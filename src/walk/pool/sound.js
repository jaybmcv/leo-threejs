// Paw Pool's sound, synthesized like Alien Cat Invasion's: the kick, balls clicking (louder for harder hits), the
// cushion, a ball dropping, the cue ball dropping, a fresh rack and the cleared table. Nothing is loaded. `muted()`
// follows the walk's Sound toggle.
export function createSound(muted=()=>false){
 let ctx=null,master=null,lastClick=0;
 const ready=()=>{
  if(muted())return null;
  if(!ctx){const A=globalThis.AudioContext||globalThis.webkitAudioContext;if(!A)return null;ctx=new A();master=ctx.createGain();master.gain.value=.3;master.connect(ctx.destination);}
  if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx;
 };
 function tone(type,freq,len,gain=.5,at=0){
  const c=ready();if(!c)return;const t=c.currentTime+at,o=c.createOscillator(),g=c.createGain();o.type=type;
  if(Array.isArray(freq)){o.frequency.setValueAtTime(freq[0],t);o.frequency.exponentialRampToValueAtTime(freq[1],t+len);}else o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g).connect(master);o.start(t);o.stop(t+len+.02);
 }
 function noise(len,gain=.5,from=4000,to=300,at=0){
  const c=ready();if(!c)return;const t=c.currentTime+at,buf=c.createBuffer(1,Math.ceil(c.sampleRate*len),c.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=buf;f.type='lowpass';f.frequency.setValueAtTime(from,t);f.frequency.exponentialRampToValueAtTime(to,t+len);
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.001,t+len);s.connect(f).connect(g).connect(master);s.start(t);
 }
 return {
  kick(power){tone('sine',[140,50],.18,.5+power*.4);noise(.06,.25+power*.3,1800,200);},
  rack(){[0,.05,.1,.16].forEach(at=>noise(.05,.18,3500,900,at));},
  // The step's events from rules.js.
  play(events){
   for(const e of events){
    if(e.startsWith('click')){const now=performance.now();if(now-lastClick<30)continue;lastClick=now;const v=Math.min(1,+e.slice(6)/10);tone('triangle',[2200,1400],.05,.08+v*.4);}
    else if(e==='cushion')tone('sine',[180,90],.12,.25);
    else if(e==='pot'){tone('sine',[320,120],.25,.35);noise(.25,.2,1200,150,.05);}
    else if(e==='scratch')[330,262].forEach((f,i)=>tone('square',f,.16,.18,i*.14));
    else if(e==='clear')[523,659,784,1046,1318].forEach((f,i)=>tone('triangle',f,.16,.32,i*.09));
   }
  },
 };
}
