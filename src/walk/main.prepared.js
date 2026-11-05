import {createAtriumGeometryRuntime} from '../v2/atrium-geometry-runtime.js';
import {getAtriumQuality,observeAtriumFrame} from '../v2/atrium-quality.js';
import {mountGraphicsSettings} from './graphics-settings.js';
import {mountControlsSettings} from './controls-settings.js';
import {mountFurSettings} from './fur-settings.js';
import {savedFur} from './fur-colours.js';
let furColour=savedFur(),furSettings=null;
import {walkBindings,bindingLabel} from './bindings.js';
let atriumGeometry=null,graphicsSettings=null,controlsSettings=null;
import {ATRIUM_VIEW} from '../v2/atrium-render-policy.js';
import {settlePreparedStatic} from '../v2/prepared-static.js';
import {setAtriumView,setAtriumSight,inOpenAtrium,atriumViewSpan,onePassAtriumGlass} from '../v2/atrium-visibility.js';
import {createAtriumSight} from '../v2/atrium-sight.js';
import {loadPreparedShip,preparedBake,preparedFacade,preparedHaze,preparedPlacements,preparedDecks,preparedSigns} from '../v2/prepared-runtime.js';
import {renderGotoMenu} from '../v2/goto-menu.js';
import {gotoStand as v2GotoStand,yarnPlace} from '../v2/wayfinding.js';
import {addWayfindingGuides} from '../v2/wayfinding-guides.js';
import {createHangarDoor} from '../v2/hangar-door.js';
let hangarDoor=null;
import {visibilityState} from '../v2/visibility-state.js';
const spanChanged=visibilityState(),renderMetrics={span:[]};let spanQuery=null;
import {createVisibilityQuery} from '../v2/visibility-query.js';
import {installDistantArchitecture} from '../v2/distant-architecture.js';
import {batchLowDeckDraws,separateAtriumPaving} from '../v2/facade.js';
import {phase4Culling} from '../v2/phase4-culling.js';
let phase4Visibility=null;
import {v2Signs} from '../v2/signs.js';
import {isolateStaticWorld} from '../v2/facade.js';
import {createCabinGlass} from '../v2/prepared-cabin-glass.js';
import {crewGalleryController} from '../v2/crew-gallery.js';
let cabinGlass=null,crewGallery=null;
import '../plan/debug.js';
import {interactionTargets} from '../plan/debug-targets.js';
import {prepareWalkWorld} from './prepare.prepared.js';
import {registry,toWorld,anchoredYaw,anchoredOffset,deferRoomFrames} from '../plan/rooms.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createShip} from '../model.js';
import {shapeInterior} from '../concept-shape.js';
import {applyConceptPaint} from '../concept-paint.js';
import {loadEnvironment} from '../environment.js';
import {publicAsset} from '../v2/public-assets.js';
import {createMars} from '../mars.js';
import motion from './assets/ecctrl-locomotion.json' with {type:'json'};
const cabinPlacements=preparedPlacements;
import {Colliders,BODY} from './collision.js';
import {STATIC_LIFT_PARTS,LIFTS} from './lifts.js';
import {Controller} from './controller.js';
import {FollowCamera} from './camera.js';
import {WalkInput} from './input.js';
import {createWalker,WALKER,EMOTES} from './avatar.js';
import {bakeForWalking,showBands} from '../v2/render-bake.js';
import {bandOf} from './collision.js';
import {partitionMesh} from './partitions.js';
import walkPlan from 'walk-partitions';
import {railingMesh} from '../v2/railings.js';
import {ShipMap,drawMiniMap,drawFullMap,deckOf} from './minimap.prepared.js';
const DECKS=preparedDecks;
import {floorY} from '../transit.js';
import {createLifts} from './lift-ride.prepared.js';
import {spotIndex} from '../v2/rest.js';
import {PLACES,findStand,describe} from './places.js';
import {openWindows,clearGlass} from './windows.js';
import {createHaze} from '../v2/haze.js';
import {createStarDrift} from './star-drift.js';
import {createAmbience} from './ambience.js';
import {createLullaby} from './lullaby.js';
import {createLoungeSound} from './lounge-sound.js';
import {stairSigns,corridorSigns,floorGuides} from './signs.prepared.js';
import {corridorTrim} from './trim.prepared.js';
import {connectLive,savedName,httpBase} from './net/live.js';
import {identify,currentPass,bestPass,connect,connectPopup,forget,invite} from './net/connect.js';
import {inOtherside,onGlyph} from './net/otherside.js';
import {RemotePlayers} from './remotes.js';
import {glossLoungeFloor,quietFloorReflections} from './lounge-floor.js';
import {tileLiftFloor} from './lift-tile-floor.js';
import {createRecoveryMood} from './recovery.js';
import {createArrivalMood} from './arrival-mood.js';
import {Marks} from './marks.prepared.js';
import {createChat} from './chat.js';
import {createHostess} from './hostess.prepared.js';
import {wearHat,fit,FIT} from './hat.js';
import {createYarn,YARN_SPOTS} from './yarn.js';
import {BALL,createBallMesh} from './hamster-ball.js';
import {ballBounce,ballDismount} from './ball-bounce.js';
import {MeshBVH} from 'three-mesh-bvh';
import {readSpot,spotLink,remapSpot} from './link.js';
import {KITTEN_POSE_NAMES} from './kittens.prepared.js';
import {createAtriumKittens} from './arrival-atrium.prepared.js';
import {createSurgeryArms} from './surgery.prepared.js';
import {createImagingScans} from './imaging.js';
import {createMissionTimer} from './mission-timer.js';
import {createFinCasing} from './fin-casing.js';
import {createGraffiti} from './graffiti.js';
import {createCrownTv} from './crown-tv.js';
import {createInvasion} from './invasion/game.js';
import {createEmergencyDrill} from './emergency-drill/game.js';
import {drillStation} from './emergency-drill/station.js';
import layout from '../plan/selected-layout.js';
let emergencyDrill=null;const emergencyStation=drillStation(layout);
import {createPawPool} from './pool/game.js';
import {createPinball} from './pinball/game.js';
import {openOutside,closeOutside} from './outside-game.js';
import {createMazeGame} from './maze/run.js';
import {createTreasureGame} from './aquarium-treasure/game.js';
import {createPawsOff} from './paws-off/game.prepared.js';
import {createMudwater} from './mudwater.prepared.js';
import {createGiveaway} from './mudwater-giveaway.js';
import {createPaintings} from './paintings.prepared.js';
import {createComics,createComicReader} from './comics.prepared.js';
import {showInfo} from './chinampa.js';
import {createChangesBoards} from './changes-board.prepared.js';
import {createTheatre,ACTOR_POSE_NAMES} from './theatre.prepared.js';
import {createGamingLounge} from './gaming-lounge.prepared.js';
import {createCommsDisplays} from './comms-displays.prepared.js';
import {createHalloween} from './halloween.js';
import {createHexFloor} from './hex-floor.prepared.js';
import {createLoungeCompass} from './lounge-compass.prepared.js';
import {createLeverPanel} from './lever-panel.js';
import {createTransporters} from './transporter.js';
import {installFeedback,hasTesterInvite,testerInvite} from '../feedback/feedback.js';
import {createHelp} from './help.js';
import {createArrivalTour} from './arrival-tour.js';
let arrivalTour=null;
import {listenForHub} from './hub-link.js';
import {createHubPanel} from './hub-panel.js';

// Walk around Leo: Cosmo on foot through the whole fitted interior, with collision, lifts, seats and beds.
const $=id=>document.getElementById(id);
// Building the walk takes about 2 GB at its largest, more than a phone with 4 GB or less can give one tab. walk.html
// asks such phones first, and any browser whose last start never finished (its tab was closed under it), before this
// script loads. The note is set from here until the walk is ready, and cleared on leaving the page, so only a start
// that was cut off leaves it behind.
const STARTING='leo-walk-building';
try{localStorage.setItem(STARTING,String(Date.now()));}catch{}
addEventListener('pagehide',()=>{try{localStorage.removeItem(STARTING);}catch{}});
// From the first moment, so the Builder's Hub knows a walk is on its way and doesn't start a second one.
const hubLink=listenForHub();
const timings=[],t0=performance.now();
// Still building after 20 s means an older machine, with stages ahead that hold the page for a minute at a time: say so,
// or the browser's "page not responding" prompt looks like the walk has failed.
const status=text=>{$('loading-text').textContent=text;timings.push([text,Math.round(performance.now()-t0)]);if(performance.now()-t0>20000)$('loading-slow').hidden=false;};
// Leo live, the multiplayer server (server/leo-live.mjs): its address comes with the build (LEO_LIVE_URL); without one
// the walk is solo, as before. ?live= points a page at another Leo live server on localhost or marscatsvoyage.com.
const LIVE_URL=(()=>{const asked=new URLSearchParams(location.search).get('live');
 if(asked&&/^wss?:\/\/(localhost|127\.0\.0\.1|[a-z0-9-]+\.marscatsvoyage\.com)(:\d+)?\//.test(asked))return asked;
 return typeof __LIVE_URL__!=='undefined'?__LIVE_URL__:'';})();
// Who is walking: a name of their own, or their Discord account through The Creamery (net/connect.js), which is
// optional. Asked on the loading card, while the ship is still to build, so nobody waits to answer. The card stays
// until they come aboard. A tester's invite link (?invite=, the same code that turns on tester feedback:
// feedback/feedback.js), or one this browser kept from an earlier visit to Leo, asks for Discord first, so Leo live can
// note who used it and their reports can name them. Someone who connected before is remembered in this browser for 30
// days and goes straight aboard; "Not you?" forgets them. In Otherside (net/otherside.js) there's no login at all:
// they type a name, or glyph:ready names them and they come straight aboard, with what Discord would give them
// (server/live-core.mjs), and Discord isn't offered.
const tester=invite||testerInvite();
let me={pass:null,name:null,error:null},board,glyphed=false,glyph=null,live=null;
const boarded=new Promise(r=>{board=r;});
const identity=LIVE_URL?(inOtherside?Promise.resolve(me):identify()).then(r=>{me=r;showWho();return r;}):Promise.resolve(me);
function comeAboard(){$('name-input').blur();$('who').hidden=true;board();}
function showWho(asking=!inOtherside&&!me.pass&&(!!tester||!!me.error)){
 if(glyphed){comeAboard();return;}
 $('who').hidden=false;$('who-connected').hidden=!me.pass;$('who-ask').hidden=!asking;
 $('who-guest').hidden=!!me.pass||asking;
 if(me.pass){$('who-name').textContent=me.name||'Voyager';return;}
 $('name-input').value||=savedName();
 $('who-note').textContent=me.error?(me.error==='cancelled'?'Discord sign-in was cancelled. Try again, or skip for now.':'Discord sign-in didn’t work. Try again, or skip for now.')
  :tester?'You’re invited to test Leo. Connect Discord so we know it’s you.':'Connect Discord so others aboard know it’s you.';
}
if(LIVE_URL){
 $('who-connect').addEventListener('click',connect);$('who-later').addEventListener('click',connect);
 $('who-skip').addEventListener('click',()=>{showWho(false);$('name-input').focus();});
 $('who-forget').addEventListener('click',()=>{forget();me={pass:null,name:null,error:null};showWho();});
 $('who-guest').addEventListener('submit',e=>{e.preventDefault();comeAboard();});
 if(inOtherside){$('who-later').hidden=true;$('who-small').hidden=true;$('name-connect').hidden=true;document.querySelector('#name-sheet .verified-note').textContent='Your name aboard is your Glyph name.';}
 onGlyph(g=>{glyphed=true;glyph=g;if(g.username)$('name-input').value=g.username;if(!me.pass){if(g.wallet)live?.rejoin();else if(g.username)live?.rename(g.username);}comeAboard();});
}
const renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
const phone=matchMedia('(pointer:coarse)').matches;
// Resolution: High is the usual sharpness; Medium and Low draw fewer pixels, for slower laptops and phones.
// The Res button steps through them and the choice is remembered for the next visit.
const RES=['High','Med','Low'],RES_SCALE=[1,.75,.5],RES_KEY='leo-walk-resolution',maxRatio=Math.min(devicePixelRatio,phone?1.25:1.75);
const savedRes=(()=>{try{return localStorage.getItem(RES_KEY);}catch{return null;}})();
let res=Math.max(0,RES.indexOf(savedRes)),resChosen=savedRes!==null,resFrames=[],resFrom=0;
const setRes=i=>{res=i;renderer.setPixelRatio(maxRatio*RES_SCALE[res]);$('resolution').textContent=`Res ${RES[res]}`;};
// Until the visitor picks a resolution, four seconds under 20 frames a second steps it down a level, for this visit only
// (nothing is saved). Older laptops start on High otherwise and many never find the button. Not under automation, so
// captures keep their sharpness; a stall or a hidden tab doesn't count.
function watchFrames(ms,now){
 if(resChosen||res===RES.length-1||navigator.webdriver||document.hidden||ms>1000)return;
 if(!resFrom)resFrom=now;resFrames.push(ms);if(now-resFrom<4000)return;
 const median=resFrames.sort((a,b)=>a-b)[resFrames.length>>1],enough=resFrames.length>=8;resFrames=[];resFrom=now;
 if(enough&&median>50)setRes(res+1);
}
renderer.setPixelRatio(maxRatio*RES_SCALE[res]);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
// Lift door shutter blades are clipped to their doorway as they open (lift-ride.js).
renderer.localClippingEnabled=true;
$('viewport').appendChild(renderer.domElement);
// A phone short of graphics memory drops the WebGL context: bring the card back with a reason, not a frozen view.
renderer.domElement.addEventListener('webglcontextlost',()=>{document.body.dataset.ready='0';$('loading-text').textContent='The view stopped: this device ran short of graphics memory. Reload to walk again.';});
const scene=new T.Scene();scene.environmentIntensity=.65;
// Space through the windows: stars and Mars in their own pass behind the ship, so the ship's far plane can stay short.
const sky=new T.Scene();sky.background=new T.Color(0x05080d);const skyCamera=new T.PerspectiveCamera(60,1,10,5000);
{let seed=731;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const p=[];
 for(let i=0;i<1500;i++){const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y);p.push(3800*r*Math.cos(a),3800*y,3800*r*Math.sin(a));}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));
 sky.add(new T.Points(g,new T.PointsMaterial({color:0xd5e2eb,size:1.25,sizeAttenuation:false,transparent:true,opacity:.65})));
 // Mars sits dead ahead, centred in the lounge's nose row (1C).
 const mars=createMars();mars.position.set(1800,90,0);sky.add(mars);}
