import * as T from 'three';

// Cut away whatever of `root`'s meshes (those `pick` takes) lies inside `box`, exactly: each triangle reaching into it
// is split along the box's faces and the pieces inside dropped, with every attribute carried across the cuts. A cut
// triangle keeps its place, collapsed to a point, and its pieces go at the end, so triangle numbers stay put (the
// hull's window plan counts on them, windows.js).
export function cutOut(root,box,pick=()=>true){
 root.updateMatrixWorld(true);const tb=new T.Box3(),w=new T.Vector3();
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||!pick(o)||!new T.Box3().setFromObject(o).intersectsBox(box))return;
  const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry,names=Object.keys(g.attributes),attrs=names.map(n=>g.attributes[n]);
  // A vertex is its world position followed by every attribute's components.
  const vert=i=>{w.fromBufferAttribute(g.attributes.position,i).applyMatrix4(o.matrixWorld);const v=[w.x,w.y,w.z];for(const a of attrs)for(let k=0;k<a.itemSize;k++)v.push(a.getComponent(i,k));return v;};
  const lerp=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t),out=[],kept=[];let cut=false;
  for(let t=0;t<g.attributes.position.count;t+=3){
   let poly=[vert(t),vert(t+1),vert(t+2)];tb.makeEmpty();for(const v of poly)tb.expandByPoint(w.set(v[0],v[1],v[2]));
   if(!tb.intersectsBox(box)){kept.push(...poly);continue;}cut=true;kept.push(poly[0],poly[0],poly[0]);
   // Peel off the part beyond each face of the box in turn; what is left after all six is inside.
   for(let f=0;f<6&&poly.length;f++){const k=f>>1,d=v=>f&1?v[k]-box.max.getComponent(k):box.min.getComponent(k)-v[k],keep=[],rest=[];
    poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length],da=d(a),db=d(b);(da>0?keep:rest).push(a);if(da>0!==db>0){const c=lerp(a,b,da/(da-db));keep.push(c);rest.push(c);}});
    if(keep.length>2)out.push(keep);poly=rest.length>2?rest:[];}
  }
  if(!cut)return;
  // Fans of the pieces, without the slivers a cut along an edge leaves.
  const e1=new T.Vector3(),e2=new T.Vector3(),tris=kept;
  for(const p of out)for(let i=1;i<p.length-1;i++){const a=p[0],b=p[i],c=p[i+1];e1.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);e2.set(c[0]-a[0],c[1]-a[1],c[2]-a[2]);if(e1.cross(e2).lengthSq()>1e-12)tris.push(a,b,c);}
  const geo=new T.BufferGeometry(),n=tris.length;
  names.forEach((name,j)=>{const a=attrs[j],off=3+attrs.slice(0,j).reduce((s,x)=>s+x.itemSize,0),arr=new Float32Array(n*a.itemSize);let m=0;
   for(const v of tris)for(let k=0;k<a.itemSize;k++)arr[m++]=v[off+k];
   geo.setAttribute(name,new T.BufferAttribute(arr,a.itemSize));});
  o.geometry=geo;
 });
}
