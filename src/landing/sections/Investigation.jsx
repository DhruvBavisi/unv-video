import { useState } from 'react'
import EvidenceCard from '../components/EvidenceCard.jsx'
import InvestigationDetail from '../components/InvestigationDetail.jsx'
import { evidenceItems, suspectPreview, suspicionMeterWidth } from '../data/evidence.js'

// ============================================================
// UNDERCOVER — Investigation (Phase 5)
//
// A detective's investigation board placed after the cinematic. It is
// intentionally normal document flow: the cinematic owns the only pinned
// interaction, so this content can never remain hidden after its spacer.
// ============================================================

// Desktop board placement per evidence id ("intentional arrangement",
// not a CSS grid). Mobile ignores these and stacks the items.
const BOARD_POSITION = {
  'file-evidence': 'board__slot--central',
  'map-districts': 'board__slot--map',
  'photo-civilian': 'board__slot--civilian',
  'photo-undercover': 'board__slot--undercover',
  'photo-mrwhite': 'board__slot--mrwhite',
  'walkie-transcript': 'board__slot--walkie',
  'note-anonymous': 'board__slot--note',
  'evidence-marker': 'board__slot--key',
}

const BOARD_ORDER = [
  'file-evidence',
  'map-districts',
  'photo-civilian',
  'note-anonymous',
  'walkie-transcript',
  'photo-undercover',
  'evidence-marker',
  'photo-mrwhite',
]

export default function Investigation() {
  const [examined, setExamined] = useState(() => new Set())
  const [active, setActive] = useState(null)

  const handleSelect = (item) => {
    setExamined((prev) => new Set(prev).add(item.id))
    setActive(item)
  }

  const closeDetail = () => setActive(null)

  return (
    <section
      className="investigation"
      id="investigation"
      aria-label="Investigation board — case evidence"
    >
      <div className="section-inner investigation__inner">
        {/* HUD — subtle investigation interface, not a game dashboard */}
        <div className="investigation__hud">
          <span className="label">Case File // Case #001</span>
          <span className="label">
            Evidence: {String(examined.size).padStart(2, '0')}/{String(evidenceItems.length).padStart(2, '0')}
          </span>
          <span className="label">Status: Ongoing</span>
        </div>

        <header className="investigation__header">
          <span className="label label--accent">Investigation</span>
          <h2 className="investigation__title">Everyone has something to hide.</h2>
          <p className="investigation__subtitle">
            Read the room. Study the evidence. Trust no one.
          </p>
        </header>

        {/* Investigation board */}
        <div className="board">
          <svg
            className="board__threads"
            viewBox="0 0 1000 640"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M500 215 C 340 155, 230 100, 150 66" />
            <path d="M500 215 C 660 155, 770 100, 850 66" />
            <path d="M500 215 C 400 300, 270 335, 150 385" />
            <path d="M500 215 C 600 300, 740 335, 850 385" />
            <path d="M500 215 C 500 360, 500 480, 500 605" />
          </svg>

          <span className="board__stamp label">
            Confidential — Do Not Share
          </span>

          {BOARD_ORDER.map((id) => {
            const item = evidenceItems.find((evidence) => evidence.id === id)
            if (!item) return null
            return (
              <div
                key={item.id}
                className={`board__slot ${BOARD_POSITION[item.id]}`}
              >
                <div className="board__reveal">
                  <EvidenceCard
                    item={item}
                    examined={examined.has(item.id)}
                    onSelect={handleSelect}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Suspicion mechanic preview — visual only */}
        <section className="suspicion" aria-labelledby="suspicion-title">
          <div className="suspicion__head">
            <h3 className="label label--accent" id="suspicion-title">
              Suspicion — Case Preview
            </h3>
            <p className="suspicion__note">
              The mechanic to come is already on the table. Which one is it?
            </p>
          </div>

          <div className="suspicion__list">
            {suspectPreview.map((suspect) => (
              <div
                key={suspect.id}
                className={`suspicion__row suspicion__row--${suspect.suspicion.toLowerCase()}`}
              >
                <span className="label suspicion__name">{suspect.name}</span>
                <div className="suspicion__meter" aria-hidden="true">
                  <span style={{ width: suspicionMeterWidth[suspect.suspicion] }} />
                </div>
                <span className="label suspicion__level">{suspect.suspicion}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {active && <InvestigationDetail item={active} onClose={closeDetail} />}
    </section>
  )
}