// Nearer stars drift slowly aft past the windows (star-drift.js).
const drift=createStarDrift({count:phone?320:520,still:matchMedia('(prefers-reduced-motion: reduce)').matches});sky.add(drift.points);
renderer.autoClear=false;
// A light haze down the long corridors lets the far plane stop at 150 m.
scene.fog=new T.Fog(0xd9dcd6,70,148);
const camera=new T.PerspectiveCamera(phone?70:62,1,.05,ATRIUM_VIEW.far);
// Past the far plane, the ship in haze rather than open space (haze.js); drawn between the sky and the ship.
const haze=new T.Scene();haze.fog=scene.fog;const hazeCamera=new T.PerspectiveCamera(60,1,ATRIUM_VIEW.far-10,1500);
// Cool, crisp base light (2B): rooms with a mood of their own warm or dim it while you are inside.
const hemi=new T.HemisphereLight(0xeef4ff,0x4f5d68,1);scene.add(hemi);
const fill=new T.DirectionalLight(0xf2f6ff,.55);fill.position.set(.3,1,.2);scene.add(fill);
loadEnvironment(renderer).then(t=>{scene.environment=t;quietFloorReflections(scene,t);}).catch(()=>{});
function resize(){const w=innerWidth,h=innerHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

deferRoomFrames();const ship=await loadPreparedShip(scene,status);scene.add(ship.root);
const colliders=new Colliders();
// The ship map image is small; it loads alongside the models.
const shipMap=new ShipMap(__MAP_URL__);shipMap.ready.then(()=>{$('minimap-button').hidden=false;}).catch(()=>{});

async function loadExterior(){}

const idle=()=>new Promise(r=>(window.requestIdleCallback||setTimeout)(()=>r(),{timeout:60}));
async function buildShip(){
 status('Fitting the walls…');await idle();
 const prepared=await prepareWalkWorld(ship,{into:colliders,kit:cosmoKit,anisotropy:renderer.capabilities.getMaxAnisotropy(),still:matchMedia('(prefers-reduced-motion: reduce)').matches,urls:artUrls,hat:__HAT_URL__,light:{hemi,fill,scene},afterBase(){
 // The hull behind the glass goes for drawing only, after the colliders have it.
 const w0=performance.now(),opened=0;timings.push([`${opened} hull triangles opened for windows in ${Math.round(performance.now()-w0)} ms`,Math.round(performance.now()-t0)]);
 lifts=createLifts(scene,colliders);addWayfindingGuides(lifts.signs);preparedSigns(ship,lifts.signs);
 },afterRest(state){
 restSpots=state.restSpots;rest=spotIndex(state.seats);lounge=state.lounge;lullaby=lounge?createLullaby(lounge.dome):null;
 // Its floor, galleries and the promenade in front: glossy acrylic with neon swirls (lounge-floor.js).
 quietFloorReflections(scene,scene.environment);
 // Deck 19's lift lobby and promenade up to the lounge: black ceramic tile (lift-tile-floor.js).
 // The floor finish is in the prepared render bands.
 // The crew recovery lounge's pod side dims the lights (recovery.js).
 recovery=createRecoveryMood(ship,{hemi,fill,scene});arrivalMood=createArrivalMood(ship,{hemi,fill,scene});
 }});
 ({booth,poolTable,pinball:pinballMachine,concession,provisions,kittens,diningRobots,hydration,blossom,loungeFalls,jaguarGate,arcadeRow,missionHolo,mudwater,chinampa}=prepared);
 loungeSound=lounge&&loungeFalls?createLoungeSound(lounge,loungeFalls.soundLine):null;
 const {pipework,trolley,wardTrolley,mctBay,swordCase,theatreCast}=prepared;freightGate=prepared.freightGate;baggage=prepared.baggage;atmosphere=prepared.atmosphere;
 // The Container Maze in Container hold A (maze/hold.js; its clock and board are maze/run.js).
 mazeHold=prepared.maze;
 // The hidden clubhouse's vault door behind the arcade (vault.js): solid here, as a movable collider of its own.
 vault=prepared.vault;vault.attach(colliders);
 vaultLift=prepared.vaultLift;scene.add(vaultLift.group);
 // Paws Off on the Deck 16 exercise studio's treadmills (paws-off/game.js): their belts, before the room is merged; and
 // on the arcade's treadmill. With Leo live, a run joins the gym round (server/gym.mjs).
 pawsOff=createPawsOff(ship,{ground:p=>findStand(colliders,p.toArray(),{radius:2}),more:arcadeRow?[arcadeRow.treadmill]:[],gym:msg=>!!live?.gym(msg),me:()=>live?.id,onStart:startRun,onEnd:endRun});
 await idle();
 // The forward observation lounge's telescope plays Alien Cat Invasion (invasion/game.js): where it stands, on its floor.
 {const base=ship.root.getObjectByName('Shared_telescope_base');if(base){base.updateWorldMatrix(true,false);scope=base.getWorldPosition(new T.Vector3());scope.y-=.325;}}
 // The Deck 16 theatre's cinema dressing (theatre.js), before baking so the pieces it hides stay out.
 theatre=createTheatre(ship,{url:typeof __REEL_URL__!=='undefined'?__REEL_URL__:'',anisotropy:renderer.capabilities.getMaxAnisotropy()});
 await idle();
 // The gaming lounge's lights, screens, glass floor and starry ceiling (gaming-lounge.js), drawn with its deck band.
 gaming=createGamingLounge(ship,{hemi,fill,scene},{still:matchMedia('(prefers-reduced-motion: reduce)').matches});
 await idle();
 // Deck 15 dressed for Halloween until November (halloween.js): its lanes' ceiling diffusers go dead before the merge.
 halloween=createHalloween(ship,{hemi,fill,scene},{still:matchMedia('(prefers-reduced-motion: reduce)').matches,sheet:$('clown-sheet')});
 // Deck 1's hallways: hexagon tiles that light up round the walker, teal heading forward and orange heading aft
 // (hex-floor.js); drawn only, after the colliders, so the floor walks as before.
 hexFloor=createHexFloor();
 await idle();
 // Deck 4's tank bay doorway behind a lever panel (lever-panel.js): drawn only, with a movable collider of its own.
 leverPanel=createLeverPanel(colliders,{shared:!!LIVE_URL,send:msg=>live?.panel(msg),id:()=>live?.id});
 status('Dressing the crew…');await idle();
 // Fixed crew are already dressed in the prepared render bands.
 status('Preparing the walk · 1/4 · placing the ship…');await idle();
 // Decals and seams only matter from outside.
 // Exterior visibility was resolved by the build.
 ship.v2Haze=preparedHaze(ship);preparedFacade(ship,scene);const b0=performance.now();baked=preparedBake(ship);for(const g of baked.bands.values())scene.add(g);quietFloorReflections(scene,scene.environment);timings.push([`${baked.sources} meshes merged into ${baked.meshes} in ${Math.round(performance.now()-b0)} ms`,Math.round(performance.now()-t0)]);
 haze.add(ship.v2Haze);separateAtriumPaving(ship);await installDistantArchitecture(ship,baked,haze,{phone,multiDraw:renderer.extensions.has("WEBGL_multi_draw")});cabinGlass=createCabinGlass(ship,scene);crewGallery=crewGalleryController(ship);hangarDoor=createHangarDoor(scene,colliders);
 // Signs, the selfie booth (selfie.js) and the Crown lounge hostess (hostess.js) draw with the deck band they're on.
 status('Preparing the walk · 2/4 · placing activities…');await idle();
 const toBand=o=>{const band=bandOf(o.position.y);let g=baked.bands.get(band);if(!g){g=new T.Group();g.name='Walk_band_'+band;g.userData.band=band;baked.bands.set(band,g);scene.add(g);}g.add(o);};
 for(const o of [...lifts.signs.children,booth.group,...(poolTable?[poolTable.group]:[]),...(pinballMachine?[pinballMachine.group]:[]),...(pawsOff?pawsOff.groups:[]),...(mudwater?[mudwater.group]:[]),...(arcadeRow?[arcadeRow.group]:[])])toBand(o);
 if(concession)toBand(concession);
 toBand(vault.group);
 if(provisions)toBand(provisions.group);
 if(pipework)toBand(pipework.group);
 if(kittens)toBand(kittens.group);
 // Kittens on the arrival hall's cat tree (arrival-atrium.js), dressing only.
 {const g=createAtriumKittens(ship,cosmoKit);if(g)toBand(g);}
 if(diningRobots)toBand(diningRobots.group);
 if(hydration)toBand(hydration.group);
 if(trolley)toBand(trolley.group);
 if(typeof __WALK_DEBUG__!=="undefined"&&__WALK_DEBUG__)ship.v2RuntimeFeatures={wardTrolley,baggage,freightGate};if(wardTrolley)toBand(wardTrolley.group);
 if(mazeHold)toBand(mazeHold.group);
 if(mctBay)toBand(mctBay.group);
 // The aft freight gate (freight-gate.js): its iris, gantry, lanes and posters.
 if(freightGate)toBand(freightGate.group);
 // The surgical suite's ceiling robot arms (surgery.js), dressing only.
 surgeryArms=createSurgeryArms(ship,{still:matchMedia('(prefers-reduced-motion: reduce)').matches});if(surgeryArms)toBand(surgeryArms.group);
 // The diagnostics room's resting patients, holographic scans and scan beams (imaging.js), dressing only.
 imagingScans=createImagingScans(ship,{kit:cosmoKit,still:matchMedia('(prefers-reduced-motion: reduce)').matches,anisotropy:renderer.capabilities.getMaxAnisotropy()});if(imagingScans)toBand(imagingScans.group);
 if(blossom)toBand(blossom.group);
 // The Hydro-Nip Lounge's waterfall pond (lounge-falls.js).
 if(loungeFalls)toBand(loungeFalls.group);
 toBand(jaguarGate.group);
 for(const g of prepared.entranceSigns.groups)toBand(g);
 if(lounge)for(const o of lounge.drawn)toBand(o);
 // Its synthwave wall (lounge-mural.js) spans three decks' bands, like a painting.
 if(lounge?.mural){baked.bands.set(lounge.mural.name,lounge.mural);scene.add(lounge.mural);}
 // Its aquarium (lounge-aquarium.js) fills the front wall over the same three decks.
 if(lounge?.aquarium){baked.bands.set(lounge.aquarium.name,lounge.aquarium);scene.add(lounge.aquarium);}
 // The paintings (paintings.js) span several bands each: they draw while any of them is in view.
 // The ship log boards (changes-board.js) in the crown lounge and the arrival hall.
 for(const g of changeLog.groups)toBand(g);
 paintings=createPaintings({urls:artUrls,anisotropy:renderer.capabilities.getMaxAnisotropy()});
 for(const g of paintings.groups){baked.bands.set(g.name,g);scene.add(g);}
 // The comic books (comics.js) lie on counters and tables, drawn with their deck's band.
 comics=createComics({urls:artUrls,anisotropy:renderer.capabilities.getMaxAnisotropy()});for(const g of comics.groups)toBand(g);
 if(cosmoKit)toBand(createHostess(cosmoKit));
 // The welcome guide stands beside the arrival aisle; the tour never moves the walker.
 if(cosmoKit){arrivalTour=createArrivalTour(cosmoKit);toBand(arrivalTour.group);}
 if(theatre)toBand(theatre.group);
 if(theatreCast)toBand(theatreCast.group);
 if(gaming)toBand(gaming.group);
 // Communications' wraparound star map and station screens (comms-displays.js), drawn with Deck 20's band.
 {const comms=createCommsDisplays(ship,{anisotropy:renderer.capabilities.getMaxAnisotropy()});if(comms)toBand(comms.group);}
 missionTimer=createMissionTimer(ship,{anisotropy:renderer.capabilities.getMaxAnisotropy(),still:matchMedia('(prefers-reduced-motion: reduce)').matches});if(missionTimer)toBand(missionTimer.group);
 if(missionHolo)toBand(missionHolo.group);
 if(swordCase)toBand(swordCase.group);
 // Hydroponic garden A's chinampa tank (chinampa.js), drawn with Deck 3's band.
 if(chinampa)toBand(chinampa.group);
 if(baggage)toBand(baggage.group);
 if(atmosphere)toBand(atmosphere.group);
 if(halloween)toBand(halloween.group);
 toBand(hexFloor.group);
 toBand(leverPanel.group);
 // Six Mars Cat Transporters in Cargo maintenance's charging bays, to drive or ride in (transporter.js), drawn with Deck 1's band.
 status('Preparing the walk · 3/4 · connecting transport and displays…');await idle();
 mct=createTransporters({colliders,lifts});for(const g of mct.groups)toBand(g);
 // The forward observation lounge's Mars-viewing compass, a flush inlay on its floor (lounge-compass.js), drawn with its band.
 {const compass=createLoungeCompass();if(compass)toBand(compass);}
 // The shared graffiti wall on the casing's main face (graffiti.js), drawn with Deck 19's band.
 graffiti=createGraffiti(casing.userData.paintFace,casingFrame,{bar:$('spray'),colours:$('spray-colours'),nozzles:$('spray-nozzles'),note:$('spray-note'),connect:$('spray-connect'),done:$('spray-done'),surface:$('viewport')},
  {live:()=>live,connect,onOpen(){emote=null;input.enabled=false;input.down.clear();},onClose(){input.enabled=true;input.down.clear();}});
 toBand(graffiti.mesh);
 // The Crown lounge TV on the crown lift's aft face (crown-tv.js): the video someone shared through Leo live.
 crownTv=createCrownTv({live:()=>live,base:LIVE_URL?httpBase(LIVE_URL):'',connect,
  els:{sheet:$('tv-sheet'),now:$('tv-now'),status:$('tv-status'),sound:$('tv-sound'),pick:$('tv-pick'),connect:$('tv-connect'),down:$('tv-down'),limits:$('tv-limits'),file:$('tv-file')},
  onOpen(){emote=null;input.enabled=false;input.down.clear();}});
 toBand(crownTv.group);
 // Instanced meshes (the repeated cabins, lifeboat seating, garden planting) draw when their height range is in view;
 // a deck's 499 repeated cabins only from that deck.
 status('Preparing the walk · 4/4 · setting nearby details…');await idle();
 phase4Visibility=phase4Culling(ship.inside,colliders);ship.inside.traverse(o=>{if(!o.isInstancedMesh||o.userData.phase4)return;o.updateWorldMatrix(true,false);if(!o.boundingBox)o.computeBoundingBox();
  const box=o.boundingBox.clone().applyMatrix4(o.matrixWorld);let cabins=false,walls=false,boat=false;for(let q=o;q;q=q.parent){if(q.name==='V2_cabin_instances')cabins=true;if(q.name==='V2_cabin_shells')walls=true;if(/^Area_d\d+-lifeboats-/.test(q.name))boat=true;}
  o.userData.span=[box.min.y,box.max.y];o.userData.cabins=cabins;o.userData.cabinWalls=walls;o.userData.boat=boat;instanced.push(o);});
 // Furniture in the repeated cabins draws only for the cabins nearest the walker; their walls and doors always draw.
 const sharedNear=new Map();for(const o of instanced){
  if(!o.userData.boat&&(!o.userData.cabins||o.userData.cabinWalls))continue;
  const key=o.parent.uuid+'|'+(o.userData.cabinIds||[o.uuid]).join(',');if(sharedNear.has(key)){o.userData.near=sharedNear.get(key);continue;}const all=Array.from({length:o.count},(_,i)=>{const m=new T.Matrix4();o.getMatrixAt(i,m);return m;});
  o.userData.near={all,centres:all.map(m=>new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld))};sharedNear.set(key,o.userData.near);
 }
 isolateStaticWorld(ship,scene);ship.v2LowDeckBatches=await batchLowDeckDraws(baked,renderer);atriumGeometry=createAtriumGeometryRuntime(baked,renderer,{getQuality:getAtriumQuality});settlePreparedStatic(ship);
}
let imagingScans=null,missionTimer=null;
let baked=null,cosmoKit=null,lifts=null,rest=null,restSpots=[],resting=null,booth=null,concession=null,provisions=null,kittens=null,diningRobots=null,surgeryArms=null,freightGate=null,hydration=null,blossom=null,loungeFalls=null,jaguarGate=null,scope=null,poolTable=null,pinballMachine=null,pawsOff=null,mudwater=null,arcadeRow=null,run=null,runView='third',paintings=null,comics=null,theatre=null,lounge=null,arrivalMood=null,recovery=null,gaming=null,missionHolo=null,halloween=null,hexFloor=null,graffiti=null,crownTv=null,lullaby=null,loungeSound=null,mct=null;
let mazeHold=null,maze=null,treasure=null,leverPanel=null,chinampa=null,baggage=null,atmosphere=null;
const artUrls=typeof __ART_URLS__!=='undefined'?__ART_URLS__:{};const bodies=[],eye=new T.Vector3();const instanced=[];
// Lifeboat fittings (2,000 seats a deck with their headrests and harnesses, seen only through a hatch or from inside a
// craft) draw only near the walker: drawn whole, they were most of the triangles in any view on the lower decks.
const NEAR_CABINS=40,BOAT_REACH=45,nearFrom=new T.Vector3(1e9,0,0);
// The deck bands to draw: the walker's own and its neighbours, stretched to whatever the camera's centre and corner rays
// reach, so a tall hall, an atrium or a stairwell shows its full height. The rays skip the first 0.6 m: pressed into a
// corner, the camera can sit inside a column, and every ray then stopped on its back faces (a garden's roof was culled).
// Seen through an opening from under a lower ceiling (the lounge from its access ramp), a taller room's ceiling can be in
// view with no ray landing on it, so each ray also looks straight up and down from partway along for the space it crosses.
const VIEW_RAYS=[];for(const x of [-.96,-.5,0,.5,.96])for(const y of [-.96,-.5,0,.5,.96])VIEW_RAYS.push([x,y]);let viewSpan=[0,0],localViewSpan=[0,0],lastSpan=-Infinity,atriumSpanActive=false,atriumSight=null;
function span(p,now){
 // Sight through an adjoining doorway keeps the whole atrium, even outside its footprint.
 setAtriumView(p);
 const inside=inOpenAtrium();
 setAtriumSight(ATRIUM_VIEW.fullHeight&&(inside||(atriumSight??=createAtriumSight(colliders)).update(camera,p,now)));
 const atriumBand=atriumViewSpan();if(inside&&atriumBand){atriumSpanActive=true;return viewSpan=atriumBand;}
 // Returning indoors must recompute even at the same pose as the last indoor query.
 if(atriumSpanActive){atriumSpanActive=false;lastSpan=-Infinity;spanChanged(camera,p,NaN,NaN,colliders);}

 if(now-lastSpan>=150){lastSpan=now;if(spanChanged(camera,p,0,0,colliders)){
 const spanStart=performance.now();
 let low=p.y-3,high=p.y+4;const ray=new T.Raycaster(),ndc=new T.Vector2(),probe=new T.Ray();
 const reach=y=>{low=Math.min(low,y-1);high=Math.max(high,y+1);};
 for(const [x,y] of VIEW_RAYS){ndc.set(x,y);ray.setFromCamera(ndc,camera);const hit=(spanQuery??=createVisibilityQuery(colliders)).raycast(ray.ray,90,.6),d=hit?hit.distance:90;reach(ray.ray.at(d,probe.origin).y);
  for(const f of [1/3,2/3])for(const s of [1,-1]){ray.ray.at(d*f,probe.origin);probe.direction.set(0,s,0);const h=(spanQuery??=createVisibilityQuery(colliders)).raycast(probe,12);if(h)reach(h.point.y);}}
 renderMetrics.span.push(performance.now()-spanStart);if(renderMetrics.span.length>600)renderMetrics.span.shift();localViewSpan=[low,high];
 }}
 // Preserve the observer's local floor/ceiling, including views from below Deck 6.
 return viewSpan=atriumBand?[Math.min(localViewSpan[0],atriumBand[0]),Math.max(localViewSpan[1],atriumBand[1])]:localViewSpan;
}
function cull(p,now=performance.now()){
 camera.updateMatrixWorld(true);
 cabinGlass?.update(p);crewGallery?.update(p);const [low,high]=span(p,now);phase4Visibility?.update(camera,p,low,high,now,renderer.domElement.height);showBands(baked.bands,low,high);let shown=false;
 for(const o of instanced){const [a,b]=o.userData.span,v=o.userData.cabins?a<p.y+3.5&&b>p.y-.5:a<high&&b>low;if(v&&!o.visible)shown=true;o.visible=v;}
 // Re-rank after 3 m of walking, or at once when another deck's cabins come into view.
 if(!shown&&nearFrom.distanceToSquared(p)<9)return;nearFrom.copy(p);
 // Every part of a cabin shares its instance index, so one ranking per deck serves all of that deck's parts.
 const ranks=new Map();
 for(const o of instanced){const near=o.userData.near;if(!near||!o.visible)continue;
  if(o.userData.boat){let k=0;near.centres.forEach((c,i)=>{if(c.distanceToSquared(p)<BOAT_REACH*BOAT_REACH)o.setMatrixAt(k++,near.all[i]);});o.count=k;o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();continue;}
  let order=ranks.get(o.parent);if(!order)ranks.set(o.parent,order=near.centres.map((c,i)=>[c.distanceToSquared(p),i]).sort((a,b)=>a[0]-b[0]).slice(0,NEAR_CABINS).map(e=>e[1]));
  order.forEach((i,k)=>o.setMatrixAt(k,near.all[i]));o.userData.currentCabinIds=order.map(i=>o.userData.cabinIds[i]);o.count=order.length;o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();
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
  if(t.kind==='arrival-tour'){closePanels();arrivalTour.open();return;}
  if(t.kind==='launch-ladder'){goTo({at:t.at,yaw:heading,lv:2,resolved:true});return;}
  if(t.kind==='cabin-glass'){cabinGlass.toggle(t.cabin);return;}
  if(t.kind==='call')lifts.call(t.lift,t.stop);
  else if(t.kind==='inside')openLiftPanel(t.lift);
  else if(t.kind==='waiting')return;
  else if(t.kind==='sit'||t.kind==='lie'||t.kind==='stand')settle(t.spot);
  else if(t.kind==='selfie'){closePanels();$('selfie-setup').hidden=false;previewBackdrop();input.enabled=false;$('selfie-backdrop').focus();}
  else if(t.kind==='comic'){closePanels();reader.open(t.comic);input.enabled=false;}
  else if(t.kind==='read'){closePanels();showInfo($('info-sheet'),t.info);input.enabled=false;}
  else if(t.kind==='play')arcade.open();
  else if(t.kind==='emergency-drill')emergencyDrill.open();
  else if(t.kind==='log')changeLog.open({near:controller.position});
  else if(t.kind==='pool')pool.open();
  else if(t.kind==='vault')openVault();
  else if(t.kind==='vault-exit')vault.release();
  else if(t.kind==='clubhouse-call')vaultLift.call(t.lift,t.stop);
  else if(t.kind==='clubhouse-inside')openLiftPanel(t.lift,vaultLift);
  else if(t.kind==='pinball')pinballGame.open();
  else if(t.kind==='outside'){closePanels();emote=null;input.enabled=false;input.down.clear();openOutside($('outside-sheet'),$('outside-frame'));}
  else if(t.kind==='maze')maze.use(t);
  else if(t.kind==='treasure')treasure.use(t);
  else if(t.kind==='treadmill')pawsOff.start(t.mill);
  else if(t.kind==='mudwater'){mudwater.play();live?.arena('play');}
  else if(t.kind==='packs'){closePanels();const w=$('mudwater-wordmark');if(mudwater.wordmark&&!w.src){w.src=mudwater.wordmark;w.hidden=false;}giveaway.open();$('mudwater-sheet').hidden=false;input.enabled=false;}
  else if(t.kind==='ball')enterBall();
  else if(t.kind==='ball-out')leaveBall();
  else if(t.kind==='mct')boardCart(t);
  else if(t.kind==='graffiti'){closePanels();graffiti.open();}
  else if(t.kind==='lever')leverPanel.flip(t.lever);
  else if(t.kind==='lever-exit')leverPanel.release();
  else if(t.kind==='tv'){closePanels();crownTv.open();}
  else if(t.kind==='clown'){closePanels();input.enabled=false;halloween.knock(t.clown,()=>live?.clown());}
 },
 escape(){if(treasure?.active){treasure.leave();return;}closePanels();arrivalTour?.close();},
 // (Nothing below until the walk is ready.)
 places(){if(ready())togglePlaces();},
 map(){if(ready())toggleMap();},
 crouch(){if(ready()&&!resting&&!inBall&&!treasure?.active){controller.toggle('crouch');emote=null;}},
 prone(){if(ready()&&!resting&&!inBall&&!treasure?.active){controller.toggle('prone');emote=null;}},
 emotes(){if(ready())toggleEmotes();},
 // The ship log from anywhere aboard, starting on the changes made around the walker (changes-board.js).
 log(){if(ready())openLog();},
 // Respawn: back to the arrival hall from anywhere aboard, off any seat or bed.
 respawn(){if(ready()){closePanels();emote=null;goTo({at:START.position.toArray(),yaw:START.yaw,resolved:true});for(const y of yarns)y.reset();ball.mesh.position.copy(ballHome);}},
 // A ping where you stand, for others aboard to find (marks.js); one every few seconds at most.
 ping(now=performance.now()){if(!ready()||!live?.live||now-pinged<PING_GAP_MS)return;pinged=now;const at=myPose().pos;live.mark(at);marks.show('me','You',at,now);},
 // Chat with everyone aboard (chat.js).
 chat(){if(ready())chat.open();},
 // How to play, and the tester guide (help.js).
 help(){if(ready())toggleHelp();},
 // Standing still, an emote plays until the walker moves (Voyager's Reach's wheel).
 emote(i){if(ready()&&!resting&&!inBall&&!treasure?.active&&EMOTES[i]&&controller.grounded){emote=EMOTES[i];controller.stance='stand';}},
 // The emote sheet uses the same bindings as the walk.
 sheet(code){
  const open=id=>!$(id).hidden;
  // E puts the spray can down again.
  if(graffiti?.active&&code==='KeyE'){closePanels();return;}
  if((code==='KeyE'&&open('info-sheet'))||(walkBindings.action(code)==='emotes'&&open('emotes'))||(code==='KeyN'&&open('map-sheet'))||(code==='KeyM'&&open('places'))||(code==='KeyH'&&open('help-sheet'))){closePanels();return;}
  if(open('emotes')&&walkBindings.action(code)?.startsWith('emote:')){closePanels();actions.emote(+walkBindings.action(code).slice(6));}
  if(open('comic-sheet'))reader.key(code);
 },
};
let emote=null,pinged=-Infinity;const PING_GAP_MS=4000;
// The clubhouse vault behind the arcade (vault.js): its door, and the password sheet it asks with.
let vault=null,vaultLift=null;
const VAULT_ASK='This door opens only for the clubhouse password.';
function openVault(){closePanels();emote=null;input.enabled=false;input.down.clear();$('vault-note').textContent=VAULT_ASK;$('vault-code').value='';$('vault-sheet').hidden=false;
 // (After the key that opened it, so the E isn't typed into the field.)
 setTimeout(()=>$('vault-code').focus());}
