import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Box3,Vector3} from 'three';
import {SHIP_AREAS as ALL_AREAS,createShipArea} from '../src/areas.js';
import {createServiceCirculation} from '../src/service-circulation.js';
import {insideHull,logicalX,hullAt} from '../src/model.js';
import {finishedRoofY} from '../src/exterior-profile.js';
const SHIP_AREAS=ALL_AREAS.filter(a=>!a.special);
const evidence=[];let samples=0,minRoofMargin=Infinity;
const required={cargo:'Secured_cargo_container',stores:'Storage_rack',cold:'Insulated_storage',workshop:'Tool_board',community:'Tool_board',logistics:'Systems_wall_display',control:'Systems_wall_display',arrival:'Passenger_bench',security:'Scanner_upright',airlock:'Pressure_chamber_floor',baggage:'Baggage_conveyor',farm:'Hydroponic_rack',nursery:'Hydroponic_rack',harvest:'Wash_sink',kitchen:'Cooking_surface',air:'Air_handling_unit',thermal:'Heat_exchanger',water:'Water_treatment_vessel',recycle:'Recovery_machine',power:'Power_distribution_cabinet',ward:'Patient_bed_base',isolation:'Privacy_partition',surgery:'Surgical_light',clinic:'Consultation_partition',imaging:'Diagnostic_scanner',pharmacy:'Storage_rack',counseling:'Privacy_screen',shelter:'Shelter_bench',classroom:'Teaching_screen',library:'Book_stack',gym:'Treadmill',recreation:'Game_board',theater:'Stage',childcare:'Play_block',dining:'Meal_service_station'};
for(const a of SHIP_AREAS){
 const room=createShipArea(a),b=new Box3().setFromObject(room.root),[cx,cy,cz]=a.center;
 assert.ok(b.min.x>=cx-26.01&&b.max.x<=cx+26.01&&b.min.z>=cz-17.01&&b.max.z<=cz+17.01,`${a.id}: fittings leave footprint`);
 assert.ok(b.min.y>=cy-.26&&b.max.y<=cy+3.5,`${a.id}: fittings leave deck`);
 for(let ix=0;ix<=12;ix++)for(let iz=0;iz<=8;iz++){
  const x=cx-26+52*ix/12,z=cz-17+34*iz/8;
  assert.ok(insideHull(x,cy+3.5,z),`${a.id}: upper hull`);
  assert.ok(insideHull(x,cy-.25,z),`${a.id}: lower hull`);
  const margin=finishedRoofY(logicalX(x),z)-cy-3.5;minRoofMargin=Math.min(minRoofMargin,margin);assert.ok(margin>=0,`${a.id}: finished roof`);samples+=2;
 }
 let fixtureCount=0,meshes=0;room.root.traverse(o=>{if(o.name===required[a.kind])fixtureCount++;if(o.isMesh)meshes++;});
 assert.ok(fixtureCount>0,`${a.id}: missing ${required[a.kind]}`);assert.ok(meshes>20);
 for(const pose of [room.overview,room.inside])assert.ok([...pose.position,...pose.target].every(Number.isFinite));
 assert.ok(room.inside.position[0]>cx-26&&room.inside.position[0]<cx+26&&room.inside.position[2]>cz-17&&room.inside.position[2]<cz+17);
 evidence.push({id:a.id,kind:a.kind,deck:a.deck,meshes,requiredFixture:required[a.kind],fixtureCount});
}
for(let i=0;i<SHIP_AREAS.length;i++)for(let j=i+1;j<SHIP_AREAS.length;j++){
 const a=SHIP_AREAS[i],b=SHIP_AREAS[j];if(a.deck!==b.deck)continue;
 assert.ok(Math.abs(a.center[0]-b.center[0])>=52||Math.abs(a.center[2]-b.center[2])>=34,`Overlapping rooms: ${a.id}, ${b.id}`);
}
const circulation=[];
for(const deck of new Set(SHIP_AREAS.map(a=>a.deck))){
 const corridor=createServiceCirculation(deck);corridor.root.updateMatrixWorld(true);let vertices=0;
 corridor.root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
   assert.ok(insideHull(v.x,v.y,v.z),`Deck ${deck}: corridor ${o.name} outside hull at ${v.toArray()}`);
   assert.ok(v.y<=finishedRoofY(logicalX(v.x),v.z),`Deck ${deck}: corridor roof`);vertices++;
  }
 });
 const boxes=[];corridor.shell.traverse(o=>{if(o.isMesh&&o.name.includes('wall'))boxes.push(new Box3().setFromObject(o));});
 for(const route of corridor.plan.connections){
  for(let k=1;k<route.points.length;k++){
   const a=route.points[k-1],b=route.points[k],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   for(let d=0;d<=Math.ceil(length*2);d++){const t=d/Math.max(1,Math.ceil(length*2)),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
    assert.ok(!boxes.some(box=>box.containsPoint(new Vector3(x,corridor.plan.y+1.7,z))),`Deck ${deck}: blocked route ${route.id}`);
   }
  }
 }
 circulation.push({deck,roomConnections:corridor.plan.connections.length,vertices,spineWidth:8,branchWidth:7});
}
const report={status:'PASS',areas:SHIP_AREAS.length,roomTypes:new Set(SHIP_AREAS.map(a=>a.kind)).size,hullSamples:samples,minimumFinishedRoofMarginM:minRoofMargin,evidence,circulation,scope:'Service-room and corridor containment, same-deck room separation, fixture presence, camera locations and clear corridor centerline routes to all 48 entries. Does not prove system capacity, vertical integration, or whole-ship completion.'};
await fs.writeFile('output/leo-interior-v01/area-fit-report.json',JSON.stringify(report,null,2));console.log({...report,evidence:undefined});
