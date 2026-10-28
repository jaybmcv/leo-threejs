import {walkBuildIdentity,WALK_REPORT_VERSION} from './v2-walk-identity.mjs';
import {classifyRoomDrops} from './v2-walk-policy.mjs';
import phase2Baseline from '../src/plan/phase2-walk-baseline.json' with {type:'json'};
import fs from 'node:fs/promises';
import * as T from 'three';
import layout from 'v2-layout';
const CABINS=layout.cabins;
const SHIP_AREAS=[...layout.rooms,...layout.fixedRooms].filter(r=>!r.aggregate);
import {cabinPlacements} from '../src/walk/world.js';
import {BODY,bandOf} from '../src/walk/collision.js';
import {LIFTS,carTriangles} from '../src/walk/lifts.js';
import {toWorld,objectRoom} from '../src/plan/rooms.js';
import {contains} from '../src/plan/geometry-v2.js';
import {findRestSpots,solidSpots} from '../src/walk/rest.js';
import {preparedV2} from './v2-world.mjs';

// Walk the whole ship as a 2 m tall, 0.7 m wide walker (Voyager's Reach's capsule, floating 0.4 m over the floor),
// from the Deck 2 arrival hall, through every opening a body that size fits, up and down the stairs and in every
// lift (a car waits at each stop), and off every edge it can walk over (a fall lands wherever the floor below is).
// Then check that every room, cabin, lift stop, seat and bed is reachable and that
// no walkable spot is open to space. About ten minutes; `npm run check:walk`.
const buildIdentity=await walkBuildIdentity();
const t0=Date.now(),log=(...a)=>console.log(((Date.now()-t0)/1000).toFixed(0)+'s',...a);
const {ship,prepared,plan,image}=await preparedV2({map:!!process.env.REPLAN});if(process.env.REPLAN){plan.shells=layout.rooms.filter(r=>!r.aggregate).map(r=>({id:r.id,deck:r.deck,polygon:r.polygon,door:r.door,fittingDoor:r.fittingDoor}));await fs.writeFile('output/leo-interior-v02/walk-plan.json',JSON.stringify(plan));await fs.writeFile('output/leo-interior-v02/walk-map.png',image);}
// The partitions, railings and colliders exactly as the page has them (scripts/walk-plan.mjs).
const col=prepared.colliders,dropped=prepared.dropped,walls=plan.walls,rails=plan.rails;
// Automatic lounge doors open on approach in the page; the static reachability flood holds them open.
if(prepared.lounge)prepared.lounge.update(.6,prepared.lounge.doors.map(d=>d.centre),new T.Vector3());
log('exterior triangles inside the decks, dropped:',dropped,'; partitions',walls.length,'; railings',rails.length,`(${Math.round(rails.reduce((s,r)=>s+r[3]-r[2],0))} m)`);
for(const lift of LIFTS)for(const stop of lift.stops)col.addMover(lift.id,carTriangles(lift,[stop.door||lift.door]),new T.Matrix4().makeTranslation(lift.car.x,stop.y,lift.car.z));
log('world built:',col.triangles,'static triangles');

const {radius:R,height:H,step:STEP}=BODY,G=.35,MIN_NY=Math.cos(BODY.maxSlope*Math.PI/180);
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3(new T.Vector3(),new T.Vector3());
// The controller's five-ray foot probe (controller.js): the highest walkable ground under the feet.
const FEET=[[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]];
// The centre ray settles almost every probe; the other four only matter over a gap (a lift sill).
const probe=(x,y,z,up,down)=>{ray.origin.set(x,y+up,z);ray.direction.set(0,-1,0);const h=col.raycast(ray,down);return h&&h.normal.y>=MIN_NY?h.point.y:null;};
const floorAt=(x,y,z,up=STEP+.05,down=2*STEP+.1)=>{const c=probe(x,y,z,up,down);if(c!==null&&Math.abs(c-y)<=STEP)return c;let best=c;for(const [dx,dz] of FEET.slice(1)){const h=probe(x+dx,y,z+dz,up,down);if(h!==null&&(best===null||h>best))best=h;}return best;};
const stands=(x,y,z)=>{seg.start.set(x,y+STEP+R,z);seg.end.set(x,y+H-R,z);return !col.overlaps(seg,R);};

