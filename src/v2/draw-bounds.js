import {BackSide, FrontSide, Frustum, Matrix4, Vector3} from 'three';

// A draw can span disjoint rooms or repeated cabin instances. Keep bounds in index order so
// a changing band group or draw range can reuse the same tree after the GPU upload.
const records = new WeakMap();
const point = new Vector3();
const MAX_ORDINARY_INDICES = 300000;
const clipMargin = .025;

function makeRecord(g, merged) {
 const p = g.attributes.position, ix = g.index, count = ix?.count ?? p?.count;
 if (!p?.array || p.isInterleavedBufferAttribute || p.isGLBufferAttribute || (ix && !ix.array) ||
     g.morphAttributes.position || !count || count % 3 || (!merged && count > MAX_ORDINARY_INDICES)) return null;
 const stride = (merged ? 64 : 16) * 3;
 let leaves = 1;
 while (leaves * stride < count) leaves *= 2;
 // Six doubles per node. The index buffer and position array can both leave CPU memory.
 const boxes = new Float64Array(2 * leaves * 6);
 for (let i = 6; i < boxes.length; i += 6) {
  boxes[i] = boxes[i+1] = boxes[i+2] = Infinity;
  boxes[i+3] = boxes[i+4] = boxes[i+5] = -Infinity;
 }
 for (let i = 0; i < count; i++) {
  point.fromBufferAttribute(p, ix ? ix.getX(i) : i);
  if (!Number.isFinite(point.x + point.y + point.z)) return null;
  const j = 6 * (leaves + Math.floor(i / stride));
  boxes[j] = Math.min(boxes[j], point.x);
  boxes[j+1] = Math.min(boxes[j+1], point.y);
  boxes[j+2] = Math.min(boxes[j+2], point.z);
  boxes[j+3] = Math.max(boxes[j+3], point.x);
  boxes[j+4] = Math.max(boxes[j+4], point.y);
  boxes[j+5] = Math.max(boxes[j+5], point.z);
 }
 for (let i = leaves - 1; i > 0; i--) {
  for (let axis = 0; axis < 3; axis++) {
   const child = 12 * i + axis;
   boxes[6*i+axis] = Math.min(boxes[child], boxes[child+6]);
   boxes[6*i+axis+3] = Math.max(boxes[child+3], boxes[child+9]);
  }
 }
 return {boxes, leaves, stride, count};
}

function recordFor(g, merged = false) {
 const p = g.attributes.position, ix = g.index;
 let record = records.get(g);
 if (!record || record.p !== p || record.ix !== ix || record.pv !== p?.version || record.iv !== ix?.version) {
  record = {p, ix, pv:p?.version, iv:ix?.version, tree:makeRecord(g, merged)};
  records.set(g, record);
 }
 return record.tree;
}

// The deck merge owns these arrays and releases them on upload. Capture their static bounds first.
export function rememberMergedBounds(g) { recordFor(g, true); }

function intersectsBox(tree, frustum, node) {
 const j = node * 6, b = tree.boxes;
 if (b[j] === Infinity) return false;
 for (const plane of frustum.planes) {
  const {x, y, z} = plane.normal;
  const support = x*b[j+(x>0?3:0)] + y*b[j+(y>0?4:1)] + z*b[j+(z>0?5:2)];
  if (support + plane.constant < -clipMargin) return false;
 }
 return true;
}

function firstSurvivingLeaf(tree, frustum, start, end, node, lo, span) {
 if (lo >= end || lo + span <= start || !intersectsBox(tree, frustum, node)) return 0;
 if (node >= tree.leaves) return node;
 const half = span / 2;
 return firstSurvivingLeaf(tree, frustum, start, end, node*2, lo, half) ||
        firstSurvivingLeaf(tree, frustum, start, end, node*2+1, lo+half, half);
}

