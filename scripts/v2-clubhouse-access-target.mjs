import * as T from 'three';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {createGardenCommons} from '../src/model.js';
import {resolveRoomFrames,frame} from '../src/plan/rooms.js';
import {createLoungeAquarium} from '../src/walk/lounge-aquarium.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {Controller} from '../src/walk/controller.js';
import {VAULT_LIFT} from '../src/walk/vault.js';
import {createVaultLift} from '../src/walk/vault-lift.js';
import {prepareClubhouseAccess} from '../src/v2/clubhouse-access.js';
import {CLUBHOUSE_SHAFT as S} from '../src/v2/vault-lift-fit.js';
import {Colliders,solid} from '../src/walk/collision.js';
import {installGround} from '../src/v2/ground.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {fitPrototypeStructure} from '../src/v2/hull-prototypes.js';
import {contains} from '../src/plan/geometry-v2.js';
import {box,mesh,polygonGeometry} from '../src/v2/geometry.js';
import {LOUNGE_PLAN} from '../src/plan/lounge-layout-v2.js';

installWalkCanvas(createCanvas);
const r=layout.rooms.find(r=>r.id==='commons-1'),root=new T.Group(),source=createGardenCommons(1);
root.add(source.root);resolveRoomFrames(root);
const structure=new T.Group();structure.name='V2_structure';root.add(structure);
const ship={root,inside:root,exterior:new T.Group(),cutaway:new Set()};
const gardens=layout.rooms.filter(room=>['commons-1','commons-3'].includes(room.id));
for(const room of gardens)buildRoomShell(ship,room,structure);
const prototypes=layout.hullPrototypes.prototypes.filter(p=>gardens.some(room=>room.id===p.id));
fitPrototypeStructure(ship,{...layout,shuttles:[],hullPrototypes:{...layout.hullPrototypes,prototypes}});
mesh(root,'Lounge_deck_slab',polygonGeometry(r.polygon,[],r.y,.24));
// The ground slab between the two gardens is part of the full deck slab.
box(root,'V2_room_floor',[2,.24,9],[-87,24.18,-49]);
prepareClubhouseAccess(ship,VAULT_LIFT);
const col=new Colliders(),lift=createVaultLift(col),walker=new Controller(col);
installGround(col,new Colliders());
const f=frame(r.id),m=new T.Matrix4().makeTranslation(...f.origin).multiply(new T.Matrix4().makeRotationY(f.yaw)).multiply(new T.Matrix4().makeScale(1,1,f.mirror?-1:1)).multiply(new T.Matrix4().makeTranslation(-132,-24.3,-27));
createLoungeAquarium(ship,m,{addStatic:g=>col.addStatic(g,()=>true)});
col.addStatic(root,solid);col.addStatic(lift.solid,()=>true);col.commit();

const dock=i=>new T.Vector3().setFromMatrixPosition(lift.docks[i]);
assert.deepEqual(lift.lift.stops.map(s=>[s.deck,+s.y.toFixed(2)]),[[17,24.3],[18,28.3],[19,32.3]]);
for(const [i,id] of ['commons-1-end-4','commons-1-end-8'].entries()){
 const gallery=r.components.galleries.find(p=>p.id===id);
 assert.equal(Math.max(...gallery.polygon.map(p=>p[0])),S.edge,'Existing gallery edge');
 for(const dz of [-S.doorWidth/2,0,S.doorWidth/2]){
  assert(contains(gallery.polygon,[S.edge-.01,S.z+dz]),'Gallery meets the full sill');
  assert(!contains(gallery.polygon,[S.x-S.radius,S.z+dz]),'Shaft stays outside the slab');
 }
 assert.deepEqual(dock(i+1).toArray(),[S.x,lift.lift.stops[i+1].y,S.z]);
}
assert.deepEqual(dock(0).toArray(),[S.x,lift.lift.stops[0].y,S.z]);
assert(LOUNGE_PLAN.tank[2]-S.z-S.radius>.7,'Walkable aquarium-side clearance');

