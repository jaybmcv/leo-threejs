import assert from 'node:assert/strict';
import * as T from 'three';
import {installFilmLook} from '../src/walk/film-look.js';
import {THREE_DIFFUSE} from '../src/walk/film-shading.js';
import {getLook,setLook} from '../src/walk/look.js';

// The walk's film look (src/walk/film-look.js), without a GPU: which materials it wraps and how, that today's look
// builds exactly today's programs, and the program keys and shader text three would get in each look. Both it and the
// style lab swap lines of three's own lighting (film-shading.js THREE_DIFFUSE), so a three that has rewritten one fails
// here rather than drawing film without it.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
const warnings=[],consoleWarn=console.warn;console.warn=(...args)=>{warnings.push(args.join(' '));consoleWarn(...args);};
const D=THREE_DIFFUSE;
const SHADERS={standard:'standard',physical:'physical',lambert:'lambert',basic:'basic',phong:'phong'};
// What three passes onBeforeCompile for a material, and what it then builds from (its key and fragment text).
function compileFor(material){
 const lib=T.ShaderLib[SHADERS[material.type.replace(/^Mesh|Material$/g,'').toLowerCase()]];
 const shader={uniforms:{},vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader};
 material.onBeforeCompile(shader,null);
 return {shader,key:material.customProgramCacheKey()};
}
const renderer={toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:.95,info:{programs:[]},getDrawingBufferSize:v=>v.set(1920,1080)};
const scene=new T.Scene(),holder=new T.Group(),box=new T.BoxGeometry();
const tiled=new T.Texture();tiled.wrapS=tiled.wrapT=T.RepeatWrapping;
const sign=new T.CanvasTexture({width:4,height:4});
const mats={
 floor:new T.MeshStandardMaterial({map:tiled}),
 sign:new T.MeshStandardMaterial({map:sign}),
 metal:new T.MeshPhysicalMaterial({metalness:1}),
 wall:new T.MeshLambertMaterial(),
 screen:new T.MeshBasicMaterial(),
 glow:new T.MeshBasicMaterial({blending:T.AdditiveBlending}),
 phong:new T.MeshPhongMaterial(),
 cat:new T.MeshStandardMaterial(),
};
// a walk material with its own patch and key, as the walk's finishes have
mats.wall.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n// walk-wall');};
mats.wall.customProgramCacheKey=()=>'walk-wall';
for(const [name,m] of Object.entries(mats))(name==='cat'?holder:scene).add(new T.Mesh(box,m));
scene.add(holder);
const before=Object.fromEntries(Object.entries(mats).map(([k,m])=>[k,compileFor(m)]));

assert.equal(getLook(),'today');
const film=installFilmLook({renderer,scene,keep:()=>holder});
assert.equal(film.film,false);
for(const [k,m] of Object.entries(mats)){assert.equal(Object.hasOwn(m,'onBeforeCompile'),k==='wall');const now=compileFor(m);assert.equal(now.key,before[k].key);assert.equal(now.shader.fragmentShader,before[k].shader.fragmentShader);}
assert.equal(renderer.toneMapping,T.ACESFilmicToneMapping);
pass('a visitor on today\'s look gets exactly today\'s materials, keys and curve');

setLook('film',{persist:false});
assert.equal(film.film,true);assert.equal(renderer.toneMapping,T.NeutralToneMapping);assert.equal(renderer.toneMappingExposure,1.15);
const on=Object.fromEntries(Object.entries(mats).map(([k,m])=>[k,compileFor(m)]));
const count=(text,part)=>text.split(part).length-1;
for(const k of ['floor','sign','metal','wall']){const f=on[k].shader.fragmentShader;
 assert.match(f,/stylWrapNL\( stylNL \)/,k);assert(f.includes('BRDF_Lambert( stylAlbI )'),k);
 const replaced=k==='wall'?[D.lambertDirect,D.lambertIndirect]:[D.physicalDirect,D.physicalIndirect];
 for(const line of replaced)assert.equal(f.includes(line),false,`${k}: ${line}`);}
