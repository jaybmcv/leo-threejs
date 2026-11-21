import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as T from 'three';
import {createNeighborhood} from '../src/model.js';
import {moveRoomFitoutMeshes} from '../src/v2/room-fitout-overrides.js';
import {retireV2RoomShell} from '../src/v2/room-shell.js';
import {Colliders,solid} from '../src/walk/collision.js';
import {Controller} from '../src/walk/controller.js';
import {installGround} from '../src/v2/ground.js';
import {contains,distanceToSegment} from '../src/plan/geometry-v2.js';
import {ZEN_POND,ZEN_BRIDGES} from '../src/walk/zen-garden.js';
import {phase4Programme} from '../src/v2/phase4-programme.js';
import {fitoutGeometry,material} from '../src/v2/phase4-mesh-kit.js';
import {spotIndex,solidSpots} from '../src/walk/rest.js';
import layout from '../src/plan/selected-layout.js';

// Real source furniture and feature colliders in their commons frame. Full-ship flood and browser proof run separately.
const outfile=path.resolve('.qa/zen-garden-factory.mjs');await fs.mkdir(path.dirname(outfile),{recursive:true});
const source=path.resolve('src/walk/blossom.js');let text=await fs.readFile(source,'utf8');
text=text.replace("import {roomObject} from '../plan/rooms.js';","const roomObject=(ship,id)=>ship.root.getObjectByName(id)||null;");
text=text.replace(/from (['"])(\.[^'"]+)\1/g,(_,q,rel)=>'from '+JSON.stringify(pathToFileURL(path.resolve(path.dirname(source),rel)).href));await fs.writeFile(outfile,text);
const {prepareBlossomBed,createBlossomGarden}=await import(pathToFileURL(outfile));
const template=createNeighborhood(),root=new T.Group(),room=new T.Group();room.name='Fitted_garden_commons_10';root.add(room);
for(const o of template.gardenParts.fittings)room.add(o);
moveRoomFitoutMeshes(room,'commons-10');moveRoomFitoutMeshes(room,'commons-10');retireV2RoomShell(room,new Set());
const tables=[];room.traverse(o=>{if(o.name==='Cafe_table')tables.push(o.position.toArray());});
assert.deepEqual(tables.map(p=>[p[0],p[2]]),[[142,43],[148,43],[148,39.5]],'all three cafe sets moved to the edge');
// Each chair's tailored seams are its own child, so they move with the chair exactly once (the nightly hull gate found them doubled).
room.updateMatrixWorld(true);const chairs=[];room.traverse(o=>{if(o.name==='Tail_clearance_chair'&&o.userData.v2FitoutMoved)chairs.push(o);});assert.equal(chairs.length,6,'six moved cafe chairs');
for(const chair of chairs){const seat=new T.Box3().setFromObject(chair.getObjectByName('Seat'),true).expandByScalar(.01),seams=[];chair.traverse(o=>{if(o.name==='Polish_tailored_seam')seams.push(o);});
 assert.equal(seams.length,1,'moved chair keeps its seam pair');for(const s of seams)assert.ok(seat.containsBox(new T.Box3().setFromObject(s,true)),'seams stay on their moved chair at '+chair.position.toArray());}
assert.ok(!room.children.some(o=>o.name==='Garden_planter'&&o.position.x===125),'old green planter removed');
const floor=new T.Mesh(new T.BoxGeometry(53,.3,42.3));floor.name='Fixture_floor';floor.position.set(132,24.15,29.15);room.add(floor);
// Use the same fit-out meshes and rest anchors as the built ship, brought into the fixture's commons frame.
const fitout=phase4Programme(layout),rest=fitout.rests.filter(s=>s.room==='commons-10');
for(const b of fitout.parts.filter(b=>b.room==='commons-10')){
 const o=new T.Mesh(fitoutGeometry(b),material(b.mat));o.name='P4_'+b.part;o.position.set(b.at[0]+26.5,b.at[1],b.at[2]-16);o.rotation.y=b.yaw||0;room.add(o);
}
const seats=rest.filter(s=>s.id?.startsWith('zen-seat-')).map(s=>({...s,instanced:false,point:new T.Vector3(s.point[0]+26.5,s.point[1],s.point[2]-16),facing:new T.Vector3(...s.facing)}));
assert.equal(seats.length,9,'three sitting areas with three cushion spots each');
assert.equal(rest.filter(s=>s.id?.startsWith('p6-')).length,12,'all existing gallery sofa anchors retained');
const ship={root};prepareBlossomBed(ship);const garden=createBlossomGarden(ship);root.add(garden.solid);root.updateMatrixWorld(true);garden.group.updateMatrixWorld(true);
const zen=garden.group.getObjectByName('Zen_garden'),water=zen.getObjectByName('Zen_pond_water'),koi=zen.getObjectByName('Zen_koi');
assert.equal(koi.count,24);let draws=0,triangles=0;zen.traverse(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.count??1);}assert.ok(!o.isLight,'no new real lights');});
assert.ok(draws<=14&&triangles<24000,'bounded garden draw and triangle budget: '+JSON.stringify({draws,triangles}));
const area=Math.abs(ZEN_POND.reduce((sum,[x,z],i)=>{const [xx,zz]=ZEN_POND[(i+1)%ZEN_POND.length];return sum+x*zz-xx*z;},0)/2);
assert.ok(area>360,'pond grows to several times its original footprint');
const transform=garden.group.children[0].matrix.clone().premultiply(garden.group.matrixWorld),inv=transform.clone().invert();
const localBox=o=>new T.Box3().setFromObject(o).applyMatrix4(inv);
assert.ok(localBox(zen.getObjectByName('Zen_rocks_moss_and_pines')).max.y<28.02,'pines and falls stay below next balcony underside');
// Retained crew stand on gravel clear of the new bridge and pond rim.
const gravel=zen.getObjectByName('Zen_gravel_floor'),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
const gravelBox=localBox(gravel);assert.ok(gravelBox.min.x<=106.01&&gravelBox.max.x>=157.99&&gravelBox.min.z<=8.51&&gravelBox.max.z>=47.99,'continuous gravel covers the open floor');
const footprint=layout.rooms.find(r=>r.id==='commons-10').polygon;
for(let x=80;x<132;x+=3)for(let z=25;z<66;z+=3){if(!contains(footprint,[x,z]))continue;
 ray.set(new T.Vector3(x+26.5,25,z-16).applyMatrix4(transform),down);assert.ok(ray.intersectObject(gravel).length,'gravel covers selected floor at '+[x,z]);
}
const vertices=gravel.geometry.attributes.position;
for(let i=0;i<vertices.count;i++){const p=[vertices.getX(i)-26.5,vertices.getZ(i)+16];assert.ok(contains(footprint,p)||footprint.some((a,k)=>distanceToSegment(p,a,footprint[(k+1)%footprint.length])<.001),'finish stays within the existing room');}
const trunks=[];garden.solid.traverse(o=>{if(o.name==='Zen_pine_trunk')trunks.push(o);});assert.ok(trunks.length>=7,'several bonsai in varied sizes');
const crew=[];room.traverse(o=>{if(o.name==='Mars_cat_1.75m')crew.push(o);});assert.equal(crew.length,6,'all existing crew retained');
for(const actor of crew){
 const b=new T.Box3().setFromObject(actor);
 for(const B of ZEN_BRIDGES)assert.ok(!b.intersectsBox(new T.Box3(new T.Vector3(B.x-B.width/2-.2,24.3,B.z0),new T.Vector3(B.x+B.width/2+.2,26.5,B.z1))),'crew clear each timber bridge');
 if(actor.position.y>25)continue;
 for(const x of [b.min.x,b.max.x])for(const z of [b.min.z,b.max.z]){
  assert.ok(!contains(ZEN_POND,[x,z])&&ZEN_POND.every((a,i)=>distanceToSegment([x,z],a,ZEN_POND[(i+1)%ZEN_POND.length])>.7),'crew clear the water and rock rim');
  ray.set(new T.Vector3(x,b.min.y+.1,z).applyMatrix4(transform),down);const hit=ray.intersectObject(gravel)[0];assert.ok(hit&&Math.abs(hit.point.clone().applyMatrix4(inv).y-b.min.y)<.025,'crew feet supported at gravel height');
 }
}
const col=installGround(new Colliders(),new Colliders());col.addStatic(root,solid);col.commit();const ctl=new Controller(col);
assert.equal(solidSpots(seats,col).length,9,'every new cushion holds a sitting cat');
const index=spotIndex(seats);
const put=(x,z,y=24.3)=>ctl.place(new T.Vector3(x,y,z));
const go=(x,z)=>{for(let i=0;i<2400;i++){const d=new T.Vector3(x-ctl.position.x,0,z-ctl.position.z);if(d.length()<.12)return;d.setLength(Math.min(3.2,d.length()*5));ctl.step(1/120,d,false);assert.ok(ctl.position.y>24.28&&ctl.position.y<25.4,'no fall or unintended climb');}assert.fail('stuck en route to '+[x,z]+' at '+ctl.position.toArray());};
const crests=[];assert.equal(ZEN_BRIDGES.length,3);
for(const B of ZEN_BRIDGES){
 put(B.x,B.z0-.8);let crest=0;
 for(let z=B.z0;z<=B.z1+.6;z+=.25){go(B.x,z);crest=Math.max(crest,ctl.position.y);}
 assert.ok(crest>24.3+B.rise-.07,'cat climbs bridge arch at '+B.x);assert.ok(Math.abs(ctl.position.y-24.3)<.04,'cat lands on far gravel');crests.push(crest);
 go(B.x,B.z0-.8);assert.ok(Math.abs(ctl.position.y-24.3)<.04,'bridge also crosses back');
 put(B.x,(B.z0+B.z1)/2,24.3+B.rise+.045);for(let i=0;i<300;i++)ctl.step(1/120,new T.Vector3(3.2,0,0),false);assert.ok(ctl.position.x<B.x+B.width/2-.15,'bridge rail holds cat');
}
// Near balcony floor to the new centre bridge and on to the retained cherry planter.
put(114,21);for(const [x,z] of [[114,17.5],[118.5,17.5],[118.5,14],[131,14],[131,35.9],[135,35.9],[135,35]])go(x,z);
// The cafe strip remains clear along both its window counters and the kitchen's front chairs.
put(125.8,40.5);for(const [x,z] of [[145.5,40.5],[145.5,37.2],[145.5,40.5],[135.2,40.5],[135.2,35],[135.2,30],[135.2,27]])go(x,z);
put(125.8,41);for(const [x,z] of [[125.8,35.9],[135.2,35.9],[135.2,40.5],[145.5,40.5]])go(x,z);
// All entrances stay joined by dry banks: west services, both long banks and lower stair arrival.
put(114,17.5);for(const [x,z] of [[118.5,17.5],[118.5,14],[131,14],[138,14],[138,12],[150,12],[150,32],[151.8,33.8],[150,32],[150,33],[149.4,37.2],[145.5,37.2]])go(x,z);
for(const s of seats.filter(s=>s.id.endsWith('-1'))){
 const p=s.point.clone().addScaledVector(s.facing,1.1).setY(24.3);put(p.x,p.z);
 assert.equal(index.pick(ctl.position,s.facing.clone().negate())?.id,s.id,'existing sit picker finds each garden seat');
 go(p.x+s.facing.x*3,p.z+s.facing.z*3);
}
// Low pond edges have no trapping face, including where decorative stones meet.
for(let i=0;i<ZEN_POND.length;i++){
 const a=ZEN_POND[i],b=ZEN_POND[(i+1)%ZEN_POND.length],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=dz/len,nz=-dx/len;
 if(ZEN_BRIDGES.some(B=>Math.abs(x-B.x)<B.width/2+1.8&&z>B.z0-1&&z<B.z1+1))continue;
 put(x-nx*.8,z-nz*.8);go(x+nx*.8,z+nz*.8);assert.ok(ctl.position.y<24.65,'cat steps out of shallow water at edge '+i);
}
const m=new T.Matrix4(),p=new T.Vector3();
for(let step=0;step<600;step++){garden.update(.1,new T.Vector3(125,25,26));for(let i=0;i<koi.count;i++){koi.getMatrixAt(i,m);p.setFromMatrixPosition(m);assert.ok(contains(ZEN_POND,[p.x,p.z]),'koi remain in pond');assert.ok(ZEN_POND.every((a,k)=>distanceToSegment([p.x,p.z],a,ZEN_POND[(k+1)%ZEN_POND.length])>.35),'fish clear the rocks');}}
assert.ok(water.material.opacity>.4&&water.material.opacity<.6,'clear aqua water');
const selected=layout.rooms.find(r=>r.id==='commons-10');assert.equal(selected.y,24.3);assert.equal(Math.min(...selected.components.galleries.map(g=>g.center[1])),28.3);
console.log(JSON.stringify({status:'PASS',draws,triangles,pondArea:area,bridgeCrests:crests,seats:seats.length,scope:'Source furniture, all three bridges both ways, supported sit anchors and departures, cafe aisle, perimeter and stair approaches, shallow pond exits, rails, koi containment and gallery clearance. Full ship/browser checked separately.'},null,2));
