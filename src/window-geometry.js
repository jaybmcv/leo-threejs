import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';
import {tintWindow} from './glazing-finish.js';

// Subtract XY apertures directly from existing triangles. Interpolating every
// attribute preserves the original surface and smooth normals at cut edges.
function clip(poly,axis,edge,less){
 const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=less?a[axis]<=edge:a[axis]>=edge,ib=less?b[axis]<=edge:b[axis]>=edge;
  if(ia)out.push(a);if(ia!==ib){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,k)=>v+(b[k]-v)*t));}}
 return out;
}
function subtract(poly,r){
 let inner=poly;const out=[];
 for(const [axis,edge,less] of [[0,r.x0,true],[0,r.x1,false],[1,r.y0,true],[1,r.y1,false]]){
  const piece=clip(inner,axis,edge,less);if(piece.length>=3)out.push(piece);inner=clip(inner,axis,edge,!less);if(inner.length<3)break;
 }return out;
}
export function cutWindowApertures(mesh,rects){
 const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),names=['position',...Object.keys(g.attributes).filter(n=>n!=='position')],attrs=names.map(n=>g.attributes[n]),sizes=attrs.map(a=>a.itemSize),offsets=[];let stride=0;for(const s of sizes){offsets.push(stride);stride+=s;}
 const bins=new Map(),cell=4;rects.forEach((r,i)=>{for(let x=Math.floor(r.x0/cell);x<=Math.floor(r.x1/cell);x++)for(let y=Math.floor(r.y0/cell);y<=Math.floor(r.y1/cell);y++){const k=x+','+y;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(i);}});
 const result=attrs.map(()=>[]),ix=g.index,p=g.attributes.position;let affected=0;
 for(let i=0;i<(ix?.count||p.count);i+=3){const tri=[];for(let j=0;j<3;j++){const n=ix?ix.getX(i+j):i+j,v=[];for(const a of attrs)for(let k=0;k<a.itemSize;k++)v.push(a.array[n*a.itemSize+k]);tri.push(v);}
  const xs=tri.map(v=>v[0]),ys=tri.map(v=>v[1]),candidates=new Set();
  for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)for(let y=Math.floor(Math.min(...ys)/cell);y<=Math.floor(Math.max(...ys)/cell);y++)for(const id of bins.get(x+','+y)||[])candidates.add(id);
  let polys=[tri];for(const id of candidates){const r=rects[id];if(Math.max(...xs)<=r.x0||Math.min(...xs)>=r.x1||Math.max(...ys)<=r.y0||Math.min(...ys)>=r.y1)continue;polys=polys.flatMap(poly=>subtract(poly,r));affected++;}
  for(const poly of polys)for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]])attrs.forEach((a,k)=>{for(let c=0;c<sizes[k];c++)result[k].push(v[offsets[k]+c]);});
 }
 const out=new T.BufferGeometry();names.forEach((n,k)=>out.setAttribute(n,new T.Float32BufferAttribute(result[k],sizes[k])));out.applyMatrix4(mesh.matrixWorld.clone().invert());out.computeBoundingBox();out.computeBoundingSphere();out.normalizeNormals();mesh.geometry=mergeVertices(out,1e-5);
 const clean=[],idx=mesh.geometry.index,pp=mesh.geometry.attributes.position,va=new T.Vector3(),vb=new T.Vector3(),vc=new T.Vector3();
 for(let i=0;i<idx.count;i+=3){const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);va.fromBufferAttribute(pp,a);vb.fromBufferAttribute(pp,b).sub(va);vc.fromBufferAttribute(pp,c).sub(va);if(a!==b&&b!==c&&a!==c&&vb.cross(vc).lengthSq()>1e-16)clean.push(a,b,c);}
 mesh.geometry.setIndex(clean);out.dispose();g.dispose();return affected;
}

export function addGlazing(root,rects,side,steel,glass,lining,prefix='V33',orientation=1){
 function mapped(g,s,offset){const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,s*(side(x,y)+offset*orientation));}g.computeVertexNormals();return g;}
 for(const s of [-1,1]){
  const panes=[],frames=[],reveals=[];
  for(const r of rects){const {x0,x1,y0,y1}=r;
   panes.push(mapped(new T.PlaneGeometry(x1-x0,y1-y0,4,2).translate((x0+x1)/2,(y0+y1)/2,0),s,-.08));
   const shape=new T.Shape();shape.moveTo(x0-.13,y0-.12);shape.lineTo(x1+.13,y0-.12);shape.lineTo(x1+.13,y1+.12);shape.lineTo(x0-.13,y1+.12);shape.closePath();const hole=new T.Path();hole.moveTo(x0,y0);hole.lineTo(x0,y1);hole.lineTo(x1,y1);hole.lineTo(x1,y0);hole.closePath();shape.holes.push(hole);
   frames.push(mapped(new TessellateModifier(.8,4).modify(new T.ShapeGeometry(shape)),s,y0<-17?.34:.045));
   const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],v=[];for(let j=0;j<4;j++){const a=corners[j],b=corners[(j+1)%4],az=s*side(...a),bz=s*side(...b);v.push(...a,az,...b,bz,...a,az-s*.32*orientation,...b,bz,...b,bz-s*.32*orientation,...a,az-s*.32*orientation);}const rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(v,3));rg.computeVertexNormals();reveals.push(rg);
  }
  for(const [name,gs,mat] of [[prefix+'_passenger_glazing',panes,glass],[prefix+'_passenger_window_frames',frames,steel],[prefix+'_passenger_window_reveals',reveals,lining]]){const m=new T.Mesh(mergeGeometries(gs),mat);m.name=name;m.userData={side:s,windowCount:rects.length};m.castShadow=false;if(name.endsWith('_passenger_glazing'))tintWindow(m,()=>new T.Vector3(0,0,s*orientation));root.add(m);gs.forEach(g=>g.dispose());}
 }
}
