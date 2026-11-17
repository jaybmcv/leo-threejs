import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PARTS,PUZZLES,JUNK} from '../src/walk/mct-repair/catalog.js';
import {VIEWS,newRepair,required,workbench,scatterPile,pileMetrics,pilePosition,pileDrop,install,nextRound,formatTime} from '../src/walk/mct-repair/rules.js';
import {partArt,cartArt,PART_SPOTS} from '../src/walk/mct-repair/art.js';

const repairNames=[
 'Bed Anchor Ring','Air Intake Snorkel','Electric Winch','Skid Plate Guard','Warning Triangle','Cargo Barrier Wall','Leaf Spring Assembly','Tailgate Hinge Latch','Auxiliary 12V Battery',
 'Fluid Reservoir','Air Compressor','Heavy Fluid Filter','Radiator Core','Pneumatic Valves','Reinforced Hose','Master Cylinder','Moisture Trap Filter','Spring Latch Mechanism',
 'Coilover Shock','Steering Rack','HV Fuse and Relay Box','Cooling Fan Shroud','Pedal Assembly','Roof Strobe Beacon','Side-View Mirror','Instrument Cluster','Rear Pintle Hitch'
];
assert.equal(PARTS.length,45);assert.equal(new Set(PARTS.map(p=>p.id)).size,45);assert.equal(new Set(PARTS.map(p=>p.name)).size,PARTS.length,'No duplicate part names');assert.equal(PUZZLES.length,26);assert.equal(JUNK.length,33);
for(const name of repairNames)assert.equal(PARTS.filter(p=>p.name===name).length,1,`${name} appears exactly once`);
assert.equal(new Set(PARTS.map(p=>partArt(p.id))).size,PARTS.length,'Every repair part has a distinct icon');
for(const name of repairNames){const p=PARTS.find(p=>p.name===name);for(const junk of JUNK)assert.notEqual(partArt(p.id),partArt(junk),`${name} must not use generic debris art`);}
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
// Test real rotated bounds after scattering, dropping outside, and resizing.
let seed=401;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(const round of [0,1,2]){
 const g=newRepair(random);g.current=round;
 for(const [width,height] of [[260,160],[350,220],[720,160],[1240,250],[1880,660],[3800,1650]]){
  const ids=workbench(g,width,height,random),points=scatterPile(ids.length,random),m=pileMetrics(width,height,ids.length);
  assert.equal(points.length,ids.length);for(const p of required(g))assert.equal(ids.filter(id=>id===p.id).length,1,'Every needed part is in the pile');
  assert(new Set(points.map(p=>p.angle)).size>ids.length/2,'Parts have varied angles');
  const bounds=(point,metrics,w,h)=>{
   const p=pilePosition(point,metrics),angle=point.angle*Math.PI/180,half=metrics.size*(Math.abs(Math.cos(angle))+Math.abs(Math.sin(angle)))/2;
   assert(p.x-half>=0&&p.x+half<=w&&p.y-half>=0&&p.y+half<=h,'Every rotated item stays inside the workbench');return p;
  };
  let overlaps=0;
  for(const [i,point] of points.entries()){
   assert(point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1);const p=bounds(point,m,width,height);
   for(const other of points.slice(i+1)){const q=pilePosition(other,m);if(Math.hypot(p.x-q.x,p.y-q.y)<m.size*.6)overlaps++;}
   for(const [x,y] of [[-1000,-1000],[width+1000,height+1000],[p.x,p.y]]){
    const dropped={...pileDrop(x,y,m),angle:point.angle};bounds(dropped,m,width,height);
    bounds(dropped,pileMetrics(260,160,ids.length),260,160);
    if(x===p.x&&y===p.y){assert(Math.abs(dropped.x-point.x)<1e-9);assert(Math.abs(dropped.y-point.y)<1e-9,'An unmoved drop stays put');}
   }
  }
  assert(overlaps>ids.length/3,'The bench has overlapping clumps rather than separated tiles');
  assert(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))>.6,'Scatter covers the bench width');
  assert(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))>.6,'Scatter covers the bench height');
  assert.notDeepEqual(scatterPile(ids.length,random),points,'A new round gets a fresh scatter');
 }
}
const ui=await fs.readFile('src/walk/mct-repair/game.js','utf8');
assert(!/mct-float|animation:|grid-template-columns:repeat|createElement\('small'\)/.test(ui),'The pile has no tiles, permanent captions or continuous movement');
assert(ui.includes("b.setAttribute('aria-label',p?.name||label(id))"),'Every covered item retains its accessible name');
assert(ui.includes("b.addEventListener('focus',()=>{raise(b);itemName();})"),'Keyboard focus uncovers an item');
for(const mode of ['', '.public','.prepared','.authoring']){
 const main=await fs.readFile(`src/walk/main${mode}.js`,'utf8');
 assert(main.includes("import {createMctRepair} from './mct-repair/game.js'"),'Every walk mode uses the same pile');
 for(const s of ["t.kind==='mct-repair'","repairStations.near(p)",'mctRepair.open(t.bay)','mctRepair?.close();','||!!mctRepair?.isOpen||','!mctRepair?.isOpen&&!emergencyDrill?.isOpen){acc+=dt;'])assert(main.includes(s),`${mode}: ${s}`);
}
console.log('PASS MCT repair: all 27 requested names, unique icons, valid mounts, all 26 tasks completable, every part available in each 4/8/12 round, bench counts, scattering, rotated bounds, persistent drops, resizing, keyboard access, scoring and four walk modes.');
