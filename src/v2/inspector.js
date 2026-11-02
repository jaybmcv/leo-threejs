import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {publicAsset,enablePublicDownloads} from './public-assets.js';
import {prepareInspectorModel} from './inspector-model.js';
import {viewerRoutes,sampleShot,tourWalkSpot} from './viewer-routes.js';
import {loadEnvironment} from '../environment.js';
import {createThrusterEffects} from '../thruster-effects.js';
import {createSpaceBackdrop} from '../space-backdrop.js';
import {installFeedback} from '../feedback/feedback.js';

const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
const lite=query.get('lite')==='1'||query.get('lite')!=='0'&&(window.LEO_LITE||matchMedia('(pointer:coarse)').matches);
document.body.classList.toggle('studio-tools',query.get('studio')==='1');
enablePublicDownloads();
const renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,lite?1:1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
$('viewport').append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color(0x03050a);
scene.add(new T.HemisphereLight(0xf3f4eb,0x657481,.7));
for(const [color,power,position] of [[0xfff4dc,1.8,[160,420,250]],[0xd7ebff,.55,[-260,200,-180]],[0xffffff,.65,[200,60,-300]]]){const l=new T.DirectionalLight(color,power);l.position.fromArray(position);scene.add(l);}
scene.environmentIntensity=.4;loadEnvironment(renderer).then(t=>scene.environment=t).catch(console.warn);
const camera=new T.PerspectiveCamera(42,1,.05,10000),controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.minDistance=1;controls.maxDistance=6000;
const amount={value:0},selectedDeck={value:0},models=new Map();
let layout,exterior,interior,thrusters,mode='exterior',operation=0,turntable=false,playing=false,shotIndex=0,tourTime=0,lastTime=0,explodeAnimation=null,lastCull=-1,room=null,viewBounds=null;
const names={exterior:'Exterior',layout:'Deck layout',areas:'Ship areas',neighborhood:'Neighborhood',aft:'Aft systems',transit:'Connections',walk:'Take the tour'};
const backdrop=createSpaceBackdrop(lite?{scale:.5,fps:30,pixels:true}:{});
scene.background=backdrop.texture;
let dimensionBox=null;
const loading=text=>{$('loading').hidden=!text;$('loading').textContent=text||'';};
const fail=e=>{loading('');$('error').hidden=false;$('error').textContent=e.message||String(e);};
const action=fn=>async(...args)=>{try{$('error').hidden=true;await fn(...args);}catch(e){fail(e);}};
function bounds(){return new T.Box3(new T.Vector3(-400,-120-210*amount.value,-420),new T.Vector3(300,amount.value?420:180,420));}
function fit(box,direction=[1,.35,1.2]){const sphere=box.getBoundingSphere(new T.Sphere());controls.enabled=true;camera.up.set(0,1,0);camera.fov=42;camera.updateProjectionMatrix();const half=Math.min(T.MathUtils.degToRad(21),Math.atan(Math.tan(T.MathUtils.degToRad(21))*camera.aspect));camera.position.copy(sphere.center).add(new T.Vector3(...direction).normalize().multiplyScalar(sphere.radius/Math.sin(half)*1.02));controls.target.copy(sphere.center);controls.update();}
function cameraPreset(name='boarding'){
  if(amount.value){fit(bounds(),[1,.9,1.3]);return;}
  const dirs={boarding:[1,.25,1.2],concept:[1,.5,1.2],perspective:[1,.7,1.35],side:[0,.1,1],front:[1,.1,0],aft:[-1,.15,0],top:[0,1,.001]};
  let box=new T.Box3().setFromObject(exterior.root),direction=dirs[name];
  if(!direction){const centers={bow:[215,10,0],windows:[-10,12,63],aftwindows:[-205,65,0],enginewindows:[-230,-8,120],engine:[-268,-16,122]};const center=new T.Vector3(...(centers[name]||[0,0,0]));box=new T.Box3(center.clone().addScalar(-45),center.clone().addScalar(45));direction=[1,.3,1.3];}
  fit(box,direction);camera.position.sub(controls.target).multiplyScalar(.74).add(controls.target);controls.update();if(name==='top'){camera.up.set(1,0,0);camera.lookAt(controls.target);}
  for(const b of document.querySelectorAll('[data-camera]'))b.setAttribute('aria-pressed',b.dataset.camera===name);
}
async function load(name){
  if(!models.has(name))models.set(name,(async()=>{
    const bytes=await publicAsset(name,p=>loading('Loading current ship… '+p+'%'));
    const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes,'');
    gltf.scene.traverse(o=>{const association=gltf.parser.associations.get(o);if(association?.nodes!==undefined)o.name=gltf.parser.json.nodes[association.nodes].name||o.name;});
    return gltf.scene;
  })().catch(e=>{models.delete(name);throw e;}));
  return models.get(name);
}
async function getInterior(){
  if(interior)return interior;
  const root=await load('leo-full-ship.glb');
  if(interior)return interior;
  const savedExterior=root.getObjectByName('01_EXTERIOR_REFINED_V31');savedExterior?.removeFromParent();
  loading('Preparing the updated decks and cabin parts…');await new Promise(r=>setTimeout(r,0));
  interior=prepareInspectorModel(root,layout,{amount,selectedDeck});scene.add(root);root.visible=false;
  return interior;
}
function cutaway(on){if(!interior)return;for(const r of interior.records)r.mesh.userData.inspectorCut=on&&r.ceiling;lastCull=-1;}
function cull(force=false){
  if(!interior?.root.visible)return;
  const distance=camera.position.distanceTo(controls.target),radius=mode==='walk'||room?0:Math.max(.15,distance/Math.max(1,renderer.domElement.clientHeight)*1.5);
  if(!force&&Math.abs(radius-lastCull)<.05)return;lastCull=radius;
  for(const r of interior.records){r.mesh.frustumCulled=amount.value===0;r.mesh.visible=r.baseVisible&&!r.mesh.userData.inspectorCut&&(r.mesh.isInstancedMesh||r.radius>=radius)&&(!viewBounds||r.box.intersectsBox(viewBounds))&&(!selectedDeck.value||r.attribute||Math.abs(r.motion[1]+1-selectedDeck.value)<.1);}
}
function updateLink(){const q=new URLSearchParams();if(query.get('studio')==='1')q.set('studio','1');if(query.get('review')==='1')q.set('review','1');if(lite)q.set('lite','1');q.set('view',mode);if(amount.value)q.set('explode',Math.round(amount.value*100));if(selectedDeck.value)q.set('deck',selectedDeck.value);if(room)q.set('area',room.id);history.replaceState(null,'','?'+q);}
function setAmount(value,reframe=true){
  amount.value=Math.max(0,Math.min(1,value));selectedDeck.value=0;room=null;
  if(interior){interior.root.visible=value>0;cutaway(value>0);}
  const percent=Math.round(amount.value*100),stage=value===0?'Assembled':value<.28?'Opening the hull':value<.67?'Lifting the decks':value<.70?'Twenty decks apart':value<1?'Separating rooms and cabins':'Rooms and cabins apart';
  $('explode-dial').setAttribute('aria-valuenow',percent);$('explode-dial').setAttribute('aria-valuetext',percent+'%, '+stage);$('explode-value').firstChild.textContent=percent;
  $('explode-fill').style.strokeDasharray=(179.07*amount.value).toFixed(2)+' 238.76';$('explode-knob').setAttribute('transform',`rotate(${-135+270*amount.value} 50 50)`);$('explode-stage').textContent=stage;$('explode-play').textContent=value>=.5?'Put Leo back together':'Explode Leo';
  for(const b of $('explode-stops').children)b.setAttribute('aria-pressed',Math.abs(+b.dataset.value-value)<.005);
  $('status').textContent=`Current ship · ${layout.stats.cabins.toLocaleString()} cabins · ${stage}`;
  if(reframe)cameraPreset();cull(true);updateLink();
}
async function explodeTo(value,animate=false){
  const token=++operation;if(value>0)await getInterior();if(token!==operation)return;
  loading('');if(animate){explodeAnimation={from:amount.value,to:value,start:performance.now()};fit(bounds(),[1,.9,1.3]);}else{explodeAnimation=null;setAmount(value);}
}
function clipBox(box){viewBounds=box;renderer.clippingPlanes=[new T.Plane(new T.Vector3(1,0,0),-box.min.x),new T.Plane(new T.Vector3(-1,0,0),box.max.x),new T.Plane(new T.Vector3(0,1,0),-box.min.y),new T.Plane(new T.Vector3(0,-1,0),box.max.y),new T.Plane(new T.Vector3(0,0,1),-box.min.z),new T.Plane(new T.Vector3(0,0,-1),box.max.z)];}
function roomBox(r){const xs=r.polygon.map(p=>p[0]),zs=r.polygon.map(p=>p[1]);return new T.Box3(new T.Vector3(Math.min(...xs)-.2,r.y-.2,Math.min(...zs)-.2),new T.Vector3(Math.max(...xs)+.2,r.y+r.height-.15,Math.max(...zs)+.2));}
function focusRoom(id,eye=false){
  const r=layout.byId.get(id);if(!r)return;room=r;selectedDeck.value=0;exterior.root.visible=false;interior.root.visible=true;cutaway(!eye&& !$('detail-walls')?.checked);const box=roomBox(r);clipBox(box);fit(box,[1,1,1.2]);
  if(eye){const center=box.getCenter(new T.Vector3());camera.position.set(center.x,box.min.y+1.9,box.max.z-1);controls.target.set(center.x,box.min.y+1.9,box.min.z);controls.update();}
  const label=r.name||r.type+' cabin '+r.id;
  $('area-select').value=r.id;$('area-deck').textContent=r.deck;$('area-description').textContent=label+' · current furnished model';$('status').textContent=label+' · Deck '+r.deck;
  const p=r.door?.center||[box.getCenter(new T.Vector3()).x,r.y,box.getCenter(new T.Vector3()).z];$('enter-space').href='walk.html?lv=2&at='+p.join(',')+'&view=first';cull(true);updateLink();
}
function showDeck(number=+$('deck-select').value){
  room=null;amount.value=0;const d=layout.decks.find(d=>d.number===number);selectedDeck.value=$('isolate').checked?number:0;viewBounds=null;renderer.clippingPlanes=[];interior.root.visible=true;exterior.root.visible=$('shell-context').checked;
  if(selectedDeck.value)clipBox(new T.Box3(new T.Vector3(-600,d.y-.3,-400),new T.Vector3(600,d.y+3.65,400)));
  cutaway(true);const xs=d.slab.outline.map(p=>p[0]),zs=d.slab.outline.map(p=>p[1]);fit(new T.Box3(new T.Vector3(Math.min(...xs),d.y,Math.min(...zs)),new T.Vector3(Math.max(...xs),d.y+4,Math.max(...zs))),[.1,1,.7]);
  const cabins=layout.cabins.filter(c=>c.deck===number);$('deck-cabins').textContent=cabins.length.toLocaleString();$('deck-berths').textContent=cabins.reduce((s,c)=>s+c.berths,0).toLocaleString();$('deck-description').textContent=d.name+' · '+layout.rooms.filter(r=>r.deck===number).length+' room areas';$('status').textContent='Deck '+number+' · '+d.name+' · current furnished model';cull(true);updateLink();
}
function showAft(){room=null;selectedDeck.value=0;interior.root.visible=true;exterior.root.visible=$('aft-shell').checked;cutaway(true);const key=$('aft-section').value,box=key==='crown'?new T.Box3(new T.Vector3(-360,80,-140),new T.Vector3(-100,180,140)):key==='pods'?new T.Box3(new T.Vector3(-380,-70,-220),new T.Vector3(-140,50,220)):new T.Box3(new T.Vector3(-380,-70,-220),new T.Vector3(-100,180,220));clipBox(box);fit(box,[-1,.6,1.3]);$('status').textContent='Aft systems · current model';cull(true);}
function showTransit(){room=null;selectedDeck.value=0;exterior.root.visible=false;interior.root.visible=true;cutaway(true);const d=layout.decks[+$('transit-deck').value-1],x=$('transit-core').value==='forward'?132:-132,box=new T.Box3(new T.Vector3(x-16,d.y-.2,-20),new T.Vector3(x+16,d.y+7.8,20));clipBox(box);fit(box);$('status').textContent='Lift and stair connections · Deck '+d.number;cull(true);}
let routes;
function showShot(){const route=routes[$('tour-select').value],shot=route.shots[shotIndex];room=layout.byId.get(shot.room)||null;amount.value=0;selectedDeck.value=0;renderer.clippingPlanes=[];interior.root.visible=true;exterior.root.visible=false;cutaway(false);controls.enabled=false;camera.fov=65;camera.updateProjectionMatrix();tourTime=0;poseShot(0);$('route-name').textContent=shot.label;$('stop-count').textContent=`${shotIndex+1} / ${route.shots.length}`;$('route-detail').textContent=shot.label+' · Deck '+shot.deck;$('status').textContent='Current furnished ship · guided camera tour';const spot=tourWalkSpot(layout,shot);$('tour-walk').href='walk.html?lv=2&at='+spot.at.join(',')+'&yaw='+spot.yaw+'&view=first';cull(true);}
function poseShot(t){const shot=routes[$('tour-select').value].shots[shotIndex],pose=sampleShot(shot,t);camera.position.fromArray(pose.position);camera.lookAt(new T.Vector3(...pose.target));}
async function setMode(next){
  const token=++operation;explodeAnimation=null;playing=false;turntable=false;if(next!=='exterior')await getInterior();if(token!==operation)return;
  mode=next;room=null;viewBounds=null;amount.value=0;selectedDeck.value=0;renderer.clippingPlanes=[];controls.enabled=true;
  if(interior)interior.root.visible=false;exterior.root.visible=next==='exterior';document.body.dataset.mode=mode;
  for(const key of Object.keys(names))$(key+'-controls').hidden=key!==mode;
  for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',b.dataset.mode===mode);
  $('m-view-label').textContent=names[mode];$('panel-title').textContent=names[mode];$('eyebrow').textContent='LEO / CURRENT MODEL';$('view-title').textContent=mode==='exterior'?'A home between planets.':names[mode];$('view-description').textContent=`${layout.stats.cabins.toLocaleString()} cabins · ${layout.stats.berths.toLocaleString()} berths · ${layout.stats.decks} decks`;$('route').hidden=mode!=='walk';
  if(next==='exterior'){setAmount(0,false);cameraPreset();}else if(next==='layout')showDeck();else if(next==='areas')focusRoom($('area-select').value);else if(next==='neighborhood')focusNeighborhood();else if(next==='aft')showAft();else if(next==='transit')showTransit();else showShot();
  $('save-interior').hidden=mode==='exterior';
  loading('');updateLink();await renderer.compileAsync(scene,camera);renderer.render(scene,camera);document.body.dataset.ready='1';
}
function focusNeighborhood(kind='all'){const number=+$('neighborhood-select').value,deck=number+5;if(kind==='garden')focusRoom('commons-'+number);else if(kind==='observation')focusRoom('observation-lounge');else if(kind==='nose')focusRoom('neighborhood-'+number+'-dining');else if(kind==='cabin')focusRoom(layout.cabins.find(c=>c.deck===deck).id);else{$('deck-select').value=deck;showDeck(deck);}const cs=layout.cabins.filter(c=>c.deck===deck);$('neighborhood-cabins').textContent=cs.length;$('neighborhood-berths').textContent=cs.reduce((s,c)=>s+c.berths,0);}
async function savePicture(){renderer.render(scene,camera);const blob=await new Promise(r=>renderer.domElement.toBlob(r,'image/png'));const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='leo-current-model.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function resize(){const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.setViewOffset(r.width,r.height,r.width>1000?110:0,0,r.width,r.height);camera.updateProjectionMatrix();backdrop.resize(camera.aspect);}
new ResizeObserver(resize).observe($('viewport'));resize();
renderer.domElement.addEventListener('webglcontextlost',()=>fail(Error('Graphics memory exhausted. Reload with ?lite=1.')));
renderer.domElement.addEventListener('webglcontextrestored',()=>{$('error').hidden=true;});
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=action(()=>setMode(b.dataset.mode));
for(const b of document.querySelectorAll('[data-camera]'))b.onclick=()=>{turntable=false;cameraPreset(b.dataset.camera);};
for(const [name,value] of [['Ship',0],['Hull',.28],['Decks',.67],['Rooms',1]]){const b=document.createElement('button');b.textContent=name;b.dataset.value=value;b.onclick=action(()=>explodeTo(value));$('explode-stops').append(b);}
$('explode-play').onclick=action(()=>explodeTo(amount.value>=.5?0:1,true));
const dial=$('explode-dial');dial.onkeydown=action(async e=>{const step=e.shiftKey?.1:.02;let v=amount.value;if(['ArrowUp','ArrowRight'].includes(e.key))v+=step;else if(['ArrowDown','ArrowLeft'].includes(e.key))v-=step;else if(e.key==='Home')v=0;else if(e.key==='End')v=1;else return;e.preventDefault();await explodeTo(v);});
let dragging=false;const dialValue=e=>{const b=dial.getBoundingClientRect(),angle=Math.atan2(e.clientX-b.left-b.width/2,-(e.clientY-b.top-b.height/2))*180/Math.PI;return T.MathUtils.clamp((angle+135)/270,0,1);};
dial.onpointerdown=action(async e=>{dial.setPointerCapture(e.pointerId);dragging=true;await explodeTo(dialValue(e));});dial.onpointermove=e=>{if(dragging&&interior){explodeAnimation=null;setAmount(dialValue(e));}};dial.onpointerup=dial.onpointercancel=()=>dragging=false;
for(const id of ['deck-select','isolate','shell-context'])$(id).onchange=showDeck.bind(null,undefined);
$('area-select').onchange=()=>focusRoom($('area-select').value);for(const b of document.querySelectorAll('[data-area-view]'))b.onclick=()=>focusRoom($('area-select').value,b.dataset.areaView==='inside');
$('locate-area').onclick=action(async()=>{const deck=room.deck;$('deck-select').value=deck;await setMode('layout');});
$('neighborhood-select').onchange=()=>focusNeighborhood();for(const b of document.querySelectorAll('[data-focus]'))b.onclick=()=>focusNeighborhood(b.dataset.focus);$('detail-walls').onchange=()=>{cutaway(!$('detail-walls').checked);cull(true);};
for(const id of ['aft-section','aft-shell'])$(id).onchange=showAft;for(const id of ['transit-core','transit-deck'])$(id).onchange=showTransit;
$('tour-select').onchange=()=>{shotIndex=0;showShot();};$('restart-tour').onclick=()=>{shotIndex=0;showShot();};$('play-tour').onclick=()=>{playing=!playing;$('play-tour').textContent=playing?'Pause route':'Play route';};
function stepTour(n){shotIndex=(shotIndex+n+routes[$('tour-select').value].shots.length)%routes[$('tour-select').value].shots.length;showShot();}
$('next-stop').onclick=()=>stepTour(1);$('previous-stop').onclick=()=>stepTour(-1);
$('turntable').onclick=()=>{turntable=!turntable;$('turntable').textContent=turntable?'Stop turntable':'Start turntable';};controls.addEventListener('start',()=>turntable=false);
for(const id of ['save-render','save-interior'])$(id).onclick=action(savePicture);
$('toggle-panels').onclick=()=>document.body.classList.toggle('panels-hidden');$('m-handle').onclick=()=>{const open=document.querySelector('.panel').classList.toggle('open');$('m-handle').setAttribute('aria-expanded',open);};
$('m-view').onclick=()=>{$('m-menu').hidden=!$('m-menu').hidden;};for(const [key,name]of Object.entries(names)){const b=document.createElement('button');b.textContent=name;b.onclick=action(async()=>{$('m-menu').hidden=true;await setMode(key);});$('m-menu').append(b);}$('m-tour').onclick=action(()=>setMode('walk'));
$('clean-branding').onchange=()=>{for(const r of exterior.records)if(/wordmark|Mission_identifier|Mission_brand|Crest_|Tail_registry|authentic_Mars_Cats/i.test(r.mesh.name))r.mesh.visible=!$('clean-branding').checked;};
$('dimensions').onchange=()=>{if(!dimensionBox&&exterior){dimensionBox=new T.Box3Helper(new T.Box3().setFromObject(exterior.root),0xf85800);scene.add(dimensionBox);}if(dimensionBox)dimensionBox.visible=$('dimensions').checked;};
installFeedback({renderer,page:'viewer',mount:()=>document.querySelector('.foot-links'),context:()=>({where:$('status').textContent,link:location.href})});
async function start(){
  layout=await(await fetch(window.LEO_VIEWER_LAYOUT)).json();layout.byId=new Map([...layout.rooms,...layout.cabins,...layout.shuttles].map(r=>[r.id,r]));routes=viewerRoutes(layout);
  for(const d of layout.decks){$('deck-select').add(new Option(d.number+' · '+d.name,d.number));$('transit-deck').add(new Option(d.number+' · '+d.name,d.number));}
  for(const r of [...layout.rooms].sort((a,b)=>a.deck-b.deck||a.name.localeCompare(b.name)))$('area-select').add(new Option('D'+r.deck+' · '+r.name,r.id));$('area-count').textContent=layout.rooms.length;$('area-select').value='d02-arrival-1';
  for(let n=1;n<=10;n++)$('neighborhood-select').add(new Option('Neighborhood '+n+' · Deck '+(n+5),n));
  $('deck-select').value=query.get('deck')||6;$('transit-deck').value=6;
  const root=await load(lite?'leo-exterior-phone.glb':'leo-exterior-web.glb');exterior=prepareInspectorModel(root,layout,{exterior:true,amount});scene.add(root);thrusters=createThrusterEffects(root);scene.add(thrusters.root);
  if(query.get('area')&&layout.byId.has(query.get('area')))$('area-select').value=query.get('area');
  await setMode(names[query.get('view')]?query.get('view'):'exterior');if(query.has('explode'))await explodeTo(Math.min(100,+query.get('explode'))/100);loading('');
  if(query.get('review')==='1')window.__leoInspector={get stats(){return layout.stats;},get amount(){return amount.value;},get modelHash(){return window.LEO_PUBLIC_ASSETS['leo-full-ship.glb'].sha256;},get exteriorHash(){return window.LEO_PUBLIC_ASSETS['leo-exterior-web.glb'].sha256;},get draw(){return {...renderer.info.render};},get interiorRecords(){return interior?.records.length||0;},get ownerBatches(){return interior?.records.filter(r=>r.attribute).length||0;}};
}
start().catch(fail);
renderer.setAnimationLoop(now=>{
  const dt=Math.min(.1,(now-(lastTime||now))/1000);lastTime=now;
  if(explodeAnimation){const a=explodeAnimation,t=Math.min(1,(now-a.start)/3500);setAmount(T.MathUtils.lerp(a.from,a.to,t*t*(3-2*t)),false);if(t===1){explodeAnimation=null;cameraPreset();}}
  if(playing&&mode==='walk'){const shot=routes[$('tour-select').value].shots[shotIndex];tourTime+=dt;if(tourTime>=shot.duration)stepTour(1);else poseShot(tourTime/shot.duration);}
  else{controls.autoRotate=turntable;controls.autoRotateSpeed=.5;controls.update();}
  if(thrusters){thrusters.root.visible=mode==='exterior'&&amount.value===0&&$('thruster-glow').checked;thrusters.update?.(now/1000);}
  if(dimensionBox)dimensionBox.visible=mode==='exterior'&&amount.value===0&&$('dimensions').checked;
  backdrop.update(dt,$('speed-lines').checked);
  cull();renderer.render(scene,camera);
});
