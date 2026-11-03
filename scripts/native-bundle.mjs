// Windows restricted sessions can execute esbuild with inherited file handles,
// but cannot open its service pipes. Run the same plugins once into local files
// and let the native CLI perform parsing, linking, tree shaking and codegen.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {build as serviceBuild} from 'esbuild';
const require=createRequire(import.meta.url);

// Find literal module specifiers while skipping comments, ordinary strings and
// templates. Nonliteral imports are left to esbuild exactly as in the API path.
export function moduleSpecifiers(source){
 const found=[],space=i=>{while(/\s/.test(source[i]||''))i++;return i;};
 function quoted(i){const quote=source[i];if(quote!=="'"&&quote!=='"')return null;const start=++i;let value='';while(i<source.length&&source[i]!==quote){if(source[i]==='\\'){value+=source.slice(i,i+2);i+=2;}else value+=source[i++];}return {start,end:i,value};}
 function skip(i){const q=source[i++];for(;i<source.length;i++){if(source[i]==='\\'){i++;continue;}if(source[i]===q)return i+1;}return i;}
 for(let i=0;i<source.length;){
  if(source.startsWith('//',i)){i=source.indexOf('\n',i);if(i<0)break;continue;}
  if(source.startsWith('/*',i)){const end=source.indexOf('*/',i+2);i=end<0?source.length:end+2;continue;}
  if("'\"`".includes(source[i])){i=skip(i);continue;}
  if(!/[A-Za-z_$]/.test(source[i])){i++;continue;}
  const start=i++;while(/[\w$]/.test(source[i]||''))i++;const word=source.slice(start,i);
  if(!['import','export','require'].includes(word)||source[start-1]==='.')continue;
  let at=space(i);if(word==='import'&&source[at]==='.')continue;
  if((word==='import'||word==='export')&&/^type\b/.test(source.slice(at)))continue;
  if(source[at]==='('){const ref=quoted(space(at+1));if(ref)found.push({...ref,kind:word==='require'?'require-call':'dynamic-import'});continue;}
  if(word==='require')continue;
  let ref=quoted(at);if(ref){found.push({...ref,kind:'import-statement'});continue;}
  // Static import/export clauses end at a semicolon. Their only literal is
  // the specifier after `from`; braces do not contain executable expressions.
  const match=/\bfrom\s*(['"])/g;match.lastIndex=at;const m=match.exec(source),end=source.indexOf(';',at);
  if(m&&(end<0||m.index<end)){ref=quoted(m.index+m[0].length-1);if(ref)found.push({...ref,kind:'import-statement'});}
 }
 return found;
}

export async function nativeBuild(options){
 const dir=path.resolve('output/fast-deploy/native-bundle-'+randomUUID()),root=options.absWorkingDir||process.cwd();await fs.mkdir(dir,{recursive:true});
 const resolveHooks=[],loadHooks=[],starts=[];
 const api={initialOptions:options,onResolve:(o,f)=>resolveHooks.push([o,f]),onLoad:(o,f)=>loadHooks.push([o,f]),onStart:f=>starts.push(f)};
 for(const plugin of options.plugins||[])await plugin.setup(api);
 for(const start of starts)await start();
 const matches=(o,p,namespace)=>{o.filter.lastIndex=0;return (!o.namespace||o.namespace===namespace)&&o.filter.test(p);};
 const nodes=new Map(),queue=[],externals=new Set(options.external||[]);
 async function resolve(specifier,importer='',namespace='file',resolveDir=root,kind='import-statement'){
  for(const [o,fn]of resolveHooks)if(matches(o,specifier,namespace)){const result=await fn({path:specifier,importer,namespace,resolveDir,kind});if(result){if(result.errors?.length)throw Error(JSON.stringify(result.errors));if(result.external)return {external:true,path:result.path||specifier};return add(result.path,result.namespace||'file');}}
  if(specifier.startsWith('node:')||options.packages==='external'&&!specifier.startsWith('.')&&!path.isAbsolute(specifier))return {external:true,path:specifier};
  const target=kind==='entry-point'?path.resolve(root,specifier):specifier.startsWith('.')?path.resolve(resolveDir,specifier):path.isAbsolute(specifier)?specifier:require.resolve(specifier,{paths:[resolveDir]});return add(target,'file');
 }
 function add(original,namespace){const key=namespace+':'+original;let node=nodes.get(key);if(node)return node;node={original,namespace,file:path.join(dir,createHash('sha256').update(key).digest('hex').slice(0,20)+(/\.json$/.test(original)?'.json':/\.ts$/.test(original)?'.ts':'.js'))};nodes.set(key,node);queue.push(node);return node;}
 const entries=[];for(const input of options.entryPoints){const entry=await resolve(path.resolve(root,input),'','file',root,'entry-point');if(entry.external)throw Error('Entry point resolved external: '+input+' ('+entry.path+')');entries.push(entry);}
 while(queue.length){const node=queue.shift();let loaded;for(const [o,fn]of loadHooks)if(matches(o,node.original,node.namespace)){loaded=await fn({path:node.original,namespace:node.namespace});if(loaded)break;}
  loaded??={contents:await fs.readFile(node.original),resolveDir:path.dirname(node.original),loader:node.file.endsWith('.json')?'json':node.file.endsWith('.ts')?'ts':'js'};
  let source=Buffer.isBuffer(loaded.contents)||loaded.contents instanceof Uint8Array?Buffer.from(loaded.contents).toString('utf8'):loaded.contents;
  if(loaded.loader!=='json'){const changes=[];for(const ref of moduleSpecifiers(source)){const specifier=JSON.parse('"'+ref.value.replaceAll('"','\\"')+'"'),target=await resolve(specifier,node.original,node.namespace,loaded.resolveDir||path.dirname(node.original),ref.kind);if(!target.external)changes.push({...ref,text:target.file.replaceAll('\\','/')});else{externals.add(target.path);if(target.path!==specifier)changes.push({...ref,text:target.path});}}for(const change of changes.sort((a,b)=>b.start-a.start))source=source.slice(0,change.start)+change.text+source.slice(change.end);}
  if(loaded.loader==='json'&&!node.file.endsWith('.json')){
   const data=node.file+'.json';await fs.writeFile(data,source);
   await fs.writeFile(node.file,'export * from '+JSON.stringify(data.replaceAll('\\','/'))+';export {default} from '+JSON.stringify(data.replaceAll('\\','/'))+';');
  }else if(loaded.loader==='ts'&&!node.file.endsWith('.ts')){
   const typed=node.file+'.ts';await fs.writeFile(typed,source);
   await fs.writeFile(node.file,'export * from '+JSON.stringify(typed.replaceAll('\\','/'))+';'+(/export\s+default\b/.test(source)?'export {default} from '+JSON.stringify(typed.replaceAll('\\','/'))+';':''));
  }else await fs.writeFile(node.file,source);
 }
 const outfile=path.join(dir,path.basename(options.outfile||'bundle.js')),args=[...entries.map(e=>e.file),'--bundle','--outfile='+outfile,'--format='+(options.format||'esm'),'--platform='+(options.platform||'browser'),'--log-level=error'];
 if(entries.length!==1){args.splice(args.findIndex(a=>a.startsWith('--outfile=')),1);args.push('--outdir='+dir+'/built');}
 if(options.minify)args.push('--minify');if(options.target)args.push('--target='+[].concat(options.target).join(','));if(options.globalName)args.push('--global-name='+options.globalName);if(options.legalComments)args.push('--legal-comments='+options.legalComments);if(options.sourcemap)args.push('--sourcemap='+options.sourcemap);if(options.packages)args.push('--packages='+options.packages);for(const f of options.external||[])args.push('--external:'+f);for(const[k,v]of Object.entries(options.define||{}))args.push('--define:'+k+'='+v);if(options.metafile)args.push('--metafile='+dir+'/meta.json');
 for(const external of externals)args.push('--external:'+external);
 const binary=process.platform==='win32'?require.resolve('@esbuild/win32-x64/esbuild.exe'):require.resolve('@esbuild/'+process.platform+'-'+process.arch+'/bin/esbuild'),run=spawnSync(binary,args,{cwd:root,windowsHide:true,stdio:'inherit'});if(run.status!==0)throw run.error||Error('Native bundle failed ('+run.status+')');
 const files=entries.length===1?[outfile,...(options.sourcemap?[outfile+'.map']:[])]:await fs.readdir(dir+'/built').then(names=>names.map(n=>dir+'/built/'+n)),outputFiles=[];
 for(const file of files){let contents=await fs.readFile(file);if(file.endsWith('.js'))contents=Buffer.from(contents.toString('utf8').replaceAll(path.basename(dir),'native-bundle'));outputFiles.push({path:file,contents,text:contents.toString('utf8')});}
 let metafile;if(options.metafile){metafile=JSON.parse(await fs.readFile(dir+'/meta.json'));const lookup=new Map([...nodes.values()].map(n=>[path.relative(root,n.file).replaceAll('\\','/'),n]));metafile.inputs=Object.fromEntries(Object.entries(metafile.inputs).map(([p,v])=>{const n=lookup.get(p);return[n?(n.namespace==='file'?path.relative(root,n.original).replaceAll('\\','/'):n.namespace+':'+n.original):p,v];}));}
 if(options.write!==false&&options.outfile)await fs.writeFile(options.outfile,outputFiles.find(f=>f.path.endsWith('.js')).contents);
 return {outputFiles,metafile,errors:[],warnings:[],nativeFallback:true};
}

let needsNative=process.env.LEO_NATIVE_BUNDLE==='1';
export async function build(options){
 if(!needsNative)try{return await serviceBuild(options);}catch(e){if(process.platform!=='win32'||e.code!=='EPERM')throw e;needsNative=true;console.log('esbuild service pipes unavailable; using native file transport');}
 return nativeBuild(options);
}
