import * as T from 'three';
import {bandOf} from './collision.js';

// The fitted interior is ~50k small meshes: fine for the cutaway views, far too many draw calls to walk through.
// Walk mode merges every visible static mesh into one mesh per material, deck band and 40 m stretch of the ship, and
// shows only the bands around the walker. Instanced meshes (the repeated cabins) and anything under a
// userData.keepLive group (lift cars, doors) stay as they are.
const CELL=40,WHITE=new T.Color(1,1,1);
const worldVisible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
// Plain colour materials (no textures, opaque, not glowing) fold into a few shared ones that take their colour per
// vertex, grouped by finish; ~300 materials become a handful of draw calls per chunk.
const MAPS=['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap','alphaMap','bumpMap'];
const shared=new Map();
function finishOf(m){
 if(!m.isMeshStandardMaterial||m.transparent||MAPS.some(k=>m[k])||(m.emissive&&m.emissive.getHex()&&m.emissiveIntensity>0))return null;
 const key=`${Math.round(m.roughness*10)}|${Math.round(m.metalness*10)}|${m.side}|${m.flatShading?1:0}`;
 let mat=shared.get(key);if(!mat){mat=new T.MeshStandardMaterial({name:'Walk_finish_'+key,vertexColors:true,roughness:Math.round(m.roughness*10)/10,metalness:Math.round(m.metalness*10)/10,side:m.side,flatShading:m.flatShading});shared.set(key,mat);}
 return mat;
}

