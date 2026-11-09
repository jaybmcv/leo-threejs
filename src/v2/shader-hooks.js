import {Material} from 'three';

// Shader hooks (material.onBeforeCompile) that only change shading mark themselves keepsGeometry (corner-shade.js,
// film-look.js), when whatever they wrap keeps it too. Anything else may move vertices (the aquarium's fish, the lounge's
// swings) or discard fragments, so the owner bake (scripts/walk-owner-bake.scene.js) neither hides it nor counts it as a
// wall.
export const keepsGeometry=hook=>!hook||hook===Material.prototype.onBeforeCompile||hook.keepsGeometry===true;
// A material drawn where its geometry says: no hook of its own (it inherits three's empty one) or one marked as keeping
// geometry, no shader of its own, no displacement. Inherited, not identical: the owner bake's page bundles its own
// three, so the walk's materials inherit another copy's empty hook, and comparing it with this copy's turned away every
// material the corner shading had not wrapped.
const ownHook=m=>Object.prototype.hasOwnProperty.call(m,'onBeforeCompile');
export const geometryKept=m=>!!m&&!m.isShaderMaterial&&!m.isRawShaderMaterial&&!m.displacementMap&&(!ownHook(m)||keepsGeometry(m.onBeforeCompile));
