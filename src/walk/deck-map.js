import * as T from 'three';
import {GRID,eachTriangle} from './partitions.js';
import {LIFTS} from './lifts.js';

// The ship map: each deck as a 0.5 m plan, worked out at build time from the partition grid (the floors) and the
// interior's walls, then saved as one image, a deck to a band (scripts/walk-plan.mjs). Pixel values are classes, which
// the page colours (minimap.js).
export const MAP={cell:.5,x0:GRID.X0,z0:GRID.Z0,nx:Math.round((GRID.X1-GRID.X0)/.5),nz:Math.round((GRID.Z1-GRID.Z0)/.5)};
export const MAP_CLASS={empty:0,floor:1,raised:2,wall:3,rail:4,lift:5};
const worldVisible=o=>{for(let p=o;p;p=p.parent)if(!p.visible&&!p.userData.baked)return false;return true;};
// A wall on the map stands at least this tall within a deck's walking height; furniture lower than it stays off.
const WALL_SPAN=1.1;

export function planMap(ship,decks,rails){
 const {cell,x0,z0,nx,nz}=MAP,{CELL,NX,NZ}=GRID,ratio=Math.round(cell/CELL);
 const out=decks.map(d=>({number:d.number,y:d.y,data:new Uint8Array(nx*nz)}));
 const at=(x,z)=>{const i=Math.floor((x-x0)/cell),j=Math.floor((z-z0)/cell);return i>=0&&i<nx&&j>=0&&j<nz?j*nx+i:-1;};
 // Floors: a map cell is floor when any of its grid cells is (raised when it stands above the deck, like a stair).
 decks.forEach((d,n)=>{const data=out[n].data;
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){const k=j*NX+i;if(!d.closed[k])continue;const m=Math.floor(j/ratio)*nx+Math.floor(i/ratio);
   const raised=d.height[k]>d.y+.3;if(data[m]<MAP_CLASS.floor||raised&&data[m]===MAP_CLASS.floor)data[m]=raised?MAP_CLASS.raised:MAP_CLASS.floor;}});
 // Walls: the plan line of every steep triangle that spans a wall's height at a deck's walking level.
 const line=(data,a,b)=>{const len=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(len/(cell*.5)));
  for(let s=0;s<=steps;s++){const t=s/steps,k=at(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);if(k>=0)data[k]=MAP_CLASS.wall;}};
 const nrm=new T.Vector3(),e1=new T.Vector3(),e2=new T.Vector3();
 ship.inside.traverse(o=>{
  if(!o.isMesh||!worldVisible(o)||!o.geometry?.attributes?.position)return;
  eachTriangle(o,(a,b,c)=>{
   nrm.crossVectors(e1.subVectors(b,a),e2.subVectors(c,a));const len=nrm.length();if(len<1e-9||Math.abs(nrm.y)/len>.3)return;
   const lo=Math.min(a.y,b.y,c.y),hi=Math.max(a.y,b.y,c.y);if(hi-lo<WALL_SPAN)return;
   for(const [n,d] of decks.entries()){if(hi<d.y+1.4||lo>d.y+.6)continue;const data=out[n].data;line(data,a,b);line(data,b,c);line(data,c,a);}
  });
 });
 for(const [deck,axis,a0,a1,pos] of rails){const d=out.find(o=>o.number===deck);if(!d)continue;
  for(let a=a0;a<=a1;a+=cell*.5){const k=axis?at(pos,a):at(a,pos);if(k>=0)d.data[k]=MAP_CLASS.rail;}}
 // Lift cars, at every deck they stop at.
 for(const lift of LIFTS)for(const stop of lift.stops){const d=out.find(o=>Math.abs(o.y-stop.y)<.3);if(!d)continue;const c=lift.car;
  for(let x=c.x-c.width/2+cell/2;x<c.x+c.width/2;x+=cell)for(let z=c.z-c.depth/2+cell/2;z<c.z+c.depth/2;z+=cell){const k=at(x,z);if(k>=0)d.data[k]=MAP_CLASS.lift;}}
 return out;
}
