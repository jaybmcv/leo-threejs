import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as T from 'three';
import {createCarryState,CARRY_KEY} from '../src/walk/carry-state.js';
import {carryItem,registerCarryItem} from '../src/walk/carry-items.js';
import {carrySpots} from '../src/walk/carry-spots.js';
import {spotIndex} from '../src/walk/rest.js';
import {phase4Programme} from '../src/v2/phase4-programme.js';
import {contains} from '../src/plan/geometry-v2.js';
import {createWalkBindings,BINDINGS_KEY,DEFAULT_BINDINGS} from '../src/walk/bindings.js';

const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},desks=['d02-new-2','d16-new-1'];
let state=createCarryState(desks,{storage});
assert.equal(state.snapshot().backpack.length,12);for(const slots of Object.values(state.snapshot().stores))assert.equal(slots.length,10);
assert.equal(state.pickup('yarn').ok,true);assert.equal(state.snapshot().backpack[0],'yarn');assert.equal(state.pickup('yarn').ok,false);
assert.equal(state.move('backpack',0,desks[0]).ok,true);assert.equal(state.location('yarn'),desks[0]);
state=createCarryState(desks,{storage});assert.equal(state.location('yarn'),desks[0]);assert.equal(state.snapshot().stores[desks[1]].filter(Boolean).length,0);
assert.equal(state.move(desks[0],0,'backpack').ok,true);assert.equal(state.home(0).ok,true);assert.equal(createCarryState(desks,{storage}).location('yarn'),'home');
for(let i=0;i<23;i++)registerCarryItem({id:'check-'+i,name:'Capacity fixture '+i,icon:'<svg/>'});
for(let i=0;i<12;i++)assert.equal(state.pickup('check-'+i).ok,true);
const full=state.snapshot();assert.equal(state.pickup('ration').ok,false);assert.deepEqual(state.snapshot(),full);assert.equal(state.location('ration'),'home');
for(let i=0;i<10;i++)assert.equal(state.move('backpack',i,desks[0]).ok,true);
assert.equal(state.move('backpack',10,desks[0]).ok,false);assert.equal(state.location('check-10'),'backpack');
for(let i=12;i<22;i++)assert.equal(state.pickup('check-'+i).ok,true);
assert.equal(state.move(desks[0],0,'backpack').ok,false);assert.equal(state.location('check-0'),desks[0]);
data.set(CARRY_KEY,JSON.stringify({backpack:['yarn','yarn','unknown'],stores:{[desks[0]]:['yarn','ration']}}));state=createCarryState(desks,{storage});
assert.deepEqual(state.snapshot().backpack.slice(0,3),['yarn',null,null]);assert.equal(state.location('ration'),desks[0]);
data.set(CARRY_KEY,'broken');assert.equal(createCarryState(desks,{storage}).location('yarn'),'home');
const blocked=createCarryState(desks,{storage:{getItem(){throw Error();},setItem(){throw Error();}}});assert.deepEqual(blocked.pickup('yarn'),{ok:true,saved:false});assert.equal(blocked.location('yarn'),'backpack');assert.equal(blocked.home(0).ok,true);
const previous={...DEFAULT_BINDINGS,emotes:'KeyO'};delete previous.backpack;data.set(BINDINGS_KEY,JSON.stringify(previous));assert.equal(createWalkBindings(storage).get('emotes'),'KeyO');assert.equal(createWalkBindings(storage).get('backpack'),'KeyI');
previous.emotes='KeyI';data.set(BINDINGS_KEY,JSON.stringify(previous));assert.equal(createWalkBindings(storage).get('emotes'),'KeyI');assert.equal(createWalkBindings(storage).get('backpack'),null);

