import {FrontSide, BackSide, Matrix4, Object3D, Vector3} from 'three';
import {geometryKept} from './shader-hooks.js';

// Answer only for complete two-triangle draws. Each triangle must independently face away
// from the eye. Testing in object space follows Three's winding change for mirrored meshes.
export function createQuadFacingTest() {
 const geometries = new WeakMap(), transforms = new WeakMap();
 const a = new Vector3(), b = new Vector3(), c = new Vector3(), eye = new Vector3();
 function planes(geometry, position, index) {
  const prior = geometries.get(geometry);
  if (prior && prior.position === position && prior.index === index &&
      prior.positionVersion === position.version && prior.indexVersion === index?.version) return prior.faces;
  let faces = null;
  if (position.array && !position.isInterleavedBufferAttribute && (!index || index.array)) {
   faces = [];
   for (let i = 0; i < 6; i += 3) {
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
  geometries.set(geometry, {position, index, positionVersion: position.version, indexVersion: index?.version, faces});
  return faces;
 }
 return (camera, geometry, material, object, group) => {
  const p = geometry.attributes.position, ix = geometry.index;
  if (!p || !camera.isPerspectiveCamera || (ix?.count ?? p.count) !== 6 || !object.isMesh || object.isInstancedMesh || object.isBatchedMesh ||
      object.isSkinnedMesh || geometry.morphAttributes.position || material.wireframe || !geometryKept(material) ||
      object.onBeforeRender !== Object3D.prototype.onBeforeRender || object.onAfterRender !== Object3D.prototype.onAfterRender ||
      (material.side !== FrontSide && material.side !== BackSide) || material.transparent ||
      geometry.drawRange.start !== 0 || geometry.drawRange.count < 6 || (group && (group.start !== 0 || group.count < 6))) return false;
  const projection = camera.projectionMatrix.elements;
  if (projection[3] || projection[7] || projection[11] !== -1 || projection[15] || projection[12] || projection[13] ||
      projection[0] * projection[5] - projection[1] * projection[4] <= 0 || camera.matrixWorld.determinant() <= 0) return false;
  const faces = planes(geometry, p, ix);
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

export function installQuadFacingTest(renderer, scene, camera) {
 const facingAway = createQuadFacingTest(), submit = renderer.renderBufferDirect;
 renderer.renderBufferDirect = function(view, world, geometry, material, object, group) {
  if ((geometry.index?.count ?? geometry.attributes.position?.count) === 6 &&
      view === camera && world === scene && view.isPerspectiveCamera && !scene.overrideMaterial &&
      !renderer.shadowMap.enabled && !renderer.xr.isPresenting && !renderer.getRenderTarget() &&
      facingAway(view, geometry, material, object, group)) return;
  return submit.apply(this, arguments);
 };
}
