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
- **Stage 2, gym rounds (built):** with Leo live, every run is a gym round.
  - Stepping onto any treadmill (the six on Deck 16 or the arcade's) joins the round's countdown, or opens one: 6 s from the first to step on. A late joiner pushes the end back to give them the 3-2-1, but never past 12 s from the start. The display shows the seconds left and how many are on the treadmills, and the belt starts in the last three.
  - When the countdown ends, everyone still on a treadmill (their pose says they are playing) runs on one prompt seed, so all type the same prompts on the same ramp. Anyone who asked but isn't on one by then is told to run alone.
  - Each page says when its runner fell and after how long on the belt; the server never takes a time longer than the round has run. Others hear each fall ("Bea fell at 31.2 s") and the display counts who is still running.
  - Once everyone is off, every runner's card ranks the round: place, name and time, theirs marked, and "2nd of 4" at the top. Someone who steps off (Esc) or leaves the ship mid-round is out at once and listed after those who fell. A round of one says no one else was on a treadmill.
  - Rounds live in the server's memory only and are forgotten once their results are sent. A round still running after 3 minutes is closed.
  - Without Leo live, or with a server that has no gym rounds yet (no answer within 1.5 s), a run is single player, as in stage 1. If the link drops during a countdown, the run goes on alone; during a run, it plays on and the card says the results didn't come.
- **No permanent leaderboard:** typing is too easy to script, so results stay per round, plus your own best.

## As built

| Piece | Where | What |
|---|---|---|
| Rules | `src/walk/paws-off/rules.js` | Plain state and time steps, no drawing: the ramp of prompt lengths, timers and belt speed, the seeded prompt dealer (stage 2 can give everyone one seed), typing, stumbles, the touch pad |
| Game | `src/walk/paws-off/game.js` | Finds the room's `Treadmill` meshes by name (`areas.js` is unchanged), takes the arcade's treadmill as passed in, lays a scrolling belt over each, and runs the countdown, the run, the fall, the display, the card and the touch pad. Keys are caught before the walk sees them |
| Arcade | `src/walk/arcade.js` | The arcade treadmill past the row's last cabinet: a screen tower with a Paws Off screen and marquee, the deck, dash, handrails and neon, solid as plain boxes; `arcadeTreadmill()` says where its deck is |
| Walk | `src/walk/main.js` | E within 1.5 m offers "Play Paws Off". The run holds Cosmo on the belt instead of the controller; leaving puts him on the floor where he landed, or just behind the treadmill |
| Others | `src/walk/remotes.js` | Someone playing who stands on a belt runs on the spot instead of standing |
| Gym rounds | `server/gym.mjs` (passed its messages by `server/leo-live.mjs`), `src/walk/net/live.js` | The countdown, the shared seed, falls, leavers and the ranked results, in memory only |
| Checks | `scripts/check-paws-off.mjs` (in `npm run check`), `scripts/check-live.mjs` | The rules, and typists of three speeds running until they fall; on the server, a runner on a treadmill reaching another visitor, playing, then lying behind it, then not playing, on Deck 16 and on the arcade's; and gym rounds: a runner on Deck 16 and one at the arcade joining one countdown and running on one seed (someone not on a treadmill is told to run alone), a fall reaching the other runner, the same ranked results reaching both, a time cut to what the round ran, someone leaving mid-round, and a countdown given up |

## Tuning

Each prompt gives 0.6 s to read it plus a share per character that shrinks from 1.1 s at the start to 0.2 s after 72 s. In the check's typists, a slow one falls at about 40 s, a typical one at about 58 s and a fast, careful one at about 77 s; none lasts past 100 s.

## Release

Stage 1 was page only. Stage 2 changes the Leo live server (`server/gym.mjs`), so it needs a Leo live restart after merging. The protocol number is unchanged: until the restart, the old server ignores the gym messages and every run is single player, exactly as in stage 1.
