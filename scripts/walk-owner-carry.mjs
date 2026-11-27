// Carries the last full owner bake (scripts/walk-owner-bake.mjs) to a walk built since: a fast deploy's page-only change.
// The walk names its bake file after its own script (src/v2/owner-hiding.js), so without this every new build starts
// with the empty one the public build writes, until the next full run bakes again (about 80 minutes).
//   node scripts/walk-owner-carry.mjs --site=<built site dir> [--from=output/leo-interior-v02/owner-bake/last.json]
//     [--poses=200] [--max-pixels=8] [--cdp=9348] [--chrome=<chrome.exe>]
// One headless bake page of the new build stands where the full bake stood (the bench seed, then the café's) and reads
// each stored row's digest again (walk-owner-carry-rows.mjs says what a bake depends on and why that is enough). Rows that
// differ, and every entry relying on one, are dropped; the rest go through the full bake's own self-check on this build:
// every part and wall matched, [--poses] random poses inside the blocks and 100 at the café, none changing more than
// [--max-pixels] pixels. Only then is walk-owner-bake.<hash>.json beside the walk script replaced, keyed to it. Nothing to
// carry (no stored bake, another bake page or configuration, no row left) leaves the build's empty one and exits 0; a
// failed check leaves it too and exits 1.
import fs from 'node:fs/promises';
import path from 'node:path';
import {ownerBakeFile,ownerBakeProblem} from '../src/v2/owner-hiding.js';
import {cafe,coversCafe} from './walk-owner-hotspots.mjs';
import {openPage,pageScript,walkPage} from './walk-owner-page.mjs';
import {OWNER_STORE,carryProblem,carryRows,keyScript} from './walk-owner-carry-rows.mjs';

const arg=(name,fallback)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const SITE_DIR=arg('site',null),FROM=path.resolve(arg('from',OWNER_STORE)),POSES=Number(arg('poses',200)),MAX_PIXELS=Number(arg('max-pixels',8));
const CDP=Number(arg('cdp',9348)),CHROME=arg('chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'),started=Date.now();
if(!SITE_DIR)throw Error('Give --site=<built site dir>');
const minutes=()=>((Date.now()-started)/60e3).toFixed(1)+' min';
const none=reason=>{console.log('owner carry: nothing carried, the walk keeps its empty bake: '+reason);process.exit(0);};

const stored=await fs.readFile(FROM,'utf8').then(JSON.parse,()=>null);if(!stored)none('no full bake kept in '+FROM);
const walk=await walkPage({site:SITE_DIR});if(!walk.script)throw Error('No walk script named in walk.html');
const out=path.join(walk.dir,ownerBakeFile(walk.script));
if(keyScript(stored.key)===walk.script)none(walk.script+' is the build the full bake was made for (its own file is beside it)');
const {text:script,code}=await pageScript();
{const why=carryProblem(stored,{code,key:stored.key});if(why)none(why);}// the configuration is compared once the page says its key
console.log(`owner carry: ${stored.key} (${stored.made}) to ${walk.script}: ${stored.parts.length} parts, ${stored.conds.length} walls, ${stored.entries.length} entries`);

const page=await openPage(0,walk,script,{cdp:CDP,chrome:CHROME});
const ev=(name,...args)=>page.ev(`__ownerBake.${name}(${args.map(a=>JSON.stringify(a)).join(',')})`);
let written=false;
try{
 const tables={parts:stored.parts,conds:stored.conds},c=stored.carry;
 await ev('stand',c.seed);const main=await ev('rows',tables);
 {const why=carryProblem(stored,{code,key:main.key});if(why)none(why);}
 let cafeNow=null;if(c.cafe){await ev('stand',c.cafeSeed);cafeNow=await ev('rows',tables);await ev('stand',c.seed);}
 const {data:carried,dropped,changed}=carryRows(stored,{key:main.key,main,cafe:cafeNow});
 console.log('owner carry: rows read again in',minutes(),'at',JSON.stringify([main.where,cafeNow?.where].filter(Boolean)),'dropped',JSON.stringify(dropped));
 // What changed, by name: the walls (mostly bands) and parts whose digests differ now.
 const name=row=>JSON.parse(row[0]).map(s=>s[0]).filter(Boolean).join('/');
 for(const k of ['conds','parts']){const list=changed[k].map(i=>name(stored[k][i]));if(list.length)console.log(`owner carry: ${k==='conds'?'walls':'parts'} changed (${list.length}):`,list.slice(0,16).join(', ')+(list.length>16?', …':''));}
 if(!carried.blocks.length)none('every proof relies on a part or wall that changed');
 // The full bake's own steps from here: whatever moved since is dropped, then the self-check at the bench seed and the café.
 const {data,dropped:moved}=await ev('prune',carried);if(moved.entries)console.log('owner carry: moved since reading',JSON.stringify(moved));
 if(!data.blocks.length)none('nothing left once what moved was dropped');
 // As the full bake: the blocks it proved from the bench seed checked there, the café's cell from the café.
 const atCafe=b=>b.every((v,i)=>v===cafe.cell[i%3]),bench={...data,blocks:data.blocks.filter(b=>!atCafe(b.slice(0,6)))};
 const check=bench.blocks.length?await ev('check',bench,POSES):{resolved:0,parts:0,condsResolved:0,conds:0,poses:[]},worst=Math.max(0,...check.poses.map(p=>p.big));
 console.log('owner carry: check',JSON.stringify({resolved:`${check.resolved}/${check.parts}`,conds:`${check.condsResolved}/${check.conds}`,poses:check.poses.length,worstPixels:worst,meanHidden:Math.round(check.poses.reduce((a,p)=>a+p.hidden,0)/Math.max(1,check.poses.length))}));
 if(check.resolved!==check.parts||check.condsResolved!==check.conds)throw Error('The walk could not match every carried part and wall; nothing was carried');
 if(worst>MAX_PIXELS)throw Error(`A pose changed ${worst} pixels (> ${MAX_PIXELS}); nothing was carried`);
 if(coversCafe(data)){
  await ev('stand',c.cafeSeed);const focus={...data,blocks:data.blocks.filter(b=>atCafe(b.slice(0,6)))};
  const at=await ev('check',focus,100,4523);
  if(at.resolved!==at.parts||at.condsResolved!==at.conds||at.poses.length!==100||at.poses.some(p=>p.big>MAX_PIXELS))throw Error('Café render check failed; nothing was carried');
  console.log('owner carry:',cafe.name,'maximum changed pixels',Math.max(...at.poses.map(p=>p.big)));
 }
 const problem=ownerBakeProblem(data,main.key);if(problem)throw Error('The carried bake would not be used: '+problem);
 const final={...data,carried:{...data.carried,at:new Date().toISOString(),dropped,kept:{parts:data.parts.length,conds:data.conds.length,entries:data.entries.length,blocks:data.blocks.length}}};
 await fs.writeFile(out+'.part',JSON.stringify(final));await fs.rename(out+'.part',out);written=true;
 console.log(`owner carry: ${data.blocks.length}/${stored.blocks.length} blocks, ${data.entries.length}/${stored.entries.length} entries -> ${out} in ${minutes()}`);
}finally{page.close();if(!written)await fs.rm(out+'.part',{force:true});}
process.exit(0);
