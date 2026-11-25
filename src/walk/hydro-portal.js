import * as T from 'three';
import {SYNTHWAVE_MURAL} from '../v2/community-routes.js';
import layout from '../plan/selected-layout.js';
import {TRANSIT_CORES} from '../plan/v1.js';
import {createSpatial,updateSpatial} from './spatial-audio.js';

// The exit sits on the Deck 17 mural, centred on the reported approach (yaw 273).
const FLOOR=SYNTHWAVE_MURAL.paintFloor,X=SYNTHWAVE_MURAL.x+.04;
const Z=-41.56+(X+138.8)/Math.tan(273*Math.PI/180);
// The gallery underside is at 28.02 m; the oval and its halo must both fit below it.
export const HYDRO_PORTAL=Object.freeze({x:X,y:FLOOR+2.4,z:Z,width:2.2,height:2.4,floor:FLOOR,range:9});
// Both landings use floor points, facing out into the room.
export const HYDRO_PORTAL_ARRIVAL=Object.freeze({name:'Hydro-Portal',at:Object.freeze([SYNTHWAVE_MURAL.x+.8,FLOOR,Z]),yaw:160});
const CORE=TRANSIT_CORES.find(c=>c.id==='forward'),PARK_FLOOR=layout.decks[5].y;
// The blank east face ahead of the park approach, between z -7.87 and -2.73.
export const HYDRO_PARK_PORTAL=Object.freeze({x:CORE.stairX+4.64+.04,y:PARK_FLOOR+2.4*.54,z:-CORE.stairZ,width:2.2,height:2.4,floor:PARK_FLOOR,range:9});
export const HYDRO_PARK_ARRIVAL=Object.freeze({name:'Hydro-Portal park',at:Object.freeze([HYDRO_PARK_PORTAL.x+1.6,PARK_FLOOR,HYDRO_PARK_PORTAL.z]),yaw:90});
const CARGO=layout.rooms.find(r=>r.id==='d02-maintenance-aft');
// The engine housing's blank back is behind the glass; mount outside its east face without cutting either.
export const HYDRO_CARGO_PORTAL=Object.freeze({x:CARGO.x+CARGO.width/2+.09,y:CARGO.y+1.7,z:CARGO.z,width:2.2,height:2.4,floor:CARGO.y,range:9});
export const HYDRO_PORTAL_LINKS=Object.freeze([
 Object.freeze({portal:HYDRO_PORTAL,arrival:HYDRO_PARK_ARRIVAL}),
 Object.freeze({portal:HYDRO_PARK_PORTAL,arrival:HYDRO_PORTAL_ARRIVAL}),
 Object.freeze({portal:HYDRO_CARGO_PORTAL,arrival:HYDRO_PORTAL_ARRIVAL})
]);

export function hydroPortalContains(portal,p,pad=0){
 return p.x>=portal.x-.05&&p.x<portal.x+.75+pad&&Math.abs(p.z-portal.z)<portal.width*.4+pad&&Math.abs(p.y-portal.floor)<.4;
}
export function createHydroPortalTravel(){
 let locked=false;
 return {step(p,enabled,go){
  if(locked){if(!HYDRO_PORTAL_LINKS.some(l=>hydroPortalContains(l.portal,p,1.2)))locked=false;return false;}
  if(!enabled)return false;
  const link=HYDRO_PORTAL_LINKS.find(l=>hydroPortalContains(l.portal,p));if(!link)return false;
  // Go-to validates the landing and places the controller before normal pose, light and sound updates.
  locked=true;return go({...link.arrival,yaw:link.arrival.yaw*Math.PI/180,resolved:true});
 }};
}

export function hydroPortalLevel(p,on,portal=HYDRO_PORTAL){
 const d=Math.hypot(p.x-portal.x,p.y-portal.y,p.z-portal.z);
 return on?Math.max(0,1-d/portal.range)**2*.045:0;
}

// A seamless noise loop through a sweeping resonator and two phasing all-pass filters.
export function buildHydroPortalWarp(ctx,out){
 const n=ctx.sampleRate*4,fade=Math.min(2048,Math.floor(n/4)),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);let b=0;
 for(let i=0;i<n;i++){const w=Math.random()*2-1;b=(b+.025*w)/1.025;d[i]=b*3+w*.025;}
 for(let i=0;i<fade;i++){const f=i/fade;d[i]=d[i]*f+d[n-fade+i]*(1-f);}
 const src=ctx.createBufferSource(),low=ctx.createBiquadFilter(),sweep=ctx.createBiquadFilter();
 src.buffer=buf;src.loop=true;src.loopEnd=(n-fade)/ctx.sampleRate;
 low.type='lowpass';low.frequency.value=1100;sweep.type='bandpass';sweep.frequency.value=330;sweep.Q.value=.8;
 src.connect(low).connect(sweep);let tail=sweep;
 for(const [hz,rate,depth] of [[270,.23,200],[590,.17,340]]){
  const f=ctx.createBiquadFilter(),lfo=ctx.createOscillator(),g=ctx.createGain();f.type='allpass';f.frequency.value=hz;
  lfo.frequency.value=rate;g.gain.value=depth;lfo.connect(g).connect(f.frequency);tail.connect(f);tail=f;lfo.start();
 }
 const pull=ctx.createOscillator(),depth=ctx.createGain(),dry=ctx.createGain();pull.type='sine';pull.frequency.value=.13;depth.gain.value=220;
 dry.gain.value=.35;sweep.connect(dry).connect(out);
 pull.connect(depth).connect(sweep.frequency);tail.connect(out);src.start();pull.start();
}

