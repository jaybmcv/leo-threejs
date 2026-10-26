import {CHAT_CHARS} from './net/wire.js';

// Chat aboard: everyone on Leo live (server/leo-live.mjs) shares one channel. T (or the Chat button) opens the field
// and stops the walk while you type; Enter says the line and closes it, Escape or clicking away closes it and keeps
// what you typed. Closed, the newest lines stay up in the corner (walk.html shows the last few); open, the last
// MAX_LINES (the server's history too, however old) can be scrolled back through, each with when it was said. Lines
// are plain text, set with textContent. Over a speaker's head, the line shows as a bubble too (remotes.js say).
//
// Hide puts the corner lines and the bubbles away, remembered in this browser; the Chat button then counts the lines
// said since, and opening the chat still shows them all.
//
// The server decides who may chat (LEO_LIVE_CHAT: all, verified or off); the page only reflects it.
const MAX_LINES=100,QUIET_KEY='leo-chat-hidden';
const REFUSED={slow:'Slow down a moment: a few lines every few seconds.',link:'Links can’t be posted in chat.',again:'You just said that.',
 'sign-in':'Connect Discord to chat aboard.',off:'Chat is off right now.',offline:'Not connected: chat comes back with Leo live.'};

function remembered(){try{return localStorage.getItem(QUIET_KEY)==='1';}catch{return false;}}
function remember(quiet){try{if(quiet)localStorage.setItem(QUIET_KEY,'1');else localStorage.removeItem(QUIET_KEY);}catch{}}
// When a line was said, in the visitor's own time: "14:05" today, "Oct 25" before.
function when(at){
 const d=new Date(at),today=d.toDateString()===new Date().toDateString();
 const t=document.createElement('time');t.dateTime=d.toISOString();t.title=d.toLocaleString();
 t.textContent=today?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):d.toLocaleDateString([],{month:'short',day:'numeric'});
 return t;
}

// els: {box, lines, form, field, send, opener, hider, unread}. say(text): true when sent; connect(): connect Discord
// (for chat that asks for it); onOpen/onClose: the walk stops and starts again; onQuiet(quiet): chat hidden or shown.
export function createChat({box,lines,form,field,send,opener,hider,unread},{say,connect,onOpen,onClose,onQuiet}){
 let open=false,mode='off',verified=false,live=false,me=null,quiet=remembered(),missed=0;
 field.maxLength=CHAT_CHARS;
 const allowed=()=>mode==='all'||(mode==='verified'&&verified);

 function show(){
  box.hidden=!live||mode==='off';
  if(box.hidden&&open)close();
  field.disabled=!allowed();send.textContent=allowed()?'Send':'Connect';
  field.placeholder=allowed()?'Say something to everyone aboard':'Connect Discord to chat';
 }
 function showQuiet(){
  box.classList.toggle('quiet',quiet);
  hider.textContent=quiet?'Show':'Hide';hider.setAttribute('aria-pressed',String(quiet));
  hider.setAttribute('aria-label',quiet?'Show chat lines and bubbles':'Hide chat lines and bubbles');
  unread.textContent=missed>99?'99+':String(missed);unread.hidden=!quiet||!missed;
 }
 function line({id,name,verified:v,text,at},{note=false}={}){
  const li=document.createElement('li');
  if(note){li.className='note';li.textContent=text;}
  else{
   const who=document.createElement('b');who.textContent=id===me?'You':name||'Voyager '+id.slice(-4);
   li.classList.toggle('me',id===me);li.classList.toggle('verified',!!v);li.append(who,document.createTextNode(text),when(Number.isFinite(at)?at:Date.now()));
  }
  const atEnd=lines.scrollHeight-lines.scrollTop-lines.clientHeight<24;
  lines.append(li);while(lines.children.length>MAX_LINES)lines.firstChild.remove();
  if(atEnd||!open)lines.scrollTop=lines.scrollHeight;
 }

 function openChat(){
  // (When chat wants Discord and this visitor hasn't connected, it opens on the lines with Connect in place of Send.)
  if(box.hidden)return;
  if(open){field.focus();return;}
  // onOpen closes any other panel first (which closes the chat, a no-op while it is still shut).
  onOpen?.();open=true;box.classList.add('open');missed=0;showQuiet();
  if(document.pointerLockElement)document.exitPointerLock?.();
  lines.scrollTop=lines.scrollHeight;field.focus();
 }
 function close(){if(!open)return;open=false;box.classList.remove('open');field.blur();onClose?.();}
 function hide(next){quiet=next;missed=0;remember(quiet);showQuiet();onQuiet?.(quiet);lines.scrollTop=lines.scrollHeight;}

 form.addEventListener('submit',e=>{
  e.preventDefault();if(!allowed()){connect?.();return;}
  const text=field.value.trim();
  if(text){if(!say(text)){line({text:REFUSED.offline},{note:true});return;}field.value='';}
  close();
 });
 // Clicking or tapping away closes the field; the Send button keeps the focus so a tap on it still sends.
 form.addEventListener('focusout',e=>{if(open&&!form.contains(e.relatedTarget))setTimeout(()=>{if(open&&!form.contains(document.activeElement))close();},0);});
 send.addEventListener('pointerdown',e=>e.preventDefault());
 opener.addEventListener('click',openChat);
 hider.addEventListener('click',()=>hide(!quiet));
 show();showQuiet();

 return {
  get isOpen(){return open;},
  // Hidden: no corner lines and no bubbles over heads.
  get quiet(){return quiet;},
  open:openChat,close,
  // Leo live's state: whether connected, this visitor's id, whether they're Discord-verified, and the server's chat mode.
  set({live:l=live,id=me,verified:v=verified,mode:m=mode}={}){live=l;me=id;verified=v;mode=m;show();},
  // The welcome's history: everything said in the last few minutes, in order.
  load(list){lines.textContent='';for(const l of list||[])if(typeof l?.text==='string'&&typeof l.id==='string')line(l);},
  add(l){line(l);if(quiet&&!open&&l.id!==me){missed++;showQuiet();}},
  refused(why){line({text:REFUSED[why]||'That line wasn’t sent.'},{note:true});},
 };
}
