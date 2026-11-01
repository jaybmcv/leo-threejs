import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import layout from 'v2-layout';
import {configureV2Ship} from '../src/v2/model.js';
import {removeGardenSlabCaps} from '../src/v2/launch-b-geometry.js';
import {subtractRect} from '../src/v2/hull-prototypes.js';
import {glass} from '../src/v2/geometry.js';
import {chartPoint,triangulate,worldPoint} from '../src/plan/hull-skin-v2.js';
import {roomCoreFinishFaces,coplanarOverlaps} from '../src/plan/coplanar-v2.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
const r=layout.rooms.find(r=>r.id==='commons-1'),p=layout.hullPrototypes.prototypes.find(p=>p.id===r.id),root=new T.Group(),shared=new T.Group();
const decks=[17,18,19].map(number=>{const g=new T.Group();g.userData.number=number;root.add(g);return g;});
const ship={root,inside:root,shared,decks,residentialDecks:new Map(),ensureServiceDeck:()=>[]};root.add(shared);configureV2Ship(ship);
// Match the unchanged entry-glass producer, including its actual door apertures.
let panels=[[[p.rect[0],0,p.fixedV],[p.rect[1],0,p.fixedV],[p.rect[1],p.rect[3],p.fixedV],[p.rect[0],p.rect[3],p.fixedV]]];
for(const door of [r.door,...(r.galleryDoors||[])].filter(Boolean)){const q=chartPoint(p.chart,door.center);if(Math.abs(q[2]-p.fixedV)>.3)continue;panels=panels.flatMap(poly=>subtractRect(poly,[q[0]-door.width/2,q[0]+door.width/2,q[1],q[1]+2.5]));}
const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(panels.flatMap(triangulate).flatMap(t=>t.flatMap(q=>worldPoint(p.chart,q))),3)),entry=new T.Mesh(g,glass);entry.name='V2_prototype_garden_entry_glass';entry.userData={room:r.id,batchedEnvelope:true};g.userData.finishParts=[{start:0,count:g.attributes.position.count,name:entry.name,room:r.id}];root.add(entry);
function audit(){const testRoot=root.clone(true);testRoot.updateMatrixWorld(true);return coplanarOverlaps(roomCoreFinishFaces({root:testRoot,inside:testRoot},{...r,finishedFloorRise:.006,finishedCeilingDepth:.1}));}
function horizontalDigest(){const h=createHash('sha256');for(const d of decks){const geo=d.getObjectByName('Deck_slab').geometry,pos=geo.attributes.position,ix=geo.index;for(let i=0;i<(ix?.count??pos.count);i+=3){const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pos,ix?ix.getX(i+k):i+k));if(v.every(q=>Math.abs(q.y-v[0].y)<1e-6))h.update(JSON.stringify(v.map(q=>q.toArray())));}}return h.digest('hex');}
const before=audit(),supportHash=horizontalDigest();assert.equal(before.length,46,'Unfixed source slabs must reproduce all 46 overlaps');const changes=removeGardenSlabCaps(root,layout),after=audit();assert.equal(changes.reduce((n,q)=>n+q.removedFaces,0),12,'Eight existing end caps plus four recessed front caps');assert.equal(after.length,0,'Corrected source slabs must pass the unchanged finish audit');assert.equal(horizontalDigest(),supportHash,'Every horizontal support face stays byte-identical');root.updateMatrixWorld(true);
// The retained glass closes both sides of each removed cap; its existing door stays open.
const caster=new T.Raycaster(),levels=[r.y+.1,28.1,28.29,32.1,32.29],probes=[];
for(let x=-140;x<=-89;x+=3)for(const y of levels){if(Math.abs(x-r.door.center[0])<r.door.width/2&&y<r.y+2.5)continue;for(const side of [-1,1]){caster.set(new T.Vector3(x,y,-24+side),new T.Vector3(0,0,-side));caster.far=2;assert(caster.intersectObject(entry,false).length,'Continuous entry glass closes the cap from either side');probes.push({x,y,side});}}
caster.set(new T.Vector3(r.door.center[0],r.y+1.25,-23),new T.Vector3(0,0,-1));assert.equal(caster.intersectObject(entry,false).length,0,'Existing door opening stays clear');
const report={status:'PASS',scope:'Three-deck structural rebuild through configureV2Ship and normal cap cleanup; no prepared build',decks:[17,18,19],counterfactualPairs:before.length,correctedPairs:after.length,removedFaces:changes.reduce((n,q)=>n+q.removedFaces,0),horizontalSupportHash:supportHash,coverageProbes:probes.length,doorClear:true};
await fs.mkdir('output/launch-b',{recursive:true});await fs.writeFile('output/launch-b/entry-glass-fixture.json',JSON.stringify(report,null,2));globalThis.FileReader??=class{readAsArrayBuffer(b){b.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};await fs.writeFile('output/launch-b/entry-decks-17-19.glb',Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true})));console.log(report);
