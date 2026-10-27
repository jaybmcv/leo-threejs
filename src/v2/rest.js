import * as T from 'three';
import layout from 'v2-layout';
import {worldPoint,patchDepth} from '../plan/hull-skin-v2.js';
import {findRestSpots as original,solidSpots,spotIndex,SPACING} from '../walk/rest.js';
import {cabinRestSpots} from './cabins.js';
export {solidSpots,spotIndex,SPACING};
export function findRestSpots(root){const spots=original(root);for(const p of layout.hullPrototypes?.prototypes||[]){if(p.kind!=='garden')continue;const v=patchDepth(p.inner,0,1.7)-1.05,at=new T.Vector3(...worldPoint(p.chart,[0,.54,v])),s=spots.find(s=>s.kind==='sit'&&!s.room&&s.point.distanceTo(at)<.03);if(s){s.room=p.id;s.id=p.id+'-hull-window-bench';s.facing=new T.Vector3(...p.chart.v);}}return [...spots,...cabinRestSpots()];}
