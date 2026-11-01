// The booster pack giveaway card at Mudwater Arena's counter (walk.html's #mudwater-sheet; server/arena.mjs). Until the
// giveaway is switched on, or with no Leo live, it says details are coming. Once on, it shows the giveaway's own title
// and note and, by its mode: a button to claim a pack (one per Discord-verified visitor, to a chosen verified wallet in
// wallet mode), the code or wallet already claimed, a link to the claim form, or that the packs are gone. Anyone not
// signed in with Discord, including players from Otherside, is offered it first, in a small window (net/connect.js).
const COMING='Booster packs of Mudwater: Swamp Origins will be given away here. Details are coming soon.';
const NOTES={codes:'One pack per Voyager while they last. Claim yours for a code to redeem.',wallet:'One pack per Voyager while they last, sent to your verified wallet.',
 list:'One pack per Voyager while they last. Claim to get on the list.',form:'Fill in the claim form to get yours.'};
const WHY={'sold-out':'All the packs have been claimed.','sign-in':'Connect Discord first to claim.','no-wallet':'Add a verified wallet in The Creamery first.',
 wallet:'That wallet isn’t one The Creamery has verified for you.',closed:'The giveaway isn’t open right now.'};
const short=w=>w.length>14?`${w.slice(0,6)}…${w.slice(-4)}`:w;

// `$`: the page's getElementById; `live()`: Leo live's link or null; `connect()`: Discord through The Creamery, which
// resolves to a line to show if it didn't work.
export function createGiveaway({$,live,connect}){
 const title=$('mudwater-title'),note=$('mudwater-note'),box=$('mudwater-claim');
 let state=null,waiting=false,connecting=false,message='';
 const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);e.append(...kids);return e;};
 function render(){
  box.replaceChildren();const g=state;
  if(!g?.open){title.textContent='Booster pack giveaway';note.textContent=COMING;box.hidden=true;return;}
  title.textContent=g.title;note.textContent=g.note||NOTES[g.mode]||'';box.hidden=false;
  if(g.mode==='form'){box.append(el('a',{className:'go',href:g.formUrl,target:'_blank',rel:'noopener',textContent:'Open the claim form'}));return;}
  if(g.claim){
   if(g.claim.code)box.append(el('p',{className:'got'},'Your code ',el('code',{textContent:g.claim.code})),el('button',{type:'button',className:'go',textContent:'Copy code',
    onclick:e=>{navigator.clipboard?.writeText(g.claim.code).then(()=>{e.target.textContent='Copied';},()=>{});}}));
   else if(g.claim.wallet)box.append(el('p',{className:'got',textContent:`Claimed: your pack goes to ${short(g.claim.wallet)}.`}));
   else box.append(el('p',{className:'got',textContent:'Claimed: you’re on the list.'}));
   return;
  }
  if(g.soldOut){box.append(el('p',{className:'got',textContent:WHY['sold-out']}));return;}
  if(!g.verified){box.append(el('p',{className:'why',textContent:g.remembered?'Connect Discord again to claim, so The Creamery can check your wallets: one pack each.':'Claiming is for Voyagers signed in with Discord: one pack each.'}),...(message?[el('p',{className:'why',textContent:message})]:[]),el('button',{type:'button',className:'go',textContent:connecting?'Connecting…':'Connect Discord',disabled:connecting,
   onclick:async()=>{connecting=true;message='';const shown=connect();render();message=await shown||'';connecting=false;render();}}));return;}
  if(g.mode==='wallet'&&!g.wallets.length){box.append(el('p',{className:'why',textContent:WHY['no-wallet']}));return;}
  let pick=null;
  if(g.mode==='wallet'&&g.wallets.length>1){pick=el('select',{ariaLabel:'Wallet'},...g.wallets.map(w=>el('option',{value:w,textContent:short(w)})));box.append(el('label',{className:'why',textContent:'Send it to '},pick));}
  if(message)box.append(el('p',{className:'why',textContent:message}));
  box.append(el('button',{type:'button',className:'go',textContent:waiting?'Claiming…':'Claim a pack',disabled:waiting,
   onclick:()=>{const l=live();if(!l?.live){message='Leo live isn’t connected. Try again in a moment.';render();return;}waiting=true;message='';render();l.claim(pick?.value||(g.mode==='wallet'?g.wallets[0]:undefined));}}));
 }
 return {
  // The card opened at the counter: shown as it last was, then refreshed from the server.
  open(){message='';render();const l=live();if(l?.live){l.giveaway();l.arena('card');}},
  status(g){state=g;waiting=false;render();},
  claimed(r){waiting=false;if(r.ok){message='';live()?.giveaway();}else{message=WHY[r.why]||'That didn’t work. Try again in a moment.';if(r.why==='sold-out'&&state)state.soldOut=true;render();}},
 };
}
