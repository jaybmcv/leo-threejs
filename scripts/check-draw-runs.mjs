// Draw runs (src/v2/draw-runs.js) on a small scene: which draws of a main pass it holds back and draws as one, in what
// order, what it leaves to draw as before (a row of one, another camera, a render target, a group, a mirrored mesh, a
// changed material), the matrices and instance counts each sub-draw gets, and the facade palette's values.
// node scripts/check-draw-runs.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import {createDrawRuns} from '../src/v2/draw-runs.js';
import {HELD} from '../src/v2/floor-occlusion.js';

const calls={plain:[],instanced:[]},drawn=[];
const ext={multiDrawElementsWEBGL(...a){calls.plain.push(a);},multiDrawElementsInstancedWEBGL(...a){calls.instanced.push(a);}};
let target=null;
const renderer={extensions:{has:n=>n==='WEBGL_multi_draw',get:()=>ext},info:{render:{triangles:0}},shadowMap:{enabled:false},xr:{isPresenting:false},domElement:new EventTarget(),
 getRenderTarget:()=>target,renderBufferDirect(camera,scene,geometry,material,object,group){drawn.push({camera,object,material,group,count:object.isBatchedMesh?object._multiDrawCount:null});}};
const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.1,100),other=new T.PerspectiveCamera(60,1,.1,100);
const P=new T.MeshStandardMaterial({name:'P'}),Q=new T.MeshStandardMaterial({name:'Q'}),glass=new T.MeshStandardMaterial({name:'glass',transparent:true,opacity:.4});
const box=new T.BoxGeometry(1,1,1),plank=new T.BoxGeometry(2,.1,1);
assert(box.groups.length>1,'a geometry with groups (drawn whole with one material)');
const at=(x,y,z)=>new T.Matrix4().makeTranslation(x,y,z);
function instanced(name,geometry,material,matrices,parent=scene){const o=new T.InstancedMesh(geometry,material,matrices.length+1);o.name=name;matrices.forEach((m,i)=>o.setMatrixAt(i,m));o.count=matrices.length;parent.add(o);return o;}
function mesh(name,geometry,material,parent=scene){const o=new T.Mesh(geometry,material);o.name=name;parent.add(o);return o;}
const inst1=instanced('inst1',box,P,[at(0,0,-5),at(1,0,-5),at(2,0,-5)]);
const inst2=instanced('inst2',plank,P,[at(0,1,-6),at(1,1,-6)]);
// An instanced part under a moved, turned and evenly scaled parent: its instances are multiplied into the world.
const turned=new T.Group();turned.position.set(3,0,-7);turned.rotation.y=.6;turned.scale.setScalar(2);scene.add(turned);
const inst3=instanced('inst3',box,P,[at(0,0,0),at(0,1,0)],turned);
const mesh1=mesh('mesh1',plank,P);mesh1.position.set(-2,0,-4);
const mirror=mesh('mirror',plank,P);mirror.scale.set(-1,1,1);mirror.position.set(-3,0,-4);
const q=mesh('q',box,Q),pane=mesh('pane',box,glass);
const cabin=instanced('cabin',box,P,[at(5,0,-5)]);cabin.userData.cabins=true;
// Facade copies: white, vertex colours, differing in roughness, metalness and glow; one of another colour.
const look=(roughness,metalness,emissive,emissiveIntensity,color=0xffffff)=>new T.MeshStandardMaterial({name:'P6_tower_architecture',color,vertexColors:true,roughness,metalness,emissive,emissiveIntensity});
const coloured=g=>{const c=g.clone();c.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(c.attributes.position.count*3).fill(.8),3));return c;};
const towerA=mesh('towerA',coloured(box),look(.3,.1,0x000000,1)),towerB=mesh('towerB',coloured(plank),look(.7,.5,0xff8000,1.5)),towerC=mesh('towerC',coloured(box),look(.3,.1,0,1,0x808080));
const runs=await createDrawRuns(scene,renderer,[{parts:[inst1,inst2,inst3,mesh1,mirror,q,pane,cabin]},{parts:[towerA,towerB,towerC],palette:true}]);
assert(runs,'draw runs made');
assert.equal(runs.stats.batches,2,'P (four parts and the mirrored mesh) and the palette (A and B); Q, glass, C and the cabin part not batched');
const batchOf=name=>scene.children.find(o=>o.isBatchedMesh&&o.name==='V2_draw_run '+name);
const PB=batchOf('P'),TB=batchOf('P6_tower_architecture');assert(PB&&TB);
assert(TB.material.roughnessMap&&TB.material.emissiveMap&&TB.material.roughness===1&&TB.material.metalness===1,'the palette reads its values from its maps');
assert.equal(TB.material.emissive.getHex(),0xffffff);
const marker=scene.getObjectByName('V2_draw_run_end');assert(marker&&marker.parent.renderOrder>=1e9,'the marker sorts after every opaque draw');

