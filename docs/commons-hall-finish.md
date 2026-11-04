# Deck 17 commons finish

The approved next step finishes the existing open commons without another wall
removal. The selected v2 layout is the measurement authority; the retired v1
hall rectangles are not used.

Dependencies recorded before implementation:

- Ten garden footprints span X -141 to 132 m, with their entry faces at Z +/-24 m.
  The paired gardens have 2 m gaps. Deck 17's finished floor is Y 24.30 m.
- The active promenades run at Z +/-21.55 m, stepping inward to +/-19.4 m
  near the aft core. The atrium, lift and stair openings come from the slab plan.
- Deck 18 is Y 28.30 m. Its openings determine where a ceiling may exist.
  The existing distribution lining has its underside at Y 27.94 m.
- The current commons-1 plan, galleries, aquarium, jaguar entry, lounge glass and
  vault remain authoritative for the related lounge changes. This pass places
  nothing inside any room footprint and adds no boundary. The separate glass
  boundary decision and upper gallery work remain independent.

Implementation uses the garden-bank bounds clipped to the current slab outline,
subtracting all Deck 17 rooms and slab holes. Ceiling coverage also subtracts
Deck 18's openings and clips to its outline. Finishes stop at the atrium and all
existing room boundaries, including the lounge's acrylic floor.

The matte floor top is Y 24.314 m, 6 mm above the existing corridor finish.
The ceiling lining underside is Y 27.84 m; warm emissive strips sit just below
it, at Y 27.805 m. Strips follow the actual promenade segments at up to 12 m
spacing and the inter-garden gaps at up to 10 m spacing. Every strip footprint
must fit completely beneath the new ceiling. They use the existing emissive
fixture approach, without adding dynamic lights.

All additions are visual finishes marked noCollide. Existing support, headroom,
walls, glass, stair routes, galleries and collision remain unchanged. The shared
producer is called by both normal and authoring v2 model builders; prepared and
public visitors receive its baked meshes through the normal geometry build.

Validation: source checks and isolated geometry probes run in this worktree.
Full geometry/public builds, whole-ship walk checks and browser screenshots run
in the separate validation copy; visual acceptance and deployment remain pending.
