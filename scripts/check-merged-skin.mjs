// Another visitor's body drawn as one skinned mesh per material (src/walk/merged-skin.js).
import assert from 'node:assert/strict';
import * as T from 'three';
import {mergeSkinnedParts} from '../src/walk/merged-skin.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
// A two-bone figure: parts are boxes skinned to one bone or the other, under one parent.
function figure(){
 const root=new T.Group(),hip=new T.Bone(),knee=new T.Bone();hip.add(knee);knee.position.y=1;root.add(hip);
 const skeleton=new T.Skeleton([hip,knee]),body=new T.MeshStandardMaterial({name:'body'}),clothes=new T.MeshStandardMaterial({name:'clothes'});
 const part=(name,material,bone,{indexed=true,x=0}={})=>{let g=new T.BoxGeometry(.3,.3,.3);if(!indexed)g=g.toNonIndexed();g.clearGroups();// a glTF part has noneg.translate(x,bone,0);
  const n=g.attributes.position.count,si=new Uint8Array(n*4),sw=new Float32Array(n*4);for(let i=0;i<n;i++){si[i*4]=bone;sw[i*4]=1;}
  g.setAttribute('skinIndex',new T.BufferAttribute(si,4));g.setAttribute('skinWeight',new T.BufferAttribute(sw,4));
  const m=new T.SkinnedMesh(g,material);m.name=name;root.add(m);m.bind(skeleton);return m;};
 const parts=[part('body',body,0),part('eyes',body,1,{x:.4}),part('nose',body,1,{indexed:false,x:-.4}),part('hoodie',clothes,0,{x:.8}),part('shirt',clothes,1,{x:-.8})];
 root.updateMatrixWorld(true);return {root,hip,knee,skeleton,parts,body,clothes};
}
const shown=f=>{const out=[];f.root.traverse(o=>{if(o.isMesh&&o.visible)out.push(o);});return out;};
// Every vertex where it is drawn, posed: the parts' against the merged copy's, in the same order.
const drawn=meshes=>meshes.flatMap(m=>Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrixWorld)));

{const f=figure(),before=f.parts.map(p=>p.visible);const m=mergeSkinnedParts(f.parts);
 assert.equal(m.meshes.length,2);assert.equal(m.merged,5);assert.deepEqual(shown(f).map(o=>o.name).sort(),['Merged_body','Merged_clothes']);assert.ok(before.every(Boolean));
 assert.ok(m.meshes.every(x=>x.skeleton===f.skeleton&&x.isSkinnedMesh));pass('five parts in two materials draw as two skinned meshes on the same skeleton; the parts stay, hidden');
 f.knee.rotation.z=.9;f.hip.rotation.y=.4;f.root.position.set(3,0,-2);f.root.updateMatrixWorld(true);
 const a=drawn(f.parts.filter(p=>p.material===f.body)),b=drawn([m.meshes.find(x=>x.material===f.body)]);
 assert.equal(a.length,b.length);assert.ok(a.every((v,i)=>v.distanceTo(b[i])<1e-6));pass('posed, every merged vertex is drawn where its part\'s is (indexed and not)');
 const eyes=f.parts[1],open=eyes.geometry.attributes.uv,shut=open.clone();for(let i=0;i<shut.count;i++)shut.setXY(i,.5,.25);eyes.geometry.setAttribute('uv',shut);m.sync();
 const merged=m.meshes.find(x=>x.material===f.body).geometry.attributes.uv,start=f.parts[0].geometry.attributes.position.count;
 assert.ok(Array.from({length:shut.count},(_,i)=>merged.getX(start+i)===.5&&merged.getY(start+i)===.25).every(Boolean));assert.ok(merged.updateRanges.length>0);
 pass('a part\'s uvs swapped later (eyes shut) are copied into its merged copy');
 const sphere=m.meshes[0].boundingSphere;assert.ok(sphere&&sphere.radius>.5);pass('the merged copy is culled by the parts\' bounds with room for the limbs');
 m.dispose();assert.deepEqual(shown(f).map(o=>o.name).sort(),['body','eyes','hoodie','nose','shirt']);pass('dispose draws the parts again');}

{const f=figure();f.parts[4].bindMatrix.makeTranslation(0,.1,0);f.parts[2].geometry.morphAttributes.position=[f.parts[2].geometry.attributes.position.clone()];
 const m=mergeSkinnedParts(f.parts);assert.equal(m.meshes.length,1);
 assert.deepEqual(shown(f).map(o=>o.name).sort(),['Merged_body','hoodie','nose','shirt']);pass('a part with morphs, or one whose bind differs (leaving a single part in its material), keeps drawing on its own');}

{const f=figure(),solo=new T.Group();f.root.add(solo);f.parts[3].removeFromParent();solo.add(f.parts[3]);f.root.updateMatrixWorld(true);
 const m=mergeSkinnedParts(f.parts);assert.deepEqual(shown(f).map(o=>o.name).sort(),['Merged_body','hoodie','shirt']);pass('parts under another parent are not merged with the rest');}

{const f=figure(),m=mergeSkinnedParts(f.parts),before=f.parts[0].matrixWorld.clone();
 f.root.position.set(2,0,1);f.root.updateMatrixWorld(true);f.root.updateWorldMatrix(false,true);
 assert.ok(f.parts.every(p=>p.matrixWorld.equals(before)));assert.ok(Math.abs(m.meshes[0].matrixWorld.elements[12]-2)<1e-9);
 m.dispose();assert.ok(f.parts.every(p=>Math.abs(p.matrixWorld.elements[12]-2)<1e-9&&Math.abs(p.bindMatrixInverse.elements[12]+2)<1e-9));
 f.root.position.set(5,0,0);f.root.updateMatrixWorld(true);assert.ok(f.parts.every(p=>Math.abs(p.matrixWorld.elements[12]-5)<1e-9));
 pass('hidden parts skip the figure\'s matrix passes (their readers read the bones); shown again, they are current and update');}
console.log(`merged skin: ${passed} checks passed`);
