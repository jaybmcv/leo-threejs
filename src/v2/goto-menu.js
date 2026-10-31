import layout from 'v2-layout';
import {groupPlaces} from './wayfinding-data.js';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
export function renderGotoMenu(list,places,{go,close,currentDeck}={}){
 if(!document.getElementById('v2-goto-style')){const style=el('style');style.id='v2-goto-style';style.textContent='#places .goto-search{box-sizing:border-box;width:100%;padding:12px;margin:8px 0 14px;font:inherit;color:var(--text,#eee);background:#10212a;border:1px solid #53636a;border-radius:6px}#places details{margin:8px 0;border-top:1px solid #53636a}#places summary{padding:14px 0;cursor:pointer;font-weight:600}#places details button{width:100%}#places .goto-section{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#2fd6c5;margin:14px 0 4px}#places .goto-status{font-size:13px;min-height:1.5em}';document.head.append(style);}
 const label=el('label','Find a room or activity');label.htmlFor='v2-goto-search';const search=el('input',null,'goto-search');search.id='v2-goto-search';search.type='search';search.placeholder='Try food hall, spa, Deck 6…';search.autocomplete='off';
 const status=el('p',null,'goto-status');status.setAttribute('role','status');const groups=el('div');list.append(label,search,status,groups);
 const render=()=>{groups.replaceChildren();const query=search.value.trim().toLocaleLowerCase(),matches=places.filter(p=>!query||[p.name,p.detail,p.section,'deck '+p.deck].join(' ').toLocaleLowerCase().includes(query));
  for(const group of groupPlaces(layout,matches)){if(query&&!group.places.length)continue;const d=el('details'),summary=el('summary',group.title+' ('+group.places.length+')');d.dataset.deck=group.id;d.open=!!query||group.deck===currentDeck;d.append(summary);let section='';for(const p of group.places){if(section!==p.section){section=p.section;d.append(el('p',section,'goto-section'));}const button=el('button');button.type='button';button.dataset.place=p.id;button.append(el('b',p.name),el('span',p.detail));button.onclick=()=>{if(go(p)!==false)close();else status.textContent='That landing is blocked right now. Choose another place or use the lifts.';};d.append(button);}groups.append(d);}
  status.textContent=matches.length+' '+(matches.length===1?'destination':'destinations')+(query?' found':' · choose a deck or search');
 };
 search.addEventListener('input',render);render();
 if(!matchMedia('(pointer:coarse)').matches)requestAnimationFrame(()=>search.focus({preventScroll:true}));
}
