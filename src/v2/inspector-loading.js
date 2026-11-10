// What the home inspector's loading cover shows, as a function of state (no DOM, no three: scripts/check-inspector-loading.mjs).
// The state: which operation owns the view (the last one begun), what that owner is waiting for, and the latest word
// from each loader. The cover shows exactly while the owner waits, with the word for what it waits for. An operation a
// later click superseded can neither show the cover nor leave it up, however late its download reports or finishes.
export function createCover(render,fallback='Assembling Leo'){
 let owner=0,need=null,shown;const said=new Map();
 const sync=()=>{const text=need===null?'':said.get(need)||fallback;if(text!==shown)render(shown=text);};
 return{
  // A new operation takes the view. Whatever the last one was waiting for stops showing at once.
  begin(){owner++;need=null;sync();return owner;},
  owns:token=>token===owner,
  // The owner waits for something: the cover shows that thing's latest word until the wait ends, well or badly.
  async wait(token,what,promise){
   if(token===owner){need=what;sync();}
   try{return await promise;}finally{if(token===owner){need=null;sync();}}
  },
  // Loaders report here whoever asked for them. It reaches the screen only while the owner waits for that thing.
  say(what,text){said.set(what,text);sync();},
 };
}
// One shared run of an async job: callers that arrive while it runs, or after it finished, get the same result.
// A failed run is forgotten, so the next caller tries again.
export function once(job){let run=null;return()=>run||=job().catch(e=>{run=null;throw e;});}
