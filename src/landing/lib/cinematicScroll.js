// ============================================================
// UNDERCOVER — ScrollTrigger factory for the cinematic timeline
//
// Kept OUT of cinematicTimeline.js so the timeline math (curve,
// segments, reveals) stays Node-verifiable — importing the pure
// module must not pull in GSAP.  This module is browser-only.
// ============================================================

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CINEMATIC_CONFIG, coverAlignX, getFocusX } from './cinematicTimeline.js'

gsap.registerPlugin(ScrollTrigger)

// Same condition as the stacked (text-at-the-bottom) cinematic layout in
// globals.css. Keep the two in sync.
const COMPACT_QUERY = '(max-width: 768px), (orientation: portrait)'

/**
 * Horizontal crop alignment for a frame inside the pinned section.
 * Wide layouts keep the centred crop the role text is composed against;
 * the compact layout pans the crop to follow the character on screen.
 */
export function getCinematicAlignX(frame, section) {
  if (!section || !window.matchMedia(COMPACT_QUERY).matches) return 0.5
  return coverAlignX(getFocusX(frame), section.clientWidth, section.clientHeight)
}

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