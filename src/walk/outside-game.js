// Games hosted outside Leo, opened in a window over the walk: Neon Arena Survival (arcade.js) and Asteroid Defense (the
// sealed airlock panel on Deck 1's lifeboat bank). The page loads only when the window opens and is dropped when it
// closes, so nothing outside loads until a visitor chooses to play. The frame is sandboxed without top navigation or popups:
// the game cannot send the visitor away from Leo, and Back to Leo (or Esc, while Leo has the keys) closes the window and
// returns to the walk where they stood. Leo sends the game nothing: no referrer, no visitor identity.
import * as T from 'three';
import {canvasTexture} from '../polish-kit.js';

export const NEON_ARENA_URL='https://neonarenasurvival.grok.me/';
export const GAMES={
 neon:{url:NEON_ARENA_URL,eyebrow:'Deck 17 arcade',title:'Neon Arena Survival',back:'returns you to the arcade',
  sandbox:'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-modals'},
 // Scripts and pointer lock are what play needs; no forms, dialogs, popups or navigation away.
 asteroid:{url:'https://asteroiddefense.grok.me/',eyebrow:'Deck 1 lifeboat bank',title:'Asteroid Defense',back:'returns you to the corridor',
  sandbox:'allow-scripts allow-same-origin allow-pointer-lock',retry:true,wait:12},
};

const LATE='The game has not answered yet. Try Reload game, open it in a new tab, or go Back to Leo.';
let timer=0;
function clear(){clearTimeout(timer);timer=0;}
// The window's words come from the game's entry, so a second game never shows the first one's name.
function dress(sheet,frame,g){
 const q=s=>sheet.querySelector(s);
 q('.eyebrow').textContent=g.eyebrow;q('#outside-title').textContent=g.title;frame.title=g.title;
 const note=q('.note');note.textContent='';
 note.append(`A game from outside Leo, shown in this window. Back to Leo ${g.back}. Not showing? The game’s site may not allow being shown here; `);
 const a=document.createElement('a');a.href=g.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='open it in a new tab';note.append(a,'.');
 sheet.classList.toggle('retryable',!!g.retry);const re=q('[data-reload]');if(re)re.onclick=()=>reloadOutside(sheet,frame);
 frame.setAttribute('sandbox',g.sandbox);frame.setAttribute('referrerpolicy','no-referrer');
}
export function openOutside(sheet,frame,game='neon'){
 const g=GAMES[game]||GAMES.neon,wait=sheet.querySelector('.wait');
 clear();dress(sheet,frame,g);wait.textContent='Loading the game…';
 sheet.classList.toggle('loading',true);sheet.hidden=false;
 frame.onload=()=>{clear();sheet.classList.toggle('loading',false);frame.focus();};
 // A load event only says a page arrived, never that the game runs; what is left to say is in the note and Reload game.
 // If nothing arrives at all, say so rather than wait for ever.
 if(g.wait){const late=()=>{wait.textContent=LATE;};if(navigator.onLine===false)late();else timer=setTimeout(late,g.wait*1000);}
 frame.src=g.url;
 sheet.dataset.game=game;
}
// Starts the same game again from a blank frame.
export function reloadOutside(sheet,frame){frame.onload=null;frame.src='about:blank';openOutside(sheet,frame,sheet.dataset.game);}
// Drops the page, so the game stops and its sound with it. The keys go back to Leo's page.
export function closeOutside(sheet,frame){
 clear();frame.onload=null;sheet.classList.toggle('loading',false);
 const src=frame.getAttribute('src');if(src&&src!=='about:blank')frame.src='about:blank';
 if(document.activeElement===frame)frame.blur();
}

