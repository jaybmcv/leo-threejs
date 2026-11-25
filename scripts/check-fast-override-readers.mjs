import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {geometryDependencies} from './fast-dependencies-v2.mjs';
import {OVERRIDES,OVERRIDE_READERS,overrideReason,readerProblems} from './fast-overrides-v2.mjs';

// The fast lane sends a room fit-out override edit to the whole build when a module other than the fit-out data reads
// it (fast-overrides-v2.mjs). Each override edit compares OVERRIDE_READERS with the sources and widens when they
// disagree; this check says so before then, checks the rooms picked at run time, and classifies edits to today's file.
assert.deepEqual(await readerProblems(await geometryDependencies()),[]);
const reader=file=>OVERRIDE_READERS.find(r=>r.file===file);
assert.deepEqual(reader('src/lower-aft.js').rooms,(await import('../src/lower-aft.js')).LOWER_AFT_AREAS.map(a=>a.id),'Lower-aft rooms');
assert.deepEqual(reader('src/walk/emergency-drill/station.js').rooms,[(await import('../src/walk/emergency-drill/station.js')).DRILL_CRAFT],'Drill craft');
for(const file of ['src/v2/garden-art.js','src/v2/room-fitout-overrides.js'])assert.equal(reader(file).rooms,null,file+' reads any room');

// What the fit-out data shows stays in the fast lane; anything else takes the whole build.
const current=JSON.parse(await fs.readFile(OVERRIDES,'utf8')),edit=change=>{const next=structuredClone(current);change(next);return overrideReason(current,next);};
const whole=[
 [o=>{o['commons-1'].loungeRug.at[0]+=.5;},/commons-1 loungeRug, which src\/hydro-nip-lounge\.js/,'Moving the lounge rug'],
 [o=>{o['commons-1'].moveLoungeSeating[0].to[1]+=.5;},/moveLoungeSeating, which src\/hydro-nip-lounge\.js/,'Moving lounge seating'],
 [o=>{o['commons-1'].remove.pop();},/commons-1 remove, which src\/hydro-nip-lounge\.js/,'Putting back the lounge cat tree'],
 [o=>{o['commons-1'].removeMeshes.pop();},/commons-1 removeMeshes, which src\/v2\/room-fitout-overrides\.js/,'Source mesh removal (819448ad)'],
 [o=>{o['commons-1'].removeGardenPrints.push(74);},/removeGardenPrints, which src\/v2\/garden-art\.js/,'Garden print removal'],
 [o=>{o['d02-maintenance-aft'].remove.pop();},/d02-maintenance-aft remove, which src\/lower-aft\.js/,'Lower-aft legacy fitting removal'],
 [o=>{o['d4-escape-s-9'].add.find(p=>p.part==='emergency_drill_button').at[0]+=.1;},/station\.js/,'Drill button'],
 [o=>{o['commons-1'].converger.center[0]+=.5;},/commons-1 converger, which src\/plan\/lounge-layout-v2\.js/,'Moving the munchies converger'],
 [o=>{o['d16-training-aft'].gamingStations[0].at[0]+=.5;},/d16-training-aft gamingStations, which src\/walk\/gaming-lounge\.js/,'Moving a gaming wall station'],
 [o=>{o['d16-training-aft'].gamingLeaderboard.radius+=.1;},/d16-training-aft gamingLeaderboard, which src\/walk\/gaming-lounge\.js/,'Resizing the leaderboard hologram'],
 [o=>{o['d16-theater-5'].colour='red';},/d16-theater-5 colour, which the fit-out data does not show/,'Unknown key'],
 [o=>{o['d16-theater-5']=[];},/d16-theater-5, which the fit-out data does not show/,'A room that is not an object'],
];
const fast=[
 [()=>{},'No change'],
 [o=>{o['d02-maintenance-aft'].add[0].at[0]+=.1;},'Lower-aft reads only remove'],
 [o=>{o['d05-surgery-2'].add[0].at[0]+=.1;},'Moving an added part'],
 [o=>{o['d04-air-1'].rests.pop();},'Room rests'],
 [o=>{delete o['observation-lounge'];},'Dropping a room that only adds parts'],
 [o=>{o['d16-theater-5'].replace=[{match:{part:'x'},set:{mat:'red'}}];},'Replacing a part'],
];
for(const [change,reason,name]of whole)assert.match(edit(change)||'',reason,name);
for(const [change,name]of fast)assert.equal(edit(change),null,name);
console.log(`Room fit-out override readers: ${OVERRIDE_READERS.length} listed and matching the sources; ${whole.length} edits take the whole build, ${fast.length} stay in the fast lane`);
