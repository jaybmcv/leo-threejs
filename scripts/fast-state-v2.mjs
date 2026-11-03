import fs from 'node:fs/promises';
import path from 'node:path';
import {geometryIdentity,sha,sourceHash,changedInputs} from './fast-dependencies-v2.mjs';
import {runNode} from './fast-timing.mjs';

export const output='output/leo-interior-v02';
export const baseline=output+'/fast-base';
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const modelFiles=async directory=>(await fs.readdir(directory)).filter(f=>f.endsWith('.glb')||['layout.json','walk-plan.json','walk-map.png','exterior-envelopes.json'].includes(f));
// A patch-writer fix must invalidate a prior active patch even when the room
// descriptors are identical. It does not invalidate the clean full-build base.
const patchProducerFiles=['scripts/build-fast-v2.mjs','scripts/fast-state-v2.mjs',
 'scripts/fast-room-patch-v2.mjs','scripts/prepared-patch-v2.mjs',
 'scripts/patch-models-v2.mjs','scripts/fast-fitout-data-v2.mjs'];
const patchProducerIdentity=async()=>sha(JSON.stringify(await Promise.all(patchProducerFiles.map(async f=>[f,sourceHash(f,await fs.readFile(f))]))));
export async function captureActiveBuild(identity,{rooms=[],decks=[]}={}){
 const prepared=await verifyPrepared(),files={};for(const name of await modelFiles(output))files[name]=sha(await fs.readFile(output+'/'+name));
 const state={version:1,identity,patchProducer:await patchProducerIdentity(),prepared:prepared.sha256,files,rooms,decks};
 await fs.writeFile(output+'/fast-active.json.tmp',JSON.stringify(state,null,2));await fs.rename(output+'/fast-active.json.tmp',output+'/fast-active.json');
}
async function activeBuildMatches(identity){
 try{const state=await json(output+'/fast-active.json');if(state.identity.hash!==identity.hash)return false;
  if(state.patchProducer!==await patchProducerIdentity())return false;
  if((await verifyPrepared()).sha256!==state.prepared)return false;
  if(JSON.stringify((await modelFiles(output)).sort())!==JSON.stringify(Object.keys(state.files).sort()))return false;
  for(const[name,value]of Object.entries(state.files))if(sha(await fs.readFile(output+'/'+name))!==value)return false;
  return state;
 }catch{return false;}
}
export async function verifyPrepared(directory=output+'/prepared-walk'){
 const i=await json(directory+'/integrity.json'),h=(await import('node:crypto')).createHash('sha256');
 for(const f of [...i.files].sort()){if(!/^(geometry-\d+\.bin|world\.bin|world\.json\.gz)$/.test(f))throw Error('Invalid prepared file '+f);h.update(f).update(await fs.readFile(directory+'/'+f));}
 if(h.digest('hex')!==i.sha256)throw Error('Prepared artifact integrity mismatch: '+directory);
 return i;
}

export async function captureFastBaseline({bootstrap=false}={}){
 const i=await verifyPrepared(),identity=await geometryIdentity();
 if(bootstrap){
  const {compatiblePreparedSources}=await import('./prepared-identity-v2.mjs');
  if(!await compatiblePreparedSources(i.sourceInputs?.sources,identity))throw Error('Warm baseline has changed geometry inputs; use a wider build');
  for(const [name,file]of Object.entries({skin:'leo-exterior-web.glb',layout:'layout.json',plan:'walk-plan.json'}))if(sha(await fs.readFile(output+'/'+file))!==i.sourceInputs[name])throw Error('Warm baseline input differs from prepared artifact: '+file);
  const models=await json(output+'/scoped-models.json');for(const[name,record]of Object.entries(models))if(sha(await fs.readFile(output+'/'+name+'.glb'))!==record.sha256)throw Error('Warm model differs from its completed export: '+name);
 }
 await fs.mkdir(baseline,{recursive:true});
 for(const e of await fs.readdir(output,{withFileTypes:true}))if(e.isFile()&&(/\.glb$/.test(e.name)||['layout.json','walk-plan.json','walk-map.png','exterior-envelopes.json','scoped-models.json'].includes(e.name)))await fs.copyFile(output+'/'+e.name,baseline+'/'+e.name);
 await fs.cp(output+'/prepared-walk',baseline+'/prepared-walk',{recursive:true});
 // Importing afresh is intentional: a full build and the next deploy run in
 // separate processes; no stale ESM module can hide a room edit.
 await runNode('scripts/fast-fitout-data-v2.mjs');
 await fs.copyFile('output/fast-deploy/fitout-current.json',baseline+'/fitout.json');
 const files={};for(const name of (await fs.readdir(baseline)).filter(f=>f.endsWith('.glb')||['layout.json','walk-plan.json','walk-map.png','fitout.json'].includes(f)))files[name]=sha(await fs.readFile(baseline+'/'+name));
 const record={version:1,identity,prepared:i.sha256,files,captured:new Date().toISOString()};
 await fs.writeFile(baseline+'/state.json',JSON.stringify(record,null,2));
 return record;
}

