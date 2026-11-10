// Three's scene walk skips another visitor's bones except the way to what hangs from one and shows (src/walk/bone-walk.js).
import assert from 'node:assert/strict';
import * as T from 'three';
import {boneWalk} from '../src/walk/bone-walk.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
// As WebGLRenderer's projectObject: a hidden node is passed over with its children.
const walk=root=>{const seen=[];const go=o=>{if(!o.visible)return;seen.push(o);for(const c of o.children)go(c);};go(root);return seen;};
// figure root > spine > neck > head (the catnip face on it, hidden) and spine > thigh > shin, plus a top bone with nothing.
function figure(){
 const root=new T.Group(),b=n=>{const x=new T.Bone();x.name=n;return x;},spine=b('spine'),neck=b('neck'),head=b('head'),thigh=b('thigh'),shin=b('shin'),neutral=b('neutral');
 root.add(spine,neutral);spine.add(neck,thigh);neck.add(head);thigh.add(shin);head.position.y=.4;shin.position.y=-.5;
 const face=new T.Mesh(new T.BoxGeometry());face.visible=false;head.add(face);
 const body=new T.SkinnedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial());root.add(body);
 const bones=[spine,neck,head,thigh,shin,neutral];body.bind(new T.Skeleton(bones));
 return {root,bones,spine,neck,head,thigh,face,body};
}
const bonesIn=list=>list.filter(o=>o.isBone).map(o=>o.name).sort();

{const f=figure(),w=boneWalk(f.bones);w.sync();const seen=walk(f.root);
 assert.deepEqual(bonesIn(seen),[]);assert.ok(seen.includes(f.body));
 pass('nothing hung from the bones shows: the walk visits no bone, and the body still draws');}
{const f=figure(),w=boneWalk(f.bones);f.face.visible=true;w.sync();const seen=walk(f.root);
 assert.deepEqual(bonesIn(seen),['head','neck','spine']);assert.ok(seen.includes(f.face));
 f.face.visible=false;w.sync();assert.deepEqual(bonesIn(walk(f.root)),[]);
 pass('the catnip face shown: the walk takes only the way to the head and draws it; hidden again, no bone');}
{const f=figure(),w=boneWalk(f.bones);w.sync();
 const mount=new T.Group(),hat=new T.Mesh(new T.BoxGeometry());mount.add(hat);f.head.add(mount);w.sync();
 assert.ok(walk(f.root).includes(hat));assert.deepEqual(bonesIn(walk(f.root)),['head','neck','spine']);
 mount.visible=false;w.sync();assert.ok(!walk(f.root).includes(hat));
 mount.visible=true;mount.removeFromParent();w.sync();assert.deepEqual(bonesIn(walk(f.root)),[]);
 const glove=new T.Mesh(new T.BoxGeometry());f.thigh.add(glove);w.sync();assert.deepEqual(bonesIn(walk(f.root)),['spine','thigh']);
 pass('a hat hung on the head later is walked to while shown; taken off, the way goes; any bone works');}
{const f=figure(),g=figure(),w=boneWalk(f.bones);w.sync();
 for(const x of [f,g]){x.thigh.rotation.x=.6;x.neck.rotation.z=.3;x.root.position.set(1,2,3);x.root.updateMatrixWorld(true);x.body.skeleton.update();}
 assert.ok(f.bones.every((b,i)=>b.matrixWorld.equals(g.bones[i].matrixWorld)));
 assert.ok(f.body.skeleton.boneMatrices.every((v,i)=>v===g.body.skeleton.boneMatrices[i]));
 pass('hidden bones keep their world matrices and skinning exactly');}
console.log(`bone walk: ${passed} checks passed`);
