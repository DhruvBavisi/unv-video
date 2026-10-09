const fs = require('fs')

let content = fs.readFileSync('src/codenames/components/CodenamesBoard.jsx', 'utf8')

// C2
content = content.replace(
  /const handleClueSubmit = \(e\) => \{[\s\S]*?setIsSubmitting\(false\)\r?\n\s*if \(res\.success\) \{[\s\S]*?setClueNum\(1\)[\s\S]*?\}[\s\S]*?\}\)[\s\S]*?\}/,
  `const handleClueSubmit = (e) => {
    e.preventDefault()
    if (!clueWord.trim() || isSubmitting) return
    setClueError('')
    setIsSubmitting(true)
    const unlock = setTimeout(() => setIsSubmitting(false), 8000)
    const socket = connectSocket(playerId)
    socket.emit('codenames:give-clue', { clue: clueWord.trim(), number: clueNum }, (res) => {
      clearTimeout(unlock)
      setIsSubmitting(false)
      if (res?.success) { setClueWord(''); setClueNum(1) }
      else setClueError(CLUE_ERRORS[res?.error] || 'Could not send the clue.')
    })
  }`
)

// C4
content = content.replace(
  /const needsBlueSpy = room\.phase === 'BOARD_READY' && blueSpymasters\.length === 0[\s\S]*?statusMessage = \`\$\{room\.currentTeam\.toUpperCase\(\)\} TEAM'S TURN\`\r?\n\s*\}/,
  `const clueStage = room.phase === 'BOARD_READY' || room.phase === 'CLUE_PHASE'
  const isActive = (team, kind) => room.status === 'PLAYING' && team === room.currentTeam && kind === (clueStage ? 'spy' : 'ops')
  const myPlayer = room.players.find(p => p.id === playerId)
  const canSeeBoardColors = myPlayer?.role === 'SPYMASTER'
  const isMyClueTurn = room.status === 'PLAYING' && canSeeBoardColors && myPlayer?.team === room.currentTeam && clueStage

  let statusMessage = 'GAME STARTED'
  if (room.status === 'FINISHED') statusMessage = room.winner ? \`\$\{room.winner.toUpperCase()\} TEAM WINS\` : 'GAME OVER'
  else if (isMyClueTurn) statusMessage = 'GIVE YOUR OPERATIVES A CLUE'
  else if (room.phase === 'GUESS_PHASE' && room.currentClue) statusMessage = \`\$\{room.currentTeam.toUpperCase()\} CLUE: \$\{room.currentClue.word\} \$\{room.currentClue.number\}\`
  else if (room.currentTeam) statusMessage = \`\$\{room.currentTeam.toUpperCase()\} TEAM'S TURN\``
)

fs.writeFileSync('src/codenames/components/CodenamesBoard.jsx', content)
console.log('done updating board 2')
