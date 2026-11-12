import {keepsGeometry} from '../v2/shader-hooks.js';
import * as T from 'three';
import {STYL_SURFACE_GLSL,STYL_GRADE_GLSL,STYL_INDIRECT_SAT,STYL_METAL_PAINT_GLSL,THREE_DIFFUSE} from './film-shading.js';
import {getLook,subscribeLook} from './look.js';

// The film look (look.js): Voyager's Reach's Stylised 3D drawn by the walk's own materials, with no pass of its own.
// A lit surface takes Stylised 3D's light (film-shading.js); every tone-mapped surface takes its grade just before the
// tone curve, which turns neutral. Cosmo keeps the shading he was drawn with and is graded with the rest.
// On today's look nothing changes: a material is only wrapped once film is first chosen, and a wrapped material builds
// exactly today's program while the look is today's.

// Stylised 3D's neutral curve, at the style lab's exposure for Leo's interiors (src/style-lab/walk-styles.js).
const FILM_TONE=T.NeutralToneMapping,FILM_EXPOSURE=1.15;
// Texture grain: Stylised 3D reads a texture's broad colour three mips down; a normal map bends the light less.
const BROAD_MIP=3,BROAD_SHARE=.8,NORMAL_EASE=.65;
// New materials are looked for every frame while programs are still being built (the ship arriving, a room built as
// the walker reaches it), so they are wrapped before they are first drawn, and every SCAN_EVERY frames once settled.
const SETTLE_FRAMES=120,SCAN_EVERY=30;
// (Phong has no Stylised 3D light here, so it takes the grade alone, as an unlit surface does)
const isLit=m=>m.isMeshStandardMaterial||m.isMeshLambertMaterial;
// A texture's grain is softened only where it is grain: a tiling texture on an opaque surface. A sign, a label, a
// painting or a decal keeps its texture sharp.
const isGrain=m=>{const map=m.map;return !!map&&!map.isCanvasTexture&&map.wrapS===T.RepeatWrapping&&!m.transparent&&!(m.alphaTest>0);};
// The level a material takes, or null: an additive glow keeps its own colour (the grade's toe would tint its black).
const levelOf=(m,kept)=>m.blending===T.AdditiveBlending?null:kept.has(m)||m.isMeshBasicMaterial||m.isMeshPhongMaterial?'grade':isLit(m)?(isGrain(m)?'lit':'lit-sharp'):null;

// A line of three's text, swapped; a three without it draws film without that term and says so once.
const warned=new Set();
function swap(text,from,to,label){
 if(text.includes(from))return text.replace(from,to);
 if(!warned.has(label)){warned.add(label);console.warn(`Film look: three's ${label} has changed; drawn without it.`);}
 return text;
}
const DIRECT=(albedo,paint)=>`{
    float stylNL = dot( geometryNormal, directLight.direction );
    vec3 stylAlb = stylLift( stylTerminator( ${albedo}${paint?' + '+paint:''}, stylNL ), STYL_ALB_FLOOR );
    reflectedLight.directDiffuse += directLight.color * stylWrapNL( stylNL ) * BRDF_Lambert( stylAlb );
  }`;
const INDIRECT=(albedo,paint)=>`vec3 stylAlbI = stylLift( stylSat( ${albedo}${paint?' + '+paint:''}, ${STYL_INDIRECT_SAT.toFixed(2)} ), STYL_ALB_FLOOR );`;
let chunks=null;
const filmChunks=()=>chunks??=(()=>{
 const C=T.ShaderChunk,D=THREE_DIFFUSE,paint=STYL_METAL_PAINT_GLSL;
 const physical=swap(swap(C.lights_physical_pars_fragment,D.physicalDirect,DIRECT('material.diffuseContribution',paint),'physical direct diffuse'),
  D.physicalIndirect,`${INDIRECT('material.diffuseContribution',paint)}\n\tvec3 diffuse = irradiance * BRDF_Lambert( stylAlbI );`,'physical indirect diffuse');
 const lambert=swap(swap(C.lights_lambert_pars_fragment,D.lambertDirect,DIRECT('material.diffuseColor'),'lambert direct diffuse'),
  D.lambertIndirect,`${INDIRECT('material.diffuseColor')}\n\treflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( stylAlbI );`,'lambert indirect diffuse');
 const map=swap(C.map_fragment,D.map,`sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, texture2D( map, vMapUv, ${BROAD_MIP.toFixed(1)} ).rgb, ${BROAD_SHARE.toFixed(2)} );
	${D.map}`,'map read');
 return {physical,lambert,map};
})();
const NORMAL_EASED=`
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_NORMALMAP_OBJECTSPACE ) || defined( USE_BUMPMAP )
  normal = normalize( mix( normal, nonPerturbedNormal, ${NORMAL_EASE.toFixed(2)} ) );
#endif`;
// (graded only where three tone-maps, so a screen drawn as it is, or a picture drawn into a target, stays as it is)
const GRADE=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = stylGrade( gl_FragColor.rgb, gl_FragCoord.xy * uFilmTexel );
#endif
#include <tonemapping_fragment>`;

