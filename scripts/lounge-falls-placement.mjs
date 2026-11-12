// Placement study for the Hydro-Nip Lounge waterfall and pond (Deck 17, Neighborhood 1 sky garden). Nothing here changes
// the walk: it reads the selected layout 2 plan and the waterfall's own constants, measures where the assembly stands now,
// tests rigid translations of it (no rotation, no change to its shape) against the Deck 18 and 19 openings, the stairs and
// the rest of the lounge, and writes the measured proposal to docs/lounge-falls-placement/.
//   node scripts/lounge-falls-placement.mjs            writes placement.json, plan.svg, view-*.svg, views.json
//   node scripts/lounge-falls-placement.mjs --check    recomputes and fails if the committed placement.json differs
// It needs no built ship: the plan comes from src/plan/layout-v2.js and the lounge's constants are checked against the
// source text of src/walk/lounge-falls.js, so a change to that file makes this script fail until it is re-read.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {LAYOUT_V2 as L} from '../src/plan/layout-v2.js';
import {LOUNGE_PLAN} from '../src/plan/lounge-layout-v2.js';

const OUT=new URL('../docs/lounge-falls-placement/',import.meta.url),CHECK=process.argv.includes('--check');
const r2=n=>Math.round(n*100)/100,r3=n=>Math.round(n*1000)/1000;

// ---- What the walk builds, in the lounge's template frame (src/walk/lounge-falls.js) -----------------------------------
const SRC=fs.readFileSync(new URL('../src/walk/lounge-falls.js',import.meta.url),'utf8');
for(const s of ['const POND={x:137,z:39,a:6.2,b:4.4,n:3},BED=FLOOR+.22,WATER=FLOOR+.27,RIM=FLOOR+.58;',
 'const PATH={x0:136.1,x1:137.9,z0:33.9,z1:43.05,top:FLOOR+.36,step:33.3,rail:34.3},LANDING={x0:133.4,x1:140.6,z0:43,z1:45.86,top:FLOOR+.36};',
 'const FALL={x0:132.6,x1:141.4,z:41.82,lip:LEVELS[1]-.28-.26,reach:.35},BENCH={x:137,z:45.5,width:2.4};',
 'slab(FALL.x0-.3,FALL.x1+.3,41.5,41.98,FALL.lip-.02,LEVELS[1]-.28,',
 'const {FLOOR,LEVELS}=LOUNGE;']) assert(SRC.includes(s),'lounge-falls.js changed; re-read its constants here: '+s);
const FLOOR=24.3,LEVELS=[28.3,32.3];
const POND={x:137,z:39,a:6.2,b:4.4,n:3},PATH={x0:136.1,x1:137.9,z0:33.9,z1:43.05,step:33.3},LANDING={x0:133.4,x1:140.6,z0:43,z1:45.86};
const FALL={x0:132.6,x1:141.4,z:41.82,lip:LEVELS[1]-.28-.26,reach:.35},WATER=FLOOR+.27,BENCH={x:137,z:45.5,width:2.4};
const LIP={x0:FALL.x0-.3,x1:FALL.x1+.3,z0:41.5,z1:41.98,y0:FALL.lip-.02,y1:LEVELS[1]-.28};

// Template frame to ship: the lounge group's matrix, read from the live walk (x - 246.5, z = -16 - z). The walk then
// squeezes the assembly's depth about its front step (src/v2/lounge-falls-fit.js); the record below is the live ship's
// ship.v2FeaturePlacements.loungeFalls (depthScale 0.8567, frontDepth 49.3), read 2026-11-12 on the live build.
const FRAME={dx:-246.5,zc:-16},FIT={scale:.8567,anchorZ:-49.3};
const toShip=([x,z])=>[x+FRAME.dx,FRAME.zc-z],fit=z=>FIT.anchorZ+FIT.scale*(z-FIT.anchorZ);
const at=(x,z)=>{const p=toShip([x,z]);return [p[0],fit(p[1])];};

// ---- Measurements read from the live walk, to hold the model above to (box of world bounds, metres) ------------------
const LIVE={build:'3243183',poolCentre:[-109.5,24.3,-54.18],bench:[-109.5,24.66,-59.75],soundLineZ:-57.82,
 groupBox:{min:[-118.1,24.2,-60.63],max:[-100.9,32.09,-48.36]},colliderBox:{min:[-116.15,24.3,-60.06],max:[-102.85,25.56,-49.3]}};

// ---- Plan: plates, openings, stairs (src/plan/layout-v2.js, the selected layout 2) ---------------------------------
const room=L.rooms.find(r=>r.id==='commons-1');
assert.equal(room.x,-114.5);assert.equal(room.z,-43);assert.equal(room.side,-1);
const rectangle=(cx,cz,w,d)=>[[cx-w/2,cz-d/2],[cx+w/2,cz-d/2],[cx+w/2,cz+d/2],[cx-w/2,cz+d/2]];
// The same holes src/v2/garden-guards.js cuts for stairs in a gallery plate.
const holesIn=o=>(room.components.stairs||[]).filter(t=>t.center[1]<=o.center[1]+.02&&t.center[1]>o.center[1]-2.4).map(t=>{const arrival=Math.abs(t.center[1]-o.center[1])<.02,dir=t.id.includes('-tread-0-')?-1:1;return rectangle(t.center[0],t.center[2]-(arrival?dir*.04:0),t.size[0]+.16,t.size[2]+(arrival?.08:.16));});
const plates=lv=>[...room.components.galleries,...room.components.links,...room.components.landings].filter(o=>Math.abs(o.center[1]-lv)<.02).map(o=>({id:o.id,poly:o.polygon,holes:holesIn(o)}));
const opening=lv=>L.decks.find(d=>Math.abs(d.y-lv)<.05).slab.holes.find(h=>h.id==='commons-1-assembly-opening').polygon;
const LV=[{name:'Deck 18 (level 2)',y:LEVELS[0]},{name:'Deck 19 (level 3)',y:LEVELS[1]}].map(l=>({...l,plates:plates(l.y),opening:opening(l.y)}));
// Flights: footprints of the two flights and their landing (the plan's treads, at their tread heights).
const flights=(()=>{const by={};for(const t of room.components.stairs)(by[t.id.replace(/-\d+$/,'')]||(by[t.id.replace(/-\d+$/,'')]=[])).push(t);
 return Object.entries(by).map(([id,a])=>{const xs=a.flatMap(t=>[t.center[0]-t.size[0]/2,t.center[0]+t.size[0]/2]),zs=a.flatMap(t=>[t.center[2]-t.size[2]/2,t.center[2]+t.size[2]/2]);return {id,x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs),y0:a[0].center[1],y1:a.at(-1).center[1]};});})();
