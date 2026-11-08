import {getAtriumQuality,getAtriumQualitySelection,setAtriumQuality,subscribeAtriumQuality} from '../v2/atrium-quality.js';
import {getLook,setLook,subscribeLook} from './look.js';

const choices=[
 ['auto','Auto (recommended)','Choose for this device and adjust detail as you play.'],
 ['high','High','Keep the most geometry detail throughout the atrium.'],
 ['balanced','Balanced','Simplify distant geometry while keeping nearby details.'],
 ['performance','Performance','Simplify geometry sooner to reduce rendering work.'],
];
// The same levels on the desktop's merged drawing, which keeps full geometry: they set the atrium's haze (detail-levels.js).
const hazeChoices=[
 ['auto','Auto (recommended)','Choose for this device and adjust as you play.'],
 ['high','High','See the full length of the atrium.'],
 ['balanced','Balanced','Haze closes in across the far end of the atrium.'],
 ['performance','Performance','Haze as close as in the corridors, and no corner shading. From your next visit, edge smoothing turns off and depth is drawn a faster way.'],
];
// The walk's look (look.js, film-look.js).
const looks=[
 ['today','Leo today','The ship as it looks now.'],
 ['film','Film (preview)',"Voyager's Reach's Stylised 3D: light that wraps round forms, richer shade and a warm grade. The ship's shaders are rebuilt when you change, which can take a few seconds."],
];

