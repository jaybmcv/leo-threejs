import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {phase4Programme} from '../src/v2/phase4-programme.js';
import {communityDisplayParts} from '../src/v2/community-displays.js';
import {buildPhase4Fitout} from '../src/v2/phase4-fitout.js';
import {atriumGlass} from '../src/v2/phase4-mesh-kit.js';
import {onePassAtriumGlass} from '../src/v2/atrium-visibility.js';

const descriptors=phase4Programme(layout),ids=new Set([...descriptors.parts,...communityDisplayParts(layout)].flatMap(p=>[p.room,p.component].filter(Boolean)));ids.add('circulation-2');
const fit=buildPhase4Fitout({inside:new T.Group()},layout,{rooms:[...ids]}),records=new Map();
for(const root of fit.roots){onePassAtriumGlass(root);root.updateMatrixWorld(true);root.traverse(o=>{
 if(!o.isInstancedMesh)return;
 const h=createHash('sha256');for(const [name,a]of Object.entries(o.geometry.attributes).sort())h.update(name).update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));
 if(o.geometry.index)h.update(Buffer.from(o.geometry.index.array.buffer));const material=o.material.toJSON();delete material.uuid;h.update(JSON.stringify([o.name,o.userData.noCollide,material]));const mesh=h.digest('hex');
 for(const run of o.userData.ownerRuns){const id=run.component||run.room;let record=records.get(id);if(!record)records.set(id,record={hash:createHash('sha256'),deck:o.userData.v2Deck});
  record.hash.update(mesh);for(let i=run.start;i<run.start+run.count;i++)record.hash.update(Buffer.from(o.instanceMatrix.array.buffer,o.instanceMatrix.array.byteOffset+i*64,64));
 }
 });}
const result=Object.fromEntries([...records].map(([id,r])=>[id,{signature:r.hash.digest('hex'),deck:r.deck}])),shared=atriumGlass.toJSON();delete shared.uuid;result['@shared-shell-glass']={signature:createHash('sha256').update(JSON.stringify(shared)).digest('hex')};
await fs.mkdir('output/fast-deploy',{recursive:true});await fs.writeFile('output/fast-deploy/fitout-mesh-current.json',JSON.stringify(result,null,2));console.log('Fingerprinted actual fitout meshes for '+records.size+' owners');
