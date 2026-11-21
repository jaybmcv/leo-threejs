import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {dressGamingLounge,createGamingLounge} from '../src/walk/gaming-lounge.js';
import {gamingBoards,hearGamingBoard} from '../src/walk/gaming-scores.js';
import {v1Frame,toWorld} from '../src/plan/rooms.js';
import {findRestSpots,solidSpots,spotIndex} from '../src/walk/rest.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import layout from '../src/plan/selected-layout.js';

globalThis.document={createElement:()=>createCanvas(1,1)};
Object.defineProperty(globalThis,'localStorage',{value:{getItem:()=>null},writable:true,configurable:true});
const id='d16-training-aft',root=new T.Group(),room=new T.Group(),fit=new T.Group(),shell=new T.Group();
room.name='Area_'+id;room.position.set(...v1Frame(id).origin);fit.name='Room_fittings';shell.name='Walls_and_ceiling';room.add(fit,shell);root.add(room);
const floor=new T.Mesh(new T.BoxGeometry(48,.2,32),new T.MeshBasicMaterial());floor.position.set(0,-.1,-5);floor.name='Floor';room.add(floor);
const ship={root};assert(dressGamingLounge(ship));
const desks=fit.children.filter(o=>o.name==='Gaming_desk_top'),chairs=fit.children.filter(o=>o.name==='Gaming_chair');
assert.equal(desks.length,8);assert.equal(chairs.length,13);
assert(desks.every(o=>o.position.z<-11));assert(chairs.slice(0,8).every(o=>o.position.z<-10));
assert.deepEqual(fit.children.filter(o=>o.name==='Wall_screen_frame').map(o=>o.position.toArray()),[-21,-16.5,-12,-7.5,-3].map(x=>[x,1.35,7.84-.025]));
const seats=findRestSpots(root).filter(s=>s.kind==='sit');assert(seats.length>=13);
for(const chair of chairs.slice(0,8)){const p=chair.getWorldPosition(new T.Vector3());assert(seats.some(s=>Math.hypot(s.point.x-p.x,s.point.z-p.z)<.1));}
const colliders=new Colliders();colliders.addStatic(root);colliders.commit();
const restIndex=spotIndex(solidSpots(seats,colliders));
const center=new T.Vector3(...toWorld(id,[0,0,-5])),controller=new Controller(colliders),target=new T.Vector3();
controller.place(center.clone().add(new T.Vector3(5,0,0)));
const walk=(at,seconds)=>{target.copy(at);for(let i=0;i<Math.ceil(seconds*60);i++){const wish=target.clone().sub(controller.position).setY(0);if(wish.length()>.05)wish.normalize().multiplyScalar(2.25);else wish.set(0,0,0);controller.step(1/60,wish);}return controller.position.distanceTo(at);};
walk(center,5);assert(controller.position.x>center.x+1.7,'The plinth stops a walking capsule');
const stopped=controller.position.clone();walk(center,1);assert(controller.position.distanceTo(stopped)<.1,'Continued walking cannot enter the base');
for(const [x,z] of [[3.2,0],[3.2,3.2],[-3.2,3.2],[-3.2,-3.2],[3.2,-3.2],[3.2,0]])assert(walk(center.clone().add(new T.Vector3(x,0,z)),4)<.15,'Clear path around the hologram');
assert(walk(center.clone().add(new T.Vector3(3.2,0,-3.2)),3)<.15);
assert(walk(new T.Vector3(-229,20.3,-30.2),15)<.15,'The far end remains reachable');
for(const chair of chairs.slice(0,8)){
 const p=chair.localToWorld(new T.Vector3(0,0,-1.1)),seat=chair.getWorldPosition(new T.Vector3());controller.place(p);assert(controller.grounded);assert(controller.position.distanceTo(p)<.2,'Each chair has a clear room-side approach');
 const picked=restIndex.pick(p,seat.clone().sub(p).setY(0).normalize());assert(picked&&Math.hypot(picked.point.x-seat.x,picked.point.z-seat.z)<.1,'The existing sit target follows each chair');
}

