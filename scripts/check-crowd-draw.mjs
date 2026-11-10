// Other visitors drawn together (src/walk/crowd-draw.js), with the real rig in Node: the parts each visitor drew are
// hidden and drawn by one instanced draw per part, fur colour and eye state; a body out of view or put back in the pool
// is not drawn; each body's row of the bone texture is its own skeleton's matrices; and the crowd's vertex skinning,
// replayed on the CPU, puts every vertex where three's own skinning of that visitor puts it.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadImage} from '@napi-rs/canvas';
import * as T from 'three';
import {build} from './native-bundle.mjs';
import {createCrowdDraw,crowdShader} from '../src/walk/crowd-draw.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const out=path.resolve('output/check-walker'),file=path.join(out,`crowd-avatar.${process.pid}.mjs`);await fs.mkdir(out,{recursive:true});
const bundle=await build({entryPoints:['src/walk/avatar.js'],bundle:true,format:'esm',platform:'node',external:['three'],write:false,target:'es2022',logLevel:'error'});
await fs.writeFile(file,bundle.outputFiles[0].text);
let createWalker;try{({createWalker}=await import('file://'+file.replaceAll('\\','/')));}finally{await fs.rm(file,{force:true});}
const {createDLCat}=await import('../src/vendor/cosmo/DLCat.js');
const source=await fs.readFile('src/vendor/cosmo/DLCat.js','utf8'),images=JSON.parse(source.match(/var images = (.*);/)[1]);
T.Cache.enabled=true;for(const image of images)T.Cache.add('image:'+image.dataUri,await loadImage(image.dataUri));
const motion=JSON.parse(await fs.readFile('src/walk/assets/ecctrl-locomotion.json','utf8'));

const scene=new T.Scene(),crowd=createCrowdDraw(scene,{slots:4}),walkers=[];
for(let i=0;i<3;i++){const w=await createWalker(createDLCat,motion,{mergeDraws:true,cacheBones:true});scene.add(w.holder);w.holder.position.set(i*1.5-1.5,0,-6);crowd.add(w);walkers.push(w);}
const camera=new T.PerspectiveCamera(60,16/9,.1,100);camera.updateMatrixWorld();
const base={speed:0,grounded:true,stance:'stand',jumpCount:1,jumpS:-1,turnRate:0,accel:0,rise:0};
let n=0;const renderer={info:{render:{frame:0}}};
// A frame as the page runs it: the visitors' updates, the crowd's choice of who draws, three's scene pass, then drawing.
const frame=(s={})=>{for(const w of walkers)w.update(1/60,{...base,...s});crowd.update(camera,s.crowd??{});scene.updateMatrixWorld();
 renderer.info.render.frame=++n;for(const g of crowd.groups.values())if(g.mesh.visible)g.mesh.onBeforeRender(renderer);};
const drawn=()=>{const list=[];scene.traverse(o=>{if(o.isMesh&&o.visible){let shown=true;for(let p=o;p;p=p.parent)if(!p.visible)shown=false;if(shown)list.push(o);}});return list;};
const counts=()=>[...crowd.groups.values()].map(g=>g.mesh.visible?g.count:0).reduce((a,b)=>a+b,0);

for(let i=0;i<10;i++)frame({solveEvery:0});
{const own=drawn().filter(o=>o.isSkinnedMesh);assert.equal(own.length,0,'no visitor draws its own body');
 const groups=[...crowd.groups.values()].filter(g=>g.mesh.visible);
 assert.ok(groups.length>=3&&groups.length<=4,`${groups.length} draws`);assert.ok(groups.every(g=>g.count===3));
 pass(`three visitors' bodies: ${groups.length} instanced draws of 3, none of their own (was ${3*groups.length})`);}

// Each body's row is its skeleton's matrices; the crowd's skinning puts each vertex where three's own does.
{const m=crowd.members[1],row=crowd.texture.image.data.subarray(m.slot*crowd.texture.image.width*4),k=new T.Matrix4();
 m.skeleton.bones.forEach((b,i)=>{k.multiplyMatrices(b.matrixWorld,m.skeleton.boneInverses[i]);assert.ok(k.elements.every((v,j)=>Math.abs(v-row[i*16+j])<1e-6),'row of bone '+i);});
 const at=(row,i)=>new T.Matrix4().fromArray(row,i*16),v=new T.Vector3(),own=new T.Vector3();let worst=0;
 for(const part of m.parts){const g=part.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,p=g.attributes.position;
  for(let i=0;i<p.count;i+=37){const bindP=new T.Vector4(p.getX(i),p.getY(i),p.getZ(i),1).applyMatrix4(part.bindMatrix),sum=new T.Vector4();
   for(let c=0;c<4;c++){const w=sw.getComponent(i,c);if(w)sum.add(bindP.clone().applyMatrix4(at(row,si.getComponent(i,c))).multiplyScalar(w));}
   v.set(sum.x,sum.y,sum.z);part.getVertexPosition(i,own).applyMatrix4(part.matrixWorld);worst=Math.max(worst,v.distanceTo(own));}}
 assert.ok(worst<1e-5,`worst ${worst} m`);
 pass(`a body's bone texture row is its skeleton's, and the crowd's skinning puts its vertices where three's own does (worst ${worst.toExponential(1)} m)`);}

