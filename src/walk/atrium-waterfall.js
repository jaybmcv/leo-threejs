import * as T from 'three';
import {ATRIUM_WATERFALL} from '../plan/atrium-v2.js';
import {atriumViewSpan,inOpenAtrium} from '../v2/atrium-visibility.js';
import {walkCanvas} from './canvas.js';
import {createSpatial,updateSpatial} from './spatial-audio.js';

const NAME='P6_atrium_waterfall',SPRAY=12,LITE_SPRAY=6,NEAR=3,REACH=28,LEVEL=.12;

// The sheets' UVs already run up the slope. A positive V offset makes these streaks fall.
function fallingMap(){
 const c=walkCanvas(),w=128,h=256;c.width=w;c.height=h;
 const g=c.getContext('2d');g.fillStyle='#99bbcd';g.fillRect(0,0,w,h);
 let seed=8181;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(const [count,width,length,colour] of [[32,6,98,'217,240,248'],[84,2.3,52,'255,255,255']]){
  for(let i=0;i<count;i++){
   const x=rnd()*w,y=rnd()*h,sw=.8+rnd()*width,len=16+rnd()*length,alpha=.35+.6*rnd();
   for(const dy of [0,-h]){
    const grad=g.createLinearGradient(0,y+dy,0,y+dy+len);
    grad.addColorStop(0,`rgba(${colour},0)`);grad.addColorStop(.42,`rgba(${colour},${alpha})`);grad.addColorStop(1,`rgba(${colour},0)`);
    g.fillStyle=grad;g.fillRect(x,y+dy,sw,len);if(x+sw>w)g.fillRect(x-w,y+dy,sw,len);
   }
  }
 }
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;return map;
}

const varying='varying vec2 vUv;';
const vertex=body=>`${varying}
 #include <common>
 #include <logdepthbuf_pars_vertex>
 void main(){
  vUv=uv;
  ${body}
  gl_Position=projectionMatrix*mvPosition;
  #include <logdepthbuf_vertex>
 }`;
const fragment=body=>`${varying}
 #include <common>
 #include <logdepthbuf_pars_fragment>
 void main(){
  #include <logdepthbuf_fragment>
  ${body}
  #include <colorspace_fragment>
 }`;
const foamVertex=vertex('vec4 mvPosition=modelViewMatrix*vec4(position,1.);');
const foamFragment=`uniform float time,halfWidth;
 float ripple(vec2 p,float age){
  vec2 radii=mix(vec2(.7,.32),vec2(halfWidth+1.15,2.65),age);
  float edge=abs(length(p/radii)-1.);
  return (1.-smoothstep(.019,.052,edge))*smoothstep(0.,.12,age)*(1.-age);
 }${fragment(`
  vec2 p=(vUv-.5)*vec2(8.,5.)+vec2(0.,1.7);
  float scallop=.10*sin(9.*p.x+time*7.)+.05*sin(18.*p.x-time*4.);
  float bubbles=.7+.3*sin(p.x*15.+p.y*18.-time*10.)*sin(p.x*8.-time*6.);
  float foam=(1.-smoothstep(.48,1.,length(vec2(p.x/halfWidth,(p.y-.4-scallop)/.52))))*bubbles;
  vec2 q=p-vec2(0.,.95);float t=time/2.35;
  float rings=(ripple(q,fract(t))+ripple(q,fract(t+.5)))*smoothstep(-.45,.45,q.y);
  gl_FragColor=vec4(.84,.96,1.,min(.88,.78*foam+.69*rings));`)}`;
const sprayVertex=`attribute vec3 launch;uniform float time;varying float life;
 ${vertex(`
  float age=fract(time*mix(.94,1.33,launch.z)+launch.y);
  life=smoothstep(0.,.1,age)*(1.-smoothstep(.35,1.,age));
  float hop=4.*age*(1.-age)*mix(.28,.70,launch.z);
  vec4 mvPosition=modelViewMatrix*vec4(launch.x+age*(launch.z-.5)*.45,.11+hop,.24+age*.9,1.);
  mvPosition.xy+=position.xy*vec2(1.,1.35)*mix(.17,.39,launch.z)*(.55+.75*age);`)}`;
const sprayFragment=`varying float life;
 ${fragment(`
  float soft=1.-smoothstep(.08,1.,length(vUv*2.-1.));
  gl_FragColor=vec4(.89,.97,1.,life*soft*.86);`)}`;

