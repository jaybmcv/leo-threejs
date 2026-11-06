// src/v2/visibility-query.js: the numeric cell walk (visibilityRayCodes) names the cells visibilityRayCells names, in the
// same order, and a query yields the same colliders in the same order as one keyed by strings. Random rays, including
// axis-aligned and diagonal ones that tie on cell borders. Usage: node scripts/check-visibility-codes.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import {Colliders} from '../src/walk/collision.js';
import {visibilityRayCells,visibilityRayCodes,createVisibilityQuery} from '../src/v2/visibility-query.js';
import {bandOf} from '../src/walk/collision.js';

let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648,span=(a,b)=>a+(b-a)*rnd();
const code=k=>{const [x,y,z]=k.split(',').map(Number);return ((x+1024)*2048+(y+1024))*2048+(z+1024);};
function ray(){
 const o=new T.Vector3(span(-120,120),span(-30,60),span(-80,80)),kind=rnd();
 // On a cell border, along an axis, along a diagonal, or anywhere.
 if(kind<.2)o.set(Math.round(o.x/8)*8,Math.round(o.y/8)*8,o.z);
 const d=kind<.35?new T.Vector3(...[[1,0,0],[0,-1,0],[0,0,1]][Math.floor(rnd()*3)]):kind<.5?new T.Vector3(1,rnd()<.5?1:-1,1).normalize():new T.Vector3(span(-1,1),span(-1,1),span(-1,1)).normalize();
 return new T.Ray(o,d);
}
function check(name,fn){fn();console.log('PASS '+name);}

check('the same cells in the same order, or null alike, for 200,000 rays',()=>{
 for(let i=0;i<200000;i++){const r=ray(),far=span(.5,120),box=new T.Box3().setFromPoints([r.origin,r.at(far,new T.Vector3())]).expandByScalar(.01);
  const a=visibilityRayCells(box,r),b=visibilityRayCodes(box,r);
  if(a===null)assert.equal(b,null);else assert.deepEqual(b,a.map(code),'ray '+i);}
});

// The query as it was before cell codes, for comparison.
function stringQuery(col){const query=Object.create(col);query.near=function*(box,ray=null){if(!ray){yield*col.near(box,ray);return;}const keys=visibilityRayCells(box,ray);if(!keys){yield*col.near(box,ray);return;}for(let b=bandOf(box.min.y);b<=bandOf(box.max.y);b++){const band=col.bands.get(b);if(band)yield[band.bvh,null,null];}for(const g of col.groups){if(g.items.length<=keys.length*2){for(const item of g.items)if(item.box.intersectsBox(box)&&ray.intersectsBox(item.box))yield[g.bvh,item.inverse,item.matrix];}else{const seen=new Set();for(const key of keys)for(const item of g.cells.get(key)||[])if(!seen.has(item)){seen.add(item);if(item.box.intersectsBox(box)&&ray.intersectsBox(item.box))yield[g.bvh,item.inverse,item.matrix];}}}for(const m of col.movers)if(m.enabled&&m.box.intersectsBox(box))yield[m.bvh,m.inverse,m.matrix];};return query;}
check('a query yields the same colliders in the same order',()=>{
 const col=new Colliders(),box=new T.Mesh(new T.BoxGeometry(1,1,1));
 for(const [n,count] of [['small',3],['crates',400],['columns',1500]]){
  const matrices=Array.from({length:count},()=>new T.Matrix4().compose(new T.Vector3(span(-120,120),span(-30,60),span(-80,80)),new T.Quaternion(),new T.Vector3(span(.5,4),span(.5,9),span(.5,4))));
  col.addInstances(n,box.geometry.toNonIndexed().attributes.position.array,matrices);
 }
 const fast=createVisibilityQuery(col),slow=stringQuery(col);let yields=0;
 for(let i=0;i<20000;i++){const r=ray(),far=span(.5,120),b=new T.Box3().setFromPoints([r.origin,r.at(far,new T.Vector3())]).expandByScalar(.01);
  const a=[...slow.near(b,r)].map(x=>x[2]),c=[...fast.near(b,r)].map(x=>x[2]);assert.equal(c.length,a.length,'ray '+i);c.forEach((m,j)=>assert.equal(m,a[j]));yields+=a.length;}
 assert.ok(yields>1000,'the rays met colliders ('+yields+')');
});
