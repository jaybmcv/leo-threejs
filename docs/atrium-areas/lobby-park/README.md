# G1 Arrival lobby: welcome court (option A) · G2 Voyager park: flower meadow (option A)

**G1:** a low round welcome desk stands on the port side of the arrival plaza. It is warm timber slats under a cream
stone top, with a thin brass band and two screens facing the lifts. Around it:

- a ring of six low stone planters with pink and white flowering shrubs;
- four slim bronze lamp posts whose lanterns glow;
- a round basalt inlay edged in brass, like the boulevard's inlays.

The straight walkway from the aft lifts to the boulevard stays clear, and the black directory sign and the reception
counter stay.

**G2:** drifts of soft pink, white and pale yellow flowers run over low leafy mounds:

- along both edges of the park path and beside the grove trees;
- with ornamental grasses in the gaps and behind the drifts.

Two more small trees join two of the grove trees. The open lawn in the middle stays open.

![lobby-in: before / concept A / after, day](contact-lobby-in.jpg)

![park-wide: before / concept A / after, day](contact-park-wide.jpg)

![all four views by day: before (top) and after (bottom)](contact-day.jpg)

![all four views at night: before (top) and after (bottom)](contact-night.jpg)

![park-wide: first build (80a6723d) and the refine pass (1e582352)](contact-park-refine.jpg)

*How these were made:*
- **Before** is a local r187 build (three 0.187.0) of main a7b127ff. atrium-lake-food built it in `leo-floor-before`
  and captured it for all three ground-zone jobs (`C:\Users\victo\Leo\atrium-before-a7b127ff\lobbypark-before-*`).
- **After** is an r187 build of this branch at 1e582352, built in `leo-build-2`.
- **Captures:** `scripts/capture-atrium-areas.mjs --only=lobby-in,lobby-back,park-wide,park-path --query=time=day|night`
  at 1600×900.
- **Concepts** were painted over the live captures, so compare layout and colour, not exact distance.
- **Why the court looks smaller:** it sits farther from the camera than in the concept. The concept has the court
  almost touching the centre line; here it keeps the walkway clear (see below).

## What changed

Everything lives in a new module, `src/v2/atrium-lobby-park.js`. Shared files get one-line hooks, so sibling area jobs
merge easily:

- `src/v2/phase6-programme.js`: `addWelcomeCourtParts(add,y)` after the lobby's planters adds the court's collidable
  parts.
