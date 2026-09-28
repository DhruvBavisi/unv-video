export const SPECIAL_ROLES = [
  {
    key: "joyFool",
    name: "Joy Fool",
    minPlayers: 3,
    description: "The Joy Fool has a singular, bizarre goal: to be eliminated by the group.",
    rules: [
      "The Joy Fool receives a +4 point bonus if eliminated in the first elimination of the investigation.",
      "Does not know who the Undercovers or Mr. White are."
    ],
    avatar: '/images/characters/joyfool.png'
  },
  {
    key: "duelists",
    name: "Duelists",
    minPlayers: 5,
    description: "Two players locked in a rivalry. One must fall for the other to triumph.",
    rules: [
      "Assigned to exactly two players.",
      "If a Duelist is eliminated first, the eliminated player loses 2 points, and the surviving Duelist gains 2 points.",
      "The duel resolves only once."
    ],
    avatar: '/images/characters/duelist.png'
  },
  {
    key: "lovers",
    name: "Lovers",
    minPlayers: 5,
    description: "Two players bound by a secret romance. Their fates are intertwined.",
    rules: [
      "Assigned to exactly two players.",
      "If one Lover is eliminated, the other Lover is immediately eliminated from a broken heart."
    ],
    avatar: '/images/characters/lovers.png'
  },
  {
    key: "revenger",
    name: "Revenger",
    minPlayers: 5,
    description: "A vindictive spirit who will not go down without a fight.",
    rules: [
      "If eliminated by vote, the Revenger can choose to eliminate one other player along with them."
    ],
    avatar: '/images/characters/revenger.png'
  },
  {
    key: "boomerang",
    name: "Boomerang",
    minPlayers: 5,
    description: "Resilient and lucky, eliminations bounce off them.",
    rules: [
      "The first time they would be eliminated, they survive and another random player is eliminated instead."
    ],
    avatar: '/images/characters/boomerang.png'
  },
  {
    key: "goddessOfJustice",
    name: "Goddess of Justice",
    minPlayers: 3,
    description: "A seeker of truth who can reveal hidden identities.",
    rules: [
      "Once per investigation, can reveal the true role of any eliminated player."
    ],
    avatar: '/images/characters/goddessofjustice.png'
  },
  {
    key: "ghost",
    name: "Ghost",
    minPlayers: 3,
    description: "Even in death, they continue to haunt the investigation.",
    rules: [
      "Can continue to communicate with the remaining players after being eliminated."
    ],
    avatar: '/images/characters/ghost.png'
  },
  {
    key: "falafelVendor",
    name: "Falafel Vendor",
    minPlayers: 4,
    description: "A generous provider of delicious snacks that demand your full attention.",
    rules: [
      "Can give a falafel to one player per round.",
      "The player eating the falafel cannot speak for the remainder of the round."
    ],
    avatar: '/images/characters/falafalvendor.png'
  },
  {
    key: "mrMeme",
    name: "Mr. Meme",
    minPlayers: 3,
    description: "An eccentric investigator who only communicates in modern internet culture.",
    rules: [
      "Must only communicate using memes, emojis, or internet slang."
    ],
    avatar: '/images/characters/mrmeme.png'
  }
];
