import * as T from 'three';
import {SYNTHWAVE_MURAL} from '../v2/community-routes.js';
import {createSpatial,updateSpatial} from './spatial-audio.js';

// The exit sits on the Deck 17 mural, centred on the reported approach (yaw 273).
const FLOOR=SYNTHWAVE_MURAL.paintFloor,X=SYNTHWAVE_MURAL.x+.04;
const Z=-41.56+(X+138.8)/Math.tan(273*Math.PI/180);
// The gallery underside is at 28.02 m; the oval and its halo must both fit below it.
export const HYDRO_PORTAL=Object.freeze({x:X,y:FLOOR+2.4,z:Z,width:2.2,height:2.4,floor:FLOOR,range:9});
// Feet arrive at the oval's lower centre, 0.8 m into the room, facing +X. No feature uses this yet.
export const HYDRO_PORTAL_ARRIVAL=Object.freeze({name:'Hydro-Portal',at:Object.freeze([SYNTHWAVE_MURAL.x+.8,FLOOR+1.2,Z]),yaw:90});

export function hydroPortalLevel(p,on){
 const d=Math.hypot(p.x-X,p.y-HYDRO_PORTAL.y,p.z-Z);
 return on?Math.max(0,1-d/HYDRO_PORTAL.range)**2*.045:0;
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

export function createHydroPortalSound(){
 let ctx=null,gain=null,spatial=null,wanted=false;
 const source=Object.freeze({x:X,y:HYDRO_PORTAL.y,z:Z});
 return {source,get spatial(){return spatial;},update(p,on,camera){
  const level=hydroPortalLevel(p,on);wanted=level>0;
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

export function createHydroPortal(){
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
 const group=new T.Mesh(new T.PlaneGeometry(HYDRO_PORTAL.width*1.35,HYDRO_PORTAL.height*1.35),material);
 group.name='Hydro_Portal';group.position.set(X,HYDRO_PORTAL.y,Z);group.rotation.y=Math.PI/2;
 group.userData={room:'commons-1',noCollide:true};
 const sound=createHydroPortalSound();
 return {group,sound,arrival:HYDRO_PORTAL_ARRIVAL,update(dt,p,on,camera){uniforms.uTime.value+=dt;sound.update(p,on,camera);}};
}
