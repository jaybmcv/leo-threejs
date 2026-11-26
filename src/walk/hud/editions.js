const editions = { concourse: 'Grand Voyage', flight: 'Heliograph', orbit: 'Afterglow' };
const preference = 'leo-walk-hud-edition';
const by = id => document.getElementById(id);
const body = document.body;
const where = by('where');
const map = by('minimap-button');
const sections = {
  Explore: [['Find a place','go','go'], ['Ship log','log','log'], ['Changes here','changes-here','changes']],
  Crew: [['Chat','chat-open','chat'], ['Visitors aboard','aboard','aboard'], ['Discord','discord-chip','aboard']],
  Tools: [['Camera','camera-open','camera'], ['Skate','skate','skate'], ['Your cat','fur','more'], ['Emotes','emote-button','changes'],
    ['Settings','settings-toggle','settings'], ['Help','help','log'], ['Stats','stats','changes'], ['Feedback','.fb-button','chat'], ['Respawn','.tools .respawn','go']]
};
const glyphs = {
    go:'<path d="M4 19 9 5l11-2-4 14-12 2Z M9 5l7 12 M4 19l8-9 8-7"/>',
    log:'<path d="M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1z M12 6v14"/>',
    changes:'<path d="m12 2 2.6 7.3L22 12l-7.4 2.7L12 22l-2.7-7.3L2 12l7.3-2.7z"/>',
    chat:'<path d="M3 4h18v13H9l-6 5z M7 9h10 M7 12h7"/>',
    aboard:'<circle cx="9" cy="8" r="3"/><path d="M2 20c0-8 14-8 14 0 M16 5c5 0 5 6 0 6 M18 14q4 0 4 5"/>',
    camera:'<path d="M2 7h5l2-3h6l2 3h5v13H2z"/><circle cx="12" cy="13" r="4"/>',
    skate:'<path d="M2 10q2 5 6 5h9q3 0 5-5"/><circle cx="7" cy="18" r="1.4"/><circle cx="17" cy="18" r="1.4"/>',
    more:'<path d="M3 4h7v7H3z M14 4h7v7h-7z M3 15h7v6H3z M14 15h7v6h-7z"/>',
    settings:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>'
  };
