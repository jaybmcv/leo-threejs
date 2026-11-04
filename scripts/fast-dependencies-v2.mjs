import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Git may materialize the same text as LF or CRLF on the build PC. JavaScript
// and JSON line endings must not turn an otherwise warm checkout into a rebuild.
export const sourceHash=(file,bytes)=>sha(/\.(?:[cm]?js|ts|json)$/.test(file)?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes);
// These are the geometry-producing entry points, not the page/controller entry.
// esbuild follows their imports, including literal dynamic imports and JSON data.
const roots=['src/model.js','src/walk/prepare.js','src/walk/prepare.authoring.js','src/v2/world.js',
 'src/v2/render-bake.authoring.js','src/v2/haze.authoring.js',
 'src/v2/facade.authoring.js','src/v2/cabin-glass.authoring.js',
 'src/walk/signs.authoring.js','src/walk/comms-displays.authoring.js',
 'src/concept-paint.js','src/v2/signs.js','src/walk/fin-casing.js',
 'src/walk/windows.js','src/walk/lounge-floor.authoring.js','src/walk/lift-tile-floor.authoring.js',
 // The paintings' frames and canvases are prepared geometry templates recorded by the authoring page.
 'src/walk/paintings.authoring.js'];
const producerScripts=['v2-build','v2-world','layout-v2-data','build-exterior-v2',
 'fit-cabin-ceilings-v2','ceiling-coverage-v2','v2-indexed-export','v2-export',
 'v2-export-metadata','retire-obsolete-facades-v2','freight-threshold-retirement-v2'];
// These bytes enter via fs/embedded URLs, outside the JavaScript import graph.
// v1 hulls are immutable source assets; their published pins remain mandatory.
const bakedAssets=['src/walk/assets/hydro-nip-main-logo.jpg','src/plan/v1-models-v2.json'];
const hullAssets=['leo-exterior.glb','leo-exterior-refined.glb','leo-exterior-web.glb','leo-exterior-phone.glb'];

export async function producerDependencies(entries){return Object.keys(await producerGraph(entries)).sort();}
// The same trace with each file's imports, so a change can be classified through every consumer.
export async function producerGraph(entries){
 let result;
 if(process.platform==='win32'){
  // In restricted Windows sessions inherited handles work even when anonymous
  // service pipes do not. No plugins are needed for this dependency-only graph.
  const dir='output/fast-deploy/dependencies';await fs.mkdir(dir,{recursive:true});
  const child=spawnSync(require.resolve('@esbuild/win32-x64/esbuild.exe'),[...entries,'--bundle',
   '--outdir='+dir,'--platform=node','--format=esm','--packages=external',
   '--external:v2-layout','--external:walk-partitions','--external:walk-changes',
   '--metafile='+dir+'/inputs.json','--log-level=error'],{stdio:'inherit',windowsHide:true});
  if(child.status!==0)throw child.error||Error('Geometry dependency trace failed');
  result={metafile:JSON.parse(await fs.readFile(dir+'/inputs.json','utf8'))};
 }else result=await build({entryPoints:entries,bundle:true,write:false,outdir:'unused',
   platform:'node',format:'esm',packages:'external',external:['v2-layout','walk-partitions','walk-changes'],metafile:true,logLevel:'silent'});
 const ours=f=>f.startsWith('src/')||f.startsWith('scripts/');
 return Object.fromEntries(Object.entries(result.metafile.inputs).filter(([f])=>ours(f)).map(([f,input])=>[f,input.imports.map(i=>i.external?'package:'+i.path:i.path)]));
}
export const geometryRoots=()=>[...roots,...producerScripts.map(n=>'scripts/'+n+'.mjs')];

export async function producerSourceIdentity(entry){
 const files=await producerDependencies([entry]),h=createHash('sha256');for(const file of [...files,'package-lock.json'].sort())h.update(file).update(sourceHash(file,await fs.readFile(file)));return h.digest('hex');
}

export async function geometryDependencies(){
 const inputs=await producerDependencies([...roots,...producerScripts.map(n=>'scripts/'+n+'.mjs')]);
 // Mode variants are separate authored files, not interchangeable copies.
 // Include the variants actually used by the offline authoring page as well.
 const variants=[];
 for(const f of inputs)if(f.endsWith('.js')&&!/\.(authoring|prepared|public)\.js$/.test(f)){
  const v=f.slice(0,-3)+'.authoring.js';try{await fs.access(v);variants.push(v);}catch{}
 }
 return [...new Set([...inputs,...variants,...bakedAssets,...hullAssets.map(n=>'output/leo-interior-v01/'+n),'package-lock.json',...producerScripts.map(n=>'scripts/'+n+'.mjs')])].sort();
}

export async function geometryIdentity(){
 const files={};for(const f of await geometryDependencies())try{files[f]=sourceHash(f,await fs.readFile(f));}catch(e){
  // A cold checkout has no generated v1 inputs yet. Keep their absence in the
  // identity so classification widens and ensureV1Inputs can restore them.
  if(e.code!=='ENOENT'||!hullAssets.some(n=>f==='output/leo-interior-v01/'+n))throw e;
  files[f]=null;
 }
 const pins=JSON.parse(await fs.readFile('src/plan/v1-models-v2.json','utf8'));
 for(const name of hullAssets){const pin=pins.models.find(m=>m.name===name),actual=files['output/leo-interior-v01/'+name];if(!pin||(actual!==null&&actual!==pin.sha256))throw Error('Immutable v1 hull input differs from its pin: '+name+'; restore the pinned source asset before deploying');}
 return {version:3,hash:sha(JSON.stringify(files)),files};
}

export function changedInputs(before,after){
 return [...new Set([...Object.keys(before||{}),...Object.keys(after||{})])]
  .filter(f=>before?.[f]!==after?.[f]).sort();
}

export async function sourceChanges(){
 const {execFileSync}=await import('node:child_process');
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true});
 const files=new Set(git('diff','--name-only','HEAD').trim().split('\n').filter(Boolean));
 for(const f of git('ls-files','--others','--exclude-standard').trim().split('\n').filter(Boolean))files.add(f);
 return [...files].map(f=>f.replaceAll(path.sep,'/')).sort();
}
