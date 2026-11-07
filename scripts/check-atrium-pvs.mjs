import assert from 'node:assert/strict';
import * as T from 'three';
import {PVS_GRID,PVS_HIDDEN,PVS_RANGE,PVS_UNKNOWN,PVS_VISIBLE,createAtriumPvs,decodeCells,encodeCells,snapRange} from '../src/v2/atrium-pvs.js';
import {BAND} from '../src/walk/collision.js';
import {createAtriumSight} from '../src/v2/atrium-sight.js';
import {atriumPvsKey} from '../src/v2/atrium-pvs-key.js';

const {nx,nz,ny,x0,z0,step,y0}=PVS_GRID,length=nx*nz*ny,source={key:'2.abc'};
const cellOf=(x,y,z)=>(Math.floor((y-y0)/2)*nx+Math.round((x-x0)/step))*nz+Math.round((z-z0)/step);
function data(set={},from=source){const cells=new Uint8Array(length);for(const [c,v] of Object.entries(set))cells[c]=v;return {version:1,source:from,grid:PVS_GRID,cells:encodeCells(cells)};}
function check(name,fn){fn();console.log('PASS '+name);}

check('cells survive a round trip, including runs past one varint byte',()=>{
 const cells=new Uint8Array(length);cells.fill(1,10,400);cells.fill(2,500,70000);cells[length-1]=2;
 assert.deepEqual(decodeCells(encodeCells(cells),length),cells);
});
check('a truncated grid is refused',()=>assert.throws(()=>decodeCells(encodeCells(new Uint8Array(10)),length)));
check('a state this code does not know is refused rather than read as hidden',()=>{const cells=new Uint8Array(length);cells[7]=3;assert.throws(()=>decodeCells(encodeCells(cells),length));});
check('data baked from other geometry, or for no key, is ignored',()=>{
 assert.equal(createAtriumPvs(data({},{key:'2.old'}),source),null);
 assert.equal(createAtriumPvs(data({},{prepared:'abc',layout:'def'}),source),null);
 assert.equal(createAtriumPvs(data(),{key:undefined}),null);
 assert.equal(createAtriumPvs(data({},{}),{}),null);
 assert.equal(createAtriumPvs({...data(),grid:{...PVS_GRID,step:4}},source),null);
});

