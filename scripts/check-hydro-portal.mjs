import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {createGardenCommons} from '../src/model.js';
import {resolveRoomFrames} from '../src/plan/rooms.js';
import {contains} from '../src/plan/geometry-v2.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {shellParts} from '../src/v2/hull-prototypes.js';
import {worldPoint} from '../src/plan/hull-skin-v2.js';
import {Colliders,solid} from '../src/walk/collision.js';
import {groundMesh} from '../src/v2/ground.js';
import {Controller} from '../src/walk/controller.js';
import {FollowCamera} from '../src/walk/camera.js';
import {findStand} from '../src/walk/places.js';
import {createTransit} from '../src/transit.js';
import {atriumFloorGeometry} from '../src/v2/atrium-surfaces.js';
import {phase6Programme} from '../src/v2/phase6-programme.js';
import {phase4Programme} from '../src/v2/phase4-programme.js';
import {fitoutGeometry} from '../src/v2/phase4-mesh-kit.js';
import {polygonGeometry} from '../src/v2/geometry.js';
import {createLoungeMural} from '../src/walk/lounge-mural.js';
import {inLounge} from '../src/walk/lounge-mood.js';
import {SYNTHWAVE_MURAL,synthwaveMuralOutline} from '../src/v2/community-routes.js';
import {HYDRO_PORTAL as portal,HYDRO_PORTAL_ARRIVAL as arrival,HYDRO_PARK_PORTAL as park,HYDRO_PARK_ARRIVAL as parkArrival,HYDRO_CARGO_PORTAL as cargo,HYDRO_PORTAL_LINKS,hydroPortalContains,createHydroPortalTravel,createHydroPortal,createHydroPortalSound,hydroPortalLevel,buildHydroPortalWarp} from '../src/walk/hydro-portal.js';

