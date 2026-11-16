import '../src/model.js';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {addWayfindingGuides} from '../src/v2/wayfinding-guides.js';
import {guideSchedule} from '../src/v2/wayfinding-guide-data.js';
import {HYDRO_NIP_HANGER} from '../src/v2/hydro-nip-wayfinding.js';
import {buildCommonsHallFinish} from '../src/v2/commons-hall-finish.js';
import {createLoungeEntranceSigns} from '../src/walk/lounge-entrance-signs.js';
import {VIP_RUNNER} from '../src/v2/lounge-vip-entrance.js';
import {Colliders,BODY} from '../src/walk/collision.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {shellParts,cutChartMany} from '../src/v2/hull-prototypes.js';
import {worldPoint} from '../src/plan/hull-skin-v2.js';
import {sideGalleryDoorCuts} from '../src/v2/gallery-doorways.js';
import {polygonGeometry} from '../src/v2/geometry.js';
import {createPaintings} from '../src/walk/paintings.js';
import {createJaguarGate} from '../src/walk/jaguar-gate.js';

globalThis.document={createElement:()=>createCanvas(1,1)};
const parent=new T.Group(),roots=addWayfindingGuides(parent),schedule=guideSchedule(layout);
parent.updateMatrixWorld(true);
const labels=roots.flatMap(r=>r.children.flatMap(o=>o.userData.labels||[]));
assert.deepEqual(labels.map(r=>r.id).sort(),schedule.filter(r=>r.id!=='commons-1').map(r=>r.id).sort(),'Only the jaguar plaque is removed');
assert(roots[16].getObjectByName('V2_floor_guides').userData.destinations.includes('commons-1'),'Retain its floor arrow');
assert.equal(schedule.filter(r=>!r.plaque).length,1);
const sign=parent.getObjectByName('Hydro_Nip_Promenade_Sign'),box=new T.Box3().setFromObject(sign,true),floor=layout.decks[16].y;
const {group:gate}=createJaguarGate(),gateBox=new T.Box3().setFromObject(gate,true);
assert(Math.abs(sign.position.x-gate.position.x)<1e-6,'Hanging sign follows the actual doorway centre');
assert(box.min.z>gateBox.max.z+.1,'Centred sign and rods stay clear of the jaguar head');
assert.equal(sign.parent,roots[16],'Sign stays in the Deck 17 render band');
assert(box.min.y-floor>=2.3,'Standing cats have generous clearance');
assert(Math.abs(box.max.y-floor-HYDRO_NIP_HANGER.ceiling)<1e-5,'Rods end at the hall ceiling');
assert(box.min.z>-20,'Sign stays well outboard of the jaguar face and aquarium');
sign.traverse(o=>assert(o.userData.noCollide,'Every sign part is non-solid'));
const front=sign.getObjectByName('Hydro_Nip_Hanger_Front'),back=sign.getObjectByName('Hydro_Nip_Hanger_Back');
assert.equal(front.material,back.material,'Both faces use the same artwork');
assert.equal(front.material.side,T.FrontSide,'Backwards lettering never shows through');
const normal=o=>new T.Vector3(0,0,1).transformDirection(o.matrixWorld);
assert(normal(front).x>.999&&normal(back).x<-.999,'Separate readable faces look along the walkway');
for(const o of [front,back])assert(o.matrixWorld.determinant()>0,'No mirrored artwork');
const hall=new T.Group();buildCommonsHallFinish(hall,layout);hall.updateMatrixWorld(true);
const ray=new T.Raycaster(new T.Vector3(sign.position.x,floor+3,sign.position.z),new T.Vector3(0,1,0));
const ceiling=hall.getObjectByName('V2_commons_hall_ceiling');
assert(ray.intersectObject(ceiling).some(h=>Math.abs(h.point.y-floor-HYDRO_NIP_HANGER.ceiling)<.001),'Real ceiling exists above the rods');
const lights=hall.getObjectByName('V2_commons_hall_lights'),p=lights.geometry.attributes.position,idx=lights.geometry.index,triangle=new T.Triangle();
for(let i=0;i<(idx?.count||p.count);i+=3){for(let k=0;k<3;k++)triangle[['a','b','c'][k]].fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(lights.matrixWorld);assert(!box.intersectsTriangle(triangle),'Hanger must not clip a ceiling light');}
console.log('PASS: sign centred on the jaguar doorway with head clearance; floor arrow retained; two readable faces, ceiling attachment, light clearance and 2.52 m headroom');

