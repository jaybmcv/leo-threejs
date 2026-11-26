import {Box3, CullFaceNone, Frustum, LessEqualDepth, Matrix4, NoBlending, Vector3} from 'three';
import {geometryKept} from './shader-hooks.js';

// Room features and lift shafts the rest of the frame hides are left out of the main pass, as the GPU measures it.
// Seen from the arrival hall looking down the ship, about a third of the drawn meshes changed no pixel: the dressing,
// vehicles and fittings of rooms behind walls (a cargo bay, a cold room, a container maze, other decks' rooms), and the
// lift cars in their shafts. The hall's walls are glass, so neither the floor occlusion (src/v2/floor-occlusion.js, one
// covering floor or wall triangle) nor room culling's probe rays (phase4-culling.js, which see through glass) can tell.
// Here each group (a feature root: a room's dressing or a vehicle; a lift) has a world box, and after the main pass's
// opaque draws (before the glass and anything transparent, so glass hides nothing) the box is drawn with no colour and
// no depth write inside a WebGL2 occlusion query against the depth those draws left. A group whose box shows no sample
// is hidden: its draws, and its rows in the feature batches, are left out of the next main passes, and its box is
// queried again each frame; a group in view is queried every `recheck` frames. An answer is only used while the eye is
// within `reach` metres of where it was asked (a turn of the third-person camera moves the eye), within `stale` frames,
// and while the group's box is unchanged; otherwise the group draws. So whatever goes wrong only draws more: a box the
// eye is in, an unanswered query, a teleport, a group added later, a missing WebGL2 query.
// Guards (from a read of this code by Fable 5.2): each frame's queries start with a canary box just in front of the eye
// that must show, or the frame's answers are dropped (a failed draw reads as hidden); an answer about a box partly off
// the view counts only while the view has not turned (the part off the view was never tested); a group with a skinned,
// point, never-culled or vertex-moving member is never hidden (its box cannot be trusted); and a member found outside
// its group's box when about to be left out draws, and the group is measured again.
// Main camera only; other cameras (the photo booth, portable views) draw all. On by default where it was measured
// (Chrome and Edge on Windows: Chromium's ANGLE on Direct3D 11, occlusionByDefault); ?occlusion=1 turns it on elsewhere, and
// ?occlusion=0 off, to compare.
const corners = new Uint8Array([0,0,0, 1,0,0, 1,1,0, 0,1,0, 0,0,1, 1,0,1, 1,1,1, 0,1,1]);
const faces = new Uint8Array([0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 3,7,6, 3,6,2, 0,4,7, 0,7,3, 1,2,6, 1,6,5]);

function program(gl, log) {
 const vs = `#version 300 es
in vec3 corner;
uniform mat4 viewProjection;
uniform vec3 lo, hi;
${log ? 'out float vFragDepth;' : ''}
void main() {
 gl_Position = viewProjection * vec4(mix(lo, hi, corner), 1.0);
 ${log ? 'vFragDepth = 1.0 + gl_Position.w;' : ''}
}`;
 // three's logdepthbuf_fragment for a perspective camera, so the box's depth is the walk's own.
 const fs = `#version 300 es
precision highp float;
${log ? 'uniform float logDepthBufFC;\nin float vFragDepth;' : ''}
out vec4 colour;
void main() {
 colour = vec4(0.0);
 ${log ? 'gl_FragDepth = log2(vFragDepth) * logDepthBufFC * 0.5;' : ''}
}`;
 const p = gl.createProgram();
 for (const [type, text] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
  const s = gl.createShader(type);
  gl.shaderSource(s, text);
  gl.compileShader(s);
  gl.attachShader(p, s);
  gl.deleteShader(s);
 }
 gl.bindAttribLocation(p, 0, 'corner');
 gl.linkProgram(p);
 if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; }
 return p;
}

/** Whether occlusion is on without ?occlusion: where it was measured, Chromium's ANGLE on Direct3D 11 (Chrome and Edge on
 * Windows). Firefox on Windows names ANGLE on Direct3D 11 too, but was not measured. */