const ready=()=>document.body.dataset.ready==='1';
// The ship log boards (changes-board.js): the walk stands still while one is open; its hearts are Leo live's.
// Go there in a change's details drops the walker where its pictures were taken, looking as they do.
const changeLog=createChangesBoards({
 onOpen(){closePanels();emote=null;input.enabled=false;},
 onClose(){input.enabled=true;input.down.clear();},
 onGo:goToSpot,
 hearts:{request(){live?.hearts();},toggle(id,on){live?.heart(id,on);}},
});
// Chat aboard (chat.js): hidden until Leo live says who may chat; typing stops the walk.
const chat=createChat({box:$('chat'),lines:$('chat-lines'),form:$('chat-form'),field:$('chat-input'),send:$('chat-send'),opener:$('chat-open'),hider:$('chat-hide'),unread:$('chat-unread')},{
 say:text=>!!live?.say(text),connect,
 onOpen(){closePanels();emote=null;input.enabled=false;input.down.clear();},
 onClose(){input.enabled=true;input.down.clear();},
 // Hidden, the bubbles over heads go too.
 onQuiet(quiet){if(quiet)remotes?.hush();},
});
// The log always opens on every change (Jay, 2026-11-03); Near you is one press away.
function openLog(){changeLog.open({near:controller.position});}
// A spot (link.js's readSpot form), looking as it says; true if it could be reached.
function goToSpot(spot){spot=remapSpot(spot);if(!goTo({at:spot.at,yaw:spot.yaw,resolved:true}))return false;emote=null;follow.pitch=spot.pitch;follow.look(0,0);follow.mode=spot.view;return true;}

