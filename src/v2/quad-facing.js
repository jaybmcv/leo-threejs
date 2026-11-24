import {createDrawBoundsTest} from './draw-bounds.js';
import {createFloorOcclusion} from './floor-occlusion.js';
import {FrontSide, BackSide, Material, Matrix4, Object3D, Vector3} from 'three';
import {geometryKept} from './shader-hooks.js';

// Each triangle of the submitted range must independently face away
// from the eye. Testing in object space follows Three's winding change for mirrored meshes.
export function createQuadFacingTest() {
 const geometries = new WeakMap(), transforms = new WeakMap();
 const a = new Vector3(), b = new Vector3(), c = new Vector3(), eye = new Vector3();
 function planes(geometry, position, index, start, end) {
  let prior = geometries.get(geometry);
  if (!prior || prior.position !== position || prior.index !== index ||
      prior.positionVersion !== position.version || prior.indexVersion !== index?.version) {
   prior = {position, index, positionVersion:position.version, indexVersion:index?.version, ranges:new Map()};
   geometries.set(geometry, prior);
  }
  if (prior.ranges.size > 16) prior.ranges.clear();
  // The ordinary ungrouped quad is the common sparse-view path.
  if (start === 0 && end === 6 && 'quad' in prior) return prior.quad;
  const key = start * 2048 + (end - start);
  if (prior.ranges.has(key)) return prior.ranges.get(key);
  let faces = null;
  if (position.array && !position.isInterleavedBufferAttribute && (!index || index.array)) {
   faces = [];
   for (let i = start; i < end; i += 3) {
    const vertex = k => index ? index.getX(k) : k;
    a.fromBufferAttribute(position, vertex(i));
    b.fromBufferAttribute(position, vertex(i + 1));
    c.fromBufferAttribute(position, vertex(i + 2));
    const normal = b.sub(a).cross(c.sub(a)).clone();
    if (!(normal.lengthSq() > 1e-16)) { faces = null; break; }
    normal.normalize();
    faces.push({normal, offset: normal.dot(a)});
   }
  }
  if (start === 0 && end === 6) prior.quad = faces;
  else prior.ranges.set(key, faces);
  return faces;
 }
 return (camera, geometry, material, object, group) => {
  const p = geometry.attributes.position, ix = geometry.index;
  if (!p || !camera.isPerspectiveCamera || !object.isMesh || object.isInstancedMesh || object.isBatchedMesh ||
      object.isSkinnedMesh || geometry.morphAttributes.position || material.wireframe || !geometryKept(material) ||
      object.onBeforeRender !== Object3D.prototype.onBeforeRender || object.onAfterRender !== Object3D.prototype.onAfterRender ||
      (material.side !== FrontSide && material.side !== BackSide)) return false;
  const start = Math.max(geometry.drawRange.start, group?.start ?? 0);
  const end = Math.min(ix?.count ?? p.count, geometry.drawRange.start + geometry.drawRange.count, group ? group.start + group.count : Infinity);
  if (start % 3 || (end - start) % 3 || end <= start || end - start > 1536) return false;
  const projection = camera.projectionMatrix.elements;
  if (projection[3] || projection[7] || projection[11] !== -1 || projection[15] || projection[12] || projection[13] ||
      projection[0] * projection[5] - projection[1] * projection[4] <= 0 || camera.matrixWorld.determinant() <= 0) return false;
  const faces = planes(geometry, p, ix, start, end);
  if (!faces) return false;
  let transform = transforms.get(object);
  if (!transform || !transform.matrix.equals(object.matrixWorld)) {
   const matrix = object.matrixWorld.clone();
   transform = {matrix, inverse: Math.abs(matrix.determinant()) > 1e-12 ? new Matrix4().copy(matrix).invert() : null};
   transforms.set(object, transform);
  }
  if (!transform.inverse) return false;
  eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(transform.inverse);
  const sign = material.side === FrontSide ? 1 : -1;
  return faces.every(({normal, offset}) => sign * (normal.dot(eye) - offset) < -.01);
 };
}

