import fs from 'node:fs/promises';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {load} from './fast-glb-read.mjs';
import {legacyRoomIds,buildLegacyRoom} from '../src/v2/legacy-room.js';
import layout from '../src/plan/selected-layout.js';

// Compare actual retained raw-model geometry against the isolated producer.
// This is deliberately separate from browser/prepared-world acceptance.
const base=await load('output/leo-interior-v02/fast-base/leo-service-areas.glb'),file='output/fast-deploy/legacy-audit-room.glb',evidence=[];
globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
function meshes(model,id){
 const result=new Map(),v=new T.Vector3();
 for(const [key,{n,world}]of model.nodes){
  const attrs=n.extensions?.EXT_mesh_gpu_instancing?.attributes,owned=key.includes('/Area_'+id+'#')||key.includes('/V2_shell_'+id+'#');
  const instances=attrs?(n.extras?.roomIds||[]).map((room,i)=>room===id?i:null).filter(i=>i!==null):owned?[null]:[];
  const rows=[];for(const instance of instances){const matrix=world.clone();if(instance!==null){const get=(name,size,defaults)=>attrs[name]===undefined?defaults:Array.from(model.array(attrs[name]).subarray(instance*size,(instance+1)*size));matrix.multiply(new T.Matrix4().compose(new T.Vector3(...get('TRANSLATION',3,[0,0,0])),new T.Quaternion(...get('ROTATION',4,[0,0,0,1])),new T.Vector3(...get('SCALE',3,[1,1,1]))));}
   for(const p of model.j.meshes[n.mesh].primitives){const pos=model.array(p.attributes.POSITION),ix=p.indices===undefined?null:model.array(p.indices),count=ix?.length??pos.length/3;
    for(let i=0;i<count;i+=3){const tri=[];for(let k=0;k<3;k++){const at=(ix?ix[i+k]:i+k)*3;v.set(pos[at],pos[at+1],pos[at+2]).applyMatrix4(matrix);tri.push(v.toArray().map(x=>Math.round(x*1000)/1000));}rows.push([tri,tri.slice(1).concat(tri.slice(0,1)),tri.slice(2).concat(tri.slice(0,2))].map(JSON.stringify).sort()[0]);}
   }
  }
  if(rows.length){const list=result.get(n.name)||[];list.push(...rows);result.set(n.name,list);}
 }
 for(const rows of result.values())rows.sort();return result;
}
function surfaceDelta(a,b){
 if(!a?.length||!b?.length)return Infinity;
 const build=rows=>{const triangles=rows.map(s=>JSON.parse(s)),positions=Float32Array.from(triangles.flat(2)),geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3));return {triangles,geometry,bvh:new MeshBVH(geometry,{indirect:true})};};
 const A=build(a),B=build(b);let delta=0;
 const probe=(left,right)=>{for(const tri of left.triangles){const samples=[...tri,...tri.map((p,i)=>p.map((v,k)=>(v+tri[(i+1)%3][k])/2)),tri[0].map((v,k)=>(v+tri[1][k]+tri[2][k])/3)];for(const p of samples){const hit=right.bvh.closestPointToPoint(new T.Vector3(...p));delta=Math.max(delta,hit?.distance??Infinity);if(delta>.002)return;}}};
 probe(A,B);if(delta<=.002)probe(B,A);A.geometry.dispose();B.geometry.dispose();return delta;
}
for(const id of legacyRoomIds(layout)){
 const root=new T.Group();root.name='audit';root.add(buildLegacyRoom(id,layout).root);
 await fs.writeFile(file,Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true})));
 const actual=meshes(base,id),isolated=meshes(await load(file),id),differences=[];
 for(const name of new Set([...actual.keys(),...isolated.keys()]))if(JSON.stringify(actual.get(name))!==JSON.stringify(isolated.get(name))){const delta=surfaceDelta(actual.get(name),isolated.get(name));if(delta>.002)differences.push({name,baseTriangles:actual.get(name)?.length||0,isolatedTriangles:isolated.get(name)?.length||0,surfaceDelta:delta});}
 evidence.push({id,status:differences.length?'DIFFERENCES':'PASS',sourceStatus:differences.some(r=>r.name!=='V2_glass_wall')?'DIFFERENCES':'PASS',baseMeshes:actual.size,isolatedMeshes:isolated.size,differences});
 console.log(id,differences.length?'DIFFERENCES '+differences.map(r=>r.name).join(','):'PASS');
}
await fs.writeFile('output/fast-deploy/legacy-coverage-audit.json',JSON.stringify({method:'Retained clean raw service model versus isolated current room: mesh name and oriented world triangles rounded to 1 mm; changed tessellation additionally checks vertices, edge midpoints and centroids against both surfaces within 2 mm. Material, prepared collision, visual acceptance and live interactions are not covered.',rooms:evidence},null,2));
