// v2 wayfinding signs: no stair or lift sign may stand inside a cabin or a room, and a wing stair's sign hangs in its
// wing corridor. The old placement (stair centre + 3.5 m in z) put all 50 port-side wing stair signs inside the cabin
// beside the stair; the check must still reject that placement.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {signPlaces,legacySignPlace} from '../src/plan/signs-v2.js';
import {runtimeLayout} from './v2-plugin.mjs';
import {guideSchedule} from '../src/v2/wayfinding-guide-data.js';
// Placed from the plan as the walk receives it (v2-layout), since that's what src/v2/signs.js reads.
const full=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8')),layout=runtimeLayout(full);
const inside=(p,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>p[1])!==(zj>p[1])&&p[0]<(xj-xi)*(p[1]-zi)/(zj-zi)+xi)c=!c;}return c;};
const byDeck=list=>{const m=new Map();for(const o of list)if(o.polygon)(m.get(o.deck)||m.set(o.deck,[]).get(o.deck)).push(o);return m;};
const cabins=byDeck(layout.cabins),rooms=byDeck(layout.rooms);
// The sign's two ends and centre in plan.
const ends=({at,yaw,width})=>[-.5,0,.5].map(t=>[at[0]+Math.cos(yaw)*t*width,at[2]-Math.sin(yaw)*t*width]);
function intrusions(places){
 const out=[];for(const p of places){const pts=ends(p),hit=[...(cabins.get(p.s.deck)||[]),...(rooms.get(p.s.deck)||[])].find(o=>pts.some(q=>inside(q,o.polygon)));if(hit)out.push(`${p.s.id} (deck ${p.s.deck}) inside ${hit.id}`);}
 return out;
}
const places=signPlaces(layout),bad=intrusions(places);
assert.deepEqual(bad,[],'Wayfinding signs inside cabins or rooms:\n'+bad.join('\n'));
const segDist=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
const wing=places.filter(p=>p.s.wing!==undefined);
for(const p of wing){const r=layout.circulation.corridors.find(r=>r.id===p.corridor),d=Math.min(...r.points.slice(1).map((b,i)=>segDist([p.at[0],p.at[2]],r.points[i],b)));
 assert.ok(d<.01&&p.width<=r.width-.5,`${p.s.id}: sign not centred across ${r.id} (${d.toFixed(3)} m off, ${p.width} m wide in ${r.width} m)`);}
// The old placement must fail, on exactly the 50 port-side wing stairs.
const legacy=intrusions(places.map(p=>({s:p.s,...legacySignPlace(layout,p.s)})));
assert.equal(legacy.length,51,'expected 50 original wing conflicts and the new Deck 5 waiting-room conflict');
assert.equal(legacy.filter(l=>/wing-stair-.*--1 /.test(l)).length,50,'all 50 original port-side wing conflicts remain rejected');
assert.deepEqual(legacy.filter(l=>!/wing-stair-.*--1 /.test(l)),['forward_lift_1 (deck 5) inside d05-launch-d-28']);
console.log(`Wayfinding signs: ${places.length} placed, none inside a cabin or room; ${wing.length} wing stair signs hang across their wing corridors; the old placement is rejected (${legacy.length} inside cabins)`);

// Room plaques sit on the hallway wall face above the door trim, below either ceiling.
const guides=guideSchedule(layout),eligible=layout.rooms.filter(r=>!r.aggregate&&r.door&&!r.id.includes('-housekeeping-'));
assert.deepEqual(guides.map(g=>g.id),eligible.map(r=>r.id),'Keep the existing sign schedule');
function checkRoomGuide(g,r){
 const n=r.door.outward,dx=g.at[0]-r.door.center[0],dz=g.at[2]-r.door.center[2],ceiling=Math.min(r.y+r.height,r.door.center[1]+3.64);
 assert(Math.abs(dx*n[0]+dz*n[1]-.065)<1e-8,'Plaque must be just outside the wall face '+r.id);
 assert(Math.abs(dx*n[1]-dz*n[0])<1e-8,'Plaque must be centred over the doorway '+r.id);
 assert(Math.hypot(Math.sin(g.yaw)-n[0],Math.cos(g.yaw)-n[1])<1e-8,'Plaque must face the hallway '+r.id);
 assert(g.height>0&&g.height<=.55&&g.at[1]-g.height/2>=r.door.center[1]+2.5875-1e-8,'Plaque overlaps the door trim '+r.id);
 assert(g.at[1]+g.height/2<=ceiling-.02+1e-8,'Plaque crosses the ceiling '+r.id);
 assert(Math.abs(g.width/Math.min(3,Math.max(1.8,r.door.width-.3))-g.height/.55)<1e-8,'Fit must scale uniformly '+r.id);
 assert.equal(g.label,r.name);assert.equal(g.youAreHere,'You are here · Deck '+r.deck);assert.equal(g.plaque,r.id!=='commons-1');
 assert.deepEqual(g.from,[r.door.center[0]+n[0]*1.9,r.y+.025,r.door.center[2]+n[1]*1.9]);
 assert.deepEqual(g.to,[r.door.center[0]+n[0]*.6,r.y+.025,r.door.center[2]+n[1]*.6]);
}
for(const [i,g]of guides.entries())checkRoomGuide(g,eligible[i]);
const sample=eligible.find(r=>r.id==='d01-launch-d-27'),guide=guides.find(g=>g.id===sample.id);
assert.throws(()=>checkRoomGuide({...guide,at:[sample.door.center[0],sample.y+2.75,sample.door.center[2]-.9]},sample),/wall face/,'Reject the old hallway overhang');
assert.throws(()=>checkRoomGuide({...guide,at:[guide.at[0]+.4,guide.at[1],guide.at[2]]},sample),/centred/,'Reject a sign beside its door');
// A narrow, raised, rotated doorway with a low ceiling must keep a wider plaque and shrink it to fit.
const shallow={...sample,height:3,door:{...sample.door,width:.6,center:[...sample.door.center],outward:[Math.SQRT1_2,Math.SQRT1_2]}};shallow.door.center[1]+=.15;
const fitted=guideSchedule({...layout,rooms:[shallow]})[0];checkRoomGuide(fitted,shallow);assert(fitted.height<.55&&fitted.width>shallow.door.width);
assert.throws(()=>checkRoomGuide({...fitted,height:.55},shallow),/trim|ceiling/,'Reject an unscaled sign in a shallow strip');
console.log(`Room plaques: ${guides.filter(g=>g.plaque).length} wall-mounted, centred, fitted and one per existing doorway; old overhang and shallow-strip overflow rejected`);
