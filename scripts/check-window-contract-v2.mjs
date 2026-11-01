import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {hydrateHullLayout} from '../src/plan/envelope-data-v2.js';
import {hullPlanChecks} from './hull-plan-check-v2.mjs';
import {roomWindowValid,prototypeRoomWindowValid,checkGeneratedRoomWindows} from './window-contract-v2.mjs';
{
const L=JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8')),obs=L.windows.filter(w=>w.roomId==='observation-lounge'),ordinary=L.windows.filter(w=>w.roomId&&w.kind!=='garden'&&w.roomId!=='observation-lounge');
assert.deepEqual(checkGeneratedRoomWindows(L),[]);
assert.equal(obs.length,24);let negatives=0;
for(const w of obs){assert(roomWindowValid(w));for(const patch of [{kind:'working'},{width:2.99},{height:2.2},{height:6.64},{sill:.5},{pitch:3.31}]){assert(!roomWindowValid({...w,...patch}));negatives++;}}
for(const w of ordinary){assert(roomWindowValid(w),w.id);for(const patch of [{height:6.65,sill:.45},{kind:'garden'},{kind:'unknown'},{width:2.99},{height:w.height+.01},{sill:w.sill+.01}]){assert(!roomWindowValid({...w,...patch}),w.id);negatives++;}}
for(const p of L.hullPrototypes.prototypes.filter(p=>p.ownerId==='observation-lounge'))for(const r of p.openings){assert(prototypeRoomWindowValid(p,r,L.windows));assert(!prototypeRoomWindowValid(p,[r[0],r[1],r[2],r[2]+2.2],L.windows));assert(!prototypeRoomWindowValid({...p,kind:'garden'},r,L.windows));assert(!prototypeRoomWindowValid({...p,roomKind:'working'},r,L.windows));negatives+=3;}
for(const mutate of [l=>l.windows.splice(l.windows.findIndex(w=>w.roomId==='observation-lounge'),1),l=>{const w=l.windows.find(w=>w.roomId==='observation-lounge');w.clearPrototypeRect[0]+=.01;w.clearPrototypeRect[1]+=.01;}]){const m=structuredClone(L);mutate(m);assert(checkGeneratedRoomWindows(m).length);negatives++;}
const real=hydrateHullLayout(structuredClone(L));assert.equal(hullPlanChecks(real).status,'PASS');
const integrated=[];
for(const [name,mutate] of [
 ['observation kind',m=>{m.windows.find(w=>w.roomId==='observation-lounge').kind='working';}],
 ['ordinary room full-height glazing',m=>{const w=m.windows.find(w=>w.roomId&&w.roomId!=='observation-lounge'&&!w.shuttleId&&w.kind==='public');w.height=6.65;w.sill=.45;const p=m.hullPrototypes.prototypes.find(p=>p.id===w.prototype),r=p.openings.find(r=>r.every((v,i)=>Math.abs(v-w.clearPrototypeRect[i])<1e-5));r[2]=.45;r[3]=7.1;w.clearPrototypeRect=[...r];}]
]){const m=structuredClone(real);mutate(m);assert(checkGeneratedRoomWindows(m).length,name+' plan negative');const rejected=hullPlanChecks(m);assert.equal(rejected.status,'FAIL',name+' envelope negative');assert(rejected.issues.some(i=>i.kind==='room window dimensions'),name+' exact dimension assertion');integrated.push(name);}
console.log(JSON.stringify({status:'PASS',observationWindows:obs.length,standardWindows:ordinary.length,negativeMutants:negatives,integrationNegatives:integrated}));
}
