import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PARTS,PUZZLES,JUNK} from '../src/walk/mct-repair/catalog.js';
import {VIEWS,newRepair,required,workbench,install,nextRound,formatTime} from '../src/walk/mct-repair/rules.js';
import {partArt,cartArt,PART_SPOTS} from '../src/walk/mct-repair/art.js';

assert.equal(PARTS.length,45);assert.equal(new Set(PARTS.map(p=>p.id)).size,45);assert.equal(PUZZLES.length,21);assert.equal(JUNK.length,33);
assert.deepEqual([4,8,12].map(n=>PUZZLES.filter(p=>p.count===n).length),[8,7,6]);
assert.equal(formatTime(125),'2:05');
for(const p of PARTS){assert(VIEWS.includes(p.view));assert(partArt(p.id).includes('<svg'));assert.equal(PART_SPOTS[p.view][p.id].length,2,'Every replacement part has an assembly location');}
for(const view of VIEWS){const art=cartArt(view);assert(art.includes('#e8782c'));assert(art.includes('#19c4b6'));assert(art.includes('#1c2023'));}
// Every diagnostic task can finish, including late games with no speed bonus.
for(const puzzle of PUZZLES){
 assert.equal(new Set(puzzle.parts).size,puzzle.count);assert(puzzle.diag.length>20);
 const g=newRepair(()=>0);g.rounds=[puzzle,puzzle,puzzle];g.elapsed=95;
 assert.equal(install(g,'bolt'),false);const first=required(g)[0];g.view=VIEWS.find(v=>v!==first.view);assert.equal(install(g,first.id),false);assert.equal(g.score,0);
 const pile=workbench(g,1280,664,()=>.3);assert.equal(pile.length,puzzle.count+8+28);for(const id of puzzle.parts)assert.equal(pile.filter(p=>p===id).length,1);
 for(const p of required(g)){g.view=p.view;assert(install(g,p.id));assert.equal(install(g,p.id),false);}
 assert.equal(g.phase,'clear');assert.equal(g.score,puzzle.count*150);assert(nextRound(g));assert.equal(g.current,1);assert.equal(g.view,'side');assert.equal(g.elapsed,95);assert.equal(g.placed.size,0);
}
for(const sample of [0,.25,.5,.999999]){
 const g=newRepair(()=>sample);assert.deepEqual(g.rounds.map(p=>p.count),[4,8,12]);assert.equal(nextRound(g),false);
 for(let round=0;round<3;round++){
  assert.equal(g.current,round);g.elapsed=round*50;
  assert.equal(workbench(g,1920,1080,()=>sample).length,[40,48,56][round]);
  assert.equal(workbench(g,3840,2160,()=>sample).length,g.rounds[round].count+8+Math.round((28+round*4)*2.2));
  const wrong=PARTS.find(p=>!g.rounds[round].parts.includes(p.id));g.view=wrong.view;assert.equal(install(g,wrong.id),false);
  for(const p of required(g)){g.view=p.view;assert(install(g,p.id));}
  assert.equal(g.phase,round===2?'complete':'clear');if(round<2)assert(nextRound(g));
 }
 assert.equal(g.score,4*240+8*190+12*150);assert.equal(nextRound(g),false);
}
for(const mode of ['', '.public','.prepared','.authoring']){
 const main=await fs.readFile(`src/walk/main${mode}.js`,'utf8');
 for(const s of ["t.kind==='mct-repair'","repairStations.near(p)",'mctRepair.open(t.bay)','mctRepair?.close();','||!!mctRepair?.isOpen||','!mctRepair?.isOpen&&!emergencyDrill?.isOpen){acc+=dt;'])assert(main.includes(s),`${mode}: ${s}`);
}
console.log('PASS MCT repair: all 21 tasks, 45 parts, 4/8/12 progression, view/wrong/duplicate rejection, bench counts, elapsed bonuses, unbounded time and four walk modes.');
