import * as T from 'three';

export const rectangle=r=>[[r.x0,r.z0],[r.x1,r.z0],[r.x1,r.z1],[r.x0,r.z1]];
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function clip(poly,a,b,inside){
  const out=[];
  for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],cp=cross(a,b,p),cq=cross(a,b,q),pin=inside?cp>=-1e-8:cp<=1e-8,qin=inside?cq>=-1e-8:cq<=1e-8;
    if(pin)out.push(p);
    if(pin!==qin){const t=cp/(cp-cq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
  }
  return out.filter((p,i)=>!i||Math.hypot(p[0]-out[i-1][0],p[1]-out[i-1][1])>1e-7);
}
const area=poly=>poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-p[1]*q[0];},0)/2;
export function subtractConvex(poly,hole){
  if(area(poly)<0)poly=poly.slice().reverse();if(area(hole)<0)hole=hole.slice().reverse();
  let pending=poly;const pieces=[];
  for(let i=0;i<hole.length&&pending.length>=3;i++){
    const a=hole[i],b=hole[(i+1)%hole.length],outside=clip(pending,a,b,false);
    if(outside.length>=3&&Math.abs(area(outside))>1e-7)pieces.push(outside);
    pending=clip(pending,a,b,true);
  }
  return pieces;
}
export function cutPolygons(polygons,holes){
  for(const h of holes)polygons=polygons.flatMap(p=>subtractConvex(p,h));return polygons;
}
export function unionRectangles(rectangles,holes=[]){
  const accepted=[],pieces=[];
  for(const r of rectangles){const p=rectangle(r);pieces.push(...cutPolygons([p],accepted));accepted.push(p);}
  return cutPolygons(pieces,holes.map(h=>Array.isArray(h)?h:rectangle(h)));
}
export function slabGeometry(polygons,y,depth=.24){
  const p=[];const tri=(a,b,c)=>p.push(...a,...b,...c);
  for(let poly of polygons){
    if(area(poly)<0)poly=poly.slice().reverse();
    const top=poly.map(([x,z])=>[x,y,z]),bottom=poly.map(([x,z])=>[x,y-depth,z]);
    for(let i=1;i<poly.length-1;i++){tri(top[0],top[i+1],top[i]);tri(bottom[0],bottom[i],bottom[i+1]);}
    for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;tri(top[i],top[j],bottom[j]);tri(top[i],bottom[j],bottom[i]);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.computeVertexNormals();return geometry;
}
export function outlinedSlab(outline,holes,y,depth=.28){
  const shape=new T.Shape(outline.map(p=>new T.Vector2(...p))),g=new T.ShapeGeometry(shape),pos=g.attributes.position,idx=g.index.array,triangles=[];
  for(let i=0;i<idx.length;i+=3)triangles.push([0,1,2].map(k=>[pos.getX(idx[i+k]),pos.getY(idx[i+k])]));
  g.dispose();return slabGeometry(cutPolygons(triangles,holes.map(h=>Array.isArray(h)?h:rectangle(h))),y,depth);
}
