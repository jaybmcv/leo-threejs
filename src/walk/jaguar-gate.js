import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture,seeded} from '../polish-kit.js';
import {floorY} from '../transit.js';

// The Hydro-Nip Lounge's entrance from the Deck 17 promenade as a jaguar's open mouth (from tester feedback): only this
// doorway, the entry bridge into Neighborhood 1's commons. The head is a spotted relief on the promenade wall round the
// opening, the mouth is the opening itself (4 m wide, the full 3.68 m height), with fangs above and at the corners, a
// dark lining, palate ridges and molars along the 4 m passage, a tongue down its floor and purple neon along the roof
// of the mouth washing light down the throat. Walk only: the walls here are the walk's own partitions.
// In the group's frame x runs along the promenade wall (world x), y up from the floor, +z out into the promenade; the
// passage runs from z 0 back to −4, where it meets the lounge. Only the head's relief is solid; it stops at the
// opening's edges, and every tooth stays above 2.2 m or tucked into a corner, so the way through is as wide and tall
// as before.
const GATE={x:-86.75,z:-4,half:2,h:3.68,depth:4,wall:.06};
const SKIN={gold:'#c98a35',deep:'#9c5f1f',cream:'#ecd9b2'},PURPLE=0xa04dff;

// Jaguar rosettes on tawny gold: broken rings of black round a darker centre, small solid spots between them.
const skinTexture=()=>canvasTexture(1024,1024,(g,w,h)=>{
 const r=seeded(1712),bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,SKIN.gold);bg.addColorStop(.5,'#d59a45');bg.addColorStop(1,SKIN.gold);
 g.fillStyle=bg;g.fillRect(0,0,w,h);
 for(let i=0;i<1400;i++){g.fillStyle=`rgba(${r()<.5?'120,70,20':'240,200,140'},${.05+r()*.08})`;g.fillRect(r()*w,r()*h,2+r()*5,1+r()*2);}
 const blob=(x,y,rx,ry,a)=>{for(const dx of [-w,0,w])for(const dy of [-h,0,h]){g.beginPath();g.ellipse(x+dx,y+dy,rx,ry,a,0,Math.PI*2);g.fill();}};
 for(let i=0;i<34;i++){
  const x=r()*w,y=r()*h,s=38+r()*30;
  g.fillStyle=SKIN.deep;blob(x,y,s*.62,s*.5,r()*3);
  g.fillStyle='#17110c';const n=4+Math.floor(r()*3),a0=r()*6;
  for(let k=0;k<n;k++){const a=a0+k*Math.PI*2/n+(r()-.5)*.4;blob(x+Math.cos(a)*s*.72,y+Math.sin(a)*s*.6,s*(.2+r()*.14),s*(.12+r()*.08),a+Math.PI/2);}
  if(r()<.5)blob(x+(r()-.5)*s*.3,y+(r()-.5)*s*.3,s*.07,s*.07,0);
 }
 g.fillStyle='#17110c';for(let i=0;i<70;i++)blob(r()*w,r()*h,5+r()*9,4+r()*7,r()*3);
},[.42,.42]);
// The inside of the mouth: deep red going to near black, ridged across like a palate.
const mouthTexture=()=>canvasTexture(256,512,(g,w,h)=>{
 const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#7a1f33');bg.addColorStop(.6,'#4a0f22');bg.addColorStop(1,'#1c0610');
 g.fillStyle=bg;g.fillRect(0,0,w,h);
 for(let y=10;y<h;y+=34){g.strokeStyle='rgba(160,60,90,.55)';g.lineWidth=7;g.beginPath();g.moveTo(0,y);g.quadraticCurveTo(w/2,y+16,w,y);g.stroke();
  g.strokeStyle='rgba(20,0,8,.5)';g.lineWidth=4;g.beginPath();g.moveTo(0,y+9);g.quadraticCurveTo(w/2,y+25,w,y+9);g.stroke();}
});
// A vertical fade for the neon's light: full at the top of the texture, gone at the bottom.
const fadeTexture=()=>canvasTexture(8,256,(g,w,h)=>{const f=g.createLinearGradient(0,0,0,h);f.addColorStop(0,'rgba(255,255,255,1)');f.addColorStop(.45,'rgba(255,255,255,.35)');f.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=f;g.fillRect(0,0,w,h);});

