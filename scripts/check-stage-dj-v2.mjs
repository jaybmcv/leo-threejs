import assert from 'node:assert/strict';
import * as T from 'three';
import {createStageDj,stageDjCollider,STAGE_DJ} from '../src/v2/common-stage-dj.js';
import {stageDjLevel,stageDjLoop,createStageDjSound} from '../src/walk/stage-dj-sound.js';
import {addAtriumStage,stageGeometry} from '../src/v2/atrium-stage.js';
import {Colliders} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {installPreparedColliders} from '../src/v2/prepared-codec.public.js';
import {MeshBVH} from 'three-mesh-bvh';

const floorY=STAGE_DJ.at[1]-.36,parts=[],rests=[];addAtriumStage({parts,rests,y:floorY});
const root=new T.Group(),mat=new T.MeshBasicMaterial(),floor=new T.Mesh(new T.BoxGeometry(90,.2,50),mat);floor.position.set(85,floorY-.1,30);root.add(floor);
for(const p of parts.filter(p=>!p.noCollide)){const m=new T.Mesh(stageGeometry(p)||new T.BoxGeometry(...p.size),mat);m.name=p.part;m.position.set(...p.at);root.add(m);}
const colliders=new Colliders();colliders.addStatic(root);colliders.commit();
// Exercise the public walk's restricted factories, not just an authoring collider collection.
installPreparedColliders(colliders,{v2PreparedMovers:new Map()});
const dj=createStageDj({colliders}),bounds=new T.Box3().setFromObject(dj.group);let draws=0,triangles=0;
assert.equal(colliders.movers.length,1);assert.equal(colliders.movers[0].name,'Common_stage_DJ_solid');
dj.group.traverse(o=>{assert(!o.isLight,'The DJ adds no lights');if(!o.isMesh)return;draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert(!o.castShadow);for(const v of o.geometry.attributes.position.array)assert(Number.isFinite(v));});
assert.equal(dj.targets.length,8);assert(draws<=14,'Keep the DJ below fourteen draws');assert(triangles<18000,'Keep the DJ below eighteen thousand triangles');
assert(bounds.min.x>107&&bounds.max.x<111&&bounds.min.z>26.9&&bounds.max.z<33.1,'Leave clear floor in front, behind and on both sides');
assert(bounds.max.y-STAGE_DJ.at[1]>2.8&&bounds.max.y-STAGE_DJ.at[1]<3.1);
const stool=dj.group.getObjectByName('Common_stage_DJ_stool');assert(stool,'The DJ has a stool');
const stoolBounds=new T.Box3().setFromObject(stool,true),seat=stoolBounds.getCenter(new T.Vector3());seat.y=stoolBounds.max.y;
const platform=new T.Box3().setFromObject(root.getObjectByName('p6_stage_platform'));
assert(platform.containsPoint(new T.Vector3(seat.x,platform.max.y,seat.z))&&Math.abs(stoolBounds.min.y-platform.max.y)<1e-5,'The stool feet stand on the stage platform');
const deskMeshes=dj.group.children.filter(o=>o.isMesh),desk=new T.Box3();for(const mesh of deskMeshes)desk.expandByObject(mesh);
assert(stoolBounds.min.x>desk.max.x,'The stool clears the table and truss');
const stoolBvh=new MeshBVH(stool.children[0].geometry,{indirect:true}),toStool=stool.matrix.clone().invert(),up=new T.Vector3(0,1,0);
for(let i=0;i<=16;i++){
 dj.update(i?60/STAGE_DJ.bpm/8:0,dj.group.position,false);dj.group.updateMatrixWorld(true);
 const underside=new T.Raycaster(seat.clone().addScaledVector(up,-.05),up).intersectObject(dj.head,true)[0];
 assert(underside&&Math.abs(underside.point.y-seat.y)<1e-5&&Math.abs(new T.Box3().setFromObject(dj.head,true).min.y-seat.y)<1e-5,'The DJ rests on the seat throughout its sway');
 for(const mesh of dj.arms.children)assert(!stoolBvh.intersectsGeometry(mesh.geometry,toStool.clone().multiply(dj.arms.matrix)),'The stool clears the moving tentacles and suction cups');
}
// Five centimetres around each lid also covers the arms' small idle movement.
const lid=new T.BoxGeometry(.78,.54,.135),armBvhs=dj.arms.children.map(mesh=>new MeshBVH(mesh.geometry,{indirect:true}));
for(const x of[-2.12,2.12]){
 const z=.15+.5*(1-(x/2.8)**2)-.21,matrix=new T.Matrix4().makeRotationX(.2).setPosition(x,1.62,z);
 for(const bvh of armBvhs)assert(!bvh.intersectsGeometry(lid,matrix),'Tentacles and suction cups must clear the open laptop lids');
 const side=sign=>new T.Raycaster(dj.group.localToWorld(new T.Vector3(x,1.62,z+sign)),new T.Vector3(0,0,-sign).transformDirection(dj.group.matrixWorld)).intersectObjects(deskMeshes,false)[0];
 const screen=side(-1),back=side(1);
 assert(screen?.object.material.emissive.getHex()===0x36efff&&screen.face.normal.z<-.9,'Each laptop screen faces the DJ');
 assert(back?.object.material.emissive.getHex()===0&&back.face.normal.z>.9&&!back.object.material.transparent,'The audience sees each opaque lid back');
}
lid.dispose();
const cat=new Controller(colliders),step=(seconds,x=0,z=0)=>{for(let i=0;i<Math.round(seconds*120);i++)cat.step(1/120,new T.Vector3(x,0,z));};
cat.place(new T.Vector3(100.17,floorY+.24,29.49));step(.2);step(5,2.25);assert(cat.position.x>106&&cat.position.x<107,'The cat reaches the stage and stops against the booth');
const stopped=cat.position.clone();step(1,2.25);assert(cat.position.distanceTo(stopped)<.03,'The cat cannot walk through the booth');
step(1.9,0,-2.25);assert(cat.position.z<25.6);step(3,2.25);assert(cat.position.x>112.5&&cat.grounded,'Pass the side of the booth');
step(4,0,2.25);assert(cat.position.z>34&&cat.grounded,'Cross behind the octopus');step(6,-2.25);assert(cat.position.x<100.5&&cat.grounded,'Leave along the other side');
step(2,0,-2.25);assert(cat.grounded&&Math.abs(cat.position.z-29.49)<1,'Return to the audience floor');

