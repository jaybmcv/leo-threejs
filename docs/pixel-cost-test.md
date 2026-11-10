# Is a slow desktop short of pixels or of triangles?

A tester's M5 MacBook Air drew the open atrium at 18 frames a second with the GPU taking 51 ms a frame. #455 and #460 cut the triangles it draws. Whether that is what the GPU was short of has not been measured: it may be the pixels instead (multisampled edges, the drawing size, depth writes). These links answer it on the tester's own machine.

Each link opens the walk at the open atrium with the Stats readout on (`?fps=1`) and pins everything it draws with, so the tester's own Detail and Res choices don't change the result. Nothing is saved on their browser.

Base: `walk.html?fps=1&lv=2&at=0,-19.7,0&yaw=90&pitch=0`

| | Add to the base | Compare with | What the GPU time tells you |
|---|---|---|---|
| A | `&detail=high&deskaa=1&deskdepth=log&res=high` | | The reference. |
| B | `&detail=high&deskaa=0&deskdepth=log&res=high` | A | What multisampling costs. |
| C | `&detail=high&deskaa=1&deskdepth=log&res=low` | A | A quarter of the pixels. If the GPU time falls most of the way with it, the machine is short of pixels. If it barely moves, it is short of triangles. |
| D | `&detail=performance&deskaa=1&deskdepth=log&res=high` | | The reference for E: Performance's shorter haze, so fewer triangles than A. |
| E | `&detail=performance&deskaa=1&deskdepth=linear&res=high` | D | What the logarithmic depth buffer's depth writes cost. Linear depth always holds the haze at Performance's, so it is only comparable with D. |
| F | `&detail=high&deskaa=1&deskdepth=log&res=high&deskpiece=0` | A | What #455's view-culled pieces save on this machine. |

The `desk` switches apply where the main pointer is a mouse or trackpad. A touch-first device is treated as a phone and takes `?phoneaa=0` and `?phonedepth=linear` instead. `?res=` works on both; `?detail=` only where the desktop's ship is loaded.

Ask for the whole Stats box from each, after standing still for ten seconds. Its lines say what was measured: frames a second and frame times, CPU and GPU time, draws and triangles, the drawing size and pixel ratio, `msaa ×4` or `msaa off` with `log depth` or `linear depth`, and the GPU's name. The GPU time shows only where the browser can time it; where it reads `n/a`, compare the median frame time instead.

## The switches

- `?deskaa=0` or `1`: a desktop's multisampling off or on, whatever the Detail level chose (`src/walk/pixel-switches.js`). A phone has `?phoneaa=0`.
- `?res=high`, `med` or `low`: holds that level of the Res button for this visit. Nothing is saved, and slow frames never step it down, so one measurement keeps one drawing size. Works on phones too.
- `?deskdepth=linear` or `log`, `?detail=high`, `balanced` or `performance`, and `?deskpiece=` were already there (`src/walk/main.public.js`, `src/walk/detail-levels.js`, `src/v2/desk-piece.js`).

`node scripts/check-pixel-switches.mjs` checks the two new switches and the Stats line.
