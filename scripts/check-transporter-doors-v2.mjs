import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {Colliders} from '../src/walk/collision.js';
import * as visitor from '../src/walk/transporter.js';
import * as authoring from '../src/walk/transporter.authoring.js';

// Exercise the real room shells and driving collision, without the full furnished ship.
const rooms=layout.rooms.filter(r=>r.deck===1&&!r.aggregate),width=1.52,clearance=.15;
const entries=r=>[r.door,r.fittingDoor,...(r.galleryDoors||[]),...(r.bayAccessDoors||[])].filter(Boolean);
const walkOnly=rooms.filter(r=>!entries(r).some(d=>d.width>=width+2*clearance));
assert.equal(walkOnly.length,0,'Review narrow rooms before allowing the MCT');
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
