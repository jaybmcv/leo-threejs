import * as T from 'three';
import {setAtriumRealRooms} from './atrium-visibility.js';

// The atrium's cabins as the walk draws them, chosen by what the camera can see and never by the walker's height.
//
// Every atrium cabin has a stand-in that looks the same from any deck and any distance:
//  - a card across its atrium window, painted with the walk's own capture of a cabin's inside (atrium-room-views.js).
//    The capture is looked up where the sight line through the card meets the room's walls, floor or ceiling, so the
//    room keeps its depth and perspective as the camera moves. The card is solid: whatever is drawn behind it (the real
//    cabin on the walker's own deck and its furniture) is covered, so a deck no longer looks different because the
//    walker stands on it. It lies just inside the window pane;
//  - the real cabin's own window pane (the same part, in the same glass), wherever the real cabin does not draw, so
//    every window is tinted alike and the card and the real room behind it are seen through the same glass;
//  - its two side walls, in the real wall's own material, a centimetre inside the real wall's outer face, with the
//    wall's ends (the pier between two windows), the ceiling's edge above each end and its top. A cabin at the end of a wing
//    shows a wall there, as the real one does (the old stand-in was drawn from the inside only, so every wing end but
//    the walker's deck was open to view, 2026-11-13 glide video), and nothing shows between or above the windows;
//  - its corridor end, the same pale surface as the frosted corridor glass, and its window frame (the facade's own
//    P6_Flowing_atrium_window_* stand-ins, atrium-visibility.js). These two show only where the real cabin does not.
//
// The real cabin takes over by distance from the camera to its window. Within ROOMS.far metres the card dissolves in a
// screen-space dither (whole at far, gone at near) and the real room shows through it. The real room is there on any
// deck: on the walker's own deck from the deck's own meshes, as always, and on every other deck from a small pool of
// instanced copies of the same parts, filled with the cabins within ROOMS.reach metres whose window faces the camera.
// So climbing, falling, gliding or swinging past the terraces changes nothing in a room until the camera is close to it,
// and then it changes with distance, one room at a time.
//
// Nothing here is seen by the owner bake: it leaves out instanced meshes (scripts/walk-owner-bake.scene.js).
export const ROOMS={near:5,far:8,reach:9.5,keep:10.5,cap:64};
// A cabin part draws while the walker's band, 0.5 m below the feet to 3.5 m above, overlaps it by more than a
// centimetre: standing on a deck, the ceiling of the cabins below ends exactly at the band's foot and stays out.
export const cabinBandShown=(low,high,y)=>low<y+3.49&&high>y-.49;
// A cabin's clear inside faces (src/v2/cabins.js): +/-1.59 across, 3.4 high, +/-3.7 along; its side walls reach 1.71.
// Its ceiling is a 0.1 m slab over the clear height, ending with the room.
// The atrium pane is 3.5 cm of glass outside the room's end face; the card lies half a centimetre inside that face, in
// front of everything in the room (its glass rail reaches 3.69).
const HALF=[1.59,1.7,3.7],CARD_Z=3.695,SIDE_X=1.7,WALL_X=1.71,SIDE_Z=3.82,CAP_Z=3.815,HEAD_Z=3.695,HEAD=.1,LID=.095,END_Z=3.72;
export const cabinDoorSide=c=>{const dx=c.door.center[0]-c.x,dz=c.door.center[2]-c.z;return Math.sin(c.yaw)*dx+Math.cos(c.yaw)*dz>0?1:-1;};

