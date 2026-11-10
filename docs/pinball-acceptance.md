# Leo Pinball: acceptance record

Project-local record for the existing Recreation Hall machine and game (`src/walk/pinball/`, wired in `prepare*.js` and `main*.js`). Nothing was rebuilt, moved or repaired: no failure was demonstrated.

This record was written in a checkout with no built layout 2 (`output/leo-interior-v02/layout.json` was absent) and no browser driver, so the walk could not be loaded. The in-walk steps (approach, prompt, enter) are marked below as not rerun here and need the post-build browser visit.

## Where it is

The report's view (`walk.html?at=78.02,20.30,-38.89&yaw=368&pitch=-13`) is a Deck 16 Recreation Hall spot from layout 1 and is not a placement instruction. The machine finds the hall by name (`Area_d16-recreation-4`, through `roomObject`) and stands in the room's own frame against the end wall (`WALL=25.84`, centre line `Z=0`), so it follows the hall into layout 2. `src/v2/goto-features.js` already carries a `pinball` go-to at `[23.7,0,0]` in that room, facing the machine. The prompt shows within 1.3 m of the spot in front of it ("Play Leo Pinball"), and E opens the game in all four walk copies (`main`, `.public`, `.prepared`, `.authoring`).

## Verified here

- `node scripts/check-pinball.mjs` passes (plunger, flippers, every scoring piece, ball save, game over, 30 minutes of bot play, determinism).
- The overlay (`game.js`) was driven in Node with a small DOM stand-in (not committed), keyboard and touch, over the real source:
  - Keyboard: opening turns walk input off; walking keys are swallowed while it is open; Space starts; hold and release launches the ball out of the lane; Left/Z and Right/Slash each raise their own flipper; flipping scores (3540 points in one short run); an idle game runs to GAME OVER; Space restarts at 0; closing turns walk input back on and the walk's own key listener sees keys again.
  - Touch: a tap starts; the LAUNCH button launches; the ◀ FLIP and FLIP ▶ buttons raise their flippers; tapping the left half of the table raises the left flipper; closing restores walk input.
- Exit wiring: `onOpen` turns `input.enabled` off; `onClose` turns it on and clears held keys, as Paw Pool's does. The overlay sits at z-index 60, above every walk control (the highest is the loading cover at 20). The camera is not touched while it is open, so the walk resumes in the same view.

## Not rerun here

- Walking up to the machine in the built layout 2 and seeing the prompt and the machine at the end wall (the earlier step's screenshots showed it on the live site).
- Real-browser keyboard and touch on a phone, and the sound by ear.

## Observation, not changed

A ball can come to rest wedged where the inlane wall ends against a flipper's pivot (seen at about x 154, y 364 on the right, mirrored on the left). The idle-ball nudge skips balls near a flipper, so an untouched game can wait there indefinitely. Pressing either flipper frees it at once (checked), so every listed function still works and the brief asked for demonstrated failures only. If testers report a stuck ball, let the nudge fire for a ball that has not moved for several seconds even near a flipper.
