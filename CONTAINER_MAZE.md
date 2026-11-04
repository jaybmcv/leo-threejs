# Container Maze

Deck 1's Container hold A on foot is a timed maze of small shipping containers, with the goal in the middle. The idea came from tester feedback. The maze, clock and shared fastest times now have container numbering, overhead fixtures and an entrance screen.

## How it plays

- The hold's ten big container stacks and its aisle lines are gone on foot. A maze of 9 × 7 cells fills the hold from the end wall to 9.8 m short of the doorway, side wall to side wall, so the room's own walls are its outer walls. The space by the doorway stays open: the desk, the parked trolley and the Go to spot are there.
- Walls are rows of corrugated containers 2.2 m wide and 2.9 m tall, in mixed colours, door ends out. Corridors are 2.45 m and 2.93 m wide. Some straight corridors run through containers open at both ends, and some dead ends are containers open at one end, with closed doors at the back.
- A START header and a striped line mark the way in, facing the doorway. A sign beside it explains the game; E at the sign opens the best times.
- The clock starts when you walk in through START and shows at the top of the screen. E at the red button, on a striped console in the middle cell, stops it. Leaving the maze any other way (back out, Respawn, Go to) drops the run. **Give up**, beside the clock, and **Back to the start**, on the result card, take you back to the way in, so nobody has to find their way out.
- The result card shows your time, the top ten and your best. This browser keeps its own best too, so guests and solo walkers still have a time to beat.
- A screen beside the entrance sign shows the same top ten without opening a card. It refreshes every 15 seconds while someone is in the entrance foyer or reading the card. E at the screen opens the existing details.
- Containers have stable cargo IDs on their door ends and open headers. Warm diffusers sit inside the open containers. Neither feature marks the route to the finish.

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

## Entrance polish dimensions and dependencies

All new dressing is in the existing hold's fitting frame, in metres; X runs from the entrance toward the end wall. The screen is 3.2 m wide by 2.4 m high, centred at `[X0-.075,1.65,entrance.z1+6.5]`, facing the doorway. Its 3.3 by 2.5 m surround sits on the solid front row beside the instruction sign, clear of START, the desk, trolley and Go to spot. It adds no collision. Both the screen and sign open the existing details within 2.2 m.

The 99 containers have 0.92 by 0.28 m ID plates, shared between their ends, using one texture atlas and one merged draw. Open-container headers sit at 2.7 m; the 0.72 by 0.13 m warm diffusers sit just below the 2.9 m roof, at most 3.5 m apart. Fixtures use a shared unlit material rather than additional dynamic lights. Container bodies, colliders, layout seed, timing rules, records and exit behavior are unchanged.

`hold.js` and `run.js` have no parallel variants: all four `prepare` and `main` variants import these same modules. This step uses the existing `maze/board` response and introduces no dependency, protocol or persistence change.

## The clock and the board

- The page times the run. The server starts its own clock when the walker crosses START (their last pose must be within 8 m of the start line), keeps the page's time when the two agree (never more than 3 s under its own), and refuses a finish not made at the button (within 4 m) or faster than `MAZE_FASTEST_S`: the way at a 12 m/s sprint, with a third off for cutting corners (7 s).
- Guests can run and read the board, and are told to connect Discord to post times. As with the other games, times come from the player's browser, so a determined cheater can't be stopped entirely.

## Release

The original maze step required a server restart to enable its `maze` messages. This polish uses that existing support; it does not change the server. Production support still needs a fresh verification before describing the entrance board as live.

If disconnected, both the screen and card say the board is offline. If connected but no board response arrives within six seconds, they say it is unavailable and retry on the next refresh. An unanswered finish also stops waiting after six seconds and explains that the browser best is kept. Late replies still update the card and screen. No shared times are invented or displayed as current while disconnected.

## What could follow

- A note in chat when someone sets a new record.
- Others aboard seeing "· running the maze" under a runner's name.
- A new layout now and then (a weekly seed), with its own board.
- More false leads, such as closed doors that look like ways through.