// Parts built by different passes often share a face exactly: a lobby floor laid over the transit floor at the same
// height, a panel flush with its wall, a walk-mode partition on a room wall. Merged into one mesh they z-fight,
// flickering as the walker moves. Where the faces of two parts' boxes coincide and overlap, the smaller part's face
// moves out by a couple of millimetres (a layer per part stacked on it), so the finer piece always draws on top.
// Boxes test all six faces of their bounds when they line up with the ship (just top and bottom when turned about
// the vertical); merged parts made of boxes (partitions, railings) list them in userData.boxes ([x0,x1,y0,y1,z0,z1],
// world) to be tested one by one; free-form parts (deck slabs with their stair holes, merged polish passes) test
// each plane their flat, axis-facing triangles lie in.
const NUDGE=.002,MAX_LAYERS=6,EPS=5e-4,PLAN={x:['y','z'],y:['x','z'],z:['x','y']};
const FREE_FORM=/^(BufferGeometry|ExtrudeGeometry|ShapeGeometry)$/,AXES=['x','y','z'];
// Each plane a mesh's axis-facing triangles lie in, with the bounds they cover there.
function planes(o,add){
 const g=o.geometry,pos=g.attributes.position.array,idx=g.index?g.index.array:null,n=idx?idx.length:pos.length/3,m=o.matrixWorld.elements,found=new Map(),p=[0,0,0,0,0,0,0,0,0];
 // Most free-form parts are built in ship coordinates: no rotation or scale to apply.
 const plain=m[0]===1&&m[5]===1&&m[10]===1&&!m[1]&&!m[2]&&!m[4]&&!m[6]&&!m[8]&&!m[9];
 for(let t=0;t<n;t+=3){
  for(let k=0;k<3;k++){const i=(idx?idx[t+k]:t+k)*3,x=pos[i],y=pos[i+1],z=pos[i+2];
   if(plain){p[k*3]=x+m[12];p[k*3+1]=y+m[13];p[k*3+2]=z+m[14];continue;}
   p[k*3]=m[0]*x+m[4]*y+m[8]*z+m[12];p[k*3+1]=m[1]*x+m[5]*y+m[9]*z+m[13];p[k*3+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}
  const ux=p[3]-p[0],uy=p[4]-p[1],uz=p[5]-p[2],vx=p[6]-p[0],vy=p[7]-p[1],vz=p[8]-p[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=Math.hypot(nx,ny,nz);
  if(l<1e-9)continue;
  const a=Math.abs(nx)>.9999*l?0:Math.abs(ny)>.9999*l?1:Math.abs(nz)>.9999*l?2:-1;if(a<0)continue;
  const sign=(a===0?nx:a===1?ny:nz)>0?1:-1,at=(p[a]+p[a+3]+p[a+6])/3,key=(a*2+(sign>0?1:0))*1e9+Math.round(at*1000);
  let r=found.get(key);if(!r)found.set(key,r={a,sign,min:{x:1e9,y:1e9,z:1e9},max:{x:-1e9,y:-1e9,z:-1e9}});
  for(let k=0;k<3;k++)for(let c=0;c<3;c++){const v=p[k*3+c],ax=AXES[c];if(v<r.min[ax])r.min[ax]=v;if(v>r.max[ax])r.max[ax]=v;}
 }
 for(const [key,r] of found){const ax=AXES[r.a];r.min[ax]=r.max[ax]=(r.min[ax]+r.max[ax])/2;add(o,key,ax,r.sign,r.min,r.max);}
}
function coplanarNudges(meshes){
 const faces=new Map(),box=new T.Box3(),e=new Array(16);
 const add=(o,part,axis,sign,a,b)=>{const at=sign>0?b[axis]:a[axis],[u,w]=PLAN[axis],key=(AXES.indexOf(axis)*2+(sign>0?1:0))*1e9+Math.round(at*1000);let list=faces.get(key);if(!list)faces.set(key,list=[]);
  list.push({o,part,axis,sign,at,u,w,u0:a[u],u1:b[u],w0:a[w],w1:b[w],area:(b[u]-a[u])*(b[w]-a[w])});};
 const six=(o,part,a,b)=>{for(const axis of ['x','y','z'])for(const sign of [1,-1])add(o,part,axis,sign,a,b);};
 for(const o of meshes){
  if(o.userData.boxes){o.userData.boxes.forEach(([x0,x1,y0,y1,z0,z1],i)=>six(o,i,{x:x0,y:y0,z:z0},{x:x1,y:y1,z:z1}));continue;}
  const g=o.geometry;
  // (The hull's curved skin, hundreds of thousands of triangles, has no flat faces worth the scan.)
  if(FREE_FORM.test(g.type)){if((g.index?g.index.count:g.attributes.position.count)<300000)planes(o,add);continue;}
  if(!g.boundingBox)g.computeBoundingBox();box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
  o.matrixWorld.toArray(e);const col=k=>{const x=e[k*4],y=e[k*4+1],z=e[k*4+2],l=Math.hypot(x,y,z)||1;return [x/l,y/l,z/l];};
  // Upright: the part's own up stays up. Square: every axis lines up with a ship axis.
  const cols=[0,1,2].map(col),upright=cols.some(c=>Math.abs(c[1])>.9999),square=cols.every(c=>c.some(v=>Math.abs(v)>.9999));
  if(!upright)continue;
  if(square)six(o,0,box.min,box.max);else for(const sign of [1,-1])add(o,0,'y',sign,box.min,box.max);
 }
 // Each face sits one layer above the highest face it overlaps, largest first. Faces are found through a 4 m grid on
 // their plane; the few that would fill too many cells (deck plates, hull) are checked against every face.
 const nudges=new Map(),CELL_SIZE=4,cell=v=>Math.floor(v/CELL_SIZE);let stamp=0;
 for(const list of faces.values()){
  if(list.length<2)continue;
  list.sort((p,q)=>q.area-p.area);
  const grid=new Map(),large=[];
  for(const p of list){
   p.layer=0;p.seen=++stamp;
   const i0=cell(p.u0),i1=cell(p.u1),j0=cell(p.w0),j1=cell(p.w1),wide=(i1-i0+1)*(j1-j0+1)>64;
   const test=q=>{if(q.seen===stamp||(q.o===p.o&&q.part===p.part))return;q.seen=stamp;
    if(Math.min(p.u1,q.u1)-Math.max(p.u0,q.u0)>.01&&Math.min(p.w1,q.w1)-Math.max(p.w0,q.w0)>.01)p.layer=Math.max(p.layer,q.layer+1);};
   for(const q of large)test(q);
   if(wide){for(const cells of grid.values())for(const q of cells)test(q);large.push(p);}
   else{for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=i*100003+j,cells=grid.get(k);if(cells)for(const q of cells)test(q);}
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=i*100003+j;let cells=grid.get(k);if(!cells)grid.set(k,cells=[]);cells.push(p);}}
   p.layer=Math.min(p.layer,MAX_LAYERS);
   if(!p.layer)continue;
   let list=nudges.get(p.o);if(!list)nudges.set(p.o,list=[]);
   list.push({axis:AXES.indexOf(p.axis),at:p.at,shift:p.sign*p.layer*NUDGE,u:AXES.indexOf(p.u),w:AXES.indexOf(p.w),u0:p.u0-EPS,u1:p.u1+EPS,w0:p.w0-EPS,w1:p.w1+EPS});
  }
 }
 // A part with many nudges (the merged partitions) gets them indexed by axis and plane, to the millimetre both ways
 // of rounding, for the vertex pass.
 for(const [o,list] of nudges){
  if(list.length<=8){nudges.set(o,{list});continue;}
  const index=new Map();
  for(const n of list)for(const mm of new Set([Math.floor(n.at*1000),Math.ceil(n.at*1000)])){const key=n.axis*1e9+mm;let at=index.get(key);if(!at)index.set(key,at=[]);at.push(n);}
  nudges.set(o,{index});
 }
 return nudges;
}
// Move a world-space vertex [x,y,z] by the nudges whose face it lies on.
function nudge(p,{list,index}){
 const hit=n=>Math.abs(p[n.axis]-n.at)<EPS&&p[n.u]>n.u0&&p[n.u]<n.u1&&p[n.w]>n.w0&&p[n.w]<n.w1;
 if(list){for(const n of list)if(hit(n))p[n.axis]+=n.shift;return;}
 for(let a=0;a<3;a++){const at=index.get(a*1e9+Math.round(p[a]*1000));if(at)for(const n of at)if(hit(n)){p[a]+=n.shift;break;}}
}

