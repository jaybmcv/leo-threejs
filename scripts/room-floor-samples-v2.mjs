import {BODY} from '../src/walk/collision.js';import {PHASE4_ROOMS} from '../src/v2/phase4-programme.js';
const fitted=new Set(PHASE4_ROOMS);
export function sampleRoomFloor(a,x,z,floorAt){if(!fitted.has(a.id))return floorAt(x,a.center[1]+.5,z,1.5,3);const y=floorAt(x,a.center[1],z);return y!==null&&Math.abs(y-a.center[1])<=BODY.step+.001?y:null;}