export function createHydroPortalSound(portal=HYDRO_PORTAL){
 let ctx=null,gain=null,spatial=null,wanted=false;
 const source=Object.freeze({x:portal.x,y:portal.y,z:portal.z});
 return {source,get spatial(){return spatial;},update(p,on,camera){
  const level=hydroPortalLevel(p,on,portal);wanted=level>0;
  if(wanted&&!ctx){
   if(navigator.userActivation?.hasBeenActive===false)return;
   ctx=new (window.AudioContext||window.webkitAudioContext)();gain=ctx.createGain();gain.gain.value=0;
   spatial=createSpatial(ctx);gain.connect(spatial);buildHydroPortalWarp(ctx,gain);
   document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else if(wanted)ctx.resume().catch(()=>{});});
  }
  if(!ctx)return;
  if(wanted&&!document.hidden&&ctx.state==='suspended')ctx.resume().catch(()=>{});
  updateSpatial(ctx,spatial,camera,source);gain.gain.setTargetAtTime(level,ctx.currentTime,.15);
 }};
}

export function createHydroPortal(portal=HYDRO_PORTAL){
 const uniforms={uTime:{value:0}},material=new T.ShaderMaterial({uniforms,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,
  vertexShader:`#include <common>
   #include <logdepthbuf_pars_vertex>
   varying vec2 vUv;
   void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    #include <logdepthbuf_vertex>
   }`,
  fragmentShader:`
   #include <logdepthbuf_pars_fragment>
   uniform float uTime;varying vec2 vUv;
   void main(){
    #include <logdepthbuf_fragment>
    vec2 p=(vUv-.5)*2.7;float r=length(p),a=atan(p.y,p.x),t=uTime;
    if(r>1.08)discard;
    float phase=4.*a+13.*log(r+.16)+1.4*t;
    float arms=pow(.5+.5*cos(phase),7.);
    float sparks=pow(.5+.5*cos(phase),24.)*pow(.5+.5*cos(34.*r+2.6*t+sin(7.*a)),24.);
    float edge=1.+.012*sin(9.*a+2.*t)+.008*sin(13.*a-1.3*t);
    float rimDistance=(r-edge)/.014;
    float rim=exp(-rimDistance*rimDistance),halo=exp(-abs(r-edge)*26.);
    float inside=1.-smoothstep(.92,1.02,r);
    float hue=a+2.*log(r+.16)+.25*t;
    vec3 ink=mix(vec3(.58,.06,1.),vec3(1.,.025,.42),.5+.5*sin(hue));
    ink=mix(ink,vec3(1.,.30,.025),pow(.5+.5*cos(hue+1.5),4.));
    vec3 colour=ink*(arms*1.3*inside+rim*1.7+halo*.3);
    colour+=vec3(1.,.65,.36)*(sparks*3.*inside+2.2*exp(-r*19.));
    gl_FragColor=vec4(colour,1.-smoothstep(1.03,1.08,r));
   }`});
 const group=new T.Mesh(new T.PlaneGeometry(portal.width*1.35,portal.height*1.35),material);
 group.name=portal===HYDRO_PORTAL?'Hydro_Portal':portal===HYDRO_CARGO_PORTAL?'Hydro_Portal_Cargo':'Hydro_Portal_Park';group.position.set(portal.x,portal.y,portal.z);group.rotation.y=Math.PI/2;
 group.userData={room:portal===HYDRO_PORTAL?'commons-1':portal===HYDRO_CARGO_PORTAL?'circulation-2':'circulation-6',noCollide:true};
 const sound=createHydroPortalSound(portal);
 return {group,sound,arrival:portal===HYDRO_PARK_PORTAL?HYDRO_PARK_ARRIVAL:HYDRO_PORTAL_ARRIVAL,
  prompt(p){return portal===HYDRO_CARGO_PORTAL&&hydroPortalContains(portal,p,2)?{kind:'hydro-portal',label:'Walk into Hydro-Portal to Hydro-Nip Lounge',passive:true}:null;},
  update(dt,p,on,camera){uniforms.uTime.value+=dt;sound.update(p,on,camera);}};
}