// A main pass: the draws three would submit, in order, then the marker and the transparent ones.
// `by`: the camera the draws are made with (another than the main pass's, as a room view's render inside it).
function pass(list,{view=camera,by=view,end=true,around=true}={}){
 scene.updateMatrixWorld(true);view.updateMatrixWorld();by.updateMatrixWorld();drawn.length=0;
 const render=()=>{for(const o of list){const [object,material,group]=Array.isArray(o)?o:[o,o.material,null];renderer.renderBufferDirect(by,scene,object.geometry,material,object,group);}
  if(end){marker.onBeforeRender(renderer,scene,by);renderer.renderBufferDirect(by,scene,marker.geometry,marker.material,marker,null);}
  scene.onAfterRender(renderer,scene,by);};
 if(around)runs.around(view,render);else render();
 return drawn.map(d=>d.object.isBatchedMesh?d.object.name+'×'+d.count:d.object.name);
}
const heads=b=>Array.from(b._indirectTexture.image.data.subarray(0,b._multiDrawCount));
const matrixAt=(b,h)=>new T.Matrix4().fromArray(b._matricesTexture.image.data,h*16);

// One row of four P draws, Q, the palette pair, the glass.
assert.deepEqual(pass([inst1,inst2,inst3,mesh1,q,towerA,towerB,pane]),['V2_draw_run P×4','q','V2_draw_run P6_tower_architecture×2','pane']);
assert.equal(runs.stats.folded,4);assert.equal(runs.stats.runs,2);
assert.equal(drawn[0].material,PB.material,'drawn with the batch copy');
assert.notEqual(PB.material.id,P.id,'a copy has a material id of its own');assert.notEqual(TB.material.id,towerA.material.id);assert.equal(drawn[0].camera,camera);
// three's multi-draw of the batch becomes the instanced one, with each part's instance count, in submission order.
ext.multiDrawElementsWEBGL(4,PB._multiDrawCounts,0,5125,PB._multiDrawStarts,0,PB._multiDrawCount);
assert.deepEqual(Array.from(calls.instanced.at(-1)[6].subarray(0,4)),[3,2,2,1]);
const [h1,h2,h3,h4]=heads(PB);
assert(matrixAt(PB,h1).equals(at(0,0,-5))&&matrixAt(PB,h1+2).equals(at(2,0,-5)),'identity world: the instance matrices as they are');
assert(matrixAt(PB,h2+1).equals(at(1,1,-6)));
const want=new T.Matrix4().multiplyMatrices(inst3.matrixWorld,at(0,1,0)),got=matrixAt(PB,h3+1);
assert(got.elements.every((v,i)=>Math.abs(v-want.elements[i])<1e-6),'a moved parent: its world times each instance');
assert(matrixAt(PB,h4).elements.every((v,i)=>Math.abs(v-mesh1.matrixWorld.elements[i])<1e-6),'a plain mesh: its world matrix');
// The palette's texels: each part's own roughness and metalness, and its glow times its intensity.
const L=TB.material.roughnessMap.image.data,G=TB.material.emissiveMap.image.data;
const near=(a,b)=>Math.abs(a-b)<1e-6;
assert(near(L[1],.3)&&near(L[2],.1)&&near(L[5],.7)&&near(L[6],.5),'roughness in G, metalness in B');
const orange=new T.Color(0xff8000);assert(near(G[4],orange.r*1.5)&&near(G[5],orange.g*1.5)&&near(G[6],0)&&near(G[0],0));
// Each palette part's uv points at its own texel.
const uvs=TB.geometry.attributes.uv.array;assert(uvs.includes(.25)&&uvs.includes(.75),'texel centres of two parts');

