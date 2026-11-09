import * as T from 'three';

// The owner bake's proof (scripts/walk-owner-bake.mjs): a box B is hidden from every eye in a cell C when one plane P
// separates them and the drawn, opaque triangles lying on P cover P ∩ conv(C ∪ B), the region every segment from C to B
// crosses. Where no single plane does, C or B is split in half (subdiv levels) and each half must be proven, possibly
// by another plane. Occluders come as a BVH (three-mesh-bvh, `indirect: true`) over world-space triangles, each with
// the side it is drawn from (`sides`: 0 front, 1 back, 2 both; front = counter-clockwise as stored) and a condition
// (`conds`): an index the caller maps to what must be drawn for that triangle to be there. A proof returns the set of
// conditions it relied on, or null. Anything not proven stays visible, so every shortcut here errs towards null.
export const OWNER_PROOF={
 planeTol:.002,      // m: a triangle within this of P counts as lying on it (the footprint grows to allow for it)
 areaEps:1e-9,       // m²: uncovered pieces smaller than this are float noise between triangles that share an edge
 maxPieces:4000,     // a cover that fragments further is given up (not proven)
 nearMargin:.1,      // m: every eye in C at least this far from P (clear of the camera's near plane)
 targetMargin:.15,   // m: all of B at least this far behind P (finishes a few mm behind a wall still draw: depth bias)
 maxSlope:50,        // the steepest sight line's slope against P beyond which the tolerance is unbounded
 subdiv:2,
};

const corners=b=>{const out=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])out.push(new T.Vector3(x,y,z));return out;};
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length];a+=u[0]*v[1]-v[0]*u[1];}return a/2;};
function hull2(points){
 const s=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
 for(const p of s){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
 for(let i=s.length-1;i>=0;i--){const p=s[i];while(up.length>1&&cross(up.at(-2),up.at(-1),p)<=0)up.pop();up.push(p);}
 return lo.slice(0,-1).concat(up.slice(0,-1));
}
// The part of a convex polygon where a*x+b*y+c >= 0, or null.
function clip(poly,a,b,c){
 const out=[];
 for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=a*p[0]+b*p[1]+c,dq=a*q[0]+b*q[1]+c;if(dp>=0)out.push(p);if(dp>0&&dq<0||dp<0&&dq>0){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
 return out.length>=3?out:null;
}
// A convex polygon minus a counter-clockwise triangle: the pieces outside each edge in turn.
function subtract(poly,t,eps){
 const out=[];let inside=poly;
 for(let i=0;i<3&&inside;i++){const p=t[i],q=t[(i+1)%3],a=-(q[1]-p[1]),b=q[0]-p[0],c=-(a*p[0]+b*p[1]),outside=clip(inside,-a,-b,-c);if(outside&&Math.abs(area(outside))>eps)out.push(outside);inside=clip(inside,a,b,c);}
 return out;
}
const bbox2=p=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y] of p){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}return [x0,y0,x1,y1];};
const canonical=pl=>{const n=pl.normal;if(n.x<0||n.x===0&&(n.y<0||n.y===0&&n.z<0))pl.negate();return pl;};

/** `occluders`: {bvh, sides, conds}. Returns {prove(cell, box, hint?, key?) -> Set|null, stats}. `hint` (a Map) keeps
 * the plane that last proved each `key` and tries it first: neighbouring cells usually share it. */
