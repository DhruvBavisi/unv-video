export const SPECIAL_ROLES = [
  {
    key: "joyFool",
    name: "Joy Fool",
    minPlayers: 3,
    description: "The Joy Fool has a singular, bizarre goal: to be eliminated by the group.",
    rules: [
      "Wins the investigation immediately if eliminated by a group vote.",
      "Does not know who the Undercovers or Mr. White are."
    ],
    avatar: null
  },
  {
    key: "duelists",
    name: "Duelists",
    minPlayers: 5,
    description: "Two players locked in a rivalry. One must fall for the other to triumph.",
    rules: [
      "Assigned to exactly two players.",
      "If one Duelist is eliminated, the surviving Duelist earns bonus points if they win the game."
    ],
    avatar: null
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
    avatar: null
  },
  {
    key: "revenger",
    name: "Revenger",
    minPlayers: 5,
    description: "A vindictive spirit who will not go down without a fight.",
    rules: [
      "If eliminated by vote, the Revenger can choose to eliminate one other player along with them."
    ],
    avatar: null
  },
  {
    key: "boomerang",
    name: "Boomerang",
    minPlayers: 5,
    description: "Resilient and lucky, eliminations bounce off them.",
    rules: [
      "The first time they would be eliminated, they survive and another random player is eliminated instead."
    ],
    avatar: null
  },
  {
    key: "goddessOfJustice",
    name: "Goddess of Justice",
    minPlayers: 3,
    description: "A seeker of truth who can reveal hidden identities.",
    rules: [
      "Once per investigation, can reveal the true role of any eliminated player."
    ],
    avatar: null
  },
  {
    key: "ghost",
    name: "Ghost",
    minPlayers: 3,
    description: "Even in death, they continue to haunt the investigation.",
    rules: [
      "Can continue to communicate with the remaining players after being eliminated."
    ],
    avatar: null
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
    avatar: null
  },
  {
    key: "mrMeme",
    name: "Mr. Meme",
    minPlayers: 3,
    description: "An eccentric investigator who only communicates in modern internet culture.",
    rules: [
      "Must only communicate using memes, emojis, or internet slang."
    ],
    avatar: null
  }
];
