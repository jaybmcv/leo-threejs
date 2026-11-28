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

// Feature kinds (look-kinds.js): parts whose materials differ only in colour, glow, roughness and metalness share one batch.
{
 const s=new T.Scene(),b=new T.Group(),root=new T.Group();b.name='Walk_band_kinds';s.add(b);b.add(root);root.position.z=-6;
 const mats=[[0xff0000,.2,.1,0x102030,1],[0x00ff00,.5,0,0x000000,1],[0x3366cc,.9,.4,0xffffff,.25]].map(([color,roughness,metalness,emissive,emissiveIntensity])=>new T.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity}));
 const apart=new T.MeshStandardMaterial({side:T.DoubleSide}),textured=new T.MeshStandardMaterial({map:new T.Texture()}),lonely=new T.MeshStandardMaterial({color:0x808080,flatShading:true});
 const box=new T.BoxGeometry(),ball=new T.SphereGeometry(.5,8,6),bare=new T.BoxGeometry();bare.deleteAttribute('uv');
 // Added out of id order: the batch must draw them in id order.
 const plan=[[box,mats[2]],[ball,mats[0]],[box,mats[1]],[bare,mats[0]],[box,apart],[box,apart],[box,textured],[box,textured],[box,lonely],[bare,lonely]];
 const parts=plan.map(([g,m],i)=>{const o=new T.Mesh(g,m);o.position.x=i*.4-2;root.add(o);return o;});
 const kinds=await createFeatureBatches(s,renderer,[root],{kinds:true,alone:m=>m===textured});
 assert.equal(kinds.stats.kinds,1);assert.equal(kinds.stats.kindMaterials,3);
 // The kind, the side-apart material's batch and the textured one's; the lonely material's two parts differ in uv, so stay apart.
 assert.equal(kinds.stats.batches,3);
 const kind=kinds.kinds[0],K=kind.material,batch=s.children.find(o=>o.isBatchedMesh&&o.material===K);
 assert.deepEqual(kind.materials,[...mats].sort((a,b)=>a.id-b.id));
 assert.equal(K.id,Math.min(...mats.map(m=>m.id)),'the kind sorts where its first member did');
 assert(/^Walk_feature_batch_kind_\d+$/.test(batch.name)&&!/facade|hull|exterior|skin|sky|glass|window|haze|water/i.test(batch.name));
 // White, glowing white at intensity 1, roughness and metalness 1; float32 nearest texels with no colour-space conversion.
 assert(K.color.equals(new T.Color(1,1,1))&&K.emissive.equals(new T.Color(1,1,1))&&K.emissiveIntensity===1&&K.roughness===1&&K.metalness===1);
 for(const t of [K.map,K.emissiveMap,K.roughnessMap,K.metalnessMap]){assert(t?.isDataTexture&&t.type===T.FloatType&&t.magFilter===T.NearestFilter&&t.minFilter===T.NearestFilter&&t.colorSpace===T.NoColorSpace&&!t.matrixAutoUpdate);}
 assert.equal(K.roughnessMap,K.metalnessMap);
 const f=Math.fround;
 kind.materials.forEach((m,k)=>{const c=K.map.image.data,e=K.emissiveMap.image.data,l=K.roughnessMap.image.data,i=k*4;
  assert.deepEqual([c[i],c[i+1],c[i+2],c[i+3]],[f(m.color.r),f(m.color.g),f(m.color.b),1]);
  assert.deepEqual([e[i],e[i+1],e[i+2]],[f(m.emissive.r*m.emissiveIntensity),f(m.emissive.g*m.emissiveIntensity),f(m.emissive.b*m.emissiveIntensity)]);
  assert.deepEqual([l[i+1],l[i+2]],[f(m.roughness),f(m.metalness)]);});
 // Each instance's vertices sit at its own material's texel, in the materials' id order.
 const uv=batch.geometry.attributes.uv,n=kind.width,seen=[];
 for(let i=0;i<4;i++){const info=batch._geometryInfo[batch._instanceInfo[i].geometryIndex],u=uv.getX(info.vertexStart);
  for(let v=info.vertexStart;v<info.vertexStart+info.vertexCount;v++)assert.equal(uv.getX(v),u);seen.push(Math.floor(u*n));}
 assert.deepEqual(seen,[0,0,1,2]);
 // Another call (the lifts' after the features') with parts of that look shares the kind: one material, one id.
 const again=new T.Group();b.add(again);again.position.z=-6;const late=new T.MeshStandardMaterial({color:0x445566});
 for(const m of [mats[0],late])again.add(new T.Mesh(box,m));
 const other=await createFeatureBatches(s,renderer,[again],{kinds:true});
 assert.equal(other.kinds[0],kind);assert(s.children.filter(o=>o.isBatchedMesh&&o.material===K).length===2);
 assert.equal(kind.index.get(late),3,'a later member takes the next texel');b.remove(again);
 // A kind with no room left: the next is a kind of its own, at the lowest id no kind has taken.
 {const many=Array.from({length:256},(_,i)=>new T.MeshBasicMaterial({color:i*0x010101,fog:false})),root2=new T.Group();b.add(root2);
  for(const m of many)root2.add(new T.Mesh(box,m));const full=await createFeatureBatches(s,renderer,[root2],{kinds:true});
  const extra=new T.MeshBasicMaterial({color:0x123456,fog:false}),root3=new T.Group();b.add(root3);root3.add(new T.Mesh(box,many[0]),new T.Mesh(box,extra));
  const next=await createFeatureBatches(s,renderer,[root3],{kinds:true});
  assert.notEqual(next.kinds[0],full.kinds[0]);assert.equal(full.kinds[0].material.id,many[0].id);assert.equal(next.kinds[0].material.id,extra.id,'the first free id');
  b.remove(root2,root3);}
 const draw=fn=>{s.updateMatrixWorld(true);kinds.around(camera,()=>{s.onBeforeRender(renderer,s,camera,null);fn();});assert(parts.every(o=>o.visible));};
 draw(()=>{assert(batch.visible);assert.deepEqual(parts.slice(0,4).map(o=>o.visible),[false,false,false,false]);assert.equal(kinds.stats.apart,0);});
 // A changed colour shows in its texel at the next pass.
 mats[1].color.setRGB(.25,.5,.75);draw(()=>{});{const k=kind.index.get(mats[1]),c=K.map.image.data;assert.deepEqual([c[k*4],c[k*4+1],c[k*4+2]],[.25,.5,.75]);}
 // A member that no longer has the kind's look draws itself; the others stay batched.
 mats[1].side=T.DoubleSide;mats[1].needsUpdate=true;
 draw(()=>{assert(parts[2].visible);assert(!parts[0].visible&&!parts[1].visible&&!parts[3].visible);assert.equal(kinds.stats.apart,1);});
 mats[1].side=T.FrontSide;mats[1].needsUpdate=true;draw(()=>assert(!parts[2].visible));
 // So does one whose hooks differ from the kind's, which are always its first member's (corner shading on it alone).
 const hook=function(){};hook.cornerShade=true;hook.keepsGeometry=true;mats[2].onBeforeCompile=hook;
 draw(()=>{assert(parts[0].visible);assert(!parts[1].visible&&!parts[2].visible&&!parts[3].visible);});
 delete mats[2].onBeforeCompile;K.onBeforeCompile=hook;draw(()=>{assert(!parts[0].visible);assert.equal(K.onBeforeCompile,mats[0].onBeforeCompile,"the kind takes its first member's hooks back");});
 // A kind whose own material no longer holds one for what it reads from its textures lets every part draw itself.
 K.roughness=.5;draw(()=>{assert(!batch.visible);assert(parts.slice(0,4).every(o=>o.visible));});K.roughness=1;
 // Corner shading may wrap the members before the kind is made, then members and kind again, each with a closure of its
 // own and the kind last: the kind takes its first member's hooks back.
 {const corner=()=>{const h=function(){};h.cornerShade=true;h.keepsGeometry=true;return h;};
  const a=new T.MeshStandardMaterial({color:0x111111,flatShading:true}),c=new T.MeshStandardMaterial({color:0x222222,flatShading:true});
  for(const m of [a,c])m.onBeforeCompile=corner();
  const r4=new T.Group();b.add(r4);r4.position.z=-6;r4.add(new T.Mesh(box,a),new T.Mesh(box,c));
  const wrapped=await createFeatureBatches(s,renderer,[r4],{kinds:true}),W=wrapped.kinds[0];
  for(const m of [a,c,W.material])m.onBeforeCompile=corner();W.material.onBeforeCompile=corner();
  s.updateMatrixWorld(true);wrapped.around(camera,()=>{s.onBeforeRender(renderer,s,camera,null);assert(r4.children.every(o=>!o.visible),'every part batched');});
  assert.equal(W.material.onBeforeCompile,a.onBeforeCompile);b.remove(r4);}
 // Without kinds every material batches on its own, as before.
 const s2=new T.Scene(),b2=new T.Group(),r2=new T.Group();b2.name='Walk_band_plain';s2.add(b2);b2.add(r2);
 for(const m of [mats[0],mats[0],mats[1],mats[1]])r2.add(new T.Mesh(box,m));
 const plain=await createFeatureBatches(s2,renderer,[r2]);assert.equal(plain.stats.kinds,0);assert.equal(plain.stats.batches,2);
 assert(s2.children.filter(o=>o.isBatchedMesh).every(o=>mats.includes(o.material)));
}
// A basic material's kind reads only its colour.
{
 const s=new T.Scene(),b=new T.Group(),root=new T.Group();b.name='Walk_band_glow';s.add(b);b.add(root);
 for(const c of [0xff8800,0x0088ff])root.add(new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial({color:c})));
 const glow=await createFeatureBatches(s,renderer,[root],{kinds:true});const K=glow.kinds[0].material;
 assert(K.isMeshBasicMaterial&&K.map&&!K.emissiveMap&&!K.roughnessMap&&K.color.equals(new T.Color(1,1,1)));
}
console.log('PASS feature kinds: one batch a look, texels as the uniforms, id order, parts apart on drift or other hooks');

