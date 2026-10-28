import * as T from 'three';
import {WALL,PALETTE,NOZZLES,STROKE_POINTS,paintStroke,wallFromText} from './graffiti-wall.js';

// The graffiti wall on the fin root casing's main face in Deck 19's aft lift lobby (fin-casing.js). Everyone aboard
// shares one wall through Leo live (server/graffiti.mjs): coming near, the page asks for the wall as it is and then
// hears every stroke anyone sprays. E in front of the casing picks up the spray can: the view squares up to the whole
// wall, a bar offers the colours and three nozzles, and holding the button (or a finger) down sprays where it points.
// Strokes go out every tenth of a second while spraying and land on this page at once. Only Discord-verified visitors
// may paint, and the server has the last word: anyone else, or a page with no connection, can look but is told why not.
//
// The paint is one transparent layer a few millimetres proud of the face, its texture a pixel per wall cell, so the
// colours run soft at their edges like spray.
const SEND_MS=100,LOOK_M=40;
const REFUSED={'sign-in':'Connect Discord to spray paint. Everyone aboard can look.',slow:'Easy on the nozzle: a moment, then spray again.',
 offline:'The wall paints through Leo live, which isn’t connected right now.',waiting:'Fetching the wall…',closed:'The wall isn’t open for painting yet.'};

