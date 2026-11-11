// The crowd's recorded loops (src/walk/assets/crowd-motion.json, scripts/bake-crowd-motion.mjs) and how the crowd tier
// reads them (src/walk/crowd-tier.js): the recording is of the rig as it is now (its sources' hash); every loop is
// there, whole, and comes round without a jump (its seam no bigger than a quarter more than its biggest step within,
// nor than five of its usual steps); recording a loop again gives the same numbers (half-float close); a body
// skinned from the recording's numbers, as the crowd's vertex shader reads them (crowdBoneMatrix: the same layout), is
// where three's own skinning puts the rig's body, to the millimetre; and each visitor's pose picks the loop it should.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {OUT,LOOPS,EMOTES,rigHash,recordLoop,walker,partsOf} from './bake-crowd-motion.mjs';
import {crowdLoop,crowdBoneMatrix,crowdHalves} from '../src/walk/crowd-tier.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const motion=JSON.parse(await fs.readFile(OUT,'utf8'));
assert.equal(motion.rig,await rigHash(),'the crowd recording is of an older rig: run node scripts/bake-crowd-motion.mjs');
pass('the recording is of the rig as it is (its sources\' hash)');

const halves=crowdHalves(motion),numbers=Float32Array.from(halves,h=>T.DataUtils.fromHalfFloat(h)),bones=motion.bones;
assert.deepEqual(motion.clips.map(c=>c.name),LOOPS.map(l=>l[0]));
let at=0;for(const c of motion.clips){assert.equal(c.start,at,`${c.name} starts where the last ended`);assert.ok(c.frames>=1);at+=c.frames;
 // (from the numbers, not the recording's own measure: coming round is no bigger than a quarter more than the loop's
 // biggest step within, nor than five of its usual ones, so a jump within cannot excuse one at the seam)
 const W=bones*12,step=(i,j)=>{let d=0;for(let k=0;k<W;k++)d+=Math.abs(numbers[(c.start+i)*W+k]-numbers[(c.start+j)*W+k]);return d/W;};
 if(c.frames>=3){const inner=Array.from({length:c.frames-1},(_,i)=>step(i,i+1)).sort((x,y)=>x-y),wrap=step(c.frames-1,0);
  assert.ok(wrap<=inner.at(-1)*1.25+1e-9,`${c.name}: coming round is ${(wrap/inner.at(-1)).toFixed(2)} times its biggest step within`);
  assert.ok(wrap<=inner[inner.length>>1]*5+1e-9,`${c.name}: coming round is ${(wrap/inner[inner.length>>1]).toFixed(2)} of its usual steps`);}}
assert.equal(halves.length,at*bones*12,'the numbers are every frame of every loop');
assert.ok(numbers.every(Number.isFinite));
pass(`${motion.clips.length} loops, ${at} frames, ${bones} bones; each comes round in a step at most ${Math.max(...motion.clips.map(c=>c.seam)).toFixed(2)} times its biggest step within`);

// Recorded again, a loop is the same (the rig is deterministic; half floats keep about three figures).
for(const name of ['walk','crouch']){
 const again=await recordLoop(name),c=motion.clips.find(x=>x.name===name);assert.equal(again.frames.length,c.frames,`${name}: frames`);
 let worst=0;again.frames.forEach((f,i)=>{for(let k=0;k<f.length;k++){const v=numbers[(c.start+i)*bones*12+k];worst=Math.max(worst,Math.abs(v-f[k])/Math.max(1,Math.abs(f[k])));}});
 assert.ok(worst<2e-3,`${name}: recorded again, a number differs by ${worst}`);
 pass(`${name}, recorded again, matches the recording (largest difference ${worst.toExponential(1)}, half-float rounding)`);
}

