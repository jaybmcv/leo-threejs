import {createSpatial,updateSpatial} from '../walk/spatial-audio.js';
import {stageDjLoop} from '../walk/stage-dj-sound.js';

const FRONT_REACH=8,NORMAL_REACH=34,BOWL_REACH=44;
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
