// Paws Off's rules (PAWS_OFF.md): a typing run on a Deck 16 treadmill. The belt speeds up and the prompts grow
// from one character to several; type each one before its timer runs out or Cosmo goes off the back. Plain state and
// time steps, no drawing, so Node can check it (scripts/check-paws-off.mjs) and a later shared round can give everyone
// the same seed and so the same prompts.
// Letters and digits that can't be mistaken for each other (no O/0, I/1/L).
export const CHARS='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
// Prompt length by seconds on the belt: one character, then two, three and so on up to six.
const LENGTHS=[[10,1],[25,2],[40,3],[55,4],[70,5]];
export const lengthAt=t=>(LENGTHS.find(([until])=>t<until)||[0,6])[1];
// The time a prompt gives: a moment to read it plus a share per character, the share shrinking as the run goes on.
export const READ=.6,perCharAt=t=>Math.max(.2,1.1-t/60*.75),limitAt=(len,t)=>READ+len*perCharAt(t);
// A wrong key is a stumble: it costs this much of the prompt's time.
export const STUMBLE=.35;
// The belt's speed in m/s, for Cosmo's stride and the belt's scroll.
export const beltAt=t=>Math.min(8,1.8+t*.07);

const random=seed=>{let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};};

export function newGame(seed=1){
 const g={seed,next:random(seed),t:0,prompt:'',typed:0,left:0,limit:0,cleared:0,misses:0,over:false};
 deal(g);return g;
}
// The next prompt, from the game's own sequence: the same seed deals the same prompts.
function deal(g){
 const len=lengthAt(g.t);let s='';
 while(s.length<len){const c=CHARS[Math.floor(g.next()*CHARS.length)];if(c!==s.at(-1))s+=c;}
 g.prompt=s;g.typed=0;g.limit=g.left=limitAt(len,g.t);
}
// Time passes on the belt; a prompt whose timer runs out ends the run.
export function step(g,dt){
 if(g.over)return g;
 g.t+=dt;g.left-=dt;
 if(g.left<=0){g.left=0;g.over=true;}
 return g;
}
// A key typed: 'hit' (the next character), 'done' (the prompt's last; a new one is dealt), 'miss', or null once over.
export function press(g,key){
 if(g.over||typeof key!=='string'||key.length!==1)return null;
 if(key.toUpperCase()===g.prompt[g.typed]){
  g.typed++;if(g.typed<g.prompt.length)return 'hit';
  g.cleared++;deal(g);return 'done';
 }
 g.misses++;g.left=Math.max(0,g.left-STUMBLE);if(g.left===0)g.over=true;return 'miss';
}
// Keys for a touch screen: the prompt's characters and decoys, `n` in all, in an order that changes with each prompt
// but never touches the game's own sequence.
export function pad(g,n=8){
 const r=random(g.seed^(g.cleared+1)*2654435761),keys=[...new Set(g.prompt)];
 while(keys.length<n){const c=CHARS[Math.floor(r()*CHARS.length)];if(!keys.includes(c))keys.push(c);}
 for(let i=keys.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[keys[i],keys[j]]=[keys[j],keys[i]];}
 return keys;
}