// The line film adds to every shader it patches.
const TEXEL='uniform vec2 uFilmTexel;';
// `level` 'lit': Stylised 3D's light, its softened grain and the grade; 'lit-sharp': the same with the texture kept
// sharp; 'grade': the grade alone.
function patchShader(shader,level){
 // (once a shader: a material copied with the hooks of a wrapped one that another hook has wrapped since, as corner
 // shading wraps film's, holds film twice; the first film hook to run, the source's, patches it)
 if(shader.fragmentShader.includes(TEXEL))return;
 const lit=level!=='grade';
 let f=shader.fragmentShader
  .replace('#include <common>',`#include <common>\n${TEXEL}${lit?'\n'+STYL_SURFACE_GLSL:''}${STYL_GRADE_GLSL}`)
  .replace('#include <tonemapping_fragment>',GRADE);
 if(lit){
  const c=filmChunks();
  f=f.replace('#include <lights_physical_pars_fragment>',c.physical).replace('#include <lights_lambert_pars_fragment>',c.lambert)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>${NORMAL_EASED}`);
  if(level==='lit')f=f.replace('#include <map_fragment>',c.map);
 }
 shader.fragmentShader=f;
}

// `keep`: returns the object whose materials keep their own shading (the walker's cat), or null before it exists.
export function installFilmLook({renderer,scene,keep=()=>null}){
 const today={toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure};
 const texel={value:new T.Vector2(1,1)},size=new T.Vector2(),looked=new WeakSet(),wrapped=new Set();
 let film=false,lastPrograms=-1,settled=0;
 function wrap(material,level){
  // (a material copied with its hooks from one already wrapped, as the low-deck batches are, is wrapped already)
  if(material.onBeforeCompile.filmLook){wrapped.add(new WeakRef(material));material.needsUpdate=true;return;}
  const before=material.onBeforeCompile,key=material.customProgramCacheKey;
  const own=Object.hasOwn(material,'customProgramCacheKey')&&key!==T.Material.prototype.customProgramCacheKey?key:null;
  // today's key, as three makes it for the material unwrapped: a key of its own reads the material's hook as it was
  // (corner shading's builds on three's, which is the hook's text), so today's programs are found again after film
  const unwrapped=own&&Object.create(material,{onBeforeCompile:{value:before}});
  const todayKey=own?()=>own.call(unwrapped):()=>before.toString();
  // (every program carries the texel size: three keeps the uniforms of the program it first built for a material, so
  // a film program found again in its cache would otherwise draw with today's)
  const hook=function(shader,r){before.call(this,shader,r);shader.uniforms.uFilmTexel=texel;if(film)patchShader(shader,level);};
  hook.filmLook=true;hook.keepsGeometry=keepsGeometry(before);material.onBeforeCompile=hook;
  material.customProgramCacheKey=()=>film?`${todayKey()}|film-${level}`:todayKey();
  wrapped.add(new WeakRef(material));material.needsUpdate=true;
 }
 function scan(){
  const kept=new Set();
  keep()?.traverse(o=>{if(o.material)for(const m of [].concat(o.material))kept.add(m);});
  scene.traverse(o=>{
   if(!o.isMesh)return;
   for(const m of [].concat(o.material)){
    if(!m||looked.has(m))continue;
    looked.add(m);
    const level=levelOf(m,kept);
    if(level)wrap(m,level);
   }
  });
 }
 function apply(look){
  if((look==='film')===film)return;
  film=look==='film';
  renderer.toneMapping=film?FILM_TONE:today.toneMapping;renderer.toneMappingExposure=film?FILM_EXPOSURE:today.exposure;
  if(film){settled=0;scan();}
  // (every wrapped material, in the scene or not: one that is not tone-mapped would otherwise keep its old program)
  for(const ref of wrapped){const m=ref.deref();if(m)m.needsUpdate=true;else wrapped.delete(ref);}
 }
 const prior=scene.onBeforeRender;
 scene.onBeforeRender=function(r,s,camera,target,...rest){
  prior.call(this,r,s,camera,target,...rest);
  if(!film)return;
  if(target)texel.value.set(1/target.width,1/target.height);else{r.getDrawingBufferSize(size);texel.value.set(1/size.x,1/size.y);}
  const programs=r.info.programs?.length??0;
  if(programs!==lastPrograms){lastPrograms=programs;settled=0;}
  if(settled++<SETTLE_FRAMES||settled%SCAN_EVERY===0)scan();
 };
 const unsubscribe=subscribeLook(apply);apply(getLook());
 return {get film(){return film;},dispose(){unsubscribe();apply('today');scene.onBeforeRender=prior;}};
}
