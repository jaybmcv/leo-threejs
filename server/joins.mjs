// Ask to join (src/walk/join.js): a visitor picks someone in the Aboard list and asks to come to where they are. The one
// asked accepts or declines. A request lasts JOIN_MS, can be cancelled, and goes when either of them leaves. On accept
// the asker is told where the other one stands, if that is a public area (policy.canJoin: not a restricted room, a lift
// shaft or inside a game, src/walk/public-area.js) and they are not playing; the asker's page then finds a safe floor
// beside it. Nothing is kept: requests live in memory only.
//
// In, {m:'join', op}:  'ask' {to} · 'cancel' · 'answer' {req, ok}
// Out, {m:'join', e, req}:
//   to the asker      'sent' {to, name, ms}   asked; the answer comes within ms
//                     'go' {to, name, at}     accepted: come to at (where they stand, ship metres)
//                     'no' {to, name, why}    why: declined, expired, gone (they left), busy (somewhere they can't be
//                                             joined, or too many asking them), cancelled, again (they said no to this
//                                             asker less than DECLINED_MS ago), slow (too many asks), unknown, self
//   to the one asked  'ask' {from, name, ms}  someone asks to join you
//                     'done' {from, name}     you accepted and they are on their way
//                     'off' {from, name, why} why: cancelled, expired, gone (the asker left), busy (you are somewhere
//                                             they can't join)
export const JOIN_MS=30000,DECLINED_MS=60000,MOST_ASKING=3,ASKS=[3,30000];
export function createJoins({send,find,canJoin,log=()=>{},clock=()=>Date.now(),ms=JOIN_MS}){
 const pending=new Map(),declined=new Map(),asked=new WeakMap();let serial=0;
 const nameOf=v=>v.name||'Voyager '+v.id.slice(-4);
 const tell=(v,msg)=>send(v,{m:'join',...msg});
 const outgoing=v=>[...pending.values()].find(j=>j.from===v);
 function close(j,toAsker,toAsked){
  pending.delete(j.req);
  if(toAsker)tell(j.from,{e:'no',req:j.req,to:j.to.id,name:nameOf(j.to),why:toAsker});
  if(toAsked)tell(j.to,{e:'off',req:j.req,from:j.from.id,name:nameOf(j.from),why:toAsked});
 }
 function ask(v,to){
  const no=(why,o=null)=>tell(v,{e:'no',req:null,to:typeof to==='string'?to:null,name:o?nameOf(o):null,why});
  if(typeof to!=='string')return;
  const now=clock(),times=(asked.get(v)||[]).filter(t=>now-t<ASKS[1]);asked.set(v,times);
  if(times.length>=ASKS[0])return no('slow');
  const o=find(to);if(!o)return no('unknown');if(o===v)return no('self',o);
  if((declined.get(v.id+'>'+o.id)||0)>now)return no('again',o);
  const mine=outgoing(v);if(mine)close(mine,null,'cancelled');
  if([...pending.values()].filter(j=>j.to===o).length>=MOST_ASKING)return no('busy',o);
  times.push(now);
  const j={req:'j'+(++serial),from:v,to:o,until:now+ms};pending.set(j.req,j);
  tell(v,{e:'sent',req:j.req,to:o.id,name:nameOf(o),ms});tell(o,{e:'ask',req:j.req,from:v.id,name:nameOf(v),ms});
  log('join ask',v.id,'->',o.id);
 }
 function answer(o,req,ok){
  const j=pending.get(req);if(!j||j.to!==o||typeof ok!=='boolean')return;
  if(!ok){declined.set(j.from.id+'>'+o.id,clock()+DECLINED_MS);close(j,'declined',null);log('join declined',j.from.id,'->',o.id);return;}
  if(o.playing||!canJoin(o.pos)){close(j,'busy','busy');log('join refused',j.from.id,'->',o.id,'(not a public spot)');return;}
  pending.delete(req);
  tell(j.from,{e:'go',req,to:o.id,name:nameOf(o),at:o.pos.map(n=>Math.round(n*100)/100)});
  tell(o,{e:'done',req,from:j.from.id,name:nameOf(j.from)});log('join accepted',j.from.id,'->',o.id);
 }
 return {
  message(v,msg){
   if(msg.op==='ask')ask(v,msg.to);
   else if(msg.op==='cancel'){const j=outgoing(v);if(j)close(j,'cancelled','cancelled');}
   else if(msg.op==='answer')answer(v,msg.req,msg.ok);
  },
  // A visitor left: their requests go, and the other side is told.
  left(v){for(const j of [...pending.values()]){if(j.from===v)close(j,null,'gone');else if(j.to===v)close(j,'gone',null);}},
  tick(){const now=clock();for(const j of [...pending.values()])if(j.until<=now)close(j,'expired','expired');
   for(const [k,until] of declined)if(until<=now)declined.delete(k);},
  get size(){return pending.size;},
 };
}