assert.deepEqual(warnings.filter(w=>w.startsWith('Film look:')),[]);
pass('Standard, Physical and Lambert surfaces all take the film\'s light and indirect light, none of three\'s left out');
assert.match(on.floor.key,/\|film-lit$/);assert.match(on.sign.key,/\|film-lit-sharp$/);
assert.match(on.floor.shader.fragmentShader,/texture2D\( map, vMapUv, 3\.0 \)/);
assert.equal(on.floor.shader.fragmentShader.includes('#include <map_fragment>'),false);
assert(on.sign.shader.fragmentShader.includes('#include <map_fragment>'));
pass('a tiling texture softens to its broad colour; a sign keeps its text sharp');
assert.match(on.metal.shader.fragmentShader,/material\.specularColorBlended \* \( 0\.6 \* material\.metalness \)/);
assert.match(on.wall.shader.fragmentShader,/\/\/ walk-wall/);assert.equal(on.wall.key,'walk-wall|film-lit-sharp');
pass('a material\'s own patch and key run first and are kept');
for(const k of ['screen','phong','cat']){assert.match(on[k].key,/\|film-grade$/,k);assert.match(on[k].shader.fragmentShader,/stylGrade\( gl_FragColor\.rgb/);assert.equal(on[k].shader.fragmentShader.includes('stylWrapNL( stylNL )'),false,k);}
pass('unlit surfaces, Phong and the walker\'s cat take the grade alone');
assert.equal(on.glow.key,before.glow.key);assert.equal(on.glow.shader.fragmentShader,before.glow.shader.fragmentShader);
pass('an additive glow is left as it is');
for(const k of ['floor','screen'])assert.equal(count(on[k].shader.fragmentShader,'uniform vec2 uFilmTexel;'),1);
assert.equal(on.floor.shader.uniforms.uFilmTexel,on.screen.shader.uniforms.uFilmTexel);

// A copy made with its source's hooks (src/v2/facade.js batches the low decks so) is patched once, not twice.
const copy=mats.floor.clone();copy.onBeforeCompile=mats.floor.onBeforeCompile;copy.customProgramCacheKey=mats.floor.customProgramCacheKey;
scene.add(new T.Mesh(box,copy));scene.onBeforeRender(renderer,scene,null,null);
const copied=compileFor(copy);assert.equal(count(copied.shader.fragmentShader,'uniform vec2 uFilmTexel;'),1);assert.equal(copied.key,on.floor.key);
pass('a material copied with a wrapped one\'s hooks is patched once');
// With film on from the start, a furnishing batch (src/v2/furnishing-batches.js) copies a source film has wrapped
// (P4_metal, P4_reflection_leaf_light) with its hooks, and when no frame is drawn in between, corner shading
// (src/walk/corner-shade.js) wraps the copy in its own hook before film first looks at it. Film then finds a hook it does
// not know on top and wraps the copy again: its shader is still patched once.
const source=new T.MeshStandardMaterial();scene.add(new T.Mesh(box,source));scene.onBeforeRender(renderer,scene,null,null);
const batched=source.clone();batched.onBeforeCompile=source.onBeforeCompile;batched.customProgramCacheKey=source.customProgramCacheKey;
scene.add(new T.Mesh(box,batched));
const cornerShade=m=>{const before=m.onBeforeCompile,key=m.customProgramCacheKey;
 m.onBeforeCompile=function(s,r){before.call(this,s,r);s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n// corner');};
 m.onBeforeCompile.cornerShade=true;m.customProgramCacheKey=function(){return key.call(this)+'|corner';};};
for(const m of [source,batched])cornerShade(m);
scene.onBeforeRender(renderer,scene,null,null);
assert.equal(batched.onBeforeCompile.filmLook,true);assert.match(batched.customProgramCacheKey(),/\|film-lit-sharp\|corner\|film-lit-sharp$/);
for(const [k,m] of Object.entries({source,batched})){const f=compileFor(m).shader.fragmentShader;
 for(const part of ['uniform vec2 uFilmTexel;','float stylWrapNL(','vec3 stylGrade(','stylGrade( gl_FragColor.rgb','// corner'])assert.equal(count(f,part),1,k+': '+part);}
pass('a batch copy that corner shading wraps before film looks at it is patched once');
const late=new T.MeshStandardMaterial();scene.add(new T.Mesh(box,late));scene.onBeforeRender(renderer,scene,null,null);
assert.match(compileFor(late).key,/\|film-lit-sharp$/);
pass('a material added while film is on is wrapped before it is drawn');

setLook('today',{persist:false});
assert.equal(renderer.toneMapping,T.ACESFilmicToneMapping);assert.equal(renderer.toneMappingExposure,.95);
for(const [k,m] of Object.entries(mats)){const now=compileFor(m);assert.equal(now.key,before[k].key,k);if(k!=='glow')assert(now.shader.uniforms.uFilmTexel,k);assert.equal(now.shader.fragmentShader.includes('stylGrade'),false,k);}
pass('back on today\'s look every key is today\'s, and each program still carries the texel size for film again');
{const now=compileFor(batched);assert.equal(now.key,compileFor(source).key);assert.equal(now.shader.fragmentShader.includes('uFilmTexel'),false);}
pass('the copy wrapped twice draws today\'s program on today\'s look');
setLook('film',{persist:false});assert.match(compileFor(mats.floor).key,/\|film-lit$/);
film.dispose();assert.equal(renderer.toneMapping,T.ACESFilmicToneMapping);
pass('film again, then put away');

// The style lab draws with the same lines: Stylised 3D in their place on its own style, three's own kept for the others
// (at style 0 a lab material draws exactly what the viewer does). Its patch throws when a line is missing.
const lab=await import('../src/style-lab/surface.js');
const labMats={floor:new T.MeshStandardMaterial(),wall:new T.MeshLambertMaterial()},labRoot=new T.Group();
for(const m of Object.values(labMats))labRoot.add(new T.Mesh(box,m));
assert.equal(lab.patchStyleMaterials(labRoot),2);
const labText=Object.fromEntries(Object.entries(labMats).map(([k,m])=>[k,compileFor(m).shader.fragmentShader]));
for(const [k,f] of Object.entries(labText)){assert.match(f,/stylWrapNL\( stylNL \)/,k);assert(f.includes('BRDF_Lambert( stylAlbI )'),k);}
for(const line of [D.physicalDirect,D.physicalIndirect])assert(labText.floor.includes(line),line);
assert(labText.wall.includes(D.lambertDirect));
pass('the style lab patches the same three: Stylised 3D on its own style, three\'s own lines kept for the others');
console.log(JSON.stringify({status:'PASS',checks}));
