import fs from 'node:fs/promises';
import {sourceHash} from './fast-dependencies-v2.mjs';

// The room fit-out overrides are a programme input: the fit-out data (fast-fitout-data-v2.mjs) runs them through
// applyRoomFitoutOverrides, which reads each room's add, replace, remove and rests, and lane B patches the rooms whose
// parts or rests then differ. Other modules build geometry from the same file that the fit-out data doesn't hold. An
// edit only they read left every room's data the same, so it took lane A and shipped the baseline's geometry (moving
// the Hydro-Nip Lounge's rug, say). Those edits take the whole build.
export const OVERRIDES='src/plan/room-fitout-overrides-v2.json';
// The clean baseline keeps the overrides it was built from (fast-state-v2.mjs captureFastBaseline), to diff against.
export const OVERRIDE_SNAPSHOT='room-fitout-overrides-v2.json';
export const FITOUT_DATA_KEYS=['add','replace','remove','rests'];
const FITOUT_DATA='src/v2/room-fitout-overrides.js';
// Every geometry input that reads the overrides apart from the fit-out data: the rooms it reads them for (null: any
// room) and the keys. readerProblems below compares this list with the sources on every override edit.
export const OVERRIDE_READERS=[
 // moveRoomFitoutMeshes, run by every room shell.
 {file:FITOUT_DATA,rooms:null,keys:['moveMeshes','removeMeshes']},
 {file:'src/hydro-nip-lounge.js',rooms:['commons-1'],keys:['terpeneBar','moveLoungeSeating','loungeRug','mazeRugMove','mazeCushions','remove']},
 {file:'src/v2/garden-art.js',rooms:null,keys:['removeGardenPrints']},
 // LOWER_AFT_AREAS: its legacy fittings share the override's part names.
 {file:'src/lower-aft.js',rooms:['d01-spares-aft','d02-maintenance-aft','d03-inspection-aft'],keys:['remove']},
 // DRILL_CRAFT: the drill helm's photo spot follows the button's descriptor.
 {file:'src/walk/emergency-drill/station.js',rooms:['d4-escape-s-9'],keys:['add']},
 // The Hydro-Nip munchies converger's place in the lounge layout.
 {file:'src/plan/lounge-layout-v2.js',rooms:['commons-1'],keys:['converger']},
 // The Hydro-Nip falls, pond, path, landing and bench (#426).
 {file:'src/v2/lounge-falls-layout.js',rooms:['commons-1'],keys:['loungeFalls']},
 // The gaming lounge's PC row, consoles, wall stations and leaderboard hologram (the walk module and its authoring twin).
 {file:'src/walk/gaming-lounge.js',rooms:['d16-training-aft'],keys:['gamingConsoles','gamingLeaderboard','gamingStations','gamingWindowRow']},
 {file:'src/walk/gaming-lounge.authoring.js',rooms:['d16-training-aft'],keys:['gamingConsoles','gamingLeaderboard','gamingStations','gamingWindowRow']},
];

// The [room, key] pairs at which two override files differ. A room added or removed counts each of its keys; a room
// that isn't an object counts as [room, null], which no rule covers.
export function overrideChanges(before,after){
 const out=[],object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 for(const room of new Set([...Object.keys(before||{}),...Object.keys(after||{})])){
  const a=before?.[room],b=after?.[room];if(JSON.stringify(a)===JSON.stringify(b))continue;
  if(a!==undefined&&!object(a)||b!==undefined&&!object(b)){out.push([room,null]);continue;}
  for(const key of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))if(JSON.stringify(a?.[key])!==JSON.stringify(b?.[key]))out.push([room,key]);
 }
 return out;
}

// Why an override edit needs the whole build, or null when the fit-out data shows all of it.
export function overrideReason(before,after){
 for(const [room,key] of overrideChanges(before,after)){
  const reader=OVERRIDE_READERS.find(r=>r.keys.includes(key)&&(!r.rooms||r.rooms.includes(room)));
  if(reader)return 'Changed room fit-out override '+room+' '+key+', which '+reader.file+' builds from';
  if(!FITOUT_DATA_KEYS.includes(key))return 'Changed room fit-out override '+room+(key?' '+key:'')+', which the fit-out data does not show';
 }
 return null;
}

