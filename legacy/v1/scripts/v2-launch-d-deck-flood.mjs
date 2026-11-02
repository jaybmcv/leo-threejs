import {gotoFloor} from '../src/v2/goto-floor.js';
import fs from 'node:fs/promises';
import * as T from 'three';
import layout from 'v2-layout';
import {preparedV2} from './v2-world.mjs';
import {installFloodIndex} from './flood-spatial-index-v2.mjs';
import {BODY} from '../src/walk/collision.js';
import {solidSpots,spotIndex} from '../src/walk/rest.js?legacy';
import {bounds,contains} from '../src/plan/geometry-v2.js';
const {prepared,artifact}=await preparedV2({artifact:true}),col=prepared.colliders;
installFloodIndex(col);installFloodIndex(col.v2Ground);
const rooms=layout.rooms.filter(r=>r.launchD),ids=new Set(rooms.map(r=>r.id)),rests=prepared.restSpots.filter(p=>ids.has(p.room)),supported=new Set(solidSpots(rests,col)),index=spotIndex(prepared.restSpots);
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3(),R=BODY.radius,H=BODY.height,STEP=BODY.step,G=.35;
const probe=(x,y,z)=>{ray.origin.set(x,y+STEP+.05,z);const h=col.raycastGround(ray,2*STEP+.1);return h&&h.normal.y>=Math.cos(BODY.maxSlope*Math.PI/180)?h.point.y:null;};
const floor=(x,y,z)=>{const c=probe(x,y,z);if(c!==null&&Math.abs(c-y)<=STEP)return c;let best=c;for(const[dx,dz]of[[.18,0],[-.18,0],[0,.18],[0,-.18]]){const q=probe(x+dx,y,z+dz);if(q!==null&&(best===null||q>best))best=q;}return best!==null&&Math.abs(best-y)<=STEP+.01?best:null;};
const stands=(x,y,z)=>{seg.start.set(x,y+STEP+R,z);seg.end.set(x,y+H-R,z);return !col.overlaps(seg,R);};

const rows=[],approaches=[],roomRows=[];
for(const deck of [1,2,3,4,5,16,17,18,19]){const d=layout.decks[deck-1],owned=rooms.filter(r=>r.deck===deck),sx=132,sz=0,q=[],seen=new Set(),failed=new Set(),cells=new Map();
 const key=(x,z)=>Math.round((x-sx)/G)+','+Math.round((z-sz)/G),push=(x,y,z)=>{const k=key(x,z);if(seen.has(k))return;seen.add(k);q.push([x,y,z]);const ck=Math.floor(x)+','+Math.floor(z);if(!cells.has(ck))cells.set(ck,[]);cells.get(ck).push([x,y,z]);};
 const y=floor(sx,d.y,sz);if(y!==null&&stands(sx,y,sz))push(sx,y,sz);
 let drops=0;for(let i=0;i<q.length&&i<600000;i++){const[x,y,z]=q[i];for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const xx=x+dx*G,zz=z+dz*G,k=key(xx,zz);if(xx< -137||xx>260||zz< -90||zz>90||seen.has(k)||failed.has(k))continue;const yy=floor(xx,y,zz);if(yy===null||yy<d.y-.2||yy>d.y+.6||!stands(xx,yy,zz)){failed.add(k);continue;}if(y-yy>1)drops++;push(xx,yy,zz);}if(i>0&&i%100000===0)console.log('Deck',deck,'visited',i);}
 const near=(p,distance=1.45)=>{const out=[];for(let x=Math.floor(p[0]-distance);x<=Math.floor(p[0]+distance);x++)for(let z=Math.floor(p[2]-distance);z<=Math.floor(p[2]+distance);z++)for(const q of cells.get(x+','+z)||[])if(Math.hypot(q[0]-p[0],q[2]-p[2])<=distance)out.push(q);return out;};
 for(const r of owned){const n=r.door.outward,inside=[r.door.center[0]-n[0]*1.4,r.y,r.door.center[2]-n[1]*1.4],seatRows=rests.filter(s=>s.room===r.id).map(s=>{const candidates=near(s.point.toArray()).sort((a,b)=>Math.abs(Math.hypot(a[0]-s.point.x,a[2]-s.point.z)-1.25)-Math.abs(Math.hypot(b[0]-s.point.x,b[2]-s.point.z)-1.25));let approach=null;for(const a of candidates){const p=new T.Vector3(...a),f=s.point.clone().sub(p);f.y=0;f.normalize();if(gotoFloor(col,a).ok&&index.pick(p,f)?.id===s.id){approach=a;break;}}if(approach)approaches.push({id:s.id,room:r.id,at:approach});return{id:s.id,supported:supported.has(s),reachable:candidates.length>0,pickable:!!approach,at:s.point.toArray()};});const row={id:r.id,deck,name:r.name,entryReached:near(inside,.6).length>0,rests:seatRows.length,usable:seatRows.filter(s=>s.supported&&s.reachable&&s.pickable).length,failedSeats:seatRows.filter(s=>!s.supported||!s.reachable||!s.pickable)};row.pass=row.entryReached&&row.rests>0&&row.usable===row.rests;roomRows.push(row);}
 let openToSpace=0,roofSamples=0;const up=new T.Ray(new T.Vector3(),new T.Vector3(0,1,0));for(let i=0;i<q.length;i+=29){up.origin.set(q[i][0],q[i][1]+1,q[i][2]);roofSamples++;if(!col.raycast(up,200))openToSpace++;}
 const rr=roomRows.filter(r=>r.deck===deck),row={deck,seed:[sx,d.y,sz],bounds:[-137,260,-90,90,d.y-.2,d.y+.6],positions:q.length,capped:q.length>=600000,rooms:rr.length,reachableRooms:rr.filter(r=>r.entryReached).length,seats:rr.reduce((n,r)=>n+r.rests,0),usable:rr.reduce((n,r)=>n+r.usable,0),roofSamples,openToSpace,dropsOver1m:drops,pass:q.length>0&&q.length<600000&&!openToSpace&&!drops&&rr.every(r=>r.pass)};rows.push(row);console.log(JSON.stringify(row));await fs.writeFile('output/launch-d/deck-flood-progress.json',JSON.stringify({decks:rows,rooms:roomRows},null,2));
}
const report={status:rows.every(r=>r.pass)?'PASS':'FAIL',artifact,at:new Date().toISOString(),scope:'Forward regions only (x >= -137) on the nine changed decks, seeded at the forward lift lobby, with actual prepared public capsule collisions. No full ship flood.',rows,rooms:roomRows,approaches,seats:rests.length,usable:roomRows.reduce((n,r)=>n+r.usable,0),openToSpace:rows.reduce((n,r)=>n+r.openToSpace,0)};await fs.writeFile('output/launch-d/walk-target.json',JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
