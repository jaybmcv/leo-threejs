import {Material} from 'three';

// Shader hooks (material.onBeforeCompile) that only change shading mark themselves keepsGeometry (corner-shade.js,
// film-look.js), when whatever they wrap keeps it too. Anything else may move vertices (the aquarium's fish, the lounge's
// swings) or discard fragments, so the owner bake (scripts/walk-owner-bake.scene.js) neither hides it nor counts it as a
// wall.
// `empty`: three's own empty hook, from the copy of three that made the material. A page that bundles its own three (the
// owner bake's) passes the walk's: its materials inherit that copy's, which no other copy's equals.
export const keepsGeometry=(hook,empty=Material.prototype.onBeforeCompile)=>!hook||hook===empty||hook.keepsGeometry===true;
// A material drawn where its geometry says: three's empty hook or one marked as keeping geometry, no shader of its own, no
// displacement.
export const geometryKept=(m,empty)=>!!m&&!m.isShaderMaterial&&!m.isRawShaderMaterial&&!m.displacementMap&&keepsGeometry(m.onBeforeCompile,empty);
