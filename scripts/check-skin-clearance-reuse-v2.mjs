// Reused skin clearance results must equal a fresh audit: unchanged meshes are reused, and any change to a mesh, its
// ancestors, its materials, a window near it or the global key audits it again.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as T from 'three';
import {createSkinAuthority,auditSkinClearance} from '../src/plan/skin-clearance-v2.js';
import {createClearanceReuse} from './skin-clearance-reuse-v2.mjs';

const skin=new T.Group(),shell=new T.Mesh(new T.BoxGeometry(20,20,10),new T.MeshBasicMaterial());shell.name='Smooth_pressure_envelope_fixture';skin.add(shell);
const authority=createSkinAuthority(skin);
const room=(id,x,rect=[-1.1,1.1,.8,2.1])=>({id,kind:'room',ownerId:id,wallBuildUp:.2,chart:{origin:[x,0,0],u:[1,0,0],v:[0,0,1]},window:{rect},surface:[[[-2,0,5,0,0,1],[2,0,5,0,0,1],[2,3.5,5,0,0,1]],[[-2,0,5,0,0,1],[2,3.5,5,0,0,1],[-2,3.5,5,0,0,1]]]});
const layoutOf=(rect)=>({hullPrototypes:{prototypes:[room('room-a',0,rect),room('room-b',6)]}});

