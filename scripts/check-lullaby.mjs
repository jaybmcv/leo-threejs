// The Hammock Dome's lullaby (src/walk/lullaby.js, feedback-inbox #165), played with a fake Web Audio context: it must
// play only inside the dome with the Sound button on, fade out on leaving or when Sound is turned off, and play its
// tune on a steady beat from the start each time someone goes in.
import {createLullaby} from '../src/walk/lullaby.js';

const problems=[],log=(...a)=>console.log(...a);
const expect=(ok,what)=>{if(!ok)problems.push(what);log(ok?'ok  ':'FAIL',what);};

// Just enough of Web Audio for the module: parameters record their automation, oscillators record when they start.
const contexts=[];
class Param{constructor(v=0){this.value=v;this.events=[];}
 setValueAtTime(v,t){this.events.push(['set',v,t]);return this;}
 exponentialRampToValueAtTime(v,t){this.events.push(['exp',v,t]);return this;}
 setTargetAtTime(v,t,c){this.events.push(['target',v,t,c]);this.target=v;return this;}}
class Node{constructor(){this.frequency=new Param();this.gain=new Param(1);}
 connect(to){return to;}
 start(t){this.started=t;}
 stop(t){this.stopped=t;}}
class FakeContext{
 constructor(){this.currentTime=0;this.state='running';this.destination=new Node();this.oscillators=[];this.gains=[];contexts.push(this);}
 createOscillator(){const o=new Node();this.oscillators.push(o);return o;}
 createGain(){const g=new Node();this.gains.push(g);return g;}
 resume(){this.state='running';return Promise.resolve();}
 suspend(){this.state='suspended';return Promise.resolve();}
}
globalThis.window={AudioContext:FakeContext};
globalThis.document={hidden:false,addEventListener(){}};

// The dome's centre on its floor and its radius, as lounge.js gives them in the world (Deck 17, Neighborhood 1).
const dome={centre:{x:-90,y:24.3,z:-25},r:6.5};
const inside={x:-90.3,y:24.3,z:-25.8},outside={x:-70,y:24.3,z:-25},above={x:-90,y:31.5,z:-25};
const FRAME=1/60;
// One frame per step: the module sees the clock as it is, then the clock moves on.
const frames=(lul,at,sound,seconds)=>{for(let i=0;i<Math.round(seconds/FRAME);i++){lul.update(at,sound);if(contexts[0])contexts[0].currentTime+=FRAME;}};
const started=()=>contexts[0].oscillators.filter(o=>o.started!==undefined);
// The output's gain is the first gain made (the rest are one per partial).
const out=()=>contexts[0].gains[0].gain;

// Outside the dome, or inside with Sound off, nothing is made or played.
{contexts.length=0;const lul=createLullaby(dome);
 frames(lul,outside,true,2);frames(lul,above,true,2);
 expect(contexts.length===0,'outside the dome, with Sound on, nothing is made');
 frames(lul,inside,false,2);
 expect(contexts.length===0,'inside the dome with Sound off, nothing is made');}

// Going in with Sound on: the tune starts 0.3 s later, on a steady beat, in the piano's range.
{contexts.length=0;const lul=createLullaby(dome);
 frames(lul,inside,true,1);
 const first=started();
 expect(first.length>0,'inside with Sound on, the tune plays');
 const start=Math.min(...first.map(o=>o.started));
 expect(Math.abs(start-.3)<1e-9,'the tune starts 0.3 s after going in');
 const frequencies=first.map(o=>o.frequency.value);
 expect(frequencies.every(f=>f>=60&&f<=4000),'every partial is in the piano range (60 to 4000 Hz)');
 // Its first beat: E5 (659.3 Hz) over C3 (130.8 Hz).
 expect(first.some(o=>Math.abs(o.frequency.value-659.26)<.1&&Math.abs(o.started-.3)<1e-9),'the first note is E5 on the first beat');
 expect(first.some(o=>Math.abs(o.frequency.value-130.81)<.1&&Math.abs(o.started-.3)<1e-9),'the bass is C3 under it on the first beat');
 frames(lul,inside,true,40);
 // One loop is 32 beats at 66 BPM, about 29.1 s: the thirty notes of the loop, four partials each.
 const loop=started().filter(o=>o.started<.3+32*60/66-1e-6);
 expect(loop.length===30*4,`one loop of the tune is 30 notes (${loop.length/4} notes, 4 partials each)`);
 expect(out().target===.8,'the output fades up to full while inside');}

// Leaving: the tune fades out and nothing new is started once the walker is out.
{contexts.length=0;const lul=createLullaby(dome);
 frames(lul,inside,true,3);
 frames(lul,outside,true,1);
 const before=started().length;
 expect(out().target===0,'leaving the dome fades the tune out');
 frames(lul,outside,true,5);
 expect(started().length===before,'after leaving, no new notes start');
 // Back in: the tune begins again from its first bar.
 frames(lul,inside,true,1);
 expect(started().length>before,'going back in starts the tune again');}

// Sound turned off while inside: the tune fades out at once.
{contexts.length=0;const lul=createLullaby(dome);
 frames(lul,inside,true,2);
 frames(lul,inside,false,1);
 expect(out().target===0,'turning Sound off while inside fades the tune out');}

log(problems.length?`${problems.length} problem(s)`:'Lullaby checks passed.');
process.exit(problems.length?1:0);
