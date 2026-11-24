import * as T from 'three';
import {startFrogAudio,setFrogAudio,stopFrogAudio,frogAudioState} from './frog-audio.js';

// Capture the finished film look, then draw one local pass. Idle uses no textures, audio nodes or frame callbacks.
const fragment=`precision highp float;
uniform sampler2D picture,history;
uniform vec2 texel;
uniform float time,strength,motion,trails;
varying vec2 vFrogUv;
vec3 sampleAt(vec2 p){return texture2D(picture,clamp(p,texel,1.0-texel)).rgb;}
void main(){
 vec2 p=vFrogUv,q=p-.5;
 p+=motion*strength*(q*dot(q,q)*.18+vec2(sin(p.y*13.0+time*.75),cos(p.x*12.0+time*.65))*.012);
 vec2 edge=q*.015*strength*motion;
 vec3 c=vec3(sampleAt(p+edge).r,sampleAt(p).g,sampleAt(p-edge).b);
 float grey=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(grey),c,1.0+strength*.9);
 // A slow rotation about the grey axis cycles hue without flashing brightness.
 vec3 axis=normalize(vec3(1.0));float a=strength*.9*sin(time*.6);
 c=c*cos(a)+cross(axis,c)*sin(a)+axis*dot(axis,c)*(1.0-cos(a));
 vec3 glow=vec3(0.0);
 for(int i=0;i<4;i++){float a=float(i)*1.570796;vec3 s=sampleAt(p+vec2(cos(a),sin(a))*texel*5.0);glow+=max(s-.68,0.0)*.25;}
 c+=glow*strength*.85;
 c=mix(c,texture2D(history,vFrogUv).rgb,trails*strength*.78);
 gl_FragColor=vec4(clamp(c,0.0,1.0),1.0);
}`;
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function frogStrength(elapsed){return ease(elapsed)*ease((20-elapsed)/5);}
export function createFrogTrip({renderer,camera,light=()=>false,now=()=>performance.now()}){
 let start=null,fade=null,fadeFrom=0,strength=0,baseFov=null,pass=null,mild=false,lite=false;
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 function release(){
  if(start===null)return;
  camera.fov=baseFov;camera.updateProjectionMatrix();stopFrogAudio();
  if(pass){pass.picture.dispose();pass.history?.dispose();pass.quad.geometry.dispose();pass.material.dispose();pass=null;}
  start=null;fade=null;strength=0;baseFov=null;
 }
 function end(immediate=false){if(start===null)return;if(immediate){release();return;}if(fade===null){fade=now();fadeFrom=strength;}}
 function update(){
  if(start===null)return false;
  const elapsed=(now()-start)/1000;
  if(elapsed>=20||(fade!==null&&now()-fade>=450)){release();return false;}
  mild=!!reduced?.matches;lite=light();
  strength=fade===null?frogStrength(elapsed):fadeFrom*(1-ease((now()-fade)/450));
  camera.fov=baseFov+(mild?0:strength*3*Math.sin(elapsed*Math.PI*2/4));camera.updateProjectionMatrix();
  setFrogAudio(strength*(.82+.18*Math.sin(elapsed*Math.PI*2/6)));
  return true;
 }
 function render(){
  if(start===null)return;
  const size=renderer.getDrawingBufferSize(new T.Vector2());
  if(pass&&(pass.picture.image.width!==size.x||pass.picture.image.height!==size.y)){pass.picture.dispose();pass.history?.dispose();pass.quad.geometry.dispose();pass.material.dispose();pass=null;}
  if(!pass){const picture=new T.FramebufferTexture(size.x,size.y),history=(!mild&&!lite)?new T.FramebufferTexture(size.x,size.y):null;
   for(const texture of [picture,history])if(texture)texture.minFilter=texture.magFilter=T.LinearFilter;
   const material=new T.ShaderMaterial({uniforms:{picture:{value:picture},history:{value:history||picture},texel:{value:new T.Vector2(1/size.x,1/size.y)},time:{value:0},strength:{value:0},motion:{value:0},trails:{value:0}},vertexShader:'varying vec2 vFrogUv; void main(){vFrogUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:fragment,depthTest:false,depthWrite:false,toneMapped:false});
   const scene=new T.Scene(),quad=new T.Mesh(new T.PlaneGeometry(2,2),material);quad.frustumCulled=false;scene.add(quad);pass={picture,history,material,quad,scene,view:new T.Camera(),previous:false};
  }
  renderer.copyFramebufferToTexture(pass.picture);
  if(pass.history&&!pass.previous)renderer.copyFramebufferToTexture(pass.history);
  const u=pass.material.uniforms;u.time.value=(now()-start)/1000;u.strength.value=strength*(mild?.28:1);u.motion.value=mild||lite?0:1;u.trails.value=pass.previous&&!mild&&!lite?1:0;
  renderer.render(pass.scene,pass.view);
  if(pass.history&&!mild&&!lite){renderer.copyFramebufferToTexture(pass.history);pass.previous=true;}
 }
 const leave=()=>end(true);globalThis.addEventListener?.('pagehide',leave);
 const visibility=()=>{if(globalThis.document?.hidden)leave();};globalThis.document?.addEventListener('visibilitychange',visibility);
 return {get active(){return start!==null;},get strength(){return strength;},get baseFov(){return baseFov;},get mild(){return mild;},get light(){return lite;},get audio(){return frogAudioState();},
  start(){if(start!==null)return;start=now();baseFov=camera.fov;strength=0;fade=null;mild=!!reduced?.matches;lite=light();try{startFrogAudio();}catch{stopFrogAudio();}},end,update,render,
  dispose(){release();globalThis.removeEventListener?.('pagehide',leave);globalThis.document?.removeEventListener('visibilitychange',visibility);}};
}
