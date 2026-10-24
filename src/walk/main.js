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
import {STATIC_LIFT_PARTS,LIFTS} from './lifts.js';
import {Controller} from './controller.js';
import {FollowCamera} from './camera.js';
import {WalkInput} from './input.js';
import {createWalker,WALKER,EMOTES} from './avatar.js';
import {bakeForWalking,showBands} from './render-bake.js';
import {bandOf} from './collision.js';
import {partitionMesh} from './partitions.js';
import walkPlan from 'walk-partitions';
import {railingMesh} from './railings.js';
import {ShipMap,drawMiniMap,drawFullMap,deckOf} from './minimap.js';
import {DECKS} from '../model.js';
import {floorY} from '../transit.js';
import {createLifts} from './lift-ride.js';
import {findRestSpots,solidSpots,spotIndex} from './rest.js';
import {PLACES,findStand,describe} from './places.js';
import {openWindows,clearGlass} from './windows.js';
import {createHaze} from './haze.js';
import {createStarDrift} from './star-drift.js';
import {createAmbience} from './ambience.js';
import {stairSigns,corridorSigns,floorGuides} from './signs.js';
import {corridorTrim} from './trim.js';
import {connectLive,savedName} from './net/live.js';
import {identify,currentPass,connect,skip,skippedRecently,forget,invite} from './net/connect.js';
import {RemotePlayers} from './remotes.js';
import {createLounge} from './lounge.js';
import {Marks} from './marks.js';
import {createHostess} from './hostess.js';
import {wearHat,fit,FIT} from './hat.js';
import {createYarn,YARN_SPOTS} from './yarn.js';
import {MeshBVH} from 'three-mesh-bvh';
import {readSpot,spotLink} from './link.js';
import {createSelfieBooth} from './selfie.js';
import {createConcession} from './concession.js';
import {createInvasion} from './invasion/game.js';
import {createPoolTable} from './pool/table.js';
import {createPawPool} from './pool/game.js';
import {createPaintings} from './paintings.js';
import {createComics,createComicReader} from './comics.js';
import {createChangesBoards} from './changes-board.js';
import {createTheatre} from './theatre.js';
import {installFeedback,hasTesterInvite,testerInvite} from '../feedback/feedback.js';

// Walk around Leo: Cosmo on foot through the whole fitted interior, with collision, lifts, seats and beds.
const $=id=>document.getElementById(id);
// Building the walk takes about 1 GB at its largest, more than a phone with 4 GB or less can give one tab. walk.html
// asks such phones first, and any browser whose last start never finished (its tab was closed under it), before this
// script loads. The note is set from here until the walk is ready, and cleared on leaving the page, so only a start
// that was cut off leaves it behind.
const STARTING='leo-walk-building';
try{localStorage.setItem(STARTING,String(Date.now()));}catch{}
addEventListener('pagehide',()=>{try{localStorage.removeItem(STARTING);}catch{}});
const timings=[],t0=performance.now();
const status=text=>{$('loading-text').textContent=text;timings.push([text,Math.round(performance.now()-t0)]);};
// Leo live, the multiplayer server (server/leo-live.mjs): its address comes with the build (LEO_LIVE_URL); without one
// the walk is solo, as before. ?live= points a page at another Leo live server on localhost or marscatsvoyage.com.
const LIVE_URL=(()=>{const asked=new URLSearchParams(location.search).get('live');
 if(asked&&/^wss?:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.marscatsvoyage\.com)(:\d+)?\//.test(asked))return asked;
 return typeof __LIVE_URL__!=='undefined'?__LIVE_URL__:'';})();
// Who is walking: their Discord account, through The Creamery (net/connect.js), or nobody in particular. Asked on the
// loading card, while the ship is still to build, so going off to connect Discord costs no waiting. A tester's invite
// link (?invite=, the same code that turns on tester feedback: feedback/feedback.js), or one this browser kept from an
// earlier visit to Leo, always asks, so Leo live can note who used it and their reports can name them.
const tester=invite||testerInvite();
let me={pass:null,name:null,error:null};
const identity=LIVE_URL?identify().then(r=>{me=r;showWho();return r;}):Promise.resolve(me);
function showWho(asking=!me.pass&&(tester||!skippedRecently())){
 $('who').hidden=false;$('who-connected').hidden=!me.pass;$('who-ask').hidden=!asking;
 $('name-field').hidden=!!me.pass||asking;$('who-later').hidden=!!me.pass||asking;
 if(me.pass){$('who-name').textContent=me.name||'Voyager';return;}
 $('name-input').value||=savedName();
 $('who-note').textContent=me.error?(me.error==='cancelled'?'Discord sign-in was cancelled. Try again, or skip for now.':'Discord sign-in didn’t work. Try again, or skip for now.')
  :tester?'You’re invited to test Leo. Connect Discord so we know it’s you.':'Connect Discord so others aboard know it’s you.';
}
if(LIVE_URL){
 $('who-connect').addEventListener('click',connect);$('who-later').addEventListener('click',connect);
 $('who-skip').addEventListener('click',()=>{if(!tester)skip();showWho(false);$('name-input').focus();});
}
const renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
const phone=matchMedia('(pointer:coarse)').matches;
// Resolution: High is the usual sharpness; Medium and Low draw fewer pixels, for slower laptops and phones.
// The Res button steps through them and the choice is remembered for the next visit.
const RES=['High','Med','Low'],RES_SCALE=[1,.75,.5],RES_KEY='leo-walk-resolution',maxRatio=Math.min(devicePixelRatio,phone?1.25:1.75);
let res=Math.max(0,RES.indexOf((()=>{try{return localStorage.getItem(RES_KEY);}catch{return null;}})()));
renderer.setPixelRatio(maxRatio*RES_SCALE[res]);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
$('viewport').appendChild(renderer.domElement);
// A phone short of graphics memory drops the WebGL context: bring the card back with a reason, not a frozen view.
renderer.domElement.addEventListener('webglcontextlost',()=>{document.body.dataset.ready='0';$('loading-text').textContent='The view stopped: this device ran short of graphics memory. Reload to walk again.';});
const scene=new T.Scene();scene.environmentIntensity=.75;
// Space through the windows: stars and Mars in their own pass behind the ship, so the ship's far plane can stay short.
const sky=new T.Scene();sky.background=new T.Color(0x05080d);const skyCamera=new T.PerspectiveCamera(60,1,10,5000);
{let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const p=[];
 for(let i=0;i<1500;i++){const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);p.push(3800*r*Math.cos(a),3800*y,3800*r*Math.sin(a));}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 sky.add(new T.Points(g,new T.PointsMaterial({color:0xd5e2eb,size:1.25,sizeAttenuation:false,transparent:true,opacity:.65})));
 const mars=createMars();mars.position.set(1800,90,-100);sky.add(mars);}
