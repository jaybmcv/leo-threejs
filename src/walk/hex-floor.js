import * as T from 'three';
import {anchorObject} from '../plan/rooms.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {serviceRoutes} from '../service-circulation.js';
import {TRANSIT_CORES} from '../transit.js';

// Deck 1's hallways on foot (from tester feedback): the service spine, its side corridors and the forward lift lobby
// are laid with hexagon tiles that light up round where the walker stands and fade softly behind them, teal while
// heading forward (toward the Forward lifts, +x) and orange while heading aft (toward the Aft lifts); walking across
// the ship keeps the last colour. The tiles are a thin drawn layer 8 mm over the floor: the floor itself, its height and
// its colliders are unchanged, and the guide lines, wayfinding edges and thresholds stay on top of it. Away from the
// walker the grout lines are faint and fade out with distance, so the hallway reads as before.
const DECK=1,HEX=.36,LIFT=.008,TRAIL=16,FADE=1.2,REACH=1.05;
const TEAL=new T.Color('#2fd6c5'),ORANGE=new T.Color('#ff6a10');

const VERTEX=`#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
varying vec2 vXZ;
void main(){
 vec4 w=modelMatrix*vec4(position,1.);vXZ=w.xz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
#include <logdepthbuf_vertex>
#include <fog_vertex>
}`;
// Each fragment finds its tile (centre and how far in from the edge), then how lit that tile is: every trail mark
// lights the tiles whose centres lie within reach of it, by its strength, in its colour.
const FRAGMENT=`#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform float uSize;uniform vec4 uTrail[${TRAIL}];uniform vec3 uReach,uTeal,uOrange;varying vec2 vXZ;
const vec2 S=vec2(1.,1.7320508);
vec4 cell(vec2 p){vec4 c=floor(vec4(p,p-vec2(.5,1.))/S.xyxy)+.5;vec4 h=vec4(p-c.xy*S,p-(c.zw+.5)*S);
 return dot(h.xy,h.xy)<dot(h.zw,h.zw)?vec4(h.xy,c.xy):vec4(h.zw,c.zw+.5);}
void main(){
#include <logdepthbuf_fragment>
 vec2 p=vXZ/uSize;vec4 h=cell(p);vec2 q=abs(h.xy);
 float d=.5-max(dot(q,S*.5),q.x),aa=fwidth(d)+1e-4;
 // The grout: a fine dark line round each tile, fading to its average tone where tiles shrink to a few pixels.
 float far=smoothstep(.06,.22,length(fwidth(p)));
 float a=mix((1.-smoothstep(.024-aa,.024+aa,d))*.2,.02,far);vec3 c=vec3(.16,.15,.14);
 vec2 centre=vXZ-h.xy*uSize;float glow=0.,warm=0.;
 if(distance(centre,uReach.xy)<uReach.z){
  for(int i=0;i<${TRAIL};i++){vec4 t=uTrail[i];float g=t.w*(1.-smoothstep(${(REACH*.4).toFixed(3)},${REACH.toFixed(3)},distance(centre,t.xy)));glow+=g;warm+=g*t.z;}
 }
 if(glow>0.){
  warm/=glow;glow=min(glow,1.);glow=glow*glow*(3.-2.*glow);
  // A lit tile: a soft wash of colour and a bright rim just inside its edge.
  vec3 tint=mix(uTeal,uOrange,warm);float rim=1.-smoothstep(.02,.13,d),core=1.-smoothstep(.0,.04,d),wash=1.-smoothstep(.0,.5,d);
  float la=glow*mix(.2+.25*wash,.95,rim);vec3 lc=tint*(1.15+.6*rim)+vec3(.12+.4*core)*glow;
  float oa=la+a*(1.-la);c=(lc*la+c*a*(1.-la))/max(oa,1e-4);a=oa;
 }
 gl_FragColor=vec4(c,a);
#include <colorspace_fragment>
#include <fog_fragment>
#ifdef USE_FOG
 gl_FragColor.a*=1.-fogFactor;
#endif
}`;

// The hallway floors as rectangles [x0,x1,z0,z1]: the spine (on through the forward lift lobby, which transit.js lays
// 8 m forward of the core) and each side corridor either side of it.
function hallways(){
 const plan=serviceRoutes(DECK),{x0,x1,width}=plan.spine,lobby=TRANSIT_CORES.find(c=>c.id==='forward').x+8,w=width/2;
 const rects=[[x0,Math.max(x1,lobby),-w,w]];
 for(const b of plan.branches)rects.push([b.x0,b.x1,w,b.extent],[b.x0,b.x1,-b.extent,-w]);
 return {y:plan.y,rects};
}

export function createHexFloor(){
 const {y,rects}=hallways();
 const geometry=mergeGeometries(rects.map(([x0,x1,z0,z1])=>new T.PlaneGeometry(x1-x0,z1-z0).rotateX(-Math.PI/2).translate((x0+x1)/2,0,(z0+z1)/2)));
 const trail=Array.from({length:TRAIL},()=>new T.Vector4()),reach=new T.Vector3(0,0,-1);
 const material=new T.ShaderMaterial({name:'Walk_hex_floor',vertexShader:VERTEX,fragmentShader:FRAGMENT,transparent:true,depthWrite:false,fog:true,
  uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),uSize:{value:HEX},uTrail:{value:trail},uReach:{value:reach},uTeal:{value:TEAL},uOrange:{value:ORANGE}}});
 const mesh=new T.Mesh(geometry,material);mesh.name='Walk_hex_floor';
 const group=new T.Group();group.name='Walk_hex_floor';group.position.y=y+LIFT;group.add(mesh);anchorObject(group,'circulation-1');
 const on=(x,z)=>rects.some(([x0,x1,z0,z1])=>x>x0-.5&&x<x1+.5&&z>z0-.5&&z<z1+.5);
 // The trail: the newest mark follows the walker; once they have gone a step from it, it stays behind and fades over
 // FADE seconds. The step grows with speed, so the marks always span about FADE seconds of walking.
 let head=0,warm=0;const last=new T.Vector2(1e9,1e9),prev=new T.Vector2(1e9,1e9);
 return {
  group,
  // `eye` is the camera's position, `p` the walker's and `heading` its facing (atan2 of its velocity's x and z, as
  // main.js keeps it). The layer draws only while the camera is on Deck 1, the one place its floor shows from.
  update(dt,eye,p,heading){
   mesh.visible=eye.y>y-1&&eye.y<y+4.5;
   for(const t of trail)t.w=Math.max(0,t.w-dt/FADE);
   const along=Math.sin(heading);if(along>.35)warm=0;else if(along<-.35)warm=1;
   const speed=dt>0?Math.min(15,Math.hypot(p.x-prev.x,p.z-prev.y)/dt):0;prev.set(p.x,p.z);
   if(Math.abs(p.y-y)<1&&on(p.x,p.z)){
    if(Math.hypot(p.x-last.x,p.z-last.y)>Math.max(.4,speed*FADE/TRAIL)){head=(head+1)%TRAIL;last.set(p.x,p.z);}
    trail[head].set(p.x,p.z,warm,1);
   }
   // A circle round every lit mark: tiles outside it skip the trail.
   let n=0,cx=0,cz=0,r=-1;for(const t of trail)if(t.w>0){cx+=t.x;cz+=t.y;n++;}
   if(n){cx/=n;cz/=n;for(const t of trail)if(t.w>0)r=Math.max(r,Math.hypot(t.x-cx,t.y-cz));r+=REACH+.05;}
   reach.set(cx,cz,r);
  },
 };
}
