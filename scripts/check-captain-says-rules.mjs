// Captain Says's rules (server/captain-says.mjs), with no server: what a pose counts as; the judging of every kind of
// call from a player's state at it and their poses since; the calls dealt over many games; the time each round gives;
// whole games on a stand-in clock with stand-in visitors (waiting alone, the countdown, a pose in the slack after a
// call and one after it, a pose in the grace before one, a trick, joining late, leaving, a shared win, the last rounds,
// a thousand players); and the wiring in every copy of the server and the page. Quick, and in npm run check; the real
// server with sockets is check-captain-says.mjs, which runs this first.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {mock} from 'node:test';
import {judge,note,fresh,graced,stateOf,pickCall,callMs,createCaptainSays,MOVES,STANCE_CALLS,CALL_MS,CALL_STEP_MS,CALL_FLOOR_MS,JUDGE_SLACK_MS,
 CALL_GRACE_MS,PAUSE_MS,WAIT_MS,COUNT_MS,WINNERS_SHOWN,MOST_ROUNDS} from '../server/captain-says.mjs';
import {WORDS} from '../src/walk/captain-says.js';
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};

// A state; whether a player stays in after the states their poses showed since the call.
const S=(st='stand',e=null,jc=0)=>({st,e,jc});
const stays=(mv,cs,before,...since)=>judge({mv,cs},before,since.reduce(note,fresh(before)));

assert.deepEqual(stateOf({stance:'slide',emote:null,jumpCount:0}),S('crouch'));
assert.deepEqual(stateOf({stance:'prone',emote:'dance',jumpCount:2}),S('prone','dance',2));assert.deepEqual(stateOf({}),S());
pass('a pose counts as its stance (a slide as the crouch it settles into), its emote and its jump count');

assert(stays('crouch',true,S(),S('crouch'))&&!stays('crouch',true,S())&&!stays('crouch',true,S(),S('prone')),'crouch');
assert(!stays('crouch',true,S(),S('crouch'),S()),'crouched, then stood again before the judging');
assert(stays('crouch',true,S('crouch'))&&stays('prone',true,S('prone')),'a stance already taken is done as it stands');
assert(stays('prone',true,S(),S('crouch'),S('prone')),'prone, by way of a crouch');
assert(stays('stand',true,S('crouch'),S())&&stays('stand',true,S('prone'),S('crouch'),S())&&!stays('stand',true,S('prone')),'stand up');
assert(stays('stand',true,S())&&stays('stand',true,S('stand','dance')),'standing all along, or dancing, is standing');
pass('"Captain says" a stance: in when it is the stance at the judging (one already taken counts), out otherwise');

assert(stays('jump',true,S(),S('stand',null,1))&&stays('jump',true,S(),S('stand',null,1),S()),'jumped, and landed before the judging');
assert(!stays('jump',true,S())&&!stays('jump',true,S('stand',null,1),S()),'no jump; in the air at the call and only landed');
assert(stays('jump',true,S('stand',null,1),S('stand',null,2))&&stays('jump',true,S('stand',null,1),S(),S('stand',null,1)),'a jump from the air, or after landing');
pass('"Captain says" jump: in when the jump count rose since the call (landing is not a jump)');

assert(stays('dance',true,S(),S('stand','dance'))&&stays('dance',true,S('stand','dance')),'dancing, or dancing already');
assert(!stays('dance',true,S())&&!stays('dance',true,S(),S('stand','box'))&&!stays('play_dead',true,S(),S('stand','play_dead'),S()),'another emote, or one ended');
pass('"Captain says" an emote: in when it is the emote at the judging');

