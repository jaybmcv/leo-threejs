import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import layout from '../plan/selected-layout.js';

// Contact shading (2B): soft darkening where surfaces meet, baked into the merged meshes' vertex colours once at build
// time, so it costs nothing per frame and survives the prepared replay and phones alike. Each vertex casts a few
// cosine-weighted rays up to FAR metres; nearer hits darken more. Only vertices that already exist are shaded, only
// on finely built surfaces (edges up to MAX_EDGE), and only in the rooms listed: a pilot, checked by eye first.
const ROOMS=['d02-arrival-1'],RAYS=24,FAR=1.5,STRENGTH=.85,DARKEST=.3,OFFSET=.01,EDGE=.05,MAX_EDGE=1;
const lit=m=>m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial;
const opaque=m=>!m.transparent&&m.opacity>=1;

// A room's bounds: its plan and every envelope section, floor to ceiling.
function roomBox(id){
 const r=layout.rooms.find(r=>r.id===id);if(!r)return null;const box=new T.Box3();
 for(const poly of [r.polygon,...(r.envelope||[]).map(s=>s.polygon)])for(const [x,z]of poly){box.expandByPoint(new T.Vector3(x,r.y,z));box.expandByPoint(new T.Vector3(x,r.y+r.height,z));}
 return box.expandByScalar(EDGE);
}

// Occluders: drawn opaque triangles whose bounds reach into the box padded by the ray length.
function occluders(meshes,reach){
 const out=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),t=new T.Box3();
 for(const o of meshes){
  if(!opaque(o.material))continue;const g=o.geometry,p=g.attributes.position,ix=g.index.array;
  for(let k=0;k+2<ix.length;k+=3){a.fromBufferAttribute(p,ix[k]);b.fromBufferAttribute(p,ix[k+1]);c.fromBufferAttribute(p,ix[k+2]);
   t.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c);if(t.intersectsBox(reach))out.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);}
 }
 return occluderBVH(new Float32Array(out));
}
// An occluder BVH: plain triangles (three-mesh-bvh adds an index), built here and never changed after, so firstHit may
// keep views of its arrays.
const occluderBVHs=new WeakSet();
export function occluderBVH(positions){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));const bvh=new MeshBVH(g,{targetLeafSize:8});occluderBVHs.add(bvh);return bvh;}

// Golden-angle spiral over the cosine-weighted hemisphere, turned per vertex (from its position, so builds repeat).
const DIRS=Array.from({length:RAYS},(_,i)=>{const u=(i+.5)/RAYS,r=Math.sqrt(u),ph=i*2.399963;return [r*Math.cos(ph),r*Math.sin(ph),Math.sqrt(1-u)];});
// bvh.raycastFirst's own answer, found the same way: three-mesh-bvh 0.9.15 (pinned in package.json) visits each root;
// at a split, the child on the ray's side first, the other skipped when the first's hit lies outside it; in a leaf the
// first smallest hit; a hit is three's Ray.intersectTriangle, both sides, at origin.distanceTo within [near, far]. Unlike
// it, this reads the corners straight from the position array and skips the uv, normal, face and barycentre it works
// out for every hit, which shading never reads. Every 97th ray is also cast by three-mesh-bvh and must agree to the bit,
// so a three-mesh-bvh or three change that parts them stops the build. Only occluder BVHs (occluderBVH) with a plain
// index and Float32 positions take this path; any other BVH goes to three-mesh-bvh.
const views=new WeakMap(),AXES=['x','y','z'],_a=new T.Vector3(),_b=new T.Vector3(),_c=new T.Vector3(),_p=new T.Vector3();let cast=0;
// three-mesh-bvh's intersectsNodeBounds (core/utils/intersectUtils.js), as it is.
function boundsHit(n,f,ray,near,far){
 let tmin,tmax,tymin,tymax,tzmin,tzmax;const ix=1/ray.direction.x,iy=1/ray.direction.y,iz=1/ray.direction.z,ox=ray.origin.x,oy=ray.origin.y,oz=ray.origin.z;
 if(ix>=0){tmin=(f[n]-ox)*ix;tmax=(f[n+3]-ox)*ix;}else{tmin=(f[n+3]-ox)*ix;tmax=(f[n]-ox)*ix;}
 if(iy>=0){tymin=(f[n+1]-oy)*iy;tymax=(f[n+4]-oy)*iy;}else{tymin=(f[n+4]-oy)*iy;tymax=(f[n+1]-oy)*iy;}
 if(tmin>tymax||tymin>tmax)return false;if(tymin>tmin||isNaN(tmin))tmin=tymin;if(tymax<tmax||isNaN(tmax))tmax=tymax;
 if(iz>=0){tzmin=(f[n+2]-oz)*iz;tzmax=(f[n+5]-oz)*iz;}else{tzmin=(f[n+5]-oz)*iz;tzmax=(f[n+2]-oz)*iz;}
 if(tmin>tzmax||tzmin>tmax)return false;if(tzmin>tmin||tmin!==tmin)tmin=tzmin;if(tzmax<tmax||tmax!==tmax)tmax=tzmax;
 return tmin<=far&&tmax>=near;}
