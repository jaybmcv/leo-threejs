# S3b lift tower: concept A, "lit glass"

Jay's pick for the Deck 6 forward lift tower ([`docs/atrium-areas.md`](../../atrium-areas.md)).

![before / concept A / after at tower-near](contact-tower-near.jpg)

![before / after, the tower core at tower-near](contact-tower-near-core.jpg)

![before / after at hero and boulevard-aft](contact-before-after.jpg)

*Before is the live site (`baseline-639f7393`); its tower is the same as base f8af5b3a's. After is a local build of
this branch (d3dcace3), captured with `scripts/capture-atrium-areas.mjs`. Both render with three 0.187.0. Local builds
that bundle three 0.185.1 (a stale `node_modules`) render the atrium much darker and warmer than live, so don't judge
colour on them.*

## What changed

All of this is in the facade's merged copy of the tower (`atrium-architecture.js`) and the walk's lift cars. The walked
tops keep their finish.

- **Glass-blue bands with white edges.** The bridge and landing undersides are glass-blue (`80b2cc`) and their fascias
  white (vertex colours; `TOWER_SLAB_FACES`, `src/v2/model.js`). Both are shaded as if they faced up. Shaded truly, a
  face looking down takes the hemisphere's ground colour and the lower environment, so the concept's pale glass-blue
  reads steel grey.
- **A warm golden line under every level.** A light strip (20 x 10 cm, hanging 8 cm below the slab) runs under both
  long edges of every bridge above Deck 6, over the open atrium. It also runs along each landing's aft edge and its
  returns to the bridges, so the line crosses the tower unbroken (`towerBridgeLights`, `src/v2/model.js`). It shares the
  lift lobbies' light material, now emissive `ffc66e` at 1.5, so the lobby lights warm too.
- **Bright glass shafts in a white frame.** The forward shafts' glass is clear and pale blue, where the walk used to
  frost every shaft (`src/walk/main.js`). Each glazed face gets two white mullions, so three bays across like the
  concept, plus transoms at every floor and a metre above it. The guide columns turn white (`towerFrame`,
  `src/transit.js`). The lowest metre of each storey stays frosted, so an empty shaft still reads as a wall at a
  walker's feet. The glass, frit and frame are shaded as if they faced up too (`towerLit`): their faces looking aft at
  the atrium sit in the sun's shade and read grey.
- **Lit cabins.** The forward cars' walls are warm-lit, and their aft wall is glass, so the atrium sees into them and
  the Mars art faces out (`src/walk/lift-ride.js` and twins).
- **Unchanged:**
  - The bridges' glass balustrades. They are the walk's shared void guards, used ship-wide.
  - Bridge and landing geometry and colliders, the tower footprint and height.
  - The aft lift core's geometry. Its lobby lights share the strip material, so they warm too.

**Where it differs from the concept:**
- The concept draws one slim glass prism with paper-thin bridges. The real landings (24 m deep) and bridges stay, as
  asked, so from the floor each landing's underside hides most of the shaft above it. The framed glass shafts read on
  the lower decks and from hero, where the tower now reads as a glass column.
- No lit cabin is in these shots. Both forward cars park at Deck 15, behind the slabs, and even called down to Decks 8
  and 11 they barely show from the floor. Parking them lower would change how the lifts behave, so it isn't done here.
- The concept's warm lines also run along every balcony edge. Those belong to the balcony glow (atrium-light), not here.

## Cost and safety

| View | Draws before -> after | Triangles before -> after |
| --- | --- | --- |
| tower-near | 526 -> 526 | 10,908,530 -> 10,914,170 |
| hero | 558 -> 558 | 10,760,649 -> 10,766,289 |
| boulevard-aft | 695 -> 695 | 10,813,357 -> 10,818,997 |

These are the main pass at each view's pose, measured with `renderer.info` on the review walk of local builds of base
f8af5b3a and this branch ([`metrics-before.json`](metrics-before.json), [`metrics-after.json`](metrics-after.json)).
The tower copy stays at 21 draws. Its triangles grow from 97,398 to 103,038 (+5,640):

| Change | Triangles |
| --- | --- |
| Shaft frame (mullions and transoms) | +3,024 |
| Frosted frit bands | +1,440 |
| Light strips (bridges, landing edges, returns) | +1,176 |

- **No new draws.** Every addition joins a bucket the tower copy already draws:
  - the frame joins the guide columns;
  - the frit joins the frosted shaft glass;
  - the clear shaft glass joins the aft back glass;
  - the strips join the lift lobbies' lights;
  - the fascia and underside tones are vertex colours and normals only.

  The cars only swap materials.
- **Collision is unchanged.** Every addition is `noCollide`. The atrium PVS key is unchanged (`4.1485ebc6…`, the same
  as base), so no re-bake is needed.
- **Distant and phone copies stay Basic.** They take the same vertex colours, so the undersides are glass-blue there
  too. Normals don't affect Basic materials.
- **Void.** Everything added sits inside the tower, landing and bridge footprints; nothing new crosses the void above
  Deck 16.

## Checks (on the after build, d3dcace3, three 0.187.0)

| Check | Result |
| --- | --- |
| `npm run check:walk` | PASS (lift stops 104/104) |
| `scripts/check-phase6-v2.mjs` | PASS (atrium void audit PASS, distant copy PASS) |
| `scripts/check-prepared-walk-v2.mjs` | PASS (prepared clearance, guard support, finishes) |
| `scripts/check-atrium-void-fixtures-v2.mjs` | PASS |
| `scripts/check-void-guards-v2.mjs` | PASS |
| `scripts/check-main-features-v2.mjs` | PASS |
| `scripts/check-lobby-tile-v2.mjs` | PASS |