async function loadCosmo(){
 globalThis.LEO_THREE=T;globalThis.LEO_COSMO_EMOTES=__EMOTES_URL__;
 await new Promise((resolve,reject)=>{const s=Object.assign(document.createElement('script'),{src:__COSMO_SCRIPT__,async:true});s.onload=resolve;s.onerror=()=>reject(new Error('Cosmo could not load'));document.head.appendChild(s);});
 walker=await createWalker(globalThis.LeoCosmo.createDLCat,motion);walker.setFur(furColour);scene.add(walker.holder);
 cosmoKit=await globalThis.LeoCosmo.createCosmoKit({poses:[...KITTEN_POSE_NAMES,...ACTOR_POSE_NAMES,'scanPatient']});
}

// The arrival hall on Deck 2, where travellers come aboard.
const START={position:new T.Vector3(...toWorld('d02-arrival-1',[-20,0,0])),yaw:anchoredYaw('d02-arrival-1',Math.PI/2)};
// Below this a walker has fallen out of the ship: 3 m under Deck 1's floor.
const BELOW_SHIP=floorY(1)-3;
await Promise.all([loadExterior(),loadCosmo()]).catch(e=>{status(e.message);throw e;});
await buildShip();
// A walk link (link.js) starts wherever it was taken; otherwise the arrival hall.
const spot=remapSpot(readSpot()),stand=spot&&findStand(colliders,spot.at);
controller.place(stand||findStand(colliders,START.position.toArray())||START.position);
follow.yaw=stand?spot.yaw:START.yaw;if(stand){follow.pitch=spot.pitch;follow.look(0,0);follow.mode=spot.view;}
walker.holder.position.copy(controller.position);
// Balls of yarn to push about: the arrival hall's, and one in each of six common areas (yarn.js).
const yarn=createYarn(colliders),yarns=[yarn];
for(const s of YARN_SPOTS){const place=yarnPlace(PLACES,s.place);if(!place)continue;
 const at=findStand(colliders,place.at.map((v,i)=>v+(place.room?anchoredOffset(place.room,s.offset):s.offset)[i]),{radius:4});if(at)yarns.push(createYarn(colliders,{at:at.toArray(),color:s.color}));}
