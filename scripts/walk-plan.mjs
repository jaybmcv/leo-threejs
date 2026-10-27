import fs from 'node:fs/promises';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {prepareWalkWorld} from '../src/walk/prepare.js';
installWalkCanvas(createCanvas);
import zlib from 'node:zlib';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createShip} from '../src/model.js';
import {deferRoomFrames} from '../src/plan/rooms.js';
import {shapeInterior} from '../src/concept-shape.js';
import {buildAll,buildColliders,prepareExteriorForWalking} from '../src/walk/world.js';
import {solid} from '../src/walk/collision.js';
import {STATIC_LIFT_PARTS} from '../src/walk/lifts.js';
import {rasterDecks,planPartitions,partitionMesh} from '../src/walk/partitions.js';
import {planRails,railingMesh} from '../src/walk/railings.js';
import {planMap,MAP} from '../src/walk/deck-map.js';
import {planWindows} from '../src/walk/windows.js';
import {createFinCasing} from '../src/walk/fin-casing.js';

// The walk world in Node, exactly as the walk page builds it: the saved web exterior (concept passes baked in), every
// deck fitted, and the deck plates faired to the hull. Shared by the page build (the partition plan) and check-walk.
globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
export async function loadWalkShip(exteriorPath='output/leo-interior-v01/leo-exterior-web.glb'){
 await MeshoptDecoder.ready;
 const bytes=await fs.readFile(exteriorPath);
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 gltf.scene.traverse(o=>{const a=gltf.parser.associations.get(o);if(a?.nodes!==undefined)o.name=gltf.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh&&a?.meshes!==undefined)o.name=o.parent.name;});
 const exterior=gltf.scene.getObjectByName('01_EXTERIOR_REFINED_V31');if(!exterior)throw new Error('The saved exterior is missing its root');
 deferRoomFrames();const ship=createShip({deferExterior:true});ship.root.remove(ship.exterior);ship.root.add(exterior);ship.exterior=exterior;
 buildAll(ship);shapeInterior(ship.exterior,ship.inside);
 return ship;
}
// Fit a loaded ship for walking as the page does (main.js buildShip): partitions in, static lift parts out, the
// exterior trimmed, the colliders built; then the railings, which ask the colliders where the floor drops. With a
// saved `plan` the partitions and railings are taken from it instead of planned.
export function fitForWalking(ship,plan,{beforePreparation=null}={}){
 const decks=plan?null:rasterDecks(ship),walls=plan?plan.walls.map(([deck,x0,x1,z0,z1,y0,y1])=>({deck,x0,x1,z0,z1,y0,y1})):planPartitions(ship,decks);
 ship.inside.add(partitionMesh(walls));
 ship.inside.add(createFinCasing());
 ship.root.traverse(o=>{if(STATIC_LIFT_PARTS.test(o.name))o.visible=false;});
 const dropped=prepareExteriorForWalking(ship);
 let colliders=buildColliders(ship,{extra:[ship.exterior],filter:o=>solid(o)&&!STATIC_LIFT_PARTS.test(o.name)});
 const rails=plan?plan.rails:planRails(decks,colliders);
 // The railings are solid too: the colliders are built again with them in.
 const railings=railingMesh(rails);ship.inside.add(railings);
 beforePreparation?.({decks,walls,rails});
 const prepared=prepareWalkWorld(ship,{exteriorPrepared:true});colliders=prepared.colliders;
 return {decks,walls,rails,colliders,dropped,prepared};
}
// The plan in the compact form the page bundles: partition rows [deck,x0,x1,z0,z1,y0,y1], railing rows
// [deck,axis,a0,a1,at,y] (millimetre precision) and the window cuts in the hull envelope (windows.js).
export const compactPlan=walls=>walls.map(w=>[w.deck,w.x0,w.x1,w.z0,w.z1,w.y0,w.y1].map(v=>Math.round(v*1000)/1000));
// {plan, map}: the plan to bundle and the ship map as a PNG (each deck a band of MAP.nz rows, Deck 1 at the top).
export async function planWalk(ship){
 ship||=await loadWalkShip();
 const windows=planWindows(ship);
 // Preserve the accepted map stage: browser-only furniture replacements must not redraw today's map.
 let map;const {decks,walls,rails}=fitForWalking(ship,undefined,{beforePreparation(state){map=planMap(ship,state.decks,state.rails);}});
 return {plan:{walls:compactPlan(walls),rails,windows},map:png(MAP.nx,MAP.nz*map.length,map.map(d=>d.data))};
}

// A greyscale PNG; each class is stored as class x 50 so a browser's decode never blurs one into another.
function png(width,height,bands){
 const raw=Buffer.alloc((width+1)*height);let row=0;
 for(const band of bands)for(let j=0;j<band.length/width;j++,row++){raw[row*(width+1)]=0;for(let i=0;i<width;i++)raw[row*(width+1)+1+i]=band[j*width+i]*50;}
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const body=Buffer.concat([Buffer.from(type),data]);const sum=Buffer.alloc(4);sum.writeUInt32BE(crc(body));return Buffer.concat([len,body,sum]);};
 const head=Buffer.alloc(13);head.writeUInt32BE(width,0);head.writeUInt32BE(height,4);head[8]=8;head[9]=0;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
