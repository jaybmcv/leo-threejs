// A quiet, original instrumental loop for Deck 16's gaming lounge (the old training & briefing room): soft sine and triangle
// tones over a slow pulse, no vocals, made here with Web Audio like the lounge's music (lounge-sound.js), so there are no sound files.
// It follows the Sound button, swells in as you step through the doorway and is silent outside the room and on other decks
// (gaming-lounge.js works out how much of the room you are in). The lounge's own music has the floor first: the two never play together.
// The loop is 16 bars of 4 beats at 76 beats a minute (about 50 s). Notes ring on across the loop's end, and the last chord resolves into the first.
// MASTER is this track's own volume, well under the game effects (their master is .3 with louder voices).
export const MASTER=.25,BEAT=60/76,LOOP=64;
const CHORDS={
 am:[33,[57,60,64,67,71]],f:[29,[53,57,60,64]],c:[36,[55,60,64,67,71]],g:[31,[55,59,62,64,69]],
 dm:[38,[53,57,60,64]],em:[40,[55,59,62,67]],am2:[33,[57,60,64,67,71]]};
// Chords of 8 beats, with the melody above each as [midi,beats] (midi 0 is a rest). The second half drifts from the first.
const BARS=[
 ['am',[[0,1],[76,1.5],[72,.5],[74,1],[71,1.5],[0,.5],[69,2]]],
 ['f',[[0,.5],[72,1],[69,.5],[76,1.5],[72,1],[0,.5],[77,1],[76,2]]],
 ['c',[[0,1],[79,1.5],[76,.5],[74,1],[71,1.5],[0,.5],[72,2]]],
 ['g',[[0,.5],[74,1],[71,1],[69,.5],[67,1.5],[71,1],[74,2.5]]],
 ['dm',[[0,1],[77,1.5],[74,.5],[72,1],[69,1.5],[0,.5],[74,2]]],
 ['f',[[72,1],[76,1],[77,1.5],[0,.5],[76,1],[72,1],[69,2]]],
 ['em',[[0,.5],[79,1.5],[76,1],[74,.5],[71,1.5],[0,1],[67,2]]],
 ['am2',[[0,1],[76,1],[72,1],[69,1.5],[0,.5],[71,1],[72,2]]]];
export const NOTES=[];
BARS.forEach(([name,tune],i)=>{
 const at=i*8,[root,pad]=CHORDS[name],second=i>=4;
 for(const m of pad)NOTES.push({at,m,n:8,kind:'pad'});
 for(let b=0;b<8;b+=4){NOTES.push({at:at+b,m:root,n:2.6,kind:'bass'});NOTES.push({at:at+b+3,m:root+(b?12:7),n:.9,kind:'bass',v:.7});}
 let t=at;for(const [m,n] of tune){if(m)NOTES.push({at:t,m,n,kind:'lead',v:second?1:.85});t+=n;}
 // The first half is only a tick; the second adds a soft pulse under it.
 for(let b=0;b<8;b++)NOTES.push({at:at+b+.5,kind:'tick',v:second?.8:.5});
 if(second)for(let b=0;b<8;b+=4)NOTES.push({at:at+b,kind:'pulse',v:b?.6:.8},{at:at+b+2.5,kind:'pulse',v:.45});
});
NOTES.sort((a,b)=>a.at-b.at);
const pitch=m=>440*2**((m-69)/12);
const VOICES={pad:{type:'sine',level:.011,attack:1.1},bass:{type:'sine',level:.09,attack:.03},lead:{type:'triangle',level:.034,attack:.012},pulse:{type:'sine',level:.07,attack:.01}};
// One short buffer of noise serves every tick.
function makeNoise(ctx){const n=Math.floor(ctx.sampleRate*.5),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);let s=12345;for(let i=0;i<n;i++){s=(s*16807)%2147483647;d[i]=s/1073741823-1;}return buf;}
// Every voice is a few nodes that stop themselves; `count` (optional) tracks how many are alive. `out` takes the notes, `send` the echo.
export function voice(ctx,out,send,noise,t,e,count=null){
 const v=e.v??1,g=ctx.createGain();g.gain.value=.0001;
 const done=node=>{if(count){count.live++;node.onended=()=>{count.live--;};}};
 if(e.kind==='tick'){
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter();s.buffer=noise;f.type='bandpass';f.frequency.value=6500;f.Q.value=.8;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.006*v,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+.05);
  s.connect(f).connect(g).connect(out);s.start(t,(e.at*.31)%.3);s.stop(t+.07);done(s);return;
 }
 const p=VOICES[e.kind],end=t+(e.kind==='lead'?e.n*BEAT*.9+.6:e.kind==='pad'?e.n*BEAT+.9:e.kind==='bass'?e.n*BEAT:.3);
 const o=ctx.createOscillator();o.type=p.type;o.frequency.setValueAtTime(e.m?pitch(e.m):110,t);
 if(e.kind==='pulse')o.frequency.exponentialRampToValueAtTime(48,t+.22);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(p.level*v,t+p.attack);
 if(e.kind==='pad'){g.gain.setValueAtTime(p.level*v,end-.9);}
 g.gain.exponentialRampToValueAtTime(.0001,end);
 o.connect(g).connect(out);if(e.kind==='lead')g.connect(send);o.start(t);o.stop(end+.02);done(o);
 // The pad is two tones a few cents apart, which slowly beat against each other.
 if(e.kind==='pad'){const o2=ctx.createOscillator();o2.type='triangle';o2.frequency.setValueAtTime(pitch(e.m),t);o2.detune.value=5;o2.connect(g);o2.start(t);o2.stop(end+.02);done(o2);}
}

