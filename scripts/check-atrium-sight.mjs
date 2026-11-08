import assert from 'node:assert/strict';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createAtriumSight} from '../src/v2/atrium-sight.js';

const portals=[[[-4,0,0],[4,0,0],[4,3,0],[-4,3,0]]];
const player=new T.Vector3(0,0,5);
const opts={portals,intervalMs:0,holdMs:0};
function camera(x=0,y=1.5,z=5){const c=new T.PerspectiveCamera(60,1.5,.05,450);c.position.set(x,y,z);c.lookAt(0,1.5,0);c.updateMatrixWorld(true);return c;}
function plane(x0=-10,x1=10,z=2){const g=new T.PlaneGeometry(x1-x0,20);g.translate((x0+x1)/2,1.5,z);return g;}
function colliders(geometries=[],{glass=0,transform=null}={}){
 const groups=[];
 if(geometries.length){
  const geometry=mergeGeometries(geometries),bvh=new MeshBVH(geometry,{indirect:true}),matrix=transform||new T.Matrix4();
  bvh.leoWindowFlags=new Uint8Array(geometry.index.count/3);bvh.leoWindowFlags.fill(1,0,glass);
  geometry.computeBoundingBox();groups.push({bvh,items:[{box:geometry.boundingBox.clone().applyMatrix4(matrix),matrix,inverse:matrix.clone().invert()}],cells:new Map()});
 }
 return{bands:new Map(),groups,movers:[],*near(){}};
}
function check(name,col,expected,options=opts,c=camera(),p=player){
 const sight=createAtriumSight(col,options);assert.equal(sight.update(c,p,0),expected,name);console.log('PASS '+name);return sight;
}

check('outside through unobstructed opening',colliders(),true);
check('glass does not occlude',colliders([plane()],{glass:2}),true);
check('wholly opaque wall proves complete portal coverage',colliders([plane()]),false);
check('glass in front of opaque wall does not bypass wall',colliders([plane(-10,10,3),plane()],{glass:2}),false);
check('blocker behind portal is not an occluder',colliders([plane(-10,10,-2)]),true);
check('transformed instance uses world-space shadow',colliders([plane(-10,10,0)],{transform:new T.Matrix4().makeTranslation(0,0,2)}),false);
check('indirect BVH triangle lookup survives spatial index reordering',colliders([...Array.from({length:12},(_,i)=>plane(40+i*3,42+i*3)),plane()]),false);
const crossing=new T.PlaneGeometry(20,20);crossing.rotateY(Math.PI/3);crossing.translate(0,1.5,.5);
check('triangle shadow excludes portal portion in front of crossing blocker',colliders([crossing]),true);
const slit=.73,width=.05,narrow=colliders([plane(-10,slit-width/2),plane(slit+width/2,10)]);
check('narrow doorway between fixed portal rays',narrow,true,{...opts,doors:[{center:[slit,0,2],width,outward:[0,1]}]});
check('unsampled narrow gap remains conservatively visible',narrow,true);
const away=camera();away.lookAt(0,1.5,10);away.updateMatrixWorld(true);
check('offscreen atrium',colliders(),false,opts,away);
check('below-deck eye can see upward through an opening',colliders(),true,opts,camera(0,-3,5));
check('third-person eye is authoritative, not avatar',colliders(),true,opts,camera(),new T.Vector3(90,0,90));
check('exhausted ray budget retains unresolved geometry',colliders([plane()]),true,{...opts,maxRays:0});

const cached=createAtriumSight(colliders(),opts),c=camera();
cached.update(c,player,0);cached.update(c,player,1);assert.equal(cached.stats.updates,1);
c.fov=80;c.updateProjectionMatrix();cached.update(c,player,2);assert.equal(cached.stats.updates,2);
c.lookAt(0,1.5,10);c.updateMatrixWorld(true);assert.equal(cached.update(c,player,3),false);assert.equal(cached.stats.updates,3);
console.log('PASS exact pose cache invalidates on projection and rotation');
const movingCol=colliders([plane()]),movingGroup=movingCol.groups[0];
movingCol.movers=[{bvh:movingGroup.bvh,...movingGroup.items[0],enabled:true}];movingCol.groups=[];
const movingSight=createAtriumSight(movingCol,opts),movingCamera=camera();
assert.equal(movingSight.update(movingCamera,player,0),false);movingCol.movers[0].enabled=false;
assert.equal(movingSight.update(movingCamera,player,1),true);
console.log('PASS moving door state invalidates unchanged camera cache');

const held=createAtriumSight(colliders(),{...opts,holdMs:250}),h=camera();
assert.equal(held.update(h,player,0),true);h.lookAt(0,1.5,10);h.updateMatrixWorld(true);
assert.equal(held.update(h,player,1),true);assert.equal(held.update(h,player,251),false);
console.log('PASS closing hysteresis expires without further motion');
const longHeld=createAtriumSight(colliders(),{...opts,holdMs:250}),longCamera=camera();
longHeld.update(longCamera,player,0);longHeld.update(longCamera,player,10000);
longCamera.lookAt(0,1.5,10);longCamera.updateMatrixWorld(true);
assert.equal(longHeld.update(longCamera,player,10001),true);assert.equal(longHeld.update(longCamera,player,10251),false);
console.log('PASS closing hysteresis survives a long stationary visible pose');

