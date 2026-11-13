import {newGame,step,STEP} from './rules.js';

// Leo Pinball's ranked games (from tester feedback): what the buttons did, step by step, so Leo live can play a game
// again from its seed with the same rules and see its score for itself (server/pinball.mjs). The page writes down each
// change of the buttons: the steps since the last change in base 36, then the buttons now as a letter (A none, then
// 1 left, 2 right, 4 launch added: H all three). A game longer than MOST_S, or a log longer than LOG_MOST, isn't ranked.
export const MOST_S=45*60,MOST_STEPS=Math.round(MOST_S/STEP),LOG_MOST=120000;
const LETTERS='ABCDEFGH';
export const bitsOf=i=>(i.left?1:0)|(i.right?2:0)|(i.launch?4:0);

// The page's side: call step(input) just before each step of the game.
export function recorder(){
 let last=0,bits=0,steps=0,log='';
 return {step(input){const b=bitsOf(input);if(b!==bits){log+=(steps-last).toString(36)+LETTERS[b];last=steps;bits=b;}steps++;},
  get steps(){return steps;},get log(){return log;}};
}

// A log as [steps since the last change, buttons] pairs, or null if it isn't one.
export function decode(log){
 if(typeof log!=='string'||log.length>LOG_MOST||!/^(?:[0-9a-z]{1,6}[A-H])*$/.test(log))return null;
 const out=[];for(const [,d,b] of log.matchAll(/([0-9a-z]+)([A-H])/g))out.push([parseInt(d,36),b.charCodeAt(0)-65]);
 // (only the first change can come at the step the last one did: the very first step)
 return out.every(([d],i)=>i===0||d>0)?out:null;
}

// Plays a logged game again from its seed: {score} when it ends on exactly its last step, else null. pause(), when
// given, is awaited every `every` steps, so a long game doesn't hold the server up.
export async function replay(seed,log,steps,{pause=null,every=20000}={}){
 const changes=decode(log);if(!changes||!Number.isInteger(seed)||!Number.isInteger(steps)||steps<1||steps>MOST_STEPS)return null;
 const g=newGame(seed),input={left:false,right:false,launch:false};
 let k=0,due=changes.length?changes[0][0]:Infinity;
 for(let i=0;i<steps;i++){
  if(pause&&i&&i%every===0)await pause();
  if(i===due){const b=changes[k][1];input.left=!!(b&1);input.right=!!(b&2);input.launch=!!(b&4);k++;due=k<changes.length?i+changes[k][0]:Infinity;}
  if(g.phase!=='play')return null;
  step(g,input);
 }
 return g.phase==='over'&&k===changes.length?{score:g.score}:null;
}
