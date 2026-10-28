import * as T from 'three';
import {placedV1,placeObject} from '../plan/placements.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {canvasTexture,seeded} from '../polish-kit.js';
import {floorY} from '../transit.js';

// The Hydro-Nip Lounge's entrance from the Deck 17 promenade as a black obsidian jaguar's open mouth (from tester
// feedback, three times): only this doorway, the entry bridge into Neighborhood 1's commons. The head is a sculpted
// head of polished black stone standing at the doorway, modelled on the concept art of a giant jaguar's head, its
// rosettes matte against the gloss and pale veins through it: a domed skull with cupped ears leaning back, a heavy
// brow over slanted eyes that glow yellow, a broad nose ridge down to a wide nose, whisker pads over the upper lip and
// jowls spreading out to the floor like a bell. The mouth is an arch through it (2.1 m wide, 2.35 m tall, nearly flat
// along the top) with curved fangs hanging at its top corners, a row of six rounded teeth between them, thick lower
// fangs rising at its corners and rounded teeth on the lip in front of them. The throat behind is clear glass (sides and
// roof, black ribs, the purple neon along its roof showing through) and the way out into the lounge is framed by a
// black obsidian arch. Walk only.
// In the group's frame x runs across the doorway (world x), y up from the floor, +z out into the promenade; the
// passage runs from z 0 back to -4, where it meets the lounge. The head is about 4.6 m wide and stands from 1.6 m out
// in front of z 0 to 1.3 m behind it, its crown 3.64 m up under the 3.7 m ceiling. The head and its lower teeth are
// solid. A walker fits through anywhere between the mouth's walls without touching a tooth: the hanging teeth end 1.95 m
// up, above a captain's hat, and the lower teeth stand on the lip at the corners, in line with the walls.
const [gx,,gz]=placedV1('jaguar-gate'),GATE={x:gx,z:gz,half:2,h:3.68,depth:4,wall:.06};
const GLOW=0xffcf3a,PURPLE=0xa04dff;
// The mouth's outline: straight sides from the floor to `side`, then a nearly flat top with rounded corners at `top`.
const MOUTH={foot:1.05,half:1.0,side:1.72,top:2.12},EDGE=.3;
// The head is shaped below with its mouth 2.12 m tall and its crown at 3.45 m, then stretched up to its built height
// (lift): the mouth's sides and arch to 1.95 m and 2.35 m, so a walker in a captain's hat clears every tooth, and the
// face above it nearly unchanged up to the crown at 3.64 m, which the ears, laid back, leave room for under the ceiling.
const lift=y=>y<MOUTH.side?y*1.95/MOUTH.side:y<MOUTH.top?1.95+(y-MOUTH.side):2.35+(y-MOUTH.top)*(3.64-2.35)/(3.45-MOUTH.top);
const mouthAt=u=>{const k=Math.min(u,1-u)/EDGE,sx=u<.5?-1:1;
 if(k<1)return [sx*(MOUTH.foot-(MOUTH.foot-MOUTH.half)*k),MOUTH.side*k];
 const a=Math.PI*(1-(u-EDGE)/(1-2*EDGE)),c=Math.cos(a),s=Math.sin(a);
 return [MOUTH.half*Math.sign(c)*Math.abs(c)**.4,MOUTH.side+(MOUTH.top-MOUTH.side)*Math.abs(s)**.4];};
// The height of the mouth's top edge at x.
const mouthTop=x=>MOUTH.side+(MOUTH.top-MOUTH.side)*(1-Math.min(1,Math.abs(x)/MOUTH.half)**5)**.2;
// The head's outline: about twice the mouth's width, its jowls spreading out to the floor like a bell, the cheeks
// swelling out a little at the height of the upper lip and a full dome over the top, under the ears.
const outerAt=u=>{const k=Math.min(u,1-u)/EDGE,sx=u<.5?-1:1;
 if(k<1)return [sx*(1.85+.45*(1-k)**1.6),1.35*k];
 const a=Math.PI*(1-(u-EDGE)/(1-2*EDGE)),c=Math.cos(a),s=Math.sin(a),y=1.35+2.1*Math.abs(s)**(2/2.6);
 return [1.85*Math.sign(c)*Math.abs(c)**(2/2.6)*(1+.07*Math.exp(-(((y-2.2)/.5)**2))),y];};
