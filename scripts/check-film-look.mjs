import assert from 'node:assert/strict';
import * as T from 'three';
import {installFilmLook} from '../src/walk/film-look.js';
import {getLook,setLook} from '../src/walk/look.js';

// The walk's film look (src/walk/film-look.js), without a GPU: which materials it wraps and how, that today's look
// builds exactly today's programs, and the program keys and shader text three would get in each look.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
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
for(const k of ['floor','sign','metal','wall'])assert.match(on[k].shader.fragmentShader,/stylWrapNL\( stylNL \)/,k);
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
const late=new T.MeshStandardMaterial();scene.add(new T.Mesh(box,late));scene.onBeforeRender(renderer,scene,null,null);
assert.match(compileFor(late).key,/\|film-lit-sharp$/);
pass('a material added while film is on is wrapped before it is drawn');

setLook('today',{persist:false});
assert.equal(renderer.toneMapping,T.ACESFilmicToneMapping);assert.equal(renderer.toneMappingExposure,.95);
for(const [k,m] of Object.entries(mats)){const now=compileFor(m);assert.equal(now.key,before[k].key,k);if(k!=='glow')assert(now.shader.uniforms.uFilmTexel,k);assert.equal(now.shader.fragmentShader.includes('stylGrade'),false,k);}
pass('back on today\'s look every key is today\'s, and each program still carries the texel size for film again');
setLook('film',{persist:false});assert.match(compileFor(mats.floor).key,/\|film-lit$/);
film.dispose();assert.equal(renderer.toneMapping,T.ACESFilmicToneMapping);
pass('film again, then put away');
console.log(JSON.stringify({status:'PASS',checks}));
