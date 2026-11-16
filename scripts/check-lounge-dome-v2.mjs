import assert from 'node:assert/strict';
import * as T from 'three';
import {createHydroNipLounge,LOUNGE} from '../src/hydro-nip-lounge.js';
import {solid} from '../src/walk/collision.js';
import {bakeForWalking} from '../src/walk/render-bake.js';
import {bakeForWalking as authoringBake} from '../src/walk/render-bake.authoring.js';

const root=createHydroNipLounge(),{DOME,FLOOR}=LOUNGE,plants=[];
root.traverse(o=>{if(o.isInstancedMesh&&/^Lounge_dome_/.test(o.name))plants.push(o);assert(!o.isLight,'Dome dressing adds no lights');});
assert.equal(plants.length,6,'Five plant kinds and one moss batch');
const matrix=new T.Matrix4(),point=new T.Vector3();let triangles=0,vertices=0;
for(const mesh of plants){
 assert(!solid(mesh)&&mesh.userData.noCollide,'Plants never add collision');
 assert(mesh.count>=10,'Each kind is scattered around the ring');
 const p=mesh.geometry.attributes.position;
 triangles+=(mesh.geometry.index?.count??p.count)/3*mesh.count;
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);
  for(let k=0;k<p.count;k++){
   point.fromBufferAttribute(p,k).applyMatrix4(matrix);const dx=point.x-DOME.x,dz=point.z-DOME.z,r=Math.hypot(dx,dz);
   assert(r>DOME.r+.15&&r<DOME.r+.95,'Every leaf, cap and speck stays within the planter');
   assert(point.y>=FLOOR+.5&&point.y<FLOOR+1.2,'Planting stays on the soil and below the old bushes');
   assert(dz>=0||Math.abs(dx)>1.15,'Planting leaves the entrance gap clear');vertices++;
  }
 }
}
assert(triangles<30000,'Instanced planting stays within a small triangle budget');
const base=root.getObjectByName('Lounge_dome_planter');assert(base&&solid(base));
assert(base.material.roughness<=.16&&base.material.metalness>=.5,'Black base keeps environment specular highlights');
for(const bake of [bakeForWalking,authoringBake]){
 const sample=new T.Group();sample.add(base.clone());
 const witness=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0x333333}));witness.position.set(100,FLOOR,0);sample.add(witness);
 const baked=bake(sample),materials=[];for(const band of baked.bands.values())band.traverse(o=>{if(o.isMesh)materials.push(o.material);});
 const finish=materials.find(m=>m.name==='Lounge_dome_planter');assert(finish,'The baked planter retains its own finish');
 assert(finish.isMeshPhysicalMaterial&&finish.clearcoat>=.8&&finish.envMapIntensity>=3,'The clear coat and environment sheen survive the walk merge');
 const restored=new T.MaterialLoader().parse(finish.toJSON());assert.equal(restored.clearcoat,finish.clearcoat);assert.equal(restored.envMapIntensity,finish.envMapIntensity);
 assert(materials.some(m=>m.name.startsWith('Walk_finish_')),'Ordinary materials still share the existing finish buckets');
}
console.log('PASS polished planter finish survives native/authoring bake and material serialization; ordinary finish merging unchanged');
const halo=root.getObjectByName('Lounge_dome_tube_glow_loose');assert(halo&&!solid(halo));
assert(halo.material.blending===T.AdditiveBlending&&!halo.material.depthWrite&&halo.material.opacity<.2,'Faint additive tube halo');
console.log('PASS dome planting:',plants.length,'instance batches,',triangles,'triangles,',vertices,'bounded vertices; polished base, additive halo, no lights or new colliders');
