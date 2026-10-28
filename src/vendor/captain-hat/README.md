# Captain hat — avatar integration handoff

Approved visual direction: revision 6, 2026-10-22. This is the latest cat-face refinement with the shallow badge retained. Do not replace it with an earlier rounded crown or deeper logo.

Leo revision, 2026-10-28 (tester report #144): the crown's low edge on the hat's left side (-X, `CROWN_SHAPE.lowTuck` in `CrownSurface.js`) is raised from .40 to .10, so it no longer hangs below the band. Nothing else in the design changed (see `asset-manifest.json`, `leoRevision`).

## Files to give the integrating agent

- `src/CaptainsHat.js`, `src/CrownSurface.js`, `src/CatHelmetBadge.js`: editable native Three.js geometry. Copy all three together; the factory has relative imports.
- `src/attachCaptainsHat.js`: optional head-parent attachment helper.
- `captains-hat.glb`: equivalent static asset if the avatar pipeline prefers GLB.
- `preview.png`: actual viewer screenshot of this revision.
- `asset-manifest.json`: source/GLB checksums and native/reimport inventory.
- `licenses/three.txt`: Three.js dependency notice. No new license to the supplied design is asserted.

The native factory requires Three.js and its official addon imports. Tested with Three.js 0.186.0. Reuse the avatar project's Three.js installation; do not add a second runtime copy. If its version differs, check compatibility with BufferGeometryUtils and TessellateModifier. No image textures, external models, DOM or rendering loop are required by the factory. Use the avatar scene's existing renderer and lighting.

## Mount the native geometry

```js
import { attachCaptainsHat } from './src/attachCaptainsHat.js';

// Resolve the real head bone/Object3D using your avatar's own rig API.
// The values below are EXAMPLES assuming head-parent units are metres.
const accessory = attachCaptainsHat(headBone, {
  openingWidth: 0.20,
  position: [0, 0.12, 0],
  rotation: [0, 0, 0], // XYZ Euler radians; adapt to the avatar's axes
});

// Tune these in the live avatar view:
accessory.mount.position.set(x, y, z);
// When unequipping permanently:
// accessory.dispose();
```

Determine the actual head transform, units and axes before selecting values. Positions and openingWidth are in the selected head parent's LOCAL coordinates; inherited skeleton/root scale also affects world size. Do not assume the example offsets or a specific bone name fit the avatar. Parent to the head so the hat follows animation; do not place it independently at a world-space head position.

For direct use without the helper:

```js
import { createCaptainsHat } from './src/CaptainsHat.js';
const hat = createCaptainsHat();
headBone.add(hat);
hat.scale.setScalar(desiredOpeningWidthInHeadLocalUnits / 2.76);
hat.position.set(localX, localY, localZ);
```

## Coordinate and fit contract

- +Y is up, +Z is the visor/front.
- Origin: centre of the lower headband opening, at the bottom of the band.
- Opening: nominal 2.76 wide by 1.94 deep, in source scene units.
- Source overall bounds: min [-1.709199, -0.180000, -1.188180], max [1.724618, 1.429122, 1.889140]. The brim extends below the opening origin.
- Prefer uniform scale. Use a separate mount transform for avatar orientation/offsets.
- Preserve the current badge geometry and its 0.23 depth compression; current maximum sampled crown projection is 0.059898 source units.
- `createCaptainsHat({optimized:false})` retains named parts for edits. Default merges into ten material groups. `hat.dispose()` releases owned geometry/materials.

The alternative GLB has the same axes/origin and can be parented via a mount group after GLTFLoader loads its scene. The native helper constructs geometry; it does not load the GLB.

## Verify in the target avatar

Check front, both sides and back; avoid intersection with skull, hair and ears. Check idle, look-up/down, head turns and any equipment/visibility toggles. Verify the logo stays shallow, the brim faces forward, and the hat follows the head without drifting. Use the avatar system's normal equipment path and cleanup lifecycle.

No automatic avatar fitting, skinning, rig or collider is included. This is a rigid accessory intended for head parenting. The optional helper's transform/cleanup behavior can be checked independently; the actual avatar is not supplied or tested here.

Default: 198,982 triangles, ten material groups. Low detail: 157,222; high: 244,982. The lower detail setting changes crown sampling; do not treat it as a game-budget optimization. Profile in the target avatar runtime and simplify further if needed while keeping the approved silhouette/logo.

## Verified asset identity

GLB SHA256: `ecd9af08e5f668c3551dd33143f87299436fc3841b88d28dc0c14ade2a6b6be8` (2026-10-28 revision; the 2026-10-22 handoff GLB was `f96178fce8b3ba819a8dc6ba8ce53a9476d78e8aef1be5ad683fc33ce9e3262f`).

Combined model-source SHA256: `04e8b90611d26758bd6200ab2b6988a1e56eb28b78331302b86b63d9c38332f0` (2026-10-28; the handoff value `df4f294f323f14fcc480ad23ead5b29026146356c90e94c9eacc9c73f5005562` is kept in the manifest).

The supplied geometry/GLB was exported, reimported and inspected in the local viewer; glTF validation has zero errors/warnings/infos. Integration into the destination avatar remains the integrating agent's work.

## In Leo

Leo loads `captains-hat.glb` (the GLB above, unchanged; published by `scripts/walk-page.mjs` as `walk-hat.<hash>.glb`) rather than building the native geometry, which takes about 1.7 s of solid CPU in a browser. The native source files stay here for edits; both build the same 198,982 triangles and bounds on Leo's Three.js 0.185.1. Integration: `src/walk/hat.js`.

- **Who wears it:** testers, meaning anyone whose browser holds a tester invite (`?invite=`, the code that turns on tester feedback). Others aboard see it through Leo live: the page says it is a tester, and the server passes that on with the visitor's name. It is taken on the page's word; it is a cosmetic hat.
- **Mount:** parented to Cosmo's head bone `spine.006` (+Y up, +Z forward like the hat; near-metre local units). `FIT` in `hat.js`: band opening 0.53 wide, its bottom 0.335 above the bone and 6 cm back, tipped back 8 degrees (-0.14 rad about X). Uniform scale; the crown and the shallow badge (0.23 relief compression) are untouched.
- **Verified (2026-10-22)** by testing every head vertex of the skinned Cosmo against the hat's meshes:
  - No head vertex pokes through the crown or the band, at least 12 mm clear.
  - The hat follows the head with zero drift, through idle, walking, sprinting, turning, jumping, crouch, slide, prone, crawl, sitting and all ten emotes, with head movements up to 68 degrees.
  - Both ears sit inside the crown.
- **Two adjustments for the hat:**
  - On all fours, a hat wearer's tail base tips down 32 degrees (`avatar.js`); otherwise its tip rises through the back of the crown.
  - Lying down (in bed, or playing dead), the hat comes off. On his back it would sink 15 cm into the floor or the pillow.
- **Cost:** one hat adds 10 draw calls and about 199k triangles. Other visitors' hats aren't drawn beyond 35 m (`remotes.js`).