export async function readFastBaseline(){
 let state;try{state=await json(baseline+'/state.json');}catch(e){if(e.code!=='ENOENT')throw e;return captureFastBaseline({bootstrap:true});}
 if((await verifyPrepared(baseline+'/prepared-walk')).sha256!==state.prepared)throw Error('Clean prepared baseline changed during an interrupted build');
 for(const [name,value]of Object.entries(state.files||{}))if(sha(await fs.readFile(baseline+'/'+name))!==value)throw Error('Clean model baseline changed: '+name);
 return state;
}

export async function classifyFastChange(){
 const identity=await geometryIdentity();let state;try{state=await readFastBaseline();}catch(e){return {lane:'whole',reason:e.message,files:[],identity,rooms:[],decks:[]};}
 const files=changedInputs(state.identity.files,identity.files);
 if(!files.length)return {lane:'A',reason:'No geometry dependency changed',files,identity,rooms:[],decks:[]};
 const active=await activeBuildMatches(identity);
 if(active)return {lane:'A',reuse:'active',reason:'Geometry matches the verified previous room patch',files,identity,rooms:active.rooms||[],decks:active.decks||[]};
 // Semantic programme output, rather than filenames or a per-room allowlist,
 // determines which owners need replacing. Shared meshing/kit changes widen.
 // These modules produce only descriptors consumed by the patch builder.
 // launch-e and community modules also drive shells/paintings/routes outside
 // this descriptor stream, so a file edit there must widen for now.
 const programmeInputs=new Set(['src/plan/room-fitout-overrides-v2.json','src/v2/phase4-programme.js','src/v2/phase6-programme.js','src/v2/launch-d-fitout.js']);
 if(files.some(f=>!programmeInputs.has(f)))return {lane:'whole',reason:'Changed shared geometry or an unsupported authoring producer',files,identity,rooms:[],decks:[]};
 // A cancelled wider build may have replaced generated frames before models.
 // Programme-only edits must be evaluated against the known clean frames.
 await fs.copyFile(baseline+'/layout.json',output+'/layout.json');
 await runNode('scripts/fast-fitout-data-v2.mjs');
 const before=await json(baseline+'/fitout.json'),after=await json('output/fast-deploy/fitout-current.json');
 const byRoom=data=>{const m=new Map();for(const type of ['parts','rests'])for(const row of data[type]){let record=m.get(row.room);if(!record)m.set(row.room,record={parts:[],rests:[]});record[type].push(row);}return m;};
 const a=byRoom(before),b=byRoom(after),rooms=[...new Set([...a.keys(),...b.keys()])].filter(id=>JSON.stringify(a.get(id))!==JSON.stringify(b.get(id))).sort();
 const layout=await json(baseline+'/layout.json'),decks=[...new Set(rooms.map(id=>layout.rooms.find(r=>r.id===id)?.deck||Number(/^circulation-(\d+)$/.exec(id)?.[1])))].filter(Boolean).sort((a,b)=>a-b);
 // Text signs are baked into shared render bands; until those are split by
 // owner they need normal authoring. Furniture additions/removals stay local.
 const signsChanged=rooms.some(id=>JSON.stringify(a.get(id)?.parts.filter(p=>p.text)||[])!==JSON.stringify(b.get(id)?.parts.filter(p=>p.text)||[]));
 if(signsChanged||rooms.some(id=>!id||!layout.rooms.some(r=>r.id===id)||/escape/.test(id)))return {lane:'whole',reason:'Room sign or assembly change needs wider authoring',files,identity,rooms,decks};
 return {lane:rooms.length?'B':'A',reason:rooms.length?'Room fitout descriptor diff':'Geometry source changed without a fitout output change',files,identity,rooms,decks};
}

if(process.argv[1]&&path.basename(process.argv[1])==='fast-state-v2.mjs')console.log(JSON.stringify(await (process.argv.includes('--capture')?captureFastBaseline({bootstrap:true}):classifyFastChange()),null,2));
