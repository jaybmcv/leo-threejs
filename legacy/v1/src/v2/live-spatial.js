// Spatial authority uses the very same transformed source modules as the v2 walk.
import {frame,toWorld,toLocal,anchoredPoint,LAYOUT_VERSION} from '../plan/rooms.js';
import {LIFTS} from '../walk/lifts.js';
import {SWIM,swimWorld,swimLocal,limitSwim,gemNear,distance} from '../walk/aquarium-treasure/layout.js';
import {AQUARIUM} from '../walk/lounge-aquarium.js';
import {MAZE_ROOM,MAZE_START,MAZE_BUTTON,MAZE_FASTEST_S} from '../walk/maze/layout.js';
import {arcadeTreadmill,liveArcadeStations} from '../walk/arcade.js';
import {homes} from '../walk/transporter.js';
import {BALL} from '../walk/hamster-ball.js';
import {GYM_TREADMILL as GYM,ACTIVITY_FLOOR,treadmillNear} from './activity-layout.js';
import {TABLE} from '../walk/pool/rules.js';
import {LIVE_IDENTITY} from 'v2-live-identity';
const mill=arcadeTreadmill(),arcade=liveArcadeStations();
const gymSpecs=GYM.xs.map(x=>{const centre=toWorld('d16-gym-3',[x,GYM.centerY+GYM.size[1]/2,GYM.z]),ahead=toWorld('d16-gym-3',[x,GYM.centerY+GYM.size[1]/2,GYM.z-1]);return {centre,front:ahead.map((n,i)=>n-centre[i]),top:centre[1],length:GYM.size[2],width:GYM.size[0]};});gymSpecs.push({centre:mill.centre.toArray(),front:mill.front.toArray(),top:mill.top,length:mill.length,width:mill.width});
export const spatial={version:LAYOUT_VERSION,identity:LIVE_IDENTITY,lifts:LIFTS,
 maze:{start:toWorld(MAZE_ROOM,MAZE_START),button:toWorld(MAZE_ROOM,MAZE_BUTTON),fastest:MAZE_FASTEST_S},
 aquarium:{bounds:AQUARIUM,swim:SWIM,door:swimWorld(SWIM.door),entry:swimWorld(SWIM.entry),chest:swimWorld(SWIM.chest),gems:SWIM.gems.map(swimWorld)},
 arcade,gymSpecs,treadmills:[...GYM.xs.map(x=>toWorld('d16-gym-3',[x,GYM.centerY+GYM.size[1]/2,GYM.z+GYM.size[2]*.08])),mill.centre.clone().addScaledVector(mill.front,-mill.length*.08).toArray()],
 telescope:anchoredPoint('observation-lounge',[203,26.3,0]),pool:toWorld('d16-recreation-4',[ACTIVITY_FLOOR.center[0],ACTIVITY_FLOOR.center[1]+ACTIVITY_FLOOR.size[1]/2,ACTIVITY_FLOOR.center[2]]),
 selfie:[-265.3,120.3,0],transporters:homes(),ball:BALL.home,
 frames:Object.fromEntries(['commons-1','commons-10','d01-cargo-1','d01-workshop-5','d16-gym-3','d16-recreation-4','observation-lounge'].map(id=>[id,frame(id)]))};
export {SWIM,swimWorld,swimLocal,limitSwim,gemNear,distance};
export const near=(p,q,r,dy=2)=>!!p&&Math.abs(p[1]-q[1])<dy&&Math.hypot(p[0]-q[0],p[2]-q[2])<r;
const poolNear=p=>{if(!p)return false;const q=toLocal('d16-recreation-4',p);return Math.abs(q[1]-ACTIVITY_FLOOR.center[1]-ACTIVITY_FLOOR.size[1]/2)<1.5&&Math.hypot(Math.max(0,Math.abs(q[0])-TABLE.w/2-TABLE.rail),Math.max(0,Math.abs(q[2])-TABLE.h/2-TABLE.rail))<1.4;};
export const policy={version:2,identity:LIVE_IDENTITY,
 canPlay:(game,p)=>game==='pool'?poolNear(p)||near(p,arcade.pool,2):near(p,spatial.telescope,3)||near(p,arcade.invasion,2),
 canGym:p=>!!p&&gymSpecs.some(t=>treadmillNear(p,t)),
 canCall:(p,l,stop)=>{const c=l.car;return !!p&&Math.hypot(p[0]-c.x,p[2]-c.z)<Math.hypot(c.width,c.depth)/2+3&&p[1]>=Math.min(...l.stops.map(s=>s.y))-3&&p[1]<=Math.max(...l.stops.map(s=>s.y))+3;}};
