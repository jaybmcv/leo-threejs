import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {geometryDependencies,geometryIdentity,changedInputs} from './fast-dependencies-v2.mjs';
import {classifyDressings} from './fast-dressing-v2.mjs';
import {programmeInputs,kitInputs,legacyInputs} from './fast-state-v2.mjs';

// The Hydro-Nip Lounge's mood (src/walk/lounge-mood.js) lives outside the ship's geometry, so an edit to it takes the
// fast lane; the room it reads (src/walk/lounge.js and its authoring copy) stays a geometry input, so an edit there
// still rebuilds the whole ship. This keeps the split from hiding a geometry change either way.
const MOOD='src/walk/lounge-mood.js',ROOM=['src/walk/lounge.js','src/walk/lounge.authoring.js'];
const deps=new Set(await geometryDependencies());
assert(!deps.has(MOOD),MOOD+' became a geometry input: a producer of the ship imports it');
for(const f of ROOM)assert(deps.has(f),f+' must stay a geometry input');

// Only the walk pages run it, the way they run the atrium's mood.
const pages=['src/walk/main.js','src/walk/main.authoring.js','src/walk/main.prepared.js','src/walk/main.public.js'],importers=[];
const walk=async dir=>{for(const e of await fs.readdir(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())await walk(f);else if(/\.m?js$/.test(f)&&/from\s*['"][^'"]*\/lounge-mood\.js['"]/.test(await fs.readFile(f,'utf8')))importers.push(f);}};
await walk('src');
assert.deepEqual(importers.sort(),[...pages].sort(),'Only the four walk pages import '+MOOD);

// It reads the lounge and the walk's shared lights; it never makes, moves or removes geometry or collision.
const mood=await fs.readFile(MOOD,'utf8');
assert.doesNotMatch(mood,/new T\.\w*(?:Mesh|Geometry|Group)\b|colliders|removeFromParent|\.add\(|\.position\b|\.geometry\b/,MOOD+' must not build geometry');
// Its per-frame step runs only in the page's animation loop. The authoring page awaits its whole build, which saves the
// prepared walk and then waits for good, before that loop starts, so the step never runs before the record is made.
const authoring=(await fs.readFile('src/walk/main.authoring.js','utf8')).replace(/\r\n/g,'\n'),built=authoring.indexOf('\nawait buildShip();');
assert(built>0&&built<authoring.indexOf('\nrenderer.setAnimationLoop('),'The authoring page must finish building before its animation loop');
assert.match(authoring,/\n await savePreparedWalk\([^\n]*\);\n await new Promise\(\(\)=>\{\}\);\n/,'The authoring page must save the prepared walk and stop there');

// Edits, through Leo's own fingerprint: the mood's tuning and its room test (the kind of edit a293feb made) leave it
// alone; an edit to the room's code changes it, and neither lane D nor lane B takes that file, so it goes whole.
const before=await geometryIdentity();
async function edited(file,from,to,test){
 const text=await fs.readFile(file,'utf8');assert.equal(text.split(from).length,2,file+' no longer has '+from);
 try{await fs.writeFile(file,text.replace(from,to));await test();}finally{await fs.writeFile(file,text);}
}
for(const [from,to,what]of [['hemi:.32','hemi:.3','mood light level'],['p.y>=room.y-1&&','p.y>=room.y-1.2&&','room test for the catnip face'],['mood+=((underwater||inRoom(eye)','mood+=((inRoom(eye)','mood trigger']])
 await edited(MOOD,from,to,async()=>assert.equal((await geometryIdentity()).hash,before.hash,'A '+what+' edit must not change the geometry fingerprint'));
for(const file of ROOM)await edited(file,'SWAY={amp:.075','SWAY={amp:.08',async()=>{
 const files=changedInputs(before.files,(await geometryIdentity()).files);
 assert.deepEqual(files,[file],'A hammock edit in '+file+' must change the geometry fingerprint');
 const dressing=await classifyDressings(files);assert(!dressing||dressing.reason,file+' must not take the dressing lane');
 assert(!programmeInputs.has(file)&&!kitInputs.has(file)&&!legacyInputs.has(file),file+' must not be a room-patch input');
});
assert.equal((await geometryIdentity()).hash,before.hash,'Every edit was put back');
console.log('PASS lounge mood outside the geometry (3 mood edits keep the fingerprint); lounge.js and lounge.authoring.js edits change it and take the whole build');
