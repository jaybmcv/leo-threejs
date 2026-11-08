import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {applyConceptShape} from './concept-shape.js';
import {applyConceptDetail} from './concept-detail.js';
import {applyConceptPaint} from './concept-paint.js';
import {loadEnvironment} from './environment.js';
import {STYLE,labUniforms,patchStyleMaterials} from './style-lab/surface.js';
import {createStyleFrame} from './style-lab/frame.js';

// A test preview, apart from the viewer: Leo's refined exterior drawn in three of Voyager's Reach's art styles beside
// its own look. ?style=original|toon|stylised|graphic|compare and ?view=hero|side|bow|aft pick the first frame.
const $=id=>document.getElementById(id);
const STYLES=[
 {id:'original',style:STYLE.original,name:'Leo today',blurb:'The viewer as it is: physically based light, reflections, ACES.'},
 {id:'toon',style:STYLE.toon,name:'Bold Ink Toon',blurb:'Sunny flat colour in two tones, drawn with strong ink lines.'},
 {id:'stylised',style:STYLE.stylised,name:'Stylised 3D',blurb:'A polished animated-film look: soft bounce light, saturated colour, rich shade.'},
 {id:'graphic',style:STYLE.graphic,name:'Graphic Novel',blurb:'Clean-line ligne claire: a few flat colours, one even ink line, hatching for shade.'},
];
// Eye and target, in ship lengths from the ship's centre (X forward, Y up, Z starboard).
const VIEWS={
 hero:{eye:[.6,.32,.8],target:[0,0,0]},
 side:{eye:[.02,.05,1.2],target:[0,0,0]},
 bow:{eye:[.82,.18,.46],target:[.28,-.03,0]},
 aft:{eye:[-.95,.5,-.75],target:[-.08,.02,0]},
};
const params=new URLSearchParams(location.search);
let current=STYLES.find(s=>s.id===params.get('style'))??STYLES[1],compare=params.get('style')==='compare',ready=false,dirty=true;

const renderer=new T.WebGLRenderer({antialias:false});
const PIXEL_RATIO=Math.min(devicePixelRatio,1.5);
// (the scene's target is cleared transparent: its alpha is the ship's coverage, which the frame lays over the sky)
renderer.setPixelRatio(PIXEL_RATIO);renderer.setClearAlpha(0);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
$('viewport').appendChild(renderer.domElement);
const frame=createStyleFrame(renderer);

// Leo's own light (viewer.js): a hemisphere, the key light that casts the shadow, a cool fill and a rim.
const scene=new T.Scene();scene.environmentIntensity=.4;
loadEnvironment(renderer).then(texture=>{scene.environment=texture;dirty=true;});
scene.add(new T.HemisphereLight(0xf3f4eb,0x657481,.7));
const key=new T.DirectionalLight(0xfff4dc,1.8);key.position.set(160,420,250);key.castShadow=true;key.shadow.mapSize.set(2048,2048);
Object.assign(key.shadow.camera,{left:-380,right:380,top:270,bottom:-270,near:1,far:1200});key.shadow.bias=-.0003;key.shadow.normalBias=.15;scene.add(key);
const fill=new T.DirectionalLight(0xd7ebff,.55);fill.position.set(-260,200,-180);scene.add(fill);
const rim=new T.DirectionalLight(0xffffff,.65);rim.position.set(200,60,-300);scene.add(rim);

const camera=new T.PerspectiveCamera(42,1,1,6000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=20;controls.maxDistance=2200;
controls.addEventListener('change',()=>{dirty=true;});
const centre=new T.Vector3();let length=564;

function setView(id){
 const v=VIEWS[id]??VIEWS.hero,at=a=>new T.Vector3(...a).multiplyScalar(length).add(centre);
 camera.position.copy(at(v.eye));controls.target.copy(at(v.target));controls.update();dirty=true;
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===id)));
}
function setStyle(id){
 compare=id==='compare';if(!compare)current=STYLES.find(s=>s.id===id)??current;
 document.querySelectorAll('[data-style]').forEach(b=>b.setAttribute('aria-pressed',String(compare?b.dataset.style==='compare':b.dataset.style===current.id)));
 $('blurb').textContent=compare?'All four, from the same camera.':current.blurb;
 document.body.classList.toggle('comparing',compare);dirty=true;
 const url=new URL(location.href);url.searchParams.set('style',id);history.replaceState(null,'',url);
}

