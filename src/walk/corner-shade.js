import * as T from 'three';
import layout from '../plan/selected-layout.js';

// Corner shading (2B): soft darkening where walls, furniture and fittings stand on a deck floor, done in the shader so
// the build pays nothing. Every steep collider face whose foot is on a deck floor becomes a wall line on that deck's
// distance grid, worked out in the page after start-up (the triangle scan in short slices, the grid in a worker). Lit
// opaque interior surfaces then darken by exp(-d/RADIUS)*exp(-h/RADIUS): d is the distance to the nearest wall line, h
// the height above the deck floor. Until the grid is ready nothing changes, and it then fades in. Desktop only.
const RES=.25,REACH=.9,RADIUS=.3,STRENGTH=.45,MIN_H=.25,FLOOR_TOL=.2,STEEP=.15,SLICE_MS=6,FADE_MS=1500;
const SKIP=/facade|hull|exterior|skin|sky|glass|window|haze|water/i;
const decks=layout.decks,Y0=decks[0].y,GAP=decks[1].y-Y0,DECKS=decks.length;
// The falloff is lifted so it reaches nothing at REACH: a clear cell (255) leaves the surface as it was.
const EDGE=Math.exp(-REACH/RADIUS),f=v=>v.toFixed(6);

const VERTEX=`#include <project_vertex>
 {vec4 cw=vec4(transformed,1.);
 #ifdef USE_BATCHING
  cw=batchingMatrix*cw;
 #endif
 #ifdef USE_INSTANCING
  cw=instanceMatrix*cw;
 #endif
 vCornerW=(modelMatrix*cw).xyz;}`;
const FRAGMENT=`#include <color_fragment>
 {float deck=floor((vCornerW.y-(${f(Y0)}))/${f(GAP)}+.02),h=vCornerW.y-(${f(Y0)}+deck*${f(GAP)});
 if(uCornerS>0.&&deck>=0.&&deck<${DECKS}.){
  float d=texture(uCorner,vec3((vCornerW.xz-uCornerBox.xy)/uCornerBox.zw,deck)).r*${f(REACH)};
  diffuseColor.rgb*=1.-uCornerS*max(exp(-d/${f(RADIUS)})-${f(EDGE)},0.)/${f(1-EDGE)}*exp(-max(h,0.)/${f(RADIUS)});}}`;

function arrayTexture(data,w,h,depth){
 const t=new T.DataArrayTexture(data,w,h,depth);t.format=T.RedFormat;t.type=T.UnsignedByteType;
 t.minFilter=t.magFilter=T.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;
}
const skipped=o=>{for(let p=o;p;p=p.parent)if(SKIP.test(p.name||''))return true;return false;};

// The grid: each wall line darkens the cells within R of it (255 = R or further). Self-contained, as it runs in a worker.
export function rasterWalls({segs,NX,NZ,DECKS,X0,Z0,RES,R}){
 const field=new Uint8Array(NX*NZ*DECKS).fill(255);
 for(let s=0;s<segs.length;s+=5){const d=segs[s],px=segs[s+1],pz=segs[s+2],qx=segs[s+3],qz=segs[s+4],base=d*NX*NZ;
  const x0=Math.max(0,Math.floor((Math.min(px,qx)-R-X0)/RES)),x1=Math.min(NX-1,Math.ceil((Math.max(px,qx)+R-X0)/RES));
  const z0=Math.max(0,Math.floor((Math.min(pz,qz)-R-Z0)/RES)),z1=Math.min(NZ-1,Math.ceil((Math.max(pz,qz)+R-Z0)/RES));
  const dx=qx-px,dz=qz-pz,LL=dx*dx+dz*dz||1e-9;
  for(let iz=z0;iz<=z1;iz++){const z=Z0+(iz+.5)*RES;for(let ix=x0;ix<=x1;ix++){const x=X0+(ix+.5)*RES;
   let t=((x-px)*dx+(z-pz)*dz)/LL;t=t<0?0:t>1?1:t;const ex=x-px-t*dx,ez=z-pz-t*dz,dist=Math.sqrt(ex*ex+ez*ez);
   if(dist<R){const v=Math.round(dist/R*254),k=base+iz*NX+ix;if(v<field[k])field[k]=v;}}}}
 return field;
}
const WORKER=`const rasterWalls=${rasterWalls};onmessage=({data})=>{const field=rasterWalls(data);postMessage(field,[field.buffer]);};`;
export const CORNER_DECKS={Y0,GAP,DECKS};
// The grid covers the wall lines (their bounds, from wallLines), with REACH to spare.
export function cornerGrid({x0,z0,x1,z1}){
 if(!(x1>=x0))return null;
 const m=REACH+RES,X0=Math.floor(x0-m),Z0=Math.floor(z0-m);
 return {NX:Math.ceil((x1+m-X0)/RES),NZ:Math.ceil((z1+m-Z0)/RES),DECKS,X0,Z0,RES,R:REACH};
}

