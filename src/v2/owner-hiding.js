// Owner hiding: drawables proven hidden from every eye in a 2 m camera cell (src/v2/owner-proof.js), baked by
// scripts/walk-owner-bake.mjs for one exact walk build (the key names its script) and hidden by the walk around its main
// render call: for the main camera only, and only while what proved them hidden is itself drawn. Cells are the atrium
// PVS grid (atrium-pvs.js). A cell, part or condition the walk cannot match is simply not used: nothing is hidden there.
import {PVS_GRID} from './atrium-pvs.js';

const PV=PVS_GRID;
export const OWNER_BAKE_VERSION=1;
export const ownerKey=scriptName=>OWNER_BAKE_VERSION+'.'+scriptName;
// The bake file for a walk script: walk.<hash>.js -> walk-owner-bake.<hash>.json beside it.
export const ownerBakeFile=scriptName=>{const m=/^walk\.([0-9a-z]+)\.js$/i.exec(scriptName||'');return m?`walk-owner-bake.${m[1]}.json`:null;};
export const ownerCell=p=>[Math.round((p.x-PV.x0)/PV.step),Math.floor((p.y-PV.y0)/2),Math.round((p.z-PV.z0)/PV.step)];

// A drawable's identity across loads of one build: its path from the scene, each step a name and the place among
// same-named siblings (runtime-made meshes get fresh uuids every load; their names and order do not change).
export function ownerPath(o,scene){
 const steps=[];
 for(let q=o;q&&q!==scene;q=q.parent){let k=0;if(q.parent)for(const s of q.parent.children){if(s===q)break;if(s.name===q.name)k++;}steps.push((q.name||'')+'#'+k);}
 return steps.reverse().join('/');
}
const cm=v=>Math.round(v*100);
// What a drawable was when baked: draw counts, materials and its world bounding sphere to the centimetre; for a group,
// its child count. A part that no longer matches is not used.
export function ownerPrint(o){
 if(!o.isMesh)return 'g'+o.children.length;
 const g=o.geometry,count=g.index?g.index.count:g.attributes.position?.count??0,mats=[o.material].flat().map(m=>(m?.name||'')+':'+(m?.side??0)+(m?.transparent?'t':'')).join(',');
 if(!g.boundingSphere&&g.attributes.position?.array)g.computeBoundingSphere();const s=g.boundingSphere;if(!s)return null;
 const c=s.center.clone().applyMatrix4(o.matrixWorld),r=s.radius*o.matrixWorld.getMaxScaleOnAxis(),n=o.isInstancedMesh?(o.userData.near?.all?.length??o.instanceMatrix.count):1;
 return [count,n,mats,cm(c.x),cm(c.y),cm(c.z),cm(r)].join('|');
}

/** `data` as written by the bake; `{key, scene}`. Returns null when the data is for another build. Otherwise
 * {resolve(), around(camera, draw), stats}: resolve() matches parts and conditions to the scene once it is built;
 * around() runs `draw` with the camera cell's proven parts hidden and restores them after. */
export function createOwnerHiding(data,{key,scene}){
 if(data?.version!==OWNER_BAKE_VERSION||!key||data.key!==key)return null;
 const g=data.grid;if(['x0','z0','step','y0'].some(k=>g?.[k]!==PV[k]))return null;
 const stats={parts:data.parts.length,resolved:0,conds:data.conds.length,condsResolved:0,cells:0,hidden:0,held:0};
 let parts=null,conds=null,lastCell='',active=[];
 // Entries by cell: each block [i0,k0,j0,i1,k1,j1,[entry...]] covers the cells i0..i1, k0..k1, j0..j1.
 const blocks=data.blocks,inBlock=(b,i,k,j)=>i>=b[0]&&i<=b[3]&&k>=b[1]&&k<=b[4]&&j>=b[2]&&j<=b[5];
 function resolve(){
  const byPath=new Map();scene.traverse(o=>{if(o!==scene)byPath.set(ownerPath(o,scene),o);});
  const match=([path,print])=>{const o=byPath.get(path);return o&&ownerPrint(o)===print?o:null;};
  parts=data.parts.map(match);conds=data.conds.map(c=>{const o=match(c);return o?{o,slot:c[2]??null}:null;});
  stats.resolved=parts.filter(Boolean).length;stats.condsResolved=conds.filter(Boolean).length;lastCell='';
 }
 const shown=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
 // Is condition k drawn now? An object shown (every ancestor visible); a cabin slot also among those its mesh shows.
 const drawn=(k,memo)=>{let v=memo.get(k);if(v===undefined){const c=conds[k];v=!!c&&shown(c.o)&&(c.slot===null||(c.o.userData.currentCabinIds||[]).includes(c.slot));memo.set(k,v);}return v;};
 function entriesAt(camera){
  const p=camera.getWorldPosition(camera.position.clone()),[i,k,j]=ownerCell(p),cell=i+','+k+','+j;
  if(cell!==lastCell){lastCell=cell;active=[];for(const b of blocks)if(inBlock(b,i,k,j))for(const e of b[6])active.push(data.entries[e]);stats.cells++;}
  return active;
 }
 // Entry [part, [cond...], [cabin id...]?]: hide the part when every condition is drawn and, for a cabin part, every
 // cabin it shows now was proven.
 function around(camera,draw){
  if(!parts)return draw();
  const memo=new Map(),off=[];
  for(const [pi,cs,slots] of entriesAt(camera)){const o=parts[pi];if(!o||!o.visible)continue;
   if(slots&&!(o.userData.currentCabinIds||[]).every(id=>slots.includes(id))){stats.held++;continue;}
   if(cs.every(k=>drawn(k,memo))){o.visible=false;off.push(o);}else stats.held++;}
  stats.hidden=off.length;
  try{return draw();}finally{for(const o of off)o.visible=true;}
 }
 return {resolve,around,stats};
}
