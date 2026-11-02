import fs from 'node:fs';import {spawnSync} from 'node:child_process';import path from 'node:path';
// Never replace an unexpected link or remove a directory containing user files.
export function ensureLegacyWorkspace(root=process.cwd()){
 root=path.resolve(root);const legacy=path.join(root,'legacy/v1'),pending=[];
 for(const name of ['output','dist','dist-v2','node_modules']){
  const target=path.join(root,name),link=path.join(legacy,name);let stat;
  try{stat=fs.lstatSync(link);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(stat){
   if(stat.isSymbolicLink()){
    let actual;try{actual=fs.realpathSync(link);}catch(e){throw Error('Unexpected legacy workspace target (unresolved link; preserved): '+link,{cause:e});}
    const expected=fs.existsSync(target)?fs.realpathSync(target):path.resolve(target);
    if(actual!==expected)throw Error('Unexpected legacy workspace target (link preserved): '+link+' -> '+actual);
    continue;
   }
   if(!stat.isDirectory())throw Error('Unexpected legacy workspace target (file preserved): '+link);
   const entries=fs.readdirSync(link);
   if(entries.length)throw Error('Unexpected legacy workspace target (nonempty directory preserved): '+link+'; entries: '+entries.slice(0,8).join(', ')+'. Move its contents to a safe backup and retry. Nothing was deleted.');
  }
  pending.push({name,target,link,empty:!!stat});
 }
 for(const {name,target,link,empty} of pending){
  if(name!=='node_modules')fs.mkdirSync(target,{recursive:true});
  else if(!fs.statSync(target).isDirectory())throw Error('Missing root node_modules: '+target);
  if(empty){fs.rmdirSync(link);console.warn('Replacing empty stale legacy workspace directory: '+link);}
  fs.symlinkSync(target,link,'junction');
 }
 return legacy;
}
export function runLegacy(entry,args=[]){const p=spawnSync(process.execPath,[...process.execArgv.filter(a=>a.startsWith('--max-old-space-size=')),entry,...args],{cwd:ensureLegacyWorkspace(),env:{...process.env,LEO_LAYOUT:'1'},stdio:'inherit',windowsHide:true});if(p.error)throw p.error;process.exit(p.status??1);}
