import {frame} from '../src/plan/rooms.js';
import {requireCabinFootprints} from '../src/plan/cabin-footprints-v2.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import layout from 'v2-layout';
import {BODY,Colliders} from '../src/walk/collision.js';
import {placements,cabinKey,template,cabinRestSpots} from '../src/v2/cabins.js';
export async function checkCabins(){const footprints=requireCabinFootprints(JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8')));const all=placements(),keys=[...new Set(all.map(cabinKey))],reports=[],entryColliders=new Map();
 for(const key of keys){const g=template(key),sign=key.includes('--')?-1:1,col=new Colliders();col.addStatic(g);col.commit();entryColliders.set(key,col);const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3(),stand=(u,v)=>{const z=-sign*v;ray.origin.set(u,.4,z);const h=col.raycast(ray,.8);if(!h)return false;seg.start.set(u,h.point.y+BODY.step+BODY.radius,z);seg.end.set(u,h.point.y+BODY.height-BODY.radius,z);return !col.overlaps(seg,BODY.radius);};
  for(let v=-3.5;v<=3.2;v+=.2)assert(stand(0,v),key+' centre aisle blocked at '+v);
  for(const v of [-1.1,-1.5,-1.9,-2.3,-2.7,-2.83])assert(stand(.845,v),key+' wet-pod approach blocked at '+v);
  for(const s of g.userData.rest){ray.origin.set(s.point[0],s.point[1]+.3,s.point[2]);const h=col.raycast(ray,.5);assert(h&&Math.abs(h.point.y-s.point[1])<.025,key+' rest spot lacks actual cushion/cover support');const v=-sign*s.point[2];assert(stand(0,v),key+' rest approach blocked');assert(Math.abs(s.point[0])<1.45,key+' rest spot beyond native E reach');}
  for(const o of g.children.filter(o=>o.isMesh&&!o.userData.shell)){const b=new T.Box3().setFromObject(o,true);assert(b.min.x>=-1.591&&b.max.x<=1.591&&b.min.z>=-3.701&&b.max.z<=3.701,key+' fixture outside clear room: '+o.name);}
  ray.origin.set(0,1.65,sign*3.5);ray.direction.set(0,0,-sign);const cast=new T.Raycaster(ray.origin,ray.direction,0,7);const opaque=g.children.filter(o=>o.isMesh&&!o.material.transparent);assert(!cast.intersectObjects(opaque,false).length,key+' opaque fitting blocks door-to-view sight lane');
  for(const x of [-1.5,0,1.5])for(const v of [-2.83,-1.96]){const eye=new T.Vector3(x,1.65,sign*4.5),target=new T.Vector3(1.4,.9,-sign*v),r=new T.Raycaster(eye,target.clone().sub(eye).normalize(),0,eye.distanceTo(target)-.1);assert(r.intersectObjects(g.children.filter(o=>/Cabin_v2_ensuite_(side_wall|entry_wall|door)$/.test(o.name)),false).length,key+' ensuite visible from corridor');}
  reports.push({key,ensuiteOpaque:true,beds:g.userData.rest.filter(s=>s.kind==='lie').length,chairs:g.userData.rest.filter(s=>s.kind==='sit').length,centreAisle:true,wetPodApproach:true,sightLane:true});
 }
 const entryGrid=checkEntryGrid(all,entryColliders);
 const ghost=new Colliders();ghost.addInstances('degenerate-regression',[0,.5,0,0,.5,0,0,.5,0,10,0,10,11,0,10,10,0,11],[new T.Matrix4()]);assert(!ghost.overlaps(new T.Line3(new T.Vector3(0,.75,0),new T.Vector3(0,1.65,0)),.35),'Zero-area point triangle must not be a collider');assert(ghost.raycast(new T.Ray(new T.Vector3(10.2,1,10.2),new T.Vector3(0,-1,0)),2),'Valid triangles remain solid');
 const spots=cabinRestSpots();assert.equal(spots.filter(s=>s.kind==='lie').length,10000);assert.equal(spots.filter(s=>s.kind==='sit').length,5084);const ids=new Set(all.map(c=>c.id)),map=layout.cabinIdMap;assert.equal(Object.keys(map).length,5000);assert(Object.values(map).every(id=>ids.has(id)));for(const c of all)for(const id of c.legacyIds)assert.equal(map[id],c.id);
 const ownership=JSON.parse(await fs.readFile('src/plan/ownership.json','utf8')),specific=Object.entries(ownership.placedFeatures).filter(([,v])=>/N\d\d-\d{3}/.test(JSON.stringify(v)));assert.equal(specific.length,0,'A new cabin-owned feature needs an explicit transplant');const report={status:'PASS',footprints,entryGrid,templates:reports,cabins:all.length,berths:10000,chairs:5084,legacyMappings:5000,uniqueMappedCabins:new Set(Object.values(map)).size,features:{specificCabinFeatures:specific,stock:['beds and covers','desk and chair','wardrobe','ensuite','reading lights','oak trim','polish seams and bezels'],lost:[]}};await fs.writeFile('output/phase3/cabin-checks.json',JSON.stringify(report,null,2));return report;}

if(process.argv[1]?.endsWith('.v2-cabin-check.mjs'))console.log(JSON.stringify(await checkCabins(),null,2));

function checkEntryGrid(all,colliders){
 const origin=frame('d02-arrival-1').origin,G=.35,seg=new T.Line3(),failed=[];
 for(const c of all){const key=cabinKey(c),col=colliders.get(key),sign=key.includes('--')?-1:1,cs=Math.cos(c.yaw),sn=Math.sin(c.yaw),local=(x,z)=>{const dx=x-c.x,dz=z-c.z;return [cs*dx-sn*dz,-sign*(sn*dx+cs*dz)];},world=(u,v)=>[c.x+cs*u-sn*sign*v,c.z-sn*u-cs*sign*v],corners=[[-1.25,-4.55],[1.25,-4.55],[1.25,-.65],[-1.25,-.65]].map(([u,v])=>world(u,v)),ix0=Math.floor((Math.min(...corners.map(p=>p[0]))-origin[0]+20)/G),ix1=Math.ceil((Math.max(...corners.map(p=>p[0]))-origin[0]+20)/G),iz0=Math.floor((Math.min(...corners.map(p=>p[1]))-origin[2])/G),iz1=Math.ceil((Math.max(...corners.map(p=>p[1]))-origin[2])/G),free=new Map(),queue=[],seen=new Set();
  for(let ix=ix0;ix<=ix1;ix++)for(let iz=iz0;iz<=iz1;iz++){const x=origin[0]-20+ix*G,z=origin[2]+iz*G,[u,v]=local(x,z);if(Math.abs(u)>1.25||v< -4.55||v> -.65)continue;const zz=-sign*v;seg.start.set(u,BODY.step+BODY.radius,zz);seg.end.set(u,BODY.height-BODY.radius,zz);if(col.overlaps(seg,BODY.radius))continue;const k=ix+','+iz;free.set(k,{ix,iz,u,v});if(v< -4.15&&Math.abs(u)<1){queue.push(k);seen.add(k);}}
  let pass=false;for(let head=0;head<queue.length;head++){const p=free.get(queue[head]);if(p.v> -1.2&&Math.abs(p.u)<.3){pass=true;break;}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const k=(p.ix+dx)+','+(p.iz+dz);if(free.has(k)&&!seen.has(k)){seen.add(k);queue.push(k);}}}if(!pass)failed.push(c.id);
 }
 assert.equal(failed.length,0,'Cabin entry blocked on the full walk grid: '+failed.slice(0,20).join(', '));return {cabins:all.length,grid:G,blocked:failed};
}
