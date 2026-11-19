import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {ANGLE_IF_ASKED,PLAYWRIGHT_FROM} from './chrome-setup.mjs';
import {PARTS,PUZZLES,JUNK,JUNK_NAMES} from '../src/walk/mct-repair/catalog.js';
import {VIEWS,newRepair,required,workbench,scatterPile,pileMetrics,pilePosition,pileDrop,pileMotion,pushPile,stepPile,install,nextRound,formatTime} from '../src/walk/mct-repair/rules.js';
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
const junkNames=[
 'EV Charge Plug','Fire Extinguisher','Hydraulic Floor Jack','Cross Lug Wrench',"Mechanic's Toolbox",'Safety Traffic Cone','Heavy Tow Hook','Diagnostic Scanner','Cargo Ratchet Strap',
 'Cosmic Laser Pointer','Zero-G Tuna Can','Cybernetic Collar','Plasma Yarn Ball','Leo Keycard','Scratched Visor','Holographic Fish Puck','Space-Nip Pouch','Paw-Pad Control Pedal',
 'Zero-G Fish Bowl','Cat-Ear Headphones','Robo-Mouse Decoy','Catnip Hydro-Pod','Scratching Post Core','Space-Milk Carton','Chewed Cargo Box','Feather Teaser Drone','Gravity Kibble Bowl'
];
assert.equal(PARTS.length,45);assert.equal(new Set(PARTS.map(p=>p.id)).size,45);assert.equal(new Set(PARTS.map(p=>p.name)).size,PARTS.length,'No duplicate part names');assert.equal(PUZZLES.length,26);assert.equal(JUNK.length,42);assert.equal(new Set(JUNK).size,JUNK.length);
assert.deepEqual(Object.values(JUNK_NAMES),junkNames,'All 27 junk names are present exactly once');
const namedJunk=Object.keys(JUNK_NAMES),oldArt=new Set(JUNK.filter(id=>!namedJunk.includes(id)).map(partArt));
assert.equal(new Set(namedJunk.map(partArt)).size,27,'Every named junk item has its own icon');
for(const id of namedJunk){
 assert(JUNK.includes(id));assert(!PARTS.some(p=>p.id===id||p.name===JUNK_NAMES[id]),'Junk stays outside the repair parts catalog');
 const art=partArt(id);assert(art.startsWith('<svg'));assert(!oldArt.has(art),'Named junk must not fall back to generic debris art');
 for(const p of PARTS)assert.notEqual(art,partArt(p.id),'Junk and replacement parts have distinct icons');
 for(const puzzle of PUZZLES){
  assert(!puzzle.parts.includes(id),'Junk is never on a Required Parts list');
  const g=newRepair(()=>0);g.rounds=[puzzle,puzzle,puzzle];
  for(const view of VIEWS){g.view=view;assert.equal(install(g,id),false,'Junk cannot be installed in any view');}
  assert.equal(g.score,0);assert.equal(g.placed.size,0);assert.equal(g.phase,'play');
 }
}
// Sampling reaches the whole catalog while retaining the existing bench size and required parts.
let seed=406;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},seen=new Set(),samples=new Set();
for(let i=0;i<32;i++){
 const g=newRepair(random);
 for(let round=0;round<3;round++){
  g.current=round;const pile=workbench(g,1280,664,random),junk=pile.filter(id=>JUNK.includes(id));
  assert.equal(junk.length,28+round*4);assert.equal(new Set(junk).size,junk.length,'Sample without repeats when the catalog fits');
  assert.equal(pile.length,[40,48,56][round]);for(const id of g.rounds[round].parts)assert.equal(pile.filter(p=>p===id).length,1);
  assert(junk.some(id=>namedJunk.includes(id)),'New junk appears in every round');
  junk.forEach(id=>seen.add(id));samples.add(junk.slice().sort().join(','));
 }
}
assert.equal(seen.size,JUNK.length,'Every junk item can appear');assert(samples.size>1,'Rounds sample different junk');
for(const name of repairNames)assert.equal(PARTS.filter(p=>p.name===name).length,1,`${name} appears exactly once`);
for(const name of requestedNames)assert.equal(PARTS.filter(p=>p.name===name).length,1,`${name} appears exactly once`);
assert.equal(new Set(PARTS.map(p=>partArt(p.id))).size,PARTS.length,'Every repair part has a distinct icon');
for(const name of repairNames){const p=PARTS.find(p=>p.name===name);for(const junk of JUNK)assert.notEqual(partArt(p.id),partArt(junk),`${name} must not use generic debris art`);}
for(const name of requestedNames){const p=PARTS.find(p=>p.name===name);for(const junk of JUNK)assert.notEqual(partArt(p.id),partArt(junk),`${name} must not use generic debris art`);}
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
// Test real rotated bounds after scattering, dropping outside, and resizing.
let pileSeed=401;const pileRandom=()=>((pileSeed=(Math.imul(pileSeed,1664525)+1013904223)>>>0)/4294967296);
for(const round of [0,1,2]){
 const g=newRepair(pileRandom);g.current=round;
 for(const [width,height] of [[260,160],[350,220],[720,160],[1240,250],[1880,660],[3800,1650]]){
  const ids=workbench(g,width,height,pileRandom),points=scatterPile(ids.length,pileRandom),m=pileMetrics(width,height,ids.length);
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
  assert.notDeepEqual(scatterPile(ids.length,pileRandom),points,'A new round gets a fresh scatter');
 }
}
const ui=await fs.readFile('src/walk/mct-repair/game.js','utf8');
assert(!/animation:|grid-template-columns:repeat|createElement\('small'\)/.test(ui),'The pile has no tiles or permanent captions');
assert(ui.includes("b.setAttribute('aria-label',p?.name||JUNK_NAMES[id]||label(id))"),'Every covered item retains its accessible name');
assert(ui.includes("b.addEventListener('focus',()=>{raise(b);itemName();})"),'Keyboard focus uncovers an item');
for(const mode of ['', '.public','.prepared','.authoring']){
 const main=await fs.readFile(`src/walk/main${mode}.js`,'utf8');
 assert(main.includes("import {createMctRepair} from './mct-repair/game.js'"),'Every walk mode uses the same pile');
 for(const s of ["t.kind==='mct-repair'","repairStations.near(p)",'mctRepair.open(t.bay)','mctRepair?.close();','||!!mctRepair?.isOpen||','!mctRepair?.isOpen&&!emergencyDrill?.isOpen){acc+=dt;'])assert(main.includes(s),`${mode}: ${s}`);
}
console.log('PASS MCT repair core: all 18 requested names, distinct icons, valid mounts and playable tasks.');
console.log('PASS MCT repair: 45 repair parts, 27 named junk with unique icons never required or installable, sampled bench counts, all 26 tasks completable, scoring and four walk modes.');
console.log('PASS MCT pile: scattering, rotated bounds, persistent drops, resizing and keyboard access.');