// Geometry detail is independent of the existing drawing-resolution control.
// onOpenChange(true) runs before the modal opens, allowing the caller to close
// other sheets. The caller owns pausing/clearing WalkInput while the menu is open.
// held: this visit loaded with Performance's linear depth, so its haze stays until the next visit (main.public.js).
export function mountGraphicsSettings({onOpenChange=()=>{},haze=false,held=false}={}){
 const levels=haze?hazeChoices:choices;
 if(typeof document==='undefined'||globalThis.__leoPreparedBuild)return null;
 const mount=document.querySelector('#settings-menu')||document.querySelector('#tools-extra')||document.querySelector('.tools');
 if(!mount||document.getElementById('graphics-settings'))return null;
 const el=(tag,props={})=>Object.assign(document.createElement(tag),props);
 const style=el('style',{textContent:`
 #graphics-settings{box-sizing:border-box;width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;margin:auto;padding:24px;border:1px solid #6b807c;border-radius:18px;background:#112326;color:#eff4ee;font:16px/1.5 system-ui,sans-serif;box-shadow:0 16px 70px #0008}
 #graphics-settings::backdrop{background:#030b11ad}
 #graphics-settings h2{font:600 25px/1.2 system-ui,sans-serif;margin:0 0 12px;letter-spacing:-.02em}
 #graphics-settings p{font:14px/1.5 system-ui,sans-serif;margin:0 0 18px;color:#c9d7d2}
 #graphics-settings fieldset{min-width:0;padding:0;margin:0;border:0}
 #graphics-settings legend{font:600 15px/1.4 system-ui,sans-serif;padding:0;margin-bottom:10px}
 #graphics-settings label{display:flex;align-items:flex-start;gap:12px;padding:13px 12px;margin:0 0 8px;border:1px solid #526963;border-radius:10px;cursor:pointer;background:#172e31}
 #graphics-settings label:has(input:checked){border-color:#a4d8c7;background:#24423f}
 #graphics-settings input{width:18px;height:18px;flex:0 0 18px;margin:3px 0 0;accent-color:#a4d8c7}
 #graphics-settings strong{display:block;font-size:15px;font-weight:600}
 #graphics-settings small{display:block;font:13px/1.45 system-ui,sans-serif;color:#c9d7d2;margin-top:3px}
 #graphics-settings .graphics-note{margin:14px 0;font-size:13px}
 #graphics-settings .graphics-look{margin-top:4px}
 #graphics-settings .graphics-actions{display:flex;justify-content:flex-end}
 #graphics-settings button{min-height:44px;padding:10px 20px;border:1px solid #a4d8c7;border-radius:10px;background:#b9dfcd;color:#102421;font:600 14px/1.4 system-ui,sans-serif;cursor:pointer}
 #graphics-settings :focus-visible{outline:3px solid #f2bb79;outline-offset:3px}
 @media(max-width:560px){
 .tools #tools-more{display:block}
 .tools #tools-extra{display:none;position:absolute;top:calc(100% + 6px);right:0;flex-direction:column;gap:6px;align-items:stretch}
 .tools.more-open #tools-extra{display:flex}
 .tools #tools-extra button{padding:11px 14px;text-align:left;min-width:110px}
 }
 @media(max-width:420px){#graphics-settings{padding:18px}#graphics-settings h2{font-size:23px}}
 `});
 const button=el('button',{id:'graphics',type:'button',textContent:'Detail'});
 button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','graphics-settings');
 const dialog=el('dialog',{id:'graphics-settings'});
 dialog.setAttribute('aria-labelledby','graphics-title');dialog.setAttribute('aria-describedby','graphics-description');dialog.setAttribute('aria-modal','true');
 const title=el('h2',{id:'graphics-title',textContent:'Graphics detail'});
 const description=el('p',{id:'graphics-description',textContent:haze?'Choose how far you see across the atrium before the haze closes in, and how the ship looks. A shorter view draws less, for slower graphics cards.':'The whole atrium stays visible in every mode. Choose how much geometry detail to keep at a distance, and how the ship looks.'});
 const fieldset=el('fieldset'),legend=el('legend',{textContent:haze?'Detail':'Geometry detail'}),radios=new Map();
 fieldset.append(legend);
 for(const [value,label,description] of levels){
  const row=el('label'),radio=el('input',{type:'radio',name:'leo-geometry-detail',value}),copy=el('span');
  radio.id='geometry-detail-'+value;
  copy.append(el('strong',{textContent:label}),el('small',{textContent:description}));
  row.append(radio,copy);fieldset.append(row);radios.set(value,radio);
  radio.addEventListener('change',()=>{if(radio.checked)setAtriumQuality(value);});
 }
 const lookFieldset=el('fieldset',{className:'graphics-look'}),lookRadios=new Map();
 lookFieldset.append(el('legend',{textContent:'Look'}));
 for(const [value,label,description] of looks){
  const row=el('label'),radio=el('input',{type:'radio',name:'leo-walk-look',value}),copy=el('span');
  radio.id='walk-look-'+value;
  copy.append(el('strong',{textContent:label}),el('small',{textContent:description}));
  row.append(radio,copy);lookFieldset.append(row);lookRadios.set(value,radio);
  radio.addEventListener('change',()=>{if(radio.checked)setLook(value);});
 }
 const lookStatus=el('p',{className:'graphics-note'});lookStatus.setAttribute('role','status');lookStatus.setAttribute('aria-live','polite');
 lookFieldset.append(lookStatus);
 const note=el('p',{className:'graphics-note',textContent:(held?'This visit started in Performance, so the haze stays close until your next visit. ':'')+'Changes apply immediately and are remembered on this browser. The Res button controls image sharpness separately.'});
 const autoStatus=el('p',{className:'graphics-note'});autoStatus.setAttribute('role','status');autoStatus.setAttribute('aria-live','polite');
 const actions=el('div',{className:'graphics-actions'}),done=el('button',{type:'button',textContent:'Done'});
 actions.append(done);dialog.append(title,description,fieldset,autoStatus,lookFieldset,note,actions);
 document.head.append(style);document.body.append(dialog);mount.append(button);
 const more=document.getElementById('tools-more');
 let opened=false,returnFocus=null,destroyed=false;
 const refresh=()=>{
  const current=getAtriumQualitySelection(),effective=getAtriumQuality();for(const [value,radio]of radios)radio.checked=value===current;
  const label=levels.find(c=>c[0]===effective)[1];
  button.setAttribute('aria-label','Graphics detail: '+(current==='auto'?'Auto — '+label:label));
  for(const [value,radio]of lookRadios)radio.checked=value===getLook();
  lookStatus.textContent=getLook()==='film'?'Film look is on.':'Leo today is on.';
  autoStatus.textContent=current==='auto'?'Currently using '+label+'. Manual choices stay fixed.':'Your chosen detail level stays fixed.';
 };
 const unsubscribe=subscribeAtriumQuality(refresh),unsubscribeLook=subscribeLook(refresh);refresh();
 function open(){
  if(opened||destroyed)return;
  returnFocus=document.activeElement;mount.closest('.tools')?.classList.remove('more-open');more?.setAttribute('aria-expanded','false');onOpenChange(true);
  try{dialog.showModal();opened=true;refresh();radios.get(getAtriumQualitySelection()).focus();}
  catch(error){onOpenChange(false);throw error;}
 }
 function closed(){
  if(!opened)return;opened=false;onOpenChange(false);
  // More may have closed while the modal was open. Focus its visible opener.
  const target=returnFocus?.isConnected&&returnFocus!==document.body&&returnFocus.getClientRects().length?returnFocus:more?.getClientRects().length?more:button;
  target?.focus();returnFocus=null;
 }
 function close(){if(!opened)return;dialog.close();closed();}
 const keyboard=e=>{
  if(!opened)return;
  // WalkInput listens on window even with its enabled flag off. Do not let
  // Escape, action shortcuts or held movement reach the game behind this modal.
  // Native radio arrows and Tab still receive their browser default behavior.
  e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();close();}
 };
 button.addEventListener('click',open);done.addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',closed);
 window.addEventListener('keydown',keyboard,true);window.addEventListener('keyup',keyboard,true);
 return {open,close,get isOpen(){return opened;},destroy(){
  if(destroyed)return;close();destroyed=true;unsubscribe();unsubscribeLook();
  window.removeEventListener('keydown',keyboard,true);window.removeEventListener('keyup',keyboard,true);
  dialog.remove();button.remove();style.remove();
 }};
}
