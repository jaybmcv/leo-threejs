import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import layout from 'v2-layout';
import {auditCorridorLanding} from './ship-log-remap-audit.mjs';
import {readSpot,remapSpot} from '../src/walk/link.js';
import {roomAt,toWorld,anchoredPoint,anchoredYaw} from '../src/plan/rooms.js';
import {CABINS} from '../src/plan/v1.js';
import {createLegacyCorridorRemapper,isLegacyCirculation,legacyDeck} from '../src/v2/legacy-corridors.js';
const fixture=JSON.parse(await fs.readFile('scripts/fixtures/phase7-remap-spots.json','utf8'));
const media=JSON.parse(await fs.readFile('scripts/ship-log-media.json','utf8'));
const queries=fixture.map(s=>({id:s.name,source:'66-spots',query:'at='+s.at+'&yaw='+s.yaw+'&pitch='+s.pitch}));
for(const [id,e] of Object.entries(media))for(const [kind,q] of [['go',e.go],...(e.shots||[]).map((s,i)=>['shot-'+i,s.at])])if(q)queries.push({id:'pr'+id+'/'+kind,source:'ship-log',query:q});
assert.equal(fixture.length,66);
assert(!('corridors' in layout.decks[0]),'Test must use the trimmed public-walk layout');
const mapping=createLegacyCorridorRemapper(layout,CABINS),rows=[];
for(const q of queries){
 const original=readSpot('?'+q.query);assert(original,'Invalid source '+q.id);
 const oldRoom=roomAt(original.at,{legacy:true}),current=remapSpot(original);
 assert(current&&current.resolved,q.id+' did not resolve');assert(current.at.every(Number.isFinite),q.id+' nonfinite position');
 assert.equal(remapSpot(current),current,q.id+' remapped twice');
 const v2=remapSpot({...original,lv:2});assert.deepEqual(v2.at,original.at,q.id+' lv=2 moved');assert.equal(v2.yaw,original.yaw);
 const deck=legacyDeck(layout,original.at);
 if(current.legacyCorridor){
  assert(deck);assert.equal(current.at[1],deck.y,q.id+' changed decks');
  assert(mapping.safe(deck,[current.at[0],current.at[2]]),q.id+' lands in solid or void');
  assert(current.corridor,q.id+' missing real corridor');
  const path=layout.circulation.corridors.find(c=>c.id===current.corridor&&c.deck===deck.number);assert(path,q.id+' missing corridor');
  assert(!layout.rooms.some(r=>r.id==='d02-arrival-1'&&pointIn(r.polygon,current.at)),q.id+' fell back to arrival');
  if(current.legacyCorridor.cabin)assert.equal(layout.cabins.find(c=>c.id===current.legacyCorridor.cabin).deck,deck.number);
 }
 const row={...q,oldRoom,original,current};auditCorridorLanding(layout,row);rows.push(row);
}
function pointIn(poly,at){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>at[2])!==(b[1]>at[2])&&at[0]<(b[0]-a[0])*(at[2]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
for(const id of ['pr50','pr55','pr90','pr98','pr99','pr122','pr126','pr128','d6-lane','d10-lane'])assert(rows.find(r=>r.id===id).current.legacyCorridor,id+' lost migration');
// Room frames and cabins remain in the existing adapter path.
const room='d16-library-2',old=readSpot('?at=-46.62,20.3,-37.07&yaw=108'),kept=remapSpot(old);
assert.deepEqual(kept.at,anchoredPoint(room,old.at));assert.equal(kept.yaw,anchoredYaw(room,old.yaw));assert(!kept.legacyCorridor);
const cabin=CABINS[0],oldCabin=remapSpot({at:[cabin.x,cabin.y,cabin.z],yaw:0,room:cabin.id,lv:1});assert.deepEqual(oldCabin.at,toWorld(layout.cabinIdMap[cabin.id],[0,0,0]));
await fs.mkdir('output/phase7',{recursive:true});
await fs.writeFile('output/phase7/remap-table.json',JSON.stringify({status:'PASS',runtimeLayout:true,positions:rows.length,corridors:rows.filter(r=>r.current.legacyCorridor).length,rows},null,2)+'\n');
console.log('Phase 7 remap: '+rows.length+' source positions; '+rows.filter(r=>r.current.legacyCorridor).length+' corridor migrations; trimmed runtime layout PASS');