// Nearer stars drift slowly aft past the windows (star-drift.js).
const drift=createStarDrift({count:phone?320:520,still:matchMedia('(prefers-reduced-motion: reduce)').matches});sky.add(drift.points);
renderer.autoClear=false;
// A light haze down the long corridors lets the far plane stop at 150 m.
scene.fog=new T.Fog(0xd9dcd6,70,148);
const camera=new T.PerspectiveCamera(phone?70:62,1,.05,150);
// Past the far plane, the ship in haze rather than open space (haze.js); drawn between the sky and the ship.
const haze=new T.Scene();haze.fog=scene.fog;const hazeCamera=new T.PerspectiveCamera(60,1,camera.far-5,1500);
scene.add(new T.HemisphereLight(0xfff6e6,0x5d6b75,1.05));
const fill=new T.DirectionalLight(0xfff1dc,.55);fill.position.set(.3,1,.2);scene.add(fill);
loadEnvironment(renderer).then(t=>{scene.environment=t;}).catch(()=>{});
function resize(){const w=innerWidth,h=innerHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

const ship=createShip({deferExterior:true,lazyInterior:true});scene.add(ship.root);
const colliders=new Colliders();
// The ship map image is small; it loads alongside the models.
const shipMap=new ShipMap(__MAP_URL__);shipMap.ready.then(()=>{$('minimap-button').hidden=false;}).catch(()=>{});
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
 ship.inside.add(partitionMesh(walkPlan.walls.map(([deck,x0,x1,z0,z1,y0,y1])=>({deck,x0,x1,z0,z1,y0,y1}))));
 // Short railings where a floor drops away (railings.js; planned at build time too).
 ship.inside.add(railingMesh(walkPlan.rails));
 // (The exterior model carries its own copy of the crown lounge, static car floor and all.)
 ship.root.traverse(o=>{if(STATIC_LIFT_PARTS.test(o.name))o.visible=false;});
 // The main lift shafts are walled in nearly clear glass, so with the car away the shaft read as an open drop at your
 // feet. Frost it on foot so it reads as the wall it is.
 const shaftGlass=new T.MeshStandardMaterial({name:'Walk_shaft_glass',color:0xb4c8d2,roughness:.45,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide});
 ship.inside.traverse(o=>{if(/^Lift_(back|side)_enclosure$/.test(o.name))o.material=shaftGlass;});
 status('Fitting the walls…');await idle();
 prepareExteriorForWalking(ship);
 buildColliders(ship,{extra:[ship.exterior],filter:walls,into:colliders});
 // The hull behind the glass goes for drawing only, after the colliders have it.
 const w0=performance.now(),opened=openWindows(ship,walkPlan.windows);clearGlass(ship.root);timings.push([`${opened} hull triangles opened for windows in ${Math.round(performance.now()-w0)} ms`,Math.round(performance.now()-t0)]);
 lifts=createLifts(scene,colliders);stairSigns(lifts.signs,colliders);corridorSigns(lifts.signs);floorGuides(lifts.signs);corridorTrim(lifts.signs);
 rest=spotIndex(solidSpots(findRestSpots(ship.inside),colliders));
 // The Hydro-Nip Lounge's doors and hammocks (lounge.js) leave the ship for meshes of their own before the merge below.
 lounge=createLounge(ship,colliders);
 // The crown lounge's selfie booth (selfie.js): solid, and drawn with its deck band like the signs below.
 booth=createSelfieBooth();colliders.addStatic(booth.group);
 // Paw Pool's table on the Recreation Hall's activity floor (pool/table.js): solid to walk into, its rails too high to step.
 {const carpet=ship.root.getObjectByName('Activity_floor');if(carpet){poolTable=createPoolTable(carpet);colliders.addStatic(poolTable.group);}}
 // The Deck 16 theatre's concession stand (concession.js): solid too.
 concession=createConcession(ship);if(concession)colliders.addStatic(concession);colliders.commit();
 // The forward observation lounge's telescope plays Alien Cat Invasion (invasion/game.js): where it stands, on its floor.
 {const base=ship.root.getObjectByName('Shared_telescope_base');if(base){base.updateWorldMatrix(true,false);scope=base.getWorldPosition(new T.Vector3());scope.y-=.325;}}
 // The Deck 16 theatre's cinema dressing (theatre.js), before baking so the pieces it hides stay out.
 theatre=createTheatre(ship,{url:typeof __REEL_URL__!=='undefined'?__REEL_URL__:'',anisotropy:renderer.capabilities.getMaxAnisotropy()});
 status('Dressing the crew…');await idle();
 if(cosmoKit)globalThis.LeoCosmo.dressCats(ship.inside,cosmoKit);
 status('Preparing the walk…');await idle();
 // Decals and seams only matter from outside.
 ship.exterior.traverse(o=>{if(o.isMesh&&outsideOnly(o))o.visible=false;});
 const b0=performance.now();baked=bakeForWalking(ship.root,{release:true});for(const g of baked.bands.values())scene.add(g);timings.push([`${baked.sources} meshes merged into ${baked.meshes} in ${Math.round(performance.now()-b0)} ms`,Math.round(performance.now()-t0)]);
 haze.add(createHaze(ship));
 // Signs, the selfie booth (selfie.js) and the Crown lounge hostess (hostess.js) draw with the deck band they're on.
 const toBand=o=>{const band=bandOf(o.position.y);let g=baked.bands.get(band);if(!g){g=new T.Group();g.name='Walk_band_'+band;g.userData.band=band;baked.bands.set(band,g);scene.add(g);}g.add(o);};
 for(const o of [...lifts.signs.children,booth.group,...(poolTable?[poolTable.group]:[])])toBand(o);
 if(concession)toBand(concession);
 if(lounge)for(const o of lounge.drawn)toBand(o);
 // The paintings (paintings.js) span several bands each: they draw while any of them is in view.
 // The ship log boards (changes-board.js) in the crown lounge and the arrival hall.
 for(const g of changeLog.groups)toBand(g);
 paintings=createPaintings({urls:artUrls,anisotropy:renderer.capabilities.getMaxAnisotropy()});
 for(const g of paintings.groups){baked.bands.set(g.name,g);scene.add(g);}
 // The comic books (comics.js) lie on counters and tables, drawn with their deck's band.
 comics=createComics({urls:artUrls,anisotropy:renderer.capabilities.getMaxAnisotropy()});for(const g of comics.groups)toBand(g);
 if(cosmoKit)toBand(createHostess(cosmoKit));
 if(theatre)toBand(theatre.group);
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
let baked=null,cosmoKit=null,lifts=null,rest=null,resting=null,booth=null,concession=null,scope=null,poolTable=null,paintings=null,comics=null,theatre=null,lounge=null;
const artUrls=typeof __ART_URLS__!=='undefined'?__ART_URLS__:{};const bodies=[],eye=new T.Vector3();const instanced=[];
const NEAR_CABINS=40,nearFrom=new T.Vector3(1e9,0,0);
// The deck bands to draw: the walker's own and its neighbours, stretched to whatever the camera's centre and corner rays
// reach, so a tall hall, an atrium or a stairwell shows its full height. The rays skip the first 0.6 m: pressed into a
// corner, the camera can sit inside a column, and every ray then stopped on its back faces (a garden's roof was culled).
// Seen through an opening from under a lower ceiling (the lounge from its access ramp), a taller room's ceiling can be in
// view with no ray landing on it, so each ray also looks straight up and down from partway along for the space it crosses.
const VIEW_RAYS=[];for(const x of [-.96,-.5,0,.5,.96])for(const y of [-.96,-.5,0,.5,.96])VIEW_RAYS.push([x,y]);let viewSpan=[0,0],lastSpan=0;
function span(p,now){
 if(now-lastSpan<150)return viewSpan;lastSpan=now;
 let low=p.y-3,high=p.y+4;const ray=new T.Raycaster(),ndc=new T.Vector2(),probe=new T.Ray();
 const reach=y=>{low=Math.min(low,y-1);high=Math.max(high,y+1);};
 for(const [x,y] of VIEW_RAYS){ndc.set(x,y);ray.setFromCamera(ndc,camera);const hit=colliders.raycast(ray.ray,90,.6),d=hit?hit.distance:90;reach(ray.ray.at(d,probe.origin).y);
  for(const f of [1/3,2/3])for(const s of [1,-1]){ray.ray.at(d*f,probe.origin);probe.direction.set(0,s,0);const h=colliders.raycast(probe,12);if(h)reach(h.point.y);}}
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

const input=new WalkInput(renderer.domElement,{joystick:$('joystick'),stick:$('stick'),onAction:(a,arg)=>actions[a]?.(arg)});
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
  else if(t.kind==='waiting')return;
  else if(t.kind==='sit'||t.kind==='lie')settle(t.spot);
  else if(t.kind==='selfie'){if(!booth.counting)live?.selfie();booth.start();}
  else if(t.kind==='comic'){closePanels();reader.open(t.comic);input.enabled=false;}
  else if(t.kind==='play')arcade.open();
  else if(t.kind==='log')changeLog.open();
  else if(t.kind==='pool')pool.open();
 },
 escape(){closePanels();},
 // (Nothing below until the walk is ready.)
 places(){if(ready())togglePlaces();},
 map(){if(ready())toggleMap();},
 crouch(){if(ready()&&!resting){controller.toggle('crouch');emote=null;}},
 prone(){if(ready()&&!resting){controller.toggle('prone');emote=null;}},
 emotes(){if(ready())toggleEmotes();},
 // Respawn: back to the arrival hall from anywhere aboard, off any seat or bed.
 respawn(){if(ready()){closePanels();emote=null;goTo({at:START.position.toArray(),yaw:START.yaw});for(const y of yarns)y.reset();}},
 // A ping where you stand, for others aboard to find (marks.js); one every few seconds at most.
 ping(now=performance.now()){if(!ready()||!live?.live||now-pinged<PING_GAP_MS)return;pinged=now;const at=myPose().pos;live.mark(at);marks.show('me','You',at,now);},
 // Standing still, an emote plays until the walker moves (Voyager's Reach's wheel).
 emote(i){if(ready()&&!resting&&EMOTES[i]&&controller.grounded){emote=EMOTES[i];controller.stance='stand';}},
 // A key pressed while a sheet is open: the key that opened it closes it, and the emote sheet takes 1-0.
 sheet(code){
  const open=id=>!$(id).hidden;
  if((code==='KeyB'&&open('emotes'))||(code==='KeyN'&&open('map-sheet'))||(code==='KeyM'&&open('places'))){closePanels();return;}
  if(open('emotes')&&/^Digit[0-9]$/.test(code)){closePanels();actions.emote((+code.slice(5)+9)%10);}
  if(open('comic-sheet'))reader.key(code);
 },
};
let emote=null,pinged=-Infinity;const PING_GAP_MS=4000;
const ready=()=>document.body.dataset.ready==='1';
// The ship log boards (changes-board.js): the walk stands still while one is open; its hearts are Leo live's.
const changeLog=createChangesBoards({
 onOpen(){closePanels();emote=null;input.enabled=false;},
 onClose(){input.enabled=true;input.down.clear();},
 hearts:{request(){live?.hearts();},toggle(id,on){live?.heart(id,on);}},
});

