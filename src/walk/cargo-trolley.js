import {roomObject} from '../plan/rooms.js';
import * as T from 'three';

// Container hold A on Deck 1 gets a parked two-wheel hand trolley: a warm-orange frame and handle, charcoal-teal wheels
// and one carton held on its nose plate by a bright teal strap. It stands upright at the first container on the left
// as you come in, just in front of that container's floor restraint rail, so the lane between the containers and the
// amber aisle lines stays open. A static prop: solid as one plain box, nothing to use.
// Room frame (Area_d01-cargo-1): the entrance at x=-25.92 (doorway |z|<2), the amber aisle lines at z=±2, the first
// left container at x -21..-15, z -13.25..-8.75 with its restraint rail at z -8.37..-8.23 (0.16 m high).
const ROOM='Area_d01-cargo-1';
// Where it stands (the trolley's own origin: the floor under its frame) and its turn; its back faces the container.
export const TROLLEY_SPOT={x:-16.6,z:-7.88,turn:.12};

// The trolley in its own frame: floor at y=0, the nose plate toward +z, the wheels and handle toward -z.
function trolley(){
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Cargo_trolley_'+name,color,roughness:.5,...o});
 const orange=mat('frame',0xe8782c,{roughness:.42,metalness:.25}),steel=mat('steel',0x8c989b,{metalness:.7,roughness:.35}),
  tyre=mat('wheel',0x24383c,{roughness:.8}),hub=mat('hub',0x3f6d72,{metalness:.4,roughness:.4}),grip=mat('grip',0x1d2427,{roughness:.85}),
  card=mat('carton',0xb88a55,{roughness:.9}),tape=mat('tape',0xd9c79a),strap=mat('strap',0x19c4b6,{roughness:.55});
 const g=new T.Group();g.name='Cargo_trolley';
 const add=(name,geo,material,at)=>{const o=new T.Mesh(geo,material);o.name=name;o.position.set(...at);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const box=(name,size,at,material)=>add(name,new T.BoxGeometry(...size),material,at);
 const tube=(name,a,b,r,material)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),o=add(name,new T.CylinderGeometry(r,r,va.distanceTo(vb),8),material,va.clone().add(vb).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return o;};
 // The frame leans back a little from the nose plate to the handle; `at(y)` is its depth at a height.
 const y0=.05,y1=1.18,back=-.11,at=y=>back*(y-y0)/(y1-y0);
 for(const s of [-1,1])tube('Cargo_trolley_upright',[s*.2,y0,0],[s*.2,y1,back],.018,orange);
 for(const y of [.42,.72,.98])tube('Cargo_trolley_crossbar',[-.2,y,at(y)],[.2,y,at(y)],.012,orange);
 tube('Cargo_trolley_handle',[-.2,y1,back],[.2,y1,back],.02,orange);
 tube('Cargo_trolley_grip',[-.13,y1,back],[.13,y1,back],.027,grip);
 box('Cargo_trolley_nose_plate',[.46,.02,.3],[0,.01,.14],steel);
 box('Cargo_trolley_toe',[.44,.07,.025],[0,.045,-.004],steel);
 // The wheels sit behind the frame on a short axle, braced up to the uprights.
 tube('Cargo_trolley_axle',[-.29,.13,-.1],[.29,.13,-.1],.014,steel);
 for(const s of [-1,1]){
  tube('Cargo_trolley_brace',[s*.2,.34,at(.34)],[s*.2,.13,-.1],.012,orange);
  for(const [name,r,w,m] of [['Cargo_trolley_wheel',.13,.075,tyre],['Cargo_trolley_hub',.055,.085,hub]])add(name,new T.CylinderGeometry(r,r,w,14).rotateZ(Math.PI/2),m,[s*.27,.13,-.1]);
 }
 // The carton on the nose plate, taped shut, with the teal strap round it and the frame.
 box('Cargo_trolley_carton',[.4,.36,.28],[0,.2,.145],card);
 box('Cargo_trolley_carton_tape',[.07,.004,.282],[0,.382,.145],tape);
 box('Cargo_trolley_strap',[.412,.035,.3],[0,.26,.137],strap);
 box('Cargo_trolley_buckle',[.05,.045,.012],[0,.26,.292],steel);
 return g;
}

// The trolley in ship coordinates: `group` draws (with its deck band), `solid` is the plain box for the colliders.
export function createCargoTrolley(ship){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Cargo_trolley_hold_A';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Cargo_trolley_collider';
 room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const {x,z,turn}=TROLLEY_SPOT,t=trolley();t.position.set(x,0,z);t.rotation.y=turn;group.add(t);
 // The box spans the wheels at the back to the carton at the front.
 const o=new T.Mesh(new T.BoxGeometry(.66,1.24,.6).translate(0,0,.01));o.position.set(x,.62,z);o.rotation.y=turn;solid.add(o);
 return {group,solid};
}
