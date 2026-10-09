const fs = require('fs')

let content = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

// 1
content = content.replace(
  /\.codenames-app--game \{[\s\S]*?\}/,
  `.codenames-app--game {
  --u: min(1vw, 4.8px);
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  overscroll-behavior: none;
  padding: 0;
  align-items: center;
  background: linear-gradient(180deg, #040309 0%, #0b0c11 10%, #161924 22%, #232a38 34%, #223347 46%, #263a4e 70%, #2a4256 100%);
}`
)

// 2
content = content.replace(
  /min-height: 100dvh;/,
  `height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-top: max(env(safe-area-inset-top, 0px), 12px);`
)
content = content.replace(
  /padding-bottom: calc\(var\(--u\) \* 3\);/,
  `padding-bottom: max(env(safe-area-inset-bottom, 0px), calc(var(--u) * 2));`
)

// 3
content = content.replace(
  /\.cn-game-nav \{ display: flex; justify-content: space-between; align-items: center; padding: calc\(env\(safe-area-inset-top, 0px\) \+ var\(--u\) \* 0\.9\) calc\(var\(--u\) \* 1\.1\) 0; \}/,
  `.cn-game-nav { display: flex; justify-content: space-between; align-items: center; padding: calc(var(--u) * 0.9) calc(var(--u) * 1.1) 0; flex: 0 0 auto; }`
)

// 4
content = content.replace(
  /\.cn-game-info-row \{/,
  `.cn-game-info-row, .cn-status-row, .cn-clue-control { flex: 0 0 auto; }\n.cn-game-info-row {`
)

// 5
content = content.replace(
  /\.cn-board-grid \{ display: grid; grid-template-columns: repeat\(5, 1fr\); gap: calc\(var\(--u\) \* 1\.15\) calc\(var\(--u\) \* 1\.1\); width: 100%; box-sizing: border-box; padding: 0 calc\(var\(--u\) \* 1\.4\); \}/,
  `.cn-board-grid {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: repeat(5, minmax(0, 1fr));
  gap: calc(var(--u) * 1.15) calc(var(--u) * 1.1);
  width: 100%;
  box-sizing: border-box;
  padding: 0 calc(var(--u) * 1.4) calc(var(--u) * 1.4);
}`
)

// 6
content = content.replace(
  /aspect-ratio: 109\.6 \/ 94;/,
  `height: 100%; min-height: 0;`
)

fs.writeFileSync('src/codenames/styles/codenames.css', content)
console.log('done updating viewport styles')