// Skinned from the recording's numbers as the shader reads them, a body is where three's skinning puts the rig's: a
// walker held crouched, its bones' matrices kept in the recording's layout (as half floats), every vertex of its parts.
{
 const {w,scene}=await walker(),parts=partsOf(w),skeleton=parts[0].skeleton,s={speed:0,grounded:true,stance:'crouch',jumpCount:1,jumpS:-1,turnRate:0,accel:0,rise:0,emote:null,rest:null};
 for(let i=0;i<180;i++)w.update(1/60,s);scene.updateMatrixWorld(true);skeleton.update();
 const m=skeleton.boneMatrices,row=new Float32Array(bones*12);
 for(let b=0;b<bones;b++){const e=b*16,o=b*12;row.set([m[e],m[e+1],m[e+2],m[e+4],m[e+5],m[e+6],m[e+8],m[e+9],m[e+10],m[e+12],m[e+13],m[e+14]],o);}
 const rounded=Float32Array.from(row,v=>T.DataUtils.fromHalfFloat(T.DataUtils.toHalfFloat(v)));
 const mats=Array.from({length:bones},(_,b)=>crowdBoneMatrix(rounded,bones,0,b));
 let worst=0,count=0;const ours=new T.Vector3(),theirs=new T.Vector3(),v=new T.Vector4(),sum=new T.Vector4(),tmp=new T.Vector4();
 for(const part of parts){
  const pos=part.geometry.attributes.position,si=part.geometry.attributes.skinIndex,sw=part.geometry.attributes.skinWeight;
  for(let i=0;i<pos.count;i+=7){
   part.getVertexPosition(i,theirs);theirs.applyMatrix4(part.matrixWorld);
   v.set(pos.getX(i),pos.getY(i),pos.getZ(i),1).applyMatrix4(part.bindMatrix);sum.set(0,0,0,0);
   for(let k=0;k<4;k++){const wt=sw.getComponent(i,k);if(wt)sum.add(tmp.copy(v).applyMatrix4(mats[si.getComponent(i,k)]).multiplyScalar(wt));}
   ours.set(sum.x,sum.y,sum.z);worst=Math.max(worst,ours.distanceTo(theirs));count++;
  }
 }
 assert.ok(worst<.003,`a vertex skinned from the recording is ${(worst*1000).toFixed(2)} mm from the rig's`);
 pass(`${count} vertices skinned from the recording's numbers as the shader reads them land within ${(worst*1000).toFixed(2)} mm of three's skinning of the rig`);
}