async function loadCosmo(){
 globalThis.LEO_THREE=T;globalThis.LEO_COSMO_EMOTES=__EMOTES_URL__;
 await new Promise((resolve,reject)=>{const s=Object.assign(document.createElement('script'),{src:__COSMO_SCRIPT__,async:true});s.onload=resolve;s.onerror=()=>reject(new Error('Cosmo could not load'));document.head.appendChild(s);});
 walker=await createWalker(globalThis.LeoCosmo.createDLCat,motion);scene.add(walker.holder);
 cosmoKit=await globalThis.LeoCosmo.createCosmoKit();
}

// The arrival hall on Deck 2, where travellers come aboard.
const START={position:new T.Vector3(-135,-35.7,-38),yaw:Math.PI/2};
// Below this a walker has fallen out of the ship: 3 m under Deck 1's floor.
const BELOW_SHIP=floorY(1)-3;
await Promise.all([loadExterior(),loadCosmo()]).catch(e=>{status(e.message);throw e;});
await buildShip();
try{localStorage.removeItem(STARTING);}catch{}
// A walk link (link.js) starts wherever it was taken; otherwise the arrival hall.
const spot=readSpot(),stand=spot&&findStand(colliders,spot.at);
controller.place(stand||findStand(colliders,START.position.toArray())||START.position);
follow.yaw=stand?spot.yaw:START.yaw;if(stand){follow.pitch=spot.pitch;follow.look(0,0);follow.mode=spot.view;}
walker.holder.position.copy(controller.position);
// Balls of yarn to push about: the arrival hall's, and one in each of six common areas (yarn.js).
const yarn=createYarn(colliders),yarns=[yarn];
for(const s of YARN_SPOTS){const place=PLACES.find(p=>p.name===s.place);if(!place)continue;
 const at=findStand(colliders,place.at.map((v,i)=>v+s.offset[i]),{radius:4});if(at)yarns.push(createYarn(colliders,{at:at.toArray(),color:s.color}));}
