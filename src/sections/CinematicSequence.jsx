import { useEffect, useRef, useState } from 'react'
import CharacterRole from '../components/CharacterRole.jsx'
import ScrollIndicator from '../components/ScrollIndicator.jsx'
import characters from '../data/characters.js'
import {
  CINEMATIC_CONFIG,
  CHARACTER_ORDER,
  CHARACTER_SEGMENTS,
  getActiveCharacter,
  getCharacterReveal,
  getRevealProgress,
  cinematicProgressFromScroll,
} from '../lib/cinematicTimeline.js'
import { createCinematicScrollTrigger } from '../lib/cinematicScroll.js'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { framesAvailable, getLoadedFrameCount, getTotalFrameCount } from '../lib/frameSequence.js'
import { useFrameCinematic } from '../hooks/useFrameCinematic.js'

const VIDEO_SRC = '/videos/Undercover_cinematic_30fps.mp4'
const VIDEO_FALLBACK = '/images/investigation-room/hero-frame.png'
const END_FRAME = '/images/investigation-room/end-frame.png'

const DEBUG =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('debugCinematic') === 'true'

const DEBUG_LABELS = {
  civilian: 'CIVILIAN',
  undercover: 'UNDERCOVER',
  mrWhite: 'MR WHITE',
}

export default function CinematicSequence() {
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const videoRef = useRef(null)
  const debugRef = useRef(null)
  const civilianRef = useRef(null)
  const civilianLabelRef = useRef(null)
  const civilianDescRef = useRef(null)
  const undercoverRef = useRef(null)
  const undercoverLabelRef = useRef(null)
  const undercoverDescRef = useRef(null)
  const mrWhiteRef = useRef(null)
  const mrWhiteLabelRef = useRef(null)
  const mrWhiteDescRef = useRef(null)
  const activeRef = useRef(null)
  const reducedRef = useRef(false)

  const labelRefs = {
    civilian: civilianLabelRef,
    undercover: undercoverLabelRef,
    mrWhite: mrWhiteLabelRef,
  }

  const descRefs = {
    civilian: civilianDescRef,
    undercover: undercoverDescRef,
    mrWhite: mrWhiteDescRef,
  }

  const [renderer, setRenderer] = useState('video') // 'frames' | 'video' | 'static'
  const [videoPainted, setVideoPainted] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [activeCharacter, setActiveCharacter] = useState(null)

  // Probe for the frame sequence.  Default to video immediately so the
  // cinematic is never black while we check.
  useEffect(() => {

    let cancelled = false

    async function probe() {
      const ok = await framesAvailable()
      if (cancelled) return
      if (ok) setRenderer('frames')
    }

    probe()

    return () => {
      cancelled = true
    }
  }, [])

  const writeDebug = (lines) => {
    if (DEBUG && debugRef.current) {
      debugRef.current.textContent = lines.join('\n')
    }
  }

  // ---------- PHASE 4: character reveals ----------
  // The SAME ScrollTrigger progress drives every character's label and
  // description opacity + position — written directly to the DOM each
  // update (no timers, no CSS transitions, no React state per scroll
  // frame). Stop = freeze, reverse = reverse. It receives CINEMATIC
  // progress (the weighted frame curve), never the raw scroll progress.
  const applyReveal = (cinematicProgress) => {
    const states = getCharacterReveal(cinematicProgress)

    for (const state of states) {
      const labelEl = labelRefs[state.id].current
      if (labelEl) {
        labelEl.style.opacity = String(state.labelOpacity)
        labelEl.style.transform = reducedRef.current
          ? 'none'
          : `translateY(${state.labelY}px)`
      }
      const descEl = descRefs[state.id].current
      if (descEl) {
        descEl.style.opacity = String(state.descOpacity)
        descEl.style.transform = reducedRef.current
          ? 'none'
          : `translateY(${state.descY}px)`
      }
    }

    const next = getActiveCharacter(cinematicProgress)
    if (next !== activeRef.current) {
      activeRef.current = next
      setActiveCharacter(next)
    }

    return states
  }

  const debugRevealRow = (cinematicProgress, states) => {
    const id = activeRef.current
    const state = states.find((s) => s.id === id)
    const reveal = id ? getRevealProgress(cinematicProgress, id) : null
    return [
      `CHARACTER: ${id ? DEBUG_LABELS[id] : '—'}`,
      `REVEAL: ${reveal == null ? '—' : `${Math.round(reveal * 100)}%`}`,
      `LABEL: ${state ? `${state.labelOpacity.toFixed(2)} ${Math.round(state.labelY)}px` : '—'}`,
      `DESC: ${state ? `${state.descOpacity.toFixed(2)} ${Math.round(state.descY)}px` : '—'}`,
    ].join('  |  ')
  }

  const debugWindowRow = () =>
    CHARACTER_SEGMENTS.map(
      (seg) =>
        `${DEBUG_LABELS[seg.id]} ${seg.labelInStartFrame}–${seg.outEndFrame}f [${seg.startFrame}–${seg.slowEndFrame} slow]`
    ).join('  |  ')

  // ---------- FRAME SEQUENCE RENDERER (primary) ----------
  useFrameCinematic({
    canvasRef,
    sectionRef,
    enabled: renderer === 'frames',
    onProgress: ({ progress, cinematicProgress, frameIndex }) => {
      const states = applyReveal(cinematicProgress)
      writeDebug([
        `RENDERER: FRAME   SCROLL ${(progress * 100).toFixed(1)}%   CINEMATIC ${(cinematicProgress * 100).toFixed(1)}%   FRAME ${frameIndex}/${CINEMATIC_CONFIG.frameCount}   LOADED ${getLoadedFrameCount()}/${getTotalFrameCount()}`,
        debugRevealRow(cinematicProgress, states),
        debugWindowRow(),
      ])
    },
  })

  // ---------- VIDEO RENDERER (fallback) ----------
  useEffect(() => {
    if (renderer !== 'video' || !videoRef.current || !sectionRef.current) return

    const video = videoRef.current
    const section = sectionRef.current
    let trigger = null

    video.pause()
    setVideoPainted(false)

    const onSeeked = () => {
      video.pause()
      setVideoPainted(true)
    }

    const onLoadedMetadata = () => {
      video.pause()
      // Nudge inside the first frame so frame 0 paints immediately.
      video.currentTime = 0.001
      ScrollTrigger.refresh()
      updateFromProgress(0)
    }

    const updateFromProgress = (scrollProgress) => {
      const cinematicProgress = cinematicProgressFromScroll(scrollProgress)
      const states = applyReveal(cinematicProgress)
      const duration = video.duration
      const targetTime = cinematicProgress * duration
      if (Number.isFinite(targetTime)) {
        if (Math.abs(video.currentTime - targetTime) > 0.008) {
          video.currentTime = targetTime
        }
      }
      writeDebug([
        `RENDERER: VIDEO   DURATION: ${Number.isFinite(duration) ? duration.toFixed(2) : '—'} s   TIME: ${Number.isFinite(video.currentTime) ? video.currentTime.toFixed(2) : '—'} s   SCROLL: ${(scrollProgress * 100).toFixed(1)}%   CINEMATIC: ${(cinematicProgress * 100).toFixed(1)}%   PAUSED: ${video.paused}`,
        debugRevealRow(cinematicProgress, states),
        debugWindowRow(),
      ])
    }

    // Never play.  Wait for duration before seeking.
    video.pause()
    video.addEventListener('seeked', onSeeked)
    if (video.readyState >= 1) {
      onLoadedMetadata()
    } else {
      video.addEventListener('loadedmetadata', onLoadedMetadata)
    }

    trigger = createCinematicScrollTrigger({
      section,
      onUpdate: (self) => {
        updateFromProgress(self.progress)
      },
    })

    updateFromProgress(0)

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('seeked', onSeeked)
      if (trigger) trigger.kill()
    }
  }, [renderer])

  const handleVideoError = () => {
    setVideoFailed(true)
  }

  const isActive = (id) => activeCharacter === id

  return (
    <section
      ref={sectionRef}
      className="cinematic"
      id="characters"
      aria-label="Cinematic investigation room — scroll to advance"
    >
      {/* ---------- FRAME SEQUENCE (primary) ---------- */}
      {renderer === 'frames' && (
        <>
          {/* Static establishing frame sits UNDER the canvas until frame 1 paints */}
          <img
            className="cinematic__fallback"
            src={VIDEO_FALLBACK}
            alt="Investigation room establishing frame"
          />
          <canvas ref={canvasRef} className="cinematic__canvas" aria-hidden="true" />
        </>
      )}

      {/* ---------- VIDEO (fallback when frames are missing) ---------- */}
      {renderer === 'video' && (
        <>
          <video
            ref={videoRef}
            className="cinematic__video"
            src={VIDEO_SRC}
            muted
            playsInline
            preload="auto"
            controls={false}
            aria-label="Scroll-controlled cinematic of the investigation room"
            onError={handleVideoError}
          />
          {(!videoPainted || videoFailed) && (
            <img
              className="cinematic__fallback"
              src={VIDEO_FALLBACK}
              alt="Investigation room establishing frame"
            />
          )}
        </>
      )}

      {/* ---------- STATIC (video failed) ---------- */}
      {renderer === 'static' && (
        <img
          className="cinematic__fallback"
          src={VIDEO_FALLBACK}
          alt="Investigation room establishing frame"
        />
      )}

      {/* ---------- OVERLAYS (always visible) ---------- */}
      <div className="cinematic__overlay">
        <span className="cinematic__corner cinematic__corner--tl">
          <span className="cinematic__classified">
            <span className="cinematic__classified-dot" aria-hidden="true" />
            Classified
          </span>
        </span>
        <span className="cinematic__corner cinematic__corner--bl">Case File: Undercover</span>
        <span className="cinematic__corner cinematic__corner--br">Scroll to investigate</span>
      </div>

      {/* ---------- CHARACTER TEXT (same progress as the cinematic) ---------- */}
      <>
          <div
            ref={civilianRef}
            className={`cinematic__role cinematic__role--${characters[0].id} cinematic__role--${characters[0].align}`}
            aria-hidden={!isActive('civilian')}
          >
            <div className="cinematic__role-label" ref={civilianLabelRef}>
              <CharacterRole
                part="label"
                role={characters[0].role}
                name={characters[0].name}
              />
            </div>
            <div className="cinematic__role-desc" ref={civilianDescRef}>
              <CharacterRole
                part="desc"
                tagline={characters[0].tagline}
                description={characters[0].description}
                meta={characters[0].meta}
              />
            </div>
          </div>

          <div
            ref={undercoverRef}
            className={`cinematic__role cinematic__role--${characters[1].id} cinematic__role--${characters[1].align}`}
            aria-hidden={!isActive('undercover')}
          >
            <div className="cinematic__role-label" ref={undercoverLabelRef}>
              <CharacterRole
                part="label"
                role={characters[1].role}
                name={characters[1].name}
              />
            </div>
            <div className="cinematic__role-desc" ref={undercoverDescRef}>
              <CharacterRole
                part="desc"
                tagline={characters[1].tagline}
                description={characters[1].description}
                meta={characters[1].meta}
              />
            </div>
          </div>

          <div
            ref={mrWhiteRef}
            className={`cinematic__role cinematic__role--${characters[2].id} cinematic__role--${characters[2].align}`}
            aria-hidden={!isActive('mrWhite')}
          >
            <div className="cinematic__role-label" ref={mrWhiteLabelRef}>
              <CharacterRole
                part="label"
                role={characters[2].role}
                name={characters[2].name}
              />
            </div>
            <div className="cinematic__role-desc" ref={mrWhiteDescRef}>
              <CharacterRole
                part="desc"
                tagline={characters[2].tagline}
                description={characters[2].description}
                meta={characters[2].meta}
              />
            </div>
          </div>
        </>

      <div className="cinematic__indicator">
        <ScrollIndicator />
      </div>

      {DEBUG && (
        <div className="cinematic__debug" ref={debugRef} aria-hidden="true">
          PROBING RENDERER…
        </div>
      )}
    </section>
  )
}
