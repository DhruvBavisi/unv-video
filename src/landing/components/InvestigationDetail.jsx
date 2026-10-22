import { useEffect, useRef } from 'react'
import { EVIDENCE_TYPES } from '../data/evidence.js'

// ============================================================
// UNDERCOVER — InvestigationDetail (Phase 5)
//
// A classified-file detail panel for a single piece of evidence.
// - dialog semantics (role=dialog, aria-modal, labelled)
// - ESC closes
// - close button focused on open, focus returned on close
// - backdrop click closes
// - restrained entrance animation (opacity + slight slide)
// ============================================================

export default function InvestigationDetail({ item, onClose }) {
  const closeButtonRef = useRef(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    closeButtonRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [onClose])

  if (!item) return null

  const isObject = item.type === EVIDENCE_TYPES.OBJECT
  const panelModifier = isObject ? 'detail__panel--object' : 'detail__panel--paper'
  const titleId = `detail-${item.id}`

  return (
    <div
      className="detail"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <article
        className={`detail__panel ${panelModifier}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="detail__head">
          <span className="detail__type label">{item.type}</span>
          {item.metadata?.[0] && <span className="detail__ref label">{item.metadata[0]}</span>}
          <button
            ref={closeButtonRef}
            type="button"
            className="detail__close label"
            onClick={onClose}
            aria-label="Close investigation detail"
          >
            Close ✕
          </button>
        </header>

        <h3 className="detail__title" id={titleId}>
          {item.title}
        </h3>

        {item.image && (
          <img className="detail__img" src={item.image.src} alt="" loading="lazy" />
        )}

        <p className="detail__desc">{item.description}</p>

        {item.notes && (
          <div className="detail__notes">
            <span className="detail__notes-label label">Investigation notes</span>
            <p>{item.notes}</p>
          </div>
        )}

        {item.metadata && item.metadata.length > 0 && (
          <ul className="detail__meta">
            {item.metadata.map((meta) => (
              <li key={meta} className="label">
                {meta}
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  )
}