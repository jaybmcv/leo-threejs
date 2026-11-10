import {RecordGeometry,recordMerged} from "../v2/prepared-geometry-record.js";
import {fitLoungeEntrance} from '../v2/community-routes.js';
import * as T from 'three';
import {placedV1,placeObject} from '../plan/placements.js';
import {mergeGeometries as nativeMergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture} from '../polish-kit.js';
import {floorY} from '../transit.authoring.js';

// The Hydro-Nip Lounge's two entrances, the aft gallery doors on Decks 19 and 18: out on the
// promenade, beside each doorway, a theatre-marquee board stands on two posts. It is square to the lounge's aft wall,
// on the side of the walkway that leads to the door, so it reads face-on as you come along that walkway and from the
// promenade beyond; both faces carry "Hydro-Nip Lounge" in lit lettering inside a ring of purple bulbs, under a purple
// tube round the rim. Its board is above head height and under the 3.64 m deck above; the walkway to the door passes
// under it between the posts. Like the canopy it replaces (which hung inside the door's neck and was seen edge-on from
// the walkway), it is dressing only: nothing in it is solid. Glow is emissive geometry, no real lights. In the group's frame (src/v2/community-routes.js fitLoungeEntrance) the door is centred on
// x 0 with its jambs at x ±1, y runs up from the deck's floor, the wall's outer face is z 0 and the promenade is +z;
// +x is the walkway's side. The board's plane is x BOARD.x, running out from z BOARD.z0.
const DOOR_HALF=1,PURPLE=0xa04dff,PALE=0xdcb8ff;
const BOARD={x:DOOR_HALF+.45,z0:.3,w:3.4,y0:2.5,y1:3.46},POST={r:.06,top:3.52},DEPTH=.2;
const SIZE=[2048,572];

// One neon catnip sprig: a stem and three serrated leaves, drawn pointing up from (x,y).
function sprig(g,x,y,s){
 g.save();g.translate(x,y);g.scale(s,s);g.lineCap=g.lineJoin='round';
 g.shadowColor='#7dff9a';g.shadowBlur=22;g.strokeStyle='#bfffcc';g.fillStyle='#2f9e57';g.lineWidth=.05;
 const leaf=(a,len)=>{g.save();g.rotate(a);g.beginPath();g.moveTo(0,0);
  for(const k of [0,1,2]){const t=(k+1)/3,w=.2*(1-.45*t);g.lineTo(-w,-len*(t-.1));g.lineTo(-w*.5,-len*(t-.02));}
  g.lineTo(0,-len*1.12);
  for(const k of [2,1,0]){const t=(k+1)/3,w=.2*(1-.45*t);g.lineTo(w*.5,-len*(t-.02));g.lineTo(w,-len*(t-.1));}
  g.closePath();g.fill();g.stroke();g.beginPath();g.moveTo(0,0);g.lineTo(0,-len*.95);g.stroke();g.restore();};
 leaf(-.75,.62);leaf(.75,.62);leaf(0,.9);
 g.beginPath();g.moveTo(0,0);g.lineTo(0,.42);g.stroke();g.restore();
}
// The fascia's face: near-black violet with a thin lit line inside the bulb ring, then the two lines of wording.
const paintFace=(g,w,h)=>{
 const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#1d0933');bg.addColorStop(.55,'#12041f');bg.addColorStop(1,'#0a0212');
 g.fillStyle=bg;g.fillRect(0,0,w,h);
 g.save();g.strokeStyle='rgba(190,120,255,.85)';g.lineWidth=5;g.shadowColor='#a04dff';g.shadowBlur=14;g.beginPath();g.moveTo(72,46);g.arcTo(w-46,46,w-46,h-46,26);g.arcTo(w-46,h-46,46,h-46,26);g.arcTo(46,h-46,46,46,26);g.arcTo(46,46,w-46,46,26);g.closePath();g.stroke();g.restore();
 g.textAlign='center';g.textBaseline='alphabetic';
 const brand='"Archivo", "Sora", sans-serif';
 g.shadowColor='#b566ff';g.shadowBlur=26;
 g.fillStyle='#ffe9b0';g.font=`600 112px ${brand}`;g.letterSpacing='30px';g.fillText('HYDRO-NIP',w/2+15,196);
 g.fillStyle='#fdf6ff';g.font=`800 232px ${brand}`;g.letterSpacing='34px';g.fillText('LOUNGE',w/2+17,432);g.letterSpacing='0px';
 for(const sx of [-1,1])sprig(g,w/2+sx*760,420,230);
};
// A rounded rectangle of board, extruded .2 m deep (its front face at z 0, its back at z −DEPTH).
function slab(w,h,r){
 const s=new T.Shape(),x=w/2,y=h/2;
 s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
 return new RecordGeometry("src/walk/lounge-entrance-signs.js:0",T.ExtrudeGeometry,s,{depth:DEPTH,bevelEnabled:false,curveSegments:6}).translate(0,0,-DEPTH);
}

