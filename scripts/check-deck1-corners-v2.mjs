import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {applyPublicFinishKit,createFinishKit} from '../src/v2/finish-kit.js';
import {wallJoints} from '../src/v2/wall-joints.js';
import {roomWallBoundary} from '../src/v2/rounded-room-walls.js';
import {buildShuttleWalls} from '../src/v2/shuttle-shell.js';
import {entrySegments,entryHeader} from '../src/v2/room-entries.js';
import {createShuttleDoors,shuttleDoorways,HALF,CASING,HEIGHT,DEEP} from '../src/walk/shuttle-doors.js';
import {Colliders,BODY} from '../src/walk/collision.js';
import {coplanarOverlaps} from '../src/plan/coplanar-v2.js';
import {clipPolygon,triangulate} from '../src/plan/hull-skin-v2.js';

// Inspect actual shell and finish triangles around every Deck 1 and Deck 2 room vertex.
function cornerFaces(root,q){
 const faces=[],v=new T.Vector3();root.updateMatrixWorld(true);
 root.traverse(o=>{if(!o.isMesh||!/^V2_(glass_wall|shuttle_door_casings|public_finish_(panel|trim|light))$/.test(o.name))return;const p=o.geometry.attributes.position,ix=o.geometry.index;
  for(let i=0;i<(ix?.count??p.count);i+=3){let poly=[0,1,2].map(k=>v.fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld).toArray());
   for(const [axis,value,side]of[[0,q[0]-.24,1],[0,q[0]+.24,-1],[2,q[1]-.24,1],[2,q[1]+.24,-1]])poly=clipPolygon(poly,axis,value,side);
   for(const triangle of triangulate(poly))faces.push({name:o.name,triangle});
  }
 });return faces;
}
const ring=p=>p.filter((q,i)=>Math.hypot(q[0]-p[(i+p.length-1)%p.length][0],q[1]-p[(i+p.length-1)%p.length][1])>1e-6);
let rooms=0,corners=0,rays=0,sectionCorners=0,doorPaths=0,shuttles=0;const decks={1:0,2:0};
// Check both incident edges and both visible sides, including stepped envelopes.
function checkEnds(root,poly,i,pieces,y,levels,id,ends=[0,1]){
 const a=poly[i],b=poly[(i+1)%poly.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),t=[(b[0]-a[0])/len,(b[1]-a[1])/len],n=[t[1],-t[0]];
 for(const [aa,bb]of pieces)for(const [end,slope]of wallJoints(poly,i,aa,bb).entries()){
  if(!ends.includes(end)||slope===null||Math.abs(slope)<.01)continue;const q=end?bb:aa;
  for(const [rise,d,kind]of levels){const side=Math.sign(d),along=slope*d*((end?1:-1)*slope*d>0?.5:1.5),start=new T.Vector3(q[0]+t[0]*along+n[0]*(d+side*.2),y+rise,q[1]+t[1]*along+n[1]*(d+side*.2)),ray=new T.Raycaster(start,new T.Vector3(-side*n[0],0,-side*n[1]),0,.201);
   assert(ray.intersectObject(root,true).some(h=>h.object.name===kind&&Math.abs(h.distance-.2)<.0001),id+' open '+kind+' side '+side+' at '+q+' height '+rise);rays++;
  }
 }
}
function checkDoors(root,doors,id){
 const colliders=new Colliders();colliders.addStatic(root,o=>o.isMesh&&o.name==='V2_glass_wall');colliders.commit();
 for(const d of doors){if(!d.outward)continue;const n=d.outward,t=[-n[1],n[0]],half=d.width/2-BODY.radius-.01;
  for(const across of [-half,0,half])for(let step=0;step<=12;step++){const along=-.6+step*.1,p=new T.Vector3(d.center[0]+t[0]*across+n[0]*along,d.center[1],d.center[2]+t[1]*across+n[1]*along),segment=new T.Line3(p.clone().add(new T.Vector3(0,BODY.step+BODY.radius,0)),p.clone().add(new T.Vector3(0,BODY.height-BODY.radius,0)));
   assert(!colliders.overlaps(segment,BODY.radius),id+' blocked doorway '+d.id);doorPaths++;
  }
 }
}
function checkDeck2(root,r){
 const doors=[r.door,r.fittingDoor,...(r.galleryDoors||[]),...(r.bayAccessDoors||[])].filter(Boolean),poly=roomWallBoundary(r,r.polygon).polygon,sign=Math.sign(T.ShapeUtils.area(poly.map(q=>new T.Vector2(...q))));
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],front=r.outer||r.publicFront&&[a,b].every(q=>Math.abs((q[0]-r.door.center[0])*r.door.outward[0]+(q[1]-r.door.center[2])*r.door.outward[1])<.02);let pieces=[[a,b]];for(const d of doors)pieces=pieces.flatMap(([a,b])=>entrySegments(a,b,d.center,d.width+.16));
  const levels=[sign].flatMap(side=>[[.1,.0845*side,'trim'],[3.22,.106*side,'light'],[3.28,.14*side,'trim'],...(!front?[[1.4,.052*side,'panel']]:[])]);
  if(r.kind==='new')levels.push(...levels.map(([h,d,k])=>[h,-d,k]));
  checkEnds(root,poly,i,pieces,r.y,levels.map(([h,d,k])=>[h,d,'V2_public_finish_'+k]),r.id);
 }
 for(const s of r.envelope||[{rise:0,height:r.height,polygon:r.polygon}]){const poly=roomWallBoundary(r,s.polygon).polygon,active=doors.filter(d=>d.center[1]<r.y+s.rise+s.height&&d.center[1]+2.5>r.y+s.rise);
  for(let i=0;i<poly.length;i++){let pieces=[[poly[i],poly[(i+1)%poly.length]]];for(const d of active)pieces=pieces.flatMap(([a,b])=>entrySegments(a,b,d.center,d.width));
   const levels=[[s.height/2,.05,'V2_glass_wall'],[s.height/2,-.05,'V2_glass_wall']];checkEnds(root,poly,i,pieces,r.y+s.rise,levels,r.id);
   for(const d of active){const upper=Math.max(r.y+s.rise,d.center[1]+2.5),header=entryHeader(poly[i],poly[(i+1)%poly.length],d.center,d.width);if(header&&upper<r.y+s.rise+s.height)checkEnds(root,poly,i,[header],upper,[[.01,.05,'V2_glass_wall'],[.01,-.05,'V2_glass_wall']],r.id+' header');}
   if(Math.abs(wallJoints(poly,i)[0])<.01)continue;assert.deepEqual(coplanarOverlaps(cornerFaces(root,poly[i]),{distance:.0001}),[],r.id+' overlapping envelope corner '+poly[i]);sectionCorners++;
  }
 }
 checkDoors(root,doors,r.id);
}
for(const r of layout.rooms.filter(r=>[1,2].includes(r.deck)&&!r.aggregate&&!r.openPlan)){
 const root=new T.Group(),ship={root,inside:root,cutaway:new Set()};buildRoomShell(ship,r,root);
 applyPublicFinishKit(ship,{...layout,rooms:[r],circulation:{...layout.circulation,corridors:[]}},{decks:[r.deck]});root.updateMatrixWorld(true);
 const poly=r.polygon.filter((q,i,p)=>Math.hypot(q[0]-p[(i+p.length-1)%p.length][0],q[1]-p[(i+p.length-1)%p.length][1])>1e-6);
 for(let i=0;i<poly.length;i++){
  const q=poly[i],prev=poly[(i+poly.length-1)%poly.length],next=poly[(i+1)%poly.length],u=new T.Vector2(q[0]-prev[0],q[1]-prev[1]).normalize(),t=new T.Vector2(next[0]-q[0],next[1]-q[1]).normalize();
  if(Math.abs(u.cross(t))<.01)continue;
  // Resolve coincident faces to 0.1 mm; the existing skirting back is 0.5 mm inside the shell.
  assert.deepEqual(coplanarOverlaps(cornerFaces(root,q),{distance:.0001}),[],r.id+' has overlapping corner faces at '+q);corners++;
  // A perpendicular ray in the old open slot must now hit each finish layer.
  const slope=wallJoints(poly,i)[0];if(slope>=-.1||r.deck===2&&roomWallBoundary(r,r.polygon).corners.some(c=>Math.hypot(c.at[0]-q[0],c.at[1]-q[1])<1e-6))continue;
  for(const [rise,d,kind]of[[.1,.0845,'trim'],[1.4,.052,'panel'],[3.22,.106,'light'],[3.28,.14,'trim'],[2,.05,'shell']]){
   if(kind==='shell'&&r.envelope)continue;
   if(kind==='panel'&&(r.outer||r.publicFront&&Math.abs((q[0]-r.door.center[0])*r.door.outward[0]+(q[1]-r.door.center[2])*r.door.outward[1])<.02))continue;
   const along=slope*d*.5,n=[t.y,-t.x],start=new T.Vector3(q[0]+t.x*along+n[0]*(d+.2),r.y+rise,q[1]+t.y*along+n[1]*(d+.2)),ray=new T.Raycaster(start,new T.Vector3(-n[0],0,-n[1]),0,.4),name=kind==='shell'?'V2_glass_wall':'V2_public_finish_'+kind;
   assert(ray.intersectObject(root,true).some(h=>h.object.name===name),r.id+' open '+kind+' corner at '+q);rays++;
  }
 }if(r.deck===2)checkDeck2(root,r);rooms++;decks[r.deck]++;
}
// Concave and reversed rings must also meet without overlapping trim or panels.
const concave=[[0,0],[6,0],[6,3],[3,3],[3,6],[0,6]];
for(const poly of [concave,concave.slice().reverse()]){
 const root=new T.Group(),kit=createFinishKit(root),sign=Math.sign(T.ShapeUtils.area(poly.map(q=>new T.Vector2(...q))));
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(const side of [1,-1])kit.wall({deck:1,owner:'fixture',a,b,y:0,normal:[side*sign*(b[1]-a[1])/len,-side*sign*(b[0]-a[0])/len],joints:wallJoints(poly,i)});}
 kit.finish();for(const q of poly)assert.deepEqual(coplanarOverlaps(cornerFaces(root,q),{distance:.0001}),[],'Concave/reversed corner overlap');
}
// Full shuttle casings keep their own doorway width and mate to the trimmed glass.
for(const s of layout.shuttles.filter(s=>s.deck===2)){
 const root=new T.Group();buildShuttleWalls(root,s);const doorways=shuttleDoorways([s]);createShuttleDoors(o=>root.add(o),doorways);root.updateMatrixWorld(true);
 for(let i=1;i<4;i++){const a=s.polygon[i],b=s.polygon[(i+1)%4],centre=[(a[0]+b[0])/2,s.y,(a[1]+b[1])/2],pieces=i===3&&s.hullEnvelope?entrySegments(a,b,centre,2*(HALF+CASING)):[[a,b]];
  // The pressure facade closes edge 0; only the two glass-to-glass corners mitre.
  for(const q of (i===2?[a,b]:[]))assert.deepEqual(coplanarOverlaps(cornerFaces(root,q),{distance:.0001}),[],s.id+' overlapping glass corner');
  checkEnds(root,s.polygon,i,pieces,s.y,[[1.4,.05,'V2_glass_wall'],[1.4,-.05,'V2_glass_wall']],s.id,i===1?[1]:i===3?[0]:[0,1]);
 }
 for(const d of doorways){const n=[Math.sin(d.yaw),Math.cos(d.yaw)],t=[Math.cos(d.yaw),-Math.sin(d.yaw)];
  for(const side of [-1,1]){const q=[d.x+t[0]*side*(HALF+CASING/2),d.z+t[1]*side*(HALF+CASING/2)];assert.deepEqual(coplanarOverlaps(cornerFaces(root,q),{distance:.0001}),[],s.id+' overlapping casing join');}
  for(const edge of [-1,1])for(const delta of [-.005,.005])for(const side of [-1,1])for(const rise of [.1,1.4,HEIGHT+.06]){
   const along=edge*(HALF+CASING+delta),depth=delta<0?DEEP/2:.05,name=delta<0?'V2_shuttle_door_casings':'V2_glass_wall',start=new T.Vector3(d.x+t[0]*along+n[0]*side*(depth+.2),d.y+rise,d.z+t[1]*along+n[1]*side*(depth+.2)),ray=new T.Raycaster(start,new T.Vector3(-side*n[0],0,-side*n[1]),0,.201);
   assert(ray.intersectObject(root,true).some(h=>h.object.name===name&&Math.abs(h.distance-.2)<.0001),s.id+' gap beside casing');rays++;
  }
  checkDoors(root,[{id:d.id,center:[d.x,d.y,d.z],width:HALF*2,outward:n}],s.id);
 }shuttles++;
}
console.log(JSON.stringify({status:'PASS',rooms,decks,corners,sectionCorners,rays,doorPaths,shuttles,concaveAndReversed:true}));
