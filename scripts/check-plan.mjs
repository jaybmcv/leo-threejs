import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {ShapeUtils,Vector2} from 'three';
import {LAYOUT_V2 as L,PLAN_V2_PIN,V1_ROOMS} from '../src/plan/layout-v2.js';
import {CABINS} from '../src/model.js';
import {hullV2} from '../src/plan/hull-v2.js';
import {area,bounds,contains,overlaps,rectangle,distanceToSegment} from '../src/plan/geometry-v2.js';

const failures=[],checks={},h=hullV2();
const check=(kind,condition,detail)=>{checks[kind]=(checks[kind]||0)+1;if(!condition)failures.push({kind,detail});};
const triCache=new WeakMap();
function triangles(p){if(!triCache.has(p)){const v=p.map(p=>new Vector2(...p));triCache.set(p,ShapeUtils.triangulateShape(v,[]).map(ix=>ix.map(i=>p[i])));}return triCache.get(p);}
function intersects(a,b){if(!overlaps(rectangle((bounds(a).x0+bounds(a).x1)/2,(bounds(a).z0+bounds(a).z1)/2,bounds(a).x1-bounds(a).x0,bounds(a).z1-bounds(a).z0),rectangle((bounds(b).x0+bounds(b).x1)/2,(bounds(b).z0+bounds(b).z1)/2,bounds(b).x1-bounds(b).x0,bounds(b).z1-bounds(b).z0)))return false;
 const concave=p=>{let sign=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],c=p[(i+2)%p.length],v=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(v)<1e-8)continue;if(sign&&Math.sign(v)!==sign)return true;sign=Math.sign(v);}return false;};
 if(!concave(a)&&!concave(b))return overlaps(a,b);return triangles(a).some(A=>triangles(b).some(B=>overlaps(A,B)));
}
function inAtrium(d,p){const s=d.atrium.samples,f=(p[0]-s[0][0])*2;if(f<0||f>=s.length-1)return false;const i=Math.floor(f),w=s[i][1]+(s[i+1][1]-s[i][1])*(f-i);return w>.001&&Math.abs(p[1])<w-1e-7;}
const rooms=L.rooms.filter(r=>!r.aggregate),all=[...rooms,...L.cabins,...L.shuttles],byId=new Map(all.map(r=>[r.id,r])),windows=new Map(L.windows.map(w=>[w.id,w]));
check('issues',L.summary.issues.length===0,L.summary.issues);
check('cabins',L.cabins.length===PLAN_V2_PIN.cabins,L.cabins.length);
check('berths',L.cabins.reduce((n,c)=>n+c.berths,0)===10000,L.summary.berths);
for(let d=6;d<=15;d++)check('pinned deck count',L.cabins.filter(c=>c.deck===d).length===PLAN_V2_PIN.perDeck[d-6],d);
for(const c of CABINS){const n=L.cabins.find(n=>n.id===L.cabinIdMap[c.id]);check('explicit v1 cabin map',!!n&&n.legacyIds.includes(c.id),c.id);check('legacy deck and side',n?.deck===c.deck&&Math.sign(n.z)===Math.sign(c.z),c.id);}check('complete cabin remap',Object.keys(L.cabinIdMap).length===5000,'all legacy cabins');
check('unique ids',new Set(all.map(r=>r.id)).size===all.length,'rooms/cabins/craft');
for(const r of [...rooms,...L.cabins]){
 check('full-height containment',r.envelope?r.envelope.every(s=>h.fits(s.polygon,r.y+s.rise,s.height,2.5,0)):h.fits(r.polygon,r.y,r.height),r.id);
 check('placed room',r.status!=='unfitted',r.id);
 check('door on wall',r.door&&r.polygon.some((p,i)=>distanceToSegment([r.door.center[0],r.door.center[2]],p,r.polygon[(i+1)%r.polygon.length])<.011),r.id);
 if(r.row){check('cabin dimensions',r.width===3.18&&r.depth===7.4&&r.height===3.5,r.id);check('cabin type',r.type==='twin'&&r.berths===2||r.type==='single'&&r.berths===1,r.id);if(r.row==='cross')check('aft core exclusion',r.polygon.every(p=>Math.abs(p[1])>=17.5),r.id);}
}
for(const a of V1_ROOMS){const r=L.rooms.find(r=>r.id===a.id);check('v1 coverage',!!r,a.id);if(r){check('preserved area',r.areaException||area(r.polygon)+1e-5>=a.width*a.depth,{id:a.id,old:a.width*a.depth,next:area(r.polygon),exception:r.areaException});check('preserved fitting dimensions',r.areaException||r.width>=a.width&&r.depth>=a.depth,{id:a.id,size:r.size});}}
for(const d of L.decks){
 const solids=all.filter(r=>r.y<d.y+3.4&&r.y+r.height>d.y+.1).map(r=>({...r,polygon:r.envelope?.find(s=>d.y-r.y>=s.rise-1e-7&&d.y-r.y<s.rise+s.height)?.polygon??r.polygon,kind:r.row?'cabin':r.seats?'craft':'room'})),shafts=[...d.openings,...L.circulation.stairs.filter(s=>s.deck===d.number&&!d.openings.some(o=>o.id===s.id))].map(s=>({...s,kind:'shaft'})),items=[...solids,...shafts].map(r=>({...r,b:bounds(r.polygon)})).sort((a,b)=>a.b.x0-b.b.x0);
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length&&items[j].b.x0<items[i].b.x1-1e-6;j++){
  const a=items[i],b=items[j];if(a.kind==='shaft'&&b.kind==='shaft')continue;
  check('no volume overlaps',!intersects(a.polygon,b.polygon),{deck:d.number,a:a.id,b:b.id});
 }
 for(const r of solids){check('room floor on slab',r.polygon.every(p=>contains(d.slab.outline,p)),{deck:d.number,id:r.id});if(d.atrium&&d.number>6)check('clear atrium',!intersects(r.polygon,d.atrium.outline),{deck:d.number,id:r.id});for(const b of L.circulation.bridges.filter(b=>b.deck===d.number))check('bridge clearance',!intersects(r.polygon,b.polygon),{deck:d.number,room:r.id,bridge:b.id});for(const b of L.circulation.towers.filter(b=>b.deck===d.number))check('tower clearance',!intersects(r.polygon,b.polygon),{deck:d.number,room:r.id});}
 if(d.number>=6){check('atrium floor',d.atrium.floor===(d.number===6),d.number);if(d.number>6)check('atrium slab hole',d.slab.holes.some(p=>p.id==='atrium'),d.number);if(d.number<20)for(let i=0;i<d.atrium.samples.length;i++){const lo=d.atrium.samples[i][1],hi=L.decks[d.number].atrium.samples[i][1];check('downward void nesting',lo+1e-7>=hi,{deck:d.number,i,lo,hi});if(d.number>=13)check('funnel step per side',lo-hi<=10.00001,{deck:d.number,i,lo,hi});}if(d.number>=16)check('upper atrium target',d.atrium.widthMid>= (d.number===20?28:40)-1e-7,d.number);}
}
for(const c of L.cabins)if(c.view==='space')check('cabin window',windows.get(c.window)?.cabinId===c.id,c.id);
for(const r of rooms.filter(r=>r.outer&&r.deck<=5))check('outer room windows',r.windows?.length>0,r.id);
for(const w of L.windows){
 const owner=byId.get(w.cabinId??w.roomId);check('aperture owner',!!owner,w.id);check('wall aperture finite',w.roomWallOpening.corners.every(p=>p.every(Number.isFinite)),w.id);
 check('matching wall aperture',w.roomWallOpening?.owner===owner?.id&&w.roomWallOpening.aperture===w.id,w.id);
 check('window dimensions',w.kind==='cabin'?w.width===2.2&&w.height===1.3&&w.sill===.8:w.kind==='working'?w.width===3&&w.height===1.4&&w.sill===.9:w.kind==='garden'?w.height===11.2:w.width===3&&w.height===2.2&&w.sill===.5,w.id);
 check('window unit normal',Math.abs(Math.hypot(...w.normal)-1)<1e-7,w.id);
 check('fitted pane',w.corners.every(p=>p.every(Number.isFinite)&&h.onSurface(p)),w.id);
 check('curved facade samples',w.surface.points.length===9&&w.surface.points.every(p=>p&&h.onSurface(p)),w.id);
 if(w.kind!=='cabin'){let measured=0,last;for(let k=0;k<=64;k++){const x=w.corners[0][0]+(w.corners[1][0]-w.corners[0][0])*k/64,p=[x,h.skin(x,w.center[1],Math.sign(w.center[2]))];if(last)measured+=Math.hypot(p[0]-last[0],p[1]-last[1]);last=p;}check('facade width metres',Math.abs(measured-3)<.05,{id:w.id,measured});}
 check('window sill',Math.abs(w.center[1]-w.height/2-owner.y-w.sill)<1e-5,w.id);
}
for(const r of rooms){const panes=L.windows.filter(w=>w.roomId===r.id);for(const side of [-1,1]){const row=panes.filter(w=>Math.sign(w.center[2])===side).sort((a,b)=>a.facadeArc-b.facadeArc);for(let i=1;i<row.length;i++){const gap=row[i].facadeArc-row[i-1].facadeArc;check('facade pitch metres',gap>=3.3-1e-6&&Math.abs(gap/3.3-Math.round(gap/3.3))<1e-6,r.id);}}}
for(const [kind,count]of Object.entries(PLAN_V2_PIN.windowsByKind))check('pinned windows',L.windows.filter(w=>w.kind===kind).length===count,kind);
check('shuttles',L.shuttles.length===100,L.shuttles.length);check('shuttle seats',L.shuttles.reduce((n,c)=>n+c.seats.length,0)===10000,L.summary.seats);
for(let d=1;d<=5;d++)check('craft per deck',L.shuttles.filter(s=>s.deck===d).length===20,d);
for(const s of L.shuttles){
 check('craft containment',h.fits(s.polygon,s.y,s.height),s.id);check('craft dimensions',s.length===22&&s.beam===8,s.id);check('individual seats',s.seats.length===100&&new Set(s.seats.map(s=>s.id)).size===100,s.id);
 check('seat packing',s.seats.every(p=>Math.abs(p.local[0])+.4<11&&Math.abs(p.local[2])+.35<4),s.id);
 check('hull launch door',s.door.width>=s.beam&&s.door.height>=s.height&&s.door.corners.every(p=>Math.abs(Math.abs(p[2])-h.skin(p[0],p[1],s.door.side))<.001),s.id);
 for(const r of all.filter(r=>r.deck===s.deck&&r.id!==s.id))check('launch clearance',!intersects(s.launch.polygon,r.polygon),{craft:s.id,room:r.id});
}
const graph=new Map(L.circulation.nodes.map(n=>[n.id,[]])),nodeById=new Map(L.circulation.nodes.map(n=>[n.id,n]));
for(const e of L.circulation.edges){check('graph endpoints',graph.has(e.a)&&graph.has(e.b),e);if(graph.has(e.a)&&graph.has(e.b)&&!e.vertical){graph.get(e.a).push(e.b);graph.get(e.b).push(e.a);}}
for(const d of L.decks){const root=L.circulation.nodes.find(n=>n.deck===d.number&&n.kind==='lift'),seen=new Set(root?[root.id]:[]),q=root?[root.id]:[];for(let i=0;i<q.length;i++)for(const n of graph.get(q[i])||[])if(!seen.has(n)){seen.add(n);q.push(n);}
 check('connected lift and stair',!!root&&L.circulation.nodes.some(n=>n.deck===d.number&&n.kind==='stairs'&&seen.has(n.id)),d.number);
 for(const r of [...rooms,...L.cabins].filter(r=>r.deck===d.number))check('door reaches lift and stair',seen.has(r.door.node),r.id);for(const door of rooms.flatMap(r=>r.galleryDoors??[]).filter(g=>g.deck===d.number))check('gallery reaches lift and stair',seen.has(door.node),door.id);
}
for(const r of rooms)for(const f of r.fittingReservations??[]){const p=rectangle(f.center[0],f.center[2],f.width,f.depth);check('bridge fitting floor',p.every(p=>contains(r.polygon,p)),f);check('bridge fitting volume',h.fits(p,f.center[1],f.height),f);check('rigid bridge fitting',f.center[0]===f.source[0]&&f.center[1]===f.source[1]&&f.center[2]===f.source[2],f);}
for(const e of L.circulation.edges)if(!e.vertical){const a=nodeById.get(e.a),b=nodeById.get(e.b);check('level corridor or accessible ramp',Math.abs(a.position[1]-b.position[1])<.001||e.kind==='ramp'&&e.points.every((p,i)=>i===0||Math.abs(p[1]-e.points[i-1][1])<=Math.hypot(p[0]-e.points[i-1][0],p[2]-e.points[i-1][2])/12+.001),e);}
// Check route segments against physical reservations, independently of the routing flood fill.
for(const d of L.decks){
 const obstacles=[...all.filter(r=>r.y<d.y+2&&r.y+r.height>d.y+.1),...d.openings,...L.circulation.stairs.filter(s=>s.deck===d.number&&!d.openings.some(o=>o.id===s.id))],buckets=new Map();
 for(const o of obstacles){const b=bounds(o.polygon);for(let x=Math.floor(b.x0/5);x<=Math.floor(b.x1/5);x++)for(let z=Math.floor(b.z0/5);z<=Math.floor(b.z1/5);z++){const key=x+':'+z;(buckets.get(key)??buckets.set(key,[]).get(key)).push(o);}}
 for(const c of d.corridors)for(let i=1;i<c.points.length;i++){
  const a=c.points[i-1],b=c.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.001)continue;
  const poly=rectangle((a[0]+b[0])/2,(a[1]+b[1])/2,length,c.width,-Math.atan2(b[1]-a[1],b[0]-a[0])),box=bounds(poly),near=new Set();
  for(let x=Math.floor(box.x0/5);x<=Math.floor(box.x1/5);x++)for(let z=Math.floor(box.z0/5);z<=Math.floor(box.z1/5);z++)for(const o of buckets.get(x+':'+z)||[])near.add(o);
  for(const o of near)check('corridor clearance',!intersects(poly,o.polygon),{deck:d.number,corridor:c.id,obstacle:o.id});
  check('corridor hull',h.fits(poly,d.y,2,.1),{deck:d.number,corridor:c.id});
  if(d.number>6&&d.atrium)for(const p of poly)check('corridor floor',!inAtrium(d,p)||L.circulation.bridges.some(b=>b.deck===d.number&&contains(b.polygon,p))||L.circulation.towers.some(b=>b.deck===d.number&&contains(b.polygon,p)),{deck:d.number,corridor:c.id,point:p});
 }
}
// The boolean partition covers the domain exactly: its last, explicitly programmed region is the complement.
for(const d of L.decks){const p=d.programme;check('programmed floor domain',p?.complete&&JSON.stringify(p.domain)===JSON.stringify(d.slab.outline),d.number);check('no unprogrammed floor',p?.zones.at(-1)?.category==='service space'&&JSON.stringify(p.zones.at(-1).polygon)===JSON.stringify(p.domain)&&p.zones.every(z=>z.name&&z.category&&z.excludes),d.number);if(d.number>=7&&d.number<=12)check('no broad residential terraces',!p.zones.some(z=>z.category==='terrace'),d.number);if(d.number>=13&&d.number<=15)check('programmed atrium terraces',p.zones.filter(z=>z.category==='terrace').length===10,d.number);}
for(const r of rooms.filter(r=>r.outer&&(r.deck<=5||r.deck>=16))){
 let contact=0;const section=r.envelope?.[0],poly=section?.polygon??r.polygon;
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(Math.abs(a[0]-b[0])<1e-7)continue;const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,side=Math.sign(z)||1,target=section?h.sectionHalf(x,r.y,section.height,side):h.roomHalf(x,r.y,r.height,side);if(Math.abs(Math.abs(z)-target)<.7)contact+=Math.hypot(a[0]-b[0],a[1]-b[1]);}
 check('outer room reaches hull',contact>=1,{id:r.id,contact});
 if(r.hullGrowth)check('entry fittings anchored',r.envelope.every(s=>r.hullGrowth.sourcePolygon.every(p=>contains(s.polygon,p))),r.id);
 for(const s of r.envelope??[]){let length=0;for(let i=0;i<s.polygon.length;i++){const a=s.polygon[i],b=s.polygon[(i+1)%s.polygon.length],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;if(Math.abs(a[0]-b[0])<1e-7)continue;if(Math.abs(Math.abs(z)-h.sectionHalf(x,r.y+s.rise,s.height,Math.sign(z)||1))<.7)length+=Math.hypot(b[0]-a[0],b[1]-a[1]);}check('full-height facade on room line',length>=1,{id:r.id,rise:s.rise,length});}
}
for(const r of rooms.filter(r=>r.fittingEnvelope))check('command aft fitting envelope',h.fits(r.fittingEnvelope.polygon,r.y,r.fittingEnvelope.height,2.5,0)&&r.fittingEnvelope.polygon.every(p=>contains(r.polygon,p)),r.id);
const regions=new Map(L.circulation.regions.map(r=>[r.id,r]));
for(const d of L.decks)for(const c of d.corridors)for(let i=1;i<c.points.length;i++){
 const a=c.points[i-1],b=c.points[i];check('no diagonal corridors',c.kind==='ring'||Math.abs(a[0]-b[0])<1e-7||Math.abs(a[1]-b[1])<1e-7,{deck:d.number,id:c.id,a,b});
 if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7)continue;const r=regions.get(c.id+'-region-'+i);check('route inside corridor',!!r&&contains(r.polygon,a)&&contains(r.polygon,b),c.id);
}
check('observation lounge at bow',JSON.stringify(byId.get('observation-lounge').frame.origin)===JSON.stringify([190,26.3,0]),'original bow anchor');
check('captain bridge at bow',JSON.stringify(byId.get('d20-bridge-9').frame.origin)===JSON.stringify([177,36.3,0]),'original bow anchor');
for(const r of rooms.filter(r=>r.kind==='garden')){
 check('garden v1 dimensions',r.v1.width===45&&r.v1.depth===38,r.id);
 check('garden area threshold',area(r.polygon)>=.9*1710,{id:r.id,area:area(r.polygon)});
 check('garden source contract',r.contentContract.scale.every(s=>s===1)&&r.contentContract.exceptions.length===0,r.id);
 for(const p of r.components.pieces){check('garden fitting hull clearance',h.fits(p.polygon,p.center[1],p.size[1],2.5,0),{garden:r.id,piece:p.name});check('garden fitting floor',p.polygon.every(q=>contains(r.polygon,q)),{garden:r.id,piece:p.name});}
 for(const g of r.components.links)check('garden gallery links',g.polygon.every(p=>contains(r.envelope.find(s=>Math.abs(s.rise-(g.center[1]-r.y))<1e-7).polygon,p)),g.id);
 for(const g of r.components.landings)check('garden stair landing',g.polygon.every(p=>contains(r.envelope.find(s=>Math.abs(s.rise-(g.center[1]-r.y))<1e-7).polygon,p)),g.id);
 for(const door of r.galleryDoors)check('gallery promenade access',nodeById.has(door.node),door.id);
 if(r.neighborhood===1)for(const name of ['geodesic hammock dome','Haze Maze tower','Terpene Tasting Deck','munchies converger','arcade row with Paws Off treadmill','hammocks','jaguar gate','glossy floor'])check('Hydro-Nip retained piece',r.components.pieces.some(p=>p.name===name),name);
 if(r.neighborhood===10)for(const name of ['koi pond','waterfall','red bridge','blossom bench'])check('blossom retained piece',r.components.pieces.some(p=>p.children?.some(c=>c.name===name)),name);
}
for(let n=1;n<=10;n++)check('garden order',byId.get('commons-'+n).x===-114.5+55*Math.floor((n-1)/2),n);

