import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {polygonGeometry} from '../src/v2/geometry.js';
import {createShipArea,SHIP_AREAS} from '../src/areas.js';
import {stripCargoMaintenance} from '../src/walk/mct-bay.js';
import {Colliders} from '../src/walk/collision.js';
import * as visitor from '../src/walk/transporter.js';
import * as authoring from '../src/walk/transporter.authoring.js';

// Exercise the real room shells and driving collision, without the full furnished ship.
const rooms=layout.rooms.filter(r=>r.deck===1&&!r.aggregate),width=1.52,clearance=.15;
const entries=r=>[r.door,r.fittingDoor,...(r.galleryDoors||[]),...(r.bayAccessDoors||[])].filter(Boolean);
const walkOnly=rooms.filter(r=>!entries(r).some(d=>d.width>=width+2*clearance));
assert.equal(walkOnly.length,0,'Review narrow rooms before allowing the MCT');
// Both road ends use the same shell/finish entry. The new aft cut must leave its jambs and header solid.
const cargo=rooms.find(r=>r.id==='d01-workshop-5'),forward=cargo.galleryDoors.find(d=>d.id===cargo.id+'-street-door'),aft=cargo.galleryDoors.find(d=>d.id===cargo.id+'-aft-street-door');
assert(aft&&forward,'Cargo road must have both street doorways');
assert.equal(aft.width,forward.width);assert.equal(aft.width,4);
assert.deepEqual(aft.center,[Math.min(...cargo.polygon.map(p=>p[0])),cargo.y,forward.center[2]]);
const cargoShell=new T.Group(),source=createShipArea(SHIP_AREAS.find(r=>r.id===cargo.id));cargoShell.add(source.root);
const cargoShip={root:cargoShell,inside:cargoShell,cutaway:new Set([source.shell])};stripCargoMaintenance(cargoShip);buildRoomShell(cargoShip,cargo,cargoShell);
const sign=source.root.getObjectByName('Cargo_aft_identity_panel'),title=source.root.getObjectByName('Cargo_aft_identity_text');
assert(sign&&title,'Aft doorway must carry the matching room sign');
sign.geometry.computeBoundingBox();assert(sign.position.y+sign.geometry.boundingBox.min.y>2.5,'Room sign must stay above the doorway');
const deck=layout.decks[0],slab=new T.Mesh(polygonGeometry(deck.slab.outline,deck.slab.holes.map(h=>h.polygon),deck.y));cargoShell.add(slab);
const cargoCol=new Colliders();cargoCol.addStatic(cargoShell);cargoCol.commit();
const [ax,ay,az]=aft.center,capsule=(x,z)=>new T.Line3(new T.Vector3(x,ay+.8,z),new T.Vector3(x,ay+1.65,z));
for(const z of [az-1.5,az,az+1.5])for(let x=ax-3;x<=ax+3;x+=.15){
 assert(!cargoCol.overlaps(capsule(x,z),.35),'Aft cargo doorway must admit the walking capsule');
 const ground=cargoCol.raycast(new T.Ray(new T.Vector3(x,ay+.5,z),new T.Vector3(0,-1,0)),1);
 assert(ground&&ground.normal.y>.9&&Math.abs(ground.point.y-ay)<.01,'Cargo threshold must retain continuous level floor');
}
for(const z of [az-3.3,az+3.3])assert(cargoCol.overlaps(capsule(ax,z),.35),'Wall beside the aft cargo doorway stays solid');
assert(cargoCol.raycast(new T.Ray(new T.Vector3(ax+1,ay+2.75,az),new T.Vector3(-1,0,0)),2),'Aft cargo doorway retains its header');
let crossings=0;
for(const r of rooms){
 const root=new T.Group();buildRoomShell({root:new T.Group(),cutaway:new Set()},r,root);
 for(const d of entries(r)){
  // The fitting airlock has its approach on the opposite face from the planned aft door.
  const n=d.outward||[1,0],at=d.center;
  const corridor=new T.Mesh(new T.BoxGeometry(24,.2,24));corridor.position.set(at[0],r.y-.1,at[2]);root.add(corridor);
  const colliders=new Colliders();colliders.addStatic(root);colliders.commit();
  for(const api of [visitor,authoring])for(const direction of [1,-1]){
   const home={at:[at[0]+n[0]*6,r.y,at[2]+n[1]*6],yaw:Math.atan2(-n[0],-n[1])};
   const c=api.createCart(0,home),world={colliders,lifts:{lifts:[]},others:[]};
   if(direction<0){c.pos.set(at[0]-n[0]*3.5,r.y,at[2]-n[1]*3.5);c.yaw=home.yaw+Math.PI;}
   assert(!api.cartBlocked(c,world),r.id+' approach must start clear');
   for(let i=0;i<200;i++){api.driveCart(c,.05,1,0,world);if(direction*((c.pos.x-at[0])*n[0]+(c.pos.z-at[2])*n[1])<-3.5)break;}
   const along=(c.pos.x-at[0])*n[0]+(c.pos.z-at[2])*n[1];
   assert(direction*along<-3.5,r.id+' '+d.id+' must admit and release the whole cart');
   assert(!api.cartBlocked(c,world),r.id+' cart must finish clear of walls');crossings++;
  }
  corridor.removeFromParent();
 }
}
// Missing floors, other decks, lift alcoves, walls and other carts remain solid boundaries.
for(const api of [visitor,authoring]){
 const home={at:[0,-39.7,0],yaw:0},c=api.createCart(0,home),floor=new T.Group();
 const slab=new T.Mesh(new T.BoxGeometry(40,.2,40));slab.position.y=home.at[1]-.1;floor.add(slab);
 const colliders=new Colliders();colliders.addStatic(floor);colliders.commit();
 const world={colliders,lifts:{lifts:[]},others:[]};assert(api.cartFits(c,world));
 assert(!api.cartFits(c,{...world,colliders:new Colliders()}),'Missing floor stays forbidden');
 c.pos.y+=4;assert(!api.cartFits(c,world),'Other decks stay forbidden');c.pos.y=home.at[1];
 assert(!api.cartFits(c,{...world,lifts:{lifts:[{spec:{car:{x:0,z:0,width:3,depth:4}},stops:[{y:home.at[1]}]}]}}),'Lifts stay forbidden');
 const other=api.createCart(1,home);assert(api.cartBlocked(c,{...world,others:[other]}),'Other carts stay solid');
 // A 1.4 m opening is too small for the unchanged 1.5 m collision width.
 for(const x of [-5.7,5.7]){const wall=new T.Mesh(new T.BoxGeometry(10,3,.3));wall.position.set(x,home.at[1]+1.5,4);floor.add(wall);}
 const narrow=new Colliders();narrow.addStatic(floor);narrow.commit();
 for(let i=0;i<160;i++)api.driveCart(c,.05,1,0,{...world,colliders:narrow});
 assert(c.pos.z+api.MCT.circles[0]<4,'Narrow doorway must stop the cart');
 assert.equal(api.MCT.radius,.75);assert.equal(api.MCT.half,.75);
}
console.log('PASS '+rooms.length+' Deck 1 rooms; '+crossings+' shell crossings in both source modes; floor, lift, narrow-door and cart boundaries retained.');