// A row of one draws itself; a draw between two parts ends the row.
assert.deepEqual(pass([inst1,q,inst2]),['inst1','q','inst2']);assert.equal(runs.stats.folded,0);
// A mirrored mesh draws itself (three turns its faces round), and ends the row before it.
assert.deepEqual(pass([inst1,inst2,mirror,mesh1,inst3]),['V2_draw_run P×2','mirror','V2_draw_run P×2']);
// The same part twice in a row (never in three's lists): two rows.
assert.deepEqual(pass([inst1,inst2,inst1,inst2]),['V2_draw_run P×2','V2_draw_run P×2']);
// Another camera, a render target, a group, another material, outside the main pass: as before.
assert.deepEqual(pass([inst1,inst2],{by:other}),['inst1','inst2'],'another camera');
target={};assert.deepEqual(pass([inst1,inst2]),['inst1','inst2'],'a render target');target=null;
assert.deepEqual(pass([[inst1,P,{start:0,count:6}],inst2]),['inst1','inst2'],'a group');
assert.deepEqual(pass([[inst1,Q,null],inst2]),['inst1','inst2'],'drawn with another material');
assert.deepEqual(pass([inst1,inst2],{around:false}),['inst1','inst2'],'outside around()');
// The batches' own places in the lists draw nothing; neither does the marker.
assert.deepEqual(pass([PB,inst1,TB]),['inst1']);
// The row still held when the pass ends without the marker draws at the end of the pass.
assert.deepEqual(pass([inst1,inst2],{end:false}),['V2_draw_run P×2']);
// The cabin part, a part that was never offered, draws itself.
assert.deepEqual(pass([cabin,inst1]),['cabin','inst1']);
// A render with another camera inside the pass reaches the marker: the held row waits for the main pass's own end.
drawn.length=0;runs.around(camera,()=>{renderer.renderBufferDirect(camera,scene,inst1.geometry,P,inst1,null);marker.onBeforeRender(renderer,scene,other);renderer.renderBufferDirect(other,scene,q.geometry,Q,q,null);
 renderer.renderBufferDirect(camera,scene,inst2.geometry,P,inst2,null);marker.onBeforeRender(renderer,scene,camera);});
assert.deepEqual(drawn.map(d=>d.object.isBatchedMesh?d.object.name+'×'+d.count:d.object.name),['q','V2_draw_run P×2']);
// A row of one replays with the main camera's view matrices, whatever a render inside the pass left in them.
drawn.length=0;runs.around(camera,()=>{inst1.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse,inst1.matrixWorld);const want=inst1.modelViewMatrix.clone();renderer.renderBufferDirect(camera,scene,inst1.geometry,P,inst1,null);
 inst1.modelViewMatrix.identity();marker.onBeforeRender(renderer,scene,camera);assert(inst1.modelViewMatrix.equals(want));});
// A part whose geometry was swapped, or whose geometry changed, draws itself.
const kept1=mesh1.geometry;mesh1.geometry=box.clone();assert.deepEqual(pass([inst1,mesh1]),['inst1','mesh1']);mesh1.geometry=kept1;assert.deepEqual(pass([inst1,mesh1]),['V2_draw_run P×2']);
mesh1.onBeforeRender=()=>{};assert.deepEqual(pass([inst1,mesh1]),['inst1','mesh1'],'a hook added later');delete mesh1.onBeforeRender;
// Switched off: everything as before.
runs.enabled=false;assert.deepEqual(pass([inst1,inst2]),['inst1','inst2']);runs.enabled=true;

