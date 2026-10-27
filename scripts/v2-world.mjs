import fs from 'node:fs/promises';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createShip} from '../src/model.js';
import {deferRoomFrames} from '../src/plan/rooms.js';
import {buildAll} from '../src/walk/world.js';
import {prepareWalkWorld} from '../src/walk/prepare.js';
import {STATIC_LIFT_PARTS} from '../src/walk/lifts.js';
import {rasterDecks} from '../src/walk/partitions.js';
import {planRails,railingMesh} from '../src/walk/railings.js';
import {planMap,MAP} from '../src/walk/deck-map.js';
installWalkCanvas(createCanvas);
globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
export async function loadV2(){
 await MeshoptDecoder.ready;const data=await fs.readFile('output/leo-interior-v02/leo-exterior-web.glb');const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
 gltf.scene.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)o.name=gltf.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh&&a?.meshes!==undefined)o.name=o.parent.name;});
 const exterior=gltf.scene.getObjectByName('01_EXTERIOR_REFINED_V31');deferRoomFrames();const ship=createShip({deferExterior:true,lazyInterior:true});ship.root.remove(ship.exterior);ship.root.add(exterior);ship.exterior=exterior;buildAll(ship);
 ship.root.traverse(o=>{if(STATIC_LIFT_PARTS.test(o.name))o.visible=false;});return ship;
}
export async function preparedV2({map=false}={}){
 const ship=await loadV2();console.log('v2 geometry built');const prepared=prepareWalkWorld(ship);console.log('v2 prepared',prepared.colliders.triangles);let plan={walls:[],rails:[],windows:[]},image;
 if(!map){plan=JSON.parse(await fs.readFile('output/leo-interior-v02/walk-plan.json','utf8'));const rails=railingMesh(plan.rails);ship.inside.add(rails);prepared.colliders.addStatic(rails);prepared.colliders.commit();}
 if(map){const decks=rasterDecks(ship);for(const d of decks)for(let k=0;k<d.plate.length;k++)if(d.plate[k]&&!d.designed[k]){d.designed[k]=1;d.height[k]=d.y;}const rails=planRails(decks,prepared.colliders);console.log('v2 rails',rails.length);const railings=railingMesh(rails);ship.inside.add(railings);prepared.colliders.addStatic(railings);prepared.colliders.commit();plan.rails=rails;
 const maps=planMap(ship,decks,rails),c=createCanvas(MAP.nx,MAP.nz*maps.length),ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);let i=0;for(const d of maps)for(const v of d.data){pixels.data[i++]=v*50;pixels.data[i++]=v*50;pixels.data[i++]=v*50;pixels.data[i++]=255;}ctx.putImageData(pixels,0,0);image=c.toBuffer('image/png');
 }return {ship,prepared,plan,image};
}