- `src/v2/atrium-gardens.js`: `addLobbyPark(out,glow,layout,clearGround,parts)` in `addAtriumGardens` adds everything
  drawn to the existing garden mesh (`P6_atrium_gardens`) and the lamp glow to the existing lantern draw
  (`P6_atrium_lanterns`, material `P6_atrium_glow`, which atrium-light's night mood already brightens).
- `src/v2/atrium-architecture.js` and its `.authoring.js` twin: one branch next to the terrace-glass hook hides
  collision-only fit-out parts (`P4_p6_*_collider`), with `phase6ArchitectureSource` so culling, phone merging and
  furnishing batches leave them hidden.

### G1 welcome court

**Placement.** The court is centred at (−101.4, −10.3), radius 5.21 m to the outer brass line. The walkway is the
boulevard's 9.8 m clear width (|z| < 4.9) carried back to the lifts, and the directory sign stands at its starboard
edge. The court's rim stops 0.19 m short of the walkway and 0.3 m from the reception counter's corner. From lobby-in it
sits about 29° left, as in the concept.

| Piece | Details |
| --- | --- |
| Desk | Radius 1.32 m drum, 0.98 m high. Cream stone plinth, 40 alternating timber slats, brass band, cream stone top with a leather inset, two screens on the aft side. |
| Planters | Six of the boulevard's own stone planters (2.4 × 0.42 × 1.1 m), 60° apart on a 3.1 m ring, opening fore and aft. `addPlanterTrims` gives them the same coping, timber bench boards and spilling leaves. They are square to the ship because the trims are laid unrotated. Each holds leafy mounds and 22 pink and white flowers. |
| Lamps | Four, on the inlay's diagonals at 4.8 m. Bronze base, 2.5 m post, collar and cap. The 0.4 m lantern between collar and cap glows. |
| Inlay | Basalt band from 4.55 to 5.15 m in 36 slabs, each clouded and set off by a 2 cm joint, between brass lines 6 cm wide. Same stone, brass and clouding as `addPromenadeInlays`, 12 mm over the floor. |

### G2 flower meadow

**Path drifts.** Along both edges of the path (`phase6ParkPath`), drifts 4–8 m long and 1.3–2.4 m deep hug the edge
with 1.4–3.8 m gaps. Each drift is:

- leafy mounds, 2.2 per m²;
- flowers on top, 16 per m², 11–16 cm across: five kite petals round a yellow eye, eleven triangles each, tipped up
  toward the viewer;
- one dominant colour (pink, white or yellow) mixed with the others.

Ornamental grasses (11–14 arching blades, pale straw tips) stand in the gaps and along each drift's back edge.

**Grove drifts.** One drift beside each grove tree, off to one side of its trunk.

**Two new small trees** at (−37.5, −30.5) and (−62.5, −31), each about 5 m from a grove tree, on the lawn beyond the
path. They use the grove's crown recipe and are 3.8–4 m tall.

**Kept clear:**
- The open lawn in the middle: x −46.5..−36.5, z −15..−6, park-wide's foreground.
- The cross route at x −81..−77.
- The path itself, the boulevard's planter edge (z > −6.6), and every fit-out footprint (benches, planters, signs)
  through `addAtriumGardens`' ground test.

**Refine pass (1e582352).** The first build read weaker than the concept: pale flowers over flat dark mounds, and
sparse drifts. The flowers are now larger and stronger in colour and sit on lighter, leafier mounds. The drifts are
deeper with shorter gaps, and more grasses stand behind them.

## Colliders and the atrium PVS key

**The desk and its planters collide**, as the atrium's existing planters and counters do:

- The planters are `garden_planter` parts with the same size and material as the boulevard and lake planters, so they
  join that instanced batch.
- The round desk is stood in for by four crossed boxes (2.5 × 0.98 × 1.04 m, 45° apart). Together they fill the drum
  to within 0.1 m.
- Those boxes are a new part, `p6_welcome_desk_collider`, that nothing draws.

**Everything else is visual only (noCollide):** the lamps, the inlay, the planting and the two new park trees. The
trees have trunks but no collider and no tree-shade decal; the brief asked for visual-only park additions.

**The atrium PVS key changes** by the 10 new collider instances (4 desk boxes and 6 planters):

| Build | Atrium PVS key |
| --- | --- |
| Before (a7b127ff) | `4.63d7c93282b3f79b647143e90093b6df.aaba3802c109794758a3fffa000069ed.6afd3900849f657047053acc00000001` |
| After (this branch) | `4.63d7c93282b3f79b647143e90093b6df.ea939c7cb1d180dda21af481000069f7.6afd3900849f657047053acc00000001` |

No atrium PVS is baked for either key, so nothing needs rebaking today. The refine pass added no colliders, so its key
is the same.

## Cost

Draws and triangles come from the walk's `?fps=1` readout (median of 6 readings), measured the same way as the
before set.

| View | Time | Draws before → after | Triangles before → after |
| --- | --- | --- | --- |
| lobby-in | day | 878 → 878 | 10.42M → 10.50M |
| lobby-back | day | 489 → 490 | 8.00M → 8.08M |
| park-wide | day | 391 → 391 | 8.59M → 8.67M |
| park-path | day | 787 → 787 | 10.31M → 10.39M |
| lobby-in | night | 879 → 879 | 10.42M → 10.50M |
| lobby-back | night | 489 → 490 | 8.00M → 8.08M |
| park-wide | night | 391 → 391 | 8.59M → 8.67M |
| park-path | night | 788 → 788 | 10.31M → 10.39M |

- **No new draw call.** Everything drawn joins the existing garden mesh and lantern draw. The hidden desk boxes are
  never drawn.
- **lobby-back +1 draw:** it is the existing `garden_planter` batch. Before, none of its instances were in that view
  (the boulevard and lake planters are behind the camera). Now a court planter's bounds reach the right edge of the
  frame, so the batch draws there.
- **Garden mesh (`P6_atrium_gardens`):** 333,524 → 412,738 triangles in a Node build (+79,214): the court ~5k, the
  meadow ~74k. The walk counts 412,642 at every view.
- **Lantern draw:** 1,632 → 1,792 triangles (+160, the four lanterns).
- **Distant and phone copies:** the garden mesh's distant copy keeps its Basic material swap, and phones drop distant
  decor as before. Both apply automatically because nothing new has its own mesh.

## Checks

All run in `leo-build-2` on the r187 build of each commit.

| Check | 80a6723d (first build) | 1e582352 (refine) |
| --- | --- | --- |
| `npm run check:walk` | PASS | PASS |
| `node scripts/check-phase6-v2.mjs` (incl. phase6-sanity's 2.4 m perimeter rule and phase6-prepared's hidden-source rule) | PASS | PASS |
| `node scripts/check-prepared-runtime-migration.mjs` | PASS | PASS |
| `npm run check:atrium-time` | PASS (12 checks) | PASS (12 checks) |
| `node scripts/check-atrium-void-fixtures-v2.mjs` | PASS | PASS |
| `node scripts/check-prepared-walk-v2.mjs` | PASS | PASS |
| `node scripts/check-void-guards-v2.mjs` | PASS | PASS |
| `node scripts/check-lobby-tile-v2.mjs` | PASS | PASS |
| `node scripts/check-main-features-v2.mjs` | PASS | PASS |

- No source re-pinning was needed: none of the required checks complained about the switchover pins.
- `scripts/check-source-fold.mjs` (not on this job's list) already fails on main a7b127ff, at `server/live-core.mjs`,
  unrelated to this change.

**Every area job keeps:**
- Nothing is added above Deck 16, and no opaque `noCollide` surface crosses the void: everything here sits on the
  Deck 6 floor.
- The boulevard's 9.8 m clear width, the x=−79 cross route and the walkway to the lifts stay clear.
- The x=2 cross route and the stall gaps are outside these zones.
