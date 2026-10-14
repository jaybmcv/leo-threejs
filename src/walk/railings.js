import * as T from 'three';
import {GRID} from './partitions.js';
import {BODY} from './collision.js';
import {LIFTS} from './lifts.js';

// Short railings along every open edge where a designed floor drops away: an atrium's gallery, the forward end of a
// garden, a mezzanine, the open side of a stair. The model leaves many such edges bare, and on foot they read as empty
// space you fall through. A railing is 0.9 m: it stops a walk or a run, and Voyager's Reach's 2.2 m jump clears it, so
// the quick way down the ship is still there. Planned at build time on the partition grid, with the colliders asked
// where the floor really drops and whether something already guards the edge.
const {CELL,X0,Z0,NX,NZ}=GRID;
export const RAIL={height:.9,mid:.45,post:.045,bar:.05,spacing:1.4,drop:1};
const MIN_NY=Math.cos(BODY.maxSlope*Math.PI/180);
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];

// Rails as rows [deck, axis, a0, a1, at, y]: axis 0 runs along x at z=`at`, axis 1 along z at x=`at`, from a0 to a1,
// standing on a floor at height y.
export function planRails(decks,colliders){
 const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),seg=new T.Line3(new T.Vector3(),new T.Vector3());
 // A lift shaft is a drop only while its car is away; its doors guard it.
 const shafts=LIFTS.map(l=>({x0:l.car.x-l.car.width/2-.75,x1:l.car.x+l.car.width/2+.75,z0:l.car.z-l.car.depth/2-.75,z1:l.car.z+l.car.depth/2+.75}));
 const inShaft=(x,z)=>shafts.some(s=>x>s.x0&&x<s.x1&&z>s.z0&&z<s.z1);
 const centre=k=>[X0+(k%NX+.5)*CELL,Z0+(Math.floor(k/NX)+.5)*CELL];
 // Walkable ground within the drop below a floor at y, at (x, z)?
 const caught=(x,z,y)=>{ray.origin.set(x,y+BODY.step+.05,z);ray.direction.set(0,-1,0);const hit=colliders.raycast(ray,BODY.step+.05+RAIL.drop);return !!hit&&hit.normal.y>=MIN_NY;};
 const rows=[];
 for(const d of decks){
  // edges[axis] maps a grid line and cell along it to {y, side}: the floor's height and which side it is on.
  const edges=[new Map(),new Map()];
  for(let k=0;k<NX*NZ;k++){
   const y=d.height[k];if(!(y===y))continue;
   const i=k%NX,j=(k-i)/NX,[x,z]=centre(k);
   for(const [dx,dz] of DIRS){
    const i1=i+dx,j1=j+dz,i2=i+2*dx,j2=j+2*dz;if(i2<0||i2>=NX||j2<0||j2>=NZ)continue;
    const n=j1*NX+i1;
    // The floor goes on (or steps down less than the drop), or this is a lift's footprint.
    if(d.height[n]>y-RAIL.drop||d.designed[n]&&!(d.height[n]===d.height[n]))continue;
    const bx=x+dx*CELL,bz=z+dz*CELL;if(inShaft(bx,bz))continue;
    if(caught(bx,bz,y)||caught(bx+dx*CELL,bz+dz*CELL,y))continue;
    // Something already stands at the edge: a wall, a partition, a balustrade, glass.
    const ex=x+dx*CELL*.6,ez=z+dz*CELL*.6;seg.start.set(ex,y+.3,ez);seg.end.set(ex,y+1.1,ez);if(colliders.overlaps(seg,.14))continue;
    // Horizontal grid lines (axis 0) sit between rows j and j+1; vertical ones between columns.
    if(dz)edges[0].set((dz>0?j:j-1)*NX+i,{y,side:dz>0?-1:1});else edges[1].set((dx>0?i:i-1)*NZ+j,{y,side:dx>0?-1:1});
   }
  }
  // Merge each line's edges into runs of the same floor height and side.
  for(const axis of [0,1]){
   const lines=axis?NX:NZ,along=axis?NZ:NX,map=edges[axis];
   for(let line=0;line<lines;line++){let run=null;
    for(let a=0;a<=along;a++){const e=a<along?map.get(line*along+a):null;
     if(run&&(!e||e.side!==run.side||Math.abs(e.y-run.y)>.03)){const at=(axis?X0:Z0)+(line+1)*CELL+run.side*RAIL.bar/2,base=axis?Z0:X0;rows.push([d.number,axis,base+run.a*CELL,base+a*CELL,at,run.y].map(v=>Math.round(v*1000)/1000));run=null;}
     if(e&&!run)run={a,y:e.y,side:e.side};}}
  }
 }
 // Runs shorter than half a metre are seams, not edges.
 return rows.filter(r=>r[3]-r[2]>=.5);
}

// One merged mesh of railings: posts, a top rail and a mid rail, in the brushed steel of Leo's balustrades.
export function railingMesh(rows){
 const boxes=[];const box=(cx,cy,cz,sx,sy,sz)=>boxes.push([cx,cy,cz,sx,sy,sz]);
 for(const [,axis,a0,a1,at,y] of rows){
  const len=a1-a0,mid=(a0+a1)/2,posts=Math.max(1,Math.ceil(len/RAIL.spacing));
  const put=(a,h,s,la,ha)=>axis?box(at,h,a,s,ha,la):box(a,h,at,la,ha,s);
  put(mid,y+RAIL.height-RAIL.bar/2,RAIL.bar,len,RAIL.bar);put(mid,y+RAIL.mid,RAIL.bar*.6,len,RAIL.bar*.6);
  for(let p=0;p<=posts;p++)put(a0+Math.min(len-RAIL.post/2,Math.max(RAIL.post/2,p*len/posts)),y+RAIL.height/2,RAIL.post,RAIL.post,RAIL.height);
 }
 const group=new T.Group();group.name='Walk_railings';
 if(!boxes.length)return group;
 const unit=new T.BoxGeometry(1,1,1).toNonIndexed(),up=unit.attributes.position.array,un=unit.attributes.normal.array,per=up.length/3;
 const P=new Float32Array(boxes.length*per*3),N=new Float32Array(boxes.length*per*3);
 boxes.forEach(([cx,cy,cz,sx,sy,sz],b)=>{for(let v=0;v<per;v++){const o=(b*per+v)*3;P[o]=cx+up[v*3]*sx;P[o+1]=cy+up[v*3+1]*sy;P[o+2]=cz+up[v*3+2]*sz;N.set(un.subarray(v*3,v*3+3),o);}});
 unit.dispose();
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(P,3));geo.setAttribute('normal',new T.BufferAttribute(N,3));geo.setAttribute('uv',new T.BufferAttribute(new Float32Array(boxes.length*per*2),2));
 const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({name:'Walk_railing_steel',color:0x8d99a3,roughness:.36,metalness:.55}));mesh.name='Walk_railing';group.add(mesh);
 return group;
}
