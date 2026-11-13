import {createAtriumGeometryRuntime} from '../v2/atrium-geometry-runtime.js';
import {getAtriumQuality,observeAtriumFrame,setAtriumAutoDefault,setAtriumQuality,subscribeAtriumQuality} from '../v2/atrium-quality.js';
import {mountGraphicsSettings} from './graphics-settings.js';
import {DETAIL,closeHaze} from './detail-levels.js';
import {installFilmLook} from './film-look.js';
import {mountControlsSettings} from './controls-settings.js';
import {mountFurSettings} from './fur-settings.js';
import {savedFur} from './fur-colours.js';
let furColour=savedFur(),furSettings=null;
import {walkBindings,bindingLabel} from './bindings.js';
let atriumGeometry=null,graphicsSettings=null,controlsSettings=null;
// Deck band draws (src/v2/phone-bands.js): each opaque or faint glass material of the deck bands is one draw, on phones
// and desktops (a desktop's frame was mostly the CPU's cost of 2,700 draws at the open atrium, 13 ms on an RTX 3090).
// Each kind of room furnishing is one draw too (phone-furnishing.js), and the rest of the bands are batched as before
// (src/v2/facade.js; on a phone every band, no per-chunk culling). ?phonebatch= tries the earlier ways on a phone: band
// (batches per band, #347), cull (the same, culled: lettering jumped), low (decks -1 to 4 only). ?deskbatch=low draws a
// desktop as before: decks -1 to 4 batched and the atrium geometry pack.
const phoneBatching=(()=>{const query=new URLSearchParams(location.search);if(!preparedPhone)return query.get('deskbatch')==='low'?{}:{merge:true};const mode=query.get('phonebatch');
 return mode==='cull'?{allBands:true,cull:true}:mode==='low'?{}:mode==='band'?{allBands:true}:{allBands:true,merge:true};})();
let phoneBands=null,wayfindingSigns=null,fogCull=null;
// The atrium geometry pack binds the band pieces the merge hides, so it runs only without the merge, and the Detail menu
// chooses its distant detail. The merged bands keep full detail and still draw faster: on them the menu sets the atrium's
// haze (detail-levels.js), and Auto starts at High, the look before the menu came back. ?detail=high|balanced|performance
// tries a level for this visit only.
const atriumPack=!preparedPhone&&!phoneBatching.merge,deskDetail=!preparedPhone&&!atriumPack;
if(deskDetail){setAtriumAutoDefault('high');const level=new URLSearchParams(location.search).get('detail');if(Object.hasOwn(DETAIL,level??''))setAtriumQuality(level,{persist:false});}
import {ATRIUM_VIEW} from '../v2/atrium-render-policy.js';
import {settlePreparedStatic} from '../v2/prepared-static.js';
import {cullByBox} from '../v2/box-frustum.js';
// Meshes whose bounding sphere reaches the view but whose box does not are culled too (src/v2/box-frustum.js).
cullByBox();
import {setAtriumView,setAtriumSight,inOpenAtrium,atriumViewSpan,onePassAtriumGlass,enableAtriumProxyFade,setAtriumRoomViews,setAtriumFurnished,atriumStandIns} from '../v2/atrium-visibility.js';
import {atriumRoomViewJob,atriumCabinSides} from '../v2/atrium-room-views.js';
// The atrium's room stand-ins: painted with the real cabins' insides once captured (below, atrium-room-views.js), until
// then dissolving near the eye's height instead of vanishing in one frame (atrium-visibility.js).
enableAtriumProxyFade();
import {createAtriumSight} from '../v2/atrium-sight.js';
import {releaseBatchedSources,releasePhoneGeometry,shrinkPhonePictures} from '../v2/phone-memory.js';
import {batchFurnishing} from '../v2/furnishing-batches.js';
import {createFrameReadout} from './frame-readout.js';
import {deskAntialias,heldRes} from './pixel-switches.js';
import {mergePhoneFurnishing} from '../v2/phone-furnishing.js';
import {mergePhoneBands} from '../v2/phone-bands.js';
import {deskPieceSize,gpuName} from '../v2/desk-piece.js';
import {createAtriumPvs} from '../v2/atrium-pvs.js';
import {PVS_LOCAL_SPAN} from '../v2/atrium-pvs-key.js';
import {warmShaders,uploadTextures,WARM_WAIT_MS} from '../v2/shader-warmup.js';
// Precomputed atrium sight (scripts/walk-atrium-pvs.mjs), shipped by the build only for the colliders and atrium it was
// baked from (__ATRIUM_PVS_KEY__). Until it arrives, or if it was baked from other geometry, the sight rays answer as before.
let atriumPvs=null;
if(typeof __ATRIUM_PVS_URL__!=='undefined'&&__ATRIUM_PVS_URL__)fetch(new URL(__ATRIUM_PVS_URL__,location.href)).then(r=>r.ok?r.json():null).then(data=>{atriumPvs=createAtriumPvs(data,{key:__ATRIUM_PVS_KEY__});}).catch(e=>console.warn('Atrium PVS not used:',e.message));
import {createOwnerHiding,ownerBakeFile,ownerBakeProblem,ownerKey} from '../v2/owner-hiding.js';
// Owner hiding (scripts/walk-owner-bake.mjs): drawables proven hidden from the camera's 2 m cell, baked for this exact
// walk script into walk-owner-bake.<hash>.json beside it (the build writes an empty one), fetched once the first view is
// up and used around the main camera's draw. ?ownerBake opens the walk as the bake's page instead: geometry arrays are
// kept and the scene goes to the bake (globalThis.__ownerBakeHost). Not on phones, whose scene is built differently.
const WALK_SCRIPT=new URL(import.meta.url).pathname.split('/').pop(),OWNER_BAKE_PAGE=new URLSearchParams(location.search).has('ownerBake');
let ownerHiding=null;
function startOwnerHiding(){
 if(preparedPhone)return;const key=ownerKey(WALK_SCRIPT,(phoneBatching.merge?'merge':'batch')+deskPiece);
 if(OWNER_BAKE_PAGE){globalThis.__ownerBakeHost={T,scene,renderer,camera,key,follow,goTo:place=>goTo(place)};return;}
 const file=ownerBakeFile(WALK_SCRIPT);if(!file)return;
 fetch(new URL(file,import.meta.url)).then(r=>r.ok?r.json():null).then(data=>{const hiding=createOwnerHiding(data,{key,scene});hiding?.resolve();ownerHiding=hiding;
  // A real bake the walk will not use (another key, format or grid): say why. The build's empty file stays quiet.
  if(!hiding&&data?.blocks?.length)console.info('Owner hiding not used:',ownerBakeProblem(data,key));}).catch(e=>console.warn('Owner hiding not used:',e.message));
}
import {loadPreparedShip,preparedBake,preparedFacade,preparedHaze,preparedPlacements,preparedDecks,preparedSigns,preparedPhone} from '../v2/prepared-runtime.public.js';
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
import {prepareWalkWorld} from './prepare.public.js';
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
import {STATIC_LIFT_PARTS,LIFTS,shutLandingDoors} from './lifts.js';
import {KEEL,RIVER,createTubeMesh,tubeBoard,tubeStep,tubeKick,tubeSeat,TUBE_SIT,TUBE_RIM,tubeDock,inKeelHall,keelPlan,KEEL_PLAN_EXTENT} from './keel-club.public.js';
import {Controller,GLIDE,HOOK} from './controller.js';
import {FollowCamera} from './camera.js';
import {WalkInput} from './input.js';
import {createWalker,WALKER,EMOTES} from './avatar.js';
import {bakeForWalking,showBands} from '../v2/render-bake.js';
import {bandOf} from './collision.js';
import {mergeMeshes} from './merge-by-material.js';
import {mergeCallLights} from './call-lights.js';
import {mergeWayfindingSigns} from './sign-array.js';
import {sharePlaques} from './plaque-atlas.js';
import {createFogCull,FOG_CULL_LAYER} from './fog-cull.js';
import {partitionMesh} from './partitions.js';
import walkPlan from 'walk-partitions';
import {railingMesh} from '../v2/railings.js';
import {ShipMap,drawMiniMap,drawFullMap,deckOf,arrow as mapArrow} from './minimap.public.js';
const DECKS=preparedDecks;
import {floorY} from '../transit.js';
import {createLifts} from './lift-ride.public.js';
import {spotIndex} from '../v2/rest.js';
import {PLACES,findStand,describe} from './places.js';
import {openWindows,clearGlass} from './windows.js';
import {createHaze} from '../v2/haze.js';
import {createStarDrift} from './star-drift.js';
import {createAmbience} from './ambience.js';
import {createLullaby} from './lullaby.js';
import {createLoungeSound} from './lounge-sound.js';
import {createTrainingSound} from './training-sound.js';
import {createKeelSound} from './keel-club-sound.js';
import {stairSigns,corridorSigns,floorGuides} from './signs.public.js';
import {corridorTrim} from './trim.public.js';
import {connectLive,savedName,httpBase} from './net/live.js';
import {identify,currentPass,bestPass,connect,connectPopup,forget,invite} from './net/connect.js';
import {inOtherside,onGlyph} from './net/otherside.js';
import {RemotePlayers} from './remotes.js';
import {glossLoungeFloor,quietFloorReflections} from './lounge-floor.js';
import {tileLiftFloor} from './lift-tile-floor.js';
import {createRecoveryMood} from './recovery.js';
import {createAtriumMood} from './atrium-mood.js';
import {createArrivalMood} from './arrival-mood.js';
import {Marks} from './marks.public.js';
import {createChat} from './chat.js';
import {createHostess} from './hostess.public.js';
import {createPortableSelfie} from './portable-selfie.js';
import {createPhotoSpots} from './photo-spots.js';
import {wearHat,fit,FIT} from './hat.js';
import {createYarn,YARN_SPOTS} from './yarn.js';
import {BALL,createBallMesh} from './hamster-ball.js';
import {createGlide} from './glide.js';
import {createGrapple} from './grapple.js';
import {ballBounce,ballDismount} from './ball-bounce.js';
import {MeshBVH} from 'three-mesh-bvh';
import {readSpot,spotLink,remapSpot} from './link.js';
import {keepSpot,takeSpot} from './last-spot.js';
import {createJoin} from './join.js';
import {createCaptainSays} from './captain-says.js';
import {restrictedAt,publicStand} from './public-area.js';
import {KITTEN_POSE_NAMES} from './kittens.public.js';
import {createAtriumKittens} from './arrival-atrium.public.js';
import {createSurgeryArms} from './surgery.public.js';
import {createImagingScans} from './imaging.js';
import {createMissionTimer} from './mission-timer.js';
import {createFinCasing} from './fin-casing.js';
import {createGraffiti} from './graffiti.js';
import {createCrownTv} from './crown-tv.js';
import {createInvasion} from './invasion/game.js';
import {createEmergencyDrill} from './emergency-drill/game.js';
import {drillStation} from './emergency-drill/station.js';
import layout from '../plan/selected-layout.js';
import {installCornerShade,cornerShadeLeavesAlone} from './corner-shade.js';
import {shareEquivalentMaterials} from './share-materials.js';
let emergencyDrill=null;const emergencyStation=drillStation(layout);
import {createPawPool} from './pool/game.js';
import {createPinball} from './pinball/game.js';
import {openOutside,closeOutside} from './outside-game.js';
import {createMazeGame} from './maze/run.js';
import {createTreasureGame} from './aquarium-treasure/game.js';
import {createPawsOff} from './paws-off/game.public.js';
import {createMudwater} from './mudwater.public.js';
import {createGiveaway} from './mudwater-giveaway.js';
import {createPaintings} from './paintings.public.js';
import {createComics,createComicReader} from './comics.public.js';
import {showInfo} from './chinampa.js';
import {createChangesBoards} from './changes-board.public.js';
import {createTheatre,ACTOR_POSE_NAMES} from './theatre.public.js';
import {createGamingLounge} from './gaming-lounge.public.js';
import {createCommsDisplays} from './comms-displays.public.js';
import {createHalloween} from './halloween.js';
import {createHexFloor} from './hex-floor.public.js';
import {createLoungeCompass} from './lounge-compass.public.js';
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
// script loads. The note is set from here until the walk is ready, so only a start that was cut off leaves it behind:
// walk.html clears it when the page is left in good order (from before this script loads) or the start fails for
// another reason than memory.
const STARTING='leo-walk-building';
try{localStorage.setItem(STARTING,String(Date.now()));}catch{}
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
const phone=matchMedia('(pointer:coarse)').matches,phoneTest=new URLSearchParams(location.search);
// Phone A/B switches, for testing on a device only: ?phoneaa=0 drops multisampling, ?phonedepth=linear drops the
// logarithmic depth buffer (its depth writes can keep a phone GPU from skipping hidden surfaces; the near plane moves
// out to 0.2 m for precision). Neither is on by default. On a desktop the Detail menu's Performance uses linear depth
// from the next load (detail-levels.js); ?deskdepth=linear or ?deskdepth=log forces either.
const linearDepth=phone?phoneTest.get('phonedepth')==='linear':(phoneTest.get('deskdepth')??(deskDetail&&DETAIL[getAtriumQuality()].linearDepth?'linear':'log'))==='linear';
// Linear depth cannot part the ship's 6 mm layers much past 140 m, so until the next load the view stays within
// Performance's haze whatever the level, the Keel hall's included.
const hazeHeld=deskDetail&&linearDepth;
// Other visitors are shaded cheaply on a phone (crowd-draw.js leanMaterial); ?phonecats=full gives them their own
// materials, to compare.
const leanCats=phone&&phoneTest.get('phonecats')!=='full';
// The crowd's farther visitors are drawn on lighter meshes (crowd-tier.js); ?crowdlod=0 draws them all in full, to compare.
const crowdLod=phoneTest.get('crowdlod')!=='0';
// The crowd is capped (remotes.js); ?crowdfps=N (1 to 240) trims it to keep N frames a second instead (crowd-count.js),
// on trial: on a phone it kept cuts that bought nothing.
const crowdFpsN=Number(phoneTest.get('crowdfps')),crowdFps=Number.isInteger(crowdFpsN)&&crowdFpsN>=1&&crowdFpsN<=240?crowdFpsN:0;
// ?phonehide=bands,glass,furnish,gardens,haze,cats hides those for a test on a device, to see what its GPU spends on.
const PHONE_HIDE={bands:o=>/^V2_low_deck_merged_/.test(o.name)&&!o.material[0]?.transparent,glass:o=>[o.material].flat().some(m=>m?.transparent),
 furnish:o=>o.isInstancedMesh&&o.userData.phase4||o.userData.phase4Batch,gardens:o=>[o.material].flat().some(m=>m?.name==='P6_atrium_gardens'),haze:o=>/haze/i.test(o.name),cats:o=>o.isSkinnedMesh};
