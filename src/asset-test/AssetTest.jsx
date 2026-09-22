import { useCallback, useEffect, useRef, useState } from 'react'
import './asset-test.css'

const VIDEO_SRC = '/videos/Undercover_cinematic_30fps.mp4'

const VIDEO_FALLBACK_IMG = '/images/investigation-room/hero-frame.png'

const FRAMES = [
  { name: 'hero-frame.png', src: '/images/investigation-room/hero-frame.png' },
  { name: 'civilian-frame.png', src: '/images/investigation-room/rookie-frame.png' },
  { name: 'undercover-frame.png', src: '/images/investigation-room/undercover-frame.png' },
  { name: 'mr-white-frame.png', src: '/images/investigation-room/veteran-frame.png' },
  { name: 'end-frame.png', src: '/images/investigation-room/end-frame.png' },
]

export default function AssetTest() {
  const videoRef = useRef(null)
  const [videoState, setVideoState] = useState('loading')
  const [videoError, setVideoError] = useState(false)
  const [duration, setDuration] = useState(null)
  const [frameStatus, setFrameStatus] = useState(
    FRAMES.map(() => 'checking'),
  )

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onLoadedMetadata = () => {
      setVideoState('ready')
      setDuration(v.duration)
    }
    const onLoadedData = () => setVideoState('ready')
    const onCanPlay = () => setVideoState('ready')
    const onError = () => {
      setVideoState('error')
      setVideoError(true)
    }

    v.addEventListener('loadedmetadata', onLoadedMetadata)
    v.addEventListener('loadeddata', onLoadedData)
    v.addEventListener('canplay', onCanPlay)
    v.addEventListener('error', onError)

    if (v.readyState >= 1) onLoadedMetadata()

    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMetadata)
      v.removeEventListener('loadeddata', onLoadedData)
      v.removeEventListener('canplay', onCanPlay)
      v.removeEventListener('error', onError)
    }
  }, [])

  const handleFrameLoad = useCallback((index) => {
    setFrameStatus((prev) => {
      const next = [...prev]
      next[index] = 'loaded'
      return next
    })
  }, [])

  const handleFrameError = useCallback((index) => {
    setFrameStatus((prev) => {
      const next = [...prev]
      next[index] = 'error'
      return next
    })
  }, [])

  const allFramesLoaded = frameStatus.every((s) => s === 'loaded')

  return (
    <section className="asset-test">
      <header className="asset-test__header">
        <h1>UNDERCOVER — Asset Test</h1>
        <p className="asset-test__note">Temporary Phase 1 page. Isolated from the cinematic implementation. Remove after Phase 1.</p>
      </header>

      <article className="asset-test__block">
        <h2>Cinematic Video</h2>
        <p>
          Source: <code>{VIDEO_SRC}</code>
        </p>
        <p>
          Status: <strong>{videoError ? 'ERROR' : videoState.toUpperCase()}</strong>
          {duration != null ? ` — duration ${duration.toFixed(2)}s` : ''}
        </p>
        <div className="asset-test__video-wrap">
          {videoError ? (
            <img
              className="asset-test__fallback"
              src={VIDEO_FALLBACK_IMG}
              alt="Cinematic video fallback — investigation room establishing frame"
            />
          ) : (
            <video
              ref={videoRef}
              className="asset-test__video"
              src={VIDEO_SRC}
              preload="metadata"
              muted
              playsInline
              controls
            />
          )}
        </div>
        {videoError && (
          <p className="asset-test__warn">
            Video failed to load. Showing fallback frame: <code>{VIDEO_FALLBACK_IMG}</code>
          </p>
        )}
        <p>
          Metadata: {duration != null ? `available (${duration.toFixed(2)}s)` : 'waiting for video metadata…'}
        </p>
      </article>

      <article className="asset-test__block">
        <h2>Cinematic Frames</h2>
        <p>
          Total frames: {FRAMES.length} — Overall: <strong>{allFramesLoaded ? 'ALL LOADED' : 'CHECKING…'}</strong>
        </p>
        <div className="asset-test__grid">
          {FRAMES.map((frame, i) => (
            <figure key={frame.name} className="asset-test__frame">
              <img
                src={frame.src}
                alt={`Cinematic frame: ${frame.name}`}
                loading="lazy"
                onLoad={() => handleFrameLoad(i)}
                onError={() => handleFrameError(i)}
              />
              <figcaption>
                <code>{frame.src}</code> — <span>{frameStatus[i]}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </article>
    </section>
  )
}
