import * as T from 'three';
import {DECKS} from '../model.js';
import {floorY} from '../transit.js';
import {LIFTS} from './lifts.js';

// Between Leo's fitted rooms and corridors each deck plate is bare: unfitted volume the cutaway views leave open. On
// foot that reads as an empty hangar with black gaps along the hull. Walk mode encloses the fitted spaces instead:
// wherever a designed floor meets bare plate, a lined partition rises to the plate above. The floors are rasterized
// per deck from their triangles (no ray casts), so the partitions follow any change to the plan. The same rasters
// place the railings (railings.js) and draw the ship map (deck-map.js).
export const GRID=(()=>{const CELL=.25,X0=-296,X1=292,Z0=-146,Z1=146;return {CELL,X0,X1,Z0,Z1,NX:Math.round((X1-X0)/CELL),NZ:Math.round((Z1-Z0)/CELL)};})();
const {CELL,X0,Z0,NX,NZ}=GRID;
export const PARTITION={height:3.68,thickness:.12,close:3};
const WALKWAY=/tread|stair|ramp|landing|step|floor|gallery|platform|bridge|walkway|threshold|dais|stage/i,ROOF=/ceiling|roof|soffit|canopy|lining/i;
// A window keeps the plate in front of it open: a partition there would stand across the glass (the bridge's sill).
const GLASS=/^LEO_glass_/,WINDOW_REACH=1.6;
const worldVisible=o=>{for(let p=o;p;p=p.parent)if(!p.visible&&!p.userData.baked)return false;return true;};

// Visit the grid cells whose centres a triangle's plan covers, with the triangle's height there.
export function raster(ax,ay,az,bx,by,bz,cx,cy,cz,visit){
 const minX=Math.max(0,Math.floor((Math.min(ax,bx,cx)-X0)/CELL)),maxX=Math.min(NX-1,Math.floor((Math.max(ax,bx,cx)-X0)/CELL));
 const minZ=Math.max(0,Math.floor((Math.min(az,bz,cz)-Z0)/CELL)),maxZ=Math.min(NZ-1,Math.floor((Math.max(az,bz,cz)-Z0)/CELL));
 const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-9)return;
 for(let j=minZ;j<=maxZ;j++){const z=Z0+(j+.5)*CELL;for(let i=minX;i<=maxX;i++){const x=X0+(i+.5)*CELL;
  const l1=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,l2=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,l3=1-l1-l2;if(l1>=-1e-6&&l2>=-1e-6&&l3>=-1e-6)visit(j*NX+i,l1*ay+l2*by+l3*cy);}}
}
// Every world-space triangle of `o` (each instance's, for an instanced mesh): each(a,b,c).
export function eachTriangle(o,each){
 const g=o.geometry,pos=g.attributes.position,idx=g.index?g.index.array:null,n=idx?idx.length:pos.count;
 const mats=o.isInstancedMesh?Array.from({length:o.count},(_,i)=>{const m=new T.Matrix4();o.getMatrixAt(i,m);return m.premultiply(o.matrixWorld);}):[o.matrixWorld];
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(const m of mats)for(let t=0;t<n;t+=3){
  a.fromBufferAttribute(pos,idx?idx[t]:t).applyMatrix4(m);b.fromBufferAttribute(pos,idx?idx[t+1]:t+1).applyMatrix4(m);c.fromBufferAttribute(pos,idx?idx[t+2]:t+2).applyMatrix4(m);
  each(a,b,c);
 }
}
const u=new T.Vector3(),w=new T.Vector3();
const upFacing=(a,b,c)=>{u.subVectors(b,a);w.subVectors(c,a);const cross=u.cross(w),len=cross.length();return len>1e-9&&Math.abs(cross.y)/len>=.9;};

