import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PARTS,PUZZLES,JUNK} from '../src/walk/mct-repair/catalog.js';
import {VIEWS,newRepair,required,workbench,install,nextRound,formatTime,pileLayout,floatingPart,boundPart,pushPart,floatPart} from '../src/walk/mct-repair/rules.js';
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
// Idle movement, a stable pointer target, and an outward impulse with distance falloff.
const idle=floatingPart(120,100,70,80);
for(let i=0;i<180;i++)floatPart(idle,800,400,1/60);
assert(Math.hypot(idle.x-120,idle.y-100)>1,'Idle tiles really move');
const held={...idle};pushPart(held,100,100);
floatPart(held,800,400,1/60,{held:true});assert.equal(held.x,idle.x);assert.equal(held.y,idle.y);assert.equal(held.vx,0);
const near=floatingPart(140,100,60,60),far=floatingPart(200,100,60,60),outside=floatingPart(400,100,60,60);
pushPart(near,130,130);pushPart(far,130,130);pushPart(outside,130,130);
assert(near.vx>far.vx&&far.vx>0);assert.equal(near.vy,0);assert.equal(outside.vx,0);
const awayBefore=near.x;floatPart(near,800,400,1/60);assert(near.x>awayBefore);
const left=floatingPart(30,100,60,60);pushPart(left,130,130);assert(left.vx<0);
const quiet=floatingPart(120,100,70,80);
for(let i=0;i<180;i++)floatPart(quiet,800,400,1/60,{reduced:true});assert.equal(quiet.x,120);assert.equal(quiet.y,100);
pushPart(quiet,100,140,true);for(let i=0;i<180;i++)floatPart(quiet,800,400,1/60,{reduced:true});
assert(quiet.x>120&&quiet.x<123,'Reduced motion keeps only a gentle push');assert.equal(quiet.vx,0);
// Repeated pushes, long idle spells and smaller bounds never lose a tile, in any round.
for(let round=0;round<3;round++){
 const g=newRepair(()=>.25);g.current=round;
 const tiles=workbench(g,1280,720,()=>.3).map((id,i)=>({id,...floatingPart(10+i%12*80,10+Math.floor(i/12)*85,64,70,i)}));
 for(let i=0;i<7200;i++)for(const p of tiles){
  const width=i<1800?1000:320,height=i<1800?500:170;
  if(i%15===0)pushPart(p,(i*37)%width,(i*13)%height);
  floatPart(p,width,height,1/60);assert(p.x>=0&&p.y>=0&&p.x+p.w<=width&&p.y+p.h<=height);
 }
 for(const p of required(g)){assert(tiles.some(t=>t.id===p.id));g.view=p.view;assert(install(g,p.id));}
}
const edge=floatingPart(-10,400,70,80);edge.vx=-10;edge.vy=10;boundPart(edge,320,170);
assert.equal(edge.x,0);assert.equal(edge.y,90);assert(edge.vx>0&&edge.vy<0);
// Resizing grows the scrollable pile while preserving usable targets and full label height.
for(const count of [40,48,56])for(const width of [1246,640,390,320,281,74])for(const labelHeight of [33,66]){
 const layout=pileLayout(count,width,170,labelHeight+53),{cols,cw,ch,w,h}=layout;
 assert(w>=74&&h>=96&&h>=labelHeight+53);assert(layout.height>170);assert(layout.width>=width);
 for(let i=0;i<count;i++){
  const p=floatingPart(i%cols*cw+(cw-w)/2,Math.floor(i/cols)*ch+(ch-h)/2,w,h,i);
  for(let frame=0;frame<180;frame++){
   if(frame%15===0)pushPart(p,p.x-10,p.y+h/2);
   floatPart(p,layout.width,layout.height,1/60);
   assert(p.x>=0&&p.y>=0&&p.x+w<=layout.width&&p.y+h<=layout.height);
  }
 }
}
for(const mode of ['', '.public','.prepared','.authoring']){
 const main=await fs.readFile(`src/walk/main${mode}.js`,'utf8');
 for(const s of ["t.kind==='mct-repair'","repairStations.near(p)",'mctRepair.open(t.bay)','mctRepair?.close();','||!!mctRepair?.isOpen||','!mctRepair?.isOpen&&!emergencyDrill?.isOpen){acc+=dt;'])assert(main.includes(s),`${mode}: ${s}`);
}
console.log('PASS MCT repair: all 27 requested names, unique icons, valid mounts, all 26 tasks completable, every part available in each 4/8/12 round, bench counts, scoring and four walk modes.');
console.log('PASS MCT repair motion: idle drift, held targets, outward pushes, damping, reduced motion, readable scrollable layouts and long-run resized bounds.');
