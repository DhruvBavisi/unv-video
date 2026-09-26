import { GAME_PHASES, PLAYER_STATUS } from './gamePhases.js'
import { connectSocket, hasListenersAttached, markListenersAttached } from './socket.js'
import { ensureIdentity, readIdentity, setResumeToken, clearIdentity } from './identity.js'

const MEMBERSHIP = {
  NONE: 'NONE',
  JOINING: 'JOINING',
  JOINED: 'JOINED',
  LEAVING: 'LEAVING',
  LEFT: 'LEFT',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR',
}

export function createInitialState() {
  const { sessionId } = ensureIdentity()
  return {
    phase: GAME_PHASES.MODE_SELECTION,
    sessionId,
    roomId: '',
    hostId: null,
    error: '',
    copied: false,
    gameStatus: 'SETUP',
    round: 1,
    configuration: { 
      totalPlayers: 3, 
      undercover: 1, 
      mrWhite: 0, 
      civilians: 2,
      specialRoles: { joyFool: false, duelists: false, lovers: false, revenger: false, boomerang: false, goddessOfJustice: false, ghost: false, falafelVendor: false, mrMeme: false }
    },
    category: import.meta.env.PROD ? 'random' : 'open-file',
    players: [],
    localSecret: null,
    connectionState: 'DISCONNECTED',
    membershipState: MEMBERSHIP.NONE,
    clues: [],
    chat: [],
    submittedCluePlayerIds: [],
    gamePhase: null,
    votes: {},
    lockedVotes: [],
    lockedVotes: [],
    voteResult: null,
    eliminationResult: null,
    mrWhiteGuesserId: null,
    mrWhiteLiveGuess: '',
    winner: null,
    specialRoleOutcomes: [],
  }
}

const localPlayer = (state) => state.players.find((p) => p.id === state.sessionId)
const canStart = (state) => {
  const host = state.hostId === state.sessionId
  if (!host) return false
  return state.players.length === state.configuration.totalPlayers &&
    state.players.every((p) => p.status === PLAYER_STATUS.READY)
}

