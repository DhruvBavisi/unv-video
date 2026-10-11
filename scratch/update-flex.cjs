const fs = require('fs')

let cssContent = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

// Fix flex child height resolution bug
cssContent = cssContent.replace(
  /\.cn-team-col \{ flex: 0 0 calc\(var\(--u\) \* 26\); min-height: 0; margin: calc\(var\(--u\) \* 0\.6\) 0; display: flex; flex-direction: column; \}/,
  `.cn-team-col { flex: 0 0 calc(var(--u) * 26); height: calc(100% - calc(var(--u) * 1.2)); min-height: 0; margin: calc(var(--u) * 0.6) 0; display: flex; flex-direction: column; }`
)

cssContent = cssContent.replace(
  /\.cn-game-log-col \{ flex: 1; min-width: 0; min-height: 0; \}/,
  `.cn-game-log-col { flex: 1; min-width: 0; height: 100%; min-height: 0; }`
)

fs.writeFileSync('src/codenames/styles/codenames.css', cssContent)
console.log('done flex fix')