// The key: the colliders as the bake reads them, a band of loose triangles and an instanced group.
const setup={version:2,grid:PVS_GRID,levels:[[[[0,0],[10,0],[10,10]],-19.65,40.12]]};
function colliders(positions,{flags=null,index=null,matrices=[[1,0,0,0,0,1,0,0,0,0,1,0,5,0,5,1]]}={}){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(positions),3));if(index)g.setIndex(index);
 const box=new T.BufferGeometry();box.setAttribute('position',new T.BufferAttribute(new Float32Array([0,0,0,1,0,0,0,1,0]),3));
 return {bands:new Map([[3,{bvh:{geometry:g,leoWindowFlags:flags}}]]),groups:[{bvh:{geometry:box,leoWindowFlags:null},items:matrices.map(m=>({matrix:new T.Matrix4().fromArray(m)}))}]};
}
const A=[0,0,0,1,0,0,0,1,0],B=[2,0,0,3,0,0,2,1,0],C=[5,5,5,6,5,5,5,6,5];
check('the key ignores triangle order, vertex rotation, indexing and sub-millimetre noise',()=>{
 const key=atriumPvsKey(colliders([...A,...B]),setup);
 assert.equal(atriumPvsKey(colliders([...B,...A]),setup),key);
 assert.equal(atriumPvsKey(colliders([...B,...A.slice(3),...A.slice(0,3)]),setup),key);
 assert.equal(atriumPvsKey(colliders([0,0,0,1,0,0,0,1,0,2,0,0,3,0,0,2,1,0],{index:[3,4,5,0,1,2]}),setup),key);
 assert.equal(atriumPvsKey(colliders([...A,...B].map(v=>v+.0002)),setup),key);
});
check('the key changes with a moved, added, removed or mirrored occluder, an instance or the setup',()=>{
 const key=atriumPvsKey(colliders([...A,...B]),setup);
 for(const other of [
  atriumPvsKey(colliders([...A,...B.map((v,i)=>i===0?v+.002:v)]),setup),
  atriumPvsKey(colliders([...A,...B,...C]),setup),
  atriumPvsKey(colliders(A),setup),
  atriumPvsKey(colliders([...A,2,0,0,2,1,0,3,0,0]),setup),
  atriumPvsKey(colliders([...A,...B],{matrices:[[1,0,0,0,0,1,0,0,0,0,1,0,5,0,5.01,1]]}),setup),
  atriumPvsKey(colliders([...A,...B],{matrices:[[1,0,0,0,0,1,0,0,0,0,1,0,5,0,5,1],[1,0,0,0,0,1,0,0,0,0,1,0,9,0,5,1]]}),setup),
  atriumPvsKey(colliders([...A,...B]),{...setup,levels:[[[[0,0],[10,0],[10,10]],-19.6,40.12]]}),
  atriumPvsKey(colliders([...A,...B]),{...setup,version:3})])assert.notEqual(other,key);
});
check('window and collision-only faces count apart from opaque ones: the bake sees through them but stands on them',()=>{
 const opaque=atriumPvsKey(colliders([...A,...B,...C]),setup),flagged=atriumPvsKey(colliders([...A,...B,...C],{flags:new Uint8Array([0,0,1])}),setup);
 assert.notEqual(flagged,opaque);assert.notEqual(flagged,atriumPvsKey(colliders([...A,...B]),setup));
 assert.equal(atriumPvsKey(colliders([...C,...A,...B],{flags:new Uint8Array([1,0,0])}),setup),flagged);
});
check('a face with two vertices rounded together hashes alike from either of them',()=>{
 const D=[0,0,0,0,0,.0001,1,0,0];
 assert.equal(atriumPvsKey(colliders([...A,...D]),setup),atriumPvsKey(colliders([...A,...D.slice(3),...D.slice(0,3)]),setup));
 assert.equal(atriumPvsKey(colliders([...A,...D]),setup),atriumPvsKey(colliders([...A,...D.slice(6),...D.slice(0,6)]),setup));
});
check('a visible cell gives the heights its sight reaches; without ranges, or for a hidden cell, none',()=>{
 const set={[cellOf(10,-30,4)]:PVS_VISIBLE,[cellOf(12,-30,4)]:PVS_HIDDEN},plain=data(set),lo=new Uint8Array(length),hi=new Uint8Array(length);
 const byte=y=>Math.round((y-PVS_RANGE.y0)/PVS_RANGE.span*255);lo[cellOf(10,-30,4)]=byte(-20);hi[cellOf(10,-30,4)]=byte(4);
 const pvs=createAtriumPvs({...plain,ranges:{...PVS_RANGE,lo:encodeCells(lo),hi:encodeCells(hi)}},source),[a,b]=pvs.range({x:10,y:-30,z:4});
 // Padded outward by a byte and a band (4 m) each side.
 assert(a<=-24&&a>-26&&b>=8&&b<10,'range '+a+'..'+b);
 assert.equal(pvs.range({x:12,y:-30,z:4}),null);assert.equal(pvs.range({x:900,y:0,z:0}),null);
 assert.equal(createAtriumPvs(plain,source).range({x:10,y:-30,z:4}),null,'no ranges: the whole atrium');
 assert.equal(createAtriumPvs({...plain,ranges:{y0:0,span:100,lo:encodeCells(lo),hi:encodeCells(hi)}},source).range({x:10,y:-30,z:4}),null,'other units: the whole atrium');
});
check('snapping widens a range to the band edges around it, never narrows it',()=>{
 const y=b=>PVS_RANGE.y0+PVS_RANGE.span*b/255;
 for(let lo=0;lo<256;lo+=3)for(let hi=lo;hi<256;hi+=7){const [a,b]=snapRange(lo,hi);
  assert(a<=lo&&b>=hi,`${lo}..${hi} -> ${a}..${b}`);
  for(const v of [a,b])if(v>0&&v<255){const k=(y(v)-BAND.base)/BAND.height;assert(Math.abs(k-Math.round(k))<PVS_RANGE.span/255/BAND.height+1e-9,'off a band edge: '+v);}}
});
check('a point finds its own cell; outside the grid is unknown',()=>{
 const pvs=createAtriumPvs(data({[cellOf(10,-18.1,4)]:PVS_HIDDEN,[cellOf(10,-16.5,4)]:PVS_VISIBLE}),source);
 assert.equal(pvs.at({x:10.9,y:-18.1,z:3.1}),PVS_HIDDEN);
 assert.equal(pvs.at({x:10,y:-16.5,z:4}),PVS_VISIBLE);
 assert.equal(pvs.at({x:14,y:-18.1,z:4}),PVS_UNKNOWN);
 assert.equal(pvs.at({x:900,y:0,z:0}),PVS_UNKNOWN);
 assert.equal(pvs.at({x:0,y:-50,z:0}),PVS_UNKNOWN);
});

