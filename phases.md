# Undercover™ Phases

The official game has three core gameplay phases:

1. **Description Phase** (CLUE) — players give clues for their secret words.
2. **Discussion Phase** (VOTE) — players discuss identities and suspects.
3. **Elimination Phase** (ELIMINATION) — players vote to eliminate someone; if Mr. White is eliminated, they receive one word-guess attempt.

*Note: In the current repository architecture, these are mapped to `CLUE → VOTE → ELIMINATION → RESULT` game phases.*

---

### Official Scoring Phase

**Purpose:** Apply official Undercover victory points and existing special-role modifiers when the investigation ends.

**Base scoring:**
* Civilian winner: +2 per Civilian
* Undercover winner: +10 per Undercover
* Mr. White winner: +6 per Mr. White

**Special modifiers:**
* Joy Fool first eliminated by vote: +4
* Duelist first eliminated: −2
* Surviving Duelist: +2

**Rules:**
* Scoring is server-authoritative.
* Base victory points are awarded exactly once per game.
* Special-role modifiers stack with victory points.
* Points are displayed on the RESULT screen.
* Points are reset only when a genuinely new game begins according to the existing lifecycle (via Play Again / Start Game).
