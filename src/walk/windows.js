import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';

// Leo's windows, seen from inside. The exterior model glazes its windows on top of the pressure envelope, which is
// never cut for them: from outside the glass reads over the hull, but from the bridge or a lounge the envelope's back
// face fills every window. For drawing only (the colliders keep the whole envelope), the envelope is cut away wherever
// glass lies over it, and the glass is made clear enough to see Mars and the stars through.
// The envelope is lofted from long slivers, so a triangle along a window's edge is split into quarters, again and
// again (down to ~8 cm), and only the pieces under glass go; whole triangles would leave a saw-tooth along every
// sill. That takes seconds, so it is planned at build time (planWindows, scripts/walk-plan.mjs) and the page only
// replays the plan (openWindows).
const GLASS=/^LEO_glass_/,ENVELOPE=/^Smooth_pressure_envelope/,REACH=2,CELL=2,FINEST=.08,DEPTH=6;
// Window glass gets one clear, faintly blue finish; the en-suite screens (Interior_glass) stay frosted.
const CLEAR=/^LEO_glass_(exterior_tint|concept_bow|concept_pane|interior_clear)$/;

// The passenger portholes along the hull (V33-V35) have cabin walls right behind them: nothing to see through.
const PORTHOLES=/passenger_glazing/;
const glassOf=o=>!PORTHOLES.test(o.name)&&[].concat(o.material).some(m=>GLASS.test(m.name||''));
function eachTriangle(o,fn){
 const g=o.geometry,pos=g.attributes.position,idx=g.index?g.index.array:null,n=idx?idx.length:pos.count,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let t=0;t<n;t+=3){const i0=idx?idx[t]:t,i1=idx?idx[t+1]:t+1,i2=idx?idx[t+2]:t+2;
  a.fromBufferAttribute(pos,i0).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(pos,i1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(pos,i2).applyMatrix4(o.matrixWorld);fn(a,b,c,t/3,i0,i1,i2);}
}
const envelopes=ship=>{const out=[];ship.exterior.traverse(o=>{if(o.isMesh&&ENVELOPE.test(o.name))out.push(o);});return out;};
// The four quarters of a triangle, as corners of its parent in barycentric terms (the order the codes use).
const QUARTERS=[[0,3,5],[3,1,4],[5,4,2],[3,4,5]];
const corners=w=>[w[0],w[1],w[2],w[0].map((x,k)=>(x+w[1][k])/2),w[1].map((x,k)=>(x+w[2][k])/2),w[2].map((x,k)=>(x+w[0][k])/2)];
// A piece's code: its depth in the low three bits, then a quarter (two bits) per level, first level lowest.
function decode(code){let w=[[1,0,0],[0,1,0],[0,0,1]];const depth=code&7;for(let l=0;l<depth;l++){const c=corners(w),q=QUARTERS[(code>>(3+2*l))&3];w=q.map(i=>c[i]);}return w;}

// For each envelope mesh, in scene order: [triangle, piece count, piece codes..., ...] for every triangle that is cut,
// each triangle counted on from the one before; a triangle with no pieces goes entirely.
export function planWindows(ship){
 ship.root.updateMatrixWorld(true);
 // Every glass triangle of the ship, in one BVH, and the 2 m cells within reach of any of them.
 const soup=[],near=new Set(),cellKey=(i,j,k)=>((i+512)*1024+j+512)*1024+k+512,key=v=>cellKey(Math.floor(v.x/CELL),Math.floor(v.y/CELL),Math.floor(v.z/CELL));
 for(const root of [ship.exterior,ship.inside])root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!o.geometry?.attributes?.position||!glassOf(o))return;
  eachTriangle(o,(a,b,c)=>{soup.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
   const lo=a.clone().min(b).min(c).subScalar(REACH),hi=a.clone().max(b).max(c).addScalar(REACH);
   for(let x=Math.floor(lo.x/CELL);x<=Math.floor(hi.x/CELL);x++)for(let y=Math.floor(lo.y/CELL);y<=Math.floor(hi.y/CELL);y++)for(let z=Math.floor(lo.z/CELL);z<=Math.floor(hi.z/CELL);z++)near.add(cellKey(x,y,z));});});
 const plan=envelopes(ship).map(()=>[]);if(!soup.length)return plan;
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(soup,3));const bvh=new MeshBVH(geo);
 const ray=new T.Ray(),n=new T.Vector3(),e=new T.Vector3(),m=new T.Vector3(),q=new T.Vector3();
 // Glass within reach along the envelope's normal `n`, either way, from `at`.
 const covered=at=>{ray.origin.copy(at).addScaledVector(n,-REACH);ray.direction.copy(n);const hit=bvh.raycastFirst(ray,T.DoubleSide);return !!hit&&hit.distance<=2*REACH;};
 // [centre, corners...] under glass.
 const under=(a,b,c)=>[covered(q.copy(a).add(b).add(c).divideScalar(3)),covered(a),covered(b),covered(c)];
 envelopes(ship).forEach((o,index)=>{
  const out=plan[index];let previous=0;
  eachTriangle(o,(a,b,c,tri)=>{
   m.copy(a).add(b).add(c).divideScalar(3);
   if(!near.has(key(m))&&!near.has(key(a))&&!near.has(key(b))&&!near.has(key(c)))return;
   n.subVectors(b,a).cross(e.subVectors(c,a));if(n.lengthSq()<1e-12)return;n.normalize();
   const s=under(a,b,c);if(!s.some(Boolean))return;
   // Along a window's edge: split into quarters, keeping the pieces not under glass.
   const pieces=[];
   const split=(p,t,depth,code)=>{
    if(t.every(Boolean))return;
    const longest=Math.max(p[0].distanceTo(p[1]),p[1].distanceTo(p[2]),p[2].distanceTo(p[0]));
    if(!t.some(Boolean)||depth>=DEPTH||longest<FINEST){if(!t[0])pieces.push(code|depth);return;}
    const c=[p[0],p[1],p[2],p[0].clone().lerp(p[1],.5),p[1].clone().lerp(p[2],.5),p[2].clone().lerp(p[0],.5)];
    QUARTERS.forEach((quarter,k)=>{const r=quarter.map(i=>c[i]);split(r,under(...r),depth+1,code|k<<(3+2*depth));});
   };
   split([a.clone(),b.clone(),c.clone()],s,0,0);
   out.push(tri-previous,pieces.length,...pieces);previous=tri;
  });
 });
 geo.dispose();
 return plan;
}

