// The owner bake's view of a walk scene (scripts/walk-owner-bake.scene.js): which triangles may hide things, on what
// condition, and which parts may be hidden.
import assert from 'node:assert/strict';
import * as T from 'three';
import {collectOccluders,collectTargets,rowDigests,tablesDiffer,withoutMoved} from './walk-owner-bake.scene.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const quad=(x=0,z=0,mat=new T.MeshStandardMaterial({name:'wall'}),name='Wall')=>{const m=new T.Mesh(new T.PlaneGeometry(2,2),mat);m.name=name;m.position.set(x,1,z);return m;};
// A band whose merged sources sit in its _merged_sources group, and a merged piece (twice: a split merge) listing them.
function ship(){
 const scene=new T.Scene(),band=new T.Group();band.name='Walk_band_3';scene.add(band);
 const kept=new T.Group();kept.name='Walk_band_3_merged_sources';kept.visible=false;kept.userData={mergedSources:true};band.add(kept);
 const s1=quad(0,-5),s2=quad(3,-5);kept.add(s1,s2);
 const root=new T.Group();root.name='V2_phone_band_merges';scene.add(root);
 const piece=()=>{const g=new T.PlaneGeometry(4,2).toNonIndexed();const m=new T.Mesh(g,[new T.MeshStandardMaterial({name:'merged'})]);m.name='V2_low_deck_merged_wall';m.userData={sources:[s1.uuid,s2.uuid]};m.position.set(20,1,0);return m;};
 root.add(piece(),piece());scene.updateMatrixWorld(true);return {scene,band,root,s1,s2};
}

