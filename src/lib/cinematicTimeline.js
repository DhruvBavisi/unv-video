// ============================================================
// UNDERCOVER — Cinematic timeline config (single source of truth)
//
// ONE ScrollTrigger reports scroll progress 0..1.  Everything else
// (active frame, character text) derives from that value.
// ============================================================

// NOTE: this module is intentionally GSAP-free — the ScrollTrigger
// factory lives in cinematicScroll.js. Timeline math must stay
// importable from plain Node (used by the verification script).
//
// NOTE ON THE ASSET: the source MP4 (Undercover_cinematic_30fps.mp4)
// is genuinely 10.0 s / 240 samples / 24.0 fps (probed from the
// container's stsz/stts + mdhd) despite the "30fps" filename.  The
// render source is the 300 JPEG frames extracted across that same
// 10 s timeline (a 30 fps re-sample), so frame n ↔ t = (n − 1)/30 s.
// Every label/description anchor below is derived from the 10 s
// visual timeline, never from the stale 20 s/480-frame timing.

export const CINEMATIC_CONFIG = {
  // Virtual scroll distance for the pinned cinematic section (vh).
  // The pinned section stays viewport-sized; this is only the native
  // scroll distance GSAP uses to progress through all 300 frames.
  // The actual scroll cost per frame is non-uniform (see SCROLL_SEGMENTS
  // below): ~2.6vh per neutral frame and ~6.1vh per frame inside a
  // character introduction.
  scrollDistance: 1400,

  // Frame sequence specs — 300 re-sampled frames across the 10 s timeline.
  frameCount: 300,
  frameWidth: 1280,
  frameHeight: 720,

  // Source-of-truth duration of the cinematic (seconds).
  mediaDuration: 10,
}

// Nominal frame rate of the 300-frame re-sample (frames per second).
const FPS = CINEMATIC_CONFIG.frameCount / CINEMATIC_CONFIG.mediaDuration // 30

// ============================================================
// CHARACTER SEGMENTS — the ONE authoritative timing source.
//
// Anchored to the OBSERVED 10 s visual timeline (frame = t × 30 + 1):
//
//   Civilian:   focus 3.00–4.75s, label+desc 3.45–4.55s
//   Undercover: focus 4.75–7.25s, label+desc 5.05–7.00s
//   Mr. White:  focus 7.25–8.90s, label+desc 7.65–8.70s
//   Tail:       pull-back to the wide room 8.90–10.00s (no text)
//
// Subtle intro beat per character: the label fade starts 0.10–0.15s
// after the focus begins (established first, then text), and the
// description fades in just as the label completes.  The previous
// character's text is fully gone before the next character's label
// starts (small gaps below).
//
//   startFrame        slow zone begins (scroll stretch starts)
//   labelInStartFrame label (tag + name) begins its subtle fade in
//   labelInEndFrame   label fully visible — primary readable period
//   descInStartFrame  description (tagline + dossier) begins to fade in
//   descInEndFrame    description fully visible
//   outStartFrame     hold ends — label + description fade out together
//   outEndFrame       fully gone — strictly before the next labelIn
//   slowEndFrame      slow zone ends, cinematic continues toward next character
// ============================================================
export const CHARACTER_SEGMENTS = [
  {
    id: 'civilian',
    startFrame: 73, // ~2.40s — earlier by ~15 frames (0.5s at 30fps)
    labelInStartFrame: 86, // ~2.85s
    labelInEndFrame: 90,
    descInStartFrame: 90,
    descInEndFrame: 94,
    outStartFrame: 123, // ~4.05s — ends 0.5s earlier
    outEndFrame: 129,
    slowEndFrame: 129,
    weight: 2.4,
  },
  {
    id: 'undercover',
    startFrame: 145, // slow zone begins just before the 4.75s focus
    labelInStartFrame: 150, // ~4.95s — subtle label entrance
    labelInEndFrame: 154, // ~5.10s — show begins
    descInStartFrame: 154, // ~5.10s
    descInEndFrame: 158, // ~5.25s
    outStartFrame: 211, // ~7.00s — fade out begins
    outEndFrame: 219, // ~7.27s — fully gone before the Mr. White focus
    slowEndFrame: 220,
    weight: 2.4,
  },
  {
    id: 'mrWhite',
    startFrame: 221, // slow zone begins just before the 7.25s focus
    labelInStartFrame: 226, // ~7.50s — subtle label entrance
    labelInEndFrame: 231, // ~7.65s — show begins
    descInStartFrame: 231, // ~7.65s
    descInEndFrame: 235, // ~7.80s
    outStartFrame: 271, // ~9.00s — 0.3s later
    outEndFrame: 277, // ~9.20s — 0.3s later
    slowEndFrame: 271,
    weight: 2.2,
  },
]

