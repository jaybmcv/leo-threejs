# Container Maze

Deck 1's Container hold A on foot is a timed maze of small shipping containers, with the goal in the middle. The idea came from tester feedback. This is the first step: the maze, the clock and a shared board of fastest times.

## How it plays

- The hold's ten big container stacks and its aisle lines are gone on foot. A maze of 9 × 7 cells fills the hold from the end wall to 9.8 m short of the doorway, side wall to side wall, so the room's own walls are its outer walls. The space by the doorway stays open: the desk, the parked trolley and the Go to spot are there.
- Walls are rows of corrugated containers 2.2 m wide and 2.9 m tall, in mixed colours, door ends out. Corridors are 2.45 m and 2.93 m wide. Some straight corridors run through containers open at both ends, and some dead ends are containers open at one end, with closed doors at the back.
- A START header and a striped line mark the way in, facing the doorway. A sign beside it explains the game; E at the sign opens the best times.
- The clock starts when you walk in through START and shows at the top of the screen. E at the red button, on a striped console in the middle cell, stops it. Leaving the maze any other way (back out, Respawn, Go to) drops the run. **Give up**, beside the clock, and **Back to the start**, on the result card, take you back to the way in, so nobody has to find their way out.
- The result card shows your time, the top ten and your best. This browser keeps its own best too, so guests and solo walkers still have a time to beat.

## The layout

`src/walk/maze/layout.js` holds it as plain numbers, shared by the page, the server and the checks. It is one fixed maze (seed 1929, three loops), so every run is timed on the same course. A growing-tree maze gives long winding corridors with side branches; three extra openings near the middle then leave the walls nearest the button standing free of the outer ones, so keeping one hand on a wall never finds it. The way to the middle is 27 cells, about 131 m, with 10 dead ends.

## As built

| Piece | Where | What |
|---|---|---|
| Layout | `src/walk/maze/layout.js` | The cells, the walls as rectangles, the walk-through and walk-in containers, the button, the start line, the fastest believable time |
| Hold | `src/walk/maze/hold.js` | Takes the old stacks out before the colliders are built (`prepare.js`), builds the containers, header, sign, chequered middle and console, merged by material. Walls, hollow containers and the console are solid as plain boxes |
| Clock | `src/walk/maze/run.js` | The clock at the top, Give up, the result and board card, a beep to start and three notes to finish (following Sound) |
| Map | `src/walk/deck-map.js` | The hold shows as open floor: the old stacks no longer stand there, and the maze is for finding, not reading off the map |
| Board | `server/maze.mjs`, `src/walk/net/live.js` | One message, `maze` (`start`, `finish`, `board`). One fastest run per verified Discord player, in `leo-live-maze.json` beside the checkout (`LEO_LIVE_MAZE` overrides it) |
| Checks | `scripts/check-maze.mjs` (in `npm run check`), `scripts/check-live.mjs` | The layout, and the maze built and walked as the 2 m walker; the board between visitors |

## The clock and the board

- The page times the run. The server starts its own clock when the walker crosses START (their last pose must be within 8 m of the start line), keeps the page's time when the two agree (never more than 3 s under its own), and refuses a finish not made at the button (within 4 m) or faster than `MAZE_FASTEST_S`: the way at a 12 m/s sprint, with a third off for cutting corners (7 s).
- Guests can run and read the board, and are told to connect Discord to post times. As with the other games, times come from the player's browser, so a determined cheater can't be stopped entirely.

## Release

The server and page change together. Deploying needs the usual build and Vercel deploy, and a restart of the `LeoLive` scheduled task on the PC that hosts Leo live. Until that restart the maze, the clock and the browser's own best work, but the old server ignores the `maze` message: the board stays on "Loading…" and a finished run stays on "Saving your time…". No protocol bump is needed.

## What could follow

- A board in the hold itself (a screen beside the sign showing the top ten live), and a note in chat when someone sets a new record.
- Others aboard seeing "· running the maze" under a runner's name.
- A new layout now and then (a weekly seed), with its own board.
- Lights in the containers, stencilled numbers on their doors, and a few false leads, such as closed doors that look like ways through.
