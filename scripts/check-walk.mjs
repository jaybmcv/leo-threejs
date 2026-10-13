import fs from 'node:fs/promises';
import * as T from 'three';
import {CABINS,SAMPLE} from '../src/model.js';
import {SHIP_AREAS} from '../src/areas.js';
import {buildColliders,cabinPlacements,prepareExteriorForWalking} from '../src/walk/world.js';
import {solid,BODY,bandOf} from '../src/walk/collision.js';
import {LIFTS,STATIC_LIFT_PARTS,carTriangles} from '../src/walk/lifts.js';
import {planPartitions,partitionMesh} from '../src/walk/partitions.js';
import {findRestSpots,solidSpots} from '../src/walk/rest.js';
import {loadWalkShip} from './walk-plan.mjs';

// Walk the whole ship as a 2 m tall, 0.7 m wide walker (Voyager's Reach's capsule, floating 0.4 m over the floor),
// from the Deck 2 arrival hall, through every opening a body that size fits, up and down the stairs and in every
// lift (a car waits at each stop). Then check that every room, cabin, lift stop, seat and bed is reachable and that
// no walkable spot is open to space. About ten minutes; `npm run check:walk`.
const t0=Date.now(),log=(...a)=>console.log(((Date.now()-t0)/1000).toFixed(0)+'s',...a);
const ship=await loadWalkShip();
ship.inside.add(partitionMesh(planPartitions(ship)));
ship.inside.traverse(o=>{if(STATIC_LIFT_PARTS.test(o.name))o.visible=false;});
log('exterior triangles inside the decks, dropped:',prepareExteriorForWalking(ship));
const col=buildColliders(ship,{extra:[ship.exterior],filter:o=>solid(o)&&!STATIC_LIFT_PARTS.test(o.name)});
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

