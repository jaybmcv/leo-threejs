# Walking Leo on a phone

Phone visitors can't load `walk.html`. This is the plan for fixing that, revised after a review by Codex GPT-6 Astra (high) on 2026-11-04.

## What a phone does today

Measured on 2026-11-04 against the live site (a1663a2) in headless Chrome on the 32 GB gaming PC, emulating a phone (390×844, DPR 3, touch, Android user agent), up to the login card:

| | |
|---|---|
| Download | 127 MB |
| JS heap, peak / settled / after GC | 1.72 GB / 1.43 GB / 1.39 GB |
| Scene geometry (each buffer counted once) | 871 MB |
| Time to the login card | 41 s |

The prepared build behind it (`complete.json`): 26.6M triangles, 1.09 GB raw geometry, a 113 MB manifest, 88 collision bands with 11.8M triangles. GPU memory was not measured, and nothing has been tried on a real phone yet.

`readPreparedWorld` (src/v2/prepared-codec.js) decodes all of it before the walk starts: it parses the whole manifest, fetches and inflates every part and decodes every array, and the inflated parts and decoded arrays are held at the same time. `prepared-resource.public.js` does this as a top-level await, so it finishes before `main.public.js` runs at all.

The walk.html start card only caught touch devices that report 4 GB or less. Safari reports no `navigator.deviceMemory`, so iPhones never saw it, and the "last start never finished" note was written only after the decode, so a phone that closed during loading never left it.

## Why "load nearby decks" is not the first step

- **Arrival:** `span()` in main.js returns the whole atrium's height when the walker is in it or can see it through a doorway, so arrival needs much more than the decks next to the walker. Phones need a light atrium either way.
- **Collision:** `goTo()` finds its stand against `colliders` straight away, and the prepared colliders are built whole (`addStatic` returns 0, `commit` does nothing). Streaming needs new contracts for adding and removing collision and for waiting before a move.
- **Shared buffers:** pooled vertex buffers, tuple dictionaries, the attribute cache and `geometryTemplates` are shared across decks, so removing a deck from the scene frees little.
- **The manifest:** loading only some arrays from today's files still parses the whole 113 MB manifest.

## What arrival needs (step 2, 2026-11-04)

Measured with `scripts/phone-working-set.mjs` on the prepared build in leo-deploy (main 087b064), and a phone-emulated live walk that looked around at the arrival spot (Deck 2 arrival hall, -135, -35.7, -52.5):

