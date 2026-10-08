const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'codenames', 'styles', 'codenames.css');
const newCssPath = path.join(__dirname, 'scratch', 'game_board_styles.css');

const cssContent = fs.readFileSync(cssPath, 'utf8');
const newCssContent = fs.readFileSync(newCssPath, 'utf8');

const lines = cssContent.split('\n');
const startIndex = lines.findIndex(l => l.includes('/* GAME HEADER (Board View) */'));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('/* MODALS */'));

if (startIndex !== -1 && endIndex !== -1) {
  const before = lines.slice(0, startIndex);
  const after = lines.slice(endIndex);
  
  const finalCss = [...before, newCssContent, ...after].join('\n');
  fs.writeFileSync(cssPath, finalCss);
  console.log('Successfully updated codenames.css');
} else {
  console.error('Could not find markers in codenames.css');
}