// Stairs: climb every flight tread by tread along its middle (each tread a step of the one below it, close in plan),
// so a partition or anything else standing across a flight shows up even where both of its ends are reached.
const treads=[];ship.inside.traverse(o=>{if(!o.isMesh||!/^(Stair_tread_up|Stair_tread_return|Aft_stair_up|Aft_stair_return|Gallery_stair)$/.test(o.name))return;
 o.geometry.computeBoundingBox();const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);treads.push({x:(b.min.x+b.max.x)/2,y:b.max.y,z:(b.min.z+b.max.z)/2});});
const blockedSteps=[],blockedStepDetails=[];let flightSteps=0;
for(const a of treads)for(const b of treads){if(b.y<=a.y+.02||b.y>a.y+.25||Math.hypot(b.x-a.x,b.z-a.z)>.6)continue;flightSteps++;
 let y=a.y,ok=true,lastTest=null;for(let t=0;t<=1.001&&ok;t+=.1){const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,fy=floorAt(x,y,z);ok=fy!==null&&stands(x,fy,z);lastTest={x,y,z,fy,ok};if(ok)y=fy;}
 if(!ok){blockedSteps.push([a.x,a.y,a.z].map(v=>+v.toFixed(1)));if(blockedStepDetails.length<12)blockedStepDetails.push({a,b,lastTest});}}
await fs.writeFile('output/leo-interior-v02/stair-report.json',JSON.stringify({steps:flightSteps,blocked:blockedSteps,details:blockedStepDetails},null,2));
log('stair steps climbed:',flightSteps-blockedSteps.length,'/',flightSteps,blockedSteps.slice(0,10));

