// patchDepth, patchNormal and patchProfile of plan/hull-skin-v2.js, reading a (u, y) grid of each patch's triangles
// instead of scanning the whole patch for every sample. Kept apart from hull-skin-v2.js, whose code keys the geometry
// caches (scripts/build-cache-v2.mjs), so using it here changes no cache key.
// A sample tests its cell's triangles in patch order and keeps the same best, so every answer equals the scan's.
// A triangle sits in each cell its bounds touch, grown by a thousandth of its size plus a micrometre. A point outside
// that is at least 5e-4 outside the triangle in barycentric terms, while the test allows 1e-6 and, for triangles at
// least 1 mm across with size^2/|d| <= 1e4, its rounding stays below 2e-8 of the true value. Slivers and specks, where
// rounding could reach further, are tested by every sample: they stay in one list, merged in by patch order.
// The edge fallback answers only within a micrometre, so it reads a second grid of every triangle (degenerate ones
// too) grown by 10 micrometres; coordinates stay under 1e6 m, where rounding of a point on an edge is far below that.
// patchDepth and patchNormal keep each patch's grid: their callers pass layout patches, which never change once
// hydrated, and a checksum of each kept patch's numbers lets verifyPatchGrids (before the prepared walk is saved) throw
// if one did. patchProfile, often handed a fresh copy, uses a kept grid or builds one for that call only. A patch that
// is small, not within 1e6 m or not worth a grid is scanned, as before.
const grids=new WeakMap(),sums=[],LIMIT=1e6,bits=new Float64Array(1),words=new Uint32Array(bits.buffer);
const checksum=patch=>{let h=patch.length|0;for(const t of patch){h=Math.imul(h^t.length,16777619);for(const p of t){h=Math.imul(h^p.length,16777619);for(const v of p){bits[0]=v;h=Math.imul(h^words[0],16777619);h=Math.imul(h^words[1],16777619);}}}return h;};
export function verifyPatchGrids(){for(const [patch,sum]of sums)if(checksum(patch)!==sum)throw Error('A sampled skin patch changed after its grid was built');}
const kept=patch=>{let g=grids.get(patch);if(!g){g=grid(patch);grids.set(patch,g);if(g.cell)sums.push([patch,checksum(patch)]);}return g;};
function grid(patch){
 let u0=Infinity,u1=-Infinity,y0=Infinity,y1=-Infinity,within=true;
 for(const t of patch)for(const p of t){if(!(Math.abs(p[0])<=LIMIT&&Math.abs(p[1])<=LIMIT))within=false;if(p[0]<u0)u0=p[0];if(p[0]>u1)u1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1];}
 const g={};
 if(!within)return g;
 const n=Math.max(1,Math.min(256,Math.round(Math.sqrt(patch.length/4)))),su=(u1-u0)/n||1,sy=(y1-y0)/n||1;
 const cell=(v,lo,s)=>{const i=Math.floor((v-lo)/s);return i<0?0:i>n-1?n-1:i;};
 // Per triangle: its face cells (-1 when the test skips it, -2 when every sample tests it) and its edge cells.
 const face=new Int32Array(patch.length*4),edge=new Int32Array(patch.length*4);let members=0,every=0;
 for(let k=0;k<patch.length;k++){
  const [a,b,c]=patch[k],d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  const lu=Math.min(a[0],b[0],c[0]),hu=Math.max(a[0],b[0],c[0]),ly=Math.min(a[1],b[1],c[1]),hy=Math.max(a[1],b[1],c[1]),size=Math.max(hu-lu,hy-ly);
  const put=(to,m)=>{const i0=to[k*4]=cell(lu-m,u0,su),i1=to[k*4+1]=cell(hu+m,u0,su),j0=to[k*4+2]=cell(ly-m,y0,sy),j1=to[k*4+3]=cell(hy+m,y0,sy);members+=(i1-i0+1)*(j1-j0+1);};
  put(edge,size*1e-3+1e-5);
  // The scan skips these before testing anything.
  if(Math.abs(d)<1e-10)face[k*4]=-1;else if(size>=1e-3&&size*size/Math.abs(d)<=1e4)put(face,size*1e-3+1e-6);else{face[k*4]=-2;every++;}
 }
 // Not worth it when most triangles are tested by every sample or the cells would hold far more than the patch.
 if(every*4>patch.length||members>16*patch.length+2*n*n)return g;
 // Cells as one index list each (start offsets, then triangle indices in patch order).
 const pack=ranges=>{const start=new Int32Array(n*n+1),all=[];
  for(let k=0;k<patch.length;k++){const i0=ranges[k*4];if(i0===-2){all.push(k);continue;}if(i0<0)continue;for(let i=i0;i<=ranges[k*4+1];i++)for(let j=ranges[k*4+2];j<=ranges[k*4+3];j++)start[i*n+j+1]++;}
  for(let i=0;i<n*n;i++)start[i+1]+=start[i];
  const items=new Int32Array(start[n*n]),at=start.slice(0,n*n);
  for(let k=0;k<patch.length;k++){const i0=ranges[k*4];if(i0<0)continue;for(let i=i0;i<=ranges[k*4+1];i++)for(let j=ranges[k*4+2];j<=ranges[k*4+3];j++)items[at[i*n+j]++]=k;}
  return {start,items,every:Int32Array.from(all)};};
 return Object.assign(g,{u0,y0,su,sy,n,cell,faces:pack(face),edges:pack(edge)});
}
// Calls visit with the triangles a sample at (u, y) must test, in patch order (g: the patch's grid, if any).
function eachCandidate(patch,g,u,y,kind,visit){
 if(!g?.cell||!(Math.abs(u)<=LIMIT&&Math.abs(y)<=LIMIT)){for(const t of patch)visit(t);return;}
 const {start,items,every}=g[kind],c=g.cell(u,g.u0,g.su)*g.n+g.cell(y,g.y0,g.sy),end=start[c+1];let i=start[c],j=0;
 while(i<end||j<every.length)visit(patch[j>=every.length||i<end&&items[i]<every[j]?items[i++]:every[j++]]);
}
function samplePatch(patch,u,y,g){let best=null;eachCandidate(patch,g,u,y,'faces',([a,b,c])=>{const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-10)return;const t=((b[1]-c[1])*(u-c[0])+(c[0]-b[0])*(y-c[1]))/d,s=((c[1]-a[1])*(u-c[0])+(a[0]-c[0])*(y-c[1]))/d;if(Math.min(t,s,1-t-s)<-1e-6)return;const q=a.map((v,k)=>t*v+s*b[k]+(1-t-s)*c[k]);if(q[2]>0&&(!best||q[2]<best[2]))best=q;});if(best)return best;let nearest=null,distance=Infinity;eachCandidate(patch,g,u,y,'edges',t=>{for(let i=0;i<3;i++){const x=t[i],z=t[(i+1)%3],dx=z[0]-x[0],dy=z[1]-x[1],f=Math.max(0,Math.min(1,((u-x[0])*dx+(y-x[1])*dy)/(dx*dx+dy*dy||1))),dist=Math.hypot(x[0]+f*dx-u,x[1]+f*dy-y);if(dist<distance){distance=dist;nearest=x.map((v,k)=>v+f*(z[k]-v));}}});
return distance<=1e-6&&nearest?.[2]>0?nearest:null;}
const gridFor=patch=>patch.length<48?null:kept(patch);
export function patchDepth(patch,u,y){const q=samplePatch(patch,u,y,gridFor(patch));if(!q)throw Error('No actual skin at chart '+[u,y]);return q[2];}
export function patchNormal(patch,u,y){const q=samplePatch(patch,u,y,gridFor(patch));if(!q||q.length<6)return null;const n=q.slice(3,6),l=Math.hypot(...n);return n.map(v=>v/l);}
export function patchProfile(patch,y,u0,u1,step=.15){const g=patch.length<48?null:grids.get(patch)||grid(patch),depth=(u,y)=>{const q=samplePatch(patch,u,y,g);if(!q)throw Error('No actual skin at chart '+[u,y]);return q[2];},us=[u0,u1];for(const t of patch)for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3];if(Math.abs(a[1]-y)<1e-6)us.push(a[0]);if((a[1]-y)*(b[1]-y)<0)us.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}for(let u=u0;u<u1;u+=step)us.push(u);return [...new Set(us.filter(u=>u>=u0-1e-6&&u<=u1+1e-6).map(u=>Math.max(u0,Math.min(u1,u))))].sort((a,b)=>a-b).map(u=>[u,y,depth(u,y)]);}
