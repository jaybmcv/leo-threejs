// Owner hiding: drawables proven hidden from every eye in a 2 m camera cell (src/v2/owner-proof.js), baked by
// scripts/walk-owner-bake.mjs for one exact walk build and configuration (the key) and hidden by the walk around its main
// render call: for the main camera only, and only while what proved them hidden is itself drawn. Cells are the atrium
// PVS grid (atrium-pvs.js). Anything the walk cannot match exactly is not used: nothing is hidden on its account.
import {PVS_GRID} from './atrium-pvs.js';

const PV=PVS_GRID;
export const OWNER_BAKE_VERSION=2;
// The key: bake format, the walk script (its name carries its content hash) and the scene's build configuration.
export const ownerKey=(scriptName,config='')=>OWNER_BAKE_VERSION+'.'+scriptName+'.'+config;
// The bake file for a walk script: walk.<hash>.js -> walk-owner-bake.<hash>.json beside it.
export const ownerBakeFile=scriptName=>{const m=/^walk\.([0-9a-z]+)\.js$/i.exec(scriptName||'');return m?`walk-owner-bake.${m[1]}.json`:null;};
// What the build writes beside a walk script until a bake replaces it: hides nothing, and spares a 404.
export const emptyOwnerBake=(scriptName,config='')=>({version:OWNER_BAKE_VERSION,key:ownerKey(scriptName,config),grid:{x0:PV.x0,z0:PV.z0,step:PV.step,y0:PV.y0},nearMargin:0,parts:[],conds:[],entries:[],blocks:[]});
export const ownerCell=p=>[Math.round((p.x-PV.x0)/PV.step),Math.floor((p.y-PV.y0)/2),Math.round((p.z-PV.z0)/PV.step)];

// A drawable's identity across loads of one build: its path from the scene as [name, place among same-named siblings]
// steps (runtime-made meshes get fresh uuids every load; their names and order do not change).
export function ownerPath(o,scene){
 const steps=[];
 for(let q=o;q&&q!==scene;q=q.parent){let k=0;if(q.parent)for(const s of q.parent.children){if(s===q)break;if(s.name===q.name)k++;}steps.push([q.name||'',k]);}
 return JSON.stringify(steps.reverse());
}
const hash=text=>{let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(36);};
const fixed=a=>Array.from(a,v=>Math.round(v*1e4)).join(',');
// What a drawable was when baked. A mesh: draw counts and range, materials, its whole world transform and, unless it is a
// merged deck piece (whose bounds the walk rewrites as decks show), its local bounds; an instanced mesh adds every slot's
// matrix. A group: its children's names. A part that no longer matches is not used.
export function ownerPrint(o){
 if(!o.isMesh)return 'g'+hash(o.children.map(c=>c.name+'|'+c.type).join(';'));
 const g=o.geometry,count=g.index?g.index.count:g.attributes.position?.count??0,mats=[o.material].flat().map(m=>[m?.type,m?.name,m?.side,m?.transparent?1:0,m?.visible===false?0:1].join(':')).join(',');
 let bounds='';if(!o.userData.sources){if(!g.boundingBox&&g.attributes.position?.array)g.computeBoundingBox();if(!g.boundingBox)return null;bounds=fixed([...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray()]);}
 const slots=o.isInstancedMesh?hash((o.userData.near?.all??[]).map(m=>fixed(m.elements)).join(';')+'|'+fixed(o.instanceMatrix.array.subarray(0,o.count*16))):'';
 return 'm'+hash([count,g.drawRange.start,g.drawRange.count,mats,fixed(o.matrixWorld.elements),bounds,slots,o.userData.sources?.length??0].join('|'));
}
// How far the near plane's corners lie from the eye (null for a camera the bake does not cover).
export function nearCorner(camera){
 if(!camera?.isPerspectiveCamera)return null;const t=Math.tan((camera.getEffectiveFOV?camera.getEffectiveFOV():camera.fov)*Math.PI/360);
 return camera.near*Math.sqrt(1+t*t*(1+camera.aspect*camera.aspect));
}

// The data must be whole before any of it is used.
const ints=(a,max)=>Array.isArray(a)&&a.every(v=>Number.isInteger(v)&&v>=0&&v<max);
function valid(d){
 const strs=a=>Array.isArray(a)&&a.every(r=>Array.isArray(r)&&r.length>=2&&r.length<=3&&r.every(v=>typeof v==='string'));
 if(!strs(d.parts)||!strs(d.conds)||!Array.isArray(d.entries)||!Array.isArray(d.blocks)||!(d.nearMargin>=0))return false;
 const P=d.parts.length,C=d.conds.length,E=d.entries.length;
 return d.entries.every(e=>Array.isArray(e)&&(e.length===2||e.length===3)&&ints([e[0]],P)&&ints(e[1],C)&&(e.length===2||Array.isArray(e[2])&&e[2].every(v=>typeof v==='string')))
  &&d.blocks.every(b=>Array.isArray(b)&&b.length===7&&b.slice(0,6).every(Number.isInteger)&&b[0]<=b[3]&&b[1]<=b[4]&&b[2]<=b[5]&&ints(b[6],E));
}