// The sealed airlock and its red button on the lifeboat bank's corridor (Deck 1): a shallow panel on the west face of Tool
// issue and repair 2, standing in the corridor with nothing solid. It is a walk piece in world space, not a part of the
// room (a room's parts stay inside it), and the E prompt takes the button's place from the same numbers. In the room's
// frame the wall's corridor face is x -8.4 and the corridor lies toward -x; the panel is at z -4.75, the button at z -3.3.
export const ASTEROID_ROOM='d01-launch-d-15';
const WALL=-8.4,DOOR_Z=-4.75,BUTTON={x:-8.475,y:1.3,z:-3.3};
// Centre x, y, z, then thickness, height, width, material: the frame sits on the wall face, the rest stands out from it.
const PARTS=[
 [-8.43,1.3,DOOR_Z,.05,2.4,1.7,'navy'],[-8.48,1.2,DOOR_Z,.05,2.2,1.4,'metal'],[-8.515,1.2,DOOR_Z,.02,2.2,.04,'navy'],
 [-8.515,.45,DOOR_Z,.02,.12,1.4,'orange'],[-8.515,2.05,DOOR_Z,.02,.12,1.4,'orange'],[-8.43,BUTTON.y,BUTTON.z,.05,.34,.26,'navy'],
];
function sign(){
 const map=canvasTexture(512,80,(g,w,h)=>{g.fillStyle='#16233a';g.fillRect(0,0,w,h);g.fillStyle='#ffd7b5';g.font='600 46px "Archivo", "Sora", sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('ASTEROID DEFENSE',w/2,h/2+2);});
 const m=new T.Mesh(new T.PlaneGeometry(1.3,.2),new T.MeshBasicMaterial({map,toneMapped:false}));m.rotation.y=-Math.PI/2;m.position.set(-8.47,2.65,DOOR_Z);return m;
}
function panel(){
 const group=new T.Group();group.name='Asteroid_Defense_airlock';
 const mats={navy:new T.MeshStandardMaterial({color:0x16233a,roughness:.6,metalness:.2}),metal:new T.MeshStandardMaterial({color:0xaeb8c2,roughness:.45,metalness:.6}),
  orange:new T.MeshStandardMaterial({color:0xff6a1a,roughness:.6}),red:new T.MeshStandardMaterial({color:0xe0201a,emissive:0xe0201a,emissiveIntensity:.6,roughness:.4}),
  glass:new T.MeshStandardMaterial({color:0x3f9bff,emissive:0x1d5fb5,emissiveIntensity:.7,roughness:.2})};
 for(const [x,y,z,t,h,w,k] of PARTS){const m=new T.Mesh(new T.BoxGeometry(t,h,w),mats[k]);m.position.set(x,y,z);group.add(m);}
 // The round window in the door and the button on its plate, both with their axis out along x.
 const disc=(r,len,x,y,z,k)=>{const m=new T.Mesh(new T.CylinderGeometry(r,r,len,20).rotateZ(Math.PI/2),mats[k]);m.position.set(x,y,z);group.add(m);};
 disc(.21,.02,-8.515,1.75,DOOR_Z,'glass');disc(.07,.05,BUTTON.x-.01,BUTTON.y,BUTTON.z,'red');
 group.add(sign());
 for(const o of group.children)o.userData.noCollide=true;
 return group;
}
export function asteroidStation(layout){
 const room=layout.rooms.find(r=>r.id===ASTEROID_ROOM);
 if(!room)throw Error('Missing Asteroid Defense room');
 const o=room.fittingFrame?.origin||room.frame?.origin||[room.x,room.y,room.z],yaw=room.fittingFrame?.yaw??room.frame?.yaw??room.yaw??0,c=Math.cos(yaw),s=Math.sin(yaw);
 const group=panel();group.position.set(o[0],o[1],o[2]);group.rotation.y=yaw;group.updateMatrixWorld(true);
 const point=[o[0]+c*BUTTON.x+s*BUTTON.z,o[1]+BUTTON.y,o[2]-s*BUTTON.x+c*BUTTON.z];
 return {room:room.id,point,group,
  // On the corridor side of the wall only, standing on this deck: the room's own side gets no prompt.
  near(p){const dx=p.x-o[0],dz=p.z-o[2],u=c*dx-s*dz,v=s*dx+c*dz;
   return p.y-o[1]>-.1&&p.y-o[1]<1&&u<WALL&&Math.hypot(u-BUTTON.x,v-BUTTON.z)<1.6?{kind:'outside',game:'asteroid',label:'Play '+GAMES.asteroid.title}:null;},
 };
}
