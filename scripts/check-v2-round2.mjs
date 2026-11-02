
import {plannedStanding} from '../src/v2/standing.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {requireCabinFootprints} from '../src/plan/cabin-footprints-v2.js';
import {requireCurrentWalkReport,WALK_REPORT_VERSION} from './v2-walk-identity.mjs';
import {requireRoomDropPolicy,ROOM_DROP_ALLOWLIST} from './v2-walk-policy.mjs';
import {checkV2Adapters} from './v2-adapters.mjs';
const layout=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8')),checks=[],expect=(name,fn,regex)=>{assert.throws(fn,regex,name);checks.push(name);};
checks.push('All '+requireCabinFootprints(layout).cabins+' cabin footprints and corridor thresholds pass');
for(const kind of ['cabin','corridor','stair']){
 const p=structuredClone(layout),c=p.cabins[0];
 if(kind==='cabin')p.cabins[1]={...p.cabins[1],deck:c.deck,polygon:c.polygon};
 if(kind==='corridor')p.circulation.corridors.push({id:'BROKEN_TEST_CORRIDOR',deck:c.deck,width:2,points:[[c.x-1,c.z],[c.x+1,c.z]]});
 if(kind==='stair')p.circulation.stairs.push({id:'BROKEN_TEST_STAIR',deck:c.deck,polygon:c.polygon});
 expect('Injected '+kind+' overlap rejected',()=>requireCabinFootprints(p),/footprint overlaps/);
}
assert(!plannedStanding(layout,12.7,28.628734,61.5),'Outboard hull ledge must not be a go-to landing');assert(!plannedStanding(layout,12.7,29.425,52.48),'Guard caps must not be go-to floors');assert(plannedStanding(layout,12.7,28.3,54.3),'Garden gallery is an interior landing');checks.push('Outboard hull and guard-top landings rejected; real garden gallery accepted');
const identity={hash:'current'},valid={reportVersion:WALK_REPORT_VERSION,buildIdentity:identity,status:'PASS',privateLiftStops:[17,18,19].map(deck=>({deck,reached:true})),privateLiftsRidden:['clubhouse-tube-lift'],guardGaps:[],roomFeatureDrops:[],roomFeatureViolations:[],safeReach:{},berths:{},cabinChairs:{},loungeSeats:{},hullInterfaces:{}};
requireCurrentWalkReport(valid,identity);
expect('Missing walk report rejected',()=>requireCurrentWalkReport(null,identity),/npm run check:walk/);
expect('Old-format walk report rejected',()=>requireCurrentWalkReport({status:'PASS'},identity),/old-format.*npm run check:walk/);
expect('Stale build identity rejected',()=>requireCurrentWalkReport({...valid,buildIdentity:{hash:'stale'}},identity),/another build.*npm run check:walk/);
expect('Removed guard array rejected',()=>requireCurrentWalkReport({...valid,guardGaps:undefined},identity),/old-format.*npm run check:walk/);
expect('Missing private lift landings rejected',()=>requireCurrentWalkReport({...valid,privateLiftStops:[]},identity),/old-format/);
expect('Unreached private lift landing rejected',()=>requireCurrentWalkReport({...valid,privateLiftStops:valid.privateLiftStops.map((s,i)=>({...s,reached:i!==1}))},identity),/old-format/);
expect('Unridden private lift rejected',()=>requireCurrentWalkReport({...valid,privateLiftsRidden:[]},identity),/old-format/);
const bad={from:[12.7,29.425,52.5],to:[13.05,24.306,52.5],drop:5.119,category:'room-feature'};
expect('Original sky-garden 5.119 m step-off rejected',()=>requireRoomDropPolicy([bad],layout),/Unapproved room-feature drops/);
const r=layout.rooms.find(r=>r.id==='observation-lounge'),fixture={from:[182.8,r.y+1.12,16],to:[183.15,r.y+.033,16],drop:1.087,category:'room-feature'},supports=[{room:r.id,name:'Soft_back',top:r.y+1.12,min:[182,r.y,15],max:[184,r.y+1.12,17]}];
requireRoomDropPolicy([fixture],layout,{supports});checks.push('Named v1 furniture exception passes within its measured height and same-floor landing');
expect('Guard cap cannot use furniture exception',()=>requireRoomDropPolicy([fixture],layout,{supports:[{...supports[0],name:'V2_guard_cap'}]}),/Unapproved/);
expect('Deeper drop cannot use furniture exception',()=>requireRoomDropPolicy([{...fixture,drop:4,to:[183.15,r.y-3,16]}],layout,{supports}),/Unapproved/);
const adapters=await checkV2Adapters();assert.equal(adapters.issues.length,0);
const report={status:'PASS',checks,allowList:ROOM_DROP_ALLOWLIST};await fs.mkdir('output/phase3/round2',{recursive:true});await fs.writeFile('output/phase3/round2/regressions.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