/** `data` as written by the bake; `{key, scene}`. Returns null when the data is for another build or not whole.
 * Otherwise {resolve(), around(camera, draw), stats}: resolve() matches parts and conditions to the scene once it is
 * built; around() runs `draw` with the camera cell's proven parts hidden, and restores them after whatever happens. */
export function createOwnerHiding(data,{key,scene}){
 if(data?.version!==OWNER_BAKE_VERSION||!key||data.key!==key)return null;
 const g=data.grid;if(['x0','z0','step','y0'].some(k=>g?.[k]!==PV[k])||!valid(data))return null;
 const stats={parts:data.parts.length,resolved:0,conds:data.conds.length,condsResolved:0,cells:0,hidden:0,held:0,dropped:0};
 let parts=null,conds=null,lastCell='',active=[];
 const blocks=data.blocks,inBlock=(b,i,k,j)=>i>=b[0]&&i<=b[3]&&k>=b[1]&&k<=b[4]&&j>=b[2]&&j<=b[5];
 // A resolved object with what it was at resolve(): it is dropped if it moves or changes geometry or material later.
 const snap=o=>({o,matrix:o.matrixWorld.elements.slice(),geometry:o.geometry,material:o.material});
 const same=s=>s.o.geometry===s.geometry&&s.o.material===s.material&&s.o.matrixWorld.elements.every((v,i)=>Math.abs(v-s.matrix[i])<1e-6);
 function resolve(){
  const byPath=new Map();scene.traverse(o=>{if(o===scene)return;const p=ownerPath(o,scene);byPath.set(p,byPath.has(p)?null:o);});// a path met twice matches nothing
  const match=([path,print])=>{const o=byPath.get(path);return o&&ownerPrint(o)===print?snap(o):null;};
  parts=data.parts.map(match);conds=data.conds.map(c=>{const s=match(c);return s?{...s,slot:c[2]??null}:null;});
  stats.resolved=parts.filter(Boolean).length;stats.condsResolved=conds.filter(Boolean).length;lastCell='';
 }
 const inScene=o=>{let q=o;while(q.parent)q=q.parent;return q===scene;};
 const shown=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
 // Is condition k drawn now for this camera: in the scene, shown, on the camera's layers, its materials visible, unmoved;
 // a cabin slot also among those its mesh shows.
 const drawn=(k,camera,memo)=>{let v=memo.get(k);if(v===undefined){const c=conds[k];
   v=!!c&&same(c)&&inScene(c.o)&&shown(c.o)&&(!c.o.isMesh||c.o.layers.test(camera.layers)&&[c.o.material].flat().every(m=>m&&m.visible!==false))&&(c.slot===null||Array.isArray(c.o.userData.currentCabinIds)&&c.o.userData.currentCabinIds.includes(c.slot));
   if(c&&!same(c)){conds[k]=null;stats.dropped++;}memo.set(k,v);}return v;};
 function entriesAt(camera){
  const p=camera.getWorldPosition(camera.position.clone()),[i,k,j]=ownerCell(p),cell=i+','+k+','+j;
  if(cell!==lastCell){lastCell=cell;active=[];for(const b of blocks)if(inBlock(b,i,k,j))for(const e of b[6])active.push(data.entries[e]);stats.cells++;}
  return active;
 }
 // Entry [part, [cond...], [cabin id...]?]: hide the part when it is unchanged, every condition is drawn and, for a
 // cabin part, every cabin it shows now was proven.
 function around(camera,draw){
  const off=[];
  try{
   const near=nearCorner(camera);
   if(parts&&near!==null&&near<=data.nearMargin){const memo=new Map();
    for(const [pi,cs,slots] of entriesAt(camera)){const s=parts[pi];if(!s||!s.o.visible)continue;
     if(!same(s)){parts[pi]=null;stats.dropped++;continue;}
     if(slots){const ids=s.o.userData.currentCabinIds;if(!Array.isArray(ids)||!ids.every(id=>slots.includes(id))){stats.held++;continue;}}
     if(cs.every(k=>drawn(k,camera,memo))){s.o.visible=false;off.push(s.o);}else stats.held++;}}
   stats.hidden=off.length;
   return draw();
  }finally{for(const o of off)o.visible=true;}
 }
 return {resolve,around,stats};
}
