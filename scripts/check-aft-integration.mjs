import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {Box3,Vector3,Raycaster} from 'three';import envelope from '../src/assets/aft-envelope.json' with {type:'json'};import {createAft} from '../src/aft.js';
const b=await fs.readFile('output/leo-interior-v01/leo-full-ship.glb'),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;});g.scene.updateMatrixWorld(true);
const interior=g.scene.getObjectByName('Fitted_ship_interior'),aft=g.scene.getObjectByName('AFT_SYSTEMS_BLOCKOUT');assert.ok(aft);const geometry=[];interior.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)geometry.push({o,b:new Box3().setFromObject(o)});});
const ray=new Raycaster(),up=new Vector3(0,1,0),down=new Vector3(0,-1,0);let headroom=0,floors=0,routeChecks=0;
function probe(p){const [x,y,z]=p;const candidates=geometry.filter(({b})=>b.min.x<=x&&b.max.x>=x&&b.min.z<=z&&b.max.z>=z);
 ray.set(new Vector3(x,y+.03,z),up);ray.far=2.07;const overhead=ray.intersectObjects(candidates.filter(({b})=>b.max.y>y+.03&&b.min.y<y+2.1).map(a=>a.o))[0];assert.ok(!overhead,'Headroom: '+overhead?.object.name+' at '+p);headroom++;
 ray.set(new Vector3(x,y+.25,z),down);ray.far=.29;assert.ok(ray.intersectObjects(candidates.map(a=>a.o)).some(h=>Math.abs(h.point.y-y)<.015),'Missing floor '+p);floors++;
}
function walk(a,b){const va=new Vector3(...a),vb=new Vector3(...b),length=va.distanceTo(vb),n=Math.ceil(length*2);for(let i=0;i<=n;i++)probe(va.clone().lerp(vb,i/n).toArray());routeChecks++;}
for(const path of createAft().routes)for(const p of path.points)probe(p);
for(let d=4;d<=17;d++){const y=-39.7+(d-1)*4;walk([-132,y,0],[-170.5,y,0]);walk([-170.5,y,0],[-170.5,y,-10]);walk([-156,y,0],[-156,y,5.8]);
 if(d<17){probe([-163.5,y+2,-10]);for(let i=0;i<12;i++){probe([-169.5+(i+.5)*5/12,y+(i+1)/6,-11.4]);probe([-164.5-(i+.5)*5/12,y+2+(i+1)/6,-8.6]);}}
}
walk([-240,-27.7,0],[-132,-27.7,0]);walk([-183,-11.7,0],[-132,-11.7,0]);for(const z of [-8,8]){walk([-284,-11.7,z],[-183,-11.7,z]);walk([-183,-11.7,z],[-183,-11.7,0]);}walk([-240,24.3,0],[-132,24.3,0]);
for(const s of [-1,1])walk([-276,-19.7,s*126.1625862121582],[-174,-19.7,s*126.1625862121582]);
// Check the turn from each wing gallery at body height, where vertical probes
// alone would miss a handrail spanning the opening.
let junctionSamples=0;
for(const s of [-1,1])for(const dz of [-.6,0,.6])for(const h of [.3,1.1,1.7]){
 const p=new Vector3(-180,-19.7+h,s*126.1625862121582+dz);
 ray.set(p,new Vector3(1,0,0));ray.far=10;
 const hits=ray.intersectObjects(geometry.filter(({b})=>b.max.x>=-180&&b.min.x<=-170&&b.min.y<=p.y&&b.max.y>=p.y&&b.min.z<=p.z&&b.max.z>=p.z).map(a=>a.o));
 assert.equal(hits.length,0,'Pod junction obstruction: '+hits[0]?.object.name);junctionSamples++;
}
for(const z of [-6,6])walk([-270,132.3,z],[-211,132.3,z]);walk([-240,132.3,-6],[-240,132.3,6]);walk([-247,132.3,3],[-247,132.3,6]);
for(const q of envelope.fin.filter(q=>q.y>=32&&q.y<=128&&(q.y-32)%16===0))walk([-243,q.y,0],[q.b-7,q.y,0]);
const counts={};aft.traverse(o=>counts[o.name]=(counts[o.name]||0)+1);assert.equal(counts.Reservoir_tank,4);assert.equal(counts.Pod_drive_chamber,4);assert.equal(counts.Central_drive_train,3);assert.equal(counts.Fin_inspection_platform,7);
assert.equal(counts.Crown_central_bar,1);assert.ok(counts.Crown_panoramic_window>40);assert.equal(counts.Crown_lift_car_floor,1);
const report={crownBar:1,crownWindows:counts.Crown_panoramic_window,status:'PASS',reservoirTanks:4,podDriveChambers:4,centralDriveTrains:3,finPlatforms:7,headroomSamples:headroom,floorSamples:floors,levelRouteSegments:routeChecks,podJunctionSamples:junctionSamples,scope:'Reloaded assembled ship: aft counts, supporting floors and 2.1 m headroom on stair treads, wing gallery treads, core landings and central maintenance aisles. Includes crown promenades and fin lift landings. Lift motion and operating machinery are not simulated.'};await fs.writeFile('output/leo-interior-v01/aft-integration-report.json',JSON.stringify(report,null,2));console.log(report);