for(const y of yarns)scene.add(y.mesh);
// The hamster ball (hamster-ball.js), parked in the Deck 17 gardens until someone climbs in.
const ballHome=findStand(colliders,BALL.home,{radius:4})||new T.Vector3(...BALL.home),ball=createBallMesh();let inBall=false;
ball.mesh.position.copy(ballHome);scene.add(ball.mesh);
function enterBall(){emote=null;inBall=true;controller.body=BALL.body;controller.place(ball.mesh.position.clone());}
// Stop before dismounting. In a tight spot the ball returns home so it cannot push Cosmo through a wall.
function leaveBall(at=null){if(!inBall)return;
 const parked=controller.position.clone(),out=at||ballDismount(parked,heading,BALL.radius+BODY.radius,q=>findStand(colliders,q,{radius:0}));
 inBall=false;controller.body=BODY;controller.place(out||parked);ball.mesh.position.copy(out?parked:ballHome);
}
// The Deck 1 transporters (transporter.js): into a cart's driver's seat, once Leo live agrees nobody else has it, or one of
// its rear seats, with the camera turned the way the seat faces. A seat granted after a walk away is given back.
function boardCart(t){if(t.seat==='driver'&&!mct.take(t.cart))return;intoSeat(t.cart,t.seat);}
function intoSeat(c,seat){const s=mct.spot(c,seat);settle(s);follow.yaw=Math.atan2(s.facing.x,s.facing.z);}
mct.granted=c=>{if(!resting&&!run&&Math.hypot(controller.position.x-c.pos.x,controller.position.z-c.pos.z)<4)intoSeat(c,'driver');else mct.park(c);};
// Someone else has our cart now (Leo live gave it away while we were cut off): out of its seat.
mct.lost=c=>{if(resting?.spot.mct?.cart===c&&resting.spot.mct.seat==='driver')standUp();};
// Someone not connected stays on the card until they come aboard, however soon the ship is ready.
if(LIVE_URL){await identity;if(!me.pass){status('Ready when you are');$('loading-slow').hidden=true;await boarded;}}
let firstViewReady=false;status('Preparing first view…');
let heading=follow.yaw;const safe=controller.position.clone(),finSafe=new T.Vector3(0,-1e3,0);
// On the floor of one of the crown lift's fin landings (the gallery and the inspection platforms), inside the fin.
const FIN_STOPS=LIFTS.find(l=>l.id==='crown').stops.filter(s=>!/Crown/.test(s.label)).map(s=>s.y);
function onFinPlatform(p){return p.x<-170&&Math.abs(p.z)<3&&FIN_STOPS.some(y=>Math.abs(p.y-y)<.3);}
// Feedback joins the top-right tools, orange-edged like the viewer's so testers spot it; a narrow phone has no room
// there, so it sits under the mini-map instead.
// The Builder's Hub, on top of the walk (hub-panel.js).
const hubPanel=createHubPanel({
 onOpen(){closePanels();feedback?.close();emote=null;input.enabled=false;input.down.clear();},
 onClose(){input.enabled=true;input.down.clear();},
 onGo(search){const spot=readSpot(search);return spot?goToSpot(spot):false;},
 onConnect:connect});
const feedback=installFeedback({renderer,page:'walk',openHub:report=>hubPanel.open({report}),mount:()=>matchMedia('(max-width:560px)').matches||document.documentElement.classList.contains('phone-hud')?null:document.querySelector('.tools'),
 css:'.fb-button:not(.fb-mounted){left:auto;bottom:auto;right:16px;top:180px;z-index:5}.tools .fb-button,.fb-button:not(.fb-mounted){border-color:var(--orange,#f85800);color:#ff8a3d}.tools .fb-button:hover,.fb-button:not(.fb-mounted):hover{background:var(--orange,#f85800);color:#050507}',
 // The pass is renewed as the panel opens unless it was got in the last two minutes, so it is fresh by Send.
 identity:()=>me.pass?{name:me.name||'Voyager',pass:bestPass,renew:()=>currentPass(480)}:null,
 context:()=>({link:spotLink({position:controller.position,yaw:follow.yaw,pitch:follow.pitch,view:follow.mode}),where:describe(controller.position)}),
 onOpen:()=>{input.enabled=false;input.down.clear();},onClose:()=>{input.enabled=true;input.down.clear();}});
// Help (help.js): how to play, and, where Feedback is on, the tester guide, which can open it, the ship log or the spot
// its example report was built at.
const help=createHelp($('help-sheet'),{touch:()=>matchMedia('(pointer:coarse)').matches,tester:()=>!!feedback,live:()=>!!live,
 onLog(){closePanels();openLog();},onFeedback(){closePanels();feedback?.open();},onHub(){hubPanel.open();},
 onGo(search){const spot=readSpot(search);closePanels();if(spot)goToSpot(spot);}});
// Now the Builder's Hub can reach it all.
hubLink.ready(search=>{const spot=readSpot(search);if(!spot)return false;hubPanel.close();closePanels();return goToSpot(spot);});
// A tester (this browser holds a tester invite) wears the captain's hat (hat.js).
if(hasTesterInvite())wearHat(walker,__HAT_URL__);
// Others aboard: their poses in, ours out, the lifts as the server runs them.
let remotes=null,marks=null,aboard=0,aboardNames=undefined,liveStatus='',wasInArena=false;
// The giveaway card at Mudwater Arena's counter, which claims through Leo live.
// Claiming takes a Discord account: its small window leaves them standing at the counter, and they carry on under their
// Discord account from there. Not offered inside Otherside, where pop-ups can't open (mudwater-giveaway.js).
async function connectToClaim(){
 const got=await connectPopup();
 if(got.pass){
  me={pass:got.pass,name:got.name,error:null};
  document.querySelector('#name-sheet .verified-note').textContent='Your name aboard is your Discord name, with a teal dot so others know it’s really you.';
  live?.rejoin();return '';
 }
 if(got.error==='blocked'){connect();return '';}
 return got.error==='cancelled'?'Discord sign-in was cancelled. Try again when you’re ready.':'Discord sign-in didn’t work. Try again in a moment.';
}
const giveaway=createGiveaway({$,live:()=>live,connect:connectToClaim});
if(LIVE_URL){
 marks=new Marks($('names'));
 remotes=new RemotePlayers(scene,{make:()=>createWalker(globalThis.LeoCosmo.createDLCat,motion),colliders,lifts,labels:$('names'),hatUrl:__HAT_URL__,running:p=>!!pawsOff?.onBelt(p),hammock:p=>!!rest?.hammockAt(p),catnip:p=>!!lounge?.inside(p),swimming:p=>!!treasure?.contains(p)});
 await identity;
 const name=me.pass?me.name||'':$('name-input').value.trim();
 live=connectLive(LIVE_URL,{
  status:s=>{liveStatus=s;if(s!=='live'){aboardNames=undefined;leverPanel?.lost();}showAboard();showAboardList();changeLog.setStatus(s==='live'?'live':'offline');if(s!=='live')chat.set({live:false});},
  welcome:msg=>{leverPanel?.apply(msg.panel);for(const {id,s} of msg.lifts)lifts.apply(id,s);live.hearts();mct.apply(msg.mcts);live.tv();
   // A server from before chat sends no chat: it stays hidden.
   chat.set({live:true,id:msg.id,verified:!!msg.you?.verified,mode:msg.chat?.mode||'off'});chat.load(msg.chat?.lines);
   // Just connected Discord at the giveaway's counter: its card shows what they can claim now.
   if(!$('mudwater-sheet').hidden)live.giveaway();},
  // A line of chat: in the corner, and over the speaker's head.
  chat:line=>{chat.add(line);if(line.id!==live.id&&!chat.quiet)remotes.say(line.id,line.text);},said:r=>chat.refused(r.why),
  poses:list=>remotes.onPoses(list),gone:id=>remotes.gone(id),reset:()=>{remotes.clear();marks.clear();graffiti?.reset();pawsOff?.lost();mct.offline();},
  mark:(id,at)=>{const r=remotes.remotes.get(id);marks.show(id,r?.name||'Voyager '+id.slice(-4),at);},
  lift:(id,s)=>lifts.apply(id,s),aboard:(n,names)=>{aboard=n;if(names!==undefined)aboardNames=names;showAboard();showAboardList();},
  maze:msg=>maze?.fromServer(msg),
  treasure:msg=>treasure?.fromServer(msg),
  panel:msg=>leverPanel?.apply(msg),
  board:b=>(b.game==='pool'?pool:arcade).setBoard({status:b.verified?'ok':'guest',top:b.top||[],you:b.you||null}),scored:r=>(r.game==='pool'?pool:arcade).setResult(r),
  hearts:h=>changeLog.setHearts(h),hearted:r=>changeLog.refused(r.why),
  // A group photo: someone pressed the selfie camera, and this page takes the photo at the same moment as theirs.
  selfie:(id,ms)=>booth?.start(ms),
  // Mudwater Arena's giveaway card (mudwater-giveaway.js): its state, and a claim's answer.
  giveaway:g=>giveaway.status(g),claimed:r=>giveaway.claimed(r),clown:r=>halloween?.got(r.code),
  // The Deck 19 graffiti wall (graffiti.js): the wall as it is, others' strokes as they spray, and ours refused.
  wall:w=>graffiti?.wall(w),stroke:s=>graffiti?.stroke(s),painted:r=>graffiti?.painted(r),
  // Paws Off's gym round on the treadmills: its countdown, start, runners out and results.
  gym:msg=>pawsOff?.round(msg),
  // The Deck 1 transporters: who drives each cart, and where each is parked.
  mcts:list=>mct.apply(list),
  // The Crown lounge TV (crown-tv.js): what is on it, and a ticket to share a video.
  tv:t=>crownTv?.tv(t),tvTicket:r=>crownTv?.ticket(r),
 },{pass:()=>me.pass?bestPass():Promise.resolve(null),refused:forget,invite:tester,hat:hasTesterInvite,glyph:()=>glyph?.wallet?{wallet:glyph.wallet,username:glyph.username}:null,otherside:inOtherside});
 if(!me.pass&&name!==savedName())live.rename(name);
 lifts.onCall=(l,index,opts)=>live.call(l.spec.id,index,opts?.now);
 mct.link({send:msg=>live.mct(msg),id:()=>live.id});
 $('ping').hidden=false;$('help-ping').hidden=false;
}
// The pose others see. Resting, the body is where the bed or seat put it, not where the controller stands.
// On a treadmill (Paws Off), it is where the run has him: on the belt, or on his back behind it after a fall.
function myPose(riding=false){
 const h=walker.holder,held=resting||run,at=held?h.position:controller.position;
 return {pos:[at.x,at.y,at.z],yaw:held?h.rotation.y:heading,g:controller.grounded||riding||!!held,st:controller.stance,jc:Math.min(3,controller.jumpCount),
  js:T.MathUtils.clamp(controller.jumpS,-1,60),r:T.MathUtils.clamp(controller.velocity.y,-100,100),e:resting?.stand?'healing_capsule':emote,rest:resting&&!resting.stand?(resting.lie?'lie':'sit'):run?.tumble>.5?'lie':null,pl:arcade.isOpen||pool.isOpen||pinballGame.isOpen||!!emergencyDrill?.isOpen||!$('outside-sheet').hidden||!!run,b:inBall,f:furColour};
}
// A hidden tab (or a covered window) draws no frames, so when frames stop it says it is still here from a timer
// instead (browsers run one about once a second in the background).
if(live)setInterval(()=>{if(document.hidden||performance.now()-last>1000)live.pose(myPose());},1000);
function showAboard(){
 const b=$('aboard');b.hidden=!live;if(!live)return;
 // Short labels on a narrow screen, unless they are in a phone's More menu (walk.html), which has room for the long ones.
 const small=matchMedia('(max-width:560px)').matches&&!document.documentElement.classList.contains('phone-hud');
 const text=(small?{live:aboard===1?'Just you':`${aboard} aboard`,connecting:'Joining…',offline:'Solo',layout:'Solo · reload ship',full:'Solo · full',replaced:'Solo · 2 tabs'}
  :{live:aboard===1?'Just you aboard':`${aboard} aboard`,connecting:'Joining…',offline:'Solo · reconnecting',layout:'Solo · reload to match ship',full:'Solo · Leo is full',replaced:'Solo · open in another tab'})[liveStatus]||'';
 b.querySelector('span').textContent=text;b.dataset.status=liveStatus;
 // Beside it: logged in with Discord says so; anyone else is offered it. Leo live has the last word once it has answered.
 const d=$('discord-chip');d.hidden=inOtherside;
 d.dataset.in=(liveStatus==='live'?live.you?.verified:me.pass)?'1':'';
 d.textContent=d.dataset.in?(small?'':'Logged in · ')+(live.you?.name||me.name||'Voyager'):small?'Discord':'Log in with Discord';
}
$('discord-chip').addEventListener('click',()=>{if($('discord-chip').dataset.in)openName();else connect();});
// Test hook for dev builds only (scripts set __WALK_DEBUG__); the public build drops it.
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__)globalThis.__walk={registry,get phase4Visibility(){return phase4Visibility;},renderMetrics,get hangarDoor(){return hangarDoor;},get cabinGlass(){return cabinGlass;},restSpots,get leverPanel(){return leverPanel;},get interactionTargets(){return interactionTargets({lifts,restSpots,arcadeRow,pawsOff,scope,theatre,poolTable,pinballMachine,mudwater,changeLog,comics,paintings,missionHolo,chinampa,places:PLACES});},T,scene,camera,renderer,ship,colliders,controller,follow,get arcade(){return arcade;},get emergencyDrill(){return emergencyDrill;},emergencyStation,get pawsOff(){return pawsOff;},get mudwater(){return mudwater;},get arcadeRow(){return arcadeRow;},get lounge(){return lounge;},get graffiti(){return graffiti;},get crownTv(){return crownTv;},get gaming(){return gaming;},get provisions(){return provisions;},get freightGate(){return freightGate;},get blossom(){return blossom;},get loungeFalls(){return loungeFalls;},changeLog,get walker(){return walker;},input,get baked(){return baked;},timings,cabinPlacements,get lifts(){return lifts;},get rest(){return rest;},get remotes(){return remotes;},get live(){return live;},get halloween(){return halloween;},get crewGallery(){return crewGallery;},get maze(){return maze;},get pinballMachine(){return pinballMachine;},get theatre(){return theatre;},get poolTable(){return poolTable;},get surgeryArms(){return surgeryArms;},hat:{wear:w=>wearHat(w||walker,__HAT_URL__),fit,FIT,MeshBVH},actions,PLACES,goTo:p=>goTo(p),get resting(){return resting;},get booth(){return booth;},yarn,yarns,ball:{mesh:ball.mesh,home:ballHome,get inside(){return inBall;}},get mct(){return mct;},
 // Debug: drop the walker at a point (feet), facing yaw, camera pitch.
 teleport(x,y,z,yaw=follow.yaw,pitch=-.18){resting=null;controller.place(new T.Vector3(x,y,z));follow.yaw=yaw;follow.pitch=pitch;heading=yaw;follow.current=.3;}};

