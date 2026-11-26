import * as T from 'three';

// Room furnishings of one material that differ only in size draw as one instanced mesh. Phase-4 furnishings are mostly
// boxes (316 of 431 kinds; in V2_structure 131 of 144, over 11 materials), and after phone-furnishing.js each part and
// size is still its own instanced mesh: the arrival hall drew 47-57 of them a frame when it looked down the ship, one
// per kind, where 10-11 materials were showing. Here each kind's shape is scaled to its own box (a unit box for a box)
// and the kinds whose scaled shapes match exactly share one mesh, each instance carrying its kind's scale and place
// (instance x K, K = translate(centre) x scale(size)). What is drawn is the same: positions are K's image of the unit
// shape, a kind joins only when its normals keep their directions under K's inverse transpose (a box's do: they lie on
// the axes), and uvs and colours must match. Room culling (phase4-culling.js) reads each instance's bounding sphere as
// the mesh's sphere times the size of the instance's matrix; the shared sphere is made at least as large as every kind's
// own, so it keeps every instance it kept before. Instances, owner runs and owner boxes follow one another as
// phone-furnishing.js lays them out, and the kinds merged leave the scene. ?p4merge=0 keeps the kinds apart, to compare.

const SIZE_EPS=1e-6,MATCH_EPS=1e-5;
// FNV-1a over the bytes of the values, rounded: equal shapes give equal keys.
function keyOf(values,step){
 let h=0x811c9dc5;
 for(const v of values){const q=Math.round(v/step);h^=q&0xffff;h=Math.imul(h,0x01000193);h^=(q>>>16)&0xffff;h=Math.imul(h,0x01000193);}
 return (h>>>0).toString(36)+':'+values.length;
}
// The kind's drawn vertices as K's image of a scaled shape, or null when it cannot join another.
function scaledShape(g){
 const p=g.attributes.position,nrm=g.attributes.normal,ix=g.index;
 if(!p||p.itemSize!==3||!nrm||nrm.itemSize!==3||g.drawRange.start!==0||Object.keys(g.morphAttributes).length)return null;
 const total=ix?ix.count:p.count;if(g.drawRange.count<total||!total||total%3)return null;
 const others=Object.keys(g.attributes).filter(n=>n!=='position'&&n!=='normal').sort();
 if(Object.values(g.attributes).some(a=>a.isInterleavedBufferAttribute))return null;
 const order=new Array(total);for(let k=0;k<total;k++)order[k]=ix?ix.getX(k):k;
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const i of order)for(let c=0;c<3;c++){const v=p.getComponent(i,c);if(!Number.isFinite(v))return null;lo[c]=Math.min(lo[c],v);hi[c]=Math.max(hi[c],v);}
 const centre=lo.map((v,c)=>(v+hi[c])/2),size=hi.map((v,c)=>v-lo[c]),scale=size.map(s=>s>SIZE_EPS?s:1);
 // A normal keeps its direction under K's inverse transpose (n / scale) only along an axis or a uniformly scaled plane.
 for(const i of order){
  const n=[nrm.getX(i),nrm.getY(i),nrm.getZ(i)],m=n.map((v,c)=>v/scale[c]),ln=Math.hypot(...n),lm=Math.hypot(...m);
  if(!(ln>0&&lm>0))return null;
  for(let c=0;c<3;c++)if(Math.abs(n[c]/ln-m[c]/lm)>MATCH_EPS)return null;
 }
 const unit=new Float32Array(total*3);order.forEach((i,k)=>{for(let c=0;c<3;c++)unit[k*3+c]=(p.getComponent(i,c)-centre[c])/scale[c];});
 const rest=[nrm,...others.map(n=>g.attributes[n])],extra=[];
 // Raw stored values: a kind joins only with exactly the same stored normals, uvs and colours.
 for(const a of rest)for(const i of order)for(let c=0;c<a.itemSize;c++)extra.push(a.array[i*a.itemSize+c]);
 const s=g.boundingSphere;
 return {key:others.join(',')+'|'+others.map(n=>g.attributes[n].itemSize+':'+g.attributes[n].normalized).join(',')+'|'+keyOf(unit,MATCH_EPS)+'|'+keyOf(extra,1e-7),
  order,unit,centre,scale,others,sphere:s?{centre:s.center.clone(),radius:s.radius}:null};
}
// One geometry for the shared shape, indexed over its distinct vertices in the first kind's draw order.
function sharedGeometry(first){
 const g=first.o.geometry,shape=first.shape,names=['position','normal',...shape.others],attrs=names.map(n=>n==='position'?null:g.attributes[n]);
 const seen=new Map(),index=[],columns=names.map(()=>[]);
 shape.order.forEach((i,k)=>{
  const row=[[shape.unit[k*3],shape.unit[k*3+1],shape.unit[k*3+2]],...attrs.slice(1).map(a=>Array.from({length:a.itemSize},(_,c)=>a.array[i*a.itemSize+c]))];
  const key=row.map(r=>r.join(',')).join('|');let at=seen.get(key);
  if(at===undefined){at=seen.size;seen.set(key,at);row.forEach((r,n)=>columns[n].push(...r));}
  index.push(at);
 });
 const out=new T.BufferGeometry();
 names.forEach((n,k)=>{const a=k?attrs[k]:null,size=k?a.itemSize:3,Type=k?a.array.constructor:Float32Array;out.setAttribute(n,new T.BufferAttribute(new Type(columns[k]),size,k?a.normalized:false));});
 out.setIndex(index);
 out.computeBoundingBox();out.computeBoundingSphere();
 return out;
}
const frobenius=s=>Math.hypot(s[0],s[1],s[2]);