// Instances re-ranked: the new matrices reach the batch, only the changed rows upload.
inst1.setMatrixAt(0,at(9,9,-9));inst1.count=2;inst1.instanceMatrix.needsUpdate=true;PB._matricesTexture.clearUpdateRanges();
pass([inst1,inst2]);
assert(matrixAt(PB,heads(PB)[0]).equals(at(9,9,-9)),'re-ranked matrices copied');assert(PB._matricesTexture.updateRanges.length>0);
assert.equal(calls.instanced.length,1);ext.multiDrawElementsWEBGL(4,PB._multiDrawCounts,0,5125,PB._multiDrawStarts,0,PB._multiDrawCount);
assert.deepEqual(Array.from(calls.instanced.at(-1)[6].subarray(0,2)),[2,2],'its new count');
// More instances than its slots: draws itself.
inst2.count=4;assert.deepEqual(pass([inst1,inst2]),['inst1','inst2']);inst2.count=2;
// A part that moves under a mirror stops folding; back, it folds again.
mesh1.scale.x=-1;assert.deepEqual(pass([inst1,mesh1]),['inst1','mesh1']);mesh1.scale.x=1;assert.deepEqual(pass([inst1,mesh1]),['V2_draw_run P×2']);
// A moved mesh: its new world matrix.
mesh1.position.x=-6;pass([inst1,mesh1]);assert(matrixAt(PB,heads(PB)[1]).elements.every((v,i)=>Math.abs(v-mesh1.matrixWorld.elements[i])<1e-6));

// Palette: a part whose material no longer looks like the batch's draws itself; values that change follow at once.
towerB.material.roughness=.9;towerB.material.emissiveIntensity=2;towerB.material.needsUpdate=true;
assert.deepEqual(pass([towerA,towerB]),['V2_draw_run P6_tower_architecture×2']);assert(near(L[5],.9)&&near(G[4],orange.r*2));
towerB.material.color.set(0x00ff00);towerB.material.needsUpdate=true;assert.deepEqual(pass([towerA,towerB]),['towerA','towerB']);
towerB.material.color.set(0xffffff);towerB.material.needsUpdate=true;assert.deepEqual(pass([towerA,towerB]),['V2_draw_run P6_tower_architecture×2']);
// The batch copy follows its original's own values (not the palette's).
P.roughness=.42;pass([inst1,inst2]);assert.equal(PB.material.roughness,.42);
towerA.material.side=T.DoubleSide;towerA.material.needsUpdate=true;pass([towerA,towerB]);
assert.equal(TB.material.roughness,1,'the palette keeps its own values');
// Its shader: the batch's matrix lookup, its maps on the constant uv.
const shader={vertexShader:'a\n#include <batching_vertex>\nb',fragmentShader:'',uniforms:{}};TB.material.onBeforeCompile(shader,null);
assert.match(shader.vertexShader,/getIndirectIndex\( gl_DrawID \) \+ float\( gl_InstanceID \)/);
assert(TB.material.onBeforeCompile.cornerShade&&TB.material.onBeforeCompile.filmLook,'corner shading and the film look leave it alone');
// An edited attribute: the copy is stale, so its parts draw themselves.
box.attributes.position.needsUpdate=true;assert.deepEqual(pass([inst1,inst3]),['inst1','inst3']);
// A replaced instance matrix buffer of the same count and version: copied again.
const fresh=new T.InstancedBufferAttribute(new Float32Array(inst2.instanceMatrix.array.length),16);for(let i=0;i<2;i++)at(7,7,i).toArray(fresh.array,i*16);fresh.version=inst2.instanceMatrix.version;
inst2.instanceMatrix=fresh;assert.deepEqual(pass([inst2,mesh1]),['V2_draw_run P×2']);assert(matrixAt(PB,heads(PB)[0]).equals(at(7,7,0)));
console.log('check-draw-runs: ok');

