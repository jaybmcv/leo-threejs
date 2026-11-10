import * as T from 'three';
import layout from '../plan/selected-layout.js';
import {contains} from '../plan/geometry-v2.js';
import {anchoredPoint,toLocal} from '../plan/rooms.js';
import {LIFTS} from './lifts.js';
import {VAULT_PLAN,VAULT_LIFT} from './vault.js';
import {MAZE_ROOM,inMaze} from './maze/layout.js';
import {panelInside,panelDoor} from './net/panel-rules.js';
import {swimLocal,inWater} from './aquarium-treasure/layout.js';

// Where the walk may put a visitor down without their walking in: a public area. Not public, each always by its own
// way in (a password, a puzzle, a game) or never open to visitors at all:
//   crew         the Deck 20 crew service gallery and the closed crew rooms (the layout's access 'crew' and closed rooms,
//                the ones Go to leaves out);
//   clubhouse    the password clubhouse behind the Deck 17 arcade, its vault door and its own tube lift and landings
//                (vault.js, vault-lift.js);
//   lever-panel  Deck 4's tank bay behind the lever panel, and its doorway (net/panel-rules.js);
//   maze         inside the Container Maze (maze/layout.js); the space in front of it, by the doorway, is public;
//   aquarium     the lounge aquarium's water, the treasure swim (aquarium-treasure/layout.js);
//   lift         a lift shaft, where a car may be moving (lifts.js): a landing in front of it is public.
// Areas from the layout are read from it, so a moved room moves its rule with it. restrictedAt(p) names the area a
// ship point (feet, ship metres) is in ('invalid' for one that is not a point), or null where it is public. Used to put
// a visitor back where they were after a reload (main.js, last-spot.js), always behind the walk's own landing checks
// (publicStand below).

// A prism: a floor polygon [[x,z]...] and the heights [y0,y1] it covers, in ship metres.
const prism=(name,poly,y0,y1)=>({name,poly,y:[y0,y1]});
const deckY=n=>layout.decks.find(d=>d.number===n)?.y;
// A rectangle in a lift's own frame (x along the ship, z across), as ship points through commons-1's frame.
const vaultRect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>{const p=anchoredPoint('commons-1',[VAULT_LIFT.x+x,VAULT_LIFT.y,VAULT_LIFT.z+z]);return [p[0],p[2]];});
export function restrictedZones(){
 const zones=[];
 for(const b of layout.circulation.bridges||[])if(b.access==='crew'){const y=deckY(b.deck);if(Number.isFinite(y))zones.push(prism('crew',b.polygon,y-.5,y+3.5));}
 for(const r of [...layout.rooms,...(layout.fixedRooms||[])])if(!r.aggregate&&(r.closed||r.access==='crew')&&r.polygon)zones.push(prism('crew',r.polygon,r.y-.5,r.y+r.height));
 // The clubhouse between its walls on Deck 17, 0.3 m wider each way than the walls' lines.
 const [a,b]=VAULT_PLAN.lines,floor=deckY(VAULT_PLAN.deck),xs=[a[0].x,a[1].x,b[0].x,b[1].x],zs=[a[0].z,a[1].z,b[0].z,b[1].z];
 const x0=Math.min(...xs)-.3,x1=Math.max(...xs)+.3,z0=Math.min(...zs)-.3,z1=Math.max(...zs)+.3;
 zones.push(prism('clubhouse',[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],floor-.5,floor+3.5));
 // Its tube lift (radius 1.7) from Deck 17 up, and on the upper stops its landings and their connections
 // (vault-lift.js, v2/clubhouse-access.js): the car, the glass landing to 3.7 m and the opening to 4 m aside.
 const stops=VAULT_LIFT.stops,top=stops.at(-1).y+3.5;
 zones.push(prism('clubhouse',vaultRect(-2,2,-2,2),stops[0].y-.5,top));
 if(stops.length>1)zones.push(prism('clubhouse',vaultRect(-4.2,2,-2,3.9),stops[1].y-.5,top));
 // Lift shafts, a car's footprint and a little more, from the lowest stop to above the highest.
 for(const l of LIFTS){const c=l.car,ys=l.stops.map(s=>s.y),hx=c.width/2+.2,hz=c.depth/2+.2;
  zones.push(prism('lift',[[c.x-hx,c.z-hz],[c.x+hx,c.z-hz],[c.x+hx,c.z+hz],[c.x-hx,c.z+hz]],Math.min(...ys)-.5,Math.max(...ys)+3.5));}
 return zones;
}
export const ZONES=restrictedZones();
export function restrictedAt(p,zones=ZONES){
 const at=Array.isArray(p)?p:[p.x,p.y,p.z];if(!at.every(Number.isFinite))return 'invalid';
 const [x,y,z]=at;
 for(const o of zones)if(y>=o.y[0]&&y<o.y[1]&&contains(o.poly,[x,z]))return o.name;
 if(panelInside(at)||panelDoor(at))return 'lever-panel';
 const m=toLocal(MAZE_ROOM,at);if(inMaze(m[0],m[1],m[2]))return 'maze';
 if(inWater(swimLocal(at)))return 'aquarium';
 return null;
}

// The nearest public spot to `at` (ship metres, a public spot itself) that passes the walk's own landing checks:
// findStand's floor and walker capsule (places.js, as walk links use) and Go to's whole-footprint floor
// (v2/wayfinding.js gotoStand). It looks on rings out to `radius` as findStand does, from `away` metres out (beside
// someone, not in them), and only where a walker at `at` could see it at chest height, so never through a wall or over
// a railing into the room beside. stand(at) is findStand(colliders, at, {radius:0}); check(at) is gotoStand(colliders,
// at). Null when `at` is not public or nothing near passes.
export function publicStand(at,{colliders,stand,check,radius=3,away=0,zones=ZONES}){
 if(!Array.isArray(at)||at.length!==3||!at.every(Number.isFinite)||restrictedAt(at,zones))return null;
 const eye=at[1]+1,from=new T.Vector3(at[0],eye,at[2]),to=new T.Vector3(),sight=new T.Ray();
 const seen=q=>{to.set(q.x,q.y+1,q.z);const d=from.distanceTo(to);if(d<.05)return true;sight.set(from,to.clone().sub(from).normalize());return !colliders.raycast(sight,d);};
 for(let d=away;d<=radius;d+=.35){const n=Math.max(1,Math.round(d*2*Math.PI/.5));
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,q=stand([at[0]+Math.cos(a)*d,at[1],at[2]+Math.sin(a)*d]);
   if(q&&!restrictedAt(q,zones)&&seen(q)&&check([q.x,q.y,q.z]))return q;}}
 return null;
}
