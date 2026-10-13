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
 const bands=new Map(),normal=new T.Matrix3();
 for(const b of buckets.values()){
  const P=new Float32Array(b.vertices*3),N=new Float32Array(b.vertices*3),U=new Float32Array(b.vertices*2),C=b.colors?new Float32Array(b.vertices*3):null;
  const I=b.vertices>65535?new Uint32Array(b.indices):new Uint16Array(b.indices);let vo=0,io=0;
  const put=(g,i,at)=>{
   const pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv,col=g.attributes.color;
   v.fromBufferAttribute(pos,i).applyMatrix4(put.m);P[at*3]=v.x;P[at*3+1]=v.y;P[at*3+2]=v.z;
   if(nor){v.fromBufferAttribute(nor,i).applyMatrix3(normal).normalize();N[at*3]=v.x;N[at*3+1]=v.y;N[at*3+2]=v.z;}
   if(uv){U[at*2]=uv.getX(i);U[at*2+1]=uv.getY(i);}
   if(C){const k=put.tint,own=col&&put.own;C[at*3]=k.r*(own?col.getX(i):1);C[at*3+1]=k.g*(own?col.getY(i):1);C[at*3+2]=k.b*(own?col.getZ(i):1);}
  };
  for(const {o,tris} of b.parts){
   const g=o.geometry,pos=g.attributes.position,idx=g.index?g.index.array:null;
   put.m=o.matrixWorld;normal.getNormalMatrix(o.matrixWorld);
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
