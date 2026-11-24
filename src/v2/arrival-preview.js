// The arrival hall, walked while the rest of Leo loads (Otherside asked on 2026-11-19 for the first area first and the
// rest in the background). On a start in the arrival hall (arrival-start.js) the page downloads the arrival pack first
// (scripts/build-arrival-pack.mjs: the hall and the garden above it with its two paintings, cut out of this very prepared
// walk, 5 MB against the ship's 121), and once the visitor is aboard this draws it through the walk's renderer, with
// Cosmo, the welcome guide standing where the walk puts it, and a camera, controller and small collision of its own,
// until the full walk has built behind it. The full walk then takes over where the visitor stands (finish(), called by
// main.js just before its first frame).
// It shares nothing else with the full walk: not its scene, colliders, controller, input, Leo live or loading notes,
// and the full walk still installs its own prepared colliders once and whole. The hall's ways out are closed (solid
// walls, and haze where the drawn cut ends). Anything that goes wrong here only stops it: the loading card comes back
// and the start carries on as before. While the ship decodes and builds behind it, the page's main thread is busy for
// seconds at a time, so this walk stutters then; while the ship downloads it runs freely.
import * as T from 'three';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {Colliders} from '../walk/collision.js';
import {Controller} from '../walk/controller.js';
import {FollowCamera} from '../walk/camera.js';
import {createWalker,WALKER} from '../walk/avatar.js';
import {createWardrobe} from '../walk/wardrobe.js';
import {toWorld,anchoredYaw,yawToWorld} from '../plan/rooms.js';
import motion from '../walk/assets/ecctrl-locomotion.json' with {type:'json'};
import {arrivalPack,arrivalDownload} from './arrival-start.js';
import {preparedResourceReady} from './prepared-resource.public.js';

// The walk's own copies of the paintings' pictures (paintings.js), hashed into the build.
const ART=typeof __ART_URLS__!=='undefined'?__ART_URLS__:{};
const TYPES={Float32Array,Int8Array,Uint8Array,Int16Array,Uint16Array,Uint32Array};
const STEP=1/120,LOOK=.0032,HAZE=0xd9dcd6;
// Frames drawn at most this often (ms): it shares the page's one thread with the ship loading behind it, so it never
// draws faster than a 60 Hz screen, and only 30 a second once the ship is in and the walk builds (the build's turns
// between its steps are what it draws in).
const FRAME_MS=1000/60-1,BUILD_FRAME_MS=1000/30-1;
// The welcome guide stands: what walker.update needs of a walker at rest.
const STILL={unseen:false,speed:0,grounded:true,stance:'stand',jumpCount:0,jumpS:-1,turnRate:0,accel:0,rise:0,emote:null,rest:null,catnip:false,swimming:false,board:null,hook:null};
const dampAngle=(a,b,lambda,dt)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*(1-Math.exp(-lambda*dt));
// A key by its code, or by its name where a browser sends no code (Otherside's Chromium sends an empty code).
const NAMED={w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',' ':'Space',spacebar:'Space',shift:'ShiftLeft',arrowup:'ArrowUp',arrowdown:'ArrowDown',arrowleft:'ArrowLeft',arrowright:'ArrowRight'};
const keyOf=e=>e.code||NAMED[String(e.key||'').toLowerCase()]||'';
const MOVES=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight']);

// The pack: gzip of [u32 header bytes][header JSON][meshopt-encoded arrays, 4-byte aligned].
async function readPack(bytes){
 const raw=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 const size=new DataView(raw.buffer).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(raw.subarray(4,4+size)));
 if(header.format!=='leo-arrival-pack-v1'||header.source!==arrivalPack.source)throw Error('Arrival pack is not for this prepared walk');
 const base=4+size+(4-(4+size)%4)%4;await MeshoptDecoder.ready;
 const array=r=>{const from=raw.subarray(base+r.offset,base+r.offset+r.bytes),out=new Uint8Array(r.count*r.stride);
  if(r.encoding==='meshopt-sequence')MeshoptDecoder.decodeIndexSequence(out,r.count,r.stride,from);else MeshoptDecoder.decodeVertexBuffer(out,r.count,r.stride,from,r.filter);
  return new TYPES[r.type](out.buffer);};
 return {header,array};
}