export function bakeForWalking(root,{skip=()=>false}={}){
 root.updateMatrixWorld(true);
 const buckets=new Map(),taken=[],v=new T.Vector3(),c=new T.Vector3();
 const bucket=(material,band,cell,colors)=>{const key=`${material.uuid}|${band}|${cell}|${colors?1:0}`;let b=buckets.get(key);if(!b)buckets.set(key,b={material,band,colors,parts:[],vertices:0,indices:0});return b;};
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||Array.isArray(o.material)||!worldVisible(o)||skip(o))return;
  for(let p=o;p;p=p.parent)if(p.userData.keepLive)return;
  const g=o.geometry,pos=g?.attributes?.position;if(!pos)return;
  if(!g.boundingBox)g.computeBoundingBox();
  const box=g.boundingBox.clone().applyMatrix4(o.matrixWorld),colors=!!(o.material.vertexColors&&g.attributes.color)||!!finishOf(o.material),material=finishOf(o.material)||o.material;
  const count=g.index?g.index.count:pos.count;taken.push(o);
  // Small parts go whole into the bucket of their centre; long or tall ones are cut up by triangle so each piece
  // can be culled with its band and stretch of the ship.
  if(box.max.x-box.min.x<=CELL&&bandOf(box.min.y)===bandOf(box.max.y)){
   box.getCenter(c);const b=bucket(material,bandOf(c.y),Math.floor(c.x/CELL),colors);
   b.parts.push({o,tris:null});b.vertices+=pos.count;b.indices+=count;return;
  }
  const split=new Map(),idx=g.index?g.index.array:null,m=o.matrixWorld;
  for(let t=0;t<count;t+=3){
   c.set(0,0,0);for(let k=0;k<3;k++)c.add(v.fromBufferAttribute(pos,idx?idx[t+k]:t+k).applyMatrix4(m));c.divideScalar(3);
   const b=bucket(material,bandOf(c.y),Math.floor(c.x/CELL),colors);let list=split.get(b);if(!list)split.set(b,list=[]);list.push(t);
  }
  for(const [b,list] of split){b.parts.push({o,tris:list});b.vertices+=list.length*3;b.indices+=list.length*3;}
 });
 const bands=new Map(),normal=new T.Matrix3(),xyz=[0,0,0],nudges=coplanarNudges(taken);
 for(const b of buckets.values()){
  const P=new Float32Array(b.vertices*3),N=new Float32Array(b.vertices*3),U=new Float32Array(b.vertices*2),C=b.colors?new Float32Array(b.vertices*3):null;
  const I=b.vertices>65535?new Uint32Array(b.indices):new Uint16Array(b.indices);let vo=0,io=0;
  const put=(g,i,at)=>{
   const pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv,col=g.attributes.color;
   v.fromBufferAttribute(pos,i).applyMatrix4(put.m);
   if(put.nudge){xyz[0]=v.x;xyz[1]=v.y;xyz[2]=v.z;nudge(xyz,put.nudge);v.set(xyz[0],xyz[1],xyz[2]);}
   P[at*3]=v.x;P[at*3+1]=v.y;P[at*3+2]=v.z;
   if(nor){v.fromBufferAttribute(nor,i).applyMatrix3(normal).normalize();N[at*3]=v.x;N[at*3+1]=v.y;N[at*3+2]=v.z;}
   if(uv){U[at*2]=uv.getX(i);U[at*2+1]=uv.getY(i);}
   if(C){const k=put.tint,own=col&&put.own;C[at*3]=k.r*(own?col.getX(i):1);C[at*3+1]=k.g*(own?col.getY(i):1);C[at*3+2]=k.b*(own?col.getZ(i):1);}
  };
  for(const {o,tris} of b.parts){
   const g=o.geometry,pos=g.attributes.position,idx=g.index?g.index.array:null;
   put.m=o.matrixWorld;put.nudge=nudges.get(o);normal.getNormalMatrix(o.matrixWorld);
   // Folded materials carry their colour in the vertices; a material's own vertex colours multiply in.
   put.tint=b.material===o.material?WHITE:o.material.color;put.own=!!(o.material.vertexColors&&g.attributes.color);
   // A mirrored transform flips the winding; swap two corners so faces keep facing out.
   const flip=o.matrixWorld.determinant()<0,a=flip?2:1,z=flip?1:2;
   if(!tris){
    for(let i=0;i<pos.count;i++)put(g,i,vo+i);
    const n=idx?idx.length:pos.count;for(let i=0;i<n;i+=3){const f=k=>idx?idx[i+k]:i+k;I[io++]=f(0)+vo;I[io++]=f(a)+vo;I[io++]=f(z)+vo;}
    vo+=pos.count;
   }else{
    for(const t of tris){for(let k=0;k<3;k++)put(g,idx?idx[t+k]:t+k,vo+k);I[io++]=vo;I[io++]=vo+a;I[io++]=vo+z;vo+=3;}
   }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(P,3));geo.setAttribute('normal',new T.BufferAttribute(N,3));geo.setAttribute('uv',new T.BufferAttribute(U,2));
  if(C)geo.setAttribute('color',new T.BufferAttribute(C,3));
  geo.setIndex(new T.BufferAttribute(I,1));geo.computeBoundingSphere();geo.computeBoundingBox();
  const mesh=new T.Mesh(geo,b.material);mesh.name='Walk_merged_'+(b.material.name||'material');mesh.matrixAutoUpdate=false;
  let group=bands.get(b.band);if(!group){group=new T.Group();group.name='Walk_band_'+b.band;group.userData.band=b.band;bands.set(b.band,group);}
  group.add(mesh);
 }
 // The originals stay in the scene graph (colliders and seats read them) but no longer render.
 for(const o of taken){o.visible=false;o.userData.baked=true;}
 return {bands,meshes:buckets.size,sources:taken.length};
}

// Show the bands between `low` and `high` (heights).
export function showBands(bands,low,high){
 const a=bandOf(low),b=bandOf(high);for(const [band,group] of bands)group.visible=band>=a&&band<=b;
}
