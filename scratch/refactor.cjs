const fs = require('fs');
let code = fs.readFileSync('server/server.js', 'utf8');

function extractFunc(name) {
  const startRegex = new RegExp('  function ' + name + '\\s*\\([\\s\\S]*?\\{');
  const match = code.match(startRegex);
  if (!match) throw new Error('Cannot find ' + name);
  const startIndex = match.index;
  let braceCount = 0;
  let i = startIndex + match[0].length;
  braceCount = 1; // we matched the opening brace
  while (braceCount > 0 && i < code.length) {
    if (code[i] === '{') braceCount++;
    if (code[i] === '}') braceCount--;
    i++;
  }
  const fullFunc = code.slice(startIndex, i);
  // Remove from code
  code = code.slice(0, startIndex) + code.slice(i);
  return fullFunc.trim();
}

const funcs = [
  'broadcastDrawRoomState',
  'getSafeStateForPlayer',
  'scheduleWordChoiceTimeout',
  'endDrawRound',
  'generateWordChoices'
];

let extracted = '';
for (const f of funcs) {
  // un-indent by 2 spaces for the root scope
  let funcBody = extractFunc(f);
  funcBody = funcBody.split('\n').map(l => l.startsWith('  ') ? l.slice(2) : l).join('\n');
  extracted += funcBody + '\n\n';
}

const insertAnchor = 'function disconnectDrawPlayer';
code = code.replace(insertAnchor, extracted + insertAnchor);

fs.writeFileSync('server/server.js', code);
console.log('Done refactoring');
