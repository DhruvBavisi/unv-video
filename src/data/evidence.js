// ============================================================
// UNDERCOVER — Evidence catalogue (Phase 5)
//
// Centralized investigation data. UI components consume these
// records — no large content blocks inside JSX. The same model
// lays groundwork for the future gameplay phases (clues, suspects,
// locations, statements) without implementing any game logic.
// ============================================================

export const EVIDENCE_TYPES = {
  DOCUMENT: 'DOCUMENT',
  PHOTO: 'PHOTO',
  LOCATION: 'LOCATION',
  OBJECT: 'OBJECT',
  STATEMENT: 'STATEMENT',
}

export const EVIDENCE_STATUS = {
  UNEXAMINED: 'unexamined',
  EXAMINED: 'examined',
  SUSPICIOUS: 'suspicious',
}

export const SUSPICION_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
}

// Surveillance photos reuse frames from the existing cinematic
// frame sequence (already preloaded by the cinematic renderer).
const P = (frame) => ({ src: `/images/cinematic/${frame}.jpg`, frame })

export const evidenceItems = [
  {
    id: 'file-evidence',
    type: EVIDENCE_TYPES.DOCUMENT,
    title: 'Undercover Case File',
    description: 'The classified file every party wants. Partial, redacted, and damning.',
    status: EVIDENCE_STATUS.SUSPICIOUS,
    notes:
      'Pages 1–12 and 14 are missing. Watermark reads C-1. The dossier ties three identities to one table — and only one of them knows it.',
    metadata: ['REF: C-1', 'PAGES: FOUND 2/15', 'WORDS REDACTED: 41'],
    suspicion: SUSPICION_LEVELS.HIGH,
  },
  {
    id: 'map-districts',
    type: EVIDENCE_TYPES.LOCATION,
    title: 'District Map — Drop Site',
    description: 'A transit map with one district circled. Someone knew exactly where to wait.',
    status: EVIDENCE_STATUS.UNEXAMINED,
    notes:
      'Circle made in black ink, post-dated. The Terminal is four minutes from the pick-up point on foot.',
    metadata: ['REF: L-02', 'MARKED: 1', 'INK: BLACK'],
    suspicion: SUSPICION_LEVELS.MEDIUM,
  },
  {
    id: 'photo-civilian',
    type: EVIDENCE_TYPES.PHOTO,
    title: 'Surveillance — The Civilian',
    description: 'Near the table before anyone else. Hands open. Eyes not.',
    image: P('frame_0133'),
    status: EVIDENCE_STATUS.UNEXAMINED,
    notes:
      'Frame 0133 of the room feed. The Civilian is the only subject who reacts before the question is even asked.',
    metadata: ['REF: P-03', 'FRAME: 0133', 'SOURCE: ROOM FEED'],
    suspicion: SUSPICION_LEVELS.LOW,
    characterRef: 'civilian',
  },
  {
    id: 'photo-undercover',
    type: EVIDENCE_TYPES.PHOTO,
    title: 'Surveillance — The Undercover',
    description: 'Never seen reaching for the file. Never seen leaving it either.',
    image: P('frame_0217'),
    status: EVIDENCE_STATUS.SUSPICIOUS,
    notes:
      'Frame 0217. Collar high, hat low. His right hand stays out of every frame that matters.',
    metadata: ['REF: P-04', 'FRAME: 0217', 'SOURCE: ROOM FEED'],
    suspicion: SUSPICION_LEVELS.HIGH,
    characterRef: 'undercover',
  },
  {
    id: 'photo-mrwhite',
    type: EVIDENCE_TYPES.PHOTO,
    title: 'Surveillance — Mr. White',
    description: 'At the table longest. Leaving last. Answering first.',
    image: P('frame_0337'),
    status: EVIDENCE_STATUS.UNEXAMINED,
    notes:
      'Frame 0337. Mr. White anchors the room. His calm reads as authority — or as a perfect rehearsal.',
    metadata: ['REF: P-05', 'FRAME: 0337', 'SOURCE: ROOM FEED'],
    suspicion: SUSPICION_LEVELS.MEDIUM,
    characterRef: 'mrWhite',
  },
  {
    id: 'walkie-transcript',
    type: EVIDENCE_TYPES.OBJECT,
    title: 'Walkie-Talkie Log',
    description: 'A scratchy transmission. One voice, no name: "It is done."',
    status: EVIDENCE_STATUS.UNEXAMINED,
    notes:
      'Log W-01. Timestamp matches the minute the room feed briefly glitched at 12:06.',
    metadata: ['REF: W-01', 'TIME: 12:06', 'CHANNEL: 4'],
    suspicion: SUSPICION_LEVELS.MEDIUM,
  },
  {
    id: 'note-anonymous',
    type: EVIDENCE_TYPES.STATEMENT,
    title: 'Handwritten Note',
    description: '"Trust no one. Not even the one who hands you the file."',
    status: EVIDENCE_STATUS.SUSPICIOUS,
    notes:
      'Written in pencil, unsigned. Paper matches the notepad on the table — the same one every subject handled.',
    metadata: ['REF: S-06', 'HAND: UNKNOWN', 'PENCIL'],
    suspicion: SUSPICION_LEVELS.HIGH,
  },
  {
    id: 'evidence-marker',
    type: EVIDENCE_TYPES.OBJECT,
    title: 'Evidence Marker — Key',
    description: 'A single key found under the map. Untagged. Unexplained.',
    status: EVIDENCE_STATUS.UNEXAMINED,
    notes:
      'Marker #3. No tag, no chain, no prints. It opens something this room cannot see.',
    metadata: ['REF: E-03', 'STATUS: UNTAGGED'],
    suspicion: SUSPICION_LEVELS.LOW,
  },
]

// Suspicion mechanic preview — visual only. No scoring is implemented.
export const suspectPreview = [
  { id: 'civilian', name: 'THE CIVILIAN', suspicion: SUSPICION_LEVELS.LOW },
  { id: 'undercover', name: 'THE UNDERCOVER', suspicion: SUSPICION_LEVELS.HIGH },
  { id: 'mrWhite', name: 'MR. WHITE', suspicion: SUSPICION_LEVELS.MEDIUM },
]

// Visual meter widths for the suspicion preview (not actual values).
export const suspicionMeterWidth = {
  [SUSPICION_LEVELS.LOW]: '26%',
  [SUSPICION_LEVELS.MEDIUM]: '58%',
  [SUSPICION_LEVELS.HIGH]: '92%',
}