// Deck kinds (phone-bands.js): a kind's pieces are slices of one shared index and share one material. A main pass's run
// of their draws is one multi-draw from the kind's own geometry (no copy), a sub-draw per held run clipped to its piece's
// slice, with no matrix lookup; held draws answer HELD; a row of one, another camera, no group or another material draw
// as before.
{
 const drawn=[],renderer={extensions:{has:n=>n==='WEBGL_multi_draw',get:()=>ext},info:{render:{triangles:0}},shadowMap:{enabled:false},xr:{isPresenting:false},domElement:new EventTarget(),
  getRenderTarget:()=>null,renderBufferDirect(camera,scene,geometry,material,object,group){drawn.push({camera,object,material,group,geometry,
   starts:object.isBatchedMesh?Array.from(object._multiDrawStarts.subarray(0,object._multiDrawCount)):null,counts:object.isBatchedMesh?Array.from(object._multiDrawCounts.subarray(0,object._multiDrawCount)):null});}};
 const world=new T.Scene(),shared=new T.BufferGeometry(),n=36;
 shared.setAttribute('position',new T.BufferAttribute(new Float32Array(n*3).map((_,i)=>i%5),3));shared.setAttribute('normal',new T.BufferAttribute(new Float32Array(n*3).fill(1),3));
 shared.setIndex(new T.BufferAttribute(Uint32Array.from({length:n},(_,i)=>i),1));
 const K=new T.MeshStandardMaterial({name:'V2_band_kind_0',vertexColors:false});
 const piece=(start,count)=>{const g=new T.BufferGeometry();for(const k of ['position','normal'])g.setAttribute(k,shared.attributes[k]);g.setIndex(shared.index);g.setDrawRange(start,count);
  g.boundingBox=new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(5,5,5));g.boundingSphere=g.boundingBox.getBoundingSphere(new T.Sphere());const m=new T.Mesh(g,[K]);m.name='V2_low_deck_merged_Walk_finish_kind_0';world.add(m);return m;};
 const A=piece(0,12),B=piece(12,12),C=piece(24,12),plain=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({name:'plain'}));plain.name='plain';world.add(plain);
 const kinds=await createDrawRuns(world,renderer,[],{kinds:[{geometry:shared,material:K,pieces:[A,B,C],runs:5}]});
 assert(kinds,'draw runs made for kinds alone');
 const batch=world.children.find(o=>o.isBatchedMesh);
 assert(batch&&batch.geometry===shared&&batch.geometry.index===shared.index,'the kind batch draws from the kind arrays');
 assert.equal(batch._multiDrawStarts.length,5,'its lists hold every run of the kind');
 const sh={vertexShader:'a\n#include <batching_vertex>\nb',fragmentShader:'',uniforms:{}};batch.material.onBeforeCompile(sh,null);
 assert.match(sh.vertexShader,/batchingMatrix = mat4\( 1\.0 \)/);assert.doesNotMatch(sh.vertexShader,/getIndirectIndex/);
 const marker=world.getObjectByName('V2_draw_run_end');
 const run=(list,{view=camera,by=view}={})=>{world.updateMatrixWorld(true);drawn.length=0;const results=[];
  kinds.around(view,()=>{for(const [o,group,m=o.material[0]] of list)results.push(renderer.renderBufferDirect(by,world,o.geometry,m,o,group));
   marker.onBeforeRender(renderer,world,by);renderer.renderBufferDirect(by,world,marker.geometry,marker.material,marker,null);world.onAfterRender(renderer,world,by);});
  return {results,drawn:drawn.map(d=>d.object.isBatchedMesh?'batch '+d.starts.join(',')+' / '+d.counts.join(','):d.object.name+(d.group?'@'+d.group.start:''))};};
 const g=(start,count)=>({start,count,materialIndex:0});
 // A's two runs, B's one, C's run reaching back before its slice (clipped to it).
 let r=run([[A,g(0,6)],[A,g(6,6)],[B,g(12,12)],[C,g(18,18)]]);
 assert.deepEqual(r.drawn,['batch 0,24,48,96 / 6,6,12,12']);assert(r.results.every(x=>x===HELD),'held draws answer HELD');
 assert.equal(kinds.stats.folded,3);assert.equal(drawn[0].material,batch.material);assert.equal(drawn[0].geometry,shared);
 // In the kind's own order (index order), whatever order the camera's sort gave.
 r=run([[C,g(24,12)],[B,g(12,12)],[A,g(6,6)],[A,g(0,6)]]);assert.deepEqual(r.drawn,['batch 0,24,48,96 / 6,6,12,12']);
 // A row of one draws itself, with its group.
 r=run([[B,g(12,12)]]);assert.deepEqual(r.drawn,['V2_low_deck_merged_Walk_finish_kind_0@12']);
 // Another draw between ends the row: A then C draw themselves, around it.
 r=run([[A,g(0,12)],[plain,null,plain.material],[C,g(24,12)]]);assert.deepEqual(r.drawn,['V2_low_deck_merged_Walk_finish_kind_0@0','plain','V2_low_deck_merged_Walk_finish_kind_0@24']);
 // Another camera inside the pass, no group, or another material: as before.
 r=run([[A,g(0,12)],[B,g(12,12)]],{by:other});assert.deepEqual(r.drawn,['V2_low_deck_merged_Walk_finish_kind_0@0','V2_low_deck_merged_Walk_finish_kind_0@12']);
 r=run([[A,null],[B,null]]);assert.deepEqual(r.drawn,['V2_low_deck_merged_Walk_finish_kind_0','V2_low_deck_merged_Walk_finish_kind_0']);
 r=run([[A,g(0,12),P],[B,g(12,12)]]);assert.deepEqual(r.drawn,['V2_low_deck_merged_Walk_finish_kind_0@0','V2_low_deck_merged_Walk_finish_kind_0@12']);
 // A run wholly outside its piece's slice adds no sub-draw.
 r=run([[A,g(0,12)],[B,g(30,6)],[C,g(24,12)]]);assert.deepEqual(r.drawn,['batch 0,96 / 12,12']);
 // Switched off: one by one.
 kinds.enabled=false;r=run([[A,g(0,12)],[B,g(12,12)]]);assert.equal(r.drawn.length,2);kinds.enabled=true;
 // A colour kind (its material reads colour and glow through map and emissiveMap) is batched the same way: its batch's
 // material keeps the kind's textures.
 {const tex=()=>new T.DataTexture(new Float32Array(12),3,1,T.RGBAFormat,T.FloatType),Kc=new T.MeshStandardMaterial({name:'V2_band_colour_kind_0'});
  Kc.map=tex();Kc.emissiveMap=tex();Kc.roughnessMap=Kc.metalnessMap=tex();
  const w2=new T.Scene(),cp=(start,count)=>{const g=new T.BufferGeometry();for(const k of ['position','normal'])g.setAttribute(k,shared.attributes[k]);g.setIndex(shared.index);g.setDrawRange(start,count);
   g.boundingBox=new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(5,5,5));g.boundingSphere=g.boundingBox.getBoundingSphere(new T.Sphere());const m=new T.Mesh(g,[Kc]);m.name='V2_low_deck_merged_Walk_colour_kind_0';w2.add(m);return m;};
  const cdr=await createDrawRuns(w2,renderer,[],{kinds:[{geometry:shared,material:Kc,pieces:[cp(0,12),cp(12,12)],runs:2}]}),cb=w2.children.find(o=>o.isBatchedMesh);
  assert(cdr&&cb&&cb.geometry===shared,'a colour kind gets its multi-draw');
  assert(cb.material.map===Kc.map&&cb.material.emissiveMap===Kc.emissiveMap&&cb.material.roughnessMap===Kc.roughnessMap,'its batch material keeps the kind textures');}
 console.log('check-draw-runs: deck kinds ok');
}
