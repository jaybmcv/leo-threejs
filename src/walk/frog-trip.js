import * as T from 'three';
import {startFrogAudio,setFrogAudio,stopFrogAudio,frogAudioState} from './frog-audio.js';

// Capture the finished film look, then draw one local pass. Idle uses no textures, audio nodes or frame callbacks.
const fragment=`precision highp float;
uniform sampler2D picture,history;
uniform vec2 texel;
uniform float time,strength,warp,trails,overlay;
varying vec2 vFrogUv;
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 hue(vec3 c,float a){
 vec3 axis=vec3(.57735027);
 return c*cos(a)+cross(axis,c)*sin(a)+axis*dot(axis,c)*(1.0-cos(a));
}
vec3 sampleAt(vec2 p){return texture2D(picture,clamp(p,.5*texel,1.0-.5*texel)).rgb;}
void main(){
 vec2 uv=vFrogUv,q=uv-.5,aspect=vec2(texel.y/texel.x,1.0),s=q*aspect;
 float radius=length(s);
 // Breathing bands and smaller cross-ripples bend the scene in screen space.
 vec2 swell=q*(.10*sin(time*.82-radius*8.0)+.045*sin(time*.56+radius*15.0));
 vec2 wave=.032*vec2(sin(s.y*14.0+s.x*2.0+time*.73),cos(s.x*11.0-s.y*2.0-time*.67));
 vec2 ripple=.011*vec2(sin(s.y*36.0-s.x*5.0-time*.91),cos(s.x*34.0+s.y*8.0+time*.84));
 vec2 room=smoothstep(vec2(0.0),vec2(.14),min(uv,1.0-uv));
 vec2 p=uv+warp*room*(swell+(wave+ripple)/aspect);
 vec2 edge=warp*(q*(.012+.060*dot(q,q))+.003*vec2(sin(time*.68+s.y*9.0),cos(time*.72-s.x*8.0))/aspect);
 vec3 c=vec3(sampleAt(p+edge).r,sampleAt(p).g,sampleAt(p-edge).b);
 c=hue(mix(vec3(luma(c)),c,1.0+strength*.65),strength*.9*sin(time*.6));

 // Fold the angle into mirrored sectors and let the colored bands spiral through them.
 float sector=1.04719755;
 float angle=atan(s.y,s.x+.00001)+radius*.9+time*.13;
 float fold=abs(mod(angle+.5*sector,sector)-.5*sector);
 vec2 tile=radius*vec2(cos(fold),sin(fold));
 float rings=sin(radius*37.0+3.4*cos(6.0*fold)-time*.8);
 float lines=sin(dot(tile,vec2(28.0,42.0))-time*.56);
 float pattern=.22+.49*smoothstep(.48,.95,rings)+.29*smoothstep(.62,.96,lines);
 vec3 rainbow=.54+.38*cos(radius*23.0+fold*4.0-time*.64+vec3(0.0,2.0944,4.1888));
 float grain=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy*.7),vec2(.06711056,.00583715))));
 c=mix(c,rainbow,overlay*pattern*.20)+overlay*.014*sin(6.2831853*grain+time*1.3);

 // Feed the last composite back at two outward scales. Bright edges carry the most color.
 if(trails>0.0){
  float pulse=.5+.5*sin(time*.92);
  vec2 drift=.010*vec2(sin(time*.63),cos(time*.59))/aspect;
  vec3 nearEcho=texture2D(history,.5+q*(1.0-trails*(.042+.016*pulse))+drift*trails).rgb;
  vec3 farEcho=texture2D(history,.5+q*(1.0-trails*(.094+.025*pulse))-drift*trails).rgb;
  float bright=smoothstep(.38,.87,max(luma(nearEcho),luma(farEcho)));
  vec3 ghost=mix(hue(nearEcho,.34),hue(farEcho,-.62),.36);
  ghost*=vec3(.98)+.16*cos(time*.57+radius*5.0+vec3(0.0,2.0944,4.1888));
  c=mix(c,ghost,trails*(.39+.16*bright));
  c+=max(ghost-c,0.0)*trails*.11*bright;
 }
 gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`;
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const TRIP_SECONDS=40,FADE_SECONDS=5;
const TRIP_PANELS=['map-sheet','places','lift-panel','aboard-sheet','emotes','help-sheet'];
const ENDING_TARGETS=new Set(['selfie','photo-spot','play','emergency-drill','mct-repair','pool','pinball','darts','outside']);
export function frogStrength(elapsed){return ease(elapsed)*ease((TRIP_SECONDS-elapsed)/FADE_SECONDS);}
export function createFrogTrip({renderer,camera,light=()=>false,now=()=>performance.now(),panelOpen=()=>false}){
 let start=null,fade=null,fadeFrom=0,strength=0,baseFov=null,pass=null,mild=false,lite=false;
 const secondsSinceLick=()=>(now()-start)/1000;
 // These panels take the keys while the walk still draws behind them.
 const tripPanelOpen=()=>TRIP_PANELS.some(panelOpen);
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 function releasePass(){
  if(!pass)return;
  pass.picture.dispose();pass.history?.dispose();pass.quad.geometry.dispose();pass.material.dispose();pass=null;
 }
 function release(){
  if(start===null)return;
  camera.fov=baseFov;camera.updateProjectionMatrix();stopFrogAudio();
  releasePass();
  start=null;fade=null;strength=0;baseFov=null;
 }
 function end(immediate=false){if(start===null)return;if(immediate){release();return;}if(fade===null){fade=now();fadeFrom=strength;}}
 function update(view=camera,inputEnabled=true){
  if(start===null)return false;
  if(view!==camera||(!inputEnabled&&!tripPanelOpen())){release();return false;}
  const elapsed=secondsSinceLick();
  if(elapsed>=TRIP_SECONDS||(fade!==null&&now()-fade>=450)){release();return false;}
  mild=!!reduced?.matches;lite=light();
  strength=fade===null?frogStrength(elapsed):fadeFrom*(1-ease((now()-fade)/450));
  camera.fov=baseFov+(mild?0:strength*3*Math.sin(elapsed*Math.PI*2/4));camera.updateProjectionMatrix();
  setFrogAudio(strength*(.82+.18*Math.sin(elapsed*Math.PI*2/6)));
  return true;
 }
 function render(){
  if(start===null||strength<=0)return;
  const size=renderer.getDrawingBufferSize(new T.Vector2()),feedback=!mild&&!lite;
  if(pass&&(pass.picture.image.width!==size.x||pass.picture.image.height!==size.y||!!pass.history!==feedback))releasePass();
  if(!pass){const picture=new T.FramebufferTexture(size.x,size.y),history=feedback?new T.FramebufferTexture(size.x,size.y):null;
   for(const texture of [picture,history])if(texture)texture.minFilter=texture.magFilter=T.LinearFilter;
   const material=new T.ShaderMaterial({uniforms:{picture:{value:picture},history:{value:history||picture},texel:{value:new T.Vector2(1/size.x,1/size.y)},time:{value:0},strength:{value:0},warp:{value:0},trails:{value:0},overlay:{value:0}},vertexShader:'varying vec2 vFrogUv; void main(){vFrogUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:fragment,depthTest:false,depthWrite:false,toneMapped:false});
   const scene=new T.Scene(),quad=new T.Mesh(new T.PlaneGeometry(2,2),material);quad.frustumCulled=false;scene.add(quad);pass={picture,history,material,quad,scene,view:new T.Camera(),previous:false};
  }
  renderer.copyFramebufferToTexture(pass.picture);
  const u=pass.material.uniforms;u.time.value=secondsSinceLick();u.strength.value=strength*(mild?.28:1);
  u.warp.value=strength*(mild?.12:lite?.72:1);u.trails.value=pass.previous?strength:0;u.overlay.value=strength*(mild?.72:1);
  renderer.render(pass.scene,pass.view);
  // The first frame seeds a fresh history texture before the shader reads it.
  if(pass.history){renderer.copyFramebufferToTexture(pass.history);pass.previous=true;}
 }
 const leave=()=>end(true);globalThis.addEventListener?.('pagehide',leave);
 const visibility=()=>{if(globalThis.document?.hidden)leave();};globalThis.document?.addEventListener('visibilitychange',visibility);
 return {get active(){return start!==null;},get elapsed(){return start===null?0:secondsSinceLick();},get strength(){return strength;},get baseFov(){return baseFov;},get mild(){return mild;},get light(){return lite;},get audio(){return frogAudioState();},
  get warp(){return pass?.material.uniforms.warp.value??0;},get trails(){return pass?.material.uniforms.trails.value??0;},get overlay(){return pass?.material.uniforms.overlay.value??0;},
  start(){if(start!==null)return;start=now();baseFov=camera.fov;strength=0;fade=null;mild=!!reduced?.matches;lite=light();try{startFrogAudio();}catch{stopFrogAudio();}},end,update,render,
  endForTarget(kind){if(ENDING_TARGETS.has(kind))end(true);},
  escape(closePanels){if(start===null)return false;if(tripPanelOpen())closePanels();else end();return true;},
  dispose(){release();globalThis.removeEventListener?.('pagehide',leave);globalThis.document?.removeEventListener('visibilitychange',visibility);}};
}