const phoneHide=(phoneTest.get('phonehide')||'').split(',').map(k=>PHONE_HIDE[k]).filter(Boolean);let phoneHidden=[],phoneHiddenAt=-Infinity;
// Multisampling is chosen with the context: the Detail menu's Performance drops it from the next load. On a desktop
// ?deskaa=0 or ?deskaa=1 forces either (pixel-switches.js), as ?deskdepth= does the depth buffer.
const antialiasByDetail=!(phone&&phoneTest.get('phoneaa')==='0')&&!(deskDetail&&!DETAIL[getAtriumQuality()].antialias);
const renderer=new T.WebGLRenderer({antialias:phone?antialiasByDetail:deskAntialias(phoneTest,antialiasByDetail),logarithmicDepthBuffer:!linearDepth,powerPreference:'high-performance'});
// A desktop's bigger merged bands draw in view-culled pieces of at most this many triangles (phone-bands.js): smaller
// on Apple and integrated GPUs, which are short of triangles, larger on discrete cards, which are short of draws
// (desk-piece.js). ?deskpiece= sets any size, 0 for one draw per material as on a phone.
const deskPiece=deskPieceSize({query:new URLSearchParams(location.search),phone:preparedPhone,gpu:gpuName(renderer.getContext())});
// The ship's layers are set apart by height (a floor finish 6 mm over the deck, paint 8 mm): with the logarithmic depth
// buffer the shaders write the depth, so polygon offset has never applied. With linear depth it would, and pull the hex
// sub-floor (finish-kit.js) over the Arrival Hall's finish, so it stays off.
if(linearDepth){const gl=renderer.getContext(),enable=gl.enable.bind(gl);gl.enable=cap=>{if(cap!==gl.POLYGON_OFFSET_FILL)enable(cap);};}
const frameReadout=createFrameReadout(renderer,{extra:()=>remotes?.crowdLine()});
// Resolution: High is the usual sharpness; Medium and Low draw fewer pixels, for slower laptops and phones.
// The Res button steps through them and the choice is remembered for the next visit. ?res=high, med or low holds a
// level for this visit in the saved one's place (pixel-switches.js): nothing is saved, and it never steps down.
const RES=['High','Med','Low'],RES_SCALE=[1,.75,.5],RES_KEY='leo-walk-resolution',maxRatio=Math.min(devicePixelRatio,phone?1.25:1.75);
const savedRes=heldRes(phoneTest,RES)??(()=>{try{return localStorage.getItem(RES_KEY);}catch{return null;}})();
let res=Math.max(0,RES.indexOf(savedRes)),resChosen=savedRes!==null,resFrames=[],resFrom=0;
const setRes=i=>{res=i;renderer.setPixelRatio(maxRatio*RES_SCALE[res]);$('resolution').textContent=`Res ${RES[res]}`;};
// Until the visitor picks a resolution, four seconds under 20 frames a second steps it down a level, for this visit only
// (nothing is saved). Older laptops start on High otherwise and many never find the button. Not under automation, so
// captures keep their sharpness; a stall or a hidden tab doesn't count. Three frames are enough: a phone at 1.5 frames a
// second shows six in four seconds, and with eight required it never stepped down.
function watchFrames(ms,now){
 if(resChosen||res===RES.length-1||navigator.webdriver||document.hidden||ms>3000)return;
 if(!resFrom)resFrom=now;resFrames.push(ms);if(now-resFrom<4000)return;
 const median=resFrames.sort((a,b)=>a-b)[resFrames.length>>1],enough=resFrames.length>=3;resFrames=[];resFrom=now;
 if(enough&&median>50)setRes(res+1);
}
renderer.setPixelRatio(maxRatio*RES_SCALE[res]);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
// Lift door shutter blades are clipped to their doorway as they open (lift-ride.js).
renderer.localClippingEnabled=true;
$('viewport').appendChild(renderer.domElement);
// A phone short of graphics memory drops the WebGL context: bring the card back with a reason, not a frozen view. The
// card then shows that line and Reload alone (walk.html, LEO_WALK_FAILED), not the notes of a start still under way.
renderer.domElement.addEventListener('webglcontextlost',()=>{document.body.dataset.ready='0';const line='The view stopped: this device ran short of graphics memory. Reload to walk again.';if(window.LEO_WALK_FAILED)window.LEO_WALK_FAILED(line);else $('loading-text').textContent=line;});
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
const camera=new T.PerspectiveCamera(phone?70:62,1,linearDepth?.2:.05,ATRIUM_VIEW.far);
// Past the far plane, the ship in haze rather than open space (haze.js); drawn between the sky and the ship.
const haze=new T.Scene();haze.fog=scene.fog;const hazeCamera=new T.PerspectiveCamera(60,1,ATRIUM_VIEW.far-10,1500);
// Cool, crisp base light (2B): rooms with a mood of their own warm or dim it while you are inside.
const hemi=new T.HemisphereLight(0xeef4ff,0x4f5d68,1);scene.add(hemi);
const fill=new T.DirectionalLight(0xf2f6ff,.55);fill.position.set(.3,1,.2);scene.add(fill);
// (The shader warm-up waits for it: an environment map is part of most materials' shaders.)
const environmentReady=loadEnvironment(renderer).then(t=>{scene.environment=t;quietFloorReflections(scene,t);}).catch(()=>{});
function resize(){const w=innerWidth,h=innerHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();

deferRoomFrames();const ship=await loadPreparedShip(scene,status);scene.add(ship.root);
const colliders=new Colliders();
// The Camera button's portable selfie lens (portable-selfie.js): drawn in place of the walker's view while its panel is open.
const portable=createPortableSelfie();
// The ship map image is small; it loads alongside the models.
const shipMap=new ShipMap(__MAP_URL__);shipMap.ready.then(()=>{$('minimap-button').hidden=false;}).catch(()=>{});

async function loadExterior(){}

const idle=()=>new Promise(r=>(window.requestIdleCallback||setTimeout)(()=>r(),{timeout:60}));
async function buildShip(){
 status('Fitting the walls…');await idle();
 const prepared=await prepareWalkWorld(ship,{into:colliders,kit:cosmoKit,anisotropy:renderer.capabilities.getMaxAnisotropy(),still:matchMedia('(prefers-reduced-motion: reduce)').matches,urls:artUrls,hat:__HAT_URL__,light:{hemi,fill,scene},afterBase(){
 // The hull behind the glass goes for drawing only, after the colliders have it.
 const w0=performance.now(),opened=0;timings.push([`${opened} hull triangles opened for windows in ${Math.round(performance.now()-w0)} ms`,Math.round(performance.now()-t0)]);
 // A desktop's room plaques, lobby boards and deck plaques share a few pictures across decks, so the band merges below draw
 // them for every deck at once (wayfinding-guides.js, plaque-atlas.js); a phone keeps one picture each.
 lifts=createLifts(scene,colliders);for(const g of addWayfindingGuides(lifts.signs,{pageSize:preparedPhone?0:Math.min(4096,renderer.capabilities.maxTextureSize)}))g.userData.bandMergeParts=true;if(!preparedPhone)sharePlaques(lifts.signs);preparedSigns(ship,lifts.signs);
 },afterRest(state){
 restSpots=state.restSpots;rest=spotIndex(state.seats);lounge=state.lounge;lullaby=lounge?createLullaby(lounge.dome):null;
 // Its floor, galleries and the promenade in front: glossy acrylic with neon swirls (lounge-floor.js).
 quietFloorReflections(scene,scene.environment);
 // Deck 19's lift lobby and promenade up to the lounge: black ceramic tile (lift-tile-floor.js).
 // The floor finish is in the prepared render bands.
 // The crew recovery lounge's pod side dims the lights (recovery.js).
 recovery=createRecoveryMood(ship,{hemi,fill,scene});arrivalMood=createArrivalMood(ship,{hemi,fill,scene});atriumMood=createAtriumMood({hemi,fill,scene});
 }});
 ({booth,poolTable,pinball:pinballMachine,concession,provisions,kittens,diningRobots,hydration,blossom,catTree,nosePark,keelClub,loungeFalls,jaguarGate,arcadeRow,missionHolo,mudwater,chinampa}=prepared);
 // Phones keep the Keel Club's look but not its fill-rate extras (keel-club.js lite()).
 if(preparedPhone)keelClub?.lite?.();
 loungeSound=lounge&&loungeFalls?createLoungeSound(lounge,loungeFalls.soundLine):null;keelSound=keelClub?createKeelSound():null;
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
 trainingSound=gaming?createTrainingSound(gaming):null;
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
 const toBand=(o,y=o.position.y)=>{const band=bandOf(y);let g=baked.bands.get(band);if(!g){g=new T.Group();g.name='Walk_band_'+band;g.userData.band=band;baked.bands.set(band,g);scene.add(g);}g.add(o);};
 // Opaque lift and deck signs of one material on one band draw as one mesh (300 signs in 36 materials). The call lights
 // (transparent) change material when lit: call-lights.js merges them per band its own way.
 {const lists=new Map();for(const o of lifts.signs.children)if(o.isMesh&&o.name==='Walk_sign'&&!o.material.transparent&&!o.children.length){const key=bandOf(o.position.y)+'|'+o.material.uuid;let l=lists.get(key);if(!l)lists.set(key,l=[]);l.push(o);}
  for(const list of lists.values()){if(list.length<2)continue;const mesh=mergeMeshes(list);if(!mesh)continue;for(const o of list)lifts.signs.remove(o);toBand(mesh,list[0].position.y);}}
 mergeCallLights(lifts.signs,bandOf,toBand);
 for(const o of [...lifts.signs.children,booth.group,...(poolTable?[poolTable.group]:[]),...(pinballMachine?[pinballMachine.group]:[]),...(pawsOff?pawsOff.groups:[]),...(mudwater?[mudwater.group]:[]),...(arcadeRow?[arcadeRow.group]:[])])toBand(o);
 // The scenic photo spots' floor markers (photo-spots.js), each with its deck's band.
 photoSpots=createPhotoSpots();for(const g of photoSpots.groups)toBand(g);
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
 // The Great Cat Tree (cat-tree.js) rises from Deck 6 to under Deck 16: it draws while any band it spans is in view.
 if(catTree){const g=catTree.group;g.userData.band=bandOf(catTree.bounds.y0);g.userData.top=bandOf(catTree.bounds.y1);baked.bands.set(g.name,g);scene.add(g);}
 // The Toybox Park (cat-tree.js) on the Deck 6 floor round the tree.
 if(nosePark){const g=nosePark.group;g.userData.band=bandOf(nosePark.bounds.y0);g.userData.top=bandOf(nosePark.bounds.y1);baked.bands.set(g.name,g);scene.add(g);}
 // The Keel Club (keel-club.js), the sports hall under Deck 1: it draws while the walker's bands reach it.
 if(keelClub){const g=keelClub.group;g.userData.band=bandOf(keelClub.bounds.y0);g.userData.top=bandOf(keelClub.bounds.y1);baked.bands.set(g.name,g);scene.add(g);}
 if(keelClub?.deck1){const g=keelClub.deck1;g.userData.band=bandOf(keelClub.deck1Bounds.y0);g.userData.top=bandOf(keelClub.deck1Bounds.y1);baked.bands.set(g.name,g);scene.add(g);}
 // Phones draw the tree's and the park's felt details only from half as far.
 if(phone)for(const f of [catTree,nosePark]){const lod=f?.group.children.find(o=>o.isLOD);if(lod)for(const l of lod.levels.slice(1))l.distance*=.5;}
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
 const casing=ship.inside.getObjectByName('Walk_fin_root_casing');if(!casing?.userData.paintFace)throw Error('Prepared fin casing paint anchor missing');casing.updateWorldMatrix(true,false);const casingFrame=casing.matrixWorld.clone();
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
 if(phoneBatching.merge)mergePhoneFurnishing(ship.inside);phase4Visibility=phase4Culling(ship.inside,colliders);ship.inside.traverse(o=>{if(!o.isInstancedMesh||o.userData.phase4)return;o.updateWorldMatrix(true,false);if(!o.boundingBox)o.computeBoundingBox();
  const box=o.boundingBox.clone().applyMatrix4(o.matrixWorld);let cabins=false,walls=false,boat=false;for(let q=o;q;q=q.parent){if(q.name==='V2_cabin_instances')cabins=true;if(q.name==='V2_cabin_shells')walls=true;if(/^Area_d\d+-lifeboats-/.test(q.name))boat=true;}
  o.userData.span=[box.min.y,box.max.y];o.userData.cabins=cabins;o.userData.cabinWalls=walls;o.userData.boat=boat;instanced.push(o);});
 // Furniture in the repeated cabins draws only for the cabins nearest the walker; their walls and doors always draw.
 const sharedNear=new Map();for(const o of instanced){
  if(!o.userData.boat&&(!o.userData.cabins||o.userData.cabinWalls))continue;
  const key=o.parent.uuid+'|'+(o.userData.cabinIds||[o.uuid]).join(',');if(sharedNear.has(key)){o.userData.near=sharedNear.get(key);continue;}const all=Array.from({length:o.count},(_,i)=>{const m=new T.Matrix4();o.getMatrixAt(i,m);return m;});
  o.userData.near={all,centres:all.map(m=>new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld))};sharedNear.set(key,o.userData.near);
 }
 // The atrium's room stand-ins paint what a real cabin looks like inside, captured once the lighting is final, one view
 // a frame just before the frame draws (atrium-room-views.js, atrium-visibility.js). Phones keep the plain stand-ins.
 if(!preparedPhone)environmentReady.then(()=>{const placements=cabinPlacements();roomViewJob=atriumRoomViewJob(renderer,scene,instanced,placements,{hide:atriumStandIns()});roomViewJob.sides=atriumCabinSides(placements);});
 // The wayfinding signs draw from one texture array (sign-array.js).
 // Parts wholly beyond the indoor fog draw no longer (fog-cull.js); ?fogcull=0 draws them, to compare.
 // Not with the atrium detail pack, whose source checks include the layers the cull changes.
 if(!atriumPack&&new URLSearchParams(location.search).get('fogcull')!=='0')fogCull=createFogCull(scene,camera);
 wayfindingSigns=mergeWayfindingSigns(baked.bands.values(),{maxLayers:renderer.getContext().getParameter(renderer.getContext().MAX_ARRAY_TEXTURE_LAYERS)});if(wayfindingSigns)scene.add(wayfindingSigns.root);
 isolateStaticWorld(ship,scene);{const hidden=(preparedPhone||phoneBatching.merge)&&!OWNER_BAKE_PAGE?releaseBatchedSources(scene):null,{merge,...batching}=phoneBatching;if(merge)phoneBands=await mergePhoneBands(baked,scene,{hidden,menus:!preparedPhone,piece:deskPiece,keepArrays:OWNER_BAKE_PAGE});ship.v2LowDeckBatches=await batchLowDeckDraws(baked,renderer,{...batching,hidden,skip:merge?g=>/^Walk_band_/.test(g.name):null});}if(!preparedPhone)ship.v2FurnishingBatches=batchFurnishing(ship.liveDraws,renderer);atriumGeometry=atriumPack?createAtriumGeometryRuntime(baked,renderer,{getQuality:getAtriumQuality}):null;settlePreparedStatic(ship);
 // The groups holding only those instanced meshes once the live draws have their final parents (V2_live_source_draws: a
 // deck's cabin shells, a cabin template's fittings), and groups of only such groups, innermost first: cull() hides each
 // while nothing in it shows, so three's scene walk and matrix pass skip it.
 {const held=new Set(instanced);for(let pass=0;pass<4;pass++){const add=[...new Set([...held].map(o=>o.parent))].filter(g=>g&&!held.has(g)&&!g.isScene&&g!==ship.liveDraws&&!/^Walk_band_/.test(g.name)&&g.children.every(c=>held.has(c)));if(!add.length)break;for(const g of add){held.add(g);instancedGroups.push(g);}}}
 // The cabins' parts on every deck draw with one object per look of material (share-materials.js), so equal draws sort
 // together and three refreshes each look once. Corner shading still treats every part as before. Not on phones.
 if(!preparedPhone){const alone=cornerShadeLeavesAlone(scene);shareEquivalentMaterials(scene,{member:o=>o.userData.v2Cabins&&!o.userData.proxySpans,split:o=>alone.has(o.material)?'alone':''});}
 // The phone ship drops what is already on the GPU from the page (src/v2/phone-memory.js).
 if(preparedPhone){releasePhoneGeometry(scene);shrinkPhonePictures(renderer,scene);}
}
let imagingScans=null,missionTimer=null;
let atriumMood=null,baked=null,cosmoKit=null,lifts=null,rest=null,restSpots=[],resting=null,booth=null,photoSpots=null,concession=null,provisions=null,kittens=null,diningRobots=null,surgeryArms=null,freightGate=null,hydration=null,blossom=null,catTree=null,nosePark=null,keelClub=null,loungeFalls=null,jaguarGate=null,scope=null,poolTable=null,pinballMachine=null,pawsOff=null,mudwater=null,arcadeRow=null,run=null,runView='third',paintings=null,comics=null,theatre=null,lounge=null,arrivalMood=null,recovery=null,gaming=null,missionHolo=null,halloween=null,hexFloor=null,graffiti=null,crownTv=null,lullaby=null,loungeSound=null,trainingSound=null,keelSound=null,mct=null;
let mazeHold=null,maze=null,treasure=null,leverPanel=null,chinampa=null,baggage=null,atmosphere=null;
const artUrls=typeof __ART_URLS__!=='undefined'?__ART_URLS__:{};const bodies=[],eye=new T.Vector3();const instanced=[],instancedGroups=[];
// Lifeboat fittings (2,000 seats a deck with their headrests and harnesses, seen only through a hatch or from inside a
// craft) draw only near the walker: drawn whole, they were most of the triangles in any view on the lower decks.
const NEAR_CABINS=40,BOAT_REACH=45,nearFrom=new T.Vector3(1e9,0,0);
// The deck bands to draw: the walker's own and its neighbours, stretched to whatever the camera's centre and corner rays
// reach, so a tall hall, an atrium or a stairwell shows its full height. The rays skip the first 0.6 m: pressed into a
// corner, the camera can sit inside a column, and every ray then stopped on its back faces (a garden's roof was culled).
// Seen through an opening from under a lower ceiling (the lounge from its access ramp), a taller room's ceiling can be in
// view with no ray landing on it, so each ray also looks straight up and down from partway along for the space it crosses.
const VIEW_RAYS=[];for(const x of [-.96,-.5,0,.5,.96])for(const y of [-.96,-.5,0,.5,.96])VIEW_RAYS.push([x,y]);let viewSpan=[0,0],localViewSpan=[0,0],lastSpan=-Infinity,atriumSpanActive=false,atriumSight=null;
// A phone casts the view rays over SPAN_SLICES frames, a fifth each, all from the camera as it was when the pass began.
// The span only widens with a pass's answers; only a pass that ends with the camera where it began (within 5 cm and
// about a degree) replaces it, and may narrow it. After a pass the camera moved during, the next starts at once. A
// desktop casts every ray in one frame, as before.
// A lift resting with its landing doors open, within 40 m of the eye and 6 m of its height: the atrium PVS counts those
// doors as shut (scripts/walk-atrium-pvs.page.js), so the atrium sight asks its rays there.
const openLanding=eye=>!!lifts?.lifts.some(l=>{const s=l.stops[l.at];return l.phase!=='moving'&&l.doors>0&&Math.abs(eye.y-s.base.y)<6&&Math.hypot(eye.x-s.base.x,eye.z-s.base.z)<40;});
const SPAN_SLICES=preparedPhone?5:1,spanEye=new T.PerspectiveCamera();let spanPass=null;
function span(p,now){
 // Sight through an adjoining doorway keeps the whole atrium, even outside its footprint.
 setAtriumView(p);
 const inside=inOpenAtrium();
 setAtriumSight(ATRIUM_VIEW.fullHeight&&(inside||(atriumSight??=createAtriumSight(colliders,{pvs:()=>atriumPvs,unbaked:openLanding})).update(camera,p,now)),inside?null:atriumSight?.stats.range);
 const atriumBand=atriumViewSpan();if(inside&&atriumBand){atriumSpanActive=true;return viewSpan=atriumBand;}
 // Returning indoors must recompute even at the same pose as the last indoor query.
 if(atriumSpanActive){atriumSpanActive=false;lastSpan=-Infinity;spanPass=null;spanChanged(camera,p,NaN,NaN,colliders);}

 if(!spanPass&&now-lastSpan>=150){lastSpan=now;if(spanChanged(camera,p,0,0,colliders)){spanEye.copy(camera,false);spanPass={next:0,low:p.y+PVS_LOCAL_SPAN[0],high:p.y+PVS_LOCAL_SPAN[1]};}}
 if(spanPass){
 const spanStart=performance.now(),pass=spanPass,end=Math.min(VIEW_RAYS.length,pass.next+Math.ceil(VIEW_RAYS.length/SPAN_SLICES));const ray=new T.Raycaster(),ndc=new T.Vector2(),probe=new T.Ray();
 const reach=y=>{pass.low=Math.min(pass.low,y-1);pass.high=Math.max(pass.high,y+1);};
 for(let i=pass.next;i<end;i++){const [x,y]=VIEW_RAYS[i];ndc.set(x,y);ray.setFromCamera(ndc,spanEye);const hit=(spanQuery??=createVisibilityQuery(colliders)).raycast(ray.ray,90,.6),d=hit?hit.distance:90;reach(ray.ray.at(d,probe.origin).y);
  for(const f of [1/3,2/3])for(const s of [1,-1]){ray.ray.at(d*f,probe.origin);probe.direction.set(0,s,0);const h=(spanQuery??=createVisibilityQuery(colliders)).raycast(probe,12);if(h)reach(h.point.y);}}
 pass.next=end;const answered=[pass.low,pass.high],widen=s=>s?[Math.min(s[0],answered[0]),Math.max(s[1],answered[1])]:answered;
 if(end<VIEW_RAYS.length)localViewSpan=widen(localViewSpan);
 else{spanPass=null;const moved=camera.position.distanceToSquared(spanEye.position)>.0025||camera.quaternion.angleTo(spanEye.quaternion)>.02||!camera.projectionMatrix.equals(spanEye.projectionMatrix);
  localViewSpan=moved?widen(localViewSpan):answered;if(moved)lastSpan=-Infinity;}
 renderMetrics.span.push(performance.now()-spanStart);if(renderMetrics.span.length>600)renderMetrics.span.shift();
 }
 // Preserve the observer's local floor/ceiling, including views from below Deck 6.
 return viewSpan=atriumBand?[Math.min(localViewSpan[0],atriumBand[0]),Math.max(localViewSpan[1],atriumBand[1])]:localViewSpan;
}
function cull(p,now=performance.now()){
 camera.updateMatrixWorld(true);
 cabinGlass?.update(p);crewGallery?.update(p);const [low,high]=span(p,now);phase4Visibility?.update(camera,p,low,high,now,renderer.domElement.height);showBands(baked.bands,low,high);phoneBands?.update();wayfindingSigns?.update();
 if(phoneHide.length){if(now-phoneHiddenAt>5000){phoneHiddenAt=now;phoneHidden=[];scene.traverse(o=>{if(o.isMesh&&phoneHide.some(f=>f(o)))phoneHidden.push(o);});}for(const o of phoneHidden)o.visible=false;}let shown=false;
 let flipped=false;for(const o of instanced){const [a,b]=o.userData.span,v=o.userData.cabins?a<p.y+3.5&&b>p.y-.5:a<high&&b>low;if(v!==o.visible){flipped=true;if(v)shown=true;}o.visible=v;}
 for(const g of instancedGroups)g.visible=g.children.some(c=>c.visible);
 // Re-rank after 3 m of walking, or at once when another deck's cabins come into view.
 if(!shown&&nearFrom.distanceToSquared(p)<9){if(flipped)noteFurnished();return;}nearFrom.copy(p);
 // Every part of a cabin shares its instance index, so one ranking per deck serves all of that deck's parts.
 const ranks=new Map();
 for(const o of instanced){const near=o.userData.near;if(!near||!o.visible)continue;
  if(o.userData.boat){let k=0;near.centres.forEach((c,i)=>{if(c.distanceToSquared(p)<BOAT_REACH*BOAT_REACH)o.setMatrixAt(k++,near.all[i]);});o.count=k;o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();continue;}
  let order=ranks.get(o.parent);if(!order)ranks.set(o.parent,order=near.centres.map((c,i)=>[c.distanceToSquared(p),i]).sort((a,b)=>a[0]-b[0]).slice(0,NEAR_CABINS).map(e=>e[1]));
  order.forEach((i,k)=>o.setMatrixAt(k,near.all[i]));o.userData.currentCabinIds=order.map(i=>o.userData.cabinIds[i]);o.count=order.length;o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();
 }
 noteFurnished();
}
// The atrium's room stand-ins show their cabin without furniture while its real furniture draws (atrium-visibility.js).
function noteFurnished(){const ids=new Set();for(const o of instanced)if(o.visible&&o.userData.near&&!o.userData.boat&&o.userData.currentCabinIds)for(const id of o.userData.currentCabinIds)ids.add(id);setAtriumFurnished(ids);}