function createSign(deck,key,mats){
 const group=new T.Group();group.name=`Lounge_entrance_sign_${deck}`;
 const [gx,,gz]=placedV1(key);group.position.set(gx,floorY(deck),gz);
 const parts=new Map(),add=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g);};
 const at=(g,x,y,z,rx=0,ry=0,rz=0)=>g.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);
 const bw=BOARD.w,bh=BOARD.y1-BOARD.y0,by=(BOARD.y0+BOARD.y1)/2,zc=BOARD.z0+bw/2;
 // The board is drawn facing +z (its width along x), then turned square to the wall and set out beside the door: its
 // front looks toward the walkway (+x), its back across the doorway.
 const out=g=>g.rotateY(Math.PI/2).translate(BOARD.x,0,zc);

 // The board, with the wording on both faces.
 add(mats.body,out(at(slab(bw,bh,.16),0,by,DEPTH/2)));
 add(mats.face,out(at(new RecordGeometry("src/walk/lounge-entrance-signs.js:1",T.PlaneGeometry,bw-.04,bh-.04),0,by,DEPTH/2+.003)));
 add(mats.face,out(at(new RecordGeometry("src/walk/lounge-entrance-signs.js:2",T.PlaneGeometry,bw-.04,bh-.04),0,by,-DEPTH/2-.003,0,Math.PI)));

 // A ring of bulbs just inside each face's edge, alternating pale and violet, and a purple tube round the rim.
 const bulb=()=>new RecordGeometry("src/walk/lounge-entrance-signs.js:3",T.SphereGeometry,.036,6,3);
 const ring=(zz,face)=>{
  const hx=bw/2-.12,hy=bh/2-.11,step=.14;let k=0;
  const put=(x,y)=>add(k++%2?mats.bulbB:mats.bulbA,out(at(bulb(),x,by+y,zz+face*.012)));
  for(let x=-hx;x<=hx+1e-6;x+=(2*hx)/Math.round(2*hx/step)){put(x,hy);put(x,-hy);}
  for(let y=-hy+(2*hy)/Math.round(2*hy/step);y<hy-1e-6;y+=(2*hy)/Math.round(2*hy/step)){put(-hx,y);put(hx,y);}
  const path=new T.CurvePath(),c=[[-hx-.07,hy+.07],[hx+.07,hy+.07],[hx+.07,-hy-.07],[-hx-.07,-hy-.07]];
  c.forEach((p,i)=>{const q=c[(i+1)%4];path.add(new T.LineCurve3(new T.Vector3(p[0],by+p[1],zz+face*.012),new T.Vector3(q[0],by+q[1],zz+face*.012)));});
  add(mats.tube,out(new RecordGeometry("src/walk/lounge-entrance-signs.js:4",T.TubeGeometry,path,64,.02,5,false)));
 };
 ring(DEPTH/2,1);ring(-DEPTH/2,-1);

 // The two posts, one at each end of the board (the inner one 0.17 m off the wall), on round foot plates, with a neon
 // collar under the board and a cap at the top.
 for(const z of [BOARD.z0-POST.r-.01,BOARD.z0+bw+POST.r+.01]){
  add(mats.body,at(new RecordGeometry("src/walk/lounge-entrance-signs.js:5",T.CylinderGeometry,POST.r,POST.r,POST.top,10),BOARD.x,POST.top/2,z));
  add(mats.body,at(new RecordGeometry("src/walk/lounge-entrance-signs.js:6",T.CylinderGeometry,.15,.17,.04,16),BOARD.x,.02,z));
  add(mats.body,at(new RecordGeometry("src/walk/lounge-entrance-signs.js:7",T.CylinderGeometry,.085,.085,.05,10),BOARD.x,POST.top+.025,z));
  add(mats.tube,at(new RecordGeometry("src/walk/lounge-entrance-signs.js:8",T.CylinderGeometry,.075,.075,.035,10),BOARD.x,BOARD.y0-.07,z));
 }

 for(const [m,list] of parts){const o=new T.Mesh(recordMerged("src/walk/lounge-entrance-signs.js",nativeMergeGeometries,list.map(g=>g.index?g.toNonIndexed():g)),m);o.name=m.name;o.userData.noCollide=true;group.add(o);}
 group.updateMatrixWorld(true);placeObject(group,key);fitLoungeEntrance(group,deck);return group;
}

export function createLoungeEntranceSigns(){
 const [w,h]=SIZE,paint=(g)=>paintFace(g,w,h);
 const map=canvasTexture(w,h,(g)=>paint(g));
 // The brand fonts may still be loading at first; paint the lettering again once they are in.
 globalThis.document?.fonts?.ready.then(()=>{paint(map.image.getContext('2d'));map.needsUpdate=true;});
 const mats={
  body:new T.MeshStandardMaterial({name:'Lounge_sign_body',color:0x160a24,roughness:.55,metalness:.25}),
  face:new T.MeshBasicMaterial({name:'Lounge_sign_face',map,toneMapped:false}),
  bulbA:new T.MeshBasicMaterial({name:'Lounge_sign_bulb_pale',color:PALE,toneMapped:false}),
  bulbB:new T.MeshBasicMaterial({name:'Lounge_sign_bulb_violet',color:PURPLE,toneMapped:false}),
  tube:new T.MeshBasicMaterial({name:'Lounge_sign_neon',color:PURPLE,toneMapped:false}),
 };
 return {groups:[createSign(19,'lounge-entrance-sign-19',mats),createSign(18,'lounge-entrance-sign-18',mats)]};
}
