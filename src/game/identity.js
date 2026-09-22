// ============================================================
// UNDERCOVER — Session identity (id + server-issued resume token)
//
// The session is a device-scoped id kept in sessionStorage.  The
// server issues a private resumeToken when the device first joins a
// room; reconnecting to the same player later REQUIRES that token so
// a public session id can never be claimed by someone else.
// ============================================================

const SESSION_KEY = 'undercover-session'
const TOKEN_KEY = 'undercover-resume-token'

export function readIdentity() {
  const sessionId = sessionStorage.getItem(SESSION_KEY)
  const resumeToken = sessionStorage.getItem(TOKEN_KEY) || null
  return { sessionId, resumeToken }
}

// Returns a guaranteed-present session id (creating + persisting one
// the first time it runs).
export function ensureIdentity() {
  let sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }
  return { sessionId, resumeToken: sessionStorage.getItem(TOKEN_KEY) || null }
}

export function setResumeToken(token) {
  if (typeof token === 'string' && token) {
    sessionStorage.setItem(TOKEN_KEY, token)
  }
}

export function clearIdentity() {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}