const fs = require('fs')

// --- 1. UPDATE JSX ---
let jsxContent = fs.readFileSync('src/codenames/components/CodenamesBoard.jsx', 'utf8')

// We need to move cn-status-row to immediately before cn-board-grid
// 1) Find cn-status-row
const statusRegex = /<div className="cn-status-row">[\s\S]*?<\/button>\r?\n      <\/div>\r?\n\r?\n/
const statusMatch = jsxContent.match(statusRegex)
if (statusMatch) {
  let statusStr = statusMatch[0]
  // Remove from current position
  jsxContent = jsxContent.replace(statusRegex, '')
  // Insert before cn-board-grid
  jsxContent = jsxContent.replace(
    /<div className="cn-board-grid">/,
    statusStr + '      <div className="cn-board-grid">'
  )
  fs.writeFileSync('src/codenames/components/CodenamesBoard.jsx', jsxContent)
  console.log('done JSX')
} else {
  console.log('status row not found in JSX')
}

// --- 2. UPDATE CSS ---
let cssContent = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

// cn-status-row flex allocation
cssContent = cssContent.replace(
  /\.cn-status-row, \.cn-clue-control \{ flex: 0 0 auto; \}/,
  `.cn-clue-control { flex: 0 0 auto; }`
)

cssContent = cssContent.replace(
  /\.cn-status-row \{ position: relative; display: flex; align-items: center; justify-content: center; height: calc\(var\(--u\) \* 8\.7\); \}/,
  `.cn-status-row { position: relative; display: flex; align-items: center; justify-content: center; height: calc(var(--u) * 8.7); flex: 0 0 auto; margin-top: auto; margin-bottom: calc(var(--u) * 2); }`
)

// cn-game-info-row allocation
cssContent = cssContent.replace(
  /flex: 2 1 calc\(var\(--u\) \* 40\);/,
  `flex: 0 0 auto;`
)
cssContent = cssContent.replace(
  /padding: calc\(var\(--u\) \* 1\) calc\(var\(--u\) \* 2\) 0;/,
  `padding: calc(var(--u) * 1.5) calc(var(--u) * 2) 0;`
)
cssContent = cssContent.replace(
  /\.cn-team-col \{ flex: 0 0 calc\(var\(--u\) \* 26\); height: calc\(var\(--u\) \* 38\);/,
  `.cn-team-col { flex: 0 0 calc(var(--u) * 26); height: calc(var(--u) * 44);`
)
cssContent = cssContent.replace(
  /\.cn-game-log-col \{ flex: 1; min-width: 0; height: calc\(var\(--u\) \* 38\);/,
  `.cn-game-log-col { flex: 1; min-width: 0; height: calc(var(--u) * 44);`
)

// cn-board-grid allocation
cssContent = cssContent.replace(
  /flex: 8 1 calc\(var\(--u\) \* 85\.6\);/,
  `flex: 0 0 auto;`
)

// codenames-card aspect ratio
cssContent = cssContent.replace(
  /position: relative; height: 100%; min-height: 0;/,
  `position: relative; aspect-ratio: 1.12 / 1; height: auto; min-height: 0;`
)

fs.writeFileSync('src/codenames/styles/codenames.css', cssContent)
console.log('done CSS')
