import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createCatTree,TREE,PLATFORMS,RING,BRIDGES,DENS,FOOT_DEN,rampY,rampAngle,rampIn,rampOut,trunkR} from '../src/walk/cat-tree.js';
import {BODY,Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {groundMesh} from '../src/v2/ground.js';
import {findRestSpots,solidSpots} from '../src/walk/rest.js';

// The Great Cat Tree (src/walk/cat-tree.js) on its own, with the Deck 6 floor and the bow cafes' slab edges round it:
// budget, the walk from the island to every platform, the ring and each bridge's far end, and no unguarded drop over 1 m.
// The mode variants are plain copies: the tree builds its own geometry in every mode.
for(const v of ['authoring','prepared','public'])assert.equal(fs.readFileSync(`src/walk/cat-tree.${v}.js`,'utf8'),fs.readFileSync('src/walk/cat-tree.js','utf8'),`cat-tree.${v}.js differs from cat-tree.js`);
const tree=createCatTree(null);assert(tree,'tree built');
let tris=0,draws=0;tree.group.traverse(o=>{if(!o.isMesh||o.material.visible===false)return;const lod=o.parent?.name;if(lod==='Great_cat_tree_far')return;draws++;const n=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;tris+=o.isInstancedMesh?n*o.count:n;});
let farTris=0;tree.group.getObjectByName('Great_cat_tree_far').traverse(o=>{if(o.isMesh)farTris+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
const leaves=tree.group.getObjectByName('Cat_tree_leaves');console.log(`leaves ${leaves.count}`);console.log(`near: ${draws} draws, ${Math.round(tris).toLocaleString()} triangles · far: ${Math.round(farTris).toLocaleString()} triangles · seats ${tree.seats.children.length}`);
assert(tris<=150000,'over the 150k triangle budget');assert(draws<=150,'over the draw budget');

// The surroundings: floor, the three cafes' aft ledges (void edge to cafe face), the cafe walls and the Deck 16 slab.
const env=new T.Group(),box=(name,x0,x1,y0,y1,z0,z1)=>{const m=new T.Mesh(new T.BoxGeometry(x1-x0,y1-y0,z1-z0));m.name=name;m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);env.add(m);};
box('Deck_floor',140,260,TREE.floor-.3,TREE.floor,-70,70);
for(const [n,edge,face] of [[9,224.5,225],[12,211,211.5],[15,197,197.5]]){const y=TREE.floor+4*(n-6);box('Deck_floor',edge,face+4,y-.3,y,-18,18);box('Cafe_wall',face,face+.2,y,y+3.5,-18,18);}
box('Deck_slab',148,260,20.3,20.6,-70,70);
env.updateMatrixWorld(true);
const col=new Colliders();col.addStatic(env,()=>true);col.addStatic(tree.solid,()=>true);col.commit();
const ground=new Colliders();tree.solid.updateMatrixWorld(true);ground.addStatic(env,o=>o.isMesh&&groundMesh(o));ground.addStatic(tree.solid,o=>o.isMesh&&groundMesh(o));ground.commit();

const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3(),MIN_NY=Math.cos(BODY.maxSlope*Math.PI/180);
const floorAt=(x,y,z,up=.42,down=.9)=>{ray.origin.set(x,y+up,z);const h=ground.raycast(ray,up+down);return h&&h.normal.y>.6?h.point.y:null;};
const room=(x,y,z)=>{seg.start.set(x,y+.75,z);seg.end.set(x,y+1.65,z);return !col.overlaps(seg,.35);};
const near=(x,z)=>Math.hypot(x-TREE.x,z-TREE.z)<TREE.island+3||(Math.abs(z)<2&&x>TREE.x&&x<226);
// start on the deck floor just off the island, where the boardwalk comes in
const entry=(()=>{const y=rampY(0),a=rampAngle(0),r=(rampIn(y)+rampOut(y))/2,b=rampAngle(.02),m=new T.Vector3(TREE.x+Math.cos(a)*r,0,TREE.z+Math.sin(a)*r),n=new T.Vector3(TREE.x+Math.cos(b)*r,0,TREE.z+Math.sin(b)*r),t=n.sub(m).normalize();return m.addScaledVector(t,-(TREE.island+1.5));})();
const start=[entry.x,TREE.floor,entry.z],D=.25,seen=new Map(),queue=[start],drops=[];
const key=([x,y,z])=>`${Math.round(x/D)},${Math.round(y/.2)},${Math.round(z/D)}`;seen.set(key(start),start);
for(let i=0;i<queue.length;i++){const [x,y,z]=queue[i];
 for(const [dx,dz] of [[D,0],[-D,0],[0,D],[0,-D]]){const nx=x+dx,nz=z+dz;if(!near(nx,nz))continue;
  const ny=floorAt(nx,y,nz);
  // stepping off an edge: as in scripts/v2-walk.mjs, the first ground below must be standable, or the walker falls out of the ship
  if(ny===null){ray.origin.set(nx,y+.42,nz);let h=ground.raycast(ray,60);if(h&&h.normal.y<MIN_NY)h=null;if(room(nx,y,nz)&&(!h||y-h.point.y>1))drops.push([nx,y,nz,h?+(y-h.point.y).toFixed(2):'∞']);continue;}
  if(!room(nx,ny,nz))continue;const p=[nx,ny,nz],k=key(p);if(!seen.has(k)){seen.set(k,p);queue.push(p);}}}
console.log(`flood: ${queue.length.toLocaleString()} spots reached`);
const reached=(x,y,z,r=1)=>queue.some(p=>Math.abs(p[1]-y)<.3&&Math.hypot(p[0]-x,p[2]-z)<r);
const goals=[...PLATFORMS.map(p=>[`D${p.deck} platform`,p.x,p.y,p.z]),['D15 ring',TREE.x+Math.cos(RING.angle+Math.PI)*6.5,RING.y,TREE.z+Math.sin(RING.angle+Math.PI)*6.5],...BRIDGES.map(b=>[`D${b.deck} bridge end`,b.x1-.4,b.y,0]),...DENS.map(d=>[`D${d.deck} den`,TREE.x+Math.cos(d.a)*(d.front-1),d.y,TREE.z+Math.sin(d.a)*(d.front-1)]),['foot den',TREE.x+Math.cos(FOOT_DEN.a)*(trunkR(TREE.islandTop)+1.4),TREE.islandTop,TREE.z+Math.sin(FOOT_DEN.a)*(trunkR(TREE.islandTop)+1.4)]];
let failed=0;for(const [name,x,y,z] of goals){const ok=reached(x,y,z);if(!ok)failed++;console.log(`${ok?'PASS':'FAIL'} ${name} (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);}
const uniq=new Map();for(const d of drops)uniq.set(`${Math.round(d[0])},${Math.round(d[1])},${Math.round(d[2])}`,d);
console.log(`unguarded drops over 1 m: ${uniq.size}`);for(const d of [...uniq.values()].slice(0,25))console.log('  drop at',d.slice(0,3).map(v=>v.toFixed(1)).join(', '),'height',d[3]);
assert.equal(failed,0,'unreached goals');assert.equal(uniq.size,0,'unguarded drops');
// Seats: as in scripts/v2-walk.mjs, each cushion the colliders hold up has somewhere reached to stand within 1.6 m
// (1.5 here, for its coarser grid), from 1.5 m below the seat to just above it.
tree.seats.updateMatrixWorld(true);const seatSpots=solidSpots(findRestSpots(tree.seats),col),farSeats=seatSpots.filter(s=>!queue.some(p=>Math.hypot(p[0]-s.point.x,p[2]-s.point.z)<=1.5&&p[1]>=s.height-1.5&&p[1]<=s.height+.05));
console.log(`seats with somewhere to stand: ${seatSpots.length-farSeats.length}/${seatSpots.length}`);for(const s of farSeats.slice(0,12))console.log('  no standing room near seat at',[s.point.x,s.height,s.point.z].map(v=>v.toFixed(1)).join(', '));
assert.equal(farSeats.length,0,'seats out of reach');

// The walk's own controller climbs the ramp from the boardwalk to Deck 15, then crosses each bridge from its platform.
const ctl=new Controller(col);
const mid=s=>{const y=rampY(s),a=rampAngle(s),r=(rampIn(y)+rampOut(y))/2;return new T.Vector3(TREE.x+Math.cos(a)*r,y,TREE.z+Math.sin(a)*r);};
const go=(t,tol=.45,max=900)=>{let i=0;for(;i<max;i++){const d=new T.Vector3(t.x-ctl.position.x,0,t.z-ctl.position.z);if(d.length()<tol)break;d.setLength(Math.min(3.2,d.length()*4+.5));ctl.step(1/60,d,false);}return i<max;};
const settle=()=>{for(let i=0;i<40;i++)ctl.step(1/60,new T.Vector3(),false);};
const m0=mid(0),tang=mid(.02).sub(m0).setY(0).normalize();ctl.position.copy(m0).addScaledVector(tang,-(TREE.island-2.2)).setY(TREE.islandTop+.3);ctl.velocity.set(0,0,0);settle();
assert(Math.abs(ctl.position.y-TREE.islandTop)<.1,'walker not standing on the island: '+ctl.position.y);
let climbed=true;go(m0);for(let s=.03;s<=9.0001;s+=.03){const t=mid(s);if(!go(t)||t.y-ctl.position.y>.6){climbed=false;console.log('FAIL ramp climb at s',s.toFixed(2),ctl.position.toArray().map(v=>v.toFixed(2)).join(','));break;}}
if(climbed){settle();console.log(`PASS controller climbs the ramp to Deck 15 (y ${ctl.position.y.toFixed(2)})`);}
for(const b of BRIDGES){const p=PLATFORMS.find(p=>p.deck===b.deck),from=p?new T.Vector3(p.x,p.y,p.z):new T.Vector3(TREE.x+6,b.y,0);ctl.position.copy(from).setY(b.y+.3);ctl.velocity.set(0,0,0);settle();
 const ok=go(new T.Vector3(b.x0+1,b.y,0))&&go(new T.Vector3(b.x1-.5,b.y,0));settle();const fine=ok&&Math.abs(ctl.position.y-b.y)<.15;if(!fine)climbed=false;
 console.log(`${fine?'PASS':'FAIL'} controller crosses the Deck ${b.deck} bridge to x ${ctl.position.x.toFixed(1)} at y ${ctl.position.y.toFixed(2)}`);}
// and walks from each landing into its den, and from the island into the den at the foot
for(const d of DENS){const out=new T.Vector3(Math.cos(d.a),0,Math.sin(d.a)),from=new T.Vector3(TREE.x,d.y,TREE.z).addScaledVector(out,rampIn(d.y)+1.35),to=new T.Vector3(TREE.x,d.y,TREE.z).addScaledVector(out,d.front-1);
 ctl.position.copy(from).setY(d.y+.3);ctl.velocity.set(0,0,0);settle();const ok=go(to,.3)&&Math.abs(ctl.position.y-d.y)<.15;settle();if(!ok)climbed=false;
 console.log(`${ok?'PASS':'FAIL'} controller walks into the Deck ${d.deck} den (${ctl.position.distanceTo(new T.Vector3(TREE.x,d.y,TREE.z)).toFixed(1)} m from the axis)`);}
{const out=new T.Vector3(Math.cos(FOOT_DEN.a),0,Math.sin(FOOT_DEN.a)),base=new T.Vector3(TREE.x,TREE.islandTop,TREE.z),to=base.clone().addScaledVector(out,trunkR(TREE.islandTop)+1.4);
 ctl.position.copy(base).addScaledVector(out,9.6).setY(TREE.islandTop+.3);ctl.velocity.set(0,0,0);settle();const ok=go(to,.3);if(!ok)climbed=false;
 console.log(`${ok?'PASS':'FAIL'} controller walks into the den at the foot`,ok?'':'stopped at '+ctl.position.toArray().map(v=>v.toFixed(2))+' r '+Math.hypot(ctl.position.x-TREE.x,ctl.position.z-TREE.z).toFixed(2)+' target r '+Math.hypot(to.x-TREE.x,to.z-TREE.z).toFixed(2)+' start '+FOOT_DEN.u.toFixed(2));}
assert(climbed,'controller walk failed');
console.log('PASS cat tree');
