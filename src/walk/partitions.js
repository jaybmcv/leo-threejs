import * as T from 'three';
import {DECKS} from '../model.js';
import {floorY} from '../transit.js';
import {LIFTS} from './lifts.js';

// Between Leo's fitted rooms and corridors each deck plate is bare: unfitted volume the cutaway views leave open. On
// foot that reads as an empty hangar with black gaps along the hull. Walk mode encloses the fitted spaces instead:
// wherever a designed floor meets bare plate, a lined partition rises to the plate above. The floors are rasterized
// per deck from their triangles (no ray casts), so the partitions follow any change to the plan.
const CELL=.25,X0=-286,X1=290,Z0=-112,Z1=112,NX=Math.round((X1-X0)/CELL),NZ=Math.round((Z1-Z0)/CELL);
export const PARTITION={height:3.68,thickness:.12,close:3};
const WALKWAY=/tread|stair|ramp|landing|step|floor|gallery|platform|bridge|walkway|threshold|dais|stage/i,ROOF=/ceiling|roof|soffit|canopy|lining/i;
const worldVisible=o=>{for(let p=o;p;p=p.parent)if(!p.visible&&!p.userData.baked)return false;return true;};

// Mark the grid cells whose centres a triangle's plan covers.
function raster(grid,ax,az,bx,bz,cx,cz){
 const minX=Math.max(0,Math.floor((Math.min(ax,bx,cx)-X0)/CELL)),maxX=Math.min(NX-1,Math.floor((Math.max(ax,bx,cx)-X0)/CELL));
 const minZ=Math.max(0,Math.floor((Math.min(az,bz,cz)-Z0)/CELL)),maxZ=Math.min(NZ-1,Math.floor((Math.max(az,bz,cz)-Z0)/CELL));
 const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)return;
 for(let j=minZ;j<=maxZ;j++){const z=Z0+(j+.5)*CELL;for(let i=minX;i<=maxX;i++){const x=X0+(i+.5)*CELL;
  const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d;if(l1>=-1e-6&&l2>=-1e-6&&l1+l2<=1+1e-6)grid[j*NX+i]=1;}}
}
// Up-facing triangles of `o` (or each instance) lying within `band` of a deck's floor level go into that deck's grid.
function floorTriangles(o,each){
 const g=o.geometry,pos=g.attributes.position,idx=g.index?g.index.array:null,n=idx?idx.length:pos.count;
 const mats=o.isInstancedMesh?Array.from({length:o.count},(_,i)=>{const m=new T.Matrix4();o.getMatrixAt(i,m);return m.premultiply(o.matrixWorld);}):[o.matrixWorld];
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),u=new T.Vector3(),w=new T.Vector3();
 for(const m of mats)for(let t=0;t<n;t+=3){
  a.fromBufferAttribute(pos,idx?idx[t]:t).applyMatrix4(m);b.fromBufferAttribute(pos,idx?idx[t+1]:t+1).applyMatrix4(m);c.fromBufferAttribute(pos,idx?idx[t+2]:t+2).applyMatrix4(m);
  u.subVectors(b,a);w.subVectors(c,a);const cross=u.cross(w),len=cross.length();if(len<1e-9||Math.abs(cross.y)/len<.9)continue;
  each(a,b,c);
 }
}

