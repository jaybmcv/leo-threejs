import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createShip} from '../model.js';
import {shapeInterior} from '../concept-shape.js';
import {applyConceptPaint} from '../concept-paint.js';
import {loadEnvironment} from '../environment.js';
import {publicAsset} from '../public-assets.js';
import {createMars} from '../mars.js';
import motion from './assets/ecctrl-locomotion.json' with {type:'json'};
import {buildSteps,buildColliders,cabinPlacements,outsideOnly,prepareExteriorForWalking} from './world.js';
import {Colliders,solid} from './collision.js';
import {STATIC_LIFT_PARTS} from './lifts.js';
import {Controller} from './controller.js';
import {FollowCamera} from './camera.js';
import {WalkInput} from './input.js';
import {createWalker,WALKER} from './avatar.js';
import {bakeForWalking,showBands} from './render-bake.js';
import {bandOf} from './collision.js';
import {partitionMesh} from './partitions.js';
import partitionPlan from 'walk-partitions';
import {createLifts} from './lift-ride.js';
import {findRestSpots,solidSpots,spotIndex} from './rest.js';
import {PLACES,findStand,describe} from './places.js';

// Walk around Leo: Cosmo on foot through the whole fitted interior, with collision, lifts, seats and beds.
const $=id=>document.getElementById(id);
const timings=[],t0=performance.now();
const status=text=>{$('loading-text').textContent=text;timings.push([text,Math.round(performance.now()-t0)]);};
const renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
const phone=matchMedia('(pointer:coarse)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio,phone?1.25:1.75));renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
$('viewport').appendChild(renderer.domElement);
const scene=new T.Scene();scene.environmentIntensity=.75;
// Space through the windows: stars and Mars in their own pass behind the ship, so the ship's far plane can stay short.
const sky=new T.Scene();sky.background=new T.Color(0x05080d);const skyCamera=new T.PerspectiveCamera(60,1,10,5000);
{let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const p=[];
 for(let i=0;i<1500;i++){const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);p.push(3800*r*Math.cos(a),3800*y,3800*r*Math.sin(a));}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 sky.add(new T.Points(g,new T.PointsMaterial({color:0xd5e2eb,size:1.25,sizeAttenuation:false,transparent:true,opacity:.65})));
 const mars=createMars();mars.position.set(1800,90,-100);sky.add(mars);}
renderer.autoClear=false;
// A light haze down the long corridors lets the far plane stop at 150 m.
scene.fog=new T.Fog(0xd9dcd6,70,148);
const camera=new T.PerspectiveCamera(phone?70:62,1,.05,150);
scene.add(new T.HemisphereLight(0xfff6e6,0x5d6b75,1.05));
const fill=new T.DirectionalLight(0xfff1dc,.55);fill.position.set(.3,1,.2);scene.add(fill);
loadEnvironment(renderer).then(t=>{scene.environment=t;}).catch(()=>{});
function resize(){const w=innerWidth,h=innerHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

const ship=createShip({deferExterior:true,lazyInterior:true});scene.add(ship.root);
const colliders=new Colliders();
const walls=o=>solid(o)&&!STATIC_LIFT_PARTS.test(o.name);

async function loadExterior(){
 const bytes=await publicAsset('leo-exterior-web.glb',p=>status(`Loading Leo… ${p}%`));
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const gltf=bytes?await loader.parseAsync(bytes,''):await loader.loadAsync('leo-exterior-web.glb');
 gltf.scene.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)o.name=gltf.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh&&a?.meshes!==undefined)o.name=o.parent.name;});
 const exterior=gltf.scene.getObjectByName('01_EXTERIOR_REFINED_V31');
 if(!exterior)throw new Error('The saved exterior is missing its root');
 ship.root.remove(ship.exterior);ship.root.add(exterior);Object.assign(ship,{exterior});applyConceptPaint(exterior);
}

