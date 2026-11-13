import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import layout from '../src/plan/selected-layout.js';
import {createGardenCommons} from '../src/model.js';
import {resolveRoomFrames,frame} from '../src/plan/rooms.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {createLoungeAquarium,AQUARIUM} from '../src/walk/lounge-aquarium.js';
import {createJaguarGate} from '../src/walk/jaguar-gate.js';
import {createVault} from '../src/walk/vault.js';
import {createArcade,arcadeTreadmill} from '../src/walk/arcade.js';
import {createVaultLift} from '../src/walk/vault-lift.js';
import {prepareClubhouseAccess} from '../src/v2/clubhouse-access.js';
import {Colliders} from '../src/walk/collision.js';
import {SWIM,swimWorld,limitSwim,gemNear} from '../src/walk/aquarium-treasure/layout.js';
import {featurePlaces} from '../src/v2/goto-features.js';
import {mesh,polygonGeometry} from '../src/v2/geometry.js';
import {createTreasureBoard} from '../server/aquarium-treasure.mjs';

// Real source furniture, maze, gallery guards and activity colliders, without a full ship build.
installWalkCanvas(createCanvas);
const r=layout.rooms.find(r=>r.id==='commons-1'),root=new T.Group(),source=createGardenCommons(1);
root.add(source.root);resolveRoomFrames(root);
const structure=new T.Group();root.add(structure);const ship={root,inside:root,cutaway:new Set()};buildRoomShell(ship,r,structure);
// The inter-garden gap keeps its existing Deck 17 slab in the full ship.
mesh(root,'Deck_slab',polygonGeometry([[-88,-61.9],[-86,-61.9],[-86,-24],[-88,-24]],[],r.y,.24));
// The lounge's own Deck 17 floor: in the full ship visitors stand on the deck slab under the room, which the room shell
// doesn't draw for the garden commons. Without it every Deck 17 route found no floor (R5 failed at its first point with
// layout 2 at every commit back to 0802eedf). Any slab opening inside the room stays open.
{const deck=layout.decks.find(d=>d.number===r.deck),box=p=>[Math.min(...p.map(q=>q[0])),Math.max(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[1]))],b=box(r.polygon);
 const openings=deck.slab.holes.map(h=>h.polygon).filter(p=>{const o=box(p);return o[1]>b[0]&&o[0]<b[1]&&o[3]>b[2]&&o[2]<b[3];});
 mesh(root,'Lounge_deck_slab',polygonGeometry(r.polygon,openings,r.y,.24));}
