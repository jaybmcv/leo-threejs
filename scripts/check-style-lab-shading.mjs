import assert from 'node:assert/strict';
import * as T from 'three';
import {THREE_DIFFUSE} from '../src/walk/film-shading.js';

// The style lab's Stylised 3D (src/style-lab/surface.js, src/walk/film-shading.js), without a GPU: it swaps lines of
// three's own lighting (film-shading.js THREE_DIFFUSE), so a three that has rewritten one fails here rather than the lab
// drawing without it. (The walk's opt-in film look, checked here before, was removed on 2026-11-28.)
// node scripts/check-style-lab-shading.mjs
const D=THREE_DIFFUSE;
const SHADERS={standard:'standard',physical:'physical',lambert:'lambert',basic:'basic',phong:'phong'};
// What three passes onBeforeCompile for a material, and what it then builds from (its fragment text).
function fragmentFor(material){
 const lib=T.ShaderLib[SHADERS[material.type.replace(/^Mesh|Material$/g,'').toLowerCase()]];
 const shader={uniforms:{},vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader};
 material.onBeforeCompile(shader,null);
 return shader.fragmentShader;
}
// three's own lines are still there to be swapped.
for(const [name,line] of Object.entries(D)){
 const lib=/^physical/.test(name)?T.ShaderLib.physical:T.ShaderLib.lambert;
 const text=T.ShaderChunk.lights_fragment_begin+T.ShaderChunk.lights_fragment_end+T.ShaderChunk.lights_physical_pars_fragment+T.ShaderChunk.lights_lambert_pars_fragment+lib.fragmentShader;
 assert(text.includes(line)||Object.values(T.ShaderChunk).some(c=>typeof c==='string'&&c.includes(line)),'three still has '+name);
}
console.log('PASS three still has the lines the style lab swaps');
// The style lab draws with them: Stylised 3D in their place on its own style, three's own kept for the others (at style 0
// a lab material draws exactly what the viewer does). Its patch throws when a line is missing.
const lab=await import('../src/style-lab/surface.js');
const box=new T.BoxGeometry(),labMats={floor:new T.MeshStandardMaterial(),wall:new T.MeshLambertMaterial()},labRoot=new T.Group();
for(const m of Object.values(labMats))labRoot.add(new T.Mesh(box,m));
assert.equal(lab.patchStyleMaterials(labRoot),2);
const labText=Object.fromEntries(Object.entries(labMats).map(([k,m])=>[k,fragmentFor(m)]));
for(const [k,f] of Object.entries(labText)){assert.match(f,/stylWrapNL\( stylNL \)/,k);assert(f.includes('BRDF_Lambert( stylAlbI )'),k);}
for(const line of [D.physicalDirect,D.physicalIndirect])assert(labText.floor.includes(line),line);
assert(labText.wall.includes(D.lambertDirect));
console.log('PASS the style lab patches three: Stylised 3D on its own style, three\'s own lines kept for the others');
