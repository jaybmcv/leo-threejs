import {fittedLoungeFalls} from '../v2/lounge-falls-fit.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {roomObject} from '../plan/rooms.js';
import {seeded} from '../polish-kit.js';
import {LOUNGE} from '../hydro-nip-lounge.js';
import {POND,PATH,LANDING,FALL,BENCH,fallZ} from '../v2/lounge-falls-layout.js';

// The Hydro-Nip Lounge's waterfall pond on foot (from tester feedback). The shared kitchen island and its four chairs
// between the Terpene Tasting Deck and the broad stair give way to a rock-rimmed pond. A sheet of glowing water falls
// into it from a stone lip on the edge of the upper rear gallery (Deck 19), in front of the lower gallery's railing.
// A stone causeway with rope rails crosses the pond and runs through the falling water to a flagstone landing under the
// lower gallery, where a bench stands against the back wall, looking out through the water. Ferns and glowing
// mushrooms sit on the rim, vines hang from the lip's ends, and the water lights the floor, the wall and the gallery's
// underside round it.
// The water is two small shaders (the falling sheet and the pond's surface), no textures and no lights.
// Frame: the commons template, moved aft and mirrored by Neighborhood 1.
const {FLOOR,LEVELS}=LOUNGE;
// The pond is narrowed between the dome and stair planter. Its bed is solid just under the water; its rim is too high to
// step in over from the floor but low enough to step out over from the bed.
const BED=FLOOR+.22,WATER=FLOOR+.27,RIM=FLOOR+.58;
// The sheet follows the pond-side edge of Deck 19, clear of the Deck 18 rail behind it.
const NEAR=50,CYAN=0x46e6ff;
const MOVE=new T.Matrix4();
// What the pond replaces: the kitchen island, its hobs, sink and worktop edge, and the seam over its chairs.
const OLD=/^(Shared_kitchen_island|Induction_hob|Kitchen_sink|Kitchen_worktop_edge|Polish_tailored_seam)$/,ISLAND={x0:126.5,x1:136.5,z0:36,z1:40.5};

// A point on the pond's edge at angle t, `grow` metres out from it.
const edge=(t,grow=0)=>{const c=Math.cos(t),s=Math.sin(t),k=2/POND.n;return [POND.x+(POND.a+grow)*Math.sign(c)*Math.abs(c)**k,POND.z+(POND.b+grow)*Math.sign(s)*Math.abs(s)**k];};
const halfWidth=z=>{const u=Math.min(1,Math.abs(z-POND.z)/POND.b);return POND.a*(1-u**POND.n)**(1/POND.n);};
// The rim is open where the causeway comes in at the front and under the landing at the back.
const open=([x,z],pad=0)=>(Math.abs(x-POND.x)<(PATH.x1-PATH.x0)/2+pad&&z<POND.z)||(x>LANDING.x0-.2-pad&&x<LANDING.x1+.2+pad&&z>LANDING.z0-.4);
// Points spaced `spacing` apart round the edge, `grow` out.
function around(grow,spacing){
 const pts=[];let prev=edge(0,grow),run=spacing;
 for(let i=1;i<=3000;i++){const t=i/3000*Math.PI*2,p=edge(t,grow);run+=Math.hypot(p[0]-prev[0],p[1]-prev[1]);prev=p;if(run>=spacing){run=0;pts.push(p);}}
 return pts;
}

