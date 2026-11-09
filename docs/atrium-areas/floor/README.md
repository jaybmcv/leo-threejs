# S1 floor & boulevard: concept B, "inlaid promenade"

Jay's pick for the Deck 6 boulevard floor ([`docs/atrium-areas.md`](../../atrium-areas.md)).

![before / concept B / after at boulevard-aft](contact-boulevard-aft.jpg)

![before / after at boulevard-aft, boulevard-cross and hero](contact-before-after.jpg)

*Before and after are both local builds (base f8af5b3a, then this branch), captured with
`scripts/capture-atrium-areas.mjs`. Local builds render the atrium darker and warmer than the live site at the same
views, so compare them with each other rather than with `baseline-639f7393`.*

## What changed

- **Travertine paving.** Large-format pavers (1.3 x 0.65 m) in a running bond along the ship, with soft mottling and
  joints, painted as a texture (`paintTravertine`, `src/v2/atrium-daylight.js`) on the existing paving faces. The floor
  gets world-planar UVs on the paved faces; every other face samples a pure-white paver, so lawns, water, the food
  hall and the stage keep their colours. The arrival lobby and the park path take the same pavers. The old 1.5 m
  joint geometry is gone.
- **Inlays** (`addPromenadeInlays`, `src/v2/atrium-gardens.js`), thin sheets 12 mm over the floor, side by side:
  - a basalt band along both boulevard edges, under the avenue (|z| 4.875..6);
  - a basalt centre stripe edged in brass (1.95 m);
  - a brass compass rose every 20 m (11, x = -84..116).

  Paver rows meet the stripe and bands on whole joints.
- **Planters.** The same collidable boxes and positions, now a stone finish (`phase6-programme.js`, new `stone`
  colour in `phase4-mesh-kit.js`). Each also gets, visual only (`addPlanterTrims`): a paler stone coping, timber bench
  boards, soil, and leaves spilling over the long sides. This covers all 95 Deck 6 atrium planters: avenue, garden
  pockets and lake.
- **Avenue tree shade** is broader (3.4 m, drawn out 1.3x along the boulevard). All tree shade is a little stronger
  (opacity 0.5).

Unchanged:
- the 9.8 m clear width, the gap in front of every stall, and the cross routes at x=-79 and x=2;
- the bridge, and the lake side (no planters added there);
- light and tint.

## Cost and safety

| View | Draws before -> after | Triangles before -> after |
| --- | --- | --- |
| boulevard-aft | 695 -> 695 | 10.81M -> 10.82M |
| boulevard-cross | 502 -> 502 | 10.71M -> 10.72M |
| hero | 558 -> 558 | 10.76M -> 10.77M |

Draws and triangles are the main pass, from the walk's own `?fps=1` readout ([`stats-before.json`](stats-before.json),
[`stats-after.json`](stats-after.json)), which rounds triangles to 0.01M. The exact change is in the one garden draw:

| Change | Triangles |
| --- | --- |
| Paving joints removed | -7,924 |
| Inlays added | +3,938 |
| Planter trims added (95 planters) | +12,920 |
| **Net** | **+8,934** |

The paving texture is 1024 x 512, with mipmaps. Distant copies stay Basic: the floor keeps its map, and the garden mesh
keeps its vertex colours. Low-memory phones drop the garden decor from the distant copy, as before.

- **Floor positions are byte-identical before and after**, so the floor colliders are unchanged.
- **The atrium PVS key is identical** (`4.1485ebc6….af4fce1a….6afd3900…` in both public builds). No re-bake is
  needed.
- **Planter colliders** keep their size and place; only the material name changes.