for(const y of yarns)scene.add(y.mesh);
document.body.dataset.ready='1';
let heading=follow.yaw;const safe=controller.position.clone(),finSafe=new T.Vector3(0,-1e3,0);
// On the floor of one of the crown lift's fin landings (the gallery and the inspection platforms), inside the fin.
const FIN_STOPS=LIFTS.find(l=>l.id==='crown').stops.filter(s=>!/Crown/.test(s.label)).map(s=>s.y);
function onFinPlatform(p){return p.x<-170&&Math.abs(p.z)<3&&FIN_STOPS.some(y=>Math.abs(p.y-y)<.3);}
// Feedback joins the top-right tools, orange-edged like the viewer's so testers spot it; a narrow phone has no room
// there, so it sits under the mini-map instead.
installFeedback({renderer,page:'walk',mount:()=>matchMedia('(max-width:560px)').matches?null:document.querySelector('.tools'),
 css:'.fb-button:not(.fb-mounted){left:auto;bottom:auto;right:16px;top:180px;z-index:5}.tools .fb-button,.fb-button:not(.fb-mounted){border-color:var(--orange,#f85800);color:#ff8a3d}.tools .fb-button:hover,.fb-button:not(.fb-mounted):hover{background:var(--orange,#f85800);color:#050507}',
 identity:()=>me.pass?{name:me.name||'Voyager',pass:currentPass}:null,
 context:()=>({link:spotLink({position:controller.position,yaw:follow.yaw,pitch:follow.pitch,view:follow.mode}),where:describe(controller.position)}),
 onOpen:()=>{input.enabled=false;input.down.clear();},onClose:()=>{input.enabled=true;input.down.clear();}});
