import {cullByBox} from '../src/v2/box-frustum.js';
import {installWalkDrawBounds,rememberDeckRuns} from '../src/v2/walk-draw-bounds.js';
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
// Only authored deck merges participate. The submitted group's interval and current transform
// decide visibility even when several bands share one geometry or the group is edited in place.
{
 const world=new T.Scene(),view=new T.PerspectiveCamera(68,1,.1,100),alt=view.clone();
 view.updateProjectionMatrix();view.updateMatrixWorld();alt.updateMatrixWorld();
 let target=null,submitted=0;
 const gpu={shadowMap:{enabled:false},getRenderTarget:()=>target,renderBufferDirect(){submitted++;}};
 const filter=installWalkDrawBounds(gpu,world),mat=new T.MeshBasicMaterial();
 const positions=[-100,-1,-4,-99,0,-4,-100,1,-4,99,-1,-4,100,0,-4,99,1,-4];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex([0,1,2,3,4,5]);
 const deck=new T.Mesh(g,[mat]),ordinary=new T.Mesh(g,mat);world.add(deck,ordinary);
 rememberDeckRuns(deck,[{start:0,count:3},{start:3,count:3}]);
 const group={start:0,count:6,materialIndex:0};
 const submit=(camera=view,object=deck)=>gpu.renderBufferDirect(camera,world,object.geometry,mat,object,group);
 function draws(camera=view,object=deck){world.updateMatrixWorld(true);const before=submitted;filter.around(view,()=>submit(camera,object));return submitted-before;}
 assert.equal(draws(),0);assert.equal(draws(),0);assert.equal(draws(),0);assert.equal(draws(view,ordinary),1);assert.equal(draws(alt),1);
 group.start=1;group.count=3;assert.equal(draws(),1);group.start=0;group.count=6;
 deck.position.x=-99;assert.equal(draws(),1);group.count=3;assert.equal(draws(),0);group.count=6;
 g.setDrawRange(0,3);assert.equal(draws(),0);g.setDrawRange(3,3);assert.equal(draws(),1);g.setDrawRange(0,Infinity);
 deck.position.x=100;assert.equal(draws(),1);deck.scale.x=-1;assert.equal(draws(),1);
 deck.scale.x=1;deck.position.x=0;assert.equal(draws(),0);
 view.position.x=100;view.updateMatrixWorld(true);assert.equal(draws(),1);view.position.x=0;view.updateMatrixWorld(true);assert.equal(draws(),0);
 mat.wireframe=true;assert.equal(draws(),1);mat.wireframe=false;mat.displacementMap=new T.Texture();assert.equal(draws(),1);mat.displacementMap=null;
 deck.onBeforeRender=()=>{};assert.equal(draws(),1);deck.onBeforeRender=T.Object3D.prototype.onBeforeRender;
 target={};assert.equal(draws(),1);target=null;gpu.shadowMap.enabled=true;assert.equal(draws(),1);gpu.shadowMap.enabled=false;
 filter.around(view,()=>{target={};const before=submitted;submit();assert.equal(submitted,before+1);target=null;});
 filter.around(view,()=>{
  filter.around(alt,()=>filter.around(alt,()=>{const before=submitted;submit(alt);assert.equal(submitted,before+1);}));
  const before=submitted;submit();assert.equal(submitted,before);
 });
 g.attributes.position.needsUpdate=true;assert.equal(draws(),1);
 rememberDeckRuns(deck,[{start:0,count:3},{start:3,count:3}]);assert.equal(draws(),0);
 g.setIndex([0,1,3]);assert.equal(draws(),1);
}
console.log('PASS exact merged deck ranges, group and transform changes, both camera paths and offscreen or nested draws');
