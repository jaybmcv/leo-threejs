import {TRANSIT_CORES,floorY} from '../transit.js';
import {shapePoint} from '../concept-shape.js';
import {CROWN} from '../fin-crown.js';

// Every passenger and service lift aboard, as data for walk mode and its checks. `car` is the car's plan centre and
// size, `door` the side of the car its doors face (axis and sign) and `stops` the floor heights it serves, after the
// concept shape's fin drop. The static cutaway cars and closed landing doors are replaced by moving ones (lift-ride.js).
const deckStops=(from,to)=>Array.from({length:to-from+1},(_,i)=>{const deck=from+i;return {deck,label:`Deck ${deck}`,y:floorY(deck)};});
export const LIFTS=[
 ...TRANSIT_CORES.flatMap(c=>[-1,1].map(s=>({
  id:`${c.id}-${s<0?'port':'starboard'}`,name:`${c.id==='forward'?'Forward':'Aft'} ${s<0?'port':'starboard'} lift`,
  car:{x:c.x,z:s*6,width:3.3,depth:3.3,height:2.8},door:{axis:'z',sign:-s,width:2.2},
  stops:deckStops(1,c.lastDeck),parked:c.id==='forward'?15:1,
 }))),
 {id:'aft-service',name:'Aft service lift',car:{x:-156,z:8,width:3.6,depth:3.6,height:2.7},door:{axis:'z',sign:-1,width:2.6},
  stops:deckStops(4,17),parked:8},
 {id:'crown',name:'Crown lift',car:{x:-247,z:0,width:4.2,depth:4.2,height:2.8},door:{axis:'x',sign:1,width:2.6},
  // The top platform (128 m before the fin drop) sits a metre under the crown's underfloor: no landing for anyone.
  stops:[24.3,32,48,64,80,96,112].map((y,i)=>({deck:null,label:i===0?'Upper service gallery':`Fin platform ${i}`,y:shapePoint([-247,y,0])[1]}))
   .concat([{deck:null,label:'Crown lounge',y:shapePoint([-247,CROWN.floor,0])[1],door:{axis:'z',sign:1,width:2.6}}]),
  parked:null},
];
// The cutaway model's own cars and landing doors; walk mode hides them and runs its own.
// (The polish passes dress each closed landing door with a reveal panel and a trim strip; those go too.)
export const STATIC_LIFT_PARTS=/^(Lift_car_(floor|roof|side)|Aft_lift_car_(floor|roof|side|threshold)|Crown_lift_car_floor)$|lift_landing_door|lift_door_|lift_platform_door/i;

// The car as collision triangles in its own frame (origin at the centre of its floor): floor, roof and the walls,
// open on each face in `doors` (default: the lift's own door side).
export function carTriangles(lift,doors=[lift.door]){
 const {width:w,depth:d,height:h}=lift.car,t=.08,out=[];
 const box=(x0,x1,y0,y1,z0,z1)=>{const c=(i)=>[i&4?x1:x0,i&2?y1:y0,i&1?z1:z0];
  for(const f of [[0,1,3],[0,3,2],[4,6,7],[4,7,5],[0,4,5],[0,5,1],[2,3,7],[2,7,6],[0,2,6],[0,6,4],[1,5,7],[1,7,3]])for(const i of f)out.push(...c(i));};
 box(-w/2,w/2,-.2,0,-d/2,d/2);box(-w/2,w/2,h,h+.12,-d/2,d/2);
 const sides=[['x',-1],['x',1],['z',-1],['z',1]].filter(([a,s])=>!doors.some(d=>a===d.axis&&s===d.sign));
 for(const [a,s] of sides)if(a==='x')box(s*w/2-(s>0?t:0),s*w/2+(s<0?t:0),0,h,-d/2,d/2);else box(-w/2,w/2,0,h,s*d/2-(s>0?t:0),s*d/2+(s<0?t:0));
 return out;
}
