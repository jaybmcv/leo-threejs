import assert from 'node:assert/strict';
import * as T from 'three';
import {createDrawBoundsTest, rememberMergedBounds} from '../src/v2/draw-bounds.js';
import {createQuadFacingTest, installQuadFacingTest} from '../src/v2/quad-facing.js';

const facesAway = createQuadFacingTest(), camera = new T.PerspectiveCamera();
const geometry = new T.PlaneGeometry(2, 1), material = new T.MeshBasicMaterial();
const mesh = new T.Mesh(geometry, material);
const test = (z, expected, group) => {
 camera.position.copy(mesh.localToWorld(new T.Vector3(0, 0, z)));
 camera.updateMatrixWorld();
 assert.equal(facesAway(camera, geometry, material, mesh, group), expected);
};
test(3, false);
test(-3, true);
test(-.001, false);
mesh.scale.set(-1, 2, .5);
mesh.rotation.y = .36;
mesh.updateMatrixWorld(true);
test(-3, true);
test(3, false);
material.side = T.BackSide;
test(3, true);
material.side = T.DoubleSide;
test(-3, false);
material.side = T.FrontSide;
test(-3, false, {start: 1, count: 5});
material.wireframe = true;
test(-3, false);
material.wireframe = false;
const a = geometry.index.array;
[a[4], a[5]] = [a[5], a[4]];
geometry.index.needsUpdate = true;
test(-3, false);
test(3, false);
geometry.setIndex(new T.PlaneGeometry(2, 1).index);
test(-3, true);
const position = geometry.attributes.position.clone();
position.array = null;
geometry.setAttribute('position', position);
test(-3, false);

const world = new T.Scene(), view = new T.PerspectiveCamera(), quad = new T.Mesh(new T.PlaneGeometry(), material);
view.position.z = -2;
view.updateMatrixWorld();
let calls = 0, target = null;
const renderer = {shadowMap: {enabled: false}, xr: {isPresenting: false}, getRenderTarget: () => target,
 renderBufferDirect() { calls++; }};
installQuadFacingTest(renderer, world, view);
function submit(camera = view, scene = world) { renderer.renderBufferDirect(camera, scene, quad.geometry, material, quad, null); }
submit();
assert.equal(calls, 0);
submit(new T.PerspectiveCamera());
submit(view, null);
target = {};
submit();
target = null;
world.overrideMaterial = material;
submit();
world.overrideMaterial = null;
renderer.shadowMap.enabled = true;
submit();
renderer.shadowMap.enabled = false;
renderer.xr.isPresenting = true;
submit();
assert.equal(calls, 6);
// Two separated clusters straddle the camera. Each aligned triangle is offscreen, but
// shifting the primitive start by a vertex creates a new triangle that crosses the frame.
const across = new T.BufferGeometry(), vertices = new Float32Array(96 * 3);
for (let i = 0; i < 96; i++) {
 vertices[3*i] = (i < 48 ? -100 : 100) + (i % 3 === 1 ? .5 : 0);
 vertices[3*i+1] = i % 3 === 2 ? .5 : 0;
 vertices[3*i+2] = -5;
}
across.setAttribute('position', new T.BufferAttribute(vertices, 3));
const clipView = new T.PerspectiveCamera(60, 1, .1, 100);
clipView.updateMatrixWorld();
const outside = createDrawBoundsTest(), clusters = new T.Mesh(across, material);
assert.equal(outside(clipView, across, clusters, null), true);
assert.equal(outside(clipView, across, clusters, {start:47, count:3}), false);
vertices[0] = 0;
across.attributes.position.needsUpdate = true;
assert.equal(outside(clipView, across, clusters, {start:0, count:48}), false);
assert.equal(outside(clipView, across, clusters, {start:48, count:48}), true);

const retained = new T.PlaneGeometry(), slots = new T.InstancedMesh(retained, material, 2);
rememberMergedBounds(retained);
retained.attributes.position.array = null;
retained.index.array = null;
slots.setMatrixAt(0, new T.Matrix4().makeTranslation(-100, 0, -8));
slots.setMatrixAt(1, new T.Matrix4().makeTranslation(100, 0, -8));
assert.equal(outside(clipView, retained, slots, null), true);
slots.setMatrixAt(1, new T.Matrix4().makeTranslation(0, 0, -8));
assert.equal(outside(clipView, retained, slots, null), false);
slots.count = 1;
assert.equal(outside(clipView, retained, slots, null), true);

const winding = new T.PlaneGeometry(2, 2, 3, 3), tile = new T.Mesh(winding, material);
clipView.position.z = -3;
clipView.updateMatrixWorld();
assert.equal(facesAway(clipView, winding, material, tile, {start:6, count:12}), true);
assert.equal(facesAway(clipView, winding, material, tile, {start:1, count:12}), false);
console.log('Winding, clip bounds, aligned ranges, released arrays, instance packing and auxiliary views passed.');

const dynamicWorld = new T.Scene(), dynamicCam = new T.PerspectiveCamera(60, 1, .1, 100);
const geometrySlots = new T.BoxGeometry();
const moving = new T.InstancedMesh(geometrySlots, material, 1);
let sent = 0;
const gl = {info:{render:{frame:0,calls:0}}, shadowMap:{enabled:false}, xr:{isPresenting:false}, getRenderTarget:()=>null, renderBufferDirect(){sent++;}};
installQuadFacingTest(gl, dynamicWorld, dynamicCam);
function finish(draws) {
 gl.info.render.calls=draws;
 dynamicWorld.onAfterRender(gl,dynamicWorld,dynamicCam);
 gl.info.render.frame++;
}
function emit() { gl.renderBufferDirect(dynamicCam,dynamicWorld,geometrySlots,material,moving,null); }
moving.setMatrixAt(0,new T.Matrix4().makeTranslation(100,0,-5));
moving.instanceMatrix.needsUpdate=true;
emit(); assert.equal(sent,1); // Sparse view follows the previous renderer.
finish(1100); emit(); assert.equal(sent,1);
finish(1100); moving.setMatrixAt(0,new T.Matrix4().makeTranslation(0,0,-5));
moving.instanceMatrix.needsUpdate=true;
emit(); assert.equal(sent,2);
moving.setMatrixAt(0,new T.Matrix4().makeTranslation(100,0,-5)); moving.instanceMatrix.needsUpdate=true;
for(let i=0;i<9;i++)finish(1100);
emit(); assert.equal(sent,2);
finish(1100); dynamicCam.position.x=100; dynamicCam.updateMatrixWorld(); emit(); assert.equal(sent,3);
finish(500); dynamicCam.position.x=0; dynamicCam.updateMatrixWorld(); emit(); assert.equal(sent,4);
