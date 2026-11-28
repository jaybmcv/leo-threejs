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
assert(TB.material.onBeforeCompile.cornerShade,'corner shading leaves it alone');
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
  const sharedC=new T.BufferGeometry();for(const k of ['position','normal'])sharedC.setAttribute(k,shared.attributes[k]);sharedC.setAttribute('uv',new T.BufferAttribute(new Uint16Array(n*2).fill(32768),2,true));sharedC.setIndex(shared.index);
  const w2=new T.Scene(),cp=(start,count)=>{const g=new T.BufferGeometry();for(const k of ['position','normal','uv'])g.setAttribute(k,sharedC.attributes[k]);g.setIndex(sharedC.index);g.setDrawRange(start,count);
   g.boundingBox=new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(5,5,5));g.boundingSphere=g.boundingBox.getBoundingSphere(new T.Sphere());const m=new T.Mesh(g,[Kc]);m.name='V2_low_deck_merged_Walk_colour_kind_0';w2.add(m);return m;};
  const P1=cp(0,12),P2=cp(12,12),cdr=await createDrawRuns(w2,renderer,[],{kinds:[{geometry:sharedC,material:Kc,pieces:[P1,P2],runs:2}]}),cb=w2.children.find(o=>o.isBatchedMesh);
  assert(cdr&&cb&&cb.geometry===sharedC&&cb.geometry.attributes.uv===sharedC.attributes.uv,'a colour kind gets its multi-draw, over its arrays with their texel coordinates');
  assert(cb.material.map===Kc.map&&cb.material.emissiveMap===Kc.emissiveMap&&cb.material.roughnessMap===Kc.roughnessMap,'its batch material keeps the kind textures');
  const mk=w2.getObjectByName('V2_draw_run_end');w2.updateMatrixWorld(true);drawn.length=0;const res=[];
  cdr.around(camera,()=>{res.push(renderer.renderBufferDirect(camera,w2,P1.geometry,Kc,P1,g(0,12)));res.push(renderer.renderBufferDirect(camera,w2,P2.geometry,Kc,P2,g(12,12)));
   mk.onBeforeRender(renderer,w2,camera);renderer.renderBufferDirect(camera,w2,mk.geometry,mk.material,mk,null);w2.onAfterRender(renderer,w2,camera);});
  assert(res.every(x=>x===HELD),'its held draws answer HELD');assert.equal(drawn.length,1);
  assert(drawn[0].object===cb&&drawn[0].material===cb.material&&drawn[0].geometry===sharedC&&drawn[0].material.map===Kc.map&&drawn[0].material.emissiveMap===Kc.emissiveMap,'a colour kind’s run is one multi-draw with its textures');
  assert.deepEqual([drawn[0].starts,drawn[0].counts],[[0,48],[12,12]]);}
 console.log('check-draw-runs: deck kinds ok');
}

