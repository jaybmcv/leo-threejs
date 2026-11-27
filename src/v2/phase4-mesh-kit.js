import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {removeGeometryCaps} from './geometry.js';
import {greenRoomGeometry,greenRoomMaterials} from './green-room-fitout.js';
function removeTopCap(g){g.computeBoundingBox();const p=g.attributes.position,ix=g.index,top=g.boundingBox.max.y,keep=[];for(let i=0;i<ix.count;i+=3){const ids=[0,1,2].map(k=>ix.getX(i+k));if(!ids.every(id=>Math.abs(p.getY(id)-top)<1e-7))keep.push(...ids);}g.setIndex(keep);g.clearGroups();}
const colours={resident:0xbd826d,oak:0xb9966f,cream:0xe4e5de,stone:0xc9bca6,teal:0x357b82,sage:0x637e64,clay:0x996954,navy:0x172e3b,metal:0x8d9da2,orange:0xe88032,green:0x507c50,light:0xffedca,screen:0x234b67,water:0x469ba7,red:0x9d1631,alarm:0xd92332},mats=new Map();
export const atriumGlass=new T.MeshStandardMaterial({name:'P4_atrium_glass',color:0x9abcc6,transparent:true,opacity:.20,roughness:.3,side:T.DoubleSide});
const greenRoomPrefix='green_room_';
export const greenRoomMaterialKey=name=>Object.hasOwn(greenRoomMaterials,name)?greenRoomPrefix+name:name;
export function material(name){
 if(!mats.has(name)){
  const greenRoom=name.startsWith(greenRoomPrefix),finishName=greenRoom?name.slice(greenRoomPrefix.length):name;
  const finish=greenRoomMaterials[finishName],m=new T.MeshStandardMaterial({name:'P4_'+name,color:colours[name]??0xffffff,roughness:name==='metal'?.42:.72,metalness:name==='metal'?.45:0,...(['light','screen'].includes(name)?{emissive:colours[name],emissiveIntensity:name==='light'?1:.45}:{}),...finish});
  // The Green Room's finishes stay dim from either side of the doorway. Keep the glowing fixtures bright.
  if(greenRoom&&finish&&!['fuchsia','mint','amber'].includes(finishName)){
   const light=finishName==='lacquer'||finishName==='brass'?.55:.32;
   m.color.multiplyScalar(light);m.emissiveIntensity*=light;
  }
  mats.set(name,m);
 }
 return mats.get(name);
}

export function fitoutGeometry(b){if(b.part.startsWith('green_room_')){const g=greenRoomGeometry(b);if(g)return g;}if(b.part==='emergency_drill_button')return new T.CylinderGeometry(b.size[1]/2,b.size[2]/2,b.size[0],24).rotateZ(Math.PI/2);const geo=b.part==='p6_tree_crown'?new T.IcosahedronGeometry(1,1).scale(...b.size.map(x=>x/2)):b.part==='p6_tree_trunk'?new T.CylinderGeometry(.16,.22,b.size[1],7):b.round?new RoundedBoxGeometry(...b.size,1,Math.min(.08,...b.size.map(x=>x/4))):new T.BoxGeometry(...b.size);if(/shuttle_(side_wall|bow_bulkhead|stern_wall)/.test(b.part))removeGeometryCaps(geo,1);if(b.part==='shuttle_side_wall')removeGeometryCaps(geo,0);if(/shuttle_.*wall_header/.test(b.part)){removeGeometryCaps(geo,2);removeTopCap(geo);}return geo;}
