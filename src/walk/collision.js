import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';

// Collision for walking Leo. Everything solid is gathered into world-space triangle soups split by deck band (4 m),
// each with its own BVH, so a page can build the bands near the walker first and Node can check the whole ship.
// Repeated parts (the 499 copies of the furnished cabin on each residential deck) share one BVH and are tested through
// their instance transforms; lift cars and doors are small movable colliders.
// The walker: a floating capsule 2 m tall and 0.7 m wide (Voyager's Reach uses radius 0.35 and a 0.4 m step), so
// anything lower than `step` is stepped onto and the ground is found by a ray, not the capsule.
export const BODY={radius:.35,height:2,step:.4,maxSlope:50};
export const BAND={base:-40.7,height:4};
export const bandOf=y=>Math.floor((y-BAND.base)/BAND.height);

// Flush or tiny dressing never stops a walker: signs, labels, seams, lights, books, foliage and the like.
const SKIP=/(^|_)(text|label|labels|wayfinding|graphics|seam|seams|marker|bezel|inlay|diffuser|diffusers|leaf|foliage|canopy|book|books|light|lights|lamp|glow|decal|decals|logo|lettering|reveal|pull|handle|status|art|poster|mirror|stripe|stripes|grain|caption|title|icon|dial)(_|$)/i;
const MIN_SIZE=.18;

// Meshes merged for drawing (render-bake.js) are hidden but still solid.
const worldVisible=o=>{for(let p=o;p;p=p.parent)if(!p.visible&&!p.userData.baked)return false;return true;};
const boxLike=g=>g.parameters&&g.parameters.width!==undefined&&g.parameters.height!==undefined&&g.parameters.depth!==undefined;
const BOX_FACES=[[0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]];

// Push a mesh's collision triangles (world space, flat xyz triples) into `out`. Box-like parts (including the rounded
// boxes of the polish passes) become their 12-triangle bounds; small, dense props do too.
export function meshTriangles(o,out,matrix=o.matrixWorld){
 const g=o.geometry,pos=g?.attributes?.position;if(!pos)return 0;
 if(!g.boundingBox)g.computeBoundingBox();const b=g.boundingBox,size=b.getSize(new T.Vector3());
 const scale=new T.Vector3().setFromMatrixScale(matrix),diagonal=size.clone().multiply(scale).length();
 if(diagonal<MIN_SIZE)return 0;
 const count=g.index?g.index.count:pos.count,v=new T.Vector3();
 if(boxLike(g)||(count/3>200&&diagonal<2.5)){
  const corners=[];for(let i=0;i<8;i++)corners.push(new T.Vector3(i&4?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&1?b.max.z:b.min.z).applyMatrix4(matrix));
  for(const f of BOX_FACES)for(const i of f)out.push(corners[i].x,corners[i].y,corners[i].z);
  return 12;
 }
 const index=g.index;
 for(let i=0;i<count;i++){v.fromBufferAttribute(pos,index?index.getX(i):i).applyMatrix4(matrix);out.push(v.x,v.y,v.z);}
 return count/3;
}
export const solid=o=>o.isMesh&&!o.isInstancedMesh&&!o.isSkinnedMesh&&!SKIP.test(o.name)&&!o.userData.noCollide&&worldVisible(o);

function bvhOf(positions){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions instanceof Float32Array?positions:new Float32Array(positions),3));
 return new MeshBVH(g,{targetLeafSize:8,indirect:true});
}

