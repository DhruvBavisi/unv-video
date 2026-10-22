import { useState } from 'react'
import { EVIDENCE_STATUS } from '../data/evidence.js'

// ============================================================
// UNDERCOVER — EvidenceCard (Phase 5)
//
// A single piece of evidence on the investigation board. Rendered
// as a button (keyboard accessible, visible focus). Supports:
//   title, category, description, status, optional image,
//   optional metadata, optional extra props (data-reveal…).
//
// Status communicates: UNEXAMINED (normal), EXAMINED (marker),
// SUSPICIOUS (red accent). Image failure falls back to a plain
// classified placeholder so the board never shows a broken image.
// ============================================================

export default function EvidenceCard({
  item,
  onSelect,
  examined = false,
  className = '',
  ...rest
}) {
  const { type, title, description, status, image, metadata } = item
  const [imageFailed, setImageFailed] = useState(false)

  const showImage = image && !imageFailed
  const isSuspicious = status === EVIDENCE_STATUS.SUSPICIOUS
  const typeModifier = `evidence--${type.toLowerCase()}`
  const statusModifier = `evidence--${status}`

  return (
    <button
      type="button"
      className={`evidence ${typeModifier} ${statusModifier} ${className}`.trim()}
      onClick={() => onSelect?.(item)}
      aria-label={`${type}. ${title}. ${description ?? ''}`}
      {...rest}
    >
      {isSuspicious && (
        <span className="evidence__pin" aria-hidden="true" title="Suspicious evidence" />
      )}
      {examined && <span className="evidence__stamp label">Examined ✓</span>}

      <span className="evidence__type label">{type}</span>
      {showImage && (
        <img
          className="evidence__img"
          src={image.src}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      )}
      <span className="evidence__title">{title}</span>
      {description && <span className="evidence__desc">{description}</span>}
      {metadata && metadata.length > 0 && (
        <span className="evidence__meta">{metadata.join('  ·  ')}</span>
      )}
    </button>
  )
}