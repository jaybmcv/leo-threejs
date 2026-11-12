import {createSpatial,updateSpatial} from './spatial-audio.js';
// Quiet water and an original melodic, half-time electronic arrangement for the lounge. Both follow the Sound button;
// the dome keeps its own lullaby and does not play the lounge music.
// The arrangement is ten sections of 32 beats (about 137 s) and repeats only after the last has turned back into the first:
// the opening theme and its answer, a lift, a quiet passage that builds again, a busier bridge, the theme's return and a thinning outro.
const BEAT=60/140,SECTION=32;
const CHORDS={cm:[36,[60,63,67,70]],ab:[32,[56,60,63,67]],bb:[34,[58,62,65,68]],fm:[41,[56,60,63,65]],eb:[39,[55,58,62,63]],gm:[31,[58,62,65,67]],g7:[31,[59,62,65,67]]};
// Four melody bars of eight beats, one per chord: [midi,beats], midi 0 is a rest.
const BARS={
 theme:[[[72,2],[75,1],[79,1],[82,2],[79,2]],[[77,2],[75,1],[72,1],[70,2],[72,2]],[[68,2],[72,1],[75,1],[79,2],[75,2]],[[77,2],[75,1],[72,1],[70,2],[72,2]]],
 answer:[[[79,1],[77,1],[75,2],[72,1],[75,1],[77,2]],[[79,2],[82,1],[84,1],[82,2],[79,2]],[[80,2],[79,1],[75,1],[72,2],[75,2]],[[74,1],[77,1],[82,2],[79,1],[77,1],[74,2]]],
 lift:[[[77,1.5],[75,.5],[72,1],[0,1],[75,1.5],[77,.5],[80,2]],[[79,1.5],[77,.5],[75,1],[0,1],[74,1.5],[75,.5],[79,2]],[[80,1.5],[79,.5],[75,1],[0,1],[72,1.5],[75,.5],[80,2]],[[83,1],[79,1],[77,1],[74,1],[71,2],[0,1],[74,1]]],
 high:[[[84,2],[80,1],[77,1],[80,2],[77,1],[75,1]],[[82,2],[79,1],[75,1],[79,2],[82,1],[84,1]],[[84,1],[80,1],[77,2],[75,1],[77,1],[80,2]],[[82,1],[79,1],[77,1],[74,1],[77,2],[74,1],[70,1]]],
 hush:[[[0,2],[84,3],[0,1],[80,2]],[[0,1],[79,4],[0,3]],[[77,3],[0,1],[75,2],[72,2]],[[74,2],[71,2],[0,4]]],
 hush2:[[[79,4],[75,2],[0,2]],[[82,3],[0,1],[79,4]],[[80,4],[77,2],[75,2]],[[74,2],[77,2],[79,4]]],
 bridge:[[[74,.5],[77,.5],[79,1],[82,1],[79,.5],[77,.5],[74,1],[77,.5],[79,.5],[82,1],[0,1]],[[75,.5],[79,.5],[82,1],[84,1],[82,.5],[79,.5],[75,1],[79,.5],[82,.5],[79,1],[0,1]],[[77,.5],[80,.5],[84,1],[80,1],[77,.5],[75,.5],[72,1],[75,.5],[77,.5],[80,1],[0,1]],[[82,1],[80,.5],[77,.5],[74,1],[77,.5],[80,.5],[82,2],[0,2]]],
 fall:[[[82,2],[79,1],[77,1],[74,2],[77,2]],[[79,2],[75,1],[72,1],[75,2],[79,2]],[[80,2],[77,1],[75,1],[72,2],[75,2]],[[74,1],[77,1],[79,2],[83,2],[0,2]]],
 outro:[[[79,3],[75,1],[72,2],[75,2]],[[80,2],[79,2],[75,4]],[[77,2],[75,2],[72,4]],[[74,2],[70,2],[67,4]]]};