// Single source of truth for mapping an authoritative room snapshot to the
// client-side phase. Shared by ROOM_STATE and SESSION_RECONNECTED so the two
// paths can never drift apart.
// - becomingActive: this snapshot marks the transition into an ACTIVE game
//   (used to land on ROLE_REVEAL exactly once).
function phaseFromRoom(room, { prevPhase, sessionId, becomingActive }) {
  const meInRoom = room.players.some((p) => p.id === sessionId)
  const isLobby = room.status === 'LOBBY' || room.status === undefined
  const isCluePhase = room.phase === 'ACTIVE' && room.gamePhase === 'CLUE'
  const isVotePhase = room.phase === 'ACTIVE' && room.gamePhase === 'VOTE'
  const isElimination = room.phase === 'ACTIVE' && room.gamePhase === 'ELIMINATION'
  const isMrWhiteGuess = room.phase === 'ACTIVE' && room.gamePhase === 'MR_WHITE_GUESS'
  const isResult = room.phase === 'ACTIVE' && room.gamePhase === 'RESULT'

  if (isCluePhase) return GAME_PHASES.CLUE_PHASE
  if (isVotePhase) return GAME_PHASES.VOTE_PHASE
  if (isElimination) return GAME_PHASES.ELIMINATION_PHASE
  // MR_WHITE_GUESS keeps the overlay alive — render as ELIMINATION_PHASE
  if (isMrWhiteGuess) return GAME_PHASES.ELIMINATION_PHASE
  if (isResult) return GAME_PHASES.RESULT_PHASE
  if (becomingActive && meInRoom) return GAME_PHASES.CLUE_PHASE
  if (meInRoom && isLobby) return GAME_PHASES.ROOM_LOBBY
  if (prevPhase === GAME_PHASES.ROOM_LOBBY && meInRoom) return GAME_PHASES.ROOM_LOBBY
  if (!meInRoom) return GAME_PHASES.MODE_SELECTION
  return prevPhase
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'SELECT_ONLINE': return { ...state, phase: GAME_PHASES.ONLINE_SETUP, error: '' }
    case 'BACK_TO_MODE': return { ...state, phase: GAME_PHASES.MODE_SELECTION, error: '' }
    case 'OPEN_CREATE': return { ...state, phase: GAME_PHASES.CREATE_ROOM, error: '' }
    case 'OPEN_JOIN': return { ...state, phase: GAME_PHASES.JOIN_ROOM, error: '' }
    case 'UPDATE_FIELD': return { ...state, [action.field]: action.value, error: '' }
    case 'SET_ERROR': return { ...state, error: action.error }
    case 'COPY_ROOM': return { ...state, copied: true }
    case 'ROOM_CREATED': {
      console.log('[ROOM] transitioning to lobby', { roomId: action.room.roomId })
      const room = action.room
      return {
        ...state,
        roomId: room.roomId,
        hostId: room.hostId,
        phase: GAME_PHASES.ROOM_LOBBY,
        players: room.players,
        configuration: room.configuration,
        category: room.category || state.category,
        membershipState: MEMBERSHIP.JOINED,
        error: '',
      }
    }
    case 'ROOM_STATE': {
      const room = action.room
      const meInRoom = room.players.some((p) => p.id === state.sessionId)
      const newPhase = phaseFromRoom(room, {
        prevPhase: state.phase,
        sessionId: state.sessionId,
        becomingActive: room.status === 'ACTIVE' && state.gameStatus !== 'ACTIVE',
      })
      console.log(`[ELIMINATION DEBUG]\nCLIENT PHASE=${newPhase}\nELIMINATION RESULT=`, room.eliminationResult)

      const newMembership = !meInRoom
        ? MEMBERSHIP.NONE
        : state.membershipState === MEMBERSHIP.LEAVING
          ? MEMBERSHIP.NONE
          : meInRoom ? MEMBERSHIP.JOINED : state.membershipState

      return {
        ...state,
        roomId: meInRoom ? room.roomId : '',
        hostId: meInRoom ? room.hostId : null,
        players: room.players,
        configuration: room.configuration,
        category: room.category || state.category,
        round: room.round || state.round,
        connectionState: 'CONNECTED',
        gameStatus: room.status === 'ACTIVE' ? 'ACTIVE' : state.gameStatus,
        phase: newPhase,
        membershipState: newMembership,
        clues: room.clues || state.clues,
        chat: room.chat || state.chat,
        currentTurnPlayerId: room.currentTurnPlayerId || null,
        turnOrder: room.turnOrder || [],
        submittedCluePlayerIds: room.submittedCluePlayerIds || [],
        gamePhase: room.gamePhase || state.gamePhase,
        votes: room.votes || {},
        lockedVotes: room.lockedVotes || [],
        voteResult: room.voteResult || null,
        eliminationResult: room.eliminationResult || null,
        mrWhiteGuesserId: room.mrWhiteGuesserId || null,
        mrWhiteLiveGuess: room.mrWhiteLiveGuess ?? '',
        winner: room.winner || null,
        wordPair: room.wordPair || state.wordPair || null,
        specialRoleOutcomes: room.specialRoleOutcomes || [],
        error: '',
      }
    }
    case 'ROOM_CLOSED': {
      console.log('[ROOM] room closed')
      return {
        ...state,
        roomId: '',
        hostId: null,
        players: [],
        phase: GAME_PHASES.ONLINE_SETUP,
        membershipState: MEMBERSHIP.NONE,
        connectionState: 'CONNECTED',
        error: action.message || 'This room is no longer available.',
      }
    }
    case 'LEAVE_ROOM': {
      return {
        ...state,
        membershipState: MEMBERSHIP.LEAVING,
      }
    }
    case 'LEAVE_CONFIRMED': {
      console.log('[ROOM] leave confirmed, returning to setup')
      return {
        ...state,
        roomId: '',
        hostId: null,
        players: [],
        phase: GAME_PHASES.ONLINE_SETUP,
        membershipState: MEMBERSHIP.NONE,
        gameStatus: 'SETUP',
        configuration: { 
          totalPlayers: 3, 
          undercover: 1, 
          mrWhite: 0, 
          civilians: 2,
          specialRoles: { joyFool: false, duelists: false, lovers: false, revenger: false, boomerang: false, goddessOfJustice: false, ghost: false, falafelVendor: false, mrMeme: false }
        },
        category: import.meta.env.PROD ? 'random' : 'open-file',
        error: '',
        clues: [],
        chat: [],
        turnOrder: [],
        submittedCluePlayerIds: [],
        gamePhase: null,
        votes: {},
        lockedVotes: [],
        voteResult: null,
        eliminationResult: null,
        mrWhiteGuesserId: null,
        winner: null,
        specialRoleOutcomes: [],
      }
    }
    case 'SESSION_RECONNECTED': {
      console.log('[ROOM] session reconnected to room', { roomId: action.room.roomId })
      const room = action.room
      const activePhase = phaseFromRoom(room, {
        prevPhase: state.phase,
        sessionId: state.sessionId,
        becomingActive: room.status === 'ACTIVE',
      })

      return {
        ...state,
        roomId: room.roomId,
        hostId: room.hostId,
        phase: activePhase,
        players: room.players,
        configuration: room.configuration,
        category: room.category || state.category,
        round: room.round || state.round,
        gameStatus: room.status === 'ACTIVE' ? 'ACTIVE' : 'SETUP',
        membershipState: MEMBERSHIP.JOINED,
        connectionState: 'CONNECTED',
        clues: room.clues || [],
        chat: room.chat || [],
        currentTurnPlayerId: room.currentTurnPlayerId || null,
        turnOrder: room.turnOrder || [],
        submittedCluePlayerIds: room.submittedCluePlayerIds || [],
        gamePhase: room.gamePhase || null,
        votes: room.votes || {},
        lockedVotes: room.lockedVotes || [],
        voteResult: room.voteResult || null,
        eliminationResult: room.eliminationResult || null,
        mrWhiteGuesserId: room.mrWhiteGuesserId || null,
        mrWhiteLiveGuess: room.mrWhiteLiveGuess ?? '',
        winner: room.winner || null,
        wordPair: room.wordPair || state.wordPair || null,
        specialRoleOutcomes: room.specialRoleOutcomes || [],
        error: '',
      }
    }
    case 'SESSION_NO_ROOM': {
      return {
        ...state,
        roomId: '',
        hostId: null,
        players: [],
        phase: GAME_PHASES.ONLINE_SETUP,
        membershipState: MEMBERSHIP.NONE,
        error: '',
      }
    }
    case 'SESSION_EXPIRED': {
      clearIdentity()
      const { sessionId: freshId } = ensureIdentity()
      return {
        ...state,
        sessionId: freshId,
        roomId: '',
        hostId: null,
        players: [],
        phase: GAME_PHASES.MODE_SELECTION,
        membershipState: MEMBERSHIP.NONE,
        error: 'Your session expired. Please start again.',
      }
    }
    case 'CONNECTION_CHANGE': return { ...state, connectionState: action.state }
    case 'JOIN_FAILED': return { ...state, error: action.error, membershipState: MEMBERSHIP.NONE }
    case 'ROLE_ASSIGNED': {
      console.log('[ROLE] role assigned privately', { role: action.role, word: action.word, specialRole: action.specialRole })
      return {
        ...state,
        localSecret: { role: action.role, word: action.word, specialRole: action.specialRole },
      }
    }
    case 'CHAT_MESSAGE': {
      const exists = state.chat.some((m) => m.id === action.message.id)
      if (exists) return state
      return {
        ...state,
        chat: [...state.chat, action.message],
      }
    }
    default: return state
  }
}

