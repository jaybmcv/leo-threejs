import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {Colliders} from '../src/walk/collision.js';
import {createVisibilityQuery} from '../src/v2/visibility-query.js';
import {opaqueBlocked} from '../src/v2/phase4-culling.js';
import {batchLowDeckDraws,separateAtriumPaving} from '../src/v2/facade.js';
import {installDistantArchitecture,structuralRange} from '../src/v2/distant-architecture.js';
const root=new T.Group(),glass=new T.Mesh(new T.BoxGeometry(8,4,.05),new T.MeshStandardMaterial({transparent:true,opacity:.18}));
glass.userData.hullEnvelopeBatch=true;glass.position.set(0,1,1);root.add(glass);
const wall=new T.Mesh(new T.BoxGeometry(2,3,.1));wall.position.set(0,1,4);root.add(wall);root.updateMatrixWorld(true);
const c=new Colliders();c.addStatic(root,()=>true);c.commit();const q=createVisibilityQuery(c),stats={rays:0,firstHits:0,windowFallbacks:0},scratch={box:new T.Box3(),point:new T.Vector3(),local:new T.Ray(),stats};
let seed=1729,checks=0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<1200;i++){
 const ray=new T.Ray(new T.Vector3((rand()-.5)*12,(rand()-.5)*6,-3),new T.Vector3((rand()-.5)*.4,(rand()-.5)*.4,1).normalize()),far=.1+rand()*15;
 assert.equal(opaqueBlocked(q,ray,far,scratch),!!c.raycastSight(ray,far,.05),'opaque sight parity '+i);checks++;
}
for(let i=0;i<50;i++){const ray=new T.Ray(new T.Vector3(0,1,6),new T.Vector3(0,0,-1));assert.equal(opaqueBlocked(q,ray,10,scratch),!!c.raycastSight(ray,10,.05));checks++;}
const p=[];const quad=(x0,x1,y0,y1)=>p.push(x0,y0,0,x1,y0,0,x1,y1,0,x0,y0,0,x1,y1,0,x0,y1,0);
quad(-2,-.5,0,3);quad(.5,2,0,3);quad(-.5,.5,0,.5);quad(-.5,.5,2.5,3);
const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(p,3));g.userData.preparedRanges=[{name:'V2_outer_room_wall',start:0,count:p.length/9,userData:{batchedEnvelope:true}}];
const band=new T.Group(),source=new T.Mesh(g,new T.MeshBasicMaterial({color:0xcabbab,side:T.DoubleSide}));band.add(source);band.visible=false;
const ship={inside:new T.Group(),facade:new T.Group(),v2Haze:new T.Group()},haze=new T.Scene();haze.add(ship.v2Haze);
const distant=await installDistantArchitecture(ship,{bands:new Map([[1,band]])},haze);distant.updateMatrixWorld(true);
assert.equal(distant.userData.proof.triangles,8);assert.equal(ship.v2Haze.parent,null);assert.equal(distant.userData.independentOfBands,true);
for(const sign of[-1,1]){const ray=new T.Raycaster(new T.Vector3(0,1,sign*200),new T.Vector3(0,0,-sign),0,1000);assert.equal(ray.intersectObject(distant,true).length,0,'real aperture stays open');ray.ray.origin.x=-1;assert(ray.intersectObject(distant,true).length>0,'real wall stays opaque');}
assert(!structuralRange({name:'chair',userData:{}}));assert(!structuralRange({name:'V2_outer_room_wall',userData:{collisionOnly:true}}));
const batchGroup=new T.Group();batchGroup.userData={band:1,top:1};const mat=new T.MeshBasicMaterial();for(let j=0;j<3;j++){const a=new Float32Array(30000);a.set([0,0,0,1,0,0,0,1,0],29991);const geo=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(a,3));geo.setIndex([9997,9998,9999]);const mesh=new T.Mesh(geo,mat);batchGroup.add(mesh);}
const batching=await batchLowDeckDraws({bands:new Map([[1,batchGroup]])},{extensions:{has:()=>true}});assert.equal(batching.vertices,9,'Batch only referenced pool vertices');assert.equal(batching.sources,3);assert.equal(batching.triangles,3);assert.equal(batchGroup.children.filter(o=>o.visible).length,1);
const paving=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial());paving.name='P6_atrium_floor_actual';paving.position.y=-19.7;const shell={facade:new T.Group()};shell.facade.add(paving);separateAtriumPaving(shell);separateAtriumPaving(shell);assert(Math.abs(paving.position.y+19.694)<1e-10,'One 6 mm visual separation');
const report={status:'PASS',sightParity:checks,stats,apertureRays:4,bandIndependent:true,exactTriangles:8,batching};await fs.writeFile('output/launch-a/fixture.json',JSON.stringify(report,null,2));console.log(report);