// Diagnostics: SEED=x,y,z floods from elsewhere, BUDGET caps the positions and stops after the flood, DUMP saves them.
const seed=(process.env.SEED||'-135,-35.7,-38').split(',').map(Number),BUDGET=+(process.env.BUDGET||Infinity);
const S0={x:seed[0],z:seed[2]};S0.y=floorAt(S0.x,seed[1],S0.z,1,3);
const key=(x,y,z)=>((Math.round((x-S0.x)/G)+2000)*4000+(Math.round((z-S0.z)/G)+2000))*1000+Math.round((y+60)*2);
const snap=(v,o)=>o+Math.round((v-o)/G)*G;
const seen=new Set(),blocked=new Set(),X=[],Y=[],Z=[];
const push=(x,y,z)=>{const k=key(x,y,z);if(seen.has(k))return;seen.add(k);X.push(x);Y.push(y);Z.push(z);};
push(S0.x,S0.y,S0.z);
const ridden=new Set(),DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
for(let head=0;head<X.length&&head<BUDGET;head++){
 const x=X[head],y=Y[head],z=Z[head];
 if(head%500000===0&&head)log('flood',head);
 for(const [dx,dz] of DIRS){
  const nx=x+dx*G,nz=z+dz*G,fy=floorAt(nx,y,nz);if(fy===null||Math.abs(fy-y)>STEP)continue;
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
const reached=(x,y,z,r=.6,below=.6,above=.6)=>{for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++)for(let j=Math.floor(z-r);j<=Math.floor(z+r);j++)for(const n of cells.get(i+','+j)||[])if(Math.hypot(X[n]-x,Z[n]-z)<=r&&Y[n]>=y-below&&Y[n]<=y+above)return true;return false;};
const problems=[];
const area=new Map();for(let i=0;i<X.length;i++){const b=bandOf(Y[i]+.2)+1;area.set(b,(area.get(b)||0)+G*G);}
// Rooms: every standable 2 m sample on the room's floor should be reached.
// (The lifeboat banks are one 249 x 139 m area spanning the whole deck, walled-off plate included; their boats are
// checked through their seats below.)
const rooms=SHIP_AREAS.filter(a=>a.kind!=='lifeboats').map(a=>{const [cx,cy,cz]=a.center;let ok=0,st=0;
 for(let x=cx-a.width/2+1;x<=cx+a.width/2-1;x+=2)for(let z=cz-a.depth/2+1;z<=cz+a.depth/2-1;z+=2){const fy=floorAt(x,cy+.5,z,1.5,3);if(fy===null||!stands(x,fy,z))continue;st++;if(reached(x,fy,z))ok++;}
 return {id:a.id,name:a.name,deck:a.deck,samples:st,reached:ok};});
for(const r of rooms)if(!r.samples||r.reached/r.samples<.8)problems.push(`room ${r.id} (${r.name}): ${r.reached}/${r.samples} floor samples reached`);
// Cabins: the floor between the berths of every one of the 5,000.
const between=new T.Vector3(SAMPLE.x,SAMPLE.y,SAMPLE.z+.2);let cabins=0;
// Each residential deck has its own sample cabin (the template, moved 4 m a deck) plus 499 copies.
const samples=[6,7,8,9,10,11,12,13,14,15].map(d=>between.clone().setY(between.y+(d-15)*4));
const missedCabins=[];for(const c of samples.concat(cabinPlacements().map(p=>between.clone().applyMatrix4(p.matrix))))if(reached(c.x,c.y,c.z))cabins++;else missedCabins.push(c.toArray().map(v=>+v.toFixed(1)));
if(cabins!==CABINS.length)problems.push(`cabins: ${cabins}/${CABINS.length} reached`);
// Lifts: the landing in front of every stop.
let stops=0,stopCount=0;
for(const lift of LIFTS)for(const s of lift.stops){stopCount++;const d=s.door||lift.door,f=d.axis==='z'?[0,d.sign]:[d.sign,0],half=(d.axis==='z'?lift.car.depth:lift.car.width)/2;
 if(reached(lift.car.x+f[0]*(half+1),s.y,lift.car.z+f[1]*(half+1),.8,.3,.3))stops++;else problems.push(`lift ${lift.id}: ${s.label} landing not reached`);}
// Seats and beds: somewhere to stand within 1.6 m.
const spots=solidSpots(findRestSpots(ship.inside),col);let usable=0;const unusable=new Map();
for(const s of spots){if(reached(s.point.x,s.height-.2,s.point.z,1.6,1.3,.25))usable++;else{const k=`${s.kind} near ${Math.round(s.point.x)},${Math.round(s.height)},${Math.round(s.point.z)}`;unusable.set(k,(unusable.get(k)||0)+1);}}
const restRatio=usable/spots.length;if(restRatio<.995)problems.push(`seats and beds: ${usable}/${spots.length} usable`);
// Space: a reached spot with nothing overhead is outside the ship.
let open=0;const openAt=[];for(let i=0;i<X.length;i+=13){ray.origin.set(X[i],Y[i]+1,Z[i]);ray.direction.set(0,1,0);if(!col.raycast(ray,200)){open++;openAt.push([X[i],Y[i],Z[i]].map(v=>+v.toFixed(1)));}}
if(open)problems.push(`${open} sampled positions open to space`);

const report={status:problems.length?'FAIL':'PASS',walker:{height:H,width:2*R,step:STEP},positions:X.length,walkableM2ByDeck:Object.fromEntries([...area].sort((a,b)=>a[0]-b[0]).map(([b,a])=>[b,Math.round(a)])),
 rooms:{total:rooms.length,below80:rooms.filter(r=>!r.samples||r.reached/r.samples<.8).length},cabins:`${cabins}/${CABINS.length}`,missedCabins:missedCabins.slice(0,20),liftStops:`${stops}/${stopCount}`,
 seatsAndBeds:{spots:spots.length,usable,seats:spots.filter(s=>s.kind==='sit').length,beds:spots.filter(s=>s.kind==='lie').length,unusable:[...unusable].slice(0,40)},openToSpace:open,openAt:openAt.slice(0,20),problems};
await fs.writeFile('output/leo-interior-v01/walk-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,seatsAndBeds:{...report.seatsAndBeds,unusable:report.seatsAndBeds.unusable.slice(0,12)}},null,1));
log(report.status);if(problems.length)process.exitCode=1;
