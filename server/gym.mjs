// Paws Off's gym rounds (PAWS_OFF.md, stage 2): the treadmills' shared runs. Leo live (leo-live.mjs) passes the game's
// messages here. A visitor stepping onto a treadmill (the Deck 16 exercise studio's six or the arcade's) asks to join;
// the first opens a short countdown and everyone who asks before it ends is in it. When it ends, those still on a
// treadmill (their pose says they are playing) run together: one prompt seed for all, so everyone types the same
// prompts on the same ramp. Each page says when its runner fell and how long they lasted; once everyone is out, every
// runner hears the ranked results and their place. Someone stepping off or leaving the ship mid-round is out there and
// then, listed after those who fell.
//
// Rounds live in memory only and are forgotten once their results are sent: there is no leaderboard (typing is too
// easy to script), only each round's results and each browser's own best.
//
// Messages from a page, {m:'gym', e, ...}:
//   in                       stepped onto a treadmill: join the countdown (opening one if none is running)
//   fell, round, t, cleared  fell off after t seconds on the belt, with this many prompts typed
//   off                      stepped off (Esc) before falling
// and to it:
//   wait, round, ms, n       in the countdown: the run starts in ms, with n runners so far
//   go, round, seed, runners the run starts now, with this seed; runners: [{id, name}]
//   cancel                   the countdown ended without them on a treadmill (or the round is full): run alone
//   out, round, id, t, how, running   a runner is out ('fell' or 'left'), with this many still running
//   results, round, ranks    everyone is out: [{id, name, t, how, place}], best first
const LOBBY_MS=6000,READY_MS=3000,LONGEST_MS=12000,ROUND_MS=180000,MOST=12;

export function createGym({log,send,now=Date.now,canPlay=()=>true}){
 let lobby=null,next=1;
 const rounds=new Map();
 const nameOf=v=>v.name||null;
 const tell=(r,msg)=>{for(const v of r.runners.keys())if(v.ready)send(v.ws,msg);};

 // The countdown: opened by the first to step on, its end pushed back a little for a late joiner so they still get the
 // belt's 3-2-1, but never past LONGEST_MS from its opening.
 function join(v){
  if(lobby&&v.gym===lobby){send(v.ws,{m:'gym',e:'wait',round:lobby.id,ms:Math.max(0,lobby.ends-now()),n:lobby.runners.size});return;}
  out(v,'left');
  if(!lobby){lobby={id:next++,runners:new Map(),opened:now(),ends:now()+LOBBY_MS,timer:null};schedule();}
  else if(lobby.runners.size>=MOST){send(v.ws,{m:'gym',e:'cancel'});return;}
  else if(lobby.ends-now()<READY_MS){lobby.ends=Math.max(lobby.ends,Math.min(now()+READY_MS,lobby.opened+LONGEST_MS));schedule();}
  lobby.runners.set(v,{id:v.id,name:nameOf(v),t:null,how:null});v.gym=lobby;
  const msg={m:'gym',e:'wait',round:lobby.id,ms:Math.max(0,lobby.ends-now()),n:lobby.runners.size};tell(lobby,msg);
 }
 function schedule(){clearTimeout(lobby.timer);const l=lobby;l.timer=setTimeout(()=>start(l),Math.max(0,l.ends-now()));}
 // The countdown ends: those on a treadmill run, with one seed.
 function start(r){
  if(lobby!==r)return;lobby=null;
  for(const v of [...r.runners.keys()])if(!v.ready||!v.playing||!canPlay(v.pos)){r.runners.delete(v);if(v.gym===r)v.gym=null;if(v.ready)send(v.ws,{m:'gym',e:'cancel'});}
  if(!r.runners.size)return;
  Object.assign(r,{seed:(Math.random()*2**31)|0,at:now(),running:true});rounds.set(r.id,r);
  const runners=[...r.runners.values()].map(({id,name})=>({id,name}));
  tell(r,{m:'gym',e:'go',round:r.id,seed:r.seed,runners});
  r.timer=setTimeout(()=>{for(const v of r.runners.keys())out(v,'left',r);},ROUND_MS);
  log('gym round',r.id,'runners',runners.length);
 }
 // A runner out of their round: fell (with the time their page says, never more than the round has run) or left.
 function out(v,how,r=v.gym,t){
  if(!r)return;
  if(!r.running){if(r===lobby&&r.runners.delete(v)){v.gym=null;if(!r.runners.size){clearTimeout(r.timer);lobby=null;}else tell(r,{m:'gym',e:'wait',round:r.id,ms:Math.max(0,r.ends-now()),n:r.runners.size});}return;}
  const e=r.runners.get(v);if(!e||e.how)return;
  const ran=(now()-r.at)/1000;
  e.how=how;e.t=Math.round(Math.max(0,Math.min(how==='fell'&&Number.isFinite(t)?t:ran,ran+.5))*10)/10;
  if(v.gym===r)v.gym=null;
  const running=[...r.runners.values()].filter(x=>!x.how).length;
  tell(r,{m:'gym',e:'out',round:r.id,id:e.id,t:e.t,how,running});
  if(!running)finish(r);
 }
 // Everyone out: the ranked results, those who fell by time on the belt, then those who left. Then it is forgotten.
 function finish(r){
  clearTimeout(r.timer);rounds.delete(r.id);
  const order=[...r.runners.values()].sort((a,b)=>(a.how==='left')-(b.how==='left')||b.t-a.t);
  const ranks=order.map(({id,name,t,how},i)=>({id,name,t,how,place:i+1}));
  tell(r,{m:'gym',e:'results',round:r.id,ranks});
  log('gym results',r.id,ranks.map(x=>`${x.place}. ${x.id} ${x.t}s${x.how==='left'?' (left)':''}`).join(', '));
 }

 return {
  message(v,msg){
   if(msg.e==='in')join(v);
   else if(msg.e==='fell'){const r=rounds.get(msg.round);if(r&&r.runners.has(v))out(v,'fell',r,typeof msg.t==='number'?msg.t:NaN);}
   else if(msg.e==='off')out(v,'left');
  },
  // Gone from the ship (or the connection lost): out of their countdown or round.
  left(v){out(v,'left');},
  get rounds(){return rounds.size;},
 };
}