const IMPORTING=/^import\s+(\w+)\s+from\s+['"][^'"]*\/room-fitout-overrides-v2\.json['"]/m;
// What a source reads from the overrides: name[room]?.key, through its import or a parameter that defaults to it.
// null when it doesn't import them; followable is false when it also uses them some other way.
export function overridesRead(file,text){
 text=text.replace(/\r\n/g,'\n');const m=IMPORTING.exec(text);if(!m)return null;
 const binding=m[1],aliases=[...text.matchAll(new RegExp('(\\w+)='+binding+'\\b(?![\\[?.])','g'))].map(a=>a[1]),names=[...new Set([binding,...aliases])];
 const reads=[...text.matchAll(new RegExp('\\b(?:'+names.join('|')+')\\[([^\\]]+)\\]\\??\\.(\\w+)','g'))];
 // Only the import, each parameter defaulting to it, the reads and the fit-out data's own walk over the rooms count.
 const code=text.replace(/^\s*\/\/.*$/gm,'').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g,"''");
 const uses=[...code.matchAll(new RegExp('\\b(?:'+names.join('|')+')\\b','g'))].length;
 let walks=0,keys=[...new Set(reads.map(r=>r[2]))].sort();
 if(file===FITOUT_DATA){
  const apply=text.slice(text.indexOf('export function applyRoomFitoutOverrides'));walks=(apply.match(/for\(const \[id,change\]of Object\.entries\(overrides\)\)/g)||[]).length;
  if(walks!==1||JSON.stringify([...new Set([...apply.matchAll(/\bchange\.(\w+)/g)].map(c=>c[1]))].sort())!==JSON.stringify([...FITOUT_DATA_KEYS].sort()))walks=-1;
 }
 return {followable:walks>=0&&uses===1+aliases.length*2+reads.length+walks,rooms:[...new Set(reads.map(r=>r[1]))],keys};
}

// Where the sources and OVERRIDE_READERS disagree, given the geometry inputs.
export async function readerProblems(files){
 const problems=[],inputs=new Set(files);
 for(const file of files.filter(f=>/^src\/.*\.m?js$/.test(f))){
  const read=overridesRead(file,await fs.readFile(file,'utf8')),listed=OVERRIDE_READERS.find(r=>r.file===file);
  if(!read){if(listed)problems.push(file+' no longer reads the room fit-out overrides: drop it from OVERRIDE_READERS');continue;}
  if(!listed){problems.push(file+' builds geometry from the room fit-out overrides: list it and what it reads in OVERRIDE_READERS');continue;}
  if(!read.followable)problems.push(file+' reads the room fit-out overrides in a way the fast lane cannot follow');
  if(JSON.stringify(read.keys)!==JSON.stringify([...listed.keys].sort()))problems.push(file+' reads override keys '+read.keys.join(', ')+'; OVERRIDE_READERS lists '+listed.keys.join(', '));
  // A room named in the source must be listed; check-fast-override-readers.mjs checks rooms chosen at run time.
  for(const room of read.rooms){const literal=/^'([^']+)'$/.exec(room);if(literal&&listed.rooms&&!listed.rooms.includes(literal[1]))problems.push(file+' reads overrides for '+literal[1]+', which OVERRIDE_READERS does not list');}
 }
 for(const r of OVERRIDE_READERS)if(!inputs.has(r.file))problems.push(r.file+' is listed in OVERRIDE_READERS but is not a geometry input');
 return problems;
}

const parse=bytes=>JSON.parse(bytes.toString('utf8').replace(/^﻿/,''));
// The overrides edit against a clean baseline: the readers must be the listed ones, and the baseline's own copy must
// be the file its identity was built from.
export async function baselineOverrideReason(directory,baselineHash,geometryFiles){
 const problems=await readerProblems(geometryFiles);if(problems.length)return 'Room fit-out override readers changed: '+problems[0];
 let saved;try{saved=await fs.readFile(directory+'/'+OVERRIDE_SNAPSHOT);}catch(e){if(e.code!=='ENOENT')throw e;return 'Clean baseline lacks the room fit-out overrides it was built from; one clean build saves them';}
 if(sourceHash(OVERRIDES,saved)!==baselineHash)return 'Clean baseline room fit-out overrides differ from the ones it was built from';
 return overrideReason(parse(saved),parse(await fs.readFile(OVERRIDES)));
}