const smallPortal=[[[-.001,1.4,0],[.001,1.4,0],[.001,1.6,0],[-.001,1.6,0]]];
const throttled=createAtriumSight(colliders(),{...opts,portals:smallPortal,intervalMs:150}),t=camera();t.fov=.5;t.updateProjectionMatrix();
throttled.update(t,player,0);t.lookAt(.1,1.5,0);t.updateMatrixWorld(true);
assert.equal(throttled.update(t,player,10),true);assert.equal(throttled.stats.updates,1);assert.equal(throttled.update(t,player,151),false);
const rapid=createAtriumSight(colliders(),{...opts,intervalMs:150}),rapidCamera=camera();
rapid.update(rapidCamera,player,0);rapidCamera.lookAt(0,1.5,10);rapidCamera.updateMatrixWorld(true);
assert.equal(rapid.update(rapidCamera,player,10),false);assert.equal(rapid.stats.updates,2);
console.log('PASS rapid turn bypasses sight throttle');
console.log('PASS pose change remains pending across throttle interval');

const ring=[[-10,-10],[10,-10],[10,10],[-10,10]];
const fixtureLayout={decks:[{number:6,y:0,atrium:{outline:ring}},{number:7,y:4,atrium:{outline:ring}}],cabins:[],rooms:[{id:'enclosed',y:0,height:3.5,polygon:[[-2,-2],[2,-2],[2,2],[-2,2]],door:{center:[slit,0,-2],width,outward:[0,-1]}}]};
const defaults={layout:fixtureLayout,intervalMs:0,holdMs:0},inside=camera(0,1.5,0);inside.lookAt(0,1.5,-3);inside.updateMatrixWorld(true);
const closedRoom=check('default envelope uses known room exits behind opaque wall',colliders([plane(-10,10,-2)]),false,defaults,inside);
assert.equal(closedRoom.stats.owner,'enclosed');
check('default enclosed room sees atrium through glass',colliders([plane(-10,10,-2)],{glass:2}),true,defaults,inside);
check('default room door target finds narrow exit',colliders([plane(-10,slit-width/2,-2),plane(slit+width/2,10,-2)]),true,defaults,inside);
const outsideAway=camera(0,1.5,20);outsideAway.lookAt(0,1.5,30);outsideAway.updateMatrixWorld(true);
check('default envelope outside and offscreen',colliders(),false,defaults,outsideAway);
const upperLayout={...fixtureLayout,rooms:[],decks:[{number:6,y:0,atrium:{outline:[[-2,-2],[2,-2],[2,2],[-2,2]]}},{number:7,y:4,atrium:{outline:ring}}]},upperEye=camera(6,7,20);upperEye.lookAt(6,7,0);upperEye.updateMatrixWorld(true);
check('default envelope includes changed upper-deck ring',colliders(),true,{...defaults,layout:upperLayout},upperEye);
// No floor below Deck 6 sees the whole atrium (Jay, 2026-11-07): an eye or walker under the atrium floor (Deck 6 here
// at y 0, so 0.3 m lower) answers hidden at once, with no PVS lookup or ray, even looking straight up an open gap.
const tiles=(hole=null)=>{const out=[];for(let x=-20;x<20;x++)for(let z=-20;z<20;z++){if(hole&&Math.abs(x+.5)<hole&&Math.abs(z+.5)<hole)continue;const t=new T.PlaneGeometry(1,1);t.rotateX(-Math.PI/2);t.translate(x+.5,-1,z+.5);out.push(t);}return out;};
const underEye=camera(0,-3,.01);underEye.lookAt(0,5,0);underEye.updateMatrixWorld(true);
const below=new T.Vector3(0,-4.5,15);
for(const [name,col,c,p] of [
 ['an eye below the atrium floor never sees it, even unobstructed',colliders(),camera(0,-3,15),below],
 ['under a ceiling of small tiles that would use up the rays',colliders(tiles()),underEye,below],
 ['looking up through an open gap in the ceiling',colliders(tiles(2)),underEye,below],
 ['a walker below the floor whose camera rises above it',colliders(),camera(),below]]){
 const sight=check('below Deck 6: '+name,col,false,{...defaults,maxRays:4},c,p);assert.equal(sight.stats.below,1);assert.equal(sight.stats.coverageRays,0);assert.equal(sight.stats.updates,0);
}
{const sight=createAtriumSight(colliders(),defaults),high=camera(0,1.5,15),low=camera(0,-3,15);
 assert.equal(sight.update(high,player,0),true);assert.equal(sight.update(low,below,1),false);assert.equal(sight.update(high,player,2),true);
 assert.equal(sight.stats.updates,2);console.log('PASS climbing back above the atrium floor asks again at once');}
console.log('Atrium sight fixtures passed.');
