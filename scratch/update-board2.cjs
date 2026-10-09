const fs = require('fs')

let content = fs.readFileSync('src/codenames/components/CodenamesBoard.jsx', 'utf8')

// C1
content = content.replace(
  /export default function CodenamesBoard\(\{ room, playerId, onLeave \}\) \{/,
  `const CLUE_ERRORS = { EMPTY_CLUE: 'Enter a clue.', INVALID_CLUE: 'One word only, up to 25 characters.', CLUE_MATCHES_BOARD_WORD: "A clue can't be a word on the board.", INVALID_NUMBER: 'Pick a number from 1 to 9.', NOT_YOUR_TURN: "It's not your team's turn.", INVALID_PHASE: 'A clue was already given.' }\n\nexport default function CodenamesBoard({ room, playerId, onLeave }) {`
)
content = content.replace(
  /const \[isSubmitting, setIsSubmitting\] = useState\(false\)/,
  `const [isSubmitting, setIsSubmitting] = useState(false)\n  const [clueError, setClueError] = useState('')`
)

// C2
content = content.replace(
  /const handleClueSubmit = \(e\) => \{[\s\S]*?\}\n  \}/,
  `const handleClueSubmit = (e) => {
    e.preventDefault()
    if (!clueWord.trim() || isSubmitting) return
    setClueError('')
    setIsSubmitting(true)
    const unlock = setTimeout(() => setIsSubmitting(false), 8000)
    connectSocket(playerId).emit('codenames:give-clue', { clue: clueWord.trim(), number: clueNum }, (res) => {
      clearTimeout(unlock)
      setIsSubmitting(false)
      if (res?.success) { setClueWord(''); setClueNum(1) }
      else setClueError(CLUE_ERRORS[res?.error] || 'Could not send the clue.')
    })
  }`
)

// C4
content = content.replace(
  /const needsBlueSpy = room\.phase === 'BOARD_READY' && blueSpymasters\.length === 0[\s\S]*?statusMessage = \`\$\{room\.currentTeam\.toUpperCase\(\)\} TEAM'S TURN\`\n  \}/,
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

// C5 Blue
content = content.replace(
  /div className=\{\`cn-panel-content\$\{blueSpymasters\.length \? '' : ' cn-panel-content--join'\}\`\}[\s\S]*?\{blueSpymasters\.length > 0 \? blueSpymasters\.map\(renderAvatar\) : \([\s\S]*?<button className="cn-spy-join-btn"><span>JOIN TEAM<\/span><\/button>[\s\S]*?\)\}[\s\S]*?<\/div>/,
  `div className="cn-panel-content">
              {blueSpymasters.map(renderAvatar)}
            </div>`
)

// C5 Red
content = content.replace(
  /\{redSpymasters\.length > 0 \? redSpymasters\.map\(renderAvatar\) : null\}/,
  `{redSpymasters.map(renderAvatar)}`
)

// C3 Clue control
content = content.replace(
  /\{isMyClueTurn && \([\s\S]*?<form className="cn-clue-control" onSubmit=\{handleClueSubmit\}>[\s\S]*?<input[\s\S]*?onChange=\{e => setClueWord\(e\.target\.value\.toUpperCase\(\)\)\}[\s\S]*?\/>[\s\S]*?<button type="button" className="cn-clue-dec" onClick=\{[\s\S]*?\} disabled=\{isSubmitting\}>[\s\S]*?<span className="cn-dec-symbol">−<\/span>[\s\S]*?\{clueNum > 1 && <span className="cn-dec-num">\{clueNum\}<\/span>\}[\s\S]*?<\/button>[\s\S]*?<button type="submit" className="cn-clue-submit" disabled=\{!clueWord\.trim\(\) \|\| isSubmitting\}>[\s\S]*?<Icon type="up" size=\{24\} \/>[\s\S]*?<\/button>[\s\S]*?<\/form>[\s\S]*?\)\}/,
  `{isMyClueTurn && (
        <>
          {clueError && <div className="cn-clue-error" role="alert">{clueError}</div>}
          <form className="cn-clue-control" onSubmit={handleClueSubmit}>
            <input
              type="text"
              className="cn-clue-input"
              placeholder="YOUR CLUE"
              value={clueWord}
              onChange={e => { setClueWord(e.target.value.toUpperCase()); setClueError(''); }}
              disabled={isSubmitting}
              maxLength={25}
            />
            <button type="button" className="cn-clue-dec" onClick={() => setClueNum(n => (n % 9) + 1)} aria-label={\`Clue number \$\{clueNum\}, tap to change\`} disabled={isSubmitting}>
              <span className="cn-dec-symbol">{clueNum}</span>
            </button>
            <button type="submit" className="cn-clue-submit" disabled={!clueWord.trim() || isSubmitting}>
              <Icon type="up" size={24} />
            </button>
          </form>
        </>
      )}`
)

fs.writeFileSync('src/codenames/components/CodenamesBoard.jsx', content)
console.log('done updating board')