function scene(){
 const root=new T.Group(),deck=new T.Group();deck.name='Deck';deck.userData={schedule:'deck-fixture'};root.add(deck);
 const box=(name,pos,material='guard',userData={})=>{const o=new T.Mesh(new T.BoxGeometry(.3,.3,.04),{name:material});o.name=name;o.position.set(...pos);o.userData=userData;deck.add(o);return o;};
 box('V2_guard_glass',[0,1.2,5.2]);                                    // outside the skin and in room-a's window
 box('Interior_obstruction',[0,1.2,4.9]);                              // blocks room-a's window
 box('Own_glass',[0,1.2,4.98],'V2_prototype_hull_glass',{room:'room-a',interface:'room-a'});
 box('Interior_guard',[0,1.2,3]);
 box('Room_b_obstruction',[6,1.2,4.9]);                                // blocks room-b's window only
 // Two ranges of one shared vertex buffer, as the prepared render bands are split.
 const shared=new T.BoxGeometry(.4,.4,.4).toNonIndexed(),positions=shared.attributes.position;
 const range=(name,start,count,offset)=>{const g=new T.BufferGeometry();g.setAttribute('position',positions);g.setIndex(Array.from({length:count},(_,i)=>start+i));const o=new T.Mesh(g,{name:'band'});o.name=name;o.position.set(...offset);o.userData={baked:true};deck.add(o);return o;};
 range('Band_range_inside',0,18,[-3,2,0]);range('Band_range_outside',18,18,[-3,2,5.3]);
 const inst=new T.InstancedMesh(new T.BoxGeometry(.2,.2,.2),{name:'stool'},3);inst.name='Stools';
 for(const [i,z] of [0,2,5.4].entries())inst.setMatrixAt(i,new T.Matrix4().makeTranslation(2,1,z));deck.add(inst);
 return root;
}
const strip=r=>{const {reuse,...rest}=r;return JSON.parse(JSON.stringify(rest));};
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leo-clearance-reuse-')),file=dir+'/reuse.json',parts={authorityProof:'fixture',code:'fixture'};
try{
 const layout=layoutOf();
 const fresh=auditSkinClearance(scene(),authority,layout);
 assert.equal(fresh.status,'FAIL');assert(fresh.outside.length>=2&&fresh.blocked.length>=3,'fixture must have outside and blocked witnesses');
 let reuse=await createClearanceReuse(file,parts);
 const first=auditSkinClearance(scene(),authority,layout,{reuse});
 assert.deepEqual(strip(first),strip(fresh));assert.equal(first.reuse.reused,0);assert.equal(reuse.stats().unkeyed,0);await reuse.save();
 reuse=await createClearanceReuse(file,parts);
 const second=auditSkinClearance(scene(),authority,layout,{reuse});
 assert.deepEqual(strip(second),strip(fresh));assert.equal(second.reuse.audited,0,'an unchanged scene reuses every mesh');
 const meshes=second.meshes;
 const changed=async(label,edit,{layout:l=layout,expectAudited=1,key=parts}={})=>{
  const root=scene();edit(root);const independent=scene();edit(independent);const truth=auditSkinClearance(independent,authority,l),reuse=await createClearanceReuse(file,key),got=auditSkinClearance(root,authority,l,{reuse});
  assert.deepEqual(strip(got),strip(truth),label+': reused result differs from a fresh audit');
  if(expectAudited==='all')assert.equal(got.reuse.reused,0,label);else assert.equal(got.reuse.audited,expectAudited,label+' audited '+got.reuse.audited);
  return got;
 };
 const find=(root,name)=>root.getObjectByName(name);
 await changed('moved mesh',r=>find(r,'Interior_guard').position.x+=.01);
 await changed('vertex edit',r=>{const g=find(r,'Interior_obstruction').geometry;g.attributes.position.setX(0,g.attributes.position.getX(0)+.001);});
 await changed('user data',r=>{find(r,'Own_glass').userData.room='room-b';});
 await changed('material name',r=>{find(r,'Own_glass').material={name:'guard'};});
 await changed('ancestor user data',r=>{find(r,'Deck').userData.schedule='other';},{expectAudited:meshes});
 await changed('instance matrix',r=>{const m=find(r,'Stools');m.setMatrixAt(1,new T.Matrix4().makeTranslation(2,1,2.5));});
 await changed('shared range edit',r=>{const g=find(r,'Band_range_outside').geometry;g.attributes.position.setY(20,g.attributes.position.getY(20)+.01);},{expectAudited:1});
 // The same triangles moved within a larger shared buffer still match.
 await changed('range moved in its buffer',r=>{for(const name of ['Band_range_inside','Band_range_outside']){const o=find(r,name),old=o.geometry,p=old.attributes.position,grown=new Float32Array(p.array.length+9);grown.set(p.array,9);const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(grown,3));g.setIndex(Array.from(old.index.array,i=>i+3));o.geometry=g;}},{expectAudited:0});
 // A window change audits only the meshes near that window.
 const near=[...['V2_guard_glass','Interior_obstruction','Own_glass']];
 await changed('window rect',()=>{},{layout:layoutOf([-1.1,1.0,.8,2.1]),expectAudited:near.length});
 await changed('global key',()=>{},{key:{...parts,code:'other'},expectAudited:'all'});
 // Inputs the fingerprint cannot cover exactly are audited afresh (counterexamples from review).
 const fresh1=async(label,edit)=>{const root=scene();edit(root);const independent=scene();edit(independent);const truth=auditSkinClearance(independent,authority,layout),reuse=await createClearanceReuse(file,parts),got=auditSkinClearance(root,authority,layout,{reuse});
  assert.deepEqual(strip(got),strip(truth),label+': differs from a fresh audit');assert(reuse.stats().unkeyed>=1,label+' must not be fingerprinted');assert(got.reuse.audited>=1,label);};
 await fresh1('half-float attribute',r=>{const g=find(r,'Interior_obstruction').geometry;g.setAttribute('_leo_owner',new T.Float16BufferAttribute(new Uint16Array(g.attributes.position.count),1));});
 await fresh1('index tail past its count',r=>{const g=find(r,'Interior_obstruction').geometry;g.index.count-=3;});
 await fresh1('undersized bounding box',r=>{const g=find(r,'Interior_guard').geometry;g.boundingBox=new T.Box3(new T.Vector3(-.01,-.01,-.01),new T.Vector3(.01,.01,.01));});
 await fresh1('two-component positions',r=>{const o=find(r,'Interior_guard'),g=o.geometry,p=g.attributes.position;g.setAttribute('position',new T.BufferAttribute(new Float32Array(Array.from({length:p.count*2},(_,i)=>p.array[Math.floor(i/2)*3+i%2])),2));g.boundingBox=new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1));});
 await fresh1('hidden attribute',r=>{const g=find(r,'Own_glass').geometry;Object.defineProperty(g.attributes,'_leo_owner',{value:new T.BufferAttribute(new Uint16Array(g.attributes.position.count).fill(2),1),enumerable:false});find(r,'Own_glass').userData.ownerTable=[null,{room:'room-a',component:'room-a'},{room:'room-b',component:'room-b'}];});
 await fresh1('hidden user data',r=>{Object.defineProperty(find(r,'Own_glass').userData,'room',{value:'room-a',enumerable:false});});
 await fresh1('class instance in user data',r=>{find(r,'Interior_guard').userData.at=new T.Vector3(1,2,3);});
 {const reuse=await createClearanceReuse(file,parts),check=(await import('../src/plan/skin-clearance-v2.js')).createWindowClearance(layout),keyOf=o=>{o.updateMatrixWorld(true);const g=o.geometry;g.computeBoundingBox();return reuse.key(o,g.boundingBox,check);};
  const mesh=(material,userData={})=>{const o=new T.Mesh(new T.BoxGeometry(.3,.3,.04),material);o.name='Probe';o.userData=userData;return o;};
  assert.notEqual(keyOf(mesh({name:'glass'})),keyOf(mesh([{name:'glass'}])),'a material and a one-material array must differ');
  assert.notEqual(keyOf(mesh({name:'glass'},{room:undefined})),keyOf(mesh({name:'glass'},{room:'<undefined>'})),'undefined and a string must differ');
  assert.notEqual(keyOf(mesh({name:'glass'},{room:undefined})),keyOf(mesh({name:'glass'},{})),'an undefined field and no field must differ');
  {const a=[{name:'glass'}],b=[{name:'glass'}];b.name='window_rim';assert.notEqual(keyOf(mesh(a)),keyOf(mesh(b)),'the own name of a material list must count');}
  // A two-component position: the audit reads z from the next vertex's slot, which a two-component hash never sees.
  for(const z of [0,6]){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array([0,0,1,0,0,1,z,0]),2));g.setIndex([0,1,2]);g.boundingBox=new T.Box3(new T.Vector3(-10,-10,-10),new T.Vector3(10,10,10));const o=new T.Mesh(g,{name:'glass'});o.updateMatrixWorld(true);assert.equal(reuse.key(o,g.boundingBox,check),null,'two-component positions are not fingerprinted');}
  {const a=[1,2],b=[1,2];b.extra=1;assert.equal(keyOf(mesh({name:'glass'},{list:b})),null,'array properties are not fingerprinted');}
  // Two window lists that differ only in the prototype's wall build-up, with identical derived boxes and faces.
  const w=check.windows[0],other={...w,p:{...w.p,wallBuildUp:w.p.wallBuildUp+.1}},only=x=>({windows:[x],candidates:()=>new Set([x])}),probe=mesh({name:'glass'});probe.updateMatrixWorld(true);probe.geometry.computeBoundingBox();
  assert.notEqual(reuse.key(probe,probe.geometry.boundingBox,only(w)),reuse.key(probe,probe.geometry.boundingBox,only(other)),'wall build-up must be in the window fingerprint');}
 // An edited saved failure is not trusted.
 {const data=JSON.parse(await fs.readFile(file,'utf8')),entry=Object.values(data.entries).find(e=>e.result.outside);assert(entry,'fixture saves a failing mesh');entry.result.outside=null;entry.result.blocked=[];await fs.writeFile(file,JSON.stringify(data));
  const reuse=await createClearanceReuse(file,parts),got=auditSkinClearance(scene(),authority,layout,{reuse});assert.deepEqual(strip(got),strip(fresh));assert.equal(reuse.stats().rejected,1);assert.equal(got.reuse.audited,1);}
 // Witness caps across meshes and the BVH path (over 30,000 index entries) reuse exactly.
 for(const [label,build,options] of [['witness cap',scene,{maxWitnesses:2}],['BVH mesh',()=>{const root=scene(),big=new T.Mesh(new T.SphereGeometry(.6,128,128),{name:'guard'});big.name='Large_obstruction';big.position.set(0,1.4,5.1);root.add(big);return root;},{}]]){
  const truth=auditSkinClearance(build(),authority,layout,options),f2=dir+'/'+label+'.json';let reuse=await createClearanceReuse(f2,parts);
  assert.deepEqual(strip(auditSkinClearance(build(),authority,layout,{...options,reuse})),strip(truth),label);await reuse.save();
  reuse=await createClearanceReuse(f2,parts);const again=auditSkinClearance(build(),authority,layout,{...options,reuse});assert.deepEqual(strip(again),strip(truth),label+' reused');assert.equal(again.reuse.audited,0,label);
  if(label==='witness cap')assert.equal(truth.blocked.length,2);else assert(truth.blocked.some(b=>b.mesh==='Large_obstruction'),'BVH fixture must block a window');}
 assert.throws(()=>auditSkinClearance(scene(),authority,layout,{maxWitnesses:0}),/maxWitnesses/);
 // A damaged file is ignored.
 await fs.writeFile(file,'{not json');reuse=await createClearanceReuse(file,parts);assert.equal(auditSkinClearance(scene(),authority,layout,{reuse}).reuse.reused,0);
 console.log('PASS: reused skin clearance equals a fresh audit; mesh, vertex, user data, material, ancestor, instance, shared range, window and key changes re-audit; moved ranges, review counterexamples, edited and damaged files are safe; witness caps and the BVH path reuse exactly');
}finally{await fs.rm(dir,{recursive:true,force:true});}
