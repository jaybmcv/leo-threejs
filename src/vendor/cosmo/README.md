# Cosmo Three.js model

Install three (tested with 0.180.0). Keep DLCat.js and imageCache.js together.

import { createDLCat } from './DLCat.js';
const cosmo = await createDLCat({ height: 1.7 });
scene.add(cosmo.root);
// On removal: cosmo.dispose();

Includes the current model, rig, embedded textures and its source clips.
Voyager's Reach's custom walk/run/jump retargeting, procedural poses, movement controller and camera are separate game systems and are not included.

Leo note: the embedded textures were re-encoded to 1024² WebP and the geometry literals shortened to their exact
float32 values by scripts/shrink-cosmo-textures.py (about 5 MB to 2 MB, 1.1 MB gzipped; the geometry is bit-identical).
