import fs from 'node:fs/promises';
import * as T from 'three';
import {CABINS,SAMPLE} from '../src/model.js';
import {SHIP_AREAS} from '../src/areas.js';
import {cabinPlacements} from '../src/walk/world.js';
import {BODY,bandOf} from '../src/walk/collision.js';
import {LIFTS,carTriangles} from '../src/walk/lifts.js';
import {toWorld} from '../src/plan/rooms.js';
import {findRestSpots,solidSpots} from '../src/walk/rest.js';
import {loadWalkShip,fitForWalking} from './walk-plan.mjs';
import {homes as mctHomes,createCart,driveCart,cartFits,cartBlocked,cartPoint} from '../src/walk/transporter.js';

// Walk the whole ship as a 2 m tall, 0.7 m wide walker (Voyager's Reach's capsule, floating 0.4 m over the floor),
// from the Deck 2 arrival hall, through every opening a body that size fits, up and down the stairs and in every
// lift (a car waits at each stop), and off every edge it can walk over (a fall lands wherever the floor below is).
// Then check that every room, cabin, lift stop, seat and bed is reachable and that
// no walkable spot is open to space, and drive a Deck 1 transporter about. About ten minutes; `npm run check:walk`.
const t0=Date.now(),log=(...a)=>console.log(((Date.now()-t0)/1000).toFixed(0)+'s',...a);
const ship=await loadWalkShip();
// The partitions, railings and colliders exactly as the page has them (scripts/walk-plan.mjs).
const {colliders:col,dropped,walls,rails,prepared}=fitForWalking(ship);
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
const blockedSteps=[];let flightSteps=0;
for(const a of treads)for(const b of treads){if(b.y<=a.y+.02||b.y>a.y+.25||Math.hypot(b.x-a.x,b.z-a.z)>.6)continue;flightSteps++;
 let y=a.y,ok=true;for(let t=0;t<=1.001&&ok;t+=.1){const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,fy=floorAt(x,y,z);ok=fy!==null&&stands(x,fy,z);if(ok)y=fy;}
 if(!ok)blockedSteps.push([a.x,a.y,a.z].map(v=>+v.toFixed(1)));}
log('stair steps climbed:',flightSteps-blockedSteps.length,'/',flightSteps,blockedSteps.slice(0,10));

