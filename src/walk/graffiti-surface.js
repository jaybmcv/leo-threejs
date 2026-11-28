import * as T from 'three';
import {SECTION,STERN,WALL} from './graffiti-wall.js';

const {floor,top,x0,x1,z0,z1}=STERN,span=(z1-z0)/SECTION.count;
const clip=(points,axis,at,sign)=>{
 const out=[];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],da=sign*(a.getComponent(axis)-at),db=sign*(b.getComponent(axis)-at);
  if(da>=0)out.push(a);
  if((da<0)!==(db<0))out.push(a.clone().lerp(b,da/(da-db)).setComponent(axis,at));
 }
 return out;
};

// Use the pressure skin's actual render faces, before draw batching or GPU upload releases their arrays.
// The slope is already triangulated. Clip its flat faces to the paint strip and divide them at the canvas joins.
export function sternPaintSurfaces(baked){
 const group=new T.Group();group.name='Walk_stern_graffiti';group.position.y=floor;group.userData.noCollide=true;
 const parts=Array.from({length:SECTION.count},()=>({positions:[],uvs:[]}));
 const bounds=new T.Box3(new T.Vector3(x0,floor,z0),new T.Vector3(x1,top,z1));
 const normal=new T.Vector3(),edge=new T.Vector3(),box=new T.Box3();
 for(const band of baked.bands.values()){
  if(band.userData.band>20||band.userData.top<17)continue;
  band.updateWorldMatrix(true,false);
  for(const mesh of band.children){
   if(!mesh.isMesh||!mesh.name.startsWith('Walk_merged_Walk_finish_'))continue;
   const g=mesh.geometry,p=g.attributes.position,index=g.index;if(!p?.array||!g.boundingBox)continue;
   mesh.updateWorldMatrix(false,false);if(!box.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld).intersectsBox(bounds))continue;
   for(const range of g.userData.preparedRanges||[]){
    if(!/^Smooth_pressure_envelope/.test(range.name))continue;
    for(let t=range.start*3;t<(range.start+range.count)*3;t+=3){
     const tri=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index?index.getX(t+k):t+k).applyMatrix4(mesh.matrixWorld));
     if(!box.setFromPoints(tri).intersectsBox(bounds))continue;
     normal.subVectors(tri[1],tri[0]).cross(edge.subVectors(tri[2],tri[0]));
     if(Math.abs(normal.y)<1e-8||normal.x/normal.y>=0)continue;
     if(normal.y>0)tri.reverse();
     let poly=tri;
     for(const [axis,at,sign] of [[0,x0,1],[0,x1,-1],[1,floor,1],[1,top,-1],[2,z0,1],[2,z1,-1]])poly=clip(poly,axis,at,sign);
     if(poly.length<3)continue;
     box.setFromPoints(poly);
     const first=Math.max(0,Math.floor((box.min.z-z0)/span)),last=Math.min(SECTION.count-1,Math.floor((box.max.z-z0)/span));
     for(let id=first;id<=last;id++){
      const left=z0+id*span,face=clip(clip(poly,2,left,1),2,left+span,-1),part=parts[id];
      for(let k=2;k<face.length;k++)for(const q of [face[0],face[k-1],face[k]]){
       part.positions.push(q.x,q.y-floor-.006,q.z);
       part.uvs.push((q.z-left)/span,(q.x-x0)/(x1-x0));
      }
     }
    }
   }
  }
 }
 const blank=new T.MeshBasicMaterial({visible:false,transparent:true});
 const meshes=parts.map(({positions,uvs},id)=>{
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  g.computeVertexNormals();g.computeBoundingSphere();
  const mesh=new T.Mesh(g,blank);mesh.name='Walk_graffiti_section_'+id;mesh.userData.section=id;mesh.visible=false;group.add(mesh);return mesh;
 });
 group.updateMatrixWorld(true);
 return {group,meshes,blank};
}

export const paintCell=hit=>[
 Math.min(WALL.w-1,Math.floor((hit.object.userData.section+T.MathUtils.clamp(hit.uv.x,0,1))*SECTION.w)),
 Math.min(WALL.h-1,Math.floor((1-T.MathUtils.clamp(hit.uv.y,0,1))*SECTION.h))
];