// Before the colliders and seats are found: the island, its hobs, sink and chairs go, and the bench joins the lounge so
// the walk's seats (rest.js) find it by its seat and back names and the colliders hold it. Returns false without the
// lounge.
export function prepareLoungeFalls(ship){
 const lounge=roomObject(ship,'Hydro_Nip_Lounge'),commons=roomObject(ship,'commons-1');if(!lounge||!commons)return false;
 commons.updateMatrixWorld(true);
 const toFrame=lounge.matrixWorld.clone().invert(),box=new T.Box3(),c=new T.Vector3(),gone=[];
 commons.traverse(o=>{
  if(o.name==='Tail_clearance_chair'&&o.parent?.name==='Neighborhood_shared_services'&&o.position.z===37){gone.push(o);return;}
  if(!o.isMesh||!OLD.test(o.name))return;
  if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
  box.copy(o.geometry.boundingBox).applyMatrix4(toFrame.clone().multiply(o.matrixWorld)).getCenter(c);
  if(c.x>ISLAND.x0&&c.x<ISLAND.x1&&c.z>ISLAND.z0&&c.z<ISLAND.z1)gone.push(o);
 });
 for(const o of gone)o.removeFromParent();
 lounge.add(bench());
 return true;
}

// The bench against the back wall, facing the falls: oak slats on stone ends, with a back.
function bench(){
 const g=new T.Group();g.name='Lounge_falls_bench';
 const oak=new T.MeshStandardMaterial({name:'Lounge_falls_bench_oak',color:0x8a5a36,roughness:.7}),stone=new T.MeshStandardMaterial({name:'Lounge_falls_bench_stone',color:0x8d8a80,roughness:.9,flatShading:true});
 const part=(name,size,[x,y,z],mat,tilt=0)=>{const o=new T.Mesh(new T.BoxGeometry(...size),mat);o.name=name;o.position.set(BENCH.x+x,LANDING.top+y,BENCH.z+z);o.rotation.x=tilt;o.castShadow=o.receiveShadow=true;g.add(o);};
 part('Garden_bench_cushion',[BENCH.width,.08,.46],[0,.43,-.02],oak);
 part('Garden_bench_back',[BENCH.width,.4,.06],[0,.78,.25],oak,.12);
 for(const s of [-1,1]){part('Lounge_falls_bench_end',[.16,.39,.42],[s*(BENCH.width/2-.25),.195,0],stone);part('Lounge_falls_bench_post',[.12,.8,.08],[s*(BENCH.width/2-.25),.4,.27],stone);}
 return g;
}

