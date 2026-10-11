const fs = require('fs')

let cssContent = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

cssContent = cssContent.replace(
  /\.cn-team-col \{ flex: 0 0 calc\(var\(--u\) \* 26\); height: auto; min-height: 0; margin: calc\(var\(--u\) \* 0\.6\) 0; display: flex; flex-direction: column; \}/,
  `.cn-team-col { flex: 0 0 calc(var(--u) * 26); height: calc(var(--u) * 44); min-height: 0; margin: calc(var(--u) * 0.6) 0; display: flex; flex-direction: column; }`
)
cssContent = cssContent.replace(
  /\.cn-game-log-col \{ flex: 1; min-width: 0; height: auto; min-height: 0; \}/,
  `.cn-game-log-col { flex: 1; min-width: 0; height: calc(var(--u) * 44); min-height: 0; }`
)

fs.writeFileSync('src/codenames/styles/codenames.css', cssContent)
console.log('done fixing heights')
