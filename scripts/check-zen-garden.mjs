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
import {groundMesh,installGround} from '../src/v2/ground.js';
import {contains,distanceToSegment} from '../src/plan/geometry-v2.js';
import {ZEN_POND,ZEN_BRIDGE} from '../src/walk/zen-garden.js';
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
const floor=new T.Mesh(new T.BoxGeometry(53,.3,42));floor.name='Fixture_floor';floor.position.set(132,24.15,29);room.add(floor);
const ship={root};prepareBlossomBed(ship);const garden=createBlossomGarden(ship);root.add(garden.solid);root.updateMatrixWorld(true);garden.group.updateMatrixWorld(true);
const zen=garden.group.getObjectByName('Zen_garden'),water=zen.getObjectByName('Zen_pond_water'),koi=zen.getObjectByName('Zen_koi');
assert.equal(koi.count,9);let draws=0,triangles=0;zen.traverse(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.count??1);}assert.ok(!o.isLight,'no new real lights');});
assert.ok(draws<=14&&triangles<24000,'bounded garden draw and triangle budget');
const transform=garden.group.children[0].matrix.clone().premultiply(garden.group.matrixWorld),inv=transform.clone().invert();
const localBox=o=>new T.Box3().setFromObject(o).applyMatrix4(inv);
assert.ok(localBox(zen.getObjectByName('Zen_rocks_moss_and_pines')).max.y<28.02,'pines and falls stay below next balcony underside');
// Retained crew stand on gravel clear of the new bridge and pond rim.
const bridgeBox=localBox(zen.getObjectByName('Zen_wooden_bridge')),gravel=zen.getObjectByName('Zen_gravel_floor'),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
const crew=[];room.traverse(o=>{if(o.name==='Mars_cat_1.75m')crew.push(o);});assert.equal(crew.length,6,'all existing crew retained');
for(const actor of crew){
 const b=new T.Box3().setFromObject(actor);assert.ok(!b.intersectsBox(bridgeBox),'crew clear the entire timber bridge');
 if(actor.position.y>25)continue;
 for(const x of [b.min.x,b.max.x])for(const z of [b.min.z,b.max.z]){
  assert.ok(!contains(ZEN_POND,[x,z])&&ZEN_POND.every((a,i)=>distanceToSegment([x,z],a,ZEN_POND[(i+1)%ZEN_POND.length])>.7),'crew clear the water and rock rim');
  ray.set(new T.Vector3(x,b.min.y+.1,z).applyMatrix4(transform),down);const hit=ray.intersectObject(gravel)[0];assert.ok(hit&&Math.abs(hit.point.clone().applyMatrix4(inv).y-b.min.y)<.025,'crew feet supported at gravel height');
 }
}
const col=installGround(new Colliders(),new Colliders());col.addStatic(root,solid);col.commit();const ctl=new Controller(col);
const put=(x,z,y=24.3)=>ctl.place(new T.Vector3(x,y,z));
const go=(x,z)=>{for(let i=0;i<2400;i++){const d=new T.Vector3(x-ctl.position.x,0,z-ctl.position.z);if(d.length()<.12)return;d.setLength(Math.min(3.2,d.length()*5));ctl.step(1/120,d,false);assert.ok(ctl.position.y>24.28&&ctl.position.y<25.4,'no fall or unintended climb');}assert.fail('stuck en route to '+[x,z]+' at '+ctl.position.toArray());};
put(ZEN_BRIDGE.x,18.3);let crest=0;
for(let z=19;z<=35;z+=.25){go(ZEN_BRIDGE.x,z);crest=Math.max(crest,ctl.position.y);}
assert.ok(crest>25.1,'cat climbs the bridge arch');assert.ok(Math.abs(ctl.position.y-24.3)<.04,'cat lands on far gravel');go(ZEN_BRIDGE.x,38.2);
// A complete circuit uses the clear aisle beside the kitchen, passes the cherry bridge and falls, and returns.
put(125.8,41);for(const [x,z] of [[125.8,34.5],[134.8,34.5],[134.8,18.3],[115.2,18.3],[115.2,34.5],[125.8,34.5],[125.8,41]])go(x,z);
put(115.5,26);for(let i=0;i<300;i++)ctl.step(1/120,new T.Vector3(3.2,0,0),false);
assert.ok(ctl.position.x<117&&Math.abs(ctl.position.y-24.3)<.04,'west rim blocks walking into water');
put(123,26,25.25);for(let i=0;i<300;i++)ctl.step(1/120,new T.Vector3(3.2,0,0),false);assert.ok(ctl.position.x<124.1,'bridge rail blocks stepping into pond');
put(115.7,14);go(116.2,14);assert.ok(ctl.position.y>24.35&&ctl.position.y<24.5,'moss islands support walking');
const m=new T.Matrix4(),p=new T.Vector3();
for(let step=0;step<600;step++){garden.update(.1,new T.Vector3(125,25,26));for(let i=0;i<koi.count;i++){koi.getMatrixAt(i,m);p.setFromMatrixPosition(m);assert.ok(contains(ZEN_POND,[p.x,p.z]),'koi remain in pond');assert.ok(ZEN_POND.every((a,k)=>distanceToSegment([p.x,p.z],a,ZEN_POND[(k+1)%ZEN_POND.length])>.35),'fish clear the rocks');}}
assert.ok(water.material.opacity>.4&&water.material.opacity<.6,'clear aqua water');
const selected=layout.rooms.find(r=>r.id==='commons-10');assert.equal(selected.y,24.3);assert.equal(Math.min(...selected.components.galleries.map(g=>g.center[1])),28.3);
console.log(JSON.stringify({status:'PASS',draws,triangles,bridgeCrest:crest,scope:'Source furniture, crew support and bridge/rim clearance, arch crossing and departure, full pond circuit, solid rim/rails, fish containment and balcony height. Full ship/browser checked separately.'},null,2));
