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
import {floor,mesh,polygonGeometry} from '../src/v2/geometry.js';
import {solid} from '../src/walk/collision.js';
import {auditAtriumVoid} from './atrium-void-v2.mjs';

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
for(const [finish,finishKit] of [[finishLiftLobbyFloor,applyPublicFinishKit],[authoringLobby,authoringKit]]){
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
 const facade=new T.Group();
 addPhase6Architecture(ship,facade,layout);
 facade.updateMatrixWorld(true);
 assert.equal(hits(facade.children,-124.41,1.36)[0]?.object.material.map,patch.material.map,'The atrium render copy keeps the hex pattern');
 assert.equal(auditAtriumVoid(facade,layout).status,'PASS');
}

const old=new T.Group();
 mesh(old,'Lift_lobby_tile_floor',new T.PlaneGeometry(50,7.88).rotateX(-Math.PI/2).translate(-113,y+.007,0));
 assert.equal(auditAtriumVoid(old,layout).status,'FAIL','The former centre-route tile still fails the void audit');
await fs.mkdir('output/phase3/closeout',{recursive:true});
await fs.writeFile('output/phase3/closeout/lobby-tile-target.json',JSON.stringify({status:'PASS',deck:19,diamondTileRemoved:true,hexPaving:floorPoints,otherLiftsPreserved:true,carpetPreserved:true,collisionChange:false,oldCentreFinishRejected:true}));
console.log('PASS Deck 19 aft lobby hex paving reaches the existing edge; other lift floors, lounge carpet and atrium opening preserved');