const entrances=createLoungeEntranceSigns(),[vip,retained]=entrances.groups;
const room=layout.rooms.find(r=>r.id==='commons-1'),door=room.galleryDoors.find(d=>d.deck===19),r=VIP_RUNNER;
assert.deepEqual(vip.position.toArray(),door.center,'VIP dressing uses the real Deck 19 doorway');
assert.deepEqual(entrances.solid.position.toArray(),door.center,'Post collision uses the same doorway frame');
const panel=vip.getObjectByName('Lounge_VIP_marquee_panel');panel.geometry.computeBoundingBox();
const pb=panel.geometry.boundingBox;
assert(Math.abs(pb.min.x+pb.max.x)<1e-5,'Marquee is centred above the doorway');
assert(pb.min.y>2.5&&pb.max.y<room.y+room.height-door.center[1],'Marquee fits the real wall height above the opening');
const marquee=new T.Box3();
for(const o of vip.children){if(o.name==='Lounge_VIP_runner'||o.name==='Lounge_VIP_velvet_ropes'||o.name.startsWith('Lounge_VIP_post_'))continue;marquee.union(new T.Box3().setFromObject(o,true));}
assert(marquee.min.y>door.center[1]+2.52&&marquee.max.y<room.y+room.height-.02,'Entire marquee, including crest, bulbs and scrolls, stays on the wall header');
assert(marquee.max.z-marquee.min.z>=door.width*1.75&&marquee.max.z-marquee.min.z<=door.width*2.25,'Complete marquee is roughly twice the doorway width');
const painting=new T.Box3().setFromObject(createPaintings().groups.find(g=>g.name==='Painting_Orange_Haze_14_1'),true);
assert(marquee.min.z>painting.max.z+.02,'Marquee and scrollwork leave the unchanged painting frame visible');
assert(!vip.children.some(o=>o.name.startsWith('Lounge_sign_')),'Deck 19 has no original post sign');
assert.equal(vip.getObjectByName('Lounge_VIP_warm_bulbs').isInstancedMesh,true);
assert.equal(vip.getObjectByName('Lounge_VIP_post_shafts').count,10,'Posts are instanced at both edges');
vip.traverse(o=>{assert(!o.isLight,'No new real-time lights');if(o.isMesh)assert(o.userData.noCollide,'Only separate post proxies are solid');});
assert.equal(entrances.solid.children.filter(o=>o.name==='Lounge_VIP_post_collider').length,10);
assert.equal(entrances.solid.children.length,11,'Ten original posts and one seating collision group');
assert(r.length>=6&&r.length<=7&&r.width>=door.width);
assert(r.surface>.02&&r.surface<.06,'Runner clears the floor finish with no step');
assert(r.postX-.19>=r.width/2-.02,'Post bases stay beside the runner');
for(let i=1;i<r.posts.length;i++)assert(r.posts[i]-r.posts[i-1]>=1.5&&r.posts[i]-r.posts[i-1]<=2);
// Keep the other entrance's exact original geometry, including both posts and both readable faces.
const hash=createHash('sha256');retained.traverse(o=>{if(!o.geometry)return;hash.update(o.name);
 for(const [name,a] of Object.entries(o.geometry.attributes))hash.update(name).update(new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 if(o.geometry.index)hash.update(new Uint8Array(o.geometry.index.array.buffer));
});
assert.equal(hash.digest('hex'),'d7bef2aa30a0f0076500c17fd9f4f387ece55b82bec820405ffec14c1cd0cebd','Deck 18 keeps the complete post-sign geometry');
retained.traverse(o=>{if(o.isMesh)assert(o.userData.noCollide);});
// Include the real lounge shell and gallery guards in the clearance probes.
const shell=new T.Group();buildRoomShell({root:new T.Group()},room,shell);
if(room.hullPrototype){const p=layout.hullPrototypes.prototypes.find(p=>p.id===room.id),walls=new T.Mesh(shellParts(p,q=>worldPoint(p.chart,q)).sides);
 cutChartMany(walls,sideGalleryDoorCuts(room));shell.add(walls);
}
const col=new Colliders();col.addStatic(shell);col.addStatic(entrances.solid,()=>true);col.commit();
const clear=(x,z)=>{const p=vip.localToWorld(new T.Vector3(x,0,z));
 const body=new T.Line3(p.clone().add(new T.Vector3(0,BODY.step+BODY.radius,0)),p.clone().add(new T.Vector3(0,BODY.height-BODY.radius,0)));
 assert(!col.overlaps(body,BODY.radius),`Visitor clearance at local ${x},${z}`);
};
for(let z=-2.3;z<=r.start+r.length+.8;z+=.12)clear(0,z);
for(let x=-2.2;x<=2.2;x+=.12)clear(x,r.start+r.length+.8);
const post=entrances.solid.children[0].getWorldPosition(new T.Vector3());
assert(col.raycast(new T.Ray(post.clone().add(new T.Vector3(-.5,0,0)),new T.Vector3(1,0,0)),1),'Posts have real collision');
console.log('PASS: Deck 19 wall marquee, instanced bulbs/posts, 6.6 m runner, real post collision, doorway/end clearance; Deck 18 unchanged');

const seating=entrances.groups[2],furniture=entrances.solid.getObjectByName('Lounge_VIP_seating_solid');
assert.equal(seating.name,'Lounge_VIP_seating');
assert.deepEqual(seating.position.toArray(),door.center,'Seating uses the real Deck 19 doorway frame');
assert.equal(entrances.groups.length,3,'Only Deck 19 receives another dressing group');
seating.updateMatrixWorld(true);
const localBox=o=>new T.Box3().setFromObject(o,true).applyMatrix4(seating.matrixWorld.clone().invert());
const seatingBounds=localBox(seating);
assert(-r.postX-.19-seatingBounds.max.x>=1.2,'All furniture, foliage and overhead dressing clear the nearest rope/post line by 1.2 m');
assert(seatingBounds.min.y>=.02,'Furniture stands above the existing floor finish');
assert(localBox(seating.getObjectByName('VIP_seating_velvet')).max.y<=.75,'Sofa backs stay low below the painting');
seating.traverse(o=>{assert(!o.isLight,'Dressing uses emissive glow only');if(o.isMesh)assert(o.userData.noCollide,'Collision comes only from simple furniture proxies');});
const types=['VIP_sofa_collider','VIP_table_collider','VIP_planter_collider'];
assert.deepEqual(types.map(name=>furniture.children.filter(o=>o.name===name).length),[2,2,5]);
assert.equal(furniture.children.length,9);
for(const o of furniture.children){
 const b=localBox(o);assert(b.min.z>=.3,'Furniture stays in front of the painting face');
 assert(b.max.x<=-r.postX-.19-1.2,'Each solid is clear of the runner and door');
 const c=new T.Box3().setFromObject(o,true).getCenter(new T.Vector3());
 assert(col.raycast(new T.Ray(c.clone().add(new T.Vector3(-2,0,0)),new T.Vector3(1,0,0)),2.5),'Every furniture proxy has real collision');
}
const artLocal=painting.clone().applyMatrix4(seating.matrixWorld.clone().invert());
for(const name of ['VIP_seating_foliage',...['pink','purple','green'].map(c=>'VIP_frond_'+c)]){
 const o=seating.getObjectByName(name),p=o.geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  assert(p.getZ(i)>.3,'Fronds stay off the painting face');
  assert(p.getX(i)<-7.1||p.getX(i)>-3.9,'Plants leave the middle of the painting visible');
 }
}
assert(artLocal.max.y>.75+2.4,'Most of the unchanged painting remains above the low sofas');
const frondRay=new T.Raycaster(seating.localToWorld(new T.Vector3(-7.8,2.5,.95)),new T.Vector3(0,-1,0));
const frondHit=frondRay.intersectObjects([seating.getObjectByName('VIP_seating_foliage'),seating.getObjectByName('VIP_frond_pink')])[0];
assert.equal(frondHit?.object.material.name,'VIP_frond_pink','Neon accent is visible outside the green frond stem');
const drops=seating.getObjectByName('VIP_crystal_drops');
assert(drops.isInstancedMesh&&drops.count>=48,'Shared faceted crystal drops');
assert(localBox(drops).min.y>=3,'Lowest crystal has at least 3 m headroom');
for(const name of ['VIP_candle_bodies','VIP_candle_holders','VIP_candle_flames'])assert.equal(seating.getObjectByName(name).count,12,'Four table candles and eight chandelier candles share instances');
const support=seating.getObjectByName('VIP_chandelier_support'),sb=localBox(support),above=layout.decks[19];
const holes=[...above.slab.holes.map(h=>h.polygon),...layout.hullPrototypes.prototypes.filter(p=>p.deck===20&&p.kind!=='cabin').map(p=>p.polygon)];
const ceilingMesh=new T.Mesh(polygonGeometry(above.slab.outline,holes,above.y),new T.MeshBasicMaterial({side:T.DoubleSide}));
ceilingMesh.updateMatrixWorld(true);
const mount=seating.localToWorld(new T.Vector3(-5,3.6,2.6));
const ceilingHit=new T.Raycaster(mount,new T.Vector3(0,1,0),0,1).intersectObject(ceilingMesh)[0];
assert(ceilingHit,'The actual Deck 20 slab exists directly above the chandelier');
assert(Math.abs(sb.max.y+door.center[1]-ceilingHit.point.y)<1e-5,'Gold canopy and rod attach to the existing slab underside');
assert(seatingBounds.max.y<=ceilingHit.point.y-door.center[1]+1e-5,'Every arm, bulb and crystal stays below the ceiling');
assert(sb.min.y<3.41&&sb.max.y-sb.min.y>.3,'Visible suspension rod reaches the chandelier hub');
for(let z=1.95;z<=8;z+=.1)clear(-5,z);
for(let x=-6.9;x<=-3.9;x+=.1)clear(x,1.95);
console.log('PASS: Deck 19 low sofas, two marble tables, five neon plants, instanced candles/crystals, ceiling-attached chandelier, painting/rope clearance and walkable seating aisle');