if(process.env.STAIRS_ONLY){process.exitCode=blockedSteps.length?1:0;process.exit();}
// Diagnostics: SEED=x,y,z floods from elsewhere, BUDGET caps the positions and stops after the flood, DUMP saves them.
const seed=process.env.SEED?process.env.SEED.split(',').map(Number):toWorld('d02-arrival-1',[-20,0,0]),BUDGET=+(process.env.BUDGET||Infinity);
const S0={x:seed[0],z:seed[2]};S0.y=floorAt(S0.x,seed[1],S0.z,1,3);
const key=(x,y,z)=>((Math.round((x-S0.x)/G)+2000)*4000+(Math.round((z-S0.z)/G)+2000))*1000+Math.round((y+60)*2);
const snap=(v,o)=>o+Math.round((v-o)/G)*G;
const seen=new Set(),blocked=new Set(),X=[],Y=[],Z=[];
const push=(x,y,z)=>{const k=key(x,y,z);if(seen.has(k))return;seen.add(k);X.push(x);Y.push(y);Z.push(z);};
push(S0.x,S0.y,S0.z);
const ridden=new Set(),DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];let falls=0,voidFalls=0,safeCount=null;const voids=[],fallEvents=[],pendingFalls=[],fallKeys=new Set();
const category=(x,y,z)=>{if((ship.v2GuardPlatforms||[]).some(p=>Math.abs(p.y-y)<.4&&x>=p.x0-.9&&x<=p.x1+.9&&z>=p.z0-.9&&z<=p.z1+.9&&Math.min(Math.abs(x-p.x0),Math.abs(x-p.x1),Math.abs(z-p.z0),Math.abs(z-p.z1))<.9))return 'terrace/bridge';const d=layout.decks.reduce((a,b)=>Math.abs(a.y-y)<Math.abs(b.y-y)?a:b),near=(p,r=.9)=>{for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<r)return true;}return false;};if(treads.some(t=>Math.abs(t.y-y)<.8&&Math.hypot(t.x-x,t.z-z)<1))return 'stair-side';if(layout.circulation.stairs.some(s=>s.wing!==undefined&&Math.abs(layout.decks[s.deck-1].y-y)<4.1&&(contains(s.polygon,[x,z])||near(s.polygon))))return 'stair-side';if(layout.circulation.ramps.some(s=>contains(s.polygon,[x,z])||near(s.polygon)))return 'ramp';if(layout.circulation.bridges.some(s=>s.deck===d.number&&(contains(s.polygon,[x,z])||near(s.polygon))))return 'terrace/bridge';if(d.slab.holes.some(h=>near(h.polygon)))return 'atrium/void-edge';if(layout.rooms.some(r=>y>=r.y-.2&&y<=r.y+r.height&&r.polygon&&contains(r.polygon,[x,z])))return 'room-feature';return 'other';};
const recordFall=(x,y,z,nx,fy,nz,newLanding)=>{const k=[x,y,z,nx,fy,nz].map(v=>v.toFixed(2)).join();if(fallKeys.has(k))return;fallKeys.add(k);fallEvents.push({from:[x,y,z],to:[nx,fy,nz],drop:+(y-fy).toFixed(3),category:category(x,y,z),newLanding});};
// Walking off an edge: the walker falls from where it stepped to the first walkable ground below (or none: the void).
const fall=(x,y,z)=>{ray.origin.set(x,y+STEP,z);ray.direction.set(0,-1,0);const h=col.raycast(ray,120);return h&&h.normal.y>=MIN_NY?h.point.y:null;};
for(let head=0;head<BUDGET;head++){
 if(head===X.length){if(safeCount===null)safeCount=X.length;let added=0;for(const p of pendingFalls.splice(0)){const n=X.length;push(...p);added+=X.length-n;}if(!added)break;}
 const x=X[head],y=Y[head],z=Z[head];
 if(head%500000===0&&head)log('flood',head);
 for(const [dx,dz] of DIRS){
  const nx=x+dx*G,nz=z+dz*G;let fy=floorAt(nx,y,nz);
  // Nothing within a step: if the body fits there, it falls (only straight moves, so a corner is not cut).
  if(fy===null&&!dx!==!dz&&stands(nx,y,nz)){fy=fall(nx,y,nz);if(fy===null){if(voids.length<20)voids.push([nx,y,nz].map(v=>+v.toFixed(1)));voidFalls++;continue;}if(y-fy>STEP){const k=key(nx,fy,nz),fresh=!seen.has(k)&&!blocked.has(k);recordFall(x,y,z,nx,fy,nz,fresh);if(fresh){if(stands(nx,fy,nz)){falls++;if(safeCount===null)pendingFalls.push([nx,fy,nz]);else push(nx,fy,nz);}else blocked.add(k);}}continue;}
  if(fy===null||Math.abs(fy-y)>STEP)continue;
  const k=key(nx,fy,nz);if(seen.has(k)||blocked.has(k))continue;
  if(stands(nx,fy,nz))push(nx,fy,nz);else blocked.add(k);
 }
 // Standing in a car at one stop reaches every stop of that lift.
 for(const lift of LIFTS){const c=lift.car;if(ridden.has(lift.id)||Math.abs(x-c.x)>c.width/2-.4||Math.abs(z-c.z)>c.depth/2-.4||!lift.stops.some(s=>Math.abs(s.y-y)<.3))continue;
  ridden.add(lift.id);for(const s of lift.stops){const sx=snap(c.x,S0.x),sz=snap(c.z,S0.z),fy=floorAt(sx,s.y,sz);if(fy!==null&&stands(sx,fy,sz))push(sx,fy,sz);}}
}
log('flood done:',X.length,'positions');
if(process.env.DUMP)await fs.writeFile(process.env.DUMP,Buffer.from(new Float32Array(X.flatMap((x,i)=>[x,Y[i],Z[i]])).buffer));
if(Number.isFinite(BUDGET)){const box=new T.Box3();for(let i=0;i<X.length;i++)box.expandByPoint(new T.Vector3(X[i],Y[i],Z[i]));log('reached box',box.min.toArray().map(Math.round),box.max.toArray().map(Math.round),'lifts ridden',[...ridden]);process.exit(0);}

