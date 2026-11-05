// src/v2/shader-warmup.js against a stand-in renderer: one sample per distinct shader, every light state compiled with
// the switched groups put back, and only textures not yet on the GPU uploaded. Usage: node scripts/check-shader-warmup.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import {shaderSamples,warmShaders,uploadTextures} from '../src/v2/shader-warmup.js';

function check(name,fn){return Promise.resolve(fn()).then(()=>console.log('PASS '+name));}
const box=new T.BoxGeometry(),plain=new T.MeshStandardMaterial({name:'plain'}),pictured=new T.MeshStandardMaterial({name:'pictured',map:new T.Texture()});
function world(){
 const scene=new T.Scene();
 scene.add(new T.Mesh(box,plain),new T.Mesh(box,plain),new T.Mesh(box,pictured));
 scene.add(new T.InstancedMesh(box,plain,4));
 const hidden=new T.Mesh(box,new T.MeshBasicMaterial({name:'hidden'}));hidden.visible=false;scene.add(hidden);
 const lamps=new T.Group();lamps.add(new T.PointLight());lamps.visible=false;scene.add(lamps);
 return {scene,lamps};
}
function renderer(){
 const r={ready:true,info:{programs:[]},calls:[],uploaded:[],properties:{get:t=>({__version:t.uploadedVersion??0})},
  compileAsync(stand,camera,scene){const lights=[];scene.traverseVisible(o=>{if(o.isLight)lights.push(o);});const meshes=[];stand.traverse(o=>meshes.push(o));
   r.calls.push({meshes:meshes.length,lights:lights.length});for(const o of meshes)r.info.programs.push({name:o.material.name+'|'+lights.length,isReady:()=>r.ready});return Promise.resolve();},
  initTexture(t){r.uploaded.push(t);t.uploadedVersion=t.version;}};
 return r;
}

await check('one sample per material and kind of mesh, hidden meshes included',()=>{
 const {samples,textures}=shaderSamples(world().scene);
 assert.deepEqual(samples.map(o=>o.material.name+(o.isInstancedMesh?'*':'')),['plain','pictured','plain*','hidden']);
 assert.deepEqual([...textures],[pictured.map]);
});
await check('every state of the switched lights is compiled, and the lights are left as they were',async()=>{
 const {scene,lamps}=world(),r=renderer(),{proof}=await warmShaders(r,scene,new T.PerspectiveCamera(),{lights:[lamps]});
 assert.deepEqual(r.calls.map(c=>c.lights),[0,1]);assert.equal(lamps.visible,false);
 assert.ok(r.calls.every(c=>c.meshes===4));assert.equal(proof.programs,8);assert.equal(proof.ready,true);
});
await check('a failing compile is reported, not thrown',async()=>{
 const r=renderer();r.compileAsync=()=>{throw Error('lost context');};
 const warn=console.warn;console.warn=()=>{};try{const {proof}=await warmShaders(r,world().scene,new T.PerspectiveCamera());assert.equal(proof.ready,false);}finally{console.warn=warn;}
});
await check('a program that never finishes stops the wait at waitMs',async()=>{
 const r=renderer();r.ready=false;
 const {proof}=await warmShaders(r,world().scene,new T.PerspectiveCamera(),{waitMs:20});assert.equal(proof.ready,false);
});
await check('only pictures with data and not yet on the GPU are uploaded, one per wait',async()=>{
 const ready=new T.Texture();ready.version=1;const empty=new T.Texture();const done=new T.Texture();done.version=2;done.uploadedVersion=2;
 const video=new T.Texture();video.version=1;video.isVideoTexture=true;
 const r=renderer();let waits=0;const n=await uploadTextures(r,[ready,empty,done,video],async()=>{waits++;});
 assert.equal(n,1);assert.deepEqual(r.uploaded,[ready]);assert.equal(waits,1);
});