/** `root` is ship.inside, after phone-furnishing.js. Returns {meshes, sources, kinds}. */
export function mergeScaledFurnishing(root,{exclude=/^P4_p6_/}={}){
 const list=[];
 root.traverse(o=>{if(o.isInstancedMesh&&o.userData.phase4&&!o.userData.phase6ArchitectureSource&&!exclude.test(o.name))list.push(o);});
 const groups=new Map();
 for(const o of list){
  const m=o.material,g=o.geometry;
  if(Array.isArray(m)||m.transparent||o.instanceColor||o.morphTexture||!o.userData.ownerRuns||!o.parent||o.onBeforeRender!==T.Object3D.prototype.onBeforeRender)continue;
  const shape=scaledShape(g);if(!shape?.sphere)continue;
  const key=[m.uuid,o.renderOrder,!!o.userData.noCollide,o.castShadow,o.receiveShadow,o.frustumCulled,o.layers.mask,o.parent.uuid,shape.key].join('|');
  let group=groups.get(key);if(!group)groups.set(key,group=[]);group.push({o,shape});
 }
 const meshes=[],sources=[],relative=new T.Matrix4(),local=new T.Matrix4(),k=new T.Matrix4(),inverse=new T.Matrix4(),centre=new T.Vector3();
 for(const members of groups.values()){
  if(members.length<2)continue;
  const first=members[0],geometry=sharedGeometry(first);
  // The shared sphere's centre, in unit space, must be where every kind's own sphere centre falls; its radius at least
  // every kind's own radius over the size K adds to an instance's matrix (sqrt(3) for a rotation, |K|F with K).
  const unitCentre=geometry.boundingSphere.center,joined=[];let radius=geometry.boundingSphere.radius;
  for(const e of members){
   const {centre:c,scale,sphere}=e.shape;
   const back=[0,1,2].map(a=>(sphere.centre.getComponent(a)-c[a])/scale[a]);
   if(back.some((v,a)=>Math.abs(v-unitCentre.getComponent(a))>1e-4*Math.max(1,Math.abs(v))))continue;
   radius=Math.max(radius,sphere.radius*Math.sqrt(3)/frobenius(scale));joined.push(e);
  }
  if(joined.length<2){geometry.dispose();continue;}
  geometry.boundingSphere.radius=radius;
  const parent=first.o.parent,total=joined.reduce((s,e)=>s+e.o.instanceMatrix.count,0);
  parent.updateWorldMatrix(true,false);inverse.copy(parent.matrixWorld).invert();
  const o=new T.InstancedMesh(geometry,first.o.material,total),runs=[],owners=new Set();let at=0,phoneMerged=0;
  for(const {o:src,shape} of joined){
   src.updateWorldMatrix(true,false);relative.multiplyMatrices(inverse,src.matrixWorld);
   k.makeScale(...shape.scale).setPosition(centre.fromArray(shape.centre));
   for(let i=0;i<src.instanceMatrix.count;i++){src.getMatrixAt(i,local);o.setMatrixAt(at+i,local.premultiply(relative).multiply(k));}
   for(const run of src.userData.ownerRuns)runs.push({...run,start:run.start+at});
   for(const id of src.userData.roomOwners||[])owners.add(id);
   phoneMerged+=src.userData.phoneMerged||1;at+=src.instanceMatrix.count;sources.push(src);src.removeFromParent();
  }
  o.name='P4_scaled_'+first.o.material.name;o.renderOrder=first.o.renderOrder;o.castShadow=first.o.castShadow;o.receiveShadow=first.o.receiveShadow;
  o.layers.mask=first.o.layers.mask;
  // Room culling picks the instances in view, as for phone-furnishing.js's meshes.
  o.frustumCulled=false;o.matrixAutoUpdate=false;
  o.userData={...first.o.userData,roomOwners:[...owners],ownerRuns:runs,ownerBoxes:first.o.userData.ownerBoxes,phoneMerged,scaledKinds:joined.length};
  parent.add(o);o.updateMatrixWorld(true);meshes.push(o);
 }
 return {meshes,sources,kinds:sources.length};
}
