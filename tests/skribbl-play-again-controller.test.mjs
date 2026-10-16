import assert from 'node:assert/strict'
import { PlayAgainRequestController } from '../src/drawgame/skribblRouting.js'

let activeTimers
let timerIdSeq
let emitCalls
let submittingState
let errorState
let controller

function resetController() {
  activeTimers = new Map()
  timerIdSeq = 0
  emitCalls = []
  submittingState = false
  errorState = null

  controller = new PlayAgainRequestController({
    onSubmittingChange: value => { submittingState = value },
    onErrorChange: value => { errorState = value },
    emit: (event, callback) => emitCalls.push({ event, callback }),
    getFriendlyError: () => null,
    timeoutMs: 7000,
    setTimeoutFn: (fn, delay) => {
      const id = ++timerIdSeq
      activeTimers.set(id, { fn, delay })
      return id
    },
    clearTimeoutFn: id => activeTimers.delete(id)
  })
}

function fireTimer(id) {
  const timer = activeTimers.get(id)
  if (!timer) return false
  activeTimers.delete(id)
  timer.fn()
  return true
}

console.log('Running standalone PlayAgainRequestController tests...')

// 1. Offline submission displays an error and emits no event.
resetController()
const offlineRes = controller.submit({ isConnected: false, isAlreadyOptedIn: false })
assert.strictEqual(offlineRes.ok, false)
assert.strictEqual(offlineRes.reason, 'NOT_CONNECTED')
assert.strictEqual(submittingState, false)
assert.strictEqual(errorState, 'Not connected to server.')
assert.strictEqual(emitCalls.length, 0, 'Offline submission must not emit any event')
assert.strictEqual(activeTimers.size, 0, 'No timer should be scheduled when offline')
console.log('✓ Offline submission displays error and emits no event')

// 2. A connected submission emits draw:play-again once; duplicate submission is prevented.
resetController()
const connectedRes = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
assert.strictEqual(connectedRes.ok, true)
assert.strictEqual(submittingState, true)
assert.strictEqual(errorState, null)
assert.strictEqual(emitCalls.length, 1)
assert.strictEqual(emitCalls[0].event, 'draw:play-again')
assert.strictEqual(activeTimers.size, 1)

// Duplicate submission while in flight
const dupRes = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
assert.strictEqual(dupRes.ok, false)
assert.strictEqual(dupRes.reason, 'PREVENTED_DUPLICATE')
assert.strictEqual(emitCalls.length, 1, 'Duplicate submission must not emit another event')

// Duplicate submission when already opted in
controller.setSubmitting(false)
const optedInRes = controller.submit({ isConnected: true, isAlreadyOptedIn: true })
assert.strictEqual(optedInRes.ok, false)
assert.strictEqual(optedInRes.reason, 'PREVENTED_DUPLICATE')
assert.strictEqual(emitCalls.length, 1, 'Opted-in submission must not emit another event')
console.log('✓ Connected submission emits draw:play-again once and duplicate submissions are prevented')

// 3. Timeout clears submitting state, displays the timeout error, and invalidates the request ID.
resetController()
const timeoutReq = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
assert.strictEqual(timeoutReq.ok, true)
const timeoutTimerId = timerIdSeq
const originalReqId = timeoutReq.reqId

const fired = fireTimer(timeoutTimerId)
assert.strictEqual(fired, true)
assert.strictEqual(submittingState, false, 'Timeout must clear submitting state')
assert.strictEqual(errorState, 'Request timed out. Please try again.')
assert.notStrictEqual(controller.activeReqId, originalReqId, 'Timeout must invalidate the active request ID')
assert.strictEqual(activeTimers.size, 0, 'Timeout timer must be cleared after firing')
console.log('✓ Timeout clears submitting state, displays timeout error, and invalidates request ID')

// 4. A late acknowledgement after timeout cannot change the error or submitting state.
resetController()
const lateReq = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
const lateTimerId = timerIdSeq
const lateReqId = lateReq.reqId
fireTimer(lateTimerId)

