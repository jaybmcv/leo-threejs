import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Deck 16's Voyage training & briefing room as an RGB gaming lounge on foot (from tester feedback; first stage):
// - dark grey walls, a cool light strip round the top of the walls and a dark ceiling of faintly twinkling stars;
// - eight PC stations along the outboard wall (curved dual monitors, RGB keyboard and mouse, tower, headset, gaming
//   chair), six console stations along the entry wall (one large screen, console, controller and headset on a side
//   table, gaming chair) and a curved couch facing a big screen at the forward end, controllers on its coffee table;
// - honeycomb clusters of hexagon wall lights that fade slowly through the colours, and a black glass floor of
//   0.25 m hexagon tiles that light up in colour round where you stand and fade behind you;
// - while the camera is in the room the walk's lights (shared by the whole ship) ease down, so the RGB glows.
// The room's briefing tables, chairs, consoles and cabinets go. The chairs and the couch are seats like any other
// (rest.js). Everything is the walk's own: the ship's models and exports are unchanged. The furniture joins the room
// before the colliders and rest spots are found, so it is solid and sittable; what glows or moves is a group of its
// own, drawn with the room's deck band (main.js).
// Room frame (Area_d16-training-aft): x along the room (+x toward the nose), z across (+z the entry wall, doorway at
// x 2..6), floor at y 0, wall faces at |x|=23.84 and |z|=7.84, the ceiling at 3.35. The aisle |z|<1.7 stays clear.
const ROOM='Area_d16-training-aft';
const END=23.84,SIDE=7.84,TOP=3.35,DOOR=[2,6],HEX=.25;
const OLD=/^(Seat|Back|Seat_base|Meeting_table|Table_support|Worktop|Training_console|Equipment_cabinet|Status_display|Briefing_wall|Aisle_inlay|Polish_.*|Refined_.*)$/;
const PCS=[-21,-17.4,-13.8,-10.2,-6.6,-3,.6,4.2],CONSOLES=[-21,-16.5,-12,-7.5,-3,10.5];
const ACCENTS=[0xff3b5c,0x2fd8ff,0xff4fd8,0x7dff5a,0xffa53a,0x9d6bff];
// The couch's arc: its centre, radii (seat front, seat back, back rest) and half span, facing +x to the big screen.
const COUCH={x:21.6,r0:3.35,r1:4.05,r2:4.3,half:.9};
// While the camera is in the room: the lights' share of their usual strength, and their colours.
const MOOD={hemi:.42,fill:.22,env:.3,sky:0x9aa8ff,ground:0x3a2458};
const TRAIL=8;

