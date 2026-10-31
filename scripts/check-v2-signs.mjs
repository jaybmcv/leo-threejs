// v2 wayfinding signs: no stair or lift sign may stand inside a cabin or a room, and a wing stair's sign hangs in its
// wing corridor. The old placement (stair centre + 3.5 m in z) put all 50 port-side wing stair signs inside the cabin
// beside the stair; the check must still reject that placement.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {signPlaces,legacySignPlace} from '../src/plan/signs-v2.js';
import {runtimeLayout} from './v2-plugin.mjs';
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
assert.equal(legacy.length,50,'expected the old sign placement to put 50 signs inside cabins, got '+legacy.length);
assert.ok(legacy.every(l=>/wing-stair-.*--1 /.test(l)),'old placement failures should all be port-side wing stairs');
console.log(`Wayfinding signs: ${places.length} placed, none inside a cabin or room; ${wing.length} wing stair signs hang across their wing corridors; the old placement is rejected (${legacy.length} inside cabins)`);
