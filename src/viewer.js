import {createThrusterEffects} from './thruster-effects.js';
import {createSpaceBackdrop,aftScreenFlow} from './space-backdrop.js';
import * as T from 'three';
import {createNoseCommons,NOSE_COMMONS} from './nose-commons.js';
import {applyContextOpacity} from './glazing-finish.js';
import {publicAsset,enablePublicDownloads} from './public-assets.js';
import {refineExterior} from './exterior-finish.js';
import {createAft} from './aft.js';
import {AFT_TOUR} from './aft-tour.js';
import {attachFinCrown,prepareCrownExterior} from './fin-crown.js';
import {AFT_VIEWS} from './aft-layout.js';
import {createSpecialCirculation} from './special-circulation.js';
import {createTransit,TRANSIT_CORES,floorY} from './transit.js';
import {SHIP_AREAS,createShipArea} from './areas.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createShip,createResidentialDeck,createGardenCommons,DECKS,ROUTE,SAMPLE,COMMONS } from './model.js';

const $=id=>document.getElementById(id);
// Visitors get the ship; ?studio=1 restores downloads, render exports and review notes for the build team.
const studioTools=new URLSearchParams(location.search).get('studio')==='1';document.body.classList.toggle('studio-tools',studioTools);
const CHAPTERS={exterior:'Exterior',layout:'Deck layout',areas:'Ship areas',neighborhood:'Neighborhood',aft:'Aft systems',transit:'Connections',walk:'Tour'};
// The last word of each view title carries the accent, as on marscatsvoyage.com.
function setTitle(text){const el=$('view-title'),i=text.lastIndexOf(' '),em=document.createElement('em');em.textContent=i>0?text.slice(i+1):text;el.replaceChildren(...(i>0?[text.slice(0,i+1)]:[]),em);}
enablePublicDownloads();
document.getElementById('share-view')?.addEventListener('click',async()=>{
 const button=document.getElementById('share-view');
 try{await navigator.clipboard.writeText(location.href);button.textContent='Link copied';setTimeout(()=>button.textContent='Copy view link',2500);}
 catch{window.prompt('Copy this view link',location.href);}
});
window.addEventListener('error',e=>showError(e.message));
function showError(message){$('error').hidden=false;$('error').textContent=`The 3D view could not start: ${message}. The GLB files remain available from the links below.`;$('loading').hidden=true;}
let renderer;
// Phones: 1.25x pixels (1x while touching) and a half-size starfield redrawn at 30 fps. MSAA stays on: 1.25x alone leaves jagged hull edges.
const touchScreen=matchMedia('(pointer: coarse)').matches,baseRatio=Math.min(devicePixelRatio,touchScreen?1.25:1.75);
try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,logarithmicDepthBuffer:true});}catch(e){showError(e.message);throw e;}
renderer.setPixelRatio(baseRatio);renderer.setClearColor(0xbac8cd);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
$('viewport').appendChild(renderer.domElement);
const spaceBackdrop=createSpaceBackdrop(touchScreen?{scale:.5,fps:30}:{});
const scene=new T.Scene();scene.background=new T.Color(0xbac8cd);
const pmrem=new T.PMREMGenerator(renderer);const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.4;room.dispose();pmrem.dispose();
const hemi=new T.HemisphereLight(0xf3f4eb,0x657481,.7);scene.add(hemi);
const key=new T.DirectionalLight(0xfff4dc,1.8);key.position.set(160,420,250);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-380,right:380,top:270,bottom:-270,near:1,far:1200});key.shadow.bias=-.0003;key.shadow.normalBias=.15;scene.add(key);
const fill=new T.DirectionalLight(0xd7ebff,.55);fill.position.set(-260,200,-180);scene.add(fill);
const rim=new T.DirectionalLight(0xffffff,.65);rim.position.set(200,60,-300);scene.add(rim);
let camera=new T.PerspectiveCamera(42,1,1,6000);
const persp=camera,ortho=new T.OrthographicCamera(-400,400,240,-240,.1,6000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=1;controls.maxDistance=2200;controls.maxPolarAngle=Math.PI*.96;
const ship=createShip({deferExterior:true});scene.add(ship.root);
let activeDistrict=10,residenceInside=false;const districtViews=new Map();
const noseScene=new T.Group(),noseViews=new Map();scene.add(noseScene);noseScene.visible=false;
function noseView(){
 if(!noseViews.has(activeDistrict)){const v=createNoseCommons(activeDistrict);noseViews.set(activeDistrict,v);noseScene.add(v.root);}
 for(const [n,v] of noseViews)v.root.visible=n===activeDistrict;
 const v=noseViews.get(activeDistrict);v.shell.visible=$('detail-walls').checked;return v;
}
function viewLink(values){if(location.protocol!=='file:'){const params=new URLSearchParams(values);if($('clean-branding')?.checked)params.set('clean','1');else params.delete('clean');history.replaceState(null,'','?'+params);}}
function districtView(){
  if(activeDistrict===10)return null;
  if(!districtViews.has(activeDistrict)){
    const residence=createResidentialDeck(activeDistrict,ship.detail),garden=createGardenCommons(activeDistrict,ship.detail),root=new T.Group();
    root.add(residence.root,garden.root);root.visible=false;scene.add(root);districtViews.set(activeDistrict,{root,residence,garden});
  }
  return districtViews.get(activeDistrict);
}
for(let n=1;n<=10;n++){const o=document.createElement('option');o.value=n;o.textContent='Deck '+(n+5)+' · '+NOSE_COMMONS[n-1].name;o.selected=n===10;$('neighborhood-select').append(o);}
  $('neighborhood-select').addEventListener('change',async()=>{const focus=document.querySelector('[data-focus][aria-pressed="true"]')?.dataset.focus||'all';activeDistrict=Number($('neighborhood-select').value);await setMode('neighborhood');focusDetail(focus);});
const areasRoot=new T.Group();areasRoot.visible=false;scene.add(areasRoot);const areaCache=new Map();let activeArea=SHIP_AREAS.find(a=>a.kind==='farm'),areaView='overview';
$('area-count').textContent=SHIP_AREAS.length;
for(const deck of [...new Set(SHIP_AREAS.map(a=>a.deck))].sort((a,b)=>a-b)){const group=document.createElement('optgroup');group.label='Deck '+deck;for(const a of SHIP_AREAS.filter(a=>a.deck===deck)){const option=document.createElement('option');option.value=a.id;option.textContent=a.name;group.append(option);}$('area-select').append(group);}
function showArea(id=activeArea.id,view=areaView){
  activeArea=SHIP_AREAS.find(a=>a.id===id)||activeArea;areaView=view;
  if(!areaCache.has(activeArea.id)){const room=createShipArea(activeArea);areaCache.set(activeArea.id,room);areasRoot.add(room.root);}
  for(const [key,room] of areaCache)room.root.visible=key===activeArea.id;
  const room=areaCache.get(activeArea.id);room.shell.visible=view==='inside';$('area-select').value=activeArea.id;$('area-deck').textContent=activeArea.deck;$('area-description').textContent=activeArea.description;
  setTitle(activeArea.name);$('view-description').textContent=activeArea.category+' · Deck '+activeArea.deck;$('status').textContent=activeArea.name+' · '+(view==='inside'?'1.7 m eye level':activeArea.width+' × '+activeArea.depth+' m concept area');
  document.querySelectorAll('[data-area-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.areaView===view));persp.fov=view==='inside'?65:42;persp.near=.05;
  const pose=room[view];setCamera('persp',pose.position,pose.target,0);
  const bridgeSky=activeArea.kind==='bridge'&&view==='inside';mars.visible=bridgeSky;stars.visible=bridgeSky;scene.background.set(bridgeSky?0x0a1422:0xbac8cd);
  viewLink({area:activeArea.id,view:areaView});
}
$('locate-area').addEventListener('click',async()=>{ $('deck-select').value=activeArea.deck-1; $('isolate').checked=true; $('shell-context').checked=false; await setMode('layout'); setCamera('ortho',[0,600,.01],[0,0,0],0); });
$('area-select').addEventListener('change',()=>showArea($('area-select').value));document.querySelectorAll('[data-area-view]').forEach(b=>b.addEventListener('click',()=>showArea(activeArea.id,b.dataset.areaView)));
let transitView=null,transitKey='',transitDeck=17,transitCore='forward',transitPose='overview',previewTransit=null;
const transitScene=new T.Group();scene.add(transitScene);transitScene.visible=false;
for(let d=1;d<=20;d++){const o=document.createElement('option');o.value=d;o.textContent='Deck '+d+' · '+DECKS[d-1].name;$('transit-deck').append(o);}
function showTransit(){
  const core=TRANSIT_CORES.find(c=>c.id===transitCore);transitDeck=Math.min(transitDeck,core.lastDeck);
  const nextKey=transitCore+'-'+transitDeck;
  if(nextKey!==transitKey){transitView?.root.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose();});transitScene.clear();transitKey=nextKey;
  transitView=createTransit({minimumDeck:transitDeck>=17&&transitDeck<=19?17:Math.max(1,transitDeck-1),maximumDeck:transitDeck>=17&&transitDeck<=19?19:Math.min(core.lastDeck,transitDeck+1),coreIds:[transitCore]});transitScene.add(transitView.root);transitView.shell.visible=transitPose==='inside';
  if(transitDeck>=17){for(const number of (transitCore==='forward'?[9,10]:[1,2])){const g=createGardenCommons(number,ship.detail);g.walls.visible=transitPose==='inside';transitScene.add(g.root);}}
  }
  transitView.shell.visible=transitPose!=='overview';transitScene.traverse(o=>{if(o.name==='Garden_walls_and_ceiling')o.visible=transitPose!=='overview';});
  document.body.dataset.eye=transitPose==='overview'?'0':'1';
  $('transit-deck').value=transitDeck;$('transit-core').value=transitCore;
  $('transit-description').textContent=(transitCore==='forward'?'Forward core · Decks 1–20':'Aft core · Decks 1–19')+' · paired lifts, two switchback stairs and deck landings.';
  setTitle(transitCore==='forward'?'The forward connection.':'The aft connection.');$('view-description').textContent='Deck '+transitDeck+' · '+DECKS[transitDeck-1].name;
  $('status').textContent='Deck '+transitDeck+' · '+(transitPose!=='overview'?'1.7 m eye level':'Three-deck cutaway');
  document.querySelectorAll('[data-transit-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.transitView===transitPose));
  const y=floorY(transitDeck);persp.near=.05;persp.fov=transitPose!=='overview'?65:42;
  if(transitPose==='inside')setCamera('persp',[core.x-4,y+1.7,0],[core.x,y+1.5,6],0);
  else if(transitPose==='stairs')setCamera('persp',[core.stairX-3.5,y+1.7,core.stairZ-1.4],[core.stairX+2.5,y+3,core.stairZ-1.4],0);
  else setCamera('persp',transitDeck>=17&&transitDeck<=19?[core.x+60,y+65,105]:[core.x+28,y+27,42],[core.x,y+3,0],0);
  viewLink({transit:transitCore,deck:transitDeck,view:transitPose});
}
$('transit-deck').addEventListener('change',()=>{transitDeck=Number($('transit-deck').value);showTransit();});
$('transit-core').addEventListener('change',()=>{transitCore=$('transit-core').value;showTransit();});
document.querySelectorAll('[data-transit-view]').forEach(b=>b.addEventListener('click',()=>{transitPose=b.dataset.transitView;showTransit();}));
const aftScene=new T.Group();scene.add(aftScene);aftScene.visible=false;
// Cosmo, the crew cat, loads as its own file once the ship is up. The blockout cats stay until it is ready, so a
// failed load degrades to the old figures. New scene parts are dressed on the next frame; a 1 s sweep of what is
// visible catches anything built deeper inside an existing group.
let cosmoKit=null,cosmoSweep=0;const cosmoPending=new Set();
function loadCosmo(){
 if(loadCosmo.started)return;loadCosmo.started=true;globalThis.LEO_THREE=T;
 const script=Object.assign(document.createElement('script'),{src:'cosmo.js',async:true});
 script.onload=()=>globalThis.LeoCosmo.createCosmoKit().then(kit=>{cosmoKit=kit;cosmoPending.add(scene);}).catch(err=>console.warn('Cosmo could not load; keeping the blockout figures.',err));
 script.onerror=()=>console.warn('cosmo.js is missing; keeping the blockout figures.');
 document.head.appendChild(script);
}
// The ship and key light never move, so the 2048 px shadow map is redrawn only after something changes (input,
// new scene parts, Cosmo, resize) plus a 1 s safety refresh, instead of re-rendering the whole ship every frame.
let shadowFrames=3,shadowClock=0;const refreshShadows=()=>{shadowFrames=3;};
for(const type of ['click','change','input'])document.addEventListener(type,refreshShadows,true);addEventListener('resize',refreshShadows);
function tickShadows(now){if(shadowFrames>0){shadowFrames--;renderer.shadowMap.needsUpdate=true;}else if(now-shadowClock>1000){shadowClock=now;renderer.shadowMap.needsUpdate=true;}}
for(const container of [scene,noseScene,areasRoot,transitScene,aftScene])container.addEventListener('childadded',()=>{refreshShadows();if(cosmoKit)cosmoPending.add(container);});
function dressCosmo(now){
 if(!cosmoKit)return;
 for(const root of cosmoPending)if(globalThis.LeoCosmo.dressCats(root,cosmoKit))refreshShadows();cosmoPending.clear();
 if(now-cosmoSweep>1000){cosmoSweep=now;if(globalThis.LeoCosmo.dressCats(scene,cosmoKit,true))refreshShadows();}
}let aftModel=null,aftGhost=null,aftSection='overview',aftEye=false;
for(const [key,v]of Object.entries(AFT_VIEWS)){const o=document.createElement('option');o.value=key;o.textContent=v.name;$('aft-section').append(o);}
function showAft(){
 if(!aftModel){aftModel=createAft();aftScene.add(aftModel.root);const rooms=new T.Group();rooms.name='Existing_aft_engineering';
  for(const area of SHIP_AREAS.filter(a=>a.category==='Aft engineering')){const r=createShipArea(area);r.shell.visible=false;rooms.add(r.root);}const c=createSpecialCirculation(7);c.shell.visible=false;rooms.add(c.root);aftScene.add(rooms);
  const upper=new T.Group();upper.name='Upper_aft_commons';for(const a of SHIP_AREAS.filter(a=>a.upperAft)){const r=createShipArea(a);r.shell.visible=false;upper.add(r.root);}for(const d of [16,17]){const r=createSpecialCirculation(d);r.shell.visible=false;upper.add(r.root);}aftScene.add(upper);
  aftGhost=ship.exterior.clone(true);aftGhost.name='Aft_shell_context';aftGhost.traverse(o=>{if(o.isMesh){const ms=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const n=m.clone();n.transparent=true;n.opacity=.1;n.depthWrite=false;n.clippingPlanes=[new T.Plane(new T.Vector3(-1,0,0),-132)];return n;});o.material=Array.isArray(o.material)?ms:ms[0];o.castShadow=false;}});aftGhost.traverse(o=>o.visible=true);aftGhost.getObjectByName('Fin_panorama_lounge')?.removeFromParent();aftScene.add(aftGhost);renderer.localClippingEnabled=true;
 }
 const v=AFT_VIEWS[aftSection];if(!v.eye)aftEye=false;
 const crownSky=aftSection==='crown'&&aftEye;stars.visible=crownSky;mars.visible=crownSky;scene.background.set(crownSky?0x0a1422:0xbac8cd);
 for(const [key,g]of Object.entries(aftModel.parts))g.visible=aftSection==='overview'||key===aftSection||(aftSection==='pods'&&key==='access');
 aftScene.getObjectByName('Existing_aft_engineering').visible=aftSection==='overview';
 aftScene.getObjectByName('Upper_aft_commons').visible=['overview','access','fin'].includes(aftSection);
 aftModel.shells.forEach(o=>o.visible=aftEye);aftModel.crown.roofs.forEach(o=>o.visible=aftEye);aftGhost.visible=$('aft-shell').checked&&!aftEye&&aftSection!=='crown';
 $('aft-shell').disabled=aftEye||aftSection==='crown';
 $('aft-section').value=aftSection;$('aft-eye').disabled=!v.eye;$('aft-eye').setAttribute('aria-pressed',String(aftEye));$('aft-overview').setAttribute('aria-pressed',String(!aftEye));
 setTitle(v.name);$('view-description').textContent=v.location;$('aft-description').textContent=v.description;$('status').textContent=v.location+' · '+(aftEye?'1.7 m inspection view':'structural blockout');
 document.body.dataset.eye=aftEye?'1':'0';persp.near=.05;persp.fov=aftEye?65:42;setCamera('persp',aftEye?v.eye:v.position,aftEye?v.look:v.target,0);
 viewLink({aft:aftSection,view:aftEye?'inside':'overview'});
}
$('aft-section').addEventListener('change',()=>{aftSection=$('aft-section').value;showAft();});$('aft-shell').addEventListener('change',showAft);
$('aft-eye').addEventListener('click',()=>{aftEye=true;showAft();});$('aft-overview').addEventListener('click',()=>{aftEye=false;showAft();});
const shapeParts=/^(Fin_cap_retained_white_underside$|Crown_|Smooth_pressure_envelope_|Upper_engine_housing_|Sculpted_nacelle_shell$|Nacelle_exhaust_bulkhead$|Nacelle_chamfered_nose_face$|Engine_shroud$|Engine_bell$|Engine_nozzle_lip$|Engine_throat$|Blended_double_delta$|Wing_thermal_edge$|Wing_stabilizer_fence$|Swept_cat_tail$|Swept_tail_cap$|Tail_root_dorsal_fairing$|Contoured_aft_pressure_frame$|Forward_observation_panes$|Individual_glazing_frames$|Individual_glazing_seals$|Bridge_roof_brow$|Forward_side_vent_)/;
const brandingParts=/^(LEO_wordmark|Mission_identifier|Mission_brand|Crest_|Tail_registry|Roof_mission|V33_authentic_Mars_Cats_Voyage_logo)$/;
const exteriorMeshes=[];ship.exterior.traverse(o=>{if(o.isMesh)exteriorMeshes.push({mesh:o,visible:o.visible});});
function brandingMesh(o){return o.isMesh&&brandingParts.test(o.name);}
function applyBrandingView(){const clean=$('clean-branding')?.checked===true;document.body.classList.toggle('clean-branding',clean);document.title=clean?'Life aboard':'LEO — Life aboard';scene.traverse(o=>{if(brandingMesh(o))o.visible=!clean;});}
function applyShapeView(){const simple=mode==='exterior'&&$('shape-only').checked,clean=$('clean-branding')?.checked===true;for(const {mesh,visible} of exteriorMeshes)mesh.visible=visible&&(!simple||shapeParts.test(mesh.name))&&(!clean||!brandingMesh(mesh));}
$('shape-only').addEventListener('change',applyShapeView);
$('clean-branding').addEventListener('change',()=>{const clean=$('clean-branding').checked;try{localStorage.setItem('leo-clean-branding',clean?'1':'0');}catch{}applyBrandingView();applyShapeView();const params=new URLSearchParams(location.search);if(clean)params.set('clean','1');else params.delete('clean');if(location.protocol!=='file:')history.replaceState(null,'','?'+params);});
function exteriorStage(){if(mode!=='exterior')return;const studio=$('studio-stage').checked;document.body.dataset.studio=studio?'1':'0';grid.visible=!studio;pad.visible=!studio;scene.background.set(studio?0x344554:0xbac8cd);scene.environmentIntensity=.55;key.intensity=1.45;hemi.intensity=.65;}
$('studio-stage').addEventListener('change',exteriorStage);
const grid=new T.GridHelper(1100,44,0x8d9fa7,0xaab9bf);grid.position.y=-59;grid.material.transparent=true;grid.material.opacity=.48;scene.add(grid);
const pad=new T.Mesh(new T.PlaneGeometry(2400,2400),new T.MeshStandardMaterial({color:0xa9b9c0,roughness:1}));pad.rotation.x=-Math.PI/2;pad.position.y=-59.1;pad.receiveShadow=true;scene.add(pad);
const dimensions=new T.Group();dimensions.name='Viewer_dimensions';scene.add(dimensions);
function label(text,pos){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.font='500 35px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#304957';ctx.fillText(text,256,62);const tx=new T.CanvasTexture(c);const sp=new T.Sprite(new T.SpriteMaterial({map:tx,depthTest:false,transparent:true}));sp.position.set(...pos);sp.scale.set(90,17,1);dimensions.add(sp);}
function line(points,color=0x718996){const geo=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));dimensions.add(new T.Line(geo,new T.LineBasicMaterial({color,transparent:true,opacity:.75,depthTest:false})));}
line([[-300,-45,190],[264,-45,190]]);for(let x of [-300,264])line([[x,-45,181],[x,-45,199]]);label('564 m', [-18,-43,205]);
line([[-330,-45,-150],[-330,-45,150]]);for(let z of [-150,150])line([[-339,-45,z],[-321,-45,z]]);label('300 m',[-353,-42,0]);
// Stylized, procedural Mars backdrop; no remote assets are needed.
const marsGeometry=new T.SphereGeometry(180,96,64),marsColors=[];
const terrainColor=new T.Color(),marsPositions=marsGeometry.attributes.position;
for(let i=0;i<marsPositions.count;i++){
  const x=marsPositions.getX(i)/180,y=marsPositions.getY(i)/180,z=marsPositions.getZ(i)/180;
  const broad=Math.sin(x*7+Math.sin(z*5))*Math.cos(y*9-z*3),fine=Math.sin(x*35+y*17)*Math.cos(z*29-y*11);
  terrainColor.setRGB(.38+.16*(broad+1)/2+.035*fine,.16+.1*(broad+1)/2+.015*fine,.075+.06*(broad+1)/2);
  if(y>.91)terrainColor.lerp(new T.Color(0xd7c9b5),(y-.91)*6);
  marsColors.push(terrainColor.r,terrainColor.g,terrainColor.b);
}
marsGeometry.setAttribute('color',new T.Float32BufferAttribute(marsColors,3));
const mars=new T.Mesh(marsGeometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1}));mars.position.set(1800,90,-100);mars.visible=false;scene.add(mars);
const starsGeometry=new T.BufferGeometry(),starPositions=[];let starSeed=731;
function starRandom(){starSeed=(Math.imul(starSeed,1664525)+1013904223)>>>0;return starSeed/4294967296;}
for(let i=0;i<1500;i++){const y=starRandom()*2-1,a=starRandom()*Math.PI*2,r=Math.sqrt(1-y*y);starPositions.push(3800*r*Math.cos(a),3800*y,3800*r*Math.sin(a));}
starsGeometry.setAttribute('position',new T.Float32BufferAttribute(starPositions,3));
const stars=new T.Points(starsGeometry,new T.PointsMaterial({color:0xd5e2eb,size:1.25,sizeAttenuation:false,transparent:true,opacity:.65}));stars.visible=false;scene.add(stars);
let routeKey='home',tourResidence=null,tourTransit=null;const routeStops=()=>routeKey==='aft'?AFT_TOUR:ROUTE;
let mode='exterior',transition=null,tourPlaying=false,stop=0,tourTimer=null,lookDrag=null,lastFrameScale=1,exporting=false;
let turntable=false,lastFrameTime=0;
function stopTurntable(){turntable=false;controls.autoRotate=false;$('turntable').textContent='Start turntable';$('turntable').setAttribute('aria-pressed','false');}
$('turntable').addEventListener('click',()=>{
 if(turntable){stopTurntable();return;}
 if(mode==='walk')return;
 if(controls.getPolarAngle()<.1){const t=controls.target.clone(),r=camera.position.distanceTo(t);setCamera('persp',t.clone().add(new T.Vector3(r*.7,r*.55,r*.7)).toArray(),t.toArray(),0);}
 transition=null;turntable=true;controls.autoRotate=true;controls.autoRotateSpeed=.6;
 $('turntable').textContent='Pause turntable';$('turntable').setAttribute('aria-pressed','true');
});
controls.addEventListener('start',stopTurntable);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTurntable();});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('speed-lines').checked=!reduced;
function setCamera(type,position,target,duration=850){
  stopTurntable();
  camera=type==='ortho'?ortho:persp;controls.object=camera;controls.enabled=mode!=='walk';resize();
  if(mode!=='walk'&&type!=='ortho')position=new T.Vector3(...position).sub(new T.Vector3(...target)).multiplyScalar(lastFrameScale).add(new T.Vector3(...target)).toArray();
  if(duration===0||reduced){camera.position.set(...position);controls.target.set(...target);camera.lookAt(controls.target);if(mode!=='walk')controls.update();transition=null;return;}
  transition={start:performance.now(),duration,from:camera.position.clone(),to:new T.Vector3(...position),fromTarget:controls.target.clone(),toTarget:new T.Vector3(...target)};
}
function resize(){
  const r=$('viewport').getBoundingClientRect();if(!r.width||!r.height)return; // hidden or collapsed: wait for a real size
  renderer.setSize(r.width,r.height);persp.aspect=r.width/r.height;
  const frameScale=Math.max(1,1.5/persp.aspect),ratio=frameScale/lastFrameScale;
  if(mode!=='walk'&&camera===persp&&ratio!==1){
    camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
    if(transition){transition.from.sub(transition.fromTarget).multiplyScalar(ratio).add(transition.fromTarget);transition.to.sub(transition.toTarget).multiplyScalar(ratio).add(transition.toTarget);}
  }
  lastFrameScale=frameScale;const shift=r.width>1000?110:r.width>680?80:0,shiftY=r.width<=680&&mode!=='walk'?70:0;
  persp.setViewOffset(r.width,r.height,shift,shiftY,r.width,r.height);persp.updateProjectionMatrix();
  const h=230*frameScale;ortho.left=-h*r.width/r.height;ortho.right=h*r.width/r.height;ortho.top=h;ortho.bottom=-h;ortho.setViewOffset(r.width,r.height,shift,shiftY,r.width,r.height);ortho.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('viewport'));
