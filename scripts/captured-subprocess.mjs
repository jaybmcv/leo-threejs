// Optional Node preload for restricted Windows diagnostics. Retry denied pipe
// creation with real file handles; execute the same child and preserve its exit
// status and captured output. No check is skipped or replaced.
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {mkdirSync,openSync,closeSync,readFileSync} from 'node:fs';
import path from 'node:path';
const original=childProcess.spawnSync,dir=path.resolve('output/fast-deploy/subprocess-capture');let sequence=0;
childProcess.spawnSync=function(command,args,options={}){
 const result=original(command,args,options);
 if(result.error?.code!=='EPERM'||options.stdio)return result;
 mkdirSync(dir,{recursive:true});const name=dir+'/'+process.pid+'-'+sequence++,out=name+'.out',err=name+'.err',stdout=openSync(out,'w'),stderr=openSync(err,'w');let retried;
 try{retried=original(command,args,{...options,stdio:['ignore',stdout,stderr]});}finally{closeSync(stdout);closeSync(stderr);}
 return {...retried,stdout:readFileSync(out,options.encoding||undefined),stderr:readFileSync(err,options.encoding||undefined)};
};
syncBuiltinESMExports();
