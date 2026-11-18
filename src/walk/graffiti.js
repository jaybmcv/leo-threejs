import * as T from 'three';
import {WALL,STERN,PALETTE,NOZZLES,STROKE_POINTS,paintStroke,readStroke,readTile,wallFromText} from './graffiti-wall.js';
import {graffitiSurface} from './graffiti-surface.js';

// The existing stern slope carries small independent canvases. Only nearby tiles are subscribed and retained.
const SEND_MS=100,CACHE=36;
const REFUSED={'sign-in':'Connect Discord to spray paint. Everyone aboard can look.',slow:'Easy on the nozzle: a moment, then spray again.',
 offline:'The wall paints through Leo live, which isn’t connected right now.',waiting:'Fetching the wall…',closed:'The wall isn’t open for painting yet.'};
export function createGraffiti(bands,els,{live,connect,onOpen,onClose}){
 const {mesh,tiles}=graffitiSurface(bands),rgb=PALETTE.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));
 let active=false,colour=4,nozzle=1,note='',camera=null,held=null,pending=[],lastSent=null,sentAt=0,painting=null,focusZ=0,askAt=0,testLink=null;
 const link=()=>testLink||(live()?.live?live():null),verified=()=>!!link()?.you?.verified;
 function allocate(tile){
  if(tile.cells)return;tile.cells=new Uint8Array(WALL.w*WALL.h);tile.canvas=document.createElement('canvas');tile.canvas.width=WALL.w;tile.canvas.height=WALL.h;
  tile.ctx=tile.canvas.getContext('2d');tile.image=tile.ctx.createImageData(WALL.w,WALL.h);
  tile.texture=new T.CanvasTexture(tile.canvas);tile.texture.colorSpace=T.SRGBColorSpace;tile.texture.generateMipmaps=false;tile.texture.minFilter=T.LinearFilter;
  tile.mesh.material.map=tile.texture;tile.mesh.material.opacity=1;tile.mesh.material.needsUpdate=true;
 }
 function release(tile){
  tile.texture?.dispose();tile.mesh.visible=false;tile.mesh.material.map=null;tile.mesh.material.opacity=0;tile.mesh.material.needsUpdate=true;
  for(const k of ['cells','canvas','ctx','image','texture','loaded','asked','askedAt','dirty'])delete tile[k];
 }
 function setCell(tile,u,v){
  const c=tile.cells[v*WALL.w+u],i=(v*WALL.w+u)*4,d=tile.image.data;
  if(!c)d[i+3]=0;else{const [r,g,b]=rgb[c-1];d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;tile.mesh.visible=true;}tile.dirty=true;
 }
 const swatches=PALETTE.map((hex,i)=>{const b=document.createElement('button');b.type='button';b.style.setProperty('--paint',hex);b.setAttribute('aria-label',`Colour ${i+1}`);b.onclick=()=>{send();colour=i+1;lastSent=null;showBar();};els.colours.append(b);return b;});
 const nozzles=['Fine','Medium','Wide'].map((label,i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.setProperty('--dot',`${6+NOZZLES[i]*1.6}px`);b.onclick=()=>{send();nozzle=i;lastSent=null;showBar();};els.nozzles.append(b);return b;});
 function showBar(){
  const loaded=[...tiles.values()].some(t=>t.loaded&&Math.abs(t.centre.z-focusZ)<3);
  const why=!link()?'offline':!loaded?'waiting':!verified()?'sign-in':'';
  swatches.forEach((b,i)=>{b.setAttribute('aria-pressed',String(colour===i+1));b.disabled=!!why;});
  nozzles.forEach((b,i)=>{b.setAttribute('aria-pressed',String(nozzle===i));b.disabled=!!why;});
  els.note.textContent=note||REFUSED[why]||'Hold and drag to spray. Paint goes over whatever is there.';els.connect.hidden=why!=='sign-in';
 }
 els.done.addEventListener('click',()=>close());els.connect.addEventListener('click',()=>connect());
 const ray=new T.Raycaster(),ndc=new T.Vector2(),aim=new T.Vector3();
 function cellAt(e){
  if(!camera)return null;const r=els.surface.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObject(mesh,true)[0],tile=tiles.get(hit?.object.userData.tile);if(!hit?.uv||!tile?.loaded)return null;
  return {tile,at:[Math.min(WALL.w-1,Math.max(0,Math.floor(hit.uv.x*WALL.w))),Math.min(WALL.h-1,Math.max(0,Math.floor((1-hit.uv.y)*WALL.h)))]};
 }
 function addPoint({tile,at}){
  if(painting!==tile){send();lastSent=null;painting=tile;}
  const prev=pending.length?pending.slice(-2):lastSent;if(prev&&prev[0]===at[0]&&prev[1]===at[1])return;
  paintStroke(tile.cells,{c:colour,s:nozzle,p:prev?[...prev,...at]:at},(u,v)=>setCell(tile,u,v));tile.used=performance.now();
  if(!pending.length&&lastSent)pending.push(...lastSent);pending.push(...at);if(pending.length>=STROKE_POINTS*2)send();
 }
 function send(){if(!pending.length)return;sentAt=performance.now();link()?.paint({tile:painting.id,c:colour,s:nozzle,p:pending});lastSent=pending.slice(-2);pending=[];}
 const capture={capture:true};
 els.surface.addEventListener('pointerdown',e=>{
  if(!active)return;e.stopPropagation();e.preventDefault();if(!link()||!verified()||held!==null)return;const hit=cellAt(e);if(!hit)return;
  held=e.pointerId;els.surface.setPointerCapture?.(e.pointerId);note='';painting=null;lastSent=null;pending=[];addPoint(hit);
 },capture);
 els.surface.addEventListener('pointermove',e=>{if(!active)return;e.stopPropagation();if(held!==e.pointerId)return;const hit=cellAt(e);if(hit)addPoint(hit);else{send();lastSent=null;}},capture);
 const lift=e=>{if(!active||held!==e.pointerId)return;e.stopPropagation();held=null;send();lastSent=null;painting=null;};
 els.surface.addEventListener('pointerup',lift,capture);els.surface.addEventListener('pointercancel',lift,capture);
 els.surface.addEventListener('wheel',e=>{if(active)e.stopPropagation();},capture);
 function close(){if(!active)return;send();held=null;painting=null;active=false;document.body.classList.remove('spraying');els.bar.hidden=true;onClose?.();}
 return {
  ...(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__?{setTestLink(l){testLink=l;askAt=-Infinity;}}:{}),
  mesh,tiles,get active(){return active;},
  near(p){
   if(Math.abs(p.y-STERN.floor)>1.2||p.x<-226||p.x>-219||p.z<STERN.z0-.5||p.z>STERN.z1+.5)return null;
   focusZ=T.MathUtils.clamp(p.z,STERN.z0+1,STERN.z1-1);return {kind:'graffiti',label:'Spray paint the wall'};
  },
  load(p){
   const now=performance.now(),near=Math.abs(p.y-STERN.floor)<5&&p.x<-210&&p.x>-245;
   const wanted=[...tiles.values()].filter(t=>near&&Math.abs(t.centre.z-p.z)<4.6||t.id==='legacy'&&Math.abs(p.y-STERN.floor)<5&&p.x<-140&&p.x>-245);
   const keep=new Set(wanted);for(const t of wanted)t.used=now;
   const retained=[...tiles.values()].filter(t=>t.cells).sort((a,b)=>(b.used||0)-(a.used||0));
   for(const t of retained.slice(CACHE-wanted.filter(t=>!t.cells).length))if(!keep.has(t)&&t!==painting)release(t);
   for(const t of wanted)if(t.asked&&!t.loaded&&now-t.askedAt>5000)t.asked=false;
   if(link()&&now-askAt>650){const batch=wanted.filter(t=>!t.asked).slice(0,24);if(batch.length){for(const t of batch){allocate(t);t.asked=true;t.askedAt=now;}link().wall(batch.map(t=>t.id),[...tiles.values()].filter(t=>t.asked).map(t=>t.id));askAt=now;}}
   if(active)showBar();
  },
  reset(){for(const t of tiles.values()){t.asked=false;t.loaded=false;}held=null;painting=null;pending=[];lastSent=null;if(active)showBar();},
  wall(msg){
   const tile=tiles.get(readTile(msg.tile));if(!tile?.asked)return;const back=msg.w===WALL.w&&msg.h===WALL.h?wallFromText(msg.cells):null;if(!back)return;
   allocate(tile);tile.cells=back;tile.loaded=true;tile.mesh.visible=false;for(let v=0;v<WALL.h;v++)for(let u=0;u<WALL.w;u++)setCell(tile,u,v);
   if(msg.cleared)note='The wall was cleared.';if(active)showBar();
  },
  stroke(msg){const tile=tiles.get(readTile(msg.tile)),stroke=readStroke(msg);if(tile?.loaded&&stroke)paintStroke(tile.cells,stroke,(u,v)=>setCell(tile,u,v));},
  painted(r){if(r.ok!==false)return;note=REFUSED[r.why]||'';const t=tiles.get(readTile(r.tile));if(t){t.asked=false;t.loaded=false;}if(active)showBar();},
  close,open(){active=true;note='';held=null;document.body.classList.add('spraying');els.bar.hidden=false;showBar();onOpen?.();},
  update(view,now=performance.now()){
   for(const t of tiles.values())if(t.dirty){t.dirty=false;t.ctx.putImageData(t.image,0,0);t.texture.needsUpdate=true;}
   if(held!==null&&now-sentAt>=SEND_MS)send();if(!active)return;camera=view;
   // Stay under the ceiling, above the floor, looking down the slope at the visitor's own stretch.
   view.position.set(-222,33.9,focusZ);aim.set(-232,32.95,focusZ);view.lookAt(aim);view.updateMatrixWorld();
  },
 };
}
