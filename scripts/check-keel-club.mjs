import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {TRANSIT_CORES} from '../src/plan/v1.js';
import {createKeelClub,KEEL,CORES,DECK1,STOREY,STAIRS,RIVER,BRIDGES,BRIDGE_SPANS,FALLS,CANNONS,riverOuter,riverInner,half,RIVER_PATH,riverFrame,riverNearest,TUBE,TUBE_RANGE,DOCKS,tubeBoard,tubeStep,tubeKick,tubeSeat,tubeDock,bridgeUnderside} from '../src/walk/keel-club.js';
import {LIFTS,KEEL_STOP,carTriangles} from '../src/walk/lifts.js';
import {BODY,Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {groundMesh} from '../src/v2/ground.js';
import {findRestSpots,solidSpots} from '../src/walk/rest.js';
import {encodeRecord,encodeIdentity,assembleFrame,WireReader} from '../src/walk/net/wire.js';

// The Keel Club, the sports hall under Deck 1 (createKeelClub in src/walk/keel-club.js), walked with the rules of
// scripts/v2-walk.mjs: from every core lift's Keel Club stop, every zone and both terraces reached, no step off an edge
// onto nothing standable or more than 1 m down, both core stairs climbed to Deck 1's landing, and the walk Controller
// down a stair, over a bridge across the Keel Loop and up to a terrace. KEEL_FRESH_LAYOUT=1 builds the layout from source instead of
// reading output/leo-interior-v02/layout.json.
const layout=process.env.KEEL_FRESH_LAYOUT?(await import('../src/plan/layout-v2.js')).LAYOUT_V2:(await import('../src/plan/selected-layout.js')).default;
const club=createKeelClub(null),FY=KEEL.floor,TY=KEEL.terrace,MIN_NY=Math.cos(BODY.maxSlope*Math.PI/180);

// Each walk mode loads its own copy of the module; they stay identical.
const lf=p=>fs.readFileSync(new URL('../src/walk/'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
for(const m of ['authoring','prepared','public'])assert.equal(lf(`keel-club.${m}.js`),lf('keel-club.js'),`src/walk/keel-club.${m}.js differs from keel-club.js: copy it over`);
// The data it shares with the ship.
for(const c of CORES){const t=TRANSIT_CORES.find(t=>t.id===c.id);assert(t&&t.x===c.x&&t.stairX===c.stairX&&t.stairZ===c.stairZ,`core ${c.id} differs from TRANSIT_CORES`);}
assert.equal(DECK1,LIFTS[0].stops.find(s=>s.deck===1).y,'DECK1 is not Deck 1');assert.equal(KEEL_STOP.y,FY,'the lifts stop off the Keel Club floor');
const core=LIFTS.filter(l=>/^(forward|aft)-(port|starboard)$/.test(l.id));assert.equal(core.length,4);
for(const l of core){assert.equal(l.stops.at(-1).label,'Keel Club',`${l.id}: the Keel Club stop is not last (Leo live stop indices)`);assert.equal(l.stops.filter(s=>s.y<DECK1).length,1);}
const deck1=layout.decks.find(d=>d.number===1);
for(const c of CORES)assert(deck1.slab.holes.some(h=>h.id===`${c.id}_stairs_1`),`Deck 1's slab does not open over the ${c.id} starboard stair`);

// Budget (Jay, 2026-11-07): 4M triangles and 400 draws on desktop for the whole Keel Club.
let tris=0,draws=0;club.group.traverse(o=>{if(o.isMesh&&o.material.visible!==false){draws++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});
console.log(`Keel Club: ${draws} draws, ${Math.round(tris).toLocaleString()} triangles`);assert(tris<=4e6,'over 4M triangles');assert(draws<=400,'over 400 draws');

// Walk surfaces face up.
club.solid.updateMatrixWorld(true);
club.solid.traverse(o=>{if(!o.isMesh||!/walkway/.test(o.name))return;const p=o.geometry.attributes.position,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);assert(new T.Triangle(a,b,c).getNormal(new T.Vector3()).y>0,`${o.name} has a downward-facing triangle at ${a.toArray().map(v=>v.toFixed(1))}`);}});

// The world: the club, Deck 1's slab over it (its outline as the hull at Deck 1, with the layout's holes) and each
// core's Deck 1 stair landing, and every core lift's car parked at its Keel Club stop with its doors open.
const env=new T.Group(),box=(name,x0,x1,ya,yb,z0,z1)=>{const m=new T.Mesh(new T.BoxGeometry(x1-x0,yb-ya,z1-z0));m.name=name;m.position.set((x0+x1)/2,(ya+yb)/2,(z0+z1)/2);env.add(m);};
const holes=deck1.slab.holes.map(h=>{const xs=h.polygon.map(p=>p[0]),zs=h.polygon.map(p=>p[1]);return [Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];});
const inHole=(x,z)=>holes.some(([x0,x1,z0,z1])=>x>x0&&x<x1&&z>z0&&z<z1);
for(let x=KEEL.aft;x<KEEL.bow;x+=1)for(let z=-60;z<60;z+=1)if(!inHole(x+.5,z+.5)&&Math.abs(z+.5)<half(x+.5,DECK1-.3))box('Deck_floor',x,x+1,DECK1-.24,DECK1,z,z+1);
for(const c of CORES)box('Stair_main_landing',c.stairX-4.5,c.stairX-2.5,DECK1-.24,DECK1,c.stairZ-2.5,c.stairZ+2.5);
// Deck 1's own flight up to Deck 2 (transit.js: 12 treads 0.14 m thick, 2 m up), as solid steps nobody stands on here:
// the ship's walk check (v2-walk.mjs) walks it. Its underside is the headroom over the last flight up from the club.
for(const c of CORES)for(let i=0;i<12;i++){const x=c.stairX-2.5+i*5/12,top=DECK1+(i+1)/6;box('Deck1_flight_block',x,x+5/12,top-.14,top,c.stairZ-2.5,c.stairZ-.3);}
env.updateMatrixWorld(true);
const col=new Colliders(),ground=new Colliders();for(const r of [env,club.solid]){col.addStatic(r,()=>true);ground.addStatic(r,o=>o.isMesh&&groundMesh(o));}
for(const l of core){const m=new T.Matrix4().makeTranslation(l.car.x,FY,l.car.z);col.addMover(l.id,carTriangles(l,[l.door]),m);ground.addMover(l.id,carTriangles(l,[l.door]),m);}
col.commit();ground.commit();
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3(),STEP=BODY.step,R=BODY.radius,H=BODY.height;
const floorAt=(x,y,z)=>{ray.origin.set(x,y+STEP+.05,z);const h=ground.raycast(ray,2*STEP+.15);return h&&h.normal.y>=MIN_NY&&Math.abs(h.point.y-y)<=STEP?h.point.y:null;};
const stands=(x,y,z)=>{seg.start.set(x,y+STEP+R,z);seg.end.set(x,y+H-R,z);return !col.overlaps(seg,R);};
// Deck 1 itself (a stand-in slab here, without its shafts and rails) only inside each core's stair tower.
const inClub=(x,z,y)=>x>KEEL.aft&&x<KEEL.bow&&Math.abs(z)<70&&(y<DECK1-.5||y<DECK1+.3&&CORES.some(c=>x>c.stairX-4.5&&x<c.stairX+4.5&&Math.abs(z-c.stairZ)<2.5));
const G=.5,seen=new Map(),queue=[],drops=[];const key=([x,y,z])=>`${Math.round(x/G)},${Math.round(y/.2)},${Math.round(z/G)}`;
// One origin, the forward port lift: everything else (the other lifts, both stairs, every zone) must connect to it.
{const l=core.find(l=>l.id==='forward-port'),p=[l.car.x,FY,l.car.z];seen.set(key(p),p);queue.push(p);}
for(let i=0;i<queue.length;i++){const [x,y,z]=queue[i];
 for(const [dx,dz] of [[G,0],[-G,0],[0,G],[0,-G]]){const nx=x+dx,nz=z+dz;if(!inClub(nx,nz,y))continue;const ny=floorAt(nx,y,nz);
  if(ny===null){if(!stands(nx,y,nz))continue;ray.origin.set(nx,y+STEP,nz);let h=ground.raycast(ray,60);if(h&&h.normal.y<MIN_NY)h=null;if(!h||y-h.point.y>1)drops.push([nx,y,nz,h?+(y-h.point.y).toFixed(2):'void']);else if(y-h.point.y>STEP){const p=[nx,h.point.y,nz],k=key(p);if(!seen.has(k)&&stands(...p)){seen.set(k,p);queue.push(p);}}continue;}
  if(!stands(nx,ny,nz))continue;const p=[nx,ny,nz],k=key(p);if(!seen.has(k)){seen.set(k,p);queue.push(p);}}}
console.log(`flood: ${queue.length.toLocaleString()} spots reached`);
const cells=new Map();for(const p of queue){const k=Math.floor(p[0])+','+Math.floor(p[2]);(cells.get(k)||cells.set(k,[]).get(k)).push(p);}
const reached=(x,y,z,r=1.2,below=.5,above=.5)=>{for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++)for(let j=Math.floor(z-r);j<=Math.floor(z+r);j++)for(const p of cells.get(i+','+j)||[])if(Math.hypot(p[0]-x,p[2]-z)<=r&&p[1]>=y-below&&p[1]<=y+above)return true;return false;};
const front=x=>half(x,FY),terr=(x,s,d=6)=>[x,TY,s*(front(x)+d)],strip=x=>(front(x)+riverOuter(x))/2;
assert.equal(CANNONS.length,2*BRIDGE_SPANS.length,'two water cannons a bridge');
const goals=[
 ...core.map(l=>[`${l.id} lift car at the Keel Club stop`,l.car.x,FY,l.car.z]),
 ...CORES.flatMap(c=>[[`${c.id} lift lobby`,c.x,FY,0],[`${c.id} stair, Deck 1 landing`,c.stairX-3.5,DECK1,c.stairZ],[`${c.id} stair, first storey landing`,c.stairX-3.5,FY+STOREY,c.stairZ]]),
 ['arrival plaza',-140,FY,-20],['tennis court 1',-100,FY,-27],['tennis court 4',-100,FY,27],['port pitch',-56,FY,-31],['starboard pitch',-56,FY,31],['basketball court',-56,FY,0],
 ['beach',-18,FY,0],['port lagoon promenade',50,FY,-34],['starboard lagoon promenade',50,FY,34],['aft promenade, behind the river',RIVER.aft-3,FY,0],
 ...BRIDGE_SPANS.map(({a,b},i)=>[`bridge ${i+1} crown`,(a[0]+b[0])/2,FY+RIVER.rise,(a[1]+b[1])/2]),
 ...[-1,1].flatMap(s=>FALLS.flatMap(([x0,x1])=>{const m=(x0+x1)/2;return [[`behind the ${s<0?'port':'starboard'} falls at x ${m}`,m,FY,s*strip(m)],[`on the ${s<0?'port':'starboard'} falls overhang at x ${m}`,m,TY,s*(riverOuter(m)+.8)]];})),
 ...[-1,1].flatMap(s=>[-140,0,100,185].map(x=>[`${s<0?'port':'starboard'} promenade at x ${x}`,x,FY,s*strip(x)])),['beach club',140,FY,15],['driving range tee',150,FY,0],['port climbing wall',165,FY,-(front(165)-1.5)],['starboard climbing wall',165,FY,front(165)-1.5],
 ...[-1,1].flatMap(s=>{const side=s<0?'port':'starboard';return [[`${side} terrace aft`,...terr(-110,s)],[`${side} terrace midships`,...terr(30,s)],[`${side} terrace forward`,...terr(135,s)],...STAIRS.map(x=>[`${side} stair at x ${x} top`,x+7,TY,s*(front(x+7)+1.5)])];}),
];
let failed=0;for(const [name,x,y,z] of goals){const ok=reached(x,y,z);if(!ok)failed++;console.log(`${ok?'PASS':'FAIL'} ${name} (${x.toFixed(1)}, ${y.toFixed(2)}, ${z.toFixed(1)})`);}
const uniq=new Map();for(const d of drops)uniq.set(`${Math.round(d[0])},${Math.round(d[1])},${Math.round(d[2])}`,d);
console.log(`unguarded drops over 1 m or onto nothing standable: ${uniq.size}`);for(const d of [...uniq.values()].slice(0,25))console.log('  at',d.slice(0,3).map(v=>v.toFixed(1)).join(', '),'drop',d[3]);
assert.equal(failed,0,'unreached goals');assert.equal(uniq.size,0,'unguarded drops');
// Seats (benches, stools, loungers): each needs somewhere reached within 1.5 m, from 1.3 m below the seat to just above.
club.seats.updateMatrixWorld(true);const declared=findRestSpots(club.seats),spots=solidSpots(declared,col),far=spots.filter(sp=>!reached(sp.point.x,sp.height-.2,sp.point.z,1.5,1.3,.25));
console.log(`seats with somewhere to stand: ${spots.length-far.length}/${spots.length} (of ${declared.length} declared; ${declared.filter(d=>d.kind==='lie').length} loungers)`);for(const sp of far.slice(0,12))console.log('  no standing room near seat at',[sp.point.x,sp.height,sp.point.z].map(v=>v.toFixed(1)).join(', '));
assert.equal(far.length,0,'seats out of reach');assert(spots.length>=100,'seats lost');

// Water cannons: the prompt on each bridge's crown, a jet that splashes and clears, and every cannon's arc (14 m/s
// along its aim) coming down in the river, not on a walkway.
{const inRiver=(x,z)=>(x>=RIVER.aft&&x<=RIVER.aft+RIVER.width&&Math.abs(z)<=riverOuter(x))||(x>=RIVER.bow-RIVER.width&&x<=RIVER.bow&&Math.abs(z)<=riverOuter(x))||(Math.abs(z)>=riverInner(x)&&Math.abs(z)<=riverOuter(x));
 let dry=0;for(const {at,aim} of CANNONS){const y0=at[1]+.08+aim[1]*1.1,vy=aim[1]*14,dy=y0-(FY-RIVER.drop),t=(vy+Math.sqrt(vy*vy+2*9.8*dy))/9.8,x=at[0]+aim[0]*1.1+aim[0]*14*t,z=at[2]+aim[2]*1.1+aim[2]*14*t;if(!inRiver(x,z)){dry++;console.log('  cannon jet lands out of the river at',x.toFixed(1),z.toFixed(1));}}
 const crowns=BRIDGE_SPANS.map(({a,b})=>new T.Vector3((a[0]+b[0])/2,FY+RIVER.rise,(a[1]+b[1])/2)),prompts=crowns.filter(p=>club.near(p)?.kind==='cannon').length;
 // facing down the channel either way from a crown picks the cannon aimed that way
 const facing=CANNONS.filter((c,i)=>club.near(crowns[c.bridge],Math.atan2(c.aim[0],c.aim[2]))?.cannon===i).length;
 console.log(`${facing===CANNONS.length?'PASS':'FAIL'} facing picks the cannon aimed that way: ${facing}/${CANNONS.length}`);assert.equal(facing,CANNONS.length,'facing a cannon does not pick it');
 club.fire(club.near(crowns[0]).cannon);let most=0,splashed=0;const [drop,ring]=club.group.children.filter(o=>o.name==='Keel_club_cannon_water');
 for(let i=0;i<240;i++){club.update(1/60);most=Math.max(most,drop.count);splashed=Math.max(splashed,ring.count);}
 console.log(`${dry?'FAIL':'PASS'} cannon jets land in the river (${CANNONS.length} cannons) · prompts on ${prompts}/${crowns.length} crowns · a jet: ${most} drops at once, ${splashed} splashes, ${drop.count+ring.count} left after 4 s`);
 assert.equal(dry,0,'a cannon jet lands out of the river');assert.equal(prompts,crowns.length,'a bridge crown without a cannon prompt');assert(most>30&&splashed>0&&drop.count+ring.count===0,'cannon jet');}

// ---- Floating the Keel Loop ----
// Every place a tube can be (the loop, at every offset it may steer to) is water under the tube's whole ring, and a
// seated rider (a column RIDER_R round the seat, RIDER_TOP above it) clears every bridge's underside by CLEAR.
{const {aft:ra,bow:rb,width:W}=RIVER,WY=FY-RIVER.drop,RIDER_R=.4,RIDER_TOP=1.2,CLEAR=.2;
 const inWater=(x,z)=>x>=ra&&x<=rb&&Math.abs(z)<=riverOuter(x)&&!(x>ra+W&&x<rb-W&&Math.abs(z)<riverInner(x));
 let dry=0,low=0,worst=Infinity,samples=0;
 for(let s=0;s<RIVER_PATH.total;s+=.5){const f=riverFrame(s);for(let d=f.lo;d<=f.hi+1e-9;d+=Math.max(.05,(f.hi-f.lo)/12)){const seat=tubeSeat({s,d});samples++;
  for(let a=0;a<8;a++){const x=seat.x+Math.cos(a*Math.PI/4)*TUBE.radius,z=seat.z+Math.sin(a*Math.PI/4)*TUBE.radius;if(!inWater(x,z)){dry++;if(dry<6)console.log('  tube ring out of the water at',x.toFixed(1),z.toFixed(1),'s',s.toFixed(1),'d',d.toFixed(2));}}
  for(let a=-1;a<8;a++){const x=a<0?seat.x:seat.x+Math.cos(a*Math.PI/4)*RIDER_R,z=a<0?seat.z:seat.z+Math.sin(a*Math.PI/4)*RIDER_R,u=bridgeUnderside(x,z);if(u===Infinity)continue;
   const gap=u-(seat.y+RIDER_TOP);worst=Math.min(worst,gap);if(gap<CLEAR){low++;if(low<6)console.log('  rider under a bridge with',gap.toFixed(2),'m at',x.toFixed(1),z.toFixed(1));}}}}
 let narrow=Infinity;for(let s=0;s<RIVER_PATH.total;s+=.5){const f=riverFrame(s);narrow=Math.min(narrow,f.hi-f.lo);}console.log(`narrowest steering range ${narrow.toFixed(2)} m (full ${(2*TUBE_RANGE).toFixed(1)} m)`);assert(narrow>=1.5,'a corner pinches the tube');
 console.log(`${dry||low?'FAIL':'PASS'} tube range: ${samples.toLocaleString()} places on the ${RIVER_PATH.total.toFixed(0)} m loop, ring in the water everywhere (${dry} out), least headroom under a bridge ${worst.toFixed(2)} m (needs ${CLEAR})`);
 assert.equal(dry,0,'a tube can leave the water');assert.equal(low,0,'a rider hits a bridge');
 // The current carries a tube all the way round, and braking never stops it.
 const st=tubeBoard(DOCKS[0]),s0=st.s;let gone=0;for(let i=0;i<60*120;i++){const before=st.s;tubeStep(st,1/60,{x:-riverFrame(st.s).tx*5,z:-riverFrame(st.s).tz*5});gone+=((st.s-before)%RIVER_PATH.total+RIVER_PATH.total)%RIVER_PATH.total;}
 console.log(`PASS braking against the current still drifts ${(gone/120).toFixed(2)} m/s downstream`);assert(gone/120>.2&&gone/120<.4,'brake speed');
 // Docks: each is reached on foot (in the flood above), offers a tube there, and lets the tube out again where it boards.
 let docks=0;for(const dock of DOCKS){const [x,y,z]=dock.at,ok=reached(x,y,z,1.2)&&club.near(new T.Vector3(x,y,z))?.kind==='tube'&&tubeDock(tubeBoard(dock))===dock;if(ok)docks++;else console.log('  dock at',x,z,'fails');}
 console.log(`${docks===DOCKS.length?'PASS':'FAIL'} tube docks reached, offering a tube and letting it out: ${docks}/${DOCKS.length}`);assert.equal(docks,DOCKS.length,'a tube dock fails');
 // A shot hits a rider downstream of its cannon once, at 60 and at 20 frames a second, and pushes the tube.
 for(const fps of [60,20]){let hits=0,i=0;for(const c of CANNONS){if(i++%5)continue;const aim=[c.aim[0],c.aim[2]],m=Math.hypot(...aim),land=[c.at[0]+aim[0]/m*7.5,c.at[2]+aim[1]/m*7.5],{s,d}=riverNearest(...land),rider={s,d,vs:TUBE.current,vd:0,ks:0,kd:0},seat=tubeSeat(rider);
   club.fire(CANNONS.indexOf(c),{id:'t'+fps+'-'+i,seed:7});let got=0,ks=0;for(let k=0;k<fps*3;k++){for(const h of club.update(1/fps,[seat.x,seat.y+.2,seat.z])){got++;tubeKick(rider,h.dir);ks=Math.hypot(rider.ks,rider.kd);}}
   if(got===1&&ks>.3)hits++;else console.log('  cannon',CANNONS.indexOf(c),'at',fps,'fps: hits',got,'push',ks.toFixed(2));}
  const tried=Math.ceil(CANNONS.length/5);console.log(`${hits===tried?'PASS':'FAIL'} a shot hits a downstream rider exactly once and pushes them, ${fps} fps: ${hits}/${tried}`);assert.equal(hits,tried,'cannon hits');}
 // Two cannons on one bridge fire at once at a rider between their landing points: two hits, one each. And a rider
 // floating downstream into a jet is hit once as they pass through it.
 {const a=CANNONS[0],b=CANNONS[1],mid=[(a.at[0]+b.at[0])/2,(a.at[2]+b.at[2])/2];let got=new Set();
  const land=c=>{const m=Math.hypot(c.aim[0],c.aim[2]);return [c.at[0]+c.aim[0]/m*7.5,c.at[2]+c.aim[2]/m*7.5];};
  for(const [c,tag] of [[a,'A'],[b,'B']]){const [x,z]=land(c),{s,d}=riverNearest(x,z),seat=tubeSeat({s,d});club.fire(CANNONS.indexOf(c),{id:'pair-'+tag,seed:3});
   for(let k=0;k<180;k++)for(const h of club.update(1/60,[seat.x,seat.y+.2,seat.z]))got.add(h.id);}
  console.log(`${got.size===2?'PASS':'FAIL'} two cannons at once: ${got.size} shots hit, one each`);assert.equal(got.size,2,'two shots');
  const c=CANNONS[4],[x,z]=land(c),{s}=riverNearest(x,z),rider={s:s-3,d:0,vs:TUBE.current,vd:0,ks:0,kd:0};club.fire(4,{id:'moving',seed:5});let n=0;
  for(let k=0;k<180;k++){tubeStep(rider,1/60,{x:riverFrame(rider.s).tx*5,z:riverFrame(rider.s).tz*5});const seat=tubeSeat(rider);n+=club.update(1/60,[seat.x,seat.y+.2,seat.z]).length;}
  console.log(`${n===1?'PASS':'FAIL'} a rider paddling into a jet is hit once: ${n}`);assert.equal(n,1,'moving rider');}}

// The walk Controller: from Deck 1's forward stair landing down the tower, out of its door, across to a terrace stair and up.
const ctl=new Controller(col);const go=(x,z,max=2400)=>{let i=0;for(;i<max;i++){const d=new T.Vector3(x-ctl.position.x,0,z-ctl.position.z);if(d.length()<.4)break;d.setLength(Math.min(3.2,d.length()*4+.5));ctl.step(1/60,d,false);}return i<max;};
const f=CORES[0],sx=f.stairX,sz=f.stairZ;ctl.position.set(sx-3.5,DECK1+.3,sz);ctl.velocity.set(0,0,0);for(let i=0;i<40;i++)ctl.step(1/60,new T.Vector3(),false);
const down=[];for(let k=0;k<3;k++)down.push([sx-2.8,sz+1.4],[sx+2.8,sz+1.4],[sx+3.5,sz],[sx+2.8,sz-1.4],[sx-2.8,sz-1.4],[sx-3.5,sz]);
// over the forward port bridge (x 120) to the promenade, along it past the stair's rail and up the stair at x 124
const x0=STAIRS[2],bx=BRIDGES.side.find(x=>x<x0&&x>x0-8),rz=riverInner(bx),oz=riverOuter(bx);
const route=[...down,[sx-3.5,sz-4],[135,0],[127.5,0],[126,-12],[bx,-(rz-3)],[bx,-(rz-1)],[bx,-(oz+1)],[bx,-(oz+3.6)],[x0-.6,-(oz+3.6)],[x0-.6,-(front(x0)-1.5)],[x0+7,-(front(x0)-1.5)],[x0+7,-(front(x0+7)+2)]];let walked=true;
for(const [x,z] of route){if(!go(x,z)){walked=false;console.log('FAIL controller stuck going to',x,z,'at',ctl.position.toArray().map(v=>v.toFixed(2)).join(','));break;}}
console.log(`${walked?'PASS':'FAIL'} controller walks Deck 1 → down the forward stair → between the lifts → over a bridge → up the port terrace stair, ends at y ${ctl.position.y.toFixed(2)}`);
assert(walked&&Math.abs(ctl.position.y-TY)<.15,'controller route');
// A floater's pose crosses the wire as rest 'tube' (3), alongside someone sitting, and the frame still decodes.
{const base={yaw:0,grounded:false,stance:'stand',jumpCount:0,jumpS:-1,rise:0,emote:null,playing:false,ball:false,glide:false,hook:null,fur:0},r=new WireReader();
 const got=r.read(assembleFrame([encodeIdentity(1,'voyager-a'),encodeIdentity(2,'voyager-b')],[encodeRecord(1,{...base,pos:[-89,-52.05,-43],rest:'tube'}),encodeRecord(2,{...base,pos:[0,-51.5,0],rest:'sit'})]));
 assert.deepEqual(got.map(p=>p.rest),['tube','sit'],'a tube pose does not cross the wire');console.log('PASS a tube pose crosses the wire with the others in its frame');}
console.log('PASS Keel Club');
