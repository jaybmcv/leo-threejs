import * as T from 'three';
import {STYLE,labUniforms,patchStyleMaterials} from './surface.js';
import {createStyleFrame} from './frame.js';

// The style lab inside the walk: the same three Voyager's Reach styles on Leo's interiors, walked in the real walk.
// Nothing in the walk is changed. A debug build of the walk (scripts/style-lab-walk.mjs) publishes globalThis.__walk,
// and this wraps its renderer's clear and render: a frame that begins with a clear of the canvas is drawn into the
// style frame's target instead (the stars, the haze and the ship, as the walk draws them), and when the ship has been
// drawn the frame pass puts the styled picture on the canvas. "Leo today" leaves the walk drawing exactly as it does.
// ?style=original|toon|stylised|graphic picks the first style.

const STYLES=[['original','Leo today',STYLE.original],['toon','Bold Ink Toon',STYLE.toon],['stylised','Stylised 3D',STYLE.stylised],['graphic','Graphic Novel',STYLE.graphic]];
// A room is metres across, not the ship's half kilometre: the graphic hatching is cut closer. And a room is lit by its
// lamps and its mood as much as by the walk's soft key, so the toon cuts all of its light into bands (surface.js).
const INTERIOR_HATCH_M=.3;
// The walk's own light is a soft key (a 0.55 fill) over a bright hemisphere, where the exterior had a 1.8 sun: the toon
// needs less exposure to put a white wall at its warm white, and Stylised 3D a little more under its neutral curve.
const INTERIOR_EXPOSURE={[STYLE.toon]:1.45,[STYLE.stylised]:1.15};
// Rooms are built as the walker reaches them; new materials are looked for this often (frames).
const PATCH_EVERY=45;

export function installWalkStyles(walk){
 const {renderer,scene}=walk;
 const frame=createStyleFrame(renderer,{logDepth:renderer.capabilities.logarithmicDepthBuffer,ownSky:true,exposure:{...INTERIOR_EXPOSURE,[STYLE.original]:renderer.toneMappingExposure}});
 const clear=renderer.clear,render=renderer.render,size=new T.Vector2(),css=new T.Vector2();
 let style=STYLE.original,inFrame=false,frames=0,pendingCapture=null;
 renderer.clear=function(...args){
  const target=renderer.getRenderTarget();
  // (a frame left open by a draw that threw is begun again, not presented; a still of "Leo today" goes through the frame
  // too, which draws it with the walk's own curve and exposure)
  if((style!==STYLE.original||pendingCapture)&&(target===null||(inFrame&&target===frame.target))){
   if(frames++%PATCH_EVERY===0)patchStyleMaterials(scene,walk.walker?.holder);
   renderer.getDrawingBufferSize(size);frame.setSize(size.x,size.y);
   labUniforms.uLabPx.value=size.y/720;
   renderer.setRenderTarget(frame.target);inFrame=true;
  }
  return clear.apply(renderer,args);
 };
 renderer.render=function(drawn,camera){
  const out=render.call(renderer,drawn,camera);
  if(inFrame&&drawn===scene){
   inFrame=false;renderer.getSize(css);frame.render(style,camera,{x:0,y:0,w:css.x,h:css.y});
   // a still is taken in the task that drew it: the canvas keeps no drawing past it
   if(pendingCapture){const done=pendingCapture;pendingCapture=null;renderer.domElement.toBlob(done,'image/png');}
  }
  return out;
 };
 const buttons=mountChooser(id=>setStyle(id));
 function setStyle(id){
  const entry=STYLES.find(s=>s[0]===id)??STYLES[0];style=entry[2];
  labUniforms.uLabStyle.value=style;labUniforms.uLabHatchM.value=INTERIOR_HATCH_M;labUniforms.uLabLightBands.value=1;
  if(style!==STYLE.original)patchStyleMaterials(scene,walk.walker?.holder);
  buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.style===entry[0])));
  const url=new URL(location.href);url.searchParams.set('style',entry[0]);history.replaceState(history.state,'',url);
 }
 // The next frame the walk draws, as a PNG saved by the style lab's server to output/style-lab/captures.
 async function capture(name){
  if(!/^[a-z0-9-]+$/.test(name))throw new Error('a capture name is lower-case letters, digits and dashes');
  const blob=await new Promise(resolve=>{pendingCapture=resolve;});
  const res=await fetch(`/captures/${name}.png`,{method:'PUT',body:blob});
  if(!res.ok)throw new Error(`the capture was not saved (${res.status})`);
  return `output/style-lab/captures/${name}.png`;
 }
 setStyle(new URLSearchParams(location.search).get('style')??'toon');
 globalThis.leoWalkStyles={setStyle,capture,styles:STYLES.map(s=>s[0])};
 return globalThis.leoWalkStyles;
}

// A row of style buttons over the walk, top centre, under the walk's own top row of buttons.
function mountChooser(onPick){
 const bar=document.createElement('div');bar.setAttribute('role','group');bar.setAttribute('aria-label','Art style');
 bar.style.cssText='position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:2147483000;display:flex;gap:6px;padding:6px;border-radius:999px;background:rgba(5,5,7,.78);font:600 12px/1 system-ui,sans-serif';
 const buttons=STYLES.map(([id,name])=>{
  const b=document.createElement('button');b.type='button';b.dataset.style=id;b.textContent=name;
  b.style.cssText='font:inherit;color:#ecebe6;background:transparent;border:1px solid #2a2a33;border-radius:999px;padding:6px 11px;cursor:pointer';
  b.addEventListener('click',e=>{e.stopPropagation();onPick(id);b.blur();});bar.append(b);return b;
 });
 const sheet=document.createElement('style');sheet.textContent='[data-style][aria-pressed="true"]{background:#f85800!important;border-color:#f85800!important;color:#050507!important}';
 document.head.append(sheet);document.body.append(bar);
 return buttons;
}
