// Visibility broad phase only. Physical capsule queries retain the original collider.
export const VISIBILITY_CELL_SIZE=8;
import * as T from 'three';
import {bandOf} from '../walk/collision.js';
export function visibilityRayCells(box,ray){const s=VISIBILITY_CELL_SIZE,o=ray.origin,d=ray.direction,at=[Math.floor(o.x/s),Math.floor(o.y/s),Math.floor(o.z/s)],dirs=[d.x,d.y,d.z],orig=[o.x,o.y,o.z],lo=[box.min.x,box.min.y,box.min.z],hi=[box.max.x,box.max.y,box.max.z],step=dirs.map(v=>Math.sign(v)),delta=dirs.map(v=>v?Math.abs(s/v):Infinity),next=dirs.map((v,k)=>v?((at[k]+(v>0?1:0))*s-orig[k])/v:Infinity),exit=Math.min(...dirs.map((v,k)=>v?(v>0?hi[k]-orig[k]:lo[k]-orig[k])/v:Infinity));if(!Number.isFinite(exit)||exit<0)return null;const limit=lo.reduce((n,v,k)=>n+Math.ceil((hi[k]-v)/s)+2,8),seen=new Set(),keys=[],add=p=>{const key=p.join(',');if(!seen.has(key)){seen.add(key);keys.push(key);}};for(let n=0;n<limit;n++){add(at);const t=Math.min(...next);if(t>exit+1e-9)return keys;const axes=[0,1,2].filter(k=>Math.abs(next[k]-t)<=1e-10*Math.max(1,Math.abs(t)));for(let mask=1;mask<(1<<axes.length);mask++){const p=at.slice();for(let j=0;j<axes.length;j++)if(mask&(1<<j))p[axes[j]]+=step[axes[j]];add(p);}for(const k of axes){at[k]+=step[k];next[k]+=delta[k];}}return null;}

