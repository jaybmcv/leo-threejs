import assert from 'node:assert/strict';
import * as T from 'three';
import {shareEquivalentMaterials} from '../src/walk/share-materials.js';

// Shared materials (src/walk/share-materials.js), without a GPU: equal copies on several decks become one object, and a
// material that differs in any value, texture, shader hook or the caller's split keeps its own.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
const oak=(extra={})=>new T.MeshStandardMaterial({name:'Residential_oak_polished',color:0xa98762,roughness:.58,...extra});
const part=(material,cabin=true)=>{const o=new T.InstancedMesh(new T.BoxGeometry(),material,2);o.userData.v2Cabins=cabin;return o;};
const cabins=o=>o.userData.v2Cabins;

{const scene=new T.Scene(),decks=[0,1,2].map(()=>{const g=new T.Group();scene.add(g);return g;}),parts=decks.map(g=>{const o=part(oak());g.add(o);return o;});
 const first=parts[0].material,result=shareEquivalentMaterials(scene,{member:cabins});
 assert(parts.every(o=>o.material===first));assert.deepEqual(result,{meshes:2,materials:1});
 pass('equal copies on three decks become the first one');
 assert.deepEqual(shareEquivalentMaterials(scene,{member:cabins}),{meshes:0,materials:1});pass('sharing again changes nothing');}

{const scene=new T.Scene(),map=new T.Texture(),hook=s=>s,same=part(oak()),base=part(oak());
 const odd=[oak({color:0xa98763}),oak({roughness:.59}),oak({transparent:true,opacity:.5}),oak({side:T.DoubleSide}),oak({map}),oak({map:new T.Texture()}),oak({emissive:new T.Color(0x010000)}),oak({defines:{CORNER:''}})].map(m=>part(m));
 const hooked=part(oak());hooked.material.onBeforeCompile=hook;const shader=part(new T.ShaderMaterial()),shader2=part(new T.ShaderMaterial());
 const other=part(oak(),false),multi=new T.Mesh(new T.BoxGeometry(),[oak(),oak()]);multi.userData.v2Cabins=true;
 scene.add(base,same,...odd,hooked,shader,shader2,other,multi);const before=new Map([...odd,hooked,shader,shader2,other].map(o=>[o,o.material])),multiple=multi.material;
 shareEquivalentMaterials(scene,{member:cabins});
 assert.equal(same.material,base.material);for(const [o,m] of before)assert.equal(o.material,m);assert.equal(multi.material,multiple);
 pass('a colour, roughness, blending, side, texture, emissive, define or shader hook keeps a material its own');
 pass('so do shader materials, meshes not chosen and meshes with several materials');}

{const scene=new T.Scene(),a=part(oak()),b=part(oak()),c=part(oak());scene.add(a,b,c);const alone=new Set([b.material]),own=b.material;
 shareEquivalentMaterials(scene,{member:cabins,split:o=>alone.has(o.material)?'alone':''});
 assert.equal(c.material,a.material);assert.equal(b.material,own);pass('the split keeps a material corner shading leaves alone apart from those it shades');}

{const scene=new T.Scene(),map=new T.Texture(),a=part(oak({map})),b=part(oak({map}));scene.add(a,b);shareEquivalentMaterials(scene,{member:cabins});
 assert.equal(a.material,b.material);pass('copies with the same texture object are equal');}
console.log(`share materials: ${checks} checks passed`);