// Reached positions near a point (plan radius r, height window [y-below, y+above]).
const cells=new Map();for(let i=0;i<X.length;i++){const k=Math.floor(X[i])+','+Math.floor(Z[i]);(cells.get(k)||cells.set(k,[]).get(k)).push(i);}
const reached=(x,y,z,r=.6,below=.6,above=.6,safeOnly=false)=>{for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++)for(let j=Math.floor(z-r);j<=Math.floor(z+r);j++)for(const n of cells.get(i+','+j)||[])if((!safeOnly||n<safeCount)&&Math.hypot(X[n]-x,Z[n]-z)<=r&&Y[n]>=y-below&&Y[n]<=y+above)return true;return false;};
const problems=[];
if(blockedSteps.length)problems.push(`stairs: ${blockedSteps.length}/${flightSteps} steps blocked, first at ${blockedSteps.slice(0,5).join(' ')}`);
const area=new Map();for(let i=0;i<X.length;i++){const b=bandOf(Y[i]+.2)+1;area.set(b,(area.get(b)||0)+G*G);}
// Rooms: every standable 2 m sample on the room's floor should be reached.
// (The lifeboat banks are one 249 x 139 m area spanning the whole deck, walled-off plate included; their boats are
// checked through their seats below.)
const rooms=SHIP_AREAS.filter(a=>a.kind!=='lifeboats').map(a=>{const [cx,cy,cz]=a.center;let ok=0,st=0,safe=0;
 for(let x=cx-a.width/2+1;x<=cx+a.width/2-1;x+=2)for(let z=cz-a.depth/2+1;z<=cz+a.depth/2-1;z+=2){const dx=x-cx,dz=z-cz,px=cx+Math.cos(a.yaw)*dx+Math.sin(a.yaw)*dz,pz=cz-Math.sin(a.yaw)*dx+Math.cos(a.yaw)*dz;if(a.polygon&&!contains(a.polygon,[px,pz]))continue;const fy=floorAt(px,cy+.5,pz,1.5,3);if(fy===null||!stands(px,fy,pz))continue;st++;if(reached(px,fy,pz))ok++;if(reached(px,fy,pz,.6,.6,.6,true))safe++;}
 return {id:a.id,name:a.name,deck:a.deck,samples:st,reached:ok,safeReached:safe};});
for(const r of rooms)if(!r.samples||r.reached/r.samples<.8)problems.push(`room ${r.id} (${r.name}): ${r.reached}/${r.samples} floor samples reached`);
// Cabins: the floor between the berths of every one of the 5,000.
let cabins=0;const missedCabins=[];for(const c of CABINS){if(reached(c.x,c.y,c.z,.7))cabins++;else missedCabins.push([c.id,c.x,c.y,c.z]);}if(cabins!==CABINS.length)problems.push('cabins: '+cabins+'/'+CABINS.length+' reached');
// Lifts: the landing in front of every stop.
let stops=0,stopCount=0;
for(const lift of LIFTS)for(const s of lift.stops){stopCount++;const d=s.door||lift.door,f=d.axis==='z'?[0,d.sign]:[d.sign,0],half=(d.axis==='z'?lift.car.depth:lift.car.width)/2;
 if(reached(lift.car.x+f[0]*(half+1),s.y,lift.car.z+f[1]*(half+1),.8,.3,.3))stops++;else problems.push(`lift ${lift.id}: ${s.label} landing not reached`);}