// Draw-run kinds (`looks`): materials that differ only in colour, glow, roughness and metalness fold in one row, each
// read from its own texel (colour through `map`); a texel a material, shared by its parts; parts of another look or
// shader, drawn with another material than offered, or left alone stay apart; a basic kind reads colour alone; parts
// offered later (offer) fold too.
{
 const drawn=[],renderer={extensions:{has:n=>n==='WEBGL_multi_draw',get:()=>ext},info:{render:{triangles:0}},shadowMap:{enabled:false},xr:{isPresenting:false},domElement:new EventTarget(),
  getRenderTarget:()=>null,renderBufferDirect(camera,scene,geometry,material,object,group){drawn.push({object,material,count:object.isBatchedMesh?object._multiDrawCount:null});}};
 const world=new T.Scene();
 const look=(name,color,roughness=.5,metalness=0,emissive=0,emissiveIntensity=1)=>new T.MeshStandardMaterial({name,color,roughness,metalness,emissive,emissiveIntensity});
 const oak=look('P4_oak',0x8a5a2b,.6),metal=look('P4_metal',0x9aa0a6,.3,.8),sage=look('P4_sage',0x9caf88,.7,0,0x203010,2),lonely=look('P4_lonely',0xff0000),odd=look('P4_odd',0x00ff00);
 odd.side=T.DoubleSide;
 const glowA=new T.MeshBasicMaterial({name:'Glow_a',color:0xffd080}),glowB=new T.MeshBasicMaterial({name:'Glow_b',color:0x80d0ff});
 const box=new T.BoxGeometry(1,1,1),plank=new T.BoxGeometry(2,.1,1);
 const at=(x,y,z)=>new T.Matrix4().makeTranslation(x,y,z);
 const inst=(name,geometry,material,list)=>{const o=new T.InstancedMesh(geometry,material,list.length);o.name=name;list.forEach((m,i)=>o.setMatrixAt(i,m));world.add(o);return o;};
 const a1=inst('a1',box,oak,[at(0,0,-5),at(1,0,-5)]),a2=inst('a2',box,oak,[at(2,0,-5)]),b=inst('b',plank,metal,[at(0,1,-6)]),c=inst('c',box,sage,[at(0,2,-6),at(1,2,-6)]);
 const lone=inst('lone',box,lonely,[at(3,0,-5)]),o1=inst('o1',box,odd,[at(4,0,-5)]),g1=inst('g1',box,glowA,[at(5,0,-5)]),g2=inst('g2',plank,glowB,[at(6,0,-5)]);
 const runs=await createDrawRuns(world,renderer,[{parts:[a1,a2,b,c,lone,o1,g1,g2]}],{looks:true,alone:m=>m===lonely});
 const batches=world.children.filter(o=>o.isBatchedMesh);
 assert.equal(runs.stats.batches,2,'one batch for the oak, metal and sage look, one for the two glows; lonely (alone) and odd (another look) not batched');
 const K=batches.find(o=>o.name==='V2_draw_run P4_oak'),Gb=batches.find(o=>o.name==='V2_draw_run Glow_a');assert(K&&Gb);
 assert(K.material.map&&K.material.roughnessMap&&K.material.emissiveMap,'the kind reads colour, roughness, metalness and glow from its maps');
 assert.equal(K.material.color.getHex(),0xffffff);assert.equal(K.material.roughness,1);assert.equal(K.material.emissive.getHex(),0xffffff);
 assert(Gb.material.map&&!Gb.material.roughnessMap,'a basic kind reads its colour alone');
 assert.equal(K.material.map.image.width,3,'a texel a material (oak, metal, sage), not a part');
 const uvs=new Set(K.geometry.attributes.uv.array.filter((_,i)=>i%2===0));assert.deepEqual([...uvs].sort(),[1/6,.5,5/6].map(Math.fround).sort(),'each part at its material’s texel');
 const marker=world.getObjectByName('V2_draw_run_end');
 const pass=list=>{world.updateMatrixWorld(true);camera.updateMatrixWorld();drawn.length=0;
  runs.around(camera,()=>{for(const e of list){const [o,m]=Array.isArray(e)?e:[e,e.material];renderer.renderBufferDirect(camera,world,o.geometry,m,o,null);}
   marker.onBeforeRender(renderer,world,camera);renderer.renderBufferDirect(camera,world,marker.geometry,marker.material,marker,null);world.onAfterRender(renderer,world,camera);});
  return drawn.map(d=>d.object.isBatchedMesh?d.object.name+'×'+d.count:d.object.name);};
 // oak, oak, metal, sage in a row (three's order: their ids one after another): one draw.
 assert.deepEqual(pass([a1,a2,b,c]),['V2_draw_run P4_oak×4']);assert.equal(runs.stats.folded,3);
 const near=(x,y)=>Math.abs(x-y)<1e-6,C=K.material.map.image.data,L=K.material.roughnessMap.image.data,G=K.material.emissiveMap.image.data;
 const want=[oak,metal,sage];want.forEach((m,k)=>{assert(near(C[k*4],m.color.r)&&near(C[k*4+1],m.color.g)&&near(C[k*4+2],m.color.b),m.name+' colour in its texel');
  assert(near(L[k*4+1],m.roughness)&&near(L[k*4+2],m.metalness),m.name+' roughness and metalness');assert(near(G[k*4],m.emissive.r*m.emissiveIntensity)&&near(G[k*4+1],m.emissive.g*m.emissiveIntensity),m.name+' glow');});
 // Another look between ends the row; the glows fold apart.
 assert.deepEqual(pass([a1,o1,b,g1,g2]),['a1','o1','b','V2_draw_run Glow_a×2']);
 assert(near(Gb.material.map.image.data[4],glowB.color.r),'the second glow’s colour');
 // Colour changed: the texel follows at once.
 metal.color.set(0x112233);pass([a1,b]);assert(near(C[4],metal.color.r)&&near(C[6],metal.color.b));
 // Drawn with another material than it was offered with (even one of the look): draws itself.
 assert.deepEqual(pass([a1,[b,sage],c]),['a1','b','c']);
 // Each material's own corner-shading closure, one program key: still one shader, so it folds; another key does not.
 const hook=()=>{const f=function(s){s.fragmentShader+='//corner';};f.cornerShade=true;f.keepsGeometry=true;return f;},key=function(){return 'corner';};
 for(const m of [oak,metal,sage]){m.onBeforeCompile=hook();m.customProgramCacheKey=key;m.needsUpdate=true;}
 assert.deepEqual(pass([a1,b,c]),['V2_draw_run P4_oak×3'],'own closures, one key');
 metal.customProgramCacheKey=function(){return 'other';};metal.needsUpdate=true;assert.deepEqual(pass([a1,b,c]),['a1','b','c']);
 metal.customProgramCacheKey=key;metal.needsUpdate=true;
 // Its look changed: draws itself; changed back: folds again.
 sage.side=T.DoubleSide;sage.needsUpdate=true;assert.deepEqual(pass([a1,a2,c]),['V2_draw_run P4_oak×2','c']);sage.side=T.FrontSide;sage.needsUpdate=true;
 assert.deepEqual(pass([a1,a2,c]),['V2_draw_run P4_oak×3']);
 // Parts offered later (the reach cabins) fold in batches of their own; a part already offered is left as it was.
 const r1=inst('r1',box,oak,[at(7,0,-5)]),r2=inst('r2',plank,metal,[at(8,0,-5)]);
 await runs.offer([{parts:[r1,r2,a1]}]);
 assert.equal(runs.stats.batches,3,'one batch more');
 assert.deepEqual(pass([r1,r2]),['V2_draw_run P4_oak×2']);assert.notEqual(drawn[0].object,K,'its own batch');
 assert.deepEqual(pass([a1,a2]),['V2_draw_run P4_oak×2']);assert.equal(drawn[0].object,K,'an offered part stays in its batch');
 // Each part's sub-draw reads its own material's texel (the uv at its first index).
 const uvAt=(B,i)=>{const ix=B.geometry.index.array,v=ix[B._multiDrawStarts[i]/ix.BYTES_PER_ELEMENT];return B.geometry.attributes.uv.array[v*2];};
 assert.deepEqual(pass([a1,b,c]),['V2_draw_run P4_oak×3']);assert.deepEqual([0,1,2].map(i=>uvAt(K,i)),[1/6,.5,5/6].map(Math.fround),'oak, metal, sage texels');
 // The copy has a name of its own (the moods find materials by name), kept as the copy follows its original.
 assert.match(K.material.name,/^V2_draw_run_palette_\d+$/);assert.notEqual(K.material.name,oak.name);
 // A value written into the copy (as a mood that found it would): its parts draw themselves until it is put back.
 K.material.emissiveIntensity=4;assert.deepEqual(pass([a1,b,c]),['a1','b','c']);K.material.emissiveIntensity=1;assert.deepEqual(pass([a1,b,c]),['V2_draw_run P4_oak×3']);
 K.material.color.set(0xff0000);assert.deepEqual(pass([a1,b]),['a1','b'],'its colour too');K.material.color.set(0xffffff);
 // The first material given a texture (no look any more): neither it nor the others fold with it.
 oak.map=new T.Texture();oak.needsUpdate=true;assert.deepEqual(pass([a1,a2,b]),['a1','a2','b']);oak.map=null;oak.needsUpdate=true;assert.deepEqual(pass([a1,a2,b]),['V2_draw_run P4_oak×3']);
 // Without looks, the same parts fold by material only.
 const w3=new T.Scene();for(const o of [a1,a2,b,c])w3.add(o.clone());const plainRuns=await createDrawRuns(w3,renderer,[{parts:w3.children.slice()}]);
 assert.equal(plainRuns.stats.batches,1,'oak alone has two parts');
 console.log('check-draw-runs: looks ok');
}
