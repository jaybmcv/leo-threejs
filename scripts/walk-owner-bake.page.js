// In-page half of scripts/walk-owner-bake.mjs (bundled by it with esbuild; 'three' is the page's own). Runs in a built
// walk opened with ?ownerBake, which keeps geometry arrays and exposes globalThis.__ownerBakeHost {T, scene, renderer,
// camera, key}. Installs globalThis.__ownerBake:
//  setup()          occluders and targets from the scene; returns their counts and the parts/conditions tables.
//  bake(blocks)     per block [i0,k0,j0,i1,k1,j1] (cells of the atrium PVS grid), each owner group proven for the whole
//                   block, then for halves of it where that fails, down to single cells; returns [[i0,k0,j0,i1,k1,j1,
//                   [entry...]]...] with entries [part, [cond...], [cabin id...]?] (parts and conds index setup()'s tables).
//  check(data,n)    the finished bake loaded through the walk's own createOwnerHiding, and n random poses inside its
//                   blocks drawn with and without the hiding: changed pixels per pose (a second plain draw is the noise).
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createOwnerProof,OWNER_PROOF} from '../src/v2/owner-proof.js';
import {createOwnerHiding,ownerBakeProblem,pruneOwnerBake} from '../src/v2/owner-hiding.js';
import {PVS_GRID} from '../src/v2/atrium-pvs.js';
import {collectOccluders,collectTargets} from './walk-owner-bake.scene.js';

const PV=PVS_GRID,NEAR_SLOTS=80;
const cellBox=(i,k,j)=>new T.Box3(new T.Vector3(PV.x0+PV.step*i-PV.step/2,PV.y0+2*k,PV.z0+PV.step*j-PV.step/2),new T.Vector3(PV.x0+PV.step*i+PV.step/2,PV.y0+2*k+2,PV.z0+PV.step*j+PV.step/2));
const blockBox=([i0,k0,j0,i1,k1,j1])=>cellBox(i0,k0,j0).union(cellBox(i1,k1,j1));
// Blocks are one slab tall: they split along their longer horizontal side.
const halves=b=>{const s=b.getSize(new T.Vector3()),a=s.x>=s.z?'x':'z',n=Math.round((b.max[a]-b.min[a])/PV.step),cut=b.min[a]+PV.step*Math.floor(n/2),l=b.clone(),h=b.clone();l.max[a]=cut;h.min[a]=cut;return [l,h];};
// A box of whole cells back to its cell range (inclusive).
const cellsOf=b=>{const c=p=>[Math.round((p.x-PV.x0)/PV.step),Math.floor((p.y-PV.y0)/2),Math.round((p.z-PV.z0)/PV.step)],lo=c(b.min.clone().addScalar(.01)),hi=c(b.max.clone().subScalar(.01));return [lo[0],lo[1],lo[2],hi[0],hi[1],hi[2]];};
const isCell=b=>{const s=b.getSize(new T.Vector3());return s.x<=PV.step+.01&&s.y<=2.01&&s.z<=PV.step+.01;};

