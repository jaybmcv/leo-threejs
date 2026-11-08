// Runs the full checks as separate processes, several at once. Each job is {name,args,kind,after?}: kind is 'light',
// 'heavy' (loads the full ship or the prepared world) or 'browser' (drives Chrome); `after` names a job that must pass
// first. Limits: LEO_CHECK_JOBS at once in all (default 4), LEO_CHECK_HEAVY heavy (default 2), LEO_CHECK_BROWSERS
// browsers (default 1). A job also waits for free memory (heavy 10 GB, browser 4 GB, light 2 GB, less what jobs started
// in the last 30 s have yet to take) unless nothing else is running. Longest jobs start first, using the last run's
// times. Every job runs even after a failure, so one nightly reports every failing check. A job that V8 stopped for
// running out of heap while other checks ran beside it goes back in the queue once, to run with nothing beside it; both
// attempts are printed, and a job that fails that way alone, or fails any other way, fails the run.
import {spawn} from 'node:child_process';
import os from 'node:os';

const GB=2**30,NEED={heavy:10*GB,browser:4*GB,light:2*GB},WARMUP=30000;
// V8's own fatal out-of-heap report at the start of a line, not any log line that mentions memory.
const OOM=/^FATAL ERROR: (?:Reached heap limit|Ineffective mark-compacts near heap limit|[^\n]*Allocation failed)[^\n]*JavaScript heap out of memory/m;

function runOne(job){return new Promise(resolve=>{
 const t=performance.now();let log='',settled=false;
 const finish=r=>{if(!settled){settled=true;resolve({...r,seconds:(performance.now()-t)/1000,log});}};
 let child;
 try{child=spawn(job.command||process.execPath,job.args,{windowsHide:true,env:process.env});}catch(e){log+=e.stack;finish({code:-1});return;}
 const take=d=>{log+=d;};child.stdout.on('data',take);child.stderr.on('data',take);
 child.once('error',e=>{log+=e.stack;finish({code:-1});});
 // 'close' comes after the output streams end, so the log is whole (the out-of-heap report is often the last line).
 child.once('close',(code,signal)=>finish({code:code??-1,signal}));
});}

function limit(name,fallback){const raw=process.env[name];if(raw===undefined||raw==='')return fallback;
 const n=Number(raw);if(!Number.isInteger(n)||n<1)throw new Error(`${name} must be a whole number of at least 1 (got ${raw})`);return n;}