// `room.soundLevel(p)` is 0 to 1: how much of the room's music reaches the walker (0 outside it and on other decks).
// `yieldTo` is true while the lounge's own music is audible; this track then waits.
export function createTrainingSound(room){
 let ctx=null,fade=null,master=null,analyser=null,noise=null,take=null,wanted=false,target=0;
 const count={live:0},stats={takes:0,connected:0,loops:0};
 function build(){
  ctx=new (window.AudioContext||window.webkitAudioContext)();noise=makeNoise(ctx);
  // notes (and the echo) -> a take's gain -> the room's fade -> this track's own volume -> out
  fade=ctx.createGain();fade.gain.value=0;master=ctx.createGain();master.gain.value=MASTER;
  analyser=ctx.createAnalyser();analyser.fftSize=2048;fade.connect(master).connect(analyser).connect(ctx.destination);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else if(wanted)ctx.resume().catch(()=>{});});
 }
 // A take is one playthrough, with its own soft dotted-eighth echo on the melody. It ends, and its nodes go, once the music has
 // faded out, so coming back never stacks a second loop.
 function open(){
  const gain=ctx.createGain(),send=ctx.createGain(),echo=ctx.createDelay(2),back=ctx.createGain(),tone=ctx.createBiquadFilter(),wet=ctx.createGain();
  echo.delayTime.value=BEAT*.75;back.gain.value=.38;tone.type='lowpass';tone.frequency.value=2200;wet.gain.value=.5;send.gain.value=.5;
  send.connect(echo);echo.connect(tone);tone.connect(back);back.connect(echo);tone.connect(wet);wet.connect(gain);gain.connect(fade);
  take={gain,send,echo,back,tone,wet,start:ctx.currentTime+.1,index:0,loops:0};stats.takes++;stats.connected++;
 }
 function close(){for(const k of ['gain','send','echo','back','tone','wet'])take[k].disconnect();take=null;stats.connected--;}
 function pump(){
  const now=ctx.currentTime;
  for(;;){let t=take.start+(take.loops*LOOP+NOTES[take.index].at)*BEAT;
   if(t<now-.25){take.start+=now+.1-t;t=now+.1;}
   if(t>=now+.5)break;
   voice(ctx,take.gain,take.send,noise,t,NOTES[take.index],count);if(++take.index===NOTES.length){take.index=0;take.loops++;stats.loops++;}
  }
 }
 return {
  update(walker,soundOn,yieldTo=false){
   target=soundOn&&!yieldTo?room.soundLevel(walker):0;
   wanted=target>0;
   if(wanted&&!ctx){if(navigator.userActivation?.hasBeenActive===false)return;build();}
   if(!ctx)return;
   if(wanted&&!document.hidden&&ctx.state==='suspended')ctx.resume().catch(()=>{});
   fade.gain.setTargetAtTime(target,ctx.currentTime,.25);
   if(wanted&&!take)open();
   if(take&&!wanted&&fade.gain.value<.0005)close();
   if(take&&wanted&&ctx.state==='running'&&!document.hidden)pump();
  },
  // Whether any of it is audible now (the lounge music waits for this to clear).
  get audible(){return !!ctx&&fade.gain.value>.003;},
  // For tests: what is playing.
  get debug(){return ctx?{state:ctx.state,target,fade:fade.gain.value,master:master.gain.value,voices:count.live,...stats}:{state:'none',target,fade:0,master:MASTER,voices:0,...stats};},
  rms(){if(!analyser)return 0;const d=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(d);let s=0;for(const x of d)s+=x*x;return Math.sqrt(s/d.length);},
 };
}
