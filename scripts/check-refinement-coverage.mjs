import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SHIP_AREAS} from '../src/areas.js';
import {AREA_TREATMENTS} from '../src/area-finish.js';
const out='output/leo-interior-v01/';
const b=await fs.readFile(out+'leo-full-ship.glb');
const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;});
const records=[];
for(const area of SHIP_AREAS){
 const root=g.scene.getObjectByName('Area_'+area.id);assert.ok(root,'Missing assembled area '+area.id);
 const refinement=root.userData.refinement,expected=AREA_TREATMENTS[area.kind];
 assert.ok(expected&&refinement?.features?.[expected]>0,'Missing specialty finish '+area.id);
 let newVertices=0,finishedSurfaces=0;root.traverse(o=>{if(!o.isMesh)return;
  if(o.name.startsWith('Refined_'))newVertices+=o.geometry.attributes.position.count;
  const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.some(m=>m.name.startsWith('Finish_')))finishedSurfaces++;
 });
 assert.ok(newVertices>0&&finishedSurfaces>0,'No physical finish geometry '+area.id);
 records.push({id:area.id,name:area.name,deck:area.deck,treatment:expected,newVertices,finishedSurfaces,features:refinement.features});
}
const connections=[];
for(const [decks,suffix] of [[[1,2,3,4,5,16],'connected_service_corridors'],[[2,7,14,15,16,17,20],'special_area_connections']])for(const deck of decks){
 const root=g.scene.getObjectByName(`Deck_${deck}_${suffix}`);assert.ok(root,'Missing corridor '+deck+' '+suffix);
 assert.ok(root.userData.refinement?.features.corridor_lining>0,'Unfinished corridor '+deck);
 assert.ok(root.getObjectByName('Refined_corridor_lining'),'Missing saved lining geometry');connections.push({deck,type:suffix,features:root.userData.refinement.features});
}
const transit=g.scene.getObjectByName('LEO_connected_transit');
assert.ok(transit?.userData.refinement?.features.wayfinding===78,'Every served lift landing must have a deck sign');
assert.ok(transit.getObjectByName('Refined_wayfinding')&&transit.getObjectByName('Refined_stair_grip'),'Missing transit finish geometry');
const aft=g.scene.getObjectByName('AFT_SYSTEMS_BLOCKOUT');assert.ok(aft);
for(const [section,feature] of Object.entries({drive:'machinery_instruments',tanks:'machinery_instruments',pods:'maintenance_controls',access:'wayfinding',fin:'structural_collars'})){
 assert.ok(aft.userData.refinement?.sections[section]?.[feature]>0,'Unfinished aft section '+section);
 assert.ok(aft.getObjectByName('Aft_'+section).getObjectByName('Refined_'+feature),'Missing saved aft finish '+section);
}
// Previously finished areas remain present in every repeated neighborhood.
for(let n=1;n<=10;n++){
 const residence=g.scene.getObjectByName('Furnished_neighborhood_'+String(n).padStart(2,'0'));
 assert.ok(residence?.getObjectByName('Upholstered_headboard'),'Missing finished residence '+n);
 assert.ok(residence.getObjectByName('Residential_corridor_wayfinding_inlay'),'Missing residential corridor finish '+n);
 const garden=g.scene.getObjectByName('Fitted_garden_commons_'+String(n).padStart(2,'0'));
 assert.ok(garden?.getObjectByName('Garden_commons_refined_furnishings'),'Missing finished garden '+n);
}
assert.ok(g.scene.getObjectByName('Forward_lounge_finish')&&g.scene.getObjectByName('Fin_lounge_finish'),'Missing previously refined lounges');
const report={status:'PASS',scope:'Saved complete ship: all 74 named areas have their specialty finish and actual new geometry; all 13 corridor groups, 78 lift landing signs, stair finishes and 5 aft engineering sections are present. Ten residential neighborhoods, ten garden commons and both previously finished lounges retained. Separate geometry and integration reports cover containment and routes.',namedAreas:records.length,corridorGroups:connections.length,liftLandingSigns:78,aftSections:5,priorNeighborhoods:10,priorGardens:10,priorLounges:2,areas:records,connections,aft:aft.userData.refinement.sections};
await fs.writeFile(out+'refinement-coverage.json',JSON.stringify(report,null,2));console.log({...report,areas:undefined,connections:undefined,aft:undefined});
