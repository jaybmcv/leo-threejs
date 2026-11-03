import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {buildPhase4Fitout,addPhase4Colliders} from '../src/v2/phase4-fitout.js';
import {Colliders} from '../src/walk/collision.js';
import {PreparedWriter} from '../src/v2/prepared-codec.js';
import {baseline,output} from './fast-state-v2.mjs';
import {PreparedPatch,preparedManifest,preparedArrayReader,hash} from './prepared-patch-v2.mjs';
import {patchModels} from './patch-models-v2.mjs';
import {onePassAtriumGlass} from '../src/v2/atrium-visibility.js';

export async function patchRooms(plan,timer){
 installWalkCanvas(createCanvas);
 const rooms=new Set(plan.rooms),base=baseline+'/prepared-walk',m=await preparedManifest(base),read=preparedArrayReader(m,base),patch=new PreparedPatch(m);
 const ship={inside:new T.Group()},fittings=await timer.stage('author changed rooms',async()=>{const fit=buildPhase4Fitout(ship,layout,{rooms:plan.rooms});for(const root of fit.roots)onePassAtriumGlass(root);return fit;});
 // Meshes with unchanged text stay in the original render bands. Only the
 // selected owners are removed from mixed batches; neighbours keep their data.
 const removed=new Set();let keptInstances=0,removedInstances=0;
 for(const node of m.source.nodes){const runs=node.userData?.phase4&&node.userData.ownerRuns;if(!runs?.some(r=>rooms.has(r.room)||rooms.has(r.component)))continue;
  const keep=[];for(const r of runs)if(!rooms.has(r.room)&&!rooms.has(r.component))for(let i=r.start;i<r.start+r.count;i++)keep.push(i);
  removedInstances+=runs.reduce((n,r)=>n+r.count,0)-keep.length;
  if(!keep.length){removed.add(node.uuid);continue;}
  for(const field of ['instanceMatrix','instanceColor'])if(node[field]!=null){const original=await read(node[field]),stride=field==='instanceMatrix'?16:3,next=new original.constructor(keep.length*stride);keep.forEach((i,k)=>next.set(original.subarray(i*stride,(i+1)*stride),k*stride));node[field]=patch.array(next);}
  node.count=keep.length;keptInstances+=keep.length;let offset=0;node.userData.ownerRuns=runs.filter(r=>!rooms.has(r.room)&&!rooms.has(r.component)).map(r=>{const value={...r,start:offset};offset+=r.count;return value;});node.userData.roomOwners=[...new Set(node.userData.ownerRuns.map(r=>r.room))];
  // The original bounds are conservative after removing instances.
 }
 m.source.nodes=m.source.nodes.filter(n=>!removed.has(n.uuid));
 const filterGroups=col=>{for(const group of col.groups){const keep=group.items.filter(i=>!rooms.has(i.owner)),ids=new Map(keep.map((item,i)=>[item.i,i]));group.items=keep.map((item,i)=>({...item,i}));group.cells=group.cells.map(([cell,list])=>[cell,list.filter(i=>ids.has(i)).map(i=>ids.get(i))]).filter(([,list])=>list.length);}col.groups=col.groups.filter(g=>g.items.length);if(col.ground)filterGroups(col.ground);};filterGroups(m.colliders);
 const writer=new PreparedWriter(),graphs=fittings.roots.map(root=>writer.graph(root)),col=new Colliders(),ground=new Colliders();
 await timer.stage('collision changed rooms',async()=>addPhase4Colliders(ship,col,ground));
 const collision=writer.colliders(col),groundCollision=writer.colliders(ground),relocate=patch.absorb(writer);
 for(const graph of graphs){const parent=m.source.nodes.find(n=>n.name===graph.nodes[0].name),updated=relocate.graph(graph);if(parent){for(const node of updated.nodes.slice(1)){if(node.parent===updated.root)node.parent=parent.uuid;m.source.nodes.push(node);}}else{const structure=m.source.nodes.find(n=>n.name==='V2_structure');assert(structure,'Missing baseline structure root');updated.nodes[0].parent=structure.uuid;m.source.nodes.push(...updated.nodes);}}
 const extra=relocate.colliders(collision),extraGround=relocate.colliders(groundCollision);
 for(const g of [...extra.groups,...extraGround.groups])g.name='fast-'+g.name+'-'+hash(Buffer.from(plan.rooms.join(','))).slice(0,8);
 m.colliders.groups.push(...extra.groups);m.colliders.ground.groups.push(...extraGround.groups);
 const seated=new Set(m.seats.map(i=>m.rest[i]));m.rest=m.rest.filter(s=>!(s.phase4&&rooms.has(s.room)));m.seats=m.rest.map((s,i)=>seated.has(s)?i:null).filter(i=>i!==null);
 for(const s of fittings.rests){const record={...s,point:{$vector3:s.point},...(s.facing?{facing:{$vector3:s.facing}}:{}),...(s.head?{head:{$vector3:s.head}}:{})};m.seats.push(m.rest.length);m.rest.push(record);}
 const models=await timer.stage('patch affected models',()=>patchModels({baseline,destination:output,rooms:plan.rooms,roots:fittings.roots}));
 const original=JSON.parse(await fs.readFile(base+'/integrity.json','utf8')),sourceInputs={...original.sourceInputs,sources:plan.identity};
 const prepared=await timer.stage('encode changed parts',()=>patch.save(output+'/prepared-walk',base,sourceInputs,{rooms:plan.rooms,decks:plan.decks,base:original.sha256}));
 return {models,prepared,removedInstances,keptInstances,changedCollisionGroups:extra.groups.length,changedGroundGroups:extraGround.groups.length};
}
