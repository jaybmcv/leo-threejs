// The owner bake's proof (src/v2/owner-proof.js) on walls built here: what it may hide, and everything it must not.
import assert from 'node:assert/strict';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createOwnerProof} from '../src/v2/owner-proof.js';

// A rectangle in a plane of constant z, front face towards +z (`back` turns it to face -z); `segments` tiles it.
function rect(x0,x1,y0,y1,z,{back=false,segments=1}={}){
 const g=new T.PlaneGeometry(x1-x0,y1-y0,segments,segments);if(back)g.rotateY(Math.PI);g.translate((x0+x1)/2,(y0+y1)/2,z);return g.toNonIndexed();
}
// Occluders from [{geometry, side, cond}]: one world-space soup with each triangle's side and condition.
function occluders(parts){
 const positions=[],sides=[],conds=[];
 for(const {geometry,side=0,cond=0} of parts){const a=geometry.attributes.position.array;positions.push(...a);for(let i=0;i<a.length/9;i++){sides.push(side);conds.push(cond);}}
 // An empty soup still needs one (degenerate, far away) triangle for the BVH.
 if(!positions.length){positions.push(1e6,1e6,1e6,1e6,1e6,1e6,1e6,1e6,1e6);sides.push(0);conds.push(0);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 return {bvh:new MeshBVH(g,{indirect:true}),sides:Uint8Array.from(sides),conds:Uint32Array.from(conds)};
}
const box=(x0,y0,z0,x1,y1,z1)=>new T.Box3(new T.Vector3(x0,y0,z0),new T.Vector3(x1,y1,z1));
const cell=box(-1,0,4,1,2,6),target=box(-.5,.5,-3,.5,1.5,-2);
const wall=(opts={})=>rect(-10,10,-2,8,0,opts);
let passed=0;
function check(name,parts,expect,{c=cell,b=target,options={}}={}){
 const proof=createOwnerProof(occluders(parts),options),used=proof.prove(c,b);
 if(expect===false)assert.equal(used,null,name);else{assert.ok(used,name);if(Array.isArray(expect))assert.deepEqual([...used].sort(),expect,name);}
 passed++;console.log('PASS '+name);
}

check('a solid wall hides what is behind it',[{geometry:wall(),cond:7}],[7]);
check('with nothing in between, the box shows',[],false);
const holed=(hx0,hx1,hy0,hy1)=>[rect(-10,hx0,-2,8,0),rect(hx1,10,-2,8,0),rect(hx0,hx1,-2,hy0,0),rect(hx0,hx1,hy1,8,0)].map(geometry=>({geometry}));
check('a hole on the sight lines shows the box',holed(-.3,.3,.8,1.2),false);
check('a hole off the sight lines does not matter',holed(8,9,.8,1.2),true);
check('a single-sided wall seen from behind does not hide',[{geometry:wall({back:true}),side:0}],false);
check('a double-sided wall hides from either side',[{geometry:wall({back:true}),side:2}],true);
check('a back-side wall hides from its drawn side',[{geometry:wall({back:true}),side:1}],true);
check('a box 5 cm behind the wall stays visible (depth bias)',[{geometry:wall()}],false,{b:box(-.5,.5,-.3,.5,1.5,-.05)});
check('a box 20 cm behind the wall is hidden',[{geometry:wall()}],true,{b:box(-.5,.5,-.6,.5,1.5,-.2)});
check('an eye 5 cm from the wall is not trusted (near plane)',[{geometry:wall()}],false,{c:box(-1,0,.05,1,2,1)});
check('a box through the wall stays visible',[{geometry:wall()}],false,{b:box(-.5,.5,-.5,.5,1.5,.5)});
check('a wall tiled from 3,200 triangles still covers',[{geometry:wall({segments:40})}],true);
check('two halves sharing an edge cover without a seam',[{geometry:rect(-10,0,-2,8,0)},{geometry:rect(0,10,-2,8,0)}],true);
check('a 1 cm gap between two halves shows the box',[{geometry:rect(-10,-.005,-2,8,0)},{geometry:rect(.005,10,-2,8,0)}],false);
// Astra's case: halves meeting at x=0 but 1.5 mm apart in depth leave a slit that oblique sight passes through.
check('two halves 1.5 mm apart in depth do not cover (a slit between them)',[{geometry:rect(-10,0,-2,8,0)},{geometry:rect(0,10,-2,8,.0015)}],false);
check('an eye within the near-plane margin is not trusted',[{geometry:wall()}],false,{c:box(-1,0,.3,1,2,1)});
check('grazing sight lines are not trusted',[{geometry:rect(-100,100,-2,8,0)}],false,{c:box(-1,0,.15,1,2,.35),b:box(50,.5,-.6,51,1.5,-.3)});
check('a box touching the cell is never hidden',[{geometry:wall()}],false,{b:box(0,1,5,1,2,7)});
// Two walls in different planes, each covering one half: only splitting proves it, and both are relied on.
const two=[{geometry:rect(-10,1.5,-2,8,0),cond:1},{geometry:rect(-1.5,10,-2,8,-1),cond:2}],wide=box(-2,.5,-3,2,1.5,-2.5);
check('two walls that each cover half need a split',two,false,{b:wide,options:{subdiv:0}});
check('one split proves it and names both walls',two,[1,2],{b:wide,options:{subdiv:1}});
// A plane that proved one cell is tried first for the next.
{const proof=createOwnerProof(occluders([{geometry:wall()}])),hint=new Map();proof.prove(cell,target,hint,'t');const before=proof.stats.hinted;
 assert.ok(proof.prove(box(1,0,4,3,2,6),target,hint,'t'));assert.equal(proof.stats.hinted,before+1,'the neighbouring cell reuses the plane');passed++;console.log('PASS the neighbouring cell reuses the plane');}
console.log(`owner proof: ${passed} checks passed`);