const icon = key => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">'+glyphs[key]+'</svg>';
function button(label, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', action);
  return node;
}
function make(tag, id) {
  const node = document.createElement(tag);
  node.id = id;
  return node;
}
const native = id => id.startsWith('.') ? document.querySelector(id) : by(id);
const locationPlate = make('div', 'hud-location');
locationPlate.innerHTML = '<a href="./" aria-label="Return to Leo">'+'<svg aria-hidden="true" viewBox="0 0 54 48" fill="none" stroke="currentColor" stroke-linejoin="round"><path d="M2 24h9m32 0h9M6 29h8m26 0h8M10 34h7m20 0h7" stroke-width="2"/><path d="M14 12 22 17q5-2 10 0l8-5-2 16q-1 8-11 12-10-4-12-12z" stroke-width="2"/><path d="m19 24 5 2m11-2-5 2m-6 4 3 2 3-2"/><path d="M23 8h8m-4-4v8" stroke-width="1.5"/></svg>'+'<span>LEO</span></a><div><small></small><b></b></div><i class="at-stamp" aria-hidden="true"></i>';
const dock = make('nav', 'hud-dock');
dock.setAttribute('aria-label','Ship actions');
const mobile = make('nav', 'mobile-bar');
mobile.setAttribute('aria-label','Mobile ship navigation');
const hub = make('section','ship-directory');
hub.hidden = true;
hub.setAttribute('aria-label','Ship hub');
hub.innerHTML = '<header><div><small>MARS CATS VOYAGE</small><h2>Ship directory</h2></div><button type="button" class="at-x" aria-label="Close ship directory">×</button></header><div class="at-body"><button type="button" class="at-poster" data-arcade aria-label="Find Hydro-Nip arcade on Deck 17"><span class="at-copy"><small>DECK 17 &nbsp;/&nbsp; GAMES</small><strong>Hydro-Nip<br>arcade</strong></span><span class="at-arrow" aria-hidden="true">↗</span></button><nav class="at-tabs" aria-label="Directory sections"></nav><div class="at-actions"></div></div><div id="hud-editions" role="group" aria-label="Choose HUD edition" hidden></div><footer></footer>';
const choices=hub.querySelector('#hud-editions');
const footer=hub.querySelector('footer');
const closeButton=hub.querySelector('.at-x');
const poster=hub.querySelector('[data-arcade]');
let section='Explore';
let openedFrom;
function setExpanded() {
  for(const b of [dockHub, mobileHub]) b.setAttribute('aria-expanded',String(!hub.hidden));
  editionButton.setAttribute('aria-expanded',String(!choices.hidden));
}
function currentLauncher() { return mobileHub.offsetWidth ? mobileHub : dockHub; }
function closeHub(restoreFocus=false) {
  choices.hidden=true;
  hub.hidden=true;
  delete body.dataset.hubOpen;
  setExpanded();
  if(restoreFocus)(openedFrom?.offsetWidth ? openedFrom : currentLauncher()).focus({preventScroll:true});
}
function showSection(name) {
  section=name;
  poster.hidden=name!=='Explore';
  for(const tab of hub.querySelectorAll('.at-tabs button'))tab.setAttribute('aria-pressed',String(tab.textContent===name));
  const row=hub.querySelector('.at-actions');
  row.replaceChildren();
  for(const [label,id,glyph] of sections[name]){
    const target=native(id);
    if(!target||target.hidden)continue;
    const b=button(label,()=>{closeHub();target.click()});
    b.dataset.invoke=id;
    b.innerHTML=icon(glyph)+'<span>'+label+'</span><i aria-hidden="true">›</i>';
    row.append(b);
  }
}
function toggleHub(e) {
  if(!hub.hidden){closeHub(true);return}
  openedFrom=e.currentTarget;
  showSection('Explore');
  hub.hidden=false;
  body.dataset.hubOpen='';
  setExpanded();
  closeButton.focus({preventScroll:true});
}
const dockActions=[['go','Go to','go','M'],['log','Ship log','log','L'],['camera-open','Camera','camera'],['skate','Skate','skate'],['more','Hub','more']];
function positionSector(b,index){
  const step=Math.PI/8, start=step*index+.004, end=step*(index+1)-.004;
  const point=(angle,r)=>[(1-r*Math.cos(angle))*100,(1-r*Math.sin(angle))*100];
  const arc=(a,z,r)=>Array.from({length:9},(_,i)=>point(a+(z-a)*i/8,r));
  const outline=[...arc(start,end,1),...arc(end,start,.39)].map(([x,y])=>x.toFixed(2)+'% '+y.toFixed(2)+'%');
  const [x,y]=point((start+end)/2,.73);
  b.style.setProperty('--sector','polygon('+outline.join(',')+')');
  b.style.setProperty('--label-x',x+'%'); b.style.setProperty('--label-y',y+'%');
}
for(const [i,[id,label,glyph,key]] of dockActions.entries()){
  const b=button(label,id==='more'?toggleHub:()=>by(id)?.click());
  b.dataset.action=id;
  b.title=key?label+' ('+key+')':label;
  b.innerHTML=icon(glyph)+'<span>'+label+'</span>'+(key?'<kbd>'+key+'</kbd>':'');
  if(id!=='more')positionSector(b,i);
  dock.append(b);
}
const dockHub=dock.querySelector('[data-action=more]');
const go=button('Go to',()=>by('go')?.click());
go.dataset.key='go';
const mobileHub=button('Hub',toggleHub);mobileHub.dataset.key='hub';
for(const b of [dockHub,mobileHub])b.setAttribute('aria-controls',hub.id);
mobile.append(go,mobileHub);
for(const key of Object.keys(sections))hub.querySelector('nav').append(button(key,()=>showSection(key)));
const restore=button('⌖  Show HUD',()=>{
  delete body.dataset.compactHud;
  restore.hidden=true;
  currentLauncher().focus({preventScroll:true});
});
restore.id='hud-restore';restore.hidden=true;restore.setAttribute('aria-label','Restore full HUD');
const minimize=button('Minimize HUD',()=>{
  closeHub();body.dataset.compactHud='';restore.hidden=false;restore.focus({preventScroll:true});
});
minimize.id='hud-collapse';
const editionButton=button('Edition',()=>{
  choices.hidden=!choices.hidden;setExpanded();
  if(!choices.hidden)choices.querySelector('[aria-pressed=true]')?.focus();
});
editionButton.id='hud-edition-toggle';editionButton.setAttribute('aria-controls',choices.id);
footer.append(minimize,editionButton);
function applyEdition(edition) {
  body.dataset.hudEdition=edition;
  go.hidden=edition==='orbit';
  go.textContent=edition==='concourse'?'Find a place':'Go to';
  editionButton.textContent=editions[edition]+' ▾';
  editionButton.setAttribute('aria-label','Edition: '+editions[edition]);
  for(const b of choices.children)b.setAttribute('aria-pressed',String(b.dataset.edition===edition));
}
for(const [key,name] of Object.entries(editions)){
  const choice=button(name,()=>{
    applyEdition(key);
    try{localStorage.setItem(preference,key)}catch{}
    choices.hidden=true;setExpanded();editionButton.focus({preventScroll:true});
  });
  choice.dataset.edition=key;choices.append(choice);
}
let initial='orbit';
try{const saved=localStorage.getItem(preference);if(Object.hasOwn(editions,saved))initial=saved}catch{}
applyEdition(initial);
body.append(locationPlate,dock,mobile,hub,restore);
setExpanded();
closeButton.onclick=()=>closeHub(true);
poster.onclick=()=>{
  closeHub();by('go')?.click();
  const input=by('v2-goto-search');
  if(input){input.value='Hydro-Nip arcade';input.dispatchEvent(new Event('input',{bubbles:true}))}
};
document.addEventListener('pointerdown',e=>{
  if(!hub.hidden&&!hub.contains(e.target)&&!dockHub.contains(e.target)&&!mobileHub.contains(e.target))closeHub();
},true);
window.addEventListener('keydown',e=>{
  if(hub.hidden||e.key!=='Escape')return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!choices.hidden){choices.hidden=true;setExpanded();editionButton.focus()}else closeHub(true);
},true);
const settingsClose=button('Close',()=>by('settings-toggle')?.click());
settingsClose.id='hud-settings-close';by('settings-menu')?.append(settingsClose);
const prompt=by('prompt');
function updateLocation(){
  const [deck,...rest]=where.textContent.split('·');
  locationPlate.dataset.deckNumber=(deck.match(/-?\d+/)?.[0]||'–').padStart(2,'0');
  locationPlate.querySelector('small').textContent=deck.trim()||'Deck';
  locationPlate.querySelector('b').textContent=rest.join('·').trim()||'Walk aboard';
  const arcade=/deck\s*17\b/i.test(deck)&&prompt&&!prompt.hidden&&/alien cat invasion|paw pool|neon arena survival/i.test(prompt.textContent);
  if(/arrival hall/i.test(where.textContent))locationPlate.dataset.roomArt='arrival';
  else if(arcade||/hydro.nip arcade/i.test(where.textContent))locationPlate.dataset.roomArt='arcade';
  else delete locationPlate.dataset.roomArt;
}
function updateVisibility(){
  const active=!map.hidden&&Boolean(where.textContent.trim());
  body.toggleAttribute('data-hud-ready',active);
  if(!active&&!hub.hidden)closeHub();
}
new MutationObserver(()=>{updateLocation();updateVisibility()}).observe(where,{subtree:true,childList:true,characterData:true});
if(prompt)new MutationObserver(updateLocation).observe(prompt,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden']});
new MutationObserver(updateVisibility).observe(map,{attributes:true,attributeFilter:['hidden']});
updateLocation();updateVisibility();
const skate=by('skate');
if(skate){const sync=()=>dock.querySelector('[data-action=skate]').setAttribute('aria-pressed',skate.getAttribute('aria-pressed')||'false');new MutationObserver(sync).observe(skate,{attributes:true,attributeFilter:['aria-pressed']});sync()}
const places=by('places');
if(places)new MutationObserver(()=>{
  if(places.hidden)return;
  for(const b of places.querySelectorAll('button:not([data-mobile-intro])')){
    const t=b.textContent.trim();
    if(t.startsWith('Arrival tour:')||(t.startsWith('Ship log')&&t.includes('Every change')))b.dataset.mobileIntro='';
  }
}).observe(places,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
// Keep the actual live deck canvas above native top-layer dialogs as a read-only reference.
if(map.showPopover){
  new MutationObserver(()=>{
    if(document.querySelector('dialog[open]')&&!map.hidden){
      map.setAttribute('popover','manual');
      if(!map.matches(':popover-open'))map.showPopover();
    }else if(map.hasAttribute('popover')){
      if(map.matches(':popover-open'))map.hidePopover();
      map.removeAttribute('popover');
    }
  }).observe(body,{subtree:true,attributes:true,attributeFilter:['open']});
}
