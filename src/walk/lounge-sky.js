import * as T from 'three';

// The Hydro-Nip Lounge's glass roof (from tester feedback): the commons' ceiling reads as clear glass in a dark frame,
// open to the stars, with a huge full moon high over the hammock dome. It is one plane just under the old ceiling. What
// it shows depends only on the direction you look, as space through a window does, so the stars and the moon stay put
// as you walk; the moon turns very slowly, as if the ship were passing it.
// Its stars, the moon's seas and its craters are all made up in the shader: no texture.
const VERTEX=`#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorld;varying vec2 vUv;
void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;
#include <logdepthbuf_vertex>
}`;
const FRAGMENT=`#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;uniform vec3 uMoon,uRight,uUp;uniform float uSize;uniform vec2 uSpan;varying vec3 vWorld;varying vec2 vUv;
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
  mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+1.7;a*=.5;}return s;}
// Craters at one scale: a bowl sunk below the surface with a raised rim, in some of the cells round p.
float craters(vec3 p,float keep){vec3 c=floor(p);float h=0.;
 for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++)for(int k=-1;k<=1;k++){vec3 id=c+vec3(i,j,k);float s=hash3(id+.37);if(s>keep)continue;
  vec3 o=id+.5+(vec3(hash3(id+1.1),hash3(id+2.3),hash3(id+3.7))-.5)*.7;float r=mix(.18,.48,hash3(id+5.9)),d=length(p-o)/r;
  h+=r*(d<1.?d*d-1.:0.)*.8+r*.3*exp(-pow((d-1.)*4.,2.));}
 return h;}
// The moon's height at a point on it, turned by angle t: seas aside, craters at three sizes.
float height(vec3 n,float t){float ct=cos(t),st=sin(t);vec3 m=vec3(n.x*ct+n.z*st,n.y,-n.x*st+n.z*ct);
 return craters(m*3.,.55)*.9+craters(m*7.,.6)*.35+craters(m*16.,.65)*.12;}
void main(){
#include <logdepthbuf_fragment>
 vec3 dir=normalize(vWorld-cameraPosition);
 // Deep space, a faint band of the galaxy across it, and stars that fade rather than smear when far smaller than a pixel.
 vec3 c=vec3(.0015,.002,.005);
 float band=exp(-pow(dot(dir,normalize(vec3(.35,.25,.9)))*3.2,2.));c+=vec3(.009,.008,.014)*band*(.4+.9*fbm(dir*7.));
 vec3 p=dir*240.,id=floor(p);float s=hash3(id);
 if(s>.9-.05*band){vec3 o=id+.5+(vec3(hash3(id+3.1),hash3(id+7.7),hash3(id+1.9))-.5)*.6;float r=mix(.07,.2,pow(hash3(id+1.3),5.)),d=length(p-o);
  float px=length(fwidth(p)),tw=.75+.25*sin(uTime*(.5+1.5*hash3(id+9.1))+hash3(id+5.3)*6.2832);
  c+=mix(vec3(1.,.95,.88),vec3(.72,.82,1.),hash3(id+2.9))*(1.-smoothstep(r*.3,r,d))*min(1.,r*2./px)*tw;}
 // The moon: a sphere seen face on, its seas and craters turning slowly past.
 float a=acos(clamp(dot(dir,uMoon),-1.,1.));
 vec2 q=vec2(dot(dir,uRight),dot(dir,uUp))/sin(uSize);float qq=dot(q,q);
 c+=vec3(.5,.52,.6)*.03*exp(-max(a-uSize,0.)*14.)*step(uSize,a);
 if(qq<1.&&dot(dir,uMoon)>0.){
  vec3 n0=vec3(q,sqrt(1.-qq));float t=uTime*.004,ct=cos(t),st=sin(t);vec3 m=vec3(n0.x*ct+n0.z*st,n0.y,-n0.x*st+n0.z*ct);
  float sea=smoothstep(.5,.62,fbm(m*1.6+4.));
  // Bumps from the height's slope along the surface, lit low from one side, as on a moon a night or two from full,
  // so the crater rims stand out.
  vec3 tx=normalize(vec3(n0.z,0.,-n0.x)),ty=cross(n0,tx);const float e=.004;
  float h=height(n0,t),gx=(height(normalize(n0+tx*e),t)-h)/e,gy=(height(normalize(n0+ty*e),t)-h)/e;
  vec3 n=normalize(n0-(tx*gx+ty*gy)*.22);
  vec3 L=normalize(vec3(-.42,.22,.88));float lit=max(dot(n,L),0.);
  vec3 albedo=mix(vec3(.66,.65,.62),vec3(.3,.31,.33),sea)*(.86+.28*fbm(m*12.))+vec3(.08)*smoothstep(.02,.06,h);
  vec3 moon=albedo*(.05+1.05*lit)*(.75+.25*n0.z);
  float edge=fwidth(qq)*1.5;c=mix(c,moon,1.-smoothstep(1.-edge,1.,qq));}
 // The glass: a faint cool sheen toward the horizon, and the frame between the panes.
 c+=vec3(.003,.005,.008)*(1.-abs(dir.y))+vec3(.02,.025,.035)*smoothstep(.85,1.,sin((vUv.x+vUv.y)*9.)*.5+.5)*.4;
 vec2 at=vUv*uSpan,cell=abs(fract((at-vec2(.5,0.))/vec2(11.,9.5)+.5)-.5)*vec2(11.,9.5),w=fwidth(at);
 float bar=1.-smoothstep(.12,.12+max(w.x,w.y)*1.5,min(cell.x,cell.y));
 float edges=1.-smoothstep(.2,.2+max(w.x,w.y)*1.5,min(min(at.x,uSpan.x-at.x),min(at.y,uSpan.y-at.y)));
 c=mix(c,vec3(.035,.035,.045),max(bar,edges));
 gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`;

// `frame` takes the lounge's own coordinates to the world's; `room` is its extent there, `y` the ceiling's underside.
// The moon hangs `tilt` off straight up along the room's length, in line with the sign on the dome's crown so the
// sign hides it only from right under it.
export function createLoungeSky(frame,room,y,time,{size=.17,tilt=.35}={}){
 const span=[room.x1-room.x0,room.z1-room.z0];
 const g=new T.PlaneGeometry(...span).rotateX(Math.PI/2).translate((room.x0+room.x1)/2,y,(room.z0+room.z1)/2).applyMatrix4(frame);
 const moon=new T.Vector3(Math.sin(tilt),Math.cos(tilt),0).transformDirection(frame),right=new T.Vector3(1,0,0).cross(moon).cross(moon).negate().normalize(),up=new T.Vector3().crossVectors(moon,right);
 return new T.Mesh(g,new T.ShaderMaterial({name:'Lounge_glass_roof',vertexShader:VERTEX,fragmentShader:FRAGMENT,side:T.DoubleSide,
  uniforms:{uTime:time,uMoon:{value:moon},uRight:{value:right},uUp:{value:up},uSize:{value:size},uSpan:{value:new T.Vector2(...span)}}}));
}
