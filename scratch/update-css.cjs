const fs = require('fs')

let content = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

content = content.replace(
  /\.cn-clue-input \{[\s\S]*?font-size:[\s\S]*?;/,
  match => match.replace(/font-size:[^;]+;/, 'font-size: max(16px, calc(var(--u) * 4.5));')
)

content = content.replace(
  /\.cn-dec-symbol \{[\s\S]*?\}/,
  `.cn-dec-symbol { font-weight: 600; color: #fff; font-size: calc(var(--u) * 4.5); margin-top: 0; }`
)

if (!content.includes('.cn-clue-error')) {
  content += '\n.cn-clue-error { flex: 0 0 auto; text-align: center; padding: calc(var(--u) * 1) calc(var(--u) * 2) 0; font-size: calc(var(--u) * 3); color: #ffb4a8; }\n'
}

fs.writeFileSync('src/codenames/styles/codenames.css', content)
console.log('done css')
