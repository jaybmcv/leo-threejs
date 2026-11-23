import {cullByBox} from '../src/v2/box-frustum.js';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createFeatureBatches} from '../src/v2/feature-batches.js';

const scene=new T.Scene(),band=new T.Group(),vehicle=new T.Group();
band.name='Walk_band_1';scene.add(band);band.add(vehicle);
const camera=new T.PerspectiveCamera(60,1,.1,100);
const renderer={extensions:{has:()=>true},shadowMap:{enabled:false}};
const material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry();
const sources=Array.from({length:6},(_,i)=>{
 const o=new T.Mesh(geometry,material);o.position.set(i*.6-1,0,-8);vehicle.add(o);return o;
});
const feature=await createFeatureBatches(scene,renderer,[vehicle]);
assert.equal(feature.stats.sources,6);
const batch=scene.children.find(o=>o.isBatchedMesh);
function check(expected,inspect){
 scene.updateMatrixWorld(true);camera.updateMatrixWorld();
 const prior=sources.map(o=>o.visible);
 feature.around(camera,()=>{
  scene.onBeforeRender(renderer,scene,camera,null);
  assert.equal(batch.visible,expected.length>1);
  for(let i=0;i<sources.length;i++)assert.equal(sources[i].visible,prior[i]&&!expected.includes(i));
  inspect?.();
 });
 assert.deepEqual(sources.map(o=>o.visible),prior);assert.equal(batch.visible,false);
}
check([0,1,2,3,4,5]);
sources.forEach((o,i)=>o.visible=i===0);check([]); // Retire the idle batch on its next submission.
sources.forEach((o,i)=>o.visible=i===2||i===3);
check([2,3],()=>assert.deepEqual(sources.map((_,i)=>batch.getVisibleAt(i)),[false,false,true,true,false,false]));
sources.forEach(o=>o.visible=true);check([0,1,2,3,4,5]);
sources[0].visible=false;sources[1].layers.set(2);sources[2].position.x=1000;
sources[3].add(new T.Object3D());sources[4].position.x=.5;
check([4,5],()=>{const m=new T.Matrix4();batch.getMatrixAt(4,m);assert(m.equals(sources[4].matrixWorld));});
sources[4].scale.x=-1;check([]);
sources[4].scale.x=1;vehicle.visible=false;check([]);vehicle.visible=true;
material.transparent=true;check([]);material.transparent=false;
material.depthWrite=false;check([]);material.depthWrite=true;
vehicle.renderOrder=3;check([]);vehicle.renderOrder=0;
const lod=new T.LOD();vehicle.add(lod);lod.add(sources[4]);check([]);vehicle.add(sources[4]);
const otherRoot=new T.Group();band.add(otherRoot);otherRoot.add(sources[4]);check([]);vehicle.add(sources[4]);
sources[4].matrixAutoUpdate=false;sources[4].matrix.elements[4]=.35;check([]);
sources[4].matrixAutoUpdate=true;
camera.layers.set(2);check([]);camera.layers.set(0);
material.normalMap=new T.Texture();material.normalMapType=T.ObjectSpaceNormalMap;check([]);
material.normalMap=null;material.normalMapType=T.TangentSpaceNormalMap;
renderer.shadowMap.enabled=true;check([]);renderer.shadowMap.enabled=false;
scene.overrideMaterial=new T.MeshNormalMaterial();check([]);scene.overrideMaterial=null;
feature.around(camera,()=>{scene.onBeforeRender(renderer,scene,new T.PerspectiveCamera(),null);assert(!batch.visible);});
assert.throws(()=>feature.around(camera,()=>{scene.onBeforeRender(renderer,scene,camera,null);throw new Error('draw failed');}),/draw failed/);
assert.equal(sources[4].visible,true);assert.equal(batch.visible,false);
geometry.attributes.position.needsUpdate=true;check([]);
assert.equal(await createFeatureBatches(scene,{extensions:{has:()=>false}},[vehicle]),null);
console.log('PASS feature multi-draw respects transforms, live visibility, camera, material, fallback and failed draws');

// Long equipment parts can have a sphere in view while their entire box is offscreen.
{
 cullByBox();
 const s=new T.Scene(),b=new T.Group(),r=new T.Group();b.name='Walk_band_far';s.add(b);b.add(r);
 const g=new T.BoxGeometry(.1,40,.1),m=new T.MeshBasicMaterial();
 for(const x of [8,9,10]){const o=new T.Mesh(g,m);o.position.set(x,0,-5);r.add(o);}
 s.updateMatrixWorld(true);const equipment=await createFeatureBatches(s,renderer,[r]);
 equipment.around(camera,()=>{s.onBeforeRender(renderer,s,camera,null);assert.equal(equipment.stats.active,0);});
 assert(r.children.every(o=>o.visible));
}
// A two-part feature can share its draw. Both source meshes retain their own transform and
// visibility, and return to the normal path when their parent leaves the registered root.
{
 const s=new T.Scene(),b=new T.Group(),root=new T.Group(),parent=new T.Group();b.name='Walk_band_pair';s.add(b);b.add(root);root.add(parent);root.position.z=-5;
 const m=new T.MeshBasicMaterial(),g=new T.BoxGeometry(),parts=[new T.Mesh(g,m),new T.Mesh(g,m)];parent.add(...parts);
 const controller=await createFeatureBatches(s,renderer,[root]);assert.equal(controller.stats.sources,2);
 function checkPair(count){s.updateMatrixWorld(true);controller.around(camera,()=>{s.onBeforeRender(renderer,s,camera,null);assert.equal(parts.filter(o=>!o.visible).length,count);});assert(parts.every(o=>o.visible));}
 checkPair(2);parent.visible=false;checkPair(0);parent.visible=true;parent.renderOrder=1;checkPair(0);parent.renderOrder=0;root.position.x=100;checkPair(0);root.position.x=0;parent.remove(parts[0]);s.add(parts[0]);checkPair(0);
}
console.log('PASS two-part equipment collection, parent visibility and existing box-aware frustum culling');

// Painting frames can share one material across scene roots that span different decks.
{
 const s=new T.Scene(),g=new T.BoxGeometry(),m=new T.MeshBasicMaterial();
 const roots=[-1,0,1].map(x=>{const root=new T.Group();root.position.set(x,0,-5);root.add(new T.Mesh(g,m));s.add(root);return root;});
 const controller=await createFeatureBatches(s,renderer,roots);
 function painted(count){
  s.updateMatrixWorld(true);
  controller.around(camera,()=>{s.onBeforeRender(renderer,s,camera,null);assert.equal(roots.filter(root=>!root.children[0].visible).length,count);});
  assert(roots.every(root=>root.children[0].visible));
 }
 painted(3);roots[0].visible=false;painted(2);roots[1].position.x=1000;painted(0);
 roots[0].visible=true;painted(2);s.remove(roots[2]);painted(0);
}
console.log('PASS painting frames retain independent deck, frustum and parent visibility');