for(const r of rooms.concat(L.cabins)){
 const l=L.circulation.doorLandings.find(l=>l.door===r.door.id);check('door on corridor landing',!!l&&(L.circulation.ramps.some(p=>p.owner===r.id)||contains(l.polygon,[r.door.center[0],r.door.center[2]])),r.id);
}
for(const l of L.circulation.doorLandings){const d=L.decks[l.deck-1];check('door landing hull',h.fits(l.polygon,d.y,2,.1),l.id);for(const r of all.filter(r=>r.y<d.y+2&&r.y+r.height>d.y+.1)){const poly=r.envelope?.find(s=>d.y-r.y>=s.rise-1e-7&&d.y-r.y<s.rise+s.height)?.polygon??r.polygon;const a=bounds(l.polygon),b=bounds(poly);if(a.x1<b.x0||a.x0>b.x1||a.z1<b.z0||a.z0>b.z1)continue;check('door landing clearance',!intersects(l.polygon,poly),{landing:l.id,room:r.id});}}
const arrival=rooms.filter(r=>r.assembly==='arrival-garden');check('arrival rigid assembly',arrival.length===2&&arrival[0].x-arrival[0].v1.origin[0]===arrival[1].x-arrival[1].v1.origin[0]&&arrival[0].z-arrival[0].v1.origin[2]===arrival[1].z-arrival[1].v1.origin[2],'arrival/garden/opening');
for(const r of rooms.filter(r=>r.kind==='garden')){check('garden galleries',r.components.galleries.length===6&&r.components.galleries.every(g=>g.polygon.every(p=>contains(r.envelope.find(s=>s.rise===g.center[1]-r.y)?.polygon??r.polygon,p))),r.id);check('garden stairs',r.components.stairs.length===48&&r.components.stairs.every(s=>contains(r.polygon,[s.center[0],s.center[2]])),r.id);}
check('reshaped gardens',rooms.filter(r=>r.kind==='garden').length===10&&rooms.filter(r=>r.kind==='garden').every(r=>area(r.polygon)>=1539&&r.height===11.2&&r.assembly),'ten garden assemblies');
await fs.mkdir('output/plan-v2',{recursive:true});await fs.writeFile('output/plan-v2/check-report.json',JSON.stringify({pass:!failures.length,checks,failures,summary:L.summary},null,2));
console.log(JSON.stringify({pass:!failures.length,checks,failures:failures.length,examples:failures.slice(0,60)},null,2));
assert.equal(failures.length,0,'v2 plan failures; see output/plan-v2/check-report.json');