export function initSocket(sid) {
  const socket = connectSocket(sid)

  if (!hasListenersAttached()) {
    markListenersAttached()

    socket.on('room-state', (room) => {
      console.log('[ROOM] ROOM_STATE_UPDATED received', room)
      dispatchRef?.({ type: 'ROOM_STATE', room })
    })

    socket.on('room-closed', (data) => {
      console.log('[ROOM] room-closed received', data)
      dispatchRef?.({ type: 'ROOM_CLOSED', message: data?.message })
    })

    socket.on('leave-confirmed', () => {
      console.log('[ROOM] leave-confirmed received')
      dispatchRef?.({ type: 'LEAVE_CONFIRMED' })
    })

    socket.on('session-reconnected', (room) => {
      console.log('[ROOM] session-reconnected received', room)
      dispatchRef?.({ type: 'SESSION_RECONNECTED', room })
    })

    socket.on('session-no-room', () => {
      console.log('[ROOM] session-no-room received')
      dispatchRef?.({ type: 'SESSION_NO_ROOM' })
    })

    socket.on('session-expired', () => {
      console.log('[ROOM] session-expired received')
      dispatchRef?.({ type: 'SESSION_EXPIRED' })
    })

    socket.on('role-assigned', ({ role, word, specialRole }) => {
      console.log('[ROLE] role-assigned received', { role, word, specialRole })
      dispatchRef?.({ type: 'ROLE_ASSIGNED', role, word, specialRole })
    })

    socket.on('session-token', ({ resumeToken, roomId, playerName }) => {
      setResumeToken(resumeToken, roomId, playerName)
    })

    socket.on('chat-message', (message) => {
      console.log('[CHAT] message received', message)
      dispatchRef?.({ type: 'CHAT_MESSAGE', message })
    })

    socket.on('mr-white-live-guess-update', ({ text }) => {
      dispatchRef?.({ type: 'UPDATE_FIELD', field: 'mrWhiteLiveGuess', value: text })
    })

    socket.on('connect', () => {
      dispatchRef?.({ type: 'CONNECTION_CHANGE', state: 'CONNECTED' })
    })

    socket.on('disconnect', () => {
      dispatchRef?.({ type: 'CONNECTION_CHANGE', state: 'RECONNECTING' })
    })
  }

  return socket
}

