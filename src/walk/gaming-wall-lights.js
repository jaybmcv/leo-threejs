import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {worldPoint} from '../plan/hull-skin-v2.js';
import {patchDepth} from '../v2/patch-sampler.js';

// The finished hull lining and its two opaque end returns replace the old box walls.
export function buildGamingWallLights(layout,id,ceiling){
 const plan=layout.rooms.find(r=>r.id===id),facade=layout.hullPrototypes.prototypes.find(p=>p.ownerId===id);
 const {chart,inner,fixedV,openings,rect:[aft,bow,bottom,top]}=facade;
 const origin=new T.Vector3(...plan.frame.origin),yaw=-plan.frame.yaw,up=new T.Vector3(0,1,0);
 const local=(u,y,v)=>new T.Vector3(...worldPoint(chart,[u,y,v])).sub(origin).applyAxisAngle(up,yaw);
 const depth=(u,y)=>patchDepth(inner,u,y),surface=(u,y)=>local(u,y,depth(u,y));
 const sill=Math.min(...openings.map(o=>o[2])),head=Math.max(...openings.map(o=>o[3]));
 const stripY=Math.min(top,ceiling)-.06;

 // Follow the sloping wall across its whole width. End strips stop where the opaque returns meet glass.
 const runs=[{length:bow-aft,point:(t,y,d)=>{const u=T.MathUtils.lerp(aft,bow,t);return local(u,y,depth(u,y)-d);}}];
 for(const [u,dir] of [[aft,1],[bow,-1]])runs.push({length:depth(u,stripY)-fixedV,point:(t,y,d)=>{
  const v=T.MathUtils.lerp(fixedV,depth(u,y),dir===1?t:1-t);return local(u+dir*d,y,v);}});
 const wrap=(g,run,y,offset)=>{const p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setXYZ(i,...run.point(p.getX(i)+.5,y+p.getY(i),offset+p.getZ(i)).toArray());
  g.computeVertexNormals();return g;
 };
 const strips=[],wash=[],washTop=stripY-.01,washHeight=Math.min(.5,washTop-head-.02);
 for(const run of runs){const steps=Math.ceil(run.length/.25);
  strips.push(wrap(new T.BoxGeometry(1,.035,.04,steps),run,stripY,.02));
  const g=new T.PlaneGeometry(1,washHeight,steps,2),colors=[],p=g.attributes.position;
  for(let i=0;i<p.count;i++){const k=.09*(p.getY(i)/washHeight+.5);colors.push(.55*k,.75*k,k);}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));wash.push(wrap(g,run,washTop-washHeight/2,.006));
 }

 const frames=[],faces=[],halos=[],cells=[[0,0],[1,0],[.5,1],[1.5,1],[2,0],[-.5,1]];
 function cluster(center,tangent,normal,r,n){
  const bounds=cells.slice(0,n),mid=(Math.min(...bounds.map(c=>c[0]))+Math.max(...bounds.map(c=>c[0])))/2;
  const rise=normal.clone().cross(tangent),mount=new T.Matrix4().makeBasis(tangent,rise,normal).setPosition(center);
  for(const [c,row] of bounds){const x=(c-mid)*r*1.75,y=(row-.5)*r*1.52;
   frames.push(new T.CylinderGeometry(r*.97,r*.97,.03,6).rotateX(Math.PI/2).translate(x,y,.016).applyMatrix4(mount));
   faces.push(new T.CylinderGeometry(r*.84,r*.84,.02,6).rotateX(Math.PI/2).translate(x,y,.028).applyMatrix4(mount));
   halos.push(new T.PlaneGeometry(r*4,r*3.6).translate(x,y,.014).applyMatrix4(mount));
  }
 }
 // Keep the clusters along the window row, either in the header or below the sill, clear of the title.
 for(const [t,n,low] of [[4/48,5,false],[11.5/48,5,false],[17.8/48,3,false],[31.5/48,5,true]]){
  const u=T.MathUtils.lerp(aft,bow,t),y=low?(bottom+sill)/2:(head+stripY)/2;
  const tangent=surface(u+.01,y).sub(surface(u-.01,y)).normalize();
  const normal=tangent.clone().cross(surface(u,y+.01).sub(surface(u,y-.01))).normalize();
  cluster(surface(u,y),tangent,normal,low?.095:.125,n);
 }
 // The inboard glass continues around the end walls. Only the hull-side returns carry lights.
 for(const [u,dir,positions,r] of [[aft,1,[[.18,4],[.5,6],[.78,4]],.115],[bow,-1,[[.28,4],[.78,4]],.16]]){
  const y=stripY-.45,tangent=local(u,y,fixedV+dir).sub(local(u,y,fixedV)).normalize(),normal=tangent.clone().cross(up);
  for(const [t,n] of positions)cluster(local(u,y,T.MathUtils.lerp(fixedV,depth(u,y),t)),tangent,normal,r,n);
 }
 return {frame:mergeGeometries(frames),hex:mergeGeometries(faces),halo:mergeGeometries(halos),strip:mergeGeometries(strips),wash:mergeGeometries(wash)};
}
