// ============================================================
// UNDERCOVER — ScrollTrigger factory for the cinematic timeline
//
// Kept OUT of cinematicTimeline.js so the timeline math (curve,
// segments, reveals) stays Node-verifiable — importing the pure
// module must not pull in GSAP.  This module is browser-only.
// ============================================================

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CINEMATIC_CONFIG } from './cinematicTimeline.js'

gsap.registerPlugin(ScrollTrigger)

/**
 * The single ScrollTrigger every renderer path shares. Frame renderer
 * and video fallback both scrub through the same pinned, weight-mapped
 * scroll so the two can never drift apart.
 */
export function createCinematicScrollTrigger({ section, onUpdate }) {
  return ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: `+=${CINEMATIC_CONFIG.scrollDistance}vh`,
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate,
  })
}