const turn=room.components.landings.find(o=>o.id==='commons-1-stair-turn'),TURN={x0:turn.center[0]-turn.size[0]/2,x1:turn.center[0]+turn.size[0]/2,z0:turn.center[2]-turn.size[2]/2,z1:turn.center[2]+turn.size[2]/2};
const STAIRS={x0:Math.min(...flights.map(f=>f.x0),TURN.x0),x1:Math.max(...flights.map(f=>f.x1),TURN.x1),z0:Math.min(...flights.map(f=>f.z0),TURN.z0),z1:Math.max(...flights.map(f=>f.z1),TURN.z1)};
// The walk's own dome (template DOME {x 134, z 25, r 6.5}, its planter ring out to r + .95) and the munchies piece.
const DOME={c:toShip([134,25]),r:6.5+.95},MUNCH=(()=>{const a=toShip([142.65,22.5]),b=toShip([147,27.5]);return {x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[1],b[1]),z1:Math.max(a[1],b[1])};})(); // counter 3 x 5 m and its three stools
const TASTING=(()=>{const p=room.components.pieces.find(p=>p.name==='Terpene Tasting Deck');return {x0:p.center[0]-p.size[0]/2,x1:p.center[0]+p.size[0]/2,z0:p.center[2]-p.size[2]/2,z1:p.center[2]+p.size[2]/2};})();
const hullZ=x=>{const ys=[];const P=room.polygon;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];if((a[0]-x)*(b[0]-x)<0&&a[0]!==b[0])ys.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}return Math.min(...ys);};

// ---- Geometry helpers ---------------------------------------------------------------------------------------------------
const inPoly=(p,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const segDist=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
const ringDist=(p,P)=>{let m=1e9;for(let i=0;i<P.length;i++)m=Math.min(m,segDist(p,P[i],P[(i+1)%P.length]));return m;};
const rectDist=(p,R)=>{const dx=Math.max(R.x0-p[0],0,p[0]-R.x1),dz=Math.max(R.z0-p[1],0,p[1]-R.z1);return Math.hypot(dx,dz);};
const rectPoly=R=>[[R.x0,R.z0],[R.x1,R.z0],[R.x1,R.z1],[R.x0,R.z1]];
// Signed distance from p to the solid part of a deck level: negative inside a plate or the slab beyond the opening.
function solid(lv,p){
 // Inside the solid: in a plate (outside its stair holes) or outside the slab opening.
 let inside=!inPoly(p,lv.opening);
 for(const o of lv.plates)if(inPoly(p,o.poly)&&!o.holes.some(h=>inPoly(p,h)))inside=true;
 let boundary=ringDist(p,lv.opening);for(const o of lv.plates){boundary=Math.min(boundary,ringDist(p,o.poly));for(const h of o.holes)boundary=Math.min(boundary,ringDist(p,h));}
 return inside?-boundary:boundary;}

// ---- The assembly, fitted and moved by (dx, dz) ---------------------------------------------------------------------------
const edge=(t,grow=0)=>{const c=Math.cos(t),s=Math.sin(t),k=2/POND.n;return [POND.x+(POND.a+grow)*Math.sign(c)*Math.abs(c)**k,POND.z+(POND.b+grow)*Math.sign(s)*Math.abs(s)**k];};
const ring=(grow,n=240)=>Array.from({length:n},(_,i)=>edge(i/n*Math.PI*2,grow));
function assembly(dx=0,dz=0){
 const m=([x,z])=>{const p=at(x,z);return [p[0]+dx,p[1]+dz];};
 const box=(x0,x1,z0,z1)=>{const a=m([x0,z0]),b=m([x1,z1]);return {x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[1],b[1]),z1:Math.max(a[1],b[1])};};
 const sheetZ=t=>m([0,FALL.z-FALL.reach*t**3])[1],h=FALL.lip-WATER;
 return {dx,dz,
  sheet:{x0:FALL.x0+FRAME.dx+dx,x1:FALL.x1+FRAME.dx+dx,zTop:sheetZ(0),zFoot:sheetZ(1),yTop:FALL.lip,yBottom:WATER,zAt:y=>sheetZ(Math.min(1,Math.max(0,(FALL.lip-y)/h)))},
  lip:{...box(LIP.x0,LIP.x1,LIP.z0,LIP.z1),y0:LIP.y0,y1:LIP.y1},
  pondCollider:ring(.45).map(m),pondWater:ring(-.02).map(m),pondDressed:ring(1.6).map(m),pondLight:ring(2.4).map(m),
  causeway:box(PATH.x0,PATH.x1,PATH.step,PATH.z1),landing:box(LANDING.x0,LANDING.x1,LANDING.z0,LANDING.z1),
  bench:box(BENCH.x-BENCH.width/2,BENCH.x+BENCH.width/2,BENCH.z-.35,BENCH.z+.35),centre:[...m([POND.x,POND.z])]};
}
const bounds=pts=>({x0:Math.min(...pts.map(p=>p[0])),x1:Math.max(...pts.map(p=>p[0])),z0:Math.min(...pts.map(p=>p[1])),z1:Math.max(...pts.map(p=>p[1]))});
const allPoints=a=>[...a.pondCollider,...[a.causeway,a.landing,a.bench].flatMap(r=>rectPoly(r))];

