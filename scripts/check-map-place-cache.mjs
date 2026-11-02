import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import layout from '../src/plan/selected-layout.js';
import {contains} from '../src/plan/geometry-v2.js';
import {currentMapPlaces} from '../src/v2/map-labels.js';
import {V2_PLACES} from '../src/v2/wayfinding.js';
const original=places=>{const seen=new Set();return places.filter(p=>{const room=layout.rooms.find(r=>!r.aggregate&&Math.abs(p.at[1]-r.y)<1&&contains(r.polygon,[p.at[0],p.at[2]]));if(room&&(/-new-/.test(room.id)||/^neighborhood-\d+-(dining|cafe)$/.test(room.id))&&p.room!==room.id)return false;const key=p.room+'|'+p.name+'|'+p.at.join(',');if(seen.has(key))return false;seen.add(key);return true;});};
const places=structuredClone(V2_PLACES),verify=()=>assert.deepEqual(currentMapPlaces(places),original(places));verify();const cached=currentMapPlaces(places);assert.equal(currentMapPlaces(places),cached);
for(const edit of [()=>places.push({...places[0],at:[...places[0].at]}),()=>places.pop(),()=>places.reverse(),()=>places[0]={...places[0]},()=>places[0].at[0]+=100,()=>places[0].at[1]+=4,()=>places[0].at[2]-=100,()=>places[0].at.push(1),()=>places[0].at[3]=2,()=>places[0].room='changed-room',()=>places[0].name='changed-name',()=>places.splice(2,1),()=>places.length=0]){edit();verify();}
assert.deepEqual(currentMapPlaces([...V2_PLACES]),original(V2_PLACES));
const before=performance.now();for(let i=0;i<20;i++)original(V2_PLACES);const originalMs=(performance.now()-before)/20;currentMapPlaces(V2_PLACES);const start=performance.now();for(let i=0;i<1000;i++)currentMapPlaces(V2_PLACES);const cachedMs=(performance.now()-start)/1000;
const report={status:'PASS',places:V2_PLACES.length,filtered:currentMapPlaces(V2_PLACES).length,originalMs,cachedMs,mutations:13,method:'Exact comparison with the previous filter, repeated list identity, separate list, duplicates and in-place mutations; indicative Node timings only.'};await fs.mkdir('output/frame-time',{recursive:true});await fs.writeFile('output/frame-time/map-fixture.json',JSON.stringify(report,null,2));console.log(report);
