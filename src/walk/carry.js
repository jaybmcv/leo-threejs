import * as T from 'three';
import layout from '../plan/selected-layout.js';
import {contains} from '../plan/geometry-v2.js';
import {carryItem} from './carry-items.js';
import {createCarryState,CARRY_KEY} from './carry-state.js';
import {carrySpots} from './carry-spots.js';
import {walkBindings,bindingLabel} from './bindings.js';

export function createCarry({scene,surface,onOpen,onClose,canOpen}){
 if(globalThis.__leoPreparedBuild)return null;
 const spots=carrySpots(layout),state=createCarryState(spots.map(s=>s.id)),models=new Map();
 // Two tiny live props, never baked into the ship or its collision.
 const group=new T.Group();group.name='Visitor_carry_items';scene.add(group);
 for(const s of spots){
  const prop=new T.Group(),yarn=s.item==='yarn',mat=new T.MeshStandardMaterial({color:yarn?0xf85800:0x2fd6c5,roughness:.65,metalness:yarn?0:.55});
  const body=new T.Mesh(yarn?new T.SphereGeometry(.13,16,12):new T.CylinderGeometry(.12,.12,.19,20),mat);prop.add(body);
  if(yarn)for(let i=0;i<4;i++){const ring=new T.Mesh(new T.TorusGeometry(.132,.009,5,32),new T.MeshStandardMaterial({color:0xf4c49c}));ring.rotation.set(i*.6,i*.8,0);prop.add(ring);}
  else for(const y of [-.095,.095]){const rim=new T.Mesh(new T.CylinderGeometry(.126,.126,.014,20),new T.MeshStandardMaterial({color:0xf4f0e8,metalness:.7,roughness:.4}));rim.position.y=y;prop.add(rim);}
  prop.position.fromArray(s.home);group.add(prop);models.set(s.item,prop);
 }
 const el=(tag,props={})=>Object.assign(document.createElement(tag),props);
 const style=el('style',{textContent:`
 #backpack{position:fixed;right:calc(16px + var(--hud-right,0px));bottom:calc(16px + var(--hud-bottom,0px));z-index:6;display:flex;align-items:center;gap:8px;min-height:44px;padding:8px 12px;border:1px solid var(--hairline);border-radius:12px;background:var(--surface);color:var(--text);font:11px var(--mono)}
 #backpack svg{width:25px;height:25px;color:var(--teal)}#backpack:hover{border-color:var(--orange)}
 #carry-panel{margin:auto;width:min(900px,calc(100vw - 16px));max-height:calc(100dvh - 24px);overflow:auto;padding:18px;border:1px solid var(--hairline);border-radius:16px;background:var(--card);color:var(--text);font:12px/1.4 var(--sans)}
 #carry-panel::backdrop{background:#030609b8}#carry-panel header{display:flex;align-items:center;justify-content:space-between;gap:12px}#carry-panel h2{font:24px var(--display);margin:0}#carry-panel h3{margin:6px 0}
 #carry-panel p{color:var(--dim);margin:8px 0}#carry-panel button{border:1px solid var(--hairline);border-radius:8px;background:#ffffff08;color:inherit;cursor:pointer;font:inherit}#carry-panel button:hover{border-color:var(--orange)}#carry-close{padding:10px 16px}
 .carry-panels{display:grid;grid-template-columns:minmax(280px,4fr) minmax(350px,5fr);gap:16px;overflow:auto;padding:4px}.carry-panels.solo{grid-template-columns:minmax(280px,360px)}
 .carry-grid{display:grid;gap:6px;grid-template-columns:repeat(4,minmax(0,1fr))}#carry-store .carry-grid{grid-template-columns:repeat(5,minmax(0,1fr))}
 .carry-cell{aspect-ratio:1;min-width:0;display:flex;flex-direction:column;border:1px solid var(--hairline);border-radius:9px;overflow:hidden;background:#ffffff04}
 #carry-panel .carry-slot{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:0;border-radius:0;padding:3px;font-size:10px;line-height:1.15;overflow-wrap:anywhere}
 .carry-slot svg{width:30%;max-height:32px;min-height:12px;color:var(--teal);flex-shrink:0}#carry-panel .carry-home{font-size:10px;border:0;border-top:1px solid var(--hairline);border-radius:0;padding:3px 0;color:var(--orange)}
 #carry-status{min-height:18px}#carry-toast{position:fixed;top:28%;left:50%;transform:translateX(-50%);z-index:16;max-width:90vw;background:var(--card);border:1px solid var(--orange);border-radius:12px;padding:12px;pointer-events:none;color:var(--text);font:13px var(--sans)}
 body.carry-open .touch,body.carry-open #joystick,body.carry-open #prompt{visibility:hidden}body.camera-mode #backpack,body.spraying #backpack{display:none}
 @media(max-width:600px){#carry-panel .carry-slot,#carry-panel .carry-home{font-size:9px}}
 @media(pointer:coarse){.touch #backpack{position:static;align-self:flex-end;flex:none;width:64px;height:44px;min-height:44px;padding:6px;justify-content:center;gap:4px}.touch #backpack svg{width:24px}.touch #backpack kbd{font-size:9px}}
 @media(pointer:coarse) and (max-height:500px){.touch #use{position:absolute;right:76px;bottom:104px;width:164px}.touch .row{position:absolute;right:72px;bottom:0;display:flex;width:auto;gap:0}}
 `});document.head.append(style);
 const button=el('button',{id:'backpack',type:'button'});
 button.innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 9V7a6 6 0 0 1 12 0v2M9 8h14l3 6v14H6V14zM11 19h10v7H11zM6 14h20M10 11v5m12-5v5"/></svg><kbd></kbd>';
 button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','carry-panel');
 const coarse=matchMedia('(pointer:coarse)'),mountButton=()=>{(coarse.matches?document.querySelector('.touch'):document.body).append(button);};mountButton();coarse.addEventListener('change',mountButton);
 const label=()=>{const key=bindingLabel(walkBindings.get('backpack'));button.querySelector('kbd').textContent=key==='Unbound'?'':key;button.setAttribute('aria-label','Backpack ('+key+')');button.title='Backpack ('+key+')';};walkBindings.subscribe(label);label();
 const dialog=el('dialog',{id:'carry-panel'}),head=el('header'),title=el('h2',{id:'carry-title',textContent:'Backpack'}),closeButton=el('button',{id:'carry-close',type:'button',textContent:'Close'});
 dialog.setAttribute('aria-labelledby',title.id);head.append(title,closeButton);
 const note=el('p',{textContent:'Your own storage on this device. Saved in this browser.'}),help=el('p',{textContent:'Click an item to move it between panels. Arrow keys select; Enter moves. Tab reaches Put back. Scroll sideways on small screens. Esc closes.'}),panels=el('div',{className:'carry-panels'});
 const pack=el('section',{id:'carry-backpack'}),store=el('section',{id:'carry-store'}),status=el('p',{id:'carry-status'}),toast=el('div',{id:'carry-toast',hidden:true});
 status.setAttribute('role','status');toast.setAttribute('role','status');panels.append(pack,store);dialog.append(head,note,help,panels,status);document.body.append(dialog,toast);
 let desk=null,opened=false,toastTimer=null;
 function message(text){if(opened)status.textContent=text;else{toast.textContent=text;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},2600);}}
 function result(r){message(r.ok?(r.saved?'Saved on this browser.':'Browser storage unavailable: kept for this visit only.'):r.message);}
 function refresh(){
  for(const s of spots)models.get(s.item).visible=state.location(s.item)==='home';
  if(!opened)return;
  const focus=document.activeElement?.dataset,was=focus?{side:focus.side,index:focus.index,home:focus.home}:null,data=state.snapshot();
  panels.classList.toggle('solo',!desk);store.hidden=!desk;
  for(const [section,side,slots,columns,name]of [[pack,'backpack',data.backpack,4,'Backpack'],...(desk?[[store,desk.id,data.stores[desk.id],5,desk.name+' · Deck '+desk.deck]]:[])]){
   section.replaceChildren(el('h3',{textContent:name}));const grid=el('div',{className:'carry-grid'});grid.setAttribute('aria-label',name+' slots');
   slots.forEach((id,index)=>{
    const item=carryItem(id),cell=el('div',{className:'carry-cell'}),slot=el('button',{type:'button',className:'carry-slot'});slot.dataset.side=side;slot.dataset.index=index;
    slot.setAttribute('aria-label','Slot '+(index+1)+': '+(item?.name||'Empty'));if(item){slot.innerHTML=item.icon;slot.append(el('span',{textContent:item.name}));}else slot.textContent=String(index+1);
    slot.addEventListener('click',()=>{if(!item)return;if(!desk){message('Open one of the two desks to store items, or use Put back.');return;}result(state.move(side,index,side==='backpack'?desk.id:'backpack'));});
    slot.addEventListener('keydown',e=>{const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns};if(offsets[e.code]!==undefined){e.preventDefault();grid.children[Math.max(0,Math.min(slots.length-1,index+offsets[e.code]))]?.querySelector('button')?.focus();}});
    cell.append(slot);
    if(item&&side==='backpack'){const home=el('button',{type:'button',className:'carry-home',textContent:'Put back'});home.dataset.side=side;home.dataset.index=index;home.dataset.home='1';home.setAttribute('aria-label','Put back '+item.name);home.addEventListener('click',()=>result(state.home(index)));cell.append(home);}
    grid.append(cell);
   });section.append(grid);
  }
  if(was?.side){const cells=(was.side==='backpack'?pack:store).querySelectorAll('.carry-cell'),cell=cells[+was.index];(was.home?cell?.querySelector('.carry-home')||cell?.querySelector('.carry-slot'):cell?.querySelector('.carry-slot'))?.focus();}
 }
 state.subscribe(refresh);refresh();
 function close(){if(!opened)return;opened=false;dialog.close();document.body.classList.remove('carry-open');onClose();surface.tabIndex=-1;surface.focus({preventScroll:true});}
 function open(next=null){
  if(opened){close();return;}if(!canOpen())return;
  onOpen();desk=next;opened=true;title.textContent=desk?'Desk storage':'Backpack';status.textContent=state.saved?'':'Browser storage unavailable: kept for this visit only.';refresh();
  document.getElementById('settings-menu').hidden=true;document.getElementById('settings-toggle').setAttribute('aria-expanded','false');document.body.classList.add('carry-open');dialog.showModal();pack.querySelector('.carry-slot').focus();
 }
 button.addEventListener('click',()=>open());closeButton.addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 // Keep panel keys out of the walk, including Enter on native slot buttons.
 addEventListener('keydown',e=>{if(!opened)return;if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.code==='Escape'||walkBindings.action(e.code)==='backpack'||(desk&&e.code==='KeyE')){e.preventDefault();e.stopImmediatePropagation();close();return;}
 },true);
 dialog.addEventListener('pointerdown',e=>{if(opened&&e.pointerType==='mouse'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&walkBindings.action('Mouse'+e.button)==='backpack'){e.preventDefault();e.stopPropagation();close();}});
 dialog.addEventListener('contextmenu',e=>{if(walkBindings.get('backpack')==='Mouse2')e.preventDefault();});
 addEventListener('storage',e=>{if(e.key===CARRY_KEY||e.key===null)state.reload();});
 return {open,close,state,spots,get isOpen(){return opened;},near(p){
  if(opened)return null;
  for(const s of spots){if(Math.abs(p.y-s.desk[1])>1||Math.hypot(p.x-s.desk[0],p.z-s.desk[2])>=2.4||!contains(s.polygon,[p.x,p.z]))continue;
   if(state.location(s.item)==='home'&&Math.hypot(p.x-s.home[0],p.z-s.home[2])<1.85)return {kind:'carry-item',label:'Pick up '+carryItem(s.item).name,item:s.item};
   return {kind:'carry-desk',label:'Open',desk:s};
  }return null;
 },use(t){if(t.kind==='carry-item')result(state.pickup(t.item));else open(t.desk);}};
}
