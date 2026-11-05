import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import * as T from 'three';

// Only room lookup and prepared-resource transport are substituted. No recorded geometry is supplied to replay.
const dir=path.resolve('.qa/blossom-expansion');await fs.mkdir(dir,{recursive:true});
const replayPath=path.join(dir,'replay.mjs');
let replay=await fs.readFile('src/v2/prepared-geometry-replay.public.js','utf8');
replay=replay.replace(/import \{preparedResource\} from .*?;/,'const preparedResource={geometryTemplates:new Map()};')
 .replace("'./prepared-geometry-key.js'",JSON.stringify(pathToFileURL(path.resolve('src/v2/prepared-geometry-key.js')).href));
await fs.writeFile(replayPath,replay);
const factories=[];
for(const suffix of ['','.authoring','.prepared','.public']){
 const source=path.resolve('src/walk/blossom'+suffix+'.js');let text=await fs.readFile(source,'utf8');
 text=text.replace("import {roomObject} from '../plan/rooms.js';","const roomObject=(ship,id)=>ship.root.getObjectByName(id)||null;");
 text=text.replace(/from (['"])(\.[^'"]+)\1/g,(_,q,rel)=>'from '+JSON.stringify(pathToFileURL(rel.includes('prepared-geometry-replay')?replayPath:path.resolve(path.dirname(source),rel)).href));
 const file=path.join(dir,'factory'+suffix+'.mjs');await fs.writeFile(file,text);factories.push(await import(pathToFileURL(file)));
}
function ship(){const root=new T.Group(),room=new T.Group();room.name='Fitted_garden_commons_10';root.add(room);return {root,room};}
function signature(root){const hash=createHash('sha256');root.updateMatrixWorld(true);root.traverse(o=>{
 hash.update(o.name+o.matrixWorld.elements.join(','));if(o.geometry){for(const [key,a] of Object.entries(o.geometry.attributes))hash.update(key).update(Buffer.from(a.array.buffer));if(o.geometry.index)hash.update(Buffer.from(o.geometry.index.array.buffer));}
 if(o.isInstancedMesh)hash.update(Buffer.from(o.instanceMatrix.array.buffer));
 });return hash.digest('hex');}
const baseline=factories[0].createBlossomGarden(ship());
for(const factory of factories.slice(1)){
 const actual=factory.createBlossomGarden(ship());assert.equal(signature(actual.group),signature(baseline.group),'render geometry agrees across modes without recorded templates');assert.equal(signature(actual.solid),signature(baseline.solid),'collision geometry agrees across modes without recorded templates');
}
const garden=baseline,box=o=>new T.Box3().setFromObject(o,true);
assert.equal(signature(garden.group.getObjectByName('Blossom_tree_trunk')),'dbb5d5c22d792909938887a87a6b1d6e4df2b578cc67e87fa6e50ca197e90322','original trunk retained');
assert.equal(signature(garden.group.getObjectByName('Blossom_tree_canopy')),'2187c262b79db577f2e48f421381823d763af93bbd40c2c7f7a6cb913d03305c','original canopy retained');
const bridgeHash=createHash('sha256');for(const key of ['position','normal'])bridgeHash.update(Buffer.from(garden.group.getObjectByName('Blossom_bridge').geometry.attributes[key].array.buffer));
assert.equal(bridgeHash.digest('hex'),'1964d7af4524f55a79214a7bfbc4242f0b4b7434df47719c5472d10d66a98167','original bridge shape retained');
const pond=box(garden.group.getObjectByName('Blossom_pond_water'));
assert.ok(Math.abs(pond.max.x-pond.min.x-3.18)<.001&&Math.abs(pond.max.z-pond.min.z-6.18)<.001,'larger continuous water surface');
const trees=[];garden.group.traverse(o=>{if(o.isLOD)trees.push(o);});assert.equal(trees.length,2,'three cherry trees in total');
const bridge=box(garden.group.getObjectByName('Blossom_bridge'));
const bridgeRoute=new T.Box3(new T.Vector3(135,24.3,33.85),new T.Vector3(141.95,27.2,35.95));
let nearTriangles=0,farTriangles=0;
const triangles=root=>{let n=0;root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});return n;};
for(const tree of trees){
 nearTriangles+=triangles(tree.levels[0].object);farTriangles+=triangles(tree.levels[1].object);
 for(const level of tree.levels){const b=box(level.object);assert.ok(b.min.x>=136.5&&b.max.x<=148.5&&b.min.z>=27.5&&b.max.z<=36.5,'whole tree stays in allocated bed');assert.ok(!b.intersectsBox(bridgeRoute),'bridge and bench approach stays clear');}
 const camera=new T.PerspectiveCamera();camera.position.copy(tree.getWorldPosition(new T.Vector3())).add(new T.Vector3(0,0,30));camera.updateMatrixWorld();tree.update(camera);assert.equal(tree.getCurrentLevel(),1,'distant tree uses fallback');
 camera.position.copy(tree.getWorldPosition(new T.Vector3())).add(new T.Vector3(0,0,8));camera.updateMatrixWorld();tree.update(camera);assert.equal(tree.getCurrentLevel(),0,'near tree uses blossom detail');
}
assert.ok(nearTriangles<=14000&&farTriangles<=300,'two added trees have a bounded budget');
assert.ok(bridge.min.x<136.5&&bridge.max.x>139.8,'original bridge still crosses pond');
// Solid pond floor and continuous east/north edges must cover the added water.
const solids=garden.solid.children.map(box);
assert.ok(solids.some(b=>b.min.x<=136.51&&b.max.x>=139.79&&b.min.z<=33.21&&b.max.z>=39.49&&b.max.y<24.5),'pond floor covers extension');
assert.ok(solids.some(b=>b.min.x<139.8&&b.max.x>=139.8&&b.min.z<=36.51&&b.max.z>=39.49),'new east rim is solid');
function bedShip(){const prepared=ship();for(const name of ['Garden_planter','Planting_bed']){const mesh=new T.Mesh(new T.BoxGeometry(9,.65,9));mesh.name=name;mesh.position.set(141,24.625,32);prepared.room.add(mesh);}return prepared;}
const prepared=bedShip();
factories[0].prepareBlossomBed(prepared);const planter=box(prepared.root.getObjectByName('Garden_planter'));
for(const factory of factories.slice(1)){const actual=bedShip();factory.prepareBlossomBed(actual);assert.equal(signature(actual.root),signature(prepared.root),'planter and bench agree across modes without recorded templates');}
assert.ok(Math.abs(planter.max.x-148.5)<.001,'expanded planter and collision use actual new footprint');
const bench=prepared.root.getObjectByName('Blossom_bench');assert.ok(bench,'original bench retained');
const world=new T.Matrix4().makeTranslation(-26.5,0,16),worldPond=pond.clone().applyMatrix4(world);
assert.ok(worldPond.max.z<57.4-1.8,'dry route to cafe counter stays at least 1.8 m wide');
assert.ok(box(garden.group.getObjectByName('Blossom_pond_stones')).max.z<41.4-1.75,'actual rim leaves at least 1.75 m at cafe counter');
assert.ok(planter.max.x-26.5<126.5-4,'more than 4 m beside selected lower stairs');
const koi=garden.group.getObjectByName('Blossom_koi'),m=new T.Matrix4(),v=new T.Vector3();
for(let step=0;step<500;step++){
 garden.update(.1,new T.Vector3(141,25,32));for(let i=0;i<koi.count;i++){koi.getMatrixAt(i,m);v.setFromMatrixPosition(m);assert.ok(v.x>136.8&&v.x<139.5&&v.z>33.5&&v.z<39.2,'koi stay in water clear of rim');}
}
assert.equal(garden.group.getObjectByName('Blossom_butterflies').count,16,'eight butterflies retained');
assert.equal(garden.group.getObjectByName('Blossom_falling_petals').count,160,'particle budget unchanged');
console.log(JSON.stringify({status:'PASS',bed:'12 x 9 m',pond:'3.3 x 6.3 m',trees:3,addedNearTriangles:nearTriangles,addedFarTriangles:farTriangles,modes:4,scope:'Factories, render/collision parity, tree footprints and LOD, pond containment and measured source-frame clearances; full ship browser and flood run separately.'},null,2));
