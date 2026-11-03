import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runNode} from './fast-timing.mjs';
import {classifyFastChange,baseline,output} from './fast-state-v2.mjs';
const file='src/v2/phase4-programme.js',source=await fs.readFile(file,'utf8'),needle="add('workbench',[3.2,.90,1.0]";
assert(source.includes(needle),'Run recovery fixture with the default workbench source');
let model;
try{
 await fs.writeFile(file,source.replace(needle,"add('workbench',[3.4,.90,1.0]"));
 await runNode('scripts/build-fast-v2.mjs',[],{env:{...process.env,LEO_LAYOUT:'2',LEO_FAST_TAG:'active-recovery'}});
 const active=await classifyFastChange();assert.equal(active.lane,'A');assert.equal(active.reuse,'active');assert.deepEqual(active.rooms,['d01-new-2'],'A retry must retain the changed-room smoke targets');
 const activeFile=output+'/fast-active.json',activeBytes=await fs.readFile(activeFile),stale=JSON.parse(activeBytes);stale.patchProducer='old patch writer';
 try{await fs.writeFile(activeFile,JSON.stringify(stale));assert.equal((await classifyFastChange()).lane,'B','A patch-writer change must rebuild the active patch');}finally{await fs.writeFile(activeFile,activeBytes);}
 const target=output+'/leo-full-ship.glb';model=await fs.readFile(target);await fs.appendFile(target,Buffer.from([1]));
 const damaged=await classifyFastChange();assert.equal(damaged.lane,'B','Damaged active model must be regenerated from the clean base');
 await fs.writeFile(target,model);model=null;
 await fs.writeFile(output+'/layout.json','{}');const interrupted=await classifyFastChange();assert.equal(interrupted.lane,'B');assert.deepEqual(interrupted.rooms,['d01-new-2']);
 assert((await fs.readFile(output+'/layout.json')).equals(await fs.readFile(baseline+'/layout.json')),'Classification must restore known clean frames before evaluating a room edit');
}finally{
 if(model)await fs.writeFile(output+'/leo-full-ship.glb',model);
 await fs.writeFile(file,source);
 await runNode('scripts/build-fast-v2.mjs',[],{env:{...process.env,LEO_LAYOUT:'2',LEO_FAST_TAG:'recovery-restore'}});
}
assert((await fs.readFile(output+'/leo-full-ship.glb')).equals(await fs.readFile(baseline+'/leo-full-ship.glb')));
console.log('PASS: active room reuse retains smoke targets; corrupted active model and interrupted layout recover; source and baseline restored');