// Character reveal order — same sequence the cinematic introduces each character.
export const CHARACTER_ORDER = CHARACTER_SEGMENTS.map((seg) => seg.id)

/** Video time (seconds) at which a given frame is first displayed. */
export function frameToVideoTime(frame) {
  return (frame - 1) / FPS
}

/** Inverse of the frame mapping: cinematic progress (0..1) → frame index (1..300). */
export function frameFromCinematicProgress(cinematicProgress) {
  const p = Math.min(1, Math.max(0, cinematicProgress))
  return Math.round(p * (CINEMATIC_CONFIG.frameCount - 1)) + 1
}

/**
 * Derived video-time windows, kept for compatibility and debug display.
 * Frame-number source of truth lives in CHARACTER_SEGMENTS above.
 */
export const CHARACTER_TIMINGS = Object.fromEntries(
  CHARACTER_SEGMENTS.map((seg) => [
    seg.id,
    {
      timeStart: frameToVideoTime(seg.labelInStartFrame),
      timeEnd: frameToVideoTime(seg.outEndFrame),
      startFrame: seg.labelInStartFrame,
      endFrame: seg.outEndFrame,
    },
  ]),
)

// ============================================================
// NON-LINEAR SCROLL CURVE
//
// Scroll progress (0..1) maps to cinematic progress through a
// weighted, piecewise-constant per-frame cost.  The weight zones are
// DERIVED from CHARACTER_SEGMENTS above, so the cinematic slows exactly
// during each character's introduction — the label timing and the
// slowdown can never drift apart because they share one config.
// ============================================================
const SCROLL_SEGMENTS = []
let cursor = 1
for (const seg of CHARACTER_SEGMENTS) {
  if (seg.startFrame > cursor) {
    SCROLL_SEGMENTS.push({ start: cursor, end: seg.startFrame - 1, weight: 1 })
  }
  SCROLL_SEGMENTS.push({ start: seg.startFrame, end: seg.slowEndFrame, weight: seg.weight })
  cursor = seg.slowEndFrame + 1
}
if (cursor <= CINEMATIC_CONFIG.frameCount) {
  SCROLL_SEGMENTS.push({ start: cursor, end: CINEMATIC_CONFIG.frameCount, weight: 1 })
}

// Per-frame cost map + prefix sums (CUM_WEIGHT[f] = cost of frames 1..f).
const { frameCount } = CINEMATIC_CONFIG
const WEIGHT_BY_FRAME = new Array(frameCount + 1).fill(1)
for (const seg of SCROLL_SEGMENTS) {
  for (let f = seg.start; f <= seg.end; f++) WEIGHT_BY_FRAME[f] = seg.weight
}

const CUM_WEIGHT = new Array(frameCount + 1)
CUM_WEIGHT[0] = 0
for (let f = 1; f <= frameCount; f++) {
  CUM_WEIGHT[f] = CUM_WEIGHT[f - 1] + WEIGHT_BY_FRAME[f]
}
const TOTAL_SCROLL_WEIGHT = CUM_WEIGHT[frameCount]

/**
 * Map raw scroll progress (0..1) to a frame number (1..300) under the
 * weighted curve.  Purely monotonic: scroll down = advance, up = rewind.
 * This is the frame mapped to "progress" by getActiveCharacter etc.
 */
export function frameFromScrollProgress(scrollProgress) {
  const p = Math.min(1, Math.max(0, scrollProgress))
  const target = p * TOTAL_SCROLL_WEIGHT

  // Smallest frame whose cumulative cost reaches target.
  let lo = 1
  let hi = frameCount
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (CUM_WEIGHT[mid] >= target) hi = mid
    else lo = mid + 1
  }
  return lo
}

