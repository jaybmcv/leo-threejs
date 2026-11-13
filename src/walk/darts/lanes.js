import * as T from 'three';
import {roomObject} from '../../plan/rooms.js';

// Where the Recreation Hall's darts are (from tester feedback): on the long glass partition at the hall's aft end,
// behind the air hockey table, each board on a small backing so the glass stays whole. Hall frame (Area_d16-recreation-4):
// the partition's face at x=-25.95 (its collider's; the glass runs to about 3.1 m, the DARTS sign under its top rail);
// air hockey at x=-15, z=-9 (its ends at x=-16.25); the window corner at z=-17. The boards face forward (+x); the
// throwing line is the regulation 2.37 m out from the board's face.
export const ROOM='Area_d16-recreation-4',WALL=-25.95,BOARD_Y=1.73,OCHE=2.37,LANE_W=2.5,LANES=[-12.5,-9,-5.5];
export const FACE=WALL+.14,LINE=FACE+OCHE;
const REACH=1.1;

// The throwing lines in ship coordinates, and near() for the walk's E prompt. Null if the hall is missing.
export function createDartsLanes(ship){
 const room=roomObject(ship,ROOM);if(!room)return null;
 room.updateWorldMatrix(true,false);
 // Where a player stands: just behind each line, on the lane's centre.
 const spots=LANES.map(z=>room.localToWorld(new T.Vector3(LINE+.3,0,z)));
 return {spots,
  near(p){for(let i=0;i<spots.length;i++){const s=spots[i];if(Math.abs(p.y-s.y)<1.5&&Math.hypot(p.x-s.x,p.z-s.z)<REACH)return {kind:'darts',lane:i,label:'Play darts: the nine-dart challenge'};}return null;},
 };
}
