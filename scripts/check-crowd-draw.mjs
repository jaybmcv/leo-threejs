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
const drawn=()=>{const list=[];scene.traverse(o=>{if(o.isMesh&&o.visible){let shown=true;for(let p=o;p;p=p.parent)if(!p.visible)shown=false;if(shown)list.push(o);}});return list;};
// A body drawn on its own, as three draws a skinned mesh: a bone texture made on its first draw (a padded copy of its
// matrices), then its skeleton updated once a frame.
const drawOwn=()=>{const seen=new Set();for(const o of drawn())if(o.isSkinnedMesh&&!seen.has(o.skeleton)){seen.add(o.skeleton);if(!o.skeleton.boneTexture)o.skeleton.computeBoneTexture();o.skeleton.update();}};
const frame=(s={})=>{for(const w of walkers)w.update(1/60,{...base,...s});crowd.update(camera,s.crowd??{});scene.updateMatrixWorld();
 renderer.info.render.frame=++n;for(const g of crowd.groups.values())if(g.mesh.visible)g.mesh.onBeforeRender(renderer);drawOwn();};
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

// Off, on and off again: a body drawn on its own has a bone texture that follows its bones (three's padded copy is
// dropped when it rejoins, so it is made again).
{crowd.enabled=false;frame();crowd.enabled=true;frame();walkers[0].holder.position.x+=2;crowd.enabled=false;frame();frame();
 const s=crowd.members[0].skeleton,k=new T.Matrix4().multiplyMatrices(s.bones[0].matrixWorld,s.boneInverses[0]),t=s.boneTexture.image.data;
 assert.ok(k.elements.every((v,j)=>Math.abs(v-t[j])<1e-6),'the bone texture of a body drawn on its own follows its bones');
 walkers[0].holder.position.x-=2;crowd.enabled=true;frame();
 pass('off, on and off again, a body drawn on its own still has a bone texture that follows its bones');}

// A fur colour changed (fur.js swaps its map's image) changes only that visitor: each draw keeps its own colour.
{const part=m=>m.parts.find(p=>p.material.map?.name==='body_BaseColor'),a=crowd.members[0],b=crowd.members[2];frame();
 const imageOf=m=>part(m).material.map.image,groupOf=m=>[...crowd.groups.values()].find(g=>g.mesh.visible&&g.mesh.material.name===part(m).material.name&&g.slots.slice(0,g.count).includes(m.slot));
 const bWas=imageOf(b),bGroup=groupOf(b);assert.equal(bGroup.mesh.material.map.image,bWas);
 const fresh={width:1,height:1,data:new Uint8Array([1,2,3,4])};part(a).material.map.image=fresh;frame();
 assert.equal(groupOf(a).mesh.material.map.image,fresh);assert.equal(bGroup.mesh.material.map.image,bWas,'another visitor\'s draw keeps its colour');
 pass('a visitor\'s fur colour changed recolours only their own draw');}

// The crowd culls a body by its parts' own bounds: in every pose each vertex lies inside one of them, so a body with any
// vertex in view is drawn. (A fixed sphere round the holder, as first written, missed a body lying in a hammock.)
{const poses={standing:{},'lying in a hammock':{rest:{kind:'lie',weight:1,hammock:true,seatHeight:.4}},prone:{stance:'prone'},
  'on the board':{speed:3,board:1},'up a grapple line':{hook:new T.Vector3(1,4,2)},floating:{rest:{kind:'float',weight:1}}};
 const m=crowd.members[0],v=new T.Vector3(),s=new T.Sphere(),c=new T.Vector3();let fixedWorst=0;
 for(const [name,state] of Object.entries(poses)){
  // (lying, remotes.js also tips the body back onto the pillow: PILLOW_TILT .12)
  m.walker.body.rotation.set(state.rest?.kind==='lie'?-Math.PI/2+.12:0,0,0);
  for(let i=0;i<50;i++){m.walker.update(1/60,{...base,...state});scene.updateMatrixWorld();}
  const spheres=m.parts.map(p=>s.clone().copy(p.boundingSphere).applyMatrix4(p.matrixWorld));c.copy(m.walker.holder.position).y+=.9;
  for(const p of m.parts)for(let i=0;i<p.geometry.attributes.position.count;i+=7){p.getVertexPosition(i,v).applyMatrix4(p.matrixWorld);
   assert.ok(spheres.some(x=>x.containsPoint(v)),`${name}: a vertex outside every part's bounds`);fixedWorst=Math.max(fixedWorst,v.distanceTo(c));}}
 m.walker.body.rotation.set(0,0,0);for(let i=0;i<40;i++)frame({solveEvery:.05});
 pass(`in six poses every vertex lies within its parts' culling bounds (the farthest, ${fixedWorst.toFixed(2)} m from mid-body, beyond a fixed 1.8 m sphere)`);}

// The visitor's own shader hooks (the film look, corner shading) come with a draw made later, its skin after them.
{const m=crowd.members[0],p=m.parts.find(q=>q.material.map?.name==='body_BaseColor'),mat=p.material,calls=[];
 const hook=function(shader){calls.push('own');shader.vertexShader='// own\n'+shader.vertexShader;};hook.filmLook=true;hook.cornerShade=true;
 mat.onBeforeCompile=hook;mat.customProgramCacheKey=function(){return 'own-key';};
 mat.map.image={width:2,height:2,data:new Uint8Array(16)};frame();
 const g=[...crowd.groups.values()].find(x=>x.mesh.visible&&x.slots.slice(0,x.count).includes(m.slot)&&x.mesh.material.name===mat.name);
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,uniforms:{}};g.mesh.material.onBeforeCompile(shader,null);
 assert.deepEqual(calls,['own']);assert.ok(shader.vertexShader.startsWith('// own')&&shader.vertexShader.includes('crowdBone( skinIndex.x )'));
 assert.ok(g.mesh.material.onBeforeCompile.filmLook&&g.mesh.material.onBeforeCompile.cornerShade);
 assert.equal(g.mesh.material.customProgramCacheKey(),'own-key|crowd-skin');
 pass('a draw made later keeps the visitor\'s own shader hooks and their marks (film look, corner shading), its skin after them');}

// The shader: three's own standard and physical vertex shaders take the crowd's skinning.
{for(const lib of ['standard','physical']){const v=crowdShader(T.ShaderLib[lib].vertexShader);
  assert.ok(v.includes('crowdBone( skinIndex.x )')&&v.includes('transformed = skinned.xyz')&&!v.includes('#include <skinning_vertex>'));}
 assert.throws(()=>crowdShader('void main(){}'));pass('three\'s standard and physical vertex shaders take the crowd\'s skinning chunks');}
console.log(`crowd draw: ${passed} checks passed`);