// The garden's raked gravel and four animated ripple rings are single-sided surfaces.
// Bound every triangle's plane in local coordinates. The interval can certify that
// all faces point away even when floating-point rotations give them slightly different normals.
export function createSurfaceFacingTest() {
 const cache = new WeakMap(), a = new Vector3(), b = new Vector3(), c = new Vector3();
 const inverse = new Matrix4(), instance = new Matrix4(), eye = new Vector3(), local = new Vector3();
 function bounds(g, p, ix) {
  const prior = cache.get(g);
  if (prior && prior.p === p && prior.ix === ix && prior.pv === p.version && prior.iv === ix?.version) return prior.planes;
  const count = ix?.count ?? p.count;
  let planes = null;
  if (p.array && !p.isInterleavedBufferAttribute && (!ix || ix.array) && count && count % 3 === 0) {
   const min = [Infinity,Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity,-Infinity];
   for (let i=0; i<count; i+=3) {
    a.fromBufferAttribute(p,ix ? ix.getX(i) : i);
    b.fromBufferAttribute(p,ix ? ix.getX(i+1) : i+1);
    c.fromBufferAttribute(p,ix ? ix.getX(i+2) : i+2);
    const n=b.sub(a).cross(c.sub(a));
    if (!(n.lengthSq()>1e-16)) {
     cache.set(g,{p,ix,pv:p.version,iv:ix?.version,planes:null});
     return null;
    }
    n.normalize();
    const values=[n.x,n.y,n.z,n.dot(a)];
    for (let k=0;k<4;k++) { min[k]=Math.min(min[k],values[k]); max[k]=Math.max(max[k],values[k]); }
   }
   planes={min,max};
  }
  cache.set(g,{p,ix,pv:p.version,iv:ix?.version,planes});
  return planes;
 }
 return (view,g,m,o,group) => {
  if (m.name !== 'Zen_gravel_grooves' && m.name !== 'Zen_water_ripples') return false;
  if (m.side!==FrontSide || !view.isPerspectiveCamera || m.onBeforeRender!==Material.prototype.onBeforeRender || !g.attributes.position) return false;
  const pe=view.projectionMatrix.elements;
  if (pe[3] || pe[7] || pe[11]!==-1 || pe[15] || pe[12] || pe[13] || pe[0]*pe[5]-pe[1]*pe[4]<=0 ||
      view.matrixWorld.determinant()<=0 || Math.abs(o.matrixWorld.determinant())<1e-12 || Math.max(g.drawRange.start,group?.start??0)%3) return false;
  const plane=bounds(g,g.attributes.position,g.index);
  if (!plane) return false;
  eye.setFromMatrixPosition(view.matrixWorld).applyMatrix4(inverse.copy(o.matrixWorld).invert());
  const {min,max}=plane;
  const behind=p=>p.x*(p.x>=0?max[0]:min[0])+p.y*(p.y>=0?max[1]:min[1])+p.z*(p.z>=0?max[2]:min[2])-min[3]<-.025;
  if (!o.isInstancedMesh) return behind(eye);
  if (o.count<1 || o.count>16) return false;
  for (let i=0;i<o.count;i++) {
   o.getMatrixAt(i,instance);
   if (!(instance.determinant()>1e-12) || !behind(local.copy(eye).applyMatrix4(inverse.copy(instance).invert()))) return false;
  }
  return true;
 };
}

