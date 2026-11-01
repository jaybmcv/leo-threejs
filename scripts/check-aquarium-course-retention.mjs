// Deterministic storage-only supplement to the real signed WebSocket suite.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createTreasureBoard} from '../server/aquarium-treasure.mjs';
import {SWIM,swimWorld,distance} from '../src/walk/aquarium-treasure/layout.js';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'leo-course-retention-')),file=path.join(dir,'scores.json'),id='889999999999999999';
const course2={id,name:'Local retained swimmer',ms:23456,at:'2026-11-01T00:00:00.000Z',course:2};
try{await fs.writeFile(file,JSON.stringify([{id,name:'Local retained swimmer',ms:999999,at:'2026-10-01T00:00:00.000Z'},course2]));
 let clock=0;const messages=[],v={ws:{},name:'Local retained swimmer',discord:{discordId:id},pos:swimWorld(SWIM.door)};
 const board=createTreasureBoard({file,course:1,now:()=>clock,log(){},send:(_,m)=>messages.push(m)});board.message(v,{op:'start'});let q=[...SWIM.entry];v.pos=swimWorld(q);board.observe(v);
 for(const target of [...SWIM.gems.map(g=>[g[0],g[1]-SWIM.offset,g[2]]),SWIM.chest]){const n=Math.ceil(distance(q,target)/.3),from=[...q];for(let i=1;i<=n;i++){clock+=100;q=from.map((x,k)=>x+(target[k]-x)*i/n);v.pos=swimWorld(q);board.observe(v);}}
 board.message(v,{op:'finish',ms:clock});assert(messages.at(-1).ok);await new Promise(r=>setTimeout(r,1100));
 const kept=JSON.parse(await fs.readFile(file,'utf8'));assert.deepEqual(kept.find(e=>e.course===2),course2);assert.equal(kept.find(e=>!e.course).ms,clock);assert.equal(kept.length,2);
 console.log('PASS v1 course award preserves the same player’s course-2 record and keeps the original v1 record schema');
}finally{assert(path.dirname(path.resolve(dir))===path.resolve(os.tmpdir())&&path.basename(dir).startsWith('leo-course-retention-'));await fs.rm(dir,{recursive:true,force:true});}