// Attempt late ack callback from the timed-out request
const lateResult = controller.handleResponse(lateReqId, { success: true })
assert.strictEqual(lateResult, false, 'Late acknowledgement must return false')
assert.strictEqual(submittingState, false, 'Late acknowledgement must not alter submitting state')
assert.strictEqual(errorState, 'Request timed out. Please try again.', 'Late acknowledgement cannot overwrite timeout error')
console.log('✓ Late acknowledgement after timeout cannot change error or submitting state')

// 5. Disconnect clears the pending timer, invalidates the request, and ignores its late acknowledgement.
resetController()
const disconnectReq = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
const disconnectReqId = disconnectReq.reqId
assert.strictEqual(activeTimers.size, 1)

controller.handleDisconnect()
assert.strictEqual(submittingState, false, 'Disconnect must reset submitting state')
assert.strictEqual(errorState, 'Connection lost. Please try again.')
assert.strictEqual(activeTimers.size, 0, 'Disconnect must clear pending timeout timer')
assert.notStrictEqual(controller.activeReqId, disconnectReqId, 'Disconnect must invalidate request ID')

const ackAfterDisconnect = controller.handleResponse(disconnectReqId, { success: true })
assert.strictEqual(ackAfterDisconnect, false, 'Late ack after disconnect must be ignored')
assert.strictEqual(submittingState, false)
assert.strictEqual(errorState, 'Connection lost. Please try again.')
console.log('✓ Disconnect clears pending timer, invalidates request, and ignores late acknowledgement')

// 6. A new submission after recovery succeeds; an old callback cannot modify its state.
resetController()
const firstReq = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
const firstReqId = firstReq.reqId
controller.handleDisconnect()

// Reconnect & new submission
const secondReq = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
assert.strictEqual(secondReq.ok, true)
assert.strictEqual(submittingState, true)
assert.strictEqual(errorState, null)
assert.strictEqual(activeTimers.size, 1)

// Old callback from firstReq arrives
const staleCallbackRes = controller.handleResponse(firstReqId, { success: false, error: 'OLD_ERROR' })
assert.strictEqual(staleCallbackRes, false, 'Stale callback must be ignored')
assert.strictEqual(submittingState, true, 'Stale callback must not alter newer submitting state')
assert.strictEqual(errorState, null, 'Stale callback must not overwrite newer error state')
console.log('✓ New submission after recovery succeeds; old callback cannot modify its state')

// 7. The current request's acknowledgement is accepted and clears its timeout.
resetController()
const validReq = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
assert.strictEqual(validReq.ok, true)
assert.strictEqual(activeTimers.size, 1)
const validReqId = validReq.reqId

const accepted = controller.handleResponse(validReqId, { success: true })
assert.strictEqual(accepted, true, 'Current request acknowledgement must be accepted')
assert.strictEqual(submittingState, false)
assert.strictEqual(errorState, null)
assert.strictEqual(activeTimers.size, 0, 'Acknowledgement must clear timeout timer')
console.log('✓ Current request acknowledgement is accepted and clears its timeout')

// 8. Unmount cleanup: start a request, call controller.cleanup(), then invoke its saved acknowledgement callback.
// Assert that the callback cannot change submitting/error state and all pending timers are cleared.
resetController()
const unmountReq = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
assert.strictEqual(unmountReq.ok, true)
assert.strictEqual(submittingState, true)
assert.strictEqual(activeTimers.size, 1)
const unmountReqId = unmountReq.reqId
const savedCallback = emitCalls[0].callback

// Call cleanup (component unmount)
controller.cleanup()
assert.strictEqual(activeTimers.size, 0, 'Cleanup must clear all pending timers')

// Now simulate invoking the saved acknowledgement callback
const cleanupAckResult = controller.handleResponse(unmountReqId, { success: true })
assert.strictEqual(cleanupAckResult, false, 'Acknowledgement after cleanup must be ignored')
// State callbacks should not be touched by late ack
assert.strictEqual(submittingState, true, 'Submitting state in controller is unaffected by late ack')
assert.strictEqual(errorState, null, 'Error state is unaffected by late ack')
console.log('✓ Unmount cleanup invalidates pending request, clears timers, and ignores late callback')

console.log('\n======================================================')
console.log('ALL PLAYAGAIN REQUEST CONTROLLER TESTS PASSED!')
console.log('======================================================\n')