let host,proof,targets,parts,partIndex,conditions,bandConds,mergeRoot;
// `seed` {at, yaw}: where the walker stands while the bake runs and checks itself (the decks shown there are those a
// visitor in the baked cells sees).
async function setup(seed){
 host=globalThis.__ownerBakeHost;if(!host?.scene)throw Error('No __ownerBakeHost: open the walk with ?ownerBake');
 if(seed){if(!host.goTo({at:seed.at,yaw:seed.yaw,resolved:true}))throw Error('Could not stand the walker at '+JSON.stringify(seed.at));host.follow.mode='third';host.follow.yaw=(seed.yaw??0)*Math.PI/180;
  for(let n=0;n<60;n++)await new Promise(f=>requestAnimationFrame(f));}
 host.scene.updateMatrixWorld(true);
 const occ=collectOccluders(host.scene),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(occ.positions,3));
 proof=createOwnerProof({bvh:new MeshBVH(g,{indirect:true,maxLeafSize:8}),sides:occ.sides,conds:occ.conds});conditions=occ.conditions;bandConds=occ.bandConds;mergeRoot=occ.mergeRoot;
 targets=collectTargets(host.scene);parts=[];partIndex=new Map();for(const e of targets)for(const p of e.parts){partIndex.set(p,parts.length);parts.push([p.path,p.print]);}
 return {key:host.key,nearMargin:OWNER_PROOF.nearMargin,occluders:occ.stats,conditions:conditions.length,owners:targets.length,parts:parts.length,tables:{parts,conditions}};
}
// The parts of one owner group proven from `box`: [{p, conds}]. The group's plain parts together first, then each. The
// proof splits cell or box itself only for a single cell (a block splits itself first: visit below).
function proveGroup(box,parts,hint){const depth=isCell(box)?undefined:0;
 const out=[],plain=parts.filter(p=>p.boxes),centre=box.getCenter(new T.Vector3());
 const all=new T.Box3();for(const p of plain)for(const b of p.boxes)all.union(b);
 const whole=plain.length>1?proof.prove(box,all,hint,'g:'+plain[0].path,depth):null;
 for(const p of plain){if(whole){out.push({p,conds:whole});continue;}
  const conds=new Set();let ok=true;for(const [n,b] of p.boxes.map((b,n)=>[n,b]).sort((x,y)=>x[1].distanceToPoint(centre)-y[1].distanceToPoint(centre))){const u=proof.prove(box,b,hint,p.path+'#'+n,depth);if(!u){ok=false;break;}for(const k of u)conds.add(k);}
  if(ok)out.push({p,conds});}
 return out;
}
// A cabin part's slots one by one (its nearest NEAR_SLOTS), proven for the whole block only.
function proveSlots(box,p,hint){
 const centre=box.getCenter(new T.Vector3()),ids=[],conds=new Set();
 for(const s of p.slots.map(s=>[s.centre.distanceToSquared(centre),s]).sort((a,b)=>a[0]-b[0]).slice(0,NEAR_SLOTS).map(e=>e[1])){const u=proof.prove(box,s.box,hint,p.path+'@'+s.id,isCell(box)?undefined:0);if(u){ids.push(s.id);for(const k of u)conds.add(k);}}
 return ids.length?{p,conds,slots:ids}:null;
}
async function bake(blocks){
 const out=[],hint=new Map(),started=performance.now();let visits=0;
 // A merge source's triangles draw only while its band shows and the merged pieces' root is drawn: entries relying on a band
 // rely on that root too.
 const withRoot=c=>{const s=new Set(c);if(mergeRoot!==null&&[...s].some(k=>bandConds.has(k)))s.add(mergeRoot);return [...s].sort((a,b)=>a-b);};
 const record=(box,proven)=>{if(!proven.length)return;out.push([...cellsOf(box),proven.map(x=>[partIndex.get(x.p),withRoot(x.conds),...(x.slots?[x.slots]:[])])]);};
 const visit=async(box,parts)=>{visits++;const proven=proveGroup(box,parts,hint);record(box,proven);const done=new Set(proven.map(x=>x.p)),rest=parts.filter(p=>!done.has(p));
  if(!rest.length||isCell(box))return;if(visits%100===0)await new Promise(f=>setTimeout(f,0));for(const h of halves(box))await visit(h,rest);};
 for(const block of blocks){const box=blockBox(block);
  for(const e of targets){const plain=e.parts.filter(p=>p.boxes);if(plain.length)await visit(box.clone(),plain);
   const cabins=e.parts.filter(p=>p.slots).map(p=>proveSlots(box,p,hint)).filter(Boolean);record(box,cabins);}}
 return {blocks:out,visits,ms:Math.round(performance.now()-started),stats:{...proof.stats}};
}
// After the bake: whatever moved or changed since setup is dropped (pruneOwnerBake in src/v2/owner-hiding.js).
const prune=data=>{host.scene.updateMatrixWorld(true);return pruneOwnerBake(data,host.scene);};
// Picture diffs through the walk's own hiding.
async function check(data,poses=60,seed=7){
 const {scene,renderer:r,camera}=host,gl=r.getContext(),hiding=createOwnerHiding(data,{key:host.key,scene});if(!hiding)throw Error('The walk would not use this bake: '+ownerBakeProblem(data,host.key));hiding.resolve();
 const W=r.domElement.width,H=r.domElement.height,A=new Uint8Array(W*H*4),A2=new Uint8Array(W*H*4),B=new Uint8Array(W*H*4);
 const draw=(cam,buf,hide)=>{const rt=r.getRenderTarget();r.setRenderTarget(null);const go=()=>{r.clear();r.render(scene,cam);};if(hide)hiding.around(cam,go);else go();gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,buf);r.setRenderTarget(rt);};
 const diff=(a,b)=>{let big=0,max=0;for(let p=0;p<a.length;p+=4){const d=Math.max(Math.abs(a[p]-b[p]),Math.abs(a[p+1]-b[p+1]),Math.abs(a[p+2]-b[p+2]));if(d>max)max=d;if(d>24)big++;}return {big,max};};
 let s=seed;const rand=()=>(s=(s*16807)%2147483647)/2147483647,rows=[];
 for(let n=0;n<poses;n++){const b=data.blocks[Math.floor(rand()*data.blocks.length)],box=blockBox(b),cam=camera.clone();
  cam.position.set(box.min.x+rand()*(box.max.x-box.min.x),box.min.y+.25+rand()*Math.max(0,box.max.y-box.min.y-.25),box.min.z+rand()*(box.max.z-box.min.z));cam.rotation.set((rand()-.5),rand()*Math.PI*2,0,'YXZ');cam.updateMatrixWorld(true);
  draw(cam,A,false);draw(cam,A2,false);draw(cam,B,true);const noise=diff(A,A2),d=diff(A,B);rows.push({pos:cam.position.toArray().map(v=>+v.toFixed(2)),hidden:hiding.stats.hidden,noise:noise.big,big:d.big,max:d.max});
  if(n%10===9)await new Promise(f=>setTimeout(f,0));}
 return {resolved:hiding.stats.resolved,parts:hiding.stats.parts,condsResolved:hiding.stats.condsResolved,conds:hiding.stats.conds,poses:rows};
}
globalThis.__ownerBake={setup,bake,prune,check};
