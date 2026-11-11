// Captain Says (server/captain-says.mjs, CAPTAIN_SAYS.md): the page's side of the crowd game of copying the captain's
// moves. A visitor joins from the Aboard sheet (the button this adds to its row); from then a small panel at the top of
// the view shows the countdown to a game, each call in large letters with a bar running down its time, whether they are
// still in, out (watching to the end) or a winner, and how many are left. The call is a button too, which does the move
// as its key would, so a phone needs neither the emote sheet nor a prone key in the second or two it has. The panel never
// takes the keyboard from the walk: the call's button does not keep focus, or Space for the next jump would press it.
//   live(): the Leo live link or null;  move(mv): do a move (main.js);  key(mv): the key that does it, or '' (none, or a
//   touch screen);  row: where the join button goes (the Aboard sheet's row);  close(): close the sheet it is in.
const CSS=`
#captain{position:fixed;left:50%;top:104px;transform:translateX(-50%);z-index:6;width:min(380px,calc(100vw - 24px));box-sizing:border-box;display:grid;gap:8px;padding:10px 12px 12px;text-align:center;background:var(--surface);border:1px solid var(--hairline);border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.35);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
#captain[hidden],#captain [hidden]{display:none!important}
#captain .head{display:flex;align-items:center;gap:8px;font:400 10px/1.2 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
#captain .head b{font-weight:500;color:var(--orange)}#captain .info{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#captain .leave{background:none;border:1px solid var(--hairline);border-radius:999px;padding:5px 10px;font:400 10px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}#captain .leave:hover{border-color:var(--orange);color:var(--text)}
#captain .call{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:center;gap:2px 10px;background:none;border:0;padding:0;color:var(--text);font:inherit}
#captain .call:disabled{cursor:default}#captain .call:not(:disabled):hover .move{color:var(--orange)}
#captain .says{font:500 13px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--teal)}
#captain .move{font:600 34px/1.05 var(--display);letter-spacing:-.02em;overflow-wrap:anywhere}
#captain .call kbd{align-self:center;display:inline-grid;place-items:center;min-width:24px;height:24px;padding:0 7px;border-radius:7px;background:rgba(255,255,255,.08);border:1px solid var(--hairline);font:500 11px/1 var(--mono);color:var(--text)}
#captain .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}#captain .bar div{height:100%;background:var(--orange);transform-origin:left}
#captain .line{margin:0;font:400 13px/1.35 var(--sans);color:var(--body);overflow-wrap:anywhere}#captain .line:empty{display:none}
#captain.out .move,#captain.done .move{color:var(--dim)}#captain.won{border-color:var(--teal)}#captain.won .move{color:var(--teal)}
#aboard-cs{background:var(--orange);border:1px solid var(--orange);color:#fff;border-radius:10px;padding:10px 14px;font:500 11px/1 var(--mono);letter-spacing:.04em}#aboard-cs.on{background:none;border-color:var(--hairline);color:var(--text)}#aboard-cs[hidden]{display:none}
html.cs-on #join{top:250px}
@media (pointer:coarse) and (max-width:560px),(pointer:coarse) and (orientation:landscape) and (max-width:950px) and (max-height:500px){
#captain{top:calc(56px + env(safe-area-inset-top,0px));left:calc(8px + env(safe-area-inset-left,0px));right:calc(104px + env(safe-area-inset-right,0px));width:auto;transform:none;gap:6px;padding:8px 10px 10px}
#captain .move{font-size:24px}#captain .says{font-size:11px}#captain .line{font-size:12px}html.cs-on #join{top:200px}
}
@media (pointer:coarse) and (orientation:landscape) and (max-width:950px) and (max-height:500px){#captain{left:calc(176px + env(safe-area-inset-left,0px));right:calc(188px + env(safe-area-inset-right,0px))}}`;
// Each call as the panel words it, and as a reason for going out ("You didn't ... in time").
export const WORDS={stand:'Stand up',crouch:'Crouch',prone:'Lie flat',jump:'Jump',dance:'Dance',box:'Box',spell:'Cast a spell',play_dead:'Play dead'};
const label=mv=>WORDS[mv]||String(mv).replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
const secs=ms=>Math.max(0,Math.ceil(ms/1000))+' s';
// A server from before Captain Says never answers a join: after NO_ANSWER_MS the panel says so, and goes.
const NO_ANSWER_MS=5000,NOTE_MS=4000;
const num=(n,d=0)=>Number.isFinite(n)?n:d;

