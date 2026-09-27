import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runTests() {
  const args = process.argv.slice(2)
  const testsToRun = args.length > 0 ? args : [
    'tests/phase14-clue-chat.test.mjs',
    'tests/phase25-27-qa.test.mjs'
  ]

  console.log(`Starting server for tests...`)
  const env = Object.assign({}, process.env, { PORT: '3005', TEST_URL: 'http://localhost:3005' })
  const server = spawn('node', [path.join(__dirname, '../server/server.js')], { stdio: 'pipe', env })

  let serverReady = false

  function killServer() {
    try { server.kill('SIGTERM') } catch {}
  }

  // Ensure server is always cleaned up
  process.on('exit', killServer)
  process.on('SIGINT', () => { killServer(); process.exit(1) })
  process.on('SIGTERM', () => { killServer(); process.exit(1) })
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception in test runner:', err)
    killServer()
    process.exit(1)
  })

  server.stdout.on('data', data => {
    if (!serverReady && data.toString().includes('running on port')) {
      serverReady = true
      runNextTest(0)
    }
  })

  server.stderr.on('data', data => {
    const msg = data.toString()
    // Only print genuine errors, not expected auth rejections
    if (msg.includes('[AUTH]')) return
    console.error(`[Server Error] ${msg}`)
  })

  async function runNextTest(index) {
    if (index >= testsToRun.length) {
      console.log('\nAll tests finished successfully.')
      killServer()
      process.exit(0)
    }

    const testFile = testsToRun[index]
    console.log(`\n===================================`)
    console.log(`Running test: ${testFile}`)
    console.log(`===================================\n`)

    // Use --test flag for node:test runner files, plain node for legacy scripts
    const isNodeTest = testFile.includes('qa.test.') || testFile.includes('node-test')
    const args = isNodeTest ? ['--test', testFile] : [testFile]
    const testProcess = spawn('node', args, { stdio: 'inherit', cwd: path.join(__dirname, '..'), env })

    testProcess.on('exit', code => {
      if (code !== 0) {
        console.error(`\nTest failed with exit code ${code}: ${testFile}`)
        killServer()
        process.exit(code || 1)
      } else {
        runNextTest(index + 1)
      }
    })

    testProcess.on('error', err => {
      console.error(`\nTest process error: ${err.message}`)
      killServer()
      process.exit(1)
    })
  }

  // Timeout if server doesn't start
  setTimeout(() => {
    if (!serverReady) {
      console.error('Server failed to start within 10 seconds.')
      killServer()
      process.exit(1)
    }
  }, 10000)
}

runTests()