export function createJaguarGate(){
 const group=new T.Group();group.name='Jaguar_gate';group.position.set(GATE.x,floorY(17),GATE.z);
 const solid=new T.Group();solid.name='Jaguar_gate_solid';group.add(solid);
 const skinMap=skinTexture();
 const mat={
  skin:new T.MeshStandardMaterial({name:'Jaguar_skin',map:skinMap,roughness:.78}),
  cream:new T.MeshStandardMaterial({name:'Jaguar_cream',color:SKIN.cream,roughness:.8}),
  dark:new T.MeshStandardMaterial({name:'Jaguar_lips',color:0x1a1110,roughness:.55}),
  nose:new T.MeshStandardMaterial({name:'Jaguar_nose',color:0x5a3330,roughness:.5}),
  ivory:new T.MeshStandardMaterial({name:'Jaguar_teeth',color:0xf3ecd8,roughness:.35}),
  mouth:new T.MeshStandardMaterial({name:'Jaguar_mouth_lining',map:mouthTexture(),roughness:.6,side:T.DoubleSide}),
  gums:new T.MeshStandardMaterial({name:'Jaguar_gums',color:0x4a1020,roughness:.6}),
  tongue:new T.MeshStandardMaterial({name:'Jaguar_tongue',color:0xb04a68,roughness:.45}),
  eye:new T.MeshStandardMaterial({name:'Jaguar_eye',color:0xd8c23a,emissive:0x6a5a10,emissiveIntensity:.6,roughness:.25}),
  neon:new T.MeshBasicMaterial({name:'Jaguar_neon_glow',color:PURPLE,toneMapped:false}),
  wash:new T.MeshBasicMaterial({name:'Jaguar_neon_wash_glow',color:PURPLE,map:fadeTexture(),transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}),
 };
 const parts=new Map(),add=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g);};
 const at=(g,x,y,z,rx=0,ry=0,rz=0,s=[1,1,1])=>g.scale(...s).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);
 const {half,h,depth,wall}=GATE;

 // The head: an inverted U of cheeks and brow round the opening, bevelled out from the wall. The bevel grows the
 // outline by `bev`, so the mouth's edge is drawn that much wider and lands on the opening's own edges.
 const bev=.1,top=3.5,mouthTop=2.9,s=new T.Shape();
 s.moveTo(-4.3,0);s.lineTo(-4.3,2.1);s.quadraticCurveTo(-4.3,top,-3.2,top);s.lineTo(3.2,top);s.quadraticCurveTo(4.3,top,4.3,2.1);s.lineTo(4.3,0);
 s.lineTo(half+bev,0);s.lineTo(half+bev,2.15);s.quadraticCurveTo(half+bev,mouthTop,1.3,mouthTop);s.lineTo(-1.3,mouthTop);s.quadraticCurveTo(-half-bev,mouthTop,-half-bev,2.15);s.lineTo(-half-bev,0);
 const head=new T.ExtrudeGeometry(s,{depth:.28,bevelEnabled:true,bevelThickness:.14,bevelSize:bev,bevelSegments:3,curveSegments:14});
 head.translate(0,0,wall+.14);
 const face=new T.Mesh(head,mat.skin);face.name='Jaguar_head';solid.add(face);

 // The muzzle over the mouth: a broad snout with whisker pads, a nose and a black lip line; the brow ridges above the eyes.
 add(mat.skin,at(new T.SphereGeometry(1,28,16),0,3.12,.55,0,0,0,[1.55,.42,.62]));
 for(const sx of [-1,1]){
  add(mat.cream,at(new T.SphereGeometry(1,20,12),sx*.5,2.98,.95,0,0,0,[.62,.26,.34]));
  // Rows of small whisker spots on each pad, set on its surface, and three long whiskers fanning out.
  for(let k=0;k<4;k++)for(let r=0;r<2;r++){const x=sx*(.27+k*.13),y=2.93+r*.09,u=(x-sx*.5)/.62,v=(y-2.98)/.26;
   add(mat.dark,at(new T.SphereGeometry(.022,6,4),x,y,.95+.34*Math.sqrt(Math.max(0,1-u*u-v*v))));}
  for(let j=0;j<3;j++)add(mat.ivory,new T.TubeGeometry(new T.LineCurve3(new T.Vector3(sx*.8,2.94+j*.06,1.1),new T.Vector3(sx*1.85,2.82+j*.2,1.3)),2,.012,5,false));
  // Eyes on the cheeks above the corners of the mouth: gold almonds with a slit pupil, rimmed black, under a brow.
  add(mat.dark,at(new T.SphereGeometry(1,20,10),sx*2.75,3.0,.62,0,0,sx*.25,[.46,.25,.12]));
  add(mat.eye,at(new T.SphereGeometry(1,20,10),sx*2.75,3.0,.66,0,0,sx*.25,[.38,.19,.12]));
  add(mat.dark,at(new T.SphereGeometry(1,10,8),sx*2.75,3.0,.76,0,0,0,[.05,.16,.04]));
  add(mat.skin,at(new T.SphereGeometry(1,16,8),sx*2.7,3.28,.58,0,0,sx*.3,[.62,.12,.2]));
  // Rounded ears at the top corners, dark backed with a cream inside.
  add(mat.dark,at(new T.CylinderGeometry(.45,.45,.14,20,1,false,0,Math.PI),sx*3.85,3.08,.4,Math.PI/2,0,Math.PI/2-sx*.4));
  add(mat.cream,at(new T.CylinderGeometry(.3,.3,.08,20,1,false,0,Math.PI),sx*3.85,3.1,.5,Math.PI/2,0,Math.PI/2-sx*.4));
 }
 add(mat.nose,at(new T.SphereGeometry(1,20,12),0,3.32,1.12,0,0,0,[.34,.18,.18]));
 add(mat.dark,at(new T.BoxGeometry(.05,.24,.05),0,3.1,1.14));
 // The lips: a dark roll along the mouth's edge, round the top and down both sides to the floor.
 const lip=new T.CurvePath();
 lip.add(new T.LineCurve3(new T.Vector3(-half-.05,0,.62),new T.Vector3(-half-.05,2.15,.62)));
 lip.add(new T.QuadraticBezierCurve3(new T.Vector3(-half-.05,2.15,.62),new T.Vector3(-half-.05,mouthTop-.05,.62),new T.Vector3(-1.3,mouthTop-.05,.62)));
 lip.add(new T.LineCurve3(new T.Vector3(-1.3,mouthTop-.05,.62),new T.Vector3(1.3,mouthTop-.05,.62)));
 lip.add(new T.QuadraticBezierCurve3(new T.Vector3(1.3,mouthTop-.05,.62),new T.Vector3(half+.05,mouthTop-.05,.62),new T.Vector3(half+.05,2.15,.62)));
 lip.add(new T.LineCurve3(new T.Vector3(half+.05,2.15,.62),new T.Vector3(half+.05,0,.62)));
 add(mat.dark,new T.TubeGeometry(lip,80,.08,8,false));

 // Teeth: two long upper fangs and a row of small ones under the muzzle, all ending 2.2 m or more above the floor;
 // the lower fangs stand in the corners of the mouth, against its sides.
 const fang=(len,r)=>new T.ConeGeometry(r,len,12);
 for(const sx of [-1,1]){
  add(mat.ivory,at(fang(.62,.14),sx*1.05,mouthTop-.3,.5,Math.PI,0,sx*.06));
  add(mat.ivory,at(fang(.7,.15),sx*(half-.12),.35,.5,0,0,-sx*.08));
  add(mat.ivory,at(fang(.24,.08),sx*(half-.4),.12,.52));
 }
 for(let k=-3;k<=3;k++)add(mat.ivory,at(fang(.22,.075),k*.2,mouthTop-.12,.62,Math.PI));

 // Inside: the lining on both walls and the roof, molars along the walls top and bottom, and a tongue down the gums.
 const inner=half-wall;
 for(const sx of [-1,1]){
  add(mat.mouth,at(new T.PlaneGeometry(depth,h),sx*(inner-.01),h/2,-depth/2,0,-sx*Math.PI/2));
  for(let k=0;k<6;k++){const z=-.35-k*.62;
   add(mat.ivory,at(new T.BoxGeometry(.14,.26,.42),sx*(inner-.08),h-.5,z));
   add(mat.ivory,at(new T.BoxGeometry(.12,.22,.42),sx*(inner-.07),.11,z));}
 }
 add(mat.mouth,at(new T.PlaneGeometry(2*inner,depth),0,h-.03,-depth/2,Math.PI/2));
 add(mat.gums,at(new T.PlaneGeometry(2*inner,depth),0,.006,-depth/2,-Math.PI/2));
 const tongue=new T.Shape();tongue.moveTo(-1.1,0);tongue.lineTo(1.1,0);tongue.lineTo(1.25,-2.6);tongue.quadraticCurveTo(1.2,-3.7,0,-3.75);tongue.quadraticCurveTo(-1.2,-3.7,-1.25,-2.6);tongue.lineTo(-1.1,0);
 add(mat.tongue,at(new T.ShapeGeometry(tongue,12),0,.012,-.15,-Math.PI/2,Math.PI));
 add(mat.dark,at(new T.PlaneGeometry(.06,3.3),0,.016,-1.95,-Math.PI/2));

 // The neon: three purple tubes along the roof of the mouth and one across its front, and their light falling down
 // the lining and onto the tongue.
 for(const x of [-inner+.12,0,inner-.12])add(mat.neon,at(new T.CylinderGeometry(.035,.035,depth-.1,8),x,h-.1,-depth/2,Math.PI/2));
 add(mat.neon,at(new T.CylinderGeometry(.035,.035,2*inner-.2,8),0,h-.1,-.08,0,0,Math.PI/2));
 for(const sx of [-1,1])add(mat.wash,at(new T.PlaneGeometry(depth,h*.85),sx*(inner-.03),h*.575,-depth/2,0,-sx*Math.PI/2));
 const pool=new T.PlaneGeometry(2*inner-.2,depth-.2);add(new T.MeshBasicMaterial({name:'Jaguar_floor_glow',color:PURPLE,transparent:true,opacity:.18,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),at(pool,0,.03,-depth/2,-Math.PI/2));

 for(const [m,list] of parts){const o=new T.Mesh(mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g)),m);o.name=m.name;o.userData.noCollide=true;group.add(o);}
 group.updateMatrixWorld(true);
 return {group,solid};
}
