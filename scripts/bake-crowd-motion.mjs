// The crowd's motion (src/walk/crowd-tier.js): loops recorded from Cosmo's own rig (avatar.js and the vendored Voyager's
// Reach figure) for the visitors beyond the nearest few, who are drawn without a rig of their own. Each loop is a fresh
// walker held in one steady state (standing, walking, running, crouched, crouch-walking, prone, crawling, sitting,
// lying, swimming), solved every frame at 60 Hz from rest until it has settled, then recorded FPS times a second and cut
// where it comes round again (record, below). What is kept of a frame is each bone's
// skinning matrix (the bone's world matrix times its inverse bind) for a body at the origin facing yaw 0, its top three
// rows, as half floats: the crowd's vertex shader skins with them and the instance's own place and turn.
// With it, lighter meshes for the farther (crowd-lod.mjs: each of the body's parts' index, simplified). The file carries
// the hash of the sources the rig and this recording are made from (RIG): check-crowd-motion.mjs fails when they change
// and it was not recorded again.
//   node scripts/bake-crowd-motion.mjs   (writes src/walk/assets/crowd-motion.json; prints each loop and its seam)
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadImage} from '@napi-rs/canvas';
import * as T from 'three';
import {build} from './native-bundle.mjs';
import {crowdLods} from './crowd-lod.mjs';

export const OUT='src/walk/assets/crowd-motion.json';
const FPS=15,EMOTE_FPS=10,STEP=1/60,WARM_S=3,MIN_S=.5,CROSS_S=.3,EMOTE_CROSS_S=.6;
// What the recording depends on: the rig, the walker round it, its motion, this script and the lighter meshes'.
export const RIG=['src/walk/avatar.js','src/walk/rig-pace.js','src/walk/solved-pose.js','src/walk/merged-skin.js','src/vendor/cosmo/DLCat.js',
 'src/walk/assets/ecctrl-locomotion.json','src/walk/assets/cosmo-emotes.json','scripts/bake-crowd-motion.mjs','scripts/crowd-lod.mjs'];
const RIG_DIRS=['src/walk/vr'];
// The loops: [name, state for the walker's update, seconds recorded (the longest a loop may be)], the speed (m/s) a
// moving loop was recorded at, which the crowd scales its pace by, and its frames a second (FPS; the emotes, standing,
// EMOTE_FPS: they are seen from afar). Lying, the body turns as remotes.js turns it. Each emote is recorded long enough
// to come round whole (fix, kneeling, is 5.2 s; box and spell turn through two moves each); play dead holds its last
// pose, breathing. An emote's way round is faded over EMOTE_CROSS_S (a punch or a spell's moves come in their own
// order, and seldom round to the first exactly). Talk and interact are not called in Captain Says, and stand in the crowd.
export const EMOTES=['dance','slash','push','fix','pick_up','box','spell','play_dead'];
const EMOTE_S={fix:6.5,box:8,spell:8};
export const LOOPS=[
 ['idle',{},4],['walk',{speed:1.4},2.5,1.4],['run',{speed:5},2,5],
 ['crouch',{stance:'crouch'},3],['crouchWalk',{stance:'crouch',speed:1},2.5,1],
 ['prone',{stance:'prone'},3],['crawl',{stance:'prone',speed:.6},3,.6],
 ['sit',{rest:'sit'},3],['lie',{rest:'lie'},3],['swim',{swimming:true,speed:1},3,1],
 ...EMOTES.map(e=>[e,{emote:e},EMOTE_S[e]??4,0,EMOTE_FPS,EMOTE_CROSS_S]),
];
const PILLOW_TILT=.12;

export async function rigHash(){
 const files=[...RIG];
 for(const dir of RIG_DIRS)for(const name of (await fs.readdir(dir)).sort())files.push(path.join(dir,name).replaceAll('\\','/'));
 const h=createHash('sha256');for(const f of files){h.update(f+'\0');h.update((await fs.readFile(f,'utf8')).replace(/\r\n/g,'\n'));h.update('\0');}
 return h.digest('hex');
}

// avatar.js imports the rig's TypeScript, which Node cannot strip alone: bundled for Node, sharing this three (as
// check-visitor-bones.mjs does).
async function walkers(){
 const out=path.resolve('output/check-walker');await fs.mkdir(out,{recursive:true});
 const file=path.join(out,`avatar-bake.${process.pid}.mjs`);
 const b=await build({entryPoints:['src/walk/avatar.js'],bundle:true,format:'esm',platform:'node',external:['three'],write:false,target:'es2022',logLevel:'error'});
 await fs.writeFile(file,b.outputFiles[0].text);let createWalker;try{({createWalker}=await import('file://'+file.replaceAll('\\','/')));}finally{await fs.rm(file,{force:true});}
 const {createDLCat}=await import('../src/vendor/cosmo/DLCat.js');
 const source=await fs.readFile('src/vendor/cosmo/DLCat.js','utf8'),images=JSON.parse(source.match(/var images = (.*);/)[1]);
 T.Cache.enabled=true;for(const image of images)T.Cache.add('image:'+image.dataUri,await loadImage(image.dataUri));
 const motion=JSON.parse(await fs.readFile('src/walk/assets/ecctrl-locomotion.json','utf8')),emotes=JSON.parse(await fs.readFile('src/walk/assets/cosmo-emotes.json','utf8'));
 return async()=>{const w=await createWalker(createDLCat,motion,{mergeDraws:true}),scene=new T.Scene();w.figure.attachEmotes(emotes);scene.add(w.holder);return {w,scene};};
}