const idle=()=>new Promise(r=>(window.requestIdleCallback||setTimeout)(()=>r(),{timeout:60}));
async function buildShip(){
 let done=0;const total=26;
 for(const label of buildSteps(ship)){done++;status(`Building the interior… ${Math.min(99,Math.round(done/total*100))}%`);await idle();}
 shapeInterior(ship.exterior,ship.inside);
 // Lined partitions close the fitted spaces off from the bare deck plate (partitions.js; planned at build time).
 ship.inside.add(partitionMesh(partitionPlan.map(([deck,x0,x1,z0,z1,y0,y1])=>({deck,x0,x1,z0,z1,y0,y1}))));
 ship.inside.traverse(o=>{if(STATIC_LIFT_PARTS.test(o.name))o.visible=false;});
 status('Fitting the walls…');await idle();
 prepareExteriorForWalking(ship);
 buildColliders(ship,{extra:[ship.exterior],filter:walls,into:colliders});
 lifts=createLifts(scene,colliders);
 rest=spotIndex(solidSpots(findRestSpots(ship.inside),colliders));
 status('Dressing the crew…');await idle();
 if(cosmoKit)globalThis.LeoCosmo.dressCats(ship.inside,cosmoKit);
 status('Preparing the walk…');await idle();
 // Decals and seams only matter from outside.
 ship.exterior.traverse(o=>{if(o.isMesh&&outsideOnly(o))o.visible=false;});
 baked=bakeForWalking(ship.root);for(const g of baked.bands.values())scene.add(g);
 // Instanced meshes (the repeated cabins, lifeboat seating, garden planting) draw when their height range is in view;
 // a deck's 499 repeated cabins only from that deck.
 ship.inside.traverse(o=>{if(!o.isInstancedMesh)return;o.updateWorldMatrix(true,false);if(!o.boundingBox)o.computeBoundingBox();
  const box=o.boundingBox.clone().applyMatrix4(o.matrixWorld);let cabins=false,walls=false;for(let q=o;q;q=q.parent){if(q.name==='Remaining_499_furnished_cabins')cabins=true;if(q.name==='Repeated_cabin_walls')walls=true;}
  o.userData.span=[box.min.y,box.max.y];o.userData.cabins=cabins;o.userData.cabinWalls=walls;instanced.push(o);});
 // Furniture in the repeated cabins draws only for the cabins nearest the walker; their walls and doors always draw.
 for(const o of instanced){
  if(!o.userData.cabins||o.userData.cabinWalls||o.count!==499)continue;
  const all=Array.from({length:o.count},(_,i)=>{const m=new T.Matrix4();o.getMatrixAt(i,m);return m;});
  o.userData.near={all,centres:all.map(m=>new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld))};
 }
}
let baked=null,cosmoKit=null,lifts=null,rest=null,resting=null;const instanced=[];
const NEAR_CABINS=40,nearFrom=new T.Vector3(1e9,0,0);
// The deck bands to draw: the walker's own and its neighbours, stretched to whatever the camera's centre and corner rays
// reach, so a tall hall, an atrium or a stairwell shows its full height.
const VIEW_RAYS=[];for(const x of [-.96,-.5,0,.5,.96])for(const y of [-.96,-.5,0,.5,.96])VIEW_RAYS.push([x,y]);let viewSpan=[0,0],lastSpan=0;
function span(p,now){
 if(now-lastSpan<150)return viewSpan;lastSpan=now;
 let low=p.y-3,high=p.y+4;const ray=new T.Raycaster(),ndc=new T.Vector2();
 for(const [x,y] of VIEW_RAYS){ndc.set(x,y);ray.setFromCamera(ndc,camera);const hit=colliders.raycast(ray.ray,90);const yy=hit?hit.point.y:ray.ray.at(90,new T.Vector3()).y;low=Math.min(low,yy-1);high=Math.max(high,yy+1);}
 return viewSpan=[low,high];
}
function cull(p,now=performance.now()){
 const [low,high]=span(p,now);showBands(baked.bands,low,high);let shown=false;
 for(const o of instanced){const [a,b]=o.userData.span,v=o.userData.cabins?a<p.y+3.5&&b>p.y-.5:a<high&&b>low;if(v&&!o.visible)shown=true;o.visible=v;}
 // Re-rank after 3 m of walking, or at once when another deck's cabins come into view.
 if(!shown&&nearFrom.distanceToSquared(p)<9)return;nearFrom.copy(p);
 // Every part of a cabin shares its instance index, so one ranking per deck serves all of that deck's parts.
 const ranks=new Map();
 for(const o of instanced){const near=o.userData.near;if(!near||!o.visible)continue;
  let order=ranks.get(o.parent);if(!order)ranks.set(o.parent,order=near.centres.map((c,i)=>[c.distanceToSquared(p),i]).sort((a,b)=>a[0]-b[0]).slice(0,NEAR_CABINS).map(e=>e[1]));
  order.forEach((i,k)=>o.setMatrixAt(k,near.all[i]));o.count=order.length;o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();
 }
}

const input=new WalkInput(renderer.domElement,{joystick:$('joystick'),stick:$('stick'),onAction:a=>actions[a]?.()});
const follow=new FollowCamera(camera,colliders);
const controller=new Controller(colliders);
let walker=null;
const actions={
 view(){follow.mode=follow.mode==='first'?'third':'first';},
 use(){
  if(!lifts)return;// still loading
  if(resting){standUp();return;}
  const t=target();if(!t)return;
  if(t.kind==='call')lifts.call(t.lift,t.stop);
  else if(t.kind==='inside')openLiftPanel(t.lift);
  else if(t.kind==='sit'||t.kind==='lie')settle(t.spot);
 },
 escape(){closePanels();},
 map(){togglePlaces();},
};

