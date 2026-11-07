// Runs the full checks as separate processes, several at once. Each job is {name,args,kind,after?}: kind is 'light',
// 'heavy' (loads the full ship or the prepared world) or 'browser' (drives Chrome); `after` names a job that must pass
// first. Limits: LEO_CHECK_JOBS at once in all (default 6), LEO_CHECK_HEAVY heavy (default 2), LEO_CHECK_BROWSERS
// browsers (default 1). A job also waits for free memory (heavy 10 GB, browser 4 GB, light 2 GB) unless nothing else is
// running. Longest jobs start first, using the last run's times. Every job runs even after a failure, so one nightly
// reports every failing check; a job that ran out of memory goes back in the queue once, to run with nothing beside it.
import {spawn} from 'node:child_process';
import os from 'node:os';

const GB=2**30,NEED={heavy:10*GB,browser:4*GB,light:2*GB};
const OOM=/heap out of memory|Allocation failed|ENOMEM|Reached heap limit/i;

function runOne(job,onLine){return new Promise(resolve=>{
 const t=performance.now();let log='';
 const child=spawn(job.command||process.execPath,job.args,{windowsHide:true,env:process.env});
 const take=d=>{log+=d;};child.stdout.on('data',take);child.stderr.on('data',take);
 child.once('error',e=>{log+=e.stack;resolve({code:-1,seconds:(performance.now()-t)/1000,log});});
 child.once('exit',(code,signal)=>resolve({code:code??(signal?-1:0),seconds:(performance.now()-t)/1000,log}));
});}

export async function runJobs(jobs,{previous={},record=async()=>{},limits={}}={}){
 const max={all:Number(process.env.LEO_CHECK_JOBS)||limits.all||6,heavy:Number(process.env.LEO_CHECK_HEAVY)||limits.heavy||2,browser:Number(process.env.LEO_CHECK_BROWSERS)||limits.browser||1};
 const names=new Set(jobs.map(j=>j.name));
 for(const j of jobs)if(j.after&&!names.has(j.after))throw new Error(`${j.name} waits for unknown job ${j.after}`);
 // Longest first; a job's chain counts toward it, so check-plan starts at once for the v2 check behind it.
 const chain=j=>(previous[j.name]??30)+jobs.filter(k=>k.after===j.name).reduce((s,k)=>Math.max(s,chain(k)),0);
 const waiting=[...jobs].sort((a,b)=>chain(b)-chain(a)),running=new Map(),done=new Map();
 let minFree=os.freemem();
 const sample=setInterval(()=>{minFree=Math.min(minFree,os.freemem());},2000);
 const count=kind=>[...running.values()].filter(j=>j.kind===kind).length;
 const ready=j=>!j.after||done.get(j.after)?.code===0;
 const blocked=j=>j.after&&done.has(j.after)&&done.get(j.after).code!==0;
 const report=async(job,r,note='')=>{
  const ok=r.code===0;
  console.log(`\n===== ${ok?'PASS':'FAIL'} ${job.name} (${r.seconds.toFixed(1)} s${note}) =====`);
  const lines=r.log.trimEnd().split(/\r?\n/);
  console.log((ok?lines.slice(-15):lines.slice(-80)).join('\n'));
  await record(job.name,r.seconds,ok?'PASS':'FAIL');
 };
 await new Promise(resolve=>{
  const pump=()=>{
   for(const j of [...waiting])if(blocked(j)){waiting.splice(waiting.indexOf(j),1);done.set(j.name,{code:-2,seconds:0,log:`skipped: ${j.after} failed`});console.log(`\n===== SKIP ${j.name} (${j.after} failed) =====`);record(j.name,0,'SKIPPED');}
   const solo=waiting.find(j=>j.solo&&ready(j));
   for(const j of solo?[solo]:[...waiting]){
    if(running.size>=max.all||[...running.values()].some(r=>r.solo))break;
    if(j.solo&&running.size)break;
    if(!ready(j))continue;
    if(j.kind==='heavy'&&count('heavy')>=max.heavy)continue;
    if(j.kind==='browser'&&count('browser')>=max.browser)continue;
    if(running.size&&os.freemem()<NEED[j.kind||'light'])continue;
    waiting.splice(waiting.indexOf(j),1);running.set(j.name,j);
    console.log(`[check-start] ${j.name} (${j.kind||'light'}${j.solo?', alone after running out of memory':''}; ${running.size} running, ${(os.freemem()/GB).toFixed(1)} GB free)`);
    runOne(j).then(async r=>{
     running.delete(j.name);
     if(r.code!==0&&OOM.test(r.log)&&!j.solo){j.solo=true;waiting.unshift(j);console.log(`\n===== ${j.name} ran out of memory after ${r.seconds.toFixed(1)} s; it runs again with nothing beside it =====`);}
     else{done.set(j.name,r);await report(j,r,j.solo?', run alone':'');}
     pump();
    });
   }
   if(!running.size&&!waiting.length)resolve();
   else if(!running.size&&waiting.length&&waiting.every(j=>!ready(j)&&!blocked(j)))throw new Error('check scheduler stuck: '+waiting.map(j=>j.name).join(', '));
   else if(!running.size)setTimeout(pump,5000); // memory was short with nothing running: try again shortly
  };
  pump();
 });
 clearInterval(sample);
 return {results:done,minFreeGB:minFree/GB};
}
