import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {serviceRoutes} from '../service-circulation.js';
import {DECKS,CABINS} from '../model.js';
import {floorY} from '../transit.js';
import {wallKit,homeKit,KIT_MATERIALS} from './wall-kit.js';
import {PAINTINGS,FRAME,hangSize} from './paintings.js';

// Sci-fi trim for the service corridors (service-circulation.js) on foot: a frame every 8 m, two shallow ribs up the
// walls and a beam across the ceiling, set between the ceiling lights, and a lit cove strip where wall meets ceiling, with
// teal light lines under the coves and the beams.
// Ribs and strips only where there is wall, so doors and junctions stay open; they stand 5 cm proud, inside the clear
// widths. One mesh per material per deck.
const SPACING=8,RIB=.32,DEPTH=.05,HEIGHT=3.3,BEAM=.1,COVE=.06;
const frameMaterial=new T.MeshStandardMaterial({name:'Walk_corridor_frame',color:0xbfc6c6,roughness:.55,metalness:.15});
const coveMaterial=new T.MeshStandardMaterial({name:'Walk_corridor_cove',color:0xeef8ff,emissive:0xdff2ff,emissiveIntensity:1.2,roughness:.4});
// A teal light line under each cove strip and along the underside of each ceiling beam.
const accentMaterial=new T.MeshBasicMaterial({name:'Walk_corridor_accent',color:0x2fd6c5,toneMapped:false});
const ACCENT=.02;
const box=(sx,sy,sz,x,y,z)=>new T.BoxGeometry(sx,sy,sz).translate(x,y,z);
// The stretches of [lo,hi] outside the gaps.
const walls=(lo,hi,gaps)=>{let p=lo;const out=[];for(const [a,b] of [...gaps].sort((a,b)=>a[0]-b[0])){if(a>p)out.push([p,Math.min(a,hi)]);p=Math.max(p,b);}if(p<hi)out.push([p,hi]);return out.filter(([a,b])=>b-a>.1);};
const onWall=(runs,t)=>runs.some(([a,b])=>t-RIB/2>a&&t+RIB/2<b);

// One corridor running along `axis` ('x' or 'z') from lo to hi, centred at `mid` across it, `width` wide, with the wall
// stretches on each side. Positions along it are `t`, across it `u`.
function corridor(frames,coves,accents,{axis,lo,hi,mid,width,sides,start}){
 const put=(along,across,t,u,y,height)=>axis==='x'?box(along,height,across,t,y,u):box(across,height,along,u,y,t);
 for(const [s,runs] of sides){
  const u=mid+s*(width/2-DEPTH/2);
  for(const [a,b] of runs){coves.push(put(b-a,COVE,(a+b)/2,mid+s*(width/2-COVE/2),HEIGHT-BEAM-COVE/2-.02,COVE));
   accents.push(put(b-a,ACCENT,(a+b)/2,mid+s*(width/2-ACCENT/2),HEIGHT-BEAM-COVE-.02-.05,ACCENT));}
  for(let t=start;t<hi-RIB;t+=SPACING)if(t>lo+RIB&&onWall(runs,t))frames.push(put(RIB,DEPTH,t,u,HEIGHT/2,HEIGHT));
 }
 for(let t=start;t<hi-RIB;t+=SPACING)if(t>lo+RIB&&sides.some(([,runs])=>onWall(runs,t))){frames.push(put(RIB,width,t,mid,HEIGHT-BEAM/2,BEAM));
  accents.push(put(.04,width-2*DEPTH,t,mid,HEIGHT-BEAM-.006,.012));}
}
// The spacecraft lining (wall-kit.js): level 2 in every service corridor, spine and side corridors alike; level 1 along
// the residential lanes, between the cabin doors.
const SERVICE_LEVEL=2,LANE_WIDTH=4;
// The wall behind a painting (paintings.js) stays bare, so no rail, pipe or hatch stands out through it: the spans along
// a corridor's side wall at `u` across it, on the deck whose floor is at y.
function hung(axis,u,y){
 return PAINTINGS.filter(p=>Math.abs(p.wall[axis==='z'?0:2]-u)<.1&&Math.abs(p.floor-y)<1).map(p=>{
  const t=p.wall[axis==='z'?2:0],half=hangSize(p)[0]/2+FRAME.width+.03;return [t-half,t+half];});
}
const bare=({axis,mid,width,sides},y)=>sides.map(([s,runs])=>{const gaps=hung(axis,mid+s*width/2,y);return [s,gaps.length?runs.flatMap(([a,b])=>walls(a,b,gaps)):runs];});

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
  const {x0,x1,width}=plan.spine,frames=[],coves=[],accents=[],kit={};
  // The spine's walls open to each side corridor and the lift lobbies, as in service-circulation.js.
  const spineGaps=[...plan.branches.map(b=>[b.x0,b.x1]),[136.8,146],[-137.5,-130.1],[130.1,133.9]];
  const spine={axis:'x',lo:x0,hi:x1,mid:0,width,sides:[-1,1].map(s=>[s,walls(x0,x1,spineGaps)]),start:x0+SPACING};
  corridor(frames,coves,accents,spine);wallKit(kit,{...spine,sides:bare(spine,plan.y),spacing:SPACING},SERVICE_LEVEL);
  for(const b of plan.branches){
   const e=b.extent,w=b.x1-b.x0;
   // The aft wall opens only to the spine; the forward wall to the spine, each room's entry and its vision glass.
   const sides=[[-1,walls(-e,e,[[-4,4]])],[1,walls(-e,e,[[-4,4],...b.entries.flatMap(n=>[[n.z-2,n.z+2],...n.glass])])]];
   const branch={axis:'z',lo:-e,hi:e,mid:(b.x0+b.x1)/2,width:w,sides,start:-e+SPACING};
   corridor(frames,coves,accents,branch);wallKit(kit,{...branch,sides:bare(branch,plan.y),spacing:SPACING},SERVICE_LEVEL);
  }
  draw([[frames,frameMaterial],[coves,coveMaterial],[accents,accentMaterial],...kitLists(kit)],plan.y);
 }
}
