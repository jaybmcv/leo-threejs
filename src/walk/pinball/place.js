import {toWorld} from '../../plan/rooms.js';

// Where Leo Pinball stands (machine.js), for the page and for Leo live (server/pinball.mjs): against the Deck 16
// Recreation Hall's end wall, in the hall's frame. The end wall's face at x=wall, the machine on the centre line z.
export const PINBALL={room:'d16-recreation-4',wall:25.84,z:0,length:1.36};
// Where a player stands to play: in front of the lockdown bar, on the hall's floor; and that spot in ship coordinates.
export const PINBALL_SPOT=[PINBALL.wall-.02-PINBALL.length-.4,0,PINBALL.z];
export const pinballSpot=()=>toWorld(PINBALL.room,PINBALL_SPOT);