// face: the casing's userData.paintFace {x, z0, z1, y0, y1}, in the casing's frame; matrix: the casing's world matrix.
// els: {bar, colours, nozzles, note, connect, done, surface (the element the scene is drawn in)}.
// live(): the Leo live link or null; connect(): connect Discord; onOpen/onClose: the walk stops and starts again.
export function createGraffiti(face,matrix,els,{live,connect,onOpen,onClose}){
 const width=face.z1-face.z0,height=face.y1-face.y0;
 const canvas=document.createElement('canvas');canvas.width=WALL.w;canvas.height=WALL.h;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(WALL.w,WALL.h);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
 const material=new T.MeshStandardMaterial({name:'Walk_graffiti_paint',map:texture,transparent:true,roughness:.6,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 // A plane's +z faces the lobby (+x) once turned; its u runs along -z, which is left to right as you face it.
 const mesh=new T.Mesh(new T.PlaneGeometry(width,height),material);mesh.name='Walk_graffiti_wall';
 mesh.position.set(face.x+.006,(face.y0+face.y1)/2,(face.z0+face.z1)/2);mesh.rotation.y=Math.PI/2;
 mesh.applyMatrix4(matrix);mesh.updateMatrixWorld(true);
 const centre=mesh.getWorldPosition(new T.Vector3()),normal=new T.Vector3(0,0,1).transformDirection(mesh.matrixWorld),along=new T.Vector3(1,0,0).transformDirection(mesh.matrixWorld);
 const floor=centre.y-height/2-.14;
 let cells=new Uint8Array(WALL.w*WALL.h),loaded=false,asked=false,askedAt=0,active=false,colour=4,nozzle=1,note='';
 const rgb=PALETTE.map(h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)));
 let dirty=false;
 function setCell(u,v){const c=cells[v*WALL.w+u],i=(v*WALL.w+u)*4,d=image.data;if(!c){d[i+3]=0;}else{const [r,g,b]=rgb[c-1];d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;}dirty=true;}
 function redraw(){for(let v=0;v<WALL.h;v++)for(let u=0;u<WALL.w;u++)setCell(u,v);}
 function flushTexture(){if(!dirty)return;dirty=false;ctx.putImageData(image,0,0);texture.needsUpdate=true;}

 // The bar: a button per colour and per nozzle.
 const swatches=PALETTE.map((hex,i)=>{const b=document.createElement('button');b.type='button';b.style.setProperty('--paint',hex);b.setAttribute('aria-label',`Colour ${i+1}`);b.onclick=()=>{colour=i+1;showBar();};els.colours.append(b);return b;});
 const nozzles=['Fine','Medium','Wide'].map((label,i)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.setProperty('--dot',`${6+NOZZLES[i]*1.6}px`);b.onclick=()=>{nozzle=i;showBar();};els.nozzles.append(b);return b;});
 els.done.addEventListener('click',()=>close());
 els.connect.addEventListener('click',()=>connect());
 const link=()=>live()?.live?live():null;
 const verified=()=>!!link()?.you?.verified;
 const canPaint=()=>!!link()&&loaded&&verified();
 function showBar(){
  const why=!link()?'offline':!loaded?(performance.now()-askedAt>4000?'closed':'waiting'):!verified()?'sign-in':'';
  swatches.forEach((b,i)=>{b.setAttribute('aria-pressed',String(colour===i+1));b.disabled=!!why;});
  nozzles.forEach((b,i)=>{b.setAttribute('aria-pressed',String(nozzle===i));b.disabled=!!why;});
  els.note.textContent=note||REFUSED[why]||'Hold and drag to spray. Paint goes over whatever is there.';
  els.connect.hidden=why!=='sign-in';
 }

 // Spraying: the pointer's points on the wall, in cells; laid down here at once, sent in short strokes.
 const ray=new T.Raycaster(),ndc=new T.Vector2();let camera=null,held=null,pending=[],lastSent=null,sentAt=0;
 function cellAt(e){
  if(!camera)return null;const r=els.surface.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);const hit=ray.intersectObject(mesh,false)[0];if(!hit?.uv)return null;
  return [Math.min(WALL.w-1,Math.max(0,Math.floor(hit.uv.x*WALL.w))),Math.min(WALL.h-1,Math.max(0,Math.floor((1-hit.uv.y)*WALL.h)))];
 }
 function addPoint(at){
  const prev=pending.length?pending.slice(-2):lastSent;if(prev&&prev[0]===at[0]&&prev[1]===at[1])return;
  const stroke={c:colour,s:nozzle,p:prev?[...prev,...at]:at};
  paintStroke(cells,stroke,setCell);
  if(!pending.length&&lastSent)pending.push(...lastSent);pending.push(...at);
  if(pending.length>=STROKE_POINTS*2)send();
 }
 function send(){
  if(!pending.length)return;sentAt=performance.now();
  link()?.paint({c:colour,s:nozzle,p:pending});lastSent=pending.slice(-2);pending=[];
 }
 const capture={capture:true};
 els.surface.addEventListener('pointerdown',e=>{
  if(!active)return;e.stopPropagation();e.preventDefault();
  if(!canPaint()||held!==null)return;const at=cellAt(e);if(!at)return;
  held=e.pointerId;els.surface.setPointerCapture?.(e.pointerId);note='';lastSent=null;pending=[];addPoint(at);
 },capture);
 els.surface.addEventListener('pointermove',e=>{
  if(!active)return;e.stopPropagation();if(held!==e.pointerId)return;const at=cellAt(e);if(at)addPoint(at);
 },capture);
 const lift=e=>{if(!active||held!==e.pointerId)return;e.stopPropagation();held=null;send();lastSent=null;};
 els.surface.addEventListener('pointerup',lift,capture);els.surface.addEventListener('pointercancel',lift,capture);
 els.surface.addEventListener('wheel',e=>{if(active)e.stopPropagation();},capture);

 function open(){active=true;note='';held=null;document.body.classList.add('spraying');els.bar.hidden=false;if(!asked)ask();showBar();onOpen?.();}
 function close(){if(!active)return;if(held!==null){send();held=null;}active=false;document.body.classList.remove('spraying');els.bar.hidden=true;onClose?.();}
 function ask(){const l=link();if(!l)return;asked=true;askedAt=performance.now();l.wall();}

 return {
  mesh,
  get active(){return active;},
  // What E offers: standing on the lobby floor in front of the casing's main face, facing more or less toward it.
  near(p){
   const off=new T.Vector3().subVectors(p,centre);const ahead=off.dot(normal),across=Math.abs(off.dot(along));
   if(Math.abs(p.y-floor)>1.2||ahead<.25||ahead>4.5||across>width/2+1.2)return null;
   return {kind:'graffiti',label:'Spray paint the wall'};
  },
  // Every HUD tick: ask for the wall once the walker comes within sight of it.
  load(p){if(!asked&&link()&&Math.abs(p.y-centre.y)<6&&p.distanceTo(centre)<LOOK_M)ask();if(active)showBar();},
  // The connection dropped: ask again when it is back (the wall may have changed meanwhile).
  reset(){asked=false;loaded=false;held=null;pending=[];lastSent=null;if(active)showBar();},
  wall(msg){const back=msg.w===WALL.w&&msg.h===WALL.h?wallFromText(msg.cells):null;if(!back)return;cells=back;loaded=true;redraw();if(msg.cleared)note='The wall was cleared.';if(active)showBar();},
  stroke(msg){if(!loaded)return;const s={c:msg.c,s:msg.s,p:msg.p};if(!Number.isInteger(s.c)||s.c<1||s.c>PALETTE.length||!Number.isInteger(s.s)||!NOZZLES[s.s]||!Array.isArray(s.p)||s.p.length%2||!s.p.every(Number.isInteger))return;paintStroke(cells,s,setCell);},
  // A stroke of ours the server would not take: say why, and take the wall back as the server has it.
  painted(r){if(r.ok!==false)return;note=REFUSED[r.why]||'';if(r.why==='slow'){asked=false;ask();}if(active)showBar();},
  close,open,
  // Each frame: the texture catches up, and while spraying the view squares up to the whole wall.
  update(view,now=performance.now()){
   flushTexture();if(held!==null&&now-sentAt>=SEND_MS)send();
   if(!active)return;camera=view;
   const v=T.MathUtils.degToRad(view.fov)/2,need=Math.max(height*1.12/2/Math.tan(v),width*1.25/2/(Math.tan(v)*view.aspect));
   view.position.copy(centre).addScaledVector(normal,Math.min(4.2,need));view.lookAt(centre);view.updateMatrixWorld();
  },
 };
}
