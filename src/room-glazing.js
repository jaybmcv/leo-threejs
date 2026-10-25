import * as T from 'three';

// Vision glazing: a band of clear glass in a room's wall where it faces the corridor that leads to it, like a lab's, so
// a walker sees into the room before reaching its door. Only the wall's make-up changes: the plan, doors and
// circulation stay as they were. Panes are solid to the walker; sill, header and piers keep the wall's line and its trim.
// A wall that backs onto a void, the hull or another wall stays solid.
export const VISION={sill:.95,head:2.45,pier:.3,pane:3,margin:1,glass:.03};
export const visionGlass=new T.MeshStandardMaterial({name:'Room_vision_glass',color:0xb9d3dc,roughness:.08,metalness:0,transparent:true,opacity:.18,depthWrite:false,side:T.DoubleSide});

// How far a service side corridor runs from the spine (service-circulation.js): past the last room on its line, or
// out to the lifeboat corridor on Decks 1-5.
export const branchExtent=(deck,x,rooms)=>deck<=5&&x>-115?56.9:Math.max(...rooms.filter(a=>a.center[0]===x).map(a=>Math.abs(a.center[2])))+2;

// The stretch of a wall running a0..a1 that has corridor beside it from c0 to c1, or null when it is too short to glaze.
export function glassSpan(a0,a1,c0,c1){const lo=Math.max(a0,c0),hi=Math.min(a1,c1);return hi-lo>=VISION.pane+2*VISION.margin?[lo,hi]:null;}
// A standard room's two entry walls (areas.js: 15 m either side of its 4 m door) face its side corridor, which runs
// -reach..reach in z. The world z span of glass in each, or null: none past the corridor's end, nor over the Deck 16
// stair lobby (the inboard 8 m of the forward rooms there).
export function entryGlass(area,reach){
 const cz=area.center[2],lobby=s=>area.deck===16&&area.center[0]===-115&&s===-Math.sign(cz)?9:17;
 return [-1,1].map(s=>glassSpan(cz+Math.max(s*9.5-7.5,-lobby(s)),cz+Math.min(s*9.5+7.5,lobby(s)),-reach,reach));
}

// The parts of a straight wall of `size` centred at `p` (its length along x or z), or null when there is no glass in it.
// `span` is the stretch along the wall, in the same frame as `p`, that faces a corridor (the whole wall when left out).
// Panes are laid out on it alone, so two walls back to back given the same span line up pane for pane.
export function glazedWallParts(size,p,span){
 const along=size[0]>size[2]?0:2,across=along?0:2,L=size[along],t=size[across],h=size[1],y0=p[1]-h/2;
 const c=p[along],[g0,g1]=span?[Math.max(span[0]-c,-L/2),Math.min(span[1]-c,L/2)]:[-L/2,L/2];
 const n=Math.floor((g1-g0-2*VISION.margin+VISION.pier)/(VISION.pane+VISION.pier));if(n<1)return null;
 const w=(g1-g0-2*VISION.margin-(n-1)*VISION.pier)/n,parts=[];
 const part=(name,a0,a1,b0,b1,thick=t)=>{if(a1-a0<1e-3)return;const s=[0,b1-b0,0],q=[...p];s[along]=a1-a0;s[across]=thick;q[along]+=(a0+a1)/2;q[1]=y0+(b0+b1)/2;parts.push({name,size:s,p:q,glass:name==='Room_glazing'});};
 part('Wall_sill',-L/2,L/2,0,VISION.sill);part('Wall_header',-L/2,L/2,VISION.head,h);
 part('Wall_pier',-L/2,g0+VISION.margin,VISION.sill,VISION.head);part('Wall_pier',g1-VISION.margin,L/2,VISION.sill,VISION.head);
 for(let i=0;i<n;i++){const a=g0+VISION.margin+i*(w+VISION.pier);part('Room_glazing',a,a+w,VISION.sill,VISION.head,VISION.glass);if(i<n-1)part('Wall_mullion',a+w,a+w+VISION.pier,VISION.sill,VISION.head);}
 return parts;
}
// A wall made through `box(name,size,p,glass)`: glazed on `span` when it has one, else the one solid box it was.
export function glazedWall(box,name,size,p,span){
 const parts=span&&glazedWallParts(size,p,span);if(!parts)return box(name,size,p,false);
 for(const q of parts)box(q.name,q.size,q.p,q.glass);
}
