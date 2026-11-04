import {walkBindings,bindingLabel,bindingProblem} from './bindings.js';

// A native modal keeps editing keys out of the walk and its other sheets.
export function mountControlsSettings({emotes=[],onOpenChange=()=>{}}={}){
 if(typeof document==='undefined'||globalThis.__leoPreparedBuild)return null;
 const mount=document.querySelector('#tools-extra')||document.querySelector('.tools');
 if(!mount||document.getElementById('controls-settings'))return null;
 const el=(tag,props={})=>Object.assign(document.createElement(tag),props);
 const style=el('style',{textContent:`
 #controls-settings{box-sizing:border-box;width:min(520px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;margin:auto;padding:24px;border:1px solid var(--hairline,#555);border-radius:18px;background:var(--card,#111);color:var(--text,#f4f0e8);font:14px/1.5 var(--sans,system-ui);box-shadow:0 16px 70px #0008}
 #controls-settings::backdrop{background:#030609bd}
 #controls-settings h2{margin:0 0 12px;font-size:24px}
 #controls-settings p{margin:12px 0;color:var(--dim,#bbb)}
 #controls-settings .binding-row{display:grid;grid-template-columns:minmax(80px,1fr) minmax(110px,1fr) auto;align-items:center;gap:8px;padding:5px 0;border-top:1px solid var(--hairline,#444)}
 #controls-settings button{min-height:40px;padding:8px 12px;border:1px solid var(--hairline,#666);border-radius:9px;background:#ffffff0a;color:inherit;font:inherit;cursor:pointer}
 #controls-settings button:hover,#controls-settings button[aria-pressed="true"]{border-color:var(--orange,#f85800);background:#f8580020}
 #controls-settings :focus-visible{outline:2px solid var(--orange,#f85800);outline-offset:3px}
 #controls-settings .binding-actions{display:flex;justify-content:space-between;gap:10px;margin-top:16px}
 #controls-settings #bindings-status{min-height:42px;color:var(--text,#f4f0e8)}
 @media(max-width:420px){#controls-settings{padding:16px}#controls-settings .binding-row{gap:5px}#controls-settings button{padding:8px}}
 `});
 const button=el('button',{id:'controls',type:'button',textContent:'Controls'}),dialog=el('dialog',{id:'controls-settings'});
 button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.id);
 dialog.setAttribute('aria-labelledby','controls-title');dialog.setAttribute('aria-describedby','controls-description');
 const title=el('h2',{id:'controls-title',textContent:'Emotes & ping controls'}),description=el('p',{id:'controls-description',textContent:'Select a binding, then press a key or mouse button. Esc cancels. Clear an action to free its binding. Left mouse stays for looking; browser shortcuts stay reserved.'});
 const list=el('div'),buttons=new Map(),labels=new Map([['emotes','Emote menu'],['ping','Ping'],...emotes.map((name,i)=>['emote:'+i,name.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase())])]);
 const status=el('p',{id:'bindings-status',textContent:'Bindings are saved on this browser. Ping works while connected to Leo live.'});status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 let pending=null,opened=false,returnFocus=null;
 function refresh(){for(const [id,b]of buttons){b.textContent=pending===id?'Press key / mouse…':bindingLabel(walkBindings.get(id));b.setAttribute('aria-pressed',String(pending===id));b.setAttribute('aria-label',labels.get(id)+': '+b.textContent);}}
 function result(r){status.textContent=r.ok?(r.saved?'Saved on this browser.':'Applied for this visit. Browser storage is unavailable.'):(r.conflict?bindingLabel(walkBindings.get(r.conflict))+' is assigned to '+(labels.get(r.conflict)||r.conflict)+'. Clear it first.':r.error);if(r.ok)pending=null;refresh();}
 for(const [id,label]of labels){
  const row=el('div',{className:'binding-row'}),bind=el('button',{type:'button'}),clear=el('button',{type:'button',textContent:'Clear'});
  clear.setAttribute('aria-label','Clear '+label);buttons.set(id,bind);row.append(el('span',{textContent:label}),bind,clear);list.append(row);
  bind.addEventListener('click',()=>{pending=id;status.textContent='Press a plain key or mouse button for '+label+'. Esc cancels.';refresh();});
  clear.addEventListener('click',()=>{pending=null;result(walkBindings.set(id,null));});
 }
 const actions=el('div',{className:'binding-actions'}),reset=el('button',{type:'button',textContent:'Reset defaults'}),done=el('button',{type:'button',textContent:'Done'});actions.append(reset,done);
 dialog.append(title,description,list,status,actions);document.head.append(style);document.body.append(dialog);mount.append(button);
 const more=document.getElementById('tools-more'),moreLabel=more?.getAttribute('aria-label');if(more)more.setAttribute('aria-label',(moreLabel||'More buttons')+', controls');
 function clearInput(){onOpenChange(false);const more=document.getElementById('tools-more'),target=returnFocus?.getClientRects().length?returnFocus:more?.getClientRects().length?more:button;target.focus();returnFocus=null;}
 function closed(){if(!opened)return;opened=false;pending=null;refresh();clearInput();}
 function close(){if(!opened)return;dialog.close();closed();}
 function open(){
  if(opened)return;returnFocus=document.activeElement;onOpenChange(true);
  mount.closest('.tools')?.classList.remove('more-open');document.getElementById('tools-more')?.setAttribute('aria-expanded','false');
  document.exitPointerLock?.();pending=null;refresh();
  try{dialog.showModal();opened=true;buttons.get('emotes').focus();}catch(error){clearInput();throw error;}
 }
 const keyboard=e=>{
  if(!opened)return;
  e.stopImmediatePropagation();
  if(e.type==='keyup')return;
  if(e.code==='Escape'){e.preventDefault();if(pending){pending=null;status.textContent='Binding cancelled.';refresh();}else close();return;}
  // Keep native Tab navigation and browser shortcuts available while editing.
  if(!pending||e.code==='Tab'||e.ctrlKey||e.metaKey||e.altKey)return;
  if(!bindingProblem(e.code)||/^(Key|Digit)/.test(e.code))e.preventDefault();
  if(!e.repeat)result(walkBindings.set(pending,e.code));
 };
 const mouse=e=>{
  if(!opened||!pending||e.pointerType!=='mouse'||e.ctrlKey||e.metaKey||e.altKey)return;
  e.preventDefault();e.stopImmediatePropagation();result(walkBindings.set(pending,'Mouse'+e.button));
 };
 // The click following a captured mouse button must not arm another row.
 let captured=false;
 const capture=e=>{captured=false;if(e.button===0&&e.target.closest?.('button'))return;if(opened&&pending&&e.pointerType==='mouse'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){captured=true;mouse(e);}};
 const click=e=>{if(captured){e.preventDefault();e.stopImmediatePropagation();captured=false;}};
 const mouseDefault=e=>{if(opened&&captured)e.preventDefault();};
 const context=e=>{if(opened&&captured){e.preventDefault();e.stopImmediatePropagation();}};
 window.addEventListener('keydown',keyboard,true);window.addEventListener('keyup',keyboard,true);window.addEventListener('pointerdown',capture,true);window.addEventListener('mousedown',mouseDefault,true);window.addEventListener('mouseup',mouseDefault,true);window.addEventListener('click',click,true);window.addEventListener('auxclick',click,true);dialog.addEventListener('contextmenu',context);
 button.addEventListener('click',open);done.addEventListener('click',close);reset.addEventListener('click',()=>{pending=null;result(walkBindings.reset());});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',closed);const unsubscribe=walkBindings.subscribe(refresh);refresh();
 return {open,close,get isOpen(){return opened;},destroy(){close();unsubscribe();window.removeEventListener('keydown',keyboard,true);window.removeEventListener('keyup',keyboard,true);window.removeEventListener('pointerdown',capture,true);window.removeEventListener('mousedown',mouseDefault,true);window.removeEventListener('mouseup',mouseDefault,true);window.removeEventListener('click',click,true);window.removeEventListener('auxclick',click,true);dialog.removeEventListener('contextmenu',context);dialog.remove();button.remove();style.remove();if(more){if(moreLabel===null)more.removeAttribute('aria-label');else more.setAttribute('aria-label',moreLabel);}}};
}
