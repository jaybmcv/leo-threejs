import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import layout from 'v2-layout';
import {BODY,Colliders} from '../src/walk/collision.js';
import {placements,cabinKey,template,cabinRestSpots} from '../src/v2/cabins.js';
export async function checkCabins(){const all=placements(),keys=[...new Set(all.map(cabinKey))],reports=[];
 for(const key of keys){const g=template(key),sign=key.includes('--')?-1:1,col=new Colliders();col.addStatic(g);col.commit();const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3(),stand=(u,v)=>{const z=-sign*v;ray.origin.set(u,.4,z);const h=col.raycast(ray,.8);if(!h)return false;seg.start.set(u,h.point.y+BODY.step+BODY.radius,z);seg.end.set(u,h.point.y+BODY.height-BODY.radius,z);return !col.overlaps(seg,BODY.radius);};
  for(let v=-3.5;v<=3.2;v+=.2)assert(stand(0,v),key+' centre aisle blocked at '+v);
  for(const v of [-1.25,-1.65,-2.05,-2.4,-2.8,-3.22])assert(stand(.845,v),key+' wet-pod approach blocked at '+v);
  for(const s of g.userData.rest){ray.origin.set(s.point[0],s.point[1]+.3,s.point[2]);const h=col.raycast(ray,.5);assert(h&&Math.abs(h.point.y-s.point[1])<.025,key+' rest spot lacks actual cushion/cover support');const v=-sign*s.point[2];assert(stand(0,v),key+' rest approach blocked');assert(Math.abs(s.point[0])<1.45,key+' rest spot beyond native E reach');}
  for(const o of g.children.filter(o=>o.isMesh&&!o.userData.shell)){const b=new T.Box3().setFromObject(o,true);assert(b.min.x>=-1.591&&b.max.x<=1.591&&b.min.z>=-3.701&&b.max.z<=3.701,key+' fixture outside clear room: '+o.name);}
  ray.origin.set(0,1.65,sign*3.5);ray.direction.set(0,0,-sign);const cast=new T.Raycaster(ray.origin,ray.direction,0,7);const opaque=g.children.filter(o=>o.isMesh&&!o.material.transparent);assert(!cast.intersectObjects(opaque,false).length,key+' opaque fitting blocks door-to-view sight lane');
  reports.push({key,beds:g.userData.rest.filter(s=>s.kind==='lie').length,chairs:g.userData.rest.filter(s=>s.kind==='sit').length,centreAisle:true,wetPodApproach:true,sightLane:true});
 }
 const ghost=new Colliders();ghost.addInstances('degenerate-regression',[0,.5,0,0,.5,0,0,.5,0,10,0,10,11,0,10,10,0,11],[new T.Matrix4()]);assert(!ghost.overlaps(new T.Line3(new T.Vector3(0,.75,0),new T.Vector3(0,1.65,0)),.35),'Zero-area point triangle must not be a collider');assert(ghost.raycast(new T.Ray(new T.Vector3(10.2,1,10.2),new T.Vector3(0,-1,0)),2),'Valid triangles remain solid');
 const spots=cabinRestSpots();assert.equal(spots.filter(s=>s.kind==='lie').length,10000);assert.equal(spots.filter(s=>s.kind==='sit').length,5084);const ids=new Set(all.map(c=>c.id)),map=layout.cabinIdMap;assert.equal(Object.keys(map).length,5000);assert(Object.values(map).every(id=>ids.has(id)));for(const c of all)for(const id of c.legacyIds)assert.equal(map[id],c.id);
 const ownership=JSON.parse(await fs.readFile('src/plan/ownership.json','utf8')),specific=Object.entries(ownership.placedFeatures).filter(([,v])=>/N\d\d-\d{3}/.test(JSON.stringify(v)));assert.equal(specific.length,0,'A new cabin-owned feature needs an explicit transplant');const report={status:'PASS',templates:reports,cabins:all.length,berths:10000,chairs:5084,legacyMappings:5000,uniqueMappedCabins:new Set(Object.values(map)).size,features:{specificCabinFeatures:specific,stock:['beds and covers','desk and chair','wardrobe','ensuite','reading lights','oak trim','polish seams and bezels'],lost:[]}};await fs.writeFile('output/phase3/cabin-checks.json',JSON.stringify(report,null,2));return report;}

if(process.argv[1]?.endsWith('.v2-cabin-check.mjs'))console.log(JSON.stringify(await checkCabins(),null,2));
