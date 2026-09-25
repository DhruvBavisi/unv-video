export const WORD_CATEGORIES = import.meta.env.PROD ? [
  { id: 'food', label: 'Food & Drink', description: 'Delicious treats and meals.' },
  { id: 'animals', label: 'Animals', description: 'Creatures from around the world.' },
  { id: 'household', label: 'Household', description: 'Everyday objects in your home.' },
  { id: 'technology', label: 'Technology', description: 'Gadgets and digital terms.' },
  { id: 'nature', label: 'Nature', description: 'The great outdoors.' }
] : [
  { id: 'places', label: 'Places', description: 'Familiar locations with close alternatives.' },
  { id: 'objects', label: 'Objects', description: 'Everyday objects with subtle distinctions.' },
  { id: 'open-file', label: 'Open File', description: 'A balanced rotating selection.' },
]

// Later online word data can be added here without changing room or role UI.
export const WORD_PAIRS = {
  places: [{ civilianWord: 'Ocean', undercoverWord: 'Swimming Pool' }],
  objects: [{ civilianWord: 'Camera', undercoverWord: 'Binoculars' }],
  'open-file': [{ civilianWord: 'Ocean', undercoverWord: 'Swimming Pool' }],
}