export async function runJobs(jobs,{previous={},record=async()=>{},limits={}}={}){
 const max={all:limit('LEO_CHECK_JOBS',limits.all||4),heavy:limit('LEO_CHECK_HEAVY',limits.heavy||2),browser:limit('LEO_CHECK_BROWSERS',limits.browser||1)};
 jobs=jobs.map(j=>({...j,kind:NEED[j.kind]?j.kind:'light'}));
 const names=new Set(jobs.map(j=>j.name));
 if(names.size!==jobs.length)throw new Error('two jobs share a name');
 for(const j of jobs)if(j.after&&!names.has(j.after))throw new Error(`${j.name} waits for unknown job ${j.after}`);
 // Longest first; a job's chain counts toward it, so check-plan starts at once for the v2 check behind it.
 const chain=j=>(previous[j.name]??30)+jobs.filter(k=>k.after===j.name).reduce((s,k)=>Math.max(s,chain(k)),0);
 const waiting=[...jobs].sort((a,b)=>chain(b)-chain(a)),running=new Map(),done=new Map(),pending=new Set();
 let minFree=os.freemem(),timer=null;
 const sample=setInterval(()=>{minFree=Math.min(minFree,os.freemem());},2000);
 const count=kind=>[...running.values()].filter(j=>j.kind===kind).length;
 const ready=j=>!j.after||done.get(j.after)?.code===0;
 const blocked=j=>j.after&&done.has(j.after)&&done.get(j.after).code!==0;
 // Memory a just-started job will likely still take, so a burst of starts can't all see the same free memory.
 const reserved=()=>[...running.values()].filter(j=>performance.now()-j.startedAt<WARMUP).reduce((s,j)=>s+NEED[j.kind],0);
 const show=(job,r,note)=>{
  const ok=r.code===0,lines=r.log.trimEnd().split(/\r?\n/);
  // Windows reports crashes as NTSTATUS codes (0xC0000005 access violation, 0xC0000409 fail-fast/abort); show them in hex.
  const exit=ok?'':r.signal?', signal '+r.signal:', exit '+(r.code>=0x80000000?'0x'+r.code.toString(16).toUpperCase():r.code);
  console.log(`\n===== ${ok?'PASS':'FAIL'} ${job.name} (${r.seconds.toFixed(1)} s${exit}${note}) =====`);
  // Only the tail of a check's output is kept, but its timing lines (check-plan's gates, run-v2 tasks) always are.
  // A failed check that ran its own jobs (check-plan's gates) also keeps every inner FAIL block, which later jobs' output
  // can push out of the tail.
  const tail=ok?15:80,head=lines.slice(0,-tail),kept=[];let inFail=false;
  for(const l of head){if(/^===== /.test(l))inFail=!ok&&/^===== FAIL /.test(l);if(inFail||l.includes('[check-timing]')||l.includes('[timing]'))kept.push(l);}
  console.log([...kept,...lines.slice(-tail)].join('\n'));
 };
 try{
  await new Promise((resolve,reject)=>{
   const track=p=>{pending.add(p);p.then(()=>pending.delete(p),reject);};
   const pump=()=>{try{
    for(const j of [...waiting])if(blocked(j)){
     waiting.splice(waiting.indexOf(j),1);done.set(j.name,{code:-2,seconds:0,log:`not run: ${j.after} failed`});
     console.log(`\n===== SKIP ${j.name} (${j.after} failed) =====`);track(record(j.name,0,'SKIPPED'));
    }
    const solo=waiting.find(j=>j.solo&&ready(j));
    for(const j of solo?[solo]:[...waiting]){
     if(running.size>=max.all||[...running.values()].some(r=>r.solo))break;
     if(j.solo&&running.size)break;
     if(!ready(j))continue;
     if(j.kind==='heavy'&&count('heavy')>=max.heavy)continue;
     if(j.kind==='browser'&&count('browser')>=max.browser)continue;
     if(running.size&&os.freemem()-reserved()<NEED[j.kind])continue;
     waiting.splice(waiting.indexOf(j),1);
     // A job overlapped others if any ran beside it at any moment; only those get the out-of-heap rerun.
     j.startedAt=performance.now();j.overlapped=running.size>0;for(const r of running.values())r.overlapped=true;
     running.set(j.name,j);
     console.log(`[check-start] ${j.name} (${j.kind}${j.solo?', alone after running out of heap':''}; ${running.size} running, ${(os.freemem()/GB).toFixed(1)} GB free)`);
     track(runOne(j).then(async r=>{
      running.delete(j.name);
      if(r.code!==0&&!j.solo&&j.overlapped&&OOM.test(r.log)){
       show(j,r,', ran out of heap beside other checks');
       console.log(`===== ${j.name} runs again with nothing beside it =====`);
       j.solo=true;j.firstAttempt=r;waiting.unshift(j);
      }else{
       done.set(j.name,r);show(j,r,j.solo?', run alone after running out of heap beside other checks':'');
       await record(j.name,r.seconds+(j.firstAttempt?.seconds||0),r.code===0?'PASS':'FAIL');
      }
      pump();
     }));
    }
    // Recording still in flight is awaited below; a rejection there (or in any job's handling) fails the run.
    if(!running.size&&!waiting.length)resolve();
    else if(!running.size&&waiting.length){
     if(waiting.every(j=>!ready(j)))reject(new Error('check scheduler stuck: '+waiting.map(j=>j.name+' waits for '+j.after).join(', ')));
     else{clearTimeout(timer);timer=setTimeout(pump,5000);}
    }
   }catch(e){reject(e);}};
   pump();
  });
  await Promise.all([...pending]);
 }finally{clearInterval(sample);clearTimeout(timer);}
 return {results:done,minFreeGB:minFree/GB};
}