// A tester (this browser holds a tester invite) wears the captain's hat (hat.js).
if(hasTesterInvite())wearHat(walker,__HAT_URL__);
// Others aboard: their poses in, ours out, the lifts as the server runs them.
let live=null,remotes=null,marks=null,aboard=0,liveStatus='';
if(LIVE_URL){
 marks=new Marks($('names'));
 remotes=new RemotePlayers(scene,{make:()=>createWalker(globalThis.LeoCosmo.createDLCat,motion),colliders,lifts,labels:$('names'),hatUrl:__HAT_URL__});
 await identity;
 const name=me.pass?me.name||'':$('name-input').value.trim();
 live=connectLive(LIVE_URL,{
  status:s=>{liveStatus=s;showAboard();changeLog.setStatus(s==='live'?'live':'offline');},
  welcome:msg=>{for(const {id,s} of msg.lifts)lifts.apply(id,s);live.hearts();},
  poses:list=>remotes.onPoses(list),gone:id=>remotes.gone(id),reset:()=>{remotes.clear();marks.clear();},
  mark:(id,at)=>{const r=remotes.remotes.get(id);marks.show(id,r?.name||'Voyager '+id.slice(-4),at);},
  lift:(id,s)=>lifts.apply(id,s),aboard:n=>{aboard=n;showAboard();},
  board:b=>(b.game==='pool'?pool:arcade).setBoard({status:b.verified?'ok':'guest',top:b.top||[],you:b.you||null}),scored:r=>(r.game==='pool'?pool:arcade).setResult(r),
  hearts:h=>changeLog.setHearts(h),hearted:r=>changeLog.refused(r.why),
  // A group photo: someone pressed the selfie camera, and this page takes the photo at the same moment as theirs.
  selfie:(id,ms)=>booth?.start(ms),
 },{pass:()=>me.pass?currentPass():Promise.resolve(null),refused:forget,invite:tester,hat:hasTesterInvite});
 if(!me.pass&&name!==savedName())live.rename(name);
 lifts.onCall=(l,index,opts)=>live.call(l.spec.id,index,opts?.now);
 $('ping').hidden=false;$('help-ping').hidden=false;
}
// The pose others see. Resting, the body is where the bed or seat put it, not where the controller stands.
function myPose(riding=false){
 const h=walker.holder,at=resting?h.position:controller.position;
 return {pos:[at.x,at.y,at.z],yaw:resting?h.rotation.y:heading,g:controller.grounded||riding||!!resting,st:controller.stance,jc:Math.min(3,controller.jumpCount),
  js:T.MathUtils.clamp(controller.jumpS,-1,60),r:T.MathUtils.clamp(controller.velocity.y,-100,100),e:emote,rest:resting?(resting.lie?'lie':'sit'):null,pl:arcade.isOpen||pool.isOpen};
}
// A hidden tab (or a covered window) draws no frames, so when frames stop it says it is still here from a timer
// instead (browsers run one about once a second in the background).
if(live)setInterval(()=>{if(document.hidden||performance.now()-last>1000)live.pose(myPose());},1000);
function showAboard(){
 const b=$('aboard');b.hidden=!live;if(!live)return;
 const text={live:aboard===1?'Just you aboard':`${aboard} aboard`,connecting:'Joining…',offline:'Solo · reconnecting',full:'Solo · Leo is full',replaced:'Solo · open in another tab'}[liveStatus]||'';
 b.querySelector('span').textContent=text;b.dataset.status=liveStatus;
}
// Test hook for dev builds only (scripts set __WALK_DEBUG__); the public build drops it.
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__)globalThis.__walk={T,scene,camera,renderer,ship,colliders,controller,follow,get arcade(){return arcade;},get lounge(){return lounge;},changeLog,get walker(){return walker;},input,get baked(){return baked;},timings,cabinPlacements,get lifts(){return lifts;},get rest(){return rest;},get remotes(){return remotes;},get live(){return live;},hat:{wear:w=>wearHat(w||walker,__HAT_URL__),fit,FIT,MeshBVH},actions,PLACES,goTo:p=>goTo(p),get resting(){return resting;},get booth(){return booth;},yarn,yarns,
 // Debug: drop the walker at a point (feet), facing yaw, camera pitch.
 teleport(x,y,z,yaw=follow.yaw,pitch=-.18){resting=null;controller.place(new T.Vector3(x,y,z));follow.yaw=yaw;follow.pitch=pitch;heading=yaw;follow.current=.3;}};

// The ship map: the corner mini-map, redrawn a few times a second, and the full map sheet.
const mini=$('minimap');let lastMini=0,mapDeck=null,mapShown=[];
function sizeCanvas(c){const r=Math.min(devicePixelRatio||1,2),w=Math.round(c.clientWidth*r),h=Math.round(c.clientHeight*r);if(w&&h&&(c.width!==w||c.height!==h)){c.width=w;c.height=h;}}
function miniMap(p){sizeCanvas(mini);const d=drawMiniMap(mini,shipMap,{x:p.x,y:p.y,z:p.z,yaw:follow.yaw,places:PLACES});$('minimap-deck').textContent=d?`Deck ${d.number}`:p.y>100?'Crown lounge':'Fin';}
function showMap(number){
 mapDeck=T.MathUtils.clamp(number,1,DECKS.length);const c=$('map-canvas');sizeCanvas(c);
 const p=controller.position;mapShown=drawFullMap(c,shipMap,mapDeck,{walker:{x:p.x,y:p.y,z:p.z,yaw:heading},places:PLACES});
 $('map-title').textContent=`Deck ${mapDeck} · ${DECKS[mapDeck-1].name}`;$('map-deck').value=String(mapDeck);
}
function toggleMap(){
 const panel=$('map-sheet');if(!panel.hidden){closePanels();return;}
 panel.hidden=false;input.enabled=false;showMap(deckOf(controller.position.y)?.number??20);
}
{const select=$('map-deck');for(const d of DECKS)select.append(new Option(`Deck ${d.number}`,String(d.number)));select.onchange=()=>showMap(+select.value);
 for(const b of document.querySelectorAll('[data-deck]'))b.addEventListener('click',()=>showMap(mapDeck+Number(b.dataset.deck)));
 // A place marker on the map takes you there.
 $('map-canvas').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  const hit=mapShown.find(s=>Math.hypot(s.x-x,s.y-y)<18);if(hit){goTo(hit.place);closePanels();}});
 $('minimap-button').addEventListener('click',toggleMap);}