// The falling sheet: streaks that speed up as they fall, ragged sides, foam at the lip and the foot, and sparkles.
// uv is metres: across the sheet, and down from the lip.
const VERTEX=`#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`;
const NOISE=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}`;
const SHEET=`#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;uniform vec2 uSize;varying vec2 vUv;
${NOISE}
void main(){
#include <logdepthbuf_fragment>
 float x=vUv.x,d=vUv.y,t=uTime,fall=sqrt(d+.4);
 float a1=noise(vec2(x*7.,fall*5.-t*2.6)),a2=noise(vec2(x*19.+3.,fall*9.-t*4.1)),a3=noise(vec2(x*41.+9.,fall*14.-t*6.));
 float streak=pow(a1*.5+a2*.32+a3*.18,1.8);
 float side=smoothstep(0.,.25+.35*noise(vec2(d*1.3-t*.8,7.)),min(x,uSize.x-x));
 float foot=smoothstep(uSize.y-1.4,uSize.y,d)*(.6+.4*a2),lip=1.-smoothstep(0.,.45,d);
 vec2 cell=vec2(x*5.,d*2.4-t*3.2),f=fract(cell)-.5;float spark=step(.92,hash(floor(cell)))*smoothstep(.16,0.,length(f*vec2(1.,.45)));
 vec3 c=mix(vec3(.02,.22,.6),vec3(.45,.95,1.),streak)+vec3(.75,1.,1.)*(foot*.55+lip*.35)+spark*vec3(.9,1.,1.);
 gl_FragColor=vec4(c*1.25,clamp((.22+.6*streak+.4*foot+.3*lip+spark)*side,0.,.92));
#include <colorspace_fragment>
}`;
// The pond's surface: deep teal lit from below, caustics drifting over it, and rings spreading from the falls' foot.
// uv is the template's x and z in metres; uFall is the foot's x0, x1 and z.
const POOL=`#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;uniform vec3 uFall;varying vec2 vUv;
${NOISE}
void main(){
#include <logdepthbuf_fragment>
 vec2 p=vUv*.9;float t=uTime*.45,v=0.;
 for(int i=0;i<3;i++){p+=vec2(sin(p.y*1.7+t),cos(p.x*1.3-t*1.1))*.55;v+=abs(sin(p.x+p.y));}
 float caustic=pow(1.-v/3.,5.);
 float dx=max(max(uFall.x-vUv.x,vUv.x-uFall.y),0.),dz=max(uFall.z-vUv.y,0.),d=length(vec2(dx,dz));
 float near=exp(-d*.45),rings=(.5+.5*sin(d*7.-uTime*3.5))*exp(-d*.6);
 vec3 c=vec3(.0,.16,.3)+vec3(.05,.55,.8)*near*.6+vec3(.5,1.,1.)*(caustic*.55+rings*.18+noise(vUv*3.+t)*.05);
 gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`;

// The pond, in ship coordinates. `group` draws (with the lounge floor's deck band), `solid` holds the rim, the bed, the
// causeway, the landing and the rope rails for the colliders, and update() lets the water run while the walker is
// within NEAR metres.
function createUnfittedLoungeFalls(ship){
 const lounge=roomObject(ship,'Hydro_Nip_Lounge');if(!lounge)return null;
 lounge.updateWorldMatrix(true,false);
 const rnd=seeded(121),centre=new T.Vector3(POND.x,FLOOR,POND.z).applyMatrix4(MOVE).applyMatrix4(lounge.matrixWorld);
 // Drawn in the template frame, under a group placed at the pond so it joins the right deck band (the renderer turns
 // the faces round under the commons' mirror).
 const group=new T.Group();group.name='Lounge_falls';group.position.copy(centre);
 const frame=new T.Group();frame.matrixAutoUpdate=false;frame.matrix.makeTranslation(-centre.x,-centre.y,-centre.z).multiply(lounge.matrixWorld).multiply(MOVE);group.add(frame);
 const solid=new T.Group();solid.name='Lounge_falls_colliders';solid.matrixAutoUpdate=false;solid.matrix.copy(lounge.matrixWorld).multiply(MOVE);
 const block=(w,h,d,x,y,z,turn=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.position.set(x,y,z);o.rotation.y=turn;solid.add(o);};

 // Few materials, colour per vertex.
 const M={
  stone:new T.MeshStandardMaterial({name:'Lounge_falls_stone',vertexColors:true,flatShading:true,roughness:.92}),
  rope:new T.MeshStandardMaterial({name:'Lounge_falls_rope',vertexColors:true,roughness:.85}),
  leaf:new T.MeshStandardMaterial({name:'Lounge_falls_leaf',vertexColors:true,flatShading:true,roughness:.8,side:T.DoubleSide}),
  glow:new T.MeshBasicMaterial({name:'Lounge_falls_glow',vertexColors:true,toneMapped:false}),
  halo:new T.MeshBasicMaterial({name:'Lounge_falls_halo',vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,side:T.DoubleSide}),
 };
 const lists=new Map(),black=new T.Color(0);
 // `color` is a colour, or a function of a vertex's position giving one (the halos fade out with it).
 const put=(mat,g,color)=>{const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();for(const k of Object.keys(n.attributes))if(k!=='position'&&k!=='normal')n.deleteAttribute(k);
  if(!n.attributes.normal)n.computeVertexNormals();const p=n.attributes.position,a=new Float32Array(p.count*3),v=new T.Vector3(),fixed=typeof color==='function'?null:new T.Color(color);
  for(let i=0;i<p.count;i++)(fixed||color(v.fromBufferAttribute(p,i))).toArray(a,i*3);
  n.setAttribute('color',new T.BufferAttribute(a,3));(lists.get(mat)||lists.set(mat,[]).get(mat)).push(n);};
 const stoneTint=(k=1)=>new T.Color(0x8a857a).multiplyScalar((.72+rnd()*.38)*k).lerp(new T.Color(0x5f6e4a),rnd()*.35);
 const rock=(r,[x,y,z],sx=1.2,sy=.85,detail=1,k=1)=>put(M.stone,new T.IcosahedronGeometry(r,detail).scale(sx,sy,1+rnd()*.2).rotateY(rnd()*6).translate(x,y,z),stoneTint(k));
 const slab=(x0,x1,z0,z1,y0,y1,color)=>put(M.stone,new T.BoxGeometry(x1-x0,y1-y0,z1-z0).translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2),color);
 const UP=new T.Vector3(0,1,0);
 const rod=(mat,a,b,r,color,seg=6)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),g=new T.CylinderGeometry(r,r,d.length(),seg,1);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(UP,d.normalize()));put(mat,g.translate(...A.add(B).multiplyScalar(.5).toArray()),color);};

 // The rim: big stones half sunk round the foot, a course of smaller ones on top, and stones at the water line inside.
 for(const [x,z] of around(.24,.5))if(!open([x,z],.3))rock(.27+rnd()*.08,[x,FLOOR+.17,z],1.25,.9,0,.9);
 for(const [x,z] of around(.12,.42))if(!open([x,z],.2)){const r=.17+rnd()*.07;rock(r,[x,RIM-r*.55,z]);}
 for(const [x,z] of around(-.08,.55))if(!open([x,z],.1))rock(.11+rnd()*.05,[x,WATER,z],1.3,.7,0,.8);
 // Solid: the rim as a ring of low walls, too high to step in over (open at the causeway and under the landing), and
 // the bed in strips just under the water.
 {const pts=around(.2,.45);pts.forEach((p,i)=>{const q=pts[(i+1)%pts.length],mid=[(p[0]+q[0])/2,(p[1]+q[1])/2];if(open(mid,.25))return;
  block(Math.hypot(q[0]-p[0],q[1]-p[1])+.12,RIM-FLOOR,.5,mid[0],(FLOOR+RIM)/2,mid[1],-Math.atan2(q[1]-p[1],q[0]-p[0]));});}
 for(let z=POND.z-POND.b+.05;z<POND.z+POND.b-.05;z+=.4){const z1=Math.min(z+.4,POND.z+POND.b-.05),w=Math.min(halfWidth(z),halfWidth(z1));block(2*w,BED-FLOOR,z1-z,POND.x,(FLOOR+BED)/2,(z+z1)/2);}

 // The water: the pond's surface, and the sheet falling into it from the stone lip.
 const time={value:0};
 {const shape=[];for(let i=0;i<160;i++)shape.push(new T.Vector2(...edge(i/160*Math.PI*2,-.02)));
  const g=new T.ShapeGeometry(new T.Shape(shape),1),p=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,WATER,z);uv.setXY(i,x,z);}
  // (Built in x, z with the face down; turned up.)
  const ix=g.index.array;for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];g.computeVertexNormals();
  const o=new T.Mesh(g,new T.ShaderMaterial({name:'Lounge_falls_pool',vertexShader:VERTEX,fragmentShader:POOL,uniforms:{uTime:time,uFall:{value:new T.Vector3(FALL.x0,FALL.x1,fallZ(POND.x)-FALL.reach)}}}));
  o.name='Lounge_falls_pool';frame.add(o);}
 {const w=FALL.x1-FALL.x0,h=FALL.lip-WATER,g=new T.PlaneGeometry(1,1,32,40),p=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){const u=p.getX(i)+.5,t=.5-p.getY(i),x=FALL.x0+u*w;p.setXYZ(i,x,FALL.lip-t*h,fallZ(x)-FALL.reach*t**3);uv.setXY(i,u*w,t*h);}
  const o=new T.Mesh(g,new T.ShaderMaterial({name:'Lounge_falls_sheet',vertexShader:VERTEX,fragmentShader:SHEET,transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{uTime:time,uSize:{value:new T.Vector2(w,h)}}}));
  o.name='Lounge_falls_sheet';o.renderOrder=2;frame.add(o);}
 // The lip: a stone spout hung on the upper gallery's front edge, under its floor, lit cyan along its underside.
 for(let x=FALL.x0;x<FALL.x1-.001;x+=.2){const end=Math.min(x+.2,FALL.x1),z=fallZ((x+end)/2);
  slab(x,end,z-.22,z+.015,FALL.lip-.045,FALL.lip+.015,new T.Color(0x9a958a));
  put(M.glow,new T.BoxGeometry(end-x,.018,.018).translate((x+end)/2,FALL.lip-.045,z),CYAN);}

 // The causeway: a stone body over the water, flagstones on top, a low step at its foot; and the landing behind the
 // falls, flagged the same, its front face over the water.
 slab(PATH.x0,PATH.x1,PATH.z0,PATH.z1,FLOOR+.02,PATH.top-.06,new T.Color(0x6e6a62));
 slab(LANDING.x0,LANDING.x1,LANDING.z0,LANDING.z1-.02,FLOOR+.02,LANDING.top-.06,new T.Color(0x6e6a62));
 const flags=(x0,x1,z0,z1,top,size)=>{for(let z=z0;z<z1-.05;){const d=Math.min(size*(.8+rnd()*.4),z1-z);
  for(let x=x0;x<x1-.05;){const w=Math.min(size*(.7+rnd()*.6),x1-x),fit=x1-x-w<.25?x1-x:w;slab(x+.02,x+fit-.02,z+.02,z+d-.02,top-.07,top,new T.Color(0xa9a396).multiplyScalar(.82+rnd()*.25));x+=fit;}z+=d;}};
 flags(PATH.x0,PATH.x1,PATH.z0,PATH.z1,PATH.top,.6);flags(LANDING.x0,LANDING.x1,LANDING.z0,LANDING.z1-.02,LANDING.top,.7);
 slab(PATH.x0,PATH.x1,PATH.step,PATH.z0,FLOOR,FLOOR+.18,new T.Color(0xa9a396).multiplyScalar(.9));
 block(PATH.x1-PATH.x0,PATH.top-FLOOR,PATH.z1-PATH.z0,(PATH.x0+PATH.x1)/2,(FLOOR+PATH.top)/2,(PATH.z0+PATH.z1)/2);
 block(PATH.x1-PATH.x0,.18,PATH.z0-PATH.step,(PATH.x0+PATH.x1)/2,FLOOR+.09,(PATH.step+PATH.z0)/2);
 block(LANDING.x1-LANDING.x0,LANDING.top-FLOOR,LANDING.z1-LANDING.z0,(LANDING.x0+LANDING.x1)/2,(FLOOR+LANDING.top)/2,(LANDING.z0+LANDING.z1)/2);
 // Rope rails: stone posts and a sagging rope down both sides of the causeway and along the landing's edge over the
 // water. Solid as thin walls, so the walker keeps to the stone.
 const ROPE=new T.Color(0x6b4a2b),rail=(a,b,top)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(len/1.45)),pts=[];
  for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n;pts.push([x,z]);
   put(M.stone,new T.CylinderGeometry(.06,.08,.85,7).translate(x,top+.425,z),stoneTint(1.1));put(M.stone,new T.IcosahedronGeometry(.085,0).translate(x,top+.87,z),stoneTint(1.1));}
  for(let i=0;i<n;i++){const [p,q]=[pts[i],pts[i+1]],curve=new T.CatmullRomCurve3(Array.from({length:7},(_,k)=>{const s=k/6;return new T.Vector3(p[0]+(q[0]-p[0])*s,top+.78-.14*Math.sin(Math.PI*s),p[1]+(q[1]-p[1])*s);}));
   put(M.rope,new T.TubeGeometry(curve,10,.022,5,false),ROPE);}
  const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];block(Math.max(.1,Math.abs(b[0]-a[0])),.9,Math.max(.1,Math.abs(b[1]-a[1])),mid[0],top+.45,mid[1]);};
 for(const x of [PATH.x0+.05,PATH.x1-.05])rail([x,PATH.rail],[x,LANDING.z0+.05],PATH.top);
 rail([LANDING.x0+.05,LANDING.z0+.05],[PATH.x0+.05,LANDING.z0+.05],LANDING.top);rail([PATH.x1-.05,LANDING.z0+.05],[LANDING.x1-.05,LANDING.z0+.05],LANDING.top);

 // Ferns on the rim, arching out over the floor and the water, and big leaves on the landing's corners.
 const greens=[0x2f6b34,0x3f8a3f,0x24502a,0x5d9b48,0x4b7d2e];
 // A leaf blade: a flat diamond from a to b, w wide, facing up.
 const blade=(color,a,b,w)=>{const d=b.clone().sub(a),across=new T.Vector3().crossVectors(d,UP).normalize().multiplyScalar(w),m=a.clone().add(b).multiplyScalar(.5),lift=new T.Vector3(0,w*.25,0);
  put(M.leaf,new T.BufferGeometry().setFromPoints([a,m.clone().add(across).add(lift),b,a,b,m.clone().sub(across).add(lift)]),color);};
 const frond=(color,from,a,len,lift,leaflet)=>{const h=new T.Vector3(Math.cos(a),0,Math.sin(a)),across=new T.Vector3().crossVectors(h,UP);
  const at=t=>from.clone().addScaledVector(h,len*t).addScaledVector(UP,lift*Math.sin(Math.PI*t*.8)-len*.35*t*t);
  for(let i=1;i<=8;i++){const t=i/8,c=at(t),l=leaflet*Math.sin(Math.PI*Math.min(1,t*1.1))+.04;blade(color,at(t-1/8),c,.015);
   for(const s of [-1,1])blade(color,c,c.clone().addScaledVector(across,s*l).addScaledVector(h,l*.35).addScaledVector(UP,-l*.3),.05);}};
 const fern=([x,z],y,size=1)=>{const n=6+Math.floor(rnd()*3),base=new T.Vector3(x,y,z),c=greens[rnd()*greens.length|0];
  for(let i=0;i<n;i++)frond(c,base,i/n*Math.PI*2+rnd()*.5,(.6+rnd()*.3)*size,(.35+rnd()*.2)*size,(.14+rnd()*.05)*size);};
 const spots=around(.1,1.35).filter(p=>!open(p,.5));
 for(const p of spots)fern(p,RIM-.08,.85+rnd()*.35);
 for(const [x,z] of [[LANDING.x0+.35,LANDING.z1-.35],[LANDING.x1-.35,LANDING.z1-.35]])fern([x,z],LANDING.top,1.3);
 // Vines hanging from both ends of the lip, down toward the lower gallery's railing.
 for(const s of [-1,1])for(let k=0;k<4;k++){const x=(s<0?FALL.x0-.15:FALL.x1+.15)+s*k*.12,z=fallZ(x)-.04+rnd()*.1,len=1.6+rnd()*1.6;
  for(let d=0;d<len;d+=.16){const y=FALL.lip-d,px=x+Math.sin(d*2.3+k)*.06;blade(greens[(k+Math.round(d*5))%greens.length],new T.Vector3(px,y,z),new T.Vector3(px+Math.cos(d*3+k)*.13,y-.04,z-.06+Math.sin(d*3+k)*.05),.05);}}

 // Glowing mushrooms in clusters on the rim, on the landing's corners and either side of the causeway's foot.
 const caps=[0xffe2b0,0xffe2b0,0xffd28a,CYAN,0xc79cff,0xff9fd8];
 const cluster=([x,z],y,big=1)=>{const n=3+Math.floor(rnd()*3),color=caps[rnd()*caps.length|0];
  for(let i=0;i<n;i++){const a=rnd()*Math.PI*2,d=rnd()*.22,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d,h=(.1+rnd()*.22)*big,r=(.06+rnd()*.09)*big;
   put(M.stone,new T.CylinderGeometry(r*.28,r*.36,h,6).translate(px,y+h/2,pz),new T.Color(0xe8dcc4));
   put(M.glow,new T.SphereGeometry(r,10,4,0,Math.PI*2,0,Math.PI/2).scale(1,.6,1).translate(px,y+h,pz),color);}
  const c=new T.Color(color).multiplyScalar(.45);
  put(M.halo,new T.CircleGeometry(.45*big,16).rotateX(-Math.PI/2).translate(x,y+.02,z),v=>Math.hypot(v.x-x,v.z-z)<.01?c:black);};
 around(.12,1.35).filter(p=>!open(p,.4)).forEach((p,i)=>{if(i%2===0)cluster(p,RIM-.02);});
 for(const [x,z] of [[LANDING.x0+.3,LANDING.z0+.3],[LANDING.x1-.3,LANDING.z0+.3],[LANDING.x0+.9,LANDING.z1-.3],[LANDING.x1-.9,LANDING.z1-.3]])cluster([x,z],LANDING.top);
 for(const x of [PATH.x0-.45,PATH.x1+.45])cluster([x,PATH.step+.15],FLOOR,1.3);

 // The water's light: on the floor round the pond, the back wall behind the falls and the lower gallery's underside.
 {const strip=[],n=160,inner=new T.Color(CYAN).multiplyScalar(.3);
  for(let i=0;i<n;i++){const [a,b,c,d]=[edge(i/n*Math.PI*2,.45),edge((i+1)/n*Math.PI*2,.45),edge(i/n*Math.PI*2,2.4),edge((i+1)/n*Math.PI*2,2.4)].map(([x,z])=>new T.Vector3(x,FLOOR+.025,z));strip.push(a,c,b,b,c,d);}
  const ring=new T.BufferGeometry().setFromPoints(strip);
  put(M.halo,ring,v=>{const d=Math.hypot((v.x-POND.x)/POND.a,(v.z-POND.z)/POND.b);return d<1.2?inner:black;});}
 const wash=(g,color,fade)=>put(M.halo,g,v=>new T.Color(color).multiplyScalar(fade(v)));
 wash(new T.PlaneGeometry(FALL.x1-FALL.x0+2,28-LANDING.top,8,4).rotateY(Math.PI).translate((FALL.x0+FALL.x1)/2,(28+LANDING.top)/2,45.84),CYAN,v=>.2*(1-Math.min(1,Math.abs(v.x-POND.x)/((FALL.x1-FALL.x0)/2+1)))*(.6+.4*(28-v.y)/(28-LANDING.top)));
 wash(new T.PlaneGeometry(FALL.x1-FALL.x0+2,3,8,2).rotateX(Math.PI/2).translate((FALL.x0+FALL.x1)/2,LEVELS[0]-.3,39.4),CYAN,v=>.22*(1-Math.min(1,Math.abs(v.x-POND.x)/((FALL.x1-FALL.x0)/2+1)))*(1-(v.z-37.9)/3));

 for(const [mat,gs] of lists){const g=mergeGeometries(gs);gs.forEach(x=>x.dispose());const o=new T.Mesh(g,mat);o.name=mat.name;
  o.castShadow=mat===M.stone||mat===M.rope;o.receiveShadow=!mat.transparent;if(mat===M.halo)o.renderOrder=1;frame.add(o);}

 const here=new T.Vector3();
 return {group,solid,
  update(dt,walker){if(walker.distanceTo(here.copy(centre))<NEAR)time.value+=Math.min(dt,.1);},
  // For checks: the pond's middle and the bench, in the ship's coordinates.
  centre,bench:new T.Vector3(BENCH.x,LANDING.top,BENCH.z).applyMatrix4(lounge.matrixWorld),
  soundLine:{a:new T.Vector3(FALL.x0,FLOOR,fallZ(FALL.x0)).applyMatrix4(lounge.matrixWorld),b:new T.Vector3(FALL.x1,FLOOR,fallZ(FALL.x1)).applyMatrix4(lounge.matrixWorld)},
 };
}

export function createLoungeFalls(ship){return fittedLoungeFalls(ship,createUnfittedLoungeFalls); }
