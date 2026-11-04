import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as T from 'three';
import {createLayeredConservatory} from '../src/walk/layered-conservatory.js';

// Exercise the real factory without requiring multi-GB ship inputs. The only
// substituted dependency is room lookup; the ship fixture uses its legacy frame.
const outfile=path.resolve('.qa/conservatory-factory-check.mjs');
await fs.mkdir(path.dirname(outfile),{recursive:true});
await build({entryPoints:['src/walk/blossom.js'],bundle:true,platform:'node',packages:'external',format:'esm',outfile,plugins:[{
  name:'conservatory-room-fixture',setup(builder){
    builder.onResolve({filter:/plan\/rooms\.js$/},()=>({path:'fixture-room',namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const roomObject=(ship,id)=>ship.root.getObjectByName(id)||null;',loader:'js'}));
  },
}]});
const {createBlossomGarden,prepareBlossomBed}=await import(pathToFileURL(outfile));
function ship(name){const root=new T.Group(),room=new T.Group();room.name=name;root.add(room);return {root};}
function signature(root){
  const hash=createHash('sha256');root.updateMatrixWorld(true);
  root.traverse(object=>{
    hash.update(object.name+object.matrixWorld.elements.join(','));
    if(object.geometry){
      for(const [key,attribute] of Object.entries(object.geometry.attributes))hash.update(key).update(Buffer.from(attribute.array.buffer));
      if(object.geometry.index)hash.update(Buffer.from(object.geometry.index.array.buffer));
    }
    if(object.isInstancedMesh)hash.update(Buffer.from(object.instanceMatrix.array.buffer));
  });return hash.digest('hex');
}

// Captured from unmodified db2882a, three@0.185.1. The original tree stays intact.
// The approved garden expansion changes the pond collisions and scattered plank tones.
const baseline={
  Blossom_tree_trunk:'dbb5d5c22d792909938887a87a6b1d6e4df2b578cc67e87fa6e50ca197e90322',
  Blossom_tree_canopy:'2187c262b79db577f2e48f421381823d763af93bbd40c2c7f7a6cb913d03305c',
};
const garden=createBlossomGarden(ship('Fitted_garden_commons_10'));
for(const name of Object.keys(baseline))assert.equal(signature(garden.group.getObjectByName(name)),baseline[name],name);
const bridgeHash=createHash('sha256'),bridge=garden.group.getObjectByName('Blossom_bridge');
for(const name of ['position','normal'])bridgeHash.update(Buffer.from(bridge.geometry.attributes[name].array.buffer));
assert.equal(bridgeHash.digest('hex'),'1964d7af4524f55a79214a7bfbc4242f0b4b7434df47719c5472d10d66a98167','original bridge shape');
await import('./check-blossom-expansion.mjs');
for(const excluded of ['Fitted_garden_commons_01','Hydro_Nip_Lounge','Exterior']){
  const fixture=ship(excluded),before=signature(fixture.root);
  assert.equal(prepareBlossomBed(fixture),false,excluded+' is not prepared');
  assert.equal(createBlossomGarden(fixture),null,excluded+' gets no garden');
  assert.equal(signature(fixture.root),before,excluded+' is untouched');
}
const conservatory=createLayeredConservatory(),approach=new T.Box3(new T.Vector3(135,24.3,33.85),new T.Vector3(141.95,27.2,35.95));
const galleryWalk=new T.Box3(new T.Vector3(114,28.3,42),new T.Vector3(150,35.8,46));
const matrix=new T.Matrix4(),bounds=new T.Box3(),point=new T.Vector3();let triangles=0;
for(const mesh of conservatory.children){
  const position=mesh.geometry.attributes.position;triangles+=(mesh.geometry.index?.count??position.count)/3*mesh.count;
  for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);bounds.makeEmpty();
    for(let n=0;n<position.count;n++){point.fromBufferAttribute(position,n).applyMatrix4(matrix);assert.ok(point.toArray().every(Number.isFinite),'finite vertices');bounds.expandByPoint(point);}
    assert.ok(!bounds.intersectsBox(approach),mesh.name+' keeps bridge and bench approach clear');
    assert.ok(!bounds.intersectsBox(galleryWalk),mesh.name+' stays outside gallery walking area');
  }
}
assert.equal(signature(conservatory),signature(createLayeredConservatory()),'deterministic planting');
assert.ok(triangles<=46844,'planting stays below the 46,844 triangles it replaces');
assert.ok(conservatory.children.length<=8,'bounded draw count');
for(const suffix of ['','.authoring','.prepared','.public']){
  const source=await fs.readFile('src/walk/blossom'+suffix+'.js','utf8');
  assert.ok(source.includes('frame.add(createLayeredConservatory());preserveBlossomRandomSequence(rnd);'),'garden integration '+suffix);
}
// Run the actual authoring/replay pair with in-memory template transport. Only
// network resource loading is replaced; missing or drifted replay keys still fail.
const replayFile=path.resolve('.qa/conservatory-replay-check.mjs');
await build({stdin:{contents:"export {createBlossomGarden as author} from './src/walk/blossom.authoring.js';export {createBlossomGarden as replay} from './src/walk/blossom.public.js';",resolveDir:process.cwd(),loader:'js'},bundle:true,platform:'node',packages:'external',format:'esm',outfile:replayFile,plugins:[{
  name:'conservatory-memory-transport',setup(builder){
    builder.onResolve({filter:/plan\/rooms\.js$/},()=>({path:'room',namespace:'fixture'}));
    builder.onResolve({filter:/prepared-resource\.public\.js$/},()=>({path:'resource',namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='room'?'export const roomObject=(ship,id)=>ship.root.getObjectByName(id)||null;':`import {geometryRecords} from ${JSON.stringify(path.resolve('src/v2/prepared-geometry-record.js'))};export const preparedResource={geometryTemplates:geometryRecords()};`,loader:'js',resolveDir:process.cwd()}));
  },
}]});
const {author,replay}=await import(pathToFileURL(replayFile)),authored=author(ship('Fitted_garden_commons_10')),replayed=replay(ship('Fitted_garden_commons_10'));
assert.equal(signature(authored.group),signature(replayed.group),'public replay reproduces authoring geometry');
assert.equal(signature(authored.solid),signature(replayed.solid),'public replay reproduces collision geometry');
console.log(JSON.stringify({passed:true,protected:['original tree','red bridge shape','expanded pond collision','Hydro-Nip Lounge','exterior','bridge and bench approach','gallery routes'],plantingDraws:conservatory.children.length,plantingTriangles:triangles,replacedTriangles:46844},null,2));