const input=new WalkInput(renderer.domElement,{joystick:$('joystick'),stick:$('stick'),lockHint:$('camera-lock-hint'),onAction:(a,arg)=>actions[a]?.(arg)});
const follow=new FollowCamera(camera,colliders);
const controller=new Controller(colliders);
let walker=null;
// The film look (film-look.js, chosen in the Graphics detail sheet): Stylised 3D drawn by the walk's own materials,
// installed before the walk first draws.
installFilmLook({renderer,scene,keep:()=>walker?.holder});
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
  else if(t.kind==='photo-spot')openPhotoSpot(t.spot);
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
  // Online the server decides each shot and every page, ours too, fires the shots it accepts; offline we fire our own.
  else if(t.kind==='cannon'){if(live?.live)live.cannon(t.cannon,keelClub.seed());else keelClub.fire(t.cannon);}
  else if(t.kind==='tube')boardTube(t.dock);
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
 stats(){frameReadout.toggle();},
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
// Every shader the walk can need compiles behind the loading card and the first view waits for it (at most WARM_WAIT_MS),
// so a first look at another area does not freeze; on desktop every picture then uploads, one between frames
// (src/v2/shader-warmup.js). Started at the end of this script, once everything is built.
let shaderWarmup=null,warmed=false;
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
// Below the Keel Club's floor (keel-club.js), the walker has fallen out of the ship.
const BELOW_SHIP=KEEL.floor-3;
await Promise.all([loadExterior(),loadCosmo()]).catch(e=>{status(e.message);throw e;});
await buildShip();
// A walk link (link.js) starts wherever it was taken. Otherwise a visitor back within 10 minutes (a reload, or the page
// opened again after the link dropped) starts where they last stood (last-spot.js), if that was a public area
// (public-area.js) and it, or a spot in sight of it, still passes findStand's and Go to's landing checks; otherwise the
// arrival hall.
const spot=remapSpot(readSpot()),back=spot?null:takeSpot(),view=spot||back;
const stand=spot?findStand(colliders,spot.at):back?publicStand(back.at,{colliders,stand:at=>findStand(colliders,at,{radius:0}),check:at=>v2GotoStand(colliders,at)}):null;
controller.place(stand||findStand(colliders,START.position.toArray())||START.position);
follow.yaw=stand?view.yaw:START.yaw;if(stand){follow.pitch=view.pitch;follow.look(0,0);follow.mode=view.view;}
walker.holder.position.copy(controller.position);
// Balls of yarn to push about: the arrival hall's, and one in each of six common areas (yarn.js).
const yarn=createYarn(colliders),yarns=[yarn];
for(const s of YARN_SPOTS){const place=yarnPlace(PLACES,s.place);if(!place)continue;
 const at=findStand(colliders,place.at.map((v,i)=>v+(place.room?anchoredOffset(place.room,s.offset):s.offset)[i]),{radius:4});if(at)yarns.push(createYarn(colliders,{at:at.toArray(),color:s.color}));}
