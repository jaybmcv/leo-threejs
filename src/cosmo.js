import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createDLCat} from './vendor/cosmo/DLCat.js';

// Cosmo, the Mars Cats Voyage crew cat, stands in for the blockout figures. The rig ships in a T-pose with no motion
// clips, so it is posed once (arms relaxed at the sides) and baked into four static meshes that every figure shares.
export const COSMO_HEIGHT=1.75;
const FIGURE_NAMES=new Set(['Mars_cat_1.75m','Resident_scale_1_75m']);

// Turn a bone in world space so the segment towards `child` points along `target`.
function aim(bone,child,target){
 const from=child.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize();
 const turn=new T.Quaternion().setFromUnitVectors(from,target.clone().normalize());
 const world=turn.multiply(bone.getWorldQuaternion(new T.Quaternion()));
 bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world));
 bone.updateMatrixWorld(true);
}

function relaxArms(cat){
 const bones=cat.meshes[0].skeleton;cat.root.updateMatrixWorld(true);
 for(const side of ['L','R']){
  const upper=bones.getBoneByName('upper_arm'+side),fore=bones.getBoneByName('forearm'+side),hand=bones.getBoneByName('hand'+side);
  if(!upper||!fore||!hand)throw new Error('Cosmo rig is missing the '+side+' arm');
  const out=Math.sign(fore.getWorldPosition(new T.Vector3()).x-upper.getWorldPosition(new T.Vector3()).x)||1;
  aim(upper,fore,new T.Vector3(out*.2,-1,.04));aim(fore,hand,new T.Vector3(out*.12,-1,.32));
 }
}

// Apply the posed skin on the CPU: bindMatrixInverse · Σ w·(bone.matrixWorld · boneInverse) · bindMatrix.
function bake(mesh,toRoot){
 const g=mesh.geometry,pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
 const {bones,boneInverses}=mesh.skeleton,boneMatrices=bones.map((b,i)=>new T.Matrix4().multiplyMatrices(b.matrixWorld,boneInverses[i]).elements);
 const P=new Float32Array(pos.count*3),N=new Float32Array(pos.count*3),skin=new T.Matrix4(),normalMatrix=new T.Matrix3(),v=new T.Vector3(),n=new T.Vector3();
 for(let i=0;i<pos.count;i++){
  const e=skin.elements;e.fill(0);
  for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(!w)continue;const m=boneMatrices[si.getComponent(i,k)];for(let j=0;j<16;j++)e[j]+=m[j]*w;}
  skin.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix).premultiply(toRoot);
  v.fromBufferAttribute(pos,i).applyMatrix4(skin);P[i*3]=v.x;P[i*3+1]=v.y;P[i*3+2]=v.z;
  if(nor){n.fromBufferAttribute(nor,i).applyMatrix3(normalMatrix.getNormalMatrix(skin)).normalize();N[i*3]=n.x;N[i*3+1]=n.y;N[i*3+2]=n.z;}
 }
 const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(P,3));
 out.setAttribute('uv',uv?uv.clone():new T.BufferAttribute(new Float32Array(pos.count*2),2));
 out.setIndex(g.index?g.index.clone():[...Array(pos.count).keys()]);
 if(nor)out.setAttribute('normal',new T.BufferAttribute(N,3));else out.computeVertexNormals();
 return out;
}

export async function createCosmoKit(){
 const cat=await createDLCat({height:COSMO_HEIGHT,castShadow:true,receiveShadow:true});
 relaxArms(cat);
 const byMaterial=new Map(),rootInverse=cat.root.matrixWorld.clone().invert();
 for(const mesh of cat.meshes){
  if(Array.isArray(mesh.material))throw new Error('Cosmo mesh '+mesh.name+' uses several materials');
  const list=byMaterial.get(mesh.material)||[];list.push(bake(mesh,new T.Matrix4().multiplyMatrices(rootInverse,mesh.matrixWorld)));byMaterial.set(mesh.material,list);
 }
 const parts=[...byMaterial].map(([material,list])=>{const geometry=mergeGeometries(list);if(!geometry)throw new Error('Could not merge Cosmo '+material.name);geometry.computeBoundingSphere();return {material,geometry};});
 // The baked meshes keep the rig's materials and textures; only the skinned source is released.
 cat.root.removeFromParent();cat.mixer.stopAllAction();
 return {parts,figure(){
  const g=new T.Group();g.name='Cosmo';
  for(const {material,geometry} of parts){const m=new T.Mesh(geometry,material);m.name='Cosmo_'+(material.name||'part');m.castShadow=true;m.receiveShadow=true;g.add(m);}
  return g;
 }};
}

// Swap every blockout cat under `root` for Cosmo. Idempotent; the blockout meshes stay, hidden, as the fallback.
// `visibleOnly` limits the walk to what is on screen, for the viewer's cheap periodic sweep.
export function dressCats(root,kit,visibleOnly=false){
 const found=[];root[visibleOnly?'traverseVisible':'traverse'](o=>{if(FIGURE_NAMES.has(o.name)&&!o.userData.cosmo)found.push(o);});
 for(const figure of found){
  for(const child of figure.children)child.visible=false;
  const cosmo=kit.figure();cosmo.scale.setScalar(1/(figure.scale.x||1));figure.add(cosmo);figure.userData.cosmo=true;
 }
 return found.length;
}
