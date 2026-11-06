import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Skribbl Settings & Player Settings Redesign Tests', () => {
  it('globals.css applies the doodle blue background and uniform theme buttons to both panels', () => {
    const cssPath = path.resolve('src/shared/styles/globals.css')
    const css = fs.readFileSync(cssPath, 'utf-8')

    // Background verification
    assert.ok(css.includes('.sk-settings-panel') && css.includes('.sk-player-settings-panel'), 'Must target both settings panels')
    assert.ok(css.includes('background-color: #0d3284'), 'Must have #0d3284 base color')
    assert.ok(css.includes("background-image: url('/images/characters/skribbl/background.webp')"), 'Must have blue doodle printed background image')
    assert.ok(css.includes('border: 3px solid #2345B5'), 'Must have blue theme border')
    assert.ok(css.includes('border-radius: 20px'), 'Must have 20px border radius')

    // Theme button styling verification
    assert.ok(css.includes('.sk-theme-btn--success'), 'Must define green success theme button')
    assert.ok(css.includes('#56d325') && css.includes('#23740b'), 'Success button must have green gradient and bottom bevel shadow')
    assert.ok(css.includes('.sk-theme-btn--danger'), 'Must define red danger theme button')
    assert.ok(css.includes('#ff4d4d') && css.includes('#8b0000'), 'Danger button must have red gradient and bottom bevel shadow')
    assert.ok(css.includes('.sk-theme-btn--primary'), 'Must define blue primary theme button')
    assert.ok(css.includes('#3b82f6') && css.includes('#1e3a8a'), 'Primary button must have blue gradient and bottom bevel shadow')
    assert.ok(css.includes('.sk-theme-btn--secondary'), 'Must define secondary translucent theme button')
  })

  it('SettingsPanel.jsx uses theme buttons, blue doodle styled rows, and puts RESUME on top of LEAVE GAME', () => {
    const settingsPath = path.resolve('src/games/skribbl/components/SettingsPanel.jsx')
    const content = fs.readFileSync(settingsPath, 'utf-8')

    assert.ok(content.includes('sk-theme-btn--danger'), 'Leave game must use red theme button')
    assert.ok(content.includes('sk-theme-btn--success'), 'Resume and Stay must use green theme button')
    assert.ok(content.includes('sk-settings-panel'), 'Must use sk-settings-panel class')
    assert.ok(content.includes('sk-settings-room-row'), 'Must render room code row')
    assert.ok(content.includes('sk-settings-status-row'), 'Must render connection status row')

    // Requirement 3: Resume button on top and leave game below
    const resumeIndex = content.indexOf('RESUME')
    const leaveBtnIndex = content.indexOf('onClick={() => setConfirmLeave(true)}')
    assert.ok(resumeIndex !== -1 && leaveBtnIndex !== -1, 'Both RESUME and LEAVE GAME buttons must exist')
    assert.ok(resumeIndex < leaveBtnIndex, 'RESUME button must be placed on top of LEAVE GAME button')

    // Confirm view: STAY on top of YES, LEAVE
    const stayIndex = content.indexOf('STAY')
    const yesLeaveIndex = content.indexOf('YES, LEAVE')
    assert.ok(stayIndex !== -1 && yesLeaveIndex !== -1, 'Both STAY and YES, LEAVE must exist in confirm body')
    assert.ok(stayIndex < yesLeaveIndex, 'STAY button must be placed on top of YES, LEAVE button')

    // Origin alignment using clientWidth / clientHeight
    assert.ok(content.includes('document.documentElement.clientWidth'), 'Origin calculation must use clientWidth to avoid scrollbar offset')
  })

  it('PlayerStrip.jsx player actions modal uses blue doodle background, 24px gear icon, and identical fly-in/fly-out animation', () => {
    const playerStripPath = path.resolve('src/games/skribbl/components/PlayerStrip.jsx')
    const content = fs.readFileSync(playerStripPath, 'utf-8')

    assert.ok(content.includes('sk-player-settings-panel'), 'Player modal must use sk-player-settings-panel')
    assert.ok(content.includes('sk-player-modal-card'), 'Must render sk-player-modal-card for player details')
    assert.ok(content.includes('sk-theme-btn--danger'), 'Kick player must use red danger theme button')
    assert.ok(content.includes('sk-theme-btn--primary'), 'Vote kick must use blue primary theme button')
    assert.ok(content.includes('sk-theme-btn--secondary'), 'Cancel and Back must use secondary theme button')

    // Requirement 2: Increase gear icon size
    assert.ok(content.includes('width="24"') && content.includes('height="24"'), 'Gear icon must be enlarged to at least 24px')
    assert.ok(content.includes('width: \'28px\'') && content.includes('height: \'28px\''), 'Gear button container must be 28px')

    // Requirement 1: Origin alignment and matching fly animation for player card
    assert.ok(content.includes('getBoundingClientRect()'), 'Must capture gear button rect on click')
    assert.ok(content.includes('getOriginVars'), 'PlayerStrip must compute origin vars for identical fly animation')
    assert.ok(content.includes('ANIM_ENTERING') && content.includes('ANIM_EXITING'), 'PlayerStrip must implement entering and exiting animation states')
  })

  it('globals.css guarantees symmetric fly-in/fly-out origin alignment with disabled transitions during animation', () => {
    const cssPath = path.resolve('src/shared/styles/globals.css')
    const css = fs.readFileSync(cssPath, 'utf-8')

    assert.ok(css.includes('transition: none !important'), 'Entering and exiting states must disable transitions to prevent keyframe conflict')
    assert.ok(css.includes('@keyframes panelFlyIn') && css.includes('@keyframes panelFlyOut'), 'Must define both panelFlyIn and panelFlyOut')
    assert.ok(css.includes('.sk-gear-btn'), 'Must define .sk-gear-btn styles in globals.css')
  })

  it('DrawingToolbar.jsx toolbox row background color is reverted to solid white', () => {
    const toolbarPath = path.resolve('src/games/skribbl/components/DrawingToolbar.jsx')
    const content = fs.readFileSync(toolbarPath, 'utf-8')

    assert.ok(content.includes("background: '#ffffff'"), 'Toolbox row must have solid white background')
    assert.ok(!content.includes("background: 'rgba(255, 255, 255, 0.8)'"), 'Must remove translucent rgba background')
    assert.ok(!content.includes("backdropFilter: 'blur(12px)'"), 'Must remove backdrop blur that causes blue pattern bleed')
  })
})