for(const y of yarns)scene.add(y.mesh);
// The hamster ball (hamster-ball.js), parked in the Deck 17 gardens until someone climbs in.
const ballHome=findStand(colliders,BALL.home,{radius:4})||new T.Vector3(...BALL.home),ball=createBallMesh();let inBall=false;
ball.mesh.position.copy(ballHome);scene.add(ball.mesh);
// The longboard Cosmo rides down a long drop when Space is held through the fall (glide.js, controller.js GLIDE).
const glide=createGlide(walker,artUrls);
// The grapple hook (grapple.js, controller.js HOOK): Q, the right mouse button or the Hook button fires a line at the
// middle of the view; held, Cosmo swings under it.
const grapple=createGrapple(scene,{camera,colliders,controller,walker,hook:HOOK});
// The aim dot (walk.html #aim-dot) marks the middle of the view, where the hook aims. It shows only while the hook can
// fire: walking with the view, in third or first person, with no sheet, panel, game or camera open.
const aimDot=$('aim-dot');let aimShown=false;
const showAim=on=>{if(aimDot&&on!==aimShown){aimShown=on;aimDot.hidden=!on;}};
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
// (listedAt: when the list of who is aboard was last made: showAboardList)
let remotes=null,marks=null,aboard=0,aboardNames=undefined,aboardIds=null,join=null,captainSays=null,listedAt=0,liveStatus='',wasInArena=false;
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
 remotes=new RemotePlayers(scene,{make:()=>createWalker(globalThis.LeoCosmo.createDLCat,motion,{mergeDraws:true,cacheBones:true}),crowd:true,lean:leanCats,lod:crowdLod,crowdFps,crowdMotion:typeof __CROWD_URL__==='string'?__CROWD_URL__:null,colliders,lifts,labels:$('names'),hatUrl:__HAT_URL__,artUrls,running:p=>!!pawsOff?.onBelt(p),hammock:p=>!!rest?.hammockAt(p),catnip:p=>!!lounge?.inside(p),swimming:p=>!!treasure?.contains(p),tube:{make:createTubeMesh,y:KEEL.floor-RIVER.drop+.08,recline:TUBE_SIT.recline}});
 remotes.tube.rim=TUBE_RIM;// the ring a tube rider's arms rest on (avatar.js)
 await identity;
 const name=me.pass?me.name||'':$('name-input').value.trim();
 live=connectLive(LIVE_URL,{
  status:s=>{liveStatus=s;if(s!=='live'){aboardNames=undefined;aboardIds=null;leverPanel?.lost();join?.reset();}showAboard();showAboardList();changeLog.setStatus(s==='live'?'live':'offline');if(s!=='live')chat.set({live:false});},
  welcome:msg=>{leverPanel?.apply(msg.panel);captainSays?.back();for(const {id,s} of msg.lifts)lifts.apply(id,s);live.hearts();mct.apply(msg.mcts);live.tv();
   // A server from before chat sends no chat: it stays hidden.
   chat.set({live:true,id:msg.id,verified:!!msg.you?.verified,mode:msg.chat?.mode||'off'});chat.load(msg.chat?.lines);
   // Just connected Discord at the giveaway's counter: its card shows what they can claim now.
   if(!$('mudwater-sheet').hidden)live.giveaway();},
  // A line of chat: in the corner, and over the speaker's head.
  chat:line=>{chat.add(line);if(line.id!==live.id&&!chat.quiet)remotes.say(line.id,line.text);},said:r=>chat.refused(r.why),
  poses:list=>{remotes.onPoses(list);if(aboardNames==='heard'&&performance.now()-listedAt>1000)showAboardList();},gone:id=>remotes.gone(id),reset:()=>{remotes.clear();marks.clear();graffiti?.reset();pawsOff?.lost();mct.offline();join?.reset();captainSays?.lost();},
  mark:(id,at)=>{const r=remotes.remotes.get(id);marks.show(id,r?.name||'Voyager '+id.slice(-4),at);},
  lift:(id,s)=>lifts.apply(id,s),
  // Someone else's Keel Club water cannon shot: the same jet here, from its seed.
  cannon:(id,i,seed,shot)=>keelClub?.fire(i,{id:shot,seed,who:id===live.id?'me':id}),aboard:(n,names,ids)=>{aboard=n;if(names!==undefined){aboardNames=names;aboardIds=ids||null;}showAboard();showAboardList();},
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
  // Asking to join someone from the Aboard list, and being asked (join.js).
  join:msg=>join?.fromServer(msg),
  // Captain Says (captain-says.js): its countdown, each call and its judging, and the result.
  cs:msg=>captainSays?.fromServer(msg),
  // The Deck 1 transporters: who drives each cart, and where each is parked.
  mcts:list=>mct.apply(list),
  // The Crown lounge TV (crown-tv.js): what is on it, and a ticket to share a video.
  tv:t=>crownTv?.tv(t),tvTicket:r=>crownTv?.ticket(r),
 },{pass:()=>me.pass?bestPass():Promise.resolve(null),refused:forget,invite:tester,hat:hasTesterInvite,glyph:()=>glyph?.wallet?{wallet:glyph.wallet,username:glyph.username}:null,otherside:inOtherside});
 if(!me.pass&&name!==savedName())live.rename(name);
 lifts.onCall=(l,index,opts)=>live.call(l.spec.id,index,opts?.now);
 mct.link({send:msg=>live.mct(msg),id:()=>live.id});
 join=createJoin({live:()=>live,here:joinBlock,land:joinBeside});
 // Captain Says (captain-says.js): joined from the Aboard sheet; its call's button does the move.
 captainSays=createCaptainSays({live:()=>live,move:captainMove,key:captainKey,row:$('aboard-sheet').querySelector('.row'),close:closePanels});
 $('ping').hidden=false;$('help-ping').hidden=false;
}
// In a game here: what a pose says (pl).
function playing(){return arcade.isOpen||pool.isOpen||pinballGame.isOpen||!!emergencyDrill?.isOpen||!$('outside-sheet').hidden||!!run;}
// The pose others see. Resting, the body is where the bed or seat put it, not where the controller stands.
// On a treadmill (Paws Off), it is where the run has him: on the belt, or on his back behind it after a fall.
function myPose(riding=false){
 const h=walker.holder,held=resting||run,at=held?h.position:controller.position;
 return {pos:[at.x,at.y,at.z],yaw:held?h.rotation.y:heading,g:controller.grounded||riding||!!held,st:controller.stance,jc:Math.min(3,controller.jumpCount),
  js:T.MathUtils.clamp(controller.jumpS,-1,60),r:T.MathUtils.clamp(controller.velocity.y,-100,100),e:resting?.stand?'healing_capsule':emote,rest:resting&&!resting.stand?(resting.spot.tube?'tube':resting.lie?'lie':'sit'):run?.tumble>.5?'lie':null,pl:playing(),b:inBall,gl:controller.gliding,hk:controller.hook&&!resting&&!run?controller.hook.toArray():undefined,f:furColour};
}
// A hidden tab (or a covered window) draws no frames, so when frames stop it says it is still here from a timer
// instead (browsers run one about once a second in the background).
if(live)setInterval(()=>{if(document.hidden||performance.now()-last>1000)live.pose(myPose());},1000);
// Where this visitor stands, kept for a reload within 10 minutes (last-spot.js): on foot in a public area, or the
// arrival hall once they are somewhere restricted (public-area.js) or in a game. Passing through (a lift, a jump, a
// seat, the hamster ball) keeps the spot from before. Only a page that has been aboard Leo live, or started from a
// kept spot, keeps one, so the build's tools and checks, which never are, start where they ask to. A page left before
// its walk was up puts back the spot it started from, untried.
let spotKept=!!back;
function noteSpot(e){
 if(live?.live)spotKept=true;
 if(!ready()){if(e?.type==='pagehide'&&back)keepSpot(back,back.t);return;}
 if(!spotKept)return;
 const p=controller.position,where=restrictedAt(p);
 if((where&&where!=='lift')||playing()||pawsOff?.active||maze?.running||treasure?.active){keepSpot(null);return;}
 if(where||resting||inBall||!controller.grounded||controller.gliding||controller.hook)return;
 keepSpot({at:[p.x,p.y,p.z],yaw:follow.yaw,pitch:follow.pitch,view:follow.mode});
}
setInterval(noteSpot,2000);addEventListener('pagehide',noteSpot);
// Asking to join someone (join.js, server/joins.mjs). Asked, a visitor can be joined only where the walk could put
// someone down (public-area.js) and not in a game; the server checks the same from their last pose.
function joinBlock(){return restrictedAt(controller.position)||(playing()||pawsOff?.active||maze?.running||treasure?.active?'game':null);}
// Accepted: a public floor beside them, 1.2 to 4 m out and in their sight, through the walk's own landing checks; facing them.
function joinBeside(at,name){
 if(!ready())return false;
 const q=publicStand(at,{colliders,stand:p=>findStand(colliders,p,{radius:0}),check:p=>v2GotoStand(colliders,p),away:1.2,radius:4});
 if(!q)return false;closePanels();emote=null;return goTo({at:q.toArray(),yaw:Math.atan2(at[0]-q.x,at[2]-q.z),resolved:true});
}
// Captain Says (captain-says.js): the call's button does the move as its key would (the stance keys toggle, so a stance
// already taken is left as it is), and the key is shown beside the call (a touch screen has the button alone).
function captainMove(mv){
 if(!ready()||resting||inBall||treasure?.active)return;
 const st=controller.stance,down=st==='crouch'||st==='slide';
 if(mv==='stand'){if(down)actions.crouch();else if(st==='prone')actions.prone();}
 else if(mv==='crouch'){if(!down)actions.crouch();}else if(mv==='prone'){if(st!=='prone')actions.prone();}
 else if(mv==='jump')input.jumpQueued=true;else if(EMOTES.includes(mv))actions.emote(EMOTES.indexOf(mv));
}
function captainKey(mv){
 if(matchMedia('(pointer:coarse)').matches)return '';
 const st=controller.stance,emote=EMOTES.indexOf(mv);
 return mv==='stand'?(st==='prone'?'X':st==='stand'?'':'C'):mv==='crouch'?'C':mv==='prone'?'X':mv==='jump'?'Space':emote>=0?bindingLabel(walkBindings.get('emote:'+emote)):'';
}
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
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__)globalThis.__walk={get portable(){return portable;},get ownerHiding(){return ownerHiding;},registry,get landingDoors(){return shutLandingDoors();},get fogCull(){return fogCull;},get phase4Visibility(){return phase4Visibility;},renderMetrics,get hangarDoor(){return hangarDoor;},get cabinGlass(){return cabinGlass;},restSpots,get leverPanel(){return leverPanel;},get interactionTargets(){return interactionTargets({lifts,restSpots,arcadeRow,pawsOff,scope,theatre,poolTable,pinballMachine,mudwater,changeLog,comics,paintings,missionHolo,chinampa,places:PLACES});},T,scene,camera,renderer,ship,colliders,controller,follow,get arcade(){return arcade;},get emergencyDrill(){return emergencyDrill;},emergencyStation,get pawsOff(){return pawsOff;},get mudwater(){return mudwater;},get arcadeRow(){return arcadeRow;},get lounge(){return lounge;},get graffiti(){return graffiti;},get crownTv(){return crownTv;},get gaming(){return gaming;},get trainingSound(){return trainingSound;},get loungeSound(){return loungeSound;},get ambience(){return ambience;},get provisions(){return provisions;},get freightGate(){return freightGate;},get blossom(){return blossom;},get loungeFalls(){return loungeFalls;},changeLog,get walker(){return walker;},input,get baked(){return baked;},timings,cabinPlacements,get lifts(){return lifts;},get rest(){return rest;},get remotes(){return remotes;},get live(){return live;},get halloween(){return halloween;},get crewGallery(){return crewGallery;},get maze(){return maze;},get pinballMachine(){return pinballMachine;},get theatre(){return theatre;},get poolTable(){return poolTable;},get surgeryArms(){return surgeryArms;},hat:{wear:w=>wearHat(w||walker,__HAT_URL__),fit,FIT,MeshBVH},actions,PLACES,goTo:p=>goTo(p),get resting(){return resting;},get booth(){return booth;},get photoSpots(){return photoSpots;},get lastPhoto(){return lastPhoto;},yarn,yarns,ball:{mesh:ball.mesh,home:ballHome,get inside(){return inBall;}},get mct(){return mct;},
 // Debug: drop the walker at a point (feet), facing yaw, camera pitch.
 teleport(x,y,z,yaw=follow.yaw,pitch=-.18){resting=null;controller.place(new T.Vector3(x,y,z));follow.yaw=yaw;follow.pitch=pitch;heading=yaw;follow.current=.3;}};

