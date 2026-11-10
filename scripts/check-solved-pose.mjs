// What is done on top of a rig solve does not compound on frames without one (src/walk/solved-pose.js, avatar.js).
import assert from 'node:assert/strict';
import * as T from 'three';
import {solvedPose} from '../src/walk/solved-pose.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const bones=[new T.Bone(),new T.Bone()],root=new T.Group(),held=solvedPose(bones,root),X=new T.Vector3(1,0,0);
const solve=()=>{bones.forEach(b=>b.quaternion.identity());root.position.y=.1;held.keep();};
// The tail tucked under a hat: a turn premultiplied onto the bone each frame, as avatar.js does.
const tuck=()=>{bones[1].quaternion.premultiply(new T.Quaternion().setFromAxisAngle(X,-.55));root.position.y+=.02;held.touched();};
const angle=b=>2*Math.acos(Math.min(1,Math.abs(b.quaternion.w)));
solve();tuck();const once=angle(bones[1]);
for(let i=0;i<5;i++){held.restore();tuck();}assert.ok(Math.abs(angle(bones[1])-once)<1e-9);assert.ok(Math.abs(root.position.y-.12)<1e-9);
pass('frames without a solve start from the solved pose: the tail\'s tuck and the height stay as after one frame');
{solve();assert.equal(held.restore(),false);bones[0].quaternion.setFromAxisAngle(X,.3);assert.equal(held.restore(),false);assert.ok(angle(bones[0])>.29);
 pass('nothing is restored when nothing was done on top of the solve (the bones are left as they are)');}
{solve();tuck();solve();assert.equal(held.restore(),false);assert.equal(angle(bones[1]),0);pass('a new solve is kept as the pose to start from');}
console.log(`solved pose: ${passed} checks passed`);
