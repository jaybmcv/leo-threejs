import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {moduleSpecifiers} from './native-bundle.mjs';
import {PreparedPatch,preparedArrayReader,preparedManifest,compress} from './prepared-patch-v2.mjs';
import {liveLayoutIdentity} from './live-layout-identity.mjs';
import layout from '../src/plan/selected-layout.js';
import {sourceHash} from './fast-dependencies-v2.mjs';

assert.equal(sourceHash('fixture.js',Buffer.from('const a=1;\r\n')),sourceHash('fixture.js',Buffer.from('const a=1;\n')));
assert.notEqual(sourceHash('fixture.glb',Buffer.from('binary\r\n')),sourceHash('fixture.glb',Buffer.from('binary\n')));

const text=`import type { X } from './missing.js';
import { y } from './y.js'; export { z } from './z.js';
const x="import bad from './bad.js'"; // import bad from './comment.js'
const t=\`import bad from './template.js'\`; const d=import('./d.js');`;
assert.deepEqual(moduleSpecifiers(text).map(r=>r.value),['./y.js','./z.js','./d.js']);
const dir='output/fast-deploy/codec-fixture';await fs.mkdir(dir,{recursive:true});
const base=Float32Array.of(1,2,3),old=Buffer.from(base.buffer);await fs.writeFile(dir+'/geometry-0.bin',compress(old));
const m={parts:[{name:'geometry-0.bin',bytes:old.length,zipped:(await fs.stat(dir+'/geometry-0.bin')).size}],arrays:[{type:'Float32Array',start:0,bytes:old.length}],geometries:[],materials:[],textures:[],images:[]};
await fs.writeFile(dir+'/complete.json','{}');const patch=new PreparedPatch(m),next=Float32Array.of(4,5,6,7),index=patch.array(next),empty=patch.array(new Uint32Array());
await patch.save(dir+'/patched',dir,{},{});const read=preparedArrayReader(await preparedManifest(dir+'/patched'),dir+'/patched');
assert.deepEqual([...await read(0)],[...base]);assert.deepEqual([...await read(index)],[...next]);assert.deepEqual([...await read(empty)],[]);
assert((await fs.readFile(dir+'/geometry-0.bin')).equals(await fs.readFile(dir+'/patched/geometry-0.bin')));
const baseline=JSON.parse(await fs.readFile('src/plan/live-protocol-baseline-v2.json','utf8')),identity=await liveLayoutIdentity(layout);assert.equal(identity.layoutIdentity,baseline.layoutIdentity);
const cosmetic=structuredClone(layout);cosmetic.rooms.find(r=>r.id==='d01-new-2').name+=' cosmetic test';assert.equal((await liveLayoutIdentity(cosmetic)).layoutIdentity,identity.layoutIdentity);
const moved=structuredClone(layout),gym=moved.rooms.find(r=>r.id==='d16-gym-3');(gym.fittingFrame||gym.frame).origin[0]+=1;assert.notEqual((await liveLayoutIdentity(moved)).layoutIdentity,identity.layoutIdentity);
console.log('PASS: native import scanner, independent patch buffers, preserved baseline, cosmetic identity, moved activity identity');
