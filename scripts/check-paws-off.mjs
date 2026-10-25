// Paws Off's rules (src/walk/paws-off/rules.js), played headless: the ramp of prompt lengths, timers and belt speed,
// typing and stumbling, running out of time, the touch pad, the same seed dealing the same prompts, and typists of
// three speeds running until they fall, so a typical run ends within about a minute.
import {newGame,step,press,pad,lengthAt,limitAt,beltAt,CHARS,STUMBLE} from '../src/walk/paws-off/rules.js';

const problems=[],log=(...a)=>console.log(...a);
const expect=(ok,what)=>{if(!ok)problems.push(what);log(ok?'ok  ':'FAIL',what);};

{const g=newGame(1);expect(g.prompt.length===1&&CHARS.includes(g.prompt)&&!g.over&&g.left===limitAt(1,0),'a new run: one character and its full timer');}

// The ramp: longer prompts, less time for each character, a faster belt.
{const lens=[0,12,30,45,60,80].map(lengthAt);expect(lens.join()==='1,2,3,4,5,6',`prompts grow from one character to six (${lens})`);
 const per=[0,30,60].map(t=>limitAt(lengthAt(t),t)/lengthAt(t));expect(per[0]>per[1]&&per[1]>per[2],`each character gets less time as the run goes on (${per.map(v=>v.toFixed(2))} s)`);
 expect(beltAt(0)<beltAt(30)&&beltAt(30)<beltAt(60)&&beltAt(600)===8,`the belt speeds up and tops out (${beltAt(0)}, ${beltAt(30).toFixed(1)}, ${beltAt(60).toFixed(1)} m/s)`);}

// Typing the prompt deals the next one; a wrong key costs time but not progress.
{const g=newGame(2);g.t=15;g.prompt='AB';g.typed=0;g.left=2;
 const a=press(g,'a'),wrong=press(g,'Z'),left=g.left,b=press(g,'B');
 expect(a==='hit'&&wrong==='miss'&&Math.abs(left-(2-STUMBLE))<1e-9&&b==='done'&&g.cleared===1&&g.typed===0&&g.prompt.length===lengthAt(15),'letters in either case count, a wrong key stumbles, the last one deals a new prompt');
 expect(press(g,'Shift')===null,'keys that are not one character are ignored');}

// Out of time, the run is over and keys do nothing.
{const g=newGame(3);step(g,limitAt(1,0)+.01);expect(g.over&&press(g,g.prompt)===null,'a prompt left too long ends the run');}

// No character twice in a row, so a held key never clears two.
{const g=newGame(4);g.t=80;let twice=false;for(let i=0;i<200;i++){g.typed=0;for(const c of g.prompt){g.left=9;press(g,c);}for(let k=1;k<g.prompt.length;k++)if(g.prompt[k]===g.prompt[k-1])twice=true;}
 expect(!twice,'no prompt repeats a character back to back');}

// The touch pad holds the prompt's characters and decoys, without moving the game's own sequence.
{const a=newGame(5),b=newGame(5);a.t=b.t=50;pad(a);const keys=pad(a,8);
 expect(keys.length===8&&new Set(keys).size===8&&[...a.prompt].every(c=>keys.includes(c)),`the pad: the prompt's characters and decoys (${keys.join('')} for ${a.prompt})`);
 for(const c of a.prompt)press(a,c);for(const c of b.prompt)press(b,c);expect(a.prompt===b.prompt,'the pad leaves the prompts as they were');}

// The same seed deals the same prompts.
{const seen=s=>{const g=newGame(s),out=[];for(let i=0;i<30;i++){out.push(g.prompt);for(const c of g.prompt)press(g,c);step(g,1.5);g.over=false;}return out.join(' ');};
 expect(seen(77)===seen(77)&&seen(77)!==seen(78),'the same seed deals the same prompts, another seed others');}

// Typists run until they fall: each reads a prompt, then types at their own pace, now and then hitting a wrong key.
function typist(seed,{react,perChar,slip}){
 const g=newGame(seed);let r=seed*7919;const rand=()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return r/4294967296;};
 const dt=1/60;let wait=react;
 while(!g.over&&g.t<600){step(g,dt);if(g.over)break;wait-=dt;
  if(wait<=0){const want=g.prompt[g.typed],before=g.cleared;
   press(g,rand()<slip?CHARS[(CHARS.indexOf(want)+1)%CHARS.length]:want);wait=g.cleared>before?react:perChar;}}
 return g.t;
}
const runs=(kind,o)=>{const ts=Array.from({length:20},(_,i)=>typist(i+1,o)).sort((a,b)=>a-b);return {kind,median:ts[10],max:ts[19]};};
const slow=runs('slow',{react:.75,perChar:.5,slip:.06}),typical=runs('typical',{react:.55,perChar:.36,slip:.04}),fast=runs('fast',{react:.4,perChar:.22,slip:.02});
for(const r of [slow,typical,fast])log(`     ${r.kind} typist: median ${r.median.toFixed(1)} s, longest ${r.max.toFixed(1)} s`);
expect(slow.median<typical.median&&typical.median<fast.median,'faster typists last longer');
expect(typical.median>30&&typical.median<75,`a typical run ends within about a minute (median ${typical.median.toFixed(1)} s)`);
expect(fast.max<180,`even a fast, careful typist falls within three minutes (longest ${fast.max.toFixed(1)} s)`);

if(problems.length){console.error(`\n${problems.length} Paws Off check(s) failed`);process.exit(1);}
console.log('\nPaws Off rules check passed');
