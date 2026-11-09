# S3b lift tower: concept A, "lit glass"

Jay's pick for the Deck 6 forward lift tower ([`docs/atrium-areas.md`](../../atrium-areas.md)).

![before / concept A / after at tower-near](contact-tower-near.jpg)

![before / after, the tower core at tower-near](contact-tower-near-core.jpg)

![before / after at hero and boulevard-aft](contact-before-after.jpg)

*Before and after are both local builds (base f8af5b3a, then this branch), captured with
`scripts/capture-atrium-areas.mjs`. Local builds render the atrium darker and warmer than the live site, so compare
them with each other rather than with `baseline-639f7393`.*

## What changed

- **Bridge and landing undersides read light.** In the facade's merged copy of the tower (`atrium-architecture.js`),
  the undersides of the bridges and landings are light grey and the fascias white (vertex colours; `TOWER_SLAB_FACES`,
  `src/v2/model.js`). The undersides are also shaded as if they faced up. The atrium's hemisphere light gives every
  face looking down its dark ground colour (`8a7356`), so a light colour alone still rendered brown. The walked tops
  keep their finish.
- **A warm light strip** runs under both long edges of every bridge above Deck 6, over the open atrium (20 x 10 cm,
  hanging 8 cm below the slab; `towerBridgeLights`, `src/v2/model.js`).
- **Clear shafts with a slim white frame.** The forward shafts' glass is clear and pale blue, where the walk used to
  frost every shaft (`src/walk/main.js`). Each glazed face gets a white mullion, plus transoms at every floor and a
  metre above it, and the guide columns turn white (`towerFrame`, `src/transit.js`). The lowest metre of each storey
  stays frosted, so an empty shaft still reads as a wall at a walker's feet.
- **Lit cabins.** The forward cars' walls are warm-lit, and their aft wall is glass, so the atrium sees into them and
  the Mars art faces out (`src/walk/lift-ride.js` and twins).
- **Unchanged:**
  - The bridges' glass balustrades (they already existed).
  - Bridge and landing geometry and colliders, the tower footprint and height.
  - The aft lift core.

**Where it differs from the concept:**
- The concept draws one continuous glass prism with paper-thin bridges. The real 0.24 m landings and bridges stay, as
  asked, so from the floor each deck's slab hides most of the shaft above it. The frame mostly reads on the lower decks.
- The cars follow the shared lift schedule, so a lit cabin is in shot only when one is near. In these captures both
  forward cars were at Deck 15, behind the slabs.
- The glass is less blue than the concept. The shaft glass shares the aft back glass's bucket, so it keeps its opacity
  (0.18).

## Cost and safety

| View | Draws before -> after | Triangles before -> after |
| --- | --- | --- |
| tower-near | 526 -> 526 | 10,908,530 -> 10,913,594 |
| hero | 558 -> 558 | 10,760,649 -> 10,765,713 |
| boulevard-aft | 695 -> 695 | 10,813,357 -> 10,818,421 |

These are the main pass at each view's pose, measured with `renderer.info` on the review walk
([`metrics-before.json`](metrics-before.json), [`metrics-after.json`](metrics-after.json)). The tower copy stays at
21 draws. Its triangles grow from 97,398 to 102,462 (+5,064):

| Change | Triangles |
| --- | --- |
| Shaft frame (mullions and transoms) | +2,952 |
| Frosted frit bands | +1,440 |
| Bridge light strips | +672 |

- **No new draws.** Every addition joins a bucket the tower copy already draws:
  - the frame joins the guide columns;
  - the frit joins the frosted shaft glass;
  - the clear shaft glass joins the aft back glass;
  - the strips join the lift lobbies' ceiling lights;
  - the fascia and underside tones are vertex colours and normals only.

  The cars only swap materials.
- **Collision is unchanged.** Every addition is `noCollide`. The atrium PVS key is identical in both public builds
  (`4.1485ebc6…`), so no re-bake is needed.
- **Distant and phone copies stay Basic.** They take the same vertex colours, so the undersides are light there too.
  Normals don't affect Basic materials.
- **Void.** Everything added sits inside the tower and bridge footprints; nothing new crosses the void above Deck 16.

## Checks (on the after build, 5a12767a)

| Check | Result |
| --- | --- |
| `npm run check:walk` | PASS (lift stops 104/104) |
| `scripts/check-phase6-v2.mjs` | PASS (atrium void audit PASS, distant copy PASS) |
| `scripts/check-prepared-walk-v2.mjs` | PASS (prepared clearance, guard support, finishes) |
| `scripts/check-atrium-void-fixtures-v2.mjs` | PASS |
| `scripts/check-void-guards-v2.mjs` | PASS |
| `scripts/check-main-features-v2.mjs` | PASS |
| `scripts/check-lobby-tile-v2.mjs` | PASS |
