import * as T from 'three';

function clip(poly,axis,limit,less){
 const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=less?a[axis]<=limit:a[axis]>=limit,ib=less?b[axis]<=limit:b[axis]>=limit;if(ia)out.push(a);if(ia!==ib){const t=(limit-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,k)=>v+(b[k]-v)*t));}}return out;
}
// Keep the original curved white underside. Only the occupied upper portion
// is replaced by the lounge, and only its lift footprint cuts the lower shell.
export function retainFinCapUnderside(mesh,top,lift){
 mesh.updateWorldMatrix(true,false);const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),p=g.attributes.position,n=g.attributes.normal,ix=g.index,positions=[],normals=[];
 for(let i=0;i<(ix?.count||p.count);i+=3){let poly=[];for(let j=0;j<3;j++){const k=ix?ix.getX(i+j):i+j;poly.push([p.getX(k),p.getY(k),p.getZ(k),n.getX(k),n.getY(k),n.getZ(k)]);}poly=clip(poly,1,top,true);if(poly.length<3)continue;
  let inner=poly;const pieces=[];for(const [axis,limit,less]of [[0,lift.x0,true],[0,lift.x1,false],[2,lift.z0,true],[2,lift.z1,false]]){const q=clip(inner,axis,limit,less);if(q.length>=3)pieces.push(q);inner=clip(inner,axis,limit,!less);if(inner.length<3)break;}
  for(const q of pieces)for(let j=1;j<q.length-1;j++)for(const v of [q[0],q[j],q[j+1]]){positions.push(...v.slice(0,3));normals.push(...v.slice(3));}
 }
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(positions,3));result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));result.applyMatrix4(mesh.matrixWorld.clone().invert());result.normalizeNormals();mesh.geometry=result;mesh.name='Fin_cap_retained_white_underside';mesh.userData.retainedCap={top,lift,source:'Swept_tail_cap'};g.dispose();
}
