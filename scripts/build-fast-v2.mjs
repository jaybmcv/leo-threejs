import fs from 'node:fs/promises';
import {classifyFastChange,captureActiveBuild,output,baseline} from './fast-state-v2.mjs';
import {stageTimer,runNode} from './fast-timing.mjs';
import {preparedSourceIdentity} from './prepared-identity-v2.mjs';

process.env.LEO_LAYOUT='2';
const tag=process.env.LEO_FAST_TAG||'last',timer=stageTimer({file:'output/fast-deploy/'+tag+'-build-timing.json',label:'fast build'});
try{
 const plan=await timer.stage('classify changes',classifyFastChange);console.log(`Fast lane ${plan.lane}: ${plan.reason}`);
 await fs.mkdir('output/fast-deploy',{recursive:true});await fs.writeFile('output/fast-deploy/plan.json',JSON.stringify(plan,null,2));
 let details={};
 if(plan.lane==='whole'){
  await timer.stage('wider geometry build',()=>runNode('scripts/build-all.mjs',plan.decks.length?['--decks='+plan.decks.join(',')]:[]));
 }else if(plan.lane==='B'){
  for(const name of ['layout.json','walk-plan.json','walk-map.png','exterior-envelopes.json'])await fs.copyFile(baseline+'/'+name,output+'/'+name);
  details=await (await import('./fast-room-patch-v2.mjs')).patchRooms(plan,timer);
 }else if(plan.reuse!=='active'){
  const current=await preparedSourceIdentity();
   await fs.cp(baseline+'/prepared-walk',output+'/prepared-walk',{recursive:true});
   for(const name of (await fs.readdir(baseline)).filter(f=>f.endsWith('.glb')))await fs.copyFile(baseline+'/'+name,output+'/'+name);
   const restored=JSON.parse(await fs.readFile(output+'/prepared-walk/integrity.json','utf8'));restored.sourceInputs.sources=current;await fs.writeFile(output+'/prepared-walk/integrity.json',JSON.stringify(restored,null,2));
  // A previous interrupted wider build may have written layout data before
  // the prepared artifact. Restore the matching baseline input as well.
  for(const name of ['layout.json','walk-plan.json','walk-map.png','exterior-envelopes.json'])await fs.copyFile(baseline+'/'+name,output+'/'+name);
 }
 if(plan.lane!=='whole')await timer.stage('save verified active build',()=>captureActiveBuild(plan.identity,plan));
 await fs.writeFile('output/fast-deploy/'+tag+'-build.json',JSON.stringify({plan,details},null,2));
}finally{await timer.finish();}