{const w=ship(),o=collectOccluders(w.scene);assert.equal(o.stats.sources,2);assert.equal(o.positions.length,(2*2)*9);pass('a merge source counts once however many pieces list it');
 const bandCond=o.conditions.findIndex(c=>c[0].includes('Walk_band_3')&&!c[0].includes('merged_sources'));assert.ok(o.bandConds.has(bandCond));assert.equal(JSON.parse(o.conditions[o.mergeRoot][0])[0][0],'V2_phone_band_merges');
 assert.ok([...o.conds].every(k=>k===bandCond));pass('its triangles depend on its band, and the band on the merged pieces\' root');}
{const scene=new T.Scene();const see=[new T.MeshStandardMaterial({transparent:true,opacity:.5}),new T.MeshStandardMaterial({alphaTest:.5}),new T.ShaderMaterial(),new T.MeshPhysicalMaterial({transmission:1}),new T.MeshStandardMaterial({colorWrite:false}),new T.MeshBasicMaterial({alphaToCoverage:true}),new T.MeshStandardMaterial({alphaHash:true}),new T.MeshBasicMaterial({blending:T.AdditiveBlending}),new T.MeshStandardMaterial({depthFunc:T.NeverDepth}),new T.MeshStandardMaterial({stencilWrite:true})];
 see.forEach((m,i)=>scene.add(quad(i*3,0,m,'Glass'+i)));scene.updateMatrixWorld(true);const o=collectOccluders(scene);assert.equal(o.positions.length,0);assert.equal(o.stats.skippedMaterials,see.length);
 assert.equal(o.conditions.length,0,'a mesh with no wall triangle adds no condition (a moving one would split the pages\' tables)');
 pass('see-through, cut-out, hashed, additive, refracting and custom-shaded surfaces are not occluders, nor conditions');}
{const scene=new T.Scene(),plain=quad(0,0),mirror=quad(4,0);mirror.scale.x=-1;scene.add(plain,mirror);scene.updateMatrixWorld(true);const o=collectOccluders(scene),p=o.positions;
 const normal=f=>{const v=i=>new T.Vector3(p[f*9+i*3],p[f*9+i*3+1],p[f*9+i*3+2]);return new T.Vector3().subVectors(v(1),v(0)).cross(new T.Vector3().subVectors(v(2),v(0))).normalize();};
 assert.ok(normal(0).z>.99&&normal(2).z>.99,'both face +z as drawn');pass('a mirrored mesh is stored with the face three draws in front');}
{const scene=new T.Scene(),door=quad(0,0,undefined,'Lounge_door'),lift=new T.Group();lift.name='Walk_lift_core';lift.add(quad(3,0,undefined,'Panel'));
 const lever=quad(6,0,undefined,'Lever_panel_arm');// swings when pulled, and settles after load at a moment that differs page to page
 const panel=new T.Group();panel.name='Lever_panel';panel.add(quad(9,0,undefined,'Panel_face'));// moves with what it holds
 scene.add(door,lift,lever,panel);scene.updateMatrixWorld(true);
 assert.equal(collectOccluders(scene).positions.length,0);assert.equal(collectTargets(scene).length,0);pass('doors, levers and lifts, and what they hold, neither hide anything nor are hidden');}
{const scene=new T.Scene(),tree=quad(0,0,undefined,'Blossom_tree');tree.castShadow=true;const glass=quad(3,0,new T.MeshStandardMaterial({transparent:true}),'Pane');
 const overlay=quad(6,0,new T.MeshBasicMaterial({depthTest:false}),'Marker');// drawn over whatever is in front of it
 const always=quad(9,0,new T.MeshBasicMaterial({depthFunc:T.AlwaysDepth}),'Halo'),stencil=quad(12,0,new T.MeshBasicMaterial({stencilWrite:true}),'Mask');
 scene.add(tree,glass,overlay,always,stencil);scene.updateMatrixWorld(true);
 assert.equal(collectTargets(scene).length,0);pass('shadow casters, see-through parts and parts drawn without the depth test are never hidden');}
{const scene=new T.Scene(),geo=new T.BoxGeometry(1,1,1),mat=new T.MeshStandardMaterial();
 const loose=new T.InstancedMesh(geo,mat,3);loose.name='P4_seat';const cabins=new T.InstancedMesh(geo,mat,2);cabins.name='Cabin_fit';
 const all=[new T.Matrix4().makeTranslation(0,0,-10),new T.Matrix4().makeTranslation(5,0,-10),new T.Matrix4().makeTranslation(9,0,-10)];
 cabins.userData={near:{all,centres:all.map(m=>new T.Vector3().setFromMatrixPosition(m))},cabinIds:['A','B','C']};scene.add(loose,cabins);scene.updateMatrixWorld(true);
 const parts=collectTargets(scene).flatMap(e=>e.parts);assert.equal(parts.length,1);assert.deepEqual(parts[0].slots.map(s=>s.id),['A','B','C']);pass('instanced parts only with every slot listed (cabins), never re-packed ones without');}
{const w=ship(),parts=collectTargets(w.scene).flatMap(e=>e.parts).filter(p=>/merged/.test(p.o.name));assert.equal(parts.length,2);
 for(const p of parts){const box=p.boxes.reduce((b,x)=>b.union(x),new T.Box3());assert.ok(box.min.x>=17.9&&box.max.x<=22.1,'the piece\'s own triangles at x 18..22');}pass('a merged piece is boxed by its own triangles, not its whole merge');}
{const w=ship(),hidden=new T.Group();hidden.name='Walk_band_9';hidden.visible=false;const lamp=quad(0,0,undefined,'Lamp'),wall=quad(0,-3,undefined,'Wall');hidden.add(lamp,wall);w.scene.add(hidden);w.scene.updateMatrixWorld(true);
 const names=collectTargets(w.scene).flatMap(e=>e.parts.map(p=>p.o.name));assert.ok(names.includes('Lamp'));
 assert.equal(names.filter(n=>n==='Wall').length,1,"merge sources are not targets; the hidden band's wall is");
 const o=collectOccluders(w.scene);assert.ok(o.conditions.some(c=>c[0].includes('Walk_band_9')));pass('parts and walls of a deck not shown now are still baked (their conditions decide when they count)');}
{const scene=new T.Scene(),moved=new T.MeshStandardMaterial();moved.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=100.;');};
 const shaded=new T.MeshStandardMaterial(),hook=()=>{};hook.keepsGeometry=true;shaded.onBeforeCompile=hook;
 scene.add(quad(0,0,moved,'Fish'),quad(3,0,shaded,'Shaded'));scene.updateMatrixWorld(true);
 assert.deepEqual(collectTargets(scene).flatMap(e=>e.parts.map(p=>p.o.name)),['Shaded']);const o=collectOccluders(scene);assert.equal(o.positions.length/9,2);
 pass('a shader that moves vertices keeps its part out of the bake; one marked as keeping geometry does not');}
{// The bake's page bundles its own three: the walk's materials inherit another copy's empty hook.
 const scene=new T.Scene(),foreign=new T.MeshStandardMaterial(),theirs=Object.create(Object.getPrototypeOf(foreign),{onBeforeCompile:{value:function onBeforeCompile(){}}});
 Object.setPrototypeOf(foreign,theirs);assert.ok(!Object.prototype.hasOwnProperty.call(foreign,'onBeforeCompile')&&foreign.onBeforeCompile!==T.Material.prototype.onBeforeCompile);
 // A hook inherited that is not that copy's empty one: it may discard (a subclass, a shared prototype).
 const sneaky=new T.MeshStandardMaterial();Object.setPrototypeOf(sneaky,Object.create(theirs,{onBeforeCompile:{value:s=>{s.fragmentShader=s.fragmentShader.replace('}','discard;}');}}}));
 scene.add(quad(0,0,foreign,'Painting_frame_rail'),quad(3,0,sneaky,'Inherited_hook'));scene.updateMatrixWorld(true);
 const emptyHook=theirs.onBeforeCompile,names=o=>collectTargets(scene,o).flatMap(e=>e.parts.map(p=>p.o.name));
 assert.deepEqual(names({emptyHook}),['Painting_frame_rail']);assert.equal(collectOccluders(scene,{emptyHook}).positions.length/9,2);
 assert.deepEqual(names(),[],'without the walk\'s empty hook nothing is trusted');
 pass('a material with the walk\'s empty hook is baked; an inherited hook of any other kind is not');}
{const scene=new T.Scene(),clipped=new T.MeshStandardMaterial({clippingPlanes:[new T.Plane(new T.Vector3(0,1,0),-10)]});scene.add(quad(0,0,clipped,'Clipped_panel'));scene.updateMatrixWorld(true);
 assert.equal(collectOccluders(scene).positions.length,0);pass('a clipped surface is not a wall');}
{const w=ship(),pieces=w.root.children,g=pieces[0].geometry;g.computeBoundingBox();g.boundingBox.max.x=g.boundingBox.min.x+.1;// the walk narrows it to the decks shown
 const p=collectTargets(w.scene).flatMap(e=>e.parts).find(x=>x.o===pieces[0]),box=p.boxes.reduce((b,x)=>b.union(x),new T.Box3());assert.ok(box.max.x>=21.9,'every vertex, not the narrowed box');
 pass('a merged piece is boxed by all its vertices, whatever its bounds say now');}
{const t=(parts,conditions)=>({parts,conditions}),a=t([['["p1"]','m1'],['["p2"]','m2']],[['["w1"]','m3']]);
 assert.deepEqual(tablesDiffer(a,a),{parts:[],conditions:[]});
 const moved=tablesDiffer(a,t([['["p1"]','m1'],['["p2"]','mX']],[['["w1"]','mY']]));assert.deepEqual(moved,{parts:[1],conditions:[0]});
 assert.equal(tablesDiffer(a,t([['["p1"]','m1']],[['["w1"]','m3']])),null);assert.equal(tablesDiffer(a,t([['["p1"]','m1'],['["p3"]','m2']],[['["w1"]','m3']])),null);
 const list=[[0,[0]],[1,[]],[0,[]]];assert.deepEqual(withoutMoved(list,moved),[[0,[]]]);
 pass('rows that moved between pages drop every entry relying on them; other differences refuse the bake');}

