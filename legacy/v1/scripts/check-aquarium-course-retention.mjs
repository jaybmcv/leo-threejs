// Deterministic persistence and browser-key regression using both selected layouts.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createTreasureBoard} from '../server/aquarium-treasure.mjs';
import {buildLiveV2} from './build-live-v2.mjs';
import {liveSpatialFixtures} from './live-spatial-fixture.mjs';
import {applyV2Adapters} from './v2-adapters.mjs';
const {v1,v2}=await liveSpatialFixtures();
const selected=await import((await buildLiveV2({entry:'server/aquarium-treasure.mjs',outfile:'output/launch-h/treasure-v2.mjs'})).href);
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leo-aquarium-retention-')),file=path.join(dir,'scores.json');
const legacy=[
 {id:'11',name:'Existing champion',ms:1000,at:'2026-10-01T00:00:00.000Z'},
 {id:'22',name:'V1 swimmer',ms:999999,at:'2026-10-02T00:00:00.000Z'},
 {id:'33',name:'V2 swimmer',ms:999999,at:'2026-10-03T00:00:00.000Z'},
];
const stray={id:'44',name:'Stray local tag',ms:2000,at:'2026-11-01T00:00:00.000Z',course:2};
const seed=[...legacy,stray,{...stray,ms:3000,course:1}];
let v1Saved;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const state=async()=>JSON.parse(await fs.readFile(file,'utf8'));
try{
 await fs.writeFile(file,JSON.stringify(seed));const original=await fs.readFile(file,'utf8');
 for(const [version,layout,create,id] of [[1,v1,createTreasureBoard,'22'],[2,v2,selected.createTreasureBoard,'33']]){
  let clock=0;const messages=[],board=create({file,now:()=>clock,log(){},send:(_,m)=>messages.push(m)});
  const visitor=id=>({ws:{},name:legacy.find(e=>e.id===id)?.name,discord:{discordId:id},pos:layout.swimWorld(layout.SWIM.door)});
  const read=v=>{board.message(v,{op:'board'});const m=messages.at(-1);assert(!('course' in m));assert(!('previousCourse' in m));return m;};
  const champ=visitor('11');assert.equal(read(champ).you.ms,1000);
  assert.equal(read(visitor('44')).you.ms,2000,'stray tags never separate records; duplicate ids keep their fastest time');
  if(version===1)assert.equal(await fs.readFile(file,'utf8'),original,'loading must not rewrite existing records');
  function swim(v){
   const start=clock;v.pos=layout.swimWorld(layout.SWIM.door);board.message(v,{op:'start'});
   let q=[...layout.SWIM.entry];v.pos=layout.swimWorld(q);board.observe(v);
   for(const target of [...layout.SWIM.gems.map(g=>[g[0],g[1]-layout.SWIM.offset,g[2]]),layout.SWIM.chest]){
    const n=Math.ceil(layout.distance(q,target)/.3),from=[...q];
    for(let i=1;i<=n;i++){clock+=100;q=from.map((x,k)=>x+(target[k]-x)*i/n);v.pos=layout.swimWorld(q);board.observe(v);}
   }
   board.message(v,{op:'finish',ms:clock-start});const result=messages.at(-1);assert.equal(result.ok,true);return result;
  }
  const before=await fs.readFile(file,'utf8'),slower=swim(champ);
  assert.equal(slower.newBest,false);assert.equal(slower.best,1000);
  assert.equal(await fs.readFile(file,'utf8'),before,'a slower run leaves existing records untouched');
  const improved=swim(visitor(id));assert.equal(improved.newBest,true);assert(improved.best<999999);
  for(let n=0;n<100;n++){if((await state()).find(e=>e.id===id)?.ms===improved.best)break;await sleep(25);}
  const saved=await state();assert.equal(saved.find(e=>e.id===id).ms,improved.best);
  assert(saved.every(e=>!('course' in e)));assert.equal(saved.length,4);
  assert.deepEqual(saved.find(e=>e.id==='11'),legacy[0]);
  assert.deepEqual(saved.find(e=>e.id===(version===1?'33':'22')),version===1?legacy[2]:v1Saved);
  assert.deepEqual(saved.find(e=>e.id==='44'),{id:'44',name:stray.name,ms:2000,at:stray.at});
  if(version===1)v1Saved=saved.find(e=>e.id==='22');
  const response=read(visitor(id));assert.equal(response.you.ms,improved.best);assert.equal(response.top.length,4);
  let opposite;const other=(version===1?selected.createTreasureBoard:createTreasureBoard)({file,log(){},send:(_,m)=>opposite=m});
  other.message(visitor(id),{op:'board'});assert.deepEqual(opposite,response,'both layouts read identical rankings and personal bests');
  console.log('PASS v'+version+': existing best survives a slower swim; new best joins the same board and survives opposite-layout reload');
 }
 const client=await fs.readFile('src/walk/aquarium-treasure/game.js','utf8');
 assert.equal(applyV2Adapters('src/walk/aquarium-treasure/game.js',client),client.replaceAll('\r\n','\n'),'v2 uses the same client/key/UI');
 const key=client.match(/const KEY=[^;]+;/)[0],best=client.match(/const best=\(\)=>[^\r\n]+/)[0];
 const local=new Map([['leo-aquarium-best','1234']]),context={localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)}};
 assert.equal(vm.runInNewContext(key+best+';best()',{...context}),1234,'old browser best still counts');
 const finish=client.match(/ran=Math.round[^\r\n]+/)[0];
 vm.runInNewContext(key+best+';let ran;const t0=0,performance={now:()=>2345};'+finish,{...context});
 assert.equal(local.get('leo-aquarium-best'),'1234','slower browser swim preserves the old best');
 vm.runInNewContext(key+best+';let ran;const t0=0,performance={now:()=>1100};'+finish,{...context});
 assert.equal(local.get('leo-aquarium-best'),'1100');assert.equal(local.size,1,'no alternate browser key');
 console.log('PASS both layouts retain the original browser key and best, with no separate standings');
}finally{
 assert(path.dirname(path.resolve(dir))===path.resolve(os.tmpdir())&&path.basename(dir).startsWith('leo-aquarium-retention-'));
 await fs.rm(dir,{recursive:true,force:true});
}
