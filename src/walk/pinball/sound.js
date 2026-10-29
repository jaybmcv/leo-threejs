// Pinball's sound, synthesized like Paw Pool's: flipper clacks, the plunger, pop bumpers, slingshots, drop targets,
// the lanes, the saucer, a saved ball, a drained one and game over. Nothing is loaded. `muted()` follows the walk's
// Sound toggle.
export function createSound(muted=()=>false){
 let ctx=null,master=null,lastWall=0;
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
 const SOUNDS={
  flip:()=>{noise(.05,.35,2500,400);tone('square',[160,90],.05,.12);},
  launch:()=>{noise(.18,.4,1800,200);tone('sine',[220,520],.2,.2);},
  wall:()=>{const now=performance.now();if(now-lastWall<40)return;lastWall=now;tone('triangle',[900,500],.04,.12);},
  bumper:()=>{tone('square',[620,310],.09,.22);noise(.04,.2,5000,1500);},
  sling:()=>{tone('sawtooth',[300,160],.07,.18);noise(.03,.2,3000,800);},
  lane:()=>tone('triangle',[880,1320],.1,.25),
  lanes:()=>[660,880,1100,1320].forEach((f,i)=>tone('triangle',f,.12,.28,i*.07)),
  drop:()=>{tone('square',[220,110],.08,.2);noise(.05,.25,1500,300);},
  bank:()=>[523,784,1046].forEach((f,i)=>tone('square',f,.14,.18,i*.08)),
  saucer:()=>{tone('sine',[400,90],.35,.35);noise(.3,.18,900,120,.05);},
  kick:()=>{noise(.08,.35,2200,300);tone('sine',[120,300],.1,.25);},
  saved:()=>[784,988,1175].forEach((f,i)=>tone('triangle',f,.12,.25,i*.09)),
  drain:()=>tone('sawtooth',[300,70],.6,.22),
  over:()=>[392,330,262,196].forEach((f,i)=>tone('triangle',f,.25,.25,.5+i*.22)),
 };
 return {
  // The step's events from rules.js.
  play(events){for(const e of new Set(events))SOUNDS[e]?.();},
 };
}
