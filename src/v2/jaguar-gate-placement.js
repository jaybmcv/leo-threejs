import {toWorld} from '../plan/rooms.js';
import {placed} from '../plan/placements.js';

// The head and throat share this offset from the lounge's stored entrance anchor.
export function jaguarGateOffset(){
 const origin=toWorld('commons-1',[0,0,0]),at=toWorld('commons-1',[-3.25,0,6]);
 return at.map((n,i)=>n-origin[i]);
}
export function jaguarGatePosition(){
 const at=placed('jaguar-gate'),offset=jaguarGateOffset();
 return at.map((n,i)=>n+offset[i]);
}
