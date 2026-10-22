// The ship's sound aboard: a low hum of air and engines, and now and then a soft two-note chime, as on a liner's
// address system. All of it is made here with Web Audio, so there are no sound files. It starts off; the Sound button
// turns it on (browsers only play sound after a click or key), and the choice is remembered for the next visit.
const KEY='leo-walk-sound';
const saved=()=>{try{return localStorage.getItem(KEY)==='1';}catch{return false;}};
const save=on=>{try{localStorage.setItem(KEY,on?'1':'0');}catch{}};

export function createAmbience(){
 let ctx=null,master=null,timer=0,on=saved();
 function build(){
  ctx=new (window.AudioContext||window.webkitAudioContext)();
  master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  // Air handling: two seconds of brown noise, looped, low-passed to a soft rush.
  const n=ctx.sampleRate*2,buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);let b=0;
  for(let i=0;i<n;i++){b=(b+.02*(Math.random()*2-1))/1.02;d[i]=b*3.5;}
  const air=ctx.createBufferSource();air.buffer=buf;air.loop=true;
  const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=320;
  const airGain=ctx.createGain();airGain.gain.value=.5;air.connect(low).connect(airGain).connect(master);air.start();
  // The engines far aft: two low tones a fifth apart that swell very slowly.
  for(const [f,g,rate] of [[48,.09,.05],[72,.04,.031]]){
   const o=ctx.createOscillator();o.frequency.value=f;const v=ctx.createGain();v.gain.value=g;
   const lfo=ctx.createOscillator();lfo.frequency.value=rate;const depth=ctx.createGain();depth.gain.value=g*.5;
   lfo.connect(depth).connect(v.gain);o.connect(v).connect(master);o.start();lfo.start();
  }
 }
 // A "ding dong": two bell-like notes, each a sine with a quieter octave above, fading over a second and a half.
 function chime(){
  if(!ctx||!on||ctx.state!=='running')return;
  const t=ctx.currentTime;
  [[659.3,0],[523.3,.55]].forEach(([f,delay])=>{for(const [m,g] of [[1,.05],[2,.012]]){
   const o=ctx.createOscillator();o.frequency.value=f*m;const v=ctx.createGain();
   v.gain.setValueAtTime(0,t+delay);v.gain.linearRampToValueAtTime(g,t+delay+.02);v.gain.exponentialRampToValueAtTime(.0001,t+delay+1.6);
   o.connect(v).connect(master);o.start(t+delay);o.stop(t+delay+1.7);}});
 }
 // The next chime comes 40 to 100 s later.
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{chime();schedule();},40000+Math.random()*60000);};
 function apply(){
  if(!on){if(ctx){master.gain.setTargetAtTime(0,ctx.currentTime,.3);clearTimeout(timer);}return;}
  if(!ctx)build();ctx.resume();master.gain.setTargetAtTime(.6,ctx.currentTime,.8);schedule();
 }
 // Turned on last visit: it waits for the first click or key on the page.
 // Pressing Sound itself is left to toggle.
 if(on){const start=e=>{removeEventListener('pointerdown',start);removeEventListener('keydown',start);if(!e.target.closest?.('#sound'))apply();};
  addEventListener('pointerdown',start);addEventListener('keydown',start);}
 // A hidden tab goes quiet.
 document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden)ctx.suspend();else if(on)ctx.resume();});
 return {
  get on(){return on;},
  toggle(){on=!on;save(on);apply();if(on)setTimeout(chime,900);return on;},
  chime,
 };
}
