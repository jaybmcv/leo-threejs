import {roomObject} from '../plan/rooms.js';
import * as T from 'three';
import {walkCanvas} from './canvas.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {wearHat} from './hat.js';

// The Deck 16 community theatre as a cinema (first stage): purple drapes round the walls under a pelmet with a blue
// light line, a starry ceiling, plum carpet, warm wall sconces and a real screen above the stage. Everything is
// unlit or baked colour, one mesh per material, so the room adds no lights. The room's own blue backdrop panel goes,
// and its title moves onto the pelmet above the screen, where it can be read.
// Room frame (Area_d16-theater-5): the stage end at +x, the entrance at -x, the stair lobby notch at x<-12, z<-9.
// The screen plays a short muted loop (src/walk/art/theatre-loop.mp4), fetched and played only while a walker is near.
const ROOM='Area_d16-theater-5',NEAR=40;
const BACK=25.84,SIDE=16.84,ENTRY=-25.84,NOTCH={x:-12,z:-9},DOOR=2.2,LIP=2.95,TOP=3.28,INSET=.16;
const SCREEN={w:4,h:2.25,y:1.68},SERVER=[-23.65,0,-6.3];
// Wall runs a drape hangs along: from, to, and the way into the room.
const RUNS=[
 [[BACK,-SIDE],[BACK,-SCREEN.w/2],[-1,0]],[[BACK,SCREEN.w/2],[BACK,SIDE],[-1,0]],
 [[ENTRY,SIDE],[BACK,SIDE],[0,-1]],
 [[NOTCH.x,-SIDE],[BACK,-SIDE],[0,1]],
 [[NOTCH.x,-SIDE],[NOTCH.x,NOTCH.z],[1,0]],
 [[ENTRY,NOTCH.z],[NOTCH.x,NOTCH.z],[0,1]],
 [[ENTRY,NOTCH.z],[ENTRY,-DOOR],[1,0]],[[ENTRY,DOOR],[ENTRY,SIDE],[1,0]],
];
// The pelmet runs unbroken round the room, over the screen and the doorway too.
const PELMET=[[[BACK,-SIDE],[BACK,SIDE],[-1,0]],RUNS[2],RUNS[3],RUNS[4],RUNS[5],[[ENTRY,NOTCH.z],[ENTRY,SIDE],[1,0]]];
const PURPLE=new T.Color(0x5b2a9a),SHADOW=new T.Color(0x1e0b3a),GLOW=new T.Color(0x58c8ff);

