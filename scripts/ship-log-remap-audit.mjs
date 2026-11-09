import assert from 'node:assert/strict';
import {contains,distanceToSegment} from '../src/plan/geometry-v2.js';

// Audit final poses independently of candidate selection. Native measurements
// additionally prove the real prepared floor and the unchanged walker capsule.
// The walk remaps an old link only on an old deck (legacyDeck in src/v2/legacy-corridors.js). This is written out again,
// not imported, so a change to the runtime rule cannot quietly move the audit with it; the fixture pins both at the
// deck boundaries.
export const onOldDeck=(layout,at)=>layout.decks.some(d=>Math.abs(d.y-at[1])<=2.05);
const corridorEligible=(row,current)=>(!row.oldRoom||/^(circulation-|lift-|stairs-|service-lift-)/.test(row.oldRoom))&&!current.feature;
// A link the corridor audit would take but that is on no old deck, such as the Keel Club below Deck 1. It never had a
// corridor, so it must land exactly where it points, and auditNativeLanding proves the floor and capsule there.
export const offDeckLink=(layout,row,current=row.current||row.spot)=>corridorEligible(row,current)&&!onOldDeck(layout,row.original.at);
export function auditCorridorLanding(layout,row){
 const {original,current}=row;
 if(!corridorEligible(row,current))return;
 if(offDeckLink(layout,row,current)){assert(!current.legacyCorridor&&Math.hypot(...current.at.map((v,i)=>v-original.at[i]))<.01,row.id+' moved a link that is on no old deck');return;}
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
// Pass layout (as the native gate does) to hold off-deck links to the same floor and capsule proof as corridor links.
export function auditNativeLanding(row,layout=null){
 assert(row.at,row.id+' has no native landing');
 const offDeck=!!layout&&offDeckLink(layout,row,row.spot);
 if(row.spot.legacyCorridor||row.spot.feature==='fin-inspection-approach'||offDeck){
  assert(row.exact,row.id+' needs the native spiral to escape a bad corridor pose');
  assert(row.details.floor,row.id+' has no real floor');assert(row.details.floor.normal[1]>=.7,row.id+' floor is too steep');
  assert(Math.abs(row.details.floor.at[1]-row.spot.at[1])<.13,row.id+' is above or below the real floor');
  assert(!row.details.overlap,row.id+' overlaps the native walker capsule');
  assert(Math.hypot(row.at[0]-row.spot.at[0],row.at[2]-row.spot.at[2])<.05,row.id+(offDeck?' was displaced from where it points':' was displaced from its corridor'));
 }
 if(row.spot.legacyCorridor){assert(row.ahead,row.id+' faces a nearby physical obstruction');assert(Math.abs(row.ahead[1]-row.spot.at[1])<.13,row.id+' faces off its corridor floor');}
 if(row.source==='ship-log'&&row.inLog)assert(row.nearby,row.id+' is absent from changes near you');
}