let last=performance.now(),acc=0,lastHud=0,lastHeading=heading,lastSpeed=0,turnRate=0,accel=0;const STEP=1/120,wish=new T.Vector3();
const SPEED={stand:WALKER.walk,crouch:WALKER.crouch,slide:WALKER.crouch,prone:WALKER.prone};
renderer.setAnimationLoop(()=>{
 // Our own clamped clock: with the loop's timestamp argument the fixed steps stalled in testing.
 const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
 const k=input.read();follow.look(k.look.x,k.look.y);if(k.zoom)follow.distance=T.MathUtils.clamp(follow.distance+k.zoom*.4,1.4,6);
 const fwd=follow.forward(),right=new T.Vector3(-fwd.z,0,fwd.x);
 wish.copy(fwd).multiplyScalar(k.y).addScaledVector(right,k.x);
 if(wish.lengthSq()>1)wish.normalize();wish.multiplyScalar(controller.stance==='stand'&&k.run?WALKER.run:SPEED[controller.stance]);
 if(emote&&(wish.lengthSq()>.01||k.jump))emote=null;
 // Moving off a seat or bed stands you up.
 if(resting&&resting.phase==='in'&&resting.t===1&&wish.lengthSq()>.1)standUp();
 lifts.update(dt,controller);
 // Riding a moving car, the car carries the walker; it passes slab edges and the hull skin, which must not push.
 const riding=lifts.lifts.some(l=>l.phase==='moving'&&lifts.inside(l,controller.position));
 // A tap shorter than a frame still counts as held for the first step.
 if(!resting&&!riding){acc+=dt;let pressed=k.jump;while(acc>=STEP){controller.step(STEP,wish,pressed||k.held);pressed=false;acc-=STEP;}}else{acc=0;if(riding)controller.velocity.set(0,0,0);}
 for(const y of yarns)y.update(dt,resting||riding?null:controller);
 const p=controller.position;
 // Neither safety net keeps a lift car's floor to return to: the car may have gone by the time it is needed, leaving
 // only the shaft.
 const inCar=lifts.lifts.some(l=>lifts.inside(l,p));
 // A fall over a fin platform's railing ends on the fin's skin with no way out: unless it came down on another
 // landing of the crown lift, it goes back to the platform it left (its last ground may be a rail or spar above it).
 const onLanding=controller.grounded&&!riding&&!inCar&&controller.ground.normal.y>.98&&onFinPlatform(p);
 if(controller.grounded&&!riding&&controller.fell>4&&safe.distanceTo(finSafe)<6&&!onLanding){controller.place(finSafe);emote=null;}
 else if(onLanding)finSafe.copy(p);
 controller.fell=0;
 // Should a walker ever fall out of the ship, it comes back to the last ground it stood on. Nothing aboard is walkable
 // below Deck 1, and the inside of the hull under it (-54.6 m) used to catch fallers and count as safe ground.
 if(p.y<BELOW_SHIP){controller.place(safe);emote=null;}
 else if(controller.grounded&&!inCar)safe.copy(p);
 if(controller.speed>.15&&!resting)heading=dampAngle(heading,Math.atan2(controller.velocity.x,controller.velocity.z),12,dt);
 // What the figure leans into: the turn (+ to its left) and the change of speed, both smoothed a little.
 if(dt>0){turnRate=T.MathUtils.damp(turnRate,Math.atan2(Math.sin(heading-lastHeading),Math.cos(heading-lastHeading))/dt,10,dt);accel=T.MathUtils.damp(accel,(controller.speed-lastSpeed)/dt,10,dt);}
 lastHeading=heading;lastSpeed=controller.speed;
 let pose=null;
 if(resting)pose=restPose(dt);
 if(!resting){walker.holder.position.copy(p);walker.holder.rotation.set(0,heading,0);walker.body.rotation.set(0,0,0);}
 walker.update(dt,{speed:controller.speed,grounded:controller.grounded||riding,stance:controller.stance,jumpCount:controller.jumpCount,jumpS:controller.jumpS,
  turnRate,accel,rise:controller.velocity.y,emote,rest:pose});
 live?.pose(myPose(riding),now);
 follow.update(dt,resting?resting.view:p,WALKER.height);
 // Hide Cosmo when the camera is pressed right up against him (a lift car, a narrow aisle).
 walker.holder.visible=follow.mode!=='first'&&follow.current>.75;
 cull(p);
 remotes?.update(dt,{camera,low:viewSpan[0],high:viewSpan[1]},now);
 // The lounge's doors open for anyone near them.
 if(lounge){bodies.length=0;bodies.push(p);if(remotes)for(const r of remotes.remotes.values())bodies.push(r.cur);lounge.update(dt,bodies,camera.getWorldPosition(eye));}
 marks?.update(camera,p,now);
 if(now-lastHud>120){lastHud=now;hud(p);paintings.update(p);comics.update(p);theatre?.update(p);}
 if(now-lastMini>66&&!$('minimap-button').hidden){lastMini=now;miniMap(p);}
 drift.update(dt);
 // A game covers the window: the ship need not be drawn behind it.
 if(!arcade.isOpen&&!pool.isOpen)draw(camera);
 const shot=booth.update(now);$('countdown').hidden=!shot.left;if(shot.left)$('countdown').textContent=String(shot.left);
 if(shot.due)takePhoto();
});
// One frame of the ship from `view`: the sky, the haze past the far plane, then the ship.
function draw(view){
 for(const c of [skyCamera,hazeCamera]){c.position.copy(view.position);c.quaternion.copy(view.quaternion);c.fov=view.fov;c.aspect=view.aspect;c.updateProjectionMatrix();}
 renderer.clear();renderer.render(sky,skyCamera);renderer.clearDepth();renderer.render(haze,hazeCamera);renderer.clearDepth();renderer.render(scene,view);
}
// The selfie booth's photo: drawn from its lens and copied off the canvas at once (the drawing buffer is not kept past
// this frame), then the walker's own view drawn back over it.
let photoUrl=null;
function takePhoto(){
 const canvas=renderer.domElement,shown=walker.holder.visible;walker.holder.visible=true;
 booth.aim(canvas.width,canvas.height);booth.camera.updateMatrixWorld();draw(booth.camera);
 const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);
 walker.holder.visible=shown;draw(camera);
 const flash=$('photo-flash');flash.hidden=false;flash.getAnimations?.().forEach(a=>a.cancel());flash.animate?.([{opacity:.85},{opacity:0}],{duration:450}).finished.then(()=>{flash.hidden=true;},()=>{});
 booth.frame(copy).then(out=>out.toBlob(blob=>{if(blob)showPhoto(blob);},'image/jpeg',.92));
}
function showPhoto(blob){
 if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=URL.createObjectURL(blob);
 const name=`leo-crown-lounge-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.jpg`;
 $('photo-image').src=photoUrl;Object.assign($('photo-save'),{href:photoUrl,download:name});
 // Where the browser can share files (most phones), sharing is the easy way to keep or send it.
 const file=new File([blob],name,{type:'image/jpeg'}),share=$('photo-share');
 share.hidden=!navigator.canShare?.({files:[file]});share.onclick=()=>navigator.share({files:[file],title:'Leo · Crown lounge'}).catch(()=>{});
 closePanels();$('photo-sheet').hidden=false;input.enabled=false;
}
function dampAngle(a,b,lambda,dt){const d=Math.atan2(Math.sin(b-a),Math.cos(b-a));return a+d*(1-Math.exp(-lambda*dt));}