// (Debug: the vault, vault.js.)
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__)Object.defineProperty(globalThis.__walk,'vault',{get:()=>vault});
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__)Object.defineProperty(globalThis.__walk,'vaultLift',{get:()=>vaultLift});
// The ship map: the corner mini-map, redrawn a few times a second, and the full map sheet.
const mini=$('minimap');let lastMini=0,mapDeck=null,mapShown=[];
// (A phone's small mini-map, html.phone-hud from walk.html, keeps up to 3× its pixels, so its names stay sharp.)
function sizeCanvas(c){const r=Math.min(devicePixelRatio||1,c===mini&&document.documentElement.classList.contains('phone-hud')?3:2),w=Math.round(c.clientWidth*r),h=Math.round(c.clientHeight*r);if(w&&h&&(c.width!==w||c.height!==h)){c.width=w;c.height=h;}}
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
 // Under the Builder's Hub the walk stands still, as in a background tab, and draws nothing, once it has its first view.
 if(hubPanel.isOpen()&&firstViewReady)return;
 // Our own clamped clock: with the loop's timestamp argument the fixed steps stalled in testing.
 const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-last)/1000));watchFrames(now-last,now);observeAtriumFrame(now-last,now,{active:document.body.dataset.ready==='1'&&!document.hidden&&document.hasFocus()&&!graphicsSettings?.isOpen&&!controlsSettings?.isOpen&&!furSettings?.isOpen});last=now;
 const k=input.read();if(graphicsSettings?.isOpen||controlsSettings?.isOpen||furSettings?.isOpen||emergencyDrill?.isOpen){k.x=k.y=k.zoom=0;k.jump=k.held=k.run=false;k.look.x=k.look.y=0;}follow.look(k.look.x,k.look.y);if(k.zoom)follow.distance=T.MathUtils.clamp(follow.distance+k.zoom*.4,1.4,6);
 const fwd=follow.forward(),right=new T.Vector3(-fwd.z,0,fwd.x);
 wish.copy(fwd).multiplyScalar(k.y).addScaledVector(right,k.x);
 if(wish.lengthSq()>1)wish.normalize();wish.multiplyScalar(inBall?(k.run?BALL.run:BALL.speed):controller.stance==='stand'&&k.run?WALKER.run:SPEED[controller.stance]);
 if(emote&&(wish.lengthSq()>.01||k.jump))emote=null;
 // Moving off a seat or bed stands you up; in a transporter's driver's seat the keys drive it instead (transporter.js),
 // and the camera swings round behind it while it moves. A healing capsule holds you until you leave it (E or the button).
 const cart=resting?.spot.mct,driving=cart?.seat==='driver'&&resting.phase==='in'&&resting.t===1;
 if(driving){mct.drive(dt,k.y,k.x,k.run);if(Math.abs(cart.cart.speed)>.3&&!k.look.x)follow.yaw=dampAngle(follow.yaw,cart.cart.yaw,1.2,dt);}
 else if(resting&&!resting.stand&&resting.phase==='in'&&resting.t===1&&wish.lengthSq()>.1)standUp();
 lifts.update(dt,controller);
 vaultLift?.update(dt,controller);
 // A Paws Off run holds the walker on the treadmill (paws-off/game.js); the belts of others playing run too.
 run=pawsOff?.update(dt,remotes?[...remotes.remotes.values()].filter(r=>r.tgt?.playing).map(r=>r.cur):[])||null;
 mudwater?.update(dt);
 vault?.update(dt,controller.position);
 // Riding a moving car, the car carries the walker; it passes slab edges and the hull skin, which must not push.
 const riding=vaultLift?.riding||lifts.lifts.some(l=>l.phase==='moving'&&lifts.inside(l,controller.position));
 // A tap shorter than a frame still counts as held for the first step.
 // In the ball the jump is one low hop (BALL.body.jump).
 if(!resting&&!riding&&!run&&!treasure?.active&&!emergencyDrill?.isOpen){acc+=dt;let pressed=k.jump;while(acc>=STEP){controller.step(STEP,wish,pressed||k.held,ballBounce(inBall,deckOf(controller.position.y)?.number));pressed=false;acc-=STEP;}}else{acc=0;if(riding)controller.velocity.set(0,0,0);}
 treasure?.step(dt,k);
 for(const y of yarns)y.update(dt,resting||riding?null:controller);
 const p=controller.position;
 // The parked ball is solid to walk into.
 if(!inBall&&!resting&&!run&&Math.abs(p.y-ball.mesh.position.y)<1.2){const b=ball.mesh.position,dx=p.x-b.x,dz=p.z-b.z,d=Math.hypot(dx,dz),reach=BALL.radius+BODY.radius;
  if(d<1e-4)p.x+=reach;else if(d<reach){p.x+=dx/d*(reach-d);p.z+=dz/d*(reach-d);}}
 // So are the transporters, parked or moving.
 if(!resting&&!run)mct.push(p,controller.body.radius);
 // Neither safety net keeps a lift car's floor to return to: the car may have gone by the time it is needed, leaving
 // only the shaft.
 const inCar=vaultLift?.inside(p)||lifts.lifts.some(l=>lifts.inside(l,p));
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
 if(cart)followSeat(resting);
 if(resting)pose=restPose(dt);
 else if(run){heading=run.yaw;walker.holder.position.copy(run.pos);walker.holder.rotation.set(0,run.yaw,0);
  // Off the back: over onto his back, head first the way the belt carried him.
  walker.body.rotation.set((-Math.PI/2+PILLOW_TILT)*T.MathUtils.smoothstep(run.tumble,.25,1),0,0);
  if(run.tumble>0)pose={kind:'lie',weight:run.tumble,seatHeight:walker.hipHeight};}
 if(!resting&&!run){walker.holder.position.copy(p);walker.holder.rotation.set(0,heading,0);walker.body.rotation.set(0,0,0);}
 if(inBall){ball.mesh.position.copy(p);if(controller.grounded)ball.roll(dt,controller.velocity.x,controller.velocity.z);}
 walker.update(dt,{speed:run?run.speed:controller.speed,grounded:controller.grounded||riding,stance:controller.stance,jumpCount:controller.jumpCount,jumpS:controller.jumpS,
  turnRate,accel,rise:controller.velocity.y,emote,rest:pose,catnip:!!lounge?.inside(walker.holder.position),swimming:!!treasure?.active});
 live?.pose(myPose(riding),now);
 // In a transporter the camera rides higher, over the heads of the others aboard.
 if(treasure?.active)treasure.updateCamera(dt);else follow.update(dt,resting?resting.view:run?run.pos:p,inBall?BALL.eye:cart&&follow.mode==='third'?WALKER.height+.7:WALKER.height,resting||run||inBall?null:controller.grounded?controller.stance:'stand');
 // Spraying the graffiti wall, the view squares up to it (graffiti.js), and its paint catches up.
 graffiti?.update(camera,now);
 // Hide Cosmo when the camera is pressed right up against him (a lift car, a narrow aisle), or is off at the wall.
 walker.holder.visible=follow.mode!=='first'&&follow.current>.75&&!graffiti?.active;
 capsuleView(!!resting?.stand&&resting.t===1&&follow.mode==='first');
 cull(p);
 remotes?.update(dt,{camera,low:viewSpan[0],high:viewSpan[1]},now);
 // Carts others drive go where their drivers sit; ours is where we drove it.
 mct.update(dt,remotes,walker.hipHeight);
 // The lounge's doors open, and the cold room's strip curtain parts, for anyone near them.
 bodies.length=0;bodies.push(p);if(remotes)for(const r of remotes.remotes.values())bodies.push(r.cur);
 if(arrivalMood)arrivalMood.update(dt,camera.getWorldPosition(eye));
 if(lounge)lounge.update(dt,bodies,camera.getWorldPosition(eye));
 if(recovery)recovery.update(dt,camera.getWorldPosition(eye));
 halloween?.update(dt,camera.getWorldPosition(eye),ambience.on);
 hexFloor?.update(dt,camera.getWorldPosition(eye),p,heading);
 leverPanel?.update(dt,p);
 gaming?.update(dt,camera.getWorldPosition(eye),p,remotes?[...remotes.remotes.values()]:[]);
 arrivalMood?.apply();
 provisions?.update(dt,bodies);
 blossom?.update(dt,p,ambience.on,camera);
 loungeFalls?.update(dt,p);
 loungeSound?.update(p,ambience.on,camera);
 lullaby?.update(p,ambience.on);
 missionHolo?.update(dt,p);
 missionTimer?.update(dt,p);
 surgeryArms?.update(dt,p,remotes?.remotes);
 imagingScans?.update(dt,p,resting,remotes?.remotes);
 // The Container Maze's clock starts at its way in and drops if the walker leaves (maze/run.js).
 maze?.update(p,now);
 freightGate?.update(dt,p,bodies);hangarDoor?.update(dt,p);
 chinampa?.update(dt,p);
 baggage?.update(dt,p);
 atmosphere?.update(dt,p);
 marks?.update(camera,p,now);
 if(now-lastHud>120){lastHud=now;hud(p);paintings.update(p);comics.update(p);mudwater?.load(p);theatre?.update(p);graffiti?.load(p);crownTv?.update(p,camera);
  // Walking into Mudwater Arena counts as a visit (server/arena.mjs).
  const inArena=!!mudwater?.contains(p);if(inArena&&!wasInArena)live?.arena('enter');wasInArena=inArena;}
 if(now-lastMini>66&&!$('minimap-button').hidden){lastMini=now;miniMap(p);}
 drift.update(dt);
 // A game covers the window: the ship need not be drawn behind it.
 if(!arcade.isOpen&&!pool.isOpen&&!pinballGame.isOpen&&!emergencyDrill?.isOpen){draw(camera);if(!firstViewReady){firstViewReady=true;timings.push(['First complete frame',Math.round(performance.now()-t0)]);document.body.dataset.ready='1';hubPanel.resume();if(new URLSearchParams(location.search).get('controls')==='1')controlsSettings?.open();try{localStorage.removeItem(STARTING);}catch{}}}
 const shot=booth.update(now);$('countdown').hidden=!shot.left;if(shot.left)$('countdown').textContent=String(shot.left);
 if(shot.due)takePhoto();
});
// One frame of the ship from `view`: the sky, the haze past the far plane, then the ship.
function draw(view){
 view.updateMatrixWorld(true);atriumGeometry?.update(view,renderer.domElement.height);
 for(const c of [skyCamera,hazeCamera]){c.position.copy(view.position);c.quaternion.copy(view.quaternion);c.fov=view.fov;c.aspect=view.aspect;c.updateProjectionMatrix();}
 renderer.clear();renderer.render(sky,skyCamera);renderer.clearDepth();renderer.render(haze,hazeCamera);renderer.clearDepth();renderer.render(scene,view);
}
// The selfie booth's photo: drawn from its lens and copied off the canvas at once (the drawing buffer is not kept past
// this frame), then the walker's own view drawn back over it.
let photoUrl=null,photoSource=null,photoNames=[],photoRender=0,photoFilename='';
function takePhoto(){
 const canvas=renderer.domElement,shown=walker.holder.visible;walker.holder.visible=true;
 booth.aim(canvas.width,canvas.height);booth.camera.updateMatrixWorld();draw(booth.camera);
 const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);
 photoSource=copy;photoNames=selfieNames();photoFilename=`leo-crown-lounge-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.jpg`;$('photo-names').checked=true;
 walker.holder.visible=shown;draw(camera);
 const flash=$('photo-flash');flash.hidden=false;flash.getAnimations?.().forEach(a=>a.cancel());flash.animate?.([{opacity:.85},{opacity:0}],{duration:450}).finished.then(()=>{flash.hidden=true;},()=>{});
 renderPhoto(true);
}
// Name tags live in an HTML layer, so add their existing display names to the photo canvas here.
function selfieNames(){
 const names=[],ray=new T.Ray(),eye=booth.camera.getWorldPosition(new T.Vector3());
 const add=(name,x,y,z)=>{
  if(!name)return;const point=new T.Vector3(x,y,z),delta=point.clone().sub(eye),distance=delta.length();if(!distance)return;
  ray.set(eye,delta.divideScalar(distance));const hit=colliders.raycast(ray,distance);if(hit&&hit.distance<distance-.4)return;
  point.project(booth.camera);names.push({name,x:point.x,y:point.y,z:point.z});
 };
 for(const r of remotes?.remotes.values()||[])if(r.walker)add(r.name||'Voyager '+r.id.slice(-4),r.cur.x,r.cur.y+(r.rest&&r.restKind==='lie'?.8:2.15),r.cur.z);
 const own=live?.you?.name||me.name||savedName(),p=walker.holder.position;if(own)add(own,p.x,p.y+(resting&&resting.lie ? .8 : 2.15),p.z);
 return names;
}
function renderPhoto(open=false){
 const serial=++photoRender;
 booth.frame(photoSource,photoNames,$('photo-names').checked).then(out=>new Promise(resolve=>out.toBlob(resolve,'image/jpeg',.92))).then(blob=>{if(blob&&serial===photoRender)showPhoto(blob,open);});
}
function showPhoto(blob,open=false){
 if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=URL.createObjectURL(blob);
 const name=photoFilename||`leo-crown-lounge-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.jpg`;
 $('photo-image').src=photoUrl;Object.assign($('photo-save'),{href:photoUrl,download:name});
 // Where the browser can share files (most phones), sharing is the easy way to keep or send it.
 const file=new File([blob],name,{type:'image/jpeg'}),share=$('photo-share');
 share.hidden=!navigator.canShare?.({files:[file]});share.onclick=()=>navigator.share({files:[file],title:'Leo · Crown lounge'}).catch(()=>{});
 if(open){closePanels();$('photo-sheet').hidden=false;input.enabled=false;}
}
// Each visitor chooses the backdrop and angle for their own photo.
function previewBackdrop(){const c=$('selfie-preview').getContext('2d');c.drawImage(booth.backdropCanvas,0,0,c.canvas.width,c.canvas.height);}
$('selfie-backdrop').addEventListener('change',e=>{booth.setBackdrop(Number(e.target.value));previewBackdrop();});
$('selfie-angle').addEventListener('change',e=>booth.setAngle(Number(e.target.value)));
$('selfie-start').addEventListener('click',()=>{closePanels();if(!booth.counting){live?.selfie();booth.start();}});
$('photo-names').addEventListener('change',()=>{if(photoSource)renderPhoto();});
function dampAngle(a,b,lambda,dt){const d=Math.atan2(Math.sin(b-a),Math.cos(b-a));return a+d*(1-Math.exp(-lambda*dt));}

