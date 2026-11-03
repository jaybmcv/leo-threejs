# Selected interior design pass

User selection, 2026-11-02: 1C Orbital Twilight, 2C Reflection Terraces,
3B Retro Voyage, 4A Flowing Ribs, 5B Layered Conservatory.

Work branch: `design/leo-selected-interiors-20261102`, based on main
`db2882a92aaa1cbdc0cdb54114328b02b751dfe4`.

Hydro-Nip Lounge and exterior artwork are explicitly excluded. Avoid shared
material mutations and restore any localized lighting when leaving its area.
Preserve established hull, deck plan, clear circulation and usable seating.
No deployment, merge or rebase until the local pass is ready for review.

Working scope:
- Arrival: localized twilight atmosphere and cream/walnut/orange/brass finishes.
- Deck 6 atrium: waterside curved seating, planting and flowing architectural ribs.
- Atrium-facing cabin windows: rounded ivory reveals with slim brass inlays;
  entry doors and space-facing windows retain their original geometry.
- Blossom garden: layered grouped foliage, retaining blossom tree and red bridge.

Concept boards are visual direction, not exact engineering specifications.
All geometry changes need actual-world clearance and interaction checks.
Timebox started 21:16 UTC Nov 2; hard stop 01:16 UTC Nov 3 (20:16 EST Nov 2).
The final report must distinguish source changes, verified geometry, rendered
evidence, public-build results, and remaining work.

## Implementation and checks

The arrival finish is applied after room-frame resolution and only touches the
arrival room and its shell. Existing material side flags are preserved. Local
lights turn off on departure and the shared lighting values restore immediately;
the arrival controller reapplies its active state after the other room controllers
so their outgoing fades cannot overwrite the arrival transition.

The four lake-edge terraces add twenty usable seats, an open curved portal at
each bay, and a planted tree island. Their walking surfaces sit above the existing
shallow water. The original bridge, central boulevard, and perimeter routes stay
clear. Rounded cabin window surrounds use shared geometry and instanced distant
facades, with the same visibility rules as the existing atrium architecture.

The garden is limited to neighborhood 10. The blossom tree, red bridge, their
randomized details, and existing collision surfaces retain the baseline geometry.
The new grouped planting and six hanging planters use eight draw calls and 36,632
triangles, replacing 46,844 planting triangles. This is a geometry count, not a
measured frame-rate improvement.

Run `npm run check:design` for the focused checks. It checks material isolation,
lighting transitions, terrace geometry and routes, window sightlines, unchanged
garden landmarks/colliders, and authoring/public replay parity. If the v2 layout
has been built, it also checks real room frames and full-layout placement.

Isolated asset previews use the same implementation factories. Their simplified
surroundings do not establish integrated ship rendering, startup, or performance.
Those need the complete v2 build and an in-game review before acceptance.

## Integration notes

The room's hull extension is finished before cross-room batching, using the
exact `d02-arrival-1` owner. This avoids changing shared lining materials.
The lighting volume follows the selected room polygon and height, including
its window-side extension, rather than the smaller original furniture plan.

Distant atrium window frames use the same front contour with 80 triangles per
window, versus 200 for the nearby extruded version. Across 2,815 atrium windows,
the facade maximum is 225,200 triangles in two instanced draws. The nearby
geometry remains unchanged. The low-memory distant fallback omits only the two
decorative frame proxies; it retains structural geometry. These are geometry
savings, not a measured frame-rate claim.

Review the local v2 public build with `LEO_LAYOUT=2 node scripts/serve.mjs 4192`.
The Go to menu offers Arrival hall, Open atrium on Deck 6, and Blossom garden on
Deck 17. Check the arrival's outer window-side strip as well as its central
seating, and try sitting on a terrace bench. Hydro-Nip Lounge is a useful
unchanged-room check after leaving the arrival lighting volume.

Rebase attention: this work touches all four walk entry variants and both
normal/authoring geometry variants. Preserve the arrival update before other
room controllers and its final apply afterward. Preserve the pre-batch exact
owner filter when resolving hull-prototype conflicts. Do not overwrite
concurrent performance work or the independently updated full-ship inspector.

The main iteration bottleneck is shared build dependencies. `--room` allows
reuse but does not constrain layout/exterior generation to that room. Both
producers import `hull-prototypes.js`, which is also part of the global geometry
cache revision; ceiling fitting fingerprints all source files. A room-material
edit therefore invalidates broad caches and processes all 2,420 hull interfaces.
The first complete prepared-world stage took about 41 minutes. A future build
improvement should separate geometry from appearance and narrow dependency keys,
while retaining strict final artifact freshness checks. That refactor is outside
this visual-design pass.

