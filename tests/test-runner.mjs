import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runTests() {
  const args = process.argv.slice(2)
  const testsToRun = args.length > 0 ? args : [
    'tests/phase14-clue-chat.test.mjs',
    'tests/phase25-27-qa.test.mjs'
  ]

  console.log(`Starting server for tests...`)
  const env = Object.assign({}, process.env, { PORT: 3005, TEST_URL: 'http://localhost:3005' })
  const server = spawn('node', [path.join(__dirname, '../server/server.js')], { stdio: 'pipe', env })
  
  let serverReady = false
  
  server.stdout.on('data', data => {
    if (!serverReady && data.toString().includes('running on port')) {
      serverReady = true
      runNextTest(0)
    }
  })

  server.stderr.on('data', data => {
    console.error(`[Server Error] ${data}`)
  })

  async function runNextTest(index) {
    if (index >= testsToRun.length) {
      console.log('All tests finished successfully.')
      server.kill()
      process.exit(0)
    }

    const testFile = testsToRun[index]
    console.log(`\n===================================`)
    console.log(`Running test: ${testFile}`)
    console.log(`===================================\n`)

    const testProcess = spawn('node', [testFile], { stdio: 'inherit', cwd: path.join(__dirname, '..'), env })

    testProcess.on('exit', code => {
      if (code !== 0) {
        console.error(`\nTest failed with exit code ${code}: ${testFile}`)
        server.kill()
        process.exit(code)
      } else {
        runNextTest(index + 1)
      }
    })
  }

  // Timeout if server doesn't start
  setTimeout(() => {
    if (!serverReady) {
      console.error('Server failed to start within 5 seconds.')
      server.kill()
      process.exit(1)
    }
  }, 5000)
}

runTests()
