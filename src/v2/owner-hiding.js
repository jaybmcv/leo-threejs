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
// Its print with its world matrix brought up to date from its transforms first: the walk skips a hidden branch's matrix
// update, so one moved while hidden would still match by its old world matrix.
const printNow=o=>{o.updateWorldMatrix(true,false);return ownerPrint(o);};
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

/** The bake's data checked against `scene` as it is now: every part and condition that no longer matches (it moved or
 * changed since it was recorded) is dropped with every entry relying on it, and the tables shrink to what the entries
 * still use. Returns {data, dropped: {parts, conds, entries, blocks}}. */
export function pruneOwnerBake(data,scene){
 const byPath=new Map();scene.traverse(o=>{if(o===scene)return;const p=ownerPath(o,scene);byPath.set(p,byPath.has(p)?null:o);});
 const ok=([path,print])=>{const o=byPath.get(path);return !!o&&printNow(o)===print;},partOk=data.parts.map(ok),condOk=data.conds.map(ok);
 const kept=new Map(),entries=[];data.entries.forEach((e,i)=>{if(partOk[e[0]]&&e[1].every(k=>condOk[k])){kept.set(i,entries.length);entries.push(e);}});
 const index=list=>{const m=new Map();[...new Set(list)].sort((a,b)=>a-b).forEach((v,i)=>m.set(v,i));return m;},pIdx=index(entries.map(e=>e[0])),cIdx=index(entries.flatMap(e=>e[1]));
 const blocks=data.blocks.map(b=>[...b.slice(0,6),b[6].filter(i=>kept.has(i)).map(i=>kept.get(i))]).filter(b=>b[6].length);
 return {data:{...data,parts:[...pIdx.keys()].map(i=>data.parts[i]),conds:[...cIdx.keys()].map(i=>data.conds[i]),entries:entries.map(([p,cs,slots])=>[pIdx.get(p),cs.map(k=>cIdx.get(k)),...(slots?[slots]:[])]),blocks},
  dropped:{parts:partOk.filter(x=>!x).length,conds:condOk.filter(x=>!x).length,entries:data.entries.length-entries.length,blocks:data.blocks.length-blocks.length}};
}
/** Why the walk would not use `data` (a short reason), or null when it would. */
export function ownerBakeProblem(data,key){
 if(data?.version!==OWNER_BAKE_VERSION)return 'format '+data?.version+', not '+OWNER_BAKE_VERSION;
 if(!key||data.key!==key)return 'key '+data?.key+', not '+key;
 const g=data.grid;if(['x0','z0','step','y0'].some(k=>g?.[k]!==PV[k]))return 'another grid';
 return valid(data)?null:'not whole (a table, entry or block out of shape)';
}
/** `data` as written by the bake; `{key, scene}`. Returns null when the data is for another build or not whole.
 * Otherwise {resolve(), around(camera, draw), stats}: resolve() matches parts and conditions to the scene once it is
 * built; around() runs `draw` with the camera cell's proven parts hidden, and restores them after whatever happens. */
