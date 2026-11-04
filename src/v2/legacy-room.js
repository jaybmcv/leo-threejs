import * as T from 'three';
import {SHIP_AREAS,createShipArea} from '../areas.js';
import {deferRoomFrames,resolveRoomFrames} from '../plan/rooms.js';
import {buildRoomShell} from './room-shell.js';
import {cutPrototypeStructure} from './hull-prototypes.js';
import {onePassAtriumGlass} from './atrium-visibility.js';

// These rooms have later world/activity passes which are not yet isolated.
// Refuse them rather than replace a finished room with its earlier source.
const excluded=new Set(['d01-cargo-1','d01-workshop-5','d01-stores-8',
 'd02-arrival-1','d02-baggage-5','d03-farm-1','d03-cold-6','d04-air-1','d04-control-8',
 'd05-surgery-2','d05-imaging-6','d16-arena-1','d16-recreation-4',
 'd16-theater-5','d16-childcare-6','d16-training-aft','d16-voyage-forum-bow','d01-spares-aft','d02-hangar-9','d17-fin-lounge-aft']);
export function legacyRoomIds(layout){return SHIP_AREAS.filter(a=>!excluded.has(a.id)&&layout.rooms.some(r=>r.id===a.id&&!r.aggregate&&!r.hullPrototype&&!r.closed)).map(a=>a.id).sort();}
export function buildLegacyRoom(id,layout,{probe=false}={}){
 if(!probe&&!legacyRoomIds(layout).includes(id))throw Error('Legacy room needs wider authoring: '+id);
 const area=SHIP_AREAS.find(a=>a.id===id),r=layout.rooms.find(r=>r.id===id);
 const root=new T.Group(),inside=new T.Group(),structure=new T.Group();root.add(inside);inside.add(structure);
 structure.name='V2_structure';
 deferRoomFrames();
 try{
  const part=createShipArea(area);inside.add(part.root);part.root.userData.fastRoom=id;
  const ship={root,inside,cutaway:new Set([part.shell].filter(Boolean))};
  buildRoomShell(ship,r,structure);cutPrototypeStructure(inside,layout);resolveRoomFrames(root);root.updateMatrixWorld(true);onePassAtriumGlass(root);
  return {root,inside,source:part.root,shell:structure.children[0]};
 }finally{deferRoomFrames(false);}
}
