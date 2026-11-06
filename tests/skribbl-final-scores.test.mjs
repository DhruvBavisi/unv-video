import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Skribbl Final Scores Tournament Stage Tests', () => {
  it('FinalScores.jsx integrates crayon textured stage, trophy on side, uniform design without badges, and structured runner rows', () => {
    const finalScoresPath = path.resolve('src/games/skribbl/components/FinalScores.jsx')
    const content = fs.readFileSync(finalScoresPath, 'utf-8')

    // Verifies removal of trophy/crown from behind
    assert.ok(!content.includes('sk-final-crown'), 'Must remove trophy/crown from behind winner')
    assert.ok(!content.includes('👑'), 'Must remove crown emoji from behind winner')

    // Verifies authentic trophy on side and jumping winner avatar
    assert.ok(content.includes('SkribblTrophy'), 'Must render SkribblTrophy component')
    assert.ok(content.includes('sk-final-trophy-wrap'), 'Must render sk-final-trophy-wrap on his side')
    assert.ok(content.includes('sk-final-winner-avatar-wrap'), 'Must wrap winner avatar in jump container')

    // Verifies SVG filter for authentic crayon texture
    assert.ok(content.includes('id="sk-crayon-stroke"'), 'Must define SVG filter sk-crayon-stroke for crayon texture')
    assert.ok(content.includes('feTurbulence'), 'Must use feTurbulence for crayon grain')
    assert.ok(content.includes('feDisplacementMap'), 'Must use feDisplacementMap for textured stroke distortion')

    // Verifies removal of non-uniform ready/you badge pills
    assert.ok(!content.includes('sk-final-badges'), 'Must remove sk-final-badges from podium boxes')
    assert.ok(!content.includes('sk-final-card-badges'), 'Must remove sk-final-card-badges from runner cards')

    // Verifies avatar fallback with color class and letter
    assert.ok(content.includes('getAvatarColorClass'), 'Must use getAvatarColorClass for letter avatar')
    assert.ok(content.includes('sk-final-avatar-fallback'), 'Must render fallback avatar when no image URL')

    // Verifies structured runner rows without pills and dynamic balanced row partitioning
    assert.ok(!content.includes('sk-final-runner-pill'), 'Must NOT render old .sk-final-runner-pill')
    assert.ok(content.includes('sk-final-player-card'), 'Must render .sk-final-player-card')
    assert.ok(content.includes('sk-final-card-rank'), 'Must render .sk-final-card-rank')
    assert.ok(content.includes('sk-final-card-name'), 'Must render .sk-final-card-name')
    assert.ok(content.includes('sk-final-card-points'), 'Must render .sk-final-card-points')
    assert.ok(content.includes('runnerRows'), 'Must compute runnerRows structure')

    // Verifies stage moves up when player count exceeds 8 and no single player at center row
    assert.ok(content.includes('isCrowded = ranked.length > 8'), 'Must detect when player count exceeds 8')
    assert.ok(content.includes('sk-final-podium-wrap--crowded') || content.includes('sk-final--crowded'), 'Must apply crowded stage classes')
    assert.ok(content.includes('Math.ceil(remaining.length / remainingRows)'), 'Must evenly balance rows so no row has an orphan single player')
  })

  it('globals.css provides crayon-textured top/side-only borders, transparent inside, borderless below rows, and short jump', () => {
    const cssPath = path.resolve('src/shared/styles/globals.css')
    const css = fs.readFileSync(cssPath, 'utf-8')

    // Verifies crayon stage borders: only top and sides, no bottom, no inside color, crayon filter
    assert.ok(css.includes('border-top: 3.5px solid'), 'Stage box must have top crayon border')
    assert.ok(css.includes('border-left: 3.5px solid'), 'Stage box must have left crayon border')
    assert.ok(css.includes('border-right: 3.5px solid'), 'Stage box must have right crayon border')
    assert.ok(css.includes('border-bottom: none !important'), 'Stage box must have NO bottom border')
    assert.ok(css.includes('background: transparent !important'), 'Stage box must have NO inside color')
    assert.ok(css.includes('filter: url(#sk-crayon-stroke)'), 'Stage box must use crayon stroke filter')

    // Verifies place colors on borders
    assert.ok(css.includes('--tier-crayon: #FFD000') || css.includes('border-top-color: #FFD000'), '1st place border must be gold')
    assert.ok(css.includes('--tier-crayon: #CBD5E1') || css.includes('border-top-color: #CBD5E1'), '2nd place border must be silver')
    assert.ok(css.includes('--tier-crayon: #FF8A3D') || css.includes('border-top-color: #FF8A3D'), '3rd place border must be bronze')

    // Verifies stepped heights for podium pedestals (3rd place name & points not cut)
    assert.ok(css.includes('.sk-final-slot--first .sk-final-box'), 'Must style 1st place podium pedestal')
    assert.ok(css.includes('.sk-final-slot--third .sk-final-box'), 'Must style 3rd place podium pedestal')
    assert.ok(css.includes('clamp(40px'), 'Must increase height of 3rd place stage pedestal to clamp(40px, ...) so name and points are not cut')

    // Verifies stage players stand on top stage line (not sunken below)
    assert.ok(css.includes('.sk-final-avatar-slot--podium') && css.includes('align-items: flex-end'), 'Avatar slot must align to flex-end so player stands on top stage line')
    assert.ok(css.includes('.sk-final-stand-actor') && css.includes('align-items: flex-end'), 'Stand actor must align to flex-end')
    assert.ok(css.includes('.sk-final-podium-header') && css.includes('margin-bottom: 0px'), 'Podium header must have 0 margin-bottom so feet touch top border')

    // Verifies increased rank font sizes for podium and below rows
    assert.ok(css.includes('.sk-final-rank') && css.includes('clamp(0.95rem'), 'Podium rank font size must be increased')
    assert.ok(css.includes('.sk-final-card-rank') && css.includes('font-size: 0.80rem'), 'Card rank font size must be increased')

    // Verifies trophy and winner short jumping animation with left and right tilt
    assert.ok(css.includes('skWinnerJumpLeftRight'), 'Must define skWinnerJumpLeftRight keyframes')
    assert.ok(css.includes('translate3d(0, 0, 0)'), 'Must use translate3d for GPU acceleration')
    assert.ok(css.includes('-7px'), 'Must use short jump apex (-7px)')
    assert.ok(css.includes('rotate(-6deg)') && css.includes('rotate(6deg)'), 'Must include slight tilt for the jump on both sides')
    assert.ok(css.includes('skTrophyTilt'), 'Must define skTrophyTilt keyframes')

    // Verifies stage moves up when player count exceeds 8
    assert.ok(css.includes('.sk-final--crowded .sk-final-podium-wrap') && css.includes('translateY'), 'Stage must move up with translateY when crowded')
    assert.ok(css.includes('.sk-final--crowded .sk-final-runners-section'), 'Runners section must expand when crowded')

    // Verifies below rows have NO background and NO borders, and rank is positioned slightly more to left
    assert.ok(css.includes('.sk-final-player-card'), 'Must style .sk-final-player-card')
    assert.ok(css.includes('.sk-final-player-card') && css.includes('background: transparent !important'), 'Runner cards must have NO background')
    assert.ok(css.includes('.sk-final-player-card') && css.includes('border: none !important'), 'Runner cards must have NO border')
    assert.ok(css.includes('.sk-final-card-rank') && css.includes('left: -2px'), 'Card rank must be placed more to the left away from player body')
    assert.ok(css.includes('.sk-final-row-grid'), 'Must style .sk-final-row-grid')

    // Verifies title truncation safeguard against container blowout
    assert.ok(css.includes('.sk-final-title'), 'Must style .sk-final-title')
    assert.ok(css.includes('text-overflow: ellipsis'), 'Title must have text-overflow: ellipsis to prevent clipping')
  })

  it('Runner row distributions strictly enforce 5-4-2 for 14 players, 5-4-3 for 15 players, and zero orphan single-player rows', () => {
    const finalScoresPath = path.resolve('src/games/skribbl/components/FinalScores.jsx')
    const content = fs.readFileSync(finalScoresPath, 'utf-8')
    const cssPath = path.resolve('src/shared/styles/globals.css')
    const css = fs.readFileSync(cssPath, 'utf-8')

    // Parse getRunnerRowDistribution function body safely for unit testing
    const slice = content.slice(
      content.indexOf('export function getRunnerRowDistribution'),
      content.indexOf('export default function FinalScores')
    )
    const body = slice.replace('export function getRunnerRowDistribution(total) {', '').replace(/\n\}\s*$/, '')
    const getRunnerRowDistribution = new Function('total', body)

    // 14 players total -> 3 on podium + 11 runners -> exactly 3 rows [5, 4, 2]
    const dist14 = getRunnerRowDistribution(11)
    assert.deepEqual(dist14, [5, 4, 2], '14 players must distribute runners across 3 rows as [5, 4, 2]')
    assert.equal(dist14[1], 4, '14 players second row must have 4 players (not a single player)')
    assert.ok(!dist14.includes(1), '14 players must not have any row with a single player')

    // 15 players total -> 3 on podium + 12 runners -> exactly 3 rows [5, 4, 3]
    const dist15 = getRunnerRowDistribution(12)
    assert.deepEqual(dist15, [5, 4, 3], '15 players must distribute runners across 3 rows as [5, 4, 3]')
    assert.equal(dist15[1], 4, '15 players second row must have 4 players (not a single player)')
    assert.ok(!dist15.includes(1), '15 players must not have any row with a single player')

    // For all player counts from 5 to 20 (2 to 17 runners), verify sum matches and no row has 1 player
    for (let runners = 2; runners <= 17; runners++) {
      const dist = getRunnerRowDistribution(runners)
      const sum = dist.reduce((acc, count) => acc + count, 0)
      assert.equal(sum, runners, `Sum of row counts for ${runners} runners must equal ${runners}`)
      assert.ok(!dist.includes(1), `Runners count ${runners} (total ${runners + 3} players) must NEVER have a single player in any row: [${dist.join(', ')}]`)
    }

    // CSS nowrap guarantees no browser wrapping introduces an orphan single card
    assert.ok(css.includes('.sk-final-row-grid') && css.includes('flex-wrap: nowrap'), 'Row grid must use flex-wrap: nowrap')
  })
})
