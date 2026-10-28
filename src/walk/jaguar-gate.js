import * as T from 'three';
import {placedV1,placeObject} from '../plan/placements.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture,seeded} from '../polish-kit.js';
import {floorY} from '../transit.js';

// The Hydro-Nip Lounge's entrance from the Deck 17 promenade as a black obsidian jaguar's open mouth (from tester
// feedback, twice): only this doorway, the entry bridge into Neighborhood 1's commons. The head is polished black
// stone in relief on the promenade wall round the opening, its rosettes matte against the gloss so they still read,
// with eyes that glow yellow, black fangs above and at the corners, and the mouth is the opening itself (4 m wide, the
// full 3.68 m height). The throat is clear glass (sides and roof, black ribs, the purple neon along its roof showing
// through) and the way out into the lounge is framed by a black obsidian arch. Walk only: the walls here are the
// walk's own partitions.
// In the group's frame x runs along the promenade wall (world x), y up from the floor, +z out into the promenade; the
// passage runs from z 0 back to −4, where it meets the lounge. Only the head's relief is solid; it stops at the
// opening's edges, and every tooth stays above 2.2 m or tucked into a corner, so the way through is as wide and tall
// as before.
const [gx,,gz]=placedV1('jaguar-gate'),GATE={x:gx,z:gz,half:2,h:3.68,depth:4,wall:.06};
const GLOW=0xffcf3a,PURPLE=0xa04dff;

// Jaguar rosettes: broken rings round a centre, small solid spots between them. Drawn twice from the same seed, once
// as colour and once as roughness, so the spots sit exactly on the matte patches of the polished stone.
const rosettes=(g,w,h,c)=>{
 const r=seeded(1712);g.fillStyle=c.base;g.fillRect(0,0,w,h);
 const blob=(x,y,rx,ry,a)=>{for(const dx of [-w,0,w])for(const dy of [-h,0,h]){g.beginPath();g.ellipse(x+dx,y+dy,rx,ry,a,0,Math.PI*2);g.fill();}};
 for(let i=0;i<34;i++){
  const x=r()*w,y=r()*h,s=38+r()*30;
  g.fillStyle=c.centre;blob(x,y,s*.62,s*.5,r()*3);
  g.fillStyle=c.ring;const n=4+Math.floor(r()*3),a0=r()*6;
  for(let k=0;k<n;k++){const a=a0+k*Math.PI*2/n+(r()-.5)*.4;blob(x+Math.cos(a)*s*.72,y+Math.sin(a)*s*.6,s*(.2+r()*.14),s*(.12+r()*.08),a+Math.PI/2);}
  if(r()<.5)blob(x+(r()-.5)*s*.3,y+(r()-.5)*s*.3,s*.07,s*.07,0);
 }
 g.fillStyle=c.ring;for(let i=0;i<70;i++)blob(r()*w,r()*h,5+r()*9,4+r()*7,r()*3);
};
const skinTexture=()=>canvasTexture(1024,1024,(g,w,h)=>rosettes(g,w,h,{base:'#050508',centre:'#0b0b10',ring:'#22232b'}),[.42,.42]);
// Roughness is read from the green channel: low on the polished stone, high on the rosettes.
const skinRoughness=()=>{const t=canvasTexture(1024,1024,(g,w,h)=>rosettes(g,w,h,{base:'#262626',centre:'#8c8c8c',ring:'#d8d8d8'}),[.42,.42]);t.colorSpace=T.NoColorSpace;return t;};
// A soft round glow for the eyes' light: full in the middle, gone at the rim.
const haloTexture=()=>canvasTexture(128,128,(g,w,h)=>{const f=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);f.addColorStop(0,'rgba(255,255,255,1)');f.addColorStop(.4,'rgba(255,255,255,.4)');f.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=f;g.fillRect(0,0,w,h);});
// A vertical fade for the neon's light: full at the top of the texture, gone at the bottom.
const fadeTexture=()=>canvasTexture(8,256,(g,w,h)=>{const f=g.createLinearGradient(0,0,0,h);f.addColorStop(0,'rgba(255,255,255,1)');f.addColorStop(.45,'rgba(255,255,255,.35)');f.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=f;g.fillRect(0,0,w,h);});

