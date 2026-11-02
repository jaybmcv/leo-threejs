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