// Cut the envelope as planned. Returns the triangles cut.
export function openWindows(ship,plan){
 let opened=0;
 envelopes(ship).forEach((o,index)=>{
  const cuts=plan[index];if(!cuts?.length)return;
  const g=o.geometry,idx=g.index?g.index.array:null,count=(idx?idx.length:g.attributes.position.count)/3,gone=new Uint8Array(count),pieces=[];
  for(let k=0,tri=0;k<cuts.length;){tri+=cuts[k];const n=cuts[k+1];gone[tri]=1;opened++;for(let p=0;p<n;p++)pieces.push(tri,cuts[k+2+p]);k+=2+n;}
  const keep=[];for(let t=0;t<count;t++)if(!gone[t])for(let k=0;k<3;k++)keep.push(idx?idx[t*3+k]:t*3+k);
  o.geometry=withPieces(g,keep,pieces,t=>idx?[idx[t*3],idx[t*3+1],idx[t*3+2]]:[t*3,t*3+1,t*3+2]);
 });
 return opened;
}
// A copy of `g` drawing the `keep` triangles plus the pieces ([triangle, code] pairs), whose corners are interpolated
// from their triangle's vertices (every attribute: position, normal, uv...).
function withPieces(g,keep,pieces,vertsOf){
 const out=new T.BufferGeometry(),base=g.attributes.position.count,added=pieces.length/2*3;
 const plan=[];for(let k=0;k<pieces.length;k+=2)plan.push([vertsOf(pieces[k]),decode(pieces[k+1])]);
 for(const [name,attr] of Object.entries(g.attributes)){
  const size=attr.itemSize,array=new Float32Array((base+added)*size);
  for(let i=0;i<base;i++)for(let k=0;k<size;k++)array[i*size+k]=attr.getComponent(i,k);
  let v=base;
  for(const [[i0,i1,i2],w] of plan)for(const [w0,w1,w2] of w){for(let k=0;k<size;k++)array[v*size+k]=w0*attr.getComponent(i0,k)+w1*attr.getComponent(i1,k)+w2*attr.getComponent(i2,k);v++;}
  if(name==='normal')for(let i=base;i<base+added;i++){const x=array[i*3],y=array[i*3+1],z=array[i*3+2],l=Math.hypot(x,y,z)||1;array[i*3]=x/l;array[i*3+1]=y/l;array[i*3+2]=z/l;}
  out.setAttribute(name,new T.BufferAttribute(array,size));
 }
 const index=keep;for(let i=base;i<base+added;i++)index.push(i);
 out.setIndex(index);return out;
}

export function clearGlass(root){
 const done=new Set();
 root.traverse(o=>{if(!o.isMesh)return;for(const mat of [].concat(o.material)){if(done.has(mat)||!CLEAR.test(mat.name||''))continue;done.add(mat);
  mat.color?.set(0xc8dce6);mat.opacity=.06;mat.metalness=0;mat.roughness=.04;mat.envMapIntensity=.4;mat.transparent=true;mat.depthWrite=false;mat.side=T.DoubleSide;mat.needsUpdate=true;}});
 return done.size;
}