// The skinned parts a walker draws (merged-skin.js), on one skeleton.
export const partsOf=w=>{const parts=[];w.figure.root.traverse(o=>{if(o.isSkinnedMesh&&o.visible)parts.push(o);});return parts;};

// One loop: the state held, recorded at 60 Hz, its period found (where a run of frames is most like the first run, from
// MIN_S on), its last CROSS_S faded into its first so it comes round without a jump, and resampled to FPS with the
// period shared evenly between its frames. seam: the step from its last frame round to its first, over the biggest
// step within it (a punch is quick: what matters is that coming round is no jump beside the loop's own moves).
async function record(make,[name,state,seconds,speed,fps=FPS,crossS=CROSS_S]){
 const {w,scene}=await make(),skeleton=partsOf(w)[0].skeleton,bones=skeleton.bones.length;
 const rest=state.rest?{kind:state.rest,weight:1,seatHeight:w.hipHeight}:null;
 const s={speed:0,grounded:true,stance:'stand',jumpCount:1,jumpS:-1,turnRate:0,accel:0,rise:0,emote:null,...state,rest};
 if(state.rest==='lie')w.body.rotation.set(-Math.PI/2+PILLOW_TILT,0,0);
 for(let t=0;t<WARM_S;t+=STEP)w.update(STEP,s);
 const raw=[];
 for(let i=0;i<Math.round(seconds/STEP);i++){
  w.update(STEP,s);scene.updateMatrixWorld(true);skeleton.update();const m=skeleton.boneMatrices,f=new Float32Array(bones*12);
  for(let b=0;b<bones;b++){const e=b*16,o=b*12;f.set([m[e],m[e+1],m[e+2],m[e+4],m[e+5],m[e+6],m[e+8],m[e+9],m[e+10],m[e+12],m[e+13],m[e+14]],o);}
  raw.push(f);
 }
 w.dispose?.();
 const diff=(a,b)=>{let d=0;for(let k=0;k<a.length;k++)d+=Math.abs(a[k]-b[k]);return d/a.length;};
 // A loop that never moves (nothing differs) is one frame.
 if(raw.every(f=>diff(raw[0],f)<1e-6))return {name,frames:[raw[0]],bones,speed:speed??0,fps,seam:0};
 const RUN=6,cross=Math.round(crossS/STEP);let period=raw.length-cross-RUN,best=Infinity;
 for(let p=Math.round(MIN_S/STEP);p+RUN+cross<=raw.length;p++){let d=0;for(let k=0;k<RUN;k++)d+=diff(raw[k],raw[p+k]);if(d<best){best=d;period=p;}}
 // Faded: the first `cross` frames lean from what followed the period (the loop's way round) to their own.
 const c=Math.min(cross,Math.floor(period/3)),loop=raw.slice(0,period).map((f,i)=>{if(i>=c)return f;const u=i/c,g=raw[period+i],o=new Float32Array(f.length);
  for(let k=0;k<f.length;k++)o[k]=g[k]+(f[k]-g[k])*u;return o;});
 const n=Math.max(2,Math.round(period*STEP*fps)),frames=[];
 for(let i=0;i<n;i++){const x=i*period/n,a=Math.floor(x),u=x-a,p=loop[a],q=loop[(a+1)%period],o=new Float32Array(p.length);for(let k=0;k<p.length;k++)o[k]=p[k]+(q[k]-p[k])*u;frames.push(o);}
 const steps=frames.map((f,i)=>diff(f,frames[(i+1)%n])),within=Math.max(...steps.slice(0,-1))||1e-9;
 return {name,frames,bones,speed:speed??0,fps,seam:steps[n-1]/within};
}

// One loop recorded afresh, and the walker it was recorded on (for check-crowd-motion.mjs).
export async function recordLoop(name){
 const make=await walkers(),loop=LOOPS.find(l=>l[0]===name);if(!loop)throw Error('no loop '+name);
 return record(make,loop);
}
// A walker to compare with (merged draws, as the crowd's template).
export async function walker(){return (await walkers())();}

export async function bake(){
 const make=await walkers(),loops=[];
 for(const loop of LOOPS){const r=await record(make,loop);loops.push(r);console.log(`${r.name}: ${r.frames.length} frames (${(r.frames.length/r.fps).toFixed(2)} s), seam ${r.seam.toFixed(5)}`);}
 const bones=loops[0].bones,total=loops.reduce((s,l)=>s+l.frames.length,0),half=new Uint16Array(total*bones*12);let at=0;
 const clips=loops.map(l=>{const start=at/(bones*12);for(const f of l.frames)for(let k=0;k<f.length;k++)half[at++]=T.DataUtils.toHalfFloat(f[k]);
  return {name:l.name,start,frames:l.frames.length,speed:l.speed,fps:l.fps,seam:+l.seam.toFixed(6)};});
 const {w}=await make(),lods=await crowdLods(partsOf(w));w.dispose?.();
 for(const l of lods)console.log(`lighter, to ${(l.error*1000).toFixed(1)} mm: ${l.parts.map(p=>`${p.name} ${p.triangles}`).join(', ')}`);
 return {version:1,rig:await rigHash(),fps:FPS,bones,clips,data:Buffer.from(half.buffer).toString('base64'),lods};
}

if(process.argv[1]?.replaceAll('\\','/').endsWith('scripts/bake-crowd-motion.mjs')){
 const baked=await bake();await fs.writeFile(OUT,JSON.stringify(baked));
 console.log(`${OUT}: ${baked.clips.length} loops, ${baked.bones} bones, ${baked.clips.reduce((s,c)=>s+c.frames,0)} frames, ${(baked.data.length/1024).toFixed(0)} KB`);
}