// ---- Measures --------------------------------------------------------------------------------------------------------------
// `q` coarsens the sampling for the search (1 is the reported, fine measure).
function measure(dx,dz,q=1){
 const a=assembly(dx,dz),out={dx:r3(dx),dz:r3(dz)};
 const xs=[];for(let x=a.sheet.x0;x<=a.sheet.x1+1e-9;x+=.05*q)xs.push(x);
 // Sheet through each level: signed clearance of the sheet's line at the level's height (negative: it crosses solid).
 out.levels=LV.map(lv=>{const z=a.sheet.zAt(lv.y===LEVELS[1]?a.sheet.yTop:lv.y),cl=xs.map(x=>solid(lv,[x,z]));
  const open=cl.filter(c=>c>0).length/cl.length;return {level:lv.name,openFraction:r3(open),minClearance:r3(Math.min(...cl)),zAtLevel:r3(z)};});
 // Lip: how much of its length sits under a plate or the slab (a header must hang from something).
 const lv3=LV[1],lipX=[],zs=[];for(let x=a.lip.x0;x<=a.lip.x1+1e-9;x+=.05*q)lipX.push(x);for(let z=a.lip.z0;z<=a.lip.z1+1e-9;z+=.04*q)zs.push(z);
 const gaps=lipX.map(x=>{const d=zs.map(z=>solid(lv3,[x,z]));
  // Some of the lip's depth under solid: it hangs from something; otherwise the gap to the nearest solid edge.
  return d.some(v=>v<0)?0:Math.min(...d);});
 out.lip={supportedFraction:r3(gaps.filter(g=>g===0).length/gaps.length),largestGap:r3(Math.max(...gaps))};
 // Neighbours: minimum distance from the walkable parts (rim collider, causeway, landing, bench) to each, negative if they overlap.
 const parts=allPoints(a),b=bounds(allPoints(a));
 const dist=(f)=>Math.min(...parts.map(f));
 const domeD=pt=>Math.hypot(pt[0]-DOME.c[0],pt[1]-DOME.c[1])-DOME.r,stairD=pt=>rectDist(pt,STAIRS),tasteD=pt=>rectDist(pt,TASTING),munchD=pt=>rectDist(pt,MUNCH);
 const sample=[];for(let i=0;i<a.pondCollider.length;i+=2)sample.push(a.pondCollider[i]);for(const R of [a.causeway,a.landing,a.bench])for(const p of rectPoly(R))sample.push(p);
 const mid=(R)=>{const xs2=[];for(let x=R.x0;x<=R.x1;x+=.25*q)for(let z=R.z0;z<=R.z1;z+=.25*q)xs2.push([x,z]);return xs2;};
 for(const R of [a.causeway,a.landing])sample.push(...mid(R));
 // pond interior points count as the assembly too (the dome ring must not cross the water)
 const poly=a.pondCollider,bx=bounds(poly);for(let x=bx.x0;x<=bx.x1;x+=.3*q)for(let z=bx.z0;z<=bx.z1;z+=.3*q)if(inPoly([x,z],poly))sample.push([x,z]);
 out.clearance={dome:r3(Math.min(...sample.map(domeD))),stairs:r3(Math.min(...sample.map(stairD))),tastingDeck:r3(Math.min(...sample.map(tasteD))),munchies:r3(Math.min(...sample.map(munchD))),
  hullWall:r3(Math.min(...sample.map(p=>p[1]-hullZ(p[0]))))};
 // The causeway's front approach: how far the walker can go straight ahead from the foot before something stands in the way,
 // and the narrowest side clearance to a neighbour over the first 3 m of it (a walker's body is 0.7 m wide).
 {const cx=(a.causeway.x0+a.causeway.x1)/2,names=[['dome ring',domeD],['stairs',stairD],['tasting deck',tasteD],['munchies counter',munchD]];let ahead=null,by=null,side=1e9;
  for(let d=0;d<=14&&ahead===null;d+=.05){const p=[cx,a.causeway.z1+d],hit=names.find(([,f])=>f(p)<=.35);if(hit){ahead=d;by=hit[0];}else if(d<=3)side=Math.min(side,...names.map(([,f])=>f(p)));}
  out.approach={freeAhead:ahead===null?14:r2(ahead),stoppedBy:by||'nothing within 14 m',narrowestSideClearance:r2(side)};}
 out.collider=b;out.centre=a.centre.map(r3);
 return out;
}
const ok=m=>m.levels.every(l=>l.minClearance>=.25&&l.openFraction===1);
const worst=m=>Math.min(m.clearance.dome,m.clearance.stairs,m.clearance.tastingDeck,m.clearance.munchies);

// ---- Current state -------------------------------------------------------------------------------------------------------------
const current=measure(0,0),cur=assembly(0,0);
// The model must agree with the live walk's own boxes before anything built on it is trusted.
{const c=bounds(allPoints(cur)),m=.4;
 assert(Math.abs(cur.centre[0]-LIVE.poolCentre[0])<.01&&Math.abs(cur.centre[1]-LIVE.poolCentre[2])<.01,'pond centre differs from the live walk');
 assert(Math.abs(c.x0-LIVE.colliderBox.min[0])<m&&Math.abs(c.x1-LIVE.colliderBox.max[0])<m&&Math.abs(c.z1-LIVE.colliderBox.max[2])<m&&Math.abs(c.z0-LIVE.colliderBox.min[2])<m+.6,'collider bounds differ from the live walk');
 const lb=bounds(cur.pondLight);assert(Math.abs(lb.x0-LIVE.groupBox.min[0])<.5&&Math.abs(lb.x1-LIVE.groupBox.max[0])<.5,'effect ring differs from the live walk');}