| | Decoded | Download parts |
|---|---|---|
| Whole ship | 1,090 MB | 30 of 30 (94.5 MB) |
| Main vertex pool and its position dictionary (#16900–16902, #24289) | 329 MB | 12 (42.8 MB) |
| Deck 2's render band alone (14 groups) | 399 MB | 16 (47.6 MB) |
| Deck 2's collision band alone | 200 MB | 13 (56.1 MB) |
| Deck 2 render + collision + facade, haze and signs | 537 MB | 24 (76.7 MB) |
| The 113 band groups the walk shows at arrival | 515 MB | 18 (48.8 MB) |

- **Every band needs the main pool.** All 211 render band groups read the same pooled vertex buffers, which are shared by 4,116 geometries, plus a 119 MB position dictionary. Collision indexes into its own large shared arrays the same way. So loading only some pieces of today's files cannot get a phone near budget: one deck already needs more than a third of the whole ship.
- **Arrival shows nearly the whole ship.** Looking around in the arrival hall, the walk shows 113 of the 211 band groups: 10.3M of the 10.8M baked triangles, every height from Deck 1 to the sky. This is the atrium sight (`atriumViewSpan`) on top of the local span. Desktops draw all of that too.
- **A short walk is much smaller.** Baked triangles whose meshes come within 20 m of the arrival spot: 0.69M; within 40 m: 1.20M; within 80 m: 3.45M. At roughly 30–56 bytes per triangle with its own buffers, a 40 m arrival pack would be about 35–70 MB of render geometry. Collision and the existing 26 MB phone distant hull come on top. That is near the 100 MB target, against 537 MB today.

So step 3 has to be its own phone payload with its own buffers. It can't be a reader over today's files. Its view up the atrium has to come from a light stand-in, not the real upper decks.

## The phone ship (step 3, 2026-11-05)

A first version cut the ship down to the arrival hall (PR #329's first commit). Jay turned that down: phones should get the whole ship, made light. `scripts/build-phone-walk.mjs` now does that from the verified prepared build, without rebuilding the ship. The output keeps the prepared-walk format, so `readPreparedWorld` reads it unchanged:

- **Render geometry is simplified** with meshoptimizer. Each connected part may move by at most 3% of its middle dimension and never more than 5 cm, so thin strips and floors of small parts (footprints) keep their shape. Lettering isn't simplified. Each material group and prepared range is simplified on its own, so their index ranges can be rewritten, and the vertices ranges share are locked so their seams can't open. Seam-crossing collapses (meshoptimizer's Permissive mode) would save another 80 MB, but they tore holes in curved trims, so they're off.
- **Smaller vertices:** normals and colours become 8 bits, and indices 16 bits where a geometry has 65,535 vertices or fewer. Vertices that become identical are merged. The owner and finish ids, which only the inspector reads, are dropped.
- **What the walk rebuilds from stays byte for byte:** geometry templates and live source meshes (its merged templates are keyed on their contents), cabin frost, the lounge, and the facade and haze meshes the phone distant view reads. Envelope batches carry room and finish ranges; they were merged from unindexed parts, so those ranges are rewritten like groups.
- **Collision** is welded by position and simplified to 2.5 cm, glass and the rest each on its own, with the vertices they share locked. Then it is checked against the full collision: 13.4M points on floors (facing up) and walls (upright), about one per half square metre, each probed with a short ray, down onto a floor and into a wall, in both. Where the two differ by more than 3 cm on a floor or 5 cm on a wall, the full triangles within 40 cm stay exact and the band is simplified again around them, up to three times. On prepared build e0e97a59, 59,062 points (0.44%) differed at first, 958k triangles were kept exact, and 22 points still differ. Without the check, 8 cm collision had 4.1M triangles but 5.6% of the points differed. With the check, 4 cm and 6 cm save only 15–20 MB more and leave more points differing. The bands run in worker threads. The BVHs are rebuilt with 32-triangle leaves and the index in BVH order, as the ship's are packed.
- **Checks that stop the build:** every geometry must read only arrays this build wrote, with whole items, attributes of one length and a valid index; every BVH's index must be its geometry's; and no low-deck batch (`batchLowDeckDraws`, which merges by material, render order and attribute size and normalisation) may mix array types. Rewritten range ends must fall on cuts.
- **Pictures are half size.** Arrays are meshopt-encoded.

| Prepared build e0e97a59 | Whole ship | Phone ship |
|---|---|---|
| Render triangles (each geometry once) | 14.4M | 8.3M |
| Collision triangles | 11.8M | 8.3M |
| Decoded geometry and collision | 1,090 MB | 554 MB |
| Payload download | 94 MB | 126 MB |
| Pictures, decoded | 303 MB | 76 MB |

The payload downloads more than the ship's own, because the ship's arrays share a position dictionary (`meshopt-tuple`) and the phone ship's are encoded one by one.

The build takes about 3 minutes. `scripts/public-v2.mjs` runs it on every public build through `scripts/phone-walk-public.mjs`, which writes it to `prepared-walk-phone/<hash>/` (listed as `walk-phone` in the asset manifest) and keeps it in `output/phone-walk-cache/`, keyed on the prepared walk, the builder, the lockfile and the Node version. None of these files are geometry inputs, so deploys stay in the fast lane. Desktops still load the whole ship.

On the walk side, walk.html sends phones and 4 GB touch devices straight to the phone ship (`LEO_WALK_PHONE`), with a line on the loading card saying it is a lighter copy. `?ship=full` asks for the full ship and its start card. `prepared-resource.public.js` loads `walk-phone`, and `main.public.js` skips the atrium detail pack.

In phone emulation on the gaming PC (390×844, DPR 3, Android user agent, cold cache), on main 6529975 with this branch:

| | Full ship | Phone ship |
|---|---|---|
| Download | 145 MB | 148 MB |
| Peak JS heap while loading | 1,812 MB | 1,075 MB |
| JS heap once walkable | 1,524 MB | 977 MB |
| Walkable | 35 s | 36 s |

Loading time is the walk's own setup on this PC, not the payload. Views from six spots on this build match the full ship: the arrival hall, library, sky garden lounge, observation lounge, a café and the crew lounge. The window frames in the observation lounge still show a few faint marks. Not tested yet: walking on the light collision over stairs, thresholds and moving platforms (the ray check covers floors and walls, not a walk), a real phone, GPU memory and frame time.

An earlier build of this branch, with unchecked 8 cm collision, peaked at 889 MB. Gpt-6-astra (high) reviewed that one on 2026-11-05. Its must-fix items were old collision geometry records left reading other arrays, and batches that could mix array types (none did). It also asked for collision checked against the full ship, asserted range ends, lettering found by containment and by name, and a cache key with the lockfile. All of these are in.

What is left of the heap, by a sampling heap profile: the geometry arrays, about 240 MB of objects (the scene graph, its matrices, the collision groups' boxes and the manifest), and copies the walk makes at start (the phone distant hull, low-deck batches). Desktop Chrome collects garbage late, so a phone's real peak is unknown until one loads it.

## Walking the phone ship (step 3b, 2026-11-05)

On the Galaxy S9 the phone ship loaded but was slow, then crashed while walking. In S9 emulation (360×740, DPR 4) over a route of 12 places, the scenes' pictures took about 690 MB once uploaded. 460 MB of that was canvases the walk draws itself (room guides, signs, murals), up to 3,500 px across, on a canvas of 450×925 pixels. Every shape drawn stayed in the page as well as on the GPU. Deck 9 and 12 views issued about 4,100 draw calls a frame, about 1,900 of them separate 40 m chunks of one finish.

On the phone ship only (`src/v2/phone-memory.js`):
- **Pictures:** a picture over 1,024 px in an ordinary material's colour slots is swapped for a 1,024 px copy, before or soon after its first upload. The original is held weakly. A canvas drawn once is freed, and a module that redraws its canvas gets it back on `needsUpdate`. A global cap (`maxTextureSize`) was tried first and rejected: it also shrank a 768×2048 RGBE environment image that a shader decodes, and every view came out about 45% darker. Shader uniforms, the scene environment and data textures are left as they are.
- **Shapes:** the prepared ship's arrays leave the page after their first upload. A batched chunk's arrays go as soon as it is copied into its batch, unless another mesh draws them. Templates, collision geometry, instance attributes and dynamic or morphing geometry keep theirs. Culling batches keep their index, and each chunk's bounds are worked out first, since three reads those every frame.
- **Draw calls:** every band is batched (`batchLowDeckDraws`, `allBands`). Each chunk was culled at first; #347 turned that off, because on the S9 lettering jumped across the screen. Desktops still batch only decks −1 to 4. Step 3c (below) replaced this for the deck bands.
- `readPreparedWorld` (public) now has `release()`. Closures it makes (the colliders' triangle count, stand-in bounds) keep its scope alive, and with it every decoded array.
- Batching yields about every 12 ms, not after every chunk. That saved about 20 s of timers once all bands were batched.

| S9 emulation, 12-place route, heap after collection | Before | After |
|---|---|---|
| JS heap while walking | 955–979 MB | 752–876 MB |
| Draw calls, Deck 9 housekeeping | 4,092 | 2,368 |
| Draw calls, arrival hall | 4,851 | 3,053 |
| Pictures in the scenes (uncompressed, with mipmaps) | 688 MB | 474 MB |
| Walkable | 39 s | 32 s |

Views at ten places match the build before (mean difference under 0.6 of 255, only the cat's tail differs). The loading peak in emulation is about the same or higher (1,096–1,115 MB against 1,032–1,108), because desktop Chrome under no memory pressure collects late. The released arrays are gone after a collection. Not measured: GPU memory on a phone, and whether a 4 GB phone now stays up.

Next, if the S9 still struggles: about 320 draws a frame of smart glass and 140 of hull glass (transparent, so not batched), 4.8M triangles at the Deck 9 corridor, and the 1,024 px pictures (257 MB).

## Phone frame rate (step 3c, 2026-11-06)

With #347 the S9 walked without glitches, but at about 10 frames a second or less. Measured on live 9b68fdb in S9 emulation, with the CPU throttled 4× and a 5 s profile per place, both standing and walking with turns:
- A phone frame is mostly CPU. The arrival hall drew 3,248 draws a frame, the Deck 9 corridor 2,497, commons 787. Only 128 of the arrival hall's draws were within 50 m. The hall sees into the atrium, so every band from 0 to 19 is in the view span, along the whole ship.
- In the bands there were 2,401 draws but only 240 materials. 664 of them were two faint glass materials, in chunks of about 12 per band.
- While walking, `span()` took 19–40% of the CPU. It casts 25 view rays plus 100 vertical probes every 150 ms, and on a throttled phone that is every frame. Most of the cost was the ray queries' per-group loop and BVH walks that never shortened after a hit.
- The atrium PVS isn't shipped: its bake fails its own check (`cells hidden where bench-view eyes see the atrium: arrival-hall`). So the atrium sight casts its own rays too, on desktops and phones.
- Spatial cells (simulated at 16–48 m) cut triangles but multiplied draws 2–6×, since each cell holds most materials. Changing the far plane didn't help either: views at 450, 200 and 150 m look the same in the hall.

Changes:
- **One draw per material in the deck bands** (phone ship only, `src/v2/phone-bands.js`). Every opaque mesh low-deck batching would take from a `Walk_band_*` group, and faint glass, goes into one plain mesh per material. Faint glass means transparent, no depth writes, normal blending up to 35% opacity or additive. Triangles are ordered by band. After `showBands`, each mesh draws one geometry group per unbroken run of shown bands, usually just one. Nothing of a hidden band draws. Plain draws only: no multi-draw and no draw list that changes from frame to frame. Meshes with interleaved attributes, or with tangents and a transform, stay out. The bands' other groups (the cat tree, paintings, lounge pieces) are batched as before. `?phonebatch=band` brings back #347's per-band batches for comparison.
- **Ray queries** (desktops too, `src/v2/visibility-query.js`). One cell index across all instance groups replaces the per-ray loop over groups. Each later BVH walk stops at the best distance so far. Over 10,000 random rays from 400 eyes, the hits are identical (distance, point and normal) and take 4.3× less time.
- **`?fps=1`** shows frames a second, the median and 90th percentile frame, the main pass's draws and triangles, and the pixel ratio. **`?phoneaa=0`** (no multisampling) and **`?phonedepth=linear`** (no logarithmic depth, near plane 0.2 m) are off by default. They are A/B switches for a real phone. Astra expects linear depth to z-fight at 100–200 m, so it isn't a default.

| S9 emulation, walking, CPU 4× | Before (live 9b68fdb) | After |
|---|---|---|
| Arrival hall: frame, draws | 292 ms, 3,248 | 150 ms, 1,696 |
| Deck 9 corridor | 313 ms, 2,497 | 125 ms, 1,417 |
| Garden commons | 171 ms, 787 | 50 ms, 348 |
| Library | 171 ms, 722 | 50 ms, 323 |
| JS heap while walking (12-place route) | 784–807 MB | 726–743 MB |
| GPU memory peak (route) | 739 MB | 668 MB |

The views at six places match `?phonebatch=band`: under 0.6% of pixels differ, and those are animated things. Astra (gpt-6-astra high) reviewed the plan first. It rejected broad glass batching because of order effects, so only faint, non-depth-writing, normal-blended glass merges. It ranked spatial visibility first, then the ray work, and asked for device A/B switches. Its review of the diff found that one run per mesh could include bands `showBands` hides (now groups per run), plus the attribute cases. It then cleared the merge. Spreading span's rays over five frames on phones gave Deck 9 125 → 83 ms walking. It was held back: a pass can mix camera poses and narrow the span on completion.

Next, by size at the arrival hall: room furnishing (509 instanced draws, from about 1,081 deck-split meshes that would merge to about 320), 237 multi-material wayfinding and directory meshes, 198 always-drawn facade meshes, 76 lift door shutters, and the span rays (11–27% while walking).

## Steps

0. **Stop the silent crashes** (this branch). walk.html sets the start note before the walk script loads, records how far loading got, and clears both once the walk is ready. Likely phones (coarse pointer and a small screen or mobile user agent; not tablets or touch laptops) see the guided-tour card first, with Try anyway; a phone that has finished loading before goes straight in. `scripts/check-phone-memory.mjs` reports download, peak heap and time to a walkable view in phone emulation. It reports only and blocks nothing.
1. **Real phones, now.** Safari on a named iPhone; Chrome on a 4 GB and an 8 GB Android. Record where each stops: network, stalled decode, WebGL context loss or the tab closing. So far (2026-11-04): a Galaxy S20 Ultra (12 GB) stalled on the first try and loaded after a refresh. A Galaxy S9 (about 4 GB) never finished: the loading line flashed between "Loading prepared collisions…" and "Fitting the walls…", then the tab crashed and the phone overheated. No iPhone yet.
2. **Measure one phone working set.** Done for the arrival spot (above). Not yet measured: a route away from arrival, and the overlap while moving between areas.
3. **A phone payload of its own.** Done in phone emulation (above): the whole ship, made light. Next: the same real phones as step 1, starting with the Galaxy S9 that couldn't load the full ship. If it still runs short, the next savings are, in Astra's order: copies the walk keeps at start, reading the payload one part at a time, 16-bit positions on selected meshes (about 60 MB), and dropping small decorative props (never signs, interactables or navigation cues). Coarser collision is last, because it is the riskiest.
4. **Keep phone changes quick to build.** Derive the phone payload from the verified prepared build without the full rebuild where the inputs allow, with its own integrity and publishing support.
5. **Stream only if phones need more of the ship.** Prototype with two areas, one of them the atrium, before splitting the whole ship: explicit dependencies, a bounded resident set, waiting navigation, safe collision handoff, cancellation and recovery.
6. **Agree acceptance from real phones** (Jay's call, since he retired the blocking limits on 2026-11-02). Measure a walkable view and the worst transitions, not the login card. Starting targets from the review: 10–15 MB to a walkable view, at most 350 MB peak JS heap including transitions, about 100 MB of decoded geometry and collision resident, time measured on a named phone. Narrow the step 0 card only once phones pass.