function nodeHit(n32,r,v,ray,near,far){const n16=n32*2;
 if(r.u16[n16+15]===0xFFFF){const P=v.pos,I=v.index;let res=null,dist=Infinity;
  for(let i=r.u32[n32+6],end=i+r.u16[n16+14];i<end;i++){const a=I[i*3]*3,b=I[i*3+1]*3,c=I[i*3+2]*3;_a.set(P[a],P[a+1],P[a+2]);_b.set(P[b],P[b+1],P[b+2]);_c.set(P[c],P[c+1],P[c+2]);
   if(ray.intersectTriangle(_a,_b,_c,false,_p)===null)continue;const d=ray.origin.distanceTo(_p);if(d<near||d>far||!(d<dist))continue;dist=d;res={distance:d,x:_p.x,y:_p.y,z:_p.z};}
  return res;}
 const axis=r.u32[n32+7],ltr=ray.direction[AXES[axis]]>=0,left=n32+8,right=n32+r.u32[n32+6]*8,c1=ltr?left:right,c2=ltr?right:left;
 const r1=boundsHit(c1,r.f32,ray,near,far)?nodeHit(c1,r,v,ray,near,far):null;
 if(r1&&(ltr?r1[AXES[axis]]<=r.f32[c2+axis]:r1[AXES[axis]]>=r.f32[c2+axis+3]))return r1;
 const r2=boundsHit(c2,r.f32,ray,near,far)?nodeHit(c2,r,v,ray,near,far):null;
 return r1&&r2?(r1.distance<=r2.distance?r1:r2):r1||r2||null;}
export function firstHit(bvh,ray,near,far){
 let v=views.get(bvh);if(v===undefined){const g=bvh.geometry,p=g.attributes.position;v=occluderBVHs.has(bvh)&&!bvh.indirect&&g.index&&g.index.itemSize===1&&!g.index.normalized&&!g.index.isInterleavedBufferAttribute&&(g.index.array instanceof Uint16Array||g.index.array instanceof Uint32Array)&&p.array instanceof Float32Array&&!p.isInterleavedBufferAttribute&&!p.normalized&&p.itemSize===3?{index:g.index.array,pos:p.array,roots:bvh._roots.map(b=>({f32:new Float32Array(b),u16:new Uint16Array(b),u32:new Uint32Array(b)}))}:null;views.set(bvh,v);}
 if(!v)return bvh.raycastFirst(ray,T.DoubleSide,near,far);let best=null;
 for(const r of v.roots){const hit=nodeHit(0,r,v,ray,near,far);if(hit&&(!best||hit.distance<best.distance))best=hit;}
 if(++cast%97===0){const lib=bvh.raycastFirst(ray,T.DoubleSide,near,far);if(!Object.is(lib?lib.distance:null,best?best.distance:null))throw Error('Contact shading: lean ray cast '+best?.distance+' differs from three-mesh-bvh '+lib?.distance);}
 return best;}
function shadeAt(bvh,ray,p,n,tA,tB,up){
 up.set(Math.abs(n.y)<.9?0:1,Math.abs(n.y)<.9?1:0,0);tA.crossVectors(up,n).normalize();tB.crossVectors(n,tA);
 const turn=(Math.abs(Math.sin(p.x*12.9898+p.y*78.233+p.z*37.719)*43758.5453)%1)*6.2832,cs=Math.cos(turn),sn=Math.sin(turn);
 ray.origin.copy(p).addScaledVector(n,OFFSET);let occ=0;
 for(const [dx,dy,dz]of DIRS){const a=dx*cs-dy*sn,b=dx*sn+dy*cs;
  ray.direction.set(tA.x*a+tB.x*b+n.x*dz,tA.y*a+tB.y*b+n.y*dz,tA.z*a+tB.z*b+n.z*dz);
  const hit=firstHit(bvh,ray,0,FAR);if(hit)occ+=1-hit.distance/FAR;}
 return Math.max(DARKEST,1-STRENGTH*occ/RAYS);
}

// The longest edge touching each vertex. A corner of a big face (a whole ceiling panel, a wall) would spread its
// darkness across metres of surface, dimming the face instead of shading the contact, so such vertices are skipped.
function longestEdges(g){
 const p=g.attributes.position,ix=g.index.array,out=new Float32Array(p.count),a=new T.Vector3(),b=new T.Vector3();
 for(let k=0;k+2<ix.length;k+=3)for(let e=0;e<3;e++){const i=ix[k+e],j=ix[k+(e+1)%3],d=a.fromBufferAttribute(p,i).distanceTo(b.fromBufferAttribute(p,j));
  if(d>out[i])out[i]=d;if(d>out[j])out[j]=d;}
 return out;
}

export function shadeContacts(bands){
 const stats={rooms:0,meshes:0,vertices:0,ms:0},t0=performance.now();
 const all=[];for(const g of bands.values())g.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.geometry.index)all.push(o);});
 for(const id of ROOMS){
  const box=roomBox(id);if(!box)continue;stats.rooms++;
  const reach=box.clone().expandByScalar(FAR),near=all.filter(o=>{o.geometry.boundingBox||o.geometry.computeBoundingBox();return o.geometry.boundingBox.intersectsBox(reach);});
  const bvh=occluders(near,reach),ray=new T.Ray(),p=new T.Vector3(),n=new T.Vector3(),tA=new T.Vector3(),tB=new T.Vector3(),up=new T.Vector3();
  for(const o of near){
   const g=o.geometry,col=g.attributes.color,nor=g.attributes.normal;
   if(!col||!nor||!lit(o.material)||!opaque(o.material)||!g.boundingBox.intersectsBox(box))continue;
   const pos=g.attributes.position,edge=longestEdges(g);let shaded=0;
   for(let i=0;i<pos.count;i++){if(edge[i]>MAX_EDGE)continue;p.fromBufferAttribute(pos,i);if(!box.containsPoint(p))continue;n.fromBufferAttribute(nor,i).normalize();
    const k=shadeAt(bvh,ray,p,n,tA,tB,up);for(let c=0;c<3;c++)col.array[i*3+c]=Math.round(col.array[i*3+c]*k);shaded++;}
   if(shaded){col.needsUpdate=true;stats.meshes++;stats.vertices+=shaded;}
  }
 }
 stats.ms=Math.round(performance.now()-t0);return stats;
}
