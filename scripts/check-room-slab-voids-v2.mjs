import './v2-output.mjs';
import * as T from 'three';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const signedArea=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2;
const bounds=p=>[Math.min(...p.map(q=>q[0])),Math.max(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[1]))];
function overlapArea(subject,mask){let p=subject;const sign=Math.sign(signedArea(mask));for(let i=0;i<3&&p.length;i++){const a=mask[i],b=mask[(i+1)%3],distance=q=>sign*((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0])),out=[];for(let j=0;j<p.length;j++){const u=p[j],v=p[(j+1)%p.length],du=distance(u),dv=distance(v);if(du>=0)out.push(u);if((du>=0)!==(dv>=0)){const t=du/(du-dv);out.push(u.map((x,k)=>x+(v[k]-x)*t))}}p=out;}return p.length>=3?Math.abs(signedArea(p)):0;}
// The original lounge has no intermediate structural slab in its occupied
// projection. Its real approach ramp and stairs are named meshes and remain.
export async function checkRoomSlabVoids(root,layout,{artifact=null,buildIdentity=null,reportPath='output/phase3b/room-slab-voids.json'}={}){
 const r=layout.rooms.find(r=>r.id==='observation-lounge');assert(r,'Missing observation lounge');
 const poly=r.polygon.map(p=>p.map(Math.fround)),mask=T.ShapeUtils.triangulateShape(poly.map(p=>new T.Vector2(...p)),[]).map(t=>{const p=t.map(i=>poly[i]);return{p,b:bounds(p)}}),failures=[],v=new T.Vector3();let triangles=0,intersections=0,maximumArea=0,totalArea=0;
 root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh||!/^Deck_slab$|^V2_distribution_ceiling$/.test(o.name))return;const p=o.geometry.attributes.position,ix=o.geometry.index;if(!p)return;for(let i=0;i<(ix?.count??p.count);i+=3){const t=[0,1,2].map(k=>v.fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(o.matrixWorld).toArray());if(t.some(q=>q[1]<=r.y+.4||q[1]>=r.y+r.height-.2))continue;const flat=t.map(q=>[q[0],q[2]]),b=bounds(flat);if(Math.abs(signedArea(flat))<1e-10)continue;triangles++;let area=0;for(const m of mask){if(b[0]>=m.b[1]||b[1]<=m.b[0]||b[2]>=m.b[3]||b[3]<=m.b[2])continue;area+=overlapArea(flat,m.p)}maximumArea=Math.max(maximumArea,area);totalArea+=area;if(area>.0001){intersections++;if(failures.length<20)failures.push({mesh:o.name,triangle:t,area});}}});
 const report={status:intersections?'FAIL':'PASS',artifact,buildIdentity,room:r.id,triangles,intersections,maximumArea,totalArea,roundingArea:.0001,method:'Finite projected intersection of every actual intermediate structural slab/distribution-ceiling triangle with the full occupied lounge projection. Float32 joint residue at most 1 cm2 per face; no change to the 5 cm exterior contact rule. Explicit approach ramps, stairs and promenade meshes are retained.',failures};if(reportPath)await fs.writeFile(reportPath,JSON.stringify(report,null,2));assert.equal(report.status,'PASS','Old slab islands remain inside the full-height observation lounge; see room-slab-voids.json');return report;
}
