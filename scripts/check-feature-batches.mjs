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
