const fs = require('fs')

let cssContent = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

const varsBlock = `
/* =========================================================
   CND GAME LAYOUT — MANUAL SIZING CONTROLS
   Adjust these values to manually tune the composition.
   ========================================================= */
:root {
  --cn-main-top-gap: 0px;
  --cn-main-bottom-gap: 0px;

  --cn-status-height: calc(var(--u) * 8.7);
  --cn-status-board-gap: calc(var(--u) * 2);

  --cn-board-width: 100%;
  --cn-board-card-ratio: 1.12 / 1;

  --cn-info-height: calc(var(--u) * 48); /* Approx +20px over previous */
  --cn-info-board-gap: calc(var(--u) * 1.5);

  --cn-clue-height: auto;
}
`

// Inject varsBlock just before .codenames-app--game
cssContent = cssContent.replace(
  /\/\* ===== 2\. MAIN GAME PAGE/,
  varsBlock + '\n/* ===== 2. MAIN GAME PAGE'
)

// Apply vars to .cn-game-main
cssContent = cssContent.replace(
  /\.cn-game-main \{ flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; \}/,
  `.cn-game-main { flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 0; padding-top: var(--cn-main-top-gap); padding-bottom: var(--cn-main-bottom-gap); }`
)

// Apply vars to .cn-status-row
cssContent = cssContent.replace(
  /\.cn-status-row \{ position: relative; display: flex; align-items: center; justify-content: center; height: calc\(var\(--u\) \* 8\.7\); flex: 0 0 auto; margin-bottom: calc\(var\(--u\) \* 2\); \}/,
  `.cn-status-row { position: relative; display: flex; align-items: center; justify-content: center; height: var(--cn-status-height); flex: 0 0 auto; margin-bottom: var(--cn-status-board-gap); }`
)

// Apply vars to .cn-board-grid
cssContent = cssContent.replace(
  /width: 100%;/,
  `width: var(--cn-board-width);`
)

// Apply vars to .codenames-card
cssContent = cssContent.replace(
  /aspect-ratio: 1\.12 \/ 1;/,
  `aspect-ratio: var(--cn-board-card-ratio);`
)

// Apply vars to .cn-game-info-row
cssContent = cssContent.replace(
  /\.cn-game-info-row \{[\s\S]*?padding: calc\(var\(--u\) \* 1\.5\) calc\(var\(--u\) \* 2\) 0;\r?\n\}/,
  `.cn-game-info-row {
  flex: 0 0 auto;
  height: var(--cn-info-height);
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: calc(var(--u) * 1.9);
  padding: var(--cn-info-board-gap) calc(var(--u) * 2) 0;
}`
)

// Remove fixed heights from child columns so they stretch to --cn-info-height
cssContent = cssContent.replace(
  /\.cn-team-col \{ flex: 0 0 calc\(var\(--u\) \* 26\); height: calc\(var\(--u\) \* 44\); min-height: 0; margin: calc\(var\(--u\) \* 0\.6\) 0; display: flex; flex-direction: column; \}/,
  `.cn-team-col { flex: 0 0 calc(var(--u) * 26); min-height: 0; margin: calc(var(--u) * 0.6) 0; display: flex; flex-direction: column; }`
)
cssContent = cssContent.replace(
  /\.cn-game-log-col \{ flex: 1; min-width: 0; height: calc\(var\(--u\) \* 44\); min-height: 0; \}/,
  `.cn-game-log-col { flex: 1; min-width: 0; min-height: 0; }`
)

// Apply vars to .cn-clue-control
cssContent = cssContent.replace(
  /\.cn-clue-control \{[\s\S]*?gap: calc\(var\(--u\) \* 1\.5\);\r?\n\}/,
  match => match.replace('display: flex;', 'display: flex;\n  height: var(--cn-clue-height);')
)

fs.writeFileSync('src/codenames/styles/codenames.css', cssContent)
console.log('done CSS config')