// What's in front of the walker to use: a lift (call button or car panel) first, then the graffiti wall, the selfie camera, a comic book,
// a ship log board, the telescope or an arcade cabinet, then a seat or bed.
function target(){
 const p=controller.position;if(treasure?.active)return treasure.near(p);
 const t=inBall?null:treasure?.near(p);if(t)return t;
 const l=lifts.nearest(p);if(l&&l.kind!=='riding')return l;
 const w=graffiti?.near(p)||crownTv?.near(p);if(w)return w;
 const ladder=hangarDoor?.near(p);if(ladder)return ladder;
 const privacy=cabinGlass?.near(p,new T.Vector3(Math.sin(heading),0,Math.cos(heading)));if(privacy)return privacy;
 const b=booth.near(p)||comics.near(p)||chinampa?.near(p);if(b)return b;
 const v=inBall?null:vault?.near(p);if(v)return v;
 const tube=inBall?null:vaultLift?.nearest(p);if(tube)return tube.kind==='riding'?null:tube;
 const g=changeLog.near(p);if(g)return g;
 const welcome=inBall?null:arrivalTour?.near(p);if(welcome)return welcome;
 if(scope&&Math.abs(p.y-scope.y)<1.5&&Math.hypot(p.x-scope.x,p.z-scope.z)<2)return {kind:'play',label:'Play Alien Cat Invasion'};
 const drill=inBall?null:emergencyStation.near(p);if(drill)return drill;
 const q=poolTable?.near(p)||maze?.near(p)||pinballMachine?.near(p)||arcadeRow?.near(p)||pawsOff?.near(p)||mudwater?.near(p)||halloween?.near(p)||leverPanel?.near(p);if(q&&!(inBall&&q.kind==='treadmill'))return q;
 // In the hamster ball: no seats, beds or treadmills; with nothing else to use, E climbs out.
 if(inBall)return {kind:'ball-out',label:'Get out of the ball'};
 const parked=ball.mesh.position;if(Math.abs(p.y-parked.y)<1.2&&Math.hypot(p.x-parked.x,p.z-parked.z)<BALL.radius+1)return {kind:'ball',label:'Get in the ball'};
 // A transporter's driver's seat or rear seats (transporter.js).
 const m=mct.near(p,remotes);if(m)return m;
 const s=rest.pick(p,new T.Vector3(Math.sin(heading),0,Math.cos(heading)));
 return s?{kind:s.kind,spot:s,label:s.kind==='lie'?'Lie down':s.kind==='stand'?'Enter the healing capsule':'Sit down'}:null;
}
const touch=matchMedia('(pointer:coarse)').matches;
function hud(p){
 arrivalTour?.update(p,camera,ready()&&input.enabled&&!resting&&!run&&!inBall&&!treasure?.active);
 $('where').textContent=describe(p);
 // The changes made around here, for the ship log's chip.
 const near=changeLog.nearby(p).length,chip=$('changes-here');
 if(chip.dataset.count!==String(near)){chip.dataset.count=String(near);chip.hidden=!near;chip.querySelector('b').textContent=String(near);
  chip.querySelector('span').textContent=near===1?' change here':' changes here';chip.setAttribute('aria-label',`${near} change${near===1?'':'s'} made around here: open the ship log`);}
 const t=run||graffiti?.active?null:resting?{label:resting.stand?'Leave the capsule':resting.spot.mct?'Get out':resting.lie?'Get up':'Stand up'}:target();
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
 }else if(spot.kind==='stand'){
  // A healing capsule (surgery.js): stood on its floor, facing out of the tube.
  yaw=Math.atan2(spot.facing.x,spot.facing.z);pos=spot.point.clone();
 }else{
  const face=spot.facing?spot.facing.clone():new T.Vector3(p.x-spot.point.x,0,p.z-spot.point.z);
  if(face.lengthSq()<1e-6)face.set(Math.sin(heading),0,Math.cos(heading));face.normalize();
  yaw=Math.atan2(face.x,face.z);pos=spot.point.clone().addScaledVector(face,.04);pos.y=spot.height+.06-walker.hipHeight;
 }
 const stand=spot.kind==='stand';
 resting={spot,lie,stand,from:{pos:p,heading},to:{pos,yaw},t:0,phase:'in',view:new T.Vector3(spot.point.x,spot.height-(stand?0:lie?.35:.55),spot.point.z)};
}
const PILLOW_TILT=.12;
// Paws Off: on the treadmill, the game has the keys and the camera goes behind Cosmo; off it, the walk has them back.
function startRun(m){
 closePanels();emote=null;resting=null;input.enabled=false;input.down.clear();controller.velocity.set(0,0,0);
 runView=follow.mode;follow.mode='third';follow.yaw=m.yaw;follow.pitch=-.28;follow.look(0,0);
}
function endRun({at,yaw}){
 run=null;controller.place(at);heading=yaw;follow.mode=runView;walker.body.rotation.set(0,0,0);input.enabled=true;input.down.clear();
}
// Seen from inside a healing capsule (first person): the view tinted blue and wavering, as through the fluid (walk.html).
function capsuleView(on){if(document.body.classList.contains('capsule-view')!==on)document.body.classList.toggle('capsule-view',on);}
function standUp(){
 if(!resting||resting.phase!=='in')return;
 // Out of a transporter: beside it, or behind a rear seat; a driver leaves it parked where it stopped.
 const m=resting.spot.mct;if(m){const out=mct.exit(m.cart,m.seat);resting.from.pos.copy(out.pos);resting.from.heading=out.heading;if(m.seat==='driver')mct.park(m.cart);}
 resting.phase='out';
}
// In a transporter's seat the seat moves with the cart: the body, its facing and the camera's pivot follow it, and so does
// the walker's own position (the map, the drawn decks and where it says you are).
function followSeat(r){
 const s=mct.spot(r.spot.mct.cart,r.spot.mct.seat);
 r.to.pos.copy(s.point).addScaledVector(s.facing,.04).setY(s.height+.06-walker.hipHeight);r.to.yaw=Math.atan2(s.facing.x,s.facing.z);r.view.set(s.point.x,s.height-.55,s.point.z);
 if(r.phase==='in')controller.position.set(r.to.pos.x,r.spot.mct.cart.pos.y,r.to.pos.z);
}
function restPose(dt){
 const r=resting;r.t=T.MathUtils.clamp(r.t+(r.phase==='in'?1:-1)*dt/.7,0,1);
 const e=r.t*r.t*(3-2*r.t),h=walker.holder;
 h.position.lerpVectors(r.from.pos,r.to.pos,e);h.rotation.set(0,lerpAngle(r.from.heading,r.to.yaw,Math.min(1,e*1.6)),0);
 walker.body.rotation.set(r.lie?(-Math.PI/2+PILLOW_TILT)*T.MathUtils.smoothstep(r.t,.25,1):0,0,0);
 // In a hammock (lounge.js) the body swings with it.
 const swing=r.spot.hammock&&lounge?.swingOf(r.spot.hammock);
 if(swing){const q=new T.Quaternion().setFromAxisAngle(swing.axis,swing.angle*e);h.position.sub(swing.pivot).applyQuaternion(q).add(swing.pivot);h.quaternion.premultiply(q);}
 if(r.phase==='out'&&r.t===0){heading=r.from.heading;controller.place(r.from.pos);resting=null;return null;}
 // In a healing capsule the body floats a little in the fluid, standing.
 if(r.stand){h.position.y+=(.20+.025*(1-Math.cos(performance.now()/1100)))*e;return {kind:'float',weight:e,seatHeight:walker.hipHeight};}
 return {kind:r.lie?'lie':'sit',weight:e,seatHeight:walker.hipHeight,hammock:!!r.spot.hammock};
}
function lerpAngle(a,b,t){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;}

