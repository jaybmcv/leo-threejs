// Every walk sound keeps a direct path when the frog is idle. Only the local visitor owns these nodes.
const outputs=new Map();let running=false,amount=0,hum=null;
function chain(ctx,input){
 const nodes=[],oscillators=[],node=n=>(nodes.push(n),n),gain=v=>{const g=node(ctx.createGain());g.gain.value=v;return g;};
 const dry=gain(1),wet=gain(0),pitch=node(ctx.createDelay(.1)),drift=node(ctx.createOscillator()),depth=gain(0);
 pitch.delayTime.value=.025;drift.frequency.value=.13;drift.connect(depth).connect(pitch.delayTime);drift.start();oscillators.push(drift);
 input.disconnect();input.connect(dry).connect(ctx.destination);input.connect(pitch);
 let last=pitch;
 for(const f of [230,530,1100]){const filter=node(ctx.createBiquadFilter());filter.type='allpass';filter.frequency.value=f;last.connect(filter);last=filter;const sweep=gain(f*.65);drift.connect(sweep).connect(filter.frequency);}
 const flange=node(ctx.createDelay(.05));flange.delayTime.value=.008;const sweep=gain(.003);drift.connect(sweep).connect(flange.delayTime);last.connect(wet);last.connect(flange).connect(wet);
 const echo=node(ctx.createDelay(1)),feedback=gain(.32);echo.delayTime.value=.38;last.connect(echo).connect(feedback).connect(echo);echo.connect(wet);
 const reverb=node(ctx.createConvolver()),buffer=ctx.createBuffer(2,Math.floor(ctx.sampleRate*1.8),ctx.sampleRate);
 for(let c=0;c<2;c++){const a=buffer.getChannelData(c);let seed=391+c;for(let i=0;i<a.length;i++){seed=(seed*1664525+1013904223)>>>0;a[i]=(seed/2147483648-1)*Math.pow(1-i/a.length,3)*.38;}}
 reverb.buffer=buffer;last.connect(reverb).connect(wet);wet.connect(ctx.destination);
 return {set(v){const t=ctx.currentTime;dry.gain.setTargetAtTime(1-v*.2,t,.025);wet.gain.setTargetAtTime(v*.55,t,.025);depth.gain.setTargetAtTime(v*.0018,t,.025);},dispose(){input.disconnect();input.connect(ctx.destination);oscillators.forEach(o=>o.stop());nodes.forEach(n=>n.disconnect());}};
}
export function walkAudioOutput(ctx){
 let out=outputs.get(ctx);if(!out){const input=ctx.createGain();input.connect(ctx.destination);out={input,effect:null};outputs.set(ctx,out);if(running){out.effect=chain(ctx,input);out.effect.set(amount);}}
 return out.input;
}
export function startFrogAudio(){
 if(running)return;running=true;amount=0;
 for(const [ctx,out] of outputs)if(ctx.state!=='closed')out.effect=chain(ctx,out.input);
 const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
 if(Audio){const ctx=new Audio(),gain=ctx.createGain(),tones=[];gain.gain.value=0;gain.connect(ctx.destination);
  for(const f of [55,110.35,165.2]){const o=ctx.createOscillator();o.type='sine';o.frequency.value=f;o.connect(gain);o.start();tones.push(o);}
  ctx.resume().catch(()=>{});hum={ctx,gain,tones};}
}
export function setFrogAudio(v){
 amount=v;for(const out of outputs.values())out.effect?.set(v);
 if(hum)hum.gain.gain.setTargetAtTime(v*.018,hum.ctx.currentTime,.06);
}
export function stopFrogAudio(){
 running=false;amount=0;
 for(const [ctx,out] of outputs){out.effect?.dispose();out.effect=null;if(ctx.state==='closed')outputs.delete(ctx);}
 if(hum){hum.tones.forEach(o=>{o.stop();o.disconnect();});hum.gain.disconnect();hum.ctx.close().catch(()=>{});hum=null;}
}
export function frogAudioState(){return {active:running,amount,chains:[...outputs.values()].filter(o=>o.effect).length,hum:!!hum};}