if(process.env.LEO_LAYOUT==='2'){const {spawnSync}=await import('node:child_process');for(const args of [['scripts/check-skin-clip-adaptive-v2.mjs'],['scripts/check-ceiling-coverage-v2.mjs'],['scripts/check-room-slab-voids-fixture-v2.mjs'],['scripts/check-finished-skin-authority-v2.mjs'],['scripts/check-hull-invariants-v2.mjs'],['scripts/check-envelope-contact-v2.mjs'],['scripts/check-envelope-transport-v2.mjs'],['scripts/check-v2-solid-slabs.mjs'],['scripts/check-coplanar-volume-v2.mjs'],['scripts/check-ground-v2.mjs'],['scripts/check-v2-export-topology.mjs'],['scripts/check-exterior-compression-v2.mjs'],['scripts/check-room-mitres-v2.mjs'],['scripts/check-cut-boundary-v2.mjs'],['scripts/check-room-core-query-v2.mjs'],['scripts/check-arena-inlay-v2.mjs'],['scripts/check-bay-access-v2.mjs'],['scripts/run-v2.mjs','prepared-registry-fixture'],['scripts/run-v2.mjs','slab-bake-fixture'],['scripts/run-v2.mjs','facade-check'],['scripts/check-phone-envelopes-v2.mjs'],['scripts/check-phone-skin-shading-v2.mjs'],['scripts/run-v2.mjs','envelope-check'],['scripts/check-lower-lining-returns-v2.mjs'],['scripts/check-void-guards-v2.mjs'],['scripts/check-boarding-guards-v2.mjs'],['scripts/check-guard-support-v2.mjs'],['scripts/check-guard-support-audit-v2.mjs'],['scripts/check-room-guard-support-v2.mjs'],['scripts/check-skin-clearance-fixtures-v2.mjs'],['scripts/check-skin-clearance-v2.mjs'],['scripts/check-prepared-codec-v2.mjs'],['scripts/check-prepared-walk-v2.mjs'],['scripts/check-prepared-transport-v2.mjs'],['scripts/check-prepared-finishes-fixture-v2.mjs'],['scripts/check-collision-visibility-v2.mjs']]){const p=spawnSync(process.execPath,['--max-old-space-size=11000',...args],{stdio:'inherit',windowsHide:true});if(p.status!==0)throw Error('Converted hull gate failed: '+args.join(' '));}}
