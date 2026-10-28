import * as T from 'three';
import {placedV1,placeObject} from '../plan/placements.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture} from '../polish-kit.js';
import {floorY} from '../transit.js';

// The Hydro-Nip Lounge's entrances on Decks 19 and 18 (from tester feedback): the short neck that runs from the
// aft promenade into the lounge's end gallery gets a theatre-marquee canopy. A dark fascia across its mouth reads
// "Hydro-Nip Lounge" in lit lettering inside a ring of purple bulbs, and a low lit soffit runs back along the neck
// to the lounge, rows of bulbs and purple tubes down its underside. It sits entirely inside the neck (nothing
// sticks out into the promenade), above head height, and is dressing only: nothing in it is solid. Glow is emissive
// geometry and additive washes, no real lights. In the group's frame x runs across the neck, y up from the deck's
// floor, and the passage runs from z 0 at the mouth back to −NECK.
const NECK={half:1.94,length:4},PURPLE=0xa04dff,PALE=0xdcb8ff;
const FASCIA={w:3.8,y0:2.56,y1:3.62},DEPTH=.2,SOFFIT=2.56;
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
// A soft fall-off for the wash the tubes throw down the walls: full at the top of the texture, gone at the bottom.
const fadeTexture=()=>canvasTexture(8,128,(g,w,h)=>{const f=g.createLinearGradient(0,0,0,h);f.addColorStop(0,'rgba(255,255,255,1)');f.addColorStop(.3,'rgba(255,255,255,.5)');f.addColorStop(.65,'rgba(255,255,255,.15)');f.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=f;g.fillRect(0,0,w,h);});

// A rounded rectangle of fascia, extruded .2 m deep (its front face at z 0, its back at z −DEPTH).
function slab(w,h,r){
 const s=new T.Shape(),x=w/2,y=h/2;
 s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
 return new T.ExtrudeGeometry(s,{depth:DEPTH,bevelEnabled:false,curveSegments:6}).translate(0,0,-DEPTH);
}

function createSign(deck,key,mats){
 const group=new T.Group();group.name=`Lounge_entrance_sign_${deck}`;
 const [gx,,gz]=placedV1(key);group.position.set(gx,floorY(deck),gz);
 const parts=new Map(),add=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g);};
 const at=(g,x,y,z,rx=0,ry=0,rz=0)=>g.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);
 const fw=FASCIA.w,fh=FASCIA.y1-FASCIA.y0,fy=(FASCIA.y0+FASCIA.y1)/2,len=NECK.length-.12;

 // Fascia across the mouth and an end plate where the neck meets the lounge (turned to face it), both with the wording.
 add(mats.body,at(slab(fw,fh,.16),0,fy,0));
 add(mats.body,at(slab(fw,fh,.16),0,fy,-len,0,Math.PI));
 add(mats.face,at(new T.PlaneGeometry(fw-.04,fh-.04),0,fy,.003));
 add(mats.face,at(new T.PlaneGeometry(fw-.04,fh-.04),0,fy,-len-.003,0,Math.PI));
 // The soffit and its lid: a hollow canopy between the plates, so the top reads as a solid cover from above.
 const sw=fw,sl=len-2*DEPTH;
 add(mats.body,at(new T.BoxGeometry(sw,.06,sl),0,SOFFIT+.03,-len/2));
 add(mats.body,at(new T.BoxGeometry(sw,.06,sl),0,FASCIA.y1-.03,-len/2));

 // A ring of bulbs just inside each fascia edge, alternating pale and violet, and a purple tube round the rim.
 const bulb=()=>new T.SphereGeometry(.036,6,3);
 const ring=(zz,face)=>{
  const hx=fw/2-.12,hy=fh/2-.11,step=.14;let k=0;
  const put=(x,y)=>add(k++%2?mats.bulbB:mats.bulbA,at(bulb(),x,fy+y,zz+face*.012));
  for(let x=-hx;x<=hx+1e-6;x+=(2*hx)/Math.round(2*hx/step)){put(x,hy);put(x,-hy);}
  for(let y=-hy+(2*hy)/Math.round(2*hy/step);y<hy-1e-6;y+=(2*hy)/Math.round(2*hy/step)){put(-hx,y);put(hx,y);}
  const path=new T.CurvePath(),c=[[-hx-.07,hy+.07],[hx+.07,hy+.07],[hx+.07,-hy-.07],[-hx-.07,-hy-.07]];
  c.forEach((p,i)=>{const q=c[(i+1)%4];path.add(new T.LineCurve3(new T.Vector3(p[0],fy+p[1],zz+face*.012),new T.Vector3(q[0],fy+q[1],zz+face*.012)));});
  add(mats.tube,new T.TubeGeometry(path,64,.02,5,false));
 };
 ring(0,1);ring(-len,-1);

 // The soffit's underside: four lengthwise rows of bulbs and a tube along each side, running the length of the neck.
 for(const [i,x] of [-1.35,-.45,.45,1.35].entries())for(let z=-DEPTH-.2;z>-len+DEPTH+.1;z-=.3)add(i%2?mats.bulbA:mats.bulbB,at(bulb(),x,SOFFIT-.012,z));
 for(const sx of [-1,1])add(mats.tube,at(new T.CylinderGeometry(.022,.022,sl-.1,6),sx*(fw/2-.1),SOFFIT-.012,-len/2,Math.PI/2));
 // Purple light washed down both side walls from the soffit, and a pool of it on the floor.
 const wash=new T.PlaneGeometry(sl,1.25);
 for(const sx of [-1,1])add(mats.wash,at(wash.clone(),sx*(NECK.half-.01),SOFFIT-.625,-len/2,0,-sx*Math.PI/2));
 add(mats.pool,at(new T.PlaneGeometry(NECK.half*2-.1,sl),0,.03,-len/2,-Math.PI/2));

 for(const [m,list] of parts){const o=new T.Mesh(mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g)),m);o.name=m.name;o.userData.noCollide=true;group.add(o);}
 group.updateMatrixWorld(true);placeObject(group,key);return group;
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
  wash:new T.MeshBasicMaterial({name:'Lounge_sign_wash_glow',color:PURPLE,map:fadeTexture(),transparent:true,opacity:.38,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}),
  pool:new T.MeshBasicMaterial({name:'Lounge_sign_floor_glow',color:PURPLE,transparent:true,opacity:.07,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),
 };
 return {groups:[createSign(19,'lounge-entrance-sign-19',mats),createSign(18,'lounge-entrance-sign-18',mats)]};
}