// The same walk as visibilityRayCells, in the same order with the same arithmetic, naming each cell by a number instead
// of an "x,y,z" string: the strings, their sets and the arrays around them were half of the room-culling pass's time
// (100 ms updates walking through the arrival hall). Returns the codes, or null where visibilityRayCells does.
const code=(x,y,z)=>((x+1024)*2048+(y+1024))*2048+(z+1024);
export function visibilityRayCodes(box,ray){
 const s=VISIBILITY_CELL_SIZE,o=ray.origin,d=ray.direction,at=[Math.floor(o.x/s),Math.floor(o.y/s),Math.floor(o.z/s)],dirs=[d.x,d.y,d.z],orig=[o.x,o.y,o.z],lo=[box.min.x,box.min.y,box.min.z],hi=[box.max.x,box.max.y,box.max.z];
 const step=[0,0,0],delta=[0,0,0],next=[0,0,0];let exit=Infinity;
 for(let k=0;k<3;k++){const v=dirs[k];step[k]=Math.sign(v);delta[k]=v?Math.abs(s/v):Infinity;next[k]=v?((at[k]+(v>0?1:0))*s-orig[k])/v:Infinity;exit=Math.min(exit,v?(v>0?hi[k]-orig[k]:lo[k]-orig[k])/v:Infinity);}
 if(!Number.isFinite(exit)||exit<0)return null;
 let limit=8;for(let k=0;k<3;k++)limit=limit+Math.ceil((hi[k]-lo[k])/s)+2;
 const seen=new Set(),codes=[],add=(x,y,z)=>{const c=code(x,y,z);if(!seen.has(c)){seen.add(c);codes.push(c);}},axes=[0,0,0],p=[0,0,0];
 for(let n=0;n<limit;n++){
  add(at[0],at[1],at[2]);const t=Math.min(next[0],next[1],next[2]);if(t>exit+1e-9)return codes;
  let count=0;for(let k=0;k<3;k++)if(Math.abs(next[k]-t)<=1e-10*Math.max(1,Math.abs(t)))axes[count++]=k;
  for(let mask=1;mask<(1<<count);mask++){p[0]=at[0];p[1]=at[1];p[2]=at[2];for(let j=0;j<count;j++)if(mask&(1<<j))p[axes[j]]+=step[axes[j]];add(p[0],p[1],p[2]);}
  for(let j=0;j<count;j++){const k=axes[j];at[k]+=step[k];next[k]+=delta[k];}
 }
 return null;
}
// Each instance group's "x,y,z" cells (src/walk/collision.js), by code. Prepared groups are fixed once loaded.
const groupCodes=new WeakMap();
function cellsByCode(g){let m=groupCodes.get(g);if(!m){m=new Map();for(const [key,items] of g.cells){const [x,y,z]=key.split(',').map(Number);m.set(code(x,y,z),items);}groupCodes.set(g,m);}return m;}
// One cell index across every instance group, so a ray visits only the copies in its cells instead of looping over every
// group (the loop was a third of the room view's ray time walking on a phone). Rebuilt whenever a group, its copies or its
// cells change; copies are yielded in another order than the per-group loop, which no caller depends on (the nearest hit
// keeps the first of equal distances, and every equal-distance hit is the same point).
function mergedCells(col,state){
 const groups=col.groups;let same=state.groups===groups&&state.sign.length===groups.length*4;
 if(same)for(let i=0,k=0;i<groups.length;i++){const g=groups[i];if(state.sign[k++]!==g||state.sign[k++]!==g.items||state.sign[k++]!==g.items.length||state.sign[k++]!==g.cells.size){same=false;break;}}
 if(same)return state.cells;
 const cells=new Map(),sign=[];
 for(const g of groups){sign.push(g,g.items,g.items.length,g.cells.size);groupCodes.delete(g);for(const [c,items] of cellsByCode(g)){let list=cells.get(c);if(!list)cells.set(c,list=[]);for(const item of items)list.push(g,item);}}
 state.groups=groups;state.sign=sign;state.cells=cells;return cells;
}
export function createVisibilityQuery(col){const query=Object.create(col),state={groups:null,sign:[],cells:null};query.near=function*(box,ray=null){if(!ray){yield*col.near(box,ray);return;}const codes=visibilityRayCodes(box,ray);if(!codes){yield*col.near(box,ray);return;}for(let b=bandOf(box.min.y);b<=bandOf(box.max.y);b++){const band=col.bands.get(b);if(band)yield[band.bvh,null,null];}
 const cells=mergedCells(col,state),seen=new Set();for(const c of codes){const list=cells.get(c);if(list)for(let i=0;i<list.length;i+=2){const item=list[i+1];if(!seen.has(item)){seen.add(item);if(item.box.intersectsBox(box)&&ray.intersectsBox(item.box))yield[list[i].bvh,item.inverse,item.matrix];}}}
 for(const m of col.movers)if(m.enabled&&m.box.intersectsBox(box))yield[m.bvh,m.inverse,m.matrix];};
 // The nearest hit as col.raycast finds it, with each later BVH walk stopped at the best distance so far: a hit at or
 // beyond it could never replace the best (only a strictly nearer one does), so the answer is the same hit.
 query.raycast=function(ray,far=1e4,near=0){
  const box=new T.Box3().setFromPoints([ray.origin,ray.at(far,new T.Vector3())]).expandByScalar(.01);
  let best=null;const local=new T.Ray();
  for(const [bvh,inverse,matrix] of this.near(box,ray)){
   local.copy(ray);if(inverse)local.applyMatrix4(inverse);
   const hit=bvh.raycastFirst(local,T.DoubleSide,near,best?Math.min(far,best.distance):far);
   if(hit&&hit.distance<=far&&(!best||hit.distance<best.distance)){
    const normal=hit.face.normal.clone();if(matrix)normal.transformDirection(matrix);
    if(normal.dot(ray.direction)>0)normal.negate();
    best={distance:hit.distance,point:ray.at(hit.distance,new T.Vector3()),normal};
   }
  }
  return best;
 };
 return query;}
