import '../src/model.authoring.js';
import '../src/model.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {createCanvas} from '@napi-rs/canvas';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {geometryRecords} from '../src/v2/prepared-geometry-record.js';

// Reproduce a warm prepared ship: old dimensions are recorded before the new
// public factories run. Keep the real strict replay lookup and room transforms.
installWalkCanvas(createCanvas);
const dir=path.resolve('.qa/lounge-runtime-templates');await fs.mkdir(dir,{recursive:true});
const replayPath=path.join(dir,'replay.mjs'),url=file=>pathToFileURL(path.resolve(file)).href;
let replay=await fs.readFile('src/v2/prepared-geometry-replay.public.js','utf8');
replay=replay.replace(/import \{preparedResource\} from .*?;/,`import {geometryRecords} from ${JSON.stringify(url('src/v2/prepared-geometry-record.js'))};const preparedResource={geometryTemplates:geometryRecords()};`)
 .replace("'./prepared-geometry-key.js'",JSON.stringify(url('src/v2/prepared-geometry-key.js')));
await fs.writeFile(replayPath,replay);
async function factory(name,suffix,{legacy=false}={}){
 const source=path.resolve('src/walk/'+name+suffix+'.js');let text=await fs.readFile(source,'utf8');
 if(legacy)text=text.replace('depth:2.08','depth:4').replace("import {LOUNGE_PLAN} from '../plan/lounge-layout-v2.js';","const LOUNGE_PLAN={arcadeWall:-92.06,arcadeStart:-47.25,arcadeGap:.95};");
 text=text.replace(/from (['"])(\.[^'"]+)\1/g,(_,q,rel)=>'from '+JSON.stringify(url(rel.includes('prepared-geometry-replay')?replayPath:path.resolve(path.dirname(source),rel))));
 const file=path.join(dir,name+(legacy?'-legacy':suffix||'-native')+'.mjs');await fs.writeFile(file,text);return import(url(file));
}
const oldGate=await factory('jaguar-gate','.authoring',{legacy:true}),oldArcade=await factory('arcade','.authoring',{legacy:true});oldGate.createJaguarGate();oldArcade.createArcade();
const records=geometryRecords(),oldKeys=new Set(records.keys());
assert(!oldKeys.has('src/walk/jaguar-gate.js:10|[1.08,3.68]'),'Fixture must lack the shortened throat template');
const signature=root=>{const hash=createHash('sha256');root.updateMatrixWorld(true);root.traverse(o=>{hash.update(o.name+o.matrixWorld.elements.join(','));if(o.geometry){for(const [name,a] of Object.entries(o.geometry.attributes))hash.update(name).update(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength));if(o.geometry.index)hash.update(Buffer.from(o.geometry.index.array.buffer));}});return hash.digest('hex');};
for(const [name,method] of [['jaguar-gate','createJaguarGate'],['arcade','createArcade']]){
 const native=await factory(name,''),expected=native[method]();
 for(const suffix of ['.public','.prepared','.authoring']){
  const mode=await factory(name,suffix),actual=mode[method]();
  assert.equal(signature(actual.group),signature(expected.group),name+suffix+' render parity');
  assert.equal(signature(actual.solid),signature(expected.solid),name+suffix+' collision parity');
  assert([...records.keys()].every(key=>oldKeys.has(key)),'Current factories must not require newly recorded templates');
 }
 console.log('PASS',name,'public/prepared/authoring match native geometry with old templates');
}
const {ReplayGeometry}=await import(url(replayPath));assert.throws(()=>new ReplayGeometry('src/walk/jaguar-gate.js:10',T.PlaneGeometry,1.08,3.68),/missing a fixed geometry template/,'Missing-template validation remains strict');
const retainedKey='src/walk/jaguar-gate.js:0|[1,24,12]',retained=records.get(retainedKey);assert(retained);records.delete(retainedKey);
try{const current=await factory('jaguar-gate','.public');assert.throws(()=>current.createJaguarGate(),/missing a fixed geometry template/,'Unchanged head geometry still requires its recorded template');}finally{records.set(retainedKey,retained);}
console.log('PASS strict missing-template negative controls');
