import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {serviceRoutes} from '../service-circulation.js';
import {DECKS,CABINS} from '../model.js';
import {floorY} from '../transit.js';
import {wallKit,homeKit,KIT_MATERIALS} from './wall-kit.js';

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
// The spacecraft lining (wall-kit.js): level 2 in every service corridor, spine and side corridors alike; level 1 along
// the residential lanes, between the cabin doors.
const SERVICE_LEVEL=2,LANE_WIDTH=4;

// A residential deck's lanes (model.js: five lanes 26 m apart, cabins 5.2 m off each lane's centre with their doors on
// it), as homeKit wants them: each side's runs of touching cabins, broken at the cross corridors.
function lanes(deck){
 const cabins=CABINS.filter(c=>c.deck===deck),out=[];
 for(let lane=0;lane<5;lane++){
  const mid=(lane-2)*26,fronts=[];
  for(const s of [-1,1]){
   const row=cabins.filter(c=>Math.abs(c.z-(mid+s*5.2))<.1).sort((a,b)=>a.x-b.x),runs=[];
   for(const c of row){const h=c.width/2,cabin=[c.x-h,c.x+h,c.x-.7,c.x+.7],run=runs.at(-1);
    if(run&&cabin[0]-run.at(-1)[1]<.5)run.push(cabin);else runs.push([cabin]);}
   fronts.push([s,runs]);
  }
  out.push({mid,width:LANE_WIDTH,fronts});
 }
 return out;
}

export function corridorTrim(parent){
 const draw=(lists,y)=>{for(const [list,material] of lists){
  if(!list.length)continue;
  const o=new T.Mesh(mergeGeometries(list),material);o.name=material.name;o.position.y=y;o.receiveShadow=true;
  list.forEach(g=>g.dispose());parent.add(o);
 }};
 const kitLists=kit=>Object.entries(kit).map(([m,list])=>[list,KIT_MATERIALS[m]]);
 for(let deck=1;deck<=20;deck++){
  if(DECKS[deck-1].residential){const kit={};for(const lane of lanes(deck))homeKit(kit,lane);draw(kitLists(kit),floorY(deck));continue;}
  const plan=serviceRoutes(deck);if(!plan)continue;
  const {x0,x1,width}=plan.spine,frames=[],coves=[],kit={};
  // The spine's walls open to each side corridor and the lift lobbies, as in service-circulation.js.
  const spineGaps=[...plan.branches.map(b=>[b.x0,b.x1]),[136.8,146],[-137.5,-130.1],[130.1,133.9]];
  const spine={axis:'x',lo:x0,hi:x1,mid:0,width,sides:[-1,1].map(s=>[s,walls(x0,x1,spineGaps)]),start:x0+SPACING};
  corridor(frames,coves,spine);wallKit(kit,{...spine,spacing:SPACING},SERVICE_LEVEL);
  for(const b of plan.branches){
   const e=b.extent,w=b.x1-b.x0;
   // The aft wall opens only to the spine; the forward wall to the spine and each room's entry.
   const sides=[[-1,walls(-e,e,[[-4,4]])],[1,walls(-e,e,[[-4,4],...b.entries.map(n=>[n.z-2,n.z+2])])]];
   const branch={axis:'z',lo:-e,hi:e,mid:(b.x0+b.x1)/2,width:w,sides,start:-e+SPACING};
   corridor(frames,coves,branch);wallKit(kit,{...branch,spacing:SPACING},SERVICE_LEVEL);
  }
  draw([[frames,frameMaterial],[coves,coveMaterial],...kitLists(kit)],plan.y);
 }
}
