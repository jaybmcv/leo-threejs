// Another visitor's figure keeps its matrices and bone texture until something moves it (src/walk/figure-matrices.js).
import assert from 'node:assert/strict';
import * as T from 'three';
import {figureMatrices} from '../src/walk/figure-matrices.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
// Bone-texture rebuilds that do work (the gate keeps three's own update and calls it).
let rebuilt=0;const own=T.Skeleton.prototype.update;T.Skeleton.prototype.update=function(){rebuilt++;return own.call(this);};
// holder > body > figure root > hip > knee, and a part skinned to both bones, as avatar.js builds a walker.
function walker(){
 const holder=new T.Group(),body=new T.Group(),root=new T.Group(),hip=new T.Bone(),knee=new T.Bone();
 holder.add(body);body.add(root);root.add(hip);hip.add(knee);knee.position.y=1;
 const g=new T.BoxGeometry(.3,1.3,.3),n=g.attributes.position.count,si=new Uint16Array(n*4),sw=new Float32Array(n*4);
 for(let i=0;i<n;i++){si[i*4]=g.attributes.position.getY(i)>0?1:0;sw[i*4]=1;}
 g.setAttribute('skinIndex',new T.BufferAttribute(si,4));g.setAttribute('skinWeight',new T.BufferAttribute(sw,4));
 const part=new T.SkinnedMesh(g,new T.MeshBasicMaterial()),skeleton=new T.Skeleton([hip,knee]);root.add(part);holder.updateMatrixWorld(true);part.bind(skeleton);
 return {holder,body,root,hip,knee,part,skeleton,figure:{root,asset:{meshes:[part]}}};
}
// The same moves on a walker with three's own updates: what drawing the gated one must match.
const pair=()=>{const a=walker(),b=walker();return {a,b,m:figureMatrices(a.figure)};};
const frame=(...ws)=>{for(const w of ws){w.holder.updateMatrixWorld();w.skeleton.update();}};
const sameDrawn=(a,b)=>{assert.ok(a.skeleton.boneMatrices.every((v,i)=>Math.abs(v-b.skeleton.boneMatrices[i])<1e-9));
 for(const k of ['hip','knee','root'])assert.ok(a[k].matrixWorld.equals(b[k].matrixWorld),k);};

{const {a,b,m}=pair();frame(a,b);const made=m.made,count=rebuilt;frame(a);frame(a);
 assert.equal(m.made,made);assert.equal(rebuilt,count);sameDrawn(a,b);
 pass('a figure nothing moved is skipped by the scene pass and its bone texture is not rebuilt');}
{const {a,b,m}=pair();frame(a,b);
 for(const w of [a,b]){w.holder.position.set(2,0,-1);w.holder.rotation.y=.7;}const made=m.made;frame(a,b);
 assert.equal(m.made,made+1);sameDrawn(a,b);
 for(const w of [a,b])w.body.quaternion.setFromAxisAngle(new T.Vector3(1,0,0),.2);frame(a,b);assert.equal(m.made,made+2);sameDrawn(a,b);
 pass('the holder moving or turning, or the body leaning, remakes it: it draws as three would');}
{const {a,b,m}=pair();frame(a,b);
 for(const w of [a,b])w.knee.rotation.z=.5;frame(a,b);assert.ok(!a.knee.matrixWorld.equals(b.knee.matrixWorld));
 m.changed();frame(a);sameDrawn(a,b);
 pass('bones moved outside a solve wait for changed() (avatar.js calls it at each such move); then it matches');}
{const {a,b,m}=pair();frame(a,b);const made=m.made;let inside=0;
 const solve=w=>{w.knee.rotation.z=.8;w.root.updateMatrixWorld(true);w.skeleton.update();w.hip.rotation.y=.3;w.root.updateMatrixWorld(true);w.skeleton.update();};
 const count=rebuilt;m.solve(()=>{solve(a);inside=rebuilt-count;});solve(b);
 assert.equal(inside,0);assert.equal(m.made,made+2);
 frame(a);sameDrawn(a,b);const after=rebuilt;frame(a);assert.equal(rebuilt,after);
 pass('inside a solve every matrix update runs and the bone texture waits: drawing rebuilds it once');}
{const {a,b,m}=pair();frame(a,b);
 const hang=w=>{const mount=new T.Group();mount.position.y=.2;w.knee.add(mount);return mount;},ma=hang(a),mb=hang(b);frame(a,b);
 assert.ok(ma.matrixWorld.equals(mb.matrixWorld));
 const hat=w=>{const o=new T.Mesh(new T.BoxGeometry());o.position.x=.1;w.add(o);return o;},ha=hat(ma),hb=hat(mb);frame(a,b);
 assert.ok(ha.matrixWorld.equals(hb.matrixWorld));assert.ok(!ha.matrixWorld.equals(new T.Matrix4()));
 pass('a hat hung on a bone later, then its meshes, is placed at the next scene pass');}
{const {a,b,m}=pair();frame(a,b);let made=m.made;
 for(const w of [a,b])w.root.position.y=.5;frame(a,b);assert.equal(m.made,++made);sameDrawn(a,b);
 const other=new T.Group();other.position.x=4;a.holder.add(other);other.add(a.root);a.holder.updateMatrixWorld();assert.equal(m.made,++made);
 assert.ok(Math.abs(a.hip.matrixWorld.elements[12]-4)<1e-9);
 pass('the figure\'s own transform, or a new parent, is noticed');}
T.Skeleton.prototype.update=own;
console.log(`figure matrices: ${passed} checks passed`);