// A pleated drape along one run, its folds and the blue wash from the light line above baked into vertex colours.
function drape([a,b,n]){
 const len=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,cols=Math.max(2,Math.round(len/.09)),rows=[0,.9,1.7,2.2,2.55,LIP];
 const pos=[],col=[],idx=[],c=new T.Color();
 for(let i=0;i<=cols;i++){
  const s=Math.min(len-INSET,Math.max(INSET,i/cols*len)),phase=s/.36*Math.PI*2,fold=Math.sin(phase),out=INSET+.07+.06*fold;
  const x=a[0]+dx*s+n[0]*out,z=a[1]+dz*s+n[1]*out,shade=.55+.45*(.5+.5*fold);
  for(const y of rows){
   const wash=Math.pow(Math.max(0,(y-1.4)/(LIP-1.4)),2.2);
   c.copy(SHADOW).lerp(PURPLE,shade).lerp(GLOW,wash*.55).multiplyScalar(.75+.25*y/LIP);
   pos.push(x,y,z);col.push(c.r,c.g,c.b);
  }
 }
 const R=rows.length;
 for(let i=0;i<cols;i++)for(let j=0;j<R-1;j++){const p=i*R+j,q=p+R;idx.push(p,q,p+1,q,q+1,p+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);
 return g;
}
// A box along a run, `out` metres into the room from the wall, between heights y0 and y1, `deep` thick.
function strip([a,b,n],y0,y1,out,deep){
 const len=Math.hypot(b[0]-a[0],b[1]-a[1]),g=new T.BoxGeometry(len,y1-y0,deep);
 g.rotateY(-Math.atan2(b[1]-a[1],b[0]-a[0]));g.translate((a[0]+b[0])/2+n[0]*out,(y0+y1)/2,(a[1]+b[1])/2+n[1]*out);
 return g;
}
function canvasTexture(w,h,paint,repeat){
 const canvas=walkCanvas();canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
 if(repeat){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);}
 return t;
}
// Seeded, so the sky is the same for everyone.
function rng(seed){return ()=>(seed=(seed*16807)%2147483647)/2147483647;}
function stars(g,w,h){
 const sky=g.createRadialGradient(w*.7,h/2,0,w*.7,h/2,w*.7);sky.addColorStop(0,'#141a44');sky.addColorStop(1,'#070923');
 g.fillStyle=sky;g.fillRect(0,0,w,h);const r=rng(1987);
 for(let i=0;i<2600;i++){
  const x=r()*w,y=r()*h,big=r()<.04,s=big?1.6+r()*1.4:.5+r()*.9,a=.45+r()*.55;
  if(big){const halo=g.createRadialGradient(x,y,0,x,y,s*5);halo.addColorStop(0,`rgba(200,220,255,${a*.5})`);halo.addColorStop(1,'rgba(200,220,255,0)');g.fillStyle=halo;g.fillRect(x-s*5,y-s*5,s*10,s*10);}
  g.fillStyle=`rgba(${230+r()*25|0},${230+r()*25|0},255,${a})`;g.beginPath();g.arc(x,y,s,0,Math.PI*2);g.fill();
 }
}
function carpet(g,w,h){
 g.fillStyle='#2c1340';g.fillRect(0,0,w,h);
 const r=rng(42);for(let i=0;i<9000;i++){g.fillStyle=`rgba(${r()<.5?90:20},${r()*30|0},${r()<.5?120:60},.18)`;g.fillRect(r()*w,r()*h,2,2);}
 // A small repeating motif: a violet diamond with a teal fleck.
 for(const [x,y] of [[w/4,h/4],[w*3/4,h*3/4]]){g.strokeStyle='rgba(150,90,210,.55)';g.lineWidth=3;g.beginPath();g.moveTo(x,y-20);g.lineTo(x+20,y);g.lineTo(x,y+20);g.lineTo(x-20,y);g.closePath();g.stroke();g.fillStyle='rgba(90,200,230,.6)';g.fillRect(x-3,y-3,6,6);}
}
function sconceGlow(g,w,h){
 const halo=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);halo.addColorStop(0,'rgba(255,200,140,.95)');halo.addColorStop(.25,'rgba(255,160,110,.45)');halo.addColorStop(1,'rgba(255,140,90,0)');
 g.fillStyle=halo;g.fillRect(0,0,w,h);
}
// The room's floor (and ceiling) outline, less the stair lobby notch, in the plane's x and y.
function roomShape(flip){
 const p=[[ENTRY,NOTCH.z],[NOTCH.x,NOTCH.z],[NOTCH.x,-SIDE],[BACK,-SIDE],[BACK,SIDE],[ENTRY,SIDE]];
 return new T.Shape(p.map(([x,z])=>new T.Vector2(x,flip*z)));
}
function plane(flip,y,material,uv){
 const g=new T.ShapeGeometry(roomShape(flip)),pos=g.attributes.position,uvs=g.attributes.uv;
 for(let i=0;i<pos.count;i++)uvs.setXY(i,...uv(pos.getX(i),flip*pos.getY(i)));
 g.rotateX(flip*Math.PI/2);g.translate(0,y,0);
 return new T.Mesh(g,material);
}

