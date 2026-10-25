import * as T from 'three';
import {DECKS,SAMPLE,ROUTE,LOUNGE_TOUR} from '../model.js';
import {SHIP_AREAS} from '../areas.js';
import {floorY} from '../transit.js';
import {CROWN} from '../fin-crown.js';
import {shapePoint} from '../concept-shape.js';
import {BODY} from './collision.js';

// Named places for the "Go to" menu and the location readout. Positions are floor points; findStand() nudges one to
// the nearest spot a 2 m walker fits.
const area=id=>SHIP_AREAS.find(a=>a.id===id);
const entry=(a,inset=6)=>[a.center[0]-a.width/2+inset,a.center[1],a.center[2]];
export const PLACES=[
 {name:'Arrival hall',detail:'Deck 2 · where travellers come aboard',at:[-135,-35.7,-38],yaw:Math.PI/2},
 {name:'Your twin cabin',detail:'Deck 15 · Neighborhood 10',at:[SAMPLE.x,SAMPLE.y,SAMPLE.z-1.6],yaw:0},
 {name:'Neighborhood garden',detail:'Decks 17–19 · one of ten commons',at:[ROUTE[3].position[0],24.3,ROUTE[3].position[2]],yaw:Math.atan2(ROUTE[3].target[0]-ROUTE[3].position[0],ROUTE[3].target[2]-ROUTE[3].position[2])},
 {name:'Observation lounge',detail:'Deck 18 · Mars through the forward windows',at:[LOUNGE_TOUR[2].position[0],LOUNGE_TOUR[2].position[1]-1.6,LOUNGE_TOUR[2].position[2]],yaw:Math.PI/2},
 {name:'Crown lounge',detail:'The panoramic bar at the top of the fin',at:[-240,shapePoint([-240,CROWN.floor,0])[1],4],yaw:Math.PI/2},
 ...[['d16-arena-1','Mudwater Arena'],['d16-library-2','Voyage library'],['d16-theater-5','Community theater'],['d16-dining-7','Communal dining'],['d16-gym-3','Exercise studio'],
  ['d05-ward-1','Medical ward'],['d03-farm-1','Hydroponic garden'],['d04-control-8','Life-support control'],['d01-cargo-1','Container hold']]
  .filter(([id])=>area(id)).map(([id,name])=>{const a=area(id);return {name,detail:`Deck ${a.deck} · ${a.category}`,at:entry(a),yaw:Math.PI/2};}),
 ...SHIP_AREAS.filter(a=>/bridge/i.test(a.name)&&a.deck===20).slice(0,1).map(a=>({name:a.name,detail:'Deck 20 · Command & operations',at:[a.center[0],a.center[1],a.center[2]],yaw:Math.PI/2})),
];

// Nearest point to `at` (spiralling out to 8 m, same level) where the walker stands on walkable floor.
export function findStand(colliders,at,{radius=8}={}){
 const ray=new T.Ray(),seg=new T.Line3(new T.Vector3(),new T.Vector3()),{radius:r,height:h,step}=BODY,p=new T.Vector3(...at);
 const test=(x,z)=>{ray.origin.set(x,p.y+1.6,z);ray.direction.set(0,-1,0);const hit=colliders.raycast(ray,3.2);if(!hit||hit.normal.y<.7)return null;
  const y=hit.point.y;seg.start.set(x,y+step+r,z);seg.end.set(x,y+h-r,z);return colliders.overlaps(seg,r)?null:new T.Vector3(x,y,z);};
 for(let d=0;d<=radius;d+=.35){const n=Math.max(1,Math.round(d*2*Math.PI/.5));for(let i=0;i<n;i++){const a=i/n*Math.PI*2,q=test(p.x+Math.cos(a)*d,p.z+Math.sin(a)*d);if(q)return q;}}
 return null;
}

// "Deck 2 · Arrival hall" for a walker position.
export function describe(p){
 if(p.y>floorY(20)+8)return p.y>100?'Crown lounge':'Fin platforms';
 const deck=DECKS.reduce((best,d)=>Math.abs(floorY(d.number)-p.y)<Math.abs(floorY(best.number)-p.y)?d:best,DECKS[0]);
 const room=SHIP_AREAS.find(a=>Math.abs(a.center[1]-p.y)<2.2&&Math.abs(p.x-a.center[0])<=a.width/2&&Math.abs(p.z-a.center[2])<=a.depth/2);
 return `Deck ${deck.number} · ${room?room.name:deck.name}`;
}
