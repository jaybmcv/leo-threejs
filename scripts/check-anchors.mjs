import fs from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {registry,v1Frame} from '../src/plan/rooms.js';import {AREAS} from '../src/plan/v1.js';
const old=spawnSync(process.execPath,['scripts/check-anchors.mjs'],{cwd:'legacy/v1',env:{...process.env,LEO_LAYOUT:'1'},encoding:'utf8',windowsHide:true});assert.equal(old.status,0,(old.stdout||'')+(old.stderr||''));console.log(old.stdout.trim());
const rules=JSON.parse(await fs.readFile('src/plan/ownership-rules.json','utf8')),allow=JSON.parse(await fs.readFile('src/plan/anchor-allow-list.json','utf8'));
const glob=(pattern,p)=>new RegExp('^'+pattern.replace(/[.+?^$()|[\]{}]/g,'\\$&').replaceAll('*','.*')+'$').test(p);
const exception=p=>allow.find(a=>a.paths.some(g=>glob(g,p)));
// Text is compared and fingerprinted with LF line endings, whatever the checkout uses (core.autocrlf on Windows).
const lf=s=>s.replace(/\r\n/g,'\n'),digest=s=>createHash('sha256').update(lf(s)).digest('hex');
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
export function placementSites(source){return strip(source).split('\n').map(s=>s.trim()).filter(s=>/\.position\.(set|copy|[xyz]\s*=)|\.translate\(|\.setMatrixAt\(|\b(?:wall|home|at|center)\s*:\s*\[|\b(?:box|mesh|pipe|tube|rail|tree|chair|round|cyl|put|own|add|piece|plant|panel)\s*\(/.test(s));}
export function anchoredModule(source,rule){return rule?.via==='inherited'||/\b(anchorArea|anchorObject|anchorCabins|roomObject|toWorld|toLocal|placed|placedV1|placeObject|resolveRoomFrames|deferRoomFrames|remapSpot)\s*\(/.test(strip(source));}
const expand=ids=>[...new Set(ids.flatMap(id=>id==='@areas'?AREAS.map(a=>a.id):id==='@cabins'?registry().filter(a=>/^N\d/.test(a.id)).map(a=>a.id):id==='@commons'?registry().filter(a=>/^commons-/.test(a.id)).map(a=>a.id):id==='@nose'?registry().filter(a=>/^nose-commons-/.test(a.id)).map(a=>a.id):id==='@circulation'?Array.from({length:20},(_,i)=>'circulation-'+(i+1)):[id]))];
// A fixture from the old holo builder: a literal world placement with no room boundary must fail.
assert.equal(anchoredModule("const group=new T.Group();group.position.set(9,36.3,-21);",{}),false);
assert.equal(anchoredModule("const group=new T.Group();group.position.set(9,36.3,-21);placeObject(group,'mission-holo');",{}),true);
assert.equal(placementSites('group.position.set(9,36.3,-21);').length,1);
const records=[],errors=[];
for(const dir of ['src','src/walk'])for(const rel of await fs.readdir(dir,{recursive:dir==='src/walk'})){
 const p=dir+'/'+rel.replaceAll('\\','/');if(!p.endsWith('.js')||p.startsWith('src/walk/assets/')||p.startsWith('src/walk/net/'))continue;
 const source=await fs.readFile(p,'utf8'),sites=placementSites(source);if(!sites.length&&!rules[p])continue;
 const base=p.replace(/\.(authoring|prepared|public)\.js$/,'.js'),rule=rules[p]||rules[base],fixed=exception(p)||exception(base);if(!rule&&!fixed){errors.push(p+': places geometry but belongs to no room. Add it to src/plan/ownership-rules.json with its room id (see src/plan/README.md) and place it through src/plan/rooms.js (roomObject, anchorObject or toWorld), or, if it never moves, list it in src/plan/anchor-allow-list.json with a reason.');continue;}
 if(rule?.boundary){const normalized=strip(source).replace(/\.(authoring|prepared|public)\.js/g,'.js'),body=normalized.replace(/\bimport\s+[^;]+;/g,''),compact=s=>s.replace(/\s/g,'');assert(normalized.includes(rule.boundary.module)&&compact(body).includes(compact(rule.boundary.use)),'Missing delegated ownership boundary: '+p);const broken=compact(body).replace(compact(rule.boundary.use),'REMOVED_BOUNDARY');assert(!broken.includes(compact(rule.boundary.use)),'Boundary negative fixture did not remove usage: '+p);}
 if(rule&&!anchoredModule(source,rule)){errors.push(p+': has a room in src/plan/ownership-rules.json but places geometry without going through src/plan/rooms.js (roomObject, anchorObject or toWorld).');continue;}
 const ids=rule?expand(rule.owners):fixed.room&&fixed.room!=='inherit'?expand([fixed.room]):[];for(const id of ids)v1Frame(id);
 const names=[...source.matchAll(/\.name\s*=\s*['"]([^'"\n]+)['"]/g)].map(m=>m[1]);
 records.push({source:p,rooms:rule?rule.owners:ids,via:rule?.via||'frame boundary',fixed:!rule,reason:fixed&&!rule?fixed.reason:undefined,features:[...new Set(names)],colliders:[...new Set(names.filter(n=>/solid|collid|entrance/i.test(n)))],interactionTargets:/\bnear\(|TRIGGERS|spots|PLACES|callAt|mills/.test(source)?'same room frames; see debug world positions':null,placements:sites.length,signature:digest(source.replaceAll('\r\n','\n'))});
}

if(errors.length)throw Error(errors.join('\n'));const modes=JSON.parse(await fs.readFile('src/v2/source-modes.json'));const inventory={layoutVersion:2,description:'Active source ownership; mode variants inherit the original module boundary. Frozen v1 ownership and transform round trips are checked separately.',modules:records.sort((a,b)=>a.source.localeCompare(b.source)),sourceModes:modes};const serialized=JSON.stringify(inventory,null,2)+'\n';if(process.argv.includes('--write'))await fs.writeFile('src/plan/ownership.json',serialized);else assert.equal(lf(await fs.readFile('src/plan/ownership.json','utf8')),lf(serialized),'Ownership inventory changed; verify room boundaries before --write');console.log('Active v2 ownership:',records.length,'modules; all placement modules retain an explicit boundary');