// The seating (second stage, from tester feedback): padded purple cinema seats in rows facing the stage, symmetric
// about the room's middle: a centre block of 14 seats, a walkway either side and a block of 10 seats beyond each, with a
// wider walkway along each wall. Rows are 1.5 m apart, so a walker can step along a row to any seat. The foyer behind
// the last row stays clear, with the concession stand's corner (concession.js) and the doors.
// Each seat is a hidden cushion and back (`Seat`, `Seat_back`: solid and sittable, rest.js) drawn by shared instanced
// meshes, so 476 seats cost a handful of draw calls.
export const SEATING={width:.7,pitch:1.5,front:14.5,rows:14,blocks:[[-4.9,14],[6.7,10],[-13.7,10]]};
function seatPlan(){
 const seats=[],arms=[],ends=[],{width:W}=SEATING;
 for(let k=0;k<SEATING.rows;k++){
  const x=SEATING.front-k*SEATING.pitch;
  for(const [z0,n] of SEATING.blocks){
   for(let i=0;i<n;i++)seats.push([x,z0+W*(i+.5)]);
   for(let i=0;i<=n;i++)arms.push([x,z0+W*i]);
   ends.push([x,z0,-1],[x,z0+W*n,1]);
  }
 }
 return {seats,arms,ends};
}
// A seat in the row at x, centred on z: cushion top .47 m up, its front 0.25 m ahead of x; the back 0.1 m thick, 0.2 m
// behind x. Between the back and the next row's cushion a 0.7 m walker has 0.39 m to spare.
const CUSHION={size:[.45,.16,.62],at:[.025,.39]},BACKREST={size:[.1,.74,.62],at:[-.25,.81]};

// Take the room's old chairs (and the build's seams on them) out and put the cinema seats in, before the colliders and
// rest spots are found. Returns false if the room is missing.
export function dressTheatre(ship){
 const room=roomObject(ship,ROOM),fit=room?.getObjectByName('Room_fittings');if(!fit)return false;
 const old=[];room.traverse(o=>{if(o.name==='Chair'||o.name==='Polish_tailored_seam')old.push(o);});
 for(const o of old)o.removeFromParent();
 // Hidden like the parts merged for drawing (render-bake.js), and solid and sittable as they are.
 const hidden=new T.MeshBasicMaterial({name:'Theatre_seat_proxy'}),cushion=new T.BoxGeometry(...CUSHION.size),back=new T.BoxGeometry(...BACKREST.size);
 const seats=new T.Group();seats.name='Theatre_seats';fit.add(seats);
 for(const [x,z] of seatPlan().seats)for(const [name,g,[dx,y]] of [['Seat',cushion,CUSHION.at],['Seat_back',back,BACKREST.at]]){
  const o=new T.Mesh(g,hidden);o.name=name;o.position.set(x+dx,y,z);o.visible=false;o.userData.baked=true;seats.add(o);
 }
 room.updateMatrixWorld(true);
 return true;
}
// The seats as drawn: velvet cushions and backs, dark pedestals, padded arms between them and a blue step light at each
// row's aisle ends.
function seatMeshes(){
 const {seats,arms,ends}=seatPlan(),{width:W}=SEATING;
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Theatre_'+name,color,roughness:.85,...o});
 const velvet=mat('seat_velvet',0x6a34a6),back=mat('seat_back',0x55288c),dark=mat('seat_frame',0x24102f,{roughness:.6}),base=mat('seat_base',0x120a18,{roughness:.5});
 const parts=[
  [new RoundedBoxGeometry(CUSHION.size[0]+.02,CUSHION.size[1],CUSHION.size[2],2,.06),velvet,seats,CUSHION.at],
  [new RoundedBoxGeometry(BACKREST.size[0]+.04,BACKREST.size[1],BACKREST.size[2],2,.05),back,seats,BACKREST.at],
  [new T.BoxGeometry(.32,.31,W-.2),base,seats,[-.04,.155]],
  [new RoundedBoxGeometry(.46,.62,.07,1,.025),dark,arms,[-.07,.31]],
  [new RoundedBoxGeometry(.5,.06,.1,1,.025),velvet,arms,[-.06,.65]],
  [new T.BoxGeometry(.12,.04,.01),new T.MeshBasicMaterial({name:'Theatre_aisle_light',color:0x6fd2ff}),ends,[.02,.12]],
 ];
 const m=new T.Matrix4();
 return parts.map(([g,material,at,[dx,y]],n)=>{
  const o=new T.InstancedMesh(g,material,at.length);o.name=material.name+(n===4?'_arm':'');
  at.forEach(([x,z,side=0],i)=>o.setMatrixAt(i,m.makeTranslation(x+dx,y,z+side*.04)));
  o.computeBoundingBox();o.computeBoundingSphere();return o;
 });
}

