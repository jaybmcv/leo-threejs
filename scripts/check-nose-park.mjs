import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {phase6Programme} from '../src/v2/phase6-programme.js';
import {createCatTree,createNosePark,TREE,PARK,PARK_BRIDGE,HILLS,PAVILION,parkHalfWidth} from '../src/walk/cat-tree.js';
import {BODY,Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {groundMesh} from '../src/v2/ground.js';
import {findRestSpots,solidSpots} from '../src/walk/rest.js';

// The Toybox Park on the atrium nose floor (createNosePark in src/walk/cat-tree.js), walked with the rules of
// scripts/v2-walk.mjs: from the lift tower, every goal reached, no step off an edge onto nothing standable or more than
// 1 m down, every seat with somewhere to stand, the Voyage Commons zone reached, and the walk Controller over the bridge.
const park=createNosePark(null),tree=createCatTree(null),MIN_NY=Math.cos(BODY.maxSlope*Math.PI/180),y0=PARK.y;
let tris=0,draws=0;park.group.traverse(o=>{if(o.isMesh&&o.material.visible!==false&&o.parent?.name!=='Toybox_park_far'){draws++;tris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
console.log(`park near: ${draws} draws, ${Math.round(tris).toLocaleString()} triangles · seats ${park.seats.children.filter(o=>o.name!=='Bench_back').length} · trees ${park.trees}`);
assert(tris<=110000,'over the park budget of 110k triangles');assert(draws<=12,'over the park draw budget');

// Walk surfaces face up and stay gentle.
park.solid.updateMatrixWorld(true);let steepest=0;
park.solid.traverse(o=>{if(!o.isMesh||!groundMesh(o))return;const p=o.geometry.attributes.position,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);const n=new T.Triangle(a,b,c).getNormal(new T.Vector3());if(/walkway/.test(o.name)){assert(n.y>0,`${o.name} has a downward-facing triangle at ${a.toArray().map(v=>v.toFixed(1))}`);steepest=Math.max(steepest,Math.acos(n.y)*180/Math.PI);}}});
console.log(`steepest walkway slope ${steepest.toFixed(1)} degrees`);assert(steepest<30,'a park walkway is steeper than 30 degrees');

// The world: the nose floor (its atrium outline, cabin fronts as walls beyond), the lift tower, the Voyage Commons
// fit-out from the programme, the tree and the park.
const env=new T.Group(),box=(name,x0,x1,ya,yb,z0,z1)=>{const m=new T.Mesh(new T.BoxGeometry(x1-x0,yb-ya,z1-z0));m.name=name;m.position.set((x0+x1)/2,(ya+yb)/2,(z0+z1)/2);env.add(m);};
box('Deck_floor',140,240,y0-.3,y0,-70,70);
for(let x=146;x<238;x+=2){const h=parkHalfWidth(x+1);for(const s of [-1,1])box('Cabin_front_wall',x,x+2,y0,y0+3,s>0?h:-h-.3,s>0?h+.3:-h);}
box('Lift_tower_wall',122.6,146.6,y0,y0+20,-9,9);box('Cafe_wall',238,240,y0,y0+3.5,-18,-1.4);box('Cafe_wall',238,240,y0,y0+3.5,1.4,18);
for(const p of phase6Programme(layout).parts.filter(p=>p.room==='atrium6-commons'&&!p.noCollide))box('Commons_'+p.part,p.at[0]-p.size[0]/2,p.at[0]+p.size[0]/2,p.at[1]-p.size[1]/2,p.at[1]+p.size[1]/2,p.at[2]-p.size[2]/2,p.at[2]+p.size[2]/2);
env.updateMatrixWorld(true);tree.solid.updateMatrixWorld(true);
const col=new Colliders(),ground=new Colliders();for(const r of [env,tree.solid,park.solid]){col.addStatic(r,()=>true);ground.addStatic(r,o=>o.isMesh&&groundMesh(o));}col.commit();ground.commit();
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3(),STEP=BODY.step,R=BODY.radius,H=BODY.height;
const floorAt=(x,y,z)=>{ray.origin.set(x,y+STEP+.05,z);const h=ground.raycast(ray,2*STEP+.15);return h&&h.normal.y>=MIN_NY&&Math.abs(h.point.y-y)<=STEP?h.point.y:null;};
const stands=(x,y,z)=>{seg.start.set(x,y+STEP+R,z);seg.end.set(x,y+H-R,z);return !col.overlaps(seg,R);};
// the floor only: the tree above the island has its own check (check-cat-tree.mjs)
const inNose=(x,z,y=y0)=>x>146.8&&x<238&&Math.abs(z)<parkHalfWidth(x)&&y<y0+2.5;
const G=.35,start=[147.6,y0,0],seen=new Map(),queue=[start],drops=[];const key=([x,y,z])=>`${Math.round(x/G)},${Math.round(y/.2)},${Math.round(z/G)}`;seen.set(key(start),start);
for(let i=0;i<queue.length;i++){const [x,y,z]=queue[i];
 for(const [dx,dz] of [[G,0],[-G,0],[0,G],[0,-G]]){const nx=x+dx,nz=z+dz;if(!inNose(nx,nz,y))continue;const ny=floorAt(nx,y,nz);
  if(ny===null){if(!stands(nx,y,nz))continue;ray.origin.set(nx,y+STEP,nz);let h=ground.raycast(ray,60);if(h&&h.normal.y<MIN_NY)h=null;if(!h||y-h.point.y>1)drops.push([nx,y,nz,h?+(y-h.point.y).toFixed(2):'void']);else if(y-h.point.y>STEP){const p=[nx,h.point.y,nz],k=key(p);if(!seen.has(k)&&stands(...p)){seen.set(k,p);queue.push(p);}}continue;}
  if(!stands(nx,ny,nz))continue;const p=[nx,ny,nz],k=key(p);if(!seen.has(k)){seen.set(k,p);queue.push(p);}}}
console.log(`flood: ${queue.length.toLocaleString()} spots reached`);
const cells=new Map();for(const p of queue){const k=Math.floor(p[0])+','+Math.floor(p[2]);(cells.get(k)||cells.set(k,[]).get(k)).push(p);}
const reached=(x,y,z,r=.8,below=.4,above=.4)=>{for(let i=Math.floor(x-r);i<=Math.floor(x+r);i++)for(let j=Math.floor(z-r);j<=Math.floor(z+r);j++)for(const p of cells.get(i+','+j)||[])if(Math.hypot(p[0]-x,p[2]-z)<=r&&p[1]>=y-below&&p[1]<=y+above)return true;return false;};
const goals=[['tree island',TREE.x-TREE.island+1,TREE.islandTop,0],['bow cafe door',237.2,y0,0],['bridge crown',PARK_BRIDGE.x,y0+PARK_BRIDGE.rise+.14,(PARK_BRIDGE.z0+PARK_BRIDGE.z1)/2],['far end of the bridge',PARK_BRIDGE.x,y0,PARK_BRIDGE.z1+2],
 ...HILLS.map(([x,z,r,h],i)=>[`hillock ${i+1} top`,x,y0+.03+h,z]),['pavilion table',(PAVILION.x0+PAVILION.x1)/2,y0,PAVILION.z0+.6],['port promenade',190,y0,-(parkHalfWidth(190)-1.5)],['starboard promenade',190,y0,parkHalfWidth(190)-1.5]];
let failed=0;for(const [name,x,y,z] of goals){const ok=reached(x,y,z,1.2,.5,.5);if(!ok)failed++;console.log(`${ok?'PASS':'FAIL'} ${name} (${x.toFixed(1)}, ${y.toFixed(2)}, ${z.toFixed(1)})`);}
const uniq=new Map();for(const d of drops)uniq.set(`${Math.round(d[0])},${Math.round(d[1])},${Math.round(d[2])}`,d);
console.log(`unguarded drops over 1 m or onto nothing standable: ${uniq.size}`);for(const d of [...uniq.values()].slice(0,20))console.log('  at',d.slice(0,3).map(v=>v.toFixed(1)).join(', '),'drop',d[3]);
// Seats: somewhere reached within 1.6 m (1.5 here), from 1.5 m below the seat to just above it.
park.seats.updateMatrixWorld(true);const spots=solidSpots(findRestSpots(park.seats),col),far=spots.filter(s=>!reached(s.point.x,s.height-.2,s.point.z,1.5,1.3,.25));
console.log(`park seats with somewhere to stand: ${spots.length-far.length}/${spots.length} (of ${findRestSpots(park.seats).length} declared)`);for(const s of far)console.log('  no standing room near seat at',[s.point.x,s.height,s.point.z].map(v=>v.toFixed(1)).join(', '));
// The Voyage Commons zone (atrium-v2.js): at least 80% of its standable 2 m floor samples reached, as v2-walk asks.
let st=0,ok=0;for(let x=151;x<=173;x+=2)for(let z=-17;z<=17;z+=2){const fy=floorAt(x,y0,z);if(fy===null||!stands(x,fy,z))continue;st++;if(reached(x,fy,z,.6,.6,.6))ok++;}
console.log(`Voyage Commons floor samples reached: ${ok}/${st}`);
assert.equal(failed,0,'unreached goals');assert.equal(uniq.size,0,'unguarded drops');assert.equal(far.length,0,'park seats out of reach');assert(spots.length>=10,'park seats lost');assert(ok/st>=.95,'Voyage Commons floor cut off');

// The walk Controller walks from the tower over the pond bridge and back down, and round to the bow cafe.
const ctl=new Controller(col);const go=(x,z,max=1600)=>{let i=0;for(;i<max;i++){const d=new T.Vector3(x-ctl.position.x,0,z-ctl.position.z);if(d.length()<.5)break;d.setLength(Math.min(3.2,d.length()*4+.5));ctl.step(1/60,d,false);}return i<max;};
ctl.position.set(150,y0+.3,0);ctl.velocity.set(0,0,0);for(let i=0;i<40;i++)ctl.step(1/60,new T.Vector3(),false);
const route=[[172,0],[TREE.x-PARK.ring*.7,PARK.ring*.7],[PARK_BRIDGE.x,17.8],[PARK_BRIDGE.x,(PARK_BRIDGE.z0+PARK_BRIDGE.z1)/2],[PARK_BRIDGE.x,PARK_BRIDGE.z1+2],[PARK_BRIDGE.x,17.8],...[70,40,10].map(d=>[TREE.x+Math.cos(d*Math.PI/180)*PARK.ring,TREE.z+Math.sin(d*Math.PI/180)*PARK.ring]),[207,0],[236,0]];let top=-Infinity,walked=true;
for(const [x,z] of route){if(!go(x,z)){walked=false;console.log('FAIL controller stuck going to',x,z,'at',ctl.position.toArray().map(v=>v.toFixed(2)).join(','));break;}top=Math.max(top,ctl.position.y);}
console.log(`${walked?'PASS':'FAIL'} controller walks tower → ring → over the bridge (top ${(top-y0).toFixed(2)} m) → bow cafe, ends at y ${(ctl.position.y-y0).toFixed(2)}`);
assert(walked&&Math.abs(ctl.position.y-y0)<.15&&top-y0>PARK_BRIDGE.rise*.8,'controller route');
console.log('PASS Toybox Park');