export function createJaguarGate(){
 const group=new T.Group();group.name='Jaguar_gate';group.position.set(GATE.x,floorY(17),GATE.z);
 const solid=new T.Group();solid.name='Jaguar_gate_solid';group.add(solid);
 const stone=(name,color,extra={})=>new T.MeshStandardMaterial({name,color,roughness:.08,metalness:.15,envMapIntensity:.9,...extra});
 const mat={
  skin:new T.MeshStandardMaterial({name:'Jaguar_skin',map:skinTexture(),roughnessMap:skinRoughness(),roughness:1,metalness:.1,envMapIntensity:.8}),
  stone:stone('Jaguar_obsidian',0x08080b),
  pad:stone('Jaguar_pads',0x1c1c23,{roughness:.2}),
  nose:stone('Jaguar_nose',0x141419,{roughness:.12}),
  fang:stone('Jaguar_fangs',0x050508,{roughness:.05}),
  eye:new T.MeshBasicMaterial({name:'Jaguar_eye',color:GLOW,toneMapped:false}),
  core:new T.MeshBasicMaterial({name:'Jaguar_eye_core',color:0xfff1a8,toneMapped:false}),
  halo:new T.MeshBasicMaterial({name:'Jaguar_eye_glow',color:GLOW,map:haloTexture(),transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),
  glass:new T.MeshStandardMaterial({name:'Jaguar_throat_glass',color:0xc8dce6,roughness:.04,metalness:0,envMapIntensity:.5,transparent:true,opacity:.09,depthWrite:false,side:T.DoubleSide}),
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

 // The muzzle over the mouth: a broad snout with whisker pads, a nose and a lip line; the brow ridges above the eyes.
 add(mat.skin,at(new T.SphereGeometry(1,28,16),0,3.12,.55,0,0,0,[1.55,.42,.62]));
 for(const sx of [-1,1]){
  add(mat.pad,at(new T.SphereGeometry(1,20,12),sx*.5,2.98,.95,0,0,0,[.62,.26,.34]));
  // Rows of small whisker spots on each pad, set on its surface.
  for(let k=0;k<4;k++)for(let r=0;r<2;r++){const x=sx*(.27+k*.13),y=2.93+r*.09,u=(x-sx*.5)/.62,v=(y-2.98)/.26;
   add(mat.stone,at(new T.SphereGeometry(.022,6,4),x,y,.95+.34*Math.sqrt(Math.max(0,1-u*u-v*v))));}
  // Eyes on the cheeks above the corners of the mouth: almonds that glow yellow, rimmed in black stone, under a brow,
  // each with a soft halo of its light on the face.
  add(mat.stone,at(new T.SphereGeometry(1,20,10),sx*2.75,3.0,.62,0,0,sx*.25,[.58,.3,.12]));
  add(mat.eye,at(new T.SphereGeometry(1,20,10),sx*2.75,3.0,.66,0,0,sx*.25,[.5,.23,.12]));
  add(mat.core,at(new T.SphereGeometry(1,16,8),sx*2.75,3.0,.68,0,0,sx*.25,[.3,.1,.12]));
  add(mat.halo,at(new T.PlaneGeometry(1.9,1.2),sx*2.75,3.0,.82));
  add(mat.skin,at(new T.SphereGeometry(1,16,8),sx*2.7,3.3,.58,0,0,sx*.3,[.66,.13,.2]));
  // Rounded ears at the top corners, backed with a paler stone inside.
  add(mat.stone,at(new T.CylinderGeometry(.45,.45,.14,20,1,false,0,Math.PI),sx*3.85,3.08,.4,Math.PI/2,0,Math.PI/2-sx*.4));
  add(mat.pad,at(new T.CylinderGeometry(.3,.3,.08,20,1,false,0,Math.PI),sx*3.85,3.1,.5,Math.PI/2,0,Math.PI/2-sx*.4));
 }
 add(mat.nose,at(new T.SphereGeometry(1,20,12),0,3.32,1.12,0,0,0,[.34,.18,.18]));
 add(mat.pad,at(new T.BoxGeometry(.05,.24,.05),0,3.1,1.14));
 // The lips: a polished roll along the mouth's edge, round the top and down both sides to the floor.
 const lip=new T.CurvePath();
 lip.add(new T.LineCurve3(new T.Vector3(-half-.05,0,.62),new T.Vector3(-half-.05,2.15,.62)));
 lip.add(new T.QuadraticBezierCurve3(new T.Vector3(-half-.05,2.15,.62),new T.Vector3(-half-.05,mouthTop-.05,.62),new T.Vector3(-1.3,mouthTop-.05,.62)));
 lip.add(new T.LineCurve3(new T.Vector3(-1.3,mouthTop-.05,.62),new T.Vector3(1.3,mouthTop-.05,.62)));
 lip.add(new T.QuadraticBezierCurve3(new T.Vector3(1.3,mouthTop-.05,.62),new T.Vector3(half+.05,mouthTop-.05,.62),new T.Vector3(half+.05,2.15,.62)));
 lip.add(new T.LineCurve3(new T.Vector3(half+.05,2.15,.62),new T.Vector3(half+.05,0,.62)));
 add(mat.pad,new T.TubeGeometry(lip,80,.08,8,false));

 // Teeth: two long upper fangs and a row of small ones under the muzzle, all ending 2.2 m or more above the floor;
 // the lower fangs stand in the corners of the mouth, against its sides. Black stone, like the rest.
 const fang=(len,r)=>new T.ConeGeometry(r,len,12);
 for(const sx of [-1,1]){
  add(mat.fang,at(fang(.72,.16),sx*1.05,mouthTop-.34,.5,Math.PI,0,sx*.06));
  add(mat.fang,at(fang(.7,.15),sx*(half-.12),.35,.5,0,0,-sx*.08));
  add(mat.fang,at(fang(.24,.08),sx*(half-.4),.12,.52));
 }
 for(let k=-3;k<=3;k++)add(mat.fang,at(fang(.22,.075),k*.2,mouthTop-.12,.62,Math.PI));

 // Inside: clear glass on both sides and over the roof, held by black stone ribs, with the neon along the roof of the
 // mouth showing through it and the deck's own floor underfoot. Nothing in the throat is solid.
 const inner=half-wall;
 for(const sx of [-1,1])add(mat.glass,at(new T.PlaneGeometry(depth,h),sx*(inner-.01),h/2,-depth/2,0,-sx*Math.PI/2));
 add(mat.glass,at(new T.PlaneGeometry(2*inner,depth),0,h-.03,-depth/2,Math.PI/2));
 // Three ribs across the passage, each a post either side and a beam over the top, standing just inside the glass.
 for(const z of [-1,-2,-3]){
  for(const sx of [-1,1])add(mat.stone,at(new T.BoxGeometry(.07,h,.1),sx*(inner-.04),h/2,z));
  add(mat.stone,at(new T.BoxGeometry(2*inner,.07,.1),0,h-.04,z));
 }

 // The neon: three purple tubes along the roof of the mouth and one across its front, and their light falling down
 // the glass and onto the floor.
 for(const x of [-inner+.12,0,inner-.12])add(mat.neon,at(new T.CylinderGeometry(.035,.035,depth-.1,8),x,h-.1,-depth/2,Math.PI/2));
 add(mat.neon,at(new T.CylinderGeometry(.035,.035,2*inner-.2,8),0,h-.1,-.08,0,0,Math.PI/2));
 for(const sx of [-1,1])add(mat.wash,at(new T.PlaneGeometry(depth,h*.85),sx*(inner-.03),h*.575,-depth/2,0,-sx*Math.PI/2));
 const pool=new T.PlaneGeometry(2*inner-.2,depth-.2);add(new T.MeshBasicMaterial({name:'Jaguar_floor_glow',color:PURPLE,transparent:true,opacity:.18,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),at(pool,0,.03,-depth/2,-Math.PI/2));

 // The way out: a black obsidian arch where the passage meets the lounge, its jambs against the opening's edges and
 // its top corners rounded in (nothing under 2.9 m, so the way through is as wide and tall as before).
 const rd=.7,jam=.55,arch=new T.Shape(),hole=new T.Path();
 arch.moveTo(-half-jam,0);arch.lineTo(half+jam,0);arch.lineTo(half+jam,h);arch.lineTo(-half-jam,h);arch.lineTo(-half-jam,0);
 hole.moveTo(-half,0);hole.lineTo(-half,h-rd);hole.quadraticCurveTo(-half,h,-half+rd,h);hole.lineTo(half-rd,h);hole.quadraticCurveTo(half,h,half,h-rd);hole.lineTo(half,0);hole.lineTo(-half,0);
 arch.holes.push(hole);
 const gate=new T.ExtrudeGeometry(arch,{depth:.4,bevelEnabled:true,bevelThickness:.05,bevelSize:.05,bevelSegments:2,curveSegments:10});
 gate.translate(0,0,-depth-.2);
 const exit=new T.Mesh(gate,mat.stone);exit.name='Jaguar_exit_arch';solid.add(exit);

 for(const [m,list] of parts){const o=new T.Mesh(mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g)),m);o.name=m.name;o.userData.noCollide=true;group.add(o);}
 group.updateMatrixWorld(true);
 placeObject(group,'jaguar-gate');return {group,solid};
}
