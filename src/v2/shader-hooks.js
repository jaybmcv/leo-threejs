import {Material} from 'three';

// Shader hooks (material.onBeforeCompile) that only change shading mark themselves keepsGeometry (corner-shade.js,
// film-look.js), when whatever they wrap keeps it too. Anything else may move vertices (the aquarium's fish, the lounge's
// swings) or discard fragments, so the owner bake (scripts/walk-owner-bake.scene.js) neither hides it nor counts it as a
// wall.
export const keepsGeometry=hook=>!hook||hook===Material.prototype.onBeforeCompile||hook.keepsGeometry===true;
// A material drawn where its geometry says: the stock hook or one marked as keeping geometry, no shader of its own, no
// displacement.
export const geometryKept=m=>!!m&&!m.isShaderMaterial&&!m.isRawShaderMaterial&&!m.displacementMap&&keepsGeometry(m.onBeforeCompile);
