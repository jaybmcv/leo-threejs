import * as T from 'three';

// Vision glazing: a band of clear glass in a room's corridor walls, like a lab's, so the decks read as open, lived-in
// spaces instead of closed boxes. Only the wall's make-up changes: the plan, doors and circulation stay as they were.
// Panes are solid to the walker; sill, header and piers keep the wall's line and its trim.
export const VISION={sill:.95,head:2.45,pier:.3,pane:3,margin:1,glass:.03};
export const visionGlass=new T.MeshStandardMaterial({name:'Room_vision_glass',color:0xb9d3dc,roughness:.08,metalness:0,transparent:true,opacity:.18,depthWrite:false,side:T.DoubleSide});

// The parts of a straight wall of `size` centred at `p` (its length along x or z), or null when it is too short to glaze.
export function glazedWallParts(size,p){
 const along=size[0]>size[2]?0:2,across=along?0:2,L=size[along],t=size[across],h=size[1],y0=p[1]-h/2;
 const n=Math.floor((L-2*VISION.margin+VISION.pier)/(VISION.pane+VISION.pier));if(n<1)return null;
 const w=(L-2*VISION.margin-(n-1)*VISION.pier)/n,parts=[];
 const part=(name,a0,a1,b0,b1,thick=t)=>{const s=[0,b1-b0,0],q=[...p];s[along]=a1-a0;s[across]=thick;q[along]+=(a0+a1)/2;q[1]=y0+(b0+b1)/2;parts.push({name,size:s,p:q,glass:name==='Room_glazing'});};
 part('Wall_sill',-L/2,L/2,0,VISION.sill);part('Wall_header',-L/2,L/2,VISION.head,h);
 for(const s of [-1,1])part('Wall_pier',s<0?-L/2:L/2-VISION.margin,s<0?-L/2+VISION.margin:L/2,VISION.sill,VISION.head);
 for(let i=0;i<n;i++){const a=-L/2+VISION.margin+i*(w+VISION.pier);part('Room_glazing',a,a+w,VISION.sill,VISION.head,VISION.glass);if(i<n-1)part('Wall_mullion',a+w,a+w+VISION.pier,VISION.sill,VISION.head);}
 return parts;
}
