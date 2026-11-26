import {rectangle} from './geometry-v2.js';
import fitoutOverrides from './room-fitout-overrides-v2.json' with {type:'json'};

// Shared measured lounge layout. All coordinates are ship metres.
export const LOUNGE_PLAN={tank:[-140.9,-88.1,-27.98,-24.05],entryX:-112.5,doorZ:-45.8,arcadeWall:-88,arcadeStart:-43.9,arcadeGap:.8,balconyEnd:-38.75,converger:fitoutOverrides['commons-1'].converger};
export const LOUNGE_MURAL_X=-140.692;
export const LOUNGE_UPPER_CONNECTOR='commons-1-connector-8';
export function applyLoungeLandingCorner(r){
 if(r?.id!=='commons-1'||!r.components)return;
 const rear=r.components.galleries.find(g=>g.id==='commons-1-rear-4'),landing=r.components.landings.find(g=>g.id==='commons-1-stair-turn');if(!rear||!landing)return;
 const x0=Math.max(...rear.polygon.map(p=>p[0])),x1=Math.max(...landing.polygon.map(p=>p[0]));if(x1<=x0+.001)return;
 // Continue this gallery's end to the landing edge. Stair holes stay open.
 rear.polygon=rear.polygon.flatMap((a,i)=>{const b=rear.polygon[(i+1)%rear.polygon.length];return Math.abs(a[0]-x0)<.001&&Math.abs(b[0]-x0)<.001?[a,[x1,a[1]],[x1,b[1]]]:[a];});
 rear.center[0]+=(x1-x0)/2;rear.size[0]+=x1-x0;
}
export function applyLoungeBalconyCut(r){
 if(r?.id!=='commons-1'||!r.components)return;
 const g=r.components.galleries.find(g=>g.id==='commons-1-end-4');if(!g)return;
 // Keep only the gallery door's route to the maze tube, including its full floor width.
 const xs=g.polygon.map(p=>p[0]),x0=Math.min(...xs),x1=Math.max(...xs),z1=Math.max(...g.polygon.map(p=>p[1])),z0=LOUNGE_PLAN.balconyEnd;
 g.center=[(x0+x1)/2,g.center[1],(z0+z1)/2];g.size=[x1-x0,g.size[1],z1-z0];g.polygon=rectangle(g.center[0],g.center[2],g.size[0],g.size[2]);
 g.reason='Retain the dry gallery door and maze exit; remove the side walkway to the curved balcony.';
}
export function applyLoungeWalkwayExtension(r){
 if(r?.id!=='commons-1'||!r.components)return;
 const end=r.components.galleries.find(g=>g.id==='commons-1-end-8'),rear=r.components.galleries.find(g=>g.id==='commons-1-rear-8');if(!end||!rear)return;
 const x0=Math.min(...end.polygon.map(p=>p[0])),x1=Math.max(...end.polygon.map(p=>p[0])),z1=Math.max(...end.polygon.map(p=>p[1]));
 const z0=Math.min(...end.polygon.filter(p=>p[0]===x0).map(p=>p[1]));
 const join=Math.min(...rear.polygon.map(p=>p[0])),drop=Math.min(...rear.polygon.filter(p=>p[0]===join).map(p=>p[1]));
 // Fill only the gap at the aft end. The new drop edge meets the existing rear rail.
 end.polygon=[[x0,z0],[LOUNGE_MURAL_X,z0],[LOUNGE_MURAL_X,drop],[join,drop],[join,z0],[x1,z0],[x1,z1],[x0,z1]];
 end.center[2]=(drop+z1)/2;end.size[2]=z1-drop;
}
export function applyLoungeUpperConnector(r){
 if(r?.id!=='commons-1'||!r.components)return;
 const {galleries,links,stairs}=r.components;
 const rear=galleries.find(g=>g.id==='commons-1-rear-8'),link=links.find(g=>g.id==='commons-1-gallery-link-8');
 const y=link.center[1],arrival=stairs.find(t=>t.center[1]===y);
 const x1=Math.min(...link.polygon.map(p=>p[0])),x0=x1-4,radius=1.75;
 const gapZ=arrival.center[2]+arrival.size[2]/2,startZ=gapZ+3.75;
 const curve=Array.from({length:17},(_,i)=>{const angle=i*Math.PI/32;return [x0+radius-radius*Math.sin(angle),startZ-radius+radius*Math.cos(angle)];});
 // Match every vertex of the cross gallery's near edge across the opening.
 const join=[];
 for(const [i,a] of rear.polygon.entries()){
  const b=rear.polygon[(i+1)%rear.polygon.length];if(a[0]>=b[0]||b[0]<=x0||a[0]>=x1)continue;
  const x=Math.max(x0,a[0]);join.push([x,a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])]);
  if(b[0]>=x1)join.push([x1,a[1]+(b[1]-a[1])*(x1-a[0])/(b[0]-a[0])]);
 }
 const outer=[[x1,startZ],...curve,join[0]],gap=[join.at(-1),[x1,gapZ]],endZ=Math.min(...join.map(p=>p[1]));
 const connector={id:LOUNGE_UPPER_CONNECTOR,center:[(x0+x1)/2,y,(endZ+startZ)/2],size:[x1-x0,link.size[1],startZ-endZ],
  polygon:[...outer,...join.slice(1),gap[1]],guardRuns:[outer,gap],
  joins:{[link.id]:{axis:1,line:x1,range:[gapZ,startZ]},[rear.id]:{axis:0,range:[x0,x1]}}};
 const i=galleries.findIndex(g=>g.id===LOUNGE_UPPER_CONNECTOR);
 if(i<0)galleries.push(connector);else galleries[i]=connector;
}
export function applyConvergerLayout(r){
 if(!r?.components)return;
 const p=r.components.pieces.find(p=>p.name==='munchies converger'),c=LOUNGE_PLAN.converger;
 p.center=[c.center[0],r.y,c.center[2]];p.yaw=c.yaw;p.size=[5.2,p.size[1],4.42];
 p.polygon=rectangle(p.center[0],p.center[2]-.61,5.2,4.42);
 const move=r.contentContract?.pieceMoves.find(p=>p.name==='munchies converger');if(move)Object.assign(move,{center:p.center,yaw:p.yaw});
}
export function applyLoungeLayout(r){
 if(!r?.components)return;
 r.door.center[0]=LOUNGE_PLAN.entryX;
 r.fittingDoor={id:'commons-1-inner-throat',center:[LOUNGE_PLAN.entryX,r.y,-27.98],outward:[0,1],width:4,height:3.7};
 const shape=(o,x0,x1,z0,z1)=>{o.center=[(x0+x1)/2,o.center[1],(z0+z1)/2];o.size=[x1-x0,o.size[1],z1-z0];o.polygon=rectangle(o.center[0],o.center[2],o.size[0],o.size[2]);};
 // Replacement routes are defined together, before the old front galleries go.
 const gallery=r.components.galleries.find(g=>g.id==='commons-1-front-8');shape(gallery,-126,-91.5,-30,-28);gallery.reason='Room-side aquarium gallery joins the rotated maze and the retained stair link.';
 r.components.galleries=r.components.galleries.filter(g=>g.id!=='commons-1-front-4');
 shape(r.components.links.find(g=>g.id.endsWith('-4')),-91.4,-88.2,-54.5,-47.4);
 shape(r.components.links.find(g=>g.id.endsWith('-8')),-94.7,-91.5,-48.5,-28);
 r.components.mazeTubes=[{id:'commons-1-maze-front-tube',rise:4,axis:'x',z:-37.8,from:-132.75,to:-137,radius:1.35},{id:'commons-1-maze-rear-tube',rise:8,axis:'x',z:-29,from:-126.25,to:-126,radius:1.35,half:.95}];
 const head=r.components.pieces.find(p=>p.name==='jaguar gate');shape(head,-115.1,-109.9,-28.3,-24.33);
 const arcade=r.components.pieces.find(p=>p.name==='arcade row with Paws Off treadmill');shape(arcade,-91.9,-88,-43.9,-28.5);
 r.components.pieces.find(p=>p.name==='Haze Maze tower').yaw=Math.PI;
 applyConvergerLayout(r);
 applyLoungeBalconyCut(r);
 applyLoungeLandingCorner(r);
 applyLoungeWalkwayExtension(r);
 applyLoungeUpperConnector(r);
 r.aquarium={recess:4.08,canonicalX:[105.7,158.3],worldBounds:LOUNGE_PLAN.tank,reason:'Full glass length on three decks, with a dry room-side upper gallery.'};
 r.frontRecess={metres:4.08,reason:'Aligned jaguar throat through the tank at the room glass.'};
 r.contentContract.pieceMoves=r.components.pieces.map(p=>({name:p.name,center:p.center,scale:[1,1,1],...(p.yaw?{yaw:p.yaw}:{})}));
}