function contextOpacity(value){[ship.port,ship.starboard].forEach(g=>applyContextOpacity(g,value));}
let exteriorReady=false,exteriorLoad=null,modeRequest=0,thrusters=null;
async function loadExterior(){
  if(exteriorReady)return;
  if(!exteriorLoad)exteriorLoad=(async()=>{
    if(location.protocol==='file:'){
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));ship.ensureExterior();
    }else{
      // Stream the meshopt web copy when the public build has one; downloads keep the lossless refined GLB.
      const exteriorName=window.LEO_PUBLIC_ASSETS?.['leo-exterior-web.glb']?'leo-exterior-web.glb':'leo-exterior-refined.glb';
      const bytes=await publicAsset(exteriorName,p=>{$('loading').textContent=`Loading Leo… ${p}%`;});
      const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf=bytes?await loader.parseAsync(bytes,''):await loader.loadAsync('leo-exterior-refined.glb');
      gltf.scene.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)o.name=gltf.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh&&a?.meshes!==undefined)o.name=o.parent.name;});
      const exterior=gltf.scene.getObjectByName('01_EXTERIOR_REFINED_V31');
      if(!exterior)throw new Error('The saved exterior is missing its root');
      ship.root.remove(ship.exterior);exterior.visible=false;ship.root.add(exterior);
      Object.assign(ship,{exterior,fixed:exterior.getObjectByName('Wings_engines_tail'),port:exterior.getObjectByName('Port_shell'),starboard:exterior.getObjectByName('Starboard_shell')});
    }
    if(location.protocol==='file:'){prepareCrownExterior(ship.exterior);refineExterior(ship.exterior);attachFinCrown(ship.exterior);}
    ship.exterior.traverse(o=>{if(o.isMesh){const glazing=(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.name.startsWith('LEO_glass_'));o.castShadow=!glazing;o.receiveShadow=!glazing;exteriorMeshes.push({mesh:o,visible:o.visible});}});thrusters=createThrusterEffects(ship.exterior);scene.add(thrusters.root);exteriorReady=true;loadCosmo();applyBrandingView();applyShapeView();
  })().catch(e=>{exteriorLoad=null;throw e;});
  await exteriorLoad;
}
  async function setMode(next){
    stopTurntable();$('turntable').disabled=next==='walk';
    noseScene.visible=false;
  const request=++modeRequest;
  if((next==='exterior'||next==='layout'||next==='aft'||(next==='walk'&&routeKey==='aft'))&&!exteriorReady){
    $('loading').textContent='Loading exterior model…';$('loading').hidden=false;
    try{await loadExterior();}catch(e){showError(e.message);return;}
    if(request!==modeRequest)return;
  }
  $('loading').hidden=true;
  stopTour();if(tourResidence)tourResidence.visible=false;if(tourTransit)tourTransit.visible=false;mode=next;document.body.dataset.eye='0';applyShapeView();document.body.dataset.mode=mode;persp.fov=mode==='walk'?65:42;persp.near=mode==='walk'?.05:mode==='neighborhood'?.1:1;persp.far=6000;transition=null;contextOpacity(1);
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));
  for(let m of ['exterior','layout','neighborhood','walk','areas','transit','aft'])$(`${m}-controls`).hidden=m!==mode;
  ship.exterior.visible=mode==='exterior'||mode==='layout';ship.port.visible=true;ship.starboard.visible=true;
  aftScene.visible=mode==='aft';transitScene.visible=mode==='transit';areasRoot.visible=mode==='areas';ship.inside.visible=mode==='layout';ship.detail.root.visible=(mode==='neighborhood'&&activeDistrict===10)||mode==='walk';
  if(mode==='neighborhood')districtView();for(const [number,v]of districtViews)v.root.visible=mode==='neighborhood'&&number===activeDistrict;
  dimensions.visible=mode==='exterior'&&$('dimensions').checked;grid.visible=mode==='exterior'||mode==='layout';pad.visible=grid.visible;
  stars.visible=mode==='walk';mars.visible=mode==='walk'||mode==='neighborhood';controls.enabled=mode!=='walk';controls.enablePan=true;controls.minDistance=(['neighborhood','walk','areas','transit','aft'].includes(mode))?1:50;controls.maxDistance=mode==='neighborhood'?400:2200;
  $('save-interior').hidden=!['walk','neighborhood','areas','transit','aft'].includes(mode);$('interior-render-status').textContent='';$('route').hidden=mode!=='walk';$('walk-help').hidden=mode!=='walk';$('stamp').hidden=mode==='walk';
  $('stamp').lastChild.textContent=['neighborhood','areas','transit','aft'].includes(mode)?'INTERIOR STUDY · 01':studioTools?'EXTERIOR FINISH · V35':'564 m · 20 decks · 10,000 aboard';
  $('foot-note').textContent=mode==='walk'?'Drag to look · follow the route':'Drag to orbit · scroll to zoom · right-drag to pan';
  const texts={aft:['07 / AFT SYSTEMS','Inside the tail.','Aft machinery and maintenance structure.','AFT SYSTEMS'],transit:['06 / CONNECTIONS','Moving through Leo.','Lifts, stairs and garden promenades.','DECK CONNECTIONS'],areas:['05 / SHIP AREAS','Spaces for the voyage.','Explore the facilities that support life aboard Leo.','SHIP DIRECTORY'],exterior:['01 / EXTERIOR REFINEMENT','A home between planets.','Leo’s familiar silhouette, resolved at the scale of a traveling community.','DESIGN BASELINE'],layout:['02 / SPATIAL ALLOCATION','Room for the voyage.','Inspect the deck stack and the placement of every twin cabin.','DECK INSPECTOR'],neighborhood:['03 / HUMAN-SCALE STUDY','A neighborhood aboard Leo.','500 twin cabins, a shared garden and a panoramic lounge, connected at full scale.','NEIGHBORHOOD 10'],walk:['04 / GUIDED WALKTHROUGH','From cabin to the stars.','Follow a short route through Neighborhood 10.','LIFE ABOARD']};
  [$('eyebrow'),$('view-title'),$('view-description'),$('panel-title')].forEach((el,i)=>el.textContent=texts[mode][i]);setTitle(texts[mode][1]);
  if(mode==='exterior'&&!studioTools)$('eyebrow').textContent='WELCOME ABOARD';$('counter').textContent=texts[mode][0].split(' / ')[0]+' / '+CHAPTERS[mode];
  scene.background.set(mode==='walk'?0x0a1422:0xbac8cd);scene.environmentIntensity=mode==='walk'?.65:.4;hemi.intensity=mode==='walk'?.65:.7;key.intensity=mode==='walk'?.7:1.8;fill.intensity=mode==='walk'?.25:.55;rim.intensity=mode==='walk'?.25:.65;
  if(mode==='exterior'){viewCamera('perspective');$('status').textContent=studioTools?'Exterior V35 / refined surfaces':'Exterior · refined surfaces';}
  if(mode==='layout'){updateDeck();setCamera('persp',[420,360,460],[0,-5,0]);}
  if(mode==='areas')showArea();
  if(mode==='transit')showTransit();
  if(mode==='aft')showAft();if(mode==='exterior')exteriorStage();
  if(mode==='neighborhood'||mode==='walk'){if(!previewTransit){previewTransit=createTransit({minimumDeck:15,maximumDeck:19,coreIds:['forward']});ship.detail.root.add(previewTransit.root);}previewTransit.shell.visible=mode==='walk'||$('detail-walls').checked;}
  if(mode==='neighborhood'){
    const v=districtView(),enclosed=$('detail-walls').checked;
    ship.detail.walls.visible=enclosed;ship.detail.districtWalls.visible=enclosed;
    if(v){v.residence.walls.visible=enclosed;v.residence.districtWalls.visible=enclosed;v.garden.walls.visible=enclosed;}
    $('panel-title').textContent='NEIGHBORHOOD '+activeDistrict;
    $('view-description').textContent='500 furnished twin cabins on Deck '+(activeDistrict+5)+', with a garden commons on the upper levels.';
    focusDetail('all');$('status').textContent='Neighborhood '+activeDistrict+' · 1,000 residents · 500 furnished twin cabins';
  }
  if(mode==='walk'){ship.detail.walls.visible=true;ship.detail.districtWalls.visible=true;ship.detail.district.visible=true;stop=0;goStop(0,0);$('status').textContent='Guided route · artificial gravity assumed';}
}
function viewCamera(view){if(mode==='exterior')viewLink({camera:view});document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.camera===view));
  persp.fov=view==='concept'?37:42;persp.updateProjectionMatrix();
  if(view==='concept')setCamera('persp',[340,455,650],[0,20,0]);
  if(view==='perspective')setCamera('persp',[460,300,500],[0,15,0]);
  if(view==='top')setCamera('ortho',[0,1000,.01],[0,0,0]);
  if(view==='side')setCamera('ortho',[0,30,1000],[0,30,0]);
  if(view==='front')setCamera('ortho',[1000,20,0],[0,20,0]);
  if(view==='aft')setCamera('persp',[-470,290,460],[-30,15,0]);
  if(view==='bow')setCamera('persp',[430,112,245],[211,14,0]);
  if(view==='enginewindows')setCamera('persp',[-362,39,302],[-228,-9,79]);
  if(view==='aftwindows')setCamera('persp',[-300,150,340],[-206,55,0]);
  if(view==='windows')setCamera('persp',[0,32,195],[-10,13,65]);
  if(view==='engine')setCamera('persp',[-405,22,187],[-268,-16,122]);
}
function updateDeck(){const selected=Number($('deck-select').value),isolate=$('isolate').checked,d=DECKS[selected];
  for(const deck of DECKS)if(isolate?deck.index===selected:deck.index<=selected){ship.ensureServiceDeck(deck.number);ship.ensureResidentialDeck(deck.number);}
  viewLink({deck:selected+1});
  ship.decks.forEach((g,i)=>g.visible=isolate?i===selected:i<=selected);
  const aft=ship.ensureAft();aft.root.visible=true;for(const [key,g]of Object.entries(aft.parts))g.visible=({drive:selected>=7&&selected<=13,tanks:selected>=3&&selected<=6,pods:selected===5,access:selected>=3&&selected<=16,fin:selected>=16})[key];aft.shells.forEach(o=>o.visible=false);
  ship.vertical.visible=false;const tr=ship.ensureTransit();tr.root.visible=true;tr.shell.visible=false;tr.structure.visible=!isolate;for(const [n,g]of tr.decks)g.visible=isolate?n===selected+1:n<=selected+1;ship.ensureObservation().root.visible=selected>=16&&selected<=18;ship.shared.visible=selected>=16&&selected<=18;if(ship.shared.visible)ship.ensureGardens();
  ship.exterior.visible=$('shell-context').checked;ship.starboard.visible=false;ship.port.visible=true;contextOpacity(.14);
  $('deck-cabins').textContent=d.residential?'500':'—';$('deck-berths').textContent=d.residential?'1,000':'—';
  $('deck-description').textContent=d.residential?'500 furnished twin cabins with two beds, desks, storage and compact ensuites, arranged along five 4 m corridors. Four transverse breaks connect the rows.':d.index>=16&&d.index<=18?'Ten shared commons occupy this upper zone, with openings through two gallery decks.':`${d.name}: space reserved for the next design pass. Equipment and occupancy are not yet sized.`;
  if(SHIP_AREAS.some(a=>a.deck===d.number))$('deck-description').textContent=(d.residential?'500 furnished cabins plus ':'')+SHIP_AREAS.filter(a=>a.deck===d.number).length+' fitted ship areas, including '+SHIP_AREAS.filter(a=>a.deck===d.number).map(a=>a.category).filter((c,i,list)=>list.indexOf(c)===i).join(' and ').toLowerCase()+'. Use Ship areas to inspect each space.';
  if(d.residential)$('deck-description').textContent+=' Forward: '+NOSE_COMMONS[d.number-6].name+'. Explore it under Neighborhood → Nose commons.';
    $('status').textContent=`Deck ${d.number} / 20 · ${d.name} · floor ${d.y>0?'+':''}${d.y} m`;
}
  function focusDetail(focus){document.querySelectorAll('[data-focus]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.focus===focus));
    noseScene.visible=focus==='nose'||focus==='all';
    if(noseScene.visible)noseView();
    ship.detail.root.visible=activeDistrict===10&&focus!=='nose';
    for(const [number,v] of districtViews)v.root.visible=number===activeDistrict&&focus!=='nose';
    setTitle(focus==='nose'?NOSE_COMMONS[activeDistrict-1].name:'A neighborhood aboard Leo.');
    residenceInside=false;viewLink({district:activeDistrict,space:focus});
    if(focus==='nose'){
      const v=noseView(),a=NOSE_COMMONS[activeDistrict-1];
      $('view-description').textContent='Deck '+a.deck+' · '+a.description;
      $('status').textContent='Neighborhood '+activeDistrict+' · nose commons · '+a.name;
      persp.fov=42;persp.near=.05;setCamera('persp',v.overview.position,v.overview.target);return;
    }
  $('view-description').textContent=focus==='garden'?'Garden commons · Decks 17–19 · Neighborhood '+activeDistrict:focus==='cabin'?'Twin cabin · Deck '+(activeDistrict+5)+' · Neighborhood '+activeDistrict:focus==='observation'?'Shared observation lounge · upper bow · floor +26.3 m':'500 furnished twin cabins on Deck '+(activeDistrict+5)+' and an upper garden commons.';
  if(activeDistrict!==10){
    if(focus==='observation'){activeDistrict=10;$('neighborhood-select').value=10;setMode('neighborhood');focusDetail('observation');return;}
    const v=districtView();v.residence.root.visible=focus!=='garden';v.garden.root.visible=focus==='all'||focus==='garden';
    v.residence.district.visible=focus==='all';
    if(focus==='all')setCamera('persp',[90,245,285],[30,10,0]);
    if(focus==='cabin'){const dy=(activeDistrict-10)*4;setCamera('persp',[SAMPLE.x+8,23+dy,-8],[SAMPLE.x,17.6+dy,5.2]);}
    if(focus==='garden')setCamera('persp',v.garden.overview.position,v.garden.overview.target);
    return;
  }
  ship.detail.district.visible=focus==='all';
  const views={all:[[90,245,285],[30,21,0]],cabin:[[SAMPLE.x+8,23,-8],[SAMPLE.x,17.6,5.2]],garden:[[174,58,77],[132,28,28]],observation:[[232,67,64],[190,28,0]]};
  setCamera('persp',...views[focus]);
}
function stopTour(){tourPlaying=false;clearTimeout(tourTimer);$('play-tour').textContent='Play route';}
function renderRouteDots(){
 $('route-dots').replaceChildren();routeStops().forEach((r,i)=>{const b=document.createElement('button');b.dataset.stop=i;b.setAttribute('aria-label',r.name);b.addEventListener('click',()=>{stopTour();goStop(i);});$('route-dots').appendChild(b);});
 $('tour-select').value=routeKey;
 $('tour-description').textContent=routeKey==='aft'?'Travel from Neighborhood 10 through enclosed engineering spaces to the fin crown bar. Deck and lift transfers use scene cuts.':'Follow a resident from a twin cabin through the garden to the forward observation lounge.';
}
function showTourSpace(r){
 if(tourResidence)tourResidence.visible=false;if(tourTransit)tourTransit.visible=false;
 ship.detail.root.visible=!r.section&&r.space!=='residential';aftScene.visible=Boolean(r.section);
 if(r.space==='residential'){
  if(!tourResidence){tourResidence=createResidentialDeck(10,ship.detail).root;scene.add(tourResidence);tourTransit=createTransit({minimumDeck:14,maximumDeck:16,coreIds:['aft']}).root;scene.add(tourTransit);}
  tourResidence.visible=true;tourTransit.visible=true;
 }
 if(r.section){aftSection=r.section;aftEye=true;showAft();if(r.also)aftModel.parts[r.also].visible=true;}
 else {stars.visible=routeKey==='home';mars.visible=routeKey==='home';scene.background.set(routeKey==='home'?0x0a1422:0xbac8cd);}
}
function goStop(index,duration=1400){const list=routeStops();stop=Math.max(0,Math.min(list.length-1,Number.isFinite(index)?index:0));const r=list[stop];
 if(mode==='walk')showTourSpace(r);viewLink({walk:1,tour:routeKey,stop});
 setCamera('persp',r.position,r.target,routeKey==='aft'?0:duration);
 setTitle(routeKey==='aft'?'From home to the fin crown.':'From cabin to the stars.');$('view-description').textContent=routeKey==='aft'?'A journey through the working ship.':'Follow a short route through Neighborhood 10.';
 $('status').textContent=routeKey==='aft'?'Residential / engineering / panorama':'Guided neighborhood route';
 $('route-name').textContent=r.name;$('route-detail').textContent=r.detail;$('stop-count').textContent=`${String(stop+1).padStart(2,'0')} / ${String(list.length).padStart(2,'0')}`;$('previous-stop').disabled=stop===0;$('next-stop').disabled=stop===list.length-1;document.querySelectorAll('[data-stop]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.stop)===stop));
}
function advanceTour(){if(!tourPlaying)return;if(stop===routeStops().length-1){stopTour();return;}goStop(stop+1,2800);tourTimer=setTimeout(advanceTour,6500);}
$('tour-select').addEventListener('change',async()=>{routeKey=$('tour-select').value;renderRouteDots();await setMode('walk');});

document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>viewCamera(b.dataset.camera)));
document.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>focusDetail(b.dataset.focus)));
$('dimensions').addEventListener('change',()=>dimensions.visible=$('dimensions').checked);
DECKS.forEach(d=>{const o=document.createElement('option');o.value=d.index;o.textContent=`${String(d.number).padStart(2,'0')} · ${d.name}`;o.selected=d.index===14;$('deck-select').appendChild(o);});
['deck-select','isolate','shell-context'].forEach(id=>$(id).addEventListener('change',updateDeck));
$('toggle-panels').addEventListener('click',()=>{const hidden=document.body.classList.toggle('panels-hidden');$('toggle-panels').textContent=hidden?'Show UI':'Hide UI';$('toggle-panels').setAttribute('aria-pressed',String(hidden));});
  $('enter-space').addEventListener('click',()=>{
    const focus=document.querySelector('[data-focus][aria-pressed="true"]')?.dataset.focus;
    if(focus==='nose'){
      const v=noseView();$('detail-walls').checked=true;v.shell.visible=true;persp.fov=65;persp.near=.05;
      setCamera('persp',v.inside.position,v.inside.target,0);residenceInside=true;
      viewLink({district:activeDistrict,space:'nose',eye:1});$('status').textContent=NOSE_COMMONS[activeDistrict-1].name+' · 1.7 m eye level';return;
    }
  if(activeDistrict!==10){
    const v=districtView(),garden=focus==='garden';focusDetail(garden?'garden':'cabin');
    $('detail-walls').checked=true;v.residence.walls.visible=true;v.residence.districtWalls.visible=true;v.garden.walls.visible=true;
    const pose=(garden?v.garden:v.residence).inside;persp.fov=65;persp.near=.05;setCamera('persp',pose.position,pose.target,0);
    residenceInside=true;viewLink({district:activeDistrict,space:garden?'garden':'cabin',eye:1});
    $('status').textContent='Neighborhood '+activeDistrict+' · '+(garden?'Garden commons':'Twin cabin')+' · 1.7 m eye level';return;
  }
  routeKey='home';renderRouteDots();setMode('walk');goStop(({cabin:0,garden:3,observation:5})[focus]??0,0);
});
$('detail-walls').addEventListener('change',()=>{const enclosed=$('detail-walls').checked;if(noseScene.visible)noseView().shell.visible=enclosed;ship.detail.walls.visible=enclosed;ship.detail.districtWalls.visible=enclosed;const v=districtView();if(v){v.residence.walls.visible=enclosed;v.residence.districtWalls.visible=enclosed;v.garden.walls.visible=enclosed;}});
renderRouteDots();
$('next-stop').addEventListener('click',()=>{stopTour();goStop(stop+1);});$('previous-stop').addEventListener('click',()=>{stopTour();goStop(stop-1);});$('restart-tour').addEventListener('click',()=>{stopTour();goStop(0);});
$('play-tour').addEventListener('click',()=>{if(tourPlaying){stopTour();return;}tourPlaying=true;$('play-tour').textContent='Pause';if(stop===routeStops().length-1)goStop(0);tourTimer=setTimeout(advanceTour,3000);});
renderer.domElement.addEventListener('pointerdown',e=>{if(mode!=='walk')return;stopTour();transition=null;lookDrag={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!lookDrag||mode!=='walk')return;const euler=new T.Euler().setFromQuaternion(camera.quaternion,'YXZ');euler.y-=(e.clientX-lookDrag.x)*.004;euler.x=T.MathUtils.clamp(euler.x-(e.clientY-lookDrag.y)*.004,-1.4,1.4);camera.quaternion.setFromEuler(euler);const dir=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion);controls.target.copy(camera.position).addScaledVector(dir,10);lookDrag={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',()=>lookDrag=null);
renderer.domElement.addEventListener('pointercancel',()=>lookDrag=null);
renderer.domElement.addEventListener('pointerdown',()=>{if(mode!=='walk')transition=null;});
// On phones, drop to 1x pixels while a finger is on the scene (or a pinch/scroll is under way) and sharpen 250 ms after.
if(touchScreen){let settle=0;const setRatio=r=>{if(renderer.getPixelRatio()!==r){renderer.setPixelRatio(r);resize();refreshShadows();}};
 const busy=()=>{clearTimeout(settle);setRatio(1);},idle=()=>{clearTimeout(settle);settle=setTimeout(()=>setRatio(baseRatio),250);};
 renderer.domElement.addEventListener('pointerdown',busy);renderer.domElement.addEventListener('wheel',()=>{busy();idle();},{passive:true});
 for(const type of ['pointerup','pointercancel'])renderer.domElement.addEventListener(type,idle);}
// Exterior and deck views show only the ship, which fits within 380 m of (-18, 41, 0) (bbox -300..264, -55..138, -150..150).
// Hugging it with near/far every frame instead of 1..6000 m multiplies depth precision, which phones need: with less
// depth precision than desktops, belly panels a few cm apart otherwise flicker as the ship is flipped.
const SHIP_CENTER=new T.Vector3(-18,41,0),SHIP_RADIUS=380;
function fitShipDepth(){const d=camera.position.distanceTo(SHIP_CENTER),near=Math.max(camera.isOrthographicCamera?.1:1,d-SHIP_RADIUS),far=d+SHIP_RADIUS;if(Math.abs(camera.near-near)>.5||Math.abs(camera.far-far)>.5){camera.near=near;camera.far=far;camera.updateProjectionMatrix();}}
function animate(now){requestAnimationFrame(animate);dressCosmo(now);tickShadows(now);const delta=Math.min(.05,Math.max(0,(now-(lastFrameTime||now))/1000));lastFrameTime=now;if(exporting)return;if(transition){const t=Math.min(1,(now-transition.start)/transition.duration),s=t*t*(3-2*t);camera.position.lerpVectors(transition.from,transition.to,s);controls.target.lerpVectors(transition.fromTarget,transition.toTarget,s);camera.lookAt(controls.target);if(t===1)transition=null;}if(mode!=='walk')controls.update(delta);if(mode==='exterior'||mode==='layout')fitShipDepth();if(thrusters){thrusters.root.visible=$('thruster-glow').checked&&((mode==='exterior'&&!$('shape-only').checked)||mode==='layout');thrusters.update(now/1000,!reduced);}spaceBackdrop.update(delta,$('speed-lines').checked&&!document.hidden,aftScreenFlow(camera,controls.target));const backdrop=scene.background,g=grid.visible,p=pad.visible;scene.background=spaceBackdrop.texture;grid.visible=false;pad.visible=false;renderer.render(scene,camera);scene.background=backdrop;grid.visible=g;pad.visible=p;}
$('save-render').addEventListener('click',async()=>{
  if(exporting)return;exporting=true;$('save-render').disabled=true;$('render-status').textContent='Rendering exterior…';
  const view=document.querySelector('[data-camera][aria-pressed="true"]').dataset.camera,shapeOnly=$('shape-only').checked;
  const width=3200,height=2000,oldRatio=renderer.getPixelRatio(),oldBackground=scene.background.clone();
  const visibility=[grid,pad,dimensions,ship.inside,ship.detail.root].map(o=>[o,o.visible]);
  try{
    visibility.forEach(([o])=>o.visible=false);scene.background.set(0x344554);renderer.setPixelRatio(1);renderer.setSize(width,height,false);
    let renderCamera;
    if(['perspective','concept','aft','bow','engine','windows','aftwindows','enginewindows'].includes(view)){
      renderCamera=new T.PerspectiveCamera(42,width/height,1,6000);
      renderCamera.position.set(...(view==='aft'?[-512,299,512]:[405,265,445]));renderCamera.lookAt(0,20,0);
      if(view==='concept'){renderCamera.position.set(340,455,650);renderCamera.lookAt(0,20,0);renderCamera.fov=37;renderCamera.updateProjectionMatrix();}
      if(view==='bow'){renderCamera.position.set(430,112,245);renderCamera.lookAt(211,14,0);renderCamera.far=500;renderCamera.updateProjectionMatrix();}
      if(view==='enginewindows'){renderCamera.position.set(-362,39,302);renderCamera.lookAt(-228,-9,79);}
      if(view==='aftwindows'){renderCamera.position.set(-300,150,340);renderCamera.lookAt(-206,55,0);}
      if(view==='windows'){renderCamera.position.set(0,32,195);renderCamera.lookAt(-10,13,65);}
      if(view==='engine'){renderCamera.position.set(-405,22,187);renderCamera.lookAt(-268,-16,122);renderCamera.far=330;renderCamera.updateProjectionMatrix();}
    }else{
      renderCamera=new T.OrthographicCamera(-330,330,206.25,-206.25,.1,6000);
      renderCamera.position.set(...(view==='top'?[0,1000,.01]:view==='side'?[0,25,1000]:[1000,25,0]));renderCamera.lookAt(0,25,0);
    }
    renderer.render(scene,renderCamera);
    const poster=document.createElement('canvas');poster.width=width;poster.height=height;const ctx=poster.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
    const cleanBranding=$('clean-branding').checked;ctx.textAlign=view==='engine'?'right':'left';
    if(!cleanBranding){ctx.fillStyle='#eef2f4';ctx.font='600 90px Segoe UI';ctx.fillText('LEO',view==='engine'?3100:100,150);ctx.font='24px Segoe UI';ctx.fillStyle='#b7c8d2';ctx.fillText('MARS CATS VOYAGE  /  EXTERIOR FINISH 35',view==='engine'?3100:104,198);}ctx.textAlign='left';
    ctx.strokeStyle='#8397a4';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(100,1840);ctx.lineTo(3100,1840);ctx.stroke();
    ctx.font='25px Segoe UI';ctx.fillStyle='#dbe4e9';ctx.fillText(`${view.toUpperCase()}  /  ${shapeOnly?'SHAPE STUDY':'MODEL RENDER'}`,100,1905);ctx.textAlign='right';ctx.fillText('564 m LENGTH   ·   300 m NOMINAL SPAN   ·   10,000 OCCUPANTS',3100,1905);
    const blob=await new Promise(resolve=>poster.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG encoder unavailable');
    const filename=`exterior-refined-${view}${shapeOnly?'-shape':''}.png`;
    if(location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname)){
      const response=await fetch(`/renders/${filename}`,{method:'PUT',headers:{'Content-Type':'image/png'},body:blob});if(!response.ok)throw new Error('Could not save PNG');
      if(view==='top'&&shapeOnly){
        scene.background=null;renderer.setClearColor(0,0);renderer.render(scene,renderCamera);
        const frame=Object.assign(document.createElement('canvas'),{width:renderer.domElement.width,height:renderer.domElement.height});frame.getContext('2d').drawImage(renderer.domElement,0,0);
        const overlay=await new Promise(resolve=>frame.toBlob(resolve,'image/png'));
        const saved=await fetch('/renders/exterior-top-overlay.png',{method:'PUT',headers:{'Content-Type':'image/png'},body:overlay});
        if(!saved.ok)throw new Error('Could not save transparent top overlay');
      }
      $('render-status').replaceChildren();const a=document.createElement('a');a.href=`renders/${filename}`;a.textContent='PNG saved — open image';a.style.color='#ebbd83';a.target='_blank';$('render-status').append(a);
    }else{
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);$('render-status').textContent='PNG exported';
    }
  }catch(e){$('render-status').textContent=`Export failed: ${e.message}`;}
  finally{scene.background=oldBackground;renderer.setClearColor(oldBackground,1);visibility.forEach(([o,v])=>o.visible=v);renderer.setPixelRatio(oldRatio);resize();exporting=false;$('save-render').disabled=false;}
});

$('save-interior').addEventListener('click',async()=>{
  if(exporting)return;exporting=true;$('save-interior').disabled=true;
  const ratio=renderer.getPixelRatio(),width=2400,height=1500;
  try{
    if(transition){camera.position.copy(transition.to);controls.target.copy(transition.toTarget);camera.lookAt(controls.target);transition=null;}
    const c=camera.clone();c.clearViewOffset();c.aspect=width/height;c.updateProjectionMatrix();
    renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.render(scene,c);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
    const focus=mode==='aft'?'aft-'+aftSection+'-'+(aftEye?'inside':'overview'):mode==='transit'?'transit-'+transitCore+'-d'+transitDeck+'-'+transitPose:mode==='areas'?'area-'+activeArea.id+'-'+areaView:mode==='walk'?(routeKey==='aft'?'journey-aft-':'walk-')+(stop+1):(document.querySelector('[data-focus][aria-pressed="true"]')?.dataset.focus||'all');
    ctx.fillStyle='#122b3ae6';ctx.fillRect(0,height-90,width,90);ctx.fillStyle='#eef0e7';ctx.font='32px Segoe UI';ctx.fillText($('clean-branding').checked?'LIFE ABOARD':'LEO / LIFE ABOARD',55,height-34);ctx.textAlign='right';ctx.font='24px Segoe UI';ctx.fillText(mode==='aft'?AFT_VIEWS[aftSection].name:mode==='transit'?transitCore.toUpperCase()+' CONNECTION / DECK '+transitDeck:mode==='areas'?activeArea.name+' / DECK '+activeArea.deck:mode==='walk'?routeStops()[stop].name:focus==='all'?'NEIGHBORHOOD '+activeDistrict+' / 1,000 RESIDENTS':focus.toUpperCase(),width-55,height-34);
    const blob=await new Promise(r=>canvas.toBlob(r,'image/png')),filename='interior-'+(mode==='neighborhood'?'n'+activeDistrict+'-':'')+focus+(mode==='neighborhood'&&residenceInside?'-inside':'')+'.png';
    if(location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname)){
      const res=await fetch('/renders/'+filename,{method:'PUT',headers:{'Content-Type':'image/png'},body:blob});if(!res.ok)throw new Error('Could not save image');
      $('interior-render-status').replaceChildren();const a=document.createElement('a');a.href='renders/'+filename;a.textContent='PNG saved — open image';a.target='_blank';a.style.color='#ebbd83';$('interior-render-status').append(a);
    }else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);$('interior-render-status').textContent='PNG exported';}
  }catch(e){$('interior-render-status').textContent=e.message;}finally{renderer.setPixelRatio(ratio);resize();exporting=false;$('save-interior').disabled=false;}
});

