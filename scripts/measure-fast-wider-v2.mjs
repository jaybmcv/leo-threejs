import fs from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';

const file='src/v2/phase4-fitout.js',original=await fs.readFile(file,'utf8'),needle="const geo=fitoutGeometry(b),o=new T.InstancedMesh";
assert(original.includes(needle));
const deadline=Date.parse(process.argv.find(a=>a.startsWith('--deadline='))?.slice(11)||'')||Date.now()+90*60*1000;
const run=async(tag,args)=>{
 const log='output/fast-deploy/'+tag+'.log',fd=openSync(log,'w'),start=performance.now();let timedOut=false;
 const child=spawn(process.execPath,['scripts/build-v2.mjs',...args],{stdio:['ignore',fd,fd],windowsHide:true,env:{...process.env,LEO_LAYOUT:'2'}});
 const stop=()=>{timedOut=true;if(child.exitCode!==null)return;if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});else child.kill('SIGTERM');};
 const timer=setTimeout(stop,Math.max(1,deadline-Date.now()));process.once('SIGINT',stop);
 await fs.writeFile('output/fast-deploy/wider-active-process.json',JSON.stringify({tag,pid:child.pid,parent:process.pid,deadline,log}));
 try{const exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});return {tag,log,exitCode,timedOut,seconds:(performance.now()-start)/1000};}
 finally{clearTimeout(timer);process.removeListener('SIGINT',stop);closeSync(fd);await fs.writeFile('output/fast-deploy/wider-active-process.json',JSON.stringify({tag,finished:true,timedOut}));}
};

const results=[];
if(process.argv.includes('--prime')){results.push(await run('round2-wider-prime',['--skip-prepared']));await fs.copyFile('output/fast-deploy/full-build-timing.json','output/fast-deploy/round2-wider-prime-timing.json');assert.equal(results.at(-1).exitCode,0,'Raw cache priming failed');}
results.push(await run('round2-wider-warm',['--stages-only']));
await fs.copyFile('output/fast-deploy/full-build-timing.json','output/fast-deploy/round2-wider-warm-timing.json');
assert.equal(results.at(-1).exitCode,0,'Wider preparation failed');
const edited=original.replace(needle,"const geo=fitoutGeometry(b).translate(0,.02,0),o=new T.InstancedMesh");
try{
 await fs.writeFile(file,edited);
 const fd=openSync('output/fast-deploy/round2-wider-dry-run.log','w');try{const child=spawnSync(process.execPath,[path.resolve('../feedback-inbox-fastdeploy/automation/deploy-leo.mjs'),'work','--dry-run','--skip-browser','--dir='+process.cwd(),'--tag=round2-wider-classify'],{stdio:['ignore',fd,fd],windowsHide:true,env:{...process.env,LEO_LAYOUT:'2',LEO_FAST_NO_AUTHORING:'1'}});results.push({tag:'wider classification dry run',exitCode:child.status,expected:'Stops before required authoring'});}finally{closeSync(fd);}
 results.push(await run('round2-wider-source-edit',['--skip-prepared']));
 await fs.copyFile('output/fast-deploy/full-build-timing.json','output/fast-deploy/round2-wider-source-edit-timing.json');
 for(const name of ['scoped-stages-last','scoped-models-last'])try{await fs.copyFile('output/phase3/'+name+'.json','output/fast-deploy/round2-'+name+'.json');}catch{}
 assert.equal(results.at(-1).exitCode,0,'Wider raw-model build failed');
}finally{
 assert.equal(await fs.readFile(file,'utf8'),edited,'Concurrent source edit: '+file);await fs.writeFile(file,original);
 await fs.writeFile('output/fast-deploy/round2-wider-measurements.json',JSON.stringify(results,null,2));
}
console.log(JSON.stringify(results));