// (Debug: the vault, vault.js.)
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__)Object.defineProperty(globalThis.__walk,'vault',{get:()=>vault});
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__)Object.defineProperty(globalThis.__walk,'vaultLift',{get:()=>vaultLift});
if(typeof __WALK_DEBUG__!=='undefined'&&__WALK_DEBUG__)Object.defineProperties(globalThis.__walk,{atriumSight:{get:()=>atriumSight},atriumPvs:{get:()=>atriumPvs},viewSpan:{get:()=>viewSpan},shaderWarmup:{get:()=>shaderWarmup}});
// The ship map: the corner mini-map, redrawn a few times a second, and the full map sheet.
const mini=$('minimap');let lastMini=0,mapDeck=null,mapShown=[];
// (A phone's small mini-map, html.phone-hud from walk.html, keeps up to 3× its pixels, so its names stay sharp.)
function sizeCanvas(c){const r=Math.min(devicePixelRatio||1,c===mini&&document.documentElement.classList.contains('phone-hud')?3:2),w=Math.round(c.clientWidth*r),h=Math.round(c.clientHeight*r);if(w&&h&&(c.width!==w||c.height!==h)){c.width=w;c.height=h;}}
// In the Keel Club (below Deck 1, keel-club.js) the maps show the club's own plan; map 0 is the club.
const inClub=p=>!!keelClub&&inKeelHall(p);
// Go-to places in the club show on the club's map, not on Deck 1's.
const clubPlace=p=>inClub({x:p.at[0],y:p.at[1],z:p.at[2]}),shipPlaces=()=>keelClub?PLACES.filter(p=>!clubPlace(p)):PLACES;
function clubMini(p){const g=mini.getContext('2d'),w=mini.width,h=mini.height,dpr=w/(mini.clientWidth||w),turn=-Math.PI/2-Math.atan2(Math.cos(follow.yaw),Math.sin(follow.yaw));
 g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);g.save();g.translate(w/2,h/2);g.rotate(turn);g.scale(3.2*dpr,3.2*dpr);g.translate(-p.x,-p.z);keelPlan(g,{px:1/(3.2*dpr)});g.restore();
 g.save();g.translate(w/2,h/2);mapArrow(g,7*dpr,1.5*dpr);g.restore();}
function clubFull(c,p){const g=c.getContext('2d'),w=c.width,h=c.height,dpr=w/(c.clientWidth||w),e=KEEL_PLAN_EXTENT,pad=6,scale=Math.min(w/(e.x1-e.x0+2*pad),h/(e.z1-e.z0+2*pad)),cx=(e.x0+e.x1)/2,cz=(e.z0+e.z1)/2,shown=[];
 g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);g.save();g.translate(w/2,h/2);g.scale(scale,scale);g.translate(-(e.x0+e.x1)/2,-(e.z0+e.z1)/2);keelPlan(g,{px:dpr/scale,labels:true});g.restore();
 // the club's Go-to places, marked and named as on the ship's maps; a click takes you there
 g.textAlign='center';g.textBaseline='middle';
 for(const pl of PLACES){if(!clubPlace(pl))continue;const px=w/2+(pl.at[0]-cx)*scale,pz=h/2+(pl.at[2]-cz)*scale;
  g.fillStyle='#2fd6c5';g.strokeStyle='#050507';g.lineWidth=2*dpr;g.beginPath();g.arc(px,pz,6*dpr,0,Math.PI*2);g.fill();g.stroke();
  g.font=`500 ${11*dpr}px "JetBrains Mono",monospace`;g.fillStyle='#f4f0e8';g.strokeStyle='rgba(5,5,7,.9)';g.lineWidth=3*dpr;g.strokeText(pl.name,px,pz-14*dpr);g.fillText(pl.name,px,pz-14*dpr);
  shown.push({place:pl,x:px/dpr,y:pz/dpr});}
 if(inClub(p)){g.save();g.translate(w/2+(p.x-cx)*scale,h/2+(p.z-cz)*scale);g.rotate(Math.atan2(Math.cos(heading),Math.sin(heading))+Math.PI/2);mapArrow(g,9*dpr,2*dpr);g.restore();}
 return shown;}
