// Other visitors' bones with the real rig: a walker made as remotes.js makes one (merged draws, cacheBones:
// figure-matrices.js, bone-walk.js) draws, frame by frame, exactly what one without the caching draws, and its solves
// match a walker drawing its own parts (its hidden parts skip their matrices: merged-skin.js). Each frame runs as the
// page does: the walker's update, then the scene pass, then a bone-texture rebuild for each skeleton drawn.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadImage} from '@napi-rs/canvas';
import * as T from 'three';
import {build} from './native-bundle.mjs';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
// avatar.js imports the rig's TypeScript, which Node cannot strip alone: bundled for Node, sharing this three.
const out=path.resolve('output/check-walker');await fs.mkdir(out,{recursive:true});
const bundled=async(entry,name)=>{const file=path.join(out,`${name}.${process.pid}.mjs`);
 const b=await build({entryPoints:[entry],bundle:true,format:'esm',platform:'node',external:['three'],write:false,target:'es2022',logLevel:'error'});
 await fs.writeFile(file,b.outputFiles[0].text);try{return await import('file://'+file.replaceAll('\\','/'));}finally{await fs.rm(file,{force:true});}};
const {createWalker}=await bundled('src/walk/avatar.js','avatar');
// What the walk's apply (ecctrlLocomotion.ts) reads, for the reference copy of it below.
const helpers=path.join(out,`walk-helpers.${process.pid}.js`);
await fs.writeFile(helpers,"export {ecctrlRunBlend} from '../../src/walk/vr/ecctrlLocomotion.ts';export {COSMO_RUN_DURATION,cosmoRunBlend} from '../../src/walk/vr/cosmoRunCycle.ts';export {DEFAULT_DLCAT_TUNING} from '../../src/walk/vr/dlCatTuning.ts';");
let walk;try{walk=await bundled(helpers,'walk-helpers-bundle');}finally{await fs.rm(helpers,{force:true});}
const {createDLCat}=await import('../src/vendor/cosmo/DLCat.js');
const source=await fs.readFile('src/vendor/cosmo/DLCat.js','utf8'),images=JSON.parse(source.match(/var images = (.*);/)[1]);
T.Cache.enabled=true;for(const image of images)T.Cache.add('image:'+image.dataUri,await loadImage(image.dataUri));
const motion=JSON.parse(await fs.readFile('src/walk/assets/ecctrl-locomotion.json','utf8'));

const make=async options=>{const w=await createWalker(createDLCat,motion,options),scene=new T.Scene();scene.add(w.holder);return {w,scene};};
const A=await make({mergeDraws:true,cacheBones:true}),B=await make({mergeDraws:true}),C=await make({});
// C, drawing its own parts, walks with the walk's apply as Voyager's Reach wrote it (ecctrlLocomotion.ts before Leo's
// skip of the unweighted donor, copied verbatim): the reference that skip is held to (A and B skip it).
C.w.figure.authored.apply=function(speed,dt,weight,tuning){
 const run=walk.ecctrlRunBlend(speed);
 const travel=T.MathUtils.lerp(this.travelPerCycle[0],this.travelPerCycle[1],run);
 const gaitRate=Math.min(speed/Math.max(.05,travel),T.MathUtils.lerp(1.6,2.6,run))*tuning.cadenceScale*.5;
 const cycleRate=T.MathUtils.lerp(gaitRate,1/walk.COSMO_RUN_DURATION*tuning.cadenceScale/walk.DEFAULT_DLCAT_TUNING.locomotion.cadenceScale,walk.cosmoRunBlend(speed));
 this.phase=(this.phase+dt*cycleRate)%1;
 this.actions.forEach((a,i)=>{a.time=this.phase*a.getClip().duration;a.setEffectiveWeight(i===0?1-run:i===1?run:0);});
 this.mixer.update(0);this.source.updateMatrixWorld(true);
 this.flight=Math.max(0,this.footHeight()-T.MathUtils.lerp(this.floors[0],this.floors[1],run))*this.scale*run*weight;
 if(weight<=0)return;
 this.retarget(weight,1-run);
};
const emotes=JSON.parse(await fs.readFile('src/walk/assets/cosmo-emotes.json','utf8'));for(const {w} of [A,B,C])w.figure.attachEmotes(emotes);
// What the renderer draws: reachable through shown nodes (projectObject), each skeleton rebuilt once a frame; while the
// camera has culled the body (culled), the scene pass still runs but no skeleton is rebuilt.
const drawn=scene=>{const list=[];const go=o=>{if(!o.visible)return;if(o.isMesh)list.push(o);for(const c of o.children)go(c);};go(scene);return list;};
const render=({scene},culled=false)=>{scene.updateMatrixWorld();if(culled)return;const seen=new Set();for(const m of drawn(scene))if(m.isSkinnedMesh&&!seen.has(m.skeleton)){seen.add(m.skeleton);m.skeleton.update();}};
const near=(a,b,e=1e-9)=>a.every((v,i)=>Math.abs(v-b[i])<=e);
// A hat as hat.js hangs one: a mount on the head bone, its meshes arriving later.
const hat=w=>{const mount=new T.Group();mount.name='Hat';mount.position.y=.12;w.figure.bones.get('spine.006').add(mount);w.hat={mount,remove(){mount.removeFromParent();w.hat=null;}};return mount;};
const brim=mount=>{const m=new T.Mesh(new T.CylinderGeometry(.2,.2,.05),new T.MeshBasicMaterial());m.name='Brim';mount.add(m);};

