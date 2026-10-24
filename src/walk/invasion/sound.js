// Alien Cat Invasion's sound, synthesized: Leo's shot, a hit, the formation's four-note march (it quickens with the
// march), the mothership's warble while it crosses, a lost life, the extra life and a new wave. Nothing is loaded.
// `muted()` follows the walk's Sound toggle.
const MARCH=[98,87,82,73];
export function createSound(muted=()=>false){
 let ctx=null,master=null,ufo=null;
 const ready=()=>{
  if(muted())return null;
  if(!ctx){const A=globalThis.AudioContext||globalThis.webkitAudioContext;if(!A)return null;ctx=new A();master=ctx.createGain();master.gain.value=.22;master.connect(ctx.destination);}
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx;
 };
 // A tone: type, frequency (or [from, to] for a sweep), length in seconds, loudness.
 function tone(type,freq,len,gain=.5,at=0){
  const c=ready();if(!c)return;const t=c.currentTime+at,o=c.createOscillator(),g=c.createGain();o.type=type;
  if(Array.isArray(freq)){o.frequency.setValueAtTime(freq[0],t);o.frequency.exponentialRampToValueAtTime(freq[1],t+len);}else o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g).connect(master);o.start(t);o.stop(t+len+.02);
 }
 function noise(len,gain=.5,from=4000,to=300){
  const c=ready();if(!c)return;const t=c.currentTime,buf=c.createBuffer(1,Math.ceil(c.sampleRate*len),c.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=buf;f.type='lowpass';f.frequency.setValueAtTime(from,t);f.frequency.exponentialRampToValueAtTime(to,t+len);
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+len);s.connect(f).connect(g).connect(master);s.start(t);
 }
 function mothership(on){
  if(!on){if(ufo){ufo.stop();ufo=null;}return;}
  const c=ready();if(!c||ufo)return;const o=c.createOscillator(),lfo=c.createOscillator(),depth=c.createGain(),g=c.createGain();
  o.type='square';o.frequency.value=520;lfo.frequency.value=8;depth.gain.value=90;g.gain.value=.07;lfo.connect(depth).connect(o.frequency);o.connect(g).connect(master);o.start();lfo.start();
  ufo={stop(){try{o.stop();lfo.stop();}catch{}}};
 }
 return {
  // The step's events from rules.js.
  play(events){
   for(const e of events){
    if(e==='shoot')tone('square',[880,220],.12,.25);
    else if(e==='hit')noise(.18,.4,3000,400);
    else if(e.startsWith('march'))tone('square',MARCH[+e.slice(5)],.09,.45);
    else if(e==='mother')mothership(true);
    else if(e==='motherhit'){mothership(false);tone('square',[300,1200],.35,.3);}
    else if(e==='die'){noise(.9,.6,2000,80);mothership(false);}
    else if(e==='extra')[523,659,784,1046].forEach((f,i)=>tone('triangle',f,.12,.35,i*.08));
    else if(e==='wave')[392,523,659].forEach((f,i)=>tone('triangle',f,.14,.3,i*.1));
    else if(e==='over'){mothership(false);[392,330,262,196].forEach((f,i)=>tone('square',f,.22,.3,i*.18));}
   }
  },
  // The mothership left the screen without being hit.
  quiet(){mothership(false);},
  stop(){mothership(false);},
 };
}
