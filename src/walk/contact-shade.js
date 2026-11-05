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
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(out),3));
 return new MeshBVH(g,{targetLeafSize:8});
}

// Golden-angle spiral over the cosine-weighted hemisphere, turned per vertex (from its position, so builds repeat).
const DIRS=Array.from({length:RAYS},(_,i)=>{const u=(i+.5)/RAYS,r=Math.sqrt(u),ph=i*2.399963;return [r*Math.cos(ph),r*Math.sin(ph),Math.sqrt(1-u)];});
function shadeAt(bvh,ray,p,n,tA,tB,up){
 up.set(Math.abs(n.y)<.9?0:1,Math.abs(n.y)<.9?1:0,0);tA.crossVectors(up,n).normalize();tB.crossVectors(n,tA);
 const turn=(Math.abs(Math.sin(p.x*12.9898+p.y*78.233+p.z*37.719)*43758.5453)%1)*6.2832,cs=Math.cos(turn),sn=Math.sin(turn);
 ray.origin.copy(p).addScaledVector(n,OFFSET);let occ=0;
 for(const [dx,dy,dz]of DIRS){const a=dx*cs-dy*sn,b=dx*sn+dy*cs;
  ray.direction.set(tA.x*a+tB.x*b+n.x*dz,tA.y*a+tB.y*b+n.y*dz,tA.z*a+tB.z*b+n.z*dz);
  const hit=bvh.raycastFirst(ray,T.DoubleSide,0,FAR);if(hit)occ+=1-hit.distance/FAR;}
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
