import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createDLCat} from './vendor/cosmo/DLCat.js';

// Cosmo, the Mars Cats Voyage crew cat, stands in for the blockout figures. The rig ships in a T-pose with no motion
// clips, so it is posed once (a relaxed stand, below) and baked into four static meshes that every figure shares.
export const COSMO_HEIGHT=1.75;
const FIGURE_NAMES=new Set(['Mars_cat_1.75m','Resident_scale_1_75m']);

const DEG=Math.PI/180,X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const worldPos=o=>o.getWorldPosition(new T.Vector3()),worldQuat=o=>o.getWorldQuaternion(new T.Quaternion());

// Give a bone a world-space orientation, expressed in its parent's frame.
function setWorldQuat(bone,world){
 bone.quaternion.copy(worldQuat(bone.parent).invert().multiply(world));bone.updateMatrixWorld(true);
}
// Turn a bone in world space so the segment towards `child` points along `target`.
function aim(bone,child,target){
 const from=worldPos(child).sub(worldPos(bone)).normalize();
 setWorldQuat(bone,new T.Quaternion().setFromUnitVectors(from,target.clone().normalize()).multiply(worldQuat(bone)));
}
// Turn a bone about a world axis through its own pivot.
function turn(bone,axis,degrees){setWorldQuat(bone,new T.Quaternion().setFromAxisAngle(axis,degrees*DEG).multiply(worldQuat(bone)));}

// A relaxed stand instead of the rig's T-pose (Cosmo faces +z; his left is +x): weight on the left leg with the right
// knee soft, elbows and fingers loosely bent, the head tipped a little and the tail hanging low.
const ARM={L:{upper:[.2,-1,-.07],fore:[.07,-1,.42],curl:1},R:{upper:[.16,-1,-.03],fore:[.05,-1,.3],curl:.8}};
const FINGER_CURL={index:24,middle:30,ring:36,pinky:40};
function relaxArms(bone){
 for(const side of ['L','R']){
  const upper=bone('upper_arm.'+side),fore=bone('forearm.'+side),hand=bone('hand.'+side),out=Math.sign(worldPos(fore).x-worldPos(upper).x)||1,pose=ARM[side];
  turn(bone('shoulder.'+side),Z,-out*5);
  aim(upper,fore,new T.Vector3(out*pose.upper[0],pose.upper[1],pose.upper[2]));aim(fore,hand,new T.Vector3(out*pose.fore[0],pose.fore[1],pose.fore[2]));
  turn(hand,Y,-out*20);
  for(const [finger,deg] of Object.entries(FINGER_CURL))for(const joint of ['01','02','03'])bone(`f_${finger}.${joint}.${side}`).rotateX(deg*pose.curl*DEG);
  for(const joint of ['02','03'])bone(`thumb.${joint}.${side}`).rotateX(12*DEG);
 }
}
function relaxLegs(bone){
 const feet=['L','R'].map(side=>[bone('foot.'+side),worldQuat(bone('foot.'+side))]);
 const thigh=bone('thigh.R'),shin=bone('shin.R'),foot=bone('foot.R');
 aim(thigh,shin,new T.Vector3(-.05,-1,.2));aim(shin,foot,new T.Vector3(-.02,-1,-.1));
 // Feet stay flat on the deck; the relaxed one turns out a touch.
 for(const [f,q] of feet)setWorldQuat(f,q);turn(foot,Y,-12);
}
function relaxSpine(bone){
 turn(bone('spine.001'),Z,2.5);turn(bone('spine.003'),Z,-2);turn(bone('spine.002'),Y,4);
 turn(bone('spine.005'),Z,-7);turn(bone('spine.006'),Y,-12);turn(bone('spine.006'),X,5);
 for(const [i,deg] of [[1,-78],[2,-22],[3,-4],[4,22],[5,34]])turn(bone('Tail_springBone_'+i),X,deg);
}
function relaxPose(cat){
 const skeleton=cat.meshes[0].skeleton;cat.root.updateMatrixWorld(true);
 const bone=name=>{const b=skeleton.getBoneByName(T.PropertyBinding.sanitizeNodeName(name));if(!b)throw new Error('Cosmo rig is missing '+name);return b;};
 relaxLegs(bone);relaxSpine(bone);relaxArms(bone);
}

// Apply the posed skin on the CPU: bindMatrixInverse · Σ w·(bone.matrixWorld · boneInverse) · bindMatrix.
function bake(mesh,toRoot){
 const g=mesh.geometry,pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv,color=g.attributes.color,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
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
 // One shoe multiplies its texture by vertex colours; without them it rendered black.
 if(color)out.setAttribute('color',color.clone());
 out.setIndex(g.index?g.index.clone():[...Array(pos.count).keys()]);
 if(nor)out.setAttribute('normal',new T.BufferAttribute(N,3));else out.computeVertexNormals();
 return out;
}

export async function createCosmoKit(){
 const cat=await createDLCat({height:COSMO_HEIGHT,castShadow:true,receiveShadow:true});
 relaxPose(cat);
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
