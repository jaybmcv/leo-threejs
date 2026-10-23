# Alien Cat Invasion (feedback-inbox #69)

A classic invaders game played through the telescope in Leo's forward observation lounge. Idea from tester Tochtli. Leo is the player ship, the Alien Cats are the invaders and Mars is the backdrop. The name, sprites and look are our own; only the classic rules are borrowed.

## Decisions (Jay, 2026-10-23: the defaults)

- **Opening and closing:** E at the telescope offers "Play Alien Cat Invasion". The game opens full-screen over the walk, and Esc or the close button returns the player to where they stood. Telescope only.
- **Look:** crisp retro pixel art in Mars Cats Voyage colours, on a starfield with Mars behind (the walk's own Mars texture).
- **Player ship:** a pixel sprite traced from Leo's top view: rounded bow, windowed hull, two engine pods on swept wings.
- **Invaders:** three original pixel Alien Cats (scout, tabby, brute) and a cat-head mothership. They are placeholders until canon Alien Cat art is supplied.
- **Rules:** classic.
  - A 5 × 11 formation that marches sideways, steps down at the edges and speeds up as it thins.
  - One player shot on screen at a time, three lives, four destructible shields, and a mystery mothership.
  - Points: 10 for a brute, 20 for a tabby, 30 for a scout, 50–300 for the mothership.
  - An extra life at 1,500. Endless waves, each starting a step lower.
- **Leaderboard:** signed-in (verified Discord) players only.
  - Shows the all-time top 10 and the player's own best.
  - Keeps one best score per player (name, score, date), on the live server beside its checkout.
  - The server rejects impossible scores. Scores come from the player's browser, so a determined cheater can't be stopped.
- **Presence:** while someone plays, others see their avatar at the telescope with "playing" under their name.
- **Sound:** synthesized effects (shot, hit, the four-note march that speeds up, the mothership), following the walk's Sound toggle.
- **Phones:** on-screen left and right buttons and a fire button.
- **Rewards:** none.
- **Gate:** a mock-up of the title and play screens is approved before building.

## Plan

| Piece | Where | What |
|---|---|---|
| Sprites | `src/walk/invasion/sprites.js` | Pixel grids and palettes, drawn once to canvases (done: the mock-up uses them) |
| Rules | `src/walk/invasion/rules.js` | The game as plain state and a fixed 60 Hz step: formation, march timing, shots, bombs, shields, mothership, scoring, lives, waves. No drawing, so Node can test it |
| Screen | `src/walk/invasion/game.js` | The overlay: a 240 × 270 logical canvas scaled by whole pixels, title, play, game over and leaderboard screens, keyboard, touch and gamepad input, its own loop while open, Esc to leave |
| Sound | `src/walk/invasion/sound.js` | Web Audio synth for each effect; muted when the walk's Sound is off |
| Telescope | `src/walk/main.js` | A new "play" use at the lounge telescope. The walk's input and movement pause while the game is open, and the walker returns to where they stood |
| Presence | `src/walk/net/wire.js`, `server/leo-live.mjs`, `src/walk/remotes.js` | A "playing" flag in the pose; others show "playing" under the name. Protocol version bump |
| Leaderboard | `server/leo-live.mjs`, `src/walk/net/live.js` | Messages: `play` (a game starts), `score` (it ends) and `board`. Verified visitors only. The server stores `leo-live-scores.json` beside its checkout and checks each score against the play time (points per second cap) |
| Checks | `scripts/check-invasion.mjs`, `scripts/check-live.mjs` | Node tests of the rules (march, speed-up, wave reset, scoring, shields, lives) and of the server's leaderboard (verified only, sanity checks, top 10, best per player) |

**Size and cost:** the game is a few tens of KB in the walk bundle. It draws its own canvas only while open, so the walk costs nothing extra while walking.

**Release:**
- The server and page change together (protocol bump).
- Deploying needs the usual build and Vercel deploy, plus a restart of the `LeoLive` scheduled task on this PC, which Jay approves at the time.

**Not in scope:** rewards, tokens, a shared live mode (two players in one game), or any other arcade.