function miniMap(p){sizeCanvas(mini);if(inClub(p)){clubMini(p);$('minimap-deck').textContent='Keel Club';return;}const d=drawMiniMap(mini,shipMap,{x:p.x,y:p.y,z:p.z,yaw:follow.yaw,places:shipPlaces()});$('minimap-deck').textContent=d?`Deck ${d.number}`:p.y>100?'Crown lounge':'Fin';}
function showMap(number){
 mapDeck=T.MathUtils.clamp(number,keelClub?0:1,DECKS.length);const c=$('map-canvas');sizeCanvas(c);const p=controller.position;
 if(mapDeck===0){mapShown=clubFull(c,p);$('map-title').textContent='Keel Club · below Deck 1';$('map-deck').value='0';return;}
 mapShown=drawFullMap(c,shipMap,mapDeck,{walker:inClub(p)?null:{x:p.x,y:p.y,z:p.z,yaw:heading},places:shipPlaces()});
 $('map-title').textContent=`Deck ${mapDeck} · ${DECKS[mapDeck-1].name}`;$('map-deck').value=String(mapDeck);
}
function toggleMap(){
 const panel=$('map-sheet');if(!panel.hidden){closePanels();return;}
 if(keelClub&&!$('map-deck').querySelector('option[value="0"]'))$('map-deck').prepend(new Option('Keel Club','0'));
 panel.hidden=false;input.enabled=false;showMap(inClub(controller.position)?0:deckOf(controller.position.y)?.number??20);
}
{const select=$('map-deck');for(const d of DECKS)select.append(new Option(`Deck ${d.number}`,String(d.number)));select.onchange=()=>showMap(+select.value);
 for(const b of document.querySelectorAll('[data-deck]'))b.addEventListener('click',()=>showMap(mapDeck+Number(b.dataset.deck)));
 // A place marker on the map takes you there.
 $('map-canvas').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
  const hit=mapShown.find(s=>Math.hypot(s.x-x,s.y-y)<18);if(hit){goTo(hit.place);closePanels();}});
 $('minimap-button').addEventListener('click',toggleMap);}
