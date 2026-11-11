# Hydro-Nip Lounge waterfall pond and bench: acceptance record

Project-local record for the existing pond, falls, causeway and bench (`src/walk/lounge-falls.js`, fitted to the layout 2 garden skin by `src/v2/lounge-falls-fit.js`). Nothing was built, moved or repaired in this step, and the original build was not recreated. History: the pond came from tester feedback as step 1 of a larger report (PR #225). Step 2, the stepped seating platform, is deferred (see the last section). This record separates three things: what is verified, what is still open, and what is deferred.

The record was written in a checkout with no built layout 2 (`output/leo-interior-v02/layout.json` was absent), so no check that needs the built ship could be run here. Everything below comes from the source, the committed checks and the earlier step's recorded results. The after-merge build and walk checks are the place to confirm the open items.

## Where it is

The historical report view (`walk.html?at=-90.27,30.60,-25.66&yaw=530&pitch=-19`) is a Deck 19 gallery spot from layout 1 (a link without `lv=2` is read as layout 1 and remapped by `src/walk/link.js`). It is a viewpoint for orientation, not the feature's placement. The feature sits in the Hydro-Nip Lounge, `commons-1` (Neighborhood 1's commons, Deck 17), on the lounge's rear side, in the strip of floor between the Terpene Tasting Deck and the broad stair, under the rear galleries (Deck 18 at y 28.3 and Deck 19 at y 32.3).

Placement is defined in the commons template frame (floor y 24.3, rear wall z 46) and moved to the ship by the room's selected frame. Layout 2 also changes the lounge: the plan resizes the aquarium (`src/plan/lounge-layout-v2.js`), and `prepareV2LoungeFalls` squeezes the feature's depth to fit inside the finished garden skin (scale allowed 0.65 to 1, 0.5 m clearance, front step fixed). The ship-metre position of the pond in layout 2 and the depth scale it receives are therefore read from the built plan and the written `v2FeaturePlacements.loungeFalls` record, not from the source alone. Neither was available here. (An offset of about -22.6 m in X from the layout 1 mapping is suggested by the plan's aquarium bounds, but that is an inference, not a measurement.)

## Dimensions from the source (template frame, unscaled)

| Part | Value |
| --- | --- |
| Pond | centre x 137, z 39; superellipse 12.4 m wide (x 130.8 to 143.2) by 8.8 m deep (z 34.6 to 43.4); area about 96 m2 |
| Levels | bed y 24.52, water y 24.57, rim top y 24.88 (0.58 m above the floor: too high to step in over, low enough to step out over from the bed) |
| Causeway | 1.8 m wide (x 136.1 to 137.9), 9.15 m long (z 33.9 to 43.05), top y 24.66 (0.36 m above the floor); rope rails both sides from z 34.3 |
| Landing | 7.2 m by 2.86 m (x 133.4 to 140.6, z 43 to 45.86), top y 24.66, rope rail along its front edge |
| Falls | sheet 8.8 m wide (x 132.6 to 141.4) at z 41.82; lip y 31.76 under the Deck 19 gallery edge; drop to the water about 7.2 m |
| Bench | 2.4 m wide against the back wall (x 137, z 45.5); seat top about y 25.13; back tilted 0.12 rad; three seats that face the falls |
| To the tasting deck | counter's end x 126.5, pond edge x 130.8 at z 39: about 4.3 m (about 4.6 m at the counter's rear edge z 36.6) |
| To the stair | stair planter x 147.25, pond edge x 143.2: about 4.05 m |
| To the dome ring in front | planter ring z 32.45, causeway foot z 33.9 (1.45 m), pond edge z 34.6 (2.15 m) |

In layout 2 the depth values shrink along the lounge's depth by the fitted scale (down to 0.65 at worst); widths and heights are unchanged.

## Verified existing behavior

- Source and wiring: the pond is built on the walk (`prepareLoungeFalls` removes the kitchen island, hobs, sink and four chairs and adds the bench; `createLoungeFalls` draws it and holds its colliders). The ship viewer and model downloads keep the island. Layout 2 applies the depth fit on the authoring and prepared paths (`fittedLoungeFalls`) and removes the wash on glass walls.
- Earlier step's recorded results (not rerun here): `npm run check:lounge` case 4 floods the walk's own world as the 2 m walker. The causeway leads from the floor to mid-pond and to the landing behind the falls; none of five spots in the water off the causeway can be reached; the floor either side of the pond (tasting deck side and stair side) is open; the bench gives three seats, all facing the falls. `check-anchor-movement` and `check-anchor-preparation` move the pond, its colliders and its seats with the lounge's frame under translation, rotation and mirroring.
- Clearance arithmetic from the table above: about 4 m of open floor each side of the pond to the tasting deck and the stair.

## Unresolved findings

