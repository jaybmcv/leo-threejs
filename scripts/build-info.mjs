import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';

// build.json: which commit this site was built from, so the Builder's Hub can tell whether a merged change is really
// live, however the deploy was done (the nightly timer or by hand). A build with uncommitted changes to tracked files
// isn't that commit, so it names none and the Hub says it doesn't know rather than guessing.
export function buildInfo(cwd=process.cwd()){
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 try{return git('status','--porcelain','--untracked-files=no')?{sha:null,dirty:true}:{sha:git('rev-parse','HEAD'),dirty:false};}
 catch{return {sha:null,dirty:false};}
}
export const writeBuildInfo=out=>fs.writeFile(out+'/build.json',JSON.stringify(buildInfo())+'\n');