// The cast (from tester feedback): two Cosmo actors in costume on the stage, either side of the screen and turned to the
// house, each in a pool of warm stage light. One declaims in a crimson doublet with a gold crown, a white ruff and a
// cape; the other bows in a navy coat and white trousers under the captain's hat (hat.js). They are the Cosmo kit's
// baked poses (cosmo-pose.js ACTOR_POSES) with their own copies of its materials.
export const ACTOR_POSE_NAMES=['declaim','bow'];
const STAGE_TOP=.3;
const CAST=[{pose:'declaim',at:[19.6,3.4],face:[12,1.6],coat:0x9a1838,legs:0xd9a441,royal:true},{pose:'bow',at:[19.6,-3.4],face:[12,-1.6],coat:0x1c2c62,legs:0xeeeae0,captain:true}];
const glsl=c=>{c=new T.Color(c);return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`;};
// The hoodie is near black and the shorts orange in Cosmo's clothes texture: the coat keeps the hoodie's seams.
function costume(material,name,coat,legs){
 const m=material.clone();m.name=name;
 const code=`{vec3 c=diffuseColor.rgb;float shorts=step(.12,c.r-c.b);diffuseColor.rgb=mix(${glsl(coat)}*(.7+c.g*2.),${glsl(legs)}*(.55+c.r*.45),shorts);}`;
 m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+code);};
 m.customProgramCacheKey=()=>name;
 return m;
}
function spotGlow(g,w,h){
 const pool=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);pool.addColorStop(0,'rgba(255,226,170,.55)');pool.addColorStop(.6,'rgba(255,200,130,.22)');pool.addColorStop(1,'rgba(255,190,120,0)');
 g.fillStyle=pool;g.fillRect(0,0,w,h);
}
// The crown and ruff, in the head bone's frame, the crown where the captain's hat sits (hat.js FIT): gold and white.
function regalia(head){
 const gold=new T.MeshStandardMaterial({name:'Theatre_crown',color:0xe0b04a,metalness:.85,roughness:.3,emissive:0x3a2406,side:T.DoubleSide});
 const crown=new T.Group();crown.position.set(0,.335,-.06);crown.rotation.x=-.14;head.add(crown);
 const band=new T.CylinderGeometry(.25,.24,.09,28,1,true);band.translate(0,.045,0);
 const points=[];for(let i=0;i<8;i++){const a=i/8*Math.PI*2,p=new T.ConeGeometry(.045,.14,4);p.translate(Math.sin(a)*.245,.16,Math.cos(a)*.245);points.push(p.toNonIndexed());}
 const c=new T.Mesh(mergeGeometries([band.toNonIndexed(),...points]),gold);c.name='Theatre_crown';crown.add(c);
 const jewels=new T.Mesh(mergeGeometries([0,1,2,3].map(i=>new T.SphereGeometry(.028,10,8).translate(Math.sin(i*Math.PI/2)*.255,.045,Math.cos(i*Math.PI/2)*.255))),new T.MeshStandardMaterial({name:'Theatre_crown_jewel',color:0xd0204a,roughness:.15,emissive:0x400010}));
 jewels.name='Theatre_crown_jewels';crown.add(jewels);
 const ruff=new T.Mesh(new T.TorusGeometry(.17,.05,8,28),new T.MeshStandardMaterial({name:'Theatre_ruff',color:0xf6f1e6,roughness:.9}));ruff.name='Theatre_ruff';ruff.rotation.x=Math.PI/2;ruff.position.set(0,.02,0);head.add(ruff);
}
// A crimson cape hanging from the shoulders down the back, in the figure's space (facing +z, feet at the origin).
function cape(){
 const g=new T.CylinderGeometry(.19,.4,.92,20,1,true,Math.PI*.55,Math.PI*.9);g.translate(0,.6,-.02);
 const o=new T.Mesh(g,new T.MeshStandardMaterial({name:'Theatre_cape',color:0x6a0f2a,roughness:.8,side:T.DoubleSide}));o.name='Theatre_cape';return o;
}

// The seats as drawn and the cast, in ship coordinates (draw them with the deck band), and the actors' plain boxes for
// the colliders. `kit` is the Cosmo kit (none in the Node checks: then only the seats, the light pools and the boxes);
// `hat` is the captain's hat's URL.
export function createTheatreCast(ship,kit,{hat}={}){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Theatre_cast';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Theatre_cast_colliders';room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 group.add(...seatMeshes());
 const pool=new T.MeshBasicMaterial({name:'Theatre_stage_spot',map:canvasTexture(128,128,spotGlow),transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 for(const a of CAST){
  const [x,z]=a.at,yaw=Math.atan2(a.face[0]-x,a.face[1]-z);
  const spot=new T.Mesh(new T.CircleGeometry(1.2,32),pool);spot.name='Theatre_stage_spot';spot.rotation.x=-Math.PI/2;spot.position.set(x,STAGE_TOP+.006,z);group.add(spot);
  const box=new T.Mesh(new T.BoxGeometry(.6,1.6,.6));box.position.set(x,STAGE_TOP+.8,z);solid.add(box);
  if(!kit?.head)continue;
  const actor=kit.figure(a.pose);actor.name='Theatre_actor_'+a.pose;actor.position.set(x,STAGE_TOP,z);actor.rotation.y=yaw;
  for(const m of actor.children)if(m.material.name==='clothes')m.material=costume(m.material,'Theatre_costume_'+a.pose,a.coat,a.legs);
  const head=new T.Object3D();head.name='Theatre_actor_head';kit.head(a.pose).decompose(head.position,head.quaternion,head.scale);actor.add(head);
  if(a.royal){regalia(head);actor.add(cape());}
  if(a.captain&&hat)wearHat({figure:{bones:new Map([['spine.006',head]])}},hat);
  actor.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  group.add(actor);
 }
 return {group,solid};
}

// The room's attendant serves at the concession stand (concession.js): inside the L, between the popcorn case and the
// corner, facing the room over the counter. Called before the colliders are built, so it is solid where it stands.
export function placeAttendant(ship){
 const room=roomObject(ship,ROOM),cat=room?.getObjectByName('Resident_scale_1_75m');if(!cat)return;
 cat.position.set(...SERVER);cat.rotation.y=Math.PI/2;cat.updateMatrix();cat.updateMatrixWorld(true);
}

// Dress the theatre in `ship` before it is baked for walking. Returns the room group (draw it with its deck band) and an
// update to call a few times a second with the walker's position, which starts and stops the film.
export function createTheatre(ship,{url,anisotropy=1}={}){
 const room=roomObject(ship,ROOM);if(!room)return null;
 // The blue backdrop panel (and its painted-on graphics, the room's only ones) and the plain ceiling strips and aisle lines give way to the cinema's own.
 const title=[];
 room.traverse(o=>{
  if(/^(Projection_screen|Refined_display_graphics|Ceiling_light|Main_aisle_edge|Area_identity_panel)$/.test(o.name))o.visible=false;
  if(o.name==='Wayfinding_text'&&o.position.x>25)title.push(o);
 });
 // The title sits on the pelmet above the screen, a little smaller.
 for(const o of title){o.position.set(BACK-.51,LIP+.04,o.position.z);o.scale.setScalar(.7);o.updateMatrix();}
 room.updateMatrixWorld(true);
 const group=new T.Group();group.name='Walk_theatre';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const add=(name,geo,material)=>{const o=new T.Mesh(geo,material);o.name=name;group.add(o);return o;};
 add('Theatre_drapes',mergeGeometries(RUNS.map(drape)),new T.MeshBasicMaterial({name:'Theatre_drape',vertexColors:true,side:T.DoubleSide}));
 add('Theatre_pelmet',mergeGeometries(PELMET.map(r=>strip(r,LIP,TOP,INSET+.16,.32))),new T.MeshBasicMaterial({name:'Theatre_pelmet',color:0x1a0c2c}));
 add('Theatre_light_line',mergeGeometries(PELMET.map(r=>strip(r,LIP-.03,LIP,INSET+.3,.06))),new T.MeshBasicMaterial({name:'Theatre_light_line',color:0x8fe0ff}));
 const sky=plane(1,TOP+.005,new T.MeshBasicMaterial({name:'Theatre_stars',map:canvasTexture(2048,1340,stars)}),(x,z)=>[(x-ENTRY)/(BACK-ENTRY),(z+SIDE)/(2*SIDE)]);
 sky.name='Theatre_star_ceiling';group.add(sky);
 const rug=canvasTexture(256,256,carpet,[1,1]);rug.anisotropy=anisotropy;
 const floor=plane(-1,.018,new T.MeshLambertMaterial({name:'Theatre_carpet',map:rug}),(x,z)=>[x/1.6,z/1.6]);
 floor.name='Theatre_carpet';group.add(floor);
 // Warm sconces down both long walls, on the drapes: a gilt cup and its glow, instanced.
 const at=[];for(let x=-19;x<=17;x+=6)at.push([x,SIDE,-1]);for(let x=-7;x<=17;x+=6)at.push([x,-SIDE,1]);
 const cup=new T.CylinderGeometry(.16,.07,.28,10,1,false,0,Math.PI);cup.rotateY(Math.PI/2);
 const cups=new T.InstancedMesh(cup,new T.MeshBasicMaterial({name:'Theatre_sconce',color:0xc9a25a}),at.length);cups.name='Theatre_sconces';
 const halo=new T.InstancedMesh(new T.PlaneGeometry(1.1,1.5),new T.MeshBasicMaterial({name:'Theatre_sconce_glow',map:canvasTexture(128,128,sconceGlow),transparent:true,depthWrite:false,blending:T.AdditiveBlending}),at.length);halo.name='Theatre_sconce_glow';
 const m=new T.Matrix4(),q=new T.Quaternion();
 at.forEach(([x,z,s],i)=>{
  q.setFromAxisAngle(new T.Vector3(0,1,0),s>0?0:Math.PI);
  cups.setMatrixAt(i,m.compose(new T.Vector3(x,1.95,z+s*(INSET+.2)),q,new T.Vector3(1,1,1)));
  halo.setMatrixAt(i,m.compose(new T.Vector3(x,1.95,z+s*(INSET+.15)),q,new T.Vector3(1,1,1)));
 });
 group.add(cups,halo);
 // The screen: a black masking frame and the picture, dark until the film is playing.
 add('Theatre_screen_frame',new T.BoxGeometry(.08,SCREEN.h+.3,SCREEN.w+.3).translate(BACK-.06,SCREEN.y,0),new T.MeshBasicMaterial({name:'Theatre_screen_frame',color:0x050407}));
 const picture=new T.MeshBasicMaterial({name:'Theatre_screen',color:0x1b2338});
 const screen=add('Theatre_screen',new T.PlaneGeometry(SCREEN.w,SCREEN.h),picture);screen.rotation.y=-Math.PI/2;screen.position.set(BACK-.11,SCREEN.y,0);
 // A blue step light along the stage front.
 add('Theatre_stage_light',new T.BoxGeometry(.04,.04,22).translate(17.47,.27,0),new T.MeshBasicMaterial({name:'Theatre_stage_light',color:0x6fd2ff}));
 const centre=room.getWorldPosition(new T.Vector3());
 let video=null,retry=0;
 return {
  group,
  update(p){
   const near=Math.abs(p.y-centre.y)<4&&Math.hypot(p.x-centre.x,p.z-centre.z)<NEAR;
   if(!url)return;
   if(!near){if(video&&!video.paused)video.pause();return;}
   if(!video){
    video=document.createElement('video');Object.assign(video,{muted:true,loop:true,playsInline:true,preload:'auto'});video.setAttribute('playsinline','');
    video.addEventListener('playing',()=>{if(picture.map)return;const t=new T.VideoTexture(video);t.colorSpace=T.SRGBColorSpace;picture.map=t;picture.color.set(0xffffff);picture.needsUpdate=true;},{once:true});
    video.src=url;
   }
   const now=performance.now();
   if(video.paused&&now>retry){retry=now+3000;video.play().catch(()=>{});}
  },
 };
}
