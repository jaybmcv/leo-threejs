import assert from 'node:assert/strict';
import * as T from 'three';
import {cabinPrivacy} from '../src/v2/cabin-privacy.js';

const all=[0,8].map((x,i)=>({id:'test-'+i,key:'twin',side:1,y:0,matrix:new T.Matrix4().makeTranslation(x,0,0)}));
const ship={inside:new T.Group()},scene=new T.Scene(),template=new T.Group();
for(const role of ['left','right','fixed']){const o=new T.Mesh(new T.BoxGeometry(.4,2,.03),new T.MeshStandardMaterial());o.userData.role=role;template.add(o);}
const doors=[];
for(const [name,side]of [['Cabin_v2_door-left',-1],['Cabin_v2_door-right',1],['Cabin_v2_ensuite-door',0]]){
 const o=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),2);o.name=name;o.userData={cabinIds:all.map(c=>c.id),doorSide:side};all.forEach((c,i)=>o.setMatrixAt(i,c.matrix));ship.inside.add(o);doors.push(o);
}
const privacy=cabinPrivacy(ship,scene,all,()=>template),actual=new T.Matrix4();
const expect=(o,i,m)=>{o.getMatrixAt(i,actual);assert.deepEqual(actual.elements,Array.from(new Float32Array(m.elements)),o.name+' instance '+i);};
const entry=new T.Vector3(0,0,3.7175);
privacy.update(entry);
for(const o of doors.slice(0,2))expect(o,0,all[0].matrix.clone().multiply(new T.Matrix4().makeTranslation(o.userData.doorSide*.62,0,0)));
for(const o of privacy.root.children)expect(o,0,all[0].matrix.clone().multiply(new T.Matrix4().makeTranslation(o.userData.doorSide*.62,0,0)));
const observed=[...doors,...privacy.root.children],versions=observed.map(o=>o.instanceMatrix.version);
for(let i=0;i<4;i++)privacy.update(entry);
assert.deepEqual(observed.map(o=>o.instanceMatrix.version),versions,'Unchanged open doors must not dirty their buffers');
for(let i=0;i<30;i++)privacy.update(new T.Vector3(0,0,0));
for(const o of doors.slice(0,2))expect(o,0,all[0].matrix);
for(const o of privacy.root.children)expect(o,0,all[0].matrix);
const pod=doors[2],hinge=new T.Vector3(.48,0,1.48),open=all[0].matrix.clone().multiply(new T.Matrix4().makeTranslation(...hinge.toArray())).multiply(new T.Matrix4().makeRotationY(-Math.PI/2)).multiply(new T.Matrix4().makeTranslation(...hinge.clone().negate().toArray()));
privacy.update(new T.Vector3(1.015,0,1.48));expect(pod,0,open);
pod.userData.currentCabinIds=['test-1','test-0'];pod.setMatrixAt(0,all[1].matrix);pod.setMatrixAt(1,all[0].matrix);pod.instanceMatrix.needsUpdate=true;
privacy.update(new T.Vector3(1.015,0,1.48));expect(pod,1,open);expect(pod,0,all[1].matrix);
assert.equal(privacy.toggle('test-0'),false);
for(const o of privacy.root.children)expect(o,0,all[0].matrix.clone().scale(new T.Vector3(0,0,0)));
assert.equal(privacy.toggle('test-0'),true);
for(const o of privacy.root.children)expect(o,0,all[0].matrix);
console.log('PASS cabin privacy: open/close animation, stationary upload suppression, ensuite hinge, reordered instances, local frost toggles');