// Each deck's plan on the grid: `designed` floor (with its height in `height`), bare `plate`, and cells near a
// `window`. One pass over the interior; shared by the partitions, the railings and the map.
export function rasterDecks(ship){
 ship.root.updateMatrixWorld(true);
 const decks=DECKS.map(d=>({number:d.number,y:floorY(d.number),designed:new Uint8Array(NX*NZ),plate:new Uint8Array(NX*NZ),window:new Uint8Array(NX*NZ),height:new Float32Array(NX*NZ).fill(NaN)}));
 // Floors at deck level count, and so do the raised walking surfaces above it (stair treads, landings, ramps), so a
 // flight that starts on an uncut plate (Deck 1) is not walled off.
 const deckAt=(y,raised)=>{for(const d of decks)if(y>d.y-.12&&y<d.y+(raised?2.2:.16))return d;return null;};
 ship.inside.traverse(o=>{
  if(!o.isMesh||!worldVisible(o)||!o.geometry?.attributes?.position)return;
  // The tops of ceilings and roofs that reach a deck's level (the ramped promenade's roof shows on Deck 18) count as
  // bare plate, so the designed floors beside them get a wall rather than a way onto them.
  const roof=ROOF.test(o.name),plate=o.name==='Deck_slab'||roof,raised=roof||!plate&&WALKWAY.test(o.name);
  eachTriangle(o,(a,b,c)=>{if(!upFacing(a,b,c))return;const d=deckAt((a.y+b.y+c.y)/3,raised);if(!d||!(raised||Math.abs(a.y-c.y)<.05&&Math.abs(a.y-b.y)<.05))return;
   if(plate)raster(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,k=>{d.plate[k]=1;});
   else raster(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,(k,y)=>{d.designed[k]=1;if(!(d.height[k]>=y))d.height[k]=y;});});
 });
 // A lift car's footprint is floor at every stop (some plates, like Deck 17's under the crown lift, are not cut for it).
 for(const lift of LIFTS)for(const stop of lift.stops){const d=deckAt(stop.y,false);if(!d)continue;const c=lift.car,x0=c.x-c.width/2,x1=c.x+c.width/2,z0=c.z-c.depth/2,z1=c.z+c.depth/2;
  const mark=k=>{d.designed[k]=1;};raster(x0,0,z0,x1,0,z0,x1,0,z1,mark);raster(x0,0,z0,x1,0,z1,x0,0,z1,mark);}
 // Glass reaching into a deck's height marks the plate within reach of it.
 for(const root of [ship.inside,ship.exterior])root?.traverse(o=>{
  if(!o.isMesh||!o.geometry?.attributes?.position||![].concat(o.material).some(m=>GLASS.test(m.name||'')))return;
  eachTriangle(o,(a,b,c)=>{const lo=Math.min(a.y,b.y,c.y),hi=Math.max(a.y,b.y,c.y);
   for(const d of decks){if(hi<d.y+.3||lo>d.y+PARTITION.height)continue;
    const i0=Math.max(0,Math.floor((Math.min(a.x,b.x,c.x)-WINDOW_REACH-X0)/CELL)),i1=Math.min(NX-1,Math.floor((Math.max(a.x,b.x,c.x)+WINDOW_REACH-X0)/CELL));
    const j0=Math.max(0,Math.floor((Math.min(a.z,b.z,c.z)-WINDOW_REACH-Z0)/CELL)),j1=Math.min(NZ-1,Math.floor((Math.max(a.z,b.z,c.z)+WINDOW_REACH-Z0)/CELL));
    for(let j=j0;j<=j1;j++)d.window.fill(1,j*NX+i0,j*NX+i1+1);}});
 });
 for(const d of decks)d.closed=close(d.designed,PARTITION.close);
 return decks;
}

// Returns wall boxes [{deck,x0,x1,z0,z1,y0,y1}] for every deck. A room that stays open above its floor (a garden's
// three-deck atrium) keeps its partition rising through each deck it is open on, up to the plate that closes it.
export function planPartitions(ship,decks=rasterDecks(ship)){
 const walls=[];
 decks.forEach((d,n)=>{
  const des=d.closed,bare=i=>d.plate[i]&&!des[i],open=(a,b)=>d.window[a]||d.window[b];
  // How many decks above this one the room inside (cell a) stays open with nothing built beside it (cell b), up to a
  // plate or floor that closes it; open to the top of the ship, it is outside the hull and the wall stays one deck.
  const rise=(a,b)=>{for(let m=n+1;m<decks.length;m++){const e=decks[m];if(e.closed[b])return m-n-1;if(e.closed[a]||e.plate[a])return m-n-1;}return 0;};
  // The top of a wall along an edge between grid cells k and q, or 0 when there is no wall there.
  const top=(k,q)=>{if(open(k,q))return 0;const a=des[k]&&bare(q)?k:bare(k)&&des[q]?q:-1;if(a<0)return 0;return decks[n+rise(a,a===k?q:k)].y+PARTITION.height;};
  // Edges between a designed cell and a bare plate cell, merged into runs of one height along each grid line.
  for(let j=0;j+1<NZ;j++){let run=-1,y1=0;for(let i=0;i<=NX;i++){const k=j*NX+i,h=i<NX?top(k,k+NX):0;
   if(run>=0&&h!==y1){const z=Z0+(j+1)*CELL;walls.push({deck:d.number,x0:X0+run*CELL,x1:X0+i*CELL,z0:z-PARTITION.thickness/2,z1:z+PARTITION.thickness/2,y0:d.y,y1});run=-1;}
   if(h&&run<0){run=i;y1=h;}}}
  for(let i=0;i+1<NX;i++){let run=-1,y1=0;for(let j=0;j<=NZ;j++){const k=j*NX+i,h=j<NZ?top(k,k+1):0;
   if(run>=0&&h!==y1){const x=X0+(i+1)*CELL;walls.push({deck:d.number,x0:x-PARTITION.thickness/2,x1:x+PARTITION.thickness/2,z0:Z0+run*CELL,z1:Z0+j*CELL,y0:d.y,y1});run=-1;}
   if(h&&run<0){run=j;y1=h;}}}
 });
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
