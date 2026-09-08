import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Vector3,Raycaster} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createNoseCommons,NOSE_COMMONS} from '../src/nose-commons.js';
import {insideHull,logicalX} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
const roofCache=new Map(),roof=(x,z)=>{const k=x.toFixed(4)+','+z.toFixed(4);if(!roofCache.has(k))roofCache.set(k,finishedRoofY(logicalX(x),z));return roofCache.get(k);};
const ray=new Raycaster(),v=new Vector3(),up=new Vector3(0,1,0),down=new Vector3(0,-1,0),evidence=[];
let vertices=0,routeChecks=0;
for(const a of NOSE_COMMONS){
 const room=createNoseCommons(a.number),{y,end}=room.plan;room.root.updateMatrixWorld(true);const meshes=[];
 room.root.traverse(o=>{if(!o.isMesh)return;meshes.push(o);const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);vertices++;
  assert(insideHull(v.x,v.y,v.z,2.5),'N'+a.number+' '+o.name+' outside hull '+v.toArray());
  assert(v.y<=roof(v.x,v.z)+.001,'N'+a.number+' '+o.name+' above finished roof '+v.toArray());
  assert(v.y>=y-.025&&v.y<=y+3.55,'N'+a.number+' '+o.name+' outside deck height '+v.toArray());
 }});
 // Check the full-width approach/spine, including a standing person's headroom,
 // plus floor support at metre intervals. This catches fittings blocking access.
 for(const z of [-1.8,0,1.8])for(let x=134.2;x<end-.5;x+=1){
  ray.set(new Vector3(x,y+.03,z),up);ray.far=2.1;assert(!ray.intersectObjects(meshes)[0],'N'+a.number+' blocked spine '+[x,z]);
  ray.set(new Vector3(x,y+.15,z),down);ray.far=.2;assert(ray.intersectObjects(meshes).length,'N'+a.number+' missing floor '+[x,z]);routeChecks++;
 }
 const names=new Set(meshes.map(o=>o.name));
 const required={cafe:'Espresso_machine',library:'Book_spine',art:'Painting_canvas',family:'Soft_play_block',music:'Piano_key',games:'Chess_square',wellness:'Meditation_cushion',maker:'Enclosed_desktop_printer',kitchen:'Induction_hob',grove:'Botanical_sketchbook'};
 assert(names.has(required[a.kind]),'Missing defining activity '+a.kind);
 assert(room.root.userData.bays>=8,'Too few occupied bays');
 evidence.push({deck:a.deck,name:a.name,kind:a.kind,bays:room.root.userData.bays,forwardLimit:end,meshTypes:[...names].sort()});
}
assert.equal(new Set(evidence.map(e=>JSON.stringify(e.meshTypes))).size,10,'Layouts must differ in geometry, not just colour');
const saved=[];
for(const [filename,expected] of [['leo-residential-decks.glb',10],['leo-full-ship.glb',10],['leo-neighborhood.glb',1]]){
 const b=await fs.readFile('output/leo-interior-v01/'+filename),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');const rooms=[];
 g.scene.traverse(o=>{if(o.userData.noseCommons===true)rooms.push(o.userData);});assert.equal(rooms.length,expected,filename);
 assert.equal(new Set(rooms.map(r=>r.deck)).size,expected,filename+' duplicate decks');
 for(const r of rooms)assert.equal(r.kind,NOSE_COMMONS[r.number-1].kind);
 saved.push({filename,commons:rooms.length});
}
const result={status:'PASS',verticesChecked:vertices,clearanceAndFloorSamples:routeChecks,distinctLayouts:10,evidence,saved};
await fs.writeFile('output/leo-interior-v01/nose-commons-fit.json',JSON.stringify(result,null,2));console.log({...result,evidence:evidence.map(({meshTypes,...e})=>e)});
