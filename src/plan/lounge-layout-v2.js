import {rectangle} from './geometry-v2.js';

// Shared measured lounge layout. All coordinates are ship metres.
export const LOUNGE_PLAN={tank:[-140.9,-88.1,-27.98,-24.05],entryX:-112.5,doorZ:-45.8,arcadeWall:-88,arcadeStart:-43.9,arcadeGap:.8};
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
 r.aquarium={recess:4.08,canonicalX:[105.7,158.3],worldBounds:LOUNGE_PLAN.tank,reason:'Full glass length on three decks, with a dry room-side upper gallery.'};
 r.frontRecess={metres:4.08,reason:'Aligned jaguar throat through the tank at the room glass.'};
 r.contentContract.pieceMoves=r.components.pieces.map(p=>({name:p.name,center:p.center,scale:[1,1,1],...(p.yaw?{yaw:p.yaw}:{})}));
}