const layout=JSON.parse(fs.readFileSync('output/leo-interior-v02/layout.json','utf8')),programme=phase4Programme(layout),spots=carrySpots(layout),study=spots.find(s=>s.item==='ration'),side=[study.approach[0]-.5,study.approach[1],study.approach[2]];
for(const spot of spots){
 const room=layout.rooms.find(r=>r.id===spot.room),desk=programme.parts.find(p=>p.room===spot.room&&p.part==='desk_top'&&Math.hypot(p.at[0]-spot.desk[0],p.at[2]-spot.desk[2])<.001);
 assert(desk,'an existing desk in '+spot.name);assert.equal(room.deck,spot.deck);assert(!/cabin|crew/i.test(room.name));
 assert(Math.abs(spot.home[0]-desk.at[0])<desk.size[0]/2);assert(Math.abs(spot.home[2]-desk.at[2])<desk.size[2]/2);
 assert(Math.hypot(spot.approach[0]-spot.home[0],spot.approach[2]-spot.home[2])<1.85);
 for(const approach of [spot.approach,...(spot.item==='ration'?[side]:[])])for(let i=0;i<=30;i++){
  const p=[approach[0]-i*.1,approach[2]];assert(contains(room.polygon,p),'room floor supports the approach and departure');
  for(const part of programme.parts.filter(p=>p.room===spot.room&&!p.noCollide&&p.at[1]+p.size[1]/2>room.y+.4&&p.at[1]-p.size[1]/2<room.y+2)){
   const dx=p[0]-part.at[0],dz=p[1]-part.at[2],c=Math.cos(part.yaw||0),s=Math.sin(part.yaw||0),x=c*dx-s*dz,z=s*dx+c*dz;
   const distance=Math.hypot(Math.max(0,Math.abs(x)-part.size[0]/2),Math.max(0,Math.abs(z)-part.size[2]/2));
   assert(distance>.35,spot.name+' approach/departure clears '+part.part);
  }
 }
}
// Run the actual prompt selectors with the selected layout's seats, without a browser or ship meshes.
const nearBody=fs.readFileSync('src/walk/carry.js','utf8').match(/near\(p\)\{([\s\S]*?)\n \},use/)[1];
const quiet={near:()=>null,nearest:()=>null},services=Object.fromEntries('prank wardPush treasure lifts graffiti crownTv hangarDoor cabinGlass booth photoSpots comics chinampa vault vaultLift changeLog arrivalTour repairStations emergencyStation asteroid poolTable maze pinballMachine dartsLanes arcadeRow pawsOff mudwater halloween leverPanel keelClub mct'.split(' ').map(k=>[k,quiet]));
for(const mode of ['', '.public','.prepared','.authoring']){
 const source=fs.readFileSync('src/walk/main'+mode+'.js','utf8'),body=source.slice(source.indexOf('function target(){'),source.indexOf('const touch=',source.indexOf('function target(){')));
 const state=createCarryState(desks,{storage:{getItem:()=>null,setItem(){}}}),controller={position:new T.Vector3()},carry={isOpen:false,near:runInNewContext('(function(p){'+nearBody+'})',{opened:false,spots,state,contains,carryItem})};
 const rest=spotIndex(programme.rests.map(s=>({...s,point:new T.Vector3(...s.point)})));
 const target=runInNewContext('('+body.trim()+')',{...services,controller,carry,rest,T,heading:Math.PI/2,inBall:false,scope:null,remotes:null,ball:{mesh:{position:new T.Vector3(0,1000,0)}},BALL:{radius:1}});
 for(const s of spots){
  controller.position.fromArray(s.approach);assert.equal(target().kind,'carry-item');state.pickup(s.item);
  const seat=rest.pick(controller.position,new T.Vector3(1,0,0));assert.equal(target().kind,seat?'sit':'carry-desk',mode+' keeps the original interaction after pick-up');
  if(seat){assert.equal(target().spot.id,'p4-d16-new-1-seat-8');assert.equal(target().label,'Sit down');}
 }
 controller.position.fromArray(side);assert.equal(target().kind,'carry-desk');assert.equal(target().label,'Open');
 state.home(state.snapshot().backpack.indexOf('ration'));controller.position.fromArray(study.approach);assert.equal(target().label,'Pick up Ration tin');
}
console.log('PASS carry: fixed capacities, unique locations, first free slots, independent stores, reload, put back, malformed/blocked storage, binding migration, unchanged desk approaches and seat/desk prompt priority in all four walk modes');