BARS.back=[BARS.theme[0],BARS.theme[1],BARS.answer[2],BARS.answer[3]];
// Drums, one or two four-beat bars per chord: [beat in the bar, voice, strength].
const eighths=[0,.5,1,1.5,2,2.5,3,3.5],offbeats=[.5,1.5,2.5,3.5];
const DRUMS={
 none:[[],[]],soft:[[],[[0,'kick',.5],[2,'kick',.4]]],
 half:[[[0,'kick',1],[2,'snare',1]]],
 hats:[[[0,'kick',1],[2,'snare',1],...offbeats.map(b=>[b,'hat',.8])]],
 sway:[[[0,'kick',1],[2.5,'kick',.7],[2,'snare',1],...offbeats.map((b,i)=>[b,'hat',i%2?.9:.6])]],
 busy:[[[0,'kick',1],[1.75,'kick',.6],[2.5,'kick',.8],[1,'snare',.35],[2,'snare',1],[3.75,'snare',.35],...eighths.map((b,i)=>[b,'hat',i%2?.9:.55])]],
 thin:[[[0,'kick',.8],[2,'kick',.5],[1.5,'hat',.6],[3.5,'hat',.6]]],
 fill:[[[0,'kick',.8],[2,'kick',.5],[1.5,'hat',.6],[3.5,'hat',.6]],[[0,'kick',1],[2,'snare',.5],[2.5,'snare',.6],[3,'snare',.7],[3.25,'snare',.7],[3.5,'snare',.85],[3.75,'snare',1]]]};
// Bass bars of eight beats: [beat, semitones above the chord's root, beats].
const BASSES={root:[[0,0,3.5],[4,0,3.5]],pulse:[[0,0,1.5],[2.5,0,1],[4,0,2.5],[6.5,7,1]],walk:[[0,0,2.5],[3,7,1],[4,0,2.5],[7,12,.9]]};
// bass, pad, lead and arp are strengths; the quiet passages hold the bass, the lead and the drums back.
const PARTS=[
 {name:'theme',bars:'theme',chords:'cm cm ab bb',drums:'half',bass:'root',pad:.7},
 {name:'answer',bars:'answer',chords:'cm cm ab bb',drums:'hats',bass:'pulse'},
 {name:'lift',bars:'lift',chords:'fm eb ab g7',drums:'sway',bass:'walk'},
 {name:'high',bars:'high',chords:'fm eb ab bb',drums:'sway',bass:'pulse',lead:.9,arp:.5},
 {name:'hush',bars:'hush',chords:'ab cm fm g7',drums:'none',bass:'root',bassV:.5,pad:1.3,lead:.65},
 {name:'hush2',bars:'hush2',chords:'eb gm ab g7',drums:'none none none soft',bass:'root',bassV:.6,pad:1.3,lead:.7},
 {name:'bridge',bars:'bridge',chords:'gm cm fm bb',drums:'busy',bass:'walk',pad:.9,lead:.85},
 {name:'fall',bars:'fall',chords:'gm cm fm g7',drums:'busy',bass:'pulse',arp:.4},
 {name:'return',bars:'back',chords:'cm cm ab bb',drums:'hats',bass:'pulse',pad:.9},
 {name:'outro',bars:'outro',chords:'cm ab fm bb',drums:'hats hats thin fill',bass:'root',pad:1.1,lead:.8}];
