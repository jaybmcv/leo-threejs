import {V2_PLACES,describePlace} from '../v2/wayfinding.js';
import layout from '../plan/selected-layout.js';
import {plannedStanding} from '../v2/standing.js';
import * as T from 'three';
import {toWorld,anchoredPoint,anchoredYaw,roomAt,anyFrameOverrides} from '../plan/rooms.js';
import {DECKS,SAMPLE,ROUTE,LOUNGE_TOUR} from '../model.js';
import {SHIP_AREAS} from '../areas.js';
import {floorY} from '../transit.js';
import {CROWN,FIN_PLATFORMS} from '../fin-crown.js';
import {shapePoint} from '../concept-shape.js';
import {BODY} from './collision.js';

// Named places for the "Go to" menu and the location readout. Positions are floor points; findStand() nudges one to
// the nearest spot a 2 m walker fits.
const area=id=>SHIP_AREAS.find(a=>a.id===id);
const entry=(a,inset=6)=>[a.center[0]-a.width/2+inset,a.center[1],a.center[2]];
export const PLACES=V2_PLACES;

// Nearest point to `at` (spiralling out to 8 m, same level) where the walker stands on walkable floor.
export function findStand(colliders,at,{radius=8}={}){
 const ray=new T.Ray(),seg=new T.Line3(new T.Vector3(),new T.Vector3()),{radius:r,height:h,step}=BODY,p=new T.Vector3(...at);
 const test=(x,z)=>{ray.origin.set(x,p.y+1.6,z);ray.direction.set(0,-1,0);const hit=(colliders.raycastGround||colliders.raycast).call(colliders,ray,3.2);if(!hit||hit.normal.y<.7)return null;
  const y=hit.point.y;if(!plannedStanding(layout,x,y,z,r))return null;seg.start.set(x,y+step+r,z);seg.end.set(x,y+h-r,z);return colliders.overlaps(seg,r)?null:new T.Vector3(x,y,z);};
 for(let d=0;d<=radius;d+=.35){const n=Math.max(1,Math.round(d*2*Math.PI/.5));for(let i=0;i<n;i++){const a=i/n*Math.PI*2,q=test(p.x+Math.cos(a)*d,p.z+Math.sin(a)*d);if(q)return q;}}
 return null;
}

// "Deck 2 · Arrival hall" for a walker position.
export function describe(p){return describePlace(p); }
