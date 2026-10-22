// ============================================================
// UNDERCOVER — Session identity (id + server-issued resume token)
//
// The session is a device-scoped id kept in localStorage.  The
// server issues a private resumeToken when the device first joins a
// room; reconnecting to the same player later REQUIRES that token so
// a public session id can never be claimed by someone else.
// ============================================================

const SESSION_KEY = 'undercover-session'
const TOKEN_KEY = 'undercover-resume-token'
const ROOM_KEY = 'undercover-room-id'
const NAME_KEY = 'undercover-player-name'
const MODE_KEY = 'undercover-game-mode'

const memoryStorage = {}

function getStorage(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return memoryStorage[key] || null
  }
}

function setStorage(key, val) {
  try {
    localStorage.setItem(key, val)
  } catch {
    memoryStorage[key] = val
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    delete memoryStorage[key]
  }
}

// Generate RFC4122 v4 UUID safely across all environments
// (including insecure HTTP contexts on mobile LAN where crypto.randomUUID is undefined)
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // Fallback if randomUUID fails
    }
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40 // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80 // Variant 10xx
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    } catch {
      // Fallback
    }
  }

  // Pure Math.random fallback (RFC4122 compliant UUID v4)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function readIdentity() {
  const sessionId = getStorage(SESSION_KEY)
  const resumeToken = getStorage(TOKEN_KEY) || null
  const roomId = getStorage(ROOM_KEY) || null
  const playerName = getStorage(NAME_KEY) || null
  const gameMode = getStorage(MODE_KEY) || null
  return { sessionId, resumeToken, roomId, playerName, gameMode }
}

// Returns a guaranteed-present session id (creating + persisting one
// the first time it runs).
export function ensureIdentity() {
  let sessionId = getStorage(SESSION_KEY)
  if (!sessionId) {
    sessionId = generateUUID()
    setStorage(SESSION_KEY, sessionId)
  }
  return { sessionId, resumeToken: getStorage(TOKEN_KEY) || null }
}

export function setResumeToken(token, roomId, playerName, gameMode) {
  if (typeof token === 'string' && token) {
    setStorage(TOKEN_KEY, token)
  }
  if (typeof roomId === 'string' && roomId) {
    setStorage(ROOM_KEY, roomId)
  }
  if (typeof playerName === 'string' && playerName) {
    setStorage(NAME_KEY, playerName)
  }
  if (typeof gameMode === 'string' && gameMode) {
    setStorage(MODE_KEY, gameMode)
  }
}

export function clearIdentity() {
  removeStorage(SESSION_KEY)
  removeStorage(TOKEN_KEY)
  removeStorage(ROOM_KEY)
  removeStorage(NAME_KEY)
  removeStorage(MODE_KEY)
}

// Clear room-specific credentials but keep the device session id.
// Used when a reconnect fails (room destroyed, session expired, etc.)
export function clearSession() {
  removeStorage(TOKEN_KEY)
  removeStorage(ROOM_KEY)
  removeStorage(NAME_KEY)
  removeStorage(MODE_KEY)
}

// Returns true if there is a persisted room session worth attempting to restore.
export function hasPendingSession() {
  const resumeToken = getStorage(TOKEN_KEY)
  const roomId = getStorage(ROOM_KEY)
  return !!(resumeToken && roomId)
}