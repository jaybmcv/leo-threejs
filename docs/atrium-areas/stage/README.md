# G5 Common stage: amphitheatre (concept stage-a)

The stage's 145 teal theatre chairs on a flat grey floor become four shallow curved tiers of warm timber with 62 cream
cushions, curving round in front of the stage. The stage keeps its 14 x 32 m timber deck and its THE COMMON STAGE sign;
the navy backdrop behind it becomes a cream stone wall. The plaza between the tiers and the stage is pale travertine.

![stage-wide: before, concept A, after; day (top) and night (bottom)](contact-stage-wide.jpg)

![stage-front: before and after, day (top) and night (bottom)](contact-stage-front.jpg)

![the refine pass at stage-wide and stage-front: first build (left), final (right)](refine-pass.jpg)

*Before is main a7b127ff, after is e0671d2b; both are r187 builds (three 0.187.0) in `leo-floor-before`, captured with
`scripts/capture-atrium-areas.mjs --only=stage-wide,stage-front --query=time=day|night` (the before set was taken by
atrium-lake-food from its a7b127ff build). The concept was painted over an older, brighter capture, so compare layout and
hue, not brightness.*

## What changed

| File | Change |
| --- | --- |
| `src/v2/atrium-stage.js` (new) | Tiers, nosings, cushions, seats, stage deck and back wall (`addAtriumStage`), their shapes (`stageGeometry`) and plan (`stageTiers`, `stageSeats`) |
| `src/v2/phase6-programme.js` | The stage platform/backdrop line and the chair grid become one `addAtriumStage({parts,rests,y})` call; the sign line is unchanged |
| `src/v2/phase4-fitout.js` (+ `.authoring.js`) | `stageGeometry(b)` is tried after `reflectionGeometry(b)` for parts with a `stageShape` |
| `src/v2/standing.js` | The tier treads are planned floors, like the Forum terraces |
| `src/plan/atrium-v2.js` | The stage zone's floor colour: grey `0xb6b8b0` becomes pale travertine `0xf2d7b4` |
| `src/v2/atrium-surfaces.js` (+ `.authoring.js`) | The stage zone takes the travertine paver texture (`paved`), in its own colour |

## How the tiers work

- **Plan.** Four annular sectors about a centre 4 m in front of the stage (x 102, z 30): treads at radii 24.4–26.6,
  26.6–28.8, 28.8–31 and 31–35.5 m. The top tier is a 4.5 m promenade; the stage-wide viewpoint (x 68) stands on it, as
  in the concept. Each tier runs from z 8.5 (2.5 m clear of the boulevard planters at z 6) to z 35 (2.57 m clear of the
  room recess at x 71–89, z ≥ 37.6), with radial ends, so the lower tiers wrap further round. Everything stays inside
  G5 (x 66.5–87.6, z 8.5–35 for the tiers; the stage is unchanged at x 106–120), at least 2.57 m from the atrium
  outline (phase6-sanity wants 2.4 m), and under 3.5 m, well below the Deck 7 slab. The boulevard, the x −79 and x 2 cross
  routes and the food stalls are untouched.
- **Walking.** Each riser is 0.24 m, under the walker's 0.4 m step (`BODY.step`, `src/walk/collision.js`), so every
  tread is walked onto from the one below, from anywhere along the arc; no aisles or ramps are needed. The top is 0.96 m,
  under the 1 m drop that `scripts/v2-walk.mjs` allows without a guard, so the back edge and the tier ends need no rail
  (stepping off them is a drop of 0.24–0.96 m onto the plaza). Each tier is a closed solid from the deck up (top, riser,
  back, both ends), so the walker can't get inside one: `check:walk` reports no unguarded drops, and its flood reaches
  every tread.
- **Collision.** The tiers and cushions are ordinary solid furnishings: `addPhase4Colliders` takes their real triangles
  (they are not box-like), and the tiers count as ground (`groundMesh`: the name has `stage`). The nosings and the back
  wall are visual only (`noCollide`), as the old backdrop was.
