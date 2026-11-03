import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Colliders,solid} from '../src/walk/collision.js';
import {groundMesh} from '../src/v2/ground.js';
import {findRestSpots} from '../src/walk/rest.js';
import {PreparedWriter} from '../src/v2/prepared-codec.js';
import {bakeForWalking} from '../src/v2/render-bake.authoring.js';
import {shareExportGeometry} from './v2-export.mjs';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {cachedRoom} from './fast-room-cache-v2.mjs';
import {PreparedPatch,preparedManifest,preparedArrayReader} from './prepared-patch-v2.mjs';
import {patchRooms} from './fast-room-patch-v2.mjs';
import {patchProducerIdentity} from './fast-state-v2.mjs';
import {checkFastPatchCollision} from './fast-collision-v2.mjs';
import {buildLegacyRoom} from '../src/v2/legacy-room.js';
import {roomSignature} from './legacy-room-data-v2.mjs';
import layout from '../src/plan/selected-layout.js';

const directory='output/fast-deploy/round2-room-fixture',ids=['d02-security-2','d04-thermal-3','d05-pharmacy-3'];
const stageTimer=()=>{const stages=[];return {stages,async stage(name,fn){const start=performance.now();const value=await fn();stages.push({name,seconds:(performance.now()-start)/1000});return value;}};};
const signatures=()=>Object.fromEntries(ids.map(id=>[id,roomSignature(buildLegacyRoom(id,layout).root)]));
if(process.argv.includes('--seed')){
 const seed=directory+'/seed',base=directory+'/base';await fs.mkdir(seed,{recursive:true});await fs.mkdir(base,{recursive:true});await fs.writeFile(seed+'/complete.json','{}');
 const root=new T.Group(),structure=new T.Group();root.name='ship';structure.name='V2_structure';root.add(structure);
 const node=o=>({uuid:o.uuid,name:o.name,parent:o===root?null:root.uuid,position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1],visible:true,userData:{}});
 const m={version:1,roomOwnershipVersion:1,parts:[],arrays:[],geometries:[],materials:[],textures:[],images:[],source:{root:root.uuid,nodes:[node(root),node(structure)]},bands:[],colliders:{bands:[],groups:[],movers:[],ground:{bands:[],groups:[],movers:[],ground:null}},rest:[],seats:[],ship:{},bake:{}};
 const keys=signatures();
 for(const id of ids){const built=buildLegacyRoom(id,layout);structure.add(built.source,built.shell);}
 const shared=new T.Mesh(new T.BoxGeometry(1,.2,1),new T.MeshStandardMaterial());shared.name='Shared_floor';shared.position.set(250,-35,0);structure.add(shared);
 m.fixtureGroups=Object.fromEntries(ids.map(id=>[id,root.getObjectByName('Area_'+id).getObjectByName('Room_fittings')?.uuid]));
 root.updateMatrixWorld(true);const model=root.clone(true),rests=findRestSpots(root),col=new Colliders(),ground=new Colliders();
 col.addStatic(root,solid);ground.addStatic(root,o=>solid(o)&&groundMesh(o));col.commit();ground.commit();
 const writer=new PreparedWriter(),source=writer.graph(root,{source:true}),baked=bakeForWalking(root),bands=[...baked.bands].map(([key,group])=>[key,writer.graph(group)]),collision=writer.colliders(col),groundCollision=writer.colliders(ground);
 const patch=new PreparedPatch(m),relocate=patch.absorb(writer);m.source=relocate.graph(source);m.bands=bands.map(([key,graph])=>[key,relocate.graph(graph)]);m.colliders=relocate.colliders(collision);m.colliders.ground=relocate.colliders(groundCollision);m.rest=writer.value(rests);m.seats=rests.map((_,i)=>i);
 await patch.save(base+'/prepared-walk',seed,{},{});
 globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
 shareExportGeometry(model);await fs.writeFile(base+'/leo-full-ship.glb',Buffer.from(await new GLTFExporter().parseAsync(model,{binary:true,onlyVisible:true})));
 await fs.writeFile(directory+'/signatures.json',JSON.stringify(keys));console.log('Seeded three actual legacy rooms');
}else{
 const before=JSON.parse(await fs.readFile(directory+'/signatures.json')),after=signatures(),rooms=ids.filter(id=>before[id]!==after[id]);
 assert(rooms.length,'A real room source edit is required');const timer=stageTimer(),destination=directory+'/patched';await fs.mkdir(destination,{recursive:true});
 const plan={rooms,legacyRooms:process.argv.includes('--shell')?[]:rooms,shellRooms:process.argv.includes('--shell')?rooms:[],decks:[...new Set(rooms.map(id=>layout.rooms.find(r=>r.id===id).deck))],identity:{hash:'fixture'},basePrepared:'fixture-v5',patchProducer:await patchProducerIdentity(),roomKeys:after};
 const result=await patchRooms(plan,timer,{baseDirectory:directory+'/base',destination});
 const collision=await checkFastPatchCollision(destination+'/prepared-walk'),m=await preparedManifest(destination+'/prepared-walk');
 assert.deepEqual(collision.rooms,rooms);if(process.argv.includes('--deleted'))assert.equal(collision.probes,0);else assert(collision.probes>0);assert(result.removedSpans.renderTriangles>0);assert(result.removedSpans.collisionTriangles>0);
 for(const id of plan.legacyRooms){const uuid=m.fixtureGroups[id];if(uuid)assert(m.source.nodes.some(n=>n.uuid===uuid),'Lost the existing fit-group reference for '+id);}
 const untouched=ids.filter(id=>!rooms.includes(id));for(const id of untouched)assert(m.source.nodes.some(n=>n.name==='Area_'+id));
 const nodeIds=new Set(m.source.nodes.map(n=>n.uuid));assert.equal(nodeIds.size,m.source.nodes.length,'Duplicate prepared node IDs');for(const n of m.source.nodes)assert(!n.parent||nodeIds.has(n.parent),'Missing graph parent for '+n.name);
 const read=preparedArrayReader(m,destination+'/prepared-walk');for(const g of m.geometries)if(g.index!==null){const ix=await read(g.index);assert(ix.length%3===0);}
 const modelBytes=await fs.readFile(destination+'/leo-full-ship.glb'),modelJSON=JSON.parse(modelBytes.subarray(20,20+modelBytes.readUInt32LE(12)));for(const id of plan.shellRooms)for(const n of modelJSON.nodes)if(n.extras?.exportInstances)assert(!n.extras.roomIds.includes(id),'Old shared wall instance remains for '+id);
 const evidence={rooms,stages:timer.stages,result,collision};const tag=process.argv.find(a=>a.startsWith('--tag='))?.slice(6)||'last';await fs.writeFile('output/fast-deploy/'+tag+'-room-fixture.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({rooms,stages:timer.stages,cache:result.cache,collision,removed:result.removedSpans}));
}
