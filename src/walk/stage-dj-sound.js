import {createSpatial,updateSpatial} from './spatial-audio.js';

const FRONT_REACH=8,NORMAL_REACH=34,BOWL_REACH=44,LOOP_BEATS=16;
const fade=u=>{u=Math.max(0,Math.min(1,u));return u*u*(3-2*u);};
export function stageDjLevel(p,at,on=true){
 const aft=at[0]-p.x,dy=p.y-at[1],side=p.z-at[2],d=Math.hypot(aft,dy,side);
 if(!on||d>=BOWL_REACH||Math.abs(dy)>3.5)return 0;
 const normal=fade((NORMAL_REACH-d)/30);
 if(d<=FRONT_REACH)return .16*normal;
 // Extend toward the back row, 37.2 m out. Taper at the boulevard and room recess on either side.
 const audience=fade(Math.min(aft-3,side+22,8-side)/4);
 const bowl=fade((NORMAL_REACH-FRONT_REACH-(d-FRONT_REACH)*.52)/30)*fade((BOWL_REACH-d)/6);
 return .16*(normal+(bowl-normal)*audience);
}
// Mix the kick and duck the backing on the same sixteen-beat grid.
export function mixStageDj(data,rate){
 const beatSamples=data.length/LOOP_BEATS,beat=beatSamples/rate,end=Math.min(.24,beat*.8),recovery=Math.min(.15,end),tau=2*Math.PI;
 for(let i=0;i<data.length;i++){
  const t=(i%beatSamples)/rate;
  const duck=1-.28*Math.min(1,t/.004)*Math.max(0,1-t/recovery)**2;
  const phase=tau*(46*t+112*.017*(1-Math.exp(-t/.017)));
  const thump=.66*Math.sin(phase)*Math.exp(-t*14),body=.17*Math.sin(tau*138*t)*Math.exp(-t*30);
  const click=.05*Math.sin(tau*2100*t)*Math.exp(-t*280);
  const kick=(thump+body+click)*Math.min(1,t/.002)*Math.max(0,Math.min(1,(end-t)/.035));
  const edge=Math.min(1,i/96,(data.length-1-i)/96);
  data[i]=kick+data[i]*duck*edge;
 }
 // The finished buffer allows lookahead. Limit peaks with gain before spatial playback.
 const ceiling=.735,attack=1/(rate*.008),release=1/(rate*.06),gains=new Float32Array(data.length);
 let gain=1;
 for(let i=data.length-1;i>=0;i--){
  gain=Math.min(1,gain+attack,ceiling/Math.abs(data[i]));gains[i]=gain;
 }
 gain=1;
 for(let i=0;i<data.length;i++){
  gain=Math.min(gains[i],gain+release);data[i]*=gain;
 }
}
// A local sixteen-beat phrase, made once after a gesture. Nothing is fetched or scheduled on a timer.
export function stageDjLoop(ctx,bpm=134){
 const rate=ctx.sampleRate,seconds=LOOP_BEATS*60/bpm,n=Math.round(rate*seconds),buffer=ctx.createBuffer(1,n,rate),data=buffer.getChannelData(0),beatSamples=n/LOOP_BEATS,beat=beatSamples/rate;
 const bass=[0,0,7,0,0,12,7,0,0,0,10,7,0,3,7,10],acid=[0,12,7,15,0,10,7,19,0,12,3,10,7,15,12,7];let seed=134,previous=0,low=0,band=0;
 for(let i=0;i<n;i++){
  const t=i/rate,b=i/beatSamples,kt=(i%beatSamples)/rate,bar=b%4,step=Math.floor(b*4),u=(b*4)%1,age=u*beat/4;
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1,high=noise-previous;previous=noise;
  const hatAge=((b+.5)%1)*beat,hat=high*Math.exp(-hatAge*22)*.095;
  const clapAge=((bar+3)%2)*beat,clap=high*(Math.exp(-clapAge*35)+.6*Math.exp(-(((clapAge-.018)/.008)**2))+.4*Math.exp(-(((clapAge-.036)/.009)**2)))*.14;
  const metallic=(Math.sin(t*2*Math.PI*3179)*Math.sin(t*2*Math.PI*4513))*Math.exp(-age*100)*.035;
  const env=Math.min(1,age/.004)*Math.min(1,(beat/4-age)/.012),bf=49*Math.pow(2,bass[step%16]/12),af=98*Math.pow(2,acid[step%16]/12);
  const sub=(Math.sin(2*Math.PI*bf*age)+.18*Math.sin(4*Math.PI*bf*age))*.23*env*Math.exp(-age*9)*(1-.65*Math.exp(-kt*24));
  const saw=2*((age*af)%1)-1,cut=.05+.33*Math.exp(-age*28);
  // A resonant low-pass gives the short saw notes their acid sweep.
  low+=cut*band;const h=saw-low-.24*band;band+=cut*h;
  const synth=Math.tanh(low*2.2)*.095*env;
  data[i]=hat+clap+metallic+sub+synth;
 }
 mixStageDj(data,rate);
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
 return {get level(){return level;},get running(){return ctx?.state==='running';},get looping(){return source?.loop===true;},get beat(){return ctx?(ctx.currentTime-started)/(source.buffer.duration/LOOP_BEATS):null;},get gain(){return gain?.gain.value??0;},update(p,on,camera){
  level=stageDjLevel(p,at,on&&!document.hidden);wanted=level>0;
  if(wanted&&!ctx){if(navigator.userActivation?.hasBeenActive!==true)return;build();}
  if(!ctx)return;
  if(wanted&&ctx.state==='suspended')ctx.resume().catch(()=>{});
  updateSpatial(ctx,spatial,camera,position);gain.gain.setTargetAtTime(level,ctx.currentTime,wanted?.25:.08);
 }};
}