assert(stays('crouch',false,S())&&stays('stand',false,S('crouch'),S('crouch')),'held still, or stayed down through "Stand up!"');
assert(!stays('crouch',false,S(),S('crouch'))&&!stays('crouch',false,S(),S('prone'))&&!stays('stand',false,S('crouch'),S()),'the move, another stance, rising too soon');
assert(!stays('crouch',false,S(),S('crouch'),S()),'a moment\'s crouch counts though they stood again');
assert(!stays('dance',false,S(),S('stand',null,1),S())&&!stays('jump',false,S(),S('stand','box')),'a jump, or a new emote, on any trick');
assert(stays('box',false,S('stand','dance'),S())&&!stays('box',false,S('stand','dance'),S('stand','box')),'an emote ending as they walk on is no move; a new one is');
pass('a trick (no "Captain says"): out for any move since the call (a stance, a new emote, a jump), however brief');

// Calls over many games, from a seeded random (mulberry32).
const seeded=seed=>()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
{const random=seeded(7),seen=new Map(),trickAt=new Set();
 for(let g=0;g<2000;g++){let prev=null,trick=0;const tricks=[];
  for(let r=1;r<=12;r++){
   const out=pickCall(r,prev,trick,random),c=out.call;trick=out.trick;if(!c.cs)tricks.push(r);
   assert.notEqual(c.mv,prev?.mv,'the same move twice running');
   if(c.mv==='stand')assert(prev.cs&&['crouch','prone'].includes(prev.mv),'Stand up! after anything but the captain saying crouch or prone');else assert(MOVES.includes(c.mv),c.mv);
   seen.set(c.mv,(seen.get(c.mv)||0)+1);prev=c;
  }
  assert(tricks.length===3&&tricks[0]>=2&&tricks[0]<=4&&tricks[1]>=5&&tricks[1]<=8&&tricks[2]>=9,`tricks at ${tricks}`);for(const t of tricks)trickAt.add(t);
 }
 assert.deepEqual([...trickAt].sort((a,b)=>a-b),[2,3,4,5,6,7,8,9,10,11,12]);for(const m of [...MOVES,'stand'])assert(seen.get(m)>500,m+' called '+seen.get(m));
 pass(`calls in 2000 games: one trick in each four rounds and never the first, no move twice running, "Stand up!" only after the captain said crouch or prone, every move called (stand ${seen.get('stand')} times, the rest ${Math.min(...MOVES.map(m=>seen.get(m)))} or more)`);}

{const floorAt=Array.from({length:60},(_,i)=>i+1).find(r=>callMs(r)===CALL_FLOOR_MS);
 assert.deepEqual([callMs(1),callMs(2),callMs(MOST_ROUNDS)],[CALL_MS,CALL_MS-CALL_STEP_MS,CALL_FLOOR_MS]);for(let r=1;r<60;r++)assert(callMs(r+1)<=callMs(r)&&callMs(r)>=CALL_FLOOR_MS);
 assert.deepEqual([CALL_MS,CALL_FLOOR_MS,JUDGE_SLACK_MS,CALL_GRACE_MS,PAUSE_MS,WAIT_MS],[4000,1500,400,250,2000,10000]);
 pass(`a call gives 4 s, ${CALL_STEP_MS/1000} s less each round, 1.5 s from round ${floorAt} on; judged ${JUDGE_SLACK_MS} ms after; ${PAUSE_MS/1000} s between calls; a ${WAIT_MS/1000} s countdown, and result`);}

