// The Anti-Gravity Hammock Dome's lullaby (feedback-inbox #165): an original slow tune on a soft synthesised piano, made
// with Web Audio as the ship's sounds are (ambience.js), so there are no sound files. It plays only while the Sound
// button is on and the walker is inside the dome, fading in as they go in and out as they leave. Each visitor hears
// only their own; nothing is sent over Leo live.
// `dome` is {centre, r}: the dome's centre on its floor in the world, and its radius (lounge.js).
const BEAT=60/66,BAR=4;
// The tune: eight bars in C major, each a list of [MIDI note, beats], and the bass note under each bar.
const BARS=[
 [[76,2],[74,1],[72,1]],
 [[69,1],[72,2],[76,1]],
 [[77,2],[76,1],[74,1]],
 [[74,2],[67,2]],
 [[72,2],[76,1],[79,1]],
 [[81,3],[79,1]],
 [[81,2],[77,1],[74,1]],
 [[64,1],[67,1],[60,2]],
];
const BASS=[48,45,41,43,48,45,41,43];
const LOOP=BARS.length*BAR;
// Every note as {at: the beat it starts on within the loop, m: MIDI note, n: beats it lasts, bass}, in time order.
const NOTES=[];
BARS.forEach((bar,i)=>{let b=i*BAR;for(const [m,n] of bar){NOTES.push({at:b,m,n});b+=n;}NOTES.push({at:i*BAR,m:BASS[i],n:BAR,bass:true});});
NOTES.sort((a,b)=>a.at-b.at);
// A piano's partials: each one's multiple of the note's pitch, its share of the loudness and how long it rings compared
// with the fundamental (the higher partials die away first).
const PARTIALS=[[1,1,1],[2,.28,.45],[3,.09,.25],[4,.035,.15]];
const RING=2.2; // seconds a note keeps ringing after its length
const pitch=m=>440*2**((m-69)/12);

export function createLullaby(dome){
 let ctx=null,out=null,wanted=false,playing=false,level=0,startT=0,ei=0,loops=0;
 function build(){
  ctx=new (window.AudioContext||window.webkitAudioContext)();
  out=ctx.createGain();out.gain.value=0;out.connect(ctx.destination);
  // A hidden tab goes quiet, as the ship's hum does.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else if(wanted)ctx.resume();});
 }
 // One struck note: a sine for each partial, each swelling in quickly and dying away at its own rate.
 function strike(t,{m,n,bass}){
  const g=bass?.07:.11,tail=RING+n*BEAT;
  for(const [k,share,ring] of PARTIALS){
   const o=ctx.createOscillator(),v=ctx.createGain(),end=t+.01+tail*ring;
   o.frequency.value=pitch(m)*k;
   v.gain.setValueAtTime(1e-4,t);v.gain.exponentialRampToValueAtTime(g*share,t+.008);v.gain.exponentialRampToValueAtTime(1e-4,end);
   o.connect(v).connect(out);o.start(t);o.stop(end+.05);
  }
 }
 // Notes are queued half a second ahead of the audio clock, so a slow frame does not make the tune stutter.
 function pump(){
  const now=ctx.currentTime,horizon=now+.5;
  for(;;){
   let t=startT+(loops*LOOP+NOTES[ei].at)*BEAT;
   if(t<now-.25){startT+=now+.1-t;t=now+.1;} // a stalled frame: pick the tune up from here, not in a burst
   if(t>=horizon)break;
   strike(t,NOTES[ei]);
   if(++ei===NOTES.length){ei=0;loops++;}
  }
 }
 return {
  // `walker` is the walker's feet in the world; soundOn is the Sound button.
  update(walker,soundOn){
   const inside=soundOn&&Math.abs(walker.y-dome.centre.y)<dome.r&&Math.hypot(walker.x-dome.centre.x,walker.z-dome.centre.z)<dome.r;
   if(inside&&!ctx){if(navigator.userActivation?.hasBeenActive===false)return;build();}
   if(!ctx)return;
   wanted=inside;
   if(inside&&ctx.state==='suspended')ctx.resume().catch(()=>{});
   // Going in starts the tune from its first bar.
   if(inside&&!playing){startT=ctx.currentTime+.3;ei=0;loops=0;}
   playing=inside;
   if(inside&&ctx.state==='running')pump();
   const target=inside?.8:0;
   if(target!==level){level=target;out.gain.setTargetAtTime(target,ctx.currentTime,target?.8:.5);}
  },
 };
}
