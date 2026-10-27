import data from './placements.json' with {type:'json'};
import {toWorld,hasFrameOverride,anchorObject,anchoredDirection} from './rooms.js';
export const placementRoom=key=>data[key].room;
// Keep the original doubles on the identity path; all moved placements resolve the stored local point.
export const placed=key=>hasFrameOverride(data[key].room)?toWorld(data[key].room,data[key].local):[...data[key].v1];
export const placedV1=key=>[...data[key].v1];
export const placedFacing=(key,p)=>anchoredDirection(data[key].room,p);
export const placeObject=(root,key)=>anchorObject(root,data[key].room);
