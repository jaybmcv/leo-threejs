import {mergeMeshes} from './merge-by-material.js';

// The room builder supplies fixed siblings with identical shading apart from their diffuse color.
export function joinStaticTints(group, materials) {
 const sources = group.children.filter(mesh => materials.includes(mesh.material));
 if (sources.length < 2) return;
 const first = sources[0];
 if (!sources.every(mesh => mesh.isMesh && !mesh.isInstancedMesh && !mesh.isSkinnedMesh &&
  !mesh.isBatchedMesh && !mesh.children.length && mesh.visible && !mesh.geometry.attributes.color &&
  !Object.keys(mesh.geometry.morphAttributes).length && mesh.renderOrder === first.renderOrder &&
  mesh.layers.mask === first.layers.mask && mesh.castShadow === first.castShadow &&
  mesh.receiveShadow === first.receiveShadow && mesh.frustumCulled === first.frustumCulled)) return;
 const merged = mergeMeshes(sources, sources.some(mesh => mesh.material !== first.material));
 if (!merged) return;
 merged.userData = {...first.userData};
 group.add(merged);
 group.remove(...sources);
}
