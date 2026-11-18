import * as T from 'three';
import {STERN,COLS,ROWS,tileId} from './graffiti-wall.js';

// Clip the actual finish triangles. No sampled plane can poke through this curved ceiling or cover a window.
function clip(poly,axis,at,sign){
 const out=[];for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-at)*sign,db=(b[axis]-at)*sign;
  if(da>=0)out.push(a);if((da>=0)!==(db>=0))out.push(a.clone().lerp(b,da/(da-db)));
 }return out;
}
export function graffitiSurface(bands){
 const tiles=new Map(),box=new T.Box3(new T.Vector3(STERN.x0,STERN.y0,STERN.z0),new T.Vector3(STERN.x1,STERN.y1,STERN.z1));
 for(const group of bands)group.traverse(o=>{
  const g=o.geometry,p=g?.attributes.position;
  if(!o.isMesh||!p?.array||![o.material].flat().some(m=>m?.name==='Walk_finish_4|1|2|0'))return;
  o.updateWorldMatrix(true,false);if(!g.boundingBox)g.computeBoundingBox();if(!box.intersectsBox(g.boundingBox.clone().applyMatrix4(o.matrixWorld)))return;
  const ix=g.index,n=ix?ix.count:p.count;
  for(let i=0;i<n;i+=3){
   const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld));
   if(!box.intersectsBox(new T.Box3().setFromPoints(v)))continue;
   const normal=new T.Vector3().subVectors(v[1],v[0]).cross(new T.Vector3().subVectors(v[2],v[0])).normalize();
   if(Math.abs(normal.y)<.7||Math.abs(normal.x)<.08||Math.abs(normal.x)>.7)continue;
   if(normal.x<0)normal.negate();if(normal.y>0)continue;
   let poly=v;for(const [axis,lo,hi] of [['x',STERN.x0,STERN.x1],['y',STERN.y0,STERN.y1],['z',STERN.z0,STERN.z1]]){poly=clip(poly,axis,lo,1);poly=clip(poly,axis,hi,-1);}
   if(poly.length<3)continue;
   const bounds=new T.Box3().setFromPoints(poly),c0=Math.max(0,Math.floor((bounds.min.z-STERN.z0)/STERN.dz)),c1=Math.min(COLS-1,Math.floor((bounds.max.z-STERN.z0)/STERN.dz));
   const r0=Math.max(0,Math.floor((bounds.min.x-STERN.x0)/STERN.dx)),r1=Math.min(ROWS-1,Math.floor((bounds.max.x-STERN.x0)/STERN.dx));
   for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){
    const x0=STERN.x0+row*STERN.dx,z0=STERN.z0+col*STERN.dz;
    let cut=clip(clip(clip(clip(poly,'x',x0,1),'x',x0+STERN.dx,-1),'z',z0,1),'z',z0+STERN.dz,-1);if(cut.length<3)continue;
    const id=tileId(col,row);let tile=tiles.get(id);if(!tile)tiles.set(id,tile={id,col,row,positions:[],uv:[]});
    for(let j=1;j<cut.length-1;j++)for(const q of [cut[0],cut[j],cut[j+1]]){
     const a=q.clone();a.y-=.006;tile.positions.push(a.x,a.y,a.z);
     tile.uv.push(1-(q.z-z0)/STERN.dz,(q.x-x0)/STERN.dx);
    }
   }
  }
 });
 const mesh=new T.Group();mesh.name='Walk_graffiti_wall';mesh.userData={noCollide:true,renderOnly:true};
 for(const tile of tiles.values()){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(tile.positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(tile.uv,2));g.computeVertexNormals();g.computeBoundingBox();
  tile.centre=g.boundingBox.getCenter(new T.Vector3());tile.bounds=g.boundingBox.clone();
  tile.mesh=new T.Mesh(g,new T.MeshStandardMaterial({name:'Walk_graffiti_paint',transparent:true,opacity:0,roughness:.6,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  tile.mesh.name='Graffiti_'+tile.id;tile.mesh.userData.tile=tile.id;tile.mesh.visible=false;mesh.add(tile.mesh);delete tile.positions;delete tile.uv;
 }
 if(!tiles.size)throw Error('Deck 19 stern paint finish missing');
 return {mesh,tiles};
}
