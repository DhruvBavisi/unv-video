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

export function readIdentity() {
  const sessionId = localStorage.getItem(SESSION_KEY)
  const resumeToken = localStorage.getItem(TOKEN_KEY) || null
  const roomId = localStorage.getItem(ROOM_KEY) || null
  const playerName = localStorage.getItem(NAME_KEY) || null
  return { sessionId, resumeToken, roomId, playerName }
}

// Returns a guaranteed-present session id (creating + persisting one
// the first time it runs).
export function ensureIdentity() {
  let sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, sessionId)
  }
  return { sessionId, resumeToken: localStorage.getItem(TOKEN_KEY) || null }
}

export function setResumeToken(token, roomId, playerName) {
  if (typeof token === 'string' && token) {
    localStorage.setItem(TOKEN_KEY, token)
  }
  if (typeof roomId === 'string' && roomId) {
    localStorage.setItem(ROOM_KEY, roomId)
  }
  if (typeof playerName === 'string' && playerName) {
    localStorage.setItem(NAME_KEY, playerName)
  }
}

export function clearIdentity() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROOM_KEY)
  localStorage.removeItem(NAME_KEY)
}

// Clear room-specific credentials but keep the device session id.
// Used when a reconnect fails (room destroyed, session expired, etc.)
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROOM_KEY)
  localStorage.removeItem(NAME_KEY)
}

// Returns true if there is a persisted room session worth attempting to restore.
export function hasPendingSession() {
  const resumeToken = localStorage.getItem(TOKEN_KEY)
  const roomId = localStorage.getItem(ROOM_KEY)
  return !!(resumeToken && roomId)
}