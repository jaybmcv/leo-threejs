import assert from 'node:assert/strict';
import * as T from 'three';
import {PVS_GRID,PVS_HIDDEN,PVS_UNKNOWN,PVS_VISIBLE,createAtriumPvs,decodeCells,encodeCells} from '../src/v2/atrium-pvs.js';
import {createAtriumSight} from '../src/v2/atrium-sight.js';

const {nx,nz,ny,x0,z0,step,y0}=PVS_GRID,length=nx*nz*ny,source={prepared:'abc',layout:'def'};
const cellOf=(x,y,z)=>(Math.floor((y-y0)/2)*nx+Math.round((x-x0)/step))*nz+Math.round((z-z0)/step);
function data(set={},from=source){const cells=new Uint8Array(length);for(const [c,v] of Object.entries(set))cells[c]=v;return {version:1,source:from,grid:PVS_GRID,cells:encodeCells(cells)};}
function check(name,fn){fn();console.log('PASS '+name);}

check('cells survive a round trip, including runs past one varint byte',()=>{
 const cells=new Uint8Array(length);cells.fill(1,10,400);cells.fill(2,500,70000);cells[length-1]=2;
 assert.deepEqual(decodeCells(encodeCells(cells),length),cells);
});
check('a truncated grid is refused',()=>assert.throws(()=>decodeCells(encodeCells(new Uint8Array(10)),length)));
check('a state this code does not know is refused rather than read as hidden',()=>{const cells=new Uint8Array(length);cells[7]=3;assert.throws(()=>decodeCells(encodeCells(cells),length));});
check('data made from another prepared walk or layout is ignored',()=>{
 assert.equal(createAtriumPvs(data({},{prepared:'old',layout:'def'}),source),null);
 assert.equal(createAtriumPvs(data({},{prepared:'abc',layout:'old'}),source),null);
 assert.equal(createAtriumPvs(data(),{prepared:undefined,layout:'def'}),null);
 assert.equal(createAtriumPvs({...data(),grid:{...PVS_GRID,step:4}},source),null);
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
