// Captain Says (CAPTAIN_SAYS.md): Simon Says for everyone aboard. Leo live (live-core.mjs) passes the game's messages
// here, and every pose of a visitor who has joined. Anyone aboard may join, wherever they are on the ship; once two have,
// a countdown of waitMs opens, and everyone joined when it ends plays. Each round the captain calls a move: a stance
// (stand, crouch, prone), a jump, or one of a few emotes every page offers (src/walk/avatar.js EMOTES). Most calls begin
// "Captain says"; one round in each four is a trick, without it. A player has the call's time to do the move (CALL_MS at
// first, CALL_STEP_MS less each round, never under CALL_FLOOR_MS), and is judged JUDGE_SLACK_MS after that from the poses
// the server has had, so a pose that left its page in time and was slow on the way still counts. On a "Captain says"
// call a player not doing the move is out (a jump: their jump count rose since the call); on a trick, one who moved (a
// stance, a new emote or a jump since the call) is. The last one in wins; when all those left go out in one round, they
// share the win. Those out, and anyone who joined once the game had begun, watch it to its end; the result shows for
// waitMs, and then the next game opens if two are still joined. Leaving the ship leaves the game.
//
// Poses are trusted, as everywhere aboard: this is a party game with no prize. Games live in memory only. Messages go
// only to those joined, and come in at most three forms each (a game may have a thousand players): all that differs
// from one player to the next is whether they are in, out or watching.
//
// From a page, {m:'cs', e}:  join · leave
// To the joined, {m:'cs', s, ...}:
//   idle, n                            waiting for a second player; n joined
//   lobby, ms, n                       the game starts in ms; n joined
//   call, r, mv, cs, ms, n, of, you    round r: the move mv, said by the captain (cs true) or a trick; ms to do it in;
//                                      n of `of` still in; you: in, out or watch
//   judged, r, n, o, you               round r judged: n still in, o went out in it
//   over, r, wn, w, you, ms            over after r rounds, won by wn players (w: the first WINNERS_SHOWN names); you:
//                                      won, lost or watch; the next game can open in ms
export const WAIT_MS=10000,CALL_MS=4000,CALL_STEP_MS=250,CALL_FLOOR_MS=1500,JUDGE_SLACK_MS=400,CALL_GRACE_MS=250,PAUSE_MS=2000,
 MOST_ROUNDS=40,WINNERS_SHOWN=8,MIN_PLAYERS=2,COUNT_MS=1000;
// The moves called: stances, a jump, and emotes that read at a glance from across a room. 'stand' is called only after
// the captain said crouch or prone (pickCall).
export const STANCE_CALLS=['stand','crouch','prone'],MOVES=['crouch','prone','jump','dance','box','spell','play_dead'];
const STILL={st:'stand',e:null,jc:0};

// The time a round's call gives, in ms.
export const callMs=r=>Math.max(CALL_FLOOR_MS,CALL_MS-CALL_STEP_MS*(r-1));
// A pose's part in the game (readPose in live-core.mjs): its stance (a slide is a crouch, which it settles into), its
// emote and its jump count.
export const stateOf=p=>({st:p.stance==='slide'?'crouch':p.stance||'stand',e:p.emote||null,jc:p.jumpCount||0});
// What a player has done since the call, starting from their state at it.
export const fresh=s=>({...s,jumped:false,moved:false});
// One more pose since the call: the state it shows, and whether the player jumped (their jump count rose: landing
// lowers it) or moved at all (a stance, a new emote, a jump) at any pose so far. A moment's crouch counts though they
// are back up by the judging; an emote ending as they walk on does not.
export function note(seen,s){
 const jumped=s.jc>seen.jc;
 return {...s,jumped:seen.jumped||jumped,moved:seen.moved||jumped||s.st!==seen.st||(!!s.e&&s.e!==seen.e)};
}
// Whether a player stays in. call: {mv, cs}; before: their state at the call; now: what note made of their poses since.
// A call of the stance or emote they are already in is done as it stands.
export function judge(call,before,now){
 if(!call.cs)return !(now.moved||now.jumped||now.st!==before.st||(!!now.e&&now.e!==before.e));
 if(call.mv==='jump')return now.jumped;
 if(STANCE_CALLS.includes(call.mv))return now.st===call.mv;
 return now.e===call.mv;
}
// Round r's call after the call prev (null in the first round). One round in each four is a trick, drawn as each four
// begins (trick: the round drawn for the four now running), and never the first of a game, so it opens with the
// captain's own words. After the captain says crouch or prone, "Stand up!" comes half the time: it catches those still
// down or, as a trick, those quick to rise. The same move is never called twice running.
export function pickCall(r,prev,trick,random=Math.random){
 if((r-1)%4===0)trick=r===1?2+Math.floor(random()*3):r+Math.floor(random()*4);
 const down=!!prev?.cs&&(prev.mv==='crouch'||prev.mv==='prone'),moves=MOVES.filter(m=>m!==prev?.mv);
 const mv=down&&random()<.5?'stand':moves[Math.floor(random()*moves.length)];
 return {call:{mv,cs:r!==trick},trick};
}