// The sight test: a cell with data answers without rays; a cell without data falls back to them.
const portals=[[[-4,0,0],[4,0,0],[4,3,0],[-4,3,0]]],none={bands:new Map(),groups:[],movers:[],*near(){}};
function camera(x,y,z){const c=new T.PerspectiveCamera(60,1.5,.05,450);c.position.set(x,y,z);c.lookAt(0,1.5,0);c.updateMatrixWorld(true);return c;}
check('a hidden cell overrides an open view and a visible cell needs no rays',()=>{
 const pvs=createAtriumPvs(data({[cellOf(0,1.5,5)]:PVS_HIDDEN,[cellOf(0,1.5,9)]:PVS_VISIBLE}),source);
 const sight=createAtriumSight(none,{portals,intervalMs:0,holdMs:0,pvs:()=>pvs}),p=new T.Vector3();
 assert.equal(sight.update(camera(0,1.5,5),p,0),false);
 assert.equal(sight.update(camera(0,1.5,9),p,1),true);assert.equal(sight.stats.rays,0);
 // No data at x = 12: the unobstructed portal is found by a ray, at once, though the last answer came from the PVS.
 assert.equal(sight.update(camera(12,1.5,5),p,2),true);assert.ok(sight.stats.rays>0);
});
check('leaving a visible cell for a hidden one holds the atrium for holdMs',()=>{
 const pvs=createAtriumPvs(data({[cellOf(0,1.5,5)]:PVS_HIDDEN,[cellOf(0,1.5,9)]:PVS_VISIBLE}),source);
 const sight=createAtriumSight(none,{portals,intervalMs:150,holdMs:250,pvs:()=>pvs}),p=new T.Vector3();
 assert.equal(sight.update(camera(0,1.5,9),p,0),true);
 assert.equal(sight.update(camera(0,1.5,5),p,100),true);
 assert.equal(sight.update(camera(0,1.5,5),p,300),false);
});
check('back at the pose the rays last answered, a PVS answer from between is not reused',()=>{
 const pvs=createAtriumPvs(data({[cellOf(0,1.5,5)]:PVS_HIDDEN}),source);
 const sight=createAtriumSight(none,{portals,intervalMs:0,holdMs:0,pvs:()=>pvs}),p=new T.Vector3();
 assert.equal(sight.update(camera(12,1.5,5),p,0),true);
 assert.equal(sight.update(camera(0,1.5,5),p,1),false);
 assert.equal(sight.update(camera(12,1.5,5),p,2),true);
});
check('without loaded data the rays answer as before',()=>{
 const sight=createAtriumSight(none,{portals,intervalMs:0,holdMs:0,pvs:()=>null});
 assert.equal(sight.update(camera(0,1.5,5),new T.Vector3(),0),true);assert.ok(sight.stats.rays>0);
});
