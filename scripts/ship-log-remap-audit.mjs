import assert from 'node:assert/strict';
import {contains,distanceToSegment} from '../src/plan/geometry-v2.js';

// Audit final poses independently of candidate selection. Native measurements
// additionally prove the real prepared floor and the unchanged walker capsule.
export function auditCorridorLanding(layout,row){
 const {original,current,oldRoom}=row;
 const eligible=!oldRoom||/^(circulation-|lift-|stairs-|service-lift-)/.test(oldRoom);
 if(!eligible||current.feature)return;
 assert(current.legacyCorridor,row.id+' left a circulation link unresolved');
 const deck=layout.decks.reduce((a,b)=>Math.abs(b.y-original.at[1])<=Math.abs(a.y-original.at[1])+1e-7?b:a);
 assert(Math.abs(current.at[1]-deck.y)<.01,row.id+' changed decks');
 const path=layout.circulation.corridors.find(c=>c.id===current.corridor&&c.deck===deck.number);
 assert(path,row.id+' has no current corridor');
 const p=[current.at[0],current.at[2]];let aligned=false,onPath=false;
 for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  if(length<.01||distanceToSegment(p,a,b)>.05)continue;
  onPath=true;if(Math.abs((Math.sin(current.yaw)*dx+Math.cos(current.yaw)*dz)/length)>.999)aligned=true;
 }
 assert(onPath,row.id+' is off the corridor centreline');assert(aligned,row.id+' faces across the corridor');
 const disc=Array.from({length:24},(_,i)=>[p[0]+.4*Math.cos(i*Math.PI/12),p[1]+.4*Math.sin(i*Math.PI/12)]);
 for(const q of [p,...disc]){
  assert(contains(deck.slab.outline,q),row.id+' is outside the ship floor');
  const supported=[...layout.circulation.bridges,...layout.circulation.towers,...(layout.circulation.balconies||[])].some(s=>s.deck===deck.number&&contains(s.polygon,q));
  assert(supported||!deck.slab.holes.some(h=>contains(h.polygon,q)),row.id+' is over a floor opening');
  for(const r of [...layout.cabins,...layout.rooms])if(!r.aggregate&&r.y<deck.y+2&&r.y+r.height>deck.y+.4)assert(!contains(r.polygon,q),row.id+' intersects a cabin or room wall');
 }
 if(current.legacyCorridor.cabin){
  const cabin=layout.cabins.find(c=>c.id===current.legacyCorridor.cabin);assert(cabin&&cabin.deck===deck.number,row.id+' lost its cabin neighbourhood');
  assert.equal(layout.cabinIdMap[current.legacyCorridor.legacyCabin],cabin.id,row.id+' lost its original cabin range');
  assert(Math.hypot(current.at[0]-cabin.door.center[0],current.at[2]-cabin.door.center[2])<10,row.id+' is too far from its mapped cabin row');
 }
}
export function auditNativeLanding(row){
 assert(row.at,row.id+' has no native landing');
 if(row.spot.legacyCorridor||row.spot.feature==='fin-inspection-approach'){
  assert(row.exact,row.id+' needs the native spiral to escape a bad corridor pose');
  assert(row.details.floor,row.id+' has no real floor');assert(row.details.floor.normal[1]>=.7,row.id+' floor is too steep');
  assert(Math.abs(row.details.floor.at[1]-row.spot.at[1])<.13,row.id+' is above or below the real floor');
  assert(!row.details.overlap,row.id+' overlaps the native walker capsule');
  assert(Math.hypot(row.at[0]-row.spot.at[0],row.at[2]-row.spot.at[2])<.05,row.id+' was displaced from its corridor');
 }
 if(row.spot.legacyCorridor){assert(row.ahead,row.id+' faces a nearby physical obstruction');assert(Math.abs(row.ahead[1]-row.spot.at[1])<.13,row.id+' faces off its corridor floor');}
 if(row.source==='ship-log'&&row.inLog)assert(row.nearby,row.id+' is absent from changes near you');
}