mesh(root,'Door_landing',polygonGeometry([[-113.05,-24],[-111.95,-24],[-111.95,-23.2],[-113.05,-23.2]],[],r.y,.24));
const col=new Colliders(),f=frame(r.id),m=new T.Matrix4().makeTranslation(...f.origin).multiply(new T.Matrix4().makeRotationY(f.yaw)).multiply(new T.Matrix4().makeScale(1,1,f.mirror?-1:1)).multiply(new T.Matrix4().makeTranslation(-132,-24.3,-27));
const boxes=[];createLoungeAquarium(ship,m,{addStatic:g=>{boxes.push(g);col.addStatic(g,()=>true);}});
const tank=new T.Box3().setFromObject(boxes[0],true),close=(a,b)=>assert(Math.abs(a-b)<.002,`${a} != ${b}`);
[-140.9,24.3,-27.98].forEach((v,i)=>close(tank.min.getComponent(i),v));[-88.1,35.5,-24.05].forEach((v,i)=>close(tank.max.getComponent(i),v));
const jaguar=createJaguarGate(),arcade=createArcade(),vault=createVault(ship),lift=createVaultLift(col);prepareClubhouseAccess(ship,lift);
col.addStatic(root);
for(const o of [jaguar.group,arcade.group,vault.group,lift.group])root.add(o);
for(const o of [jaguar.solid,arcade.solid,vault.solid,lift.solid])col.addStatic(o,()=>true);
col.commit();
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),segment=new T.Line3();
const clear=([x,y,z])=>{ray.origin.set(x,y+.42,z);const hit=col.raycast(ray,.85);segment.start.set(x,y+.75,z);segment.end.set(x,y+1.65,z);return !!hit&&hit.normal.y>.6&&Math.abs(hit.point.y-y)<.1&&!col.overlaps(segment,.35);};
const route=(name,points)=>{let count=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.ceil(new T.Vector3(...a).distanceTo(new T.Vector3(...b))/.1);for(let j=0;j<=n;j++){const p=a.map((v,k)=>v+(b[k]-v)*j/n);assert(clear(p),name+' blocked at '+JSON.stringify(p));count++;}}console.log('PASS',name,count,'capsule probes');};
route('R1 maze lower exit',[[-132.25,28.3,-37.8],[-139,28.3,-37.8],[-139,28.3,-30],[-140.5,28.3,-30]]);
route('R2 lift Deck 18',[[-89.8,28.3,-48.9],[-86.53,28.3,-48.9]]);
for(const flight of [0,1]){
 const steps=r.components.stairs.filter(t=>t.id.includes('-tread-'+flight+'-')).sort((a,b)=>a.center[1]-b.center[1]);assert.equal(steps.length,24);
 for(let i=1;i<steps.length;i++){const a=steps[i-1].center,b=steps[i].center;for(let k=0;k<=10;k++){const x=a[0]+(b[0]-a[0])*k/10,z=a[2]+(b[2]-a[2])*k/10;ray.origin.set(x,a[1]+.4,z);const hit=col.raycast(ray,.85);assert(hit&&clear([x,hit.point.y,z]),'Stair clearance '+steps[i].id);}}
 const last=steps.at(-1).center;route('Stair '+flight+' gallery arrival',[last,[last[0],last[1],last[2]+(flight?1:-1)*.4]]);
}
route('R3 treasure gallery',[[-93.1,32.3,-47],[-93.1,32.3,-29],[-115.7,32.3,-29]]);
const floorRay=new T.Raycaster(new T.Vector3(-93,32.5,-28.7),new T.Vector3(0,-1,0),0,.4),floorHits=floorRay.intersectObject(structure,true).filter(h=>h.object.name==='V2_garden_gallery');assert.equal(new Set(floorHits.map(h=>h.object.uuid)).size,1,'Gallery and link must share one floor surface');
route('R4 maze upper exit',[[-125.8,32.3,-29],[-126.75,32.3,-29]]);
route('R5 clubhouse and ground lift',[[-90.8,24.3,-45.8],[-86.53,24.3,-45.8],[-86.53,24.3,-49]]);
route('R6 jaguar to dome',[[-112.5,24.3,-23.5],[-112.5,24.3,-28.8],[-113.3,24.3,-29.1],[-113.3,24.3,-32.7],[-112.5,24.3,-32.7],[-112.5,24.3,-34]]);
for(const y of [28.3,32.3])route('R7 aft door '+y,[[-140.6,y,-30],[-138.2,y,-30]]);
// Walk below the retired side strips from the reported view, and below the rear strip.
route('R8 old side lights',[[-134.36,24.3,-38.2],[-135.41,24.3,-43.6],[-134.36,24.3,-38.2]]);
route('R9 old rear light',[[-121,24.3,-57],[-121,24.3,-59.5],[-121,24.3,-57]]);
// The lounge floor can't make solids walkable: the aquarium's front glass stays blocked (the tank itself is swimmable
// water), while the floor 2 m in front of it is clear.
assert(!clear([-100,24.3,-28])&&!clear([-120,24.3,-28]),'The aquarium glass stays solid over the lounge floor');
assert(clear([-100,24.3,-30]),'The floor in front of the aquarium is walkable');console.log('PASS aquarium glass blocks, the floor before it is clear');
// Reach both floors from the rotated ground door, staying inside the tower.
const queue=[[-129.5,24.3,-41.4]],seen=new Set(),goals=[[-132.25,28.3,-37.8],[-126.75,32.3,-29]],reached=new Set();
const push=p=>{const key=p.map(v=>Math.round(v*100)).join(',');if(!seen.has(key)){seen.add(key);queue.push(p);}};
for(let i=0;i<queue.length;i++){
 const p=queue[i];goals.forEach((g,k)=>{if(Math.abs(p[1]-g[1])<.1&&Math.hypot(p[0]-g[0],p[2]-g[2])<.4)reached.add(k);});
 for(const [dx,dz] of [[.2,0],[-.2,0],[0,.2],[0,-.2],[.2,.2],[.2,-.2],[-.2,.2],[-.2,-.2]]){
  const x=p[0]+dx,z=p[2]+dz;if(x<-132.5||x>-126.5||z<-41.9||z>-28.2)continue;
  ray.origin.set(x,p[1]+.4,z);const h=col.raycast(ray,.85);if(!h||h.normal.y<.6||Math.abs(h.point.y-p[1])>.401)continue;
  const q=[x,h.point.y,z];if(clear(q))push(q);
 }
}
assert.equal(reached.size,2,'The rotated ground maze must reach both platform exits');console.log('PASS maze interior',seen.size,'reachable capsule positions');
// The old rear tube gap is guarded again, and the shortened Deck 18 link has an end guard.
for(const p of [[-128.75,32.3,-43.2],[-89.8,28.3,-47.4]]){segment.start.set(p[0],p[1]+.75,p[2]);segment.end.set(p[0],p[1]+1.65,p[2]);assert(col.overlaps(segment,.35),'Missing closed-edge guard '+p);}
const serviceBounds=names=>{const b=new T.Box3();root.updateMatrixWorld(true);source.root.traverse(o=>{if(o.isMesh&&names.includes(o.name))b.union(new T.Box3().setFromObject(o,true));});return b;};
// The laundry, parcel lockers and reading bookcases were removed from this room's source (tester feedback).
assert(serviceBounds(['Laundry_counter','Laundry_machine','Laundry_drum','Parcel_locker','Reading_shelf','Library_end_panel','Library_shelf','Library_book']).isEmpty(),'Removed lounge furnishings are back');
// Old rectangular-gallery lights floated below the reshaped balconies. Remove the
// hidden upper rear strip too, before rendering and collision use the same source.
assert(serviceBounds(['Gallery_end_light','Gallery_warm_light']).isEmpty(),'Retired lounge light strips are back');
const arcadeBox=new T.Box3().setFromObject(arcade.solid,true);
assert(!arcadeBox.intersectsBox(tank));close(arcadeBox.max.x,-88);assert(arcadeBox.min.z>=-43.91&&arcadeBox.max.z<=-28.49);
close(new T.Vector3().setFromMatrixPosition(lift.group.matrixWorld).x,-86.53);close(new T.Vector3().setFromMatrixPosition(lift.group.matrixWorld).z,-51.2);
const door=new T.Vector3().fromArray(swimWorld(SWIM.door));close(door.z,-28.77);assert(clear(door.toArray()));assert.equal(SWIM.gems.length,7);assert(SWIM.gems.every(g=>gemNear(limitSwim([g[0],g[1]-SWIM.offset,g[2]]),g)));
const places=featurePlaces(layout);for(const id of ['hydro-nip','haze-maze','clubhouse-door','aquarium-treasure','arcade','arcade-pool','neon-arena','arcade-treadmill']){const p=places.find(p=>p.id===id);assert(clear(p.at),'Go-to is obstructed: '+id);}
close(arcadeTreadmill().centre.z,-29.27);vault.attach(col);assert(!clear([-88,24.3,-45.8]),'Locked vault blocks entry');assert.equal(vault.near(new T.Vector3(-89.3,24.3,-45.8)).kind,'vault');assert.equal(vault.unlock('incorrect'),false);assert.equal(vault.unlock('9lives'),true);
for(let i=0;i<40;i++)vault.update(.1,new T.Vector3(-90,24.3,-45.8));assert.equal(vault.state,'open');const leaf=new T.Box3().setFromObject(vault.group.getObjectByName('Vault_door'),true);
// The hinge thickness stays at the wall; the open leaf projects into the lounge.
assert(leaf.min.x<-90&&leaf.getCenter(new T.Vector3()).x<-89&&leaf.max.x<-87.7,'Vault swings outward into lounge');route('R5 unlocked vault',[[-90.8,24.3,-45.8],[-86.53,24.3,-45.8],[-86.53,24.3,-49]]);
console.log('PASS measured tank, services, arcade, unchanged lift, seven gems, Go-to and vault interaction');
console.log(JSON.stringify({arcade:[arcadeBox.min.toArray(),arcadeBox.max.toArray()],treasureDoor:door.toArray()}));