// ---- Search: rigid translations ---------------------------------------------------------------------------------------------
// A usable walking clearance between the assembly and any neighbour: the cat's body is 0.7 m wide (src/walk/collision.js BODY).
const WALK=1.0;
const grid=[];for(let dx=-12;dx<=12+1e-9;dx+=.5)for(let dz=-3;dz<=12+1e-9;dz+=.1)grid.push(measure(dx,dz,3));
const passing=grid.filter(ok);
// The smallest dz at this dx that puts the sheet through both openings, found coarse then confirmed on the fine measure.
function fitAt(dx){const c=grid.filter(g=>Math.abs(g.dx-dx)<1e-9&&ok(g)).sort((a,b)=>a.dz-b.dz)[0];if(!c)return null;
 for(let dz=c.dz-.12;dz<=c.dz+.3;dz+=.02){const m=measure(dx,Math.round(dz*100)/100);if(ok(m))return m;}return null;}
// The translation that gets the sheet through both openings and leaves the most room to the neighbours.
const proposed=fitAt([...passing].sort((a,b)=>worst(b)-worst(a)||Math.abs(a.dx)-Math.abs(b.dx))[0].dx);
// The best translation that keeps every walking clearance of at least WALK and the lip hung from something: how well the openings do there.
const kept=grid.filter(m=>worst(m)>=WALK&&m.lip.supportedFraction===1).sort((a,b)=>b.levels.reduce((s,l)=>s+l.openFraction,0)-a.levels.reduce((s,l)=>s+l.openFraction,0)||Math.min(...b.levels.map(l=>l.minClearance))-Math.min(...a.levels.map(l=>l.minClearance)))[0];
const chosen=proposed;

// Slot through both levels along the sheet: the free band between the Deck 18 plate's inner edge and the Deck 19 plate's rear edge.
const slot=[-114,-110,-106,-102,-98].map(x=>{
 const free=[];for(let z=-60;z<-44;z+=.01){if(solid(LV[0],[x,z])>0&&solid(LV[1],[x,z])>0)free.push(z);}
 // contiguous runs
 const runs=[];let s=null,p=null;for(const z of free){if(s===null){s=z;p=z;}else if(z-p>.0101){runs.push([s,p]);s=z;p=z;}else p=z;}if(s!==null)runs.push([s,p]);
 return {x,runs:runs.map(([a,b])=>[r2(a),r2(b)]).filter(([a,b])=>b-a>.15)};});

// ---- Output ------------------------------------------------------------------------------------------------------------------
const proposal=chosen,prop=assembly(chosen.dx,chosen.dz);
const alt=(dx,dz)=>measure(dx,dz);
const bExtent=a=>{const b=bounds(allPoints(a)),l=bounds(a.pondLight),d=bounds(a.pondDressed);return {collider:{x:[r2(b.x0),r2(b.x1)],z:[r2(b.z0),r2(b.z1)]},dressed:{x:[r2(d.x0),r2(d.x1)],z:[r2(d.z0),r2(d.z1)]},effects:{x:[r2(l.x0),r2(l.x1)],z:[r2(l.z0),r2(l.z1)]}};};
const part=a=>({sheet:{x:[r2(a.sheet.x0),r2(a.sheet.x1)],zTop:r2(a.sheet.zTop),zFoot:r2(a.sheet.zFoot),yTop:r2(a.sheet.yTop),yBottom:r2(a.sheet.yBottom)},
 lip:{x:[r2(a.lip.x0),r2(a.lip.x1)],z:[r2(a.lip.z0),r2(a.lip.z1)],y:[r2(a.lip.y0),r2(a.lip.y1)]},poolCentre:a.centre.map(r2),
 causeway:{x:[r2(a.causeway.x0),r2(a.causeway.x1)],z:[r2(a.causeway.z0),r2(a.causeway.z1)]},landing:{x:[r2(a.landing.x0),r2(a.landing.x1)],z:[r2(a.landing.z0),r2(a.landing.z1)]},
 bench:{x:[r2(a.bench.x0),r2(a.bench.x1)],z:[r2(a.bench.z0),r2(a.bench.z1)]},bounds:bExtent(a)});
