import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {runtimeLayout} from './v2-plugin.mjs';
import {selectViewerLayout,viewerStats,viewerRooms,checkViewerLabels,cleanRing,edgeDistance} from '../src/v2/viewer-data.js';
import {viewerRoutes,checkViewerRoutes,checkTourPoint,walkYaw,tourWalkSpot,exteriorFlightOffset} from '../src/v2/viewer-routes.js';
import {viewerHTML} from './viewer-page-v2.mjs';
async function check(){
const arg=process.argv.find(a=>a.startsWith('--base=')),folder=arg?path.join(arg.slice(7),'output'):'output/leo-interior-v02';
const full=JSON.parse(await fs.readFile(path.join(folder,'layout.json'),'utf8')),walk=JSON.parse(await fs.readFile(path.join(folder,'walk-plan.json'),'utf8'));
const trimmed=runtimeLayout(full);assert(trimmed.decks.every(d=>!('corridors'in d)),'fixture must use walk runtime shape');
const selected=selectViewerLayout(trimmed),routes=viewerRoutes(selected),samples=checkViewerRoutes(trimmed,routes,{shells:walk.shells});assert(samples>1000);assert.equal(checkViewerRoutes(selected,routes,{shells:walk.shells}),samples);
assert.deepEqual(viewerStats(full),{cabins:5028,berths:10000,shuttles:100,rooms:450,decks:20,gardens:10});
assert.equal(selected.stats.rooms,selected.rooms.length);assert(!selected.rooms.some(r=>r.aggregate));assert(selected.rooms.some(r=>r.id==='d02-new-1'));assert.equal(selected.rooms.filter(r=>r.kind==='garden').length,10);assert.equal(selected.shuttles.length,100);assert(selected.shuttles.every(s=>s.polygon.length>=3));
// Every exact slab hole and per-deck object survives projection. No legacy full-deck room replaces real bays.
for(const d of selected.decks){const source=full.decks.find(a=>a.number===d.number);assert.deepEqual(d.slab.holes.map(h=>h.id),source.slab.holes.map(h=>h.id));for(const h of d.slab.holes){const original=source.slab.holes.find(a=>a.id===h.id).polygon;assert(h.polygon.every(p=>edgeDistance(original,p)<1e-6));}assert.equal(selected.cabins.filter(c=>c.deck===d.number).length,full.cabins.filter(c=>c.deck===d.number).length);}
assert.deepEqual(cleanRing([[0,0],[2,0],[2,0],[2,1],[0,1],[0,0]]),[[0,0],[2,0],[2,1],[0,1]]);
const labels=[...selected.rooms.map(r=>r.name),...Object.values(routes).flatMap(r=>r.shots.map(s=>s.label))];checkViewerLabels(full,labels);
const page=await viewerHTML({viewer:'viewer.js',layoutFile:'layout.json',stats:selected.stats});assert(page.includes('5,028 cabins'));assert(page.includes('10,000 berths'));assert(page.includes('100 escape shuttles'));assert(!/lifeboat|5,000 cabins|Phase 3 cabin review/i.test(page));assert(!page.includes('@@'));
const first=routes.ROUTE.shots[0],room=trimmed.rooms.find(r=>r.id===first.room),v=room.polygon[0];
assert.throws(()=>checkTourPoint(trimmed,first,[v[0],room.y+1.7,v[1]]),/wall/,'a stop in a wall must fail');
const brokenShot={...first,to:[v[0],room.y+1.7,v[1]]};assert.throws(()=>checkViewerRoutes(trimmed,{broken:{shots:[brokenShot]}},{shells:walk.shells}),/wall/,'continuous path through a wall must fail');
const concave={id:'fixture-concave',y:0,height:3.5,polygon:[[0,0],[8,0],[8,8],[5,8],[5,3],[3,3],[3,8],[0,8]]},concaveWorld={...trimmed,rooms:[concave]},crossing={id:'crossing',room:concave.id,from:[1.5,1.7,6],to:[6.5,1.7,6]};assert.doesNotThrow(()=>checkTourPoint(concaveWorld,crossing,crossing.from));assert.doesNotThrow(()=>checkTourPoint(concaveWorld,crossing,crossing.to));assert.throws(()=>checkViewerRoutes(concaveWorld,{crossing:{shots:[crossing]}}),/wall/,'valid endpoints must not conceal a wall crossing');
const atrium=routes.ATRIUM_TOUR.shots[0];assert.throws(()=>checkTourPoint(trimmed,atrium,[0,30,100]),/atrium/);assert.throws(()=>checkViewerLabels(full,[...labels,'Family commons']),/label/,'a retired room label must fail');assert.throws(()=>checkTourPoint(trimmed,{...first,room:'retired-room'},first.from),/Retired/);
assert.equal(tourWalkSpot(selected,atrium).at[1],full.decks[5].y);assert.equal(selected.rooms.filter(r=>r.kind==='garden').reduce((n,r)=>n+r.components.galleries.length,0),60);
const fakeShell={...walk.shells.find(s=>s.id===first.room),polygon:[[first.from[0]-.1,first.from[2]-.1],[first.from[0]+.1,first.from[2]-.1],[first.from[0]+.1,first.from[2]+.1],[first.from[0]-.1,first.from[2]+.1]]};assert.throws(()=>checkTourPoint(trimmed,first,first.from,{shells:[fakeShell]}),/shell/);
assert.equal(walkYaw([0,0,0],[0,0,1]),0);assert.equal(walkYaw([0,0,0],[1,0,0]),Math.PI/2);
for(let angle=0;angle<Math.PI*2;angle+=.05)assert(Math.abs(Math.hypot(...exteriorFlightOffset(angle,500))-500)<1e-8,'Exterior flight radius must not drift inward');
const source=await fs.readFile('src/v2/viewer.js','utf8');assert(source.includes("lite?'leo-exterior-phone.glb':'leo-exterior-web.glb'"));assert(!source.includes("from '../viewer")&&!source.includes("from '../model")&&!source.includes("from 'v2-layout'"));assert(source.includes('fetch(window.LEO_VIEWER_LAYOUT)'));
console.log('PASS v2 viewer: '+samples+' tour samples; exact deck holes, 450 current room labels, 100 bays, counts, runtime trimming and 7 negative controls.');

}
await check();
