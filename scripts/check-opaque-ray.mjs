import assert from 'node:assert/strict';import * as T from 'three';import {MeshBVH} from 'three-mesh-bvh';import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';import {opaqueRayHit} from '../src/v2/opaque-ray.js';
let seed=73692;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);let checks=0;
for(const indirect of [false,true]){
 const geometry=mergeGeometries(Array.from({length:16},(_,i)=>new T.BoxGeometry(2+(i%3),3,.04).translate((i%4-1.5)*3,0,Math.floor(i/4)*3)));
 const bvh=new MeshBVH(geometry,{indirect}),p=geometry.attributes.position,ix=geometry.index,count=ix.count/3;
 bvh.leoWindowFlags=Uint8Array.from({length:count},(_,i)=>Number(p.getZ(ix.getX(i*3))<5));
 for(let i=0;i<4000;i++){
  const ray=new T.Ray(new T.Vector3((random()-.5)*20,(random()-.5)*6,(random()-.5)*25),new T.Vector3(random()-.5,random()-.5,random()-.5).normalize()),near=i%4===0?0:.05,far=i%5===0?2:30;
  const expected=bvh.raycast(ray,T.DoubleSide,near,far).some(h=>!bvh.leoWindowFlags[h.faceIndex]);assert.equal(opaqueRayHit(bvh,ray,near,far),expected,'seeded ray '+i+' indirect '+indirect);checks++;
 }
 for(const direction of [1,-1])for(const x of [-5,-1.5,1.5,5]){const ray=new T.Ray(new T.Vector3(x,0,direction>0?-3:12),new T.Vector3(0,0,direction));for(const hit of bvh.raycast(ray,T.DoubleSide,0,30))for(const far of [hit.distance-1e-10,hit.distance,hit.distance+1e-10]){assert.equal(opaqueRayHit(bvh,ray,0,far),bvh.raycast(ray,T.DoubleSide,0,far).some(h=>!bvh.leoWindowFlags[h.faceIndex]));checks++;}}
 bvh.leoWindowFlags.fill(1);assert.equal(opaqueRayHit(bvh,new T.Ray(new T.Vector3(1.5,0,-3),new T.Vector3(0,0,1)),0,30),false);checks++;
 geometry.dispose();
}
console.log('PASS opaque ray parity:',checks,'direct/indirect, glass, opaque, reversed rays and inclusive range boundaries');