async function loadShip(){
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const gltf=await loader.loadAsync('leo-exterior-refined.glb',e=>{if(e.total)$('loading').textContent=`Loading Leo… ${Math.round(e.loaded/e.total*100)}%`;});
 // The node names the concept passes look for (as the viewer names them).
 gltf.scene.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)o.name=gltf.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh&&a?.meshes!==undefined)o.name=o.parent.name;});
 const exterior=gltf.scene.getObjectByName('01_EXTERIOR_REFINED_V31');
 if(!exterior)throw new Error('the saved exterior is missing its root');
 $('loading').textContent='Shaping Leo…';await new Promise(r=>setTimeout(r,0));
 if(!exterior.userData.conceptBaked){applyConceptShape(exterior);applyConceptDetail(exterior);}
 applyConceptPaint(exterior);
 exterior.traverse(o=>{if(o.isMesh){const glazing=(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.name.startsWith('LEO_glass_'));o.castShadow=!glazing;o.receiveShadow=!glazing;}});
 const patched=patchStyleMaterials(exterior);
 scene.add(exterior);
 const box=new T.Box3().setFromObject(exterior);box.getCenter(centre);length=box.getSize(new T.Vector3()).x;
 renderer.shadowMap.needsUpdate=true;
 console.info(`Style lab: ${patched} materials patched; Leo is ${length.toFixed(0)} m long`);
}

function draw(){
 const css=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio(),hw=Math.floor(css.x/2),hh=Math.floor(css.y/2);
 // (every panel draws at one size, so the target is not reallocated between them; a right or top panel an odd pixel
 // wider is stretched by that pixel)
 const panels=compare?STYLES.map((s,i)=>({s,x:i%2*hw,y:i<2?hh:0,w:i%2?css.x-hw:hw,h:i<2?css.y-hh:hh,drawW:hw,drawH:hh})):[{s:current,x:0,y:0,w:css.x,h:css.y,drawW:css.x,drawH:css.y}];
 for(const p of panels){
  frame.setSize(Math.round(p.drawW*ratio),Math.round(p.drawH*ratio));
  camera.aspect=p.drawW/p.drawH;camera.updateProjectionMatrix();
  labUniforms.uLabStyle.value=p.s.style;labUniforms.uLabPx.value=p.drawH*ratio/720;
  // the toon filters the sun's shadow wider, so its one hard edge cuts a shape and not a smudge (toonLight.ts)
  key.shadow.radius=p.s.style===STYLE.toon?2.2:1;
  renderer.setRenderTarget(frame.target);renderer.render(scene,camera);
  frame.render(p.s.style,camera,p);
 }
}
function resize(){const r=$('viewport').getBoundingClientRect();renderer.setSize(r.width,r.height,false);dirty=true;}
new ResizeObserver(resize).observe($('viewport'));resize();
function loop(){requestAnimationFrame(loop);controls.update();if(!ready||!dirty)return;dirty=false;draw();}

document.querySelectorAll('[data-style]').forEach(b=>b.addEventListener('click',()=>setStyle(b.dataset.style)));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
addEventListener('keydown',e=>{const i='12345'.indexOf(e.key);if(i>=0&&!e.metaKey&&!e.ctrlKey)setStyle(i<4?STYLES[i].id:'compare');});
setStyle(compare?'compare':current.id);
// A still of the current style and view at exactly `width` x `height` pixels on any display, saved by the lab's server
// to output/style-lab/captures.
async function capture(name,width=1600,height=1000){
 if(!/^[a-z0-9-]+$/.test(name))throw new Error('a capture name is lower-case letters, digits and dashes');
 const before=renderer.getSize(new T.Vector2());renderer.setPixelRatio(1);renderer.setSize(width,height,false);
 let blob;
 try{draw();blob=await new Promise(r=>renderer.domElement.toBlob(r,'image/png'));}finally{renderer.setPixelRatio(PIXEL_RATIO);renderer.setSize(before.x,before.y,false);dirty=true;}
 const res=await fetch(`captures/${name}.png`,{method:'PUT',body:blob});
 if(!res.ok)throw new Error(`the capture was not saved (${res.status})`);
 return `output/style-lab/captures/${name}.png`;
}
// for checks from the console and for screenshots
globalThis.leoStyleLab={scene,camera,controls,renderer,setStyle,setView,capture};
loadShip().then(()=>{
 setView(params.get('view')??'hero');ready=true;$('loading').hidden=true;document.body.dataset.ready='1';loop();
}).catch(e=>{$('loading').textContent=`The ship could not be loaded: ${e.message}`;console.error(e);});