const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3();
const clear=(x,y,z)=>{
 ray.origin.set(x,y+.45,z);const h=col.raycastGround(ray,.9);
 seg.start.set(x,y+.75,z);seg.end.set(x,y+1.65,z);
 return !!h&&Math.abs(h.point.y-y)<.05&&!col.overlaps(seg,.35);
};
const tick=(x,z,seconds,probe)=>{
 for(let i=0;i<Math.round(seconds*60);i++){lift.update(1/60,walker);if(!lift.riding)walker.step(1/60,new T.Vector3(x,0,z),false);probe?.(walker.position);}
};
const landing=i=>new T.Vector3(-138.15,dock(i).y,S.z);
const ride=i=>{
 const from=walker.position.y;lift.call(lift.lift,i,{now:true});let between=false;
 tick(0,0,7,p=>{if(Math.abs(p.y-from)>.2&&Math.abs(p.y-dock(i).y)>.2)between=true;});
 assert(between,'The rider moves through the shaft between decks');
 assert.equal(lift.lift.at,i);assert.equal(lift.lift.phase,'open');
 assert(lift.inside(walker.position)&&Math.abs(walker.position.y-dock(i).y)<.05,'Car carries the walker to the exact floor');
};
const exit=i=>{
 tick(-2.25,0,1.45,p=>assert(Math.abs(p.y-dock(i).y)<.05,'Level step out of the cab'));
 assert(!lift.inside(walker.position)&&walker.position.x<S.edge-.6&&walker.grounded);
 tick(0,-2.25,1.55,p=>assert(Math.abs(p.y-dock(i).y)<.05,'Continuous route away from the doorway'));
 assert(walker.position.z<S.z-3);
};
for(const index of [1,2]){
 assert.equal(lift.lift.at,0);assert(!lift.authorized);
 lift.call(lift.lift,index,{now:true});assert.equal(lift.lift.calls.size,0,'Locked lounge car rejects an in-car departure');
 walker.place(landing(index));const call=lift.nearest(walker.position);
 assert.equal(call?.kind,'clubhouse-call');assert.equal(call.stop,index);
 tick(2.25,0,1.2);assert(walker.position.x<S.x-S.front-.30&&walker.grounded,'A closed landing gate guards the empty shaft');
 lift.call(call.lift,call.stop);tick(0,0,8);
 assert.equal(lift.lift.at,index);assert.equal(lift.lift.phase,'open');assert(!lift.authorized);
 tick(2.25,0,1.1,p=>assert(Math.abs(p.y-dock(index).y)<.05,'Level boarding through the rail gap'));
 assert(lift.inside(walker.position)&&lift.authorized);
 ride(0);exit(0);assert(!lift.authorized,'The lounge relocks after the return');
}

walker.place(landing(0));
assert.equal(lift.nearest(walker.position)?.kind,'clubhouse-password');
assert(!lift.unlock('wrong'),'Wrong password stays locked');
tick(2.25,0,1.1);assert(walker.position.x<S.x-S.front-.30,'Locked lounge gate blocks entry');
assert(lift.unlock('9lives'),'Existing clubhouse password opens the new station');
tick(2.25,0,.8);assert(lift.inside(walker.position),'Walk into the lounge cab');
for(const i of [1,2]){
 ride(i);exit(i);
 tick(0,2.25,1.55);
 tick(2.25,0,1.4);
 assert(lift.inside(walker.position),'Reboard from Deck '+(i+17));
}
ride(0);exit(0);
for(const z of [-35.12,-29.06])for(let x=-138.25;x<=-133.1;x+=.1)
 assert(clear(x,24.3,z),'Clear route around the tube '+[x,z]);

for(const {deck,y} of lift.lift.stops){
 for(const [x,dx] of [[-89,1],[-87,-1],[-87,1],[-85,-1]]){
  for(const dy of [.25,1.5,2.7])for(let z=-52.9;z<=-49.5;z+=.2){
   const hit=col.raycast(new T.Ray(new T.Vector3(x,y+dy,z),new T.Vector3(dx,0,0)),1.2);
   assert(hit,'Old wall blocks sight on Deck '+deck+' at '+z);
  }
 }
 assert.equal(lift.nearest(new T.Vector3(-86.53,y,-51.2)),null,'No interaction at the old tube');
}
const patches=root.getObjectsByProperty('name','V2_retired_clubhouse_lift_wall');
assert.equal(patches.length,2);assert(patches.every(o=>o.userData.v2Deck===17));
assert(clear(-86.53,24.3,-49),'Retained vault corridor has a floor and headroom');
let stairSteps=0;
for(const a of r.components.stairs)for(const b of r.components.stairs){
 if(b.center[1]<=a.center[1]+.02||b.center[1]>a.center[1]+.25||Math.hypot(b.center[0]-a.center[0],b.center[2]-a.center[2])>.6)continue;
 stairSteps++;
 for(let k=0;k<=10;k++){
  const p=new T.Vector3(...a.center).lerp(new T.Vector3(...b.center),k/10);
  ray.origin.copy(p).y+=.45;const hit=col.raycastGround(ray,.9);
  assert(hit&&clear(p.x,hit.point.y,p.z),'Garden stair headroom '+a.id);
 }
}
assert(stairSteps>40);
for(const y of [28.3,32.3]){
 assert(!clear(S.edge,y,S.z+1.3)&&!clear(S.edge,y,S.z-1.3),'The rails still guard both sides of the gap');
 assert(!clear(S.x+S.radius-.03,y,S.z),'Glass at the back of the shaft prevents step-off');
}
const closed=new T.Group();box(closed,'Old_unsplit_upper_rail',[.07,1.1,2.3],[S.edge,28.85,S.z]);col.addStatic(closed);col.commit();
assert(!clear(S.edge,28.3,S.z),'Negative control: the old rail would block boarding');
const overhang=new T.Group();box(overhang,'Old_overhang_floor',[2.77,.24,.4],[-89.115,28.18,-49.6]);col.addStatic(overhang);col.commit();
seg.start.set(-89.8,26.1333332+.75,-50);seg.end.set(-89.8,26.1333332+1.65,-50);
assert(col.overlaps(seg,.35),'Negative control: former floor strip blocks stair headroom');
console.log('PASS aligned clubhouse shaft, level doors, locked and summoned gates, both upper round trips, old walls and '+stairSteps+' stair transitions');
