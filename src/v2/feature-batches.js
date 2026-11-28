import * as T from 'three';
import {borrowId,createKind,lookNow,texelGeometry} from './look-kinds.js';
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
// A kind's parts leave their uv out: the kind gives each vertex its material's texel (look-kinds.js).
const geometryKey=(g,kind=false)=>Object.entries(g.attributes).filter(([name])=>!kind||name!=='uv').map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name,a.gpuType].join(':')).sort().join('|');
// Why a mesh under a root cannot join a batch, or null when it can. `take(o)`: false leaves a part out.
export function rowProblem(o,take=null){
 const g=o.geometry,m=o.material;
 if(!plain(o))return 'not plain';
 if(take&&!take(o))return 'left out';
 if(!compatibleMaterial(m))return 'material';
 if(!g.attributes.position||g.attributes.position.count>12000)return 'too big';
 if(g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.morphAttributes).length)return 'range or morphs';
 if(Object.values(g.attributes).some(a=>!a.array||a.isInterleavedBufferAttribute||a.isFloat16BufferAttribute||a.gpuType!==T.FloatType||a.usage!==T.StaticDrawUsage)||g.index&&!g.index.array)return 'attributes';
 return null;
}
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
// Feature kinds (`kinds`): a band's parts whose materials share a look (look-kinds.js: equal but for colour, glow,
// roughness and metalness) batch together, one batch for the kind instead of one for each material; a kind of one material
// batches as before. `alone(material)`: a material that stays apart (one corner-shade.js leaves alone, or named so that
// it would: its batch shares the material today, and its name the batch's).
// - One kind a look for the whole walk: the batches of a look (in every band, and from every call: the features', the
//   lifts', the lifts' doors') share its material and textures, which have room for KIND_WIDTH members. Its material is
//   a copy of its members' (look-kinds.js createKind) with a member's material id, the lowest when it is made that no
//   other kind has taken: three sorts opaque draws by material id, so the kind draws where its first member did, and no
//   two kinds' materials share an id (three would skip the second's uniforms, taking it for the first).
// - A batch's parts are added in their materials' id order, as three would have drawn them (an unsorted BatchedMesh draws
//   its instances in the order they were added).
// - A part whose material no longer has the kind's look or hooks sits out (draws itself, as before); a kind whose own
//   material no longer holds one for what it reads from its textures lets all its parts draw themselves.
const KIND_WIDTH=256,kindsByLook=new Map();let kindCount=0,kindBatches=0;
function kindFor(look,materials){
 let kind=kindsByLook.get(look);
 const fresh=kind?materials.filter(m=>!kind.index.has(m)):materials;
 if(kind&&kind.materials.length+fresh.length<=kind.width){for(const m of fresh)kind.add(m);return kind;}
 const id=borrowId(materials);
 kind=createKind(materials,{name:'Walk_feature_kind_'+kindCount++,width:Math.max(KIND_WIDTH,materials.length),...(id!==undefined?{id}:{})});
 kindsByLook.set(look,kind);return kind;
}
// `skip(root, o)`: a row that sits out this frame (group-occlusion.js: its root hidden behind what the frame already drew).
// `take(o)`: false leaves a part out of the batches (a lift door's blades, shown only while it opens).
// `hide`: a row the skip leaves out is hidden for the main pass too, so it never reaches group occlusion's own count.
export async function createFeatureBatches(scene,renderer,roots,{skip=null,take=null,hide=false,kinds=false,alone=null}={}){
 if(!renderer.extensions.has('WEBGL_multi_draw'))return null;
 const lists=new Map(),records=new Map(),yieldWork=yieldEvery();
 for(const root of roots){
  const band=root.parent;
  if(!root.isGroup||!band||(band!==scene&&!/^Walk_band_/.test(band.name)))continue;
  root.traverse(o=>{
   if(rowProblem(o,take))return;
   const g=o.geometry,m=o.material,look=kinds&&!alone?.(m)?lookNow(m,true):null;
   const key=[band.uuid,look===null?m.uuid:'kind '+look,o.renderOrder,o.castShadow,o.receiveShadow,!!g.index,geometryKey(g,look!==null)].join('/');
   if(!lists.has(key))lists.set(key,{band,m,look,order:o.renderOrder,casts:o.castShadow,receives:o.receiveShadow,rows:[]});
   lists.get(key).rows.push({o,g,root,m});
  });
 }
 // A kind of one material batches as before: its parts by their whole geometry (uv included), as that material's batch.
 const sets=[];
 for(const set of lists.values()){
  if(set.look===null){sets.push(set);continue;}
  const materials=[...new Set(set.rows.map(row=>row.m))];
  if(materials.length>1){materials.sort((a,b)=>a.id-b.id);set.materials=materials;sets.push(set);continue;}
  const split=new Map();
  for(const row of set.rows){const k=geometryKey(row.g);if(!split.has(k))split.set(k,{...set,look:null,rows:[]});split.get(k).rows.push(row);}
  sets.push(...split.values());
 }
 const byBand=new Map(),changed=[],shown=[],frustum=new T.Frustum(),lastProjection=new T.Matrix4(),kindList=[];
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
 const stats={batches:0,sources:0,active:0,skipped:0,kinds:0,kindMaterials:0,apart:0};
 // Each look's kind, with all its members in this call (lowest id first).
 const members=new Map();
 for(const set of sets)if(set.materials&&set.rows.length>1){let u=members.get(set.look);if(!u)members.set(set.look,u=new Set());for(const m of set.materials)u.add(m);}
 for(const [look,u] of members){const kind=kindFor(look,[...u].sort((a,b)=>a.id-b.id));if(!kindList.includes(kind))kindList.push(kind);}
 for(const set of sets){
  if(set.rows.length<2)continue;
  let kind=null;
  if(set.materials){
   kind=kindsByLook.get(set.look);set.kind=kind;
   const order=new Map(set.rows.map((row,i)=>[row,i]));
   set.rows.sort((a,b)=>a.m.id-b.m.id||order.get(a)-order.get(b));
  }
  // A kind's geometries are one per geometry and material (each carries its material's texel).
  const shapes=new Map();
  const shapeOf=row=>{let byMaterial=shapes.get(row.g);if(!byMaterial)shapes.set(row.g,byMaterial=new Map());const k=kind?row.m:null;let shape=byMaterial.get(k);
   if(!shape)byMaterial.set(k,shape={g:kind?texelGeometry(row.g,kind.index.get(row.m),kind.width):row.g});return shape;};
  const shapeOfRow=new Map(set.rows.map(row=>[row,shapeOf(row)]));
  const unique=[...new Set(shapeOfRow.values())];
  const vertices=unique.reduce((sum,s)=>sum+s.g.attributes.position.count,0),indices=unique.reduce((sum,s)=>sum+(s.g.index?.count||0),0);
  const batch=new T.BatchedMesh(set.rows.length,vertices,indices,kind?kind.material:set.m);
  batch.name='Walk_feature_batch_'+(kind?'kind_'+kindBatches++:set.m.name);batch.renderOrder=set.order;
  batch.castShadow=set.casts;batch.receiveShadow=set.receives;batch.sortObjects=false;
  batch.perObjectFrustumCulled=false;batch.frustumCulled=false;batch.visible=false;
  batch.userData.noCollide=true;batch.matrixAutoUpdate=false;
  for(const shape of unique)shape.id=batch.addGeometry(shape.g);
  for(const row of set.rows){const g=row.g;
   if(!records.has(g))records.set(g,{g,index:g.index,indexVersion:g.index?.version,attributes:Object.entries(g.attributes).map(([name,a])=>[name,a,a.version])});
   row.id=batch.addInstance(shapeOfRow.get(row).id);row.record=records.get(g);row.matrix=new T.Matrix4();row.checked=false;row.usable=false;row.on=false;
   batch.setVisibleAt(row.id,false);
  }
  // World-space instance transforms; the scene and this batch have identity transforms.
  scene.add(batch);set.batch=batch;set.visible=[];set.previous=[];
  if(!byBand.has(set.band))byBand.set(set.band,[]);
  byBand.get(set.band).push(set);stats.batches++;stats.sources+=set.rows.length;
  if(kind){stats.kinds++;stats.kindMaterials+=set.materials.length;}
  await yieldWork();
 }
 // Each pass a kind member's material is checked once (every 60 passes its look is worked out again in full).
 const fit=new Map();
 const fits=(kind,m)=>{let f=fit.get(m);if(f?.pass===pass)return f.ok;if(!f)fit.set(m,f={});f.pass=pass;f.ok=m.visible&&compatibleMaterial(m)&&kind.fits(m,pass%60===0);return f.ok;};
 function collect(camera){
  stats.skipped=stats.active=stats.apart=0;pass++;
  for(const kind of kindList)kind.follow();
  scratch.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  if(frustumVersion===0||!lastProjection.equals(scratch)){lastProjection.copy(scratch);frustum.setFromProjectionMatrix(scratch);frustumVersion++;}
  for(const [band,sets] of byBand){
   if(!band.visible||band.renderOrder!==0||(band!==scene&&band.parent!==scene))continue;
   for(const set of sets){
    const kind=set.kind;
    if(kind?!kind.usable():!set.m.visible)continue;
    let checkedMaterial=false;
    const list=set.visible;list.length=0;
    for(const row of set.rows){
     const {o,g,root}=row;
     if(skip?.(root,o)){if(hide&&o.visible){o.visible=false;changed.push(o);}continue;}
     if(!o.visible||!o.layers.test(camera.layers)||!plain(o)||o.geometry!==g||o.material!==row.m||o.renderOrder!==set.order||
        o.receiveShadow!==set.receives||o.castShadow!==set.casts||root.parent!==band)continue;
     if(!underRoot(o.parent,root,band)||!frustum.intersectsObject(o))continue;
     if(kind){if(!fits(kind,row.m)){stats.apart++;continue;}}
     else if(!checkedMaterial){if(!compatibleMaterial(set.m))break;checkedMaterial=true;}
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
 return {stats,kinds:kindList,enabled:true,around(view,draw){
  if(!this.enabled||renderer.shadowMap.enabled||renderer.xr?.isPresenting||scene.overrideMaterial||!scene.matrixWorld.equals(identity)||!view.layers.isEnabled(0))return draw();
  mainCamera=view;
  try{return draw();}finally{
   mainCamera=null;for(const o of changed)o.visible=true;changed.length=0;
   for(const batch of shown)batch.visible=false;shown.length=0;
  }
 }};
}
