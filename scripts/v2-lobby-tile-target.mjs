import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import layout from 'v2-layout';
import '../src/model.js';
import {createTransit} from '../src/transit.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {finishLiftLobbyFloor} from '../src/walk/lift-tile-floor.js';
import {finishLiftLobbyFloor as authoringLobby} from '../src/walk/lift-tile-floor.authoring.js';
import {applyPublicFinishKit} from '../src/v2/finish-kit.js';
import {applyPublicFinishKit as authoringKit} from '../src/v2/finish-kit.authoring.js';
import {addPhase6Architecture} from '../src/v2/atrium-architecture.js';
import {addPhase6Architecture as authoringArchitecture} from '../src/v2/atrium-architecture.authoring.js';
import {separateAtriumPaving} from '../src/v2/facade.js';
import {floor,mesh,polygonGeometry} from '../src/v2/geometry.js';
import {solid} from '../src/walk/collision.js';
import {bakeForWalking} from '../src/walk/render-bake.js';
import {bakeForWalking as authoringBake} from '../src/walk/render-bake.authoring.js';
import {auditAtriumVoid} from './atrium-void-v2.mjs';
import {inflate} from './prepared-patch-v2.mjs';

installWalkCanvas(createCanvas);
const deck=layout.decks[18],y=deck.y,lobbyMaterial='V2_public_hex_floor';
const ray=new T.Raycaster(new T.Vector3(),new T.Vector3(0,-1,0),0,.18);
const hits=(objects,x,z,level=y)=>{
 ray.ray.origin.set(x,level+.1,z);
 return ray.intersectObjects(objects,false);
};
const near=(a,b)=>Math.abs(a-b)<.00002;
const floorPoints=[[-137.9,0],[-132,1.36],[-126,1.36],[-125.51,1.36],[-125.49,1.36],[-124.41,1.36],[-124.01,-3.99],[-124.01,3.99]];
const otherPoints=[[-132,1.36,y-4],[134,0,y],[134,0,y-4],[-132,6,y-4]];
for(const [finish,finishKit,architecture,bakeWalk] of [
 [finishLiftLobbyFloor,applyPublicFinishKit,addPhase6Architecture,bakeForWalking],
 [authoringLobby,authoringKit,authoringArchitecture,authoringBake],
]){
 const root=new T.Group(),transit=createTransit({minimumDeck:18,maximumDeck:19});
 const ship={root,inside:root,ensureTransit:()=>transit};
 root.add(transit.root);
 const rect=[[-149,-34],[-110,-34],[-110,12],[-149,12]];
 const slab=mesh(root,'Deck_slab',polygonGeometry(rect,deck.slab.holes.map(h=>h.polygon),y),floor);
 slab.userData.v2Deck=19;
 finishKit(ship,layout,{decks:[19]});
 const base=[slab],drawn=[];
 transit.root.traverse(o=>{if(o.name==='Connected_transit_floor'||o.name==='Lift_car_floor')base.push(o);});
 root.traverse(o=>{if(o.userData.publicFinish&&o.isMesh)drawn.push(o);});
 root.updateMatrixWorld(true);
 const untouched=otherPoints.map(p=>hits([...base,...drawn],...p).map(h=>h.object));
 assert(untouched.every(objects=>objects.length),'Other lift probes must hit existing floors');
 const carpetAt=[[-142,-28],[-144,-30.97]];
 const carpet=carpetAt.map(p=>hits(drawn,...p)[0]?.object);
 assert.deepEqual(carpet.map(o=>o?.material.name),['Lounge_walkway_black_velvet','Lounge_walkway_gold_transition']);

 const patch=finish(ship,layout);
 assert(patch&&patch.parent===root&&!solid(patch),'The hex extension is render-only');
 root.updateMatrixWorld(true);
 const hex=drawn.filter(o=>o.material.name===lobbyMaterial);
 assert.equal(patch.material,hex[0].material,'Match the adjoining paving material');
 for(const [x,z] of floorPoints){
  const surface=hits(base,x,z)[0],top=hits([...hex,patch],x,z)[0];
  assert(surface&&near(surface.point.y,y),'Existing ground stays at deck height at '+[x,z]);
  assert(top&&near(top.point.y,y+.002),'Hex paving reaches the edge without a new lip at '+[x,z]);
  assert(near(top.uv.x,x/.36)&&near(top.uv.y,z/(.36*1.7320508)),'Paving UVs line up at '+[x,z]);
 }
 for(const [x,z] of [[-123.99,1.36],[-122.01,0],[-124.41,4.01],[-124.41,-4.01]]){
  assert.equal(hits([...base,...hex,patch],x,z).length,0,'Existing atrium opening stays clear at '+[x,z]);
 }
 assert.deepEqual(otherPoints.map(p=>hits([...base,...drawn,patch],...p).map(h=>h.object)),untouched);
 assert.deepEqual(carpetAt.map(p=>hits([...drawn,patch],...p)[0]?.object),carpet);
 assert(!root.getObjectByName('Lift_lobby_tile_floor'),'The old diamond strip is absent');
 const facade=ship.facade=new T.Group();
 architecture(ship,facade,layout);
 assert(patch.visible,'The atrium facade must leave the hex finish for the walk bake');
 const baked=bakeWalk(root);
 separateAtriumPaving(ship);
 facade.updateMatrixWorld(true);
 const rendered=[...facade.children];
 for(const band of baked.bands.values()){
  band.updateMatrixWorld(true);
  rendered.push(...band.children);
 }
 for(const [x,z] of floorPoints){
  const top=hits(rendered,x,z)[0];
  assert.equal(top?.object.material.name,lobbyMaterial,'Walked hex paving draws above the transit copy at '+[x,z]);
  assert.equal(top.object.material.map,patch.material.map,'The walk band keeps the shared hex texture');
 }
 assert.equal(auditAtriumVoid(facade,layout).status,'PASS');
}