const base={speed:0,grounded:true,stance:'stand',jumpCount:1,jumpS:-1,turnRate:0,accel:0,rise:0};
// [name, frames, (frame) -> {state, holder:{x, z, yaw}}]
const phases=[
 ['standing, solved every frame',30,()=>({s:{}})],
 ['standing, paced at 20 fps',40,()=>({s:{solveEvery:.05}})],
 ['walking, paced at 30 fps',60,i=>({s:{speed:1.4,solveEvery:1/30},x:i*1.4/60})],
 ['turning on the spot, paced',30,i=>({s:{turnRate:1,solveEvery:.05},yaw:i/60})],
 ['prone with a hat (the tail tucked), paced',60,i=>({s:{stance:'prone',solveEvery:.05},hat:i===0,brim:i===12})],
 ['on the longboard, paced',40,i=>({s:{speed:3,board:Math.min(1,i/20),solveEvery:1/30},x:i*3/60})],
 ['up a grapple line',30,()=>({s:{hook:new T.Vector3(1,4,2)}})],
 ['in a hammock (eyes shut), paced',40,i=>({s:{rest:{kind:'lie',weight:Math.min(1,i/15),hammock:true,seatHeight:.4},solveEvery:.05}})],
 ['floating, paced',20,()=>({s:{rest:{kind:'float',weight:1},solveEvery:.05}})],
 ['catnip (the face shown), paced',30,()=>({s:{catnip:true,solveEvery:.05}})],
 ['swimming (the suit), paced',30,i=>({s:{swimming:true,speed:1,solveEvery:.05},x:i/60})],
 ['out of view (unseen), walking',30,i=>({s:{speed:1.4,unseen:true},x:i*1.4/60})],
 ['culled by the camera, walking and solving, then drawn by another (the selfie booth)',46,i=>({s:{speed:1.4,solveEvery:1/30},x:i*1.4/60,culled:i<45})],
 ['jumping',30,i=>({s:{grounded:i>24,jumpS:i/60,rise:i<12?3-i*.25:0}})],
 ['hat off, standing still',20,i=>({s:{solveEvery:.05},off:i===0})],
 ['crouching, walking then still',60,i=>({s:{stance:'crouch',speed:i<30?1:0,solveEvery:.05},x:Math.min(i,30)/60})],
 ['running',60,i=>({s:{speed:6,solveEvery:1/30},x:i/10})],
];
// Emotes pose the donor themselves (ecctrlLocomotion.ts applyClips) with the walk unweighted; then a walk weighs it again.
for(const emote of ['dance','play_dead','spell','pick_up']){
 phases.push(['emote '+emote+' (the walk unweighted)',60,()=>({s:{emote,solveEvery:.05}})]);
 phases.push(['from '+emote+' into walking',30,i=>({s:{speed:1.4,solveEvery:1/30},x:i*1.4/60})]);
}
let at={x:0,z:0,yaw:0};
for(const [name,frames,step] of phases){
 const start={...at};let hatMounts=null;
 for(let i=0;i<frames;i++){
  const f=step(i),s={...base,...f.s};
  if(f.hat)hatMounts=[A,B,C].map(({w})=>hat(w));
  if(f.brim)for(const m of hatMounts)brim(m);
  if(f.off)for(const {w} of [A,B,C])w.hat?.remove();
  at={x:start.x+(f.x??0),z:start.z,yaw:start.yaw+(f.yaw??0)};
  for(const v of [A,B,C]){v.w.holder.position.set(at.x,0,at.z);v.w.holder.rotation.set(0,at.yaw,0);v.w.update(1/60,{...s});render(v,f.culled);}
  const bones=v=>[...v.w.figure.bones.values()];
  bones(A).forEach((b,k)=>{assert.ok(b.matrixWorld.equals(bones(B)[k].matrixWorld),`${name}, frame ${i}: bone ${b.name} differs from the uncached walker`);
   assert.ok(near(b.matrixWorld.elements,bones(C)[k].matrixWorld.elements,1e-6),`${name}, frame ${i}: bone ${b.name} differs from the walker drawing its parts`);});
  // Nothing draws a culled body's bone texture; the first frame that draws it again must have caught up.
  if(!f.culled)assert.ok(near(A.w.figure.asset.meshes[0].skeleton.boneMatrices,B.w.figure.asset.meshes[0].skeleton.boneMatrices),`${name}, frame ${i}: bone texture differs`);
  const da=drawn(A.scene),db=drawn(B.scene);
  assert.deepEqual(da.map(m=>m.name),db.map(m=>m.name),`${name}, frame ${i}: draws differ`);
  da.forEach((m,k)=>{assert.ok(m.matrixWorld.equals(db[k].matrixWorld),`${name}, frame ${i}: ${m.name} placed differently`);
   if(m.isSkinnedMesh)assert.ok(m.bindMatrixInverse.equals(db[k].bindMatrixInverse),`${name}, frame ${i}: ${m.name} bind differs`);});
 }
 const names=drawn(A.scene).map(m=>m.name);
 if(/catnip/.test(name))assert.ok(names.includes('Catnip_face'),'the catnip face draws through the hidden bones');
 if(/^prone/.test(name))assert.ok(names.includes('Brim'),'the hat draws through the hidden bones');
 if(/hat off/.test(name))assert.ok(!names.includes('Brim'));
 pass(name+': draws exactly as uncached');
}
// Standing still at 20 fps, what the cached walker costs outside its solves: the scene pass remakes nothing, and the
// bone texture is rebuilt once after each solve, never inside one. Counted by the figure's root recomposing its matrix
// and by bone-matrix writes (Skeleton.update writes each of the 93 with toArray).
{const cost=async v=>{const root=v.w.figure.root,bones=v.w.figure.asset.meshes[0].skeleton.boneMatrices,um=T.Object3D.prototype.updateMatrix,ta=T.Matrix4.prototype.toArray;
  // Settled first: slowing from a walk, the rig's foot lift rebuilds the texture once more a solve (dlCatFigure.ts).
  for(let i=0;i<90;i++){v.w.update(1/60,{...base,solveEvery:.05});render(v);}
  const n={solves:0,scene:0,inside:0,drawing:0};let inUpdate=false;const apply=v.w.figure.apply;v.w.figure.apply=function(){n.solves++;return apply.apply(this,arguments);};
  T.Object3D.prototype.updateMatrix=function(){if(this===root&&!inUpdate)n.scene++;return um.call(this);};
  T.Matrix4.prototype.toArray=function(a,o){if(a===bones&&o===0)inUpdate?n.inside++:n.drawing++;return ta.call(this,a,o);};
  try{for(let i=0;i<60;i++){inUpdate=true;v.w.update(1/60,{...base,solveEvery:.05});inUpdate=false;render(v);}}
  finally{T.Object3D.prototype.updateMatrix=um;T.Matrix4.prototype.toArray=ta;delete v.w.figure.apply;}
  return n;};
 const a=await cost(A),b=await cost(B);
 assert.equal(a.solves,b.solves);assert.ok(a.solves>=19&&a.solves<=21,`solves ${a.solves}`);
 assert.equal(a.scene,0,`cached scene pass remade the figure ${a.scene} times`);assert.equal(b.scene,60);
 assert.equal(a.inside,0);assert.equal(a.drawing,a.solves);assert.equal(b.inside,2*b.solves);assert.equal(b.drawing,60);
 pass(`standing still over 60 frames at 20 fps (${a.solves} solves): the scene pass remakes the figure 0 times (was 60), the bone texture is rebuilt ${a.drawing} times (was ${b.inside+b.drawing})`);}
console.log(`visitor bones: ${passed} checks passed`);