// What's in front of the walker to use: a lift (call button or car panel) first, then the selfie camera, a comic book,
// a ship log board, the telescope, then a seat or bed.
function target(){
 const p=controller.position,l=lifts.nearest(p);if(l&&l.kind!=='riding')return l;
 const b=booth.near(p)||comics.near(p);if(b)return b;
 const g=changeLog.near(p);if(g)return g;
 if(scope&&Math.abs(p.y-scope.y)<1.5&&Math.hypot(p.x-scope.x,p.z-scope.z)<2)return {kind:'play',label:'Play Alien Cat Invasion'};
 const q=poolTable?.near(p);if(q)return q;
 const s=rest.pick(p,new T.Vector3(Math.sin(heading),0,Math.cos(heading)));
 return s?{kind:s.kind,spot:s,label:s.kind==='lie'?'Lie down':'Sit down'}:null;
}
const touch=matchMedia('(pointer:coarse)').matches;
function hud(p){
 $('where').textContent=describe(p);
 const t=resting?{label:resting.lie?'Get up':'Stand up'}:target();
 const show=!!t&&t.kind!=='riding',prompt=$('prompt');prompt.hidden=!show||touch;
 // Waiting for a called lift there's nothing to press: the prompt just says where the car is.
 const waiting=t?.kind==='waiting';prompt.classList.toggle('waiting',waiting);$('use').disabled=waiting;
 if(show){prompt.querySelector('.label').textContent=t.label;$('use').textContent=t.label;}
 $('use').hidden=!show;
}

// Sitting and lying: the walker leaves the controller, eases onto the spot and back off again.
function settle(spot){
 emote=null;
 const p=controller.position.clone(),lie=spot.kind==='lie';
 let pos,yaw;
 if(lie){
  const head=spot.head.clone().normalize();yaw=Math.atan2(-head.x,-head.z);
  // The body lies along the bed, the back on the mattress and the head on the near half of the pillow (any further and
  // it meets the headboard); restPose tips the upper body up onto the pillow.
  pos=spot.point.clone().addScaledVector(head,-WALKER.height/2+.25);pos.y=spot.height+.13;
  // A hammock (lounge.js) has no pillow: the body lies centred along it, clear of the bars at both ends.
  if(spot.hammock)pos.copy(spot.point).addScaledVector(head,-WALKER.height/2).setY(spot.height+.13);
 }else{
  const face=spot.facing?spot.facing.clone():new T.Vector3(p.x-spot.point.x,0,p.z-spot.point.z);
  if(face.lengthSq()<1e-6)face.set(Math.sin(heading),0,Math.cos(heading));face.normalize();
  yaw=Math.atan2(face.x,face.z);pos=spot.point.clone().addScaledVector(face,.04);pos.y=spot.height+.06-walker.hipHeight;
 }
 resting={spot,lie,from:{pos:p,heading},to:{pos,yaw},t:0,phase:'in',view:new T.Vector3(spot.point.x,spot.height-(lie?.35:.55),spot.point.z)};
}
const PILLOW_TILT=.12;
function standUp(){if(resting&&resting.phase==='in')resting.phase='out';}
function restPose(dt){
 const r=resting;r.t=T.MathUtils.clamp(r.t+(r.phase==='in'?1:-1)*dt/.7,0,1);
 const e=r.t*r.t*(3-2*r.t),h=walker.holder;
 h.position.lerpVectors(r.from.pos,r.to.pos,e);h.rotation.set(0,lerpAngle(r.from.heading,r.to.yaw,Math.min(1,e*1.6)),0);
 walker.body.rotation.set(r.lie?(-Math.PI/2+PILLOW_TILT)*T.MathUtils.smoothstep(r.t,.25,1):0,0,0);
 // In a hammock (lounge.js) the body swings with it.
 const swing=r.spot.hammock&&lounge?.swingOf(r.spot.hammock);
 if(swing){const q=new T.Quaternion().setFromAxisAngle(swing.axis,swing.angle*e);h.position.sub(swing.pivot).applyQuaternion(q).add(swing.pivot);h.quaternion.premultiply(q);}
 if(r.phase==='out'&&r.t===0){heading=r.from.heading;controller.place(r.from.pos);resting=null;return null;}
 return {kind:r.lie?'lie':'sit',weight:e,seatHeight:walker.hipHeight};
}
function lerpAngle(a,b,t){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;}

