import * as T from 'three';
import {yieldEvery} from './yield-to-page.js';

// The named room features and vehicles contain many small meshes that share a material, even when
// their parts move independently. Batch their main-camera submissions after world matrices update.
// Source transforms, visibility, interactions and collision remain owned by the feature.
const standardHook=T.Material.prototype.onBeforeCompile;
function compatibleMaterial(m){
 return m&&(m.isMeshStandardMaterial||m.isMeshBasicMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial)
  &&m.depthTest&&m.depthWrite&&m.colorWrite&&(m.depthFunc===T.LessDepth||m.depthFunc===T.LessEqualDepth)
  &&(m.blending===T.NormalBlending||m.blending===T.NoBlending)&&!m.transparent&&!m.transmission&&!m.wireframe&&!m.displacementMap&&!m.polygonOffset&&!m.stencilWrite
  &&(m.onBeforeCompile===standardHook||m.onBeforeCompile.keepsGeometry&&(m.onBeforeCompile.cornerShade||m.onBeforeCompile.filmLook))
  &&(!m.normalMap||m.normalMapType!==T.ObjectSpaceNormalMap)&&m.onBeforeRender===T.Material.prototype.onBeforeRender;
}
function plain(o){
 return o.isMesh&&!o.isInstancedMesh&&!o.isBatchedMesh&&!o.isSkinnedMesh&&!o.children.length&&o.frustumCulled
  &&o.onBeforeRender===T.Object3D.prototype.onBeforeRender&&o.onAfterRender===T.Object3D.prototype.onAfterRender;
}
const geometryKey=g=>Object.entries(g.attributes).map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name,a.gpuType].join(':')).sort().join('|');
function unchanged(record){
 const {g,index,attributes}=record;
 return g.index===index&&index?.version===record.indexVersion&&g.drawRange.start===0&&g.drawRange.count===Infinity
  &&Object.keys(g.attributes).length===attributes.length&&attributes.every(([name,a,version])=>g.attributes[name]===a&&a.version===version);
}
const scratch=new T.Matrix4(),identity=new T.Matrix4();
function batchableMatrix(matrix){
 // Three changes front-face winding per object. One multi-draw cannot do that per member.
 // Its batched normal transform supports rotation and independent axis scales, but not shear.
 const e=matrix.elements,xx=e[0]**2+e[1]**2+e[2]**2,yy=e[4]**2+e[5]**2+e[6]**2,zz=e[8]**2+e[9]**2+e[10]**2;
 const xy=e[0]*e[4]+e[1]*e[5]+e[2]*e[6],xz=e[0]*e[8]+e[1]*e[9]+e[2]*e[10],yz=e[4]*e[8]+e[5]*e[9]+e[6]*e[10];
 return matrix.determinant()>0&&xy*xy<=1e-12*xx*yy&&xz*xz<=1e-12*xx*zz&&yz*yz<=1e-12*yy*zz;
}
export async function createFeatureBatches(scene,renderer,roots){
 if(!renderer.extensions.has('WEBGL_multi_draw'))return null;
 const lists=new Map(),records=new Map(),yieldWork=yieldEvery();
 for(const root of roots){
  if(!root.isGroup||!root.parent||!/^Walk_band_/.test(root.parent.name))continue;
  root.traverse(o=>{
   const g=o.geometry,m=o.material;
   if(!plain(o)||!compatibleMaterial(m)||!g.attributes.position||g.attributes.position.count>12000||
      g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.morphAttributes).length||
      Object.values(g.attributes).some(a=>!a.array||a.isInterleavedBufferAttribute||a.isFloat16BufferAttribute||a.gpuType!==T.FloatType||a.usage!==T.StaticDrawUsage)||g.index&&!g.index.array)return;
   const key=[root.parent.uuid,m.uuid,o.renderOrder,o.castShadow,o.receiveShadow,!!g.index,geometryKey(g)].join('/');
   if(!lists.has(key))lists.set(key,{band:root.parent,m,order:o.renderOrder,casts:o.castShadow,receives:o.receiveShadow,rows:[]});
   lists.get(key).rows.push({o,g,root});
  });
 }
 const byBand=new Map(),changed=[],shown=[],frustum=new T.Frustum(),lastProjection=new T.Matrix4();
 let pass=0,frustumVersion=0;
 const ancestors=new WeakMap();
 function underRoot(parent,root,band){
  if(!parent||parent===band)return false;
  let record=ancestors.get(parent);
  if(record?.pass===pass&&record.root===root)return record.visible;
  const visible=parent.visible&&!parent.isLOD&&(!parent.isGroup||parent.renderOrder===0)&&(parent===root||underRoot(parent.parent,root,band));
  if(!record){record={};ancestors.set(parent,record);}
  record.pass=pass;record.root=root;record.visible=visible;return visible;
 }
 const stats={batches:0,sources:0,active:0,skipped:0};
 for(const set of lists.values()){
  if(set.rows.length<3)continue;
  const unique=[...new Set(set.rows.map(row=>row.g))];
  const vertices=unique.reduce((sum,g)=>sum+g.attributes.position.count,0),indices=unique.reduce((sum,g)=>sum+(g.index?.count||0),0);
  const batch=new T.BatchedMesh(set.rows.length,vertices,indices,set.m);
  batch.name='Walk_feature_batch_'+set.m.name;batch.renderOrder=set.order;
  batch.castShadow=set.casts;batch.receiveShadow=set.receives;batch.sortObjects=false;
  batch.perObjectFrustumCulled=false;batch.frustumCulled=false;batch.visible=false;
  batch.userData.noCollide=true;batch.matrixAutoUpdate=false;
  const ids=new Map();
  for(const g of unique){
   ids.set(g,batch.addGeometry(g));
   if(!records.has(g))records.set(g,{g,index:g.index,indexVersion:g.index?.version,attributes:Object.entries(g.attributes).map(([name,a])=>[name,a,a.version])});
  }
  for(const row of set.rows){
   row.id=batch.addInstance(ids.get(row.g));row.record=records.get(row.g);row.matrix=new T.Matrix4();row.checked=false;row.usable=false;row.on=false;
   batch.setVisibleAt(row.id,false);
  }
  // World-space instance transforms; the scene and this batch have identity transforms.
  scene.add(batch);set.batch=batch;set.visible=[];set.previous=[];
  if(!byBand.has(set.band))byBand.set(set.band,[]);
  byBand.get(set.band).push(set);stats.batches++;stats.sources+=set.rows.length;await yieldWork();
 }
 function collect(camera){
  stats.skipped=stats.active=0;pass++;
  scratch.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  if(frustumVersion===0||!lastProjection.equals(scratch)){lastProjection.copy(scratch);frustum.setFromProjectionMatrix(scratch);frustumVersion++;}
  for(const [band,sets] of byBand){
   if(!band.visible||band.renderOrder!==0||(band!==scene&&band.parent!==scene))continue;
   for(const set of sets){
    if(!set.m.visible)continue;
    let checkedMaterial=false;
    const list=set.visible;list.length=0;
    for(const row of set.rows){
     const {o,g,root}=row;
     if(!o.visible||!o.layers.test(camera.layers)||!plain(o)||o.geometry!==g||o.material!==set.m||o.renderOrder!==set.order||
        o.receiveShadow!==set.receives||o.castShadow!==set.casts||root.parent!==band)continue;
     if(!underRoot(o.parent,root,band)||!frustum.intersectsObject(o))continue;
     if(!checkedMaterial){if(!compatibleMaterial(set.m))break;checkedMaterial=true;}
     const record=row.record;
     if(record.pass!==pass){record.pass=pass;record.valid=unchanged(record);}
     if(!record.valid)continue;
     if(!row.checked||!row.matrix.equals(o.matrixWorld)){
      row.matrix.copy(o.matrixWorld);row.checked=true;row.usable=batchableMatrix(row.matrix);
      if(row.usable)set.batch.setMatrixAt(row.id,row.matrix);
     }
     if(row.usable)list.push(row);
    }
    if(list.length<2)continue;
    for(const row of list){
     row.o.visible=false;changed.push(row.o);row.pass=pass;
     if(!row.on){set.batch.setVisibleAt(row.id,true);row.on=true;}
    }
    for(const row of set.previous){
     if(row.pass!==pass){set.batch.setVisibleAt(row.id,false);row.on=false;}
    }
    // Keep the last submitted list, including when a later frame leaves this batch idle.
    set.visible=set.previous;set.previous=list;
    set.batch.visible=true;shown.push(set.batch);stats.active++;stats.skipped+=list.length-1;
   }
  }
 }
 let mainCamera=null;
 const before=scene.onBeforeRender;
 scene.onBeforeRender=function(r,s,cam,target){
  before.apply(this,arguments);
  if(cam===mainCamera&&target===null)collect(cam);
 };
 return {stats,enabled:true,around(view,draw){
  if(!this.enabled||renderer.shadowMap.enabled||renderer.xr?.isPresenting||scene.overrideMaterial||!scene.matrixWorld.equals(identity)||!view.layers.isEnabled(0))return draw();
  mainCamera=view;
  try{return draw();}finally{
   mainCamera=null;for(const o of changed)o.visible=true;changed.length=0;
   for(const batch of shown)batch.visible=false;shown.length=0;
  }
 }};
}