// The crowd tier itself, on a walker as its template (three makes the draws without a GPU): a draw for each part and
// fur colour; out of the camera's view not drawn, unless all are (the selfie booth); the cap counts only those drawn (a
// visible one after a slow page's whole cap of unseen ones is drawn); a one-frame loop at a standstill keeps finite
// numbers; and each instance stands where its visitor is, turned their way.
{
 // (fur colours are drawn on a canvas: fur.js; here, @napi-rs/canvas's)
 const {createCanvas}=await import('@napi-rs/canvas');globalThis.document??={createElement:()=>createCanvas(1,1)};
 const {createCrowdTier}=await import('../src/walk/crowd-tier.js'),{w}=await walker(),scene=new T.Scene();
 const tier=createCrowdTier(scene,{template:w,motion,most:200});
 const camera=new T.PerspectiveCamera(60,16/9,.1,500);camera.position.set(0,1.6,0);camera.lookAt(0,1.6,-10);camera.updateMatrixWorld();
 const visitor=(x,z,o={})=>({cur:{x,y:0,z,yaw:.5},tgt:{rest:null,stance:'stand',fur:0,...o},speed:0});
 const ahead=Array.from({length:10},(_,i)=>visitor(i-5,-10,{fur:i%5})),behind=Array.from({length:156},(_,i)=>visitor(i%20-10,10+Math.floor(i/20)));
 tier.begin(camera);for(const r of ahead)tier.place(r,1/60);tier.end();
 const parts=partsOf(w).length,furred=partsOf(w).filter(p=>p.material.map?.name==='body_BaseColor').length;
 assert.equal(tier.count,10);assert.equal(tier.groups.size,(parts-furred)+furred*5,'a draw for each part, and for each fur colour of a furred one');
 for(const g of tier.groups.values())assert.equal(g.mesh.count,g.mesh.visible?g.mesh.count:0);
 tier.begin(camera);for(const r of behind)tier.place(r,1/60);tier.end();assert.equal(tier.count,0,'behind the camera, none drawn');
 tier.begin(camera,{all:true});for(const r of behind)tier.place(r,1/60);tier.end();assert.equal(tier.count,156,'all drawn for the selfie booth');
 tier.begin(camera,{most:150});for(const r of [...behind,ahead[0]])tier.place(r,1/60);tier.end();assert.equal(tier.count,1,'the visible one after 156 unseen');
 tier.begin(camera,{most:3});for(const r of ahead)tier.place(r,1/60);tier.end();assert.equal(tier.count,3,'a cap of 3');
 const lying=visitor(0,-8,{rest:'lie'});tier.begin(camera);for(let i=0;i<30;i++)tier.place(lying,0);tier.end();
 assert.ok(Number.isFinite(lying.crowd.phase));for(const g of tier.groups.values())for(let i=0;i<g.count*3;i++)assert.ok(Number.isFinite(g.frames.array[i]));
 tier.begin(camera);tier.place(ahead[2],1/60);tier.end();
 const g=[...tier.groups.values()].find(x=>x.count===1),m=new T.Matrix4().fromArray(g.mesh.instanceMatrix.array,0),p=new T.Vector3(),q=new T.Quaternion(),sc=new T.Vector3();m.decompose(p,q,sc);
 assert.ok(p.distanceTo(new T.Vector3(-3,0,-10))<1e-6,`placed at ${p.toArray()}`);assert.ok(Math.abs(new T.Euler().setFromQuaternion(q,'YXZ').y-.5)<1e-6,'turned their way');
 tier.dispose();assert.equal(scene.children.length,0,'disposed, its draws leave the scene');
 pass(`the crowd tier: ${tier.groups.size||'its'} draws by part and fur, culled to the view unless all are wanted, its cap counting only those drawn, finite at a standstill, each placed and turned`);
}
// Loading: a fetch that fails is tried again (remotes.js startCrowd), a moment later, and the crowd comes.
{
 const {build}=await import('./native-bundle.mjs'),path=await import('node:path'),file=path.resolve('output/check-walker',`remotes.${process.pid}.mjs`);
 await fs.mkdir(path.dirname(file),{recursive:true});
 const b=await build({entryPoints:['src/walk/remotes.js'],bundle:true,format:'esm',platform:'node',external:['three'],write:false,target:'es2022',logLevel:'error'});
 await fs.writeFile(file,b.outputFiles[0].text);let RemotePlayers;try{({RemotePlayers}=await import(pathToFileURL(file).href));}finally{await fs.rm(file,{force:true});}
 const {w}=await walker();let calls=0;const realFetch=globalThis.fetch;
 globalThis.fetch=async()=>{calls++;if(calls===1)return {ok:false,status:503};return {ok:true,json:async()=>motion};};
 const warn=console.warn;console.warn=()=>{};
 try{
  const remotes=new RemotePlayers(new T.Scene(),{make:async()=>w,crowdMotion:'walk-crowd.json'});
  remotes.startCrowd(0);await new Promise(r=>setTimeout(r,20));assert.equal(remotes.crowdTier,null);assert.equal(calls,1);
  remotes.startCrowd(performance.now());await new Promise(r=>setTimeout(r,20));assert.equal(calls,1,'not again at once');
  remotes.startCrowd(performance.now()+6e3);await new Promise(r=>setTimeout(r,50));assert.equal(calls,2);assert.ok(remotes.crowdTier,'the crowd came on the second try');
 }finally{globalThis.fetch=realFetch;console.warn=warn;}
 pass('a crowd recording that fails to load is fetched again five seconds later, and the crowd comes');
}
// Who has a body (remotes.js tierOf): the nearest, held steady at the edge. Two visitors walking to and fro across the
// edge of a tier of 4 (one with a body, one without) do not change hands; one coming clearly near takes the place of the
// farthest kept beyond the tier; with room, those at the edge come in; the tier falling, the farthest give theirs back.
{
 const {build}=await import('./native-bundle.mjs'),path=await import('node:path'),file=path.resolve('output/check-walker',`remotes-tier.${process.pid}.mjs`);
 await fs.mkdir(path.dirname(file),{recursive:true});
 const b=await build({entryPoints:['src/walk/remotes.js'],bundle:true,format:'esm',platform:'node',external:['three'],write:false,target:'es2022',logLevel:'error'});
 await fs.writeFile(file,b.outputFiles[0].text);let tierOf;try{({tierOf}=await import(pathToFileURL(file).href));}finally{await fs.rm(file,{force:true});}
 const v=(name,walker)=>({name,walker:walker?{}:null}),names=list=>list.map(x=>x.name).join('');
 // a tier of 4, hold 3 (as remotes.js): A..C near with bodies; D has a body; E has none; they swap ranks 4 and 5 by turns
 let swaps=0,had=null;
 for(let t=0;t<20;t++){const [A,B,C]=[v('A',1),v('B',1),v('C',1)],D=v('D',1),E=v('E',0),shown=t%2?[A,B,C,E,D]:[A,B,C,D,E];
  const now=names(tierOf(shown,4,3));if(had!==null&&now!==had)swaps++;had=now;}
 assert.equal(swaps,0,'the edge did not hold');
 assert.equal(names(tierOf([v('N',0),v('A',1),v('B',1),v('C',1),v('D',1),v('F',1)],4,1)),'NABC','one clearly near takes the place of the farthest kept');
 assert.equal(names(tierOf([v('A',1),v('B',0),v('C',0)],4,3)),'ABC','with room, those at the edge come in');
 assert.equal(names(tierOf([v('A',1),v('B',1),v('C',1),v('D',1),v('E',1)],3,3)),'ABC','the tier falling, the farthest give theirs back');
 assert.equal(tierOf([],4,3).length,0);
 pass('the near tier holds steady at its edge: no change of hands as two cross it to and fro; the clearly near come in, the farthest go first');
}
// The loop each visitor plays.
const pick=(o)=>crowdLoop({rest:null,stance:'stand',swimming:false,speed:0,...o});
assert.equal(pick({}),'idle');assert.equal(pick({speed:1.4}),'walk');assert.equal(pick({speed:5}),'run');
assert.equal(pick({stance:'crouch'}),'crouch');assert.equal(pick({stance:'crouch',speed:1}),'crouchWalk');
assert.equal(pick({stance:'prone'}),'prone');assert.equal(pick({stance:'prone',speed:.5}),'crawl');
assert.equal(pick({emote:'dance'}),'dance');assert.equal(pick({emote:'box',speed:1.4}),'walk');assert.equal(pick({emote:'dance',stance:'crouch'}),'crouch');
assert.equal(pick({emote:'dance',rest:'sit'}),'sit');assert.equal(pick({emote:'play_dead'}),'play_dead');
assert.equal(pick({rest:'sit',speed:3}),'sit');assert.equal(pick({rest:'tube'}),'sit');assert.equal(pick({rest:'lie'}),'lie');assert.equal(pick({swimming:true,speed:1}),'swim');
for(const name of new Set(['idle','walk','run','crouch','crouchWalk','prone','crawl','sit','lie','swim',...EMOTES]))assert.ok(motion.clips.some(c=>c.name===name),name);
pass('each pose picks its loop: standing, walking, running, crouched, crouch-walking, prone, crawling, sitting (and in a tube), lying, swimming, and each emote standing still (one not recorded stands idle)');
console.log(`crowd motion: ${passed} checks passed`);