assert(gamingBoards().every(b=>b.rows.length===0));
globalThis.localStorage={getItem:key=>({'leo-darts-best':'[120,75]','leo-pinball-best':'9876','leo-maze-best':'23456','leo-mct-repair-times-v1':'[{"time":42,"date":"today"}]','leo-paws-off-best':'18.2'}[key]||null)};
assert.equal(gamingBoards().find(b=>b.id==='darts').rows[0].value,'120');
assert.equal(gamingBoards().find(b=>b.id==='repair').rows[0].value,'42.0 s');
assert.equal(gamingBoards().find(b=>b.id==='paws-off').rows[0].value,'18.2 s');
hearGamingBoard('pool',{m:'board',top:[{name:'Voyager',ms:12345}]});
assert.equal(gamingBoards().find(b=>b.id==='pool').rows[0].name,'Voyager');
Object.defineProperty(globalThis,'localStorage',{get(){throw Error('storage unavailable');},configurable:true});
assert.equal(gamingBoards().find(b=>b.id==='darts').rows.length,0);
const lounge=createGamingLounge(ship),holo=lounge.leaderboard.mesh,eye=center.clone().add(new T.Vector3(5,1,0));
const plan=layout.rooms.find(r=>r.id===id),pc=lounge.group.getObjectByName('Gaming_pc_screen');lounge.group.updateMatrixWorld(true);
for(let i=0;i<pc.geometry.attributes.position.count;i++){
 const p=new T.Vector3().fromBufferAttribute(pc.geometry.attributes.position,i).applyMatrix4(pc.matrixWorld),rise=p.y-plan.y;
 const poly=(plan.envelope.find(s=>rise>=s.rise&&rise<s.rise+s.height)||plan.envelope[0]).polygon;
 let inside=false;for(let a=0,b=poly.length-1;a<poly.length;b=a++){const [x,z]=poly[a],[xx,zz]=poly[b];if((z>p.z)!==(zz>p.z)&&p.x<(xx-x)*(p.z-z)/(zz-z)+x)inside=!inside;}
 assert(inside,'All relocated monitors stay inside the sloping window envelope');
 assert(p.y<plan.y+1.4,'Monitors stay below standing window sightlines');
}
const base=fit.getObjectByName('Gaming_leaderboard_base'),capsule=holo.getObjectByName('Gaming_leaderboard_capsule');
assert.equal(base.geometry.parameters.radialSegments,64);assert(base.geometry.parameters.radiusTop<=1.65*Math.cos(Math.PI/6),'Round base stays inside the former footprint');
assert.equal(capsule.geometry.type,'LatheGeometry');capsule.geometry.computeBoundingBox();
assert(Math.abs(capsule.geometry.boundingBox.min.y-.66)<.001&&Math.abs(capsule.geometry.boundingBox.max.y-3.06)<.001,'Capsule retains the former display height');
assert.equal(holo.userData.boards.length,9);assert.deepEqual(holo.userData.boards,gamingBoards(),'All games keep their existing data');
assert.equal(holo.material.side,T.FrontSide);assert(holo.material.fragmentShader.includes('if(face<=.18)discard'),'Far-side ink is hidden');
assert.equal(holo.material.blending,T.NormalBlending,'The board backing dims bright signs behind the scores');
const positions=holo.geometry.attributes.position,normals=holo.geometry.attributes.normal;
for(let i=0;i<positions.count;i++)assert(positions.getX(i)*normals.getX(i)+positions.getZ(i)*normals.getZ(i)>1.3,'Curved board fronts face out');
const before=holo.material.uniforms.uBoards.value.version,initial=holo.userData.boards.map(b=>b.id);
lounge.update(1,eye,center);assert(Math.abs(holo.rotation.y-Math.PI/18)<1e-10);assert.equal(holo.material.uniforms.uBoards.value.version,before,'No per-frame canvas redraw');
lounge.update(35,eye,center);assert(Math.abs(holo.rotation.y)<1e-10,'One continuous turn takes 36 seconds');
assert.deepEqual(holo.userData.boards.map(b=>b.id),initial);assert.equal(holo.material.uniforms.uBoards.value.version,before,'A complete loop does not repaint unchanged scores');
hearGamingBoard('pool',{m:'board',top:[{name:'Voyager',ms:11000}]});lounge.update(3,eye,center);
assert.equal(holo.userData.boards.find(b=>b.id==='pool').rows[0].value,'11.0 s');assert.equal(holo.material.uniforms.uBoards.value.version,before+1,'Only changed scores repaint the atlas');
const still=createGamingLounge(ship,null,{still:true});still.update(4,eye,center);assert.equal(still.leaderboard.mesh.rotation.y,0);
for(const suffix of ['.public','.prepared','.authoring']){const s=fs.readFileSync('src/walk/gaming-lounge'+suffix+'.js','utf8');assert(s.includes('o.applyMatrix4(rowMatrix)'));assert(s.includes('pcPiece('));assert(s.includes('leaderboardColumn(time)'));assert(s.includes('group,leaderboard,'));}
console.log('PASS gaming lounge: eight relocated PCs, thirteen chairs, five retained wall stations, base collision, full circuit, far-end and chair clearance, existing scores, unavailable storage, atlas rotation and cycling, reduced motion and all variants');
console.log('PASS score capsule: round base collision and full circuit, nine outward boards, 36-second rotation without canvas repaint and score updates');
