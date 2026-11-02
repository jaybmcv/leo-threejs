import assert from 'node:assert/strict';import * as T from 'three';import {Colliders,bandOf} from '../src/walk/collision.js';
const keys=function*(box){for(let x=Math.floor(box.min.x/8);x<=Math.floor(box.max.x/8);x++)for(let y=Math.floor(box.min.y/8);y<=Math.floor(box.max.y/8);y++)for(let z=Math.floor(box.min.z/8);z<=Math.floor(box.max.z/8);z++)yield x+','+y+','+z;};
function* original(col,box,ray=null){for(let b=bandOf(box.min.y);b<=bandOf(box.max.y);b++){const band=col.bands.get(b);if(band)yield[band.bvh,null,null];}for(const g of col.groups){const seen=new Set();for(const key of keys(box))for(const item of g.cells.get(key)||[])if(!seen.has(item)){seen.add(item);if(item.box.intersectsBox(box)&&(!ray||ray.intersectsBox(item.box)))yield[g.bvh,item.inverse,item.matrix];}}for(const m of col.movers)if(m.enabled&&m.box.intersectsBox(box))yield[m.bvh,m.inverse,m.matrix];}
const col=new Colliders();col.bands.set(10,{bvh:{band:10}});col.bands.set(9,{bvh:{band:9}});
for(let g=0;g<2;g++){
 const cells=new Map(),items=[];
 for(const [i,[x,z]]of [[0,[17,-3]],[1,[-17,2]],[2,[0,0]],[3,[7,0]]]){const box=new T.Box3(new T.Vector3(x-2,-.5,z-2),new T.Vector3(x+2,.5,z+2)),item={i,box,matrix:{g,i},inverse:{g,i}};items.push(item);for(const key of keys(box)){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item);}}
 col.groups.push({bvh:{g},items,cells:new Map([...cells].reverse())});
}
col.movers.push({enabled:true,box:new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1)),bvh:{mover:true},inverse:{},matrix:{}});
for(const width of [3,32,160])for(const ray of [null,new T.Ray(new T.Vector3(-200,0,0),new T.Vector3(1,0,0))]){const box=new T.Box3(new T.Vector3(-width,-1,-4),new T.Vector3(width,1,4));assert.deepEqual([...col.near(box,ray)],[...original(col,box,ray)]);}
const ordinary=new T.Box3(new T.Vector3(-160,-1,-160),new T.Vector3(160,1,160)),huge=new T.Box3(new T.Vector3(-1e6,-1,-1e6),new T.Vector3(1e6,1,1e6));assert.deepEqual([...col.near(huge)],[...original(col,ordinary)]);
assert.deepEqual([...new Colliders().near(huge)],[]);
console.log('PASS wide collision queries: exact group/cell/item order, duplicate suppression, negative cells, ray filtering, movers and bounded huge sparse boxes');
