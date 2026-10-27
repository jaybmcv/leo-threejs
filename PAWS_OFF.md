# Paws Off

A typing run on the Deck 16 exercise studio's six treadmills and the arcade treadmill in the Deck 17 Hydro-Nip Lounge, played in the ship itself so others aboard see Cosmo running. The idea came from tester feedback. Jay named it and set the stages on 2026-10-24.

## Stages

- **Stage 1, single player (built):**
  - E at a treadmill steps on. The camera goes behind Cosmo, a 3-2-1 countdown starts the belt, and he runs at its speed.
  - The display at the top shows the characters to type and a shrinking timer. Prompts grow from one character to six, letters and digits mixed, and the belt speeds up from 1.8 to 8 m/s.
  - A wrong key is a stumble: it costs 0.35 s of the prompt's time. Run out of time and Cosmo tumbles off the back onto the floor.
  - A card shows the time survived and this browser's best (kept in the browser only), with Run again and Step off.
  - While on the treadmill the game has the keyboard: typed letters never move Cosmo. Esc steps off at any time.
  - Others aboard see him on the belt with "· playing" under his name (the pose's existing playing flag), their copy of that belt scrolling and Cosmo running on it, then lying behind it after a fall.
  - On phones and tablets, an on-screen pad shows the prompt's characters plus decoys, eight keys in all.
- **Arcade station (built):** from tester feedback, Jay asked on 2026-10-26 for a second station in the Deck 17 arcade, an arcade-styled treadmill at the end of the row away from the stair, past the last cabinet, with the six Deck 16 treadmills kept as they are. Its deck is the Deck 16 treadmills' size, so a run there is the same game: the same prompt, countdown, fall and card (the card names the Arcade), and the same best in this browser.
- **Stage 2, multiplayer rounds (after Jay sees stage 1):** the live server runs a gym round for everyone on a treadmill when a short countdown ends, with one prompt seed for all, fall times collected and ranked results sent to everyone. Rounds live in memory only.
- **No permanent leaderboard:** typing is too easy to script, so results stay per round, plus your own best.

## As built

| Piece | Where | What |
|---|---|---|
| Rules | `src/walk/paws-off/rules.js` | Plain state and time steps, no drawing: the ramp of prompt lengths, timers and belt speed, the seeded prompt dealer (stage 2 can give everyone one seed), typing, stumbles, the touch pad |
| Game | `src/walk/paws-off/game.js` | Finds the room's `Treadmill` meshes by name (`areas.js` is unchanged), takes the arcade's treadmill as passed in, lays a scrolling belt over each, and runs the countdown, the run, the fall, the display, the card and the touch pad. Keys are caught before the walk sees them |
| Arcade | `src/walk/arcade.js` | The arcade treadmill past the row's last cabinet: a screen tower with a Paws Off screen and marquee, the deck, dash, handrails and neon, solid as plain boxes; `arcadeTreadmill()` says where its deck is |
| Walk | `src/walk/main.js` | E within 1.5 m offers "Play Paws Off". The run holds Cosmo on the belt instead of the controller; leaving puts him on the floor where he landed, or just behind the treadmill |
| Others | `src/walk/remotes.js` | Someone playing who stands on a belt runs on the spot instead of standing |
| Checks | `scripts/check-paws-off.mjs` (in `npm run check`), `scripts/check-live.mjs` | The rules, and typists of three speeds running until they fall; on the server, a runner on a treadmill reaching another visitor, playing, then lying behind it, then not playing, on Deck 16 and on the arcade's |

## Tuning

Each prompt gives 0.6 s to read it plus a share per character that shrinks from 1.1 s at the start to 0.2 s after 72 s. In the check's typists, a slow one falls at about 40 s, a typical one at about 58 s and a fast, careful one at about 77 s; none lasts past 100 s.

## Release

Page only: no server or protocol change, so no Leo live restart is needed.