// Furnishing kinds (furnishing-batches.js): rare furnishings whose materials differ only in colour, glow, roughness and
// metalness share one batch, each at its own material's texel, in the order their materials were met.
{
 const {batchFurnishing}=await import('../src/v2/furnishing-batches.js');
 const live=new T.Group(),box=new T.BoxGeometry(),ball=new T.SphereGeometry(.5,8,6);
 const looks=[0xaa3300,0x00aa33,0x3300aa].map((color,i)=>new T.MeshStandardMaterial({color,roughness:.3+i*.2,emissive:color,emissiveIntensity:i*.5}));
 const own=new T.MeshStandardMaterial({flatShading:true}),skipped=new T.MeshStandardMaterial();skipped.name='P4_window_frame';
 const furnish=(g,m,n)=>{const o=new T.InstancedMesh(g,m,n);o.userData.phase4=true;for(let i=0;i<n;i++)o.setMatrixAt(i,new T.Matrix4().makeTranslation(i,0,0));live.add(o);return o;};
 const rare=[furnish(box,looks[1],2),furnish(ball,looks[0],1),furnish(box,looks[2],3),furnish(ball,looks[1],1),furnish(box,own,2),furnish(ball,own,1),furnish(box,skipped,1),furnish(ball,skipped,2)];
 const common=furnish(box,looks[0],40);
 const alone=m=>/window/.test(m.name);
 const proof=batchFurnishing(live,renderer,{kinds:true,alone});
 assert.equal(proof.looks,1);assert.equal(proof.lookMaterials,3);
 // The kind, `own`'s batch and the skipped material's; the common kind stays instanced.
 assert.equal(proof.batches,3);assert(common.visible);
 const batches=live.children.filter(o=>o.isBatchedMesh),kind=proof.looksList[0],K=kind.material,batch=batches.find(o=>o.material===K);
 assert(/^V2_furnishing_batch_kind_\d+$/.test(batch.name)&&batch.userData.phase4Batch);
 assert.deepEqual(kind.materials,[looks[1],looks[0],looks[2]],'met in that order');
 assert(K.map&&K.emissiveMap&&K.roughnessMap&&K.color.equals(new T.Color(1,1,1))&&K.roughness===1);
 assert(batches.some(o=>o.material!==K&&o.material.name==='P4_window_frame'),'a material left alone keeps its own batch');
 // Instances in the order of their materials (as their batches drew), each at its material's texel.
 const uv=batch.geometry.attributes.uv,texels=[];
 for(let i=0;i<batch._instanceInfo.length;i++){const info=batch._geometryInfo[batch._instanceInfo[i].geometryIndex];texels.push(Math.floor(uv.getX(info.vertexStart)*3));}
 assert.deepEqual(texels,[0,0,0,1,2,2,2]);
 // Room culling's choice still reaches the batch; the texels follow their materials.
 rare[2].userData.furnishingBatch([1],rare[2].instanceMatrix.array);assert(batch.visible);
 looks[2].emissiveIntensity=2;proof.follow();{const e=K.emissiveMap.image.data,k=kind.index.get(looks[2]);assert.equal(e[k*4+2],Math.fround(looks[2].emissive.b*2));}
 // A material that stops matching is counted and warned of once.
 const warn=console.warn;let warned=0;console.warn=()=>warned++;
 looks[0].side=T.DoubleSide;for(let i=0;i<120;i++)proof.follow();console.warn=warn;
 assert.equal(proof.drift,1);assert.equal(warned,1);
 // Without kinds, one batch a material, as before.
 const plainLive=new T.Group();for(const [g,m] of [[box,looks[0]],[ball,looks[0]],[box,looks[1]],[ball,looks[1]]]){const o=new T.InstancedMesh(g,m,1);o.userData.phase4=true;plainLive.add(o);}
 const before=batchFurnishing(plainLive,renderer);assert.equal(before.looks,0);assert.equal(before.batches,2);
}
console.log('PASS furnishing kinds: one batch a look in the order met, apart when left alone, texels follow, drift counted');
