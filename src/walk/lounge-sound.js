// Quiet water and an original melodic, half-time electronic loop for the lounge. Both follow the Sound button;
// the dome keeps its own lullaby and does not play the lounge music.
const BEAT=60/140,LOOP=32;
const MELODY=[[72,2],[75,1],[79,1],[82,2],[79,2],[77,2],[75,1],[72,1],[70,2],[72,2],
 [68,2],[72,1],[75,1],[79,2],[75,2],[77,2],[75,1],[72,1],[70,2],[72,2]];
const BASS=[36,36,32,34];
const NOTES=[];let beat=0;
for(const [m,n] of MELODY){NOTES.push({at:beat,m,n,kind:'lead'});beat+=n;}
for(let b=0;b<LOOP;b+=4){NOTES.push({at:b,m:BASS[Math.floor(b/8)],n:3.5,kind:'bass'});NOTES.push({at:b,kind:'kick'});NOTES.push({at:b+2,kind:'snare'});}
NOTES.sort((a,b)=>a.at-b.at);
const pitch=m=>440*2**((m-69)/12);

export function createLoungeSound(lounge,falls){
 let ctx=null,water=null,music=null,playing=false,start=0,index=0,loops=0,wanted=false;
 function build(){
  ctx=new (window.AudioContext||window.webkitAudioContext)();
  water=ctx.createGain();water.gain.value=0;water.connect(ctx.destination);
  music=ctx.createGain();music.gain.value=0;music.connect(ctx.destination);
  // A short, cross-faded noise loop gives the water a gentle, even rush.
  const n=ctx.sampleRate*3,fade=Math.min(2048,Math.floor(n/4)),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);let b=0;
  for(let i=0;i<n;i++){const w=Math.random()*2-1;b=(b+.04*w)/1.04;d[i]=w*.25+b;}
  for(let i=0;i<fade;i++){const f=i/fade;d[i]=d[i]*f+d[n-fade+i]*(1-f);}
  const src=ctx.createBufferSource(),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter();
  src.buffer=buf;src.loop=true;src.loopEnd=(n-fade)/ctx.sampleRate;high.type='highpass';high.frequency.value=350;low.type='lowpass';low.frequency.value=2400;
  src.connect(high).connect(low).connect(water);src.start();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else if(wanted)ctx.resume().catch(()=>{});});
 }
 function note(t,e){
  const o=ctx.createOscillator(),g=ctx.createGain(),end=t+(e.kind==='lead'?e.n*BEAT*.85:e.kind==='bass'?e.n*BEAT:.22);
  o.type=e.kind==='lead'?'triangle':e.kind==='bass'?'sine':e.kind==='snare'?'triangle':'sine';
  o.frequency.setValueAtTime(e.m?pitch(e.m):e.kind==='kick'?125:180,t);
  if(e.kind==='kick')o.frequency.exponentialRampToValueAtTime(45,t+.18);
  const level=e.kind==='lead'?.055:e.kind==='bass'?.12:e.kind==='kick'?.10:.035;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(level,t+.015);g.gain.exponentialRampToValueAtTime(.0001,end);
  o.connect(g).connect(music);o.start(t);o.stop(end+.02);
 }
 function pump(){
  const now=ctx.currentTime;
  for(;;){let t=start+(loops*LOOP+NOTES[index].at)*BEAT;
   if(t<now-.25){start+=now+.1-t;t=now+.1;}
   if(t>=now+.5)break;
   note(t,NOTES[index]);if(++index===NOTES.length){index=0;loops++;}
  }
 }
 return {update(walker,soundOn){
  const dome=lounge.dome,insideDome=Math.abs(walker.y-dome.centre.y)<dome.r&&Math.hypot(walker.x-dome.centre.x,walker.z-dome.centre.z)<dome.r;
  const dx=falls.a.x-falls.b.x,dz=falls.a.z-falls.b.z,len=dx*dx+dz*dz;
  const u=Math.max(0,Math.min(1,((walker.x-falls.b.x)*dx+(walker.z-falls.b.z)*dz)/len));
  const distance=Math.hypot(walker.x-(falls.b.x+u*dx),walker.z-(falls.b.z+u*dz));
  const waterLevel=soundOn&&Math.abs(walker.y-falls.a.y)<4?Math.max(0,1-distance/14)**2:0;
  const musicOn=soundOn&&lounge.inside(walker)&&!insideDome;
  wanted=!!(waterLevel||musicOn);
  if(wanted&&!ctx){if(navigator.userActivation?.hasBeenActive===false)return;build();}
  if(!ctx)return;
  if(wanted&&!document.hidden&&ctx.state==='suspended')ctx.resume().catch(()=>{});
  water.gain.setTargetAtTime(waterLevel*.12,ctx.currentTime,.4);
  music.gain.setTargetAtTime(musicOn?.55:0,ctx.currentTime,musicOn?.7:.12);
  if(musicOn&&!playing){start=ctx.currentTime+.1;index=0;loops=0;}
  playing=musicOn;
  if(musicOn&&ctx.state==='running'&&!document.hidden)pump();
 }};
}
