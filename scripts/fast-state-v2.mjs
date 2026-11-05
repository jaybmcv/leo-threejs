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
 'scripts/patch-models-v2.mjs','scripts/fast-fitout-data-v2.mjs','scripts/fast-room-cache-v2.mjs','scripts/patch-owned-spans-v2.mjs','scripts/legacy-room-data-v2.mjs','scripts/fast-fitout-mesh-data-v2.mjs','src/v2/legacy-room.js','src/v2/room-owner.js','scripts/fast-dressing-v2.mjs','src/v2/feature-owner.js'];
export const patchProducerIdentity=async()=>sha(JSON.stringify(await Promise.all(patchProducerFiles.map(async f=>[f,sourceHash(f,await fs.readFile(f))]))));
export async function captureActiveBuild(identity,{rooms=[],decks=[],smokeRooms=rooms}={}){
 const prepared=await verifyPrepared(),files={};for(const name of await modelFiles(output))files[name]=sha(await fs.readFile(output+'/'+name));
 const state={version:1,identity,patchProducer:await patchProducerIdentity(),prepared:prepared.sha256,files,rooms,decks,smokeRooms};
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
  if(!await compatiblePreparedSources(i.sourceInputs?.sources,identity,{artifactSha256:i.sha256}))throw Error('Warm baseline has changed geometry inputs; use a wider build');
  for(const [name,file]of Object.entries({skin:'leo-exterior-web.glb',layout:'layout.json',plan:'walk-plan.json'}))if(sha(await fs.readFile(output+'/'+file))!==i.sourceInputs[name])throw Error('Warm baseline input differs from prepared artifact: '+file);
  const models=await json(output+'/scoped-models.json');for(const[name,record]of Object.entries(models))if(sha(await fs.readFile(output+'/'+name+'.glb'))!==record.sha256)throw Error('Warm model differs from its completed export: '+name);
 }
 // Built in an empty folder and swapped in whole, so a model the build no longer makes can't survive in the baseline.
 const next=baseline+'.next',old=baseline+'.old';await fs.rm(next,{recursive:true,force:true});await fs.mkdir(next,{recursive:true});
 for(const e of await fs.readdir(output,{withFileTypes:true}))if(e.isFile()&&(/\.glb$/.test(e.name)||['layout.json','walk-plan.json','walk-map.png','exterior-envelopes.json','scoped-models.json'].includes(e.name)))await fs.copyFile(output+'/'+e.name,next+'/'+e.name);
 await fs.cp(output+'/prepared-walk',next+'/prepared-walk',{recursive:true});
 // Importing afresh is intentional: a full build and the next deploy run in
 // separate processes; no stale ESM module can hide a room edit.
 await runNode('scripts/fast-fitout-data-v2.mjs');
 await fs.copyFile('output/fast-deploy/fitout-current.json',next+'/fitout.json');
 await runNode('scripts/legacy-room-data-v2.mjs');await fs.copyFile('output/fast-deploy/legacy-current.json',next+'/legacy.json');
 await runNode('scripts/fast-fitout-mesh-data-v2.mjs');await fs.copyFile('output/fast-deploy/fitout-mesh-current.json',next+'/fitout-mesh.json');
 const files={};for(const name of (await fs.readdir(next)).filter(f=>f.endsWith('.glb')||['layout.json','walk-plan.json','walk-map.png','fitout.json','legacy.json','fitout-mesh.json'].includes(f)))files[name]=sha(await fs.readFile(next+'/'+name));
 const record={version:1,identity,prepared:i.sha256,files,captured:new Date().toISOString()};
 await fs.writeFile(next+'/state.json',JSON.stringify(record,null,2));
 await fs.rm(old,{recursive:true,force:true});await fs.rename(baseline,old).catch(e=>{if(e.code!=='ENOENT')throw e;});await fs.rename(next,baseline);await fs.rm(old,{recursive:true,force:true});
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
 let baselineIdentity=state.identity,migration=null;
 // One exact, output-neutral ownership/producer extraction can keep the old
 // room-fitout baseline useful. Legacy replacement still requires owner spans.
 try{migration=await json('scripts/fast-owner-migration.json');if(migration.from===state.identity.hash)baselineIdentity=migration.to;else migration=null;}catch{}
 const baselineRecord=async name=>{if(state.files?.[name+'.json'])return json(baseline+'/'+name+'.json');if(migration?.baselines?.[name])return migration.baselines[name];throw Error('Clean baseline lacks '+name+' ownership data');};
 const files=changedInputs(baselineIdentity.files,identity.files);
 const page=await (await import('./fast-dressing-v2.mjs')).authoringPageGuard();if(page)return {lane:'whole',reason:page,files,identity,rooms:[],decks:[]};
 if(!files.length)return {lane:'A',reason:'No geometry dependency changed',files,identity,rooms:[],decks:[]};
 const active=await activeBuildMatches(identity);
 if(active)return {lane:'A',reuse:'active',reason:'Geometry matches the verified previous room patch',files,identity,rooms:active.rooms||[],decks:active.decks||[],smokeRooms:active.smokeRooms||active.rooms||[]};
 // Lane D: only a qualified dressing's own module changed, and nothing else imports it (fast-dressing-v2.mjs).
 const dressing=await (await import('./fast-dressing-v2.mjs')).classifyDressings(files);
 if(dressing?.reason)return {lane:'whole',reason:dressing.reason,files,identity,rooms:[],decks:[]};
 if(dressing)return {lane:'D',reason:'Changed only an additive dressing ('+dressing.dressings.join(', ')+')',files,identity,rooms:[],decks:[],smokeRooms:[],dressings:dressing.dressings,basePrepared:state.prepared,patchProducer:await patchProducerIdentity()};
 const programmeInputs=new Set(['src/plan/room-fitout-overrides-v2.json','src/v2/phase4-programme.js','src/v2/phase6-programme.js','src/v2/launch-d-fitout.js']);
 const kitInputs=new Set(['src/v2/phase4-mesh-kit.js']);
 const legacyInputs=new Set(['src/special-areas.js','src/areas.js','src/area-finish.js','src/command-deck.js','src/neighborhood-services.js','src/lower-aft.js','src/lower-bow.js','src/upper-aft.js','src/voyage-forum.js','src/v2/room-shell.js']);
 if(files.some(f=>!programmeInputs.has(f)&&!legacyInputs.has(f)&&!kitInputs.has(f)))return {lane:'whole',reason:'Changed shared geometry or an unsupported authoring producer',files,identity,rooms:[],decks:[]};
 await fs.copyFile(baseline+'/layout.json',output+'/layout.json');
 let kitRooms=[],kitAfter={};
 if(files.some(f=>kitInputs.has(f))){try{await baselineRecord('fitout-mesh');}catch{return {lane:'whole',reason:'Mesh-kit baseline requires one clean build',files,identity,rooms:[],decks:[]};}
  await runNode('scripts/fast-fitout-mesh-data-v2.mjs');const before=await baselineRecord('fitout-mesh');kitAfter=await json('output/fast-deploy/fitout-mesh-current.json');kitRooms=[...new Set([...Object.keys(before),...Object.keys(kitAfter)])].filter(id=>JSON.stringify(before[id])!==JSON.stringify(kitAfter[id]));
  if(kitRooms.includes('@shared-shell-glass'))return {lane:'whole',reason:'Kit glass also changes shared neighborhood shell materials',files,identity,rooms:[],decks:[]};
 }
 const legacyChanged=files.some(f=>legacyInputs.has(f));let legacyRooms=[],shellRooms=[],legacyAfter={};
 if(legacyChanged){
  try{await baselineRecord('legacy');}catch{return {lane:'whole',reason:'Legacy ownership baseline requires one clean authoring run',files,identity,rooms:[],decks:[]};}
  await runNode('scripts/legacy-room-data-v2.mjs');const legacyBefore=await baselineRecord('legacy');legacyAfter=await json('output/fast-deploy/legacy-current.json');
  const ids=[...new Set([...Object.keys(legacyBefore),...Object.keys(legacyAfter)])];
  legacyRooms=ids.filter(id=>legacyBefore[id]?.sourceSignature!==legacyAfter[id]?.sourceSignature);
  shellRooms=ids.filter(id=>legacyBefore[id]?.shellSignature!==legacyAfter[id]?.shellSignature);
  if(ids.some(id=>JSON.stringify(legacyBefore[id]?.area)!==JSON.stringify(legacyAfter[id]?.area))||legacyRooms.some(id=>!legacyAfter[id]?.eligible||!legacyBefore[id]?.eligible)||shellRooms.some(id=>!legacyAfter[id]?.shellEligible||!legacyBefore[id]?.shellEligible))return {lane:'whole',reason:'Changed room frame, hull boundary, or a room with later world/activity passes',files,identity,rooms:[...new Set([...legacyRooms,...shellRooms])],decks:[]};

 }
 // A cancelled wider build may have replaced generated frames before models.
 // Programme-only edits must be evaluated against the known clean frames.
 await fs.copyFile(baseline+'/layout.json',output+'/layout.json');
 await runNode('scripts/fast-fitout-data-v2.mjs');
 const before=await json(baseline+'/fitout.json'),after=await json('output/fast-deploy/fitout-current.json');
 const byRoom=data=>{const m=new Map();for(const type of ['parts','rests'])for(const row of data[type]){let record=m.get(row.room);if(!record)m.set(row.room,record={parts:[],rests:[]});record[type].push(row);}return m;};
 const a=byRoom(before),b=byRoom(after),rooms=[...new Set([...legacyRooms,...shellRooms,...kitRooms,...[...new Set([...a.keys(),...b.keys()])].filter(id=>JSON.stringify(a.get(id))!==JSON.stringify(b.get(id)))])].sort();
 const layout=await json(baseline+'/layout.json'),decks=[...new Set(rooms.map(id=>layout.rooms.find(r=>r.id===id)?.deck||kitAfter[id]?.deck||Number(/^circulation-(\d+)$/.exec(id)?.[1])))].filter(Boolean).sort((a,b)=>a-b);
 // Text signs are baked into shared render bands; until those are split by
 // owner they need normal authoring. Furniture additions/removals stay local.
 const signsChanged=rooms.some(id=>JSON.stringify(a.get(id)?.parts.filter(p=>p.text)||[])!==JSON.stringify(b.get(id)?.parts.filter(p=>p.text)||[]));
 const synthetic=id=>kitRooms.includes(id)&&/^atrium6-(food|commons|stage|lobby|park|lake)$/.test(id);
 if(signsChanged||rooms.some(id=>!id||!layout.rooms.some(r=>r.id===id)&&!synthetic(id)||/escape/.test(id)))return {lane:'whole',reason:'Room sign or assembly change needs wider authoring',files,identity,rooms,decks};
 const smokeRooms=[...new Set(rooms.map(id=>{if(!synthetic(id))return id;const at=b.get(id)?.parts[0]?.at||[0,0,0];return layout.rooms.filter(r=>r.deck===6&&r.door).sort((p,q)=>Math.hypot(p.door.center[0]-at[0],p.door.center[2]-at[2])-Math.hypot(q.door.center[0]-at[0],q.door.center[2]-at[2]))[0]?.id;}).filter(Boolean))];
 if(rooms.length&&!Object.keys(kitAfter).length){await runNode('scripts/fast-fitout-mesh-data-v2.mjs');kitAfter=await json('output/fast-deploy/fitout-mesh-current.json');}
 const legacyBase=await baselineRecord('legacy').catch(()=>({}));
 const roomKeys=Object.fromEntries(rooms.map(id=>{const source=legacyAfter[id]||legacyBase[id];return [id,sha(JSON.stringify([b.get(id),source?.sourceSignature,source?.shellSignature,kitAfter[id]?.signature]))];}));
 return {lane:rooms.length?'B':'A',reason:rooms.length?'Room geometry output diff':'Geometry source changed without a room output change',files,identity,rooms,decks,smokeRooms,legacyRooms,shellRooms,roomKeys,basePrepared:state.prepared,patchProducer:await patchProducerIdentity()};
}

if(process.argv[1]&&path.basename(process.argv[1])==='fast-state-v2.mjs')console.log(JSON.stringify(await (process.argv.includes('--capture')?captureFastBaseline({bootstrap:true}):classifyFastChange()),null,2));
