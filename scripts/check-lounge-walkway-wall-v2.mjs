import assert from 'node:assert/strict';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import layout from '../src/plan/selected-layout.js';
import {createGardenCommons} from '../src/model.js';
import {resolveRoomFrames} from '../src/plan/rooms.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {createVaultLift} from '../src/walk/vault-lift.js';
import {prepareClubhouseAccess} from '../src/v2/clubhouse-access.js';
import {Colliders,solid} from '../src/walk/collision.js';
import {groundMesh} from '../src/v2/ground.js';
import {Controller} from '../src/walk/controller.js';
import {mesh,polygonGeometry} from '../src/v2/geometry.js';
import {prepareLoungeFalls,createLoungeFalls} from '../src/walk/lounge-falls.js';
import {prepareV2LoungeFalls} from '../src/v2/lounge-falls-fit.js';
import {LOUNGE_WALKWAY_WALL as W,loungeWalkwayWallLine,loungeWalkwayEdgeZ} from '../src/v2/lounge-walkway-wall.js';
import {LOUNGE_MURAL_X} from '../src/plan/lounge-layout-v2.js';

// Report #427: the black wall under the open-floor edge of the lounge's Deck 18 walkway, built from the real lounge
// source, room shell, clubhouse lift and fitted waterfall pond (no full ship build). Jay, 2026-11-24: it stops at the
// pond's rim, and the causeway through the falls is the way between the open floor and the lounge.
installWalkCanvas(createCanvas);
const r=layout.rooms.find(r=>r.id==='commons-1'),root=new T.Group(),source=createGardenCommons(1);
root.add(source.root);resolveRoomFrames(root);
const structure=new T.Group();root.add(structure);const ship={root,inside:root,cutaway:new Set()};buildRoomShell(ship,r,structure);
// The lounge's own Deck 17 floor and the gap slab, as in check-lounge-layout-v2.mjs.
{const deck=layout.decks.find(d=>d.number===r.deck),box=p=>[Math.min(...p.map(q=>q[0])),Math.max(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[1]))],b=box(r.polygon);
 const openings=deck.slab.holes.map(h=>h.polygon).filter(p=>{const o=box(p);return o[1]>b[0]&&o[0]<b[1]&&o[3]>b[2]&&o[2]<b[3];});
 mesh(root,'Lounge_deck_slab',polygonGeometry(r.polygon,openings,r.y,.24));}
mesh(root,'Deck_slab',polygonGeometry([[-88,-61.9],[-86,-61.9],[-86,-24],[-88,-24]],[],r.y,.24));
const col=new Colliders(),lift=createVaultLift(col);prepareClubhouseAccess(ship,lift);root.add(lift.group);
// As the walk does (scripts/v2-waterfall-target.mjs): the pond replaces the kitchen island, and its bench joins the lounge.
prepareLoungeFalls(ship);const pond=prepareV2LoungeFalls(ship,()=>createLoungeFalls(ship));assert(pond,'No waterfall pond');pond.group.updateMatrixWorld(true);pond.solid.updateMatrixWorld(true);
root.updateMatrixWorld(true);col.addStatic(root);col.addStatic(lift.solid,()=>true);col.addStatic(pond.solid,()=>true);col.commit();
const ground=new Colliders();ground.addStatic(root,o=>solid(o)&&groundMesh(o));ground.addStatic(pond.solid,()=>true);ground.commit();col.raycastGround=(...a)=>ground.raycast(...a);

// One wall mesh, solid, matte and opaque, from inside the deck slab to inside the walkway slab.
const walls=structure.getObjectsByProperty('name','Lounge_walkway_wall');assert.equal(walls.length,1,'Exactly one walkway wall');
const wall=walls[0],plan=loungeWalkwayWallLine(r),box=new T.Box3().setFromObject(wall,true);
assert.equal(wall.material.name,'Lounge_walkway_wall_black');assert(!wall.material.transparent&&wall.material.opacity===1&&wall.material.roughness>=.9,'Matte, opaque black');
assert(solid(wall)&&!wall.userData.noCollide&&wall.userData.room==='commons-1','The wall collides and belongs to the lounge');
const close=(a,b,e=.002)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
close(plan.underside,28.02);close(box.min.y,r.y-W.foot);close(box.max.y,plan.underside+W.top);assert(box.max.y<28.3-.1,'The top stays inside the walkway slab');
close(box.min.x,LOUNGE_MURAL_X,1e-4);close(box.max.x,W.to,1e-4);
const seamX=LOUNGE_MURAL_X+.02,seamZ=loungeWalkwayEdgeZ(plan.line,seamX)+W.inset+W.thickness/2;
const seamRay=new T.Raycaster(new T.Vector3(seamX,plan.underside-.1,seamZ),new T.Vector3(0,1,0),0,.2);
const seam=seamRay.intersectObjects(structure.getObjectsByProperty('name','V2_garden_gallery'))[0];
assert(seam,'The extended slab covers the black wall at the mural');close(seam.point.y,plan.underside);
console.log('PASS one opaque matte black colliding wall, y',box.min.y.toFixed(2),'to',box.max.y.toFixed(2),'x',W.from,'to',W.to);

