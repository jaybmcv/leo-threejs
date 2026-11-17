import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {ANGLE_IF_ASKED,PLAYWRIGHT_FROM} from './chrome-setup.mjs';
import {PARTS,PUZZLES,JUNK} from '../src/walk/mct-repair/catalog.js';
import {VIEWS,newRepair,required,workbench,install,nextRound,formatTime} from '../src/walk/mct-repair/rules.js';
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
for(const mode of ['', '.public','.prepared','.authoring']){
 const main=await fs.readFile(`src/walk/main${mode}.js`,'utf8');
 for(const s of ["t.kind==='mct-repair'","repairStations.near(p)",'mctRepair.open(t.bay)','mctRepair?.close();','||!!mctRepair?.isOpen||','!mctRepair?.isOpen&&!emergencyDrill?.isOpen){acc+=dt;'])assert(main.includes(s),`${mode}: ${s}`);
}
console.log('PASS MCT repair: all 27 requested names, unique icons, valid mounts, all 26 tasks completable, every part available in each 4/8/12 round, bench counts, scoring and four walk modes.');

// Measure the real panel, including the longest twelve-part tasks and installed marks.
const {chromium}=createRequire(PLAYWRIGHT_FROM)('playwright');
const bundle=await build({stdin:{contents:"export {createMctRepair} from './src/walk/mct-repair/game.js';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'repairCheck',platform:'browser'});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-gpu-sandbox',...ANGLE_IF_ASKED]});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><html><body></body></html>');
 const fonts=await Promise.all([['Archivo','archivo'],['Sora','sora'],['JetBrains Mono','jetbrains']].map(async([name,file])=>`@font-face{font-family:"${name}";src:url(data:font/woff2;base64,${(await fs.readFile(`src/brand/${file}.woff2`)).toString('base64')}) format('woff2');font-weight:100 900}`));
 await page.addStyleTag({content:fonts.join('\n')});
 await page.evaluate(()=>Promise.all(['14px Archivo','700 22px Sora','12px "JetBrains Mono"'].map(font=>document.fonts.load(font))));
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>{globalThis.repair=repairCheck.createMctRepair();});
 const seen=new Set(),maxParts=Math.max(...PUZZLES.map(p=>p.parts.length));assert.equal(maxParts,12);
 for(const [width,height] of [[1700,870],[1280,720],[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  // Twelve evenly spaced draws cover all 12/8/6 choices across the three rounds.
  for(let sample=0;sample<12;sample++){
   await page.evaluate(sample=>{
    repair.open(3);const random=Math.random;Math.random=()=>(sample+.5)/12;
    try{document.querySelector('.mct-repair [data-primary]').click();}finally{Math.random=random;}
   },sample);
   for(let round=0;round<3;round++){
    const measure=()=>page.evaluate(()=>{
     const root=document.querySelector('.mct-repair'),list=root.querySelector('[data-required]'),panel=list.closest('[data-assembly]'),aside=list.parentElement;
     root.scrollTop=0;
     const bounds=e=>e.getBoundingClientRect(),inside=(r,b)=>r.left>=b.left-.5&&r.right<=b.right+.5&&r.top>=b.top-.5&&r.bottom<=b.bottom+.5;
     const view={left:0,top:0,right:innerWidth,bottom:innerHeight},rows=[...list.children],problems=[];
     if(list.scrollHeight>list.clientHeight+1||list.scrollWidth>list.clientWidth+1)problems.push('List content overflows');
     if(['auto','scroll','hidden','clip'].includes(getComputedStyle(list).overflowY))problems.push('List clips or scrolls');
     if(rows.length!==repair.state.needed.length)problems.push('Missing required row');
     for(const row of rows){
      const r=bounds(row),text=row.querySelector('span'),icon=row.querySelector('svg'),range=document.createRange();range.selectNodeContents(text);
      if(![list,aside,panel].every(p=>inside(r,bounds(p)))||!inside(r,view))problems.push('Row outside list, panel or window: '+row.textContent);
      if(!inside(range.getBoundingClientRect(),r)||!inside(bounds(icon),r))problems.push('Clipped name or icon: '+text.textContent);
      if(parseFloat(getComputedStyle(text).fontSize)<11||bounds(icon).width<24)problems.push('Unreadable row: '+text.textContent);
      if(row.classList.contains('done')&&(row.lastElementChild.textContent!=='OK'||!inside(bounds(row.lastElementChild),r)))problems.push('Missing installed mark');
     }
     return {problems,count:rows.length,name:root.querySelector('[data-name]').textContent,ids:repair.state.needed.map(p=>p.id).join(',')};
    });
    const before=await measure();seen.add(before.ids);assert.deepEqual(before.problems,[],`${width}x${height}, round ${round+1}, ${before.name}`);
    const first=await page.evaluate(()=>repair.state.needed[0]);
    await page.locator(`[data-view="${first.view}"]`).click();
    await page.locator(`[data-part="${first.id}"]`).click();
    await page.locator('[data-cart]').click();
    const after=await measure();assert.deepEqual(after.problems,[],`${width}x${height}, installed mark, ${after.name}`);
    assert.equal(await page.locator('[data-required] .done').count(),1);
    await page.evaluate(()=>{
     for(const p of repair.state.needed.slice(1)){document.querySelector(`[data-view="${p.view}"]`).click();document.querySelector(`[data-part="${p.id}"]`).click();document.querySelector('[data-cart]').click();}
    });
    await page.waitForFunction(()=>!document.querySelector('.mct-repair [data-screen]').hidden);
    assert.equal(await page.evaluate(()=>repair.state.phase),round===2?'complete':'clear');
    if(round<2)await page.locator('.mct-repair [data-primary]').click();
   }
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>repair.isOpen),false);
  }
 }
 assert.equal(seen.size,PUZZLES.length,'Every catalogue task was measured');assert.deepEqual(errors,[]);
 console.log(`PASS MCT repair layout: all ${seen.size} tasks, up to ${maxParts} parts, at 1700x870, 1280x720, 390x844 and 844x390; readable rows and installed marks, no clipping or list scroll.`);
}finally{await browser.close();}
