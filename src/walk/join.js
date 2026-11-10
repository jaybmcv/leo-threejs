// Ask to join (server/joins.mjs): pick someone in the Aboard list and ask to come to where they are; they accept or
// decline. This is the page's side: the asker's waiting bar (with Cancel), the asked visitor's card (Accept, Decline),
// and a short note for each outcome. Nothing here moves anyone: on accept the page is handed where the other one stands
// (land) and finds a safe public floor beside it itself (main.js, public-area.js).
//   live(): the Leo live link or null;  here(): why this visitor cannot be joined where they stand (a restricted area's
//   name from public-area.js, or 'game'), or null;  land(at, name): put this walker beside `at`, true when it could.
// The cards never take the keyboard or the mouse from the walk: with the mouse captured, Esc frees it to click.
const CSS=`
#join{position:fixed;left:50%;top:150px;transform:translateX(-50%);z-index:6;display:flex;flex-direction:column;align-items:center;gap:8px;width:min(420px,calc(100vw - 24px));pointer-events:none}
#join>*{pointer-events:auto;box-sizing:border-box;width:100%;background:var(--surface);border:1px solid var(--hairline);border-radius:14px;padding:10px 12px;font:400 13px/1.4 var(--sans);color:var(--text);box-shadow:0 6px 24px rgba(0,0,0,.35)}
#join .row{display:flex;align-items:center;gap:8px}#join .row span{flex:1;min-width:0;overflow-wrap:anywhere}#join b{font-weight:600}
#join .time{font:400 11px/1 var(--mono);color:var(--dim);min-width:30px;text-align:right}
#join button{border:1px solid var(--hairline);background:none;border-radius:999px;padding:7px 12px;font:400 11px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--text)}
#join button.yes{background:var(--teal);border-color:var(--teal);color:#05211f}#join button:hover{border-color:var(--orange)}
#join .why{margin:6px 0 0;font-size:12px;color:var(--body)}#join .why:empty{display:none}
#join .note{text-align:center;pointer-events:none}
#aboard-list li:has(.join){display:flex;align-items:center;gap:10px}#aboard-list li .who{flex:1;min-width:0}
#aboard-list .join{background:none;border:1px solid var(--hairline);border-radius:999px;padding:6px 10px;font:400 10px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--text);white-space:nowrap}
#aboard-list .join:hover{border-color:var(--orange)}#aboard-list .join:disabled{opacity:.55}`;
// Why the one asked can't be joined where they stand (public-area.js names).
const PLACE={crew:'a crew-only area',clubhouse:'the clubhouse',['lever-panel']:'the tank bay',maze:'the Container Maze',aquarium:'the aquarium',lift:'a lift',game:'a game',invalid:'here'};
const NO={declined:n=>`${n} said no.`,expired:n=>`${n} didn’t answer.`,gone:n=>`${n} left the ship.`,busy:n=>`${n} can’t be joined where they are right now.`,
 again:n=>`${n} said no a moment ago. Try again a little later.`,slow:()=>'That’s a lot of asking. Wait a moment and try again.',unknown:()=>'They’re not aboard any more.',cancelled:()=>''};
const OFF={cancelled:n=>`${n} stopped asking.`,expired:n=>`${n}’s request ran out.`,gone:()=>'',busy:n=>`${n} can’t come to you here: step out to a public spot first.`};
const clock=ms=>Math.max(0,Math.ceil(ms/1000))+'s';

