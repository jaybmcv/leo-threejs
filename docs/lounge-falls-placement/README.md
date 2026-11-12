# Hydro-Nip Lounge waterfall and pond: placement proposal

**A proposal only. Nothing in the walk, the plan or the geometry was changed; the visitor walk is the same as before.** Written from tester feedback (a request for a measured placement of the waterfall and pond in the Deck 17 Neighborhood 1 sky garden, `commons-1`).

Everything below is produced by `node scripts/lounge-falls-placement.mjs` (about 45 s, no built ship needed) and checked by `node scripts/lounge-falls-placement.mjs --check`, which fails if `placement.json` no longer matches the plan or `src/walk/lounge-falls.js` (the script asserts the constants it copies from that file). Coordinates are ship metres: X forward, Y up, Z starboard. The lounge is `x - 246.5, z = -16 - z` from its template frame; the waterfall is then squeezed in depth about its front step (`src/v2/lounge-falls-fit.js`), live scale 0.8567 (`ship.v2FeaturePlacements.loungeFalls`, read from the live walk build 3243183 on 2026-11-12).

| File | What it is |
| --- | --- |
| `placement.json` | every number below, plus the search that produced them |
| `plan.svg` | dimensioned overhead plan, current (blue, dashed) and proposed (orange) |
| `view-reference-current.svg`, `view-reference-proposed.svg` | the tester's camera, `walk.html?lv=2&at=-101.49,25.52,-41.22&yaw=541&pitch=5&view=first` |
| `view-beside-bridge-*.svg` | from the tasting-deck side of the pond toward +X (the arcade) |
| `view-deck19-edge-*.svg` | from the Deck 19 gallery plate, looking down on the pond |
| `views.json` | the fixed cameras (walk links, feet position, yaw, pitch) |

The views are vector projections of the plan data from those cameras (62 degree vertical field, eye 1.628 m above the feet, 16:9), not renders. As a check, the projected current sheet and lip lie on the live walk's first-person picture from the reference camera to within a few pixels. After a build, take the same cameras with the links in `views.json` for the real before/after pictures.

## What is there now