The repeat export preserves exterior styling but is not byte-identical to the
first integrated build. A decoded comparison found all 66 material definitions,
transforms, color and UV streams unchanged. Local tessellation differences cover
less than 0.0027% of the assessed web surface at the 1 mm sample threshold;
the phone surface's largest sampled residual is 15 micrometres. This is an export
stability limitation, not an exterior-art change. Do not claim exact exterior
geometry identity from file hashes.

## Raw model texture export repair

The actual exported Arrival extension has exclusive room ownership, correct
slate/porcelain materials, and exact world-XZ floor UVs. A Node export bug was
found and fixed: `@napi-rs/canvas` exposes a `.data()` function which Three's image
exporter mistakes for pixel data. The Arrival-only export adapter hides that
method from image detection and stamps affected export roots to invalidate older
blank exports. Its regression test reproduces the failure, then verifies every
RGBA pixel after export and pruning, plus isolation and idempotence.

The two already-generated raw models were repaired with exact factory PNGs.
Every prior binary byte, accessor, mesh, node, transform and unrelated material
was preserved; only the three Arrival maps and their white color factors were
restored. Their scoped-model hashes and raw source provenance were refreshed.
The actual extension texture/UV/ownership checks now pass. Exterior files,
layout, walk plan and browser-prepared source identity remained unchanged.

## Final validation record

Source implementation: `abbdda7` (including the Arrival Node export adapter).
The final full build completed successfully at approximately 00:48 UTC Nov 3,
after about 92 minutes: 54 minutes for raw/layout work and 38 minutes preparing
the browser world. The raw export was repaired as described above during this
run; a second cold full build after the adapter commit was not performed.

Final prepared artifact SHA-256:
`9273a5f6b57b2f3f74e63128a002da2ff1ec8f38b3a4b3271236e936d0babc6f`.
The public build and byte gates passed: 215,318,463 total public bytes,
34,681,537 bytes below the existing limit. The focused design suite and Phase 6
contracts also passed against the regenerated layout.

An additional check restores the final serialized collision BVHs and actual
rest spots, then walks a 0.35 m grid with capsule and edge-midpoint probes.
All four terrace entries are reachable from the west Deck 6 promenade. All
twenty seats have support within 2.5 cm and a collision-clear reachable front
approach accepted by the actual rest picker (9,051 reachable grid points).
A seat was also exercised through approach, sit, stand and departure in the
first integrated browser build.

`LEO_LAYOUT=2 npm run check:walk` completed with PASS at 01:00 UTC Nov 3
(601 seconds). It visited 5,713,073 positions, found all 34,940 declared solid
seats/beds usable, reported zero openings to space, and returned no problems.
The report references the exact final prepared artifact above. The public build
and navigation command chain exited 0.

The final browser walkthrough covered Arrival (including the outer extension),
the Deck 6 terraces, the Deck 17 conservatory and the excluded Hydro-Nip Lounge.
No console errors or warnings were recorded. The outer Arrival strip retains
the room finishes and twilight lighting. These observations do not establish
performance on older laptops or phones; no FPS claim is made.

### Remaining visual polish

Arrival shows floor shimmer/zigzags at shallow viewing angles. Raw inspection
found 56 legacy plank strips (672 triangles) topping at local y=.003 beneath
the broad floor at approximately y=.006. This 3 mm separation is the strongest
suspect; no second broad hall floor was found. Retiring the exact Arrival
legacy plank-seam mesh is a candidate follow-up, followed by grazing-angle
review. Also inspect the thin legacy outer-extension floor overlay. No
unverified geometry change was added after the final build; another complete
rebuild would exceed this session's four-hour limit.

## Follow-up: Deck 6 gallery visibility

User reported upper balconies appearing only while jumping or on Deck 7.
The grounded atrium shortcut returned a fixed +/-4 m range before camera rays
ran; the v2 render-band wrapper independently applied the same cap. A jump
more than 1.6 m from the nearest deck escaped that restriction. A regression
reproduced decks 6-7 grounded versus decks 6-12 jumping for the same upward view.

The four walk entries now update atrium fog/proxies and use the existing cached,
150 ms camera-ray span. Both render-band wrappers pass that span through without
the extra cap. Nearby cabin limits, room culling, geometry and collisions are
unchanged. This draws more visible detail at ground level; physical-device
performance remains unmeasured. The normal build must finish before replacing
the prior public preview. The runtime preflight visibly shows upper gallery
rails while standing on Deck 6.

`node scripts/check-atrium-height-visibility.mjs` passes 16 cases, covering
ground, jump, landing, Deck 7, upward/downward views, narrow spans and non-atrium
positions. It is also included in `npm run check:design` when the layout exists.