// Out of view, back in the pool, or seen by the selfie booth's camera.
{walkers[2].holder.position.set(0,0,8);for(let i=0;i<3;i++)frame();assert.ok([...crowd.groups.values()].every(g=>!g.mesh.visible||g.count===2));
 frame({crowd:{all:true}});assert.ok([...crowd.groups.values()].every(g=>!g.mesh.visible||g.count===3));
 walkers[2].holder.position.set(1.5,0,-6);walkers[1].holder.removeFromParent();frame();assert.ok([...crowd.groups.values()].every(g=>!g.mesh.visible||g.count===2));
 const slotsDrawn=new Set([...crowd.groups.values()].flatMap(g=>[...g.slots.slice(0,g.count)]));assert.ok(!slotsDrawn.has(crowd.members[1].slot));
 scene.add(walkers[1].holder);frame();
 pass('a body behind the camera, or put back in the pool, is not drawn; with all (the selfie booth) every body is');}

// A fur colour of its own (fur.js changes the map's image), or eyes shut in a hammock, is a draw of its own.
{const body=crowd.members[0].parts.find(p=>p.material.map?.name==='body_BaseColor');assert.ok(body,'a part wears the body map');
 const before=crowd.groups.size;body.material.map.image={width:1,height:1,data:new Uint8Array(4)};frame();
 assert.equal(crowd.groups.size,before+1);const furGroups=[...crowd.groups.values()].filter(g=>g.mesh.visible&&g.mesh.material.name===body.material.name);
 assert.deepEqual(furGroups.map(g=>g.count).sort(),[1,2]);
 for(let i=0;i<40;i++)frame({rest:{kind:'lie',weight:1,hammock:true,seatHeight:.4},solveEvery:.05});
 const shut=[...crowd.groups.values()].filter(g=>g.mesh.visible&&g.key.endsWith('|1'));assert.ok(shut.length>=1,'eyes shut draw');
 const m=crowd.members[1],eyes=m.eyes;assert.notEqual(eyes.geometry.attributes.uv,m.open);
 const g=shut.find(x=>x.slots.slice(0,x.count).includes(m.slot)),uv=g.mesh.geometry.attributes.uv,merged=m.eyesPart.geometry.attributes.uv;
 assert.ok(Array.from({length:uv.count},(_,i)=>uv.getX(i)===merged.getX(i)&&uv.getY(i)===merged.getY(i)).every(Boolean));
 for(let i=0;i<40;i++)frame({solveEvery:.05});assert.ok([...crowd.groups.values()].every(x=>!x.mesh.visible||!x.key.endsWith('|1')));
 pass('a fur colour of its own, or eyes shut in a hammock, draws apart; open again, back with the rest');}

// The bone texture is uploaded only when a body drawn changed.
{for(let i=0;i<5;i++)frame({solveEvery:.05});let uploads=0;const v0=crowd.texture.version;
 for(let i=0;i<30;i++){const v=crowd.texture.version;frame({solveEvery:.05});if(crowd.texture.version!==v)uploads++;}
 assert.ok(uploads>=9&&uploads<=12,`${uploads} uploads in 30 frames`);assert.ok(crowd.texture.version>v0);
 pass(`standing at 20 fps, the bone texture is uploaded ${uploads} times in 30 frames`);}

// Switched off (the A/B probes), every body draws its own again; back on, the crowd does.
{crowd.enabled=false;frame();assert.equal(drawn().filter(o=>o.isSkinnedMesh).length,crowd.members.reduce((s,m)=>s+m.parts.length,0));
 assert.ok([...crowd.groups.values()].every(g=>!g.mesh.visible));
 crowd.enabled=true;frame();assert.equal(drawn().filter(o=>o.isSkinnedMesh).length,0);assert.ok(crowd.members.every(m=>m.skeleton.boneMatrices===m.row));
 pass('switched off every body draws its own again; back on, the crowd draws them');}

// The shader: three's own standard and physical vertex shaders take the crowd's skinning.
{for(const lib of ['standard','physical']){const v=crowdShader(T.ShaderLib[lib].vertexShader);
  assert.ok(v.includes('crowdBone( skinIndex.x )')&&v.includes('transformed = skinned.xyz')&&!v.includes('#include <skinning_vertex>'));}
 assert.throws(()=>crowdShader('void main(){}'));pass('three\'s standard and physical vertex shaders take the crowd\'s skinning chunks');}
console.log(`crowd draw: ${passed} checks passed`);