// Flat faces from corner lists, each wound to face its normal.
function faces(list){
 const position=[],normal=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3();
 for(const [corners,towards] of list){
  a.set(...corners[0]);b.set(...corners[1]).sub(a);c.set(...corners[2]).sub(a);n.set(...towards);
  for(const i of b.cross(c).dot(n)>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]){position.push(...corners[i]);normal.push(...towards);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(position,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(position.length/3*2),2));return g;
}
const [HX,HY]=HALF;
// The card across the atrium window (the end away from the door), facing the atrium.
const cardGeometry=side=>faces([[[[-HX,-HY,-side*CARD_Z],[HX,-HY,-side*CARD_Z],[HX,HY,-side*CARD_Z],[-HX,HY,-side*CARD_Z]],[0,0,-side]]]);
// Both side walls' outer faces, their four end faces, the ceiling's edge over each end, and the ceiling's top: the deck
// slab above starts 8 cm higher at the atrium's edge, and the camera looks down through that slot from the decks above.
const sideGeometry=()=>faces([...[-1,1].flatMap(s=>[[[[s*SIDE_X,-HY,-SIDE_Z],[s*SIDE_X,-HY,SIDE_Z],[s*SIDE_X,HY,SIDE_Z],[s*SIDE_X,HY,-SIDE_Z]],[s,0,0]],
 ...[-1,1].map(e=>[[[s*HX,-HY,e*CAP_Z],[s*WALL_X,-HY,e*CAP_Z],[s*WALL_X,HY,e*CAP_Z],[s*HX,HY,e*CAP_Z]],[0,0,e]])]),
 ...[-1,1].map(e=>[[[-HX,HY,e*HEAD_Z],[HX,HY,e*HEAD_Z],[HX,HY+HEAD,e*HEAD_Z],[-HX,HY+HEAD,e*HEAD_Z]],[0,0,e]]),
 [[[-HX,HY+LID,-HEAD_Z],[HX,HY+LID,-HEAD_Z],[HX,HY+LID,HEAD_Z],[-HX,HY+LID,HEAD_Z]],[0,1,0]]]);
// The corridor end, for a cabin whose door is towards +z (the others are turned half round).
const endGeometry=()=>faces([[[[-HX,-HY,END_Z],[HX,-HY,END_Z],[HX,HY,END_Z],[-HX,HY,END_Z]],[0,0,1]]]);