let dispatchRef = null

export function setDispatchRef(dispatch) {
  dispatchRef = dispatch
}

export function emitCreateRoom(socket, sessionId, playerName) {
  return new Promise((resolve) => {
    socket.emit('create-room', { sessionId, resumeToken: readIdentity().resumeToken, playerName }, (response) => {
      if (response.resumeToken) setResumeToken(response.resumeToken, response.room?.roomId, response.playerName)
      if (response.error) {
        const errorMessages = {
          INVALID_NAME: 'IDENTITY REQUIRED — enter a valid investigator name.',
          INVALID_NAME_FORMAT: 'IDENTITY REQUIRED — use 2–24 letters, numbers, spaces, apostrophes, or hyphens.',
          ALREADY_IN_ROOM: 'ALREADY IN ROOM — leave the current room first.',
        }
        resolve({ error: errorMessages[response.error] || 'ROOM CREATION FAILED.' })
      } else {
        resolve({ room: response.room })
      }
    })
  })
}

export function emitJoinRoom(socket, sessionId, roomId, playerName) {
  console.log('[ROOM] join requested', { roomId, playerId: sessionId })
  return new Promise((resolve) => {
    socket.emit('join-room', { sessionId, resumeToken: readIdentity().resumeToken, roomId, playerName }, (response) => {
      console.log('[ROOM] ROOM_JOINED received', response)
      if (response.resumeToken) setResumeToken(response.resumeToken, response.room?.roomId, response.playerName)
      if (response.error) {
        const errorMessages = {
          ROOM_NOT_FOUND: 'CASE FILE NOT FOUND — check the room ID.',
          GAME_IN_PROGRESS: 'GAME IN PROGRESS — cannot join at this time.',
          ROOM_FULL: 'ROOM FULL — maximum players reached.',
          NAME_TAKEN: 'NAME TAKEN — choose a different investigator name.',
          INVALID_NAME: 'IDENTITY REQUIRED — enter a valid investigator name.',
          INVALID_NAME_FORMAT: 'IDENTITY REQUIRED — use 2–24 letters, numbers, spaces, apostrophes, or hyphens.',
          INVALID_ROOM_ID: 'INVALID CASE FILE — enter a valid room ID.',
          INVALID_ROOM_ID_FORMAT: 'INVALID CASE FILE — room IDs contain six letters or numbers.',
          ALREADY_IN_ROOM: 'ALREADY IN ROOM — leave the current room first.',
        }
        resolve({ error: errorMessages[response.error] || 'JOIN FAILED.' })
      } else {
        resolve({ room: response.room })
      }
    })
  })
}

export function emitLeaveRoom(socket) {
  return new Promise((resolve) => {
    socket.emit('leave-room', (response) => {
      if (response?.error) {
        resolve({ error: response.error })
      } else {
        resolve({ success: true })
      }
    })
  })
}

export function emitSubmitClue(socket, roomId, clue) {
  return new Promise((resolve) => {
    socket.emit('submit-clue', { roomId, clue }, (response) => {
      resolve(response)
    })
  })
}

export function emitSendChat(socket, roomId, text) {
  return new Promise((resolve) => {
    socket.emit('send-chat-message', { roomId, text }, (response) => {
      resolve(response)
    })
  })
}

export function emitStartCluePhase(socket) {
  socket.emit('start-clue-phase')
}

export function emitSelectVote(socket, targetId) {
  return new Promise((resolve) => {
    socket.emit('select-vote', { targetId }, (response) => {
      resolve(response)
    })
  })
}

export function emitLockVote(socket) {
  return new Promise((resolve) => {
    socket.emit('lock-vote', (response) => {
      resolve(response)
    })
  })
}

export function emitSubmitMrWhiteGuess(socket, guess) {
  return new Promise((resolve) => {
    socket.emit('submit-mr-white-guess', { guess }, (response) => {
      resolve(response)
    })
  })
}

export function emitMrWhiteLiveGuess(socket, text) {
  return new Promise((resolve) => {
    socket.emit('mr-white-live-guess', { text }, (response) => {
      resolve(response || { success: true })
    })
  })
}


export function emitAddBots(socket) {
  return new Promise((resolve) => {
    socket.emit('add-dev-bots', (response) => {
      resolve(response)
    })
  })
}

export function emitRemoveBots(socket) {
  return new Promise((resolve) => {
    socket.emit('remove-dev-bots', (response) => {
      resolve(response)
    })
  })
}

export function emitPlayAgain(socket) {
  return new Promise((resolve) => {
    socket.emit('play-again', (response) => {
      resolve(response)
    })
  })
}

export { canStart, localPlayer, MEMBERSHIP }

