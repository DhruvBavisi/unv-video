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

export class PlayAgainRequestController {
  constructor({
    onSubmittingChange,
    onErrorChange,
    emit,
    getFriendlyError,
    timeoutMs = 7000,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  } = {}) {
    this.onSubmittingChange = onSubmittingChange
    this.onErrorChange = onErrorChange
    this.emit = emit
    this.getFriendlyError = getFriendlyError
    this.timeoutMs = timeoutMs
    this.setTimeoutFn = setTimeoutFn
    this.clearTimeoutFn = clearTimeoutFn

    this.isSubmitting = false
    this.error = null
    this.activeReqId = 0
    this.timeoutHandle = null
  }

  setSubmitting(val) {
    this.isSubmitting = val
    this.onSubmittingChange?.(val)
  }

  setError(err) {
    this.error = err
    this.onErrorChange?.(err)
  }

  clearTimeout() {
    if (this.timeoutHandle !== null) {
      this.clearTimeoutFn(this.timeoutHandle)
      this.timeoutHandle = null
    }
  }

  handleDisconnect() {
    this.clearTimeout()
    this.activeReqId++
    this.setSubmitting(false)
    this.setError('Connection lost. Please try again.')
  }

  handleTimeout(reqId) {
    if (this.activeReqId === reqId) {
      // Invalidate the timed-out request ID BEFORE clearing submitting state and setting timeout error
      this.activeReqId++
      this.timeoutHandle = null
      this.setSubmitting(false)
      this.setError('Request timed out. Please try again.')
    }
  }

  handleResponse(reqId, res) {
    // If request ID has changed (due to timeout, disconnect, or newer submit), ignore stale callback
    if (this.activeReqId !== reqId) {
      return false
    }

    this.clearTimeout()
    this.setSubmitting(false)

    if (res && res.success === false) {
      const msg = res.error
        ? (this.getFriendlyError?.(res.error) || res.error)
        : 'Failed to return to lobby.'
      this.setError(msg)
    }
    return true
  }

  submit({ isConnected, isAlreadyOptedIn }) {
    if (this.isSubmitting || isAlreadyOptedIn) {
      return { ok: false, reason: 'PREVENTED_DUPLICATE' }
    }

    if (!isConnected) {
      this.setSubmitting(false)
      this.setError('Not connected to server.')
      return { ok: false, reason: 'NOT_CONNECTED' }
    }

    this.clearTimeout()
    this.setSubmitting(true)
    this.setError(null)

    const reqId = ++this.activeReqId

    this.timeoutHandle = this.setTimeoutFn(() => {
      this.handleTimeout(reqId)
    }, this.timeoutMs)

    this.emit?.('draw:play-again', (res) => {
      this.handleResponse(reqId, res)
    })

    return { ok: true, reqId }
  }

  cleanup() {
    this.clearTimeout()
  }
}

