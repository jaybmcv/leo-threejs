import assert from 'node:assert/strict';
import * as T from 'three';
import {detailBounds,detailVisible,detailInFrustum,createDetailViewGuard} from '../src/v2/detail-lod.js';

const camera=new T.PerspectiveCamera(60,16/9,.05,450);camera.updateMatrixWorld(true);
const scale=h=>h*.5*camera.projectionMatrix.elements[5],checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
const mesh=new T.InstancedMesh(new T.BoxGeometry(.02,.02,.02),new T.MeshBasicMaterial(),2);
mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(0,0,-100));
mesh.setMatrixAt(1,new T.Matrix4().compose(new T.Vector3(0,0,-400),new T.Quaternion(),new T.Vector3(1000,.01,.01)));
const original=mesh.instanceMatrix.array.slice(),bounds=detailBounds(mesh,original);
check('subpixel props omitted while long thin silhouettes remain',()=>{
 assert(!detailVisible(bounds,0,camera,scale(720),false));
 assert(detailVisible(bounds,1,camera,scale(720),false));
 assert.deepEqual(mesh.instanceMatrix.array,original);
});
check('higher drawing-buffer resolution restores resolvable detail',()=>assert(detailVisible(bounds,0,camera,scale(2160),false)));
check('near-plane intersection is retained',()=>assert(detailVisible([0,0,-.01,.03],0,camera,scale(720),false)));
check('cutoff has hysteresis',()=>{
 const b=[0,0,-100,.05];assert(!detailVisible(b,0,camera,scale(720),false));assert(detailVisible(b,0,camera,scale(720),true));
});
check('off-axis projection cannot shrink an enlarged silhouette',()=>{
 assert(!detailVisible([0,0,-100,.04],0,camera,scale(720),false));
 assert(detailVisible([100,0,-100,.04],0,camera,scale(720),false));
});
check('camera approach restores detail',()=>{
 camera.position.z=-90;camera.updateMatrixWorld(true);assert(detailVisible(bounds,0,camera,scale(720),false));
 camera.position.z=0;camera.updateMatrixWorld(true);
});
check('parent transforms and offset geometry bounds are included',()=>{
 const parent=new T.Group(),o=new T.InstancedMesh(new T.BoxGeometry(1,1,1).translate(5,0,0),new T.MeshBasicMaterial(),1);
 parent.position.set(10,2,-40);parent.scale.set(2,1,3);parent.add(o);o.setMatrixAt(0,new T.Matrix4());
 const b=detailBounds(o,o.instanceMatrix.array);assert.deepEqual(Array.from(b.slice(0,3)),[20,2,-40]);assert(b[3]>=2.59);
});
check('unsupported camera or disabled cutoff remains conservative',()=>{
 assert(detailVisible(bounds,0,new T.OrthographicCamera(),scale(720),false));
 assert(detailVisible(bounds,0,camera,scale(720),false,0));
});
check('individual offscreen props are culled without dropping intersecting silhouettes',()=>{
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 assert(detailInFrustum([0,0,-100,1],0,frustum));assert(!detailInFrustum([0,0,100,1],0,frustum));
 assert(!detailInFrustum([200,0,-100,1],0,frustum));assert(detailInFrustum([102,0,-100,2],0,frustum));
 camera.lookAt(0,0,100);camera.updateMatrixWorld(true);frustum.setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 assert(detailInFrustum([0,0,100,1],0,frustum));
});
check('motion guard forces immediate updates for large turns, movement and projection changes',()=>{
 const guard=createDetailViewGuard(),c=new T.PerspectiveCamera(60,16/9,.05,450);c.updateMatrixWorld(true);assert(guard.changed(c));guard.commit(c);assert(!guard.changed(c));
 c.rotation.y=.05;c.updateMatrixWorld(true);assert(!guard.changed(c));c.rotation.y=.2;c.updateMatrixWorld(true);assert(guard.changed(c));guard.commit(c);
 c.position.x=2.1;c.updateMatrixWorld(true);assert(guard.changed(c));guard.commit(c);c.aspect=1;c.updateProjectionMatrix();assert(guard.changed(c));
});
check('prepared bounds survive shared vertex pools with unrelated distant vertices',()=>{
 camera.rotation.set(0,0,0);camera.updateMatrixWorld(true);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,.01,0,0,0,.01,0,400,60,200],3));g.setIndex([0,1,2]);
 g.boundingSphere=new T.Sphere(new T.Vector3(.005,.005,0),.008);
 const o=new T.InstancedMesh(g,new T.MeshBasicMaterial(),1);o.setMatrixAt(0,new T.Matrix4().makeTranslation(0,0,-100));
 const b=detailBounds(o,o.instanceMatrix.array);assert(b[3]<.014);assert.equal(g.boundingSphere.radius,.008);assert(!detailVisible(b,0,camera,scale(720),false));
});
console.log(JSON.stringify({status:'PASS',checks:checks.length,details:checks},null,2));
