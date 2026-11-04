import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Skribbl Guess Input Keyboard Scroll Behavior', () => {
  it('CSS defines padding-bottom clearance on .sk-game-body when keyboard is open', () => {
    const cssContent = fs.readFileSync(path.resolve('src/shared/styles/globals.css'), 'utf-8')
    assert.ok(
      cssContent.includes('html.sk-kb-open .sk-game-body'),
      'globals.css must style html.sk-kb-open .sk-game-body'
    )
    assert.ok(
      cssContent.includes('padding-bottom: calc(var(--sk-kb-lift, 0px) + 54px) !important'),
      'globals.css must apply padding-bottom with clearance for lifted dock'
    )
    assert.ok(
      cssContent.includes('-webkit-overflow-scrolling: touch !important'),
      'globals.css must ensure native touch momentum scrolling on .sk-game-body'
    )
  })

  it('CSS ensures lower panel inner columns are not crushed to 0px when keyboard is open', () => {
    const cssContent = fs.readFileSync(path.resolve('src/shared/styles/globals.css'), 'utf-8')
    assert.ok(
      cssContent.includes('html.sk-kb-open .sk-lower-info-section > div'),
      'globals.css must handle html.sk-kb-open .sk-lower-info-section > div'
    )
    assert.ok(
      cssContent.includes('max-height: none !important'),
      'globals.css must override max-height crush on lower info columns'
    )
  })

  it('CSS defines solid theme-white apron extending below the guess dock for translucent iOS keyboards', () => {
    const cssContent = fs.readFileSync(path.resolve('src/shared/styles/globals.css'), 'utf-8')
    assert.ok(
      cssContent.includes('.sk-guess-dock::after'),
      'globals.css must define .sk-guess-dock::after'
    )
    assert.ok(
      cssContent.includes('background: var(--sk-surface, #ffffff)'),
      '.sk-guess-dock::after must use theme white surface color'
    )
    assert.ok(
      cssContent.includes('top: 100%'),
      '.sk-guess-dock::after must attach directly to the bottom of the dock'
    )
  })

  it('CSS disables in and out animations on the input dock for instantaneous positioning', () => {
    const cssContent = fs.readFileSync(path.resolve('src/shared/styles/globals.css'), 'utf-8')
    assert.ok(
      cssContent.includes('.sk-guess-dock {\n  flex: none;\n  position: relative;\n  z-index: 10;\n  display: flex;\n  width: 100%;\n  padding: 0;\n  background: var(--sk-surface);\n  border-top: 1px solid rgba(0, 0, 0, 0.08);\n  box-sizing: border-box;\n  box-shadow: 0 0 0 rgba(0, 0, 0, 0);\n  /* Instant positioning with zero in/out animation */\n  transition: none !important;'),
      'globals.css must disable animations on .sk-guess-dock with transition: none !important'
    )
    assert.ok(
      cssContent.includes('.sk-guess-dock-inner {\n  width: 100%;\n  display: flex;\n  transform: none !important;\n  opacity: 1 !important;\n  transition: none !important;'),
      'globals.css must disable entrance/exit animations on .sk-guess-dock-inner'
    )
  })

  it('DrawingPhase removes 1000ms transition on canvas and lower info panel', () => {
    const drawingPhaseContent = fs.readFileSync(path.resolve('src/games/skribbl/components/DrawingPhase.jsx'), 'utf-8')
    assert.ok(
      !drawingPhaseContent.includes('transition: flex 1000ms'),
      'DrawingPhase must not contain 1000ms flex transition'
    )
    assert.ok(
      !drawingPhaseContent.includes('transition: height 1000ms'),
      'DrawingPhase must not contain 1000ms height transition'
    )
  })

  it('useGuessKeyboard accurately tracks continuous touch movements and resets scroll instantly on close', () => {
    const hookContent = fs.readFileSync(path.resolve('src/games/skribbl/hooks/useGuessKeyboard.js'), 'utf-8')
    assert.ok(
      hookContent.includes('lastTouchY = currentY'),
      'useGuessKeyboard must update lastTouchY on each touchmove for accurate directional scrolling'
    )
    assert.ok(
      hookContent.includes("document.querySelector('.sk-game-body')"),
      'useGuessKeyboard must locate .sk-game-body on resetAll'
    )
    assert.ok(
      hookContent.includes('gameBody.scrollTop = 0'),
      'useGuessKeyboard must immediately reset .sk-game-body scroll with zero animation on keyboard close'
    )
  })

  it('useGuessKeyboard immediately positions dock on focus and blur without delay', () => {
    const hookContent = fs.readFileSync(path.resolve('src/games/skribbl/hooks/useGuessKeyboard.js'), 'utf-8')
    assert.ok(
      hookContent.includes('setLift(estimateKb)'),
      'onInputFocus must immediately position dock via setLift(estimateKb)'
    )
    assert.ok(
      hookContent.includes('setLift(0)'),
      'onInputBlur must immediately reset dock via setLift(0)'
    )
    assert.ok(
      hookContent.includes('getIphoneKeyboardEstimate'),
      'useGuessKeyboard must provide calibrated iPhone keyboard estimate'
    )
  })
})
