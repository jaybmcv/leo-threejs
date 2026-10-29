# Hydro-Nip Lounge (feedback-inbox #58)

A catnip lounge in Neighborhood 1's garden commons (Deck 17, the port commons of the pair nearest the fin). Concept by Tochtli (Discord tochtli_13), from a render by their designer. The render is a reference for layout and mood only: no artwork, sign lettering or characters are copied from it.

## Decisions (Jay, 2026-10-23)

- **Theme:** catnip, not cannabis. No smoking, bongs or "hotbox". The mist in the maze is catnip mist. Names kept: the Hydro-Nip Lounge, the Terpene Tasting Deck (catnip's nepetalactone is a terpene), the Haze Maze, the Cosmic Munchies Converger, the Anti-Gravity Geodesic Hammock Dome.
- **Place:** one commons only, Neighborhood 1 (`createGardenCommons(1)`). The other nine stay gardens.
- **Built into the model:** shows in the viewer, the walk and the downloads.
- **Style:** Leo's stylised low-poly. Neon is glowing materials plus glow sprites; no real lights (the walk has no bloom or point lights).
- **Kept:** galleries, stairs, columns, the shared-services strip (laundry, lockers, kitchen island, reading shelves), and the room's walls and circulation.
- **Replaced:** the garden middle (planters, trees, café counter and tables) and the commons' cat figures. The render's characters are not modelled.
- **Phase 1** is decoration only. The dome and maze are sealed glass you can see into. Seats use the existing sit action. Phase 2 makes the maze and dome walkable; phase 3 adds doors that slide open as you approach and lying in the hammocks.
- **Budget:** at most +60k triangles and about 25 draw calls, drawn only near the room.
- **Credit:** a plaque by the entrance ("Hydro-Nip Lounge concept by Tochtli") and a README line.
- **Gate:** plan and blockout approved before any detail.

## Coordinates

The lounge is built in the commons template's own frame (the Neighborhood 10 commons: x 109.5–154.5, z 8–46, floor 24.3, ceiling 35.65, galleries at 28.3 and 32.3). `createGardenCommons` moves it to Neighborhood 1: world x = template x − 224, world z = −(template z), which mirrors it across the ship's centreline. Text is flipped back locally so it reads correctly.

Open floor for the lounge: x 113.5–148, z 12–42. The entrance side is z ≈ 8–12, facing the ship's centre.

## Layout (blockout)

| Zone | Template position |
|---|---|
| Haze Maze tower (glass, three storeys) | x 114–120.5, z 19–33, y 24.3–35.2 |
| Terpene Tasting Deck | across the back behind the maze, facing the entrance: counter x 117.5–126.5, z 35.6–36.6; back bar at z 37.9; stools at z 34.9 (moved from the maze's flank on Jay's request, 2026-10-23, to open the view of the maze) |
| Anti-Gravity Geodesic Hammock Dome | centre (134, 25), radius 6.5 |
| Cosmic Munchies Converger | counter around (145.5, 25) (moved 1 m from the blockout so its stools have room to walk round); machine hung from the ceiling above |
| Hydro-Nip sign | on the dome's crown, facing the entrance, y 30.9–33.1 (hung at the dome's front it blocked the upper gallery's view) |
| Lounge rugs and beanbags | x 122–146, z 12.5–17.5 |
| Credit plaque | (117.5, 12.6), facing the entrance |

## Phase 1 (dressing), as built

- **Hammock dome:** a two-frequency geodesic of neon struts over sealed glass, with a catnip ring planter round the base, a sealed door toward the entrance, a soft purple glow on the floor and nine hammocks hung at staggered heights.
- **Hydro-Nip sign:** on the dome's crown; neon lettering on a dark board, framed in cyan, with two catnip leaves.
- **Haze Maze:** a framed glass tower with two inner platforms, a zigzag of cat shelves, cushions, trailing vines and green catnip mist. It has a sealed door and a "HAZE MAZE" sign, and two glass tubes ringed in green arc over the room to the front and rear galleries.
- **Terpene Tasting Deck:** an oak bar with green neon trim, a back bar of flasks holding glowing blends, tasting flights, a still with its coil, six stools and a sign facing the room.
- **Cosmic Munchies Converger:** a metal counter with four candy dispensers and a glowing pad. The machine hangs from the ceiling (ring lights, three claws, an emitter), and a blue beam with two snacks caught in it runs down to the pad. Three stools; the sign hangs from the ceiling.
- **Seating and play:** three patterned rugs, seven beanbags, six floor cushions, two low tables with catnip bowls, toy balls, and three cat trees.
- **Galleries:** string lights in catenaries under both galleries' edges, and hanging pots of trailing catnip between them.
- **Credit plaque:** by the entrance.
- **Seats:** the stools (`Seat`), beanbags (`Soft_seat`) and cushions (`Meditation_cushion`) all work with the walk's sit action.

**Cost.** The lounge is 57k triangles, but Neighborhood 1's commons is about 4k triangles lighter than a garden commons. In the walk, from the entrance, the view draws 706k triangles and 462 calls, against 682k and 413 calls for the same view in Neighborhood 2's garden. Most of the +49 calls come from the walk splitting each glowing, see-through or textured material by deck band. The lounge uses seven shared materials (colour per vertex), down from 28 at first.

**Materials.** Neon, glow and glass are merged here. Mirrored placements are flipped back triangle by triangle, otherwise the walk's world-space merge turned them inside out. The textures (glow, mist, rug) are made only where a canvas exists. The Node builds (walk plan, checks, model downloads) leave out the additive glows and give the rug a plain colour.

## Phases 2–3: walkable maze and dome, sliding doors, hammocks (plan)

**Decisions (Jay, 2026-10-23, the defaults):**
- **Maze:** a short ground-floor maze in green mist, then cat-shelf stairs up to the two inner platforms.
- **Tubes:** both become walkways to the galleries.
- **Mist:** a light green haze inside that clears as you climb.
- **Dome:** walk in and lie in all nine hammocks, hung low enough to reach and swaying gently.
- **Doors:** the dome and maze doors slide open for anyone near them, other players included.
- **Budget:** about +15k triangles and +10 draw calls.
- **Shipping:** one blockout for approval, then one PR that keeps #58 open until Jay confirms.

**One change from the proposal:** the maze's two platforms sit at exactly the two gallery heights (28.3 and 32.3 m), so each tube is a level walkway from a platform to the gallery at its own height. The front tube leaves the lower platform for the lower front gallery; the rear tube leaves the upper platform for the upper rear gallery. A tube from the top platform to the front gallery would have had to cross the lower platform's airspace and ramp down.

### Layout (blockout)

| Part | Template position |
|---|---|
| Maze ground floor | 3 × 6 cells of 2.1 × 2.07 m (x 114.1–120.4, z 19.1–31.5), partitions 1.6 m high, so you and the camera see over them (revised after Jay's test, 2026-10-24: 4 × 8 cells under 2.6 m walls were too cramped to steer through). Door at the front middle, 2 m wide, opening on cell 1. One way through (east, back along column 2, west at row 3, back to row 5), plus one dead end to the west. |
| Stair 1 (ground → 28.3) | Two shelves along the back wall (x 115.5–118.3, z 31.5–32.9), a landing in the back east corner, then 8 shelves forward up column 2 (x 118.3–120.4) to the lower platform's back edge. Each step rises 0.364 m (4 m in 11). |
| Lower platform, 28.3 | x 114–120.5, z 19–27.37 (`SPLIT`). |
| Stair 2 (28.3 → 32.3) | Starts beside the front tube's door: two shelves along the front wall (x 115.7–118.45, z 19.1–20.5), a landing in the front west corner, then 8 shelves back up column 0 (x 114.1–115.7) to the upper platform. |
| Upper platform, 32.3 | x 114–120.5, z 27.37–33. |
| Guards | Glass with a green rail, 1 m above whatever they guard, wherever a platform or stair drops away. |
| Front tube | x 119.4, floor 28.3, z 19 → 12 (the lower front gallery). |
| Rear tube | x 118, floor 32.3, z 33 → 42 (the upper rear gallery). Each tube is glass of radius 1.35 m with a 1.75 m floor, ringed in green; each gallery's railing is cut open where its tube lands (`openRails`). |
| Dome porch | A glass porch 2.1 m wide and 2.7 m high, from the door at z 17.25 to inside the skin at z 19.6. The skin and struts in its way are cut, with a dark collar round the cut, and the planter ring is open for it. |
| Hammocks | 9 spreader-bar hammocks in a ring of spokes (2.4–4.7 m out from the dome's centre), 36° apart, with the gap at the porch. The cloth is 2.3 × 1.1 m and gently dished (0.12 m along, 0.06 m across), held by an oak bar at each end at 0.66 m. The bars are roped to points 0.45 m above them, and from there one rope goes up to the frame. You lie at 0.48 m, centred along the cloth. (Revised after Jay's test: in the deeply sagging 2.1 m cloths the body, placed as on a bed, ran its head up the curve and its ears through the fabric.) |
| Sliding doors | Maze door at the tower's front (1.9 m, leaves sliding inside the wall), dome door at the porch's front (1.7 m, leaves sliding outside it). Each has two glass leaves (`Lounge_door_panel` and `Lounge_door_frame`, with `userData.slide`), which open fully clear of the opening. |

**Checks.** `npm run check:lounge` (`scripts/check-lounge.mjs`, about 20 s) floods the walk's own world as the 2 m walker:
- From the entrance, it reaches both platforms, both tubes and the galleries past them, the dome's middle, and every hammock (9 of 9 usable, lying surface at 24.8).
- From inside the maze door, kept within the tower, the maze alone leads up to both platforms.

**Cost so far.** The blockout costs nothing from the entrance view: in the dev walk, 393 calls and 664k triangles, against 399 and 667k on main. The phase-1 sealed parts it replaces paid for it.

### Phases 2–3, as built (Jay approved the blockout and the tube change, 2026-10-24)

- **Sliding doors:** the maze's door and the dome's porch door. Each leaf is a glass pane in a dark frame with a green pull, shown shut in the model. In the walk (`src/walk/lounge.js`) the leaves slide apart in 0.6 s while anyone is within 2.6 m (the walker or any other player) and close again behind them. Each leaf is a moving collider, as the lift doors are: a shut door stops you, measured at 0.35 m (the walker's radius). The model's leaves don't collide, so the checks walk through the doorways.
- **Hammocks:** all nine swing gently (±0.075 rad, about 4°, each in its own phase), worked out in the vertex shader, so all nine are one draw. Lie in one with E: the body swings with the cloth (about the line between the rope points), lies centred, and has its head toward the rim. The lying pose (shared with beds) now relaxes the feet, toes eased along the legs, instead of pulling them up to the shins. In a hammock (from tester feedback) Cosmo also clasps his hands behind his head, elbows out, and shuts his eyes (`src/walk/avatar.js`). His face has no lids, mouth or face rig, so the eyeballs take the fur's colour from his own texture and read as closed lids under the lash line; a smile would need a mouth added to the model. Others aboard see the same pose: Leo live sends only that someone lies, and their page knows a hammock from where the body is (`hammockAt` in `src/walk/rest.js`, checked in `npm run check:live`). Spots are `Hammock` meshes in `src/walk/rest.js`.
- **Mist:** the maze's mist is a material of its own (`Lounge_maze_mist`) that the walk draws whole. It is loose (no collision): at first its name lacked the `glow` the walk skips, so every mist plane was an invisible wall, and the Node checks couldn't see it because Node builds make no mist. With the camera inside the tower it thins to 12%, and a green screen haze takes over: 0.34 on the ground floor, 0.16 on the lower platform, none on the top one.
- **Maze:** partitions of frosted green glass (`Lounge_frosted_glass`, solid), capped dark with a green line along the top, with catnip tufts at their feet.
- **Stairs:** cat shelves, each a sisal block under an oak tread.
- **Platforms and tubes:** each platform has a purple rug with a teal border. The tube floors have green edge lines.

**Cost.** Same entrance view and window (800 × 668, third person) in the dev walk: 406 calls and 669k triangles, against 399 and 667k on main. That's +7 calls and +2k triangles, inside the +10 / +15k budget. The new draws are the frosted glass, the doors (two, both doors' panes and both doors' frames), the hammocks and the maze mist. The mist at first went in as a glow the walk split by deck band (6 draws), and the platform rugs used the textured rug (2 more); both were changed.

## Marquee entrance signs, Decks 19 and 18 (feedback-inbox #164)

**Decision (Jay, 2026-10-27):** a catnip version, in keeping with the lounge: the glowing purple-LED entrance sign reads "Hydro-Nip Lounge", with no cannabis wording.

The lounge's Deck 19 and Deck 18 entrances are the short necks (3.88 m wide, 4 m long) from the aft promenade into the end gallery. Each gets a theatre-marquee canopy (`src/walk/lounge-entrance-signs.js`, walk only): a dark fascia across the mouth with "HYDRO-NIP" over "LOUNGE" and two lit catnip sprigs inside a ring of pale and violet bulbs and a purple tube, a low soffit running back along the neck with four rows of bulbs and a tube down each side, and a matching plate facing the lounge. Purple light is washed down both walls and onto the floor. It sits wholly inside the neck (nothing sticks out into the promenade), its underside 2.56 m above the floor, and nothing in it is solid. Glow is emissive geometry and additive planes, no real lights: about 5.6k triangles in 7 meshes per sign, and the pair is 11k triangles.

## Synthwave wall (from tester feedback)

A neon sunset over wireframe mountains covers the back wall (template z 45.9, x 109.5-154.5, floor to ceiling), and the same mountains run on along the left wall (`Commons_end_wall`, x 109.6) without the sun, as one panorama unrolled round the corner. It is painted in code (`src/walk/lounge-mural.js`, `paintSynthwave`), so no picture is used; the sun sits at template x 143, beside the hammock dome. The left wall stands only above Deck 17's opened hall (`HEADER` in `src/walk/commons-hall.js`, 28.0 m), so the mural covers that header. It is walk-only (no canvas in the Node builds, so no mural there), two unlit planes 8 mm off the walls, drawn like a painting across the deck bands it spans. Cost: two draws and about 26 MB of texture.

## Aquarium front wall (from tester feedback)

The lounge's front wall, the one its front galleries run along and the jaguar gate opens through, is a fish tank (`src/walk/lounge-aquarium.js`, walk only). It fills the strip between the lounge and the promenade (template x 113.7-154.3, z 4.07-7.82), from the Deck 17 floor to the ceiling (24.3-35.5), three storeys of water in one, with the glass at z 7.82-7.9 just behind the galleries' rails. The galleries are unchanged.

- **Inside:** a sand bed with rocks, five rock pinnacles rising to the galleries' heights (so each storey has a reef at eye level), about 80 glowing corals (branching, brain, tube, fan and anemones), sea grass, starfish, 30 kelp ribbons up to 8.5 m tall, and a magenta octopus with neon suckers on the pinnacle beside the Deck 18 gallery. Light shafts fall from the top, and soft glows sit round the coral.
- **Alive:** 68 fish of six kinds (neon tetra schools, pink, lime, clown, angel and yellow tang) swim loops along the tank, out along the glass and back along the rocks, tails wagging; kelp, grass, fans, anemones and the octopus's arms sway; seven vents send streams of bubbles to the top. All of it moves in the vertex shaders, so it costs no work per frame beyond one clock.
- **Way in:** the jaguar's glass throat runs through the tank on Deck 17, so you walk in with the reef either side and fish over you. From inside it, the water tints the view through its sides and roof.
- **Solid:** glass on both sides, both ends, and the throat's sides. The walk's partition along the galleries' back edge is taken out where it stands (`partitions.js`), and the promenade partitions behind the tank are cut from drawing after collision is built. The reef can be seen from the promenade on all three decks, with the jaguar's head still framing the entrance. The deck plates and floors that ran through the strip are cut from drawing. `npm run check:lounge` walks through the throat from the promenade into the lounge, and checks nobody reaches inside the tank, from the promenade or anywhere in the commons.
- **Deck 17:** the strip in front of the lounge was open floor between the promenade and the lounge. The tank takes it, so on Deck 17 the lounge opens to the promenade through the jaguar's throat, through the 4 m gap at its aft end (under the Deck 18-19 entrances) and from the hall at its forward side. The ship map still shows the strip as floor.
- **Cost:** about 43k triangles in 9 draws (reef and backdrop, fish, bubbles, glows, light shafts, glass, the throat's water, frame, trim), drawn with the lounge's deck bands, and no texture but one small glow.