// Seats and beds: somewhere to stand within 1.6 m.
const spots=solidSpots(prepared.restSpots,col);let usable=0;const unusable=new Map();
for(const s of spots){if(reached(s.point.x,s.height-.2,s.point.z,1.6,1.3,.25))usable++;else{const k=`${s.kind} near ${Math.round(s.point.x)},${Math.round(s.height)},${Math.round(s.point.z)}`;unusable.set(k,(unusable.get(k)||0)+1);}}
const restRatio=usable/spots.length;if(restRatio<1)problems.push(`seats and beds: ${usable}/${spots.length} usable`);
const cabinIds=new Set(CABINS.map(c=>c.id)),berthSpots=spots.filter(s=>cabinIds.has(s.room)&&s.kind==='lie');const usableBerths=berthSpots.filter(s=>reached(s.point.x,s.height-.2,s.point.z,1.6,1.3,.25)).length;if(berthSpots.length!==10000||usableBerths!==10000)problems.push('berths: '+usableBerths+'/10000 usable');
const cabinChairs=spots.filter(s=>cabinIds.has(s.room)&&s.kind==='sit'),usableCabinChairs=cabinChairs.filter(s=>reached(s.point.x,s.height-.2,s.point.z,1.45,1,.4,true)).length;if(usableCabinChairs!==cabinChairs.length)problems.push('cabin chairs: '+usableCabinChairs+'/'+cabinChairs.length+' reachable without falling');
// The Deck 20 crew recovery lounge's seven sleeping pods: a bed in each, with somewhere to stand in front of it.
// Space: a reached spot with nothing overhead is outside the ship.
let open=0;const openAt=[];for(let i=0;i<X.length;i+=13){ray.origin.set(X[i],Y[i]+1,Z[i]);ray.direction.set(0,1,0);if(!col.raycast(ray,200)){open++;openAt.push([X[i],Y[i],Z[i]].map(v=>+v.toFixed(1)));}}
if(open)problems.push(`${open} sampled positions open to space`);
if(voidFalls)problems.push(`${voidFalls} edges fall out of the ship`);

