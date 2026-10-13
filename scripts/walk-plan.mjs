import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createShip} from '../src/model.js';
import {shapeInterior} from '../src/concept-shape.js';
import {buildAll} from '../src/walk/world.js';
import {planPartitions} from '../src/walk/partitions.js';

// The walk world in Node, exactly as the walk page builds it: the saved web exterior (concept passes baked in), every
// deck fitted, and the deck plates faired to the hull. Shared by the page build (the partition plan) and check-walk.
globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
export async function loadWalkShip(exteriorPath='output/leo-interior-v01/leo-exterior-web.glb'){
 await MeshoptDecoder.ready;
 const bytes=await fs.readFile(exteriorPath);
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 gltf.scene.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)o.name=gltf.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh&&a?.meshes!==undefined)o.name=o.parent.name;});
 const exterior=gltf.scene.getObjectByName('01_EXTERIOR_REFINED_V31');if(!exterior)throw new Error('The saved exterior is missing its root');
 const ship=createShip({deferExterior:true});ship.root.remove(ship.exterior);ship.root.add(exterior);ship.exterior=exterior;
 buildAll(ship);shapeInterior(ship.exterior,ship.inside);
 return ship;
}
// The partition plan in the compact form the page bundles: [deck,x0,x1,z0,z1,y0,y1] rows, millimetre precision.
export const compactPlan=walls=>walls.map(w=>[w.deck,w.x0,w.x1,w.z0,w.z1,w.y0,w.y1].map(v=>Math.round(v*1000)/1000));
export async function planWalk(ship){return compactPlan(planPartitions(ship||await loadWalkShip()));}
