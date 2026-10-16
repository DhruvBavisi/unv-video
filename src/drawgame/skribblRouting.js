/**
 * Pure routing helpers for Skribbl phase navigation and individual lobby entry.
 * Usable by React components (SkribblApp, DrawingPhase) and Node.js test runners.
 */

export function shouldRenderIndividualLobby(room, sessionId) {
  const me = room?.players?.find(p => p.id === sessionId)
  return room?.phase === 'GAME_RESULT' && Boolean(me?.playAgain)
}

export function getSkribblActiveComponent(view, roomState, sessionId) {
  if (view === 'lobby' && roomState) {
    if (roomState.phase === 'LOBBY' || shouldRenderIndividualLobby(roomState, sessionId)) {
      return 'LOBBY'
    }
    if (['WORD_CHOICE', 'DRAWING', 'ROUND_REVEAL', 'GAME_RESULT'].includes(roomState.phase)) {
      return 'DRAWING_PHASE'
    }
    return 'SHELL'
  }
  return view
}