// The lift panel: one button per stop.
function openLiftPanel(l,rides=lifts){
 const panel=$('lift-panel'),list=panel.querySelector('.stops');list.textContent='';
 panel.querySelector('h2').textContent=l.spec.name;
 for(const s of rides.stopsOf(l)){const b=document.createElement('button');b.type='button';b.textContent=s.label+(s.here?' · here':'');b.disabled=s.here;
  b.onclick=()=>{rides.call(l,s.index,{now:true});closePanels();};list.appendChild(b);}
 panel.hidden=false;input.enabled=false;list.querySelector('button:not([disabled])')?.focus();
}
function togglePlaces(){
 const panel=$('places');if(!panel.hidden){closePanels();return;}
 const list=panel.querySelector('.stops');list.textContent='';
 const tour=document.createElement('button');tour.type='button';tour.textContent='Arrival tour: welcome guide and five optional stops';
 tour.onclick=()=>{closePanels();arrivalTour?.open();};list.appendChild(tour);
 // Every change made to Leo, with its before and after: the ship log, which the keyboard opens with L.
 const log=document.createElement('button');log.type='button';log.className='log';
 log.append(Object.assign(document.createElement('b'),{textContent:'Ship log'}),Object.assign(document.createElement('span'),{textContent:'Every change to Leo, before and after, and a way there'}));
 log.onclick=()=>{closePanels();openLog();};list.appendChild(log);
  renderGotoMenu(list,PLACES,{go:goTo,close:closePanels,currentDeck:deckOf(controller.position.y)?.number});
 panel.hidden=false;input.enabled=false;
}
// Help: H or the toolbar's Help opens it, and H, Esc or Close shut it.
function toggleHelp(){const panel=$('help-sheet');if(!panel.hidden){closePanels();return;}closePanels();help.open();input.enabled=false;}
// The emotes sheet shows the current bindings beside each action.
function toggleEmotes(){
 const panel=$('emotes');if(!panel)return;if(!panel.hidden){closePanels();return;}
 const list=panel.querySelector('.stops');list.textContent='';
 EMOTES.forEach((name,i)=>{const b=document.createElement('button');b.type='button';const label=name.replace(/_/g,' ');b.textContent=`${bindingLabel(walkBindings.get('emote:'+i))} · ${label[0].toUpperCase()}${label.slice(1)}`;b.onclick=()=>{closePanels();actions.emote(i);};list.appendChild(b);});
 panel.hidden=false;input.enabled=false;list.querySelector('button')?.focus();
}
function goTo(place){place=remapSpot(place);const q=place.id?v2GotoStand(colliders,place.at):findStand(colliders,place.at);if(!q)return false;if(pawsOff?.active)pawsOff.leave();
 treasure?.leave(false);
 // Going elsewhere from a transporter's driver's seat leaves it parked where it is.
 if(resting?.spot.mct?.seat==='driver')mct.park(resting.spot.mct.cart);resting=null;
 // Going somewhere else leaves the ball behind, back in the gardens.
 if(inBall){leaveBall(q);ball.mesh.position.copy(ballHome);}controller.place(q);heading=place.yaw;follow.yaw=place.yaw;follow.current=.4;return true;}
// Keys held when a panel opened would otherwise keep walking after it closes.
function closePanels(){furSettings?.close();emergencyDrill?.close();controlsSettings?.close();graphicsSettings?.close();for(const id of ['lift-panel','places','emotes','map-sheet','aboard-sheet','name-sheet','photo-sheet','selfie-setup','comic-sheet','info-sheet','mudwater-sheet','clown-sheet','help-sheet','outside-sheet','vault-sheet'])$(id).hidden=true;closeOutside($('outside-sheet'),$('outside-frame'));maze?.close();treasure?.close();chat.close();graffiti?.close();crownTv?.close();input.enabled=true;input.down.clear();}
// The list is a current server snapshot, including visitors who have not sent a pose yet.
function showAboardList(){
 const list=$('aboard-list'),note=$('aboard-note');list.replaceChildren();
 note.textContent=liveStatus!=='live'?'Not connected to Leo live.':aboardNames===undefined?'Waiting for the visitor list...':aboardNames===null?'Visitor list unavailable on this connection.':'';
 if(liveStatus==='live'&&aboardNames)for(const name of aboardNames){const li=document.createElement('li');li.textContent=name;list.appendChild(li);}
}
$('aboard').addEventListener('click',()=>{if(!$('aboard-sheet').hidden){closePanels();return;}closePanels();showAboardList();$('aboard-sheet').hidden=false;input.enabled=false;input.down.clear();$('aboard-close').focus();});
$('aboard-name').addEventListener('click',openName);
// The name others see over your head.
function openName(){closePanels();
 // Connected, the name aboard is the Discord name; otherwise one of your choosing, or connect Discord instead.
 const verified=!!live?.you?.verified&&!live.you.typed;$('name-sheet').dataset.verified=verified?'1':'';
 $('name-title').textContent=verified?`Aboard as ${live.you.name}`:'Your name';
 $('name-edit').value=savedName();$('name-sheet').hidden=false;input.enabled=false;if(!verified)$('name-edit').focus();}
$('name-connect').addEventListener('click',connect);
// The vault's password (vault.js): the right one opens the door; a wrong one says so and lets you try again.
$('vault-form').addEventListener('submit',e=>{e.preventDefault();if(vault?.unlock($('vault-code').value)){closePanels();return;}
 $('vault-note').textContent='That’s not the password. Try again.';$('vault-code').select();});
$('name-form').addEventListener('submit',e=>{e.preventDefault();live?.rename($('name-edit').value.trim());closePanels();});
for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',closePanels);
$('use').addEventListener('click',()=>actions.use());
// The comic reader (comics.js); Finish on the last page closes it.
const reader=createComicReader($('comic-sheet'),{urls:artUrls,onClose:closePanels});
$('go').addEventListener('click',togglePlaces);
$('help').addEventListener('click',()=>actions.help());
// The ship log from the toolbar, the "changes here" chip or L.
for(const id of ['log','changes-here'])$(id).addEventListener('click',()=>{if(ready())openLog();});
$('view').addEventListener('click',()=>actions.view());
// On a phone View, Sound and Res sit behind More; it closes on View or a tap anywhere else.
const toolBar=document.querySelector('.tools'),moreButton=$('tools-more');
const setMore=open=>{toolBar.classList.toggle('more-open',open);moreButton.setAttribute('aria-expanded',String(open));};
moreButton.addEventListener('click',()=>setMore(!toolBar.classList.contains('more-open')));
$('view').addEventListener('click',()=>setMore(false));
document.addEventListener('pointerdown',e=>{if(!toolBar.contains(e.target))setMore(false);});
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
// The Container Maze (maze/run.js): its clock, its best times on Leo live, and a way back to its start.
maze=createMazeGame({hold:mazeHold,live:()=>live,muted:()=>!ambience.on,
 goTo(at,yaw){closePanels();emote=null;goTo({at:at.toArray(),yaw,resolved:true});},
 onOpen(){closePanels();emote=null;input.enabled=false;},
 onClose(){input.enabled=true;input.down.clear();},
});
// The upper gallery's aquarium door: a separate swim mode, with its own clock and Leo live board.
treasure=createTreasureGame({tank:lounge?.aquarium,controller,follow,camera,input,live:()=>live,
 onEnter(){closePanels();emote=null;},onExit(){emote=null;},
 onOpen(){closePanels();input.enabled=false;input.down.clear();},
 onClose(){input.enabled=true;input.down.clear();},
});
// Leo Pinball at the Recreation Hall's end wall (pinball/game.js), the same way; its best score stays in this browser.
const pinballGame=createPinball({
 onOpen(){closePanels();emote=null;input.enabled=false;},
 onClose(){input.enabled=true;input.down.clear();},
 muted:()=>!ambience.on,
});
// One escape-shuttle practice flight. Its personal best stays in this browser.
emergencyDrill=createEmergencyDrill({
 onOpen(){closePanels();emote=null;input.enabled=false;input.down.clear();input.jumpQueued=input.jumpHeld=false;controller.velocity.set(0,0,0);},
 onClose(){input.enabled=true;input.down.clear();input.jumpQueued=input.jumpHeld=false;},
});
sound.addEventListener('click',()=>sound.setAttribute('aria-pressed',String(ambience.toggle())));
// Render resolution, set up with the renderer: each press steps High, Med, Low and round again.
const resButton=$('resolution');setRes(res);
graphicsSettings=mountGraphicsSettings({onOpenChange(open){if(open)closePanels();input.enabled=!open;input.down.clear();input.jumpQueued=false;input.jumpHeld=false;input.runLatched=false;input.stickRun=false;input.zoom=0;input.look.x=0;input.look.y=0;input.stickVec.x=0;input.stickVec.y=0;}});
controlsSettings=mountControlsSettings({emotes:EMOTES,onOpenChange(open){if(open)closePanels();input.enabled=!open;input.down.clear();input.jumpQueued=false;input.jumpHeld=false;input.runLatched=false;input.stickRun=false;input.zoom=0;input.look.x=0;input.look.y=0;input.stickVec.x=0;input.stickVec.y=0;}});
furSettings=mountFurSettings({getColour:()=>furColour,onColour:value=>{furColour=value;walker.setFur(value);},onOpenChange(open){if(open)closePanels();input.enabled=!open;input.down.clear();input.jumpQueued=false;input.jumpHeld=false;input.runLatched=false;input.stickRun=false;input.zoom=0;input.look.x=0;input.look.y=0;input.stickVec.x=0;input.stickVec.y=0;}});
resButton.addEventListener('click',()=>{resChosen=true;setRes((res+1)%RES.length);try{localStorage.setItem(RES_KEY,RES[res]);}catch{}});
// Held for a higher jump, as Space is.
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();input.jumpQueued=true;input.jumpHeld=true;$('jump').setPointerCapture(e.pointerId);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('jump').addEventListener(type,()=>{input.jumpHeld=false;});
$('crouch').addEventListener('click',()=>actions.crouch());
$('emote-button').addEventListener('click',()=>actions.emotes());
$('ping').addEventListener('click',()=>actions.ping());
for(const b of document.querySelectorAll('.respawn'))b.addEventListener('click',()=>actions.respawn());

if(typeof __WALK_DEBUG__!=="undefined"&&__WALK_DEBUG__)Object.defineProperties(globalThis.__walk,{treasure:{get:()=>treasure},baggage:{get:()=>baggage},featureDiagnostics:{get:()=>ship.v2RuntimeFeatures}});
// Include the ball and aquarium entrance created later in startup, before the first frame.
for(const root of [scene,haze,sky])onePassAtriumGlass(root);
