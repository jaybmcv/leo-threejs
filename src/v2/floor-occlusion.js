import { Frustum, LessDepth, LessEqualDepth, Material, Matrix4, NormalBlending, NoBlending, Object3D, Vector3, WebGLCoordinateSystem } from 'three';
import { geometryKept } from './shader-hooks.js';
import { retainedDrawTree } from './draw-bounds.js';
import { occlusionWorker } from './occlusion-worker.js';
const axes = ['x', 'y', 'z'];
function hooks(o) { return o.onBeforeRender === Object3D.prototype.onBeforeRender && o.onAfterRender === Object3D.prototype.onAfterRender; }
function normalDepth(m) { return m.depthTest && (m.depthFunc === LessDepth || m.depthFunc === LessEqualDepth) && !m.stencilWrite && !m.polygonOffset && !m.wireframe && m.onBeforeRender === Material.prototype.onBeforeRender && geometryKept(m); }
const names = /^(V2_facade_terraces_and_atrium_roof|V2_low_deck_merged_(V2_public_hex_floor|V2_public_wall_panels|Walk_finish_[0-9]+[|][0-9]+[|][0-9]+[|][0-9]+)|P6_atrium_floor_actual|P6_atrium_soffits|P6_sky_tip|P6_sky_ceiling|Gaming_hex_floor)$/;
/** A mesh the floors' occlusion may take as a blocker: it must reach renderBufferDirect itself (quad-facing.js reports what
 * it drew). */