1. Layout 2 placement and depth scale: the pond's world position and `depthScale` in the built layout 2 were not read. If the scale is near 0.65, the causeway, landing and rim shorten and the bench-to-wall and clearance numbers above change.
2. Walking access in the built ship: `check:lounge` case 4 is the only route evidence and is from the earlier step's checkout. It should be rerun on a layout 2 build, and the approach from the lounge floor, the Deck 18 and 19 gallery edges above, the stair foot and the tasting deck stools should be walked at eye level and from above.
3. Clearance to the tasting area and stairs in layout 2 (stool positions, the stair's lowest flight and rail) is measured on the template frame only.
4. Eye-level and top-down captures of the existing pond in layout 2 are not made in this step. The earlier step's captures (report view, pond front, causeway, from the bench) showed the intended result on its build.
5. Sitting on the bench: seat finding and the sit prompt were checked in the earlier step, not in the current layout.
6. The sound of falling water: none was added in step 1 (the blossom garden's creek sound could be reused). Open if wanted.
7. Frame rate on weaker devices: not measured. The pond is seven meshes and two small shaders.

## Layout 2 walk pass: status (step 2, 2026-11-10)

The second step was asked to prepare the layout 2 walk and verify access, seating and visual fit with measurements and screenshots. It was written in a checkout with no built ship at all: `output/leo-interior-v02/` is absent and `output/leo-interior-v01/` holds only `assets/` and the licence, with no saved exterior (`leo-exterior-web.glb`), so `loadWalkShip()` in `scripts/walk-plan.mjs` has nothing to load. Every result below that needs the built ship is therefore recorded as **not run**; none is marked passed.

| Check | Status | Blocker or result |
| --- | --- | --- |
| `npm run check:lounge` on the prepared layout 2 build (route to the causeway and landing, water unreachable off the causeway, floor either side, bench seats) | Not run | No saved exterior and no built layout 2 here. Last recorded pass: the earlier step's checkout (template frame, layout 1 mapping). |
| Pond's fitted ship-metre position and `depthScale` (`ship.v2FeaturePlacements.loungeFalls`, written by `prepareV2LoungeFalls`) | Not read | Needs the finished garden skin from the built plan. The fit throws outside a scale of 0.65 to 1, so a layout 2 build that exists implies it passed that range. |
| Eye-level and top-down captures, apparent depth, bench sit and leave, causeway crossing in the browser | Not run | No browser walk of a layout 2 build in this environment. No screenshots from this step are claimed. |
| Water animation, local sound, frame rate | Not run | Same blocker. From the source: the pond is seven meshes and two small shaders; no sound is attached to it (finding 6). |

Source-derived only (not measured in a browser). The layout 1 walk mapping is `world = (x - 224, y, -z)` from the template frame. The plan's aquarium bounds (`LOUNGE_PLAN.tank` x -140.9 to -88.1, against the template's 105.7 to 158.3, which is -118.3 to -65.7 under the layout 1 mapping) suggest layout 2 shifts the lounge about 22.6 m toward -X. That would put the pond centre near ship (-109.6, 24.3, -39) if the Z mirror is unchanged. This is an inference to check against the built plan, not a measurement.

Viewpoints to use once a layout 2 build exists (all inferred from the line above, so adjust them to the measured pond centre; `lv=2` is required or the link is read as layout 1):

- Tasting deck side, eye level, looking at the pond: `walk.html?lv=2&at=-121.00,24.30,-39.00&yaw=90&pitch=5`
- Stair side, eye level, back toward the pond: `walk.html?lv=2&at=-103.00,24.30,-39.00&yaw=270&pitch=5`
- Causeway foot from the dome ring: `walk.html?lv=2&at=-109.60,24.30,-31.50&yaw=180&pitch=-5`
- From above (Deck 19 gallery edge), down onto the pond: `walk.html?lv=2&at=-109.60,32.30,-34.00&yaw=180&pitch=-45`

Browser observation from the four viewpoints above (screenshots taken by the build tooling on a layout 2 build and on the live site; they are not stored in the project). The guessed viewpoints were not framed on the pond. The two eye-level views from the tasting-deck and stair sides look at the dome ring and the arcade and do not show the pond; the causeway-foot view looks at the dome's door and the stair, not the causeway. The from-above view shows the pond, its stone rim and the falls at the top of the frame, further along the view direction than the guess, so the inferred position above is off and must not be reused. Live site and build looked the same in all four. Nothing about access, clearance, the bench, sound or frame rate can be taken from these pictures.

To close findings 1 to 5 and 7, on a prepared layout 2 build run `npm run check:lounge`, read `loungeFalls` from the prepared ship, walk these four views plus the bench (sit, leave) and the causeway end to end, and record the measured clearances, the scale and the captures here.

## Deferred expansion (option A) and its dependency

The tester's second sketch showed a stepped wooden seating platform extending from the tasting deck over the pond, with steps, a rail and tables and benches, and the pond widened a little toward the tasting deck. It is not built and this step does not place it. It needs its own floor heights and colliders. The measured option A proposal (report #238) and the acceptance tracking for this feature (report #282) are not in this repository, so the following is missing and nothing has been invented:

- the platform's measured placement, size, step heights and the pond change;
- the number of extra seats it would add, and whether it improves or narrows access;
- how it shares the 4.3 m of floor between the pond and the tasting deck.

Until that proposal is available, the only fact on record is that the existing pond leaves about 4.3 m on the tasting deck side, which is the room the expansion would use. Whether the platform adds usable seating or improves access is undecided: the existing bench holds three seats and the causeway already crosses the water. Update this record when the proposal arrives.

## Verdict

Closure is pending. The layout 2 walk pass was attempted in step 2 and could not run in its checkout (no built ship, see the status table), so findings 1 to 5 and 7 stay open. The existing feature is intact in the source and the earlier step's checks passed on their build, but layout 2 placement, route access, clearances and the bench seats are not confirmed in this checkout, and the expansion is deferred, so the report stays open. This step is the first: the record. What would follow is the layout 2 walk pass (items 1 to 5) and the decision on the expansion once its measured proposal is available.
