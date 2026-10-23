import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {serviceRoutes} from '../service-circulation.js';
import {wallKit,KIT_MATERIALS} from './wall-kit.js';

// Sci-fi trim for the service corridors (service-circulation.js) on foot: a frame every 8 m, two shallow ribs up the
// walls and a beam across the ceiling, set between the ceiling lights, and a lit cove strip where wall meets ceiling.
// Ribs and strips only where there is wall, so doors and junctions stay open; they stand 5 cm proud, inside the clear
// widths. One mesh per material per deck.
const SPACING=8,RIB=.32,DEPTH=.05,HEIGHT=3.3,BEAM=.1,COVE=.06;
const frameMaterial=new T.MeshStandardMaterial({name:'Walk_corridor_frame',color:0xbfc6c6,roughness:.55,metalness:.15});
const coveMaterial=new T.MeshStandardMaterial({name:'Walk_corridor_cove',color:0xfff1dc,emissive:0xffe8c4,emissiveIntensity:1.1,roughness:.4});
const box=(sx,sy,sz,x,y,z)=>new T.BoxGeometry(sx,sy,sz).translate(x,y,z);
// The stretches of [lo,hi] outside the gaps.
const walls=(lo,hi,gaps)=>{let p=lo;const out=[];for(const [a,b] of [...gaps].sort((a,b)=>a[0]-b[0])){if(a>p)out.push([p,Math.min(a,hi)]);p=Math.max(p,b);}if(p<hi)out.push([p,hi]);return out.filter(([a,b])=>b-a>.1);};
const onWall=(runs,t)=>runs.some(([a,b])=>t-RIB/2>a&&t+RIB/2<b);

// One corridor running along `axis` ('x' or 'z') from lo to hi, centred at `mid` across it, `width` wide, with the wall
// stretches on each side. Positions along it are `t`, across it `u`.
function corridor(frames,coves,{axis,lo,hi,mid,width,sides,start}){
 const put=(along,across,t,u,y,height)=>axis==='x'?box(along,height,across,t,y,u):box(across,height,along,u,y,t);
 for(const [s,runs] of sides){
  const u=mid+s*(width/2-DEPTH/2);
  for(const [a,b] of runs)coves.push(put(b-a,COVE,(a+b)/2,mid+s*(width/2-COVE/2),HEIGHT-BEAM-COVE/2-.02,COVE));
  for(let t=start;t<hi-RIB;t+=SPACING)if(t>lo+RIB&&onWall(runs,t))frames.push(put(RIB,DEPTH,t,u,HEIGHT/2,HEIGHT));
 }
 for(let t=start;t<hi-RIB;t+=SPACING)if(t>lo+RIB&&sides.some(([,runs])=>onWall(runs,t)))frames.push(put(RIB,width,t,mid,HEIGHT-BEAM/2,BEAM));
}
// Which corridors get the spacecraft lining (wall-kit.js), and at what level: every service corridor, spine and side
// corridors alike, gets level 2. Level 1 is for the residential corridors, which are built elsewhere.
const kitLevel=()=>2;

export function corridorTrim(parent){
 for(let deck=1;deck<=20;deck++){
  const plan=serviceRoutes(deck);if(!plan)continue;
  const {x0,x1,width}=plan.spine,frames=[],coves=[],kit={};
  // The spine's walls open to each side corridor and the lift lobbies, as in service-circulation.js.
  const spineGaps=[...plan.branches.map(b=>[b.x0,b.x1]),[136.8,146],[-137.5,-130.1],[130.1,133.9]];
  const spine={axis:'x',lo:x0,hi:x1,mid:0,width,sides:[-1,1].map(s=>[s,walls(x0,x1,spineGaps)]),start:x0+SPACING};
  corridor(frames,coves,spine);
  if(kitLevel(deck,null))wallKit(kit,{...spine,spacing:SPACING},kitLevel(deck,null));
  for(const b of plan.branches){
   const e=b.extent,w=b.x1-b.x0;
   // The aft wall opens only to the spine; the forward wall to the spine and each room's entry.
   const sides=[[-1,walls(-e,e,[[-4,4]])],[1,walls(-e,e,[[-4,4],...b.entries.map(n=>[n.z-2,n.z+2])])]];
   const branch={axis:'z',lo:-e,hi:e,mid:(b.x0+b.x1)/2,width:w,sides,start:-e+SPACING};
   corridor(frames,coves,branch);
   if(kitLevel(deck,b))wallKit(kit,{...branch,spacing:SPACING},kitLevel(deck,b));
  }
  for(const [list,material] of [[frames,frameMaterial],[coves,coveMaterial],...Object.entries(kit).map(([m,list])=>[list,KIT_MATERIALS[m]])]){
   if(!list.length)continue;
   const o=new T.Mesh(mergeGeometries(list),material);o.name=material.name;o.position.y=plan.y;o.receiveShadow=true;
   list.forEach(g=>g.dispose());parent.add(o);
  }
 }
}
