// Lighter meshes for the crowd's farther visitors (src/walk/crowd-tier.js), made when its motion is baked
// (bake-crowd-motion.mjs) and carried in the same file. Each of the template's skinned parts is simplified by
// meshoptimizer to within each of ERRORS, its index only: a lighter mesh draws the same vertices, skinned the same way.
// Permissive, it may close across a seam of the normals (at a pixel the shading does not show it), but never across a
// seam of the colour map: every vertex at a place with more than one UV is Protect (a triangle across one would draw
// the stretch of the atlas between). The colour map's coordinates weigh too, as metres of the part's surface a UV unit
// (the 90th percentile of its triangles'), over the part's extent (meshoptimizer measures positions in it and weighs
// attributes as given). Small and thin pieces are kept whole (Lock): under SMALL_M2 (a shoe's details), or of an area
// under THIN times their length squared (whiskers, eyelids, drawstrings), which a simplifier would shorten along their
// length for next to no error of its own.
// A level's error is meshoptimizer's, the worst of its parts' (metres on the body): how far the shape and its colour
// map's coordinates move together, as it weighs them. It does not bound how far a colour slides, nor a small patch of
// colour closing up; the crowd's lighter meshes were drawn against the full ones, frame for frame, where they are used,
// before they were taken (output/perf-walk/crowd-lod-ab.js, in its pull request). A level that leaves fewer than a
// quarter of the last one's triangles out is not kept. The crowd draws a visitor at the lightest level whose error comes
// to under a pixel at their depth (crowd-tier.js).
//   crowdLods(parts) -> [{error, parts: [{name, triangles, data}]}]: error in metres; data, the part's index as Uint16,
//   base64.
//   pieces(part) -> the part as the simplifier takes it, and what the checks hold a level to: kept, the triangles kept
//   whole; island, each vertex's island of the colour map (triangles joined by shared vertices, or by vertices at one
//   place with one UV: apart only at a seam of the map; a lighter triangle's corners are on one); seam, the vertices on
//   a seam of the map.
import {MeshoptSimplifier} from 'meshoptimizer/simplifier';

export const ERRORS=[.01,.03];
const KEEP=.75,SMALL_M2=4e-4,THIN=.25,LOCK=1,PROTECT=2;

export function pieces(part){
 const g=part.geometry,a=g.attributes.position,u=g.attributes.uv,n=a.count;if(n>65535)throw Error(`${part.material.name}: ${n} vertices, past a Uint16 index`);
 const position=new Float32Array(n*3),uv=new Float32Array(n*2);
 for(let i=0;i<n;i++){position[i*3]=a.getX(i);position[i*3+1]=a.getY(i);position[i*3+2]=a.getZ(i);if(u){uv[i*2]=u.getX(i);uv[i*2+1]=u.getY(i);}}
 part.updateWorldMatrix(true,false);const scale=part.matrixWorld.getMaxScaleOnAxis(),index=Uint32Array.from(g.index.array);
 const remap=MeshoptSimplifier.generatePositionRemap(position,3);
 const sets=()=>{const up=Array.from({length:n},(_,i)=>i),root=x=>{while(up[x]!==x)x=up[x]=up[up[x]];return x;};return {root,join:(x,y)=>{up[root(y)]=root(x);}};};
 const area=(i,j,k,v,d)=>{const ax=v[j*d]-v[i*d],ay=v[j*d+1]-v[i*d+1],az=d===3?v[j*3+2]-v[i*3+2]:0,bx=v[k*d]-v[i*d],by=v[k*d+1]-v[i*d+1],bz=d===3?v[k*3+2]-v[i*3+2]:0;
  return Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)/2;};
 const welded=sets(),isle=sets(),same=new Map(),ratios=[];
 for(let i=0;i<n;i++){welded.join(remap[i],i);const k=remap[i]+'|'+uv[i*2]+'|'+uv[i*2+1],j=same.get(k);if(j===undefined)same.set(k,i);else isle.join(j,i);}
 for(let t=0;t<index.length;t+=3){const [i,j,k]=index.subarray(t,t+3);welded.join(i,j);welded.join(i,k);isle.join(i,j);isle.join(i,k);
  const world=area(i,j,k,position,3)*scale*scale,map=area(i,j,k,uv,2);if(world>1e-12&&map>1e-12)ratios.push(Math.sqrt(world/map));}
 ratios.sort((x,y)=>x-y);
 // Each piece (triangles joined by a shared place, welded across seams): its area, length and triangles.
 const by=new Map();for(let t=0;t<index.length;t+=3){const k=welded.root(index[t]),e=by.get(k)??{area:0,triangles:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  e.area+=area(index[t],index[t+1],index[t+2],position,3)*scale*scale;e.triangles.push(t/3);
  for(let c=0;c<3;c++)for(let x=0;x<3;x++){const v=position[index[t+c]*3+x];e.min[x]=Math.min(e.min[x],v);e.max[x]=Math.max(e.max[x],v);}by.set(k,e);}
 const kept=[...by.values()].filter(e=>{const length=Math.max(...e.max.map((v,x)=>(v-e.min[x])*scale));return e.area<SMALL_M2||e.area<THIN*length**2;}).map(e=>e.triangles);
 const first=new Map(),seam=new Uint8Array(n);
 for(let i=0;i<n;i++){const k=uv[i*2]+'|'+uv[i*2+1],f=first.get(remap[i]);if(f===undefined)first.set(remap[i],k);else if(f!==k)seam[remap[i]]=1;}
 for(let i=0;i<n;i++)seam[i]=seam[remap[i]];
 return {position,uv,index,scale,kept,seam,island:Uint32Array.from({length:n},(_,i)=>isle.root(i)),
  extent:MeshoptSimplifier.getScale(position,3),metresPerUv:ratios[Math.floor(ratios.length*.9)]??0,hasUv:!!u};
}

export async function crowdLods(parts,errors=ERRORS){
 await MeshoptSimplifier.ready;
 const source=parts.map(p=>{
  const s=pieces(p),n=s.position.length/3,lock=new Uint8Array(n);
  for(let i=0;i<n;i++)if(s.seam[i])lock[i]|=PROTECT;
  for(const whole of s.kept)for(const t of whole)for(let k=0;k<3;k++)lock[s.index[t*3+k]]|=LOCK;
  const weight=s.hasUv?s.metresPerUv/(s.scale*s.extent):0;
  return {...s,name:p.material.name,lock,weights:[weight,weight]};
 });
 const levels=[];let last=source.reduce((s,p)=>s+p.index.length/3,0);
 for(const error of errors){
  let worst=0,triangles=0;
  const out=source.map(p=>{
   const [index,e]=MeshoptSimplifier.simplifyWithAttributes(p.index,p.position,3,p.uv,2,p.weights,p.lock,3,error/p.scale,['ErrorAbsolute','Permissive']);
   worst=Math.max(worst,e*p.scale);triangles+=index.length/3;
   return {name:p.name,triangles:index.length/3,data:Buffer.from(Uint16Array.from(index).buffer).toString('base64')};
  });
  if(triangles>last*KEEP)continue;
  levels.push({error:Math.ceil(worst*1e5)/1e5,parts:out});last=triangles;
 }
 return levels;
}