// send(v, text): to one visitor, a message already in JSON. waitMs: the lobby's countdown, and how long a result shows.
export function createCaptainSays({log=()=>{},send,now=()=>Date.now(),random=Math.random,waitMs=WAIT_MS}){
 // joined: everyone playing or waiting to; last: each one's state at their latest pose. shown: the message last told
 // everyone, as a function of each one's part (said again to a newcomer as it is then). One timer runs the game.
 const joined=new Set(),last=new Map();
 let phase='idle',game=null,ends=0,serial=0,timer=0,counting=0,shown=()=>({s:'idle',n:joined.size});
 const later=(ms,fn)=>{clearTimeout(timer);timer=setTimeout(fn,ms);};
 const left=t=>Math.max(0,Math.round(t-now()));
 const text=msg=>JSON.stringify({m:'cs',...msg});
 // A visitor's part: watch (not in this game), in, out, or won once it is over.
 const partOf=v=>{const p=game?.players.get(v);return !p?'watch':p.won?'won':p.out?'out':'in';};
 function say(form){shown=form;const forms={};for(const v of joined)if(v.ready){const k=partOf(v);send(v,forms[k]??=text(form(k)));}}
 // While waiting, a new count reaches everyone at most once every COUNT_MS (a thousand joining at once are not a
 // million messages); the one who joined hears at once.
 function counts(){if(!counting)counting=setTimeout(()=>{counting=0;if(phase==='idle'||phase==='lobby')say(shown);},COUNT_MS);}
 function idle(){phase='idle';game=null;clearTimeout(timer);say(()=>({s:'idle',n:joined.size}));}
 function lobby(){phase='lobby';ends=now()+waitMs;say(()=>({s:'lobby',ms:left(ends),n:joined.size}));later(waitMs,start);}
 function start(){
  const players=[...joined].filter(v=>v.ready);if(players.length<MIN_PLAYERS){idle();return;}
  const entry=v=>[v,{id:v.id,name:v.name||'Voyager '+v.id.slice(-4),out:false,won:false,before:STILL,seen:fresh(STILL)}];
  game={id:++serial,players:new Map(players.map(entry)),alive:players.length,of:players.length,round:0,call:null,prev:null,trick:0,deadline:0,graceUntil:0};
  phase='game';nextCall();
 }
 // A call: each player's state now is what the round is judged against. A pose that comes within CALL_GRACE_MS left its
 // page before the call reached it, so it still counts as before.
 function nextCall(){
  const g=game,r=++g.round,{call,trick}=pickCall(r,g.prev,g.trick,random),ms=callMs(r),t=now();
  Object.assign(g,{call,prev:call,trick,deadline:t+ms,graceUntil:t+CALL_GRACE_MS});
  for(const [v,p] of g.players)if(!p.out){p.before=last.get(v)||STILL;p.seen=fresh(p.before);}
  say(you=>({s:'call',r,mv:call.mv,cs:call.cs,ms:left(g.deadline),n:g.alive,of:g.of,you}));
  later(ms+JUDGE_SLACK_MS,judgeRound);
 }
 function judgeRound(){
  const g=game,{call}=g;g.call=null;
  const out=[...g.players.values()].filter(p=>!p.out&&!judge(call,p.before,p.seen));
  // Everyone left out at once: they share the win.
  if(out.length===g.alive){finish(out);return;}
  for(const p of out)p.out=true;g.alive-=out.length;
  if(g.alive===1||g.round>=MOST_ROUNDS){finish([...g.players.values()].filter(p=>!p.out));return;}
  const r=g.round,n=g.alive,o=out.length;say(you=>({s:'judged',r,n,o,you}));later(PAUSE_MS,nextCall);
 }
 function finish(winners){
  const g=game;g.call=null;phase='over';ends=now()+waitMs;
  const won=new Set(winners);for(const p of g.players.values()){p.won=won.has(p);p.out=!p.won;}
  const r=g.round,wn=winners.length,w=winners.slice(0,WINNERS_SHOWN).map(p=>p.name);
  say(you=>({s:'over',r,wn,w,you:you==='out'?'lost':you,ms:left(ends)}));
  log('captain says',`game ${g.id}:`,`${g.of} players,`,`${r} rounds,`,wn?'won by '+winners.slice(0,WINNERS_SHOWN).map(p=>p.id).join(' ')+(wn>WINNERS_SHOWN?` and ${wn-WINNERS_SHOWN} more`:''):'nobody left to win');
  later(waitMs,()=>{game=null;if([...joined].filter(v=>v.ready).length>=MIN_PLAYERS)lobby();else idle();});
 }
 // Joining: the second to join opens the countdown (and hears it with the first); anyone else hears where things stand.
 function join(v){
  if(!v.ready)return;joined.add(v);
  if(phase==='idle'&&joined.size>=MIN_PLAYERS){lobby();return;}
  send(v,text(shown(partOf(v))));if(phase==='idle'||phase==='lobby')counts();
 }
 // Out of it: a player leaving a game is gone from it, and one left alone in it has won.
 function leave(v){
  if(!joined.delete(v))return;last.delete(v);
  const p=game?.players.get(v);
  if(p&&phase==='game'){game.players.delete(v);if(!p.out&&--game.alive<=1){finish([...game.players.values()].filter(q=>!q.out));return;}}
  if(phase==='lobby'&&joined.size<MIN_PLAYERS)idle();else if(phase==='idle'||phase==='lobby')counts();
 }
 return {
  message(v,msg){if(msg.e==='join')join(v);else if(msg.e==='leave')leave(v);},
  // A pose from anyone joined: their state for the next call, and, while a call is open, what they have done since it.
  observe(v,pose){
   if(!joined.has(v))return;const s=stateOf(pose);last.set(v,s);
   const p=game?.call&&game.players.get(v);if(!p||p.out)return;
   if(now()<game.graceUntil){p.before=s;p.seen=fresh(s);}else p.seen=note(p.seen,s);
  },
  // Gone from the ship (or the connection lost).
  left:leave,
  get phase(){return phase;},get joined(){return joined.size;},
 };
}
