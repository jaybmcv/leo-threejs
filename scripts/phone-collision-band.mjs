// One collision band of the phone ship (scripts/build-phone-walk.mjs), run in a worker thread: simplified and checked
// against the full band, then packed the way scripts/prepared-collision-pack.mjs packs the ship's.
// The walk check: points on the band's floors (facing up) and walls (upright), about one per half square metre, probed
// in the full and the simplified collision with a short ray: down onto a floor from 30 cm above, into a wall from 35 cm
// out. Where they differ by more than the floor or wall tolerance (or the light one misses), the full band's triangles
// within `near` metres stay exact and the band is simplified again around them, up to three times.
import {parentPort} from 'node:worker_threads';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {MeshoptSimplifier} from 'meshoptimizer';

const probe=(bvh,x,y,z,nx,ny,nz,floor,ray=new T.Ray())=>{if(floor){ray.origin.set(x,y+0.3,z);ray.direction.set(0,-1,0);}else{ray.origin.set(x+nx*0.35,y+ny*0.35,z+nz*0.35);ray.direction.set(-nx,-ny,-nz);}
 const hit=bvh.raycastFirst(ray,T.DoubleSide,0,floor?0.6:0.7);return hit?hit.distance:-1;};
const samplesOf=(P,I,count)=>{let seed=count>>>0||1;const random=()=>(seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),e=new T.Vector3(),f=new T.Vector3(),n=new T.Vector3(),out=[];
 for(let t=0;t<count;t++){a.fromArray(P,I[t*3]*3);b.fromArray(P,I[t*3+1]*3);c.fromArray(P,I[t*3+2]*3);e.subVectors(b,a);f.subVectors(c,a);n.crossVectors(e,f);const area=n.length()/2;if(!area)continue;n.normalize();
  const floor=n.y>0.7,wall=Math.abs(n.y)<0.3;if(!floor&&!wall)continue;const want=area/0.5,k=Math.floor(want)+(random()<want%1?1:0);
  for(let i=0;i<k;i++){let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}out.push(a.x+e.x*u+f.x*v,a.y+e.y*u+f.y*v,a.z+e.z*u+f.z*v,n.x,n.y,n.z,floor?1:0);}}
 return Float32Array.from(out);};

// P: welded positions; I: the band's index into them; flags: windowFlags per triangle, or null.
export function lightBand({P,I,flags},{error,floorTolerance,wallTolerance,near}){
 const count=I.length/3,none=new Float32Array(0);
 const full=new T.BufferGeometry();full.setAttribute('position',new T.BufferAttribute(P,3));full.setIndex(new T.BufferAttribute(I.slice(),1));const fullBvh=new MeshBVH(full,{indirect:true});
 const samples=samplesOf(P,I,count),expected=new Float32Array(samples.length/7);for(let i=0;i<expected.length;i++){const k=i*7;expected[i]=probe(fullBvh,samples[k],samples[k+1],samples[k+2],samples[k+3],samples[k+4],samples[k+5],samples[k+6]===1);}
 const keepExact=new Uint8Array(count),classOf=t=>keepExact[t]?-1:flags?flags[t]:0;let idx,keptFlags,bvh,positions,bad=[],differed=0;
 for(let round=0;round<4;round++){
  // Glass and the rest are simplified apart; the vertices they share, and those of exact triangles, are locked.
  const classes=new Map(),owner=new Int32Array(P.length/3).fill(-2),lock=new Uint8Array(P.length/3);
  for(let t=0;t<count;t++){const f=classOf(t);let list=classes.get(f);if(!list)classes.set(f,list=[]);list.push(t);for(let k=0;k<3;k++){const v=I[t*3+k];if(f===-1||owner[v]!==-2&&owner[v]!==f)lock[v]=1;owner[v]=f;}}
  const kept=[];keptFlags=[];for(const [f,list] of classes){let piece=new Uint32Array(list.length*3);list.forEach((t,i)=>{piece[i*3]=I[t*3];piece[i*3+1]=I[t*3+1];piece[i*3+2]=I[t*3+2];});
   if(f===-1)for(const t of list)keptFlags.push(flags?flags[t]:0);else{[piece]=MeshoptSimplifier.simplifyWithAttributes(piece,P,3,none,0,[],lock,0,error,['ErrorAbsolute','Sparse']);for(let i=0;i<piece.length/3;i++)keptFlags.push(f);}
   kept.push(piece);}
  const all=new Uint32Array(keptFlags.length*3);let at=0;for(const s of kept){all.set(s,at);at+=s.length;}
  const again=new Map(),verts=[];idx=new Uint32Array(all.length);for(let i=0;i<all.length;i++){let q=again.get(all[i]);if(q===undefined){q=verts.length;again.set(all[i],q);verts.push(all[i]);}idx[i]=q;}
  positions=new Float32Array(verts.length*3);verts.forEach((p,i)=>{positions[i*3]=P[p*3];positions[i*3+1]=P[p*3+1];positions[i*3+2]=P[p*3+2];});
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.BufferAttribute(positions,3));geom.setIndex(new T.BufferAttribute(idx,1));bvh=new MeshBVH(geom,{targetLeafSize:32,indirect:true});
  bad=[];for(let i=0;i<expected.length;i++){const k=i*7,floor=samples[k+6]===1,want=expected[i];if(want<0)continue;const got=probe(bvh,samples[k],samples[k+1],samples[k+2],samples[k+3],samples[k+4],samples[k+5],floor);if(got<0||Math.abs(got-want)>(floor?floorTolerance:wallTolerance))bad.push(i);}
  if(round===0)differed=bad.length;if(!bad.length||round===3)break;
  const p=new T.Vector3(),q=new T.Vector3();for(const i of bad){p.fromArray(samples,i*7);fullBvh.shapecast({intersectsBounds:box=>box.distanceToPoint(p)<near,intersectsTriangle:(tri,t)=>{if(tri.closestPointToPoint(p,q).distanceTo(p)<near)keepExact[t]=1;}});}}
 // 32-triangle leaves with the index put in BVH order and no indirect buffer.
 const s=MeshBVH.serialize(bvh,{cloneBuffers:false}),permutation=s.indirectBuffer,direct=new Uint32Array(idx.length),directFlags=new Uint8Array(permutation.length),seen=new Uint8Array(permutation.length);
 for(let i=0;i<permutation.length;i++){const t=permutation[i];if(seen[t])throw Error('BVH permutation repeats a triangle');seen[t]=1;direct[i*3]=idx[t*3];direct[i*3+1]=idx[t*3+1];direct[i*3+2]=idx[t*3+2];directFlags[i]=keptFlags[t];}
 if(!seen.every(Boolean))throw Error('BVH permutation misses a triangle');
 return {positions,index:direct,flags:directFlags,roots:s.roots.map(x=>new Uint8Array(x).slice()),version:s.version,
  walking:{samples:expected.length,differed,still:bad.length,exactTriangles:keepExact.reduce((n,x)=>n+x,0)},triangles:count,kept:permutation.length};}

if(parentPort){await MeshoptSimplifier.ready;parentPort.on('message',({id,band,options})=>{try{const r=lightBand(band,options);parentPort.postMessage({id,r},[r.positions.buffer,r.index.buffer,r.flags.buffer,...r.roots.map(x=>x.buffer)]);}catch(e){parentPort.postMessage({id,error:e.stack||String(e)});}});}
