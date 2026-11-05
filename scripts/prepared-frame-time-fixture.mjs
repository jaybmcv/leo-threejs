import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {ZSTDDecoder} from 'three/addons/libs/zstddec.module.js';
import {gunzipSync} from 'node:zlib';
import {rememberPreparedStatic,settlePreparedStatic} from '../src/v2/prepared-static.js';
import {onePassAtriumGlass} from '../src/v2/atrium-visibility.js';
import {createSwimSuit} from '../src/walk/aquarium-treasure/suit.js';
import {showBands} from '../src/walk/render-bake.js';

// Exercise the saved public graph without loading its large geometry/collision arrays or rendering a flood.
// Live: three's own matrix update, or the hidden-skip wrapper that falls back to it whenever the branch is shown.
const live=o=>o.updateMatrixWorld===T.Object3D.prototype.updateMatrixWorld||!!o.updateMatrixWorld.liveWhenShown;
export async function checkPreparedFrameTime(){
 for(const suffix of ['', '.authoring', '.public'])assert((await fs.readFile('src/v2/prepared-runtime'+suffix+'.js','utf8')).includes('preparedBake(ship){rememberPreparedStatic(ship);'),'Prepared bake must capture fixed contents before late activities');
 for(const suffix of ['.prepared','.public'])assert(/batchLowDeckDraws\(baked,renderer\);(atriumGeometry=(?:preparedPhone\?null:)?createAtriumGeometryRuntime\(baked,renderer,\{[^;]*\}\);)?settlePreparedStatic\(ship\);/.test(await fs.readFile('src/walk/main'+suffix+'.js','utf8')),'Prepared startup must settle after all reparenting and batching');
 const bytes=await fs.readFile('output/leo-interior-v02/prepared-walk/world.bin'),decoder=new ZSTDDecoder();await decoder.init();
 const manifest=JSON.parse(new TextDecoder().decode(bytes[0]===0x28?decoder.decode(bytes):gunzipSync(bytes)));
 const geometry=new T.BufferGeometry(),materials=manifest.materials.map(m=>({transparent:!!m.transparent}));
 const graph=data=>{const nodes=new Map();for(const r of data.nodes){const material=Array.isArray(r.material)?r.material.map(i=>materials[i]):materials[r.material],o=r.geometry===undefined?new T.Group():r.instanceMatrix===undefined?new T.Mesh(geometry,material):new T.InstancedMesh(geometry,material,0);o.uuid=r.uuid;o.name=r.name;o.userData=structuredClone(r.userData);o.position.fromArray(r.position);o.quaternion.fromArray(r.quaternion);o.scale.fromArray(r.scale);o.matrixAutoUpdate=r.matrixAutoUpdate;if(r.matrix)o.matrix.fromArray(r.matrix);o.visible=r.visible;nodes.set(r.uuid,o);}for(const r of data.nodes)if(r.parent)nodes.get(r.parent).add(nodes.get(r.uuid));return nodes.get(data.root);};
 const bands=new Map(manifest.bands.map(([key,data])=>[key,graph(data)])),ship={v2PreparedBake:{bands},liveDraws:new T.Group()},scene=new T.Scene();
 const source=graph(manifest.source);source.traverse(o=>{if(o.isInstancedMesh){o.userData.cabinWalls=false;for(let p=o;p;p=p.parent)if(p.name==='V2_cabin_shells')o.userData.cabinWalls=true;}});
 const instances=[];source.traverse(o=>{if(o.isInstancedMesh)instances.push(o);});for(const o of instances)ship.liveDraws.attach(o);scene.add(ship.liveDraws);
 rememberPreparedStatic(ship);
 // Activities arrive after capture and must not inherit a frozen band parent.
 const first=bands.values().next().value,movingNames=['Lift_car','Lounge_door_panel','Launch_B_hangar_leaf','Provisions_curtain','Mars_Cat_Transporter','Walker','Aquarium_fish','Crew_service_barrier_panel','V2_default_cabin_frost'],moving=[];
 for(const name of movingNames){const group=new T.Group();group.name=name;group.add(new T.Mesh(geometry,materials[0]));first.add(group);moving.push(group);}
 const kept=new T.Group();kept.userData.keepLive=true;const keptMesh=new T.Mesh(geometry,materials[0]);kept.add(keptMesh);first.add(kept);
 // The scene gets its final parent transforms after capture, just as startup may attach bands later.
 scene.position.set(3,4,5);for(const group of bands.values())scene.add(group);first.position.set(7,8,9);
 scene.updateMatrixWorld(true);const expected=new Map();scene.traverse(o=>expected.set(o,o.matrixWorld.toArray()));
 settlePreparedStatic(ship);let total=0,pruned=0;scene.traverse(o=>{total++;if(!live(o))pruned++;assert.deepEqual(o.matrixWorld.toArray(),expected.get(o),'Settling moved '+o.name);});
 assert(pruned>6000&&pruned/total>.65,'Prepared graph must prune at least 6000 objects and 65% of this scene');
 for(const o of [...moving,kept,keptMesh,...bands.values()])assert(live(o),'Moving/extendable branch was settled: '+o.name);
 const mutableInstances=instances.filter(o=>o.userData.phase4||/^Cabin_v2_(door|ensuite-door)/.test(o.name)||[].concat(o.material||[]).some(m=>m.transparent));assert(mutableInstances.length>0);
 for(const o of mutableInstances)assert(live(o),'Mutable instances must stay live: '+o.name);
 for(const o of moving)o.position.x+=2;scene.updateMatrixWorld(true);for(const o of moving)assert.equal(o.matrixWorld.elements[12],expected.get(o)[12]+2,'Forced walk must update '+o.name);
 showBands(bands,-1e6,1e6);assert([...bands.values()].every(g=>g.visible));showBands(bands,1e6,1e6+1);assert([...bands.values()].every(g=>!g.visible));
 const main=await fs.readFile('src/walk/main.public.js','utf8');assert(/batchLowDeckDraws\(baked,renderer\);(atriumGeometry=(?:preparedPhone\?null:)?createAtriumGeometryRuntime\(baked,renderer,\{[^;]*\}\);)?settlePreparedStatic\(ship\);/.test(main),'Public startup must settle after all reparenting and batching');
 // Both startup orders must resolve a manually managed local matrix against its final parent.
 for(const attached of [false,true]){const parent=new T.Scene(),band=new T.Group(),leaf=new T.Mesh(geometry,materials[0]),extra=new T.Group(),testShip={v2PreparedBake:{bands:new Map([[0,band]])}};band.add(leaf);leaf.matrixAutoUpdate=false;leaf.matrix.makeTranslation(7,8,9);parent.position.set(3,4,5);if(attached)parent.add(band);rememberPreparedStatic(testShip);if(!attached)parent.add(band);band.add(extra);settlePreparedStatic(testShip);assert.deepEqual(leaf.matrixWorld.elements.slice(12,15),[10,12,14]);assert(live(band));extra.position.x=12;parent.updateMatrixWorld(true);assert.equal(extra.matrixWorld.elements[12],15);}
 const report={status:'PASS',total,pruned,share:pruned/total,mutableInstances:mutableInstances.length,movingNames,method:'Actual prepared node topology and transforms with empty geometry, plus named late-added moving branches; forced scene traversal and both band visibility states.'};
 // The real prepared materials and all three render scenes use the same one-pass policy.
 const textures=Object.fromEntries(manifest.textures.map(t=>[t.uuid,new T.Texture()])),loader=new T.MaterialLoader().setTextures(textures),glassScene=new T.Scene(),haze=new T.Scene(),sky=new T.Scene();let covered=0;
 for(const data of manifest.materials){const m=loader.parse(data);if(m.transparent&&m.side===T.DoubleSide)covered++;glassScene.add(new T.Mesh(geometry,m));}
 const arrayMaterials=[new T.MeshStandardMaterial({name:'Late_cabin_glass',transparent:true,side:T.DoubleSide}),new T.MeshStandardMaterial({name:'Opaque_double',side:T.DoubleSide}),new T.MeshStandardMaterial({name:'Transparent_front',transparent:true})];haze.add(new T.Mesh(geometry,arrayMaterials));sky.add(new T.Mesh(geometry,new T.MeshBasicMaterial({name:'Sky_glass',transparent:true,side:T.DoubleSide})));
 for(const root of [glassScene,haze,sky]){onePassAtriumGlass(root);root.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.transparent&&m.side===T.DoubleSide)assert(m.forceSinglePass,'Transparent double-sided material still uses two draws: '+m.name);});}
 assert(!arrayMaterials[1].forceSinglePass&&!arrayMaterials[2].forceSinglePass,'Unrelated material policy changed');assert(covered>=30,'Prepared fixture no longer covers the saved transparent double-sided material population');
 for(const file of ['main.js','main.authoring.js','main.prepared.js','main.public.js']){const source=await fs.readFile('src/walk/'+file,'utf8');assert(source.indexOf('for(const root of [scene,haze,sky])onePassAtriumGlass(root);')>source.indexOf('treasure=createTreasureGame('),'Scene policy must include the late aquarium entrance and ball in '+file);}
 const body=new T.Group(),suit=createSwimSuit({bones:new Map()},body);let helmets=0;body.traverse(o=>{if(o.material?.transparent&&o.material.side===T.DoubleSide){helmets++;assert(o.material.forceSinglePass,'Lazy swimmer helmet must be single-pass without a new scene scan');}});assert.equal(helmets,1);suit.dispose();
 report.glass={preparedMaterialsCovered:covered,allThreeScenes:true,materialArrays:true,unrelatedMaterialsUnchanged:true,lateStartupAndLazySuit:true};
 await fs.mkdir('output/frame-time',{recursive:true});await fs.writeFile('output/frame-time/matrix-fixture.json',JSON.stringify(report,null,2));console.log(report);return report;
}
