import {identify,currentPass,connect,forget} from '../walk/net/connect.js';
import {TRACK,pill,note,hasTrack,isMoving,trackNodes,groups,stats,feature,shortDate} from './model.js';

// The Builder's Hub: where testers follow the ideas they sent. Nothing about anyone is in this page or this public
// repository: a tester's cards come at runtime from the Hub service (feedback-inbox hub/), which checks a fresh Leo pass
// and returns only theirs. Everything from the service goes in as text, never as markup.
const SERVICE=(()=>{
 // A local service for development, from a page on localhost only.
 const asked=new URLSearchParams(location.search).get('hub');
 if(asked&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname))return asked.replace(/\/$/,'');
 return 'https://mcv-feedback-hub.mcv-feedback.workers.dev';
})();
const MEDIA='https://raw.githubusercontent.com/jaybmcv/leo-threejs/pr-media/';
const LIVE_SHOWN=6,POLL_MS=30e3,POLLS=10,STALE_MS=60e3,OPEN_LOOK_MS=15*60e3,LIVE_STALE_MS=5*60e3;
const $=id=>document.getElementById(id);
function el(tag,props={},...kids){
 const {attrs,...rest}=props,e=Object.assign(document.createElement(tag),rest);
 for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);
 e.append(...kids.filter(k=>k!=null));
 return e;
}
const SVG='http://www.w3.org/2000/svg';
function icon(d,size=13){
 const s=document.createElementNS(SVG,'svg');
 for(const [k,v] of Object.entries({width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))s.setAttribute(k,v);
 for(const path of d){const p=document.createElementNS(SVG,'path');p.setAttribute('d',path);s.append(p);}
 return s;
}
const walkLink=go=>`walk.html?${go}`;

// Before and after: the after picture underneath, the before clipped over it, and a range input over both, so it drags,
// swipes and takes arrow keys. A picture that won't load takes the whole slider away.
function slider(shot,name){
 const before=el('img',{src:MEDIA+shot.before,alt:`Before: ${name}`,loading:'lazy',className:'cmp-before'}),after=el('img',{src:MEDIA+shot.after,alt:`After: ${name}`,loading:'lazy'});
 const line=el('div',{className:'cmp-line'}),knob=el('div',{className:'cmp-knob'},icon(['M9 7l-5 5 5 5','M15 7l5 5-5 5'],20));
 const range=el('input',{type:'range',min:0,max:100,value:45,className:'cmp-range',attrs:{'aria-label':'Drag to compare before and after'}});
 const place=()=>{const v=+range.value;before.style.clipPath=`inset(0 ${100-v}% 0 0)`;line.style.left=knob.style.left=v+'%';};
 range.addEventListener('input',place);place();
 const box=el('div',{className:'cmp'},after,before,line,knob,el('span',{className:'cmp-tag cmp-tag-l',textContent:'BEFORE'}),el('span',{className:'cmp-tag cmp-tag-r',textContent:'AFTER'}),range);
 for(const img of [before,after])img.addEventListener('error',()=>box.remove(),{once:true});
 return box;
}
const goButton=go=>go?el('a',{className:'go',href:walkLink(go),target:'_blank',rel:'noopener',textContent:'Go see it on Leo'}):null;

function trackOf(c){
 const nodes=trackNodes(c),spoken=`Progress: ${nodes.filter(n=>n.reached||n.state==='now').at(-1)?.label||TRACK[0][1]}`;
 return el('ol',{className:'track',attrs:{'aria-label':spoken}},...nodes.map((n,i)=>el('li',{className:`stop stop-${n.state}${n.key==='live'&&n.state==='done'?' stop-live':''}`},
  i<nodes.length-1?el('span',{className:`rail${n.reached?' rail-done':''}`}):null,
  el('span',{className:'dot'},n.state==='done'?icon(['M5 13l4 4L19 7']):null),
  el('span',{className:'stop-name',textContent:n.label}),
  el('span',{className:'stop-date',textContent:shortDate(n.date)}))));
}
function stepsOf(c){
 if(!c.steps?.length)return null;
 return el('ol',{className:'steps',attrs:{'aria-label':'Steps'}},...c.steps.map(s=>el('li',{className:`step step-${s.status==='live'?'live':s.status==='planned'?'todo':'now'}`},
  el('span',{className:'step-n',textContent:String(s.number)}),el('span',{textContent:s.title||`Step ${s.number}`}))));
}
function cardOf(c,{highlight=false}={}){
 const p=pill(c),text=note(c),title=c.title||'Your idea';
 const compare=c.shots?.length?el('button',{type:'button',className:'link',textContent:'See before and after'}):null;
 const actions=compare||c.go?el('div',{className:'actions'},goButton(c.go),compare):null;
 const card=el('article',{className:`card${highlight?' card-here':''}${isMoving(c)?' card-active':''}`,attrs:c.id?{'data-report':c.id}:{}},
  el('div',{className:'card-head'},el('h3',{textContent:title}),el('span',{className:`pill pill-${p.tone}`,textContent:p.text})),
  stepsOf(c),hasTrack(c)?trackOf(c):null,
  text?el('p',{className:'note',textContent:text}):null,
  c.words?el('details',{className:'words'},el('summary',{textContent:'What you said'}),el('p',{textContent:c.words})):null,
  actions);
 if(compare)compare.addEventListener('click',()=>{actions.after(slider(c.shots[0],title));compare.remove();},{once:true});
 return card;
}
function featureOf(c){
 const name=c.title||'Your idea';
 return el('article',{className:'feature'},slider(c.shots[0],name),
  el('div',{className:'feature-text'},el('div',{className:'live-mark'},el('span',{className:'live-dot'}),'Your idea is live'),el('h2',{textContent:name}),
   el('p',{textContent:`Aboard since ${shortDate(c.dates.live||c.dates.shipped)||'recently'}. You asked for it, and now you can walk up to it.`}),goButton(c.go)));
}
function statsOf(cards){
 return el('div',{className:'stats'},...stats(cards).map(s=>el('div',{className:'stat'},el('b',{className:s.tone?`tone-${s.tone}`:'',textContent:String(s.n)}),el('span',{textContent:s.label}))));
}
function panel(title,text,...kids){
 return el('div',{className:'panel'},el('h2',{textContent:title}),el('p',{textContent:text}),...kids);
}
const skeleton=()=>el('div',{className:'skeleton',attrs:{'aria-hidden':'true'}},el('div',{}),el('div',{}),el('div',{}));

let scrolled=false,lastAnswer='',lastCheck=0,polling=0;
// My ideas. asked: a report's id from a link right after sending it; it may not have arrived yet.
function showMine(data,asked){
 const box=$('mine'),{cards}=data;
 $('hero-stats').replaceChildren(cards.length?statsOf(cards):'');
 $('who').textContent=data.name?`Signed in as ${data.name}`:'';
 const out=[];
 const waiting=asked&&!cards.some(c=>c.id===asked);
 if(waiting)out.push(el('div',{className:'strip'},el('b',{textContent:'Thanks, we’ve got it.'}),' Your new idea shows up here within a few minutes.'));
 if(!cards.length){box.replaceChildren(...out,panel('No ideas yet','Press Feedback while you’re aboard Leo, type or say what you’d change, and follow it from here.',el('a',{className:'go',href:'walk.html',textContent:'Go aboard'})));return;}
 const top=feature(cards);if(top)out.push(featureOf(top));
 for(const g of groups(cards)){
  const shown=g.key==='live'&&g.cards.length>LIVE_SHOWN&&!g.cards.some(c=>c.id===asked)?g.cards.slice(0,LIVE_SHOWN):g.cards;
  const list=el('div',{className:'cards'},...shown.map(c=>cardOf(c,{highlight:c.id===asked})));
  const more=shown.length<g.cards.length?el('button',{type:'button',className:'more',textContent:`Show all ${g.cards.length}`}):null;
  more?.addEventListener('click',()=>{list.append(...g.cards.slice(shown.length).map(c=>cardOf(c)));more.remove();},{once:true});
  out.push(el('section',{className:'group'},el('h2',{className:'group-title',textContent:g.title},el('span',{textContent:String(g.cards.length)})),list,more));
 }
 out.push(el('p',{className:'foot',textContent:'Other testers can’t see your ideas here.'}));
 box.replaceChildren(...out);
 const here=asked&&box.querySelector(`[data-report="${CSS.escape(asked)}"]`);
 if(here&&!scrolled){scrolled=true;here.scrollIntoView({block:'center'});}
}
function askToConnect(me){
 $('who').textContent='';$('hero-stats').replaceChildren();
 const title=me?.remembered&&me.name?`Welcome back, ${me.name}`:'See your ideas';
 const button=el('button',{type:'button',className:'go',textContent:'Connect Discord'});button.addEventListener('click',()=>connect());
 const hint=me?.error==='failed'?'Discord sign-in didn’t work that time. Please try again.':'Connect the Discord account you send feedback from, and we’ll show you what’s happened to each idea.';
 $('mine').replaceChildren(panel(title,hint,button));
}
async function loadMine(asked){
 $('mine').replaceChildren(skeleton());
 try{
  const me=await identify(),pass=me.pass&&await currentPass();
  if(!pass){askToConnect(me);return;}
  const r=await fetch(`${SERVICE}/mine`,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({pass})});
  // The service didn't take this pass, so it isn't worth keeping.
  if(r.status===401){forget();askToConnect(null);return;}
  if(!r.ok)throw new Error(String(r.status));
  lastAnswer=await r.text();lastCheck=Date.now();
  const data=JSON.parse(lastAnswer);showMine(data,asked);
  if(asked&&!data.cards.some(c=>c.id===asked))waitFor(asked);
 }catch{
  const again=el('button',{type:'button',className:'go',textContent:'Try again'});again.addEventListener('click',()=>loadMine(asked));
  $('mine').replaceChildren(panel('We can’t reach the Hub right now','Your ideas are safe. Please try again in a moment.',again));
 }
}
// What's on screen stays, with word that it may be out of date and a way back in.
function signInRanOut(){
 $('who').textContent='';
 if($('sign-in-ran-out'))return;
 const button=el('button',{type:'button',className:'link',textContent:'Connect Discord'});button.addEventListener('click',()=>connect());
 $('mine').prepend(el('div',{className:'strip',id:'sign-in-ran-out'},el('b',{textContent:'Your sign-in ran out.'}),' This may not be the latest. ',button));
}
// A look without any fuss: nothing on screen changes unless the answer did, so an open slider or section stays as it is,
// and a failed look just leaves things as they were.
async function refreshMine(asked){
 if(!lastAnswer)return null;
 lastCheck=Date.now();
 try{
  const pass=await currentPass();if(!pass){signInRanOut();return null;}
  const r=await fetch(`${SERVICE}/mine`,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({pass})});
  if(r.status===401){forget();signInRanOut();return null;}
  if(!r.ok)return null;
  const text=await r.text(),data=JSON.parse(text);
  $('sign-in-ran-out')?.remove();
  if(text!==lastAnswer){lastAnswer=text;showMine(data,asked);}
  return data;
 }catch{return null;}
}
// A report just sent takes a moment to reach the Hub, so keep looking for a while.
function waitFor(asked){
 clearInterval(polling);let left=POLLS;
 polling=setInterval(async()=>{
  if(document.hidden)return;
  const data=await refreshMine(asked);
  if(--left<=0||data?.cards.some(c=>c.id===asked))clearInterval(polling);
 },POLL_MS);
}
// Just went live: from the public ship log, the same for everyone.
let liveAt=0,liveAnswer='';
async function loadLive(){
 if(Date.now()-liveAt<LIVE_STALE_MS)return;
 const box=$('live'),first=!liveAnswer;if(first)box.replaceChildren(skeleton());
 try{
  const r=await fetch(`${SERVICE}/live`);if(!r.ok)throw new Error(String(r.status));
  const text=await r.text();liveAt=Date.now();if(text===liveAnswer)return;liveAnswer=text;
  const {items}=JSON.parse(text);
  if(!items.length){box.replaceChildren(panel('Nothing new just yet','The latest changes aboard will show up here.'));return;}
  box.replaceChildren(el('div',{className:'gallery'},...items.map(i=>el('article',{className:'tile'},slider(i.shots[0],i.name),
   el('div',{className:'tile-text'},el('h3',{textContent:i.name}),el('span',{className:'tile-date',textContent:shortDate(i.date+'T12:00:00')}),goButton(i.go))))));
 }catch{
  if(!first)return;
  const again=el('button',{type:'button',className:'go',textContent:'Try again'});again.addEventListener('click',loadLive);
  box.replaceChildren(panel('We can’t reach the Hub right now','Please try again in a moment.',again));
 }
}
function pick(tab){
 for(const name of ['mine','live']){
  const on=name===tab;
  $(`tab-${name}`).setAttribute('aria-selected',String(on));$(`tab-${name}`).tabIndex=on?0:-1;$(name).hidden=!on;
 }
 if(tab==='live')loadLive();
}
const query=new URLSearchParams(location.search),asked=/^\d{8}-[0-9a-f]{8}$/.test(query.get('r')||'')?query.get('r'):null;
$('tab-mine').addEventListener('click',()=>pick('mine'));
$('tab-live').addEventListener('click',()=>pick('live'));
$('tabs').addEventListener('keydown',e=>{
 if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
 const next=$('tab-mine').getAttribute('aria-selected')==='true'?'live':'mine';pick(next);$(`tab-${next}`).focus();
});
pick(query.get('tab')==='live'?'live':'mine');
loadMine(asked);
// Back on this tab after a while: things may have moved.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastCheck>STALE_MS)refreshMine(asked);});
// Left open and in view, it still looks now and then.
setInterval(()=>{if(!document.hidden)refreshMine(asked);},OPEN_LOOK_MS);
