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

## The phone walk (step 3, 2026-11-04)

`scripts/build-phone-walk.mjs` cuts the verified prepared build down to one connected area: the Deck 2 arrival hall and Hydroponic garden A over it (the hall's ceiling opens into the garden, and its cat tree climbs up to it), with 6 m around them. The output keeps the prepared-walk format, so `readPreparedWorld` reads it unchanged:

- **The whole node graph, names and templates stay,** so the walk code finds everything it looks for.
- **Render geometry whose world bounds meet the area** keeps its triangles. Any geometry that reads a shared vertex pool is copied out into buffers of its own; triangle order is kept, so index ranges still hold. Everything else keeps only its bounds, as the baked source meshes already do.
- **Some meshes stay whole wherever they are, because the walk reads them at start:**
  - live source meshes (doors, hammocks), which feed merges whose templates are keyed on their contents;
  - geometry templates, copied byte for byte;
  - cabin frost;
  - the facade's tower, sky and atrium floor, from which the phone distant view is drawn. Together with the existing phone distant hull, these are the light stand-in for the view up the atrium.
- **Collision keeps the triangles that meet the area,** and those bands' BVHs are rebuilt. Instance copies outside the area are dropped; movers are kept.
- **Pictures only emptied meshes use** become a 1×1 pixel.

It takes about 8 s from a built prepared walk. Views from six spots in the hall and two in the garden match the whole ship's; only views out of the area (through the passenger-transfer glass) show nothing beyond it. Desktops still load the whole ship. `scripts/public-v2.mjs` runs it on every public build (`scripts/phone-walk-public.mjs`) into `prepared-walk-phone/<hash>/`, listed as `walk-phone` in the asset manifest. None of these files are geometry inputs, so deploys stay in the fast lane.

On the walk side:

- walk.html sends phones and 4 GB touch devices straight to the phone walk (`LEO_WALK_PHONE`). `?ship=full` asks for the whole ship and its start card instead.
- `prepared-resource.public.js` loads `walk-phone`.
- `main.public.js` keeps the walker inside the area (a walker carried off it comes back to the start). It also says, for a few seconds, that the phone walk is the arrival hall when the edge or a Go to destination outside the hall stops them. It skips the atrium detail pack.

In phone emulation on the gaming PC (390×844, DPR 3, Android user agent, cold cache), against a1663a2's whole ship:

| | Whole ship | Phone walk |
|---|---|---|
| Download | 137.5 MB | 45.7 MB (the walk payload is 23 MB of it) |
| Decoded geometry and collision | 1,090 MB | 107 MB |
| Peak JS heap while loading | 1.69 GB | 496 MB |
| JS heap after load and a GC | about 1.4 GB | 174 MB |
| Walkable | 81 s | 25 s |

Desktop Chrome collects garbage late, so its loading peak is mostly garbage a phone under memory pressure would collect sooner. Only a real phone will say what the peak is there.

## Steps

0. **Stop the silent crashes** (this branch). walk.html sets the start note before the walk script loads, records how far loading got, and clears both once the walk is ready. Likely phones (coarse pointer and a small screen or mobile user agent; not tablets or touch laptops) see the guided-tour card first, with Try anyway; a phone that has finished loading before goes straight in. `scripts/check-phone-memory.mjs` reports download, peak heap and time to a walkable view in phone emulation. It reports only and blocks nothing.
1. **Real phones, now.** Safari on a named iPhone; Chrome on a 4 GB and an 8 GB Android. Record where each stops: network, stalled decode, WebGL context loss or the tab closing. So far (2026-11-04): a Galaxy S20 Ultra (12 GB) stalled on the first try and loaded after a refresh. A Galaxy S9 (about 4 GB) never finished: the loading line flashed between "Loading prepared collisions…" and "Fitting the walls…", then the tab crashed and the phone overheated. No iPhone yet.
2. **Measure one phone working set.** Done for the arrival spot (above). Not yet measured: a route away from arrival, and the overlap while moving between areas.
3. **Build the smallest useful phone walk.** Done in phone emulation (above): the arrival hall and the garden over it, from a payload of their own, with their collision, the phone distant hull and the facade's tower and sky for the view up the atrium. Next: the same real phones as step 1, starting with the Galaxy S9 that couldn't load the whole ship.
4. **Keep phone changes quick to build.** Derive the phone payload from the verified prepared build without the full rebuild where the inputs allow, with its own integrity and publishing support.
5. **Stream only if phones need more of the ship.** Prototype with two areas, one of them the atrium, before splitting the whole ship: explicit dependencies, a bounded resident set, waiting navigation, safe collision handoff, cancellation and recovery.
6. **Agree acceptance from real phones** (Jay's call, since he retired the blocking limits on 2026-11-02). Measure a walkable view and the worst transitions, not the login card. Starting targets from the review: 10–15 MB to a walkable view, at most 350 MB peak JS heap including transitions, about 100 MB of decoded geometry and collision resident, time measured on a named phone. Narrow the step 0 card only once phones pass.