export class Colliders{
 constructor(){this.bands=new Map();this.pending=new Map();this.groups=[];this.movers=[];}
 // Collect the solid meshes under `root` into the pending band soups. `filter` can veto meshes.
 addStatic(root,filter=solid){
  root.updateMatrixWorld(true);let tris=0;const scratch=[];
  root.traverse(o=>{
   if(!filter(o))return;scratch.length=0;meshTriangles(o,scratch);
   for(let i=0;i<scratch.length;i+=9){
    const y0=Math.min(scratch[i+1],scratch[i+4],scratch[i+7]),y1=Math.max(scratch[i+1],scratch[i+4],scratch[i+7]);
    for(let b=bandOf(y0);b<=bandOf(y1);b++){let list=this.pending.get(b);if(!list)this.pending.set(b,list=[]);for(let k=0;k<9;k++)list.push(scratch[i+k]);}
    tris++;
   }
  });
  return tris;
 }
 // Build (or rebuild with additions) the BVH for every band with pending triangles.
 commit(){
  for(const [b,list] of this.pending){
   const old=this.bands.get(b),prev=old?old.geometry.attributes.position.array:null;
   const all=new Float32Array((prev?prev.length:0)+list.length);if(prev)all.set(prev);all.set(list,prev?prev.length:0);
   const bvh=bvhOf(all);this.bands.set(b,{bvh,geometry:bvh.geometry,band:b});
  }
  this.pending.clear();
 }
 // A shared shape placed many times: `template` is a flat triangle list in the template's own frame and `matrices`
 // rigid transforms (rotation + translation only) taking it to each copy.
 addInstances(name,template,matrices){
  const bvh=bvhOf(template);bvh.geometry.computeBoundingBox();const local=bvh.geometry.boundingBox;
  const cells=new Map(),items=matrices.map((m,i)=>{const box=local.clone().applyMatrix4(m);const item={i,matrix:m,inverse:m.clone().invert(),box};
   for(const key of cellKeys(box)){let list=cells.get(key);if(!list)cells.set(key,list=[]);list.push(item);}return item;});
  const group={name,bvh,items,cells};this.groups.push(group);return group;
 }
 // A movable collider (a lift car or door): `positions` in its own frame, placed by `matrix` (call place() to move it).
 addMover(name,positions,matrix=new T.Matrix4()){
  const bvh=bvhOf(positions);bvh.geometry.computeBoundingBox();
  const mover={name,bvh,matrix:new T.Matrix4(),inverse:new T.Matrix4(),local:bvh.geometry.boundingBox,box:new T.Box3(),enabled:true,
   place(m){this.matrix.copy(m);this.inverse.copy(m).invert();this.box.copy(this.local).applyMatrix4(m);}};
  mover.place(matrix);this.movers.push(mover);return mover;
 }
 // Every [bvh, inverse, matrix] whose bounds meet the world box. Statics have no transform.
 *near(box,ray=null){
  for(let b=bandOf(box.min.y);b<=bandOf(box.max.y);b++){const band=this.bands.get(b);if(band)yield [band.bvh,null,null];}
  // A long ray's box spans many cells; test the copies against the ray itself.
  for(const g of this.groups){const seen=new Set();for(const key of cellKeys(box))for(const item of g.cells.get(key)||[])if(!seen.has(item)){seen.add(item);if(item.box.intersectsBox(box)&&(!ray||ray.intersectsBox(item.box)))yield [g.bvh,item.inverse,item.matrix];}}
  for(const m of this.movers)if(m.enabled&&m.box.intersectsBox(box))yield [m.bvh,m.inverse,m.matrix];
 }
 // Capsule overlap: does any solid come within `radius` of the segment? (A standing test.)
 overlaps(segment,radius){
  const box=segmentBox(segment,radius),local=new T.Line3(),lbox=new T.Box3(),a=new T.Vector3(),b=new T.Vector3();
  for(const [bvh,inverse] of this.near(box)){
   local.copy(segment);if(inverse)local.applyMatrix4(inverse);segmentBox(local,radius,lbox);
   const hit=bvh.shapecast({intersectsBounds:bb=>bb.intersectsBox(lbox),intersectsTriangle:tri=>tri.closestPointToSegment(local,a,b)<radius});
   if(hit)return true;
  }
  return false;
 }
 // Move the capsule segment out of every triangle closer than `radius` (a few passes). Returns the total push.
 resolve(segment,radius,passes=3){
  const push=new T.Vector3(),local=new T.Line3(),lbox=new T.Box3(),a=new T.Vector3(),b=new T.Vector3(),d=new T.Vector3(),n=new T.Vector3(),mid=new T.Vector3();
  for(let pass=0;pass<passes;pass++){
   let moved=false;
   for(const [bvh,inverse,matrix] of this.near(segmentBox(segment,radius))){
    local.copy(segment);if(inverse)local.applyMatrix4(inverse);
    const start=local.start.clone();
    bvh.shapecast({intersectsBounds:bb=>bb.intersectsBox(segmentBox(local,radius,lbox)),intersectsTriangle:tri=>{
     const dist=tri.closestPointToSegment(local,a,b);
     if(dist<radius){
      // A segment touching the face: push along its normal, towards the side the capsule's middle is on.
      if(dist<1e-6){tri.getNormal(n);d.copy(n).multiplyScalar(n.dot(local.getCenter(mid).sub(a))>=0?1:-1);}else d.subVectors(b,a).divideScalar(dist);
      local.start.addScaledVector(d,radius-dist);local.end.addScaledVector(d,radius-dist);
     }
    }});
    const delta=local.start.clone().sub(start);if(delta.lengthSq()<1e-12)continue;
    if(matrix)delta.transformDirection(matrix).multiplyScalar(local.start.distanceTo(start));
    segment.start.add(delta);segment.end.add(delta);push.add(delta);moved=true;
   }
   if(!moved)break;
  }
  return push;
 }
 // First solid along a world ray within `far`: {distance,point,normal} or null.
 raycast(ray,far=1e4,near=0){
  const box=new T.Box3().setFromPoints([ray.origin,ray.at(far,new T.Vector3())]).expandByScalar(.01);
  let best=null;const local=new T.Ray();
  for(const [bvh,inverse,matrix] of this.near(box,ray)){
   local.copy(ray);if(inverse)local.applyMatrix4(inverse);
   const hit=bvh.raycastFirst(local,T.DoubleSide,near,far);
   if(hit&&hit.distance<=far&&(!best||hit.distance<best.distance)){
    const normal=hit.face.normal.clone();if(matrix)normal.transformDirection(matrix);
    if(normal.dot(ray.direction)>0)normal.negate();
    best={distance:hit.distance,point:ray.at(hit.distance,new T.Vector3()),normal};
   }
  }
  return best;
 }
 get triangles(){let n=0;for(const b of this.bands.values())n+=b.geometry.attributes.position.count/3;return n;}
}

const CELL=8;
function* cellKeys(box){
 for(let x=Math.floor(box.min.x/CELL);x<=Math.floor(box.max.x/CELL);x++)for(let y=Math.floor(box.min.y/CELL);y<=Math.floor(box.max.y/CELL);y++)for(let z=Math.floor(box.min.z/CELL);z<=Math.floor(box.max.z/CELL);z++)yield x+','+y+','+z;
}
function segmentBox(s,r,out=new T.Box3()){out.makeEmpty();out.expandByPoint(s.start);out.expandByPoint(s.end);return out.expandByScalar(r);}
