import {jaguarHeadGeometry,jaguarEyeGeometry,jaguarToothGeometry} from './jaguar-head.js';
import {ReplayGeometry} from "../v2/prepared-geometry-replay.js";
import {jaguarGateOffset} from '../v2/jaguar-gate-placement.js';
import * as T from 'three';
import {placedV1,placeObject} from '../plan/placements.js';
import {mergeGeometries as nativeMergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture,seeded} from '../polish-kit.js';
import {floorY} from '../transit.js';

// A smooth obsidian head surrounds the retained opening. Local +z faces the walkway.
const [gx,,gz]=placedV1('jaguar-gate'),GATE={x:gx,z:gz,half:2,h:3.68,depth:2.08,wall:.06};
const GLOW=0xffcf3a,ORANGE=0xff7628,PURPLE=0xa04dff,PUSH=2;

// The skin is painted once over the whole head, unrolled the way its UVs wrap it (u round the head, from the back on
// the left through the face to the back on the right; v up from the floor), so the pattern can follow the face.
const SKIN={w:2600,h:1024,u:4*Math.PI,v:3.7};
// Jaguar rosettes: broken rings of ragged spots round a slightly paler centre, small solid spots between them, all
// grainy, small on the muzzle and round the eyes and largest over the crown and down the flanks; and fine pale cracks
// branching through the stone, a few more over the brow and the snout than elsewhere. Drawn twice from the same seed, once as colour
// and once as roughness, so the spots sit exactly on the matte patches of the polished stone and the cracks stay glossy.
const paintSkin=(g,w,h,c)=>{
 const r=seeded(1712),at=(u,v)=>[(u/SKIN.u+.5)*w,(1-v/SKIN.v)*h];g.fillStyle=c.base;g.fillRect(0,0,w,h);
 const blob=(x,y,rx,ry,a)=>{for(const dx of [-w,0,w]){g.beginPath();g.ellipse(x+dx,y,rx,ry,a,0,Math.PI*2);g.fill();}};
 // A ragged spot: a few overlapping ellipses round a point, speckled inside like sandblasted stone.
 const spot=(x,y,s,a)=>{const fill=g.fillStyle;for(let k=0;k<4;k++)blob(x+(r()-.5)*s*.7,y+(r()-.5)*s*.5,s*(.35+r()*.3),s*(.22+r()*.18),a+(r()-.5)*1.2);
  for(let k=0;k<s*s/40;k++){const d=Math.sqrt(r())*s*.4,t=r()*6.3;g.fillStyle=r()<.5?c.speckA:c.speckB;g.fillRect(x+Math.cos(t)*d,y+Math.sin(t)*d*.7,2,2);}g.fillStyle=fill;};
 const size=(u,v)=>{const f=Math.hypot(u/1.7,(v-2.65)/.75);return f<1?.42+.58*f*f:1;};
 for(let i=0;i<260;i++){
  const u=(r()-.5)*SKIN.u,v=r()*SKIN.v,k=size(u,v);if(r()>.28/(k*k))continue;
  const [x,y]=at(u,v),s=(75+r()*60)*k;
  g.fillStyle=c.centre;blob(x,y,s*.5,s*.4,r()*3);
  g.fillStyle=c.ring;const n=4+Math.floor(r()*3),a0=r()*6;
  for(let j=0;j<n;j++){const a=a0+j*Math.PI*2/n+(r()-.5)*.5;spot(x+Math.cos(a)*s*.72,y+Math.sin(a)*s*.58,s*.38,a+Math.PI/2);}
 }
 g.fillStyle=c.ring;for(let i=0;i<500;i++){const u=(r()-.5)*SKIN.u,v=r()*SKIN.v,[x,y]=at(u,v);spot(x,y,(14+r()*22)*size(u,v),r()*3);}
 // Grain over everything, so the matte patches read as rough stone.
 for(let i=0;i<40000;i++){g.fillStyle=r()<.5?c.grainA:c.grainB;g.fillRect(r()*w,r()*h,2,2);}
 // The cracks: wandering lines that now and then split, most of them starting on the brow and the snout.
 g.strokeStyle=c.vein;g.lineCap='round';
 const crack=(x,y,a,steps,width)=>{g.lineWidth=width;g.beginPath();g.moveTo(x,y);
  for(let k=0;k<steps;k++){a+=(r()-.5)*.8;x+=Math.cos(a)*7;y+=Math.sin(a)*7;g.lineTo(x,y);
   if(width>.8&&r()<.05){g.stroke();crack(x,y,a+(r()<.5?-1:1)*(.5+r()*.6),steps-k>>1,width*.6);g.lineWidth=width;g.beginPath();g.moveTo(x,y);}}
  g.stroke();};
 for(let i=0;i<24;i++){const face=i<10,u=face?(r()-.5)*2.6:(r()-.5)*SKIN.u,v=face?2.2+r()*1.4:r()*SKIN.v,[x,y]=at(u,v);crack(x,y,r()*6.3,15+r()*25,.8+r()*1);}
};
// The skin's UVs run u over [-2pi, 2pi] and v over the head's height, so the textures are scaled and shifted onto them.
const wrapped=t=>{t.repeat.set(1/SKIN.u,1/SKIN.v);t.offset.set(.5,0);t.wrapT=T.ClampToEdgeWrapping;return t;};
const skinTexture=()=>wrapped(canvasTexture(SKIN.w,SKIN.h,(g,w,h)=>paintSkin(g,w,h,{base:'#050508',centre:'#0c0c10',ring:'#101115',speckA:'#1c1d22',speckB:'#08080a',grainA:'rgba(0,0,0,.25)',grainB:'rgba(60,60,70,.12)',vein:'rgba(178,180,194,.5)'})));
// Roughness is read from the green channel: low on the polished stone, high on the rosettes.
const skinRoughness=()=>{const t=wrapped(canvasTexture(SKIN.w,SKIN.h,(g,w,h)=>paintSkin(g,w,h,{base:'#262626',centre:'#6a6a6a',ring:'#a4a4a4',speckA:'#e4e4e4',speckB:'#6c6c6c',grainA:'rgba(0,0,0,.18)',grainB:'rgba(255,255,255,.12)',vein:'#0a0a0a'})));t.colorSpace=T.NoColorSpace;return t;};
// A vertical fade for the neon's light: full at the top of the texture, gone at the bottom.
const fadeTexture=()=>canvasTexture(8,256,(g,w,h)=>{const f=g.createLinearGradient(0,0,0,h);f.addColorStop(0,'rgba(255,255,255,1)');f.addColorStop(.45,'rgba(255,255,255,.35)');f.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=f;g.fillRect(0,0,w,h);});

