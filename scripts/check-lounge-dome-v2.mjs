import assert from 'node:assert/strict';
import * as T from 'three';
import {createHydroNipLounge,LOUNGE} from '../src/hydro-nip-lounge.js';
import {solid} from '../src/walk/collision.js';

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
const halo=root.getObjectByName('Lounge_dome_tube_glow_loose');assert(halo&&!solid(halo));
assert(halo.material.blending===T.AdditiveBlending&&!halo.material.depthWrite&&halo.material.opacity<.2,'Faint additive tube halo');
console.log('PASS dome planting:',plants.length,'instance batches,',triangles,'triangles,',vertices,'bounded vertices; polished base, additive halo, no lights or new colliders');
