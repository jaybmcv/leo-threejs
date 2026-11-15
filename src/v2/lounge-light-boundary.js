import {frame} from '../plan/rooms.js';
import {AQUARIUM as A} from '../walk/lounge-aquarium-profile.js';

const f=frame('commons-1'),c=Math.cos(f.yaw),s=Math.sin(f.yaw);
// The atrium outline steps inward here. Its usual 3.5 m balcony reach misses the
// walkway beside the tank. Carry it to the outer pane, with the same reach at both ends.
// The lounge template is centred at x 132, z 27; the tank sits 6 m along its z axis.
export function onLoungeAtriumWalkway(p){
 if(p.y<f.origin[1]-.3||p.y>f.origin[1]+A.top-A.floor)return false;
 const dx=p.x-f.origin[0],dz=p.z-f.origin[2],x=132+c*dx-s*dz,z=21+(s*dx+c*dz)*(f.mirror?-1:1);
 return x>=A.x0-3.5&&x<=A.x1+3.5&&z<=A.back&&z>=21-Math.abs(f.origin[2]);
}
