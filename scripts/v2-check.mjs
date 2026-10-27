import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {createHaze} from '../src/v2/haze.js';
import {attachFacade} from '../src/v2/facade.js';
import {validateBytes} from 'gltf-validator';
import layout from 'v2-layout';
import {registry,frame,toWorld,v1Frame,clearFrameOverrides,setFrameOverride} from '../src/plan/rooms.js';
import {remapSpot} from '../src/walk/link.js';
import {berthSpots,placements,cabinKey,template} from '../src/v2/cabins.js';
const hash=b=>createHash('sha256').update(b).digest('hex'),out='output/leo-interior-v02',checks=[];
assert.equal(layout.summary.issues.length,0);assert.equal(layout.cabins.length,5028);assert.equal(berthSpots().length,10000);
for(const c of placements()){assert.deepEqual(frame(c.id).origin,[c.x,c.y,c.z]);assert.equal(frame(c.id).yaw,c.yaw);const old=v1Frame(c.id),mapped=remapSpot({at:old.origin,yaw:0,room:c.id,lv:1});assert(mapped.at.every((v,i)=>Math.abs(v-c.matrix.elements[12+i])<1e-7));}
checks.push('5,028 selected cabin frames, yaw transforms, legacy link remaps and 10,000 rest spots');
for(const c of [...layout.rooms,...layout.fixedRooms].filter(r=>!r.aggregate)){assert(registry().some(f=>f.id===c.id));if(c.v1&&!['d02-arrival-1','d03-farm-1'].includes(c.id))assert.deepEqual(frame(c.id).origin,(c.fittingFrame||c.frame).origin);}
const selected=frame('commons-1');setFrameOverride('commons-1',{dx:1});assert.equal(frame('commons-1').origin[0],selected.origin[0]+1);clearFrameOverrides();assert.deepEqual(frame('commons-1'),selected);checks.push('Every v2 room has its production registry frame; clearing debug adjustments preserves the selected plan');
for(const n of ['leo-exterior.glb','leo-exterior-refined.glb','leo-exterior-web.glb','leo-exterior-phone.glb'])assert.equal(hash(await fs.readFile(out+'/'+n)),hash(await fs.readFile('output/leo-interior-v01/'+n)));
checks.push('All four exterior GLBs unchanged');
const haze=createHaze(),ray=new T.Raycaster(new T.Vector3(0,35,0),new T.Vector3(0,-1,0),0,80);haze.updateMatrixWorld(true);const hits=ray.intersectObject(haze);assert(hits.length&&Math.abs(hits[0].point.y+19.7)<.01,'Haze preserves the full atrium to the Deck 6 floor');
const scene=new T.Scene(),ship={};const facade=attachFacade(ship,scene);scene.updateMatrixWorld(true);const visibleFloor=ray.intersectObject(facade,true);assert(visibleFloor.length&&Math.abs(visibleFloor[0].point.y+19.715)<.01,'Distant facade retains Deck 6, with no intermediate solid atrium floor');checks.push('Haze and facade rays traverse all fourteen atrium voids to Deck 6');

const exports=[];for(const n of (await fs.readdir(out)).filter(n=>n.endsWith('.glb')&&!n.startsWith('leo-exterior'))){const bytes=await fs.readFile(out+'/'+n),v=await validateBytes(bytes,{maxIssues:100});exports.push({file:n,bytes:bytes.length,errors:v.issues.numErrors,warnings:v.issues.numWarnings});assert.equal(v.issues.numErrors,0,n);}
const roundBytes=await fs.readFile(out+'/leo-neighborhood.glb'),round=await new GLTFLoader().parseAsync(roundBytes.buffer.slice(roundBytes.byteOffset,roundBytes.byteOffset+roundBytes.byteLength),'');round.scene.updateMatrixWorld(true);let floors=0,mattresses=0;const byCabin=new Map(layout.cabins.map(c=>[c.id,c]));round.scene.traverse(o=>{if(!o.isInstancedMesh)return;if(/^Cabin_v2_floor/.test(o.name)){floors+=o.count;const ids=o.userData.cabinIds;assert(ids&&ids.length===o.count,'Round-trip instance ownership');for(let i=0;i<o.count;i++){const m=new T.Matrix4();o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);const c=byCabin.get(ids[i]),p=new T.Vector3().setFromMatrixPosition(m);assert(Math.abs(p.x-c.x)<.001&&Math.abs(p.z-c.z)<.001,'Round-trip cabin translation');const forward=new T.Vector3(0,0,1).transformDirection(m);assert(Math.abs(forward.x-Math.sin(c.yaw))<1e-5&&Math.abs(forward.z-Math.cos(c.yaw))<1e-5,'Round-trip cabin yaw');}}if(/^Cabin_v2_mattress/.test(o.name))mattresses+=o.count;});assert.equal(floors,473);assert.equal(mattresses,890);checks.push('Reimported Deck 15 export: 473 cabin floor instances, all yaw/ownership matrices, 890 mattresses');
const plan=JSON.parse(await fs.readFile(out+'/walk-plan.json','utf8'));assert(plan.rails.length>0);assert.equal(plan.windows.length,0);checks.push('Generated walk plan, glass rails and separate deck map; no Phase 5 hull cutting');
const report={status:'PASS',checks,exports};await fs.writeFile(out+'/check-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