// Every face points out of the wall: no bottom, the top up, the long faces toward the open floor or the lounge, and
// end caps only at the pond.
{const p=wall.geometry.attributes.position,t=new T.Triangle(),n=new T.Vector3(),c=new T.Vector3(),counts={top:0,front:0,back:0,cap:0};
 for(let i=0;i<p.count;i+=3){t.setFromAttributeAndIndices(p,i,i+1,i+2);t.getNormal(n);t.getMidpoint(c);
  if(Math.abs(n.y)>.9){assert(n.y>0,'Downward face on the wall');counts.top++;continue;}
  assert(Math.abs(n.y)<1e-3,'Sloping wall face');
  if(Math.abs(n.x)>.99&&(Math.abs(c.x-W.pond[0])<.02||Math.abs(c.x-W.pond[1])<.02)){assert.equal(Math.sign(n.x),c.x>(W.pond[0]+W.pond[1])/2?-1:1,'Pond end cap faces the pond');counts.cap++;continue;}
  const e=loungeWalkwayEdgeZ(plan.line,c.x),d=c.z-e;
  if(d<W.inset+W.thickness/2){assert(n.z<0&&Math.abs(d-W.inset)<.003,'Open-floor face '+c.toArray());counts.front++;}else{assert(n.z>0&&Math.abs(d-W.inset-W.thickness)<.02,'Lounge face '+c.toArray());counts.back++;}
 }
 assert(counts.top&&counts.front&&counts.back&&counts.cap===4,'Faces '+JSON.stringify(counts));console.log('PASS outward faces',JSON.stringify(counts));
}

// No gap: rays from the open floor meet the wall's face on the edge line, floor to walkway, everywhere but the pond.
{const ray=new T.Raycaster();let probes=0;
 for(let x=W.from+.05;x<W.to-.01;x+=.25){if(x>W.pond[0]-.01&&x<W.pond[1]+.01)continue;const e=loungeWalkwayEdgeZ(plan.line,x);
  for(const y of [r.y+.05,r.y+1.5,r.y+3,plan.underside-.03]){ray.set(new T.Vector3(x,y,e-1),new T.Vector3(0,0,1));ray.far=1.5;const hit=ray.intersectObject(wall)[0];
   assert(hit,'Gap in the wall at '+[x,y].map(v=>v.toFixed(2)));close(hit.point.z,e+W.inset,.003);probes++;}}
 console.log('PASS continuous from the synthwave wall to the hall wall apart from the pond,',probes,'probes');
}

