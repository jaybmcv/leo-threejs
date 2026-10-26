import {CHAT_CHARS} from './net/wire.js';

// Chat aboard: everyone on Leo live (server/leo-live.mjs) shares one channel. T (or the Chat button) opens the field
// and stops the walk while you type; Enter says the line and closes it, Escape or clicking away closes it and keeps
// what you typed. Closed, the newest lines stay in the corner for FRESH_MS and then step aside; open, the last
// MAX_LINES can be scrolled back through. Lines are plain text, set with textContent. Over a speaker's head, the line
// shows as a bubble too (remotes.js say).
//
// The server decides who may chat (LEO_LIVE_CHAT: all, verified or off); the page only reflects it.
const FRESH_MS=12000,MAX_LINES=60;
const REFUSED={slow:'Slow down a moment: a few lines every few seconds.',link:'Links can’t be posted in chat.',again:'You just said that.',
 'sign-in':'Connect Discord to chat aboard.',off:'Chat is off right now.',offline:'Not connected: chat comes back with Leo live.'};

// els: {box, lines, form, field, send, opener}. say(text): true when sent; connect(): connect Discord (for chat that
// asks for it); onOpen/onClose: the walk stops and starts again.
export function createChat({box,lines,form,field,send,opener},{say,connect,onOpen,onClose}){
 let open=false,mode='off',verified=false,live=false,me=null;
 field.maxLength=CHAT_CHARS;
 const allowed=()=>mode==='all'||(mode==='verified'&&verified);

 function show(){
  box.hidden=!live||mode==='off';
  if(box.hidden&&open)close();
  field.disabled=!allowed();send.textContent=allowed()?'Send':'Connect';
  field.placeholder=allowed()?'Say something to everyone aboard':'Connect Discord to chat';
 }
 function line({id,name,verified:v,text,at},{note=false}={}){
  const li=document.createElement('li');li.dataset.at=String(!note&&at||Date.now());
  if(note){li.className='note';li.textContent=text;}
  else{
   const who=document.createElement('b');who.textContent=id===me?'You':name||'Voyager '+id.slice(-4);
   li.classList.toggle('me',id===me);li.classList.toggle('verified',!!v);li.append(who,document.createTextNode(text));
  }
  // A line from before this page joined is history: shown when the chat is opened, not flashed up as new.
  if(!note&&at&&Date.now()-at>FRESH_MS)li.classList.add('old');
  const atEnd=lines.scrollHeight-lines.scrollTop-lines.clientHeight<24;
  lines.append(li);while(lines.children.length>MAX_LINES)lines.firstChild.remove();
  if(atEnd||!open)lines.scrollTop=lines.scrollHeight;
 }
 // Lines step aside once they are no longer new.
 setInterval(()=>{const now=Date.now();for(const li of lines.children)if(!li.classList.contains('old')&&now-Number(li.dataset.at)>FRESH_MS)li.classList.add('old');},1000);

 function openChat(){
  // (When chat wants Discord and this visitor hasn't connected, it opens on the lines with Connect in place of Send.)
  if(box.hidden)return;
  if(open){field.focus();return;}
  // onOpen closes any other panel first (which closes the chat, a no-op while it is still shut).
  onOpen?.();open=true;box.classList.add('open');
  if(document.pointerLockElement)document.exitPointerLock?.();
  lines.scrollTop=lines.scrollHeight;field.focus();
 }
 function close(){if(!open)return;open=false;box.classList.remove('open');field.blur();onClose?.();}

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
 show();

 return {
  get isOpen(){return open;},
  open:openChat,close,
  // Leo live's state: whether connected, this visitor's id, whether they're Discord-verified, and the server's chat mode.
  set({live:l=live,id=me,verified:v=verified,mode:m=mode}={}){live=l;me=id;verified=v;mode=m;show();},
  // The welcome's history: everything said in the last few minutes, in order.
  load(list){lines.textContent='';for(const l of list||[])if(typeof l?.text==='string'&&typeof l.id==='string')line(l);},
  add(l){line({...l,at:Date.now()});},
  refused(why){line({text:REFUSED[why]||'That line wasn’t sent.'},{note:true});},
 };
}