// The lift panel: one button per stop.
function openLiftPanel(l){
 const panel=$('lift-panel'),list=panel.querySelector('.stops');list.textContent='';
 panel.querySelector('h2').textContent=l.spec.name;
 for(const s of lifts.stopsOf(l)){const b=document.createElement('button');b.type='button';b.textContent=s.label+(s.here?' · here':'');b.disabled=s.here;
  b.onclick=()=>{lifts.call(l,s.index,{now:true});closePanels();};list.appendChild(b);}
 panel.hidden=false;input.enabled=false;list.querySelector('button:not([disabled])')?.focus();
}
function togglePlaces(){
 const panel=$('places');if(!panel.hidden){closePanels();return;}
 const list=panel.querySelector('.stops');list.textContent='';
 for(const place of PLACES){const b=document.createElement('button');b.type='button';b.append(Object.assign(document.createElement('b'),{textContent:place.name}),Object.assign(document.createElement('span'),{textContent:place.detail}));
  b.onclick=()=>{goTo(place);closePanels();};list.appendChild(b);}
 panel.hidden=false;input.enabled=false;
}
// The emotes sheet: one button per emote (also keys 1-0).
function toggleEmotes(){
 const panel=$('emotes');if(!panel)return;if(!panel.hidden){closePanels();return;}
 const list=panel.querySelector('.stops');list.textContent='';
 EMOTES.forEach((name,i)=>{const b=document.createElement('button');b.type='button';const label=name.replace(/_/g,' ');b.textContent=`${(i+1)%10} · ${label[0].toUpperCase()}${label.slice(1)}`;b.onclick=()=>{closePanels();actions.emote(i);};list.appendChild(b);});
 panel.hidden=false;input.enabled=false;list.querySelector('button')?.focus();
}
function goTo(place){const q=findStand(colliders,place.at);if(!q)return false;resting=null;controller.place(q);heading=place.yaw;follow.yaw=place.yaw;follow.current=.4;return true;}
// Keys held when a panel opened would otherwise keep walking after it closes.
function closePanels(){for(const id of ['lift-panel','places','emotes','map-sheet','name-sheet','photo-sheet','comic-sheet'])$(id).hidden=true;input.enabled=true;input.down.clear();}
// The name others see over your head.
$('aboard').addEventListener('click',()=>{
 // Connected, the name aboard is the Discord name; otherwise one of your choosing, or connect Discord instead.
 const verified=!!live?.you?.verified;$('name-sheet').dataset.verified=verified?'1':'';
 $('name-title').textContent=verified?`Aboard as ${live.you.name}`:'Your name';
 $('name-edit').value=savedName();$('name-sheet').hidden=false;input.enabled=false;if(!verified)$('name-edit').focus();});
$('name-connect').addEventListener('click',connect);
$('name-form').addEventListener('submit',e=>{e.preventDefault();live?.rename($('name-edit').value.trim());closePanels();});
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',closePanels);
$('use').addEventListener('click',()=>actions.use());
// The comic reader (comics.js); Finish on the last page closes it.
const reader=createComicReader($('comic-sheet'),{urls:artUrls,onClose:closePanels});
$('go').addEventListener('click',togglePlaces);
$('view').addEventListener('click',()=>actions.view());
// The ship's hum and chimes (ambience.js), off until asked for.
const ambience=createAmbience(),sound=$('sound');sound.setAttribute('aria-pressed',String(ambience.on));
// Alien Cat Invasion at the lounge telescope (invasion/game.js): the walk stands still behind it, its sound follows the
// ship's, and its leaderboard is Leo live's (signed-in players only).
const arcade=createInvasion({
 onOpen(){closePanels();emote=null;input.enabled=false;},
 onClose(){input.enabled=true;input.down.clear();},
 muted:()=>!ambience.on,
 scores:{
  request(){if(live?.live)live.board();else arcade.setBoard({status:'offline'});},
  start(){if(live?.live)live.play();},
  submit(score,wave){if(live?.live)live.score(score,wave);else arcade.setResult({ok:false,why:'offline'});},
 },
});
// Paw Pool at the Recreation Hall's table (pool/game.js), the same way: its fastest clears are Leo live's second board.
const pool=createPawPool({
 onOpen(){closePanels();emote=null;input.enabled=false;},
 onClose(){input.enabled=true;input.down.clear();},
 muted:()=>!ambience.on,
 scores:{
  request(){if(live?.live)live.board('pool');else pool.setBoard({status:'offline'});},
  start(){if(live?.live)live.play('pool');},
  submit(ms,shots){if(live?.live)live.cleared(ms,shots);else pool.setResult({ok:false,why:'offline'});},
 },
});
sound.addEventListener('click',()=>sound.setAttribute('aria-pressed',String(ambience.toggle())));
// Render resolution, set up with the renderer: each press steps High, Med, Low and round again.
const resButton=$('resolution'),showRes=()=>{resButton.textContent=`Res ${RES[res]}`;};showRes();
resButton.addEventListener('click',()=>{res=(res+1)%RES.length;try{localStorage.setItem(RES_KEY,RES[res]);}catch{}
 renderer.setPixelRatio(maxRatio*RES_SCALE[res]);showRes();});
// Held for a higher jump, as Space is.
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();input.jumpQueued=true;input.jumpHeld=true;$('jump').setPointerCapture(e.pointerId);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('jump').addEventListener(type,()=>{input.jumpHeld=false;});
$('crouch').addEventListener('click',()=>actions.crouch());
$('emote-button').addEventListener('click',()=>actions.emotes());
$('ping').addEventListener('click',()=>actions.ping());
for(const b of document.querySelectorAll('.respawn'))b.addEventListener('click',()=>actions.respawn());
