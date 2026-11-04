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

## Steps

0. **Stop the silent crashes** (this branch). walk.html sets the start note before the walk script loads, records how far loading got, and clears both once the walk is ready. Likely phones (coarse pointer and a small screen or mobile user agent; not tablets or touch laptops) see the guided-tour card first, with Try anyway; a phone that has finished loading before goes straight in. `scripts/check-phone-memory.mjs` reports download, peak heap and time to a walkable view in phone emulation. It reports only and blocks nothing.
1. **Real phones, now.** Safari on a named iPhone; Chrome on a 4 GB and an 8 GB Android. Record where each stops: network, stalled decode, WebGL context loss or the tab closing.
2. **Measure one phone working set.** For the arrival spot and one useful route: which arrays and parts they need (including dictionaries and shared pools), what the atrium view pulls in, collision, and the overlap while moving between areas.
3. **Build the smallest useful phone walk.** One connected area, simple collision, a light atrium and distant hull, loaded on its own rather than loaded and hidden. If step 2 shows the area needs few arrays, a selective reader over today's files is a fair first try; if it reaches most pools, make a separate phone payload.
4. **Keep phone changes quick to build.** Derive the phone payload from the verified prepared build without the full rebuild where the inputs allow, with its own integrity and publishing support.
5. **Stream only if phones need more of the ship.** Prototype with two areas, one of them the atrium, before splitting the whole ship: explicit dependencies, a bounded resident set, waiting navigation, safe collision handoff, cancellation and recovery.
6. **Agree acceptance from real phones** (Jay's call, since he retired the blocking limits on 2026-11-02). Measure a walkable view and the worst transitions, not the login card. Starting targets from the review: 10–15 MB to a walkable view, at most 350 MB peak JS heap including transitions, about 100 MB of decoded geometry and collision resident, time measured on a named phone. Narrow the step 0 card only once phones pass.