export function occlusionByDefault(gl) {
 const debug = gl.getExtension('WEBGL_debug_renderer_info'), name = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
 const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
 // Not inside another page (the Otherside embed) until it has been tried there.
 const framed = typeof window !== 'undefined' && window.top !== window;
 return !framed && /ANGLE/.test(name) && /Direct3D11|D3D11/i.test(name) && /Chrome\//.test(agent) && !/Firefox\//.test(agent);
}

/** roots: the groups' roots (they may gain children later). Returns {stats, hiddenRoot(root), dispose()} or null. */
export function createGroupOcclusion(renderer, scene, camera, roots, {recheck = 16, reach = .5, stale = 45, most = 128, pad = .05} = {}) {
 const gl = renderer.getContext();
 if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext) || gl.isContextLost() ||
     renderer.capabilities.reversedDepthBuffer || camera.reversedDepth) return null;
 const log = !!renderer.capabilities.logarithmicDepthBuffer, prog = program(gl, log);
 if (!prog) return null;
 const at = {viewProjection: gl.getUniformLocation(prog, 'viewProjection'), lo: gl.getUniformLocation(prog, 'lo'), hi: gl.getUniformLocation(prog, 'hi'),
  fc: log ? gl.getUniformLocation(prog, 'logDepthBufFC') : null};
 const vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
 {
  const array = gl.getParameter(gl.ARRAY_BUFFER_BINDING), was = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.UNSIGNED_BYTE, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faces, gl.STATIC_DRAW);
  gl.bindVertexArray(was);
  gl.bindBuffer(gl.ARRAY_BUFFER, array);
 }
 const stats = {groups: 0, inView: 0, hidden: 0, skipped: 0, queries: 0, answers: 0, canaryFailed: 0, strays: 0, ms: 0};
 const groups = [], movers = [], byRoot = new Map(), member = new WeakMap(), pool = [], pending = [];
 const eye = new Vector3(), previous = new Vector3(), ahead = new Vector3(), viewProjection = new Matrix4(), frustum = new Frustum(), box = new Box3(), part = new Box3();
 const instanced = new WeakMap(), checked = new WeakMap(), remeasure = new Set(), untrusted = new WeakSet();
 // An instanced member's own bounds, again whenever its instances change.
 function instanceBounds(o) {
  const key = o.count + ':' + o.instanceMatrix.version;let c = instanced.get(o);
  if (!c || c.key !== key) { o.computeBoundingBox(); c = {key}; instanced.set(o, c); }
  return o;
 }
 const vp = new Float32Array(16);
 let step = 0, frame = 0, built = -Infinity, boxTurn = 0, issued = true, main = false, disposed = false, enabled = true;

 // Members: every object under a root belongs to its group (refreshed now and then for children added later).
 function enrol() {
  for (const root of roots) {
   let g = byRoot.get(root);
   if (!g) { g = {id: groups.length, root, box: new Box3(), raw: new Box3(), matrix: root.matrixWorld.clone(), version: 0, moved: false, hidden: false, last: null}; groups.push(g); byRoot.set(root, g); measure(g); }
   root.traverse(o => member.set(o, g));
  }
  stats.groups = groups.length;
 }
 // A group's world box: its drawables' bounds (an instanced mesh's own, over its instances).
 function measure(g) {
  // Hidden members too (each with the world matrix it has: the walk leaves a hidden branch's alone), so one shown later
  // is already inside.
  box.makeEmpty();
  g.root.traverse(o => {
   if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.geometry) return;
   // Bones, point sizes, a sprite turning to the eye, a batch's own instances, a shader that moves vertices, a part never
   // culled or bounds that cannot be read: such a member says
   // nothing of where it draws, so it always draws and stays out of the box; the rest of its group can still be left out.
   if (o.isSkinnedMesh || o.isPoints || o.isSprite || o.isBatchedMesh || !o.frustumCulled || [o.material].flat().some(m => m && !geometryKept(m)) || !memberBox(o, part)) { untrusted.add(o); return; }
   untrusted.delete(o);
   if (!part.isEmpty()) box.union(part);
  });
  if (!box.equals(g.raw)) {
   // A box that changed after it was first measured belongs to something that moves: it gets room to move until measured again.
   if (g.version && !g.moved) { g.moved = true; movers.push(g); }
   g.raw.copy(box);g.box.copy(box);
   if (g.moved) g.box.expandByScalar(.5);
   g.version++;
  }
 }
 // A group draws nothing while it or a parent is hidden (a deck band out of the view's heights; a root the deck merges
 // copied, kept hidden): it is neither asked about nor counted.
 const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
 const release = q => pool.push(q);
 function poll() {
  // Canaries first: a frame's answers count only once its canary has shown.
  for (const pass of [true, false])
   for (let i = 0; i < pending.length;) {
    const p = pending[i];
    if (p.canary !== pass || !pass && p.batch.ok === null || !gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) { i++; continue; }
    const shown = !!gl.getQueryParameter(p.q, gl.QUERY_RESULT);
    release(p.q); pending[i] = pending[pending.length - 1]; pending.pop();
    if (p.canary) { p.batch.ok = shown; if (!shown) stats.canaryFailed++; continue; }
    const g = p.g;
    // Only the newest answer counts, and none from a frame whose canary failed.
    if (!p.batch.ok || g.last && g.last.frame > p.frame) continue;
    g.last = {shown, frame: p.frame, eye: p.eye, ahead: p.ahead, whole: p.whole, version: p.version};
    stats.answers++;
   }
 }
 // Before the main pass: answers in, then which groups it leaves out.
 function begin() {
  frame++;
  if (frame - built > 600) { built = frame; enrol(); }
  // Boxes measured again: a group whose root has moved, at once; one seen moving before, every fourth frame; the rest
  // in turn, two a frame (for parts that move inside a root that stays).
  for (const g of groups) if (!g.matrix.equals(g.root.matrixWorld)) { g.matrix.copy(g.root.matrixWorld); measure(g); }
  for (const g of movers) if ((frame + g.id) % 4 === 0) measure(g);
  for (let n = 0; n < 2 && groups.length; n++, boxTurn++) measure(groups[boxTurn % groups.length]);
  for (const g of remeasure) measure(g);
  remeasure.clear();
  poll();
  camera.updateMatrixWorld();
  previous.copy(eye);
  eye.setFromMatrixPosition(camera.matrixWorld);
  // How far the eye moved since the last frame: a moving eye asks about hidden groups every frame, with boxes grown by a
  // few frames of that movement, so what comes out from behind a wall's edge is asked about before it shows.
  step = Math.min(eye.distanceTo(previous), reach);
  ahead.setFromMatrixColumn(camera.matrixWorld, 2).normalize().negate();
  viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(viewProjection, camera.coordinateSystem, camera.reversedDepth);
  stats.hidden = 0; stats.inView = 0;
  for (const g of groups) {
   const a = g.last;
   g.inView = !g.box.isEmpty() && shown(g.root) && frustum.intersectsBox(g.box);
   if (g.inView) stats.inView++;
   // A box partly off the view was tested only where it was on it: its answer holds only while the view has not turned.
   g.hidden = enabled && !!a && !a.shown && g.inView && a.version === g.version && frame - a.frame <= stale &&
    a.eye.distanceTo(eye) <= reach && (a.whole || a.ahead.dot(ahead) > STILL);
   if (g.hidden) stats.hidden++;
  }
  issued = false;
 }
 // A box over a quarter of the view or more is in view all but always, and drawing it costs the GPU a large fill (its
 // depth is written per fragment): it is not asked about, so it draws.
 const corner = new Vector3();
 function large(b) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
   corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(camera.matrixWorldInverse);
   if (corner.z > -camera.near) return true;
   corner.applyMatrix4(camera.projectionMatrix);
   x0 = Math.min(x0, corner.x); x1 = Math.max(x1, corner.x); y0 = Math.min(y0, corner.y); y1 = Math.max(y1, corner.y);
  }
  return (Math.min(x1, 1) - Math.max(x0, -1)) * (Math.min(y1, 1) - Math.max(y0, -1)) > 1;
 }
 const STILL = Math.cos(.5 * Math.PI / 180);
 const whole = b => frustum.planes.every(p => p.distanceToPoint(corner.set(p.normal.x > 0 ? b.min.x : b.max.x, p.normal.y > 0 ? b.min.y : b.max.y, p.normal.z > 0 ? b.min.z : b.max.z)) >= 0);
 // After the opaque draws: ask about the groups in view, the hidden ones each frame, the others every `recheck` frames.
 function ask() {
  if (issued) return;
  issued = true;
  // Answers that stop coming (a driver that never makes them available) stop the asking, not the frame.
  if (!enabled || pending.length > 1024) return;
  const t = performance.now(), near = camera.near + .3, list = [];
  for (const g of groups) {
   if (!g.inView) continue;
   if (g.box.distanceToPoint(eye) <= near || large(g.box)) { g.last = null; continue; }
   // A hidden group every other frame (its answer then stays within `reach` of a running walker), one in view every `recheck`.
   if (g.hidden ? step < .01 && (frame + g.id) % 2 !== 0 : (frame + g.id) % recheck !== 0 && g.last?.version === g.version) continue;
   list.push(g);
  }
  if (!list.length) return;
  list.sort((a, b) => (b.hidden - a.hidden) || a.box.distanceToPoint(eye) - b.box.distanceToPoint(eye));
  // Hidden groups come first and are never cut: an unasked one would stay hidden on an old answer.
  if (list.length > most) list.length = Math.max(most, list.filter(g => g.hidden).length);
  const state = renderer.state, program = gl.getParameter(gl.CURRENT_PROGRAM), was = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
  // three's own state calls, so its cache knows what is set; the program and vertex array go back as they were.
  state.setBlending(NoBlending);
  state.setCullFace(CullFaceNone);
  state.setPolygonOffset(false);
  state.buffers.color.setMask(false);
  state.buffers.depth.setTest(true);
  state.buffers.depth.setFunc(LessEqualDepth);
  state.buffers.depth.setMask(false);
  state.useProgram(prog);
  gl.bindVertexArray(vao);
  vp.set(viewProjection.elements);
  gl.uniformMatrix4fv(at.viewProjection, false, vp);
  if (log) gl.uniform1f(at.fc, 2.0 / (Math.log(camera.far + 1.0) / Math.LN2));
  const from = eye.clone(), facing = ahead.clone(), batch = {ok: null};
  // The canary: a tiny box just past the near plane, straight ahead, in front of everything the frame drew.
  {
   const q = pool.pop() || gl.createQuery(), c = corner.copy(ahead).multiplyScalar(camera.near + .05).add(eye);
   gl.uniform3f(at.lo, c.x - .005, c.y - .005, c.z - .005);
   gl.uniform3f(at.hi, c.x + .005, c.y + .005, c.z + .005);
   gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, q);
   gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_BYTE, 0);
   gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
   pending.push({q, canary: true, batch});
  }
  const grow = pad + 4 * step;
  for (const g of list) {
   const q = pool.pop() || gl.createQuery(), {min, max} = g.box;
   gl.uniform3f(at.lo, min.x - grow, min.y - grow, min.z - grow);
   gl.uniform3f(at.hi, max.x + grow, max.y + grow, max.z + grow);
   gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, q);
   gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_BYTE, 0);
   gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
   pending.push({q, g, frame, eye: from, ahead: facing, whole: whole(g.box), version: g.version, batch, canary: false});
  }
  gl.bindVertexArray(was);
  state.useProgram(program);
  state.buffers.color.setMask(true);
  stats.queries = list.length;
  stats.ms = performance.now() - t;
 }
 // A member's world box, as measure() takes it (null when its bounds cannot be read).
 function memberBox(o, out) {
  const geo = o.geometry;
  if (o.isInstancedMesh) return out.copy(instanceBounds(o).boundingBox).applyMatrix4(o.matrixWorld);
  if (!geo.boundingBox && !geo.attributes.position?.array) {
   const s = geo.boundingSphere;if (!s) return null;
   const r = s.radius * o.matrixWorld.getMaxScaleOnAxis();
   out.min.copy(s.center).applyMatrix4(o.matrixWorld).subScalar(r);out.max.copy(s.center).applyMatrix4(o.matrixWorld).addScalar(r);
   return out;
  }
  if (!geo.boundingBox) geo.computeBoundingBox();
  return out.copy(geo.boundingBox).applyMatrix4(o.matrixWorld);
 }
 // Whether a member about to be left out lies inside its group's box (once a frame for each member).
 const own = new Box3();
 function inside(o, g) {
  const c = checked.get(o);
  if (c && c.frame === frame) return c.ok;
  const m = memberBox(o, own), b = g.box, t = .01;
  const ok = !!m && m.min.x >= b.min.x - t && m.min.y >= b.min.y - t && m.min.z >= b.min.z - t && m.max.x <= b.max.x + t && m.max.y <= b.max.y + t && m.max.z <= b.max.z + t;
  checked.set(o, {frame, ok});
  return ok;
 }
 const isMain = (view, world) => view === camera && world === scene && !renderer.getRenderTarget() && !scene.overrideMaterial &&
  !renderer.shadowMap.enabled && !renderer.xr?.isPresenting;
 const submit = renderer.renderBufferDirect;
 renderer.renderBufferDirect = function(view, world, geometry, material, object, group) {
  if (main && view === camera) {
   if (!issued && (material.transparent || material.transmission > 0) && !renderer.getRenderTarget()) ask();
   const g = member.get(object);
   if (g?.hidden && !untrusted.has(object)) {
    if (inside(object, g)) { stats.skipped++; return; }
    // A member outside its group's box (moved, re-parented, instances changed): it draws, and the group is measured again.
    g.hidden = false; g.last = null; remeasure.add(g); stats.strays++;
   }
  }
  return submit.apply(this, arguments);
 };
 const before = scene.onBeforeRender, after = scene.onAfterRender;
 scene.onBeforeRender = function(r, world, view, target) {
  // A lost context loses the program and every query with it: from then on everything draws.
  if (!disposed && gl.isContextLost()) api.dispose();
  main = !disposed && isMain(view, world);
  if (main) { stats.skipped = 0; begin(); }
  return before.apply(this, arguments);
 };
 scene.onAfterRender = function(r, world, view) {
  const result = after.apply(this, arguments);
  if (main) { ask(); main = false; }
  return result;
 };
 enrol();
 const api = {
  stats,
  /** For the feature batches: whether this frame leaves the root's rows out. */
  hiddenRoot: (root, o) => {
   const g = byRoot.get(root);
   if (!g?.hidden || o && untrusted.has(o)) return false;
   if (!o || inside(o, g)) return true;
   g.hidden = false; g.last = null; remeasure.add(g); stats.strays++;
   return false;
  },
  /** For the Stats readout (frame-readout.js). */
  line: () => enabled && !disposed ? `hidden by the frame: ${stats.hidden} of ${stats.inView} room features and lifts in view` : 'hidden by the frame: off',
  get enabled() { return enabled; },
  set enabled(on) { enabled = !!on; if (!enabled) for (const g of groups) g.hidden = false; },
  dispose() {
   disposed = true; main = false;
   for (const g of groups) g.hidden = false;
   if (!gl.isContextLost()) { for (const p of pending) gl.deleteQuery(p.q); for (const q of pool) gl.deleteQuery(q); }
   pending.length = pool.length = 0;
  },
 };
 return api;
}
