import fs from 'node:fs/promises';
import * as T from 'three';
import {createHash} from 'node:crypto';
import layout from '../src/plan/selected-layout.js';
import {SHIP_AREAS} from '../src/areas.js';
import {legacyRoomIds,buildLegacyRoom} from '../src/v2/legacy-room.js';
import {Colliders,solid} from '../src/walk/collision.js';
import {groundMesh} from '../src/v2/ground.js';
import {findRestSpots,solidSpots} from '../src/walk/rest.js';
import {PreparedWriter} from '../src/v2/prepared-codec.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {bakeForWalking} from '../src/v2/render-bake.authoring.js';

export function compileLegacyRoom(id,{replaceSource=true,replaceShell=true}={}){
 const {root,inside,source,shell}=buildLegacyRoom(id,layout),writer=new PreparedWriter();
 if(!replaceSource)source.removeFromParent();if(!replaceShell)shell.removeFromParent();
 const rests=findRestSpots(inside),col=new Colliders(),ground=new Colliders();
 col.addStatic(inside,solid);ground.addStatic(inside,o=>solid(o)&&groundMesh(o));col.commit();ground.commit();
 // New room collision is an owner-scoped group, so adding it cannot replace
 // an existing ship-wide band with the same numeric key.
 const grouped=input=>{const result=new Colliders();for(const [band,row]of input.bands){const group=result.addInstances('legacy-'+id+'-'+band,row.geometry.attributes.position.array,[new T.Matrix4()]);group.items[0].owner=id;group.bvh.leoWindowFlags=row.bvh.leoWindowFlags;}return result;};
 const seats=solidSpots(rests,col),modelRoot=root.clone(true),graphs=[...(replaceSource?[source]:[]),...(replaceShell?[shell]:[])].map(o=>writer.graph(o,{source:true})),baked=bakeForWalking(root),bands=[...baked.bands].map(([key,group])=>[key,writer.graph(group)]),collision=writer.colliders(grouped(col)),groundCollision=writer.colliders(grouped(ground));
 return {root:modelRoot,writer,graphs,bands,collision,groundCollision,rests,seats};
}
// UUIDs are allocation details, not changes. The graph below uses traversal
// indices and the actual geometry, material, visibility and transform values.
export function roomSignature(root){
 root.updateMatrixWorld(true);const h=createHash('sha256');
 root.traverse(o=>{h.update(JSON.stringify([o.name,o.type,o.visible,o.matrixWorld.elements,o.userData.noCollide,o.userData.collisionOnly,o.count]));
  if(o.instanceMatrix)h.update(Buffer.from(o.instanceMatrix.array.buffer));if(o.instanceColor)h.update(Buffer.from(o.instanceColor.array.buffer));
  if(o.geometry){for(const [name,a]of Object.entries(o.geometry.attributes).sort())h.update(name).update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));if(o.geometry.index)h.update(Buffer.from(o.geometry.index.array.buffer));}
  for(const m of [].concat(o.material||[])){const value=m.toJSON();delete value.uuid;h.update(JSON.stringify(value));}
 });return h.digest('hex');
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/legacy-room-data-v2.mjs')){
 const rooms={},eligible=legacyRoomIds(layout);for(const area of SHIP_AREAS){if(!layout.rooms.some(r=>r.id===area.id&&!r.aggregate))continue;const {root}=buildLegacyRoom(area.id,layout,{probe:true});rooms[area.id]={sourceSignature:roomSignature(root.getObjectByName('Area_'+area.id)),shellSignature:roomSignature(root.getObjectByName('V2_shell_'+area.id)),area,eligible:eligible.includes(area.id),shellEligible:eligible.includes(area.id)&&!layout.hullPrototypes.prototypes.some(p=>p.ownerId===area.id||p.parentRoomId===area.id)};}
 for(const r of layout.rooms.filter(r=>!r.aggregate&&!rooms[r.id])){const root=new T.Group(),structure=new T.Group();root.add(structure);buildRoomShell({root,cutaway:new Set()},r,structure);rooms[r.id]={sourceSignature:null,shellSignature:roomSignature(root),eligible:false,shellEligible:false};}
 await fs.mkdir('output/fast-deploy',{recursive:true});await fs.writeFile('output/fast-deploy/legacy-current.json',JSON.stringify(rooms,null,2));
 console.log('Fingerprinted '+Object.keys(rooms).length+' legacy rooms');
}
