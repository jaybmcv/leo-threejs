import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {buildRoomShell} from '../src/v2/room-shell.js';
import {applyPublicFinishKit,createFinishKit} from '../src/v2/finish-kit.js';
import {wallJoints} from '../src/v2/wall-joints.js';
import {coplanarOverlaps} from '../src/plan/coplanar-v2.js';
import {clipPolygon,triangulate} from '../src/plan/hull-skin-v2.js';

// Inspect actual shell and finish triangles around every Deck 1 room vertex.
function cornerFaces(root,q){
 const faces=[],v=new T.Vector3();root.updateMatrixWorld(true);
 root.traverse(o=>{if(!o.isMesh||!/^V2_(glass_wall|public_finish_(panel|trim|light))$/.test(o.name))return;const p=o.geometry.attributes.position,ix=o.geometry.index;
  for(let i=0;i<(ix?.count??p.count);i+=3){let poly=[0,1,2].map(k=>v.fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld).toArray());
   for(const [axis,value,side]of[[0,q[0]-.24,1],[0,q[0]+.24,-1],[2,q[1]-.24,1],[2,q[1]+.24,-1]])poly=clipPolygon(poly,axis,value,side);
   for(const triangle of triangulate(poly))faces.push({name:o.name,triangle});
  }
 });return faces;
}
let rooms=0,corners=0,rays=0;
for(const r of layout.rooms.filter(r=>r.deck===1&&!r.aggregate&&!r.openPlan)){
 const root=new T.Group(),ship={root,inside:root,cutaway:new Set()};buildRoomShell(ship,r,root);
 applyPublicFinishKit(ship,{...layout,rooms:[r],circulation:{...layout.circulation,corridors:[]}},{decks:[1]});root.updateMatrixWorld(true);
 const poly=r.polygon.filter((q,i,p)=>Math.hypot(q[0]-p[(i+p.length-1)%p.length][0],q[1]-p[(i+p.length-1)%p.length][1])>1e-6);
 for(let i=0;i<poly.length;i++){
  const q=poly[i],prev=poly[(i+poly.length-1)%poly.length],next=poly[(i+1)%poly.length],u=new T.Vector2(q[0]-prev[0],q[1]-prev[1]).normalize(),t=new T.Vector2(next[0]-q[0],next[1]-q[1]).normalize();
  if(Math.abs(u.cross(t))<.01)continue;
  // Resolve coincident faces to 0.1 mm; the existing skirting back is 0.5 mm inside the shell.
  assert.deepEqual(coplanarOverlaps(cornerFaces(root,q),{distance:.0001}),[],r.id+' has overlapping corner faces at '+q);corners++;
  // A perpendicular ray in the old open slot must now hit each finish layer.
  const slope=wallJoints(poly,i)[0];if(slope>=-.1)continue;
  for(const [rise,d,kind]of[[.1,.0845,'trim'],[1.4,.052,'panel'],[3.22,.106,'light'],[3.28,.14,'trim'],[2,.05,'shell']]){
   if(kind==='shell'&&r.envelope)continue;
   if(kind==='panel'&&(r.outer||r.publicFront&&Math.abs((q[0]-r.door.center[0])*r.door.outward[0]+(q[1]-r.door.center[2])*r.door.outward[1])<.02))continue;
   const along=slope*d*.5,n=[t.y,-t.x],start=new T.Vector3(q[0]+t.x*along+n[0]*(d+.2),r.y+rise,q[1]+t.y*along+n[1]*(d+.2)),ray=new T.Raycaster(start,new T.Vector3(-n[0],0,-n[1]),0,.4),name=kind==='shell'?'V2_glass_wall':'V2_public_finish_'+kind;
   assert(ray.intersectObject(root,true).some(h=>h.object.name===name),r.id+' open '+kind+' corner at '+q);rays++;
  }
 }rooms++;
}
// Concave and reversed rings must also meet without overlapping trim or panels.
const concave=[[0,0],[6,0],[6,3],[3,3],[3,6],[0,6]];
for(const poly of [concave,concave.slice().reverse()]){
 const root=new T.Group(),kit=createFinishKit(root),sign=Math.sign(T.ShapeUtils.area(poly.map(q=>new T.Vector2(...q))));
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(const side of [1,-1])kit.wall({deck:1,owner:'fixture',a,b,y:0,normal:[side*sign*(b[1]-a[1])/len,-side*sign*(b[0]-a[0])/len],joints:wallJoints(poly,i)});}
 kit.finish();for(const q of poly)assert.deepEqual(coplanarOverlaps(cornerFaces(root,q),{distance:.0001}),[],'Concave/reversed corner overlap');
}
console.log(JSON.stringify({status:'PASS',rooms,corners,rays,concaveAndReversed:true}));