const LOOP=SECTION*PARTS.length,NOTES=[],SPANS=[];
PARTS.forEach((s,k)=>{
 const base=k*SECTION,drums=s.drums.split(' ');
 SPANS.push({name:s.name,start:base,beats:SECTION});
 s.chords.split(' ').forEach((c,i)=>{
  const at=base+i*8,[root,pad]=CHORDS[c];
  for(const m of pad)NOTES.push({at,m,n:8,kind:'pad',v:s.pad??1});
  for(const [o,semi,n] of BASSES[s.bass])NOTES.push({at:at+o,m:root+semi,n,kind:'bass',v:s.bassV??1});
  let t=at;for(const [m,n] of BARS[s.bars][i]){if(m)NOTES.push({at:t,m,n,kind:'lead',v:s.lead??1});t+=n;}
  if(s.arp)for(let b=0;b<8;b+=.5)NOTES.push({at:at+b,m:pad[[0,1,2,3,2,1][b*2%6]]+12,n:.5,kind:'arp',v:s.arp});
  const bars=DRUMS[drums[Math.min(i,drums.length-1)]];
  for(let r=0;r<2;r++)for(const [o,kind,v] of bars[Math.min(r,bars.length-1)])NOTES.push({at:at+r*4+o,kind,v});
 });
});
NOTES.sort((a,b)=>a.at-b.at);
const pitch=m=>440*2**((m-69)/12);
export const SCORE={beat:BEAT,loop:LOOP,notes:NOTES,sections:SPANS};
// One short buffer of noise serves every hi-hat.
function makeNoise(ctx){const n=Math.floor(ctx.sampleRate*.6),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return buf;}
const VOICES={lead:{type:'triangle',level:.055,attack:.015},bass:{type:'sine',level:.12,attack:.015},kick:{type:'sine',level:.10,attack:.015},snare:{type:'triangle',level:.035,attack:.015},pad:{type:'sine',level:.009,attack:.6},arp:{type:'triangle',level:.02,attack:.01}};
// Every voice is a few nodes that stop themselves, so nothing builds up however long the music plays.
export function voice(ctx,out,noise,t,e){
 const v=e.v??1,g=ctx.createGain();g.gain.value=.0001;
 if(e.kind==='hat'){
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter();s.buffer=noise;f.type='highpass';f.frequency.value=7000;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.014*v,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+.06);
  s.connect(f).connect(g).connect(out);s.start(t,(e.at*.37)%.4);s.stop(t+.08);return;
 }
 const o=ctx.createOscillator(),p=VOICES[e.kind],end=t+(e.kind==='lead'?e.n*BEAT*.85:e.kind==='pad'?e.n*BEAT+.5:e.kind==='arp'?e.n*BEAT*.9:e.kind==='bass'?e.n*BEAT:.22);
 o.type=p.type;o.frequency.setValueAtTime(e.m?pitch(e.m):e.kind==='kick'?125:180,t);
 if(e.kind==='kick')o.frequency.exponentialRampToValueAtTime(45,t+.18);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(p.level*v,t+p.attack);if(e.kind==='pad')g.gain.setValueAtTime(p.level*v,end-.6);g.gain.exponentialRampToValueAtTime(.0001,end);
 o.connect(g).connect(out);o.start(t);o.stop(end+.02);
}

export function createLoungeSound(lounge,falls){
 let ctx=null,water=null,music=null,spatial=null,noise=null,playing=false,start=0,index=0,loops=0,wanted=false;
 function build(){
  ctx=new (window.AudioContext||window.webkitAudioContext)();
  water=ctx.createGain();water.gain.value=0;spatial=createSpatial(ctx);water.connect(spatial);
  music=ctx.createGain();music.gain.value=0;music.connect(ctx.destination);noise=makeNoise(ctx);
  // A short, cross-faded noise loop gives the water a gentle, even rush.
  const n=ctx.sampleRate*3,fade=Math.min(2048,Math.floor(n/4)),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);let b=0;
  for(let i=0;i<n;i++){const w=Math.random()*2-1;b=(b+.04*w)/1.04;d[i]=w*.25+b;}
  for(let i=0;i<fade;i++){const f=i/fade;d[i]=d[i]*f+d[n-fade+i]*(1-f);}
  const src=ctx.createBufferSource(),high=ctx.createBiquadFilter(),low=ctx.createBiquadFilter();
  src.buffer=buf;src.loop=true;src.loopEnd=(n-fade)/ctx.sampleRate;high.type='highpass';high.frequency.value=350;low.type='lowpass';low.frequency.value=2400;
  src.connect(high).connect(low).connect(water);src.start();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else if(wanted)ctx.resume().catch(()=>{});});
 }
 function pump(){
  const now=ctx.currentTime;
  for(;;){let t=start+(loops*LOOP+NOTES[index].at)*BEAT;
   if(t<now-.25){start+=now+.1-t;t=now+.1;}
   if(t>=now+.5)break;
   voice(ctx,music,noise,t,NOTES[index]);if(++index===NOTES.length){index=0;loops++;}
  }
 }
 return {update(walker,soundOn,camera=null){
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
  updateSpatial(ctx,spatial,camera,{x:falls.b.x+u*dx,y:falls.a.y,z:falls.b.z+u*dz});
  water.gain.setTargetAtTime(waterLevel*.12,ctx.currentTime,.4);
  music.gain.setTargetAtTime(musicOn?.55:0,ctx.currentTime,musicOn?.7:.12);
  if(musicOn&&!playing){start=ctx.currentTime+.1;index=0;loops=0;}
  playing=musicOn;
  if(musicOn&&ctx.state==='running'&&!document.hidden)pump();
 }};
}
