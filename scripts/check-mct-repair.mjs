import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PARTS,PUZZLES,JUNK} from '../src/walk/mct-repair/catalog.js';
import {VIEWS,newRepair,required,workbench,install,nextRound,formatTime} from '../src/walk/mct-repair/rules.js';
import {partArt,cartArt,PART_SPOTS} from '../src/walk/mct-repair/art.js';

const requestedNames=[
 '48V Battery Pack','Wiring Harness','Solenoid Relay','Vacuum Pump','Electric Drive Motor','Rear Axle Assembly','Steering Wheel','Brake Rotor & Caliper','ECU Controller',
 'Wheel & Hub','Safety Roll Cage','Steering & Dash','Modular Seat','Front Bumper','Rear Step & Lights','Side Skirt','Hood Deflector','Fender & Guard'
];
const repairNames=[
 'Bed Anchor Ring','Air Intake Snorkel','Electric Winch','Skid Plate Guard','Warning Triangle','Cargo Barrier Wall','Leaf Spring Assembly','Tailgate Hinge Latch','Auxiliary 12V Battery',
 'Fluid Reservoir','Air Compressor','Heavy Fluid Filter','Radiator Core','Pneumatic Valves','Reinforced Hose','Master Cylinder','Moisture Trap Filter','Spring Latch Mechanism',
 'Coilover Shock','Steering Rack','HV Fuse and Relay Box','Cooling Fan Shroud','Pedal Assembly','Roof Strobe Beacon','Side-View Mirror','Instrument Cluster','Rear Pintle Hitch'
];
assert.equal(PARTS.length,45);assert.equal(new Set(PARTS.map(p=>p.id)).size,45);assert.equal(new Set(PARTS.map(p=>p.name)).size,PARTS.length,'No duplicate part names');assert.equal(PUZZLES.length,26);assert.equal(JUNK.length,33);
for(const name of [...requestedNames,...repairNames])assert.equal(PARTS.filter(p=>p.name===name).length,1,`${name} appears exactly once`);
assert.equal(new Set(PARTS.map(p=>partArt(p.id))).size,PARTS.length,'Every repair part has a distinct icon');
for(const name of [...requestedNames,...repairNames]){const p=PARTS.find(p=>p.name===name);for(const junk of JUNK)assert.notEqual(partArt(p.id),partArt(junk),`${name} must not use generic debris art`);}
for(const name of requestedNames){const p=PARTS.find(p=>p.name===name);assert(PUZZLES.some(q=>q.parts.includes(p.id)),`${name} can be required in a repair task`);}
assert.deepEqual([4,8,12].map(n=>PUZZLES.filter(p=>p.count===n).length),[12,8,6]);
for(const [round,count] of [4,8,12].entries()){
 const choices=PUZZLES.filter(p=>p.count===count);
 for(const name of repairNames){const p=PARTS.find(p=>p.name===name);assert(choices.some(q=>q.parts.includes(p.id)),`${name} can be required in round ${round+1}`);}
 for(const [i,puzzle] of choices.entries())assert.equal(newRepair(()=>(i+.5)/choices.length).rounds[round],puzzle,'Every task can be selected');
}
assert.equal(formatTime(125),'2:05');
for(const p of PARTS){
 assert(VIEWS.includes(p.view));assert(partArt(p.id).includes('<svg'));
 const spot=PART_SPOTS[p.view][p.id];assert.equal(spot?.length,2,'Every replacement part has an assembly location');assert(spot.every(n=>Number.isFinite(n)&&n>0&&n<100),'Assembly location is inside the view');
 const g=newRepair(()=>0);g.rounds[0]={parts:[p.id],count:1};g.view=p.view;assert(install(g,p.id),`${p.name} installs in its mounting view`);
}
for(const view of VIEWS){const art=cartArt(view);assert(art.includes('#e8782c'));assert(art.includes('#19c4b6'));assert(art.includes('#1c2023'));}
// Every diagnostic task can finish, including late games with no speed bonus.
for(const puzzle of PUZZLES){
 assert.equal(new Set(puzzle.parts).size,puzzle.count);assert(puzzle.diag.length>20);
 const g=newRepair(()=>0);g.rounds=[puzzle,puzzle,puzzle];g.elapsed=95;
 assert.equal(install(g,'bolt'),false);const first=required(g)[0];g.view=VIEWS.find(v=>v!==first.view);assert.equal(install(g,first.id),false);assert.equal(g.score,0);
 const pile=workbench(g,1280,664,()=>.3);assert.equal(pile.length,puzzle.count+8+28);for(const id of puzzle.parts)assert.equal(pile.filter(p=>p===id).length,1);
 for(const p of required(g)){g.view=p.view;assert(install(g,p.id));assert.equal(install(g,p.id),false);}
 assert.equal(g.phase,'clear');assert.equal(g.score,puzzle.count*150);assert(nextRound(g));assert.equal(g.current,1);assert.equal(g.view,'side');assert.equal(g.elapsed,95);assert.equal(g.placed.size,0);
 for(let round=1;round<3;round++){
  for(const p of required(g)){g.view=p.view;assert(install(g,p.id));}
  assert.equal(g.phase,round===2?'complete':'clear');if(round<2)assert(nextRound(g));
 }
 assert.equal(g.score,puzzle.count*150*3);
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
console.log('PASS MCT repair: all 18 core and 27 additional names, unique icons, valid mounts, all 26 tasks completable, additional parts available in each 4/8/12 round, bench counts, scoring and four walk modes.');
