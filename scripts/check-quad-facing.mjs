import assert from 'node:assert/strict';
import * as T from 'three';
import {createDrawBoundsTest, rememberMergedBounds} from '../src/v2/draw-bounds.js';
import {createQuadFacingTest, createSurfaceFacingTest, installQuadFacingTest} from '../src/v2/quad-facing.js';
import {createFloorOcclusion} from '../src/v2/floor-occlusion.js';

// A floor with an open side. A target can be hidden only after that floor
// was submitted in this pass and every submitted instance is behind it.
{
 const scene=new T.Scene(), camera=new T.PerspectiveCamera(60,1,.05,100);
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-10,0,-10,-10,0,10,10,0,-10],3));
 geometry.setIndex([0,1,2]);
 const floor=new T.Mesh(geometry,new T.MeshStandardMaterial());
 floor.name='V2_facade_terraces_and_atrium_roof';scene.add(floor);
 const target=new T.InstancedMesh(new T.BoxGeometry(.2,.2,.2),new T.MeshStandardMaterial(),2);
 const move=(i,x,y,z)=>{target.setMatrixAt(i,new T.Matrix4().makeTranslation(x,y,z));target.instanceMatrix.needsUpdate=true;};
 move(0,-3,-2,-3);move(1,-4,-2,-4);
 camera.position.set(-2,2,-2);camera.updateMatrixWorld();
 const proof=createFloorOcclusion(scene,camera),renderer={info:{render:{frame:1}}};
 const hidden=()=>proof.hidden(renderer.info.render.frame,target.geometry,target.material,target);
 const submit=()=>proof.submitted(renderer,floor.material,null);
 assert.equal(hidden(),false);submit();assert.equal(hidden(),true);
 move(1,8,-2,8);assert.equal(hidden(),false);
 move(1,-4,-2,-4);assert.equal(hidden(),true);
 renderer.info.render.frame++;assert.equal(hidden(),false);
 floor.material.alphaTest=.2;submit();assert.equal(hidden(),false);
 floor.material.alphaTest=0;submit();assert.equal(hidden(),true);
 camera.position.y=-3;camera.updateMatrixWorld();submit();assert.equal(hidden(),false);
 camera.position.y=2;camera.updateMatrixWorld();geometry.setDrawRange(0,0);submit();assert.equal(hidden(),false);
}

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
const drawHistory = {};
assert.equal(outside(clipView, across, clusters, null, material, drawHistory), false);
assert.equal(outside(clipView, across, clusters, {start:48, count:48}, material, drawHistory), true);
clipView.position.x = 35;
clipView.updateMatrixWorld();
assert.equal(outside(clipView, across, clusters, {start:48, count:48}, material, drawHistory), true);
clipView.position.x = 0;
clipView.updateMatrixWorld();
vertices[0] = -100;
across.attributes.position.needsUpdate = true;
assert.equal(outside(clipView, across, clusters, null, material, drawHistory), true);

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
// A large garden surface and its animated rings must disappear only when every
// triangle in every current instance is back-facing.
const surfaceAway = createSurfaceFacingTest();
const surface = new T.PlaneGeometry(4,4,24,24), garden = new T.MeshBasicMaterial({name:'Zen_gravel_grooves'});
const floor = new T.Mesh(surface,garden), rings = new T.InstancedMesh(surface,garden,2);
clipView.position.set(0,0,-3);
clipView.updateMatrixWorld();
assert(surfaceAway(clipView,surface,garden,floor,null));
assert(!surfaceAway(clipView,surface,garden,floor,{start:1,count:3}));
rings.setMatrixAt(0,new T.Matrix4());
rings.setMatrixAt(1,new T.Matrix4().makeRotationY(Math.PI));
assert(!surfaceAway(clipView,surface,garden,rings,null));
rings.setMatrixAt(1,new T.Matrix4().makeTranslation(0,0,1));
assert(surfaceAway(clipView,surface,garden,rings,null));
rings.setMatrixAt(1,new T.Matrix4().makeScale(-1,1,1));
assert(!surfaceAway(clipView,surface,garden,rings,null));
const windingIndex=surface.index.getX(1);
surface.index.setX(1,surface.index.getX(2));
surface.index.setX(2,windingIndex);
surface.index.needsUpdate=true;
assert(!surfaceAway(clipView,surface,garden,floor,null));
// The Deck 6 laundry can show only 895 submitted calls after sparse quad culling
// even though the view passes the 900-draw threshold before culling.
{
 const room=new T.Scene(), eye=new T.PerspectiveCamera(), material=new T.MeshBasicMaterial();
 eye.position.z=-3;eye.updateMatrixWorld();
 const info={render:{frame:1,calls:895}},r={info,shadowMap:{enabled:false},xr:{isPresenting:false},
  getRenderTarget:()=>null,renderBufferDirect(){info.render.calls++;}};
 installQuadFacingTest(r,room,eye);
 const marker=new T.Mesh(new T.PlaneGeometry(),material);
 for(let i=0;i<101;i++)r.renderBufferDirect(eye,room,marker.geometry,material,marker,null);
 assert.equal(info.render.calls,895);room.onAfterRender(r,room,eye);
 const probe=new T.InstancedMesh(new T.BoxGeometry(),material,1);
 probe.setMatrixAt(0,new T.Matrix4().makeTranslation(100,0,-7));info.render.frame++;info.render.calls=0;
 r.renderBufferDirect(eye,room,probe.geometry,material,probe,null);
 assert.equal(info.render.calls,0);
}
console.log('Winding, surface instances, clip bounds, aligned ranges, released arrays and auxiliary views passed.');

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

// A slow mouse turn keeps a visible draw on its staggered schedule. A camera
// jump behind it must still reject the draw on the next frame.
{
 const room=new T.Scene(),eye=new T.PerspectiveCamera(),m=new T.MeshBasicMaterial(),tile=new T.Mesh(new T.PlaneGeometry(),m);
 const info={render:{frame:0,calls:1100}},r={info,shadowMap:{enabled:false},xr:{isPresenting:false},getRenderTarget:()=>null,
  renderBufferDirect(){submitted++;}};
 let submitted=0,tests=0;const determinant=eye.matrixWorld.determinant.bind(eye.matrixWorld);
 eye.matrixWorld.determinant=()=>{tests++;return determinant();};
 installQuadFacingTest(r,room,eye);room.onAfterRender(r,room,eye);
 eye.position.z=2;
 for(let i=0;i<60;i++){
  eye.rotation.y=.04*Math.sin(i*.3);eye.updateMatrixWorld();info.render.frame++;
  r.renderBufferDirect(eye,room,tile.geometry,m,tile,null);room.onAfterRender(r,room,eye);
 }
 assert.equal(submitted,60);assert(tests>0&&tests<30);
 eye.position.z=-2;eye.updateMatrixWorld();info.render.frame++;
 r.renderBufferDirect(eye,room,tile.geometry,m,tile,null);assert.equal(submitted,60);
 eye.near=.001;eye.updateProjectionMatrix();eye.position.z=-.04;eye.updateMatrixWorld();info.render.frame++;
 r.renderBufferDirect(eye,room,tile.geometry,m,tile,null);assert.equal(submitted,60);
 eye.position.z=.04;eye.updateMatrixWorld();info.render.frame++;
 r.renderBufferDirect(eye,room,tile.geometry,m,tile,null);assert.equal(submitted,61);
}
