import {BackSide, Box3, FrontSide, LessDepth, LessEqualDepth, Material, Matrix4, NoBlending, NormalBlending, Object3D, Vector3} from 'three';
import {geometryKept} from './shader-hooks.js';

const cellWidth = .125;
const ordinaryHooks = o => o.onBeforeRender === Object3D.prototype.onBeforeRender && o.onAfterRender === Object3D.prototype.onAfterRender;
const ordinaryDepth = m => m.depthTest && (m.depthFunc === LessDepth || m.depthFunc === LessEqualDepth) &&
 !m.stencilWrite && !m.polygonOffset && !m.wireframe && m.onBeforeRender === Material.prototype.onBeforeRender && geometryKept(m);

function edge(a,b,sign) {
 const dx=b.x-a.x, dz=b.z-a.z, scale=sign/Math.hypot(dx,dz);
 const x=-dz*scale, z=dx*scale;
 return {x,z,k:-x*a.x-z*a.z-.035,eye:0};
}

// Use individual horizontal triangles from the actual facade mesh. Holes and
// uncovered seams therefore remain holes even if the surrounding plate is large.
export function createFloorOcclusion(scene,camera) {
 const floor=scene.getObjectByName?.('V2_facade_terraces_and_atrium_roof');
 if (!floor?.isMesh || floor.isInstancedMesh || !ordinaryHooks(floor)) return null;
 const g=floor.geometry, p=g.attributes.position, ix=g.index, m=floor.material;
 if (!p?.array || p.isInterleavedBufferAttribute || !ix?.array || !m.isMeshStandardMaterial || g.morphAttributes.position) return null;
 floor.updateWorldMatrix(true,false);
 const world=floor.matrixWorld.clone(), sign=Math.sign(world.determinant()), pv=p.version, iv=ix.version;
 const bins=new Map(), binSize=24;
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),point=new Vector3();
 for(let i=0;i+2<ix.count;i+=3) {
  a.fromBufferAttribute(p,ix.getX(i)).applyMatrix4(world);
  b.fromBufferAttribute(p,ix.getX(i+1)).applyMatrix4(world);
  c.fromBufferAttribute(p,ix.getX(i+2)).applyMatrix4(world);
  if(a.y!==b.y || a.y!==c.y) continue;
  const cross=(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  if(!(Math.abs(cross)>=2)) continue;
  const winding=Math.sign(cross), x=(a.x+b.x+c.x)/3,z=(a.z+b.z+c.z)/3;
  const patch={y:a.y,x,z,front:-winding*sign,area:Math.abs(cross),edges:[edge(a,b,winding),edge(b,c,winding),edge(c,a,winding)]};
  const key=Math.floor(x/binSize)+','+Math.floor(z/binSize);
  if(!bins.has(key)) bins.set(key,[]);
  bins.get(key).push(patch);
 }
 if(!bins.size) return null;
 const targets=new WeakMap(), geometryBoxes=new WeakMap(), instance=new Matrix4(), box=new Box3();
 const selected=[], previousProjection=new Matrix4();
 let cx=NaN,cy=NaN,cz=NaN,side=-1,epoch=0,activeFrame=-1,budget=0,validProjection=false;

 function select(x,y,z) {
  selected.length=0;
  for(let bx=Math.floor(x/binSize)-2;bx<=Math.floor(x/binSize)+2;bx++) for(let bz=Math.floor(z/binSize)-2;bz<=Math.floor(z/binSize)+2;bz++) {
   const bin=bins.get(bx+','+bz);
   if(!bin) continue;
   for(const t of bin) {
    const dy=y-t.y, facing=t.front*dy;
    if(Math.abs(dy)<.7 || (side===FrontSide && facing<=0) || (side===BackSide && facing>=0)) continue;
    const r2=(x-t.x)**2+dy*dy+(z-t.z)**2;
    t.rank=t.area*Math.abs(dy)/(r2*Math.sqrt(r2));
    selected.push(t);
   }
  }
  selected.sort((a,b)=>b.rank-a.rank);
  if(selected.length>96) selected.length=96;
  for(const t of selected) {
   t.above=y>t.y; t.near=Math.abs(y-t.y)-cellWidth/2; t.far=t.near+cellWidth;
   for(const e of t.edges) e.eye=e.x*x+e.z*z+e.k-cellWidth/2*(Math.abs(e.x)+Math.abs(e.z));
  }
 }

 function submitted(r,material,group) {
  activeFrame=-1;
  if(group || material!==m || !world.equals(floor.matrixWorld) || floor.geometry!==g ||
   g.attributes.position!==p || p.version!==pv || g.index!==ix || ix.version!==iv ||
   g.drawRange.start!==0 || g.drawRange.count<ix.count || !ordinaryDepth(m) || !ordinaryHooks(floor) ||
   (m.onBeforeCompile!==Material.prototype.onBeforeCompile && !m.onBeforeCompile.cornerShade && !m.onBeforeCompile.filmLook) ||
   !m.depthWrite || !m.colorWrite || m.transparent || m.transmission || m.opacity!==1 || m.alphaMap ||
   m.alphaTest || m.alphaHash || m.alphaToCoverage || (m.blending!==NormalBlending && m.blending!==NoBlending) ||
   m.clippingPlanes?.length || r.clippingPlanes?.length || camera.view?.enabled ||
   r.capabilities?.reverseDepthBuffer) return;
  const e=camera.matrixWorld.elements;
  if(!previousProjection.equals(camera.projectionMatrix) || !epoch) {
   previousProjection.copy(camera.projectionMatrix);
   // Maximum radial distance to a near-plane corner, for this actual projection.
   let near=0;
   for(const x of [-1,1]) for(const y of [-1,1]) near=Math.max(near,point.set(x,y,-1).applyMatrix4(camera.projectionMatrixInverse).length());
   validProjection=near>0 && near<.30;
  }
  // The Frobenius norm bounds all world-space stretches, including shear.
  if(!validProjection || Math.hypot(e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10])>1.9) return;
  const cell=n=>(Math.floor(n/cellWidth)+.5)*cellWidth;
  const x=cell(e[12]),y=cell(e[13]),z=cell(e[14]);
  if(cx!==x || cy!==y || cz!==z || side!==m.side) {
   cx=x;cy=y;cz=z;side=m.side;epoch++;select(x,y,z);
  }
  activeFrame=r.info.render.frame;
  budget=.65; // CPU milliseconds for new proofs. Cached proofs remain available.
 }

 // The ray intersects a horizontal floor at a weighted average of its endpoints.
 // Bound each inward edge at the eye cell and at the target box, then bound
 // the numerator of that weighted average across both height intervals.
 function covered(b) {
  for(const t of selected) {
   const near=t.above?t.y-b.max.y:b.min.y-t.y;
   if(!(near>.08)) continue;
   const far=t.above?t.y-b.min.y:b.max.y-t.y;
   let inside=true;
   for(const e of t.edges) {
    const f=e.x*(e.x>=0?b.min.x:b.max.x)+e.z*(e.z>=0?b.min.z:b.max.z)+e.k;
    if(!((e.eye<0?far:near)*e.eye+(f<0?t.far:t.near)*f>0)) { inside=false;break; }
   }
   if(inside) return true;
  }
  return false;
 }
 function hidden(frame,geometry,material,o) {
  if(activeFrame!==frame || activeFrame<0 || o===floor || !o.isMesh || o.isBatchedMesh || o.isSkinnedMesh ||
     geometry.isInstancedBufferGeometry || geometry.morphAttributes.position || o.morphTexture || !ordinaryHooks(o) || !ordinaryDepth(material)) return false;
  const attr=geometry.attributes.position, inst=o.instanceMatrix, count=inst?o.count:1;
  if(!attr || count<1 || count>96) return false;
  let row=targets.get(o);
  if(row && row.epoch===epoch && row.attr===attr && row.pv===attr.version && row.inst===inst &&
     row.iv===inst?.version && row.count===count && row.world.equals(o.matrixWorld)) return row.hidden;
  if(budget<=0 || !attr.array || attr.isInterleavedBufferAttribute || attr.count>12000) return false;
  const start=performance.now();
  if(!row) { row={world:new Matrix4()};targets.set(o,row); }
  row.world.copy(o.matrixWorld);row.epoch=epoch;row.attr=attr;row.pv=attr.version;row.inst=inst;row.iv=inst?.version;row.count=count;row.hidden=false;
  let local=geometryBoxes.get(attr);
  if(!local || local.version!==attr.version) {
   local={version:attr.version,box:new Box3().setFromBufferAttribute(attr)};geometryBoxes.set(attr,local);
  }
  row.hidden=true;
  for(let i=0;i<count;i++) {
   if(inst) { o.getMatrixAt(i,instance);instance.premultiply(o.matrixWorld); }
   if(!covered(box.copy(local.box).applyMatrix4(inst?instance:o.matrixWorld))) {row.hidden=false;break;}
  }
  budget-=performance.now()-start;
  return row.hidden;
 }
 return {floor,submitted,hidden};
}