let last=performance.now(),acc=0,lastHud=0,lastHeading=heading,lastSpeed=0,turnRate=0,accel=0;const STEP=1/120,wish=new T.Vector3();
const SPEED={stand:WALKER.walk,crouch:WALKER.crouch,slide:WALKER.crouch,prone:WALKER.prone};
// Should anything stop the warm-up starting (it is the last thing this script does), the walk still draws. From here
// on an error in the rest of this script is therefore not a failed start, which the page is told (walk.html,
// LEO_WALK_FAILED): before this line nothing can make the walk ready, so an error there is one.
setTimeout(()=>{warmed=true;},3*WARM_WAIT_MS);window.LEO_WALK_ARMED=true;
renderer.setAnimationLoop(()=>{
 // Under the Builder's Hub the walk stands still, as in a background tab, and draws nothing, once it has its first view.
 if(hubPanel.isOpen()&&firstViewReady){showAim(false);return;}
 if(!warmed)return;
 frameReadout.begin();
 // Our own clamped clock: with the loop's timestamp argument the fixed steps stalled in testing.
 const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-last)/1000));watchFrames(now-last,now);observeAtriumFrame(now-last,now,{active:document.body.dataset.ready==='1'&&!document.hidden&&document.hasFocus()&&!graphicsSettings?.isOpen&&!controlsSettings?.isOpen&&!furSettings?.isOpen});last=now;
 const k=input.read();if(graphicsSettings?.isOpen||controlsSettings?.isOpen||furSettings?.isOpen||emergencyDrill?.isOpen){k.x=k.y=k.zoom=0;k.jump=k.held=k.run=false;k.look.x=k.look.y=0;}follow.look(k.look.x,k.look.y);if(k.zoom)follow.distance=T.MathUtils.clamp(follow.distance+k.zoom*.4,1.4,6);
 const fwd=follow.forward(),right=new T.Vector3(-fwd.z,0,fwd.x);
 wish.copy(fwd).multiplyScalar(k.y).addScaledVector(right,k.x);
 if(wish.lengthSq()>1)wish.normalize();wish.multiplyScalar(controller.gliding?(k.run?GLIDE.dive:GLIDE.speed):inBall?(k.run?BALL.run:BALL.speed):controller.stance==='stand'&&k.run?WALKER.run:SPEED[controller.stance]);
 if(emote&&(wish.lengthSq()>.01||k.jump))emote=null;
 // Moving off a seat or bed stands you up; in a transporter's driver's seat the keys drive it instead (transporter.js),
 // and the camera swings round behind it while it moves. A healing capsule holds you until you leave it (E or the button).
 const cart=resting?.spot.mct,driving=cart?.seat==='driver'&&resting.phase==='in'&&resting.t===1;
 if(driving){mct.drive(dt,k.y,k.x,k.run);if(Math.abs(cart.cart.speed)>.3&&!k.look.x)follow.yaw=dampAngle(follow.yaw,cart.cart.yaw,1.2,dt);}
 else if(resting&&!resting.stand&&!resting.spot.tube&&resting.phase==='in'&&resting.t===1&&wish.lengthSq()>.1)standUp();
 // In a Keel Club tube the keys paddle and steer it.
 if(resting?.spot.tube&&resting.phase==='in')tubeStep(resting.spot.tube,dt,wish);
 lifts.update(dt,controller);
 vaultLift?.update(dt,controller);
 // A Paws Off run holds the walker on the treadmill (paws-off/game.js); the belts of others playing run too.
 run=pawsOff?.update(dt,remotes?[...remotes.remotes.values()].filter(r=>r.tgt?.playing).map(r=>r.cur):[])||null;
 mudwater?.update(dt);nosePark?.update(dt);
 {// A water cannon's shot that reaches our tube pushes it, once a shot (keel-club.js tests it on the shots' own clock).
  const tube=resting?.spot.tube&&resting.phase==='in'?resting.spot.tube:null,seat=tube?tubeSeat(tube):null;
  for(const h of keelClub?.update(dt,seat?[seat.x,seat.y+.2,seat.z]:null)||[])if(tube){tubeKick(tube,h.dir);splashed(h.who);}}
 vault?.update(dt,controller.position);
 // Riding a moving car, the car carries the walker; it passes slab edges and the hull skin, which must not push.
 const riding=vaultLift?.riding||lifts.lifts.some(l=>l.phase==='moving'&&lifts.inside(l,controller.position));
 // A tap shorter than a frame still counts as held for the first step.
 // In the ball the jump is one low hop (BALL.body.jump).
 // The grapple fires on a press and holds while the key is held; anything that takes the walker over lets go.
 const canHook=!resting&&!riding&&!run&&!inBall&&!treasure?.active&&!emergencyDrill?.isOpen&&!graffiti?.active&&ready();
 if(!canHook)grapple.release();else{if(k.hook)grapple.fire();if(!k.hookHeld)grapple.release();}
 showAim(canHook&&input.enabled&&!playing()&&!portable.active);
 if(!resting&&!riding&&!run&&!treasure?.active&&!emergencyDrill?.isOpen){acc+=dt;let pressed=k.jump;while(acc>=STEP){controller.step(STEP,wish,pressed||k.held,ballBounce(inBall,deckOf(controller.position.y)?.number),k.run&&!!controller.hook);pressed=false;acc-=STEP;}}else{acc=0;if(riding)controller.velocity.set(0,0,0);}
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
 else if(controller.grounded&&!inCar&&!resting?.spot.tube)safe.copy(p);
 if(controller.speed>.15&&!resting)heading=dampAngle(heading,Math.atan2(controller.velocity.x,controller.velocity.z),12,dt);
 // What the figure leans into: the turn (+ to its left) and the change of speed, both smoothed a little.
 if(dt>0){turnRate=T.MathUtils.damp(turnRate,Math.atan2(Math.sin(heading-lastHeading),Math.cos(heading-lastHeading))/dt,10,dt);accel=T.MathUtils.damp(accel,(controller.speed-lastSpeed)/dt,10,dt);}
 lastHeading=heading;lastSpeed=controller.speed;
 let pose=null;
 if(cart)followSeat(resting);
 if(resting?.spot.tube)followTube(resting);
 if(resting)pose=restPose(dt);
 else if(run){heading=run.yaw;walker.holder.position.copy(run.pos);walker.holder.rotation.set(0,run.yaw,0);
  // Off the back: over onto his back, head first the way the belt carried him.
  walker.body.rotation.set((-Math.PI/2+PILLOW_TILT)*T.MathUtils.smoothstep(run.tumble,.25,1),0,0);
  if(run.tumble>0)pose={kind:'lie',weight:run.tumble,seatHeight:walker.hipHeight};}
 if(!resting&&!run){walker.holder.position.copy(p);walker.holder.rotation.set(0,heading,0);walker.body.rotation.set(0,0,0);}
 const board=glide.update(dt,{gliding:controller.gliding&&!resting&&!run,speed:controller.speed,rise:controller.velocity.y,turnRate});follow.ride=board;
 if(inBall){ball.mesh.position.copy(p);if(controller.grounded)ball.roll(dt,controller.velocity.x,controller.velocity.z);}
 tubeMesh.visible=!!resting?.spot.tube;if(tubeMesh.visible){const s=tubeSeat(resting.spot.tube);tubeMesh.position.set(s.x,KEEL.floor-RIVER.drop+.08,s.z);}
 // In first person Cosmo is hidden (below), so his rig solves less often while he was hidden last frame and no selfie is
 // counting down (the booth draws him). Switching back to third person it solves every frame again, before he shows.
 walker.update(dt,{unseen:follow.mode==='first'&&!walker.holder.visible&&!booth?.counting&&!photoSpots?.counting&&!portable.active,speed:run?run.speed:controller.speed,grounded:controller.grounded||riding,stance:controller.stance,jumpCount:controller.jumpCount,jumpS:controller.jumpS,
  turnRate,accel,rise:controller.velocity.y,emote,rest:pose,catnip:!!lounge?.inside(walker.holder.position),swimming:!!treasure?.active,board,hook:controller.hook&&!resting&&!run?controller.hook:null});
 grapple.update(dt);
 live?.pose(myPose(riding),now);
 // In a transporter the camera rides higher, over the heads of the others aboard.
 if(treasure?.active)treasure.updateCamera(dt);else follow.update(dt,resting?resting.view:run?run.pos:p,inBall?BALL.eye:cart&&follow.mode==='third'?WALKER.height+.7:WALKER.height,resting||run||inBall?null:controller.grounded?controller.stance:'stand');
 // Spraying the graffiti wall, the view squares up to it (graffiti.js), and its paint catches up.
 graffiti?.update(camera,now);
 // Hide Cosmo when the camera is pressed right up against him (a lift car, a narrow aisle), or is off at the wall.
 walker.holder.visible=portable.active||(follow.mode!=='first'&&follow.current>.75&&!graffiti?.active);
 if(portable.active)portable.point(walker.holder.position,walker.holder.rotation.y,WALKER.height*.6,colliders);
 capsuleView(!!resting?.stand&&resting.t===1&&follow.mode==='first');
 cull(p);
 remotes?.update(dt,{camera,low:viewSpan[0],high:viewSpan[1],photo:!!(booth?.counting||photoSpots?.counting||portable.active),height:renderer.domElement.height},now);
 // Carts others drive go where their drivers sit; ours is where we drove it.
 mct.update(dt,remotes,walker.hipHeight);
 // The lounge's doors open, and the cold room's strip curtain parts, for anyone near them.
 bodies.length=0;bodies.push(p);if(remotes)for(const r of remotes.remotes.values())bodies.push(r.cur);
 // 4B: the atrium warms first; any room mood after it wins where they meet.
 atriumMood?.update(dt);
 if(arrivalMood)arrivalMood.update(dt,camera.getWorldPosition(eye));
 if(lounge)lounge.update(dt,bodies,camera.getWorldPosition(eye));
 if(recovery)recovery.update(dt,camera.getWorldPosition(eye));
 halloween?.update(dt,camera.getWorldPosition(eye),ambience.on);
 hexFloor?.update(dt,camera.getWorldPosition(eye),p,heading);
 leverPanel?.update(dt,p);
 gaming?.update(dt,camera.getWorldPosition(eye),p,remotes?[...remotes.remotes.values()]:[],!!(resting&&!resting.lie&&!resting.stand));
 arrivalMood?.apply();
 provisions?.update(dt,bodies);
 blossom?.update(dt,p,ambience.on,camera);
 loungeFalls?.update(dt,p);
 trainingSound?.update(p,ambience.on,loungeSound?.audible);loungeSound?.update(p,ambience.on,camera,trainingSound?.audible);keelSound?.update(p,ambience.on,camera,keelClub?.surfClock?.());
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
 if(!arcade.isOpen&&!pool.isOpen&&!pinballGame.isOpen&&!emergencyDrill?.isOpen){if(deskDetail)closeHaze(scene.fog,getAtriumQuality());keelClub?.mood(scene.fog,camera.getWorldPosition(eye),{hemi,fill});if(hazeHeld)closeHaze(scene.fog,'performance');fogCull?.guard();draw(portable.active?portableView():camera);fogCull?.update(performance.now());if(!firstViewReady){firstViewReady=true;timings.push(['First complete frame',Math.round(performance.now()-t0)]);document.body.dataset.ready='1';startOwnerHiding();hubPanel.resume();if(new URLSearchParams(location.search).get('controls')==='1')controlsSettings?.open();try{localStorage.removeItem(STARTING);}catch{}if(shaderWarmup?.textures)shaderWarmup.uploaded=uploadTextures(renderer,shaderWarmup.textures,()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)))).finally(()=>{shaderWarmup.textures=null;});}}
 const shot=booth.update(now),spotShot=photoSpots?.update(now)||shot,camShot=portable.update(now),left=shot.left||spotShot.left||camShot.left;$('countdown').hidden=!left;if(left)$('countdown').textContent=String(left);
 if(shot.due)takePhoto();
 if(spotShot!==shot&&spotShot.due)takePhoto(photoSpots);
 if(portable.active)$('camera-timer').textContent=camShot.left?'Photo in '+camShot.left+'…':'';
 if(camShot.due)takePhoto(portable);
});
// One frame of the ship from `view`: the sky, the haze past the far plane, then the ship.
// The atrium room views being captured (set once the environment is ready); var, as that may be before this line runs.
var roomViewJob;
function draw(view){
 if(roomViewJob){try{const views=roomViewJob.step();if(views){const job=roomViewJob;roomViewJob=null;if(setAtriumRoomViews(views,job.sides))nearFrom.set(1e9,0,0);}}catch(e){roomViewJob=null;console.warn('Atrium room views skipped.',e);}}
 view.updateMatrixWorld(true);atriumGeometry?.update(view,renderer.domElement.height);
 for(const c of [skyCamera,hazeCamera]){c.position.copy(view.position);c.quaternion.copy(view.quaternion);c.fov=view.fov;c.aspect=view.aspect;c.updateProjectionMatrix();}
 renderer.clear();renderer.render(sky,skyCamera);renderer.clearDepth();renderer.render(haze,hazeCamera);renderer.clearDepth();if(ownerHiding&&view===camera)ownerHiding.around(view,()=>renderer.render(scene,view));else renderer.render(scene,view);frameReadout.frame(performance.now());
}
// The selfie booth's photo, or a photo spot's (photo-spots.js, `lens` then): drawn from its lens and copied off the
// canvas at once (the drawing buffer is not kept past this frame), then the walker's own view drawn back over it.
let photoUrl=null,photoSource=null,photoNames=[],photoRender=0,photoFilename='',photoPlace={frame:'CROWN LOUNGE',name:'Crown lounge',slug:'crown-lounge'},lastPhoto=null;
function takePhoto(lens=booth){
 const canvas=renderer.domElement,shown=walker.holder.visible,spot=lens===photoSpots?photoSpots.spot:null;walker.holder.visible=true;photoSpots?.show(false);
 // The fog cull leaves out what is beyond the fog from the walker's eye (fog-cull.js), not from the lens: it draws all.
 lens.aim(canvas.width,canvas.height);lens.camera.layers.enable(FOG_CULL_LAYER);lens.camera.updateMatrixWorld();draw(lens.camera);
 const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);
 photoPlace=lens===portable?portable.place(describe(walker.holder.position).toUpperCase()):spot?{frame:spot.place,name:spot.name,slug:spot.id}:{frame:'CROWN LOUNGE',name:'Crown lounge',slug:'crown-lounge'};
 lastPhoto={place:photoPlace.slug,lens:lens.camera.position.toArray(),at:walker.holder.position.toArray()};
 photoSource=copy;photoNames=selfieNames(lens.camera);photoFilename=`leo-${photoPlace.slug}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.jpg`;$('photo-names').checked=true;
 walker.holder.visible=shown;photoSpots?.show(!portable.active);draw(camera);
 const flash=$('photo-flash');flash.hidden=false;flash.getAnimations?.().forEach(a=>a.cancel());flash.animate?.([{opacity:.85},{opacity:0}],{duration:450}).finished.then(()=>{flash.hidden=true;},()=>{});
 renderPhoto(true);
}
// Name tags live in an HTML layer, so add their existing display names to the photo canvas here.
function selfieNames(lens=booth.camera){
 const names=[],ray=new T.Ray(),eye=lens.getWorldPosition(new T.Vector3());
 const add=(name,x,y,z)=>{
  if(!name)return;const point=new T.Vector3(x,y,z),delta=point.clone().sub(eye),distance=delta.length();if(!distance)return;
  ray.set(eye,delta.divideScalar(distance));const hit=colliders.raycast(ray,distance);if(hit&&hit.distance<distance-.4)return;
  point.project(lens);names.push({name,x:point.x,y:point.y,z:point.z});
 };
 for(const r of remotes?.remotes.values()||[])if(r.walker)add(r.name||'Voyager '+r.id.slice(-4),r.cur.x,r.cur.y+(r.rest&&r.restKind==='lie'?.8:2.15),r.cur.z);
 const own=live?.you?.name||me.name||savedName(),p=walker.holder.position;if(own)add(own,p.x,p.y+(resting&&resting.lie ? .8 : 2.15),p.z);
 return names;
}
function renderPhoto(open=false){
 const serial=++photoRender;
 booth.frame(photoSource,photoNames,$('photo-names').checked,photoPlace.frame).then(out=>new Promise(resolve=>out.toBlob(resolve,'image/jpeg',.92))).then(blob=>{if(blob&&serial===photoRender)showPhoto(blob,open);});
}
function showPhoto(blob,open=false){
 if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=URL.createObjectURL(blob);
 const name=photoFilename||`leo-crown-lounge-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.jpg`;
 $('photo-image').src=photoUrl;Object.assign($('photo-save'),{href:photoUrl,download:name});
 // Where the browser can share files (most phones), sharing is the easy way to keep or send it.
 const file=new File([blob],name,{type:'image/jpeg'}),share=$('photo-share');
 share.hidden=!navigator.canShare?.({files:[file]});share.onclick=()=>navigator.share({files:[file],title:'Leo · '+photoPlace.name}).catch(()=>{});
 $('photo-place').textContent=photoPlace.name;$('photo-image').alt='The photo from the '+photoPlace.name+' camera';
 if(open){closePanels();$('photo-sheet').hidden=false;input.enabled=false;}
}
// A photo spot's sheet (photo-spots.js): its name and the countdown button, which has the focus so Enter starts it.
let spotChoice=null;
function openPhotoSpot(spot){closePanels();spotChoice=spot;$('spot-title').textContent=spot.name;$('spot-setup').hidden=false;input.enabled=false;$('spot-start').focus();}
$('spot-start').addEventListener('click',()=>{const spot=spotChoice;closePanels();if(spot)photoSpots?.start(spot);});
// Each visitor chooses the backdrop and angle for their own photo.
function previewBackdrop(){const c=$('selfie-preview').getContext('2d');c.drawImage(booth.backdropCanvas,0,0,c.canvas.width,c.canvas.height);}
$('selfie-backdrop').addEventListener('change',e=>{booth.setBackdrop(Number(e.target.value));previewBackdrop();});
$('selfie-angle').addEventListener('change',e=>booth.setAngle(Number(e.target.value)));
$('selfie-start').addEventListener('click',()=>{closePanels();if(!booth.counting){live?.selfie();booth.start();}});
$('photo-names').addEventListener('change',()=>{if(photoSource)renderPhoto();});
// The Camera button (portable-selfie.js): the preview is the ship drawn through the lens, cropped 2:1 as the photo is, with
// its controls under it. The cat stays where it is (input is off, as in any sheet) and Escape or Close puts everything back.
function portableView(){const c=renderer.domElement;portable.aim(c.width,c.height);portable.camera.layers.enable(FOG_CULL_LAYER);return portable.camera;}
function openCamera(){
 if(!lifts)return;closePanels();portable.open();
 for(const key of ['side','dist','height','fov']){$('camera-'+key).value=portable.settings[key];$('camera-'+key+'-out').textContent=$('camera-'+key).value;}
 $('camera-timer-set').value=String(portable.settings.timer);$('camera-timer').textContent='';
 $('camera-panel').hidden=$('camera-frame').hidden=false;document.body.classList.add('camera-mode');photoSpots?.show(false);input.enabled=false;input.down.clear();$('camera-capture').focus();
}
function closeCamera(){
 if(!portable.active)return;portable.close();$('camera-panel').hidden=$('camera-frame').hidden=true;document.body.classList.remove('camera-mode');photoSpots?.show(true);document.activeElement?.blur?.();
}
$('camera-open').addEventListener('click',openCamera);
$('camera-close').addEventListener('click',closePanels);
for(const key of ['side','dist','height','fov'])$('camera-'+key).addEventListener('input',e=>{portable.set(key,e.target.value);$('camera-'+key+'-out').textContent=e.target.value;});
$('camera-timer-set').addEventListener('change',e=>portable.set('timer',e.target.value));
$('camera-capture').addEventListener('click',()=>{if(!portable.active||portable.counting)return;if(portable.settings.timer)portable.start();else takePhoto(portable);});
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
 const b=booth.near(p)||photoSpots?.near(p)||comics.near(p)||chinampa?.near(p);if(b)return b;
 const v=inBall?null:vault?.near(p);if(v)return v;
 const tube=inBall?null:vaultLift?.nearest(p);if(tube)return tube.kind==='riding'?null:tube;
 const g=changeLog.near(p);if(g)return g;
 const welcome=inBall?null:arrivalTour?.near(p);if(welcome)return welcome;
 if(scope&&Math.abs(p.y-scope.y)<1.5&&Math.hypot(p.x-scope.x,p.z-scope.z)<2)return {kind:'play',label:'Play Alien Cat Invasion'};
 const drill=inBall?null:emergencyStation.near(p);if(drill)return drill;
 const q=poolTable?.near(p)||maze?.near(p)||pinballMachine?.near(p)||arcadeRow?.near(p)||pawsOff?.near(p)||mudwater?.near(p)||halloween?.near(p)||leverPanel?.near(p)||(inBall?null:keelClub?.near(p,heading));if(q&&!(inBall&&q.kind==='treadmill'))return q;
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
 const t=run||graffiti?.active?null:resting?{kind:resting.spot.tube&&!tubeDock(resting.spot.tube)?'waiting':undefined,label:resting.spot.tube?(tubeDock(resting.spot.tube)?'Get out at the dock':'Paddle to a dock to get out'):resting.stand?'Leave the capsule':resting.spot.mct?'Get out':resting.lie?'Get up':'Stand up'}:target();
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
  // it meets the headboard; a sun lounger, keel-club.js, slides it toward the foot so the head ends at the cushion); restPose tips the upper body up onto the pillow.
  pos=spot.point.clone().addScaledVector(head,-WALKER.height/2+.25-(spot.slide||0));pos.y=spot.height+.13;
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
 // Out of a Keel Club tube only at a dock, onto its spot, facing the island.
 const tb=resting.spot.tube;if(tb){const dock=tubeDock(tb);if(!dock)return;resting.from.pos.set(...dock.at);resting.from.heading=Math.atan2(0,-dock.side);}
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
// A Keel Club tube (keel-club.js): a seat that floats round the Keel Loop. The keys paddle and steer it (tubeStep),
// the camera stays the walker's own; E lets you out only at a dock (tubeDock), onto the dock's own spot.
const tubeMesh=createTubeMesh();tubeMesh.visible=false;scene.add(tubeMesh);
function boardTube(dock){
 emote=null;const st=tubeBoard(dock),seat=tubeSeat(st);
 resting={spot:{tube:st,dock,point:new T.Vector3(seat.x,seat.y,seat.z),height:seat.y},lie:false,stand:false,from:{pos:controller.position.clone(),heading},to:{pos:new T.Vector3(),yaw:seat.yaw},t:0,phase:'in',view:new T.Vector3()};
 followTube(resting);
}
// Sat down into the ring (keel-club.js TUBE_SIT), facing downstream: restPose tips the sitting figure back about its
// hips, so the walker's origin sits ahead of and below the hips by the recline.
function followTube(r){const seat=tubeSeat(r.spot.tube),h=walker.hipHeight,b=TUBE_SIT.recline,ahead=h*Math.sin(b);
 r.to.pos.set(seat.x+Math.sin(seat.yaw)*ahead,KEEL.floor-RIVER.drop+TUBE_SIT.hip-h*Math.cos(b),seat.z+Math.cos(seat.yaw)*ahead);r.to.yaw=seat.yaw;r.view.set(seat.x,seat.y-.55,seat.z);
 if(r.phase==='in')controller.position.set(seat.x,seat.y,seat.z);}