// In the grace after a call: on "Captain says jump!" a jump counts (a quick player jumping at once stays in); on a trick,
// or any other call, what came in the grace is where they stood at the call.
{
 const at={st:'stand',e:null,jc:3},jumpedNow={st:'stand',e:null,jc:4};
 const g1=graced({mv:'jump',cs:true},at,jumpedNow);assert.ok(judge({mv:'jump',cs:true},g1.before,g1.seen),'a jump in the grace counts');
 const g2=graced({mv:'crouch',cs:false},at,jumpedNow);assert.ok(judge({mv:'crouch',cs:false},g2.before,g2.seen),'a jump in the grace of a trick does not count against');
 const g3=graced({mv:'crouch',cs:true},at,{st:'crouch',e:null,jc:3});assert.ok(judge({mv:'crouch',cs:true},g3.before,g3.seen),'a crouch in the grace is done');
 const g4=graced({mv:'jump',cs:true},at,at);assert.ok(!judge({mv:'jump',cs:true},g4.before,g4.seen),'no jump, not done');
 pass('in the grace after a call: a quick jump on "Captain says jump!" counts; on a trick what came in the grace is where they stood');
}
// Whole games on a stand-in clock. With random() always 0 the calls go: "Captain says crouch", then a trick "Stand up!",
// "Captain says crouch", "Captain says stand up", a trick "Crouch!", ... (pickCall).
mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:1_000_000});
// (in steps of 10 ms: a timer's callback reads the clock at the end of the tick that fired it)
const tick=ms=>{for(let t=0;t<ms;t+=10)mock.timers.tick(Math.min(10,ms-t));};
try{
 const told=new Map(),logged=[],auto=new Set();
 const visitor=name=>{const v={id:name.toLowerCase().padEnd(8,'x'),name,ready:true};told.set(v,[]);return v;};
 const said=v=>told.get(v),last=v=>said(v).at(-1);
 let cs;
 const pose=(v,stance='stand',emote=null,jumpCount=0)=>cs.observe(v,{stance,emote,jumpCount});
 // A player who always gets it right (auto), half a second after the call reaches them.
 const right=(v,c)=>{if(!c.cs)return;if(STANCE_CALLS.includes(c.mv))pose(v,c.mv);else if(c.mv==='jump'){pose(v,'stand',null,1);setTimeout(()=>pose(v),400);}else pose(v,'stand',c.mv);};
 const make=(random=()=>0)=>createCaptainSays({log:(...a)=>logged.push(a.join(' ')),random,send:(v,text)=>{const m=JSON.parse(text);said(v).push(m);if(m.s==='call'&&m.you==='in'&&auto.has(v))setTimeout(()=>right(v,m),500);}});
 cs=make();
 const join=v=>cs.message(v,{m:'cs',e:'join'}),leave=v=>cs.message(v,{m:'cs',e:'leave'});
 const ann=visitor('Ann'),bob=visitor('Bob'),cat=visitor('Cat'),dan=visitor('Dan'),eve=visitor('Eve'),nobody=visitor('Nobody');

 join(ann);assert.deepEqual(last(ann),{m:'cs',s:'idle',n:1});tick(WAIT_MS*2);assert.equal(cs.phase,'idle');pose(nobody,'crouch');
 join(bob);assert.deepEqual([last(ann),last(bob)],[{m:'cs',s:'lobby',ms:WAIT_MS,n:2},{m:'cs',s:'lobby',ms:WAIT_MS,n:2}]);
 join(cat);join(dan);leave(dan);const heard=said(ann).length;assert.deepEqual(last(cat),{m:'cs',s:'lobby',ms:WAIT_MS,n:3});
 tick(COUNT_MS);assert.equal(said(ann).length,heard+1,'one count a second');assert.deepEqual(last(ann),{m:'cs',s:'lobby',ms:WAIT_MS-COUNT_MS,n:3});
 pass('alone, a visitor waits; the second to join opens the countdown; later ones hear it at once, the rest a new count within a second');

 tick(WAIT_MS-COUNT_MS);const call1={m:'cs',s:'call',r:1,mv:'crouch',cs:true,ms:CALL_MS,n:3,of:3,you:'in'};
 for(const v of [ann,bob,cat])assert.deepEqual(last(v),call1);assert.equal(last(dan).s,'lobby','Dan left: told nothing more');
 tick(500);pose(ann,'crouch');tick(CALL_MS-500+JUDGE_SLACK_MS-50);pose(cat,'crouch');tick(50);
 assert.deepEqual([last(ann),last(bob),last(cat)].map(m=>[m.s,m.r,m.n,m.o,m.you]),[['judged',1,2,1,'in'],['judged',1,2,1,'out'],['judged',1,2,1,'in']]);
 pass('the game starts with everyone joined: Ann crouches and stays in, Bob does nothing and is out, Cat\'s pose in the slack after the call counts');

 join(eve);assert.deepEqual(last(eve),{m:'cs',s:'judged',r:1,n:2,o:1,you:'watch'});
 tick(PAUSE_MS);assert.deepEqual([last(ann).mv,last(ann).cs,last(eve).you,last(bob).you],['stand',false,'watch','out']);
 tick(CALL_GRACE_MS-50);pose(cat);tick(600);pose(ann);tick(callMs(2));
 assert.deepEqual(last(cat),{m:'cs',s:'over',r:2,wn:1,w:['Cat'],you:'won',ms:WAIT_MS});assert.deepEqual([last(ann).you,last(bob).you,last(eve).you],['lost','lost','watch']);
 assert.equal(said(nobody).length,0,'never joined: never told');assert.match(logged[0],/^captain says game 1: 3 players, 2 rounds, won by catxxxxx$/);
 pass('joined mid-game, Eve watches; on the trick "Stand up!" Ann rises and is out, Cat (who stood within the grace before the call reached her) stays and wins; one log line');

 tick(WAIT_MS);assert.deepEqual(last(eve),{m:'cs',s:'lobby',ms:WAIT_MS,n:4});tick(WAIT_MS);assert.equal(last(eve).you,'in');
 tick(500);pose(ann,'crouch');pose(bob,'crouch');leave(eve);const eveHeard=said(eve).length;tick(callMs(1)-500+JUDGE_SLACK_MS+10);pose(cat,'crouch');
 assert.deepEqual([last(ann).n,last(ann).o,last(cat).you],[2,1,'out'],'Cat crouched after the judging: too late');
 tick(PAUSE_MS+600);pose(ann);pose(bob);tick(callMs(2));
 assert.deepEqual([last(ann).s,last(ann).wn,last(ann).w,last(ann).you,last(bob).you,last(cat).you],['over',2,['Ann','Bob'],'won','won','lost']);
 assert.equal(said(eve).length,eveHeard,'Eve left mid-game: told nothing more');assert.match(logged[1],/^captain says game 2: 4 players, 2 rounds, won by annxxxxx bobxxxxx$/);
 pass('the next game opens with everyone still joined; a pose after the judging is too late; Eve leaves mid-call and is gone; Ann and Bob both rise on the trick and share the win');

 tick(WAIT_MS*2);assert.equal(last(cat).s,'call');leave(bob);leave(cat);assert.deepEqual([last(ann).s,last(ann).wn,last(ann).you],['over',1,'won']);
 tick(WAIT_MS);assert.deepEqual(last(ann),{m:'cs',s:'idle',n:1});join(bob);assert.equal(last(ann).s,'lobby');leave(bob);assert.deepEqual(last(ann),{m:'cs',s:'idle',n:1});
 tick(WAIT_MS*2);assert.equal(cs.phase,'idle');leave(ann);
 pass('the others leaving mid-call leaves Ann the winner; alone after it, she waits; a countdown left by all but one stops');

 cs=make(seeded(3));auto.add(ann);auto.add(bob);told.set(ann,[]);join(ann);join(bob);tick(WAIT_MS);for(let i=0;i<MOST_ROUNDS*8&&last(ann).s!=='over';i++)tick(1000);
 assert.deepEqual([last(ann).s,last(ann).r,last(ann).wn,last(ann).you,last(bob).you],['over',MOST_ROUNDS,2,'won','won']);leave(ann);leave(bob);
 const calls=said(ann).filter(m=>m.s==='call');assert.deepEqual([...new Set(calls.map(m=>m.mv))].sort(),[...MOVES,'stand'].sort());assert.equal(calls.filter(m=>!m.cs).length,MOST_ROUNDS/4);
 pass(`two who never slip share the win after ${MOST_ROUNDS} rounds, through every move there is and ${MOST_ROUNDS/4} tricks`);

 // A thousand players: a few messages each, the same few strings for all, and the judging quick.
 told.clear();auto.clear();const texts=[];let sends=0;
 const crowd=Array.from({length:1000},(_,i)=>visitor('P'+i));
 cs=createCaptainSays({random:()=>0,send:(v,text)=>{sends++;texts.push(text);}});
 for(const v of crowd)join(v);tick(WAIT_MS-1);const waiting=sends;assert(waiting<=crowd.length*2+2,`${waiting} messages to a thousand joining together`);tick(1);
 const call=texts.at(-1);assert.equal(new Set(texts.slice(-crowd.length)).size,1);assert(call.length<120,call);
 tick(500);crowd.slice(0,600).forEach(v=>pose(v,'crouch'));texts.length=0;tick(callMs(1)-500+JUDGE_SLACK_MS-10);const t0=process.hrtime.bigint();tick(10);const ms=Number(process.hrtime.bigint()-t0)/1e6;
 assert.equal(new Set(texts).size,2);assert.equal(JSON.parse(texts[0]).n,600);assert(ms<100,`judging took ${ms} ms`);
 tick(PAUSE_MS+500);crowd.slice(0,600).forEach(v=>pose(v));texts.length=0;tick(callMs(2));
 const over=JSON.parse(texts[0]);assert.equal(over.wn,600);assert.equal(over.w.length,WINNERS_SHOWN);assert(texts[0].length<400,texts[0]);
 pass(`a thousand players: ${waiting} messages to all joining at once and counting down, one string for a call (${call.length} bytes), judged in ${ms.toFixed(1)} ms; 600 sharing a win name ${WINNERS_SHOWN} (${texts[0].length} bytes)`);
}finally{mock.timers.reset();}

