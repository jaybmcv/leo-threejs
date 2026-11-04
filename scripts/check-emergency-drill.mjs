import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {newGame,step,STEP,DURATION,difficulty,METALS,HEALTH_POINTS} from '../src/walk/emergency-drill/rules.js';
import {applyRoomFitoutOverrides} from '../src/v2/room-fitout-overrides.js';
import {drillStation,DRILL_CRAFT} from '../src/walk/emergency-drill/station.js';
import {fitoutGeometry,material} from '../src/v2/phase4-mesh-kit.js';
import {escapeSeatPlan} from '../src/plan/shuttle-seats-v2.js';

const empty=()=>Object.assign(newGame(1),{spawn:Infinity,pickup:Infinity});
const contact=(g,kind='meteor',metal=0)=>{g.objects.push({kind,metal,x:g.x,y:g.y,depth:.999,spin:0,checked:false});step(g);};
{const g=empty();contact(g);assert.equal(g.health,90);for(let i=0;i<30;i++)step(g);assert.equal(g.health,90,'one meteor hits only once');
 for(let i=0;i<9;i++)contact(g);assert.equal(g.phase,'failed');assert.equal(g.score,0);const before=JSON.stringify(g);step(g,{x:1});assert.equal(JSON.stringify(g),before);}
{const g=empty();for(let i=0;i<3;i++)contact(g,'metal',i);assert.equal(g.metals,METALS.reduce((n,m)=>n+m.value,0));assert.deepEqual(g.collected,[1,1,1]);
 contact(g);while(g.t<DURATION-STEP/2)step(g);assert.equal(g.phase,'landed');assert.equal(g.t,60);assert.equal(g.score,g.metals+90*HEALTH_POINTS);}
{const g=empty();for(let i=0;i<3599;i++)step(g);assert.equal(g.phase,'play');step(g);assert.equal(g.phase,'landed');assert.equal(g.score,10000);}
{const g=empty();for(let i=0;i<240;i++)step(g,{x:1,y:-1});assert.equal(g.x,1);assert.equal(g.y,-1);}
assert(difficulty(59).speed>difficulty(1).speed);assert(difficulty(59).interval<difficulty(1).interval);
const run=seed=>{const g=newGame(seed);for(let i=0;i<3600&&g.phase==='play';i++)step(g,{x:Math.sin(i/83),y:Math.cos(i/121)});return g;};
assert.deepEqual(run(42),run(42),'replays are deterministic');
for(let seed=1;seed<=20;seed++){const g=run(seed);assert(['landed','failed'].includes(g.phase));assert(g.objects.length<25);assert(g.health>=0&&g.health<=100);assert(Number.isFinite(g.score));}

// A rotated craft fixture proves fittings and the trigger share their frame.
const craft={id:DRILL_CRAFT,roomId:'d04-lifeboats-10',deck:4,x:91,y:-27.7,z:68.18887442938441,yaw:-Math.PI/2};
const layout={rooms:[],shuttles:[craft]},data=applyRoomFitoutOverrides({parts:[],rests:[],rooms:[]},layout),station=drillStation(layout);
assert.equal(data.parts.length,4);assert(data.parts.every(p=>p.component===craft.id&&p.room===craft.roomId&&p.noCollide));
const button=data.parts.find(p=>p.part==='emergency_drill_button');assert.deepEqual(button.at,station.point);assert.equal(button.mat,'red');
const [x,y,z]=station.approach;assert.equal(station.near({x,y,z})?.kind,'emergency-drill');assert.equal(station.near({x,y:y+4,z}),null);assert.equal(station.near({x:x+10,y,z}),null);
for(const seat of escapeSeatPlan(craft,craft.id)){const [u,,v]=seat.local;assert(Math.hypot(Math.max(0,Math.abs(8.9-u)-.34),Math.max(0,Math.abs(.775-v)-.24))>.35,'a 0.7 m walker fits between the seat rows at the button approach');}
assert(9.51-8.9>.35,'helm stays clear of the walker');assert(2.93-.126>2,'full standing headroom below the craft ceiling');
const geo=fitoutGeometry(button);geo.computeBoundingBox();assert(Math.abs(geo.boundingBox.max.x-geo.boundingBox.min.x-.16)<1e-6);geo.dispose();assert.equal(material('red').color.getHex(),0xd92332);
const ordinary={id:'ordinary',deck:1,x:1,y:2,z:3,frame:{origin:[1,2,3],yaw:0}};
const parts=applyRoomFitoutOverrides({parts:[],rests:[],rooms:[]},{rooms:[ordinary],shuttles:[]},{ordinary:{add:[{part:'desk',size:[1,1,1],at:[1,1,1],mat:'oak'}]}});assert.deepEqual(parts.parts[0].at,[2,3,4]);
for(const mode of ['', '.public','.prepared','.authoring']){const main=await fs.readFile('src/walk/main'+mode+'.js','utf8');assert(main.includes("t.kind==='emergency-drill'"));assert(main.includes('emergencyStation.near(p)'));assert(main.includes('!emergencyDrill?.isOpen){acc+=dt;'));assert(main.includes('function closePanels(){emergencyDrill?.close();'));}
console.log('PASS Emergency Drill: 60-second landing, ten-hit failure, one hit per meteor, metal values, health bonus, difficulty, deterministic runs, craft fitting/trigger and all four walk modes');
