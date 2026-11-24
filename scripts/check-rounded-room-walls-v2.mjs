import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {SHIP_AREAS,createShipArea} from '../src/areas.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {roomWallBoundary,setRoomCornerObstacles} from '../src/v2/rounded-room-walls.js';
import {phase4Programme} from '../src/v2/phase4-programme.js';
import {coplanarOverlaps} from '../src/plan/coplanar-v2.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';

const parts=phase4Programme(layout).parts.filter(p=>p.deck===2).map(p=>{const g=new T.BoxGeometry(...p.size).rotateY(p.yaw||0).translate(...p.at);g.computeBoundingBox();const box=g.boundingBox.clone();g.dispose();return {part:p.part,box};});
let corners=0,rays=0;const skipped=[];
function checkCurve(root,c,y){
 for(let i=1;i<c.points.length;i++){
  const a=c.points[i-1],b=c.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[(b[1]-a[1])/len,-(b[0]-a[0])/len];
  for(const side of [-1,1]){const start=new T.Vector3((a[0]+b[0])/2+n[0]*side*.25,y,(a[1]+b[1])/2+n[1]*side*.25),ray=new T.Raycaster(start,new T.Vector3(-n[0]*side,0,-n[1]*side),0,.201);
   assert(ray.intersectObject(root,true).some(h=>h.object.name==='V2_glass_wall'&&Math.abs(h.distance-.2)<.0001),'Open curved glass at '+c.at+' segment '+i);rays++;
  }
 }
}
for(const r of layout.rooms.filter(r=>!r.aggregate&&r.deck===2)){
 const root=new T.Group(),ship={root,inside:root,cutaway:new Set()},source=SHIP_AREAS.find(a=>a.id===r.id);
 if(source)root.add(createShipArea(source).root);buildRoomShell(ship,r,root);root.updateMatrixWorld(true);
 const plan=roomWallBoundary(r,r.polygon);skipped.push(...plan.skipped.map(c=>({room:r.id,...c})));
 for(const c of plan.corners){
  assert.equal(c.points.length,9);assert.equal(c.radius,.25);
  for(const p of c.points)assert(Math.abs(Math.hypot(p[0]-c.center[0],p[1]-c.center[1])-.25)<1e-8,'Quarter-cylinder radius');
  for(const {part,box}of parts)assert(!(box.max.y>r.y&&box.min.y<r.y+r.height&&c.at[0]>=box.min.x-.3&&c.at[0]<=box.max.x+.3&&c.at[1]>=box.min.z-.3&&c.at[1]<=box.max.z+.3),'Curve too close to planned '+part+' at '+r.id+' '+c.at);
  for(const s of r.envelope||[{rise:0,height:r.height}])checkCurve(root,c,r.y+s.rise+s.height/2);corners++;
 }
}
assert.equal(corners,22,'Audit every eligible Deck 2 corner');assert.deepEqual(skipped,[],'List any new square exceptions in the change description');

// Inside turns and reversed winding use the same radius. Nearby fittings veto both passes.
const concave=[[0,0],[6,0],[6,3],[3,3],[3,6],[0,6]],fixture={deck:2,outer:true,height:3.5,y:0};
for(const polygon of [concave,concave.slice().reverse()]){const plan=roomWallBoundary(fixture,polygon);assert.equal(plan.corners.length,6);assert.equal(plan.corners.filter(c=>c.turn<0).length,polygon===concave?1:5);}
assert.equal(roomWallBoundary({...fixture,deck:1},concave).polygon,concave);
assert.equal(roomWallBoundary({...fixture,outer:false},concave).corners.length,0);
setRoomCornerObstacles(fixture,[new T.Box3(new T.Vector3(-.1,0,-.1),new T.Vector3(.1,2,.1))]);assert(roomWallBoundary(fixture,concave).skipped.some(c=>c.reason==='fixture'&&c.at[0]===0&&c.at[1]===0));
const doorway={...fixture,door:{center:[.8,0,0],outward:[0,-1],width:1.2}};assert(roomWallBoundary(doorway,concave).skipped.some(c=>c.reason==='doorway'));

// Prove the geometric checks reject a missing pane and a doubled curved face.
const r=layout.rooms.find(r=>r.id==='d02-maintenance-aft'),root=new T.Group();buildRoomShell({root,inside:root,cutaway:new Set()},r,root);root.updateMatrixWorld(true);
const c=roomWallBoundary(r,r.polygon).corners.find(c=>c.at[0]===-154),mid=c.points[4],pane=root.children[0].children.find(o=>o.name==='V2_glass_wall'&&o.position.y<r.y+.5&&Math.hypot(o.position.x-mid[0],o.position.z-mid[1])<.03);
assert(pane,'Find an actual curved pane');pane.removeFromParent();assert.throws(()=>checkCurve(root,c,r.y+.25),/Open curved glass/);root.children[0].add(pane);
const faces=[],p=pane.geometry.attributes.position,ix=pane.geometry.index;for(let i=0;i<ix.count;i+=3)faces.push({name:pane.name,triangle:[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix.getX(i+k)).applyMatrix4(pane.matrixWorld).toArray())});
assert(coplanarOverlaps([...faces,...faces],{distance:.0001}).length,'Doubled curved faces must fail');
// Exercise the real capsule against the new wall triangles on a local level floor.
const floor=new T.Mesh(new T.BoxGeometry(20,.1,20),new T.MeshBasicMaterial());floor.position.set(-154,r.y-.05,-18);root.add(floor);root.updateMatrixWorld(true);
const colliders=new Colliders();colliders.addStatic(root,o=>o.isMesh&&(o.name==='V2_glass_wall'||o===floor));colliders.commit();const controller=new Controller(colliders);controller.place(new T.Vector3(-152.43,-35.69,-18.21));
for(const [yaw,seconds,min]of [[0,.4,.55],[-90,.8,.8],[180,.3,.45],[-135,.25,.3],[-90,.7,1.1]]){
 const a=yaw*Math.PI/180,wish=new T.Vector3(Math.sin(a)*2.25,0,Math.cos(a)*2.25),start=controller.position.clone();
 for(let i=0;i<seconds*120;i++){controller.step(1/120,wish);assert(!(controller.position.x<-154.02&&controller.position.z>-17.98),'Capsule entered through the corner');}
 for(let i=0;i<15;i++)controller.step(1/120,new T.Vector3());assert(controller.position.distanceTo(start)>min,'Capsule snagged at the corner');
}
assert(controller.position.x<-155&&controller.position.z<-18.1&&controller.position.z>-18.85,'Finish tightly along the second wall face');
console.log(JSON.stringify({status:'PASS',roundedCorners:corners,arcRays:rays,skipped,missingPaneRejected:true,doubledFaceRejected:true,concaveAndReversed:true,cornerCapsuleRoute:controller.position.toArray()}));