const canvas=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;};
function rng(seed){return ()=>(seed=(seed*16807)%2147483647)/2147483647;}
// Screen pictures: a space shooter for the PCs, a racer for the consoles and a four-way split screen for the couch.
function shooter(g,w,h){
 const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#0b0f2e');sky.addColorStop(.6,'#3a1658');sky.addColorStop(1,'#e2562f');g.fillStyle=sky;g.fillRect(0,0,w,h);
 const r=rng(7);for(let i=0;i<160;i++){g.fillStyle=`rgba(255,255,255,${.3+r()*.7})`;g.fillRect(r()*w,r()*h*.6,1.5,1.5);}
 g.fillStyle='#e8743a';g.beginPath();g.arc(w*.72,h*.78,h*.42,0,Math.PI*2);g.fill();
 g.fillStyle='#1a1030';g.beginPath();g.moveTo(0,h);for(let x=0;x<=w;x+=32)g.lineTo(x,h*.84-Math.abs(Math.sin(x*.03))*h*.12);g.lineTo(w,h);g.fill();
 g.strokeStyle='#5cf2ff';g.lineWidth=3;g.beginPath();g.arc(w/2,h/2,18,0,Math.PI*2);g.moveTo(w/2-30,h/2);g.lineTo(w/2+30,h/2);g.moveTo(w/2,h/2-30);g.lineTo(w/2,h/2+30);g.stroke();
 g.fillStyle='#5cf2ff';g.fillRect(16,h-28,140,10);g.fillStyle='#ff4fd8';g.fillRect(16,h-28,96,10);
 g.strokeStyle='rgba(92,242,255,.7)';g.strokeRect(w-96,14,80,80);
}
function racer(g,w,h){
 const sky=g.createLinearGradient(0,0,0,h*.5);sky.addColorStop(0,'#1a0838');sky.addColorStop(1,'#ff5fa0');g.fillStyle=sky;g.fillRect(0,0,w,h);
 g.fillStyle='#120a22';g.fillRect(0,h*.5,w,h*.5);
 g.strokeStyle='#ff4fd8';g.lineWidth=2;for(let i=0;i<10;i++){const y=h*.5+Math.pow(i/10,2)*h*.5;g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
 for(let i=-8;i<=8;i++){g.beginPath();g.moveTo(w/2+i*8,h*.5);g.lineTo(w/2+i*90,h);g.stroke();}
 g.fillStyle='#2fd8ff';g.beginPath();g.moveTo(w/2-70,h*.95);g.lineTo(w/2+70,h*.95);g.lineTo(w/2+44,h*.8);g.lineTo(w/2-44,h*.8);g.fill();
 g.fillStyle='#ffd45a';g.font='700 26px system-ui, sans-serif';g.fillText('LAP 2/3',18,34);g.textAlign='right';g.fillText('1ST',w-18,34);
}
function quad(g,w,h){
 const paint=[shooter,racer,racer,shooter];
 paint.forEach((p,i)=>{g.save();g.translate((i%2)*w/2,(i>>1)*h/2);g.scale(.5,.5);p(g,w,h);g.restore();});
 g.fillStyle='#05060a';g.fillRect(w/2-3,0,6,h);g.fillRect(0,h/2-3,w,6);
}

// The shaders: colour that drifts through the hues with time and place; the hex floor; the twinkling ceiling.
const COMMON=`vec3 hue(float h){return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.);}
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}`;
const VERTEX=`#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorld;varying vec2 vUv;
void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;
#include <logdepthbuf_vertex>
}`;
const RGB=`#include <common>
#include <logdepthbuf_pars_fragment>
${COMMON}
uniform float uTime,uSpeed,uSpread,uGain,uHalo;varying vec3 vWorld;varying vec2 vUv;
void main(){
#include <logdepthbuf_fragment>
 vec3 c=mix(hue(uTime*uSpeed+(vWorld.x*.8+vWorld.z*.5)*uSpread),vec3(1.),.08)*uGain;
 float a=1.;if(uHalo>.5){a=1.-clamp(length(vUv-.5)*2.,0.,1.);a*=a;}
 gl_FragColor=vec4(c*a,a);
#include <colorspace_fragment>
}`;
const FLOOR=`#include <common>
#include <logdepthbuf_pars_fragment>
${COMMON}
uniform float uTime,uSize;uniform vec4 uTrail[${TRAIL}];uniform vec4 uRoom;varying vec3 vWorld;
const vec2 S=vec2(1.,1.7320508);
vec4 cell(vec2 p){vec4 c=floor(vec4(p,p-vec2(.5,1.))/S.xyxy)+.5;vec4 h=vec4(p-c.xy*S,p-(c.zw+.5)*S);
 return dot(h.xy,h.xy)<dot(h.zw,h.zw)?vec4(h.xy,c.xy):vec4(h.zw,c.zw+.5);}
void main(){
#include <logdepthbuf_fragment>
 vec4 h=cell(vWorld.xz/uSize);vec2 q=abs(h.xy);float e=max(dot(q,S*.5),q.x);
 vec2 centre=vWorld.xz-h.xy*uSize;
 float glow=0.;for(int i=0;i<${TRAIL};i++){vec4 t=uTrail[i];glow+=t.w*(1.-smoothstep(.12,.7,distance(centre,t.xz)));}
 glow=min(glow,1.);
 float wall=min(min(vWorld.x-uRoom.x,uRoom.z-vWorld.x),min(vWorld.z-uRoom.y,uRoom.w-vWorld.z));
 vec3 c=vec3(.003,.0035,.005)+.004*hash(h.zw)+vec3(.02,.024,.03)*(1.-smoothstep(0.,1.4,wall));
 vec3 rgb=hue(uTime*.12+(centre.x+centre.y)*.35);
 c+=rgb*glow*(.3+.9*smoothstep(.22,.47,e));
 c=mix(c,vec3(.018,.02,.026)+rgb*glow*.5,smoothstep(.455,.475,e));
 gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`;
const STARS=`#include <common>
#include <logdepthbuf_pars_fragment>
${COMMON}
uniform float uTime;varying vec3 vWorld;
void main(){
#include <logdepthbuf_fragment>
 vec2 p=vWorld.xz/.22,id=floor(p),f=fract(p)-.5;
 vec3 c=vec3(.006,.007,.016)+vec3(.01,.004,.018)*(.5+.5*sin(vWorld.x*.31+sin(vWorld.z*.47)*2.));
 float s=hash(id);
 // Far off, where a pixel spans more than a star, the star fades rather than smearing into a streak.
 if(s>.84){vec2 o=vec2(hash(id+3.1),hash(id+7.7))-.5;float r=mix(.035,.11,pow(hash(id+1.3),4.)),d=length(f-o*.6);
  float px=length(fwidth(p)),tw=.55+.45*sin(uTime*(.6+2.2*hash(id+9.1))+hash(id+5.3)*6.2832);
  c+=mix(vec3(1.),vec3(.7,.82,1.),hash(id+2.9))*(1.-smoothstep(r*.35,r,d))*min(1.,r*2./px)*tw*.7;}
 gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`;

// Take the room's briefing furniture out and put the lounge's in, before the colliders and rest spots are found. The
// walls go dark grey and the room's title light, so it reads on them. Returns false if the room is missing.
export function dressGamingLounge(ship){
 const room=ship.root.getObjectByName(ROOM);if(!room)return false;
 const fit=room.getObjectByName('Room_fittings'),shell=room.getObjectByName('Walls_and_ceiling');if(!fit||!shell)return false;
 const old=[];room.traverse(o=>{if(o.isMesh&&(OLD.test(o.name)||o.name==='Ceiling_light'))old.push(o);});
 for(const o of old){const p=o.parent;o.removeFromParent();if(p!==fit&&p!==shell&&p!==room&&!p.children.length)p.removeFromParent();}
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Gaming_'+name,color,roughness:.6,...o});
 const M={wall:mat('wall',0x3a3d43,{roughness:.85}),ceiling:mat('ceiling',0x111317,{roughness:.9}),
  title:new T.MeshBasicMaterial({name:'Gaming_title',color:0xdfe7f2}),
  black:mat('black',0x15161a,{roughness:.45}),leather:mat('leather',0x1b1c21,{roughness:.55}),metal:mat('metal',0x55595f,{metalness:.7,roughness:.35}),
  desk:mat('desk',0x0f1013,{roughness:.3,metalness:.2}),glass:mat('glass',0x0b0d12,{roughness:.08,metalness:.3}),
  couch:mat('couch',0x262335,{roughness:.8}),cushion:mat('cushion',0x332d4a,{roughness:.85}),white:mat('white',0xe9ecef,{roughness:.4}),
  accent:ACCENTS.map((c,i)=>mat('accent_'+i,c,{roughness:.5}))};
 for(const o of shell.children)if(o.isMesh)o.material=o.name==='Ceiling'?M.ceiling:o.name==='Entry_header'?o.material:M.wall;
 fit.traverse(o=>{if(o.isMesh&&o.name==='Service_wayfinding')o.material=M.title;});
 const box=(name,size,pos,m,parent=fit,rot=0)=>{const o=new T.Mesh(new T.BoxGeometry(...size),m);o.name=name;o.position.set(...pos);o.rotation.y=rot;parent.add(o);return o;};
 // A gaming chair facing +z in its own frame, turned `rot`: star base, gas lift, seat, tall back, wings and arms.
 function chair(x,z,rot,accent){
  const g=new T.Group();g.name='Gaming_chair';g.position.set(x,0,z);g.rotation.y=rot;fit.add(g);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2,leg=box('Chair_leg',[.05,.04,.32],[Math.sin(a)*.15,.06,Math.cos(a)*.15],M.metal,g);leg.rotation.y=a;}
  box('Chair_lift',[.06,.34,.06],[0,.25,0],M.metal,g);
  box('Seat',[.56,.1,.54],[0,.47,0],M.leather,g);
  for(const sx of [-1,1])box('Seat_bolster',[.07,.07,.5],[sx*.265,.55,0],accent,g);
  const back=box('Back',[.54,.84,.1],[0,.98,-.3],M.leather,g);back.rotation.x=-.12;
  for(const sx of [-1,1]){const w=box('Chair_wing',[.07,.78,.12],[sx*.27,.98,-.3],accent,g);w.rotation.x=-.12;}
  const head=box('Chair_headrest',[.3,.14,.06],[0,1.28,-.3],accent,g);head.rotation.x=-.12;
  for(const sx of [-1,1]){box('Chair_arm_post',[.04,.2,.04],[sx*.33,.6,-.04],M.metal,g);box('Chair_arm',[.08,.04,.3],[sx*.33,.71,-.02],M.black,g);}
 }
 // PC stations: a desk against the outboard wall, its tower beneath, and the chair.
 PCS.forEach((x,i)=>{
  const z=-SIDE+.4;
  box('Gaming_desk_top',[1.7,.05,.75],[x,.735,z],M.desk);
  for(const sx of [-1,1])box('Gaming_desk_leg',[.05,.71,.65],[x+sx*.8,.355,z],M.black);
  box('Gaming_mouse_pad',[.95,.006,.36],[x+.1,.763,z+.17],M.black);
  box('Gaming_pc_tower',[.22,.46,.45],[x+.58,.23,z],M.black);
  for(const sx of [-.42,.42])box('Monitor_stand',[.05,.34,.04],[x+sx,.93,z-.24],M.metal);
  box('Monitor_foot',[.9,.015,.16],[x,.767,z-.22],M.metal);
  chair(x,-SIDE+1.55,Math.PI,M.accent[i%ACCENTS.length]);
 });
 // Console stations: a cabinet under a wall screen on the entry wall, a side table, and the chair.
 CONSOLES.forEach((x,i)=>{
  box('Media_cabinet',[1.4,.42,.4],[x,.21,SIDE-.2],M.black);
  box('Game_console',[.34,.07,.26],[x-.3,.455,SIDE-.22],i%2?M.white:M.black);
  box('Wall_screen_frame',[1.62,.94,.05],[x,1.35,SIDE-.025],M.black);
  const t=new T.Mesh(new T.CylinderGeometry(.2,.2,.04,20),M.desk);t.name='Side_table_top';t.position.set(x+.62,.55,SIDE-2.15);fit.add(t);
  const s=new T.Mesh(new T.CylinderGeometry(.03,.03,.53,8),M.metal);s.name='Side_table_stem';s.position.set(x+.62,.265,SIDE-2.15);fit.add(s);
  chair(x,SIDE-2.25,0,M.accent[(i+3)%ACCENTS.length]);
 });
 // The couch lounge: a big screen on the forward end wall over a low console, and a curved couch round a coffee table.
 box('Lounge_screen_frame',[.06,1.86,3.26],[END-.03,1.5,0],M.black);
 box('Lounge_media_console',[.45,.4,2.4],[END-.25,.2,0],M.black);
 for(const dz of [-.5,.5])box('Game_console',[.26,.07,.34],[END-.25,.435,dz],dz<0?M.white:M.black);
 // Seat and back are annular sectors round the arc's centre, which is each mesh's own origin (rest.js seats along it).
 const sector=(r0,r1,h)=>{const a0=Math.PI-COUCH.half,a1=Math.PI+COUCH.half,s=new T.Shape();
  s.absarc(0,0,r1,a0,a1,false);s.absarc(0,0,r0,a1,a0,true);
  const g=new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:24});g.rotateX(Math.PI/2);g.translate(0,h,0);return g;};
 const curved=(name,r0,r1,h,y,m)=>{const g=sector(r0,r1,h);g.translate(0,y,0);g.computeVertexNormals();const o=new T.Mesh(g,m);o.name=name;o.position.set(COUCH.x,0,0);fit.add(o);return o;};
 curved('Gaming_couch_base',COUCH.r0+.05,COUCH.r2,.3,.04,M.couch);
 curved('Gaming_curved_couch_seat',COUCH.r0,COUCH.r1,.14,.34,M.cushion);
 curved('Gaming_curved_couch_back',COUCH.r1,COUCH.r2,.62,.34,M.couch);
 box('Coffee_table_top',[.8,.05,1.8],[19.45,.42,0],M.glass);
 box('Coffee_table_base',[.6,.36,1.5],[19.45,.18,0],M.black);
 room.updateMatrixWorld(true);
 return true;
}

