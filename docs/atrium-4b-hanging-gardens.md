# Deck 6 atrium: 4B hanging gardens

Jay's atrium direction 4B. The Deck 6 atrium reads as a daylit garden: a pale
blue sky panel with cumulus clouds, planting cascading from the balcony slab
edges of Decks 7–15, faceted trees, a lake with stone edges and a rounded lawn
shore, two waterfalls, lily pads, timber decks and a winding park path. While
the walker is in the open atrium, the shared lights ease to a warm tint.

![before / after](atrium-4b/before-after.jpg)

*Left: main. Right: 4B. Same views, fresh browser profiles.*

![concept vs walk](atrium-4b/concept-vs-walk.jpg)

| Park | Boulevard |
| --- | --- |
| ![park](atrium-4b/park.jpg) | ![boulevard](atrium-4b/boulevard.jpg) |

## Where it lives

- `src/v2/atrium-gardens.js`: cascades, trees, beds, stones, decks, waterfalls,
  lily pads, soffits, downlights, lanterns, tree shade. All of it is
  `noCollide` and lives in the atrium facade root (`V2_atrium_facade`).
- `src/v2/atrium-daylight.js`: the sky panel and tree-shade canvases.
- `src/walk/atrium-mood.js`: the warm atrium light (no added lights).
- `src/plan/atrium-v2.js`: signature trees, waterfalls, lake shore, park path.

## Rules it keeps

- The sky panel is opaque and Basic. Nothing new crosses the void above Deck 16.
- The five floor zones, routes and seats are unchanged (`check:walk`).
- Distant and phone copies swap to Basic materials; the distant copy uses a
  112-triangle planter, and low-memory phones drop the garden decor.
- Every canopy clears each overhanging deck edge by 1.5 m
  (`check-phase6-canopy-fit`).
- The lake shore reshapes Deck 6 floor colliders, so the atrium PVS key changes;
  a deploy re-bakes it, and the walk uses rays until then.

## Pass 2: avenue, promenade lamps, café string lights

Jay's follow-up after the first pass (all three were the recommended options):

![pass 2 before / after](atrium-4b/pass2-before-after.jpg)

*Left: pass 1. Right: pass 2. The festoon "before" came from a separate capture
run, so its lighting differs.*

![café string lights](atrium-4b/festoon.jpg)

- **Boulevard avenue.** 19 short runs line the boulevard's park and food-hall/stage
  edges, each a tree between two 2.4 m planters (4.8 m), with 7.2 m gaps. The
  runs sit between the food-hall stalls, so a gap opens in front of every stall;
  the cross routes at x=-79 and x=2 and the bridge stay open, and so does the
  lake side. The planters and trunks are colliders, so the boulevard keeps
  9.8 m clear (was 12 m) and the atrium PVS key changes again (the deploy
  re-bakes it).
- **Lake promenade lamps.** Ten more of the reflection bays' low brass lamps
  along the promenade edge, every 8 m between the bays and the bridge.
- **Café string lights.** Warm bulbs scallop along the front of both timber
  decks, on slim posts just off their near rims, and criss-cross over the open
  fore end of the larger deck. The rest of each deck lies in a wing approach
  under Deck 7, so the strings stay in open atrium, hanging from 2.75 m. The
  bulbs share the lanterns' draw and the cables the garden draw: no new draws,
  no real lights.

`ATRIUM_BOULEVARD_TREES`, `ATRIUM_PROMENADE_LAMPS`, `ATRIUM_TIMBER_DECKS` and
`ATRIUM_FESTOONS` live in `src/plan/atrium-v2.js`.
