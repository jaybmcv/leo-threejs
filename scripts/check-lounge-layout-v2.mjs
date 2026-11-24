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
import {Colliders,solid} from '../src/walk/collision.js';
import {groundMesh} from '../src/v2/ground.js';
import {Controller} from '../src/walk/controller.js';
import {findRestSpots} from '../src/walk/rest.js';
import {createPhotoSpots} from '../src/walk/photo-spots.js';
import {SWIM,swimWorld,limitSwim,gemNear} from '../src/walk/aquarium-treasure/layout.js';
import {featurePlaces} from '../src/v2/goto-features.js';
import {mesh,polygonGeometry} from '../src/v2/geometry.js';
import {createTreasureBoard} from '../server/aquarium-treasure.mjs';
import {LOUNGE_PLAN,applyLoungeBalconyCut,applyLoungeLandingCorner} from '../src/plan/lounge-layout-v2.js';
import {applyLoungeFloorFinish} from '../src/v2/lounge-floor-material.js';

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
// The dome's porch roof supports feet across the whole pane, with the passage below left clear.
const porch=source.root.getObjectByName('Lounge_porch_floor');assert(porch,'Missing separate porch support');
const porchBox=new T.Box3().setFromObject(porch,true),ground=new Colliders();ground.addStatic(root,o=>solid(o)&&groundMesh(o));ground.commit();
close(porchBox.min.x,-113.55);close(porchBox.max.x,-111.45);close(porchBox.min.z,-35.6);close(porchBox.max.z,-33.25);
close(porchBox.min.y,26.98);close(porchBox.max.y,27.02);
assert(porch.material.transparent&&porch.material.opacity===.15,'Porch stays see-through');
const roofRay=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),onlyRoof=new Colliders();onlyRoof.addStatic(porch);onlyRoof.commit();let roofProbes=0;
for(let x=porchBox.min.x+.02;x<porchBox.max.x;x+=.1)for(let z=porchBox.min.z+.02;z<porchBox.max.z;z+=.1){
 roofRay.origin.set(x,27.2,z);const hit=ground.raycast(roofRay,.4),pane=onlyRoof.raycast(roofRay,.4);assert(hit&&pane,'Porch roof has a support gap');close(pane.point.y,27.02);assert(Math.abs(hit.point.y-27.02)<.031,'Porch support stays level with its frame');roofProbes++;
 // A standing visitor's capsule fits beneath every point in the new support.
 const body=new T.Line3(new T.Vector3(x,25.05,z),new T.Vector3(x,25.95,z));assert(!onlyRoof.overlaps(body,.35),'Roof must not fill the porch');
}
for(const [x,z] of [[-113.8,-34.3],[-111.2,-34.3],[-112.5,-33]]){roofRay.origin.set(x,27.2,z);assert.equal(ground.raycast(roofRay,.3),null,'Roof support stops at the pane edge');}
console.log('PASS porch roof',roofProbes,'ground probes, unchanged glass and clear space below');
const walker=new Controller(col);col.raycastGround=(...args)=>ground.raycast(...args);
const walk=(wish,seconds,test)=>{for(let i=0;i<Math.round(seconds*60);i++){walker.step(1/60,new T.Vector3(...wish),false);test?.(walker.position);}};
walker.place(new T.Vector3(-111.62,26.87,-33.2));
walk([0,0,-2.25],.5,p=>assert(p.y>26.8&&p.y<27.08,'Step from the frame onto the roof must stay supported'));
walk([-2.25,0,0],.75,p=>assert(Math.abs(p.y-27.02)<.06,'Crossing the pane must stay supported'));
assert(walker.position.x<-113,'Walker crosses to the far side of the pane');
walk([2.25,0,0],.35,p=>assert(Math.abs(p.y-27.02)<.06,'Return to the middle stays supported'));
walk([0,0,2.25],.85);walk([0,0,0],1);
assert(walker.grounded&&Math.abs(walker.position.y-24.3)<.05,'Visitor can step off the roof and land below');
walker.place(new T.Vector3(-112.5,24.3,-32.7));walk([0,0,-2.25],.8,p=>assert(p.y>=24.29&&p.y<24.51,'Porch passage stays on its floor and threshold'));
assert(walker.position.z<-34,'Visitor walks into the porch under the roof');walk([0,0,2.25],.9,p=>assert(p.y>=24.29&&p.y<24.51,'Visitor can leave the porch'));
assert(walker.position.z>-33&&Math.abs(walker.position.y-24.3)<.05,'Visitor walks back out onto the lounge floor');console.log('PASS porch frame, crossing, return, drop and floor-level passage with the real controller');
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),segment=new T.Line3();
const clear=([x,y,z])=>{ray.origin.set(x,y+.42,z);const hit=col.raycast(ray,.85);segment.start.set(x,y+.75,z);segment.end.set(x,y+1.65,z);return !!hit&&hit.normal.y>.6&&Math.abs(hit.point.y-y)<.1&&!col.overlaps(segment,.35);};
const route=(name,points)=>{let count=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.ceil(new T.Vector3(...a).distanceTo(new T.Vector3(...b))/.1);for(let j=0;j<=n;j++){const p=a.map((v,k)=>v+(b[k]-v)*j/n);assert(clear(p),name+' blocked at '+JSON.stringify(p));count++;}}console.log('PASS',name,count,'capsule probes');};
// Only Deck 18's forward notch is filled. Nothing passes through the new slab.
const cornerSnapshot=JSON.stringify(r.components);applyLoungeLandingCorner(r);assert.equal(JSON.stringify(r.components),cornerSnapshot,'Landing fill is idempotent');
const cornerVolume=new T.Box3(new T.Vector3(-89.98,28.021,-56.60),new T.Vector3(-88.22,30.3,-54.92)),triangle=new T.Triangle();
source.root.updateMatrixWorld(true);
source.root.traverse(o=>{if(!o.isMesh||!new T.Box3().setFromObject(o,true).intersectsBox(cornerVolume))return;const p=o.geometry.attributes.position,ix=o.geometry.index;
 for(let i=0;i<(ix?.count??p.count);i+=3){for(const [k,v]of [triangle.a,triangle.b,triangle.c].entries())v.fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld);assert(!cornerVolume.intersectsTriangle(triangle),'Fitting crosses new floor or standing space: '+o.name);}
});
applyLoungeFloorFinish(ship);
const cornerRay=new T.Raycaster(),slabs=structure.getObjectsByProperty('name','V2_garden_gallery');let cornerProbes=0;
for(let x=-89.9;x<-88.3;x+=.1)for(let z=-56.5;z<-55;z+=.1){
 cornerRay.set(new T.Vector3(x,28.5,z),new T.Vector3(0,-1,0));cornerRay.far=.6;const top=cornerRay.intersectObjects(slabs);assert.equal(top.length,1,'Corner needs exactly one floor face');close(top[0].point.y,28.3);assert.equal(top[0].object.material.name,'Lounge_velvet_carpet');
 cornerRay.set(new T.Vector3(x,27.8,z),new T.Vector3(0,1,0));const underside=cornerRay.intersectObjects(slabs);assert(underside.length,'Open underside');close(underside[0].point.y,28.02);cornerProbes++;
}
for(const [at,dir]of [[[-90.2,28.15,-55.7],[1,0,0]],[[-89,28.15,-55.1],[0,0,1]]]){cornerRay.set(new T.Vector3(...at),new T.Vector3(...dir));cornerRay.far=.5;assert.equal(cornerRay.intersectObjects(slabs).length,0,'Buried slab join face');}
for(const [at,dir]of [[[-87.8,28.15,-55.7],[-1,0,0]],[[-89,28.15,-57],[0,0,1]]]){cornerRay.set(new T.Vector3(...at),new T.Vector3(...dir));cornerRay.far=.8;assert(cornerRay.intersectObjects(slabs).length,'Missing finished outer slab edge');}
for(const [name,y]of [['V2_garden_guard_glass',28.9],['V2_garden_guard_cap',29.4]]){const rails=structure.getObjectsByProperty('name',name);cornerRay.far=1;
 for(let x=-89.9;x<-88.2;x+=.1){cornerRay.set(new T.Vector3(x,y,-56.2),new T.Vector3(0,0,-1));assert(cornerRay.intersectObjects(rails).length,'Missing straight corner rail '+name);}
 for(let z=-56.5;z<-54.9;z+=.1){cornerRay.set(new T.Vector3(-88.7,y,z),new T.Vector3(1,0,0));assert(cornerRay.intersectObjects(rails).length,'Missing far corner rail '+name);}
 cornerRay.far=2;cornerRay.set(new T.Vector3(-91,y,-55.7),new T.Vector3(1,0,0));assert.equal(cornerRay.intersectObjects(rails).length,0,'Old jog rail remains inside landing');
}
// The #427 wall closes the floor below the corner's open-floor edge, so the walk reaches it from the lounge side only (Jay, 2026-11-20).
route('Below filled corner',[[-91,24.3,-55.7],[-89,24.3,-55.7]]);
walker.place(new T.Vector3(-91.05,28.3,-55.68));walk([2.25,0,0],2,p=>assert(Math.abs(p.y-28.3)<.06,'New corner must support feet'));
assert(walker.position.x>-89.2&&walker.position.x<-88.5,'Far rail stops the visitor inside the new floor');
walk([0,0,-2.25],1,p=>assert(Math.abs(p.y-28.3)<.06,'Outer corner rail prevents a fall'));assert(walker.position.z>-56.3&&walker.position.z<-56,'Outer rail stops the visitor');
const reach=(x,z)=>{let steps=0;while(Math.hypot(walker.position.x-x,walker.position.z-z)>.04&&steps++<900){const wish=new T.Vector3(x-walker.position.x,0,z-walker.position.z).normalize().multiplyScalar(2.25);walker.step(1/60,wish,false);}assert(steps<900,'Cannot leave corner toward '+[x,z]);};
reach(-91.05,-55.68);reach(-89.8,-55.68);walk([0,0,2.25],1.8);assert(walker.position.y<27.4&&walker.position.y>25.5,'Leave corner down purple-lit stairs');
reach(-89.8,-55.68);assert(Math.abs(walker.position.y-28.3)<.06,'Return up lower flight');reach(-93.1,-55.68);walk([0,0,2.25],1.8);assert(walker.position.y>29.2&&walker.position.y<31.3,'Leave corner up the second flight');
console.log('PASS squared Deck 18 corner',cornerProbes,'top/underside probes, clear fittings and route below, square guards, no jog and both stair flights');
// Cut only Deck 18's side strip. Its maze landing remains accessible from the gallery door.
const end=r.components.galleries.find(g=>g.id==='commons-1-end-4'),snapshot=JSON.stringify(r.components);
close(Math.min(...end.polygon.map(p=>p[1])),LOUNGE_PLAN.balconyEnd);
applyLoungeBalconyCut(r);assert.equal(JSON.stringify(r.components),snapshot,'The cut is idempotent on a rebuilt layout');
for(let x=-140.4;x<=-137.6;x+=.4)for(let z=-46.8;z<=-39.2;z+=.4){ray.origin.set(x,28.5,z);assert.equal(ground.raycast(ray,.6),null,'Removed walkway still supports feet at '+[x,z]);}
route('Deck 18 retained maze access',[[-140,28.3,-30],[-139,28.3,-30],[-139,28.3,-37.8],[-137.5,28.3,-37.8]]);
const guardRay=new T.Raycaster(new T.Vector3(),new T.Vector3(1,0,0),0,1);
for(const [name,y]of [['V2_garden_guard_glass',28.9],['V2_garden_guard_cap',29.4]]){const guards=structure.getObjectsByProperty('name',name);
 for(let z=-50.7;z<=-47.4;z+=.1){guardRay.set(new T.Vector3(-139.4,y,z),new T.Vector3(1,0,0));assert(guardRay.intersectObjects(guards).length,'Curved balcony cut needs continuous '+name+' at '+z);}
 for(let x=-140.7;x<=-137.3;x+=.1){guardRay.set(new T.Vector3(x,y,-39.1),new T.Vector3(0,0,1));assert(guardRay.intersectObjects(guards).length,'Maze balcony cut needs continuous '+name+' at '+x);}
 assert(guards.every(o=>name.endsWith('_glass')||o.material.color.getHex()===0xff6b20),'Retain the orange cap material');
}
for(const o of source.root.getObjectsByProperty('isMesh',true).filter(o=>o.name.startsWith('Lounge_'))){const p=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);assert(!(v.x>-137.2&&v.x<-136.3&&v.z>-47.1&&v.z<-39.2&&v.y>25.4&&v.y<28.1),'Floating dressing beneath removed walkway: '+o.name+' '+v.toArray()+' '+Array.from(o.geometry.attributes.color?.array.slice(i*3,i*3+3)||[]));}}
walker.place(new T.Vector3(-134.99,28.3,-51.77));walk([-1.258,0,1.865],3,p=>assert(Math.abs(p.y-28.3)<.06,'Near cut rail must prevent a fall'));
assert(walker.position.z<-47.4,'Near rail stops the approach');console.log('Near cut stop',walker.position.toArray());
walk([1.258,0,-1.865],1.7);
const rear=r.components.galleries.find(g=>g.id==='commons-1-rear-4'),escape=[-130,-125,-120,-115,-110,-105,-100,-95,-91.5].map(x=>[x,28.3,rear.polygon.find(p=>p[0]===x)[1]-2]);escape.push([-90.6,28.3,escape.at(-1)[2]]);
route('Curved balcony to retained stair',[walker.position.toArray(),...escape]);
for(const target of escape){let steps=0;const aim=new T.Vector3(...target);while(walker.position.distanceTo(aim)>.1&&steps++<900){const wish=aim.clone().sub(walker.position);wish.y=0;walker.step(1/60,wish.normalize().multiplyScalar(2.25),false);assert(Math.abs(walker.position.y-28.3)<.06,'Curved balcony escape stays supported');}assert(walker.position.distanceTo(aim)<.1,'Cannot reach retained stair route '+target);}
walk([0,0,2.25],1);assert(walker.position.y<28&&walker.position.y>26.5,'Visitor leaves the balcony down the retained stairs');
walker.place(new T.Vector3(-139,28.3,-37.8));walk([0,0,-2.25],2,p=>assert(Math.abs(p.y-28.3)<.06,'Far cut rail must prevent a fall'));
assert(walker.position.z>-38.5,'Far rail stops the approach');console.log('Far cut stop',walker.position.toArray());
walk([0,0,2.25],3.4,p=>assert(Math.abs(p.y-28.3)<.06,'Door approach remains supported'));assert(walker.position.z>-31,'Visitor can return to the gallery door');
console.log('PASS Deck 18 side cut: no floor or hanging remnants, continuous glass guards, controller stops and retained maze access');
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
route('R5 retained clubhouse corridor',[[-90.8,24.3,-45.8],[-86.53,24.3,-45.8],[-86.53,24.3,-49]]);
route('R5 lounge lift approach',[[-125,24.3,-29.7],[-125,24.3,-43],[-134.5,24.3,-43],[-134.5,24.3,-32.15],[-138.9,24.3,-32.15]]);
// The real merged wall-light fittings must stay clear of a standing cat at the new entrance.
walker.place(new T.Vector3(-138.9,24.3,-32.15));assert(lift.unlock('9lives'));const entryStart=walker.position.clone();
for(let i=0;i<51;i++){lift.update(1/60,walker);walker.step(1/60,new T.Vector3(0,0,2.25),false);}
const entryDistance=walker.position.distanceTo(entryStart);
assert(entryDistance>=1.5&&lift.inside(walker.position),'The retained wall lights must not slow entry into the clubhouse cab: '+JSON.stringify({entryDistance,at:walker.position.toArray()}));
console.log('PASS clubhouse entry below retained lights',entryDistance,'metres in .85 seconds');
route('R6 jaguar to dome',[[-112.5,24.3,-23.5],[-112.5,24.3,-28.8],[-113.3,24.3,-29.1],[-113.3,24.3,-32.7],[-112.5,24.3,-32.7],[-112.5,24.3,-34]]);
for(const y of [28.3,32.3])route('R7 aft door '+y,[[-140.6,y,-30],[-138.2,y,-30]]);
// Walk below the retired side strips from the reported view, and below the rear strip.
route('R8 old side lights',[[-134.36,24.3,-38.2],[-135.41,24.3,-43.6],[-134.36,24.3,-38.2]]);
route('R9 old rear light',[[-121,24.3,-57],[-121,24.3,-59.5],[-121,24.3,-57]]);
// The lounge floor can't make solids walkable: the aquarium's front glass stays blocked (the tank itself is swimmable
// water), while the floor 2 m in front of it is clear.
assert(!clear([-100,24.3,-28])&&!clear([-120,24.3,-28]),'The aquarium glass stays solid over the lounge floor');
assert(clear([-100,24.3,-30]),'The floor in front of the aquarium is walkable');console.log('PASS aquarium glass blocks, the floor before it is clear');
// The moved counter now occupies this patch. Exclude it to check for the old tree's base and posts.
const withoutConverger=new Colliders();withoutConverger.addStatic(root,o=>solid(o)&&!o.name.startsWith('Cosmic_Munchies_')&&!o.userData.converger);withoutConverger.commit();
for(const x of [-99.5,-99.05])for(let z=-36;z<=-33;z+=.1){segment.start.set(x,r.y+.75,z);segment.end.set(x,r.y+1.65,z);assert(!withoutConverger.overlaps(segment,.35),'Removed cat tree remains');}
ray.origin.set(-99.5,24.6,-34.6);close(withoutConverger.raycast(ray,.5)?.point.y,r.y);
assert(!clear([-121.9,24.3,-38.5])&&!clear([-133.9,24.3,-51.8]),'The other lounge cat trees stay solid');
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
// The complete machine moves at source, before collision and rest anchors are collected.
const machine=serviceBounds(['Cosmic_Munchies_Converger_Lounge_sheen']),sign=serviceBounds(['Cosmic_Munchies_Sign_Lounge_sheen']);
close(machine.min.x,-100.1);close(machine.max.x,-94.9);close(machine.min.z,-37.5);close(machine.max.z,-33.1);close(machine.max.y,35.63);
const converger=r.components.pieces.find(p=>p.name==='munchies converger');assert.deepEqual(converger.center,LOUNGE_PLAN.converger.center);close(converger.yaw,-Math.PI/2);
assert(arcade.solid&&new T.Box3().setFromObject(arcade.solid,true).min.x-machine.max.x>=1.5,'Every cabinet keeps its approach aisle');
const seats=[];source.root.traverse(o=>{if(o.userData.converger)seats.push(o.getWorldPosition(new T.Vector3()));});
assert.equal(seats.length,3);for(const p of seats){close(p.z,-37.3);assert(p.x>-100&&p.x<-95,'Stools face open floor');}
assert(sign.min.y>r.y+2.2&&sign.max.x<-97.5&&sign.min.z>-34.7,'Sign stays overhead beside the converger');
const signCenter=new T.Vector3(-99.4,30.9,-31.5),signFront=new T.Vector3(-110.55-signCenter.x,0,-34.36-signCenter.z).normalize();
assert.deepEqual(LOUNGE_PLAN.converger.signCenter,signCenter.toArray());close(LOUNGE_PLAN.converger.signYaw,-1.821885322640436);
const signMesh=source.root.getObjectByName('Cosmic_Munchies_Sign_Lounge_sheen'),normals=signMesh.geometry.attributes.normal,normalMatrix=new T.Matrix3().getNormalMatrix(signMesh.matrixWorld);
let front=0;for(let i=0;i<normals.count;i++){const n=new T.Vector3().fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();if(n.dot(signFront)>.99999)front++;}
assert(front>=6,'Sign board faces the aquarium photo approach');
// Probe the whole ceiling emitter column against galleries, rails, lights and plants.
const overhead=new Colliders();overhead.addStatic(root,o=>o.isMesh&&!o.name.startsWith('Cosmic_Munchies_')&&!o.userData.converger);overhead.commit();
for(let x=-98.8;x<=-96.2;x+=.2)for(let z=-36;z<=-33.4;z+=.2){segment.start.set(x,r.y+3,z);segment.end.set(x,35.64,z);assert(!overhead.overlaps(segment,.03),'Converger cuts overhead dressing');}
const signRight=new T.Vector3(signFront.z,0,-signFront.x);
for(let x=-2.3;x<=2.301;x+=.05)for(let y=-.65;y<=.651;y+=.05){const p=signCenter.clone().addScaledVector(signRight,x);p.y+=y;segment.start.copy(p);segment.end.copy(p).addScaledVector(signFront,-.08);assert(!overhead.overlaps(segment,.025),'Sign cuts gallery, aquarium or hanging dressing');}
for(const s of [-1,1]){segment.start.copy(signCenter).addScaledVector(signRight,s*1.4);segment.start.y+=.65;segment.end.copy(segment.start).setY(35.65);assert(!overhead.overlaps(segment,.025),'Sign wire cuts overhead dressing');}
walker.place(new T.Vector3(-110.55,24.8,-34.36));
for(const [yaw,seconds,x,z] of [[449,4,-101.58,-34.18],[0,.8,-101.54,-32.44],[90,1.2,-98.9,-32.39],[90,2.3,-93.72,-32.39]]){const a=yaw*Math.PI/180;walk([Math.sin(a)*2.25,0,Math.cos(a)*2.25],seconds);assert(Math.hypot(walker.position.x-x,walker.position.z-z)<.15&&Math.abs(walker.position.y-r.y)<.05,'Visitor reaches counter and arcade beneath sign');}
route('Aquarium approach beneath sign',[[-101.6,24.3,-34.2],[-101.6,24.3,-32.5],[-93.5,24.3,-32.5]]);
route('R10 old converger footprint',[[-107.72,24.3,-34.93],[-101,24.3,-41],[-96.5,24.3,-45.06473]]);
route('R11 arcade aisle to photo spot',[[-96.5,24.3,-45.06473],[-93.5,24.3,-45.06473],[-93.5,24.3,-32.5],[-103.5,24.3,-32.5],[-103.5,24.3,-30]]);
for(let x=-103.8;x<=-99.4;x+=.2)for(let z=-43.6;z<=-38.4;z+=.2)assert(clear([x,r.y,z]),'Old converger footprint has leftover collision');
walker.place(new T.Vector3(-107.72,r.y,-34.93));
for(const [x,z] of [[-96.5,-45.06473],[-93.5,-45.06473],[-93.5,-32.5],[-103.5,-32.5],[-103.5,-30]]){
 const target=new T.Vector3(x,r.y,z);let steps=0;
 while(walker.position.distanceTo(target)>.12&&steps++<900){const wish=target.clone().sub(walker.position);wish.y=0;wish.normalize().multiplyScalar(2.25);walker.step(1/60,wish,false);assert(Math.abs(walker.position.y-r.y)<.06,'Converger route stays on the lounge floor');}
 assert(walker.position.distanceTo(target)<.12,'Controller cannot reach '+target.toArray());
}
assert(!clear([-97.5,24.3,-34.7]),'The relocated counter stays solid');
const movedRests=findRestSpots(source.root);for(const p of seats)assert(movedRests.some(s=>Math.hypot(s.point.x-p.x,s.point.z-p.z)<.1),'Moved stool retains its sit anchor');
assert(!movedRests.some(s=>s.kind==='sit'&&Math.abs(s.point.x+103.6)<.1&&s.point.z>-43&&s.point.z<-39),'Old stool anchors are gone');
console.log('PASS converger position, overhead clearance, entrance sign, stool anchors and arcade/photo routes');
// The laundry, parcel lockers and reading bookcases were removed from this room's source (tester feedback).
assert(serviceBounds(['Laundry_counter','Laundry_machine','Laundry_drum','Parcel_locker','Reading_shelf','Library_end_panel','Library_shelf','Library_book']).isEmpty(),'Removed lounge furnishings are back');
// The three loose reading chairs and their batched seams leave bare, walkable floor.
const chairs=[];source.root.traverse(o=>{if(o.name==='Tail_clearance_chair')chairs.push(o.getWorldPosition(new T.Vector3()));});
assert.deepEqual(chairs.map(p=>p.toArray()),[[-118.5,24.3,-53],[-116.5,24.3,-53],[-114.5,24.3,-53],[-112.5,24.3,-53]],'Keep all four kitchen chairs');
const rests=findRestSpots(source.root),seams=[];source.root.traverse(o=>{if(o.name==='Polish_tailored_seam')seams.push(new T.Box3().setFromObject(o,true));});
// Only the middle seating group moves, centred on the maze door with a 1.75 m approach.
const rug=source.root.getObjectByName('Lounge_rug'),rugBoxes=[];
for(let start=0;start<rug.geometry.attributes.position.count;start+=36){const b=new T.Box3();for(let i=start;i<start+36;i++)b.expandByPoint(new T.Vector3().fromBufferAttribute(rug.geometry.attributes.position,i).applyMatrix4(rug.matrixWorld));rugBoxes.push(b);}
assert.equal(rugBoxes.length,3,'Keep exactly three lounge rugs');
for(const [i,x,z] of [[0,-119.5,-32.5],[1,-129.5,-45.75],[2,-103.15,-30]]){const b=rugBoxes[i],c=b.getCenter(new T.Vector3());close(c.x,x);close(c.z,z);close(b.max.x-b.min.x,i===2?4:7);close(b.max.z-b.min.z,i===2?3:4);}
close(rugBoxes[1].max.z,-43.75);
for(const [x,z] of [[-131.7,-44.85],[-128.3,-47.25],[-126.3,-45.05],[-132.9,-46.75],[-130.3,-44.15]])assert(rests.some(s=>s.kind==='sit'&&Math.hypot(s.point.x-x,s.point.z-z)<.01),'Moved cushion has a sit anchor');
assert(!rests.some(s=>s.height<25.1&&s.point.x>-113.5&&s.point.x<-105.9&&s.point.z>-35&&s.point.z<-29.8),'No old cushion anchors');
route('Former middle rug centre',[[-109.5,24.3,-33],[-109.5,24.3,-31]]);
walker.place(new T.Vector3(-129.5,24.3,-49));
walk([0,0,2.25],3.6,p=>assert(Math.abs(p.x+129.5)<.35&&p.y>=24.29&&p.y<25.1,'Cross the rug on the door centre line'));
assert(walker.position.z>-41.5&&walker.position.z<-40.5,'Cross the rug and finish inside the maze entrance');
walk([0,0,-2.25],3.6,p=>assert(Math.abs(p.x+129.5)<.35&&p.y>=24.29&&p.y<25.1,'Return across the rug'));
assert(walker.position.z<-48.5,'Walk back out beyond the rug');
console.log('PASS three rugs, moved cushion anchors, bare old footprint and centre-line crossing in both directions');
// The small rug at the photo spot keeps its long edges along the aquarium glass.
{
 const rug=source.root.getObjectByName('Lounge_rug'),p=rug.geometry.attributes.position,boxes=[];
 for(let i=0;i<p.count;i+=36)boxes.push(new T.Box3().setFromPoints(Array.from({length:36},(_,j)=>new T.Vector3().fromBufferAttribute(p,i+j).applyMatrix4(rug.matrixWorld))));
 assert.equal(boxes.length,3);for(const [i,x0,x1,z0,z1] of [[0,-123,-116,-34.5,-30.5],[1,-133,-126,-47.75,-43.75]]){close(boxes[i].min.x,x0);close(boxes[i].max.x,x1);close(boxes[i].min.z,z0);close(boxes[i].max.z,z1);}
 const small=boxes[2];close(small.min.x,-105.15);close(small.max.x,-101.15);close(small.min.z,-31.5);close(small.max.z,-28.5);
 assert(small.max.z<tank.min.z-.5&&!small.intersectsBox(boxes[1]),'Moved rug clears the glass and larger rug');
 const seats=[[-102.55,25.0196,-30.1],[-104.45,24.47,-28.9],[-101.55,24.47,-31.2]];
 for(const at of seats)assert.equal(rests.filter(s=>s.point.distanceTo(new T.Vector3(...at))<.002).length,1,'Each moved cushion keeps its sit point');
 assert(!rests.some(s=>s.point.x>-104.5&&s.point.x<-100.5&&s.point.z>-35&&s.point.z<-32),'No old cushion sit points');
 for(const [x,z] of [[-101.9,-33.6],[-103.8,-32.4],[-100.9,-34.7]]){assert(clear([x,24.3,z]),'No old cushion collider');ray.origin.set(x,24.7,z);close(col.raycast(ray,.5)?.point.y,24.3);}
 route('Old small rug floor',[[-104,24.3,-34.7],[-101,24.3,-34.7],[-101,24.3,-32.1]]);
 const photos=createPhotoSpots(),spot=photos.spots.find(s=>s.id==='aquarium'),marker=photos.groups.find(g=>g.name==='Photo_spot_aquarium').getObjectByName('Photo_spot_marker');
 assert.deepEqual(spot.stand,[-103.5,24.3,-30]);assert(small.containsPoint(new T.Vector3(spot.stand[0],small.max.y,spot.stand[2])));
 assert(marker.getWorldPosition(new T.Vector3()).y>small.max.y+.004,'Photo marker sits just above the rug');
 for(const g of photos.groups.filter(g=>g.name!=='Photo_spot_aquarium'))close(g.getObjectByName('Photo_spot_marker').position.y,.02);
 assert(clear(spot.stand),'The photo standing point remains clear');assert.equal(photos.near(new T.Vector3(...spot.stand)).kind,'photo-spot');
 walker.place(new T.Vector3(-103.5,24.3,-33.8));walk([0,0,2.25],1.69);walk([0,0,0],.3);
 assert(Math.hypot(walker.position.x+103.5,walker.position.z+30)<.15,'Walk onto the photo circle without a cushion blocking it');
 walk([-2.25,0,0],1);assert(walker.position.x<small.min.x-.3,'Walk off the far edge of the rug');
 console.log('PASS moved small rug, three sit points, bare old floor, visible photo marker and walk across the photo spot');
}
// Each walk crosses its old chair spot (z -56) and stops on the open-floor side of the #427 wall (Jay, 2026-11-24).
for(const [x,end] of [[-128.5,-54.8],[-125.5,-55.1],[-122.5,-55.75]]){
 route('Former reading chair '+x,[[x,24.3,-59.8],[x,24.3,end]]);
 assert(!rests.some(s=>Math.abs(s.height-24.8)<.5&&Math.hypot(s.point.x-x,s.point.z+56)<1.5),'Invisible chair rest anchor at '+x);
 const b=new T.Box3(new T.Vector3(x-.4,24.3,-56.4),new T.Vector3(x+.4,25.5,-55.6));
 assert(!seams.some(s=>s.intersectsBox(b)),'Floating upholstery seam at '+x);
}
for(const p of chairs)assert(rests.some(s=>Math.hypot(s.point.x-p.x,s.point.z-p.z)<.1),'Kitchen chair still has its sit anchor');
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
