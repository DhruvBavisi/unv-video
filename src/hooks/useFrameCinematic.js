import { useEffect, useRef } from 'react'
import {
  CINEMATIC_CONFIG,
  frameFromScrollProgress,
} from '../lib/cinematicTimeline.js'
import { createCinematicScrollTrigger } from '../lib/cinematicScroll.js'
import {
  framePath,
  preloadAllFrames,
  getFrame,
  fitCanvas,
  drawFrame,
  clearFrameCache,
} from '../lib/frameSequence.js'

// ============================================================
// UNDERCOVER — useFrameCinematic
//
// ONE ScrollTrigger reports scroll progress.  A weighted non-linear
// curve (cinematicTimeline.js) stretches character-reveal segments so
// they play back slower; frameFromScrollProgress() returns the frame:
//
//   frameIndex = frameFromScrollProgress(scrollProgress)   // 1..300
//   cinematicProgress = (frameIndex - 1) / (frameCount - 1)
//
// requestAnimationFrame is used ONLY to schedule the canvas paint
// when the frame index changes.  There is no independent animation
// timeline, no smoothing, no fallback frames.
// ============================================================

export function useFrameCinematic({ sectionRef, canvasRef, onProgress, enabled = true }) {
  const onProgressRef = useRef(onProgress)
  onProgressRef.current = onProgress

  const state = useRef({ frameIndex: 1, renderScheduled: false })

  useEffect(() => {
    if (!enabled) return

    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let trigger = null
    let rafId = null

    const renderCanvas = () => {
      const frameNum = state.current.frameIndex
      const img = getFrame(frameNum)
      if (!img || !img.complete || img.naturalWidth === 0) return
      fitCanvas(canvas, ctx, section)
      drawFrame(canvas, ctx, img, CINEMATIC_CONFIG.frameWidth, CINEMATIC_CONFIG.frameHeight)
      // Keep the static fallback visible until a real canvas frame exists.
      canvas.dataset.ready = 'true'
    }

    const requestRender = () => {
      if (state.current.renderScheduled) return
      state.current.renderScheduled = true
      rafId = requestAnimationFrame(() => {
        state.current.renderScheduled = false
        renderCanvas()
      })
    }

    // Hold frame 1 visible immediately so the cinematic is never black.
    const first = new Image()
    first.onload = () => {
      const c = canvasRef.current
      const s = sectionRef.current
      if (!c || !s) return
      const c2 = c.getContext('2d')
      if (!c2) return
      fitCanvas(c, c2, s)
      drawFrame(c, c2, first, CINEMATIC_CONFIG.frameWidth, CINEMATIC_CONFIG.frameHeight)
      c.dataset.ready = 'true'
    }
    first.src = framePath(1)

    preloadAllFrames((index) => {
      if (index === state.current.frameIndex) requestRender()
    })

    // ONE ScrollTrigger (shared factory).  Pins the section; reports raw scroll progress.
    trigger = createCinematicScrollTrigger({
      section,
      onUpdate: (self) => {
        const progress = self.progress
        const frameIndex = frameFromScrollProgress(progress)
        const cinematicProgress = (frameIndex - 1) / (CINEMATIC_CONFIG.frameCount - 1)
        if (frameIndex !== state.current.frameIndex) {
          state.current.frameIndex = frameIndex
          requestRender()
        }
        onProgressRef.current?.({ progress, cinematicProgress, frameIndex })
      },
    })

    // First paint at progress 0 (no scroll required).
    state.current.frameIndex = 1
    requestRender()

    const onResize = () => requestRender()
    window.addEventListener('resize', onResize)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (trigger) trigger.kill()
      window.removeEventListener('resize', onResize)
      clearFrameCache()
    }
  }, [canvasRef, sectionRef, enabled])

  return { frameInfo: state }
}