/**
 * Map raw scroll progress (0..1) to cinematic progress (0..1) — the
 * single value the character reveal, overlay and video-fallback seek
 * are all derived from.  Inverse of the frame mapping above.
 */
export function cinematicProgressFromScroll(scrollProgress) {
  const frame = frameFromScrollProgress(scrollProgress)
  return (frame - 1) / (frameCount - 1)
}

/**
 * Map CINEMATIC progress (0..1) to the active character id, or null.
 * Pass the output of cinematicProgressFromScroll(), never raw scroll.
 * Same function is used for BOTH the frame renderer and the fallback
 * video renderer, so text and cinematic always share one timeline.
 */
export function getActiveCharacter(cinematicProgress) {
  const frame = frameFromCinematicProgress(cinematicProgress)
  for (const seg of CHARACTER_SEGMENTS) {
    if (frame >= seg.labelInStartFrame && frame <= seg.outEndFrame) return seg.id
  }
  return null
}

/**
 * Reveal state for EVERY character at a given CINEMATIC progress —
 * the one source of truth for opacity + vertical position of the
 * character's LABEL (role tag + name) and DESCRIPTION (tagline +
 * dossier text) as separate, staggered elements.
 *
 *   label → subtle entrance at labelInStart, fully in by labelInEnd.
 *   desc  → fades in as the label completes (descInStart), both then
 *           hold together and fade out over outStart → outEnd.
 *
 *   pre-reveal    opacity 0,  label y +20 / desc y +28
 *   reveal/hold   opacity 1,  y 0
 *   exit          opacity 0,  y −10
 *
 * Purely progress-driven (no timers, no CSS transitions): stop =
 * freeze, reverse = reverse. Called directly inside the renderer's
 * ScrollTrigger onUpdate for the primary AND fallback paths.
 */
export function getCharacterReveal(cinematicProgress) {
  const frame = frameFromCinematicProgress(cinematicProgress)

  return CHARACTER_SEGMENTS.map((seg) => {
    const ramp = (f, start, end) => (f - start) / (end - start)

    // --- Label (role tag + name) ---
    let labelOpacity = 0
    if (frame >= seg.labelInStartFrame && frame < seg.labelInEndFrame) {
      labelOpacity = ramp(frame, seg.labelInStartFrame, seg.labelInEndFrame)
    } else if (frame >= seg.labelInEndFrame && frame <= seg.outStartFrame) {
      labelOpacity = 1
    } else if (frame > seg.outStartFrame && frame <= seg.outEndFrame) {
      labelOpacity = 1 - ramp(frame, seg.outStartFrame, seg.outEndFrame)
    }
    const labelY =
      labelOpacity === 1
        ? 0
        : frame < seg.labelInEndFrame
          ? 20 * (1 - labelOpacity)
          : -10 * (1 - labelOpacity)

    // --- Description (tagline + dossier text) ---
    let descOpacity = 0
    if (frame >= seg.descInStartFrame && frame < seg.descInEndFrame) {
      descOpacity = ramp(frame, seg.descInStartFrame, seg.descInEndFrame)
    } else if (frame >= seg.descInEndFrame && frame <= seg.outStartFrame) {
      descOpacity = 1
    } else if (frame > seg.outStartFrame && frame <= seg.outEndFrame) {
      descOpacity = 1 - ramp(frame, seg.outStartFrame, seg.outEndFrame)
    }
    const descY =
      descOpacity === 1
        ? 0
        : frame < seg.descInEndFrame
          ? 28 * (1 - descOpacity)
          : -10 * (1 - descOpacity)

    return { id: seg.id, labelOpacity, labelY, descOpacity, descY }
  })
}

/**
 * How far (0..1) progress is through a character's reveal window, or
 * null when not inside the window. Used by the debug readout.
 */
export function getRevealProgress(cinematicProgress, id) {
  const seg = CHARACTER_SEGMENTS.find((s) => s.id === id)
  if (!seg) return null
  const frame = frameFromCinematicProgress(cinematicProgress)
  if (frame < seg.labelInEndFrame || frame > seg.outStartFrame) return null
  return (frame - seg.labelInEndFrame) / (seg.outStartFrame - seg.labelInEndFrame)
}