import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

describe('Skribbl Final Scores Tournament Stage Tests', () => {
  it('FinalScores.jsx integrates 3D stage floor, 1st place crown, and runner pills', () => {
    const finalScoresPath = path.resolve('src/games/skribbl/components/FinalScores.jsx')
    const content = fs.readFileSync(finalScoresPath, 'utf-8')

    // Verifies 1st place champion crown
    assert.ok(content.includes('sk-final-crown'), 'Must include .sk-final-crown element')
    assert.ok(content.includes('👑'), 'Must render crown emoji for 1st place')

    // Verifies connected Tournament Stage Floor
    assert.ok(content.includes('sk-final-stage-floor'), 'Must include .sk-final-stage-floor platform bar')

    // Verifies avatar fallback with color class and letter
    assert.ok(content.includes('getAvatarColorClass'), 'Must use getAvatarColorClass for letter avatar')
    assert.ok(content.includes('sk-final-avatar-fallback'), 'Must render fallback avatar when no image URL')

    // Verifies lower row runner pills (#4 and below)
    assert.ok(content.includes('sk-final-runner-pill'), 'Must render .sk-final-runner-pill instead of cramped micro-card')
    assert.ok(content.includes('sk-final-runner-rank'), 'Must render .sk-final-runner-rank')
    assert.ok(content.includes('sk-final-runner-info'), 'Must render .sk-final-runner-info for name and score')
    assert.ok(content.includes('sk-final-runner-badges'), 'Must render .sk-final-runner-badges on the pill')
  })

  it('globals.css provides tournament 3D stage styling and zero-clipping safeguards', () => {
    const cssPath = path.resolve('src/shared/styles/globals.css')
    const css = fs.readFileSync(cssPath, 'utf-8')

    // Verifies stage floor styling
    assert.ok(css.includes('.sk-final-stage-floor'), 'Must define .sk-final-stage-floor')
    assert.ok(css.includes('border-top: 1.5px solid rgba(255, 255, 255, 0.25)'), 'Stage floor must have highlighted top edge')

    // Verifies 1st place lighting & gold styling
    assert.ok(css.includes('.sk-final-slot--first .sk-final-box'), 'Must style 1st place podium pedestal')
    assert.ok(css.includes('rgba(255, 200, 87, 0.16)'), '1st place pedestal must have gold radiant top lighting')

    // Verifies runner pill layout
    assert.ok(css.includes('.sk-final-runner-pill'), 'Must style .sk-final-runner-pill')
    assert.ok(css.includes('border-radius: 20px'), 'Runner pill must be rounded pill format')

    // Verifies title truncation safeguard against container blowout
    assert.ok(css.includes('.sk-final-title'), 'Must style .sk-final-title')
    assert.ok(css.includes('text-overflow: ellipsis'), 'Title must have text-overflow: ellipsis to prevent clipping')
  })
})

