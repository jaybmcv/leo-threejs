import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';

// Writes the Builder's Hub (hub.html, src/hub) and its content-hashed script next to the other pages. It shares the
// walk's Discord connection and nothing heavier: no Three.js, no models.
const HUB_SCRIPT=/^hub\.[0-9a-f]{10}\.js$/;
// The v2 sandbox can read these local modules, but cannot probe parent folders.
// Resolve the Hub's relative JS imports explicitly, without widening file access.
function workspaceHubModules(){const root=path.resolve('src')+path.sep;return{name:'hub-local-modules',setup(b){b.onResolve({filter:/.*/},a=>{if(a.importer&&!a.path.startsWith('.'))throw Error('Hub dependency must be a local module: '+a.path);const file=path.resolve(a.importer?path.dirname(a.importer):process.cwd(),a.path);if(!file.startsWith(root)||!file.endsWith('.js'))throw Error('Hub module outside src: '+file);return{path:file,namespace:'hub-local'};});b.onLoad({filter:/.*/,namespace:'hub-local'},async a=>({contents:await fs.readFile(a.path,'utf8'),loader:'js',resolveDir:path.dirname(a.path)}));}};}
export async function writeHubPage(out,{workspaceLocal=false}={}){
 for(const name of await fs.readdir(out))if(HUB_SCRIPT.test(name))await fs.rm(path.join(out,name));
 const result=await build({...(workspaceLocal?{absWorkingDir:process.cwd(),tsconfigRaw:{},plugins:[workspaceHubModules()]}:{}),entryPoints:[workspaceLocal?path.resolve('src/hub/hub.js'):'src/hub/hub.js'],bundle:true,minify:true,format:'esm',write:false,target:'es2022',legalComments:'none'});
 const code=result.outputFiles[0].text,name=`hub.${createHash('sha256').update(code).digest('hex').slice(0,10)}.js`;
 await fs.writeFile(path.join(out,name),code);
 const html=(await fs.readFile('src/hub/hub.html','utf8')).replace('<script>/* BUNDLE */</script>',()=>`<script type="module" src="${name}"></script>`);
 if(html.includes('/* BUNDLE */')||!html.includes(name))throw new Error('hub.html lost its bundle placeholder');
 await fs.writeFile(path.join(out,'hub.html'),html);
 return {script:name,bytes:code.length};
}