export function createDrawBoundsTest() {
 const vp = new Matrix4(), projection = new Matrix4(), matrix = new Matrix4(), instance = new Matrix4();
 const vertexA = new Vector3(), vertexB = new Vector3(), vertexC = new Vector3();
 const ab = new Vector3(), normal = new Vector3(), eye = new Vector3(), inverse = new Matrix4();
 const frustum = new Frustum(), lastVisible = new WeakMap();
 // These materials crossed the view in the deck survey even though all their triangles
 // were individually clipped or back-facing. An exact scan is bounded to small draws.
 const triangleMaterials = new Set(['P4_atrium_glass', 'P6_tower_architecture', 'Lift_door', 'Lift_door_blade', 'Lounge_additive_glow']);
 function trianglesOutside(camera, g, object, material, start, end) {
  const p = g.attributes.position, ix = g.index;
  if (!triangleMaterials.has(material.name) || end-start > 1536 || (end-start)%3 || !p.array || (ix && !ix.array)) return false;
  const pe = camera.projectionMatrix.elements;
  const sided = (material.side === FrontSide || material.side === BackSide) &&
     !pe[1] && !pe[4] && pe[0]*pe[5]>0 && pe[11]===-1 && !pe[3] && !pe[7] && !pe[12] && !pe[13] && !pe[15] &&
     camera.matrixWorld.determinant()>0 && Math.abs(object.matrixWorld.determinant())>1e-12;
  if (sided) eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse.copy(object.matrixWorld).invert());
  for (let i=start; i<end; i+=3) {
   vertexA.fromBufferAttribute(p,ix?ix.getX(i):i);
   vertexB.fromBufferAttribute(p,ix?ix.getX(i+1):i+1);
   vertexC.fromBufferAttribute(p,ix?ix.getX(i+2):i+2);
   let clipped=false;
   for (const plane of frustum.planes) {
    if (plane.distanceToPoint(vertexA)<-clipMargin && plane.distanceToPoint(vertexB)<-clipMargin && plane.distanceToPoint(vertexC)<-clipMargin) { clipped=true; break; }
   }
   if (clipped) continue;
   if (sided) {
    normal.crossVectors(ab.subVectors(vertexB,vertexA),vertexC.sub(vertexA));
    if (normal.lengthSq()>1e-16) {
     normal.normalize();
     const facing=normal.dot(eye)-normal.dot(vertexA);
     if ((material.side===FrontSide ? facing : -facing)<-clipMargin) continue;
    }
   }
   return false;
  }
  return true;
 }
 function misses(camera, world, tree, start, end, hint) {
  projection.multiplyMatrices(vp, world);
  frustum.setFromProjectionMatrix(projection, camera.coordinateSystem, camera.reversedDepth);
  if (tree.leaves === 1) return !intersectsBox(tree, frustum, 1);
  // A surviving leaf also intersects every ancestor. Recheck the leaf against the
  // current planes and index range before using it to avoid traversing the tree.
  const leaf = hint?.leaf;
  if (leaf && hint.leafTree === tree) {
   const lo = (leaf - tree.leaves) * tree.stride;
   if (lo < end && lo + tree.stride > start && intersectsBox(tree, frustum, leaf)) return false;
  }
  const found = firstSurvivingLeaf(tree, frustum, start, end, 1, 0, tree.leaves * tree.stride);
  if (found && hint) { hint.leaf = found; hint.leafTree = tree; }
  return !found;
 }
 return (camera, g, object, group, material = object.material, drawHistory) => {
  if (object.isInstancedMesh && (object.count > 256 || object.morphTexture)) return false;
  const tree = recordFor(g);
  if (!tree) return false;
  const start = Math.max(g.drawRange.start, group?.start ?? 0);
  const end = Math.min(tree.count, g.drawRange.start + g.drawRange.count, group ? group.start + group.count : Infinity);
  // Leaves are made of complete triangles from offset zero. An unaligned group changes the triangles.
  if (!Number.isSafeInteger(start) || start < 0 || start % 3 || !Number.isSafeInteger(end) || end <= start) return false;
  vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  if (!object.isInstancedMesh) return misses(camera, object.matrixWorld, tree, start, end, drawHistory) || trianglesOutside(camera, g, object, material, start, end);
  // Test the last surviving slot first. Slot packing can change each frame, so always read
  // the current instance matrix even when the camera and the winning slot are unchanged.
  const count = object.count, first = lastVisible.get(object) ?? 0;
  for (let j = 0; j < count; j++) {
   const slot = (first + j) % count;
   object.getMatrixAt(slot, instance);
   matrix.multiplyMatrices(object.matrixWorld, instance);
   if (!misses(camera, matrix, tree, start, end, drawHistory)) { lastVisible.set(object, slot); return false; }
  }
  return true;
 };
}
