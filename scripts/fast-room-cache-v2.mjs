import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createCanvas} from '@napi-rs/canvas';
import layout from '../src/plan/selected-layout.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {buildPhase4Fitout,addPhase4Colliders} from '../src/v2/phase4-fitout.js';
import {onePassAtriumGlass} from '../src/v2/atrium-visibility.js';
import {Colliders} from '../src/walk/collision.js';
import {PreparedWriter} from '../src/v2/prepared-codec.js';
import {solidSpots} from '../src/walk/rest.js';
import {compileLegacyRoom} from './legacy-room-data-v2.mjs';
import {hash} from './prepared-patch-v2.mjs';

const directory='output/leo-interior-v02/fast-room-cache';
export async function cachedRoom({id,key,legacy=false,shell=false}){
 const dir=directory+'/'+hash(Buffer.from(key)),file=dir+'/record.json';
 try{
  const metadata=await fs.readFile(file),complete=JSON.parse(await fs.readFile(dir+'/complete.json','utf8'));if(complete.recordHash!==hash(metadata))throw Error('Room cache metadata checksum mismatch');
  const record=JSON.parse(metadata);if(record.version!==2)throw Error('Room cache format changed');const bytes=await fs.readFile(dir+'/arrays.bin'),model=await fs.readFile(dir+'/room.glb');
  if(record.key!==key||record.arraysHash!==hash(bytes)||record.modelHash!==hash(model))throw Error('Room cache checksum mismatch');
  record.writer.arrays=record.arrays.map(r=>{const b=Uint8Array.from(bytes.subarray(r.offset,r.offset+r.bytes));return new globalThis[r.type](b.buffer);});
  return {...record,model,hit:true};
 }catch(e){if(e.code!=='ENOENT')console.log('Rebuilding room cache '+id+': '+e.message);}
 installWalkCanvas(createCanvas);
 const writer=new PreparedWriter(),ship={inside:new T.Group()},fit=buildPhase4Fitout(ship,layout,{rooms:[id]}),roots=[...fit.roots];
 for(const root of roots)onePassAtriumGlass(root);
 const col=new Colliders(),ground=new Colliders();addPhase4Colliders(ship,col,ground);
 const graphs=roots.map(root=>writer.graph(root)),bands=[],collision=writer.colliders(col),groundCollision=writer.colliders(ground),rests=fit.rests.map(s=>({...s,point:new T.Vector3(...s.point),...(s.facing?{facing:new T.Vector3(...s.facing)}:{}),...(s.head?{head:new T.Vector3(...s.head)}:{})})),seats=solidSpots(rests,col);
 // Absorb the room's legacy meshes in the same local resource table. No ship
 // hierarchy or shared vertex pool needs to be instantiated.
 if(legacy||shell){
  const compiled=compileLegacyRoom(id,{replaceSource:legacy,replaceShell:shell});
  const {PreparedPatch}=await import('./prepared-patch-v2.mjs');
  const local={arrays:[],geometries:writer.geometries,materials:writer.materials,textures:[],images:[],parts:[]};
  // First writer records already use these offsets; absorb only the legacy table.
  local.arrays=writer.arrays.map(()=>({}));const patch=new PreparedPatch(local),relocate=patch.absorb(compiled.writer);
  writer.arrays.push(...compiled.writer.arrays);writer.meta.textures={...writer.meta.textures,...compiled.writer.meta.textures};writer.meta.images={...writer.meta.images,...compiled.writer.meta.images};
  graphs.push(...compiled.graphs.map(relocate.graph));
  bands.push(...compiled.bands.map(([key,graph])=>[key,relocate.graph(graph)]));
  const c=relocate.colliders(compiled.collision),g=relocate.colliders(compiled.groundCollision);
  collision.groups.push(...c.groups);groundCollision.groups.push(...g.groups);rests.push(...compiled.rests);seats.push(...compiled.seats);roots.push(compiled.root);
 }
 globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
 const root=new T.Group();root.name='Fast_room_'+id;root.userData.fastRoom=id;for(const group of roots)root.add(group);
 const model=Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true}));
 const arrays=[],buffers=[];let offset=0;for(const a of writer.arrays){const bytes=Buffer.from(a.buffer,a.byteOffset,a.byteLength);arrays.push({type:a.constructor.name,offset,bytes:bytes.length});buffers.push(bytes);offset+=bytes.length;}
 const bytes=Buffer.concat(buffers),record={version:2,key,id,legacy,shell,arrays,arraysHash:hash(bytes),modelHash:hash(model),
  writer:{geometries:writer.geometries,materials:writer.materials,meta:writer.meta},graphs,bands,collision,groundCollision,rests:writer.value(rests),seatIndices:rests.map((s,i)=>seats.includes(s)?i:null).filter(i=>i!==null)};
 await fs.mkdir(dir,{recursive:true});const suffix='.'+process.pid+'.tmp',metadata=JSON.stringify(record);
 for(const [name,data]of [['arrays.bin',bytes],['room.glb',model],['record.json',metadata],['complete.json',JSON.stringify({recordHash:hash(Buffer.from(metadata))})]]){await fs.writeFile(dir+'/'+name+suffix,data);await fs.rename(dir+'/'+name+suffix,dir+'/'+name);}
 return {...record,writer:{...record.writer,arrays:writer.arrays},model,hit:false};
}
