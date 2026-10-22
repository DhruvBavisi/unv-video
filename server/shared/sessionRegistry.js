export const sessionSockets = new Map();

export function registerSessionSocket(sessionId, socket, io) {
  let sid = sessionId;
  let sock = socket;
  if (typeof sessionId === 'object' && typeof socket === 'string') {
    sid = socket;
    sock = sessionId;
  }
  const oldSocketId = sessionSockets.get(sid);
  sessionSockets.set(sid, sock.id);
  
  if (oldSocketId && oldSocketId !== sock.id) {
    const oldSocket = io?.sockets?.sockets?.get(oldSocketId);
    if (oldSocket) {
      oldSocket.disconnect(true);
    }
  }
}

export function unregisterSessionSocket(sessionId, socketId) {
  if (!socketId || sessionSockets.get(sessionId) === socketId) {
    sessionSockets.delete(sessionId);
  }
}

export function connectPlayer(socket, sessionId, io) {
  if (typeof socket === 'string' && typeof sessionId === 'object') {
    registerSessionSocket(socket, sessionId, io);
  } else {
    registerSessionSocket(sessionId, socket, io);
  }
}

export function ensureResumeToken(player) {
  if (!player || typeof player !== 'object') return null;
  if (player.resumeToken) return player.resumeToken;
  player.resumeToken = crypto.randomUUID();
  return player.resumeToken;
}

export function getSocketIdForSession(sessionId) {
  return sessionSockets.get(sessionId);
}
