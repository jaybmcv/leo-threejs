# Deck 6 atrium: improvement areas

The atrium is split so each area can be designed, concepted and built on its own. Shared layers show in every
view, so they are settled before the ground zones; otherwise each zone's concept would restyle them differently.

| Area | Covers | Main sources |
| --- | --- | --- |
| S4 Light & palette | Warm atrium light, material tones, day and night ([light/](atrium-areas/light/README.md)); locked first | `src/walk/atrium-mood.js`, `ship-time.js`, `atrium-light-paint.js`, detail haze levels |
| S1 Floor & boulevard | Paving, lawns, paths, avenue planters, tree shade | `src/v2/atrium-surfaces.js`, `atrium-gardens.js` (joints, shade), `atrium-daylight.js` |
| S2 Balcony walls | Slab edges, soffits and downlights (Decks 7–16), cascades (7–20), dining aprons (6–15), guards | `src/v2/facade.js`, `flowing-ribs.js`, `atrium-terrace-guards.js`, `atrium-gardens.js` |
| S3a Sky | Deck 20 sky panel (day: sky concept A, [light/](atrium-areas/light/README.md)), Deck 16 bow underside | `src/v2/atrium-daylight.js`, `sky-tip.js`, `crew-gallery.js` |
| S3b Lift tower | Forward glass lift tower and bridges | `src/transit.js`, `src/v2/model.js`, `facade.js` |
| G1 Arrival lobby | x −123..−96, z −32..32 | `src/v2/phase6-programme.js` (reception) |
| G2 Voyager park | x −90..−4, z −56..−6 | `phase6-programme.js`, `atrium-gardens.js`, `src/plan/atrium-v2.js` |
| G3 Reflection lake | x 4..120, z −56..−6: water, waterfall, bridge, bays, island ([option A](atrium-areas/lake-food/README.md)) | `reflection-terraces.js`, `atrium-gardens.js`, `atrium-v2.js` |
| G4 Food hall | x −90..58, z 6..56: stalls, tables, timber decks, festoons ([option A](atrium-areas/lake-food/README.md)) | `phase6-programme.js`, `atrium-gardens.js`, `atrium-v2.js` |
| G5 Common stage | x 66..122, z 6..56: timber amphitheatre tiers, stage deck, cream wall ([stage/](atrium-areas/stage/README.md)) | `src/v2/atrium-stage.js`, `phase6-programme.js`, `atrium-gardens.js` |

Out of scope unless asked: Voyage Commons, bow coffee bars, observation lounge.

## Viewpoints

`scripts/atrium-area-views.json` holds 18 fixed views, one or two per area; `concept: true` marks the one sent for
concept images. Each is a walk share link (`walk.html?lv=2&at=x,y,z&yaw=°&pitch=°&view=first`), so it opens in
any build. Capture with headless Chrome on debug port 9333:

```
node scripts/capture-atrium-areas.mjs <tag> [baseUrl] [--only=id,id] [--query=time=night]
node scripts/atrium-contact-sheet.mjs <out.jpg> <columns> <image>...
```

Shots land in `output/atrium-areas/<tag>/` with `captures.json` (link and location label per view). The capture
keeps the walk solo (a dead local live socket), boards as the default guest and hides the HUD and minimap.
The baseline is `baseline-639f7393`, taken from the live site at that commit; between it and `98a74412` only
`atrium-quality.js` (detail levels) changed in the atrium.

## Every area job keeps

- Nothing new crosses the void above Deck 16 (`scripts/atrium-void-v2.mjs` also checks opaque `noCollide`
  surfaces; edge planting is allowed only as `P6_hanging_garden_*` within 1.2 m of an edge).
- `scripts/check-phase6-v2.mjs` and `npm run check:walk`: zones, routes, seats, guards, entrances, lake depth,
  raised bridge.
- New decor joins the existing shared batches rather than adding meshes; distant copies stay Basic and phones
  drop distant decor (`src/v2/phone-distant.js`). Compare draws and triangles before and after.
- Collider changes alter the atrium PVS key: integrate one at a time, rebuild prepared data and geometry packs,
  re-pin changed sources (`scripts/repin-source-files.mjs`).
- Before / concept / after use the same viewpoint.