const f=v=>v.toFixed(3);
// The card's material: the capture, looked up where the sight line through each fragment leaves the room's box (the
// card lies just inside the box's window face) as seen from where the capture was taken, and the dither that lets the
// real room through near the camera.
// It is shown as captured (the capture holds the frame's final colours), so it is not tone mapped again.
export function roomCardMaterial(view){
 const m=new T.MeshBasicMaterial({name:'P6_atrium_room_card'});m.toneMapped=false;
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,{roomView:{value:view.full.texture},roomRot:{value:view.rotation},roomEye:{value:view.eye}});
  s.vertexShader=s.vertexShader.replace('void main() {','varying vec3 vRoomP;\nvarying vec3 vRoomEye;\nvarying float vRoomFade;\nvoid main() {')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
	{mat4 roomM=modelMatrix*instanceMatrix;vRoomP=position;vRoomEye=(cameraPosition-roomM[3].xyz)*mat3(roomM);
	vRoomFade=smoothstep(${f(ROOMS.near)},${f(ROOMS.far)},distance(cameraPosition,(roomM*vec4(0.,0.,position.z,1.)).xyz));}`);
  s.fragmentShader=s.fragmentShader.replace('void main() {','uniform samplerCube roomView;\nuniform mat3 roomRot;\nuniform vec3 roomEye;\nvarying vec3 vRoomP;\nvarying vec3 vRoomEye;\nvarying float vRoomFade;\nconst float ROOM_BAYER[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);\nvoid main() {\n\tif(vRoomFade<.999){ivec2 q=ivec2(gl_FragCoord.xy)&3;if((ROOM_BAYER[q.x+q.y*4]+.5)/16.>=vRoomFade)discard;}')
   .replace('vec4 diffuseColor = vec4( diffuse, opacity );',`vec3 roomRay=vRoomP-vRoomEye;roomRay=mix(roomRay,vec3(1e-5),lessThan(abs(roomRay),vec3(1e-5)));
	vec3 roomT=(sign(roomRay)*vec3(${HALF.map(f).join(',')})-vRoomP)/roomRay;
	vec3 roomHit=vRoomP+roomRay*max(min(roomT.x,min(roomT.y,roomT.z)),0.);
	vec4 diffuseColor=vec4(sRGBTransferEOTF(textureCube(roomView,roomRot*(roomHit-roomEye))).rgb,opacity);`);};
 m.customProgramCacheKey=()=>'atrium-room-card';return m;
}

// Which cabins are real now: 1 on a deck the walker's band shows, 2 within reach of the camera on another deck (held
// to ROOMS.keep, so a camera hovering at the edge does not flick a room in and out), 0 neither. `cabins` hold
// {y, window:[x,y,z], out:[x,z]}. Only a camera on the atrium side of a window reaches its cabin, so from inside the
// ship (a corridor, a cabin) the rooms above and below are left alone. The reach is not held back while the atrium is
// judged out of sight: the card dissolves by distance whatever that judgement says, and must never open on nothing.
export function atriumRoomStates(cabins,state,eye,walkerY){
 let changed=false;const near=ROOMS.reach**2,keep=ROOMS.keep**2;
 for(let i=0;i<cabins.length;i++){const c=cabins[i];let s=cabinBandShown(c.y-.14,c.y+3.5,walkerY)?1:0;
  if(!s){const dx=eye.x-c.window[0],dy=eye.y-c.window[1],dz=eye.z-c.window[2];if(dx*dx+dy*dy+dz*dz<(state[i]===2?keep:near)&&dx*c.out[0]+dz*c.out[1]>0)s=2;}
  if(s!==state[i]){state[i]=s;changed=true;}}
 return changed;
}

/** `parent`: the group the facade's stand-ins hang in. `placements`: the walk's cabins ({id, view, door, x, y, z, yaw,
 * matrix, key}). `views`: Map door side -> {full: cube target, rotation} from atriumRoomViewJob. `instanced`: the
 * walk's instanced meshes (cabin parts carry userData.cabins and cabinIds). `lining`: the cabin walls' material.
 * Returns {update(camera, walkerPosition), stats}. */
export function createAtriumRooms({scene,parent,placements,views,instanced,lining}){
 const list=placements.filter(c=>c.view==='atrium'&&c.door).map(c=>({c,side:cabinDoorSide(c)})).filter(r=>views.get(r.side)?.full);
 if(!list.length||!parent)return null;
 lining||=new T.MeshStandardMaterial({name:'V2_lining',color:0xdce1db,roughness:.58,metalness:.04});
 const up=new T.Matrix4().makeTranslation(0,HY,0),turn=new T.Matrix4().makeRotationY(Math.PI),v=new T.Vector3(),stats={cabins:list.length,shown:0,reached:0,changes:0};
 const cabins=list.map(({c,side})=>{const room=c.matrix.clone().multiply(up),e=room.elements;
  v.set(0,0,-side*HALF[2]).applyMatrix4(room);
  return {id:c.id,y:c.y,side,key:c.key||c.type+'|'+side,matrix:c.matrix,room,window:v.toArray(),out:[-side*e[8],-side*e[10]]};});
 const state=new Uint8Array(cabins.length);
 // The stand-ins. The cards and side walls always draw; the corridor ends and panes only for cabins that are not real.
 const stand=(name,geometry,material,rows,matrixOf)=>{const o=new T.InstancedMesh(geometry,material,rows.length);o.name=name;o.frustumCulled=false;o.userData={noCollide:true,phase6Architecture:true,atriumRoom:true};
  rows.forEach((r,i)=>o.setMatrixAt(i,matrixOf(r,i)));parent.add(o);return o;};
 for(const side of [-1,1]){const rows=cabins.filter(r=>r.side===side);if(rows.length)stand('P6_atrium_room_card',cardGeometry(side),roomCardMaterial(views.get(side)),rows,r=>r.room);}
 stand('P6_atrium_room_sides',sideGeometry(),lining,cabins,r=>r.room);
 const endMatrix=cabins.map(r=>r.side>0?r.room:r.room.clone().multiply(turn)),ends=stand('P6_atrium_room_ends',endGeometry(),lining,cabins,(r,i)=>endMatrix[i]);
 ends.instanceMatrix.setUsage(T.DynamicDrawUsage);
 // A deck's cabin parts show together, by the deck's own height range: a bed's own range is half a metre, so a walker
 // two metres up (a jump, a swing, a stair) drew that deck's walls without its beds.
 const byId=new Map(placements.map(c=>[c.id,c]));
 for(const o of instanced){const c=o.userData.cabins&&byId.get(o.userData.cabinIds?.[0]);if(c)o.userData.band=[c.y-.14,c.y+3.5];}
 // The pool: for each kind of atrium cabin, one instanced copy of each of its parts (the deck meshes' own geometry and
 // material, so no shader is compiled for them) with room for ROOMS.cap cabins, and the frosted corridor glass with it.
 const pool=new T.Group();pool.name='V2_atrium_reach_cabins';pool.userData.noCollide=true;scene.add(pool);
 const frost=scene.getObjectByName('V2_local_privacy')?.children.filter(o=>o.isInstancedMesh)||[],m4=new T.Matrix4();
 const frostAt=(o,c)=>{if(Math.abs(o.userData.y-c.y)>.01)return false;const p=c.matrix.elements;for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);if(Math.hypot(m4.elements[12]-p[12],m4.elements[14]-p[14])<.8)return true;}return false;};
 const kinds=new Map();
 for(const [i,r] of cabins.entries()){let k=kinds.get(r.key);
  if(!k){const sources=[...instanced.filter(o=>o.userData.cabins&&o.userData.cabinIds?.includes(r.id)),...frost.filter(o=>frostAt(o,r))];
   const copy=(to,src,size,name)=>{src.updateWorldMatrix(true,false);const o=new T.InstancedMesh(src.geometry,src.material,size);o.name=name;o.count=0;o.visible=false;o.frustumCulled=false;
    o.matrixAutoUpdate=false;o.matrix.copy(src.matrixWorld);o.renderOrder=src.renderOrder;o.layers.mask=src.layers.mask;o.castShadow=src.castShadow;o.receiveShadow=src.receiveShadow;
    o.userData={noCollide:true,atriumRoom:true};o.instanceMatrix.setUsage(T.DynamicDrawUsage);to.add(o);return o;};
   const pane=sources.find(o=>o.name==='Cabin_v2_shell_V2_cabin_view_glass'),all=cabins.filter(q=>q.key===r.key);
   k={all,rows:[],shown:'',parts:sources.map(src=>copy(pool,src,ROOMS.cap,'Reach_'+src.name)),pane:pane?copy(parent,pane,all.length,'P6_atrium_room_pane'):null};
   kinds.set(r.key,k);}
  r.kind=k;r.at=i;}
 function apply(){
  stats.changes++;stats.shown=stats.reached=0;
  for(const k of kinds.values())k.rows.length=0;
  const real=new Set();let rest=0;
  for(let i=0;i<cabins.length;i++){const r=cabins[i],s=state[i];
   if(s){real.add(r.id);if(s===1)stats.shown++;else if(r.kind.rows.length<ROOMS.cap){r.kind.rows.push(r);stats.reached++;}}
   else endMatrix[i].toArray(ends.instanceMatrix.array,rest++*16);}
  ends.count=rest;ends.visible=rest>0;ends.instanceMatrix.needsUpdate=true;
  for(const k of kinds.values()){
   if(k.pane){let n=0;for(const r of k.all)if(!state[r.at])r.matrix.toArray(k.pane.instanceMatrix.array,n++*16);k.pane.count=n;k.pane.visible=n>0;k.pane.instanceMatrix.needsUpdate=true;}
   const shown=k.rows.map(r=>r.id).join();if(shown===k.shown)continue;k.shown=shown;
   for(const o of k.parts){k.rows.forEach((r,n)=>r.matrix.toArray(o.instanceMatrix.array,n*16));o.count=k.rows.length;o.visible=o.count>0;o.instanceMatrix.needsUpdate=true;}}
  pool.visible=stats.reached>0;
  // The facade's window frames stand in only where the real frame does not draw.
  setAtriumRealRooms(real);
 }
 const eye=new T.Vector3();
 function update(camera,p){if(atriumRoomStates(cabins,state,eye.setFromMatrixPosition(camera.matrixWorld),p.y)||!stats.changes)apply();}
 return {update,stats,state,cabins,pool};
}