export const floorBlocker = o => !!o?.isMesh && !o.isInstancedMesh && names.test(o.name);
function opaque(m) {
  return (m.isMeshStandardMaterial || m.isMeshBasicMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial) && normalDepth(m) &&
    (m.onBeforeCompile === Material.prototype.onBeforeCompile || m.onBeforeCompile.cornerShade || m.onBeforeCompile.filmLook) && m.depthWrite && m.colorWrite && !m.transparent && !m.transmission &&
    m.opacity === 1 && !m.alphaMap && !m.alphaTest && !m.alphaHash && !m.alphaToCoverage && !m.clippingPlanes?.length && (m.blending === NormalBlending || m.blending === NoBlending);
}
// Use actual rendered geometry and material ranges as blockers. The worker chooses
// witnesses. Every hidden draw revalidates those witnesses in its current pass.
// The scan reads every triangle of the floors and facades above (about a second on a desktop), so it pauses every
// SCAN_TRIANGLES triangles: createFloorOcclusionAsync gives the page a turn there, while someone walks the arrival hall
// as the ship builds (arrival-preview.js). The same scan in the same order either way.
const SCAN_TRIANGLES = 4096;
export function createFloorOcclusion(scene, camera) {
  const scan = floorScan(scene, camera);
  let step;
  do step = scan.next(); while (!step.done);
  return step.value;
}
/** createFloorOcclusion, with `turn()` awaited once `sliceMs` of scanning has run since the last. */
export async function createFloorOcclusionAsync(scene, camera, turn, sliceMs = 12) {
  const scan = floorScan(scene, camera);
  let step, slice = performance.now();
  while (!(step = scan.next()).done)
    if (performance.now() - slice >= sliceMs) {
      await turn();
      slice = performance.now();
    }
  return step.value;
}
function* floorScan(scene, camera) {
  if (typeof Worker === 'undefined')
    return null;
  const anchors = new WeakMap(), packed = [], sources = [], p0 = new Vector3(), p1 = new Vector3(), p2 = new Vector3(), meshes = [];
  scene.traverse?.(o => {
    if (!names.test(o.name) || !o.isMesh || o.isInstancedMesh || !hooks(o))
      return;
    const g = o.geometry, p = g.attributes.position, ix = g.index, m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!p?.array || p.isInterleavedBufferAttribute || ix && !ix.array || g.morphAttributes.position || !opaque(m))
      return;
    o.updateWorldMatrix(true, false);
    const world = o.matrixWorld.clone(), det = Math.sign(world.determinant()), source = { g, p, ix, m, world, side: m.side, pv: p.version, iv: ix?.version, frame: -1, ranges: [] };
    source.id = sources.length;
    sources.push(source);
    meshes.push([o, source, det]);
  });
  let scanned = 0;
  for (const [o, source, det] of meshes) {
    const { p, ix, m, world } = source, count = ix?.count ?? p.count;
    for (let i = 0; i + 2 < count; i += 3) {
      // Counted across meshes, so many small floors pause as one big one does.
      if (++scanned % SCAN_TRIANGLES === 0)
        yield;
      p0.fromBufferAttribute(p, ix ? ix.getX(i) : i).applyMatrix4(world);
      p1.fromBufferAttribute(p, ix ? ix.getX(i + 1) : i + 1).applyMatrix4(world);
      p2.fromBufferAttribute(p, ix ? ix.getX(i + 2) : i + 2).applyMatrix4(world);
      let axis;
      if (p0.y === p1.y && p0.y === p2.y)
        axis = 1;
      else if (p0.x === p1.x && p0.x === p2.x)
        axis = 0;
      else if (p0.z === p1.z && p0.z === p2.z)
        axis = 2;
      else
        continue;
      const h = axes[axis], u = axes[(axis + 1) % 3], v = axes[(axis + 2) % 3], d = p0[h];
      const area = (p1[u] - p0[u]) * (p2[v] - p0[v]) - (p1[v] - p0[v]) * (p2[u] - p0[u]);
      if (!(Math.abs(area) >= 2))
        continue;
      packed.push(axis, d, Math.sign(area) * det, m.side, source.id, i, p0[u], p0[v], p1[u], p1[v], p2[u], p2[v]);
      anchors.set(o, source);
    }
  }
  if (!packed.length)
    return null;
  let worker, url;
  try {
    url = URL.createObjectURL(new Blob(['(' + occlusionWorker.toString() + ')(self)'], { type: 'text/javascript' }));
    worker = new Worker(url);
  }
  catch {
    return null;
  }
  finally {
    if (url)
      URL.revokeObjectURL(url);
  }
  const raw = Float64Array.from(packed);
  packed.length = 0;
  const targets = new WeakMap(), geometryIds = new WeakMap(), retired = [], rowsById = new Map(), pending = [], trees = [], scope = [];
  const eyes = new Vector3(), frustum = new Frustum(), vp = new Matrix4(), last = new Matrix4(), v = new Vector3();
  let ready = false, busy = false, frame = -1, epoch = 0, pass = 0, nextRow = 0, nextTree = 0, view = null, spent = 0, scopeHash = 0;
  worker.onmessage = ({ data }) => {
    if (data.ready) {
      ready = true;
      return;
    }
    busy = false;
    for (const [id, ticket, result] of data.answers) {
      const row = rowsById.get(id);
      rowsById.delete(id);
      if (row && row.ticket === ticket) {
        row.pending = false;
        if (row.epoch === data.epoch) {
          row.answer = result;
          row.tried = pass;
        }
      }
    }
    if (retired.length && !pending.length) queueMicrotask(finish);
  };
  const failOpen = () => { ready = false; busy = false; rowsById.clear(); worker.terminate(); };
  worker.onerror = failOpen;
  try {
    worker.postMessage({ anchors: raw }, [raw.buffer]);
  }
  catch {
    failOpen();
    return null;
  }
  function setup(r) {
    if (!ready || !Number.isSafeInteger(r.info.render.frame) || camera.coordinateSystem !== WebGLCoordinateSystem || r.clippingPlanes?.length || camera.view?.enabled || camera.reversedDepth || r.capabilities?.reversedDepthBuffer || !camera.isPerspectiveCamera || camera.matrixWorld.determinant() <= 0)
      return false;
    const p = camera.projectionMatrix.elements, w = camera.matrixWorld.elements;
    if (!Number.isFinite(camera.far) || !(camera.far > camera.near && camera.near > 0) ||
        !w.every(Number.isFinite) || w[3] !== 0 || w[7] !== 0 || w[11] !== 0 || w[15] !== 1)
      return false;
    if (p[3] || p[7] || p[11] !== -1 || p[15] || p[12] || p[13] || p[0] * p[5] - p[1] * p[4] <= 0)
      return false;
    if (Math.hypot(w[0], w[1], w[2], w[4], w[5], w[6], w[8], w[9], w[10]) > 1.9)
      return false;
    for (const x of [-1, 1])
      for (const y of [-1, 1])
        if (!(v.set(x, y, -1).applyMatrix4(camera.projectionMatrixInverse).length() < .3))
          return false;
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    let renew = !epoch;
    // A rotated or translated camera may reuse the clip proof only while its entire
    // current frustum is inside the expanded frustum sent to the worker.
    if (!epoch || !vp.equals(last))
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          for (const z of [-1, 1]) {
            v.set(x, y, z).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
            if (!Number.isFinite(v.x + v.y + v.z))
              return false;
            if (!frustum.containsPoint(v))
              renew = true;
          }
    if (renew) {
      frustum.setFromProjectionMatrix(vp, camera.coordinateSystem, camera.reversedDepth);
      for (const plane of frustum.planes)
        plane.constant += 4;
    }
    last.copy(vp);
    const cell = .25, snap = n => (Math.floor(n / cell) + .5) * cell, x = snap(w[12]), y = snap(w[13]), z = snap(w[14]);
    if (renew || eyes.x !== x || eyes.y !== y || eyes.z !== z) {
      eyes.set(x, y, z);
      epoch++;
      view = { epoch, eye: eyes.toArray(), half: cell / 2, frustum: frustum.planes.map(p => [p.normal.x, p.normal.y, p.normal.z, p.constant]) };
    }
    frame = r.info.render.frame;
    scope.length = 0;
    scopeHash = 0;
    spent = 0;
    pass++;
    return true;
  }
  function submitted(r, m, group, o) {
    const s = anchors.get(o), g = o.geometry;
    if (g !== s.g || s.p !== g.attributes.position || s.ix !== g.index || s.p.version !== s.pv || s.ix?.version !== s.iv || !o.matrixWorld.equals(s.world) || m !== s.m || m.side !== s.side || !opaque(m) || !hooks(o))
      return;
    if (frame !== r.info.render.frame && !setup(r))
      return;
    const start = Math.max(g.drawRange.start, group?.start ?? 0), end = Math.min(g.index?.count ?? s.p.count, g.drawRange.start + g.drawRange.count, group ? group.start + group.count : Infinity);
    if (start % 3 || start >= end)
      return;
    if (s.frame !== frame) {
      s.frame = frame;
      s.ranges.length = 0;
    }
    s.ranges.push(start, end);
    scope.push(s.id, start, end);
    scopeHash = Math.imul(Math.imul(scopeHash ^ s.id, 31) ^ start, 31) ^ end;
  }
  function drawn(required) {
    for (let k = 0; k < required.length; k += 3) {
      const s = sources[required[k]];
      if (s.frame !== frame)
        return false;
      let on = false;
      for (let i = 0; i < s.ranges.length; i += 2)
        if (s.ranges[i] <= required[k + 1] && s.ranges[i + 1] >= required[k + 2]) {
          on = true;
          break;
        }
      if (!on)
        return false;
    }
    return true;
  }
  function eligible(o, g, m) { return o.isMesh && !o.isBatchedMesh && !o.isSkinnedMesh && !g.isInstancedBufferGeometry && !g.morphAttributes.position && !o.morphTexture && hooks(o) && normalDepth(m); }
  function unchanged(row, o, g, group) {
    const p = g.attributes.position, ix = g.index, inst = o.instanceMatrix;
    return row.epoch === epoch && row.g === g && row.p === p && row.pv === p.version && row.ix === ix && row.iv === ix?.version &&
      row.inst === inst && row.version === inst?.version && row.count === (inst ? o.count : 1) && row.groupCount === (group?.count ?? Infinity) &&
      row.start === g.drawRange.start && row.limit === g.drawRange.count && row.mat.equals(o.matrixWorld);
  }
  function early(current, g, m, o, group) {
    if (frame !== current || !ready)
      return false;
    const row = targets.get(o)?.get(group?.start ?? 0);
    return !!row?.answer && unchanged(row, o, g, group) && eligible(o, g, m) && drawn(row.answer);
  }
  function requestProof(current, g, m, o, group) {
    if (frame !== current || !ready || busy || spent >= .45 || pending.length >= 100 || anchors.has(o) || !eligible(o, g, m))
      return false;
    const p = g.attributes.position, ix = g.index, inst = o.instanceMatrix, count = inst ? o.count : 1;
    if (!p || !count || count > 640 || p.isInterleavedBufferAttribute || inst && !(inst.array instanceof Float32Array))
      return false;
    const first = Math.max(g.drawRange.start, group?.start ?? 0), end = Math.min(ix?.count ?? p.count, g.drawRange.start + g.drawRange.count, group ? group.start + group.count : Infinity);
    if (first % 3 || first >= end)
      return false;
    let slots = targets.get(o);
    if (!slots) {
      slots = new Map();
      targets.set(o, slots);
    }
    const key = group?.start ?? 0;
    let row = slots.get(key);
    if (row && (row.pending || unchanged(row, o, g, group) && row.scopeHash === scopeHash))
      return false;
    const started = performance.now();
    if (!row) {
      if (slots.size > 16)
        slots.clear();
      row = { mat: new Matrix4(), id: ++nextRow, ticket: 0 };
      slots.set(key, row);
    }
    // Keep animated targets from monopolizing new work while static draws wait.
    if (row.epoch === epoch && row.tried > pass - 40)
      return false;
    Object.assign(row, { epoch, scopeHash, g, p, pv: p.version, ix, iv: ix?.version, inst, version: inst?.version, count, groupCount: group?.count ?? Infinity, start: g.drawRange.start, limit: g.drawRange.count, answer: null, tried: pass });
    row.mat.copy(o.matrixWorld);
    const tree = retainedDrawTree(g);
    if (tree) {
      let registered = geometryIds.get(g);
      if (registered && registered.tree !== tree)
        return false;
      if (!registered) {
        const id = ++nextTree;
        registered = { id, tree };
        geometryIds.set(g, registered);
        trees.push({ id, boxes: tree.boxes, leaves: tree.leaves, stride: tree.stride });
        const dispose = () => {
          retired.push(id);
          geometryIds.delete(g);
          g.removeEventListener('dispose', dispose);
          if (!pending.length) queueMicrotask(finish);
        };
        g.addEventListener('dispose', dispose);
      }
      const id = registered.id;
      row.ticket++;
      row.pending = true;
      rowsById.set(row.id, row);
      pending.push({ id: row.id, version: row.ticket, geo: id, first, end, world: o.matrixWorld.toArray(), slots: inst ? inst.array.slice(0, count * 16) : null, scope: scope.length });
    }
    spent += performance.now() - started;
    return false;
  }
  function finish() {
    if (!ready || busy || (!pending.length && !retired.length))
      return;
    busy = true;
    try {
      worker.postMessage({ view, jobs: pending, trees, scope, retired });
    }
    catch {
      failOpen();
    }
    pending.length = 0;
    trees.length = 0;
    retired.length = 0;
  }
  return { anchors, submitted, early, requestProof, finish };
}