const R={
 about:'Placement study for the Hydro-Nip Lounge waterfall and pond. Ship metres (X forward, Y up, Z starboard). A proposal only; the walk is unchanged.',
 frame:{templateToShip:'x - 246.5, z = -16 - z (the lounge group matrix, read from the live walk)',depthFit:FIT,fitNote:'The depth fit (src/v2/lounge-falls-fit.js) is recomputed from the finished skin when the assembly is moved; this study keeps the live ship\'s measured scale.'},
 current:{...part(cur),measures:current},
 proposal:{...part(prop),measures:proposal,translation:{x:chosen.dx,y:0,z:chosen.dz}},
 stairs:{footprint:{x:[r2(STAIRS.x0),r2(STAIRS.x1)],z:[r2(STAIRS.z0),r2(STAIRS.z1)]},flights:flights.map(f=>({id:f.id,x:[r2(f.x0),r2(f.x1)],z:[r2(f.z0),r2(f.z1)],y:[r2(f.y0),r2(f.y1)]}))},
 dome:{centre:DOME.c.map(r2),ringRadius:DOME.r},tastingDeck:TASTING,
 openings:LV.map(lv=>({level:lv.name,y:lv.y,slabOpeningRearZ:[-118.1,-110.1,-102.1].map(x=>{const ys=[];const P=lv.opening;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];if((a[0]-x)*(b[0]-x)<0)ys.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}return {x,z:r2(Math.min(...ys))};})})),
 shaftBetweenDecks:slot,
 candidates:{
  keepingEveryClearance:{note:'Best translation that keeps at least '+WALK+' m to every neighbour and the lip hung from the slab, by how much of the sheet passes both openings.',measures:kept&&measure(kept.dx,kept.dz)},
  count:{tested:grid.length,passingBothOpenings:passing.length,passingBothAndWalkingClearance:passing.filter(m=>worst(m)>=WALK).length},
  byDx:[-6,-3,0,3,6,7.5,9].map(dx=>{const m=fitAt(dx);return m?{dx,dz:m.dz,clearance:m.clearance,levels:m.levels,lip:m.lip,approach:m.approach}:{dx,none:'no dz puts the whole sheet through both openings with 0.25 m to each plate edge'};})
 },
 walkingClearanceUsed:WALK
};
fs.mkdirSync(OUT,{recursive:true});
const json=JSON.stringify(R,null,1)+'\n';
if(CHECK){const old=fs.readFileSync(new URL('placement.json',OUT),'utf8');assert.equal(old,json,'placement.json is out of date: run node scripts/lounge-falls-placement.mjs');console.log('placement.json is current');process.exit(0);}
fs.writeFileSync(new URL('placement.json',OUT),json);

// ---- Drawings: an overhead plan and fixed-camera projections of the plan data (vector, no screenshots) --------------------
const BLUE='#4aa3ff',ORANGE='#ff8a2a',TEAL='#19b3a6',AMBER='#e0a030',RED='#ff4a4a',GREEN='#3ddc84';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const wrap=(w,h,bg,body)=>'<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" font-family="Arial, Helvetica, sans-serif"><rect width="'+w+'" height="'+h+'" fill="'+bg+'"/>'+body+'</svg>\n';
const text=(x,y,s,o={})=>'<text x="'+r2(x)+'" y="'+r2(y)+'" font-size="'+(o.size||13)+'" fill="'+(o.fill||'#e8edf5')+'"'+(o.anchor?' text-anchor="'+o.anchor+'"':'')+(o.weight?' font-weight="'+o.weight+'"':'')+'>'+esc(s)+'</text>';
const fmt=n=>(n>=0?'+':'-')+Math.abs(n).toFixed(2);
const cl=(v)=>v<0?'overlaps by '+Math.abs(v).toFixed(2)+' m':v.toFixed(2)+' m';
const caption=(lines,x,y,gap=18)=>lines.map((l,i)=>text(x,y+i*gap,typeof l==='string'?l:l[0],typeof l==='string'?{}:l[1])).join('');
const factsFor=(a,m)=>{const ex=bExtent(a),c=m.clearance;return [
 'sheet x '+r2(a.sheet.x0)+' to '+r2(a.sheet.x1)+', z '+r2(a.sheet.zTop)+' (lip) to '+r2(a.sheet.zFoot)+' (foot); pond centre ('+m.centre.map(r2).join(', ')+')',
 'collider bounds x '+ex.collider.x.join(' to ')+', z '+ex.collider.z.join(' to ')+'; with plants '+ex.dressed.x.join(' to ')+' / '+ex.dressed.z.join(' to ')+'; water light '+ex.effects.x.join(' to ')+' / '+ex.effects.z.join(' to '),
 'through Deck 18 opening: '+(m.levels[0].openFraction*100).toFixed(0)+'% open, '+m.levels[0].minClearance.toFixed(2)+' m to nearest plate edge; Deck 19 opening: '+(m.levels[1].openFraction*100).toFixed(0)+'% open, '+m.levels[1].minClearance.toFixed(2)+' m',
 'stairs '+cl(c.stairs)+'; dome ring '+cl(c.dome)+'; munchies counter '+cl(c.munchies)+'; tasting deck '+cl(c.tastingDeck)+'; rear wall '+cl(c.hullWall),
 'lip hung from the Deck 19 slab/plate over '+(m.lip.supportedFraction*100).toFixed(0)+'% of its length, largest gap '+m.lip.largestGap.toFixed(2)+' m; front approach: '+m.approach.freeAhead.toFixed(2)+' m ahead, then '+m.approach.stoppedBy];};