export function createOwnerHiding(data,{key,scene}){
 if(ownerBakeProblem(data,key))return null;
 const stats={parts:data.parts.length,resolved:0,conds:data.conds.length,condsResolved:0,cells:0,hidden:0,held:0,dropped:0};
 let parts=null,conds=null,lastCell=NaN,active=[];
 const blocks=data.blocks,entries=data.entries,inBlock=(b,i,k,j)=>i>=b[0]&&i<=b[3]&&k>=b[1]&&k<=b[4]&&j>=b[2]&&j<=b[5];
 // A cabin entry's proven cabins as a set (checked every frame against the up to 40 its mesh shows).
 const slotSets=entries.map(e=>e[2]?new Set(e[2]):null);
 // A resolved object with what it was at resolve(): it is dropped if it moves or changes geometry or material later.
 // Moving is read from what makes its world matrix: the transform of it and of each node above it (position, rotation,
 // scale and pivot, or the matrix itself when set by hand) and each one's parent. The world matrix is not compared: the
 // walk skips a hidden branch's matrix update (prepared-static.js), and refreshing it every frame cost 0.7 ms. A node is
 // checked once a frame however many parts sit under it.
 const nodes=new Map();
 const fill=(q,v)=>{if(!q.matrixAutoUpdate){v.set(q.matrix.elements);return v;}const p=q.position,r=q.quaternion,s=q.scale,c=q.pivot;
  v[0]=p.x;v[1]=p.y;v[2]=p.z;v[3]=r.x;v[4]=r.y;v[5]=r.z;v[6]=r.w;v[7]=s.x;v[8]=s.y;v[9]=s.z;v[10]=c?c.x:0;v[11]=c?c.y:0;v[12]=c?c.z:0;return v;};
 const node=q=>{let n=nodes.get(q);if(!n){n={q,parent:q.parent,auto:q.matrixAutoUpdate,pivot:q.pivot??null,was:fill(q,new Float64Array(16)),now:new Float64Array(16),frame:-1,ok:true};nodes.set(q,n);}return n;};
 const still=n=>{if(n.frame===frame)return n.ok;n.frame=frame;const q=n.q;
  n.ok=q.parent===n.parent&&q.matrixAutoUpdate===n.auto&&(q.pivot??null)===n.pivot;
  if(n.ok){const a=fill(q,n.now),b=n.was,len=n.auto?13:16;for(let i=0;i<len;i++)if(Math.abs(a[i]-b[i])>=1e-6){n.ok=false;break;}}
  return n.ok;};
 const snap=o=>{const chain=[];for(let q=o;q;q=q.parent)chain.push(node(q));return {o,chain,geometry:o.geometry,material:o.material};};
 const same=s=>{if(s.o.geometry!==s.geometry||s.o.material!==s.material)return false;for(const n of s.chain)if(!still(n))return false;return true;};
 // Each condition's answer is worked out once a frame: frame number and answer per condition.
 let frame=0,condFrame=new Uint32Array(0),condValue=new Uint8Array(0);
 function resolve(){
  const byPath=new Map();scene.traverse(o=>{if(o===scene)return;const p=ownerPath(o,scene);byPath.set(p,byPath.has(p)?null:o);});// a path met twice matches nothing
  nodes.clear();const match=([path,print])=>{const o=byPath.get(path);return o&&printNow(o)===print?snap(o):null;};
  parts=data.parts.map(match);conds=data.conds.map(c=>{const s=match(c);return s?{...s,slot:c[2]??null}:null;});
  condFrame=new Uint32Array(conds.length);condValue=new Uint8Array(conds.length);
  stats.resolved=parts.filter(Boolean).length;stats.condsResolved=conds.filter(Boolean).length;lastCell=NaN;
 }
 const inScene=o=>{let q=o;while(q.parent)q=q.parent;return q===scene;};
 const shown=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
 const materialsOn=o=>{const m=o.material;if(!Array.isArray(m))return !!m&&m.visible!==false;for(const x of m)if(!x||x.visible===false)return false;return true;};
 // Is condition k drawn now for this camera: in the scene, shown, on the camera's layers, its materials visible, unmoved;
 // a cabin slot also among those its mesh shows.
 function drawn(k,camera){
  if(condFrame[k]===frame)return condValue[k]===1;
  const c=conds[k];let v=false;
  if(c){if(!same(c)){conds[k]=null;stats.dropped++;}
   else v=inScene(c.o)&&shown(c.o)&&(!c.o.isMesh||c.o.layers.test(camera.layers)&&materialsOn(c.o))&&(c.slot===null||Array.isArray(c.o.userData.currentCabinIds)&&c.o.userData.currentCabinIds.includes(c.slot));}
  condFrame[k]=frame;condValue[k]=v?1:0;return v;
 }
 // The camera cell's entries (by index), gathered again only when the camera changes cell.
 function entriesAt(camera){
  const e=camera.matrixWorld.elements,i=Math.round((e[12]-PV.x0)/PV.step),k=Math.floor((e[13]-PV.y0)/2),j=Math.round((e[14]-PV.z0)/PV.step),cell=(k*4096+i)*4096+j;
  if(cell!==lastCell){lastCell=cell;active=[];for(const b of blocks)if(inBlock(b,i,k,j))for(const n of b[6])active.push(n);stats.cells++;}
  return active;
 }
 const off=[];
 // Entry [part, [cond...], [cabin id...]?]: hide the part when it is unchanged, every condition is drawn and, for a
 // cabin part, every cabin it shows now was proven.
 function around(camera,draw){
  off.length=0;
  try{
   const near=nearCorner(camera);
   if(parts&&near!==null&&near<=data.nearMargin){frame=frame+1>>>0||1;
    for(const n of entriesAt(camera)){const [pi,cs]=entries[n],s=parts[pi];if(!s||!s.o.visible)continue;
     if(!same(s)){parts[pi]=null;stats.dropped++;continue;}
     const slots=slotSets[n];if(slots){const ids=s.o.userData.currentCabinIds;let all=Array.isArray(ids);if(all)for(const id of ids)if(!slots.has(id)){all=false;break;}if(!all){stats.held++;continue;}}
     let ok=true;for(const k of cs)if(!drawn(k,camera)){ok=false;break;}
     if(ok){s.o.visible=false;off.push(s.o);}else stats.held++;}}
   stats.hidden=off.length;
   return draw();
  }finally{for(const o of off)o.visible=true;off.length=0;}
 }
 return {resolve,around,stats};
}
