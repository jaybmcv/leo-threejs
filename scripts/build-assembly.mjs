import {createAft} from '../src/aft.js';
import {prepareCrownExterior} from '../src/fin-crown.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createShip,createResidentialDeck,createGardenCommons,createObservationArea} from '../src/model.js';
import {SHIP_AREAS,createShipArea} from '../src/areas.js';
import {createServiceCirculation} from '../src/service-circulation.js';
import {createSpecialCirculation} from '../src/special-circulation.js';
import {createTransit} from '../src/transit.js';
const out='output/leo-interior-v01/';
const exteriorBytes=await fs.readFile(out+'leo-exterior.glb'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const accepted='8971e14e0e72951880811b8a7e4f3e57310a733a9d990ba3a2ae2eec4ebabfee';assert.equal(sha(exteriorBytes),accepted);
globalThis.ProgressEvent=class{constructor(type,init){this.type=type;Object.assign(this,init);}};
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const refinedBytes=await fs.readFile(out+'leo-exterior-refined.glb');
const gltf=await new GLTFLoader().parseAsync(refinedBytes.buffer.slice(refinedBytes.byteOffset,refinedBytes.byteOffset+refinedBytes.byteLength),'');
gltf.scene.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)o.name=gltf.parser.json.nodes[a.nodes].name||o.name;});
gltf.scene.updateMatrixWorld(true);gltf.scene.getObjectByName('Fin_panorama_lounge')?.removeFromParent();
const source=createShip({deferExterior:true}),root=new Group(),inside=new Group();root.name='LEO_COMPLETE_FITTED_SHIP';inside.name='Fitted_ship_interior';root.add(gltf.scene,inside);
for(const deck of source.decks){const slab=deck.getObjectByName('Deck_slab');if(slab)inside.add(slab);}
for(let n=1;n<=10;n++){inside.add(createResidentialDeck(n,source.detail).root,createGardenCommons(n,source.detail).root);}
for(const area of SHIP_AREAS)inside.add(createShipArea(area).root);
for(const d of new Set(SHIP_AREAS.map(a=>a.deck)))for(const c of [createServiceCirculation(d),createSpecialCirculation(d)])if(c)inside.add(c.root);
inside.add(createAft().root);
const transit=createTransit();inside.add(transit.root,createObservationArea(source.detail).root);
// Adjacent floor finishes share edges; inset the transit finish 6 mm where it laps
// the existing corridor finishes to avoid coplanar faces in the combined model.
transit.root.traverse(o=>{if(o.userData.transitUnion)o.position.y=-.006;});
root.userData={units:'metres',length:564,span:300,cabins:5000,berths:10000,gardens:10,areas:68,aftSystems:'Aft pass 03: enclosed machinery, refined crown bar and guided journey',liftShafts:6,stairTowers:5,mainTransitLiftShafts:4,mainTransitStairTowers:4,lifeboats:100,lifeboatSeats:10000,shuttles:4,sourceExteriorSHA256:accepted,exteriorChanges:'V35 engine-maintenance, upper-deck, aft-gallery, fin and passenger window apertures, supplied mission emblem, refined finishes and glazed fin crown',stage:'Furnished main ship with enclosed aft machinery and fin crown lounge'};
root.traverse(o=>{if(o.isMesh)o.geometry.normalizeNormals();});
const exporter=new GLTFExporter();
for(const [name,model]of [['leo-transit',transit.root],['leo-full-ship',root]]){const b=await exporter.parseAsync(model,{binary:true,onlyVisible:true});await fs.writeFile(out+name+'.glb',Buffer.from(b));console.log(name,(b.byteLength/1048576).toFixed(2)+' MB');}
assert.equal(sha(await fs.readFile(out+'leo-exterior.glb')),accepted);
await fs.writeFile(out+'transit-network.json',JSON.stringify(transit.graph,null,2));
await fs.writeFile(out+'assembly-manifest.json',JSON.stringify({...root.userData,structuralDecks:20,containsReservationBoxes:false,source:'Current fitted component factories and retained exterior GLB'},null,2));
console.log('Accepted exterior unchanged; all fitted sources assembled.');

