import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Skribbl Winning Page Dev Preview Route Tests', () => {
  it('App.jsx detects dev preview parameters and routes to SkribblWinningPreview', () => {
    const appPath = path.resolve('src/app/App.jsx')
    const content = fs.readFileSync(appPath, 'utf-8')

    // Verifies preview route detection
    assert.ok(content.includes("preview === 'skribbl-winning'"), 'Must detect ?preview=skribbl-winning')
    assert.ok(content.includes("preview === 'winning'"), 'Must detect ?preview=winning')
    assert.ok(content.includes("mode === 'skribbl-winning'"), 'Must detect ?mode=skribbl-winning')
    assert.ok(content.includes('skribbl-winning-preview'), 'Must set gameView to skribbl-winning-preview')
    assert.ok(content.includes('<SkribblWinningPreview'), 'Must render SkribblWinningPreview component')
  })

  it('SkribblWinningPreview.jsx provides mock scenarios, inspector controls, device presets, and interactive play again', () => {
    const previewPath = path.resolve('src/games/skribbl/components/SkribblWinningPreview.jsx')
    const content = fs.readFileSync(previewPath, 'utf-8')

    // Verifies scenarios
    assert.ok(content.includes('SCENARIOS'), 'Must define mock scenarios')
    assert.ok(content.includes('three'), 'Must include 3 players scenario')
    assert.ok(content.includes('five'), 'Must include 5 players scenario')
    assert.ok(content.includes('eight'), 'Must include 8 players scenario')
    assert.ok(content.includes('tie'), 'Must include tie scenario')
    assert.ok(content.includes('fourteen'), 'Must include 14 players scenario')
    assert.ok(content.includes('fifteen'), 'Must include 15 players scenario')

    // Verifies all scenarios have custom avatars
    assert.ok(content.includes('avatar: { color: 15, eyes: 1, mouth: 1 }'), 'Scenario Dhruv must have assembled avatar')

    // Verifies inspector controls: jump speed, avatar randomizer, safe area simulator
    assert.ok(content.includes('jumpSpeed'), 'Must track jumpSpeed state')
    assert.ok(content.includes('handleRandomizeWinnerAvatar'), 'Must provide randomize winner avatar handler')
    assert.ok(content.includes('simulateSafeArea'), 'Must provide simulateSafeArea toggle')
    assert.ok(content.includes('usePageBackground'), 'Must sync transparent status bar safe area')

    // Verifies device width presets
    assert.ok(content.includes('WIDTH_PRESETS'), 'Must define device width presets')
    assert.ok(content.includes('375px'), 'Must include iPhone SE preset')
    assert.ok(content.includes('393px'), 'Must include iPhone 15 preset')

    // Verifies custom player count generator & interactive dev controls
    assert.ok(content.includes('export function generateCustomPlayers'), 'Must export generateCustomPlayers')
    assert.ok(content.includes('handleCustomCountChange'), 'Must provide handleCustomCountChange handler')
    assert.ok(content.includes('Custom Count:'), 'Must render Custom Count label')
    assert.ok(content.includes('type="number"'), 'Must render custom player number input')
    assert.ok(content.includes('Custom ({customCount}P)'), 'Must render custom scenario button')

    // Verifies scroll containment in dev preview
    assert.ok(content.includes('.sk-view--game.is-game-result .sk-game-body'), 'Preview must define scoped scroll containment for is-game-result')
    assert.ok(content.includes('overflow-y: hidden !important'), 'Preview must lock game-body scroll')

    // Verifies components
    assert.ok(content.includes('<FinalScores'), 'Must render FinalScores component')
    assert.ok(content.includes('<DrawingTopBar'), 'Must render DrawingTopBar')
    assert.ok(content.includes('<PlayerStrip'), 'Must render PlayerStrip')
    assert.ok(content.includes('<ChatBox'), 'Must render ChatBox')
  })

  it('FinalScores.jsx renders Skribbl trophy on side, no crown behind, short jump, and structured rows without pills', () => {
    const finalScoresPath = path.resolve('src/games/skribbl/components/FinalScores.jsx')
    const finalScoresContent = fs.readFileSync(finalScoresPath, 'utf-8')
    const cssPath = path.resolve('src/shared/styles/globals.css')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    // Trophy on side, no crown behind
    assert.ok(!finalScoresContent.includes('sk-final-crown'), 'Must NOT render crown/trophy behind winner')
    assert.ok(!finalScoresContent.includes('👑'), 'Must NOT render crown emoji behind winner')
    assert.ok(finalScoresContent.includes('export function SkribblTrophy'), 'Must export SkribblTrophy SVG component')
    assert.ok(finalScoresContent.includes('sk-final-winner-avatar-wrap'), 'Must wrap winner avatar and trophy in sk-final-winner-avatar-wrap')
    assert.ok(finalScoresContent.includes('sk-final-trophy-wrap'), 'Must render sk-final-trophy-wrap on side')

    // Short, non-glitchy jump physics
    assert.ok(cssContent.includes('skWinnerJumpLeftRight'), 'globals.css must define skWinnerJumpLeftRight keyframes')
    assert.ok(cssContent.includes('translate3d(0, 0, 0)'), 'globals.css must use hardware-accelerated translate3d')
    assert.ok(cssContent.includes('-7px'), 'globals.css must use a short jump (-7px apex, not long -34px)')
    assert.ok(cssContent.includes('skTrophyTilt'), 'globals.css must define skTrophyTilt keyframes')

    // Stage designed with crayon texture borders and top/side only borders
    assert.ok(cssContent.includes('.sk-final-box') && cssContent.includes('filter: url(#sk-crayon-stroke)'), 'Stage pedestals must use crayon texture filter')
    assert.ok(cssContent.includes('border-top: 3.5px solid') && cssContent.includes('border-bottom: none !important'), 'Stage must only have top and side borders')
    assert.ok(cssContent.includes('.sk-final-slot--third .sk-final-box') && cssContent.includes('clamp(40px'), '3rd place stage height must be clamp(40px, ...) so name and points fit')
    assert.ok(cssContent.includes('.sk-final-avatar-slot--podium') && cssContent.includes('align-items: flex-end'), 'Podium avatar slot must align to flex-end so player stands on top stage line')
    assert.ok(cssContent.includes('.sk-final-card-rank') && cssContent.includes('left: -2px'), 'Card rank must be positioned slightly more to left (left: -2px)')
    assert.ok(cssContent.includes('.sk-final-card-rank') && cssContent.includes('font-size: 0.80rem'), 'Card rank font size must be increased')
    assert.ok(cssContent.includes('.sk-final-rank') && cssContent.includes('clamp(0.95rem'), 'Podium rank font size must be increased')
    assert.ok(cssContent.includes('rotate(-6deg)') && cssContent.includes('rotate(6deg)'), 'Jump animation must have left and right tilt')
    assert.ok(cssContent.includes('.sk-final--crowded .sk-final-podium-wrap'), 'Stage must move up when crowded (>8 players)')

    // Below row player card vertical layout: Avatar on top, name below, points below, rank in corner
    assert.ok(cssContent.includes('.sk-final-player-card') && cssContent.includes('flex-direction: column'), 'Below row player cards must be vertically formatted')
    assert.ok(cssContent.includes('.sk-final-card-rank') && cssContent.includes('position: absolute'), 'Rank position must stay in the top corner')
    assert.ok(finalScoresContent.includes('sk-final-card-avatar'), 'Avatar must be rendered')
    assert.ok(finalScoresContent.includes('sk-final-card-name'), 'Name must be rendered below avatar')
    assert.ok(finalScoresContent.includes('sk-final-card-points'), 'Points must be rendered below name')

    // Removal of runner pills & structured row grid
    assert.ok(!finalScoresContent.includes('sk-final-runner-pill'), 'Must remove legacy sk-final-runner-pill')
    assert.ok(finalScoresContent.includes('sk-final-runners-section'), 'Must render sk-final-runners-section')
    assert.ok(finalScoresContent.includes('sk-final-row-group'), 'Must render sk-final-row-group')
    assert.ok(finalScoresContent.includes('sk-final-player-card'), 'Must render sk-final-player-card')
    // Dynamic balanced row partitioning (no single player in center row, stage moves up when >8 players)
    assert.ok(finalScoresContent.includes('isCrowded = ranked.length > 8'), 'Must detect when players exceed 8')
    assert.ok(finalScoresContent.includes('Math.ceil(remaining.length / remainingRows)'), 'Must evenly balance rows so no row has an orphan single player')
  })

  it('Canvas scroll lock and podium clearance guarantee stage players never hide behind winner title', () => {
    const drawingPhasePath = path.resolve('src/games/skribbl/components/DrawingPhase.jsx')
    const drawingPhaseContent = fs.readFileSync(drawingPhasePath, 'utf-8')
    const cssPath = path.resolve('src/shared/styles/globals.css')
    const cssContent = fs.readFileSync(cssPath, 'utf-8')

    // DrawingPhase locks game body scroll during GAME_RESULT
    assert.ok(drawingPhaseContent.includes('.sk-view--game.is-game-result .sk-game-body'), 'Must target .sk-game-body in game result phase')
    assert.ok(drawingPhaseContent.includes('overflow-y: hidden !important'), 'Game body must lock overflow-y to prevent canvas scroll')
    assert.ok(drawingPhaseContent.includes('touch-action: none'), 'Drawing surface wrapper must disable touch actions')

    // globals.css stage player title clearance
    assert.ok(cssContent.includes('.sk-final-headline-wrap'), 'Must define headline wrap')
    assert.ok(cssContent.includes('z-index: 10'), 'Headline wrap must have high z-index')
    assert.ok(cssContent.includes('.sk-final--crowded .sk-final-podium-wrap') && cssContent.includes('transform: none !important'), 'Crowded podium must not apply negative translateY')
    assert.ok(cssContent.includes('.sk-final--crowded .sk-final-podium-wrap') && cssContent.includes('margin-top: 0 !important'), 'Crowded podium must not apply negative margin-top')

    // Touch containment on final scores
    assert.ok(cssContent.includes('touch-action: none') && cssContent.includes('overscroll-behavior: contain'), 'Final scores overlay must contain touch and overscroll')
    assert.ok(cssContent.includes('.sk-final-runners-section') && cssContent.includes('touch-action: pan-y !important'), 'Runner section must restrict touch to pan-y')
  })
})