export function installQuadFacingTest(renderer, scene, camera) {
 const floorOcclusion = createFloorOcclusion(scene,camera);
 const surfaceAway = createSurfaceFacingTest(), facingAway = createQuadFacingTest(), outside = createDrawBoundsTest(), submit = renderer.renderBufferDirect;
 // These draws also straddle distant decks from the shuttle and medical rooms.
 // The material selects which draws to test; geometry and camera still decide visibility.
 const sparseMeshes = new Set(['P6_tower_architecture','Lift_door','Lift_door_blade','Imaging_heartbeat','Imaging_scan','Imaging_sweep']);
 const sparseInstances = new Set(['Residential_satin_brass_polished','Residential_oak_polished','V2_corridor_clear','V2_glass_manifestation','V2_local_frost']);
 const history = new WeakMap(), cameraWorld = new Matrix4(), cameraView = new Matrix4(), projection = new Matrix4();
 const visibleFrom = new Matrix4();
 let pose = 0, frame = -1, mainFrames = 0, visibleEpoch = 0, coordinateSystem, reversedDepth;
 function movedView(world) {
  const a = world.elements, b = visibleFrom.elements;
  // Small mouse movements keep visible draws on their staggered retest schedule.
  // A large turn or teleport rechecks them immediately. Hidden draws always
  // use the exact eye, projection, geometry and transform below.
  if (Math.abs(a[12]-b[12])>.5 || Math.abs(a[13]-b[13])>.5 || Math.abs(a[14]-b[14])>.5) return true;
  for (let i=0; i<12; i++) if (Math.abs(a[i]-b[i])>.12) return true;
  return false;
 }
 function maySkip(view, geometry, material, object, group) {
  const currentFrame = renderer.info?.render.frame;
  if (currentFrame === undefined || frame !== currentFrame) {
   frame = currentFrame;
   mainFrames++;
   if (!pose || movedView(view.matrixWorld) || !projection.equals(view.projectionMatrix)) {
    visibleFrom.copy(view.matrixWorld); visibleEpoch++;
   }
   if (!pose || !cameraWorld.equals(view.matrixWorld) || !cameraView.equals(view.matrixWorldInverse) ||
       !projection.equals(view.projectionMatrix) || coordinateSystem !== view.coordinateSystem || reversedDepth !== view.reversedDepth) {
    pose++;
    cameraWorld.copy(view.matrixWorld); cameraView.copy(view.matrixWorldInverse); projection.copy(view.projectionMatrix);
    coordinateSystem = view.coordinateSystem; reversedDepth = view.reversedDepth;
   }
  }
  let slots = history.get(object);
  if (!slots) { slots = new Map(); history.set(object, slots); }
  const start = group?.start ?? 0, count = group?.count ?? Infinity;
  let row = slots.get(start);
  if (!row) {
   if (slots.size >= 16) slots.clear();
   row = {world:new Matrix4(), pose:-1, skipped:false, next:0};
   slots.set(start, row);
  }
  // A visible draw may always be resubmitted. Spread its next test over moving frames.
  if (!row.skipped && row.epoch === visibleEpoch && mainFrames < row.next &&
      row.g === geometry && row.side === material.side && row.groupCount === count &&
      row.instanceCount === object.count && row.version === object.instanceMatrix?.version &&
      row.world.equals(object.matrixWorld)) return false;
  const p = geometry.attributes.position, ix = geometry.index, instances = object.instanceMatrix;
  if (row.pose === pose && row.g === geometry && row.p === p && row.pv === p?.version &&
      row.ix === ix && row.iv === ix?.version && row.start === geometry.drawRange.start &&
      row.count === geometry.drawRange.count && row.groupCount === count && row.side === material.side &&
      row.instances === instances && row.version === instances?.version && row.instanceCount === object.count &&
      row.world.equals(object.matrixWorld)) {
   row.epoch = visibleEpoch; row.next = mainFrames + 6 + object.id % 6;
   return row.skipped;
  }
  row.pose = pose; row.g = geometry; row.p = p; row.pv = p?.version; row.ix = ix; row.iv = ix?.version;
  row.start = geometry.drawRange.start; row.count = geometry.drawRange.count; row.groupCount = count; row.side = material.side;
  row.instances = instances; row.version = instances?.version; row.instanceCount = object.count;
  row.world.copy(object.matrixWorld);
  row.skipped = surfaceAway(view, geometry, material, object, group) || facingAway(view, geometry, material, object, group) || outside(view, geometry, object, group, material, row);
  row.epoch = visibleEpoch; row.next = mainFrames + 6 + object.id % 6;
  return row.skipped;
 }
 // Extra tests pay off in dense views. Use the last main frame's submitted and omitted
 // draws so a successful reduction does not turn the optimization off on the next frame.
 let dense = false, omitted = 0;
 const after = scene.onAfterRender;
 scene.onAfterRender = function(r, world, view) {
  after.apply(this, arguments);
  if (r === renderer && view === camera && !r.getRenderTarget() && !scene.overrideMaterial && !r.xr.isPresenting) {
   floorOcclusion?.finish();
   dense = r.info.render.calls + omitted >= (dense ? 850 : 900);
   omitted = 0;
  }
 };
 renderer.renderBufferDirect = function(view, world, geometry, material, object, group) {
  const main = floorOcclusion && view===camera && world===scene && !scene.overrideMaterial &&
      !renderer.shadowMap.enabled && !renderer.xr.isPresenting && !renderer.getRenderTarget();
  if(main && floorOcclusion.early(renderer.info.render.frame,geometry,material,object,group)){
   omitted++;
   return;
  }
  const size = geometry.index?.count ?? geometry.attributes.position?.count;
  const ordinaryQuad = size === 6 && !material.transparent && geometry.drawRange.start === 0 && geometry.drawRange.count >= 6 &&
      (!group || (group.start === 0 && group.count >= 6));
  const testBounds = dense || (object.isInstancedMesh ? sparseInstances : sparseMeshes).has(material.name);
  if ((testBounds || ordinaryQuad) && view === camera && world === scene && view.isPerspectiveCamera && !scene.overrideMaterial &&
      !renderer.shadowMap.enabled && !renderer.xr.isPresenting && !renderer.getRenderTarget() &&
      object.isMesh && !object.isBatchedMesh && !object.isSkinnedMesh && !geometry.isInstancedBufferGeometry &&
      !geometry.morphAttributes.position && !object.morphTexture && !material.wireframe && geometryKept(material) &&
      material.onBeforeRender === Material.prototype.onBeforeRender &&
      object.onBeforeRender === Object3D.prototype.onBeforeRender && object.onAfterRender === Object3D.prototype.onAfterRender &&
      (testBounds ? maySkip(view, geometry, material, object, group) : facingAway(view, geometry, material, object, group))) {
   // Sparse views also reject ordinary quads. Count those submissions when deciding
   // whether to enter the dense path so the threshold uses the same measure both ways.
   omitted++;
   return;
  }
  if (main && floorOcclusion.anchors.has(object)) {
   const before=renderer.info.render.calls;
   const result=submit.apply(this,arguments);
   if (renderer.info.render.calls>before) floorOcclusion.submitted(renderer,material,group,object);
   return result;
  }
  if (main) floorOcclusion.requestProof(renderer.info.render.frame,geometry,material,object,group);
  return submit.apply(this, arguments);
 };
}