export function createOwnerProof(occluders,options={}){
 const o={...OWNER_PROOF,...options},{bvh,sides,conds}=occluders,P=bvh.geometry.attributes.position;
 const stats={pairs:0,clear:0,planes:0,proven:0,hinted:0,splits:0,overflow:0,steep:0,margin:0};
 const ray=new T.Ray(),e1=new T.Vector3(),e2=new T.Vector3(),t0=new T.Vector3();
 const triangle=f=>[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(P,f*3+k));
 // Does triangle f stop sight coming from `from`? A single-sided one only from the side it is drawn.
 const blocks=(f,from)=>{const s=sides[f];if(s===2)return true;const t=triangle(f);e1.subVectors(t[1],t[0]).cross(e2.subVectors(t[2],t[0]));const d=e1.dot(t0.subVectors(from,t[0]));return s===0?d>0:d<0;};
 const segment=(p,q)=>{const d=q.clone().sub(p),len=d.length();ray.set(p,d.divideScalar(len||1));return len;};
 // The centre-to-centre segment meets nothing that blocks it: B shows from C.
 function clear(cell,box){const p=cell.getCenter(new T.Vector3()),len=segment(p,box.getCenter(new T.Vector3()));if(len<1e-3)return true;for(const h of bvh.raycast(ray,T.DoubleSide,0,len))if(blocks(h.faceIndex,p))return false;return true;}
 // Planes of occluder triangles met by segments between C and B (centres and corners).
 function candidates(cell,box){
  const from=[cell.getCenter(new T.Vector3()),...corners(cell)],to=[box.getCenter(new T.Vector3()),...corners(box)],planes=new Map(),pairs=[[0,0]];
  for(let k=1;k<9;k++)pairs.push([k,0],[0,k],[k,9-k]);
  for(const [a,b] of pairs){const len=segment(from[a],to[b]);if(len<1e-3)continue;
   for(const h of bvh.raycast(ray,T.DoubleSide,0,len)){const pl=new T.Plane().setFromCoplanarPoints(...triangle(h.faceIndex));if(pl.normal.lengthSq()<.99)continue;canonical(pl);
    const key=pl.normal.toArray().map(v=>v.toFixed(3)).join(',')+'|'+pl.constant.toFixed(3);if(!planes.has(key))planes.set(key,pl);}}
  return [...planes.values()];
 }
 // P ∩ conv(C ∪ B) as a polygon in P's basis, grown for the coplanarity tolerance; null if P cannot serve.
 function footprint(pl,cc,bc){
  const dc=cc.map(p=>pl.distanceToPoint(p)),db=bc.map(p=>pl.distanceToPoint(p));
  if(!(Math.max(...dc)<0&&Math.min(...db)>0||Math.min(...dc)>0&&Math.max(...db)<0))return null;
  if(Math.min(...dc.map(Math.abs))<o.nearMargin||Math.min(...db.map(Math.abs))<o.targetMargin){stats.margin++;return null;}
  let slope=0;for(const c of cc)for(const b of bc){const d=b.clone().sub(c),cos=Math.abs(d.dot(pl.normal))/d.length();slope=Math.max(slope,Math.sqrt(Math.max(0,1-cos*cos))/Math.max(cos,1e-9));}
  if(slope>o.maxSlope){stats.steep++;return null;}
  const grow=o.planeTol*slope+1e-4,n=pl.normal,u=(Math.abs(n.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0)).cross(n).normalize(),v=n.clone().cross(u),origin=n.clone().multiplyScalar(-pl.constant);
  const to2=p=>{const d=p.clone().sub(origin);return [d.dot(u),d.dot(v)];},points=[];
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){const t=dc[i]/(dc[i]-db[j]),q=to2(cc[i].clone().lerp(bc[j],t));for(const sx of [-1,1])for(const sy of [-1,1])points.push([q[0]+sx*grow,q[1]+sy*grow]);}
  const poly=hull2(points);if(poly.length<3)return null;if(area(poly)<0)poly.reverse();
  return {poly,to2,u,v,origin};
 }
 // The conditions of the triangles on P that cover the footprint, or null.
 function cover(pl,cc,bc,from){
  const f=footprint(pl,cc,bc);if(!f)return null;
  const fb=bbox2(f.poly),query=new T.Box3();for(const [x,y] of [[fb[0],fb[1]],[fb[2],fb[1]],[fb[0],fb[3]],[fb[2],fb[3]]])query.expandByPoint(f.origin.clone().addScaledVector(f.u,x).addScaledVector(f.v,y));query.expandByScalar(o.planeTol*2);
  let pieces=[f.poly],overflow=false;const used=new Set();
  bvh.shapecast({intersectsBounds:b=>b.intersectsBox(query),intersectsTriangle:(tri,index)=>{
   // `index` is already the geometry's triangle (shapecast resolves an indirect BVH's order).
   if(Math.abs(pl.distanceToPoint(tri.a))>o.planeTol||Math.abs(pl.distanceToPoint(tri.b))>o.planeTol||Math.abs(pl.distanceToPoint(tri.c))>o.planeTol||!blocks(index,from))return false;
   let t=[f.to2(tri.a),f.to2(tri.b),f.to2(tri.c)];const a=area(t);if(Math.abs(a)<1e-12)return false;if(a<0)t=[t[0],t[2],t[1]];
   const tb=bbox2(t),next=[];let touched=false;
   for(const p of pieces){const pb=bbox2(p);if(pb[2]<tb[0]||pb[0]>tb[2]||pb[3]<tb[1]||pb[1]>tb[3])next.push(p);else{touched=true;next.push(...subtract(p,t,o.areaEps));}}
   if(touched)used.add(conds[index]);pieces=next;if(pieces.length>o.maxPieces){overflow=true;return true;}return !pieces.length;}});
  if(overflow){stats.overflow++;return null;}
  return pieces.length?null:used;
 }
 // One cell and one box, by a single plane.
 function proveOnce(cell,box,hint,key){
  stats.pairs++;if(cell.intersectsBox(box))return null;
  const cc=corners(cell),bc=corners(box),from=cell.getCenter(new T.Vector3()),last=key!==undefined&&hint?.get(key);
  if(last){const used=cover(last,cc,bc,from);if(used){stats.hinted++;stats.proven++;return used;}}
  if(clear(cell,box)){stats.clear++;return null;}
  for(const pl of candidates(cell,box)){stats.planes++;const used=cover(pl,cc,bc,from);if(used){if(key!==undefined)hint?.set(key,pl);stats.proven++;return used;}}
  return null;
 }
 const halves=b=>{const s=b.getSize(new T.Vector3()),a=s.x>=s.y&&s.x>=s.z?'x':s.y>=s.z?'y':'z',m=(b.min[a]+b.max[a])/2,l=b.clone(),h=b.clone();l.max[a]=m;h.min[a]=m;return [l,h];};
 const longest=b=>{const s=b.getSize(new T.Vector3());return Math.max(s.x,s.y,s.z);};
 function prove(cell,box,hint,key,depth=o.subdiv){
  const used=proveOnce(cell,box,hint,key);if(used||depth<=0||cell.intersectsBox(box))return used;stats.splits++;
  const pairs=longest(box)>=longest(cell)?halves(box).map(h=>[cell,h]):halves(cell).map(c=>[c,box]),all=new Set();
  for(const [n,[c,b]] of pairs.entries()){const u=prove(c,b,hint,key===undefined?undefined:key+'/'+n,depth-1);if(!u)return null;for(const k of u)all.add(k);}
  return all;
 }
 return {prove,stats};
}
