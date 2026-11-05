// Visibility broad phase only. Physical capsule queries retain the original collider.
export const VISIBILITY_CELL_SIZE=8;
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
export function createVisibilityQuery(col){const query=Object.create(col);query.near=function*(box,ray=null){if(!ray){yield*col.near(box,ray);return;}const codes=visibilityRayCodes(box,ray);if(!codes){yield*col.near(box,ray);return;}for(let b=bandOf(box.min.y);b<=bandOf(box.max.y);b++){const band=col.bands.get(b);if(band)yield[band.bvh,null,null];}for(const g of col.groups){if(g.items.length<=codes.length*2){for(const item of g.items)if(item.box.intersectsBox(box)&&ray.intersectsBox(item.box))yield[g.bvh,item.inverse,item.matrix];}else{const cells=cellsByCode(g),seen=new Set();for(const c of codes)for(const item of cells.get(c)||[])if(!seen.has(item)){seen.add(item);if(item.box.intersectsBox(box)&&ray.intersectsBox(item.box))yield[g.bvh,item.inverse,item.matrix];}}}for(const m of col.movers)if(m.enabled&&m.box.intersectsBox(box))yield[m.bvh,m.inverse,m.matrix];};return query;}
