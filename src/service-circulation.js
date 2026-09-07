import * as T from 'three';
import {SHIP_AREAS} from './areas.js';

// Corridors join each room's aft entry to the longitudinal spine and both lift locations.
export function serviceRoutes(deck){
  const rooms=SHIP_AREAS.filter(a=>a.deck===deck&&!a.special);
  if(!rooms.length)return null;
  return {deck,y:rooms[0].center[1],spine:{x0:-148,x1:138,width:8},
    branches:[...new Set(rooms.map(a=>a.center[0]))].map(x=>({x0:x-33,x1:x-26,
      extent:deck<=5&&x>-115?56.9:Math.max(...rooms.filter(a=>a.center[0]===x).map(a=>Math.abs(a.center[2])))+2,
      joinsLifeboats:deck<=5&&x>-115,
      entries:rooms.filter(a=>a.center[0]===x).map(a=>({id:a.id,z:a.center[2],width:4}))})),
    connections:rooms.map(a=>({id:a.id,points:[[-132,0],[a.center[0]-29.5,0],[a.center[0]-29.5,a.center[2]],[a.center[0]-26,a.center[2]]]}))};
}

export function createServiceCirculation(deck){
  const plan=serviceRoutes(deck);if(!plan)return null;
  const root=new T.Group();root.name=`Deck_${deck}_connected_service_corridors`;root.position.y=plan.y;
  root.userData={deck,clearSpineWidth:8,clearBranchWidth:7,roomConnections:plan.connections,stage:'Concept circulation'};
  const shell=new T.Group();shell.name='Corridor_walls_and_ceiling';root.add(shell);
  const floor=new T.MeshStandardMaterial({color:0xc5baa4,roughness:.85}),lining=new T.MeshStandardMaterial({color:0xd9ddd6,roughness:.8}),
    light=new T.MeshStandardMaterial({color:0xffedcd,emissive:0xffe4b6,emissiveIntensity:.6}),edge=new T.MeshStandardMaterial({color:0x8d6a38,roughness:.8});
  function box(name,s,p,m=lining,parent=root){const o=new T.Mesh(new T.BoxGeometry(...s),m);o.name=name;o.position.set(...p);o.receiveShadow=true;o.castShadow=true;parent.add(o);return o;}
  const intervals=(lo,hi,gaps)=>{let p=lo;const result=[];for(const [a,b]of gaps.sort((a,b)=>a[0]-b[0])){if(a>p)result.push([p,Math.min(a,hi)]);p=Math.max(p,b);}if(p<hi)result.push([p,hi]);return result.filter(([a,b])=>b>a);};
  const {x0,x1,width}=plan.spine;
  box('Spine_floor',[x1-x0,.25,width],[(x0+x1)/2,-.125,0],floor);
  box('Spine_ceiling',[x1-x0,.14,width],[(x0+x1)/2,3.37,0],lining,shell);
  for(const side of [-1,1])for(const [a,b]of intervals(x0,x1,[...plan.branches.map(b=>[b.x0,b.x1]),[136.8,146],[-137.5,-130.1],[130.1,133.9]])){
    box('Spine_wall',[b-a,3.3,.16],[(a+b)/2,1.65,side*(width/2+.08)],lining,shell);
    box('Spine_wayfinding_edge',[b-a,.02,.08],[(a+b)/2,.015,side*3.85],edge);
  }
  for(let x=x0+4;x<x1;x+=8)box('Spine_light',[3,.04,.25],[x,3.25,0],light,shell);
  for(const branch of plan.branches){
    const bx=(branch.x0+branch.x1)/2,w=branch.x1-branch.x0,e=branch.extent;
    // Split at the spine so coplanar floors and ceilings never overlap.
    for(const s of [-1,1]){
      box('Branch_floor',[w,.25,e-4],[bx,-.125,s*(e+4)/2],floor);
      box('Branch_ceiling',[w,.14,e-4],[bx,3.37,s*(e+4)/2],lining,shell);
      if(!branch.joinsLifeboats)box('Branch_end_wall',[w,3.3,.16],[bx,1.65,s*(e+.08)],lining,shell);
    }
    for(const side of [-1,1]){
      const gaps=[[-4,4],...(side===1?branch.entries.map(e=>[e.z-2,e.z+2]):[])];
      for(const [a,b]of intervals(-e,e,gaps))box('Branch_wall',[.16,3.3,b-a],[side<0?branch.x0-.08:branch.x1+.08,1.65,(a+b)/2],lining,shell);
    }
    for(const entry of branch.entries){
      box('Room_entry_threshold',[w,.025,4],[bx,.015,entry.z],floor);
      box('Room_entry_header',[.16,.5,4],[branch.x1,3.05,entry.z],lining,shell);
    }
    for(let z=-e+4;z<e;z+=8)if(Math.abs(z)>4)box('Branch_light',[.25,.04,3],[bx,3.25,z],light,shell);
  }
  return {root,shell,plan};
}