async function loadCosmo(){
 globalThis.LEO_THREE=T;
 await new Promise((resolve,reject)=>{const s=Object.assign(document.createElement('script'),{src:__COSMO_SCRIPT__,async:true});s.onload=resolve;s.onerror=()=>reject(new Error('Cosmo could not load'));document.head.appendChild(s);});
 walker=await createWalker(globalThis.LeoCosmo.createDLCat,motion);scene.add(walker.holder);
 cosmoKit=await globalThis.LeoCosmo.createCosmoKit();
}

// The arrival hall on Deck 2, where travellers come aboard.
const START={position:new T.Vector3(-135,-35.7,-38),yaw:Math.PI/2};
await Promise.all([loadExterior(),loadCosmo()]).catch(e=>{status(e.message);throw e;});
await buildShip();
controller.place(findStand(colliders,START.position.toArray())||START.position);follow.yaw=START.yaw;
walker.holder.position.copy(controller.position);
document.body.dataset.ready='1';
let heading=START.yaw;
// Test hook for dev builds only (scripts set __WALK_DEBUG__); the public build drops it.
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__)globalThis.__walk={T,scene,camera,renderer,ship,colliders,controller,follow,get walker(){return walker;},input,get baked(){return baked;},timings,cabinPlacements,get lifts(){return lifts;},get rest(){return rest;},actions,PLACES,goTo:p=>goTo(p),get resting(){return resting;},
 // Debug: drop the walker at a point (feet), facing yaw, camera pitch.
 teleport(x,y,z,yaw=follow.yaw,pitch=-.18){controller.place(new T.Vector3(x,y,z));follow.yaw=yaw;follow.pitch=pitch;heading=yaw;follow.current=.3;}};

let last=performance.now(),acc=0,lastHud=0;const STEP=1/120,wish=new T.Vector3();
renderer.setAnimationLoop(()=>{
 // Our own clamped clock: with the loop's timestamp argument the fixed steps stalled in testing.
 const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
 const k=input.read();follow.look(k.look.x,k.look.y);if(k.zoom)follow.distance=T.MathUtils.clamp(follow.distance+k.zoom*.4,1.4,6);
 const fwd=follow.forward(),right=new T.Vector3(-fwd.z,0,fwd.x);
 wish.copy(fwd).multiplyScalar(k.y).addScaledVector(right,k.x);
 if(wish.lengthSq()>1)wish.normalize();wish.multiplyScalar(k.run?WALKER.run:WALKER.walk);
 // Moving off a seat or bed stands you up.
 if(resting&&resting.phase==='in'&&resting.t===1&&wish.lengthSq()>.1)standUp();
 lifts.update(dt,controller);
 // Riding a moving car, the car carries the walker; it passes slab edges and the hull skin, which must not push.
 const riding=lifts.lifts.some(l=>l.phase==='moving'&&lifts.inside(l,controller.position));
 if(!resting&&!riding){acc+=dt;let jump=k.jump;while(acc>=STEP){controller.step(STEP,wish,jump);jump=false;acc-=STEP;}}else{acc=0;if(riding)controller.velocity.set(0,0,0);}
 const p=controller.position;
 if(controller.speed>.15&&!resting)heading=dampAngle(heading,Math.atan2(controller.velocity.x,controller.velocity.z),12,dt);
 let pose=null;
 if(resting)pose=restPose(dt);
 if(!resting){walker.holder.position.copy(p);walker.holder.rotation.set(0,heading,0);walker.body.rotation.set(0,0,0);}
 walker.update(dt,{speed:resting?0:controller.speed,airborne:!resting&&!controller.grounded,rest:pose});
 follow.update(dt,resting?resting.view:p,WALKER.height);
 // Hide Cosmo when the camera is pressed right up against him (a lift car, a narrow aisle).
 walker.holder.visible=follow.mode!=='first'&&follow.current>.75;
 cull(p);
 if(now-lastHud>120){lastHud=now;hud(p);}
 skyCamera.position.copy(camera.position);skyCamera.quaternion.copy(camera.quaternion);skyCamera.fov=camera.fov;skyCamera.aspect=camera.aspect;skyCamera.updateProjectionMatrix();
 renderer.clear();renderer.render(sky,skyCamera);renderer.clearDepth();renderer.render(scene,camera);
});
function dampAngle(a,b,lambda,dt){const d=Math.atan2(Math.sin(b-a),Math.cos(b-a));return a+d*(1-Math.exp(-lambda*dt));}

