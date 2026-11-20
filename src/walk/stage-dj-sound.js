import {createSpatial,updateSpatial} from './spatial-audio.js';

// A local sixteen-beat phrase, made once after a gesture. Nothing is fetched or scheduled on a timer.
export function stageDjLevel(p,at,on=true){
 const d=Math.hypot(p.x-at[0],p.y-at[1],p.z-at[2]);
 if(!on||d>=34||Math.abs(p.y-at[1])>5)return 0;
 const u=Math.max(0,Math.min(1,(34-d)/30));return .16*u*u*(3-2*u);
}
export function stageDjLoop(ctx,bpm=134){
 const seconds=16*60/bpm,n=Math.round(ctx.sampleRate*seconds),buffer=ctx.createBuffer(1,n,ctx.sampleRate),data=buffer.getChannelData(0),beat=n/ctx.sampleRate/16;
 const bass=[0,0,7,0,0,12,7,0,0,0,10,7,0,3,7,10],acid=[0,12,7,15,0,10,7,19,0,12,3,10,7,15,12,7];let seed=134,previous=0,low=0,band=0;
 for(let i=0;i<n;i++){
  const t=i/ctx.sampleRate,b=t/beat,k=b%1,bar=b%4,step=Math.floor(b*4),u=(b*4)%1,age=u*beat/4;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,high=noise-previous;previous=noise;
  const kt=k*beat,kick=Math.sin(2*Math.PI*(47*kt+105*.025*(1-Math.exp(-kt/.025))))*Math.exp(-kt*18);
  const hatAge=((b+.5)%1)*beat,hat=high*Math.exp(-hatAge*22)*.095;
  const clapAge=((bar+3)%2)*beat,clap=high*(Math.exp(-clapAge*35)+.6*Math.exp(-(((clapAge-.018)/.008)**2))+.4*Math.exp(-(((clapAge-.036)/.009)**2)))*.14;
  const metallic=(Math.sin(t*2*Math.PI*3179)*Math.sin(t*2*Math.PI*4513))*Math.exp(-age*100)*.035;
  const env=Math.min(1,age/.004)*Math.min(1,(beat/4-age)/.012),bf=49*Math.pow(2,bass[step%16]/12),af=98*Math.pow(2,acid[step%16]/12);
  const sub=(Math.sin(2*Math.PI*bf*age)+.18*Math.sin(4*Math.PI*bf*age))*.23*env*Math.exp(-age*9)*(1-.65*Math.exp(-kt*24));
  const saw=2*((age*af)%1)-1,cut=.05+.33*Math.exp(-age*28);
  // A resonant low-pass gives the short saw notes their acid sweep.
  low+=cut*band;const h=saw-low-.24*band;band+=cut*h;
  const synth=Math.tanh(low*2.2)*.095*env;
  const edge=Math.min(1,i/96,(n-1-i)/96);data[i]=Math.tanh((kick*.6+hat+clap+metallic+sub+synth)*1.1)*edge;
 }
 return buffer;
}
export function createStageDjSound({at,bpm}){
 let ctx=null,gain=null,spatial=null,source=null,started=0,level=0,wanted=false;
 const position={x:at[0],y:at[1]+1.3,z:at[2]};
 function build(){
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
  ctx=new Audio();source=ctx.createBufferSource();source.buffer=stageDjLoop(ctx,bpm);source.loop=true;
  gain=ctx.createGain();gain.gain.value=0;spatial=createSpatial(ctx);source.connect(gain).connect(spatial);started=ctx.currentTime;source.start(started);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else if(wanted)ctx.resume().catch(()=>{});});
 }
 return {get level(){return level;},get running(){return ctx?.state==='running';},get looping(){return source?.loop===true;},get beat(){return ctx?(ctx.currentTime-started)/(source.buffer.duration/16):null;},get gain(){return gain?.gain.value??0;},update(p,on,camera){
  level=stageDjLevel(p,at,on&&!document.hidden);wanted=level>0;
  if(wanted&&!ctx){if(navigator.userActivation?.hasBeenActive!==true)return;build();}
  if(!ctx)return;
  if(wanted&&ctx.state==='suspended')ctx.resume().catch(()=>{});
  updateSpatial(ctx,spatial,camera,position);gain.gain.setTargetAtTime(level,ctx.currentTime,wanted?.25:.08);
 }};
}