// Wall lines from the walk's colliders: steep triangles at least MIN_H tall whose foot is within FLOOR_TOL of a deck
// floor, each as its longest edge seen from above, with their bounds. Scanned in slices of SLICE_MS so the walk keeps
// its frame rate.
export async function wallLines(colliders){
 let segs=new Float32Array(1<<20),n=0,due=performance.now()+SLICE_MS,x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;const a=new Float32Array(9);
 const push=(d,px,pz,qx,qz)=>{if(n+5>segs.length){const g=new Float32Array(segs.length*2);g.set(segs);segs=g;}segs[n++]=d;segs[n++]=px;segs[n++]=pz;segs[n++]=qx;segs[n++]=qz;
  x0=Math.min(x0,px,qx);x1=Math.max(x1,px,qx);z0=Math.min(z0,pz,qz);z1=Math.max(z1,pz,qz);};
 const tri=()=>{
  const ax=a[3]-a[0],ay=a[4]-a[1],az=a[5]-a[2],bx=a[6]-a[0],by=a[7]-a[1],bz=a[8]-a[2];
  const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,L=Math.hypot(nx,ny,nz);if(!(L>1e-9)||Math.abs(ny/L)>STEEP)return;
  const y0=Math.min(a[1],a[4],a[7]);if(Math.max(a[1],a[4],a[7])-y0<MIN_H)return;
  const d=Math.round((y0-Y0)/GAP);if(d<0||d>=DECKS||Math.abs(y0-(Y0+d*GAP))>FLOOR_TOL)return;
  let i=0,j=3,best=-1;for(const [p,q]of [[0,3],[0,6],[3,6]]){const e=(a[p]-a[q])**2+(a[p+2]-a[q+2])**2;if(e>best){best=e;i=p;j=q;}}
  push(d,a[i],a[i+2],a[j],a[j+2]);
 };
 const scan=async(geo,m)=>{
  const p=geo.attributes.position.array,ix=geo.index?.array,count=ix?ix.length:p.length/3,e=m?.elements;
  for(let k=0;k+2<count;k+=3){
   for(let v=0;v<3;v++){const s=(ix?ix[k+v]:k+v)*3,x=p[s],y=p[s+1],z=p[s+2],o=v*3;
    if(e){a[o]=e[0]*x+e[4]*y+e[8]*z+e[12];a[o+1]=e[1]*x+e[5]*y+e[9]*z+e[13];a[o+2]=e[2]*x+e[6]*y+e[10]*z+e[14];}else{a[o]=x;a[o+1]=y;a[o+2]=z;}}
   tri();
   if((k&2047)===0&&performance.now()>due){await new Promise(r=>setTimeout(r));due=performance.now()+SLICE_MS;}
  }
 };
 for(const band of colliders.bands.values())await scan(band.geometry,null);
 for(const g of colliders.groups)for(const it of g.items)await scan(g.bvh.geometry,it.matrix);
 // A view, not a copy: the worker takes the whole buffer.
 return {segs:segs.subarray(0,n),x0,z0,x1,z1};
}

function grid(segs,g){
 const url=URL.createObjectURL(new Blob([WORKER],{type:'text/javascript'})),worker=new Worker(url);
 return new Promise((resolve,reject)=>{worker.onmessage=e=>resolve(e.data);worker.onerror=e=>reject(Error(e.message||'corner grid worker failed'));
  worker.postMessage({segs,...g},[segs.buffer]);})
  .finally(()=>{worker.terminate();URL.revokeObjectURL(url);});
}

// Patches the lit opaque interior materials in the scene now (before the shader warm-up, so no second compile), with
// the shading off. start(colliders) then works out the grid and fades the shading in; materials added since are
// patched then too.
export function installCornerShade(scene){
 const U={uCorner:{value:arrayTexture(new Uint8Array([255]),1,1,1)},uCornerS:{value:0},uCornerBox:{value:new T.Vector4(0,0,1,1)}},done=new Map();
 // A material that any skipped (outside) mesh also uses is left alone, as the patch would reach that mesh too; one patched
 // earlier, before such a mesh came, gets its own hooks back.
 const patch=()=>{let count=0;const outside=new Set();
  scene.traverse(o=>{if(o.isMesh&&skipped(o))for(const m of [].concat(o.material))outside.add(m);});
  for(const m of outside){const was=done.get(m);if(was){[m.onBeforeCompile,m.customProgramCacheKey]=was;m.needsUpdate=true;done.delete(m);}}
  scene.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material)){
  if(!m||done.has(m)||outside.has(m)||!(m.isMeshStandardMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial)||m.transparent)continue;
  const before=m.onBeforeCompile,key=m.customProgramCacheKey;done.set(m,[before,key]);
  m.onBeforeCompile=function(s,r){before?.call(this,s,r);Object.assign(s.uniforms,U);
   s.vertexShader='varying vec3 vCornerW;\n'+s.vertexShader.replace('#include <project_vertex>',VERTEX);
   s.fragmentShader='varying vec3 vCornerW;\nuniform highp sampler2DArray uCorner;\nuniform float uCornerS;\nuniform vec4 uCornerBox;\n'+s.fragmentShader.replace('#include <color_fragment>',FRAGMENT);};
  m.customProgramCacheKey=function(){return key.call(this)+'|corner';};m.needsUpdate=true;count++;}});return count;};
 const stats={materials:patch(),walls:0,ms:0,ready:false};
 async function start(colliders){
  const t0=performance.now(),lines=await wallLines(colliders);stats.walls=lines.segs.length/5;
  const g=cornerGrid(lines);if(!g)throw Error('no wall lines');
  const old=U.uCorner.value;U.uCorner.value=arrayTexture(await grid(lines.segs,g),g.NX,g.NZ,DECKS);old.dispose();U.uCornerBox.value.set(g.X0,g.Z0,g.NX*RES,g.NZ*RES);
  stats.materials+=patch();stats.ms=Math.round(performance.now()-t0);stats.ready=true;
  const from=performance.now(),fade=()=>{const k=Math.min(1,(performance.now()-from)/FADE_MS);U.uCornerS.value=STRENGTH*k;if(k<1)requestAnimationFrame(fade);};fade();
  return stats;
 }
 return {stats,uniforms:U,start};
}
