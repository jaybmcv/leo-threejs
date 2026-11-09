# S2 balcony walls: garden terraces (concept B) with cream fascias (concept A)

The slab edges of Decks 7–16 carry a continuous planter strip with trailing greenery and small white and soft-pink
flowers (concept B), on cream limestone fascias with a slim warm-oak top band and a thin bronze line (concept A's
fascias). The balcony undersides stay cream; balustrades and geometry are unchanged.

![before / concept / after at walls-starboard, day (top) and night (bottom; concept A for the fascias)](contact-walls-starboard.jpg)

![close-ups at walls-starboard: upper decks (top) and the lower left stack (bottom)](closeup-walls-starboard.jpg)

![walls-along and hero: before, after by day, after at night](contact-day-night.jpg)

*Before is a local r187 build (three 0.187.0) of 42113d02 (day/night light + sky A); after is the same base plus this
change (2e56f019), built in the same folder. All captures are `scripts/capture-atrium-areas.mjs
--only=walls-starboard,walls-along,hero --query=time=day|night`. The concepts were painted over older, darker
captures, so compare hue and pattern, not brightness.*

## What changed (`src/v2/atrium-gardens.js`)

- **Planter strip, Decks 7–16:** each run of the slab edge is cut into equal slots of about 3.6 m, one trough per slot,
  stretched to fill its run so neighbours abut. On curves, short runs are gathered into chords first. The strip stops
  only where the tower, its bridges or a dining apron meet the edge. Vines trail about 1–3 m.
- **Lighter higher up:** three variants (lush, medium, light; the light one gathers its foliage at one end of the
  trough). The lush share falls from about 90 % on Deck 7 to about 2 % on Deck 16, and the light share rises from
  0 % to 60 %. Variants come in clustered runs from smooth noise along the edge, with a random mirror and a trail
  length per slot, so the upper decks don't read as uniform stripes. Decks 17–20 keep their irregular runs, on the
  new templates.
- **Fascias, Decks 7–16:** they follow the true edge (simplified to 1.5 cm), 3 cm outside the slab, from 0.40 m below
  the floor up to it. The cream limestone is drawn with the soffit (`V2_atrium_soffit`), so it follows atrium-light's
  day/night lerp. The oak band and the bronze line join the static garden draw. They stop at the same tower, bridge
  and apron mouths.

## Rules kept

- **Void:** every new piece above Deck 16 is a `P6_hanging_garden_*` face within 1.2 m of an edge and no more than
  0.75 m above its deck. Fascias stay at or below their deck's floor. A node run of `auditAtriumVoid` on the gardens
  layer passes: 88,794 faces, 0 violations.
- **Batching:** no new meshes. The planting is still the three instanced `P6_hanging_garden_*` draws (distant copy:
  one silhouette template, Basic). The fascias join `P6_atrium_soffits` and `P6_atrium_gardens`. All of these are
  `gardenDecor`, so phones drop them from the distant layer.
- **No collider change:** everything is `noCollide`, so the atrium PVS key is unchanged. `atrium-gardens.js` has no
  pin rows, so nothing to re-pin.

## Cost

| View | Draws before → after | Triangles before → after |
| --- | --- | --- |
| hero | 558 → 558 | 10,760,649 → 11,162,263 |
| walls-starboard | 613 → 613 | 11,067,498 → 11,469,112 |
| walls-along | 812 → 812 | 10,899,351 → 11,300,965 |

Main-pass draws and triangles from the debug review walk (`scripts/launch-a-measure.mjs`): [`stats-before.json`](stats-before.json),
[`stats-after.json`](stats-after.json). The +401,614 triangles (+3.7 %) are the same in every view because the facade
layer draws whole.

| Planting | Before | After |
| --- | --- | --- |
| Instances | 1,267 | 3,810 |
| Triangles per variant | 576 / 600 / 656 | 398 / 228 / 148 |
| Near triangles | 775,048 | 1,163,030 |
| Distant-copy triangles | 141,904 | 403,860 |
| Fascias | – | 11.9 km, 13,632 triangles |