const rampReach=[132,136,140,146,150,160,170,180,190].map(x=>{const y=24.3+Math.max(0,Math.min(24,x-146))/12,fy=floorAt(x,y,0);return {x,y,fy,stands:fy!==null&&stands(x,fy,0),reached:reached(x,y,0,.8)};});
const fallBreakdown={byHeight:Object.fromEntries([['.4-1m',.4,1],['1-4m',1,4],['4-12m',4,12],['12m+',12,Infinity]].map(([k,a,b])=>[k,fallEvents.filter(f=>f.drop>a&&f.drop<=b).length])),byCategory:Object.fromEntries(['atrium/void-edge','terrace/bridge','stair-side','ramp','room-feature','other'].map(k=>[k,{attempts:fallEvents.filter(f=>f.category===k).length,over1m:fallEvents.filter(f=>f.category===k&&f.drop>1).length}]))};
const safeCabins=CABINS.filter(c=>reached(c.x,c.y,c.z,.7,.6,.6,true)).length,safeRooms=rooms.filter(r=>r.safeReached>0).length;let safeStops=0;for(const l of LIFTS)for(const s of l.stops){const d=s.door||l.door,f=d.axis==='z'?[0,d.sign]:[d.sign,0],h=(d.axis==='z'?l.car.depth:l.car.width)/2;if(reached(l.car.x+f[0]*(h+1),s.y,l.car.z+f[1]*(h+1),.8,.3,.3,true))safeStops++;}if(safeStops!==stopCount)problems.push('lift stops without falling: '+safeStops+'/'+stopCount);if(safeRooms!==rooms.length)problems.push('rooms without falling: '+safeRooms+'/'+rooms.length);
const guardGaps=fallEvents.filter(f=>f.drop>1&&['atrium/void-edge','terrace/bridge','stair-side','ramp'].includes(f.category));if(guardGaps.length&&!process.env.FALL_BASELINE)problems.push(guardGaps.length+' unguarded drops over 1 m');if(safeCabins!==CABINS.length)problems.push('cabins reachable without falling: '+safeCabins);
const supports=[];ship.inside.updateMatrixWorld(true);ship.inside.traverse(o=>{if(!o.isMesh||!['Soft_back','Garden_bench_back'].includes(o.name))return;const room=objectRoom(o);if(!['observation-lounge','commons-10'].includes(room))return;const b=new T.Box3().setFromObject(o,true);supports.push({room,name:o.name,top:b.max.y,min:b.min.toArray(),max:b.max.toArray()});});
// Young explorers' step towers (src/walk/kittens.js) are climbable on purpose: name their 1.05 m top pads (1 x 1 m
// collider boxes) so the allow-list can match drops from them.
if(prepared.kittens){prepared.kittens.solid.updateMatrixWorld(true);prepared.kittens.solid.traverse(o=>{const p=o.geometry?.parameters;if(!o.isMesh||!p||Math.abs(p.width-1)>.01||Math.abs(p.depth-1)>.01||Math.abs(p.height-1.05)>.01)return;const b=new T.Box3().setFromObject(o,true),c=b.getCenter(new T.Vector3()),room=layout.rooms.find(r=>!r.aggregate&&b.min.y>=r.y-.1&&b.min.y<=r.y+.1&&contains(r.polygon,[c.x,c.z]));if(room)supports.push({room:room.id,name:'Kitten_step_tower_pad',top:b.max.y,min:b.min.toArray(),max:b.max.toArray()});});}
const {roomFeatureDrops,roomFeatureViolations}=classifyRoomDrops(fallEvents,layout,{supports});if(roomFeatureViolations.length)problems.push(roomFeatureViolations.length+' unapproved room-feature drops over 1 m');
if((await walkBuildIdentity()).hash!==buildIdentity.hash)problems.push('Build changed during walk check; rerun check:walk');
const report={reportVersion:WALK_REPORT_VERSION,buildIdentity,roomFeatureDrops,roomFeatureViolations,phase2Baseline,fallMetrics:{landings:falls,transitions:fallEvents.length,guardTransitionsOver1m:guardGaps.length,method:"All reachable step-off transitions; no-fall flood first, then fall-only positions. Phase 2 reference retains its original landing counter."},fallBreakdown,fallEvents,guardGaps,safeReach:{positions:safeCount,cabins:safeCabins,rooms:safeRooms,liftStops:safeStops},rampReach,status:problems.length?'FAIL':'PASS',walker:{height:H,width:2*R,step:STEP},positions:X.length,falls,voidFalls,voids,railings:{count:rails.length,metres:Math.round(rails.reduce((s,r)=>s+r[3]-r[2],0))},walkableM2ByDeck:Object.fromEntries([...area].sort((a,b)=>a[0]-b[0]).map(([b,a])=>[b,Math.round(a)])),
 rooms:{total:rooms.length,below80:rooms.filter(r=>!r.samples||r.reached/r.samples<.8).length},cabins:`${cabins}/${CABINS.length}`,missedCabins:missedCabins.slice(0,20),liftStops:`${stops}/${stopCount}`,
 cabinChairs:{total:cabinChairs.length,usable:usableCabinChairs},berths:{total:berthSpots.length,usable:usableBerths},seatsAndBeds:{spots:spots.length,usable,seats:spots.filter(s=>s.kind==='sit').length,beds:spots.filter(s=>s.kind==='lie').length,unusable:[...unusable].slice(0,40)},openToSpace:open,openAt:openAt.slice(0,20),problems};
await fs.writeFile('output/leo-interior-v02/walk-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,fallEvents:report.fallEvents.slice(0,10),guardGaps:report.guardGaps.slice(0,10),seatsAndBeds:{...report.seatsAndBeds,unusable:report.seatsAndBeds.unusable.slice(0,12)}},null,1));
log(report.status);if(problems.length)process.exitCode=1;
