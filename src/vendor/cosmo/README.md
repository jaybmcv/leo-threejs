# Cosmo Three.js model

Install three (tested with 0.180.0). Keep DLCat.js and imageCache.js together.

import { createDLCat } from './DLCat.js';
const cosmo = await createDLCat({ height: 1.7 });
scene.add(cosmo.root);
// On removal: cosmo.dispose();

Includes the current model, rig, embedded textures and its source clips.
Voyager's Reach's custom walk/run/jump retargeting, procedural poses, movement controller and camera are separate game systems and are not included.
