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
    mobileDescription: "The Joy Fool wins 4 extra points if voted out first!",
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
    mobileDescription: "Two players are in a secret duel. The first one to get eliminated loses 2 points, the other one wins 2 points",
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
    mobileDescription: "Two players are in love. If one of them gets eliminated, the other one too",
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
    mobileDescription: "When the Revenger is eliminated, she can eliminate someone else with her",
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
    mobileDescription: "The first time the Boomerang receives the majority of votes, the votes bounce back to those who cast them!",
    avatar: '/images/characters/boomerang.png',
    implemented: false
  },
  {
    key: "goddessOfJustice",
    name: "Goddess of Justice",
    minPlayers: 3,
    description: "A seeker of truth who can reveal hidden identities.",
    rules: [
      "Once per investigation, can reveal the true role of any eliminated player."
    ],
    mobileDescription: "In case of equality of votes, she decides who gets eliminated (even if she has already been eliminated)",
    avatar: '/images/characters/goddessofjustice.png',
    implemented: false
  },
  {
    key: "ghost",
    name: "Ghost",
    minPlayers: 3,
    description: "Even in death, they continue to haunt the investigation.",
    rules: [
      "Can continue to communicate with the remaining players after being eliminated."
    ],
    mobileDescription: "The Ghost can still vote even after being eliminated!",
    avatar: '/images/characters/ghost.png',
    implemented: false
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
    mobileDescription: "He receives a random ability each game. Try your luck and see what surprises await!",
    avatar: '/images/characters/falafalvendor.png',
    implemented: false
  },
  {
    key: "mrMeme",
    name: "Mr. Meme",
    minPlayers: 3,
    description: "An eccentric investigator who only communicates in modern internet culture.",
    rules: [
      "Must only communicate using memes, emojis, or internet slang."
    ],
    mobileDescription: "Each round, 1 player must describe their secret word with gestures instead of speaking (only in person or with video)",
    avatar: '/images/characters/mrmeme.png',
    implemented: false
  }
];
