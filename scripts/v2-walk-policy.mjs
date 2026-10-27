
import {contains} from '../src/plan/geometry-v2.js';
export const ROOM_DROP_ALLOWLIST=[
 {room:'observation-lounge',name:'Soft_back',maxDrop:1.15,maxAboveFloor:1.2,reason:'Unchanged v1 rounded lounge-chair backs; a person can climb from the cushion onto a 1.12 m furniture back. No floor or guard edge is exempt.',source:'src/lounge.js'},
 {room:'commons-10',name:'Garden_bench_back',maxDrop:1.1,maxAboveFloor:1.1,reason:'Unchanged v1 cherry-blossom bench back; a 1.06 m furniture drop to its own ground floor, with no lower deck beneath.',source:'src/walk/blossom.js'}
];
export function requireRoomDropPolicy(events,layout,options){const r=classifyRoomDrops(events,layout,options);if(r.roomFeatureViolations.length)throw Error('Unapproved room-feature drops over 1 m: '+r.roomFeatureViolations.length);return r;}
export function classifyRoomDrops(events,layout,{supports=[]}={}){
 const roomFeatureDrops=events.filter(f=>f.category==='room-feature'&&f.drop>1).map(f=>{
  const room=layout.rooms.find(r=>!r.aggregate&&f.from[1]>=r.y-.02&&f.from[1]<=r.y+r.height&&contains(r.polygon,[f.from[0],f.from[2]]));
  const support=supports.find(o=>o.room===room?.id&&Math.abs(o.top-f.from[1])<.035&&f.from[0]>=o.min[0]-.19&&f.from[0]<=o.max[0]+.19&&f.from[2]>=o.min[2]-.19&&f.from[2]<=o.max[2]+.19);
  const allow=ROOM_DROP_ALLOWLIST.find(a=>a.room===room?.id&&a.name===support?.name&&f.drop<=a.maxDrop&&f.from[1]-room.y<=a.maxAboveFloor&&f.to[1]>=room.y-.02);
  return {...f,room:room?.id||null,support:support?.name||null,allow:allow?{source:allow.source,reason:allow.reason}:null};
 });
 return {roomFeatureDrops,roomFeatureViolations:roomFeatureDrops.filter(f=>!f.allow)};
}