// Real lounge furniture and the current hull-owned shell, without loading the rest of the ship.
const r=layout.rooms.find(r=>r.id==='commons-1'),root=new T.Group(),structure=new T.Group();root.add(createGardenCommons(1).root,structure);resolveRoomFrames(root);
// Portal arrivals must enter the same room predicate that starts the lounge music. It lives once, in lounge-mood.js,
// which every walk page runs and which sets lounge.inside, so no page's copy of lounge.js can drift from it.
assert(readFileSync(new URL('../src/walk/lounge-mood.js',import.meta.url),'utf8').includes('lounge.inside=inLounge();'),'The lounge mood gives the lounge its body region');
for(const suffix of ['','.public','.prepared','.authoring']){
 assert(!readFileSync(new URL(`../src/walk/lounge${suffix}.js`,import.meta.url),'utf8').includes('function inLounge'),`lounge${suffix}.js keeps no copy of the body region`);
 assert(readFileSync(new URL(`../src/walk/main${suffix}.js`,import.meta.url),'utf8').includes('createLoungeMood(lounge,'),`main${suffix}.js runs the lounge mood`);
}
{
 const inside=inLounge();
 for(const at of [arrival.at,[portal.x+3,r.y,portal.z],[-89.8,25.95,-35.47],[-114.5,26,-60]])assert(inside(new T.Vector3(...at)),'Lounge body region includes portal and native room');
 for(const at of [parkArrival.at,[-141.1,26,-35],[-114.5,26,-23.9],[-114.5,35.6,-40],[-114.5,34,-60]])assert(!inside(new T.Vector3(...at)),'Lounge body region stays inside the native envelope');
 assert(inside(new T.Vector3(arrival.at[0],r.y-.7,arrival.at[2])),'Low cushion keeps its body effects');
 assert(!inside(new T.Vector3(arrival.at[0],r.y-1.1,arrival.at[2])),'Body effects do not reach the deck below');
}
buildRoomShell({root,inside:root,cutaway:new Set()},r,structure);
const parts=shellParts(r.hullPrototype,q=>worldPoint(r.hullPrototype.chart,q));
for(const [kind,geometry] of Object.entries(parts)){
 const o=new T.Mesh(geometry,new T.MeshBasicMaterial());o.name='V2_prototype_garden_'+kind;root.add(o);
}
const col=new Colliders(),ground=new Colliders();col.addStatic(root);col.commit();ground.addStatic(root,o=>solid(o)&&groundMesh(o));ground.commit();col.raycastGround=(...a)=>ground.raycast(...a);
const close=(a,b)=>assert(Math.abs(a-b)<.01,`${a} != ${b}`),walker=new Controller(col),wish=new T.Vector3();
const run=(v,seconds)=>{for(let i=0;i<seconds*120;i++)walker.step(1/120,wish.set(...v));};
walker.place(new T.Vector3(-138.8,r.y,-41.56));run([-Math.cos(Math.PI/60)*2.25,0,Math.sin(Math.PI/60)*2.25],3);
assert(walker.position.x>portal.x&&walker.position.x<-140,'Mural wall blocks the approach: '+walker.position.toArray());close(walker.position.y,r.y);
assert(Math.abs(walker.position.z-arrival.at[2])<.3,'Mural approach aligns with the portal');
run([0,0,0],.5);const stopped=walker.position.clone();run([-2.25,0,0],3);assert(walker.position.distanceTo(stopped)<.02,'Wall stays blocked');
run([2.25,0,0],1.6);assert(walker.position.x-stopped.x>3,'Walk away from the wall');
// Both portals now deliver feet directly to clear floor.
walker.position.fromArray(arrival.at);walker.velocity.set(0,0,0);walker.grounded=false;walker.top=arrival.at[1];
const capsule=new T.Line3(new T.Vector3(arrival.at[0],r.y+.75,arrival.at[2]),new T.Vector3(arrival.at[0],arrival.at[1]+1.65,arrival.at[2]));
assert(!col.overlaps(capsule,.35),'Clear arrival column, without a seat, rail or plant');
const under=walker.groundAt(walker.position,0,2);assert(under,'Floor below arrival');close(under.point.y,r.y);
run([0,0,0],.1);assert(walker.grounded,'Arrival is on the lounge floor');
run([0,0,0],1);assert(walker.grounded,'Arrival lands');close(walker.position.y,r.y);
assert(Math.hypot(walker.position.x-arrival.at[0],walker.position.z-arrival.at[2])<.01,'Arrival stays at the exact landing');
run([2.25,0,0],1.6);assert(walker.position.x-arrival.at[0]>3,'Arrival walks into the lounge');close(walker.position.y,r.y);
// Looking slightly toward the open floor keeps the departure clear of the maze corner.
for(const from of [arrival.at,stopped.toArray()]){
 walker.place(new T.Vector3(from[0],r.y,from[2]));const start=walker.position.clone(),yaw=Math.PI/2+30*.0042;
 run([2.25*Math.sin(yaw),0,2.25*Math.cos(yaw)],2);
 assert(walker.position.distanceTo(start)>3,'The play departure clears 3 m after looking toward the open floor');close(walker.position.y,r.y);
}
const effect=createHydroPortal(),mesh=effect.group,mat=mesh.material;
close(mesh.position.x-SYNTHWAVE_MURAL.x,.04);close(portal.y-portal.height/2-r.y,1.2);close(arrival.at[0]-SYNTHWAVE_MURAL.x,.8);close(arrival.at[1],r.y);assert.equal(arrival.yaw,160);
// The painted surface is in front of the structural wall. It blocks only the chase camera.
const mural=createLoungeMural(new T.Matrix4()).group;mural.updateMatrixWorld(true);
const camera=new T.PerspectiveCamera(62,1280/720,.05,100),follow=new FollowCamera(camera,col);
follow.occluders.push(...mural.children);follow.yaw=arrival.yaw*Math.PI/180;
const view=()=>{
 follow.update(1/120,walker.position,1.75);camera.updateMatrixWorld(true);
 for(const x of [-1,1])for(const y of [-1,1]){
  const near=new T.Vector3(x,y,-1).unproject(camera);
  assert(near.x>SYNTHWAVE_MURAL.x+.02,'Camera near plane clears the wallpaper at '+near.toArray());
 }
};
walker.position.fromArray(arrival.at);walker.velocity.set(0,0,0);walker.grounded=false;walker.top=arrival.at[1];
for(let i=0;i<120;i++){walker.step(1/120,wish.set(0,0,0));view();}
assert(walker.grounded&&follow.current>1.1,'Settled arrival frames the visible cat');close(walker.position.y,r.y);
const feet=walker.position.clone().project(camera);assert(Math.abs(feet.x)<1&&Math.abs(feet.y)<1,'The settled cat feet are in the landing picture');
const depart=walker.position.clone(),direction=follow.forward().multiplyScalar(2.25);
for(let i=0;i<240;i++){walker.step(1/120,direction);view();}
assert(walker.position.distanceTo(depart)>3,'The exported facing walks at least 3 m into the lounge');close(walker.position.y,r.y);
walker.place(new T.Vector3(arrival.at[0],r.y,arrival.at[2]));follow.yaw+=30*.0042;
const turned=walker.position.clone();direction.copy(follow.forward()).multiplyScalar(2.25);
for(let i=0;i<240;i++){walker.step(1/120,direction);view();}
assert(walker.position.distanceTo(turned)>3,'The play drag and walk clear 3 m');close(walker.position.y,r.y);
// Both the coloured oval and its halo fit the actual painted wall at this height.
const outline=synthwaveMuralOutline().points;
for(const [z,y] of [[portal.z-portal.width*.54,portal.y-portal.height*.54],[portal.z+portal.width*.54,portal.y+portal.height*.54]]){
 assert(contains(outline,[z,y]),'Oval and halo stay inside the painted wall');
}
for(const g of [...r.components.galleries,...r.components.links]){
 if(Math.abs(g.center[0]-portal.x)>g.size[0]/2||Math.abs(g.center[2]-portal.z)>g.size[2]/2||g.center[1]<portal.y)continue;
 assert(portal.y+portal.height*.54<g.center[1]-g.size[1]-.01,'The complete oval and halo clear the upper gallery underside');
}
assert.equal(mat.blending,T.AdditiveBlending);assert(mat.transparent&&!mat.depthWrite&&!mat.toneMapped&&mesh.userData.noCollide);assert(!('near' in effect)&&!('solid' in effect),'No action or collision');
effect.update(1,new T.Vector3(),false,null);close(mat.uniforms.uTime.value,1);
const near=new T.Vector3(portal.x,portal.y,portal.z);assert(hydroPortalLevel(near,true)>0&&hydroPortalLevel(near,true)<=.045);assert.equal(hydroPortalLevel(near,false),0);
assert.equal(hydroPortalLevel(near.clone().add(new T.Vector3(9,0,0)),true),0);assert.equal(hydroPortalLevel(near.clone().add(new T.Vector3(0,9,0)),true),0);
// Check the synthesized loop and bounded, connected graph without an audio device.
const nodes=[],param=()=>({value:0}),node=()=>{const n={gain:param(),frequency:param(),Q:param(),links:[],connect(o){this.links.push(o);return o;},start(){this.started=true;}};nodes.push(n);return n;};
const ctx={sampleRate:8000,createBuffer:(_,n)=>({data:new Float32Array(n),getChannelData(){return this.data;}}),createBufferSource:node,createBiquadFilter:node,createOscillator:node,createGain:node},out=node();
buildHydroPortalWarp(ctx,out);const loop=nodes.find(n=>n.buffer);assert(loop?.loop&&loop.started&&loop.loopEnd>3&&loop.loopEnd<=4);assert(loop.buffer.data.every(Number.isFinite));assert(nodes.some(n=>n.links.includes(out)));assert.equal(nodes.filter(n=>n.started).length,4);
const saved={window:globalThis.window,document:globalThis.document},panners=[],paramAt=()=>({value:0,setTargetAtTime(v){this.value=v;}});
const fake={...ctx,currentTime:0,state:'running',destination:out,listener:{setPosition(){},setOrientation(){}},createGain(){const g=node();g.gain=paramAt();return g;},createPanner(){const p=node();for(const k of ['positionX','positionY','positionZ'])p[k]=paramAt();panners.push(p);return p;}};
try{
 globalThis.window={AudioContext:function(){return fake;}};globalThis.document={hidden:false,addEventListener(){}};
 const sound=createHydroPortalSound();sound.update(near,false,new T.PerspectiveCamera());assert.equal(panners.length,0,'Sound off does not create audio');
 sound.update(near,true,new T.PerspectiveCamera());assert.equal(panners.length,1);assert.equal(sound.spatial,panners[0]);
 for(const [axis,key] of [['x','positionX'],['y','positionY'],['z','positionZ']])close(sound.spatial[key].value,portal[axis]);
 sound.update(near,false,new T.PerspectiveCamera());assert(nodes.some(n=>n.links.includes(sound.spatial)&&n.gain.value===0),'Sound toggle mutes the warp');
}finally{for(const [k,v] of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
// Probe the real core surface from the reported approach, rather than testing a stand-in wall.
const transit=createTransit({minimumDeck:6,maximumDeck:7,coreIds:['forward']}),deck=layout.decks[5];
transit.root.updateMatrixWorld(true);
const faceHit=new T.Raycaster(new T.Vector3(150.34,deck.y+1.5,-5.25),new T.Vector3(Math.sin(266*Math.PI/180),0,Math.cos(266*Math.PI/180))).intersectObject(transit.root,true)[0];
assert(faceHit,'Core face ahead of the reported view');
const face=new T.Box3().setFromObject(faceHit.object);
close(park.x-face.max.x,.04);close(park.z,(face.min.z+face.max.z)/2);
assert(park.z-park.width*.54>face.min.z&&park.z+park.width*.54<face.max.z,'Complete oval stays inside the pier edges');
close(park.y-park.height*.54,deck.y);
assert(park.y+park.height*.54<layout.decks[6].y-.3,'Halo clears the deck above');
const parkEffect=createHydroPortal(park);
assert.equal(parkEffect.group.material.fragmentShader,mat.fragmentShader,'Same spinning neon design');
close(parkEffect.group.rotation.y,Math.PI/2);assert(parkEffect.group.userData.noCollide);
close(parkEffect.group.position.x,park.x);close(parkEffect.group.position.y,park.y);close(parkEffect.group.position.z,park.z);
const floor=new T.Mesh(atriumFloorGeometry(deck.slab.outline,deck.slab.holes.map(h=>h.polygon),deck.y,deck.atrium.outline),new T.MeshBasicMaterial());floor.name='Deck_slab';transit.root.add(floor);
for(const p of phase6Programme(layout).parts.filter(p=>p.deck===6&&!p.noCollide&&p.at[0]>140&&p.at[0]<158&&Math.abs(p.at[2])<10)){
 const o=new T.Mesh(new T.BoxGeometry(...p.size),new T.MeshBasicMaterial());o.name=p.part;o.position.set(...p.at);o.rotation.y=p.yaw||0;transit.root.add(o);
}
col.addStatic(transit.root);col.commit();ground.addStatic(transit.root,o=>solid(o)&&groundMesh(o));ground.commit();
for(const landing of [arrival,parkArrival]){
 const q=findStand(col,landing.at,{radius:0});assert(q,'Exact landing has planned floor and capsule clearance');close(q.y,landing.at[1]);
 walker.place(q);const start=q.clone(),a=landing.yaw*Math.PI/180;
 run([Math.sin(a)*2.25,0,Math.cos(a)*2.25],2);assert(walker.position.distanceTo(start)>3,'Landing facing walks freely for 3 m');close(walker.position.y,landing.at[1]);
}
assert.equal(HYDRO_PORTAL_LINKS[0].arrival,parkArrival);assert.equal(HYDRO_PORTAL_LINKS[1].arrival,arrival);
for(const [source,target,start,yaw] of [[park,arrival,[150.34,deck.y,-5.25],266],[portal,parkArrival,[portal.x+3,r.y,portal.z],270]]){
 const travel=createHydroPortalTravel();let trips=0;walker.place(new T.Vector3(...start));
 const go=dest=>{assert.deepEqual(dest.at,target.at);assert.equal(dest.yaw,target.yaw*Math.PI/180);assert(dest.resolved);const q=findStand(col,dest.at,{radius:0});assert(q);walker.place(q);trips++;return true;};
 const a=yaw*Math.PI/180;wish.set(Math.sin(a)*2.25,0,Math.cos(a)*2.25);
 for(let i=0;i<360&&!trips;i++){walker.step(1/120,wish);travel.step(walker.position,true,go);}
 assert.equal(trips,1,'Walking into the source travels once');
 for(let i=0;i<240;i++){walker.step(1/120,wish.set(0,0,0));travel.step(walker.position,true,go);}
 assert.equal(trips,1,'Waiting at arrival never bounces back');close(walker.position.y,target.at[1]);
 // Even moving back into the arrival oval cannot rearm until the cat first leaves it.
 const other=source===park?portal:park;walker.place(new T.Vector3(other.x+.5,other.floor,other.z));travel.step(walker.position,true,go);assert.equal(trips,1);
 walker.place(new T.Vector3(other.x+3,other.floor,other.z));travel.step(walker.position,true,go);
 walker.place(new T.Vector3(other.x+.5,other.floor,other.z));
 assert(hydroPortalContains(other,walker.position));
 travel.step(walker.position,false,()=>assert.fail('Disabled controls must not travel'));
 travel.step(walker.position,true,dest=>{assert.deepEqual(dest.at,source===park?parkArrival.at:arrival.at);trips++;return true;});assert.equal(trips,2,'Leaving and re-entering allows the return trip');
}
// Deck 2 keeps the actual glass wall and engine housing intact behind the fitting.
const cargoRoom=layout.rooms.find(r=>r.id==='d02-maintenance-aft'),cargoRoot=new T.Group(),cargoStructure=new T.Group(),cargoDeck=layout.decks[1];cargoRoot.add(cargoStructure);
buildRoomShell({root:cargoRoot,inside:cargoRoot,cutaway:new Set()},cargoRoom,cargoStructure);
const housingPart=phase4Programme(layout).parts.find(p=>p.room===cargoRoom.id&&p.part==='mission_engine_housing');assert(housingPart,'Existing dark backing panel');
const housing=new T.Mesh(fitoutGeometry(housingPart),new T.MeshBasicMaterial());housing.name='P4_mission_engine_housing';housing.position.set(...housingPart.at);cargoRoot.add(housing);
const cargoFloor=new T.Mesh(polygonGeometry(cargoDeck.slab.outline,cargoDeck.slab.holes.map(h=>h.polygon),cargoDeck.y,.12),new T.MeshBasicMaterial());cargoFloor.name='Deck_slab';cargoRoot.add(cargoFloor);cargoRoot.updateMatrixWorld(true);
const glassHit=new T.Raycaster(new T.Vector3(-148.59,cargo.floor+1.5,-.30),new T.Vector3(-1,0,0)).intersectObject(cargoStructure,true)[0];
assert(glassHit&&glassHit.object.name==='V2_glass_wall','Reported approach faces the retained glass partition');
close(cargo.x-glassHit.point.x,.04);close(cargo.floor,cargoDeck.y);close(cargo.z,housingPart.at[2]);
close(cargo.x,-153.91);close(cargo.z,0);
const backing=new T.Box3().setFromObject(housing);
assert(cargo.x>backing.max.x,'Portal faces the visitor outside the backing and glass');
assert(cargo.y-cargo.height*.54>backing.min.y&&cargo.y+cargo.height*.54<backing.max.y,'Oval and halo clear the panel top and sill');
assert(cargo.z-cargo.width*.54>backing.min.z&&cargo.z+cargo.width*.54<backing.max.z,'Oval and halo fit the dark panel width');
const cargoEffect=createHydroPortal(cargo);assert.equal(cargoEffect.group.name,'Hydro_Portal_Cargo');assert.equal(cargoEffect.group.userData.room,'circulation-2');
assert(cargoEffect.group.userData.noCollide);assert.equal(cargoEffect.group.material.fragmentShader,parkEffect.group.material.fragmentShader);close(cargoEffect.group.rotation.y,Math.PI/2);
close(cargoEffect.group.position.x,cargo.x);close(cargoEffect.group.position.y,cargo.y);close(cargoEffect.group.position.z,cargo.z);
assert.equal(cargoEffect.arrival,arrival);assert.equal(HYDRO_PORTAL_LINKS.length,3);
const promptPoint=new T.Vector3(cargo.x+2.1,cargo.floor,-.30),cargoPrompt=cargoEffect.prompt(promptPoint);
assert.equal(cargoPrompt?.label,'Walk into Hydro-Portal to Hydro-Nip Lounge');assert(cargoPrompt.passive,'Walk-in instructions do not advertise a use key');
assert(!hydroPortalContains(cargo,promptPoint),'Prompt appears before the travel region');
for(const at of [[-148.59,cargo.floor,-.30],[cargo.x-.2,cargo.floor,0],[cargo.x+2,cargo.floor+4,0],arrival.at])assert.equal(cargoEffect.prompt(new T.Vector3(...at)),null,'No cargo prompt away from its approach');
assert.equal(effect.prompt(new T.Vector3(portal.x+2,portal.floor,portal.z)),null);assert.equal(parkEffect.prompt(new T.Vector3(park.x+2,park.floor,park.z)),null);
assert.equal(HYDRO_PORTAL_LINKS.find(l=>l.portal===cargo).arrival,arrival);
assert(!HYDRO_PORTAL_LINKS.some(l=>l.arrival.at[1]===cargo.floor),'No exit returns to Deck 2');
col.addStatic(cargoRoot);col.commit();ground.addStatic(cargoRoot,o=>solid(o)&&groundMesh(o));ground.commit();
const cargoTravel=createHydroPortalTravel();let cargoTrips=0,cargoPromptSeen=false;walker.place(new T.Vector3(-148.59,cargo.floor,-.30));
const cargoGo=dest=>{assert.deepEqual(dest.at,arrival.at);assert.equal(dest.yaw,arrival.yaw*Math.PI/180);assert(dest.resolved);walker.place(new T.Vector3(...dest.at));cargoTrips++;return true;};
for(let i=0;i<360&&!cargoTrips;i++){walker.step(1/120,wish.set(-2.25,0,0));if(!hydroPortalContains(cargo,walker.position)&&cargoEffect.prompt(walker.position))cargoPromptSeen=true;cargoTravel.step(walker.position,true,cargoGo);}
assert(cargoPromptSeen,'Walking from the reported spot shows instructions before travel');
assert.equal(cargoTrips,1,'Walk from the reported Deck 2 spot enters the lounge');close(walker.position.y,arrival.at[1]);
for(let i=0;i<120;i++){walker.step(1/120,wish.set(0,0,0));cargoTravel.step(walker.position,true,cargoGo);}
assert.equal(cargoTrips,1,'Cargo arrival does not bounce back');
run([2.25*Math.sin(arrival.yaw*Math.PI/180),0,2.25*Math.cos(arrival.yaw*Math.PI/180)],2);assert(walker.position.distanceTo(new T.Vector3(...arrival.at))>3,'Cargo visitor can leave the lounge landing');
// Pass close beside the oval in both directions, without entering its walk-in region.
walker.place(new T.Vector3(cargo.x+.86,cargo.floor,-3));
for(const dir of [1,-1]){const start=walker.position.clone();run([0,0,dir*2.25],2.7);assert(dir*(walker.position.z-start.z)>5.5,'Walk along the glass past the portal: '+start.toArray()+' -> '+walker.position.toArray());close(walker.position.x,start.x);close(walker.position.y,cargo.floor);assert(!hydroPortalContains(cargo,walker.position));}
walker.place(new T.Vector3(-148.59,cargo.floor,3.5));run([-2.25,0,0],3);assert(walker.position.x>glassHit.point.x,'Glass still blocks walking through beside the portal');
const blocked=walker.position.clone();run([-2.25,0,0],1);assert(walker.position.distanceTo(blocked)<.02,'Retained partition stays solid');
for(const suffix of ['','.public','.prepared','.authoring']){
 const main=readFileSync(new URL(`../src/walk/main${suffix}.js`,import.meta.url),'utf8');
 assert(main.includes('hydroParkPortal=createHydroPortal(HYDRO_PARK_PORTAL)'));
 assert(main.includes('hydroCargoPortal=createHydroPortal(HYDRO_CARGO_PORTAL);toBand(hydroCargoPortal.group,HYDRO_CARGO_PORTAL.floor)'),'Every walk draws the Deck 2 entry in its own band');
 assert(main.includes('hydroCargoPortal?.update(dt,p,ambience.on,camera)'),'Every walk animates and spatializes the Deck 2 entry');
 assert(main.includes('const hydro=inBall?null:hydroCargoPortal?.prompt(p);if(hydro)return hydro;'),'Every walk supplies the Deck 2 approach prompt to the HUD');
 assert(main.includes("const waiting=t?.kind==='waiting'||!!t?.passive;")&&main.includes('prompt.hidden=!show||touch&&!t?.passive;')&&main.includes("$('use').hidden=!show||!!t?.passive;"),'Walk-in instructions are visible on desktop and touch without a use button');
 assert(main.includes('hydroTravel.step(p,canHook&&input.enabled&&!playing()&&controller.grounded,goTo)'),'Uses the regular Go-to teleport before pose and room updates');
 assert(main.indexOf('hydroTravel.step(')<main.indexOf('live?.pose(myPose('));
}
console.log('PASS Hydro-Portal: Deck 2 approach prompt and entry-only travel, intact glass/panel fit and pass-by clearance, paired park travel, arrival guard, 3 m departures, lounge camera, shared animated oval and spatial warp');