const soup=positions=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));return new T.Mesh(g);};
// Four upright walls on the box's sides, as triangles: [x0,z0,x1,z1] each.
function walls(box,sides){const out=[],y0=box.min.y,y1=box.max.y;
 for(const [x0,z0,x1,z1] of sides)out.push(x0,y0,z0,x1,y0,z1,x1,y1,z1,x0,y0,z0,x1,y1,z1,x0,y1,z0);return new Float32Array(out);}

/** Starts fetching the pack at once; draws only after `aboard` resolves. Returns {active, finish(), stop()}. */
export function startArrivalPreview({renderer,sky,skyCamera,fov,near,far,environment,aboard,fur,outfit}){
 let state='loading',raf=0,walker=null,guide=null,building=false,drawn=0;const owned=[],off=[];
 preparedResourceReady.then(()=>{building=true;},()=>{});
 const chip=document.getElementById('arrival-chip'),loadingText=document.getElementById('loading-text');
 const scene=new T.Scene();scene.fog=new T.Fog(HAZE,70,148);scene.environmentIntensity=.65;
 const hemi=new T.HemisphereLight(0xeef4ff,0x4f5d68,1),fill=new T.DirectionalLight(0xf2f6ff,.55);fill.position.set(.3,1,.2);scene.add(hemi,fill);
 environment.then(t=>{if(t)scene.environment=t;},()=>{});
 const camera=new T.PerspectiveCamera(fov,innerWidth/Math.max(1,innerHeight),near,far);
 const start=new T.Vector3(...toWorld('d02-arrival-1',[-20,0,0])),startYaw=anchoredYaw('d02-arrival-1',Math.PI/2);
 const down=new Set(),wish=new T.Vector3(),right=new T.Vector3(),grounded=new T.Vector3().copy(start);
 let controller=null,follow=null,heading=startYaw,jumpQueued=false,lookX=0,lookY=0,dragging=false,last=0,acc=0,lastHeading=heading,lastSpeed=0,turnRate=0,accel=0,box=null;
 const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);off.push(()=>target.removeEventListener(type,fn,options));};

 const stop=()=>{if(state==='done')return;state='done';cancelAnimationFrame(raf);for(const f of off.splice(0))f();
  delete document.body.dataset.arrival;if(chip)chip.hidden=true;
  walker?.dispose();walker=null;guide?.dispose();guide=null;
  for(const o of owned)o.dispose?.();owned.length=0;scene.clear();controller=follow=null;};
 // A start that fails while this is drawing gets its failure card back (walk.html shows it over everything).
 const failed=new MutationObserver(()=>{if(document.body.dataset.failed)stop();});failed.observe(document.body,{attributes:true,attributeFilter:['data-failed']});off.push(()=>failed.disconnect());

 const draw=()=>{
  const w=innerWidth,h=innerHeight;if(w&&h&&camera.aspect!==w/h){camera.aspect=w/h;camera.updateProjectionMatrix();}
  camera.updateMatrixWorld(true);skyCamera.position.copy(camera.position);skyCamera.quaternion.copy(camera.quaternion);skyCamera.fov=camera.fov;skyCamera.aspect=camera.aspect;skyCamera.updateProjectionMatrix();
  // The renderer is the walk's: what this changes is put back, whatever the walk was in the middle of.
  const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),scissor=renderer.getScissorTest(),clear=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha();
  try{renderer.setRenderTarget(null);renderer.setScissorTest(false);renderer.clear();renderer.render(sky,skyCamera);renderer.clearDepth();renderer.render(scene,camera);}
  finally{renderer.setRenderTarget(target,face,mip);renderer.setScissorTest(scissor);renderer.setClearColor(clear,alpha);}
 };
 const frame=now=>{
  if(state!=='walking')return;raf=requestAnimationFrame(frame);if(now-drawn<(building?BUILD_FRAME_MS:FRAME_MS))return;drawn=now;
  const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
  follow.look(lookX,lookY);lookX=lookY=0;
  const x=(down.has('KeyD')||down.has('ArrowRight')?1:0)-(down.has('KeyA')||down.has('ArrowLeft')?1:0),y=(down.has('KeyW')||down.has('ArrowUp')?1:0)-(down.has('KeyS')||down.has('ArrowDown')?1:0);
  const fwd=follow.forward();right.set(-fwd.z,0,fwd.x);wish.copy(fwd).multiplyScalar(y).addScaledVector(right,x);if(wish.lengthSq()>1)wish.normalize();
  wish.multiplyScalar(down.has('ShiftLeft')||down.has('ShiftRight')?WALKER.run:WALKER.walk);
  acc+=dt;let pressed=jumpQueued;jumpQueued=false;while(acc>=STEP){controller.step(STEP,wish,pressed||down.has('Space'));pressed=false;acc-=STEP;}
  // Fallen through somewhere the cut left open: back to the start.
  if(controller.position.y<box.min.y-6)controller.place(start);
  if(controller.grounded)grounded.copy(controller.position);
  if(controller.speed>.15)heading=dampAngle(heading,Math.atan2(controller.velocity.x,controller.velocity.z),12,dt);
  if(dt>0){turnRate=T.MathUtils.damp(turnRate,Math.atan2(Math.sin(heading-lastHeading),Math.cos(heading-lastHeading))/dt,10,dt);accel=T.MathUtils.damp(accel,(controller.speed-lastSpeed)/dt,10,dt);}
  lastHeading=heading;lastSpeed=controller.speed;
  walker.holder.position.copy(controller.position);walker.holder.rotation.set(0,heading,0);
  walker.update(dt,{unseen:false,speed:controller.speed,grounded:controller.grounded,stance:controller.stance,jumpCount:controller.jumpCount,jumpS:controller.jumpS,turnRate,accel,rise:controller.velocity.y,emote:null,rest:null,catnip:false,swimming:false,board:null,hook:null});
  guide.update(dt,STILL);
  follow.update(dt,controller.position,WALKER.height,controller.grounded?controller.stance:'stand');
  draw();
 };
 const begin=()=>{
  state='walking';document.body.dataset.arrival='1';
  const keyDown=e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('input,select,textarea'))return;const code=keyOf(e);if(!MOVES.has(code))return;
   if(code==='Space'&&!e.repeat)jumpQueued=true;down.add(code);if(code.startsWith('Arrow')||code==='Space')e.preventDefault();};
  listen(window,'keydown',keyDown);listen(window,'keyup',e=>down.delete(keyOf(e)));listen(window,'blur',()=>down.clear());
  const surface=renderer.domElement;
  listen(surface,'pointerdown',e=>{if(e.button===0||e.button===2)dragging=true;});listen(window,'pointerup',()=>{dragging=false;});
  listen(window,'pointermove',e=>{if(!dragging&&document.pointerLockElement!==surface)return;lookX+=e.movementX*LOOK;lookY+=e.movementY*LOOK;});
  listen(surface,'contextmenu',e=>e.preventDefault());
  if(chip&&loadingText){const say=()=>{chip.querySelector('.line').textContent=loadingText.textContent.replace(/…$/,'');};say();
   const seen=new MutationObserver(say);seen.observe(loadingText,{childList:true,characterData:true,subtree:true});off.push(()=>seen.disconnect());chip.hidden=false;}
  last=performance.now();raf=requestAnimationFrame(frame);
 };

 (async()=>{
  // Asked for as the script started, before the ship (arrival-start.js).
  const [bytes]=await Promise.all([arrivalDownload.bytes,arrivalDownload.cosmo]);if(state==='done')return;
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
  if(sha!==arrivalPack.sha256)throw Error('Arrival pack failed its check');
  const {header,array}=await readPack(bytes);if(state==='done')return;
  box=new T.Box3(new T.Vector3(...header.box[0]),new T.Vector3(...header.box[1]));
  if(!box.containsPoint(start))throw Error('The arrival spot is outside the arrival pack');
  // Its look: the materials and pictures the walk draws there.
  const loader=new T.ObjectLoader(),images=await loader.parseImagesAsync(header.images),textures=loader.parseTextures(header.textures,images),materials=header.materials.map(j=>new T.MaterialLoader().setTextures(textures).parse(j));
  owned.push(...Object.values(textures),...materials);
  const hall=new T.Group();hall.name='Arrival_preview';
  for(const r of header.meshes){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(array(r.position),3));
   if(r.normal)g.setAttribute('normal',new T.InterleavedBufferAttribute(new T.InterleavedBuffer(array(r.normal),4),3,0,true));
   if(r.uv)g.setAttribute('uv',new T.BufferAttribute(array(r.uv),r.uv.stride/4));
   if(r.color)g.setAttribute('color',new T.InterleavedBufferAttribute(new T.InterleavedBuffer(array(r.color),4),r.color.itemSize,0,true));
   g.setIndex(new T.BufferAttribute(array(r.index),1));g.computeBoundingSphere();owned.push(g);
   const mesh=new T.Mesh(g,materials[r.material]);mesh.renderOrder=r.renderOrder;hall.add(mesh);
   // A painting's canvas: its picture, from the same file the walk hangs (and the browser keeps for it).
   if(r.art&&ART[r.art]){const canvas=materials[r.material];new T.TextureLoader().load(ART[r.art],t=>{if(state==='done'){t.dispose();return;}owned.push(t);
    t.colorSpace=T.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();canvas.map=t;canvas.color.set(0xffffff);canvas.needsUpdate=true;},undefined,()=>{});}}
  // The ways out, closed: solid walls on the box's four sides, and haze walls where the drawn cut ends, on the three sides
  // away from the hull (its windows look out to space).
  const {min,max}=box,shut=[[min.x,min.z,min.x,max.z],[max.x,max.z,max.x,min.z],[max.x,max.z,min.x,max.z]],hull=[[min.x,min.z,max.x,min.z]];
  const view=header.view?new T.Box3(new T.Vector3(...header.view[0]),new T.Vector3(...header.view[1])):box,{min:a,max:b}=view;
  const hazeWalls=soup(walls(view,[[a.x,a.z,a.x,b.z],[b.x,b.z,b.x,a.z],[b.x,b.z,a.x,b.z]]));hazeWalls.material=new T.MeshBasicMaterial({color:HAZE,side:T.DoubleSide});owned.push(hazeWalls.geometry,hazeWalls.material);hall.add(hazeWalls);
  scene.add(hall);
  // Collision as the walk keeps it: what stops the walker, and the ground it stands on (ground.js), apart.
  const solid=new Colliders(),ground=new Colliders(),stops=new T.Group();
  stops.add(soup(array(header.collision)),soup(walls(box,[...shut,...hull])));solid.addStatic(stops,o=>o.isMesh);solid.commit();
  ground.addStatic(soup(array(header.ground)),o=>o.isMesh);ground.commit();
  solid.raycastGround=(ray,far)=>ground.raycast(ray,far);
  controller=new Controller(solid);controller.place(start);follow=new FollowCamera(camera,solid);follow.yaw=startYaw;
  walker=await createWalker(globalThis.LeoCosmo.createDLCat,motion);
  if(state==='done'){walker?.dispose();walker=null;return;}
  walker.setFur(fur);createWardrobe(walker.figure).set(outfit);scene.add(walker.holder);
  // The welcome guide (arrival-tour.js) where the walk stands it: a Cosmo as others see one, in the usual hoodie.
  guide=await createWalker(globalThis.LeoCosmo.createDLCat,motion);if(state==='done'){guide.dispose();guide=null;return;}
  guide.setFur(0);createWardrobe(guide.figure).set('default');guide.holder.position.set(...toWorld('d02-arrival-1',[-16,0,-3]));
  guide.holder.rotation.y=yawToWorld('d02-arrival-1',Math.PI/2);scene.add(guide.holder);
  await aboard;if(state==='done')return;
  begin();
 })().catch(e=>{console.warn('Arrival hall preview skipped.',e);stop();});

 return {
  /** True while it draws and takes the keys: the full walk holds back its own until finish(). */
  get active(){return state==='walking';},
  /** Ends it for the full walk's first frame: where the walker last stood on the ground, the way it and the camera
   * faced, or null if it never got to walking. */
  finish(){if(state!=='walking'){stop();return null;}
   const pose={at:grounded.clone(),heading,yaw:follow.yaw,pitch:follow.pitch,distance:follow.distance};stop();return pose;},
  stop,
 };
}