// A small controller (body and two grips) and a headset (band and cups), as geometry to place.
function controllerGeometry(){
 const body=new T.BoxGeometry(.15,.035,.07),grips=[-1,1].map(s=>new T.CylinderGeometry(.022,.026,.08,8).rotateX(Math.PI/2+.4).translate(s*.06,-.005,.035));
 const sticks=[-1,1].map(s=>new T.CylinderGeometry(.01,.01,.02,6).translate(s*.03,.025,.005));
 return mergeGeometries([body,...grips,...sticks].map(g=>g.index?g.toNonIndexed():g));
}
function headsetGeometry(){
 const band=new T.TorusGeometry(.085,.012,6,16,Math.PI),cups=[-1,1].map(s=>new T.CylinderGeometry(.045,.045,.035,14).rotateZ(Math.PI/2).translate(s*.085,0,0));
 return mergeGeometries([band,...cups].map(g=>g.index?g.toNonIndexed():g));
}

// The glowing and moving parts, in ship coordinates. `update` runs each frame with the camera's position and the
// walker's (whose steps light the floor).
export function createGamingLounge(ship,light=null,{still=false}={}){
 const room=ship.root.getObjectByName(ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Walk_gaming_lounge';
 room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const origin=group.position.clone();
 const time={value:0};
 const rgb=(name,speed,spread,gain,halo=false)=>new T.ShaderMaterial({name:'Gaming_'+name,vertexShader:VERTEX,fragmentShader:RGB,
  uniforms:{uTime:time,uSpeed:{value:speed},uSpread:{value:spread},uGain:{value:gain},uHalo:{value:halo?1:0}},
  ...(halo?{transparent:true,depthWrite:false,blending:T.AdditiveBlending}:{})});
 const M={hex:rgb('hex_light',.035,.025,1.1),halo:rgb('hex_glow',.035,.025,.5,true),keys:rgb('keyboard',.25,.9,1),
  basic:(name,color)=>new T.MeshBasicMaterial({name:'Gaming_'+name,color,toneMapped:false}),
  dark:new T.MeshStandardMaterial({name:'Gaming_kit',color:0x18191d,roughness:.5}),bezel:new T.MeshStandardMaterial({name:'Gaming_bezel',color:0x0c0d10,roughness:.35,side:T.DoubleSide})};
 const parts=new Map();const piece=(m,g)=>{(parts.get(m)||parts.set(m,[]).get(m)).push(g.index?g.toNonIndexed():g);};
 const at=(g,x,y,z,ry=0)=>{g.rotateY(ry);g.translate(x,y,z);return g;};
 // Hexagon wall lights in honeycomb clusters: a dark frame, the glowing face and a soft halo on the wall behind.
 const R=.2,cells=[[0,0],[1,0],[.5,1],[1.5,1],[2,0],[-.5,1]];
 const hexes=[];
 const cluster=(x,y,z,ry,n=4,flip=1)=>{for(const [c,r] of cells.slice(0,n))hexes.push({x:x+c*R*1.75*flip,y:y+r*R*1.52,z,ry});};
 // Outboard wall over the PCs (clear of the title in the middle), the entry wall over the screens, both end walls.
 for(const x of [-20,-12.5,-6.2,7.5])cluster(x,2.2,-SIDE,0,x===-6.2?3:5);
 for(const x of [-18.7,-9.7,-.5,13.8])cluster(x,2.15,SIDE,Math.PI,5);
 for(const z of [-5,0,4.2])cluster(z,2.05,0,Math.PI/2,z?4:6);
 for(const z of [-5.6,4])cluster(z,2.1,0,-Math.PI/2,4);
 const hexFace=new T.CylinderGeometry(R*.84,R*.84,.02,6).rotateX(Math.PI/2),hexFrame=new T.CylinderGeometry(R*.97,R*.97,.03,6).rotateX(Math.PI/2),halo=new T.PlaneGeometry(R*5,R*5);
 for(const h of hexes){
  // End-wall clusters run along z: their `x` is the along-wall offset; place them on the wall they face.
  let px=h.x,pz=h.z;const n=h.ry===0?[0,1]:h.ry===Math.PI?[0,-1]:h.ry===Math.PI/2?[1,0]:[-1,0];
  if(Math.abs(h.ry)===Math.PI/2){pz=h.x;px=h.ry>0?-END:END;}
  const off=d=>[px+n[0]*d,pz+n[1]*d];
  piece(M.dark,at(hexFrame.clone(),off(.015)[0],h.y,off(.015)[1],h.ry));
  piece(M.hex,at(hexFace.clone(),off(.025)[0],h.y,off(.025)[1],h.ry));
  piece(M.halo,at(halo.clone(),off(.004)[0],h.y,off(.004)[1],h.ry));
 }
 // The light strip round the top of the walls, with a soft cool wash on the wall below it.
 const strip=M.basic('light_strip',0xcfe6ff);
 const runs=[[[-END,-SIDE],[END,-SIDE],[0,1]],[[-END,SIDE],[DOOR[0],SIDE],[0,-1]],[[DOOR[1],SIDE],[END,SIDE],[0,-1]],[[-END,-SIDE],[-END,SIDE],[1,0]],[[END,-SIDE],[END,SIDE],[-1,0]]];
 const wash=[];
 for(const [a,b,n] of runs){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),ry=-Math.atan2(b[1]-a[1],b[0]-a[0]),cx=(a[0]+b[0])/2,cz=(a[1]+b[1])/2;
  piece(strip,new T.BoxGeometry(len,.035,.04).rotateY(ry).translate(cx+n[0]*.03,3.12,cz+n[1]*.03));
  const g=new T.PlaneGeometry(len,.5);const cols=[];for(let i=0;i<g.attributes.position.count;i++){const k=g.attributes.position.getY(i)>0?.09:0;cols.push(.55*k,.75*k,k);}
  g.setAttribute('color',new T.Float32BufferAttribute(cols,3));
  g.rotateY(Math.atan2(n[0],n[1]));g.translate(cx+n[0]*.006,2.86,cz+n[1]*.006);wash.push(g);
 }
 const washMesh=new T.Mesh(mergeGeometries(wash),new T.MeshBasicMaterial({name:'Gaming_light_wash',vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
 washMesh.name='Gaming_light_wash';group.add(washMesh);
 // PC kit: two curved monitors round the sitter's eye, keyboard and mouse in colour, the tower's colour strip, a headset.
 const pc=M.basic('pc_screen',0xffffff);pc.side=T.DoubleSide;pc.map=canvas(512,288,shooter);
 const controller=controllerGeometry(),headset=headsetGeometry();
 PCS.forEach(x=>{
  const z=-SIDE+.4,eye=[x,1.08,-SIDE+1.55],r=1.4,w=.56;
  for(const [start,len] of [[Math.PI-w-.012,w],[Math.PI+.012,w]]){
   const face=new T.CylinderGeometry(r,r,.38,16,1,true,start,len),uv=face.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
   piece(pc,face.translate(...eye));
   piece(M.bezel,new T.CylinderGeometry(r+.02,r+.02,.42,16,1,true,start-.008,len+.016).translate(...eye));
  }
  piece(M.dark,new T.BoxGeometry(.46,.022,.15).translate(x-.12,.775,z+.18));
  piece(M.keys,new T.BoxGeometry(.43,.006,.13).translate(x-.12,.789,z+.18));
  piece(M.dark,new T.BoxGeometry(.065,.03,.11).translate(x+.36,.778,z+.2));
  piece(M.keys,new T.BoxGeometry(.075,.004,.12).translate(x+.36,.764,z+.2));
  piece(M.keys,new T.BoxGeometry(.006,.36,.02).translate(x+.69,.25,z+.226));
  piece(M.dark,headset.clone().translate(x-.66,.85,z-.05));
 });
 // Console kit: the wall screen's picture, a light on the console, controller and headset on the side table.
 const tv=M.basic('console_screen',0xffffff);tv.map=canvas(512,288,racer);
 CONSOLES.forEach(x=>{
  piece(tv,new T.PlaneGeometry(1.52,.855).rotateY(Math.PI).translate(x,1.35,SIDE-.052));
  piece(M.keys,new T.BoxGeometry(.2,.006,.01).translate(x-.3,.47,SIDE-.35));
  piece(M.dark,controller.clone().rotateY(.5).translate(x+.58,.59,SIDE-2.2));
  piece(M.dark,headset.clone().rotateZ(Math.PI/2).rotateX(Math.PI/2).translate(x+.68,.59,SIDE-2.05));
 });
 // The couch lounge: the big screen's split-screen picture, three controllers on the table and its colour underglow.
 const big=M.basic('lounge_screen',0xffffff);big.map=canvas(1024,576,quad);
 piece(big,new T.PlaneGeometry(3.1,1.74).rotateY(-Math.PI/2).translate(END-.065,1.5,0));
 for(const [dz,ry] of [[-.5,.3],[.05,-.2],[.55,.15]])piece(M.dark,controller.clone().rotateY(Math.PI/2+ry).translate(19.4,.48,dz));
 piece(M.keys,new T.BoxGeometry(.62,.012,1.52).translate(19.45,.012,0));
 piece(M.keys,new T.BoxGeometry(.03,.02,2.2).translate(END-.48,.03,0));
 for(const [m,list] of parts){const o=new T.Mesh(mergeGeometries(list),m);o.name=m.name;group.add(o);}
 // The floor: black glass hexagons over the room's own floor; the ceiling of stars under its own.
 const uRoom={value:new T.Vector4(origin.x-END,origin.z-SIDE,origin.x+END,origin.z+SIDE)},trail=Array.from({length:TRAIL},()=>new T.Vector4());
 const floor=new T.Mesh(new T.PlaneGeometry(END*2,SIDE*2).rotateX(-Math.PI/2).translate(0,.01,0),new T.ShaderMaterial({name:'Gaming_hex_floor',vertexShader:VERTEX,fragmentShader:FLOOR,
  uniforms:{uTime:time,uSize:{value:HEX},uTrail:{value:trail},uRoom}}));
 floor.name='Gaming_hex_floor';group.add(floor);
 const sky=new T.Mesh(new T.PlaneGeometry(END*2,SIDE*2).rotateX(Math.PI/2).translate(0,TOP-.004,0),new T.ShaderMaterial({name:'Gaming_star_ceiling',vertexShader:VERTEX,fragmentShader:STARS,uniforms:{uTime:time}}));
 sky.name='Gaming_star_ceiling';group.add(sky);
 // The room, in ship coordinates: where the floor lights and the mood holds.
 const inside=new T.Box3(new T.Vector3(origin.x-END,origin.y-.5,origin.z-SIDE),new T.Vector3(origin.x+END,origin.y+TOP,origin.z+SIDE));
 // The mood: the walk's lights ease down and cool while the camera is in the room.
 let mood=0,shown=0,setMood=null;
 if(light){
  const {hemi,fill,scene}=light,base={hemi:hemi.intensity,fill:fill.intensity,env:scene.environmentIntensity,sky:hemi.color.clone(),ground:hemi.groundColor.clone()};
  const skyC=new T.Color(MOOD.sky),groundC=new T.Color(MOOD.ground);
  setMood=t=>{const f=(a,b)=>a+(b-a)*t;hemi.intensity=f(base.hemi,base.hemi*MOOD.hemi);fill.intensity=f(base.fill,base.fill*MOOD.fill);
   scene.environmentIntensity=f(base.env,base.env*MOOD.env);hemi.color.lerpColors(base.sky,skyC,t);hemi.groundColor.lerpColors(base.ground,groundC,t);};
 }
 // The floor's trail: where the walker has stood lately, each mark fading over a second and a half.
 let head=0;const last=new T.Vector3(1e9,0,0);
 return {
  group,
  update(dt,eye,p){
   if(!still)time.value+=dt;
   for(const t of trail)t.w=Math.max(0,t.w-dt/1.5);
   if(inside.containsPoint(p)&&Math.abs(p.y-origin.y)<.6){
    if(p.distanceTo(last)>.18){head=(head+1)%TRAIL;last.copy(p);}
    trail[head].set(p.x,p.y,p.z,1);
   }
   if(!setMood)return;
   mood+=((inside.containsPoint(eye)?1:0)-mood)*(1-Math.exp(-4*dt));
   if(Math.abs(mood-shown)>.002||(mood<.002&&shown)){shown=mood<.002?0:mood;setMood(shown);}
  },
  get mood(){return shown;},
 };
}
