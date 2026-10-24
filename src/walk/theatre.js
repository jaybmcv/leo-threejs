import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// The Deck 16 community theatre as a cinema (first stage): purple drapes round the walls under a pelmet with a blue
// light line, a starry ceiling, plum carpet, warm wall sconces and a real screen above the stage. Everything is
// unlit or baked colour, one mesh per material, so the room adds no lights. The room's own blue backdrop panel goes,
// and its title moves onto the pelmet above the screen, where it can be read.
// Room frame (Area_d16-theater-5): the stage end at +x, the entrance at -x, the stair lobby notch at x<-12, z<-9.
// The screen plays a short muted loop (src/walk/art/theatre-loop.mp4), fetched and played only while a walker is near.
const ROOM='Area_d16-theater-5',NEAR=40;
const BACK=25.84,SIDE=16.84,ENTRY=-25.84,NOTCH={x:-12,z:-9},DOOR=2.2,LIP=2.95,TOP=3.28,INSET=.16;
const SCREEN={w:4,h:2.25,y:1.68};
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
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);
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

// Dress the theatre in `ship` before it is baked for walking. Returns the room group (draw it with its deck band) and an
// update to call a few times a second with the walker's position, which starts and stops the film.
export function createTheatre(ship,{url,anisotropy=1}={}){
 const room=ship.root.getObjectByName(ROOM);if(!room)return null;
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