export function createJoin({live,here,land,doc=globalThis.document,now=()=>performance.now()}){
 if(!doc.getElementById('join-css')){const style=doc.createElement('style');style.id='join-css';style.textContent=CSS;doc.head.appendChild(style);}
 const box=doc.createElement('div');box.id='join';box.setAttribute('aria-live','polite');doc.body.appendChild(box);
 const el=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 // asking: {to, name, req, until, bar}; asks: req -> {from, name, until, card, why}.
 let asking=null,noteTimer=0,ticking=0;const asks=new Map();
 const note=text=>{if(!text)return;let n=box.querySelector('.note');if(!n){n=el('div','note');box.appendChild(n);}n.textContent=text;clearTimeout(noteTimer);noteTimer=setTimeout(()=>n.remove(),4500);};
 function tick(){
  const t=now();if(asking?.bar&&asking.until)asking.bar.querySelector('.time').textContent=clock(asking.until-t);
  for(const a of asks.values())a.card.querySelector('.time').textContent=clock(a.until-t);
  if(!asking&&!asks.size){clearInterval(ticking);ticking=0;}
 }
 const keepTicking=()=>{if(!ticking)ticking=setInterval(tick,250);tick();};
 function stopAsking(){asking?.bar?.remove();asking=null;}
 function showAsking(){
  if(!asking.bar){const bar=el('div','row');bar.append(el('span'),el('span','time'),Object.assign(el('button',null,'Cancel'),{type:'button',onclick:cancel}));box.prepend(bar);asking.bar=bar;}
  const s=asking.bar.querySelector('span');s.replaceChildren('Asking ',el('b',null,asking.name),' to join them…');keepTicking();
 }
 function cancel(){if(!asking)return;live()?.joinCancel();stopAsking();}
 function removeAsk(req){const a=asks.get(req);if(!a)return null;a.card.remove();asks.delete(req);return a;}
 function answer(req,ok){
  const a=asks.get(req);if(!a)return;
  if(ok){const where=here();if(where){a.card.querySelector('.why').textContent=`They can’t join you in ${PLACE[where]||'here'}. Step out to a public spot, then accept.`;return;}}
  if(!live()?.joinAnswer(req,ok)){a.card.querySelector('.why').textContent='Not connected to Leo live.';return;}
  if(!ok)removeAsk(req);else a.card.querySelector('.why').textContent='Sending…';
 }
 function showAsk(msg){
  const card=el('div');const row=el('div','row'),who=el('span');who.append(el('b',null,msg.name||'A Voyager'),' asks to join you');
  const yes=Object.assign(el('button','yes','Accept'),{type:'button',onclick:()=>answer(msg.req,true)}),no=Object.assign(el('button',null,'Decline'),{type:'button',onclick:()=>answer(msg.req,false)});
  row.append(who,el('span','time'),yes,no);card.append(row,el('p','why',doc.pointerLockElement?'Esc frees the mouse to choose.':''));box.appendChild(card);
  asks.set(msg.req,{from:msg.from,name:msg.name,until:now()+(Number(msg.ms)||30000),card});keepTicking();
 }
 return {
  // The id being asked now, if any (the Aboard list shows it as asked).
  get asking(){return asking?.to||null;},
  ask(id,name){
   if(asking?.to===id)return;
   if(!live()?.join(id)){note('Not connected to Leo live.');return;}
   asking?.bar?.remove();asking={to:id,name,req:null,until:0,bar:null};showAsking();
  },
  fromServer(msg){
   switch(msg.e){
    case 'sent':if(asking&&asking.to===msg.to){asking.req=msg.req;asking.name=msg.name||asking.name;asking.until=now()+(Number(msg.ms)||30000);showAsking();}break;
    case 'no':if(asking&&(!msg.req||asking.req===msg.req||asking.to===msg.to)){const name=msg.name||asking.name;stopAsking();note((NO[msg.why]||NO.busy)(name));}break;
    case 'go':{
     if(!asking||asking.req!==msg.req)break;const name=msg.name||asking.name;stopAsking();
     const at=Array.isArray(msg.at)&&msg.at.length===3&&msg.at.every(Number.isFinite)?msg.at:null;
     note(at&&land(at,name)?`You joined ${name}.`:`There’s no safe spot beside ${name} right now.`);break;}
    case 'ask':showAsk(msg);break;
    case 'done':{const a=removeAsk(msg.req);if(a)note(`${a.name||msg.name} is on their way.`);break;}
    case 'off':{const a=removeAsk(msg.req);if(a)note((OFF[msg.why]||OFF.gone)(a.name||msg.name));break;}
   }
   if(!asking&&!asks.size)tick();
  },
  // The link dropped: every request went with it.
  reset(){stopAsking();for(const req of [...asks.keys()])removeAsk(req);},
 };
}
