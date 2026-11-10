# Deck 17 blossom garden: acceptance record

Acceptance check of the existing garden in the layout 2 walk. Nothing was changed or repaired in this step; the record says what the source, the colliders and the walk's own controller show today. History: #155 (tree, flowers, wall, petals, butterflies), #194 (pond, waterfall, koi, red bridge, bench, sound), #191/#192 (pond rim stones), then the layered planting, the spatial sound (`spatial-audio.js`) and the expansion (`docs/blossom-garden-expansion.md`: bed 12 x 9 m, pond 3.3 x 6.3 m, two added half-scale cherries).

## Where it is now

The historical report view (`?at=133.76,24.30,30.78`) was in layout 1. The garden is Neighborhood 10's commons, `commons-10`, in the v2 plan (origin 105.5, 24.3, 43; Deck 17). Its planter, pond and trees are built in the commons template frame by `src/walk/blossom.js` (four identical copies: `.js`, `.authoring.js`, `.prepared.js`, `.public.js`, md5 equal) and the selected frame moves them by X -26.5, Z +16. In ship metres:

| Part | v2 position |
| --- | --- |
| Planter and soil (soil y 25.01, floor y 24.3) | X 110-122, Z 43.5-52.5 |
| Main bonsai cherry | X 114.5, Z 48 |
| Added cherries (half scale) | X 119.8, Z 43.8 and 48.2 |
| Pond (water y 24.58) | X 110-113.3, Z 49.2-55.5 |
| Waterfall rocks and lip (lip y 25.62) | about X 113.4, Z 49.7 |
| Red bridge (floor to soil, over the pond) | X 109.95-113.55, Z 51 |
| Bench (seat top y 25.51) | X 114.65, Z 50.8 |

The Go-to list's "Blossom garden" entry (`src/v2/goto-features.js`) puts a walker 5.5 m west of the assembly, facing +X. The plan keeps the assembly (`check-plan.mjs` requires the koi pond, waterfall, red bridge and blossom bench pieces in neighborhood 10). `src/walk/main*.js` all hand the garden to the walk (`blossom?.update(dt,p,ambience.on,camera)`, `toBand(blossom.group)`), so visitors, authoring and prepared builds get the same garden.

## How it was checked

- `node scripts/check-blossom-expansion.mjs`: PASS (four copies agree, three trees, pond 3.3 x 6.3 m, koi stay in the water, eight butterflies, 160 falling petals, tree LOD).
- `node scripts/check-blossom-walk.mjs` (new, in the project): PASS, 18 checks. It builds the garden and planter in the commons frame, adds a floor, and drives the walk's `Controller` and `Colliders`. It does not need a built ship.
- Visual: this record was written from source in a worktree without a built ship, so the visual column below says what the geometry makes, and the screenshots that come with this pull request (the bridge, the pond and falls, the bench from the east, and the pond from above) are the visual evidence to confirm it. Nothing below was heard.

## Requirement by requirement

| # | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Bonsai-shaped cherry with pink blossoms and natural detail | Met in source; confirm in captures | `cherry()`: seven-section gnarled trunk 0.55 to 0.15 m radius, seven surface roots, eight near-level branches that each fork once, flat blossom pads in six pinks on every tip, fork and crown, bark and blossom materials. Two smaller cherries from the same builder fill the east bed; far LOD swaps in at 24 m. |
| 2 | Varied flowers round the base | Met in source; confirm in captures | The selected layered planting (`layered-conservatory.js`, `createLayeredConservatory`) fills the bed; the older green foliage in the bed is cut out by `prepareBlossomBed`. |
| 3 | Butterflies | Met | `Blossom_butterflies`: 8 butterflies, 2 hinged wings each (count 16), six colours, flapping along looped paths round the main tree and the east bed; they animate within 45 m of the walker. |
| 4 | Falling pink petals and petals on the ground | Met | 160 petals drift down with sway and tumble and restart at the canopy; 3,200 fixed petals: 2,700 on the soil, 120 on the water, the rest on the floor round the wall. Petals keep out of the pond and drift over the water or soil by what is below them. |
| 5 | Stone perimeter | Met | `Blossom_stone_wall`: two courses of irregular dry stones and a capstone rim along all six edges of the L-shaped planter, including the pond's two sides; no caps where the bridge lands. |
| 6 | Corner pond with waterfall fountain | Met | Pond with dark pebbled bed, rim stones, 70 pebbles, four lily pads and a pink flower, clear water at y 24.58. Waterfall: rock pile in the corner the bed wraps round, a curved water sheet from the lip at y 25.62, 36 running streaks, 9 foam bubbles and 3 ripple rings, all animated. |
| 7 | Orange fish | Met in source; confirm in captures | 7 koi (orange `0xff5a0a` body with white patches, fanned tail, side fins; brightened by the #194 follow-up) swim in loops that the expansion check keeps inside the water, passing under the bridge. |
| 8 | Red bridge to a bench under the tree | Met | See walk results. Red lacquered arched deck of 15 planks with beams, posts, gold caps and two rails; the bench is on the soil beside the tree, 0.59 m from the bridge landing, with a cushion and back that rest.js seat-finding matches by name (`Garden_bench_cushion`, `Garden_bench_back`). |
| 9 | Gentle fountain sound, fading with distance, respecting audio settings | Met in source; not heard | `sound()`: looped cross-faded noise, high-passed 400 Hz and low-passed near 3 kHz with slow brightness changes, plus small bubble plinks. Gain follows `(1 - d/14)^2`, so it starts 14 m away and is silent beyond; it is only on while the walk's Sound button is on (`ambience.on`), within 4 m of the falls' height, and the page's `AudioContext` is created only after a user gesture. The sound is pointed at the falls through the shared panner (`spatial-audio.js`) and is suspended while the tab is hidden. It has no separate volume control: Sound on/off is the existing setting. |
| 10 | Routes: no blocked routes, gaps, falls or snagging | Met | See walk results. Zero holes and zero drops over 1 m in a flood fill from the bridge foot across the garden's colliders; biggest climb in one frame 0.134 m against a 0.4 m step. |
| 11 | Later improvements, other trees and the layout preserved | Met | Nothing changed in this step. The expansion check pins the original trunk, canopy and bridge geometry by hash and the clear route to the cafe counter (over 1.75 m) and lower stairs (over 4 m). The commons' other planter and trees are untouched by `prepareBlossomBed`. |

## Walk results (`check-blossom-walk.mjs`, commons frame)

- Walking +X from the floor at the bridge foot, the controller climbs the bridge (deck y 24.30 at the foot, 24.56, 24.77, 24.95, 25.09, 25.19, 25.24, 25.25 at the crest, then 25.22, 25.12, 25.08 down to the soil at 25.01) and stops in front of the bench. Walking back returns to the floor at 24.30.
- The bench's cushion (top 25.51 m, 1.7 m long) is held up by the colliders and is 0.59 m from the bridge landing.
- The bridge rails stop a walker stepping off either side of the deck (stopped at z 35.23 and 34.77).
- The pond rim stops a walker from the floor on its west and north sides (stopped at x 136.29 and z 39.71).
- A walker who steps from the soil into the pond lands on its floor (y 24.45) and steps back out over the rim to the floor (y 24.30).
- The falls' rocks, the planter's face, the main trunk and both added trunks all stop a walker.
- A flood fill from the bridge foot reaches 331 spots on the soil bed, with no holes and no drop over 1 m.

## Not verified

- Sound was not played or recorded; only its source, falloff, gating and wiring were read.
- Eye-level and overhead looks, the colours and the look of the tree, flowers and fish need the screenshots; flower variety is read from the planting module, not from a render.
- Frame rate cost on weaker devices is not measured here.
- `rest.js` seat finding needs a built layout; its earlier check (#194) found two seats on this bench and none from behind the planter.

## Verdict

No requirement is missing or broken in the source, the colliders or the walk. The report is ready to close, once the attached captures confirm the tree, flowers, fish and petals look as described. If they do not, the visual item that fails is the next build decision; the walk, the sound and the layout items need nothing further.