- **Pond** centre (-109.50, 24.30, -54.18); rim, causeway, landing and bench (colliders) span x -116.15 to -102.85, z -60.06 to -49.30 (13.30 by 10.76 m); with ferns and mushrooms x -117.3 to -101.7; the water's floor light reaches x -118.1 to -100.9, z -60.0 to -48.4. These agree with the live walk's own bounding boxes (the script asserts it).
- **Falling water**: sheet x -113.90 to -105.10 (8.8 m), z -56.60 at the lip (y 31.76) leaning to -56.30 at the water (y 24.57). **Lip** x -114.2 to -104.8, z -56.74 to -56.32, y 31.74 to 32.02, hung on the underside of the Deck 19 slab.
- **Causeway** x -110.40 to -108.60, z -57.65 to -49.30; **landing** x -113.10 to -105.90, z -60.06 to -57.61; **bench** x -110.7 to -108.3, z -60.05 to -59.45.
- **Stairs** (the plan's physical flights and landing): x -94.7 to -88.2, z -54.9 to -46.85. Current clearance from the pond's collider to them: **8.15 m**. Dome planter ring 1.11 m from the causeway foot; tasting deck 4.55 m; Cosmic Munchies counter 7.05 m; rear wall 3.56 m.
- **Gallery openings** (from the selected plan, not the old template frame): the Deck 18 plate is z -56.46 to -52.46 at x -110 and the Deck 19 plate z -51.33 to -47.33; the Deck 18 slab opening reaches z -58.88 and the Deck 19 slab opening only z -53.91 at x -110 (`openings` in `placement.json`).
- **Fit through the openings today**: the lip sits 2.6 m under the Deck 19 slab beyond its opening, so the sheet leaves from under solid slab, **0% of its width in the Deck 19 opening**; at Deck 18 it is in the opening but **clips the plate's rear edge by 0.01 m at its right end (95% open)**.

## What the openings allow

Both levels are open together only in a band between the two plates: from the Deck 18 plate's inner edge to the Deck 19 plate's rear edge. It is 1.52 m wide at x -114, 1.12 m at x -110, 0.65 m at x -98 (`shaftBetweenDecks`), because the plates curve with the hull. (The wide void in front of the Deck 19 plate, z -47.3 and forward, is also open, but it is further into the dome.) The sheet, which cannot rotate, has to hang inside that band with 0.25 m to each edge. Moving screen-right (+X in the reference camera, which looks toward -Z) narrows the band under the sheet.

## Proposal: translate the whole assembly by (+7.50, 0, +4.28) m

One rigid translation of header, sheet, pond, causeway, landing, bench, rocks, plants and effects together, no rotation, no change to any shape. +X is screen-right in the reference view; +Z is toward the camera (the lounge front). It is the translation that gets the sheet through both openings and leaves the most room to the neighbours of 7,399 tested (dx -12 to +12 in 0.5 m steps, dz -3 to +12 in 0.1 m steps, 779 of them put the sheet through both openings, none of those leaves 1 m to everything).

| | Current | Proposed |
| --- | --- | --- |
| Pond centre | (-109.50, 24.30, -54.18) | (-102.00, 24.30, -49.90) |
| Sheet x, lip z, foot z | -113.90 to -105.10, -56.60, -56.30 | -106.40 to -97.60, -52.32, -52.02 |
| Collider bounds | x -116.15 to -102.85, z -60.06 to -49.30 | x -108.65 to -95.35, z -55.78 to -45.02 |
| With plants | x -117.3 to -101.7, z -59.3 to -49.0 | x -109.8 to -94.2, z -55.0 to -44.8 |
| Water light | x -118.1 to -100.9, z -60.0 to -48.4 | x -110.6 to -93.4, z -55.7 to -44.1 |
| Deck 18 opening | 95% of sheet, -0.01 m to plate edge | 100%, 0.26 m to the plate's inner edge |
| Deck 19 opening | 0% (under slab) | 100%, 0.37 m to the plate's rear edge |
| Stairs | 8.15 m | **0.65 m** (plants and light overlap the stair footprint by 0.5 m and 1.3 m) |
| Dome planter ring | 1.11 m | **0.17 m** |
| Tasting deck / rear wall | 4.55 m / 3.56 m | 11.25 m / 7.80 m |
| Munchies counter | 7.05 m | 1.52 m |
| Causeway front approach | 1.10 m, then the dome ring | 1.20 m, then the munchies counter; 0.37 m to the narrowest side |
| Lip hung from slab or plate | all of it | none: gap up to 0.42 m |

Bridge approaches. The causeway runs 8.35 m from the front step (z -45.02 here) to the landing behind the falls; the landing (7.2 by 2.45 m) and bench follow it unchanged. The approach to the front step is as tight as it is now (the existing foot has 1.1 m before the dome ring) but is now bounded by the munchies counter instead. The landing and bench (z -53.3 to -55.8) now lie under the Deck 18 plate (underside 28.0) with 3.3 m of headroom, and the pond's front half under the Deck 19 plate with about 7 m, so neither is a conflict.

### Conflicts and why the constraints cannot all be met

Pure translation cannot satisfy every request at once.

1. **Clearances (not met).** The sheet must move about 4.3 m toward the lounge front to reach the band between the plates. The pond then runs into the dome's planter ring unless it moves right; moving right runs it into the stairs. For the dz that works at each dx (`candidates.byDx`): dx 0, 3 and 6 overlap the dome ring by 3.1, 2.1 and 0.8 m; dx 7.5 clears it by 0.17 m and the stairs by 0.65 m; dx 9 clears the dome by 1.22 m and meets the stair footprint. The 1 m walking clearance used here (a walker is 0.7 m wide, `BODY.radius` 0.35) is met by no translation that also fits the openings. The illustrated separation from the stairs (the exact figure is not given in the brief and was not read from the pictures) is therefore not preserved: it shrinks from 8.15 m to 0.65 m.
2. **Lip support (structural change, not made).** The lip needs something to hang from. After the move it is clear of the Deck 19 slab (the opening there ends at z -54.1) and of the plate (edge z -51.7 to -52.0 along the lip), by up to 0.42 m, and because that edge curves, a rigid lip cannot sit flush along it. A bracket or a deeper lip back to the plate edge would be needed, or a hanger from the plate's underside.
3. **Dome and stairs (structural, not made).** To get 1 m everywhere without changing the water's appearance, either the dome's planter ring or the stairs would have to move, or the pond narrowed on one side. All of these change things the brief says to keep or leave alone (rails, stairs, room boundaries, circulation, unrelated lounge parts), so none is proposed.
4. **Plates (structural, not made).** The 0.25 m margins to the plate edges (0.26 and 0.37 m) are tight. More width would need the Deck 18 plate's inner edge or the Deck 19 plate's rear edge cut back, with their rails.

What is **not** affected: slabs, rails, stairs, room boundaries and circulation are left as they are; no extra decking and no unrelated lounge change are proposed.

## Limits of this study

- The walk's depth fit (`prepareV2LoungeFalls`) is recomputed from the finished garden skin when the assembly moves. This study keeps the live scale (0.8567) and moves the fitted shape rigidly; a rebuilt fit may rescale depth (allowed 0.65 to 1), and the skin's 0.5 m margin has to be re-checked then. Moving forward only increases the distance to the rear skin.
- The dome (template DOME, ring out to r 7.45), the munchies counter and its stools, and the tasting deck are taken from the lounge source and the plan, the stairs from the plan's treads; the stair footprint is treated as solid, which is cautious for the space under the flights.
- The sound line (`soundLine`) is not moved by the depth fit today and would need the same translation when the assembly moves.
- No manual review is part of the acceptance; the numbers are reproducible from the script and the placement is a proposal for the next step to build or reject.
