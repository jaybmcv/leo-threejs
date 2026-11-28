import * as T from 'three';
import {SECTION,STERN,PALETTE,NOZZLES,STROKE_POINTS,STROKE_TRAVEL,paintStroke,readStroke,sectionFromText,sectionId} from './graffiti-wall.js';
import {paintCell,sternPaintSurfaces} from './graffiti-surface.js';

const SEND_MS=100,LOOK_X=-144;
const REFUSED={'sign-in':'Connect Discord to spray paint. Everyone aboard can look.',slow:'Easy on the nozzle: a moment, then spray again.',
 offline:"The wall paints through Leo live, which isn't connected right now.",waiting:'Fetching the wall.',closed:"The wall isn't open for painting yet."};

// Empty sections get a ray target. A canvas is needed only once a section gets paint.
export function createGraffiti(baked,els,{colliders,live,connect,onOpen,onClose}){
 const {group,meshes,blank}=sternPaintSurfaces(baked),{floor,z0,z1}=STERN;
 const debug=typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__;
 let sections=new Map(),syncing=null,loaded=false,asked=false,askedAt=0,active=false,colour=4,nozzle=1,note='',testLink=null;
 const rgb=PALETTE.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));
 const textures=new Map(),dirty=new Set();
 function surface(id){
  if(textures.has(id))return textures.get(id);
  const canvas=document.createElement('canvas');canvas.width=SECTION.w;canvas.height=SECTION.h;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(SECTION.w,SECTION.h);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
  const material=new T.MeshStandardMaterial({name:'Walk_graffiti_paint',map:texture,transparent:true,depthWrite:false,roughness:.6,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const view={ctx,image,texture,material};textures.set(id,view);meshes[id].material=material;
  return view;
 }
 function pixel(d,i,c){const [r,g,b]=rgb[c-1];d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;}
 function setCell(id,u,v,cells){const i=v*SECTION.w+u;pixel(surface(id).image.data,i*4,cells[i]);dirty.add(id);}
 function replace(next){
  for(const [id,view] of textures){
   if(next.has(id))continue;
   view.texture.dispose();view.material.dispose();textures.delete(id);dirty.delete(id);meshes[id].material=blank;meshes[id].visible=false;
  }
  sections=next;
  for(const [id,cells] of sections){
   const d=surface(id).image.data;d.fill(0);
   for(let i=0;i<cells.length;i++)if(cells[i])pixel(d,i*4,cells[i]);
   dirty.add(id);
  }
 }
 function flushTextures(){
  for(const id of dirty){const {ctx,image,texture}=textures.get(id);ctx.putImageData(image,0,0);texture.needsUpdate=true;meshes[id].visible=true;}
  dirty.clear();
 }

 // The bar keeps the same colours, nozzles and sign-in rules.
 const swatches=PALETTE.map((hex,i)=>{const b=document.createElement('button');b.type='button';b.style.setProperty('--paint',hex);b.setAttribute('aria-label','Colour '+(i+1));b.onclick=()=>{colour=i+1;showBar();};els.colours.append(b);return b;});
 const nozzles=['Fine','Medium','Wide'].map((label,i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.setProperty('--dot',(6+NOZZLES[i]*1.6)+'px');b.onclick=()=>{nozzle=i;showBar();};els.nozzles.append(b);return b;});
 els.done.addEventListener('click',()=>close());els.connect.addEventListener('click',()=>connect());
 const link=()=>{const l=testLink||live();return l?.live?l:null;};
 const verified=()=>!!link()?.you?.verified;
 const canPaint=()=>loaded&&verified();
 function showBar(){
  const why=!link()?'offline':!loaded?(performance.now()-askedAt>4000?'closed':'waiting'):!verified()?'sign-in':'';
  swatches.forEach((b,i)=>{b.setAttribute('aria-pressed',String(colour===i+1));b.disabled=!!why;});
  nozzles.forEach((b,i)=>{b.setAttribute('aria-pressed',String(nozzle===i));b.disabled=!!why;});
  els.note.textContent=note||REFUSED[why]||'Hold and drag to spray. Paint goes over whatever is there.';
  els.connect.hidden=why!=='sign-in';
 }

 const ray=new T.Raycaster(),ndc=new T.Vector2(),aim=new T.Vector3(),stand=new T.Vector3();
 let camera=null,held=null,pending=[],lastSent=null,sentAt=0,travel=0;
 function cellAt(e){
  if(!camera)return null;const r=els.surface.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);const hit=ray.intersectObjects(meshes,false)[0];
  if(!hit?.uv||colliders.raycast(ray.ray,Math.max(0,hit.distance-.03)))return null;
  return paintCell(hit);
 }
 function addPoint(at){
  const prev=pending.length?pending.slice(-2):lastSent;if(prev&&prev[0]===at[0]&&prev[1]===at[1])return;
  const gap=prev?Math.hypot(at[0]-prev[0],at[1]-prev[1]):0;
  if(travel+gap>STROKE_TRAVEL)send();
  if(gap>STROKE_TRAVEL)lastSent=null;
  const from=pending.length?pending.slice(-2):lastSent;
  paintStroke(sections,{c:colour,s:nozzle,p:from?[...from,...at]:at},setCell);
  if(!pending.length&&lastSent)pending.push(...lastSent);pending.push(...at);travel+=from?gap:0;
  if(pending.length>=STROKE_POINTS*2)send();
 }
 function send(){
  if(!pending.length)return;sentAt=performance.now();
  // Repeat the last point to join the next message to this one.
  const stroke={c:colour,s:nozzle,p:pending};lastSent=pending.slice(-2);pending=[];travel=0;link()?.paint(stroke);
 }
 const capture={capture:true};
 els.surface.addEventListener('pointerdown',e=>{
  if(!active)return;e.stopPropagation();e.preventDefault();
  if(!canPaint()||held!==null||e.button!==0)return;const at=cellAt(e);if(!at)return;
  held=e.pointerId;els.surface.setPointerCapture?.(e.pointerId);note='';lastSent=null;pending=[];travel=0;sentAt=performance.now();addPoint(at);
 },capture);
 els.surface.addEventListener('pointermove',e=>{
  if(!active)return;e.stopPropagation();if(held!==e.pointerId)return;const at=cellAt(e);
  if(at)addPoint(at);else{send();lastSent=null;}
 },capture);
 const lift=e=>{if(!active||held!==e.pointerId)return;e.stopPropagation();held=null;send();lastSent=null;};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])els.surface.addEventListener(type,lift,capture);
 els.surface.addEventListener('wheel',e=>{if(active)e.stopPropagation();},capture);

 function open(p){stand.copy(p);active=true;note='';held=null;document.body.classList.add('spraying');els.bar.hidden=false;if(!asked)ask();showBar();onOpen?.();}
 function close(){if(!active)return;if(held!==null){send();held=null;}active=false;camera=null;document.body.classList.remove('spraying');els.bar.hidden=true;onClose?.();}
 function ask(){
  const l=link();if(!l)return;
  asked=true;askedAt=performance.now();loaded=false;syncing=new Map();l.wall(true);
 }
 function reset(){asked=false;loaded=false;syncing=null;held=null;pending=[];lastSent=null;travel=0;}

 return {
  group,
  get active(){return active;},
  near(p){
   if(Math.abs(p.y-floor)>.65||p.x<-228||p.x>-207||p.z<z0-.5||p.z>z1+.5)return null;
   return {kind:'graffiti',label:'Spray paint the wall'};
  },
  // Keep a small sight margin so walking the boundary does not repeatedly fetch the paint.
  load(p){
   if(active||Math.abs(p.y-floor)<1.2&&p.x<LOOK_X+(asked?4:0)){
    if(link()&&(!asked||!loaded&&performance.now()-askedAt>5000))ask();
   }else if(asked||sections.size){if(asked)link()?.wall(false);reset();replace(new Map());}
   if(active)showBar();
  },
  reset,
  wall(msg){
   if(!asked)return;
   if(syncing&&sectionId(msg.section)){const cells=sectionFromText(msg.cells);if(cells)syncing.set(msg.section,cells);}
   if(msg.ready&&syncing){replace(syncing);syncing=null;loaded=true;}
   if(msg.cleared){replace(new Map());syncing?.clear();held=null;pending=[];lastSent=null;travel=0;note='The wall was cleared.';}
   if(active)showBar();
  },
  stroke(msg){const s=loaded&&readStroke(msg);if(s)paintStroke(sections,s,setCell);},
  painted(r){if(r.ok!==false)return;note=REFUSED[r.why]||'';if(loaded&&['slow','closed','sign-in'].includes(r.why)){reset();ask();}if(active)showBar();},
  close,open,
  // Stay below the roof and frame the patch in front of the walker. At the centre, aim beside the obstruction.
  update(view,now=performance.now()){
   if(dirty.size)flushTextures();if(held!==null&&now-sentAt>=SEND_MS)send();
   if(!active)return;camera=view;
   const z=T.MathUtils.clamp(stand.z,z0,z1),x=Math.max(stand.x,-220+.12*Math.max(0,Math.abs(z)-17));
   view.position.set(x,floor+1.86,z);aim.set(-229,33.15,Math.abs(z)<3?(z<0?-5:5):z);
   view.lookAt(aim);view.updateMatrixWorld();
  },
  ...(debug?{setTestLink(l){reset();testLink=l;}}:{})
 };
}