// How far the face stands out in front (+z) at a point, built up from soft rounded swellings: a domed skull, the
// whisker pads split by a groove under a broad nose ridge, sockets under a frowning brow with a crease between them,
// cheeks and the jowls running down to the floor. Behind, the head rounds back over a plainer dome.
const dome=(x,y,cx,cy,rx,ry,h)=>{const q=((x-cx)/rx)**2+((y-cy)/ry)**2;return q<1?h*Math.sqrt(1-q):0;};
const hill=(x,y,cx,cy,rx,ry,h,a=0)=>{const c=Math.cos(a),s=Math.sin(a),dx=x-cx,dy=y-cy,u=(dx*c+dy*s)/rx,v=(-dx*s+dy*c)/ry,q=u*u+v*v;return q<1?h*(1-q)*(1-q):0;};
const relief=(x,y)=>{const ax=Math.abs(x);
 return .2+dome(x,y,0,1.7,2.05,2.15,.85)+hill(ax,y,.42,2.38,.62,.5,.58)+hill(x,y,0,2.45,.08,.28,-.12)+hill(x,y,0,2.88,.5,.72,.42)+hill(x,y,0,2.7,.42,.26,.16)
  // The bridge standing up from between the eyes to the nose, the heavy upper lip rolling over the teeth and the folds
  // running from the nose's sides down to the corners of the mouth.
  +hill(x,y,0,3.02,.3,.42,.26)+hill(ax,y,.48,2.17,.52,.13,.13)+hill(ax,y,.6,2.42,.42,.1,-.1,-.8)
  +hill(ax,y,.95,2.97,.42,.26,-.28,.32)+hill(ax,y,.98,3.18,.55,.18,.3,.4)+hill(x,y,0,3.2,.12,.3,-.08)+hill(ax,y,.2,3.36,.2,.05,-.05,1.2)
  +hill(ax,y,.95,2.6,.42,.24,.15)+hill(ax,y,1.35,2.2,.65,.85,.38)+hill(ax,y,1.45,.8,.7,1.3,.3)+hill(x,y,0,3.35,.85,.28,.12);};