- **Look.** Oak tiers (the stage deck's material). A cream nosing (7 cm, 1.2 cm proud, lapping 3 cm down the riser) marks
  each step: from the stage-wide view the risers face away, so without it the treads merged into one surface. The wall's
  face faces aft, away from the atrium's sun, where a cream face renders tan; its normals are tilted towards the light
  (as atrium-architecture.js does for the lift tower), so it reads cream.

## How the seats work

The cushions re-anchor the existing seat system; nothing new was invented. Each cushion is a rest spot in the phase 6
programme's `rests` (`kind:'sit'`, `phase4`/`phase6`, `instanced`), exactly like the chairs it replaces, with ids
`p6-stage-tier-<1..4>-seat-<n>`. Raised seats need nothing special:

- `point`/`height` are the cushion's top (tread + 0.08 m), and `facing` points at the tiers' centre (towards the stage).
- One row per tier, 0.36 m behind the nosing, about 1.6 m apart, at least 1 m in from the tier ends: 16, 16, 16 and 14.
- A walker stands on the tread below (0.24 m lower) in front of a cushion and sits facing the stage, feet on that tread.
  phase6-local finds that approach for all 604 phase 6 seats (it needs `plannedStanding`, hence `standing.js`), and the
  prepared-walk audit finds a collider under every seat at its height.
- No other code referred to the old `p6-atrium6-stage-seat-*` ids.

Seats in the zone go from 145 chairs to 62 cushions (phase 6 total 687 → 604; phase6-sanity wants more than 500).

## Cost

From the walk's `?fps=1` readout at 1600 x 900 (`stats.json` beside each capture set):

| View | Before (a7b127ff) | After (e0671d2b) |
| --- | --- | --- |
| stage-front, day / night | 438 draws, 7.79M tris | 438 draws, 7.80M tris |
| stage-wide, day | 474 draws, 8.29M tris | 537 draws, 9.57M tris |
| stage-wide, night | 475 draws, 8.29M tris | 538 draws, 9.57M tris |
| deck-level control, 2.2 m behind stage-wide (x 65.8) | — | 476 draws, 8.32M tris |

- **No new draws from the stage.** The tiers, nosings, cushions and wall are indexed furnishings in the existing oak and
  cream materials, so on multi-draw GPUs they join the existing furnishing batches (`furnishing-batches.js`); stage-front
  is unchanged.
- **stage-wide costs more because the walker stands higher.** The viewpoint now lands on the 0.96 m top tier, and from
  that eye height more of the ship (upper balconies, cabins through glass) is in view: +63 draws and +1.28M triangles.
  From the deck just behind the tiers the same view costs 476 draws and 8.32M triangles, within 2 draws of before.
- **Geometry:** tiers 1,090 + nosings 1,090 + cushions 6,696 + wall 12 triangles, against 5,220 for the 145 chairs it
  replaces (+3,668 net). Phones see each new kind once (phone-furnishing.js); it is all stage furnishing, not distant decor.

## Checks and the PVS key

All on the final r187 build of e0671d2b in `leo-floor-before` (exit 0 each):

| Check | Result |
| --- | --- |
| `npm run check:walk` | PASS: 0 unguarded drops over 1 m, 0 void falls; seats and beds 35,311/35,311 usable, the stage's 62/62 |
| `node scripts/check-phase6-v2.mjs` | PASS: all 12 tasks (sanity, local seat fit 604/604, contract, floor/canopy/fog/visibility/directory/service-deck/live-glass fixtures, prepared audit incl. the atrium void, sky tip) |
| `node scripts/check-prepared-runtime-migration.mjs` | PASS |
| `npm run check:atrium-time` | PASS, 12 checks |
| `node scripts/check-atrium-void-fixtures-v2.mjs` | PASS |
| `node scripts/check-prepared-walk-v2.mjs` | PASS |
| `node scripts/check-void-guards-v2.mjs` | PASS |
| `node scripts/check-lobby-tile-v2.mjs` | PASS |
| `node scripts/check-main-features-v2.mjs` | PASS |

The first build (fcecd2e0, before the refine) also passed `check:walk` with the same tier and seat geometry; the refine
only added `noCollide` nosings and moved the cushions 6 cm.

**Atrium PVS key** (the colliders changed): `4.63d7c93282b3f79b647143e90093b6df.aaba3802c109794758a3fffa000069ed.6afd3900849f657047053acc00000001`
→ `4.63d7c93282b3f79b647143e90093b6df.bbdd2b99bafbecae0c00b7830000683c.6afd3900849f657047053acc00000001`. None is baked
for either key today, so nothing goes stale; a bake for the new key would follow the usual `scripts/walk-atrium-pvs.mjs`
route.

## Left as it is / follow-ups

- **Closer to the concept:** the concept's tiers fill more of the frame and are a more saturated orange. Deeper treads
  (or tiers reaching nearer the stage) and a warmer timber than the shared `oak` would close that gap. A warmer timber
  means a new material, so one more draw, unless it joins an existing warm material.
- The back wall stays `noCollide`, as the navy backdrop was; walking off the back of the stage passes through it.
- `scripts/check-source-fold.mjs` (not in the required list) already fails on main, on `server/live-core.mjs`, so the
  switchover pins were not re-pinned here.
- Merge notes: `atrium-surfaces(.authoring).js` changes one condition in the long zone-floor line that the lobby and food
  jobs may also touch; `phase6-programme.js` changes only the stage lines; `atrium-v2.js` only the stage zone's colour.