// The opening is the pond: none of the pond (water, falls, rim, causeway, rope, plants) is inside the wall, and its rim
// and plants reach within a body's width of each wall end, so nobody walks round the pond's ends.
{const inside=(v)=>{if(v.y<box.min.y||v.y>box.max.y||v.x<W.from||v.x>W.to)return false;if(v.x>W.pond[0]&&v.x<W.pond[1])return false;const e=loungeWalkwayEdgeZ(plan.line,v.x);return v.z>e+W.inset-1e-3&&v.z<e+W.inset+W.thickness+1e-3;};
 let rim=[Infinity,-Infinity],checked=0;const t=new T.Triangle(),v=new T.Vector3();
 pond.group.traverse(o=>{if(!o.isMesh||/halo|glow/i.test(o.name))return;const p=o.geometry.attributes.position,ix=o.geometry.index,count=ix?.count??p.count;
  for(let i=0;i<count;i+=3){const at=k=>ix?ix.getX(i+k):i+k;t.a.fromBufferAttribute(p,at(0)).applyMatrix4(o.matrixWorld);t.b.fromBufferAttribute(p,at(1)).applyMatrix4(o.matrixWorld);t.c.fromBufferAttribute(p,at(2)).applyMatrix4(o.matrixWorld);
   // Samples every 5 cm or so across each triangle.
   const N=Math.min(40,Math.ceil(Math.max(t.a.distanceTo(t.b),t.b.distanceTo(t.c),t.c.distanceTo(t.a))/.05));
   for(let u=0;u<=N;u++)for(let w=0;w<=N-u;w++){v.copy(t.a).multiplyScalar(1-(u+w)/N).addScaledVector(t.b,u/N).addScaledVector(t.c,w/N);checked++;
    assert(!inside(v),'Pond part inside the wall: '+o.name+' '+v.toArray().map(n=>n.toFixed(2)));
    // The rim and its plants standing on the wall's own line, across the opening.
    const e=loungeWalkwayEdgeZ(plan.line,v.x);if(e!==null&&/stone|leaf/i.test(o.name)&&v.y<r.y+1.4&&Math.abs(v.z-e-W.inset-W.thickness/2)<W.thickness/2+.05){rim[0]=Math.min(rim[0],v.x);rim[1]=Math.max(rim[1],v.x);}}}
 });
 assert(rim[0]-W.pond[0]<.35&&W.pond[1]-rim[1]<.35,`The pond's rim on the wall line (${rim.map(n=>n.toFixed(2))}) must come within a body's width of the wall ends ${W.pond}: move the opening with the pond`);
 console.log('PASS pond opening',W.pond.join(' to '),'holds the rim',rim.map(n=>n.toFixed(2)).join(' to '),'and nothing of the pond is inside the wall,',checked,'samples');
}

// Walking: the open floor is stopped by the wall and can walk away; the causeway through the falls still joins the open
// floor and the lounge both ways; the Haze Maze door is reached from the open floor by it and the walk returns.
const walker=new Controller(col);
const walk=(wish,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)walker.step(1/60,new T.Vector3(...wish),false);};
const reach=(x,z,label)=>{let steps=0;while(Math.hypot(walker.position.x-x,walker.position.z-z)>.2&&steps++<1800){const wish=new T.Vector3(x-walker.position.x,0,z-walker.position.z).normalize().multiplyScalar(2.25);walker.step(1/60,wish,false);}
 assert(steps<1800,label+': cannot reach '+[x,z]+', stopped at '+walker.position.toArray().map(n=>n.toFixed(2)));};
for(const x of [-140.4,-136,-131,-126,-121,-116,-110,-105.5,-94.5,-90.5]){
 const e=loungeWalkwayEdgeZ(plan.line,x);walker.place(new T.Vector3(x,r.y,e-3));walk([0,0,2.25],4);
 // The edge slopes, so the walker slides along it in x: hold it to the edge where it stopped.
 assert(walker.position.z<loungeWalkwayEdgeZ(plan.line,walker.position.x)-.2,'Walked through the wall at x '+x+': '+walker.position.toArray().map(n=>n.toFixed(2)));const stop=walker.position.z;
 walk([0,0,-2.25],1.5);assert(walker.position.z<stop-2,'Cannot walk away from the wall at x '+x);
}
// The tester's standing spot, walking straight at the Haze Maze sign, then back.
{const start=new T.Vector3(-132.07,r.y,-60.39),sign=new T.Vector3(-129.5,r.y,-42),dir=sign.clone().sub(start).normalize().multiplyScalar(2.25);
 walker.place(start);walk(dir.toArray(),8);const e=loungeWalkwayEdgeZ(plan.line,walker.position.x);assert(walker.position.z<e,'Reached past the wall toward the Haze Maze');
 reach(start.x,start.z,'Back to the standing spot');console.log('PASS walls stop the open floor at ten places and the walk toward the Haze Maze sign, and each walker turns back');}
// The bench stands on the landing in line with the causeway: step onto the landing beside it.
walker.place(new T.Vector3(-102.2,r.y,-62.5));
for(const [x,z] of [[-102.2,-57.2],[-99.7,-56.6],[-99.7,-47.5],[-108.75,-47.5],[-129.5,-49],[-129.5,-43.6]])reach(x,z,'Open floor over the causeway to the Haze Maze door');
for(const [x,z] of [[-129.5,-49],[-108.75,-47.5],[-99.7,-47.5],[-99.7,-56.6],[-102.2,-57.2],[-102.2,-62.5]])reach(x,z,'Haze Maze door back over the causeway');
console.log('PASS open floor to the Haze Maze door over the pond causeway and back');
