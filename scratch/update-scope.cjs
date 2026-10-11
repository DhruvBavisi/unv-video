const fs = require('fs')

let cssContent = fs.readFileSync('src/codenames/styles/codenames.css', 'utf8')

// Fix scope of CSS variables so they can use --u
cssContent = cssContent.replace(
  /:root \{\r?\n  --cn-main-top-gap: 0px;/,
  `.codenames-app--game {\n  --cn-main-top-gap: 0px;`
)

fs.writeFileSync('src/codenames/styles/codenames.css', cssContent)
console.log('done CSS scope fix')