// With a full build present, verify its serialized draw band contains the same textured strip.
const prepared='output/leo-interior-v02/prepared-walk';
const integrity=await fs.readFile(prepared+'/integrity.json','utf8').catch(e=>{
 if(e.code!=='ENOENT')throw e;
 return null;
});
if(integrity){
 const name=JSON.parse(integrity).files.find(n=>/^world\.(bin|json\.gz)$/.test(n));
 assert(name,'Missing prepared walk metadata');
 const manifest=JSON.parse(inflate(await fs.readFile(prepared+'/'+name)));
 const rows=manifest.bands.flatMap(([,band])=>band.nodes.filter(n=>{
  const ranges=manifest.geometries[n.geometry]?.userData?.preparedRanges;
  return ranges?.some(r=>r.name==='Lift_lobby_hex_floor_finish');
 }));
 assert.equal(rows.length,1,'The built walk must save one draw for the hex strip');
 const material=manifest.materials[rows[0].material];
 assert(material?.name===lobbyMaterial&&material.map,'The saved lobby draw must use the textured public paving');
}

const old=new T.Group();
 mesh(old,'Lift_lobby_tile_floor',new T.PlaneGeometry(50,7.88).rotateX(-Math.PI/2).translate(-113,y+.007,0));
 assert.equal(auditAtriumVoid(old,layout).status,'FAIL','The former centre-route tile still fails the void audit');
await fs.mkdir('output/phase3/closeout',{recursive:true});
await fs.writeFile('output/phase3/closeout/lobby-tile-target.json',JSON.stringify({status:'PASS',deck:19,diamondTileRemoved:true,hexPaving:floorPoints,otherLiftsPreserved:true,carpetPreserved:true,collisionChange:false,oldCentreFinishRejected:true}));
console.log('PASS Deck 19 aft lobby hex paving reaches the existing edge; other lift floors, lounge carpet and atrium opening preserved');