export function createCaptainSays({live,move,key=()=>'',row=null,close=()=>{},doc=globalThis.document,now=()=>performance.now()}){
 if(!doc.getElementById('captain-css'))doc.head.appendChild(Object.assign(doc.createElement('style'),{id:'captain-css',textContent:CSS}));
 const box=Object.assign(doc.createElement('div'),{id:'captain',hidden:true});box.setAttribute('role','region');box.setAttribute('aria-label','Captain Says');
 box.innerHTML='<div class="head"><b>Captain Says</b><span class="info"></span><button class="leave" type="button">Leave</button></div><button class="call" type="button" hidden><span class="says"></span><span class="move" aria-live="polite"></span><kbd hidden></kbd></button><div class="bar" hidden><div></div></div><p class="line"></p>';
 doc.body.appendChild(box);
 const $=s=>box.querySelector(s),info=$('.info'),callEl=$('.call'),says=$('.says'),moveEl=$('.move'),kbd=$('kbd'),bar=$('.bar'),fill=$('.bar div'),line=$('.line');
 const entry=Object.assign(doc.createElement('button'),{type:'button',id:'aboard-cs',hidden:true});row?.prepend(entry);
 // phase: off (not joined), joining, lost (the link dropped), or the server's idle, lobby, call, judged, over. call: the
 // open call; wasIn: this visitor was in before the latest judging; until: when the countdown shown runs out; lineOf():
 // the line under it, said again each tick while it counts down.
 let joined=false,phase='off',call=null,you=null,wasIn=false,until=0,lineOf=null,ticking=0,quiet=0;
 // Neither button keeps focus once pressed (the walk's keys go on reaching the walk).
 for(const b of [callEl,$('.leave'),entry])b.addEventListener('mousedown',e=>e.preventDefault());
 callEl.onclick=()=>{callEl.blur();if(phase==='call'&&you==='in'&&call)move(call.mv);};
 $('.leave').onclick=()=>leave();
 entry.onclick=()=>{close();if(joined)leave();else join();};

 function refresh(){entry.hidden=!live()?.live&&!joined;entry.textContent=joined?'Leave Captain Says':'Play Captain Says';entry.classList.toggle('on',joined);}
 function show(){box.hidden=!joined;doc.documentElement.classList.toggle('cs-on',joined);refresh();}
 function tick(){if(lineOf){const t=lineOf(Math.max(0,until-now()));if(line.textContent!==t)line.textContent=t;}if(!lineOf||!joined){clearInterval(ticking);ticking=0;}}
 function counting(ms,fn){until=now()+ms;lineOf=fn;if(!ticking)ticking=setInterval(tick,250);tick();}
 function still(text){lineOf=null;line.textContent=text;}
 // The bar runs down over ms, by a transition (nothing to draw each frame); none when ms is 0.
 function runBar(ms){bar.hidden=!(ms>0);if(bar.hidden)return;fill.style.transition='none';fill.style.transform='scaleX(1)';void fill.offsetWidth;fill.style.transition=`transform ${ms}ms linear`;fill.style.transform='scaleX(0)';}
 function big(text,saysText='',keyText='',active=false){callEl.hidden=!text;moveEl.textContent=text;says.textContent=saysText;says.hidden=!saysText;kbd.textContent=keyText;kbd.hidden=!keyText;callEl.disabled=!active;}
 function look(kind){box.className=kind||'';}

 function waiting(msg){
  look('');info.textContent=msg.s==='lobby'?`${num(msg.n)} playing`:`${num(msg.n,1)} joined`;
  if(msg.s==='idle'){big('');runBar(0);still('Waiting for one more player. Anyone aboard can join from the Aboard list.');return;}
  const ms=Math.max(0,num(msg.ms));big('Get ready');runBar(ms);
  counting(ms,left=>`Copy each move, but only when the call starts “Captain says”. First call in ${secs(left)}.`);
 }
 function called(msg){
  call={mv:String(msg.mv),cs:msg.cs===true};you=msg.you;wasIn=you==='in';
  look(you==='in'?'':'out');info.textContent=`Round ${num(msg.r)} · ${num(msg.n)} of ${num(msg.of)} in`;
  big(label(call.mv)+'!',call.cs?'Captain says':'',you==='in'?key(call.mv):'',you==='in');runBar(Math.max(0,num(msg.ms)));
  still(you==='in'?'':you==='out'?'You’re out · watching to the end':'Watching · you’ll play in the next game');
 }
 function judged(msg){
  you=msg.you;callEl.disabled=true;runBar(0);info.textContent=`Round ${num(msg.r)} · ${num(msg.n)} left`;
  const o=num(msg.o),gone=o?`${o} out this round`:'Nobody out this round';
  if(you==='in')still(`Still in! ${gone}. Next call coming…`);
  else if(wasIn&&call)still(call.cs?`You’re out: you didn’t ${label(call.mv).toLowerCase()} in time.`:'You’re out: the captain didn’t say so!');
  else still(`${gone} · ${num(msg.n)} left`);
  look(you==='in'?'done':'out');wasIn=you==='in';call=null;
 }
 function over(msg){
  you=msg.you;call=null;const wn=num(msg.wn),w=Array.isArray(msg.w)?msg.w.filter(n=>typeof n==='string'):[];
  const names=w.join(', ')+(wn>w.length?` and ${wn-w.length} more`:'');
  look(you==='won'?'won':'done');info.textContent=`Game over · ${num(msg.r)} rounds`;
  big(you==='won'?(wn>1?'You share the win!':'You won!'):wn===1&&w[0]?`${w[0]} wins!`:wn?`${wn} share the win`:'Nobody won');
  const ms=Math.max(0,num(msg.ms));runBar(ms);
  counting(ms,left=>(wn>1?`Winners: ${names}. `:'')+`Next game in ${secs(left)}, if two are joined.`);
 }

 function join(){
  if(joined)return;if(!live()?.cs('join')){refresh();return;}
  joined=true;asking();
 }
 // Asked to join (again, after the link came back): no answer means a server without the game.
 function asking(){
  phase='joining';look('');info.textContent='';big('');runBar(0);still('Joining…');show();
  clearTimeout(quiet);quiet=setTimeout(()=>{if(phase!=='joining')return;still('Captain Says isn’t on this ship’s server yet.');quiet=setTimeout(()=>{if(phase==='joining')leave(false);},NOTE_MS);},NO_ANSWER_MS);
 }
 function leave(tell=true){if(!joined)return;if(tell)live()?.cs('leave');joined=false;phase='off';call=null;lineOf=null;clearTimeout(quiet);show();}
 return {
  get joined(){return joined;},get phase(){return phase;},
  join,leave,refresh,
  // A message from Leo live (only while joined; one still on its way after leaving is let go).
  fromServer(msg){
   if(!joined||!['idle','lobby','call','judged','over'].includes(msg.s))return;
   phase=msg.s;clearTimeout(quiet);show();
   if(phase==='idle'||phase==='lobby')waiting(msg);else if(phase==='call')called(msg);else if(phase==='judged')judged(msg);else over(msg);
  },
  // The link dropped: the server has let this visitor go; when it is back (back), they join again.
  lost(){if(!joined)return;phase='lost';call=null;look('');info.textContent='';big('');runBar(0);still('Lost the link to Leo live. You’ll rejoin when it’s back.');},
  back(){if(joined&&live()?.cs('join'))asking();},
 };
}