// Wiring: every server copy and every page the same way; the emotes called are ones every page has, and every call has words.
for(const f of ['live-core','live-core.authoring','live-core.prepared','live-core.public']){const s=await fs.readFile(`server/${f}.mjs`,'utf8');
 for(const piece of ["import {createCaptainSays} from './captain-says.mjs';",'captainSays.observe(v,pose);','captainSays.left(v);',"case 'cs':if(visitors.has(v)&&(msg.e==='leave'||allowed(v,'cs')))captainSays.message(v,msg);break;",'BUDGETS.cs=[1,4]','LEO_LIVE_CS_WAIT_S'])assert(s.includes(piece),f+': '+piece);}
for(const f of ['main','main.authoring','main.prepared','main.public']){const s=await fs.readFile(`src/walk/${f}.js`,'utf8');
 for(const piece of ["import {createCaptainSays} from './captain-says.js';",'captainSays=createCaptainSays({live:()=>live,move:captainMove,key:captainKey,','cs:msg=>captainSays?.fromServer(msg)','captainSays?.lost();','captainSays?.back();','captainSays?.refresh();','function captainMove(mv){','function captainKey(mv){'])assert(s.includes(piece),f+': '+piece);}
{const s=await fs.readFile('src/walk/net/live.js','utf8');assert(s.includes("case 'cs':if(typeof msg.s==='string')on.cs?.(msg);break;")&&s.includes("cs(e){if(!live())return false;ws.send(JSON.stringify({m:'cs',e}));return true;}"));}
{const emotes=[...(await fs.readFile('src/walk/vr/cosmoEmotes.ts','utf8')).matchAll(/^\s+(\w+): \{/gm)].map(m=>m[1]);
 for(const m of MOVES.filter(m=>!STANCE_CALLS.includes(m)&&m!=='jump'))assert(emotes.includes(m),m+' is not an emote the page has');
 for(const m of [...MOVES,'stand'])assert(WORDS[m],m+' has no words on the page');}
for(const f of ['help','help.authoring'])assert((await fs.readFile(`src/walk/${f}.js`,'utf8')).includes('Captain Says: Play Captain Says in the Aboard list'),f);
pass('all four server copies and all four pages are wired the same way; the emotes called are the page\'s own; every call has its words; Help explains it');
console.log(`check-captain-says-rules: ${checks} checks passed`);
