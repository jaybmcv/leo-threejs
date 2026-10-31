import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function addPhase6Architecture(ship,root,layout){
 const selected=[];ship.root.updateMatrixWorld(true,true);ship.root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||!o.geometry?.attributes.position?.count||Array.isArray(o.material))return;
  for(let q=o;q;q=q.parent)if(!q.visible||q.userData.keepLive)return;
  if(o.name==='P6_sky_ceiling'||o.name==='P6_lake_water'||o.name==='Deck_slab'&&o.parent.userData.number===6){selected.push({o,kind:o.name==='Deck_slab'?'floor':o.name==='P6_lake_water'?'water':'sky'});return;}
  const b=new T.Box3().setFromObject(o,true);
  if(b.min.x>=126&&b.max.x<=138&&Math.max(Math.abs(b.min.z),Math.abs(b.max.z))<=10.2&&b.min.y>=-40.8&&b.max.y<=40.3||/^(V2_tower_(bridge|landing)_floor|V2_lounge_balcony_floor)$/.test(o.name))selected.push({o,kind:'tower'});
 });
 const buckets=new Map(),sourceNames=[];
 for(const {o,kind} of selected){
  sourceNames.push(o.name);
  if(kind!=='tower'){const clone=new T.Mesh(o.geometry,o.material);clone.name=kind==='floor'?'P6_atrium_floor_actual':o.name;clone.matrixAutoUpdate=false;clone.matrix.copy(o.matrixWorld);clone.userData={noCollide:true,phase6Architecture:true,role:kind,actualSource:o.name};root.add(clone);o.visible=false;continue;}
  const m=o.material,key=[m.type,m.roughness,m.metalness,!!m.transparent,m.opacity,m.side,m.emissive?.getHex(),m.emissiveIntensity,m.map?.uuid,m.normalMap?.uuid,m.normalScale?.toArray().join(','),m.roughnessMap?.uuid,m.metalnessMap?.uuid,m.emissiveMap?.uuid,m.alphaMap?.uuid,m.aoMap?.uuid,m.envMap?.uuid,m.envMapIntensity,m.depthWrite,m.depthTest,m.alphaTest,m.blending,m.premultipliedAlpha,m.polygonOffset,m.polygonOffsetFactor,m.polygonOffsetUnits,m.flatShading,m.toneMapped,m.fog,m.wireframe].join('|');
  let b=buckets.get(key);if(!b){const material=m.clone();material.name='P6_tower_architecture';material.color?.set(0xffffff);material.vertexColors=true;if(material.transparent&&material.side===2)material.forceSinglePass=true;b={parts:[],material};buckets.set(key,b);}
  let g=o.geometry.clone();if(g.index)g=g.toNonIndexed();g.applyMatrix4(o.matrixWorld);
  if(!g.attributes.normal)g.computeVertexNormals();if(!m.map)g.deleteAttribute('uv');else if(!g.attributes.uv)g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  for(const name of Object.keys(g.attributes))if(!['position','normal','uv','color'].includes(name))g.deleteAttribute(name);
  const tint=m.color||new T.Color(1,1,1),prior=g.attributes.color,c=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<g.attributes.position.count;i++)c.set([tint.r*(prior?prior.getX(i):1),tint.g*(prior?prior.getY(i):1),tint.b*(prior?prior.getZ(i):1)],i*3);
  g.setAttribute('color',new T.BufferAttribute(c,3));b.parts.push(g);o.visible=false;
 }
 for(const b of buckets.values()){const o=new T.Mesh(mergeGeometries(b.parts),b.material);o.name='P6_tower_architecture';o.userData={noCollide:true,phase6Architecture:true,actualSources:true};root.add(o);b.parts.forEach(g=>g.dispose());}
 // Far architectural room fronts are a visual LOD, hidden within 30 m of their room.
 const cafes=layout.rooms.filter(r=>r.id.startsWith('nose-commons-')),front=new T.InstancedMesh(new T.BoxGeometry(.04,3.3,11.8),new T.MeshBasicMaterial({name:'P6_bow_cafe_fronts',color:0xe6d5b4}),cafes.length);
 front.name='P6_bow_cafe_fronts';front.userData={noCollide:true,phase6Architecture:true,roomOwners:cafes.map(r=>r.id),nearHide:30};
 cafes.forEach((r,i)=>front.setMatrixAt(i,new T.Matrix4().makeTranslation(Math.min(...r.polygon.map(p=>p[0]))+.15,r.y+1.65,0)));front.computeBoundingBox();front.computeBoundingSphere();root.add(front);
 root.userData.phase6Architecture={actualSources:selected.length,materialClasses:buckets.size,sourceNames:[...new Set(sourceNames)],cafeFronts:cafes.length,interiorReach:8};
 return root.userData.phase6Architecture;
}
export function attachDistantArchitecture(ship,root){
 // Clone only after the finished-skin/room retirement has completed.
 if(ship.v2Haze){const distant=root.clone(true);distant.name='P6_distant_atrium_architecture';const materials=new Map();distant.traverse(o=>{if(!o.isMesh)return;let m=materials.get(o.material);if(!m){const source=o.material;m=new T.MeshBasicMaterial({name:'P6_distant_'+source.name,color:source.color||0xffffff,map:source.map||null,vertexColors:!!source.vertexColors,transparent:!!source.transparent,opacity:source.opacity,side:source.side,depthWrite:source.depthWrite,fog:source.fog});m.forceSinglePass=true;materials.set(source,m);}o.material=m;});ship.v2Haze.add(distant);}
 return root.userData.phase6Architecture;
}
