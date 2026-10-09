const fs = require('fs')

let content = fs.readFileSync('server/server.js', 'utf8')

content = content.replace(
  /if \(!room\.players\.some\(p => p\.team === 'blue' && p\.role === 'SPYMASTER'\)\) return callback\?\.\(\{ success: false, error: 'BLUE_SPYMASTER_MISSING' \}\)[\r\n]+    const unassigned = room\.players\.find\(p => !p\.team \|\| !p\.role\)/,
  `if (!room.players.some(p => p.team === 'blue' && p.role === 'SPYMASTER')) return callback?.({ success: false, error: 'BLUE_SPYMASTER_MISSING' })
    if (!room.players.some(p => p.team === 'red' && p.role === 'OPERATIVE')) return callback?.({ success: false, error: 'RED_OPERATIVES_MISSING' })
    if (!room.players.some(p => p.team === 'blue' && p.role === 'OPERATIVE')) return callback?.({ success: false, error: 'BLUE_OPERATIVES_MISSING' })

    const unassigned = room.players.find(p => !p.team || !p.role)`
)

// Give-clue
content = content.replace(
  /if \(room\.phase !== 'BOARD_READY' && room\.phase !== 'CLUE_PHASE'\) return callback\?\.\(\{ success: false, error: 'INVALID_PHASE' \}\)[\r\n\s]+const clueStr = typeof payload\?\.clue === 'string' \? payload\.clue\.trim\(\) : ''[\r\n\s]+const num = parseInt\(payload\?\.number, 10\)[\r\n\s]+if \(!clueStr\) return callback\?\.\(\{ success: false, error: 'EMPTY_CLUE' \}\)[\r\n\s]+if \(isNaN\(num\) \|\| num < 1\) return callback\?\.\(\{ success: false, error: 'INVALID_NUMBER' \}\)[\r\n\s]+room\.currentClue = \{ word: clueStr, number: num \}/,
  `if (room.status !== 'PLAYING') return callback?.({ success: false, error: 'INVALID_PHASE' })
    if (room.phase !== 'BOARD_READY' && room.phase !== 'CLUE_PHASE') return callback?.({ success: false, error: 'INVALID_PHASE' })

    const clueStr = typeof payload?.clue === 'string' ? payload.clue.trim() : ''
    const num = Number(payload?.number)
    if (!clueStr) return callback?.({ success: false, error: 'EMPTY_CLUE' })
    if (clueStr.length > 25 || !/^[\\p{L}\\p{N}'-]+$/u.test(clueStr)) return callback?.({ success: false, error: 'INVALID_CLUE' })
    const upper = clueStr.toUpperCase()
    if (room.board.some(c => !c.revealed && String(c.word).toUpperCase() === upper)) return callback?.({ success: false, error: 'CLUE_MATCHES_BOARD_WORD' })
    if (!Number.isInteger(num) || num < 1 || num > 9) return callback?.({ success: false, error: 'INVALID_NUMBER' })
    
    room.currentClue = { word: upper, number: num, team: room.currentTeam }`
)


fs.writeFileSync('server/server.js', content)
