const fs = require('fs')

// --- 1. UPDATE JSX ---
let jsxContent = fs.readFileSync('src/codenames/components/CodenamesBoard.jsx', 'utf8')

const boardGridRegex = /<div className="cn-board-grid">[\s\S]*?<\/div>\r?\n\r?\n/
const boardGridMatch = jsxContent.match(boardGridRegex)

if (boardGridMatch) {
  let boardGridStr = boardGridMatch[0]
  jsxContent = jsxContent.replace(boardGridRegex, '')
  jsxContent = jsxContent.replace(
    /<div className="cn-game-info-row">/,
    boardGridStr + '      <div className="cn-game-info-row">'
  )
  fs.writeFileSync('src/codenames/components/CodenamesBoard.jsx', jsxContent)
  console.log('done JSX')
} else {
  console.log('board grid not found in JSX')
}

// --- 2. UPDATE CSS ---
let cssContent = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

// Swap the flex numbers: info row gets 3, board gets 7 (or info row gets 2, board gets 8)
// Let's use 3 and 7 to match "remove the excessive vertical height"
cssContent = cssContent.replace(
  /flex: 7 1 calc\(var\(--u\) \* 52\.9\);/,
  `flex: 2 1 calc(var(--u) * 40);`
)
cssContent = cssContent.replace(
  /padding: calc\(var\(--u\) \* 2\.4\) calc\(var\(--u\) \* 2\) 0;/,
  `padding: calc(var(--u) * 1) calc(var(--u) * 2) 0;`
)

cssContent = cssContent.replace(
  /\.cn-board-grid \{\r?\n  flex: 3 1 calc\(var\(--u\) \* 85\.6\);/,
  `.cn-board-grid {\n  flex: 8 1 calc(var(--u) * 85.6);`
)

fs.writeFileSync('src/codenames/styles/codenames.css', cssContent)
console.log('done CSS')
