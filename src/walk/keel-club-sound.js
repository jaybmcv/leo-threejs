import {createSpatial,updateSpatial} from './spatial-audio.js';
import {KEEL,FALLS,WATER,riverOuter} from './keel-club.public.js';
// The Keel Club's water, quietly (keel-club.js): the rush of the nearest waterfall, and the wave lagoon's surf swelling
// with its waves (one every 10 s: 26 m apart at 2.6 m/s). Both follow the Sound button, like the lounge's water
// (lounge-sound.js), start only after the visitor has used the page, and stay silent away from the hall's floor.
const FLOOR=KEEL.floor,WAVE=10,[LX0,LX1,LZ]=WATER.lagoon;
// The falls' curtains: each a line along the river just in from its outer bank, on both sides.
const CURTAINS=[-1,1].flatMap(s=>FALLS.map(([x0,x1])=>{const z=s*(riverOuter((x0+x1)/2)-.7);return {a:{x:x0,z},b:{x:x1,z}};}));
function nearestOnLine(p,{a,b}){const dx=b.x-a.x,dz=b.z-a.z,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz)));return {x:a.x+u*dx,z:a.z+u*dz};}
// A short, cross-faded noise loop: `tone` blends white into brown noise (0 hiss, 1 rumble).
function noiseLoop(ctx,tone){
 const n=ctx.sampleRate*3,fade=Math.min(2048,Math.floor(n/4)),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);let b=0;
 for(let i=0;i<n;i++){const w=Math.random()*2-1;b=(b+.04*w)/1.04;d[i]=w*.25*(1-tone)+b*(1+tone*2);}
 for(let i=0;i<fade;i++){const f=i/fade;d[i]=d[i]*f+d[n-fade+i]*(1-f);}
 const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;src.loopEnd=(n-fade)/ctx.sampleRate;src.start();return src;
}
export function createKeelSound(){
 let ctx=null,falls=null,surf=null,fallsAt=null,surfAt=null,wanted=false;
 function chain(source,lowHz,highHz){const g=ctx.createGain(),sp=createSpatial(ctx),hi=ctx.createBiquadFilter(),lo=ctx.createBiquadFilter();g.gain.value=0;
  hi.type='highpass';hi.frequency.value=highHz;lo.type='lowpass';lo.frequency.value=lowHz;source.connect(hi).connect(lo).connect(g).connect(sp);return {gain:g,spatial:sp};}
 function build(){
  ctx=new (window.AudioContext||window.webkitAudioContext)();
  falls=chain(noiseLoop(ctx,0),2600,300);surf=chain(noiseLoop(ctx,.6),900,60);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else if(wanted)ctx.resume().catch(()=>{});});
 }
 return {update(walker,soundOn,camera=null){
  const inHall=soundOn&&walker.y<KEEL.terrace+6&&walker.y>FLOOR-3;
  // the nearest curtain, and the nearest point of the lagoon
  let best=null,bd=Infinity;for(const c of CURTAINS){const q=nearestOnLine(walker,c),d=Math.hypot(walker.x-q.x,walker.z-q.z);if(d<bd){bd=d;best=q;}}
  const lx=Math.max(LX0,Math.min(LX1,walker.x)),lz=Math.max(-LZ,Math.min(LZ,walker.z)),ld=Math.hypot(walker.x-lx,walker.z-lz);
  const fallsLevel=inHall?Math.max(0,1-bd/18)**2:0,surfNear=inHall?Math.max(0,1-ld/45)**1.5:0;
  wanted=!!(fallsLevel||surfNear);
  if(wanted&&!ctx){if(navigator.userActivation?.hasBeenActive===false)return;build();}
  if(!ctx)return;
  if(wanted&&!document.hidden&&ctx.state==='suspended')ctx.resume().catch(()=>{});
  fallsAt=best;surfAt={x:lx,z:lz};
  updateSpatial(ctx,falls.spatial,camera,{x:fallsAt.x,y:FLOOR,z:fallsAt.z});updateSpatial(ctx,surf.spatial,camera,{x:surfAt.x,y:FLOOR-.8,z:surfAt.z});
  // the surf swells as each wave breaks, then eases off until the next
  const phase=(ctx.currentTime%WAVE)/WAVE,swell=.35+.65*Math.max(0,Math.sin(Math.PI*2*phase))**2;
  falls.gain.gain.setTargetAtTime(fallsLevel*.13,ctx.currentTime,.4);surf.gain.gain.setTargetAtTime(surfNear*swell*.16,ctx.currentTime,.5);
 }};
}
