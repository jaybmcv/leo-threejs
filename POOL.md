# Paw Pool

A soccer-ball pool table on the Recreation Hall's blue activity floor (Deck 16), with a kick game played at it. The idea came from tester feedback. Jay named it and set the stages on 2026-10-24.

## Stages

- **Stage 1, the table (built):** a low-railed pool table on the ground that fills the activity floor, with six pockets and 16 numbered soccer-pattern balls racked. It stays inside the carpet, so the hall's walkways around it don't change, and it is solid to walk into. The look is our own.
- **Stage 2, 1-player practice (built):** a full-window overlay game like Alien Cat Invasion, opened with E at the table.
  - A top-down view of the table. Cosmo's leg winds up to kick the cue ball, instead of a cue.
  - A white aim line to where the cue ball will hit, then hold to kick: a power bar rises and falls, and letting go kicks.
  - Pot any ball in any order, against the clock. A result screen shows the clear time.
  - Mouse, touch and gamepad.
- **Leaderboard (built):** fastest 1-player clear times, signed-in (verified Discord) players only. It is a second board in Invasion's store on the live server, not a new store. The server times the game and refuses impossibly fast clears.
- **Stage 3 (later, after Jay sees stage 2):** 2-player 8-ball on the same computer, taking turns, with the usual rules and a winner screen. Online 2-player is parked.

## As built

| Piece | Where | What |
|---|---|---|
| Rules | `src/walk/pool/rules.js` | Plain state and a fixed 240 Hz step, no drawing: the rack, the kick, rolling, balls meeting, cushions that open at each pocket's mouth, pockets, the cue ball coming back to the head spot after it drops, the clock, and the aim line's first contact |
| Table | `src/walk/pool/table.js` | The 3D table, built in the walk only (the ship's models and exports are unchanged). It finds the hall's `Activity_floor` and sits on it. The playing area is 14 × 8 m inside 0.45 m rails, 0.45 m high, too high to step over. Turf with pitch markings (halfway line, centre circle, spots), navy rails with bronze inlays, six pockets with bronze rims, and the balls racked from the rules' own rack |
| Screen | `src/walk/pool/game.js` | The overlay: title, play and result screens, the table from above (it stands up the long way on a tall screen), the aim line and ghost ball, Cosmo's leg, the power bar, the clock and the fifteen balls. Keys, mouse, touch and gamepad |
| Sound | `src/walk/pool/sound.js` | Synthesized kick, clicks, cushion, pocket and fanfare. It follows the walk's Sound toggle |
| Walk | `src/walk/main.js` | E within 1.4 m of the table offers "Play Paw Pool". The walk stands still behind the game, and others see "· playing" under the name (the pose's existing playing flag) |
| Leaderboard | `server/leo-live.mjs`, `src/walk/net/live.js` | Invasion's `play`, `score` and `board` messages with `game: 'pool'`. One fastest clear per verified player, kept in `leo-live-scores.json` beside Invasion's scores as entries marked `game: 'pool'` |
| Checks | `scripts/check-pool.mjs` (in `npm run check`), `scripts/check-live.mjs` | The rules and a bot clearing whole racks; the server's pool board between two visitors |

## Controls

- **Mouse:** point to aim. Hold the button to kick and let go at the power you want.
- **Keys:** ← → (or A, D) turn the aim, and Shift turns it finer. Hold Space or Enter to kick. Esc returns to Leo.
- **Touch:** drag on the table to aim, then hold the KICK button.
- **Gamepad:** the left stick points the aim, the right stick or the d-pad turns it finely, and holding A kicks.

## The clock and the board

- The clock starts when the rack appears and stops when the last ball drops. A dropped cue ball comes back to the head spot at no cost in practice.
- The server starts its own clock at the same moment. It keeps the page's time when the two agree, but never more than 3 s under its own. It refuses a clear under 20 s by either clock (`src/walk/pool/limits.js`).
- The check's bot shoots the instant the balls stop and clears a rack in 36–48 s, so 20 s is far past any player. As with Invasion, the times come from the player's browser, so a determined cheater can't be stopped entirely.
- Guests can play and see the board, and are told to sign in to post a time.

## Release

The server and page change together. Deploying needs the usual build and Vercel deploy, and a restart of the `LeoLive` scheduled task on the PC that hosts Leo live. Until that restart, the table and the game work, but times aren't saved: the old server refuses them, and the board stays on "Loading…".

No protocol bump is needed: the old pages keep working with the new server.
