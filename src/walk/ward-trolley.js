import {roomObject} from '../plan/rooms.js';
import * as T from 'three';

// Deck 5's Medical ward gets a compact supply trolley beside the nearest right-hand bay, clear of the aisle line.
// Room frame (Area_d05-ward-1): the aisle edge is z=2; the first right-hand bed is at x=-18, z=5.5.
const ROOM='Area_d05-ward-1';
export const TROLLEY_SPOT={x:-19.9,z:3.42,turn:0};

const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Ward_trolley_'+name,color,roughness:.55,...o});

function trolley(){
 const white=mat('frame',0xf1f3f2),trayMat=mat('tray',0xe4e9e8),teal=mat('caster',0x4f8584,{roughness:.72}),
  tire=mat('tire',0x365d5d,{roughness:.8}),steel=mat('steel',0xaab7b7,{metalness:.55,roughness:.4}),
  towel=mat('towel',0xf7f7f2,{roughness:.9}),blueTowel=mat('towel_blue',0xc5dcdf,{roughness:.9}),
  pack=mat('medical_pack',0xf8f8f5),label=mat('pack_label',0x77aeb0),coral=mat('pouch',0xe77b70,{roughness:.75}),
  cross=mat('cross',0xffffff,{roughness:.8});
 const g=new T.Group();g.name='Ward_supply_trolley';
 const add=(name,geo,m,at,rot)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...at);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const box=(name,size,at,m)=>add(name,new T.BoxGeometry(...size),m,at);
 const tube=(name,a,b,r,m)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),o=add(name,new T.CylinderGeometry(r,r,va.distanceTo(vb),8),m,va.clone().add(vb).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return o;};
 for(const x of [-.24,.24])for(const z of [-.19,.19]){
  add('Ward_trolley_wheel',new T.CylinderGeometry(.07,.07,.052,12).rotateZ(Math.PI/2),tire,[x,.085,z]);
  add('Ward_trolley_hub',new T.CylinderGeometry(.032,.032,.056,10).rotateZ(Math.PI/2),teal,[x,.085,z]);
  tube('Ward_trolley_caster_stem',[x,.13,z],[x,.2,z],.022,teal);
 }
 for(const x of [-.25,.25])for(const z of [-.2,.2])tube('Ward_trolley_post',[x,.18,z],[x,.99,z],.018,white);
 for(const y of [.29,.64])for(const z of [-.2,.2])tube('Ward_trolley_tray_support',[-.25,y,z],[.25,y,z],.012,steel);
 tube('Ward_trolley_handle',[-.25,1.02,-.2],[.25,1.02,-.2],.022,white);
 for(const y of [.34,.69]){
  box('Ward_trolley_tray_bottom',[.56,.035,.46],[0,y,0],trayMat);
  for(const z of [-.215,.215])box('Ward_trolley_tray_lip',[.56,.06,.03],[0,y+.035,z],trayMat);
  for(const x of [-.265,.265])box('Ward_trolley_tray_lip',[.03,.06,.46],[x,y+.035,0],trayMat);
 }
 // Folded towels ride on the upper tray; small packs sit below.
 box('Ward_trolley_towel',[.22,.055,.18],[-.13,.78,.02],towel);
 box('Ward_trolley_towel_fold',[.22,.035,.18],[-.13,.825,.02],blueTowel);
 for(const [x,z] of [[.12,-.12],[.12,.04],[.12,.17],[-.12,-.13]]){
  box('Ward_trolley_med_pack',[.12,.085,.09],[x,.405,z],pack);
  box('Ward_trolley_pack_label',[.075,.008,.012],[x,.451,z-.05],label);
 }
 // The coral pouch faces the aisle.
 box('Ward_trolley_pouch',[.19,.19,.055],[.08,.56,-.24],coral);
 box('Ward_trolley_cross',[.1,.026,.008],[.08,.56,-.273],cross);
 box('Ward_trolley_cross',[.026,.1,.008],[.08,.56,-.273],cross);
 return g;
}

// The trolley draws with the ward deck and collides as one plain box.
export function createWardTrolley(ship){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Ward_supply_trolley_world';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const {x,z,turn}=TROLLEY_SPOT,model=trolley();model.position.set(x,0,z);model.rotation.y=turn;group.add(model);
 const solid=new T.Group();solid.name='Ward_supply_trolley_collider';
 room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const proxy=new T.Mesh(new T.BoxGeometry(.7,1.08,.64),new T.MeshBasicMaterial());
 proxy.name='Ward_supply_trolley_solid';proxy.position.set(x,.54,z);proxy.rotation.y=turn;solid.add(proxy);
 return {group,solid};
}
