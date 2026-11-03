import './v2-output.mjs';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ensureV1Inputs} from './v2-baseline-inputs.mjs';
import {v2 as selectedV2} from './layout-selector.mjs';
import {runV2} from './run-v2.mjs';
import {stageTimer,runNode} from './fast-timing.mjs';
if(!selectedV2)throw Error('This producer requires LEO_LAYOUT=2');
const out='output/leo-interior-v02',timer=stageTimer({file:'output/fast-deploy/full-build-timing.json',label:'full build'});
try{
 await fs.mkdir(out,{recursive:true});await fs.mkdir('output/phase3b/startup',{recursive:true});await ensureV1Inputs();
 const scoped=process.argv.find(a=>/^--(decks|room|assembly|producer)=/.test(a));if(scoped)process.env.LEO_BUILD_SCOPE=scoped.slice(2);
 const {scopedStages}=await import('./scoped-stages-v2.mjs'),stages=await scopedStages();
 for(const name of ['layout','exterior'])await timer.stage(name,()=>stages.run(name));
 await timer.stage('normalize exterior',async()=>{await(await import('./normalize-exterior-before-rooms-v2.mjs')).normalizeExteriorBeforeRooms();});
 await timer.stage('ceilings',()=>stages.run('ceilings'));
 if(process.argv.includes('--stages-only'))await stages.save();
 else{
 await fs.copyFile('output/leo-interior-v01/THREE-LICENSE.txt',out+'/THREE-LICENSE.txt');
 await timer.stage('models and walk plan',()=>runV2('build'));
 await timer.stage('model finalization',async()=>{await runNode('scripts/retire-obsolete-facades-v2.mjs');await(await import('./raw-skin-source-proof-v2.mjs')).publishRawSkinSource();});
 await stages.save();
 const exported=JSON.parse(await fs.readFile(out+'/scoped-models.json'));
 for(const[name,r]of Object.entries(exported)){const bytes=await fs.readFile(out+'/'+name+'.glb');r.sha256=createHash('sha256').update(bytes).digest('hex');r.bytes=bytes.length;}
 await fs.writeFile(out+'/scoped-models.json',JSON.stringify(exported,null,2));
 if(!process.argv.includes('--skip-prepared')){
 await timer.stage('prepared authoring',async()=>{await(await import('./prepared-authoring-lock-v2.mjs')).runPreparedAuthoring();});
 await timer.stage('prepared encoding',()=>runNode('scripts/encode-prepared-walk-v2.mjs'));
 await timer.stage('save clean baseline',async()=>{await(await import('./fast-state-v2.mjs')).captureFastBaseline();});
 }
 }
}finally{await timer.finish();}
