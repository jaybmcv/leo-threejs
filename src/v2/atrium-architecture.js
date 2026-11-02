import {ATRIUM_PROTOTYPE} from '../plan/atrium-v2.js';
import {atriumFloorGeometry,atriumFloorMaterial,skyCeilingGeometry,skyMaterial} from './atrium-surfaces.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {placements,doorSide} from './cabins.js';
export function addPhase6Architecture(ship,root,layout){
 // Pure proxy/facade fixtures do not instantiate the physical ship. They use
 // the same actual surface factories, never a solid approximation of its void.
 if(!ship.root){const source=new T.Group(),deck=new T.Group();deck.userData.number=6;source.add(deck);const floor=new T.Mesh(atriumFloorGeometry(layout.decks[5].slab.outline,layout.decks[5].slab.holes.map(h=>h.polygon),layout.decks[5].y,layout.decks[5].atrium.outline),atriumFloorMaterial);floor.name='Deck_slab';deck.add(floor);const sky=new T.Mesh(skyCeilingGeometry(layout),skyMaterial());sky.name='P6_sky_ceiling';source.add(sky);ship={...ship,root:source};}
 const selected=[];ship.root.updateMatrixWorld(true,true);ship.root.traverse(o=>{
  if(o.isInstancedMesh&&/^P4_p6_terrace_(glass|rail)$/.test(o.name)){for(let i=0;i<o.count;i++){const q=new T.Mesh(o.geometry,o.material),m=new T.Matrix4();o.getMatrixAt(i,m);q.name='P6_terrace_guard_actual';q.matrixWorld.copy(o.matrixWorld).multiply(m);selected.push({o:q,kind:'tower'});}o.userData.phase6ArchitectureSource=true;o.visible=false;return;}
  if(!o.isMesh||o.isInstancedMesh||!o.geometry?.attributes.position?.count||Array.isArray(o.material))return;
  for(let q=o;q;q=q.parent)if(!q.visible||q.userData.keepLive)return;
  if(o.userData.phase6SkyTip||o.name==='P6_sky_ceiling'||o.name==='P6_lake_water'||o.name==='Deck_slab'&&o.parent.userData.number===6){selected.push({o,kind:o.name==='Deck_slab'?'floor':o.name==='P6_lake_water'?'water':'sky'});return;}
  const b=new T.Box3().setFromObject(o,true);
  if((b.min.x>=126&&b.max.x<=138&&Math.max(Math.abs(b.min.z),Math.abs(b.max.z))<=10.2||b.min.x>=-141&&b.max.x<=-122&&Math.max(Math.abs(b.min.z),Math.abs(b.max.z))<=19)&&b.min.y>=-40.8&&b.max.y<=40.3||/^(V2_tower_(bridge|landing)_floor|V2_lounge_balcony_floor)$/.test(o.name))selected.push({o,kind:'tower'});
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
 // Open atrium-facing room carcasses only. Their glass front stays open;
 // the opaque sides/back/floor/ceiling describe the real room behind it.
 const cabins=placements().filter(c=>c.view==='atrium');
 for(const side of[-1,1]){const list=cabins.filter(c=>doorSide(c)===side),g=new T.BoxGeometry(3.18,3.4,7.4),p=g.attributes.position,keep=[];
  for(let i=0;i<g.index.count;i+=3){const ids=[0,1,2].map(k=>g.index.getX(i+k));if(!ids.every(j=>Math.abs(p.getZ(j)+side*3.7)<.0001))keep.push(...ids);}
  g.setIndex(keep);g.clearGroups();const o=new T.InstancedMesh(g,new T.MeshBasicMaterial({name:'P6_atrium_room_returns',color:0xded4bd,side:T.DoubleSide}),list.length);
  o.name='P6_atrium_room_returns';o.frustumCulled=false;o.userData={noCollide:true,phase6Architecture:true,roomOwners:list.map(c=>c.id),proxySpans:list.map(c=>[c.y-.14,c.y+3.5])};
  list.forEach((c,i)=>o.setMatrixAt(i,c.matrix.clone().multiply(new T.Matrix4().makeTranslation(0,1.7,0))));o.computeBoundingBox();o.computeBoundingSphere();root.add(o);
 }
 // Distant bow/stern backdrop comes from the finished, aperture-cut web skin.
 // Retain only axial end faces; no opaque planes are substituted for windows.
 const endFaces=[];ship.exterior?.updateWorldMatrix(true,true);ship.exterior?.traverse(o=>{if(!o.isMesh||!/^Smooth_pressure_envelope/.test(o.name))return;const p=o.geometry.attributes.position,ix=o.geometry.index;
  for(let i=0;i<(ix?.count??p.count);i+=3){const t=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld));
   if(t.every(q=>q.y< -20)||t.every(q=>q.y>40.1)||!t.some(q=>(q.x>145||q.x< -122)&&Math.abs(q.z)<30))continue;for(const q of t)endFaces.push(q.x,q.y,q.z);}
 });
 if(endFaces.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(endFaces,3));g.computeBoundingBox();g.computeBoundingSphere();const o=new T.Mesh(g,new T.MeshBasicMaterial({name:'P6_distant_finished_end_skin',color:0xd9dcd6,side:T.DoubleSide}));o.name='P6_distant_finished_end_skin';o.frustumCulled=false;o.userData={noCollide:true,phase6Architecture:true,distantOnly:true,finishedWebTriangles:true};root.add(o);}
 root.userData.phase6Architecture={actualSources:selected.length,materialClasses:buckets.size,sourceNames:[...new Set(sourceNames)],atriumCabins:cabins.length,proxyClasses:2,endSkinTriangles:endFaces.length/9,interiorReach:ATRIUM_PROTOTYPE.interiorReach};
 for(const o of root.children)if(o.userData.distantOnly)o.visible=false;
 return root.userData.phase6Architecture;
}
export function attachDistantArchitecture(ship,root){
 // Clone only after the finished-skin/room retirement has completed.
 if(ship.v2Haze){const distant=root.clone(true);distant.traverse(o=>{if(o.userData.distantOnly)o.visible=true;});distant.name='P6_distant_atrium_architecture';const materials=new Map();distant.traverse(o=>{if(!o.isMesh)return;let m=materials.get(o.material);if(!m){const source=o.material;m=new T.MeshBasicMaterial({name:'P6_distant_'+source.name,color:source.color||0xffffff,map:source.map||null,vertexColors:!!source.vertexColors,transparent:!!source.transparent,opacity:source.opacity,side:source.side,depthWrite:source.depthWrite,fog:source.fog});m.forceSinglePass=true;materials.set(source,m);}o.material=m;});distant.traverse(o=>{if(o.userData.proxySpans)o.userData.distantProxy=true;});ship.v2Haze.add(distant);}
 return root.userData.phase6Architecture;
}