// Float, grab impulses and bounds use the same pure steps as the open panel.
const floatMetrics=pileMetrics(700,240,56),initial=pileMotion({x:.5,y:.5,angle:27},3);
let idle=initial;
for(let i=0;i<180;i++)idle=stepPile(idle,floatMetrics,1/60,i/60);
const distance=(a,b,m=floatMetrics)=>{const p=pilePosition(a,m),q=pilePosition(b,m);return Math.hypot(p.x-q.x,p.y-q.y);};
assert(distance(initial,idle)>1,'Idle pieces move over three seconds');assert(distance(initial,idle)<15,'Idle drift stays easy to click');
assert.notEqual(idle.angle,initial.angle,'Pieces turn slowly');
assert.deepEqual(stepPile(initial,floatMetrics,1/60,2,{reduced:true}),initial,'Reduced motion has no idle float or rotation');
const pointer=pilePosition(initial,floatMetrics);
for(const [dx,dy] of [[12,0],[-12,0],[0,12],[0,-12],[8,-8]]){
 const point=pileMotion({...pileDrop(pointer.x+dx,pointer.y+dy,floatMetrics),angle:0}),pushed=pushPile(point,pointer,floatMetrics);
 assert(pushed.vx*dx+pushed.vy*dy>0,'A grab pushes directly away from the pointer');
 assert(Math.abs(pushed.vx*dy-pushed.vy*dx)<1e-8,'The push has no sideways component');
 const moved=stepPile(pushed,floatMetrics,.05,0,{reduced:true});assert(distance(moved,initial)>Math.hypot(dx,dy),'A nearby piece moves farther from the pointer');
 assert.deepEqual(stepPile(pushed,floatMetrics,.05,0,{held:true}),{...pushed,vx:0,vy:0},'Hovered, focused and held pieces stay put');
}
const near=pileMotion({...pileDrop(pointer.x+10,pointer.y,floatMetrics),angle:0}),far=pileMotion({...pileDrop(pointer.x+60,pointer.y,floatMetrics),angle:0});
assert(pushPile(near,pointer,floatMetrics).vx>pushPile(far,pointer,floatMetrics).vx,'Push fades with distance');
assert.deepEqual(pushPile(initial,{x:-1000,y:-1000},floatMetrics),initial,'Distant pieces are untouched');
assert.deepEqual(pushPile(initial,pointer,floatMetrics),initial,'Coincident centres never produce invalid numbers');
let gentle=pushPile(near,pointer,floatMetrics,true);assert(gentle.vx<pushPile(near,pointer,floatMetrics).vx,'Reduced motion uses a gentle push');
for(let i=0;i<120;i++)gentle=stepPile(gentle,floatMetrics,1/60,i/60,{reduced:true});
assert(Math.hypot(gentle.vx,gentle.vy)<.001,'A push damps to rest');assert.equal(gentle.angle,near.angle);
assert(distance(near,gentle)<3,'A reduced-motion push is short');
for(const [width,height] of [[82,100],[160,160],[260,160],[350,220],[1240,250],[3800,1650]]){
 const m=pileMetrics(width,height,56);assert(m.size>=52,'Small benches keep tappable targets');
 let points=scatterPile(56,pileRandom).map(pileMotion);
 for(let i=0;i<2400;i++){
  if(i%15===0){const pointer={x:pileRandom()*width,y:pileRandom()*height};points=points.map(p=>pushPile(p,pointer,m));}
  points=points.map(p=>stepPile(p,m,1/60,i/60));
  for(const p of points){
   const pos=pilePosition(p,m),half=m.size/Math.SQRT2;
   assert(Object.values(p).every(Number.isFinite),'Motion remains finite');
   assert(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1,'Motion stays normalized');
   assert(pos.x-half>=0&&pos.x+half<=width&&pos.y-half>=0&&pos.y+half<=height,'Repeated grabs and idle keep every rotated corner on the bench');
  }
 }
 const small=pileMetrics(260,160,56);
 for(const p of points){const pos=pilePosition(p,small);assert(pos.x-small.inset>=0&&pos.x+small.inset<=260+.001&&pos.y-small.inset>=0&&pos.y+small.inset<=160+.001,'Resize contains the whole pile');}
}
console.log('PASS MCT float: idle drift, slow rotation, radial falloff, damping, held items, reduced motion and 40 seconds of repeated pushes at six bench sizes.');

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
    await page.locator(`[data-part="${first.id}"]`).focus();
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
 // Exercise actual pointer input and viewport resizing as well as the pure motion maths.
 await page.setViewportSize({width:1280,height:720});
 await page.evaluate(()=>{repair.open(3);document.querySelector('.mct-repair [data-primary]').click();});
 const pileSample=()=>page.evaluate(()=>[...document.querySelector('[data-pile]').children].map(el=>({x:+el.dataset.x,y:+el.dataset.y})));
 const beforeFloat=await pileSample();await page.waitForTimeout(3000);const afterFloat=await pileSample();
 assert(afterFloat.some((p,i)=>Math.hypot(p.x-beforeFloat[i].x,p.y-beforeFloat[i].y)>.001),'The open game floats without input');
 const inspectPile=()=>page.evaluate(()=>{
  const pile=document.querySelector('[data-pile]'),box=pile.getBoundingClientRect();
  return [...pile.children].map(el=>{
   const r=el.getBoundingClientRect(),angle=parseFloat(el.style.getPropertyValue('--angle'))*Math.PI/180,half=r.width*(Math.abs(Math.cos(angle))+Math.abs(Math.sin(angle)))/2,x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
   return {size:r.width,inside:x-half>=box.left-.1&&x+half<=box.right+.1&&y-half>=box.top-.1&&y+half<=box.bottom+.1};
  });
 });
 const target=await page.evaluate(()=>{
  const pile=document.querySelector('[data-pile]'),box=pile.getBoundingClientRect(),items=[...pile.children],centre=el=>{const r=el.getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};};
  const el=items.find(el=>{
   const p=centre(el),hit=document.elementFromPoint(p.x,p.y);
   return el.contains(hit)&&p.x>box.left+90&&p.x<box.right-90&&p.y>box.top+40&&p.y<box.bottom-40&&items.some(other=>other!==el&&Math.hypot(centre(other).x-p.x,centre(other).y-p.y)<70);
  });
  if(!el)throw Error('No accessible clustered piece');el.dataset.checkGrab='';return centre(el);
 });
 await page.mouse.move(target.x,target.y);
 const grabBefore=await page.evaluate(()=>[...document.querySelector('[data-pile]').children].map(el=>{const r=el.getBoundingClientRect();return {el:el.hasAttribute('data-check-grab'),x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};}));
 await page.mouse.down();await page.waitForTimeout(250);
 const grabAfter=await page.evaluate(()=>[...document.querySelector('[data-pile]').children].map(el=>{const r=el.getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};}));
 const grabbed=grabBefore.findIndex(p=>p.el);
 assert(Math.hypot(grabAfter[grabbed].x-grabBefore[grabbed].x,grabAfter[grabbed].y-grabBefore[grabbed].y)<.1,'The pressed piece stays under the pointer');
 assert(grabBefore.some((p,i)=>i!==grabbed&&Math.hypot(p.x-target.x,p.y-target.y)<90&&Math.hypot(grabAfter[i].x-target.x,grabAfter[i].y-target.y)>Math.hypot(p.x-target.x,p.y-target.y)+.2),'Pressing a piece pushes a neighbour away');
 await page.mouse.move(target.x+70,target.y,{steps:12});await page.mouse.up();
 const dropped=await page.locator('[data-check-grab]').boundingBox();
 assert(Math.abs(dropped.x+dropped.width/2-target.x-70)<1&&Math.abs(dropped.y+dropped.height/2-target.y)<1,'Dragging leaves a piece at its bench drop point');
 assert((await inspectPile()).every(p=>p.inside));
 await page.setViewportSize({width:390,height:600});await page.waitForTimeout(100);
 assert((await inspectPile()).every(p=>p.inside&&p.size>=52),'Narrow viewport retains readable targets inside the bench');
 const needed=await page.evaluate(()=>repair.state.needed[0]);
 await page.locator(`[data-view="${needed.view}"]`).click();await page.locator(`[data-part="${needed.id}"]`).focus();await page.keyboard.press('Enter');await page.locator('[data-cart]').click();
 assert.equal(await page.evaluate(()=>repair.state.placed.length),1,'A required part installs after resizing');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 const still=await pileSample();await page.waitForTimeout(600);assert.deepEqual(await pileSample(),still,'Reduced motion disables idle movement in the panel');
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>repair.isOpen),false);
 await page.emulateMedia({reducedMotion:'no-preference'});
 assert.equal(seen.size,PUZZLES.length,'Every catalogue task was measured');assert.deepEqual(errors,[]);
 console.log('PASS MCT float panel: idle, pointer push, held piece, 390x600 resize, installation and reduced motion.');
 console.log(`PASS MCT repair layout: all ${seen.size} tasks, up to ${maxParts} parts, at 1700x870, 1280x720, 390x844 and 844x390; readable rows and installed marks, no clipping or list scroll.`);
}finally{await browser.close();}