const at=STAGE_DJ.at,near={x:106.65,y:at[1],z:30},circle={x:96,y:floorY+.24,z:30},far={x:63,y:floorY+.96,z:30};
assert.equal(stageDjLevel(far,at),0);assert(stageDjLevel(circle,at)>0);assert(stageDjLevel(near,at)>stageDjLevel(circle,at));assert.equal(stageDjLevel(near,at,false),0);assert.equal(stageDjLevel({...near,y:at[1]+6},at),0);
const param=()=>({value:0,setTargetAtTime(v){this.value=v;}}),node=()=>({connect(){return this;}});let built=0,context;
class Audio {
 constructor(){context=this;built++;this.sampleRate=22050;this.currentTime=0;this.state='running';this.destination={};}
 createBuffer(ch,n,rate){const data=new Float32Array(n);return {duration:n/rate,getChannelData:()=>data};}
 createBufferSource(){return {...node(),start(){}};}
 createGain(){return {...node(),gain:param()};}
 createPanner(){return node();}
 resume(){this.state='running';return Promise.resolve();}
 suspend(){this.state='suspended';}
}
const buffer=stageDjLoop(new Audio()),data=buffer.getChannelData(0);let energy=0,peak=0;
for(const n of data){assert(Number.isFinite(n));energy+=n*n;peak=Math.max(peak,Math.abs(n));}
assert(Math.sqrt(energy/data.length)>.08);assert(peak<1);assert(Math.abs(data[0])===0&&Math.abs(data.at(-1))===0);assert(Math.abs(buffer.duration-16*60/134)<1/22050);
built=0;globalThis.AudioContext=Audio;globalThis.document={hidden:false,addEventListener(){}};Object.defineProperty(navigator,'userActivation',{value:{hasBeenActive:false},configurable:true});
const sound=createStageDjSound(STAGE_DJ);sound.update(near,true);assert.equal(built,0,'Wait for a gesture');navigator.userActivation.hasBeenActive=true;sound.update(near,false);sound.update(far,true);assert.equal(built,0,'Do not start muted or far away');
sound.update(circle,true);assert.equal(built,1);const audienceGain=sound.gain;sound.update(near,true);assert(sound.gain>audienceGain);assert(sound.running);context.currentTime=.5;assert(sound.beat>1);sound.update(far,true);assert.equal(sound.level,0);sound.update(near,false);assert.equal(sound.gain,0);
console.log(JSON.stringify({status:'PASS',draws,triangles,bounds:[bounds.min.toArray(),bounds.max.toArray()],stopped:stopped.toArray(),returned:cat.position.toArray(),audio:{bpm:134,seconds:buffer.duration,peak,audienceGain,nearGain:stageDjLevel(near,at)},walk:'blocked at booth, around both sides and behind, back to seating'}));