// Returns wall boxes [{x0,x1,z0,z1,y0,y1}] for every deck.
export function planPartitions(ship){
 ship.root.updateMatrixWorld(true);
 const decks=DECKS.map(d=>({number:d.number,y:floorY(d.number),designed:new Uint8Array(NX*NZ),plate:new Uint8Array(NX*NZ)}));
 // Floors at deck level count, and so do the raised walking surfaces above it (stair treads, landings, ramps), so a
 // flight that starts on an uncut plate (Deck 1) is not walled off.
 const deckAt=(y,raised)=>{for(const d of decks)if(y>d.y-.12&&y<d.y+(raised?2.2:.16))return d;return null;};
 ship.inside.traverse(o=>{
  if(!o.isMesh||!worldVisible(o)||!o.geometry?.attributes?.position)return;
  // The tops of ceilings and roofs that reach a deck's level (the ramped promenade's roof shows on Deck 18) count as
  // bare plate, so the designed floors beside them get a wall rather than a way onto them.
  const roof=ROOF.test(o.name),plate=o.name==='Deck_slab'||roof,raised=roof||!plate&&WALKWAY.test(o.name);
  floorTriangles(o,(a,b,c)=>{const d=deckAt((a.y+b.y+c.y)/3,raised);if(d&&(raised||Math.abs(a.y-c.y)<.05&&Math.abs(a.y-b.y)<.05))raster(plate?d.plate:d.designed,a.x,a.z,b.x,b.z,c.x,c.z);});
 });
 // A lift car's footprint is floor at every stop (some plates, like Deck 17's under the crown lift, are not cut for it).
 for(const lift of LIFTS)for(const stop of lift.stops){const d=deckAt(stop.y,false);if(!d)continue;const c=lift.car,x0=c.x-c.width/2,x1=c.x+c.width/2,z0=c.z-c.depth/2,z1=c.z+c.depth/2;
  raster(d.designed,x0,z0,x1,z0,x1,z1);raster(d.designed,x0,z0,x1,z1,x0,z1);}
 const walls=[];
 for(const d of decks){
  const des=close(d.designed,PARTITION.close),bare=i=>d.plate[i]&&!des[i];
  // Edges between a designed cell and a bare plate cell, merged into runs along each grid line.
  for(let j=0;j<NZ;j++){let run=-1;for(let i=0;i<=NX;i++){const k=j*NX+i,edge=i<NX&&j+1<NZ&&((des[k]&&bare(k+NX))||(bare(k)&&des[k+NX]));
   if(edge&&run<0)run=i;if(!edge&&run>=0){const z=Z0+(j+1)*CELL;walls.push({deck:d.number,x0:X0+run*CELL,x1:X0+i*CELL,z0:z-PARTITION.thickness/2,z1:z+PARTITION.thickness/2,y0:d.y,y1:d.y+PARTITION.height});run=-1;}}}
  for(let i=0;i<NX;i++){let run=-1;for(let j=0;j<=NZ;j++){const k=j*NX+i,edge=j<NZ&&i+1<NX&&((des[k]&&bare(k+1))||(bare(k)&&des[k+1]));
   if(edge&&run<0)run=j;if(!edge&&run>=0){const x=X0+(i+1)*CELL;walls.push({deck:d.number,x0:x-PARTITION.thickness/2,x1:x+PARTITION.thickness/2,z0:Z0+run*CELL,z1:Z0+j*CELL,y0:d.y,y1:d.y+PARTITION.height});run=-1;}}}
 }
 return walls;
}
// Morphological closing (dilate then erode by r cells, square window): seams and thresholds between neighbouring
// floors count as floor. Separable running counts keep it linear in the grid size.
function sweep(src,r,want){
 // want 'any' (dilate) or 'all' (erode); rows then columns. Off-grid counts as empty.
 const tmp=new Uint8Array(src.length),out=new Uint8Array(src.length),w=2*r+1;
 for(let j=0;j<NZ;j++){let c=0;for(let i=-r;i<NX+r;i++){const add=i+r,rem=i-r-1;if(add<NX&&add>=0)c+=src[j*NX+add];if(rem>=0&&rem<NX)c-=src[j*NX+rem];if(i>=0&&i<NX)tmp[j*NX+i]=want==='any'?(c>0?1:0):(c===w?1:0);}}
 for(let i=0;i<NX;i++){let c=0;for(let j=-r;j<NZ+r;j++){const add=j+r,rem=j-r-1;if(add<NZ&&add>=0)c+=tmp[add*NX+i];if(rem>=0&&rem<NZ)c-=tmp[rem*NX+i];if(j>=0&&j<NZ)out[j*NX+i]=want==='any'?(c>0?1:0):(c===w?1:0);}}
 return out;
}
function close(grid,r){const out=sweep(sweep(grid,r,'any'),r,'all');for(let k=0;k<grid.length;k++)out[k]|=grid[k];return out;}

// One merged mesh of lined partitions (a skirting stripe in the Leo wayfinding amber at the foot).
export function partitionMesh(walls){
 const geos=[];
 for(const w of walls){const g=new T.BoxGeometry(w.x1-w.x0,w.y1-w.y0,w.z1-w.z0);g.translate((w.x0+w.x1)/2,(w.y0+w.y1)/2,(w.z0+w.z1)/2);geos.push(g.toNonIndexed());}
 const group=new T.Group();group.name='Walk_partitions';
 if(!geos.length)return group;
 const size=geos.reduce((n,g)=>n+g.attributes.position.count,0),P=new Float32Array(size*3),N=new Float32Array(size*3);let o=0;
 for(const g of geos){P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count;g.dispose();}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(P,3));geo.setAttribute('normal',new T.BufferAttribute(N,3));geo.setAttribute('uv',new T.BufferAttribute(new Float32Array(size*2),2));
 const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({name:'Walk_partition_lining',color:0xd8dcd5,roughness:.82,metalness:.04}));mesh.name='Partition_wall';group.add(mesh);
 return group;
}
