import {MeshBVH} from 'three-mesh-bvh';
import * as T from 'three';
// Guards protect real interior drops. Use the complete finished-skin authority, including glazing closing pressure-mesh apertures, over the whole pane/cap envelope.
export function clipHullRails(rows,skin,{margin=.30,step=.10}={}){
 const out=[];
 for(const row of rows){const [deck,axis,a,b,at,y,z1]=row,point=t=>axis===2?[a+(b-a)*t,at+(z1-at)*t]:axis?[at,a+(b-a)*t]:[a+(b-a)*t,at],length=axis===2?Math.hypot(b-a,z1-at):Math.abs(b-a),n=Math.max(1,Math.ceil(length/step)),extent=axis===2?.05:.04,safe=t=>{const[x,z]=point(t);for(const dx of [-extent,extent])for(const dz of [-extent,extent])for(const dy of [0,.28,.55,.825,1.125]){const q=[x+dx,y+dy,z+dz];if(skin.distance){if(skin.distance(q)>-margin)return false;}else{const side=Math.sign(q[2])||1,edge=skin.skin(q[0],q[1],side);if(edge===null||side*(edge-q[2])<margin)return false;}}return true;};const mid=point(.5),radius=Math.hypot(length/2+extent*Math.SQRT2,.5625);if(length>=.1&&skin.distance&&skin.distance([mid[0],y+.5625,mid[1]])+radius<=-margin){out.push([...row]);continue;}let start=null;
  for(let k=0;k<=n;k++){const lo=k/n,hi=Math.min(n,k+1)/n,keep=k<n&&safe(lo)&&safe((lo+hi)/2)&&safe(hi);if(keep&&start===null)start=lo;if(!keep&&start!==null){if((lo-start)*length>=.1){if(axis===2){const p=point(start),q=point(lo);out.push([deck,2,p[0],q[0],p[1],y,q[1]]);}else out.push([deck,axis,a+(b-a)*start,a+(b-a)*lo,at,y]);}start=null;}}
 }
 // Join abutting level runs; oblique spans already follow continuous exact void edges.
 const exact=out.filter(r=>r[1]===2),groups=new Map();for(const row of out.filter(r=>r[1]!==2)){const key=[row[0],row[1],row[4].toFixed(5),row[5].toFixed(5)].join('|');(groups.get(key)||groups.set(key,[]).get(key)).push(row);}const merged=[];for(const spans of groups.values()){spans.sort((a,b)=>a[2]-b[2]);for(const row of spans){const prev=merged.at(-1);if(prev&&prev[0]===row[0]&&prev[1]===row[1]&&Math.abs(prev[4]-row[4])<1e-5&&Math.abs(prev[5]-row[5])<1e-5&&row[2]-prev[3]<.001)prev[3]=Math.max(prev[3],row[3]);else merged.push([...row]);}}return [...merged,...exact];
}

// A raster slab edge is not a real guard site when that slab was removed from
// a tall room. Keep only runs supported by the actual walk ground, including
// a small tread-height allowance. Explicit stair and exact void guards are planned separately.
export function supportedGuardRuns(rows,col,{step=.20,maxFloorGap=.22,stats={}}={}){
 const cast=col.raycastGround?.bind(col)||col.raycast.bind(col),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),out=[];stats.inputRows=rows.length;stats.inputMetres=0;stats.keptMetres=0;stats.removed=[];
 for(const row of rows){const[d,axis,a,b,at,y,z1]=row,point=t=>axis===2?[a+(b-a)*t,at+(z1-at)*t]:axis?[at,a+(b-a)*t]:[a+(b-a)*t,at],p0=point(0),p1=point(1),length=Math.hypot(p1[0]-p0[0],p1[1]-p0[1]);if(length<.001)continue;const nx=-(p1[1]-p0[1])/length,nz=(p1[0]-p0[0])/length,n=Math.max(1,Math.ceil(length/step));stats.inputMetres+=length;
 const supported=t=>{const[x,z]=point(t);for(const offset of [0,-.2,.2,-.4,.4]){ray.origin.set(x+nx*offset,y+.25,z+nz*offset);const hit=cast(ray,.85);if(hit&&Math.abs(hit.point.y-y)<=maxFloorGap+1e-5)return true;}return false;};let start=null,kept=0;
 for(let k=0;k<=n;k++){const lo=k/n,hi=Math.min(n,k+1)/n,keep=k<n&&supported(lo)&&supported((lo+hi)/2)&&supported(hi);if(keep&&start===null)start=lo;if(!keep&&start!==null){const span=(lo-start)*length;if(span>=.099){const p=point(start),q=point(lo);out.push(axis===2?[d,2,p[0],q[0],p[1],y,q[1]]:[d,axis,a+(b-a)*start,a+(b-a)*lo,at,y]);kept+=span;}start=null;}}stats.keptMetres+=kept;if(length-kept>.01)stats.removed.push({row,unsupportedMetres:length-kept});
 }stats.removedMetres=stats.inputMetres-stats.keptMetres;return out;
}

// A guard must stand on an actual floor or tread triangle. A nearby cabinet,
// facade header or proxy's bounding box cannot make an intermediate slab real.
export function actualGuardGround(ship){
 ship.root.updateMatrixWorld(true);const positions=[],v=new T.Vector3(),instance=new T.Matrix4(),matrix=new T.Matrix4();
 const floor=o=>o.userData.batchedEnvelope?o.userData.role==='floor':/floor|^Deck_slab$|tread|boarding_(step|bridge)|stair_(up|return)|ramp|landing|platform|gallery|walkway|stage|dais/i.test(o.name)&&!/wall|ceiling|roof|lining|glass|pressure|window|guard|rail|hull|canopy/i.test(o.name);
 ship.root.traverse(o=>{if(!o.isMesh||!floor(o)||o.userData.collisionOnly)return;for(let p=o;p;p=p.parent)if(!p.visible&&!p.userData.baked)return;const g=o.geometry,pos=g.attributes.position,ix=g.index;if(!pos)return;for(let j=0;j<(o.isInstancedMesh?o.count:1);j++){matrix.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(j,instance);matrix.multiply(instance);}for(let i=0;i<(ix?.count??pos.count);i++){v.fromBufferAttribute(pos,ix?ix.getX(i):i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);}}});
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));const bvh=new MeshBVH(geometry,{indirect:true,targetLeafSize:8});return {triangles:positions.length/9,raycastGround(ray,far){const hit=bvh.raycastFirst(ray,T.DoubleSide,0,far);if(!hit)return null;const normal=hit.face.normal.clone();if(normal.dot(ray.direction)>0)normal.negate();return {...hit,normal,point:ray.at(hit.distance,new T.Vector3())};},dispose(){geometry.dispose();}};
}
