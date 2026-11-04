# Deck 17 blossom garden expansion

The bounded garden expansion retains the original tree, red bridge, bench,
waterfall, sound, layered planting and eight butterflies. Two smaller cherry
trees occupy the added eastern bed; the koi swim throughout the enlarged pond.

The planting bed grows from 9 x 9 m to 12 x 9 m. The pond grows from 3.3 x 3.3 m
to 3.3 x 6.3 m (10.89 to 20.79 square metres). The combined footprint is
117.9 square metres inside one 12 x 12 m allocation, excluding stone trim.
The original bridge landing and bench retain their locations and dimensions.

Coordinates in the inherited commons fitting frame:

- Bed: X 136.5–148.5, Z 27.5–36.5; soil Y 25.01, deck Y 24.3.
- Pond: X 136.5–139.8, Z 33.2–39.5; water Y 24.58.
- Added trees: X 146.3, Z 29.8 and 34.2, at half the original tree scale.

The selected commons-10 frame translates these by X −26.5 and Z +16.
The allocation is therefore X 110–122, Z 43.5–55.5 in the v2 ship.
The actual north pond stones leave over 1.75 m before the café counter's
front edge. The bed and trim leave over 4 m beside the lower gallery stairs.
The shared kitchen stays west of the pond, and the original bridge and bench
approach stays clear. Room boundaries, doors, stairs and galleries do not move.
The older plan's 9 m blossom reservation records the pre-expansion assembly;
the dimensions above describe the additional allocation within the same room.

The two added trees total 7,128 triangles nearby, in four draws, and 240 triangles
in twelve draws at 24 m or more. The fallback favors low geometry cost over draw
count. They reuse the garden's existing materials. Falling petals remain capped
at 160, butterflies at eight and koi at seven. Animation still stops beyond
45 m; the new trees add two simple trunk collision cylinders. No dependencies,
reference textures or logos are added.

Both planter shaping and live garden geometry change in blossom.js and every
authoring/prepared/public copy. Each mode constructs this seeded garden's geometry
directly. Its new tree primitives and changed pond/wall merges cannot rely on the
exact template keys saved by a previous prepared artifact. Shared replay remains
strict for other features. The prepared ship must be regenerated before
public packaging; copying JavaScript alone leaves the old planter/collision.
The ownership inventory also corrects the blossom owner to commons-10 and
registers the existing conservatory and Arrival lighting modules, whose missing
rules prevented inventory regeneration. No Arrival lighting behavior changes.

Validation: `node scripts/check-blossom-expansion.mjs` checks all four factories,
authoring/public render and collision parity with an empty recorded-template map, original tree/bridge regression
signatures, whole tree bounds, LOD switching, extended pond support/rim and koi
containment. JavaScript syntax and a public-entry bundle smoke pass. The smoke
externalizes build-injected walk-partitions/walk-changes and node:fs; the actual
public build replaces those through its existing plugins.

The active v2 ownership checker was run with only its retired v1 subprocess
omitted because this sandbox blocks Node child-process spawning. The original
ownership command and esbuild-based conservatory checker cannot complete here.
Browser access is unavailable. Full geometry/public builds, actual room visual
review, performance measurement and the walk flood remain for combined validation.
