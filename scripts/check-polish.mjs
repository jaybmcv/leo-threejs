import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SHIP_AREAS} from '../src/areas.js';
import {surfaceIndex} from '../src/exterior-finish.js';
import {CROWN} from '../src/fin-crown.js';
import {applyContextOpacity} from '../src/glazing-finish.js';
import {retainFinCapUnderside} from '../src/fin-cap-shell.js';

const out='output/leo-interior-v01/';
async function load(name){const b=await fs.readFile(out+name),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;});g.scene.updateMatrixWorld(true);return g.scene;}
const full=await load('leo-full-ship.glb'),exterior=full.getObjectByName('01_EXTERIOR_REFINED_V31');
function physicalPolish(root){let materials=0,details=0;root.traverse(o=>{if(!o.isMesh)return;const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.some(m=>m.name.endsWith('_polished')))materials++;if(o.name.startsWith('Polish_'))details+=o.geometry.attributes.position.count;});assert.ok(materials>0,'No polished surfaces in '+root.name);return {materials,details};}
const areas=[];for(const area of SHIP_AREAS){const root=full.getObjectByName('Area_'+area.id);assert.equal(root?.userData.polish?.revision,2,area.id);const p=root.userData.polish.furnishings;assert.ok(p.softenedFixtures+p.instrumentBezels>0,area.id+' no revised fixtures');areas.push({id:area.id,...physicalPolish(root)});}
let corridors=0;for(const [decks,suffix]of [[[1,2,3,4,5,16],'connected_service_corridors'],[[2,7,14,15,16,17,20],'special_area_connections']])for(const d of decks){const r=full.getObjectByName(`Deck_${d}_${suffix}`);assert.equal(r?.userData.polish?.revision,2);physicalPolish(r);corridors++;}
const transit=full.getObjectByName('LEO_connected_transit');assert.ok(transit.userData.polish.stairMarkers>0&&transit.userData.polish.liftReveals>0);assert.ok(transit.getObjectByName('Polish_stair_edge_marker')&&transit.getObjectByName('Polish_lift_door_reveal'));physicalPolish(transit);
for(const section of ['drive','tanks','pods','access','fin']){const r=full.getObjectByName('Aft_'+section);assert.equal(r.userData.polish.revision,2);physicalPolish(r);}
for(let i=1;i<=10;i++){const n=String(i).padStart(2,'0'),r=full.getObjectByName('Furnished_neighborhood_'+n),g=full.getObjectByName('Fitted_garden_commons_'+n);physicalPolish(r);physicalPolish(g);assert.ok(r.getObjectByName('Polish_tailored_seam'));}
physicalPolish(full.getObjectByName('Forward_lounge_finish').parent);physicalPolish(full.getObjectByName('Fin_panorama_lounge'));

