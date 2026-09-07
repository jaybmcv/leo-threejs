import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createShuttle } from './model.js';

const $ = id => document.getElementById(id);
let messageTimer;
function message(text, persistent = false) {
  clearTimeout(messageTimer); $('message').textContent = text; $('message').hidden = false;
  if (!persistent) messageTimer = setTimeout(() => $('message').hidden = true, 3500);
}
window.addEventListener('error', e => { $('loading').hidden = true; message(e.message, true); });
window.addEventListener('unhandledrejection', e => message(String(e.reason), true));
const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setClearColor(0, 0);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = .88;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
$('viewport').appendChild(renderer.domElement);
const scene = new T.Scene();
const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
const environment = pmrem.fromScene(room, .04);
scene.environment = environment.texture; scene.environmentIntensity = .4;
room.dispose(); pmrem.dispose();
scene.add(new T.HemisphereLight(0xeaf1ff, 0x1b2537, .8));
for (const [color, intensity, position] of [[0xfff4e4, 1.8, [150, 500, 300]], [0xa6c4f5, .8, [-200, 160, -450]], [0xffffff, .45, [350, 60, -200]]]) {
  const light = new T.DirectionalLight(color, intensity); light.position.set(...position); scene.add(light);
  if(intensity===1.8) {
    light.castShadow=true;light.shadow.mapSize.set(4096,4096);
    Object.assign(light.shadow.camera,{left:-360,right:360,top:265,bottom:-265,near:1,far:1200});
    light.shadow.bias=-.0002;light.shadow.normalBias=1.2;
  }
}
async function startViewer() {
// The local server loads the validated export directly, avoiding a lengthy
// procedural rebuild on each refresh. Direct-file use retains the offline path.
$('loading').textContent='Loading LEO…';
const ship = location.protocol==='file:' ? createShuttle() : (await new GLTFLoader().loadAsync('./leo-shuttle.glb')).scene;
ship.traverse(object=>{
  if(!object.isMesh)return;
  const major=/^(Smooth_pressure_envelope_|Tail_attachment_shell_|Sculpted_nacelle_shell|Blended_double_delta|Wing_thermal_edge|Swept_cat_tail|Swept_tail_cap|Tail_root_dorsal_fairing|Contoured_aft_pressure_frame|Nacelle_exhaust_bulkhead)/.test(object.name);
  object.castShadow=major;object.receiveShadow=major||/panel|cover|hatch/i.test(object.name);
});
scene.add(ship);renderer.shadowMap.needsUpdate=true;
const camera = new T.OrthographicCamera(-450,450,260,-260,1,6000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = .08;
controls.minZoom = .45; controls.maxZoom = 7;
controls.autoRotateSpeed = .45; controls.enablePan = true;
const views = {
  perspective: { position: [440, 325, 740], up: [0,1,0], label:'01 / PERSPECTIVE' },
  top: { position: [0,1100,0], up: [0,0,-1], label:'02 / TOP PLAN' },
  side: { position: [0,25,1100], up: [0,1,0], label:'03 / SIDE ELEVATION' },
  front: { position: [1100,25,0], up: [0,1,0], label:'04 / FRONT ELEVATION' },
  aft: { position: [-700,260,550], up: [0,1,0], label:'05 / AFT QUARTER' },
  bridge: { position: [650,220,500],target:[202,15,0],zoom:2.8,up:[0,1,0],label:'06 / COCKPIT DETAIL' },
  engine: { position: [-520,120,300],target:[-264,-7,125],zoom:3.2,up:[0,1,0],label:'07 / ENGINE DETAIL' },
  tail: { position: [100,215,490],target:[-175,42,0],zoom:1.8,up:[0,1,0],label:'08 / TAIL FAIRING' },
};
let currentView = 'perspective';
function setView(name) {
  currentView = name; const view = views[name];
  controls.autoRotate = false; $('spin').setAttribute('aria-pressed','false');
  camera.up.set(...view.up); camera.position.set(...view.position); camera.zoom = view.zoom||1;
  controls.target.set(...(view.target||[0,25,0])); camera.lookAt(controls.target); controls.update(); resize();
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  $('view-label').textContent = view.label;
}
function resize() {
  const width = innerWidth, height = innerHeight, aspect = width / height;
  const halfHeight = Math.max(255, 365 / aspect) * (width < 760 ? 1.1 : 1);
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
  camera.top = halfHeight; camera.bottom = -halfHeight;
  camera.updateProjectionMatrix(); renderer.setSize(width, height);
}
window.addEventListener('resize', resize);
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
$('spin').addEventListener('click', () => {
  if (currentView !== 'perspective' && currentView !== 'aft') setView('perspective');
  controls.autoRotate = !controls.autoRotate; $('spin').setAttribute('aria-pressed',String(controls.autoRotate));
});
const materials = new Set();
ship.traverse(o => { if(o.isMesh) for(const m of Array.isArray(o.material)?o.material:[o.material]) materials.add(m); });
$('wire').addEventListener('click', () => {
  const enabled = $('wire').getAttribute('aria-pressed') !== 'true';
  $('wire').setAttribute('aria-pressed',String(enabled));
  for(const m of materials) m.wireframe = enabled;
});
$('reference').addEventListener('click', () => $('reference-dialog').showModal());
$('close-reference').addEventListener('click', () => $('reference-dialog').close());
$('reference-dialog').addEventListener('click', e => { if(e.target === $('reference-dialog')) $('reference-dialog').close(); });
$('capture').addEventListener('click', () => {
  renderer.render(scene,camera);
  const canvas = document.createElement('canvas'); canvas.width = renderer.domElement.width; canvas.height = renderer.domElement.height;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#414d5e'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(renderer.domElement,0,0);
  canvas.toBlob(blob => {
    if(!blob) {message('Unable to save this image.');return;}
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `leo-${currentView}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url),10000); message('Image saved.');
  },'image/png');
});
renderer.domElement.addEventListener('webglcontextlost', e => {e.preventDefault();message('Graphics context lost. Reload the viewer to restore it.',true);});
setView('perspective'); $('loading').hidden = true;
let previous = performance.now();
renderer.setAnimationLoop(now => { const delta = Math.min((now-previous)/1000,.1); previous=now; controls.update(delta); renderer.render(scene,camera); });
}
startViewer().catch(error=>{$('loading').hidden=true;message(`Unable to load the model: ${error.message}`,true);});