(async()=>{
 resize();const params=new URLSearchParams(location.search);let cleanBranding=params.get('clean')==='1';if(params.get('clean')===null){try{cleanBranding=localStorage.getItem('leo-clean-branding')==='1';}catch{}}$('clean-branding').checked=cleanBranding;applyBrandingView();routeKey=params.get('tour')==='aft'?'aft':'home';renderRouteDots();const initial=params.get('space'),areaId=params.get('area');
 const district=Number(params.get('district'));if(Number.isInteger(district)&&district>=1&&district<=10){activeDistrict=district;$('neighborhood-select').value=district;}
 const deck=Number(params.get('deck'));if(deck>=1&&deck<=20)$('deck-select').value=deck-1;
 if(params.has('transit')){transitCore=params.get('transit')==='aft'?'aft':'forward';transitDeck=deck>=1&&deck<=20?deck:17;transitPose=['inside','stairs'].includes(params.get('view'))?params.get('view'):'overview';}
 if(params.has('aft')){aftSection=AFT_VIEWS[params.get('aft')]?params.get('aft'):'overview';aftEye=params.get('view')==='inside';}
 await setMode(params.has('aft')?'aft':params.has('transit')?'transit':areaId?'areas':initial?'neighborhood':deck>=1&&deck<=20?'layout':params.get('walk')==='1'?'walk':'exterior');
 if(areaId)showArea(areaId,params.get('view')==='inside'?'inside':'overview');
 else if(initial)focusDetail(['cabin','garden','observation','nose','all'].includes(initial)?initial:'observation');
 else if(mode==='exterior'){const view=params.get('camera');viewCamera(['concept','perspective','top','side','front','aft','bow','engine','windows','aftwindows','enginewindows'].includes(view)?view:'top');}
 if(!areaId&&params.get('walk')==='1'){setMode('walk');goStop(params.has('stop')?Number(params.get('stop')):(({cabin:0,garden:3,observation:5})[initial]??0),0);}
 if(!areaId&&initial&&params.get('eye')==='1'&&(activeDistrict!==10||initial==='nose'))$('enter-space').click();
 $('loading').hidden=true;requestAnimationFrame(animate);
 // Tour and room deep links never load the exterior, so Cosmo cannot wait for it.
 setTimeout(loadCosmo,1500);
})().catch(e=>showError(e.message));
