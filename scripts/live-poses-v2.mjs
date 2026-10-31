import {buildGotoPlaces} from '../src/v2/wayfinding-data.js';
import {featurePlaces} from '../src/v2/goto-features.js';
// This set is selected only by LEO_LAYOUT=2. Feet are on physical v2 floors;
// camera.position adds the 1.65 m eye height. Yaw is radians, 0=+Z, pi/2=+X.
export function livePosesV2(layout){
 const places=buildGotoPlaces(layout,featurePlaces(layout)),byId=new Map(places.map(p=>[p.id,p]));
 const pose=id=>{const p=byId.get(id);if(!p)throw Error('Missing v2 live pose '+id);return {id,feet:p.at,yaw:p.yaw,camera:{position:[p.at[0],p.at[1]+1.65,p.at[2]],yaw:p.yaw,pitch:-.12,view:'first'}};};
 const shots=['d02-arrival-1','d02-new-1','d03-new-1','d05-new-4','atrium-floor','lobby-10','d16-recreation-4','hydro-nip','telescope','commons-10-gallery-19','d20-bridge-9','selfie-camera'].map(pose);
 const near=pose('lobby-10'),far=pose('d01-spares-aft');
 return {version:2,shots,near,nearWalker:{...near,id:'near-walker',feet:[near.feet[0]+2,near.feet[1],near.feet[2]],camera:{...near.camera,position:[near.camera.position[0]+2,near.camera.position[1],near.camera.position[2]]}},far,walk:tick=>[near.feet[0]+Math.sin(tick*.2)*.6,near.feet[1],near.feet[2]+Math.cos(tick*.2)*.6]};
}
