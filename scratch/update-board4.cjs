const fs = require('fs')

let content = fs.readFileSync('src/codenames/components/CodenamesBoard.jsx', 'utf8')

// C5
content = content.replace(
  /<div className="cn-nav-left">[\s\S]*?<button className="cn-nav-btn players-btn" aria-label="Players">[\s\S]*?<Icon type="users" \/>[\s\S]*?<span className="cn-players-badge">\{room\.players\.length\}<\/span>[\s\S]*?<\/button>[\s\S]*?<button className="cn-nav-btn undo-btn" aria-label="Undo">[\s\S]*?<Icon type="undo" \/>[\s\S]*?<\/button>[\s\S]*?<\/div>/,
  `<div className="cn-nav-left">
          <div className="cn-nav-btn players-btn" role="status" aria-label={\`\$\{room.players.length\} players\`}>
            <Icon type="users" />
            <span className="cn-players-badge">{room.players.length}</span>
          </div>
        </div>`
)

fs.writeFileSync('src/codenames/components/CodenamesBoard.jsx', content)
console.log('done updating board 3')
