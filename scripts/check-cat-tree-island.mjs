import assert from 'node:assert/strict';
import * as T from 'three';
import {createCatTree,TREE} from '../src/walk/cat-tree.js';
import {BODY,Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {groundMesh} from '../src/v2/ground.js';

// The moss mounds and yarn balls round the Great Cat Tree's island (createCatTree in src/walk/cat-tree.js) must not hold
// a walker. Their collider used to be a closed prism of guard walls, which are no ground: a cat that jumped onto one
// sank through its bare top into the prism and, with that over its head, could neither jump nor walk out. Now each is a
// thin lid that a cat stands on. Checked with the walk's own Controller and its ground rule (installGround): (1) the cat
// from the tester's report, standing under a mound, walks out with the movement keys alone; (2) at every mound, a cat
// that walks up to it from each side, then jumps at it, ends on the floor outside or on top, and then walks away.
const tree=createCatTree(null);assert(tree?.mounds?.length>=20,'the tree reports its mounds');
const y0=TREE.floor,top=TREE.islandTop,R=BODY.radius,STEP=BODY.step;
const env=new T.Group(),floor=new T.Mesh(new T.BoxGeometry(140,.3,140));floor.name='Deck_floor';floor.position.set(TREE.x,y0-.15,0);env.add(floor);env.updateMatrixWorld(true);tree.solid.updateMatrixWorld(true);
const col=new Colliders();col.addStatic(env,()=>true);col.addStatic(tree.solid,()=>true);col.commit();
const ground=new Colliders();ground.addStatic(env,o=>o.isMesh&&groundMesh(o));ground.addStatic(tree.solid,o=>o.isMesh&&groundMesh(o));ground.commit();
// As in the walk (installGround in src/v2/ground.js): the controller finds ground only on the named walk surfaces.
col.raycastGround=(...args)=>ground.raycast(...args);
const seg=new T.Line3(),dist=(x,z)=>Math.hypot(x-TREE.x,z-TREE.z);
const room=(x,y,z)=>{seg.start.set(x,y+STEP+R,z);seg.end.set(x,y+BODY.height-R,z);return !col.overlaps(seg,R);};
const ctl=new Controller(col),none=new T.Vector3(),V=(x,z)=>new T.Vector3(x,0,z);
const run=(wish,frames,jump=()=>false)=>{for(let s=0;s<frames;s++)ctl.step(1/60,wish,jump(s));};

// (1) The reported spot (the tester's view, walk.html?at=179.21,-19.45,-7.35): out to the park path, keys only.
{const spot=new T.Vector3(179.21,top,-7.35);ctl.place(spot);run(none,30);
 const outward=V(spot.x-TREE.x,spot.z-TREE.z).normalize().multiplyScalar(3.2);let s=0;for(;s<900&&dist(ctl.position.x,ctl.position.z)<TREE.island+1.6;s++)ctl.step(1/60,outward,false);
 console.log(`reported spot: walked out in ${(s/60).toFixed(1)} s to ${ctl.position.x.toFixed(2)}, ${ctl.position.y.toFixed(2)}, ${ctl.position.z.toFixed(2)}`);
 assert(dist(ctl.position.x,ctl.position.z)>=TREE.island+1.6&&ctl.grounded&&Math.abs(ctl.position.y-y0)<.4,'the walker at the reported spot did not walk out');}

// (2) Each mound, from eight sides: walk up to it, jump at it, then walk away along any heading with the keys alone.
let tried=0,needJump=0;const bad=[];
for(const [mx,mz,r,h] of tree.mounds)for(let side=0;side<8;side++){const a=side/8*Math.PI*2,sx=mx+Math.cos(a)*(r+1.7),sz=mz+Math.sin(a)*(r+1.7);
 if(dist(sx,sz)>TREE.island-.6||!room(sx,top,sz))continue;
 for(const jumpAfter of [0,.3,.6]){
  ctl.place(new T.Vector3(sx,top,sz));const toward=V(mx-sx,mz-sz).normalize().multiplyScalar(3.2);
  run(toward,Math.round(.9*60));                                                        // W to the edge
  run(toward,Math.round(1.1*60),s=>s>=Math.round(jumpAfter*60)&&s<Math.round(jumpAfter*60)+25); // Space + W at the edge
  run(none,60);const p=ctl.position,onTop=p.y>top+.6&&tree.mounds.some(([x,z,r])=>Math.hypot(p.x-x,p.z-z)<r+.2);
  // ended on the floor (or the island's bevelled rim) or on a lid; a cat that landed on the ramp or boardwalk is not a mound's to answer for
  if(ctl.grounded&&!onTop&&p.y>top+.1)continue;
  tried++;
  // away: the first of sixteen headings that carries it 2.5 m off and down on the floor
  const from=p.clone();let away=false,jumped=false;
  const leave=(withJump)=>{for(let k=0;k<16&&!away;k++){const w=k/16*Math.PI*2;ctl.place(from);run(V(Math.cos(w)*3.2,Math.sin(w)*3.2),240,s=>withJump&&s%50<20);away=ctl.grounded&&Math.hypot(ctl.position.x-from.x,ctl.position.z-from.z)>=2.5&&ctl.position.y<top+.1;}};
  if(ctl.grounded){leave(false);if(!away){leave(true);jumped=away;}}
  if(jumped)needJump++;
  if(!away&&bad.length<10)bad.push([mx,mz,a,p.x,p.y,p.z,onTop].map(v=>typeof v==='number'?+v.toFixed(2):v));}}
console.log(`mound attempts ${tried}, left stuck ${bad.length>=10?'10+':bad.length}, walked off only by jumping ${needJump}`);for(const b of bad)console.log('  stuck at mound',b.slice(0,2).join(', '),'from side',b[2],'ended',b.slice(3,6).join(', '),b[6]?'on top':'');
assert.equal(bad.length,0,'a walker was left trapped by an island mound');
console.log('island mounds hold nobody');
