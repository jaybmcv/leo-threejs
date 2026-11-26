import {BatchedMesh, Matrix4} from 'three';

// The cabins' corridor frost (cabin-privacy.js) is one instanced mesh per cabin type, corridor side, deck and door leaf:
// 15 to 24 draws in an upper deck's view, all of one material. Here each deck's frost (the meshes cabin-privacy.js
// shows by height, userData.y) draws as one batch: one multi-draw where it drew a mesh at a time.
// - The frost meshes keep their instances. cabin-privacy.js writes them (a cabin cleared, a door sliding open), and each
//   frame the batches copy those of a mesh whose instances changed.
// - The meshes move to a layer the walking camera does not draw. The atrium's room views join this deck's frost to their
//   own layer (atrium-room-views.js), so they still draw it; the batches stay out of those views.
// - A batch sits beside its meshes under the frost's root, with their deck's height, so cabin-privacy.js shows and hides
//   it with them.
// - Its instances are culled against the view one by one (three's BatchedMesh), as each mesh was as a whole, in the
//   meshes' order (not sorted: the meshes never were).
// - A camera that also draws the meshes' own layer (a photo that turns every layer on) skips the batch, so the frost is
//   not drawn twice.
// - The atrium's reached cabins copy these meshes (atrium-rooms.js), with the layers they had (userData.mainLayers).
// - It has its own copy of the frost material: three would rebuild the material's program each time it went from the
//   batch to an instanced copy and back.
// Only with WEBGL_multi_draw (without it a batch draws once for each instance). Not on phones, nor in the owner bake's
// page (main.public.js). `?privacybatch=0` leaves the meshes as they were.
export const PRIVACY_SOURCE_LAYER = 29;

export function batchPrivacy(root, {multiDraw = true} = {}) {
 if (!multiDraw) return null;
 const decks = new Map();
 for (const o of root.children) {
  if (!o.isInstancedMesh || !o.userData.privacy) continue;
  o.updateMatrix();
  // Joined only when the batch can stand where the mesh stands (the root's own space) and draw its geometry as it is.
  if (!o.matrix.equals(IDENTITY) || o.geometry.morphAttributes.position || o.count < 1) continue;
  const g = o.geometry, key = [o.userData.y, o.material.uuid, o.renderOrder, !!g.index, Object.keys(g.attributes).sort().map(n => n + ':' + g.attributes[n].itemSize + ':' + g.attributes[n].normalized + ':' + g.attributes[n].array.constructor.name).join(','), g.index?.array.constructor.name].join('|');
  (decks.get(key) || decks.set(key, []).get(key)).push(o);
 }
 const batches = [], m = new Matrix4();
 for (const list of decks.values()) {
  if (list.length < 2) continue;
  let vertices = 0, indices = 0, instances = 0;
  for (const o of list) { vertices += o.geometry.attributes.position.count; indices += o.geometry.index?.count ?? 0; instances += o.count; }
  const first = list[0], batch = new BatchedMesh(instances, vertices, indices || undefined, first.material.clone());
  batch.name = 'V2_cabin_frost_batch';
  batch.sortObjects = false;
  // Its own bounds would be measured once and never again as the instances change; each instance is culled instead.
  batch.frustumCulled = false;
  const prepare = batch.onBeforeRender;
  batch.onBeforeRender = function(renderer, scene, camera) {
   if (camera.layers.isEnabled(PRIVACY_SOURCE_LAYER)) { this._multiDrawCount = 0; return; }
   return prepare.apply(this, arguments);
  };
  batch.userData = {noCollide: true, privacyBatch: true, y: first.userData.y};
  batch.renderOrder = first.renderOrder;
  batch.visible = first.visible;
  const rows = [];
  for (const o of list) {
   const geometry = batch.addGeometry(o.geometry), ids = [];
   for (let i = 0; i < o.count; i++) { const id = batch.addInstance(geometry); o.getMatrixAt(i, m); batch.setMatrixAt(id, m); ids.push(id); }
   rows.push({o, ids, version: o.instanceMatrix.version});
   o.userData.mainLayers = o.layers.mask; o.layers.disable(0); o.layers.enable(PRIVACY_SOURCE_LAYER);
  }
  root.add(batch);
  batches.push({batch, rows});
 }
 if (!batches.length) return null;
 return {
  batches,
  /** Draws the shown batches stand in for, beyond their own (for quad-facing's dense test). */
  get replaced() { let n = 0; for (const {batch, rows} of batches) if (batch.visible) n += rows.length - 1; return n; },
  /** After cabin-privacy.js's update: the instances of every shown batch's meshes that it changed. */
  update() {
   for (const {batch, rows} of batches) {
    if (!batch.visible) continue;
    for (const row of rows) {
     const {o, ids} = row;
     if (o.instanceMatrix.version === row.version) continue;
     row.version = o.instanceMatrix.version;
     for (let i = 0; i < ids.length; i++) { o.getMatrixAt(i, m); batch.setMatrixAt(ids[i], m); }
    }
   }
  },
 };
}
const IDENTITY = new Matrix4();
