const fs = require('fs')

// --- 1. UPDATE JSX ---
let jsxContent = fs.readFileSync('src/codenames/components/CodenamesBoard.jsx', 'utf8')

// Insert <div className="cn-game-main"> after cn-game-nav
jsxContent = jsxContent.replace(
  /<\/div>\r?\n\r?\n      <div className="cn-status-row">/,
  `</div>\n\n      <div className="cn-game-main">\n      <div className="cn-status-row">`
)

// Insert </div> after the clue control / clue error block.
// The block ends around line 217 before {showSettings && (
jsxContent = jsxContent.replace(
  /      \{showSettings && \(/,
  `      </div>\n\n      {showSettings && (`
)

fs.writeFileSync('src/codenames/components/CodenamesBoard.jsx', jsxContent)
console.log('done JSX')

// --- 2. UPDATE CSS ---
let cssContent = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

// Remove margin-top: auto from .cn-status-row
cssContent = cssContent.replace(
  /\.cn-status-row \{ position: relative; display: flex; align-items: center; justify-content: center; height: calc\(var\(--u\) \* 8\.7\); flex: 0 0 auto; margin-top: auto; margin-bottom: calc\(var\(--u\) \* 2\); \}/,
  `.cn-status-row { position: relative; display: flex; align-items: center; justify-content: center; height: calc(var(--u) * 8.7); flex: 0 0 auto; margin-bottom: calc(var(--u) * 2); }`
)

// Add .cn-game-main definition after .cn-game-nav
cssContent = cssContent.replace(
  /\.cn-game-nav \{[\s\S]*?\}\r?\n/,
  match => match + `.cn-game-main { flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; }\n`
)

fs.writeFileSync('src/codenames/styles/codenames.css', cssContent)
console.log('done CSS')