function planSVG(){
 const S=30,X0=-136,X1=-84,Z0=-65,Z1=-33,W=(X1-X0)*S,MAP=(Z1-Z0)*S,H=MAP+250;
 const px=x=>r2((x-X0)*S),pz=z=>r2((z-Z0)*S);
 const pts=P=>P.map(p=>px(p[0])+','+pz(p[1])).join(' ');
 const poly=(P,a)=>'<polygon points="'+pts(P)+'" '+a+'/>',rect=(R,a)=>poly(rectPoly(R),a);
 const line=(a,b,col,w=1.5,dash='')=>'<line x1="'+px(a[0])+'" y1="'+pz(a[1])+'" x2="'+px(b[0])+'" y2="'+pz(b[1])+'" stroke="'+col+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>';
 const dim=(a,b,label,col)=>line(a,b,col,1.5)+line([a[0],a[1]-.25],[a[0],a[1]+.25],col,1.5)+line([b[0],b[1]-.25],[b[0],b[1]+.25],col,1.5)+text(px((a[0]+b[0])/2),pz((a[1]+b[1])/2)-6,label,{size:12,fill:col,anchor:'middle',weight:'bold'});
 let g='';
 // grid every 5 m
 for(let x=-135;x<=X1;x+=5)g+=line([x,Z0],[x,Z1],'#1d2533',1)+text(px(x),14,String(x),{size:10,fill:'#6b7a92',anchor:'middle'});
 for(let z=-60;z<=Z1;z+=5)g+=line([X0,z],[X1,z],'#1d2533',1)+text(4,pz(z)+4,String(z),{size:10,fill:'#6b7a92'});
 // The room, the slab openings, the two levels' plates
 g+=poly(room.polygon,'fill="none" stroke="#7d8aa3" stroke-width="2"');
 for(const [lv,col] of [[LV[0],TEAL],[LV[1],AMBER]]){
  g+='<polyline points="'+pts(lv.opening.filter(p=>p[1]<-44))+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-dasharray="7 5"/>';
  for(const o of lv.plates)g+=poly(o.poly,'fill="'+col+'" fill-opacity=".16" stroke="'+col+'" stroke-width="1.5"');}
 // Free through both levels (the shaft): rows of 0.1 m
 {let s='';for(let z=-60;z<-44;z+=.1){let run=null;for(let x=-126;x<=-88+1e-9;x+=.1){const f=solid(LV[0],[x,z])>.25&&solid(LV[1],[x,z])>.25;if(f&&run===null)run=x;if((!f||x>=-88)&&run!==null){s+='<rect x="'+px(run)+'" y="'+pz(z)+'" width="'+r2((x-run)*S)+'" height="'+r2(.1*S+.5)+'"/>';run=null;}}}
  g+='<g fill="'+GREEN+'" fill-opacity=".45">'+s+'</g>';}
 // Fixed things on the floor
 g+=rect(STAIRS,'fill="#8a93a6" fill-opacity=".35" stroke="#b8c0d0" stroke-width="1.5"')+text(px((STAIRS.x0+STAIRS.x1)/2),pz(STAIRS.z0)+16,'stairs',{size:12,anchor:'middle'});
 for(const f of flights)g+=rect(f,'fill="none" stroke="#b8c0d0" stroke-width="1" stroke-dasharray="3 3"');
 g+='<circle cx="'+px(DOME.c[0])+'" cy="'+pz(DOME.c[1])+'" r="'+r2(DOME.r*S)+'" fill="#6a4bd8" fill-opacity=".16" stroke="#a77bff" stroke-width="2"/><circle cx="'+px(DOME.c[0])+'" cy="'+pz(DOME.c[1])+'" r="'+r2(6.5*S)+'" fill="none" stroke="#a77bff" stroke-width="1" stroke-dasharray="4 3"/>'+text(px(DOME.c[0]),pz(DOME.c[1]),'dome + planter ring',{size:12,anchor:'middle'});
 g+=rect(MUNCH,'fill="#8a93a6" fill-opacity=".3" stroke="#b8c0d0" stroke-width="1.5"')+text(px((MUNCH.x0+MUNCH.x1)/2),pz((MUNCH.z0+MUNCH.z1)/2),'munchies',{size:11,anchor:'middle'});
 g+=rect(TASTING,'fill="#8a93a6" fill-opacity=".3" stroke="#b8c0d0" stroke-width="1.5"')+text(px((TASTING.x0+TASTING.x1)/2),pz((TASTING.z0+TASTING.z1)/2)+4,'tasting deck',{size:11,anchor:'middle'});
 // The assembly, current then proposed
 const draw=(a,col,dash,label)=>{const d=dash?' stroke-dasharray="'+dash+'"':'';let s='';
  s+=poly(a.pondCollider,'fill="'+col+'" fill-opacity=".16" stroke="'+col+'" stroke-width="2"'+d);
  s+=poly(a.pondWater,'fill="none" stroke="'+col+'" stroke-width="1"'+d);
  for(const R of [a.causeway,a.landing])s+=rect(R,'fill="'+col+'" fill-opacity=".3" stroke="'+col+'" stroke-width="1.5"'+d);
  s+=rect(a.bench,'fill="'+col+'" stroke="'+col+'" stroke-width="1"');
  s+=rect(a.lip,'fill="'+col+'" fill-opacity=".5" stroke="'+col+'" stroke-width="1.5"');
  s+=line([a.sheet.x0,a.sheet.zTop],[a.sheet.x1,a.sheet.zTop],col,4);
  const b=bounds(allPoints(a));s+=rect(b,'fill="none" stroke="'+col+'" stroke-width="1" stroke-dasharray="2 4"');
  s+=text(px(b.x0)+4,pz(b.z0)-6,label,{fill:col,weight:'bold',size:13});return s;};
 g+=draw(cur,BLUE,'6 4','CURRENT (built)')+draw(prop,ORANGE,'','PROPOSAL (not built)');
 // Translation vector and dimensions
 g+=line(cur.centre,prop.centre,'#ffffff',2.5)+'<circle cx="'+px(prop.centre[0])+'" cy="'+pz(prop.centre[1])+'" r="5" fill="#fff"/>'+text(px((cur.centre[0]+prop.centre[0])/2)+8,pz((cur.centre[1]+prop.centre[1])/2)+18,'translation '+fmt(chosen.dx)+' X, 0 Y, '+fmt(chosen.dz)+' Z',{weight:'bold'});
 const pb=bounds(allPoints(prop));
 if(proposal.clearance.stairs>0)g+=dim([pb.x1,-50.5],[STAIRS.x0,-50.5],proposal.clearance.stairs.toFixed(2)+' m to stairs',RED);
 g+=dim([-110,-52.45],[-110,-51.33],'',GREEN).replace(/<text[^>]*><\/text>/,'');
 g+=text(px(-118),pz(-58.2),'free shaft between the decks: 1.12 m wide at x -110',{size:11,fill:GREEN});g+=line([-110,-52.9],[-110,-57.8],GREEN,1);
 const mapEnd=g.length;
 // Legend and facts
 let y=MAP+22;
 g+=text(12,y,'Hydro-Nip Lounge waterfall and pond: overhead plan, ship metres (X right, Z down the page: the rear wall is at the top). PROPOSAL, not built.',{weight:'bold',size:15});y+=24;
 g+=caption([['Teal: Deck 18 plates and slab opening edge. Amber: Deck 19 plates and slab opening edge. Green: free of both levels by 0.25 m or more (the shaft the sheet has to fall through).',{size:12,fill:'#aab6cc'}]],12,y);y+=24;
 g+=text(12,y,'Current (blue)',{fill:BLUE,weight:'bold'});y+=18;g+=caption(factsFor(cur,current).map(s=>[s,{size:12,fill:'#cfd8e8'}]),12,y,16);y+=16*5+10;
 g+=text(12,y,'Proposal (orange): translation '+fmt(chosen.dx)+', 0, '+fmt(chosen.dz)+' m',{fill:ORANGE,weight:'bold'});y+=18;g+=caption(factsFor(prop,proposal).map(s=>[s,{size:12,fill:'#cfd8e8'}]),12,y,16);
 // 5 m scale bar
 g+=line([-134,-34.5],[-129,-34.5],'#fff',3)+text(px(-131.5),pz(-34.5)-6,'5 m',{size:11,anchor:'middle'});
 return wrap(W,H,'#10141c','<defs><clipPath id="map"><rect x="0" y="0" width="'+W+'" height="'+MAP+'"/></clipPath></defs><g clip-path="url(#map)">'+g.slice(0,mapEnd)+'</g>'+g.slice(mapEnd));
}

