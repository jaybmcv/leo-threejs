import * as T from 'three';
import {geometryKept} from './shader-hooks.js';

// These are the original index intervals of the merged walls and floors. The source arrays can
// leave memory after upload. The renderer still supplies the actual group and drawRange each draw.
const deckRuns=new WeakMap();
function extents({min,max}){
 return {cx:(min.x+max.x)*.5,cy:(min.y+max.y)*.5,cz:(min.z+max.z)*.5,
  hx:(max.x-min.x)*.5,hy:(max.y-min.y)*.5,hz:(max.z-min.z)*.5};
}
export function rememberDeckRuns(mesh,runs){
 const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index,point=new T.Vector3();
 const coordinates=position.itemSize===3&&!position.normalized&&position.array instanceof Float32Array?position.array:null;
 for(const run of runs){
  if(!run.box){
   run.box=new T.Box3();
   const {min,max}=run.box;
   for(let i=run.start,end=i+run.count;i<end;i++){
    if(!coordinates){run.box.expandByPoint(point.fromBufferAttribute(position,index.getX(i)));continue;}
    const v=index.array[i]*3,x=coordinates[v],y=coordinates[v+1],z=coordinates[v+2];
    if(x<min.x)min.x=x;if(x>max.x)max.x=x;if(y<min.y)min.y=y;if(y>max.y)max.y=y;if(z<min.z)min.z=z;if(z>max.z)max.z=z;
   }
  }
  run.drawBox=extents(run.box);
 }
 deckRuns.set(mesh,{runs,geometry,position,index,pv:position.version,iv:index.version,groups:new WeakMap(),whole:{}});
}

// Project the transformed box directly onto each frustum plane. Its extent is the sum of
// the three projected half-axes, also for nonuniform, mirrored and sheared transforms.
function inView(box,matrix,planes){
 const {cx,cy,cz,hx,hy,hz}=box,e=matrix.elements;
 if(e[3]!==0||e[7]!==0||e[11]!==0||e[15]!==1)return true;
 if(e[0]===1&&e[5]===1&&e[10]===1&&e[1]===0&&e[2]===0&&e[4]===0&&e[6]===0&&e[8]===0&&e[9]===0){
  const x=cx+e[12],y=cy+e[13],z=cz+e[14];
  for(const {normal:n,constant} of planes){
   if(n.x*x+n.y*y+n.z*z+constant < -(Math.abs(n.x)*hx+Math.abs(n.y)*hy+Math.abs(n.z)*hz)-.002)return false;
  }
  return true;
 }
 const x=e[0]*cx+e[4]*cy+e[8]*cz+e[12],y=e[1]*cx+e[5]*cy+e[9]*cz+e[13],z=e[2]*cx+e[6]*cy+e[10]*cz+e[14];
 for(const {normal:n,constant} of planes){
  const radius=Math.abs(n.x*e[0]+n.y*e[1]+n.z*e[2])*hx+Math.abs(n.x*e[4]+n.y*e[5]+n.z*e[6])*hy+Math.abs(n.x*e[8]+n.y*e[9]+n.z*e[10])*hz;
  if(n.x*x+n.y*y+n.z*z+constant < -radius-.002)return false;
 }
 return true;
}

// The group is the one Three submits. Band changes can replace a group or edit its interval,
// and drawRange can trim it further. Remember only the runs touched by that exact intersection.
function outsideRuns(deck,group,start,end,matrix,planes,epoch,stable){
 let slice=group?deck.groups.get(group):deck.whole;
 if(!slice){slice={};deck.groups.set(group,slice);}
 if(slice.start!==start||slice.end!==end){
  let lo=0,hi=deck.runs.length;
  while(lo<hi){const n=(lo+hi)>>>1,r=deck.runs[n];if(r.start+r.count<=start)lo=n+1;else hi=n;}
  slice.first=lo;slice.last=-1;slice.start=start;slice.end=end;slice.epoch=-1;
 }
 if(stable&&slice.epoch===epoch&&slice.matrix.equals(matrix))return slice.outside;
 let outside=true;
 if(slice.last>=0&&inView(deck.runs[slice.last].drawBox,matrix,planes))outside=false;
 else for(let i=slice.first;i<deck.runs.length;i++){
  const run=deck.runs[i];if(run.start>=end)break;
  if(i!==slice.last&&inView(run.drawBox,matrix,planes)){slice.last=i;outside=false;break;}
 }
 if(stable){slice.epoch=epoch;(slice.matrix??=new T.Matrix4()).copy(matrix);slice.outside=outside;}
 return outside;
}

export function installWalkDrawBounds(renderer,scene){
 const original=renderer.renderBufferDirect,frustum=new T.Frustum(),projection=new T.Matrix4();
 const previousWorld=new T.Matrix4(),previousProjection=new T.Matrix4();
 let view=null,nested=false,epoch=0,stable=false,previousCamera=null,previousSystem,previousReversed;
 renderer.renderBufferDirect=function(camera,drawScene,g,m,o,group){
  if(view===camera&&drawScene===scene){
   const deck=deckRuns.get(o);
   if(deck&&renderer.getRenderTarget()===null&&g===deck.geometry&&g.index===deck.index&&g.index.version===deck.iv&&
      g.attributes.position===deck.position&&deck.position.version===deck.pv&&!o.isInstancedMesh&&!o.isSkinnedMesh&&
      !o.morphTargetInfluences?.length&&!g.morphAttributes.position&&!m.wireframe&&geometryKept(m)&&
      o.onBeforeRender===T.Object3D.prototype.onBeforeRender&&o.onAfterRender===T.Object3D.prototype.onAfterRender&&m.onBeforeRender===T.Material.prototype.onBeforeRender){
    const start=Math.max(group?.start??0,g.drawRange.start),end=Math.min((group?.start??0)+(group?.count??Infinity),g.drawRange.start+g.drawRange.count,g.index.count);
    if(Number.isInteger(start)&&start>=0&&start%3===0&&outsideRuns(deck,group,start,end,o.matrixWorld,frustum.planes,epoch,stable))return;
   }
  }
  return original.apply(this,arguments);
 };
 return {around(camera,draw){
  if(nested)return draw();
  if(view){const outer=view;view=null;nested=true;try{return draw();}finally{view=outer;nested=false;}}
  if(camera.matrixWorld.determinant()<=0||renderer.shadowMap.enabled||renderer.xr?.isPresenting||scene.overrideMaterial||renderer.getRenderTarget()||camera.projectionMatrix.elements[0]<=0||camera.projectionMatrix.elements[5]<=0)return draw();
  projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  stable=previousCamera===camera&&previousSystem===camera.coordinateSystem&&previousReversed===camera.reversedDepth&&previousWorld.equals(camera.matrixWorld)&&previousProjection.equals(projection);
  if(!stable){
   epoch++;previousCamera=camera;previousSystem=camera.coordinateSystem;previousReversed=camera.reversedDepth;
   previousWorld.copy(camera.matrixWorld);previousProjection.copy(projection);
   frustum.setFromProjectionMatrix(projection,camera.coordinateSystem,camera.reversedDepth);
  }
  view=camera;try{return draw();}finally{view=null;}
 }};
}