function splash(group,width,clock){
 const mesh=(label,geometry,vertexShader,fragmentShader,uniforms,order,side=T.FrontSide)=>{
  const material=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,side,transparent:true,depthWrite:false,toneMapped:false,forceSinglePass:true});
  const o=new T.Mesh(geometry,material);o.name=NAME+'_'+label;o.renderOrder=order;o.frustumCulled=false;group.add(o);
 };
 // One flat draw for the foam and rings. Its UV Y points out from the fall into the lake.
 const water=new T.PlaneGeometry(8,5).rotateX(Math.PI/2).translate(0,.035,1.7);
 mesh('foam_ripples',water,foamVertex,foamFragment,{time:clock,halfWidth:{value:width/2}},1,T.DoubleSide);
 const quad=new T.PlaneGeometry(1,1),spray=new T.InstancedBufferGeometry().copy(quad),launch=[];quad.dispose();
 // Interleave the positions so the reduced set still covers the full curtain.
 for(let i=0;i<SPRAY;i++)launch.push((((i*5)%SPRAY+.5)/SPRAY-.5)*width,(i*.618)%1,(i*.382+.23)%1);
 spray.setAttribute('launch',new T.InstancedBufferAttribute(new Float32Array(launch),3));spray.instanceCount=SPRAY;
 mesh('spray',spray,sprayVertex,sprayFragment,{time:clock},2);return spray;
}

function cascadeSound(source){
 let ctx=null,gain,spatial,distance=Infinity,target=0;
 function build(Audio){
  ctx=new Audio();gain=ctx.createGain();gain.gain.value=0;spatial=createSpatial(ctx);gain.connect(spatial);
  const n=ctx.sampleRate*3,fade=Math.min(2048,Math.floor(n/4)),buffer=ctx.createBuffer(1,n,ctx.sampleRate),samples=buffer.getChannelData(0);let brown=0;
  for(let i=0;i<n;i++){const white=Math.random()*2-1;brown=(brown+.04*white)/1.04;samples[i]=(.26*white+.55*brown)*(.87+.13*Math.sin(i/ctx.sampleRate*11));}
  for(let i=0;i<fade;i++){const t=i/fade;samples[i]=samples[i]*t+samples[n-fade+i]*(1-t);}
  const loop=ctx.createBufferSource(),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter();
  loop.buffer=buffer;loop.loop=true;loop.loopEnd=(n-fade)/ctx.sampleRate;
  high.type='highpass';high.frequency.value=480;low.type='lowpass';low.frequency.value=2900;
  loop.connect(high).connect(low).connect(gain);loop.start();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend().catch(()=>{});else if(target)ctx.resume().catch(()=>{});});
 }
 return {source,get distance(){return distance;},get gain(){return gain?.gain.value??0;},get target(){return target;},
  update(walker,on,camera){
   distance=source.distanceTo(walker);
   const wanted=on&&inOpenAtrium()&&Math.abs(walker.y-source.y)<3?LEVEL*T.MathUtils.clamp((REACH-distance)/(REACH-NEAR),0,1)**2:0;
   if(!ctx){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!wanted||!Audio||navigator.userActivation?.hasBeenActive===false)return;build(Audio);}
   if(wanted&&!document.hidden&&ctx.state==='suspended')ctx.resume().catch(()=>{});
   if(wanted||target)updateSpatial(ctx,spatial,camera,source);
   if(target!==wanted){target=wanted;gain.gain.setTargetAtTime(target,ctx.currentTime,.17);}
  }};
}

export function createAtriumWaterfall(ship,scene){
 const sheet=ship.facade?.getObjectByName(NAME);if(!sheet)return null;
 const map=fallingMap(),far=ship.v2Haze?.getObjectByName(NAME);
 // Both facade copies keep their original geometry and render passes and scroll the same texture.
 for(const o of [sheet,far])if(o){o.material.map=map;o.material.needsUpdate=true;o.frustumCulled=true;}
 const bounds=new T.Box3().setFromObject(sheet);
 // The lowest sheet is the widest and faces -X. Its lower bound meets the lake.
 const group=new T.Group();group.name=NAME+'_splash';group.userData.noCollide=true;group.visible=false;
 group.position.set(bounds.min.x,bounds.min.y,(bounds.min.z+bounds.max.z)/2);group.rotation.y=ATRIUM_WATERFALL.yaw;scene.add(group);
 const clock={value:0},spray=splash(group,bounds.max.z-bounds.min.z,clock);
 const sound=cascadeSound(group.position.clone().add(new T.Vector3(0,.85,0)));
 const eye=new T.Vector3(),view=new T.Matrix4(),frustum=new T.Frustum();
 const footprint=new T.Sphere(group.position.clone().add(new T.Vector3(-1.7,0,0)),5);
 return {sound,map,get splashTime(){return clock.value;},update(camera,time,walker,on,reduced){
  map.offset.y=(time*.63)%1;
  const span=atriumViewSpan(),y=group.position.y;
  group.visible=!!span&&span[0]<=y+.8&&span[1]>=y&&camera.getWorldPosition(eye).distanceToSquared(footprint.center)<(reduced?34:55)**2;
  if(group.visible){view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);group.visible=frustum.setFromProjectionMatrix(view).intersectsSphere(footprint);}
  if(group.visible){clock.value=time;spray.instanceCount=reduced?LITE_SPRAY:SPRAY;}
  sound.update(walker,on,camera);
 }};
}