// What's in front of the walker to use: a lift (call button or car panel) first, then a seat or bed.
function target(){
 const p=controller.position,l=lifts.nearest(p);if(l&&l.kind!=='riding')return l;
 const s=rest.pick(p,new T.Vector3(Math.sin(heading),0,Math.cos(heading)));
 return s?{kind:s.kind,spot:s,label:s.kind==='lie'?'Lie down':'Sit down'}:null;
}
const touch=matchMedia('(pointer:coarse)').matches;
function hud(p){
 $('where').textContent=describe(p);
 const t=resting?{label:resting.lie?'Get up':'Stand up'}:target();
 const show=!!t&&t.kind!=='riding',prompt=$('prompt');prompt.hidden=!show||touch;
 if(show){prompt.querySelector('.label').textContent=t.label;$('use').textContent=t.label;}
 $('use').hidden=!show;
}

// Sitting and lying: the walker leaves the controller, eases onto the spot and back off again.
function settle(spot){
 const p=controller.position.clone(),lie=spot.kind==='lie';
 let pos,yaw;
 if(lie){
  const head=spot.head.clone().normalize();yaw=Math.atan2(-head.x,-head.z);
  // The body lies along the bed: the feet's origin at the foot end, the back on the mattress.
  pos=spot.point.clone().addScaledVector(head,-WALKER.height/2+.05);pos.y=spot.height+.13;
 }else{
  const face=spot.facing?spot.facing.clone():new T.Vector3(p.x-spot.point.x,0,p.z-spot.point.z);
  if(face.lengthSq()<1e-6)face.set(Math.sin(heading),0,Math.cos(heading));face.normalize();
  yaw=Math.atan2(face.x,face.z);pos=spot.point.clone().addScaledVector(face,.04);pos.y=spot.height+.06-walker.hipHeight;
 }
 resting={spot,lie,from:{pos:p,heading},to:{pos,yaw},t:0,phase:'in',view:new T.Vector3(spot.point.x,spot.height-(lie?.35:.55),spot.point.z)};
}
function standUp(){if(resting&&resting.phase==='in')resting.phase='out';}
function restPose(dt){
 const r=resting;r.t=T.MathUtils.clamp(r.t+(r.phase==='in'?1:-1)*dt/.7,0,1);
 const e=r.t*r.t*(3-2*r.t),h=walker.holder;
 h.position.lerpVectors(r.from.pos,r.to.pos,e);h.rotation.set(0,lerpAngle(r.from.heading,r.to.yaw,Math.min(1,e*1.6)),0);
 walker.body.rotation.set(r.lie?-Math.PI/2*T.MathUtils.smoothstep(r.t,.25,1):0,0,0);
 if(r.phase==='out'&&r.t===0){heading=r.from.heading;controller.place(r.from.pos);resting=null;return null;}
 return {kind:r.lie?'lie':'sit',weight:e};
}
function lerpAngle(a,b,t){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;}

// The lift panel: one button per stop.
function openLiftPanel(l){
 const panel=$('lift-panel'),list=panel.querySelector('.stops');list.textContent='';
 panel.querySelector('h2').textContent=l.spec.name;
 for(const s of lifts.stopsOf(l)){const b=document.createElement('button');b.type='button';b.textContent=s.label+(s.here?' · here':'');b.disabled=s.here;
  b.onclick=()=>{lifts.call(l,s.index);closePanels();};list.appendChild(b);}
 panel.hidden=false;input.enabled=false;list.querySelector('button:not([disabled])')?.focus();
}
function togglePlaces(){
 const panel=$('places');if(!panel.hidden){closePanels();return;}
 const list=panel.querySelector('.stops');list.textContent='';
 for(const place of PLACES){const b=document.createElement('button');b.type='button';b.append(Object.assign(document.createElement('b'),{textContent:place.name}),Object.assign(document.createElement('span'),{textContent:place.detail}));
  b.onclick=()=>{goTo(place);closePanels();};list.appendChild(b);}
 panel.hidden=false;input.enabled=false;
}
function goTo(place){const q=findStand(colliders,place.at);if(!q)return false;resting=null;controller.place(q);heading=place.yaw;follow.yaw=place.yaw;follow.current=.4;return true;}
// Keys held when a panel opened would otherwise keep walking after it closes.
function closePanels(){for(const id of ['lift-panel','places'])$(id).hidden=true;input.enabled=true;input.down.clear();}
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',closePanels);
$('use').addEventListener('click',()=>actions.use());
$('go').addEventListener('click',togglePlaces);
$('view').addEventListener('click',()=>actions.view());
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();input.jumpQueued=true;});