const backDepth=(x,y)=>.3+dome(x,y,0,1.3,2.3,2.3,1.1);

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
  nose:stone('Jaguar_nose',0x141419,{roughness:.12}),
  fang:stone('Jaguar_fangs',0x050508,{roughness:.05}),
  mouth:stone('Jaguar_mouth',0x020203,{roughness:.3,envMapIntensity:.35}),
  pit:new T.MeshStandardMaterial({name:'Jaguar_whisker_pits',color:0x020203,roughness:.9}),
  eye:new T.MeshBasicMaterial({name:'Jaguar_eye',color:GLOW,toneMapped:false}),
  core:new T.MeshBasicMaterial({name:'Jaguar_eye_core',color:0xfff1a8,toneMapped:false}),
  halo:new T.MeshBasicMaterial({name:'Jaguar_eye_glow',color:GLOW,map:haloTexture(),transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),
  glass:new T.MeshStandardMaterial({name:'Jaguar_throat_glass',color:0xc8dce6,roughness:.04,metalness:0,envMapIntensity:.5,transparent:true,opacity:.09,depthWrite:false,side:T.DoubleSide}),
  neon:new T.MeshBasicMaterial({name:'Jaguar_neon_glow',color:PURPLE,toneMapped:false}),
  wash:new T.MeshBasicMaterial({name:'Jaguar_neon_wash_glow',color:PURPLE,map:fadeTexture(),transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false}),
 };
 mat.ear=mat.skin.clone();mat.ear.name='Jaguar_ears';mat.ear.side=T.DoubleSide;
 const parts=new Map(),add=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g);};
 const at=(g,x,y,z,rx=0,ry=0,rz=0,s=[1,1,1])=>g.scale(...s).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);
 const {half,h,depth,wall}=GATE;

 // The head: a grid running round the mouth (u, from the left foot over the top to the right foot) and, at each u, round
 // a loop through the head's thickness (r): out from the mouth's front edge across the face to the outline, back over
 // the head's rear to the mouth's back edge, then forward along the mouth's wall to its front edge again. One closed
 // surface, so the lips and the outline shade round smoothly. The face rolls in a little at the lip. The skin wraps
 // round it as if round a cylinder standing just behind the face, so the spots don't streak down the sides.
 const NU=240,NS=44,WALL=6,M=2*NS+WALL,shell=[],uvs=[],quads=[];
 const ease=s=>Math.sqrt(1-s**4),lip=(s,k)=>k+(1-k)*Math.sqrt(Math.min(1,s/.12));
 for(let i=0;i<=NU;i++){const [mx,my]=mouthAt(i/NU),[ox,oy]=outerAt(i/NU),pt=s=>[mx+(ox-mx)*s,my+(oy-my)*s];
  const front=s=>{const [x,y]=pt(s);return [x,y,wall/2+relief(x,y)*ease(s)*lip(s,.75)];},rear=s=>{const [x,y]=pt(s);return [x,y,-backDepth(x,y)*ease(s)*lip(s,.85)];};
  const f0=front(0),b0=rear(0);
  for(let r=0;r<M;r++){const v=r<=NS?front(r/NS):r<=2*NS?rear((2*NS-r)/NS):b0.map((c,k)=>c+(f0[k]-c)*(r-2*NS)/WALL);
   v[1]=lift(v[1]);shell.push(...v);uvs.push(2*Math.atan2(v[0],v[2]+.3),v[1]);}}
 // The face and rear first, then the mouth's walls, which take the darker inside-of-the-mouth stone.
 const inside=[];
 for(let i=0;i<NU;i++)for(let r=0;r<M;r++){const a=i*M+r,b=a+M,a1=i*M+(r+1)%M,b1=a1+M;(r<2*NS?quads:inside).push(a,b,a1,b,b1,a1);}
 const headGeo=new T.BufferGeometry();headGeo.setAttribute('position',new T.Float32BufferAttribute(shell,3));headGeo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 headGeo.setIndex([...quads,...inside]);headGeo.addGroup(0,quads.length,0);headGeo.addGroup(quads.length,inside.length,1);headGeo.computeVertexNormals();
 const face=new T.Mesh(headGeo,[mat.skin,mat.mouth]);face.name='Jaguar_head';solid.add(face);
 // Where a point on the face lies: the nearest point of the face's grid, for setting the eyes, nose and teeth on it.
 const surf=(x,y)=>{let best=1e9,z=0;for(let i=0;i<=NU;i++)for(let r=0;r<=NS;r++){const k=(i*M+r)*3,d=(shell[k]-x)**2+(shell[k+1]-y)**2;if(d<best){best=d;z=shell[k+2];}}return z;};

 for(const sx of [-1,1]){
  // Eyes in the sockets under the brow, slanted up at their outer corners: almonds that glow yellow, paler at the
  // middle, rimmed in black stone, each with a soft halo of its light on the face.
  const ex=sx*.95,ey=lift(2.97),ez=surf(ex,ey);
  add(mat.stone,at(new T.SphereGeometry(1,24,12),ex,ey,ez-.06,0,0,sx*.4,[.365,.18,.15]));
  add(mat.eye,at(new T.SphereGeometry(1,24,12),ex,ey,ez-.02,0,0,sx*.4,[.34,.16,.14]));
  add(mat.core,at(new T.SphereGeometry(1,16,8),ex,ey,ez+.01,0,0,sx*.4,[.19,.075,.12]));
  add(mat.halo,at(new T.PlaneGeometry(1.4,.8),ex,ey,ez+.15,0,0,sx*.4));
  // Rows of small whisker pits across each pad.
  for(let k=0;k<4;k++)for(let r=0;r<3;r++){const x=sx*(.28+k*.14),y=lift(2.25+r*.09+k*.015);add(mat.pit,at(new T.SphereGeometry(.026,6,4),x,y,surf(x,y)));}
  // Thick cupped ears leaning back on the shoulders of the dome, where it is lower, so their points rise clear of the
  // crown and still stay under the ceiling, tilted out and pinched to a rounded point: an outer shell, a smaller one inside it facing into the cup and
  // a rim joining them, the skin wrapped on as on the head.
  const pinch=g=>{const p=g.attributes.position;for(let k=0;k<p.count;k++)p.setX(k,p.getX(k)*(1-.42*Math.max(0,p.getY(k))));g.computeVertexNormals();return g;};
  const cup=(r,d)=>new T.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2).rotateX(-Math.PI/2).scale(r,r,d);
  const hollow=cup(.78,.7);hollow.setIndex([...hollow.index.array].reverse());
  const ear=mergeGeometries([cup(1,1),hollow,new T.RingGeometry(.78,1,24,1)].map(g=>pinch(g).toNonIndexed()));
  const placed=at(ear,sx*1.32,3.12,.12,-.55,sx*.45,-sx*.2,[.52,.56,.34]),ep=placed.attributes.position;
  placed.setAttribute('uv',new T.Float32BufferAttribute(Array.from({length:ep.count},(_,k)=>[2*Math.atan2(ep.getX(k),ep.getZ(k)+.3),ep.getY(k)]).flat(),2));
  add(mat.ear,placed);
 }
 // The nose: a broad rounded pad of glossier stone set into the foot of the bridge, wider at the top, with two
 // nostrils under its front.
 const nose=new T.SphereGeometry(1,28,16),np=nose.attributes.position;
 for(let k=0;k<np.count;k++)np.setX(k,np.getX(k)*(.72+.38*np.getY(k)));
 const ny=lift(2.72),nz=surf(0,ny);nose.computeVertexNormals();add(mat.nose,at(nose,0,ny,nz-.14,-.3,0,0,[.6,.26,.26]));
 for(const sx of [-1,1])add(mat.pit,at(new T.SphereGeometry(1,12,8),sx*.13,ny-.19,nz+.04,.5,0,sx*.35,[.08,.04,.06]));

 // Teeth, black stone: curved fangs hanging at the top corners of the mouth (tips 1.95 m up, over a walker's hat)
 // with a row of six rounded ones between them, thick lower fangs rising at its corners and two rounded teeth on the
 // lip in front of each of them.
 const tooth=(len,r,bend,bullet=false)=>{const g=new T.CylinderGeometry(1,1,1,18,14),p=g.attributes.position;
  for(let k=0;k<p.count;k++){const t=.5-p.getY(k),w=r*(bullet?Math.sqrt(Math.max(0,1-Math.max(0,(t-.4)/.6)**2)):Math.pow(Math.max(0,1-t),.55));
   p.setXYZ(k,p.getX(k)*w,-t*len,p.getZ(k)*w-bend*len*t*t);}
  g.computeVertexNormals();return g;};
 const top=x=>lift(mouthTop(x)),lipZ=x=>surf(x,top(x)),floorZ=x=>surf(x,.12),lower=[];
 for(const sx of [-1,1]){
  add(mat.fang,at(tooth(.55,.22,.12),sx*.84,top(.84)+.21,lipZ(sx*.84)-.12,0,0,-sx*.05));
  lower.push(at(tooth(.8,.24,.1),sx*1.26,0,floorZ(sx*1.15)-.12,Math.PI,0,sx*.04));
  for(const [x,dz] of [[1.16,.22],[1.4,.12]])lower.push(at(tooth(.32,.11,0,true),sx*x,0,floorZ(sx*1.15)+dz,Math.PI));
 }
 for(const x of [-.6,-.36,-.12,.12,.36,.6])add(mat.fang,at(tooth(.3,.09,.04,true),x,top(x)+.1,lipZ(x)-.14));
 // The lower teeth stand on the lip at the mouth's corners, outside the way through, and are solid like the lip.
 const jaw=new T.Mesh(mergeGeometries(lower.map(g=>g.toNonIndexed())),mat.fang);jaw.name='Jaguar_lower_teeth';solid.add(jaw);

 // Inside: clear glass on both sides and over the roof, held by black stone ribs, with the neon along the roof of the
 // mouth showing through it and the deck's own floor underfoot. Nothing in the throat is solid.
 // The glass starts a metre back, inside the head's rear, so its roof and neon don't show over the head from in front.
 const inner=half-wall,THROAT=1,run=depth-THROAT,mid=THROAT+run/2;
 for(const sx of [-1,1])add(mat.glass,at(new T.PlaneGeometry(run,h),sx*(inner-.01),h/2,-mid,0,-sx*Math.PI/2));
 add(mat.glass,at(new T.PlaneGeometry(2*inner,run),0,h-.03,-mid,Math.PI/2));
 // Three ribs across the roof of the passage, just under the glass.
 for(const z of [-1.8,-2.6,-3.4])add(mat.stone,at(new T.BoxGeometry(2*inner,.07,.1),0,h-.04,z));

 // The neon: three purple tubes along the roof of the mouth and one across its front, and their light falling down
 // the glass and onto the floor.
 for(const x of [-inner+.12,0,inner-.12])add(mat.neon,at(new T.CylinderGeometry(.035,.035,run-.1,8),x,h-.1,-mid,Math.PI/2));
 add(mat.neon,at(new T.CylinderGeometry(.035,.035,2*inner-.2,8),0,h-.1,-THROAT-.08,0,0,Math.PI/2));
 for(const sx of [-1,1])add(mat.wash,at(new T.PlaneGeometry(run,h*.85),sx*(inner-.03),h*.575,-mid,0,-sx*Math.PI/2));
 const pool=new T.PlaneGeometry(2*inner-.2,run-.2);add(new T.MeshBasicMaterial({name:'Jaguar_floor_glow',color:PURPLE,transparent:true,opacity:.18,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),at(pool,0,.03,-mid,-Math.PI/2));

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