// Fixed cameras. `at` is the walker's feet and yaw/pitch are the walk link's, as the walk's first-person camera uses them:
// eye 0.93 of a 1.75 m cat above the feet (1.628 m), moved 0.12 m forward, 62 degrees vertical field, 16:9.
const CAMERAS=[
 {id:'reference',title:'Reference view (tester\'s camera)',at:[-101.49,25.52,-41.22],yaw:541,pitch:5,link:'walk.html?lv=2&at=-101.49,25.52,-41.22&yaw=541&pitch=5&view=first'},
 {id:'beside-bridge',title:'From beside the bridge toward the arcade',at:[-123,24.3,-53],yaw:90,pitch:6,link:'walk.html?lv=2&at=-123,24.3,-53&yaw=90&pitch=6&view=first'},
 {id:'deck19-edge',title:'Deck 19 gallery edge, looking down on the pond',at:[-106,32.3,-48],yaw:180,pitch:-30,link:'walk.html?lv=2&at=-106,32.3,-48&yaw=180&pitch=-30&view=first'}];
function viewSVG(cam,mode){
 const Wd=1280,Hd=720,f0=(Hd/2)/Math.tan(31*Math.PI/180),yaw=cam.yaw*Math.PI/180,pit=cam.pitch*Math.PI/180;
 const F=[Math.sin(yaw)*Math.cos(pit),Math.sin(pit),Math.cos(yaw)*Math.cos(pit)],Rt=[-Math.cos(yaw),0,Math.sin(yaw)],Up=[Rt[1]*F[2]-Rt[2]*F[1],Rt[2]*F[0]-Rt[0]*F[2],Rt[0]*F[1]-Rt[1]*F[0]];
 const E=[cam.at[0]+Math.sin(yaw)*.12,cam.at[1]+1.628,cam.at[2]+Math.cos(yaw)*.12];
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],rel=p=>[p[0]-E[0],p[1]-E[1],p[2]-E[2]],NEAR=.1;
 const sp=p=>{const d=rel(p),z=dot(d,F);return [r2(Wd/2+dot(d,Rt)/z*f0),r2(Hd/2-dot(d,Up)/z*f0)];};
 const clipSeg=(a,b)=>{const da=dot(rel(a),F)-NEAR,db=dot(rel(b),F)-NEAR;if(da<0&&db<0)return null;if(da>=0&&db>=0)return [a,b];const t=da/(da-db),m=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];return da<0?[m,b]:[a,m];};
 const path=(P,close=false)=>{let d='';const n=P.length;for(let i=0;i<(close?n:n-1);i++){const s=clipSeg(P[i],P[(i+1)%n]);if(s)d+='M'+sp(s[0]).join(' ')+'L'+sp(s[1]).join(' ');}return d;};
 const stroke=(P,col,w=1.5,dash='',close=false)=>{const d=path(P,close);return d?'<path d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+w+'"'+(dash?' stroke-dasharray="'+dash+'"':'')+'/>':'';};
 const fillPoly=(P,col,op)=>{const out=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],da=dot(rel(a),F)-NEAR,db=dot(rel(b),F)-NEAR;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);}}
  return out.length>2?'<polygon points="'+out.map(p=>sp(p).join(',')).join(' ')+'" fill="'+col+'" fill-opacity="'+op+'" stroke="'+col+'" stroke-width="1"/>':'';};
 const lift=(P,y)=>P.map(p=>[p[0],y,p[1]]);
 let g='';
 const env='#8a93a6';
 // Rear wall at floor and ceiling, plates' edges, slab opening edges, flights, dome, counters
 const wallPts=room.polygon.filter(p=>p[1]<-56&&p[0]>-135&&p[0]<-88);
 g+=stroke(lift(wallPts,24.3),'#55627a',1.5)+stroke(lift(wallPts,35.65),'#55627a',1.5);
 for(const [lv,col] of [[LV[0],TEAL],[LV[1],AMBER]]){
  for(const o of lv.plates)g+=stroke(lift(o.poly,lv.y),col,1.5,'',true);
  g+=stroke(lift(lv.opening.filter(p=>p[1]<-44),lv.y),col,1.5,'6 4');}
 for(const fl of flights){const c=[[fl.x0,fl.z0],[fl.x1,fl.z0],[fl.x1,fl.z1],[fl.x0,fl.z1]];g+=stroke(lift(c,fl.y1),env,1.5,'',true);g+=stroke(lift(c,fl.y0),env,1,'3 3',true);}
 const circle=(c,r,y)=>Array.from({length:96},(_,i)=>[c[0]+r*Math.cos(i/96*Math.PI*2),y,c[1]+r*Math.sin(i/96*Math.PI*2)]);
 g+=stroke(circle(DOME.c,DOME.r,24.3),'#a77bff',1.5,'',true)+stroke(circle(DOME.c,6.5,24.3),'#a77bff',1,'3 3',true);
 {const c=[[MUNCH.x0,MUNCH.z0],[MUNCH.x1,MUNCH.z0],[MUNCH.x1,MUNCH.z1],[MUNCH.x0,MUNCH.z1]];g+=stroke(lift(c,25.4),env,1.5,'',true)+stroke(lift(c,24.3),env,1,'3 3',true);}
 // The assembly
 const asm=(a,m,col,dash,label,op)=>{let s='';const wat=a.pondWater.map(p=>[p[0],24.57,p[1]]),rim=a.pondCollider.map(p=>[p[0],24.88,p[1]]);
  s+=fillPoly(wat,col,.18*op)+stroke(rim,col,2,dash,true);
  for(const R of [a.causeway,a.landing]){const c=[[R.x0,R.z0],[R.x1,R.z0],[R.x1,R.z1],[R.x0,R.z1]];s+=fillPoly(lift(c,24.66),col,.3*op)+stroke(lift(c,24.66),col,1.5,dash,true);}
  const sh=a.sheet,z=y=>sh.zAt(y);s+=fillPoly([[sh.x0,sh.yTop,z(sh.yTop)],[sh.x1,sh.yTop,z(sh.yTop)],[sh.x1,sh.yBottom,z(sh.yBottom)],[sh.x0,sh.yBottom,z(sh.yBottom)]],col,.3*op);
  s+=stroke([[sh.x0,sh.yTop,z(sh.yTop)],[sh.x0,sh.yBottom,z(sh.yBottom)],[sh.x1,sh.yBottom,z(sh.yBottom)],[sh.x1,sh.yTop,z(sh.yTop)]],col,2,dash);
  const lp=a.lip;s+=stroke([[lp.x0,lp.y1,lp.z0],[lp.x1,lp.y1,lp.z0],[lp.x1,lp.y1,lp.z1],[lp.x0,lp.y1,lp.z1]],col,2,'',true)+stroke([[lp.x0,lp.y0,lp.z0],[lp.x1,lp.y0,lp.z0],[lp.x1,lp.y0,lp.z1],[lp.x0,lp.y0,lp.z1]],col,2,'',true);
  // Where the sheet's centre line and ends meet each level, green when open and red when it would cross solid
  for(const [lv,yy] of [[LV[0],LV[0].y],[LV[1],LV[1].y]])for(const x of [sh.x0,(sh.x0+sh.x1)/2,sh.x1]){const zz=z(yy===LV[1].y?sh.yTop:yy),open=solid(lv,[x,zz])>=.25,p=[x,yy,zz],q=dot(rel(p),F);if(q>NEAR){const [u,v]=sp(p);s+='<circle cx="'+u+'" cy="'+v+'" r="5" fill="'+(open?GREEN:RED)+'" stroke="#000" stroke-width="1"/>';}}
  const [lx,ly]=sp([(sh.x0+sh.x1)/2,sh.yTop+.6,z(sh.yTop)]);s+=text(lx,ly,label,{fill:col,weight:'bold',size:16,anchor:'middle'});return s;};
 if(mode==='current')g+=asm(cur,current,BLUE,'6 4','CURRENT (built)',1);
 else g+=asm(cur,current,BLUE,'6 4','',.25).replace(/<text[^>]*><\/text>/g,'')+asm(prop,proposal,ORANGE,'','PROPOSAL (not built)',1);
 const m=mode==='current'?current:proposal,a=mode==='current'?cur:prop;
 let y=Hd-96;g+='<rect x="0" y="'+(y-22)+'" width="'+Wd+'" height="130" fill="#10141c" fill-opacity=".82"/>';
 g+=text(12,y,(mode==='current'?'CURRENT':'PROPOSAL (not built)')+' · '+cam.title+' · schematic projection of the plan data, walk link '+cam.link,{weight:'bold',size:13,fill:mode==='current'?BLUE:ORANGE});
 g+=caption(factsFor(a,m).slice(2).map(s=>[s,{size:12,fill:'#cfd8e8'}]),12,y+20,18);
 g+=text(Wd-12,22,'green dot: sheet clear of the level by 0.25 m or more · red dot: sheet crosses a slab or plate · teal/amber: Deck 18/19 plates and openings',{size:11,fill:'#aab6cc',anchor:'end'});
 return wrap(Wd,Hd,'#0b0f16',g);
}

fs.writeFileSync(new URL('plan.svg',OUT),planSVG());
for(const c of CAMERAS)for(const mode of ['current','proposed'])fs.writeFileSync(new URL('view-'+c.id+'-'+mode+'.svg',OUT),viewSVG(c,mode));
fs.writeFileSync(new URL('views.json',OUT),JSON.stringify({about:'Fixed cameras for comparing the waterfall placement. Links are for the walk (lv=2, first person); the SVGs project the plan data from the same cameras.',cameras:CAMERAS.map(({id,title,at,yaw,pitch,link})=>({id,title,at,yaw,pitch,link,svgCurrent:'view-'+id+'-current.svg',svgProposed:'view-'+id+'-proposed.svg'}))},null,1)+'\n');
console.log(JSON.stringify({translation:R.proposal.translation,current:current,proposal:proposal},null,1));