{
 const {cafe,coversCafe,addCafeCell}=await import('./walk-owner-hotspots.mjs');
 const {emptyOwnerBake}=await import('../src/v2/owner-hiding.js');
 const base={...emptyOwnerBake('walk.abcd123456.js','merge200000'),nearMargin:.3,parts:[['a','1']],conds:[['wall','2','Deck7']],entries:[[0,[0]]],blocks:[[1,2,3,1,2,3,[0]]]};
 const bounds=[...cafe.cell,...cafe.cell];
 const add={...base,parts:[['b','5'],['a','1']],conds:[['wall','2','Deck8'],['wall','2','Deck7']],entries:[[0,[0,1],['cab7']],[1,[1]]],blocks:[[...bounds,[0]],[...bounds,[1]]]};
 const full=addCafeCell(base,add);
 for(const key of ['entries','parts','conds'])assert.equal(full[key],base[key]);
 assert.deepEqual(full.blocks,[base.blocks[0],[...bounds,[0]]]);
 const repeated={...add,blocks:[[...bounds,[1,0,1]]]};
 assert.deepEqual(addCafeCell(base,repeated).blocks.at(-1)[6],[0,0]);
 for(const entry of [[1,[0]],[1,[]],[1,[1],['cab7']],[0,[1]]]){
  assert.throws(()=>addCafeCell(base,{...add,entries:[entry],blocks:[[...bounds,[0]]]}),/No shared/);
 }
 assert(coversCafe(full));assert(!coversCafe({...full,blocks:base.blocks}));
 assert.throws(()=>addCafeCell(base,{...add,key:'different'}));
 assert.throws(()=>addCafeCell(base,{...add,parts:[['b','5'],['a','changed']]}),/No shared/);
 assert.throws(()=>addCafeCell(base,{...add,blocks:[[1,2,3,1,2,3,[0]]]}));
 assert.throws(()=>addCafeCell(base,{...add,blocks:[[...bounds,[2]]]}));
}
pass('a café cell reuses only complete existing proofs and leaves every scene table unchanged');
// Deck kinds (src/v2/phone-bands.js): two pieces are slices of one shared index and arrays. Each is bounded, clustered and
// digested from its own slice only, not from the kind's whole arrays.
{const scene=new T.Scene(),band=new T.Group();band.name='Walk_band_4';scene.add(band);
 const kept=new T.Group();kept.name='Walk_band_4_merged_sources';kept.visible=false;kept.userData={mergedSources:true};band.add(kept);const src=quad(0,-5);kept.add(src);
 const root=new T.Group();root.name='V2_phone_band_merges';scene.add(root);
 // A 2 m wall at x 0 and another at x 100, one after the other in one index.
 const near=new T.PlaneGeometry(2,2),far=new T.PlaneGeometry(2,2).translate(100,0,0),n=near.attributes.position.count;
 const position=new T.BufferAttribute(new Float32Array([...near.attributes.position.array,...far.attributes.position.array]),3);
 const index=new T.BufferAttribute(Uint32Array.from([...near.index.array,...far.index.array.map(i=>i+n)]),1),m=new T.MeshStandardMaterial({name:'V2_band_kind_0'});
 const piece=(start,count)=>{const g=new T.BufferGeometry();g.setAttribute('position',position);g.setIndex(index);g.setDrawRange(start,count);const o=new T.Mesh(g,[m]);o.name='V2_low_deck_merged_Walk_finish_kind_0';o.userData={sources:[src.uuid]};o.position.y=1;root.add(o);return o;};
 const a=piece(0,6),b=piece(6,6);scene.updateMatrixWorld(true);const digest=s=>{const d=rowDigests(s,{emptyHook:T.Material.prototype.onBeforeCompile});return JSON.stringify([[...d.conds],[...d.parts]]);};
 const parts=collectTargets(scene).flatMap(g=>g.parts),pa=parts.find(p=>p.o===a),pb=parts.find(p=>p.o===b);
 assert.ok(pa&&pb);assert.ok(pa.boxes.every(x=>x.max.x<=1+1e-9),'a slice’s boxes stay on its own wall');assert.ok(pb.boxes.every(x=>x.min.x>=99-1e-9));
 // A vertex of b's wall moves: the band's digest follows it; put back, the digest is as it was.
 const before=digest(scene),was=position.getX(n);position.setX(n,105);assert.notEqual(digest(scene),before,'a slice’s own vertex counts');
 position.setX(n,was);assert.equal(digest(scene),before);
 pass('a deck kind’s pieces are bounded, clustered and digested from their own slice of the shared arrays');}
console.log(`owner bake scene: ${passed} checks passed`);
