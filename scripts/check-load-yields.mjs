// Loading work that gives the page turns (src/v2/yield-to-page.js) and the geometry compaction low-deck batching runs on
// (src/v2/facade.js compactRenderGeometry): same output as before, less waiting. Usage: node scripts/check-load-yields.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import {yieldToPage,yieldEvery,PAINT_MS} from '../src/v2/yield-to-page.js';
import {compactRenderGeometry} from '../src/v2/facade.js';

function check(name,fn){return Promise.resolve(fn()).then(()=>console.log('PASS '+name));}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

await check('scheduler.yield between timer turns, a timer turn at least every PAINT_MS',async()=>{
 const was=globalThis.scheduler;let yields=0;globalThis.scheduler={yield:()=>{yields++;return Promise.resolve();}};
 try{
  await sleep(PAINT_MS+5);await yieldToPage();assert.equal(yields,0,'a timer turn when the last was long ago');
  for(let i=0;i<20;i++)await yieldToPage();assert.equal(yields,20,'scheduler.yield in between');
  await sleep(PAINT_MS+5);await yieldToPage();assert.equal(yields,20,'a timer turn again after PAINT_MS');
 }finally{globalThis.scheduler=was;}
 // Without scheduler.yield (Node, older browsers), timers as before.
 await yieldToPage();await yieldToPage();
});
await check('a sliced yield gives a turn only after its slice of work',async()=>{
 const was=globalThis.scheduler;let yields=0;globalThis.scheduler={yield:()=>{yields++;return Promise.resolve();}};
 try{
  await sleep(PAINT_MS+5);await yieldToPage();// The next turns are scheduler.yield, so they can be counted.
  const pause=yieldEvery(5);for(let i=0;i<50;i++)await pause();assert.equal(yields,0,'quick steps do not yield');
  const end=performance.now()+6;while(performance.now()<end);await pause();assert.equal(yields,1,'a slow step yields once');
  await pause();assert.equal(yields,1,'and the slice starts again');
 }finally{globalThis.scheduler=was;}
});
await check('compaction keeps the vertices an index uses in first-use order, as the Map version did',()=>{
 // The version before typed arrays, kept here as the reference; the last case is a few pieces of a big shared pool.
 const before=source=>{const ids=source.index?Array.from(new Set(source.index.array)):Array.from({length:source.attributes.position.count},(_,i)=>i),remap=new Map(ids.map((id,i)=>[id,i])),g=new T.BufferGeometry();
  for(const[name,a]of Object.entries(source.attributes)){const values=new a.array.constructor(ids.length*a.itemSize);for(let i=0;i<ids.length;i++)for(let k=0;k<a.itemSize;k++)values[i*a.itemSize+k]=a.array[ids[i]*a.itemSize+k];g.setAttribute(name,new T.BufferAttribute(values,a.itemSize,a.normalized));}
  if(source.index)g.setIndex(Array.from(source.index.array,i=>remap.get(i)));g.computeBoundingBox();g.computeBoundingSphere();return g;};
 let seed=7;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(const [vertices,triangles,indexed] of [[50,30,true],[70000,40000,true],[90,30,false],[200,1,true],[400000,500,true]]){
  const g=new T.BufferGeometry(),pos=new Float32Array(vertices*3).map(()=>rand(1000)/7),col=new Uint8Array(vertices*4).map(()=>rand(256));
  g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('color',new T.BufferAttribute(col,4,true));
  if(indexed){const idx=new (vertices>65535?Uint32Array:Uint16Array)(triangles*3).map(()=>rand(vertices));g.setIndex(new T.BufferAttribute(idx,1));}
  const a=before(g),b=compactRenderGeometry(g);
  for(const name of ['position','color']){assert.equal(b.attributes[name].array.constructor,a.attributes[name].array.constructor);assert.deepEqual([...b.attributes[name].array],[...a.attributes[name].array],name);assert.equal(b.attributes[name].normalized,a.attributes[name].normalized);}
  if(indexed){assert.equal(b.index.array.constructor,a.index.array.constructor);assert.deepEqual([...b.index.array],[...a.index.array]);}else assert.equal(b.index,null);
  assert.ok(b.boundingSphere.equals(a.boundingSphere));
 }
 // An index past the vertex list (none in the ship) keeps what the version before made of it.
 const bad=new T.BufferGeometry();bad.setAttribute('position',new T.BufferAttribute(new Float32Array(12).map((_,i)=>i),3));bad.attributes.position.count=3;bad.setIndex([0,1,3,2,1,0]);
 const a=before(bad),b=compactRenderGeometry(bad);assert.deepEqual([...b.index.array],[...a.index.array]);assert.deepEqual([...b.attributes.position.array],[...a.attributes.position.array]);
});