// The moved swim still uses the same standings and accepts a complete seven-gem run.
await fs.mkdir('.qa',{recursive:true});const dir=await fs.mkdtemp('.qa/lounge-treasure-'),file=dir+'/scores.json';
try{
 const old={id:'1',name:'Existing best',ms:1000,at:'2026-10-01T00:00:00.000Z'};await fs.writeFile(file,JSON.stringify([old]));
 let time=0;const messages=[],board=createTreasureBoard({file,now:()=>time,log(){},send:(_,m)=>messages.push(m)});
 const swim=id=>{const v={ws:{},name:id==='1'?old.name:'Swimmer',discord:{discordId:id},pos:swimWorld(SWIM.door)};board.message(v,{op:'start'});let q=[...SWIM.entry];v.pos=swimWorld(q);board.observe(v);const began=time;
  for(const target of [...SWIM.gems.map(g=>[g[0],g[1]-SWIM.offset,g[2]]),SWIM.chest]){const from=[...q],n=Math.ceil(new T.Vector3(...q).distanceTo(new T.Vector3(...target))/.3);for(let i=1;i<=n;i++){time+=100;q=from.map((x,k)=>x+(target[k]-x)*i/n);v.pos=swimWorld(q);board.observe(v);}}
  board.message(v,{op:'finish',ms:time-began});return messages.at(-1);
 };
 assert.equal(swim('1').newBest,false);assert.deepEqual(JSON.parse(await fs.readFile(file,'utf8')),[old]);const result=swim('2');assert.equal(result.ok,true);assert.equal(result.newBest,true);
 for(let i=0;i<100;i++){if(JSON.parse(await fs.readFile(file,'utf8')).length===2)break;await new Promise(resolve=>setTimeout(resolve,25));}
 const saved=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(saved.length,2);assert.deepEqual(saved.find(r=>r.id==='1'),old);assert(saved.every(r=>!('course' in r)));
 console.log('PASS server accepts all seven gems, retains existing best and saves new best');
}finally{await fs.unlink(file);await fs.rmdir(dir);}