// Diagnostics: SEED=x,y,z floods from elsewhere, BUDGET caps the positions and stops after the flood, DUMP saves them.
const seed=process.env.SEED?process.env.SEED.split(',').map(Number):toWorld('d02-arrival-1',[-20,0,0]),BUDGET=+(process.env.BUDGET||Infinity);
const S0={x:seed[0],z:seed[2]};S0.y=floorAt(S0.x,seed[1],S0.z,1,3);
const key=(x,y,z)=>((Math.round((x-S0.x)/G)+2000)*4000+(Math.round((z-S0.z)/G)+2000))*1000+Math.round((y+60)*2);
const snap=(v,o)=>o+Math.round((v-o)/G)*G;
const seen=new Set(),blocked=new Set(),X=[],Y=[],Z=[];
const push=(x,y,z)=>{const k=key(x,y,z);if(seen.has(k))return;seen.add(k);X.push(x);Y.push(y);Z.push(z);};
push(S0.x,S0.y,S0.z);
const ridden=new Set(),DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];let falls=0,voidFalls=0;const voids=[];
// Walking off an edge: the walker falls from where it stepped to the first walkable ground below (or none: the void).
const fall=(x,y,z)=>{ray.origin.set(x,y+STEP,z);ray.direction.set(0,-1,0);const h=col.raycast(ray,120);return h&&h.normal.y>=MIN_NY?h.point.y:null;};
for(let head=0;head<X.length&&head<BUDGET;head++){
 const x=X[head],y=Y[head],z=Z[head];
 if(head%500000===0&&head)log('flood',head);
 for(const [dx,dz] of DIRS){
  const nx=x+dx*G,nz=z+dz*G;let fy=floorAt(nx,y,nz);
  // Nothing within a step: if the body fits there, it falls (only straight moves, so a corner is not cut).
  if(fy===null&&!dx!==!dz&&stands(nx,y,nz)){fy=fall(nx,y,nz);if(fy===null){if(voids.length<20)voids.push([nx,y,nz].map(v=>+v.toFixed(1)));voidFalls++;continue;}if(y-fy>STEP){const k=key(nx,fy,nz);if(!seen.has(k)&&!blocked.has(k)){if(stands(nx,fy,nz)){falls++;push(nx,fy,nz);}else blocked.add(k);}}continue;}
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
const reached=(x,y,z,r=.6,below=.6,above=.6)=>{for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++)for(let j=Math.floor(z-r);j<=Math.floor(z+r);j++)for(const n of cells.get(i+','+j)||[])if(Math.hypot(X[n]-x,Z[n]-z)<=r&&Y[n]>=y-below&&Y[n]<=y+above)return true;return false;};
const problems=[];
if(blockedSteps.length)problems.push(`stairs: ${blockedSteps.length}/${flightSteps} steps blocked, first at ${blockedSteps.slice(0,5).join(' ')}`);
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
const spots=solidSpots(prepared.restSpots,col);let usable=0;const unusable=new Map();
for(const s of spots){if(reached(s.point.x,s.height-.2,s.point.z,1.6,1.3,.25))usable++;else{const k=`${s.kind} near ${Math.round(s.point.x)},${Math.round(s.height)},${Math.round(s.point.z)}`;unusable.set(k,(unusable.get(k)||0)+1);}}
const restRatio=usable/spots.length;if(restRatio<.995)problems.push(`seats and beds: ${usable}/${spots.length} usable`);
// The Deck 20 crew recovery lounge's seven sleeping pods: a bed in each, with somewhere to stand in front of it.
{const pods=spots.filter(s=>s.kind==='lie'&&s.point.x>-88&&s.point.x<-64&&s.point.z>20&&s.point.z<25&&Math.abs(s.height-36.88)<.1);
 if(pods.length!==7||pods.some(s=>!reached(s.point.x,s.height-.2,s.point.z,1.6,1.3,.25)))problems.push(`recovery lounge pods: ${pods.length}/7 beds to lie down on`);}
// Space: a reached spot with nothing overhead is outside the ship.
let open=0;const openAt=[];for(let i=0;i<X.length;i+=13){ray.origin.set(X[i],Y[i]+1,Z[i]);ray.direction.set(0,1,0);if(!col.raycast(ray,200)){open++;openAt.push([X[i],Y[i],Z[i]].map(v=>+v.toFixed(1)));}}
if(open)problems.push(`${open} sampled positions open to space`);
if(voidFalls)problems.push(`${voidFalls} edges fall out of the ship`);
// The Deck 1 transporters (transporter.js): each parked clear of the walls and its neighbours, with somewhere to stand
// beside its driver's seat and its rear seats; MCT-01 driven out of Freight control, through the door, along the cross
// corridor and the spine to the aft corridor, stops in Cargo maintenance's doorway (fenced off for now); a wall, a lift's
// alcove and a parked cart each stop a cart.
const mct={drive:null};
{const list=mctHomes(),carts=list.map((h,i)=>createCart(i,h)),world={colliders:col,lifts:{lifts:LIFTS.map(spec=>({spec,stops:spec.stops}))},others:carts};
 const sideReached=(c,lz)=>[1.25,-1.25].some(lx=>{const q=cartPoint(c,[lx,0,lz]);return reached(q.x,q.y,q.z,.5,.3,.3);});
 carts.forEach((c,i)=>{if(!cartFits(c,world)||cartBlocked(c,world))problems.push(`MCT-0${i+1}: its bay is not clear`);
  if(!sideReached(c,0)||!sideReached(c,-1.35))problems.push(`MCT-0${i+1}: nowhere reached to board it`);});
 // Steer at waypoints, throttle on, until each is passed (or the cart stops for 3 s).
 const route=(c,points,limit=200)=>{let k=0,t=0,still=0;while(k<points.length&&t<limit){const [px,pz]=points[k],dx=px-c.pos.x,dz=pz-c.pos.z;if(Math.hypot(dx,dz)<1.2){k++;continue;}
  const err=Math.atan2(dx,dz)-c.yaw,was=c.pos.clone();driveCart(c,1/30,1,T.MathUtils.clamp(-Math.atan2(Math.sin(err),Math.cos(err))*3,-1,1),world);t+=1/30;
  if(c.pos.distanceTo(was)<1e-4){still+=1/30;if(still>3)break;}else still=0;}return k;};
 const c=carts[0],way=[[-49.25,44],[-50,41],[-56,38.3],[-66,38.2],[-72,38.2],[-76,34],[-75.5,12],[-77,3],[-90,.5],[-125,-1.5],[-141,-2],[-142,1],[-144.5,6],[-144.5,30],[-143.5,35]];
 const passed=route(c,way);mct.drive={passed,of:way.length,at:[+c.pos.x.toFixed(2),+c.pos.z.toFixed(2)]};
 if(passed<way.length)problems.push(`MCT-01: stuck on its way from Freight control to Cargo maintenance at ${mct.drive.at} (${passed}/${way.length} waypoints)`);
 route(c,[[-136,37]],20);const nose=cartPoint(c,[0,0,1.3]);mct.doorway=+nose.x.toFixed(2);
 if(nose.x>-140.2||nose.x<-142)problems.push(`MCT-01: should stop with its nose in Cargo maintenance's doorway, not at x=${nose.x.toFixed(2)}`);
 const stops=(at,yaw)=>{const x=createCart(9,{at,yaw}),w={...world,others:[...carts,x]};for(let t=0;t<6;t+=1/30)driveCart(x,1/30,1,0,w);return x;};
 const wall=stops([-100,-39.7,0],Math.PI),lift=stops([-132,-39.7,-1],0),bay=stops([-46.75,-39.7,46],0);
 mct.stops={wall:+wall.pos.z.toFixed(2),lift:+lift.pos.z.toFixed(2),cart:+bay.pos.z.toFixed(2)};
 if(wall.pos.z<-3.3||!cartFits(wall,world))problems.push(`MCT: drove into the spine's wall (z ${wall.pos.z.toFixed(2)})`);
 if(lift.pos.z>3.2)problems.push(`MCT: drove into the aft lift's alcove (z ${lift.pos.z.toFixed(2)})`);
 if(bay.pos.z>50.3)problems.push(`MCT: drove into a parked cart (z ${bay.pos.z.toFixed(2)})`);}

const report={status:problems.length?'FAIL':'PASS',walker:{height:H,width:2*R,step:STEP},positions:X.length,falls,voidFalls,voids,railings:{count:rails.length,metres:Math.round(rails.reduce((s,r)=>s+r[3]-r[2],0))},walkableM2ByDeck:Object.fromEntries([...area].sort((a,b)=>a[0]-b[0]).map(([b,a])=>[b,Math.round(a)])),
 rooms:{total:rooms.length,below80:rooms.filter(r=>!r.samples||r.reached/r.samples<.8).length},cabins:`${cabins}/${CABINS.length}`,missedCabins:missedCabins.slice(0,20),liftStops:`${stops}/${stopCount}`,
 seatsAndBeds:{spots:spots.length,usable,seats:spots.filter(s=>s.kind==='sit').length,beds:spots.filter(s=>s.kind==='lie').length,unusable:[...unusable].slice(0,40)},openToSpace:open,openAt:openAt.slice(0,20),transporters:mct,problems};
await fs.writeFile('output/leo-interior-v01/walk-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,seatsAndBeds:{...report.seatsAndBeds,unusable:report.seatsAndBeds.unusable.slice(0,12)}},null,1));
log(report.status);if(problems.length)process.exitCode=1;