const panes=[];full.traverse(o=>{if(o.userData.directionalGlazing)panes.push(o);});let passengerWindows=0,rayTests=0;const ray=new T.Raycaster(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
for(const pane of panes){
 const surfaces=pane.children.filter(o=>o.isMesh),outer=surfaces.find(o=>o.material.name==='LEO_glass_exterior_tint'),inner=surfaces.find(o=>o.material.name==='LEO_glass_interior_clear');assert.ok(outer&&inner,'Missing paired optical surfaces '+pane.name);
 assert.equal(outer.material.side,T.FrontSide);assert.equal(inner.material.side,T.FrontSide);assert.ok(outer.material.opacity>=.85&&outer.material.opacity<=.92);assert.ok(inner.material.opacity<=.15&&inner.material.opacity>0);assert.ok(outer.material.transparent&&inner.material.transparent);
 passengerWindows+=pane.userData.windowCount||0;
 const geo=outer.geometry,p=geo.attributes.position,ix=geo.index;
 for(const tri of [0,Math.floor((ix.count/3-1)/2),ix.count/3-1]){
  const i=tri*3;a.fromBufferAttribute(p,ix.getX(i)).applyMatrix4(outer.matrixWorld);b.fromBufferAttribute(p,ix.getX(i+1)).applyMatrix4(outer.matrixWorld);c.fromBufferAttribute(p,ix.getX(i+2)).applyMatrix4(outer.matrixWorld);
  const center=a.clone().add(b).add(c).multiplyScalar(1/3),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();assert.ok(normal.length()>.99);
  if(pane.userData.side){const s=pane.userData.side*(pane.name.includes('pod_inner')?-1:1);assert.ok(normal.z*s>0,'Reversed hull tint '+pane.name);}
  if(pane.name==='Crown_panoramic_window')assert.ok(normal.dot(new T.Vector3(center.x+235,0,center.z))>0,'Reversed crown tint');
  for(const [sign,expected]of [[1,outer],[-1,inner]]){ray.set(center.clone().addScaledVector(normal,sign*.05),normal.clone().multiplyScalar(-sign));ray.near=0;ray.far=.1;const hit=ray.intersectObjects(surfaces,false)[0];assert.equal(hit?.object,expected,'Wrong visible tint face '+pane.name);rayTests++;}
 }
}
assert.equal(passengerWindows,1382);assert.ok(panes.filter(o=>o.name==='Crown_panoramic_window').length>=60);
for(const value of [.14,1,.14,1])applyContextOpacity(exterior,value);
for(const pane of panes)for(const o of pane.children.filter(o=>o.isMesh)){assert.equal(o.material.opacity,o.material.name==='LEO_glass_exterior_tint'?.88:.12);assert.ok(o.material.transparent&&!o.material.depthWrite,'View switch erased window tint');}

// Compare the restored lower cap to the original curved underside, rather than
// accepting the presence of an arbitrary replacement box as proof.
const source=await load('leo-exterior.glb'),original=source.getObjectByName('Swept_tail_cap'),retained=full.getObjectByName('Fin_cap_retained_white_underside');assert.ok(retained?.isMesh);
const oldBottom=surfaceIndex([original],'y','min'),newBottom=surfaceIndex([retained],'y','min');let undersideSamples=0;
for(let x=-278;x<-192;x+=.7)for(let z=-15;z<=15;z+=.6){if(x>=CROWN.lift.x0-.1&&x<=CROWN.lift.x1+.1&&z>=CROWN.lift.z0-.1&&z<=CROWN.lift.z1+.1)continue;const y=oldBottom(x,z);if(!Number.isFinite(y)||y>=CROWN.floor-.58)continue;assert.ok(Math.abs(y-newBottom(x,z))<.003,'Lost original white underside '+[x,z]);undersideSamples++;}
assert.ok(undersideSamples>1000);const bb=new T.Box3().setFromObject(retained);assert.ok(bb.min.y<125&&bb.max.y<=CROWN.floor-.54);assert.ok(retained.material.color.r>.5&&retained.material.color.g>.5&&retained.material.color.b>.5);
retainFinCapUnderside(original,CROWN.floor-.55,CROWN.lift);const expected=original.geometry.attributes.position,actual=retained.geometry.attributes.position;assert.equal(actual.count,expected.count);for(let i=0;i<actual.count;i++){a.fromBufferAttribute(expected,i).applyMatrix4(original.matrixWorld);b.fromBufferAttribute(actual,i).applyMatrix4(retained.matrixWorld);assert.ok(a.distanceTo(b)<.0001,'Altered original cap vertex '+i);}
for(const file of ['leo-exterior-refined.glb','leo-aft-systems.glb']){const r=await load(file);let caps=0;r.traverse(o=>{if(o.userData.retainedCap)caps++;});assert.equal(caps,1,'Restored cap must appear exactly once in '+file);}
// Test clear sightlines behind central portions of the curved observation band.
const hull=[];exterior.traverse(o=>{if(o.isMesh&&(/^Smooth_pressure_envelope_/.test(o.name)||o.name==='Individual_glazing_seals'))hull.push(o);});let observationSightlines=0;
for(const pane of panes.filter(o=>o.name==='Forward_observation_panes')){
 const o=pane.children.find(o=>o.material.name==='LEO_glass_exterior_tint'),p=o.geometry.attributes.position,ix=o.geometry.index;
 for(let i=36;i<ix.count;i+=384){a.fromBufferAttribute(p,ix.getX(i)).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,ix.getX(i+1)).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,ix.getX(i+2)).applyMatrix4(o.matrixWorld);const center=a.clone().add(b).add(c).multiplyScalar(1/3),n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();ray.set(center.clone().addScaledVector(n,-2),n);ray.near=0;ray.far=2.05;const hits=ray.intersectObjects(hull,false);assert.equal(hits.length,0,'Opaque observation backing at '+center.toArray()+' '+hits[0]?.object.name);observationSightlines++;}
}
assert.ok(observationSightlines>10);
const report={status:'PASS',areas:areas.length,corridorGroups:corridors,aftSections:5,neighborhoods:10,gardens:10,lounges:2,passengerWindows,glazingGroups:panes.length,pairedTintRayTests:rayTests,undersideSamples,observationSightlines,insideOpacity:.12,outsideOpacity:.88};await fs.writeFile(out+'polish-check.json',JSON.stringify(report,null,2));console.log(report);
