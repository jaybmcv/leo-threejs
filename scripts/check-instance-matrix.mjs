import assert from 'node:assert/strict';import * as T from 'three';import {setInstanceMatrixIfChanged} from '../src/walk/instance-matrix.js';
const mesh=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial(),3),matrix=new T.Matrix4().makeRotationY(.37).setPosition(1.1,2.2,3.3),untouched=mesh.instanceMatrix.array.slice(0,16);
let version=mesh.instanceMatrix.version;
assert.equal(setInstanceMatrixIfChanged(mesh,1,matrix),true);assert.equal(mesh.instanceMatrix.version,++version);
assert.equal(setInstanceMatrixIfChanged(mesh,1,matrix.clone()),false);assert.equal(mesh.instanceMatrix.version,version);
assert.deepEqual(mesh.instanceMatrix.array.slice(0,16),untouched);
matrix.elements[12]+=1e-12;assert.equal(setInstanceMatrixIfChanged(mesh,1,matrix),false);assert.equal(mesh.instanceMatrix.version,version);
matrix.elements[12]+=1;assert.equal(setInstanceMatrixIfChanged(mesh,1,matrix),true);assert.equal(mesh.instanceMatrix.version,++version);
// A proximity-compaction pass may replace the CPU matrix between updates.
mesh.setMatrixAt(1,new T.Matrix4());assert.equal(setInstanceMatrixIfChanged(mesh,1,matrix),true);assert.equal(mesh.instanceMatrix.version,++version);
matrix.scale(new T.Vector3(0,0,0));assert.equal(setInstanceMatrixIfChanged(mesh,1,matrix),true);assert.equal(mesh.instanceMatrix.version,++version);
assert.equal(setInstanceMatrixIfChanged(mesh,1,matrix),false);assert.equal(mesh.instanceMatrix.version,version);
mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();
console.log('PASS instance uploads: Float32 equivalence, movement, compaction reset, privacy hide, unchanged version and untouched neighbours');
