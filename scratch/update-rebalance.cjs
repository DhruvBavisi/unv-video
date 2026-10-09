const fs = require('fs')

let content = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

// 1
content = content.replace(
  /\.cn-game-info-row, \.cn-status-row, \.cn-clue-control \{ flex: 0 0 auto; \}/,
  `.cn-status-row, .cn-clue-control { flex: 0 0 auto; }`
)

// 2
content = content.replace(
  /\.cn-game-info-row \{ display: flex; align-items: center; justify-content: space-between; gap: calc\(var\(--u\) \* 1\.9\); padding: calc\(var\(--u\) \* 2\.4\) calc\(var\(--u\) \* 2\) 0; \}\r?\n\.cn-team-col \{ flex: 0 0 calc\(var\(--u\) \* 26\); height: calc\(var\(--u\) \* 49\.3\); display: flex; flex-direction: column; \}\r?\n\.cn-game-log-col \{ flex: 1; min-width: 0; height: calc\(var\(--u\) \* 50\.5\); \}/,
  `.cn-game-info-row {
  flex: 7 1 calc(var(--u) * 52.9);
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: calc(var(--u) * 1.9);
  padding: calc(var(--u) * 2.4) calc(var(--u) * 2) 0;
}
.cn-team-col { flex: 0 0 calc(var(--u) * 26); height: auto; min-height: 0; margin: calc(var(--u) * 0.6) 0; display: flex; flex-direction: column; }
.cn-game-log-col { flex: 1; min-width: 0; height: auto; min-height: 0; }`
)

// 3
content = content.replace(
  /position: relative; flex: 0 0 calc\(var\(--u\) \* 18\); box-sizing: border-box;/,
  `position: relative; flex: 36.5 1 0; min-height: 0; box-sizing: border-box;`
)

// 4
content = content.replace(
  /\.cn-score-section \{ flex: 1; display: flex; align-items: center; justify-content: center; gap: calc\(var\(--u\) \* 2\.4\); \}/,
  `.cn-score-section { flex: 27 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; gap: calc(var(--u) * 2.4); }`
)

// 5
content = content.replace(
  /\.cn-board-grid \{\r?\n  flex: 1 1 auto;/,
  `.cn-board-grid {\n  flex: 3 1 calc(var(--u) * 85.6);`
)

fs.writeFileSync('src/codenames/styles/codenames.css', content)
console.log('done updating viewport rebalance styles')
