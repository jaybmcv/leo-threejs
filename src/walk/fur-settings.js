import {FUR_COLOURS,cleanFur,saveFur} from './fur-colours.js';
import {OUTFITS,cleanOutfit,saveOutfit} from './outfits.js';

// Your cat: fur colour, and with onOutfit the wardrobe (outfits.js), which Settings' Wardrobe button opens too.
export function mountFurSettings({getColour,onColour,getOutfit=()=>'default',onOutfit=null,onOpenChange=()=>{}}){
 if(typeof document==='undefined'||globalThis.__leoPreparedBuild)return null;
 const mount=document.querySelector('#tools-extra')||document.querySelector('.tools');if(!mount)return null;
 const el=(tag,props={})=>Object.assign(document.createElement(tag),props);
 const style=el('style',{textContent:`
 #fur-settings{box-sizing:border-box;width:min(380px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;margin:auto;padding:24px;border:1px solid var(--hairline,#555);border-radius:18px;background:var(--card,#111);color:var(--text,#f4f0e8);font:15px/1.5 var(--sans,system-ui);box-shadow:0 16px 70px #0008}
 #fur-settings::backdrop{background:#0306098a}
 #fur-settings h2{margin:0 0 10px;font-size:24px}
 #fur-settings p{font-size:14px;color:var(--dim,#bbb)}
 #fur-settings fieldset{border:0;margin:16px 0;padding:0}
 #fur-settings legend{margin-bottom:8px}
 #fur-settings label{display:flex;align-items:center;gap:12px;min-height:44px;padding:4px 10px;border:1px solid transparent;border-radius:9px;cursor:pointer}
 #fur-settings label:has(input:checked){border-color:var(--orange,#f85800);background:#f8580020}
 #fur-settings input{accent-color:var(--orange,#f85800)}
 #fur-settings .fur-swatch{width:24px;height:24px;border:1px solid #fff8;border-radius:50%}
 #fur-settings button{min-height:44px;padding:8px 20px;border:1px solid var(--hairline,#666);border-radius:9px;background:#ffffff0a;color:inherit;font:inherit;cursor:pointer}
 #fur-settings :focus-visible{outline:2px solid var(--orange,#f85800);outline-offset:3px}
 `});
 const button=el('button',{id:'fur',type:'button',textContent:'Fur'}),dialog=el('dialog',{id:'fur-settings'});
 button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialog.id);dialog.setAttribute('aria-labelledby','fur-title');
 const field=el('fieldset'),radios=[],note=el('p');note.setAttribute('role','status');note.setAttribute('aria-live','polite');
 field.append(el('legend',{textContent:'Fur colour'}));
 FUR_COLOURS.forEach(({name,rgb},value)=>{
  const radio=el('input',{type:'radio',name:'leo-fur',value:String(value)}),swatch=el('span',{className:'fur-swatch'}),label=el('label');
  swatch.style.background=`rgb(${rgb.join(',')})`;swatch.setAttribute('aria-hidden','true');label.append(radio,swatch,name);field.append(label);radios.push(radio);
  radio.addEventListener('change',()=>{if(!radio.checked)return;onColour(value);note.textContent=saveFur(value)?'Saved on this browser. Others aboard see this colour too.':'Applied for this visit. Browser storage is unavailable.';});
 });
 // The wardrobe: shown on this device only, so it says so up front.
 const wear=onOutfit?el('fieldset',{id:'wardrobe-choice'}):null,outfits=[],
  only=el('p',{id:'wardrobe-note',textContent:'Only you see your outfit, on this device. Others aboard still see the default outfit.'});
 if(wear){
  wear.append(el('legend',{textContent:'Wardrobe'}),only);wear.setAttribute('aria-describedby',only.id);
  for(const {id,name} of OUTFITS){
   const radio=el('input',{type:'radio',name:'leo-outfit',value:id}),label=el('label');label.append(radio,name);wear.append(label);outfits.push(radio);
   radio.addEventListener('change',()=>{if(!radio.checked)return;onOutfit(id);note.textContent=saveOutfit(id)?name+' saved on this device. Only you see it.':name+' applied for this visit. Browser storage is unavailable.';});
  }
 }
 const done=el('button',{type:'button',textContent:'Done'});
 dialog.append(el('h2',{id:'fur-title',textContent:'Your cat'}),el('p',{textContent:wear?'Choose a fur colour and an outfit. Use View to see your cat from outside.':'Choose a fur colour. Use View to see your cat from outside.'}),field,...(wear?[wear]:[]),note,done);
 document.head.append(style);document.body.append(dialog);mount.append(button);
 // Settings' Wardrobe button: the menu closes as the sheet opens, and the outfit choice takes the focus.
 const menu=wear&&document.getElementById('settings-menu'),toggle=document.getElementById('settings-toggle'),wardrobe=menu?el('button',{id:'wardrobe',type:'button',textContent:'Wardrobe'}):null;
 if(wardrobe){wardrobe.setAttribute('aria-haspopup','dialog');wardrobe.setAttribute('aria-controls',dialog.id);menu.append(wardrobe);
  wardrobe.addEventListener('click',()=>{menu.hidden=true;toggle?.setAttribute('aria-expanded','false');open('wardrobe');});}
 let opened=false,returnFocus=null;
 const closed=()=>{if(!opened)return;opened=false;onOpenChange(false);const more=document.getElementById('tools-more');
  (returnFocus?.getClientRects().length?returnFocus:more?.getClientRects().length?more:button).focus();};
 function close(){if(opened){dialog.close();closed();}}
 function open(part){if(opened)return;returnFocus=document.activeElement;document.exitPointerLock?.();onOpenChange(true);
  mount.closest('.tools')?.classList.remove('more-open');document.getElementById('tools-more')?.setAttribute('aria-expanded','false');
  const selected=cleanFur(getColour()),outfit=cleanOutfit(getOutfit());radios.forEach((r,i)=>r.checked=i===selected);outfits.forEach(r=>r.checked=r.value===outfit);
  note.textContent='Changes apply immediately. Cosmo blue restores the original fur'+(wear?'; Default, the original outfit.':'.');
  try{dialog.showModal();opened=true;(part==='wardrobe'&&outfits.find(r=>r.checked)||radios[selected]).focus();}catch(error){onOpenChange(false);throw error;}}
 const keyboard=e=>{if(!opened)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();close();}};
 button.addEventListener('click',()=>open());done.addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',closed);
 window.addEventListener('keydown',keyboard,true);window.addEventListener('keyup',keyboard,true);
 return {open,close,get isOpen(){return opened;},destroy(){close();window.removeEventListener('keydown',keyboard,true);window.removeEventListener('keyup',keyboard,true);dialog.remove();button.remove();wardrobe?.remove();style.remove();}};
}
