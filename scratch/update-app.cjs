const fs = require('fs')

let content = fs.readFileSync('src/codenames/CodenamesApp.jsx', 'utf8')

// Add restoring state
content = content.replace(
  /const \[joinRoomId, setJoinRoomId\] = useState\(''\)/,
  `const [joinRoomId, setJoinRoomId] = useState('')\n  const [restoring, setRestoring] = useState(() => { const id = readIdentity(); return !!(id.resumeToken && id.roomId && id.gameMode === 'codenames') })`
)

// setRestoring(false) in handleRoomState
content = content.replace(
  /const handleRoomState = \(state\) => \{/,
  `const handleRoomState = (state) => {\n      setRestoring(false)`
)

// setRestoring(false) in handleExpired
content = content.replace(
  /const handleExpired = \(\) => \{/,
  `const handleExpired = () => {\n      setRestoring(false)`
)

// setTimeout inside socket effect
content = content.replace(
  /const socket = connectSocket\(sessionId\)/,
  `const socket = connectSocket(sessionId)\n    const t = setTimeout(() => setRestoring(false), 6000)`
)

// clear timeout
content = content.replace(
  /return \(\) => \{/,
  `return () => {\n      clearTimeout(t)`
)

// restoring JSX
content = content.replace(
  /if \(!room\) \{/,
  `if (!room && restoring) return (<div className="codenames-app codenames-setup"><div className="codenames-header"><h1>RESTORING CASE FILE...</h1></div></div>)\n\n  if (!room) {`
)

fs.writeFileSync('src/codenames/CodenamesApp.jsx', content)
console.log('done CodenamesApp')