// Orange gathers at the lip and fades into the dark throat.
const mouthGlowTexture=()=>{
 const data=new Uint8Array(128*4);for(let i=0;i<128;i++){const v=Math.round(255*(.02+.98*(i/127)**8));data.set([v,v,v,255],i*4);}
 const t=new T.DataTexture(data,128,1);t.channel=1;t.minFilter=t.magFilter=T.LinearFilter;t.needsUpdate=true;return t;
};

export function createJaguarGate(){
 const group=new T.Group();group.name='Jaguar_gate';group.position.set(GATE.x,floorY(17),GATE.z);
 const solid=new T.Group();solid.name='Jaguar_gate_solid';group.add(solid);
 const stone=(name,color,extra={})=>new T.MeshStandardMaterial({name,color,roughness:.16,metalness:.15,envMapIntensity:.9,emissive:PURPLE,emissiveIntensity:.012,flatShading:false,...extra});
 const mat={
  skin:new T.MeshStandardMaterial({name:'Jaguar_skin',map:skinTexture(),roughnessMap:skinRoughness(),roughness:.48,metalness:.15,envMapIntensity:.8,emissive:PURPLE,emissiveIntensity:.012,flatShading:false}),
  stone:stone('Jaguar_obsidian',0x08080b),
  nose:stone('Jaguar_nose',0x141419,{roughness:.12}),
  fang:stone('Jaguar_fangs',0x202027,{roughness:.12,emissiveIntensity:.03}),
  mouth:stone('Jaguar_mouth',0x020203,{roughness:.3,envMapIntensity:.35,emissive:ORANGE,emissiveMap:mouthGlowTexture(),emissiveIntensity:.8,toneMapped:false}),
  eye:new T.MeshStandardMaterial({name:'Jaguar_eye',color:0x3b2904,emissive:GLOW,emissiveIntensity:1.1,roughness:.22}),
  pupil:new T.MeshBasicMaterial({name:'Jaguar_pupil',color:0x020104}),
  glass:new T.MeshStandardMaterial({name:'Jaguar_throat_glass',color:0xc8dce6,roughness:.04,metalness:0,envMapIntensity:.5,transparent:true,opacity:.09,depthWrite:false,side:T.DoubleSide}),
  neon:new T.MeshStandardMaterial({name:'Jaguar_neon_glow',color:ORANGE,emissive:ORANGE,emissiveIntensity:2,toneMapped:false}),
  wash:new T.MeshBasicMaterial({name:'Jaguar_neon_wash_glow',color:ORANGE,map:fadeTexture(),transparent:true,opacity:.12,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}),
 };
 mat.ear=stone('Jaguar_ears',0x24212a,{roughness:.28});
 const parts=new Map(),add=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g);};
 const at=(g,x,y,z,rx=0,ry=0,rz=0,s=[1,1,1])=>g.scale(...s).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);
 const {half,h,depth,wall}=GATE;

 // The sculpted skin includes the ears, brows, muzzle and jaw, without intersecting stone parts.
 const head=jaguarHeadGeometry(),face=new T.Mesh(head,[mat.skin,mat.mouth,mat.nose,mat.ear]);
 face.name='Jaguar_head';face.position.z=PUSH;solid.add(face);
 const eyes=new T.Mesh(jaguarEyeGeometry(head),[mat.eye,mat.pupil]);eyes.name='Jaguar_eyes';eyes.position.z=PUSH;solid.add(eyes);
 // The fangs grow from the curled lip and side jaws, outside the unchanged standing route.
 const upper=[],lower=[],tooth=jaguarToothGeometry;
 for(const sx of [-1,1]){
  upper.push(at(tooth(.86,.16,.18),sx*1.22,2.65,.9));
  lower.push(at(tooth(.6,.16,-.14),sx*1.3,.13,.78,Math.PI));
  for(const x of [1.64,1.85])lower.push(at(tooth(.22,.085,-.04),sx*x,.16,.7,Math.PI));
 }
 for(const x of [-.6,-.36,-.12,.12,.36,.6])upper.push(at(tooth(.22,.085,.04),x,2.58,1.08));
 for(const [name,list] of [['Jaguar_upper_teeth',upper],['Jaguar_lower_teeth',lower]]){
  const teeth=new T.Mesh(nativeMergeGeometries(list.map(g=>g.toNonIndexed())),mat.fang);teeth.name=name;teeth.position.z=PUSH;solid.add(teeth);
 }

 // Inside: clear glass on both sides and over the roof, held by black stone ribs, with the neon along the roof of the
 // mouth showing through it and the deck's own floor underfoot. Nothing in the throat is solid.
 // The glass starts inside the head's rear, so its roof and neon don't show over the head from in front.
 // The movable throat uses its current dimensions, independent of prepared templates.
 const inner=half-wall,THROAT=1-PUSH,run=depth-THROAT,mid=THROAT+run/2;
 for(const sx of [-1,1])add(mat.glass,at(new T.PlaneGeometry(run,h),sx*(inner-.01),h/2,-mid,0,-sx*Math.PI/2));
 add(mat.glass,at(new T.PlaneGeometry(2*inner,run),0,h-.03,-mid,Math.PI/2));
 // Three ribs across the roof of the passage, just under the glass.
 for(const z of [-THROAT-run*.2,-THROAT-run*.5,-THROAT-run*.8])add(mat.stone,at(new ReplayGeometry("src/walk/jaguar-gate.js:12",T.BoxGeometry,2*inner,.07,.1),0,h-.04,z));

 // The throat: three orange emissive tubes along the roof of the mouth and one across its front, and their light falling down
 // the glass and onto the floor.
 for(const x of [-inner+.12,0,inner-.12])add(mat.neon,at(new T.CylinderGeometry(.035,.035,run-.1,8),x,h-.1,-mid,Math.PI/2));
 add(mat.neon,at(new ReplayGeometry("src/walk/jaguar-gate.js:14",T.CylinderGeometry,.035,.035,2*inner-.2,8),0,h-.1,-THROAT-.08,0,0,Math.PI/2));
 add(mat.neon,at(new T.CylinderGeometry(.025,.025,1.7,8),0,2.4,PUSH-.08,0,0,Math.PI/2));
 for(const sx of [-1,1])add(mat.wash,at(new T.PlaneGeometry(run,h*.85),sx*(inner-.03),h*.575,-mid,0,-sx*Math.PI/2));
 const pool=new T.PlaneGeometry(2*inner-.2,run-.2);add(new T.MeshBasicMaterial({name:'Jaguar_floor_glow',color:ORANGE,transparent:true,opacity:.08,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),at(pool,0,.03,-mid,-Math.PI/2));

 // The way out: a black obsidian arch where the passage meets the lounge, its jambs against the opening's edges and
 // its top corners rounded in (nothing under 2.9 m, so the way through is as wide and tall as before).
 const rd=.7,jam=.55,arch=new T.Shape(),hole=new T.Path();
 arch.moveTo(-half-jam,0);arch.lineTo(half+jam,0);arch.lineTo(half+jam,h);arch.lineTo(-half-jam,h);arch.lineTo(-half-jam,0);
 hole.moveTo(-half,0);hole.lineTo(-half,h-rd);hole.quadraticCurveTo(-half,h,-half+rd,h);hole.lineTo(half-rd,h);hole.quadraticCurveTo(half,h,half,h-rd);hole.lineTo(half,0);hole.lineTo(-half,0);
 arch.holes.push(hole);
 const gate=new ReplayGeometry("src/walk/jaguar-gate.js:17",T.ExtrudeGeometry,arch,{depth:.4,bevelEnabled:true,bevelThickness:.05,bevelSize:.05,bevelSegments:2,curveSegments:10});
 gate.translate(0,0,-depth-.2);
 const exit=new T.Mesh(gate,mat.stone);exit.name='Jaguar_exit_arch';solid.add(exit);

 // Throat transforms change these material batches, so merge them locally.
 for(const [m,list] of parts){const o=new T.Mesh(nativeMergeGeometries(list.map(g=>g.index?g.toNonIndexed():g)),m);o.name=m.name;o.userData.noCollide=true;group.add(o);}
 group.updateMatrixWorld(true);
 placeObject(group,'jaguar-gate');group.position.add(new T.Vector3(...jaguarGateOffset()));group.updateMatrixWorld(true);return {group,solid};
}
