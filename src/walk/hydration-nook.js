import {roomObject} from '../plan/rooms.js';
import {walkCanvas} from './canvas.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// The Deck 16 exercise studio's hydration and towel nook (from tester feedback): a slim teal refill dispenser with a
// tiny orange status light, a wall row of bottle cubbies and a low shelf of folded towels, against the end wall on the
// mats' side of the centre lane. Plain boxes and low cylinders, like the room's own equipment.
// Room frame (Area_d16-gym-3): the end wall's face at x=25.84 (its name panel above 2.2 m), the centre lane between the
// aisle lines at z=±2, treadmills along z=-10 and mats from z=6.7 out to x=16.
const ROOM='Area_d16-gym-3',WALL=25.84,DISPENSER=3.23,SHELF=4.65;

// A white water drop on a navy tile, for the dispenser's front.
function dropTexture(){
 const c=walkCanvas();c.width=c.height=64;const g=c.getContext('2d');
 g.fillStyle='#1d3443';g.fillRect(0,0,64,64);
 g.fillStyle='#e8fbff';g.beginPath();g.moveTo(32,10);g.bezierCurveTo(40,24,48,32,48,40);g.arc(32,40,16,0,Math.PI);g.bezierCurveTo(16,32,24,24,32,10);g.fill();
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

// The nook, placed in `ship`'s exercise studio. Returns {group, solid} in ship coordinates, or null if the room is missing.
export function createHydrationNook(ship){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Exercise_hydration_nook';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Exercise_hydration_nook_collider';
 room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Hydration_'+name,color,roughness:.7,...o});
 const M={teal:mat('teal',0x2f9e98,{roughness:.45}),white:mat('white',0xeef0ec,{roughness:.5}),navy:mat('navy',0x304e61),dark:mat('dark',0x1b262c),
  steel:mat('steel',0x9fb0b4,{roughness:.35,metalness:.6}),timber:mat('timber',0x9c7b55),
  towel:mat('towel',0xf4f2ec,{roughness:1}),towelTeal:mat('towel_teal',0x5fb3ad,{roughness:1}),towelGrey:mat('towel_grey',0xc3ced2,{roughness:1}),
  cap:mat('cap_orange',0xf26a1b,{roughness:.5}),orange:new T.MeshBasicMaterial({name:'Hydration_status',color:0xff7a1a,toneMapped:false}),
  label:new T.MeshStandardMaterial({name:'Hydration_label',map:dropTexture(),roughness:.6})};
 const parts=new Map();
 const piece=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g.index?g.toNonIndexed():g);};
 // Sizes are [x depth from the wall, height, z width]; positions are centres.
 const box=(m,[w,h,d],[x,y,z])=>piece(m,new T.BoxGeometry(w,h,d).translate(x,y,z));
 const can=(m,r,h,[x,y,z])=>piece(m,new T.CylinderGeometry(r,r,h,10).translate(x,y,z));

 // The refill dispenser: a teal column on a dark plinth, a recessed bay with a spout over a drip tray, the drop sign
 // and a tiny orange status light.
 const dx=WALL-.19,front=WALL-.38;
 box(M.dark,[.34,.08,.42],[dx,.04,DISPENSER]);
 box(M.teal,[.38,1.32,.46],[dx,.74,DISPENSER]);
 box(M.white,[.4,.1,.48],[dx,1.45,DISPENSER]);
 box(M.dark,[.02,.34,.3],[front-.005,1,DISPENSER]);
 box(M.steel,[.14,.03,.28],[front-.06,.86,DISPENSER]);
 can(M.steel,.016,.09,[front-.04,1.12,DISPENSER]);
 piece(M.label,new T.PlaneGeometry(.13,.13).rotateY(-Math.PI/2).translate(front-.006,1.27,DISPENSER-.05));
 box(M.orange,[.012,.03,.03],[front-.007,1.27,DISPENSER+.11]);

 // The low towel shelf: a navy carcass with a timber top, three neat stacks of folded towels in each bay and one on top.
 const sx=WALL-.24,half=.95;
 box(M.navy,[.44,.08,half*2-.04],[sx+.02,.04,SHELF]);
 for(const s of [-1,1])box(M.navy,[.48,.78,.04],[sx,.47,SHELF+s*(half-.02)]);
 box(M.navy,[.02,.78,half*2],[WALL-.01,.47,SHELF]);
 for(const y of [.1,.46])box(M.navy,[.48,.04,half*2],[sx,y,SHELF]);
 box(M.timber,[.5,.05,half*2+.04],[sx-.01,.865,SHELF]);
 const towel=new RoundedBoxGeometry(.32,.055,.28,2,.018);
 const stack=(m,n,y,z)=>{for(let i=0;i<n;i++)piece(m,towel.clone().translate(sx-.01+(i%2?.006:-.006),y+.0275+i*.056,z));};
 [[M.towelTeal,M.towel,M.towelGrey],[M.towel,M.towelTeal,M.towel]].forEach((row,j)=>row.forEach((m,i)=>stack(m,4+j,j?.48:.12,SHELF+(i-1)*.6)));
 stack(M.towel,3,.89,SHELF+.45);

 // The bottle cubbies over the shelf: six bays in a navy frame on a dark back, five of them holding a bottle.
 const cx=WALL-.13,y0=1.18,y1=1.56,bays=6,bw=.3,z0=SHELF-bays*bw/2;
 box(M.dark,[.015,y1-y0,bays*bw],[WALL-.008,(y0+y1)/2,SHELF]);
 for(const y of [y0,y1])box(M.navy,[.26,.03,bays*bw+.025],[cx,y,SHELF]);
 for(let i=0;i<=bays;i++)box(M.navy,[.26,y1-y0,.025],[cx,(y0+y1)/2,z0+i*bw]);
 const bottles=[[M.teal,M.white],[M.white,M.navy],null,[M.teal,M.cap],[M.steel,M.white],[M.white,M.teal]];
 bottles.forEach((b,i)=>{if(!b)return;const z=z0+(i+.5)*bw;can(b[0],.036,.2,[cx+.01,y0+.115,z]);can(b[1],.026,.035,[cx+.01,y0+.232,z]);});

 for(const [m,list] of parts){const o=new T.Mesh(mergeGeometries(list),m);o.name=m.name;o.castShadow=true;o.receiveShadow=true;group.add(o);}
 towel.dispose();
 // One plain box for the whole nook, so nobody walks into it.
 const block=new T.Mesh(new T.BoxGeometry(.5,1.6,SHELF+half-DISPENSER+.25));
 block.position.set(WALL-.25,.8,(DISPENSER-.25+SHELF+half)/2);solid.add(block);
 return {group,solid};
}