// "Splashed by ..." when a water cannon's shot hits our tube: at most every 3 s.
let splashAt=0,splashHide=0;
function splashed(who){const now=performance.now();if(now-splashAt<3000)return;splashAt=now;
 const name=who==='me'?'yourself':remotes?.remotes.get(who)?.name||'a Voyager';let el=$('splash-toast');
 if(!el){el=document.createElement('div');el.id='splash-toast';Object.assign(el.style,{position:'fixed',left:'50%',top:'16%',transform:'translateX(-50%)',padding:'10px 18px',borderRadius:'14px',background:'rgba(23,58,74,.9)',color:'#f6f2e8',font:'600 18px Inter,"Segoe UI",Arial,sans-serif',pointerEvents:'none',zIndex:'40',transition:'opacity .4s'});document.body.appendChild(el);}
 el.textContent='Splashed by '+name+'!';el.style.opacity='1';clearTimeout(splashHide);splashHide=setTimeout(()=>{el.style.opacity='0';},1800);}
function restPose(dt){
 const r=resting;r.t=T.MathUtils.clamp(r.t+(r.phase==='in'?1:-1)*dt/.7,0,1);
 const e=r.t*r.t*(3-2*r.t),h=walker.holder;
 h.position.lerpVectors(r.from.pos,r.to.pos,e);h.rotation.set(0,lerpAngle(r.from.heading,r.to.yaw,Math.min(1,e*1.6)),0);
 // In a Keel Club tube the sitting figure leans back into the ring (TUBE_SIT).
 walker.body.rotation.set(r.lie?(-Math.PI/2+PILLOW_TILT)*T.MathUtils.smoothstep(r.t,.25,1):r.spot.tube?-TUBE_SIT.recline*T.MathUtils.smoothstep(r.t,.25,1):0,0,0);
 // In a hammock (lounge.js) the body swings with it.
 const swing=r.spot.hammock&&lounge?.swingOf(r.spot.hammock);
 if(swing){const q=new T.Quaternion().setFromAxisAngle(swing.axis,swing.angle*e);h.position.sub(swing.pivot).applyQuaternion(q).add(swing.pivot);h.quaternion.premultiply(q);}
 if(r.phase==='out'&&r.t===0){heading=r.from.heading;controller.place(r.from.pos);resting=null;return null;}
 // In a healing capsule the body floats a little in the fluid, standing.
 if(r.stand){h.position.y+=(.20+.025*(1-Math.cos(performance.now()/1100)))*e;return {kind:'float',weight:e,seatHeight:walker.hipHeight};}
 return {kind:r.lie?'lie':'sit',weight:e,seatHeight:walker.hipHeight,hammock:!!r.spot.hammock,rim:r.spot.tube?TUBE_RIM:null};
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
function closePanels(){furSettings?.close();emergencyDrill?.close();controlsSettings?.close();graphicsSettings?.close();for(const id of ['lift-panel','places','emotes','map-sheet','aboard-sheet','name-sheet','photo-sheet','selfie-setup','spot-setup','comic-sheet','info-sheet','mudwater-sheet','clown-sheet','help-sheet','outside-sheet','vault-sheet'])$(id).hidden=true;closeOutside($('outside-sheet'),$('outside-frame'));maze?.close();treasure?.close();chat.close();graffiti?.close();crownTv?.close();closeCamera();input.enabled=true;input.down.clear();}
// The list is a current server snapshot, including visitors who have not sent a pose yet.
// The list of who is aboard, while its sheet is open.
function showAboardList(){
 if($('aboard-sheet').hidden)return;listedAt=performance.now();captainSays?.refresh();
 const list=$('aboard-list'),note=$('aboard-note');list.replaceChildren();
 note.textContent=liveStatus!=='live'?'Not connected to Leo live.':aboardNames===undefined?'Waiting for the visitor list...':aboardNames===null?'Visitor list unavailable on this connection.':'';
 // With many aboard the server sends the count alone ('heard': net/live.js): the names are this page's own (the
 // server's for a verified visitor who has not typed one, else the one this page last sent) and those it hears with
 // the poses, each with their id. Each name but this visitor's own offers Ask to join (join.js), when its id is known.
 const entries=aboardNames==='heard'?[{name:(live?.you?.verified&&!live.you.typed?live.you.name:savedName())||me.name||'Voyager',id:live?.id||null},...[...(remotes?.remotes.entries()??[])].map(([id,r])=>({name:r.name||'Voyager',id}))]
  :aboardNames?.map((name,i)=>({name,id:aboardIds?.[i]||null}));
 if(liveStatus==='live'&&entries)for(const {name,id} of entries){const li=document.createElement('li');
  if(!id||id===live.id){li.textContent=id?name+' (you)':name;list.appendChild(li);continue;}
  const b=Object.assign(document.createElement('button'),{type:'button',className:'join',textContent:join?.asking===id?'Asked':'Ask to join',disabled:join?.asking===id});
  b.onclick=()=>{closePanels();join?.ask(id,name);};li.append(Object.assign(document.createElement('span'),{className:'who',textContent:name}),b);list.appendChild(li);}
}
$('aboard').addEventListener('click',()=>{if(!$('aboard-sheet').hidden){closePanels();return;}closePanels();$('aboard-sheet').hidden=false;showAboardList();input.enabled=false;input.down.clear();$('aboard-close').focus();});
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
  // The link holds a score it cannot send yet (net/live.js heldFinishes) and says when it never went.
  submit(score,wave){const lost=()=>arcade.setResult({ok:false,why:'offline'});if(live)live.score(score,wave,lost);else lost();},
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
  submit(ms,shots){const lost=()=>pool.setResult({ok:false,why:'offline'});if(live)live.cleared(ms,shots,lost);else lost();},
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
graphicsSettings=atriumPack||deskDetail?mountGraphicsSettings({haze:deskDetail,held:hazeHeld,onOpenChange(open){if(open)closePanels();input.enabled=!open;input.down.clear();input.jumpQueued=false;input.jumpHeld=false;input.runLatched=false;input.stickRun=false;input.zoom=0;input.look.x=0;input.look.y=0;input.stickVec.x=0;input.stickVec.y=0;}}):null;
controlsSettings=mountControlsSettings({emotes:EMOTES,onOpenChange(open){if(open)closePanels();input.enabled=!open;input.down.clear();input.jumpQueued=false;input.jumpHeld=false;input.runLatched=false;input.stickRun=false;input.zoom=0;input.look.x=0;input.look.y=0;input.stickVec.x=0;input.stickVec.y=0;}});
furSettings=mountFurSettings({getColour:()=>furColour,onColour:value=>{furColour=value;walker.setFur(value);},onOpenChange(open){if(open)closePanels();input.enabled=!open;input.down.clear();input.jumpQueued=false;input.jumpHeld=false;input.runLatched=false;input.stickRun=false;input.zoom=0;input.look.x=0;input.look.y=0;input.stickVec.x=0;input.stickVec.y=0;}});
resButton.addEventListener('click',()=>{resChosen=true;setRes((res+1)%RES.length);try{localStorage.setItem(RES_KEY,RES[res]);}catch{}});
// Held for a higher jump, as Space is.
$('jump').addEventListener('pointerdown',e=>{e.preventDefault();input.jumpQueued=true;input.jumpHeld=true;$('jump').setPointerCapture(e.pointerId);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('jump').addEventListener(type,()=>{input.jumpHeld=false;});
$('hook').addEventListener('pointerdown',e=>{e.preventDefault();input.hookQueued=true;input.hookHeld=true;$('hook').setPointerCapture(e.pointerId);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('hook').addEventListener(type,()=>{input.hookHeld=false;});
$('crouch').addEventListener('click',()=>actions.crouch());
$('emote-button').addEventListener('click',()=>actions.emotes());
$('ping').addEventListener('click',()=>actions.ping());
for(const b of document.querySelectorAll('.respawn'))b.addEventListener('click',()=>actions.respawn());

if(typeof __WALK_DEBUG__!=="undefined"&&__WALK_DEBUG__)Object.defineProperties(globalThis.__walk,{treasure:{get:()=>treasure},baggage:{get:()=>baggage},featureDiagnostics:{get:()=>ship.v2RuntimeFeatures},cornerShade:{get:()=>cornerShade}});
// Include the ball and aquarium entrance created later in startup, before the first frame.
for(const root of [scene,haze,sky])onePassAtriumGlass(root);
// Corner shading (corner-shade.js): patched in before the warm-up, worked out and faded in after it. Not on phones; ?corner=0 leaves it off.
const cornerShade=phone||phoneTest.get('corner')==='0'?null:installCornerShade(scene);
if(cornerShade&&deskDetail){const corner=()=>cornerShade.setOn(DETAIL[getAtriumQuality()].corner);corner();subscribeAtriumQuality(corner);}
// The shader warm-up (see shaderWarmup): the walk's scene with the arrival hall's lamps both ways, then its sky and haze.
// The phone ship uploads nothing ahead and keeps no list of pictures.
Promise.race([environmentReady,new Promise(r=>setTimeout(r,WARM_WAIT_MS))])
 .then(()=>Promise.all([warmShaders(renderer,scene,camera,{lights:[arrivalMood?.lamps].filter(Boolean)}),warmShaders(renderer,haze,hazeCamera),warmShaders(renderer,sky,skyCamera)]))
 .then(([main,...rest])=>{shaderWarmup={proof:main.proof,textures:preparedPhone?null:new Set([main,...rest].flatMap(w=>[...w.textures])),uploaded:null};})
 .catch(e=>console.warn('Shader warm-up skipped.',e)).finally(()=>{warmed=true;cornerShade?.start(colliders).catch(e=>console.warn('Corner shading skipped.',e));});
