import * as T from 'three';
import layout from 'v2-layout';
import {plannedStanding} from './standing.js';
import {buildGotoPlaces,describeV2} from './wayfinding-data.js';
import {featurePlaces} from './goto-features.js';
import {gotoFloor} from './goto-floor.js';
export const V2_PLACES=buildGotoPlaces(layout,featurePlaces(layout));
const crownFloor=V2_PLACES.find(p=>p.id==='crown-lounge').at[1];
export const describePlace=p=>describeV2(layout,p,{crownFloor});
export function gotoStand(colliders,at){const r=gotoFloor(colliders,at,{planned:(x,y,z)=>plannedStanding(layout,x,y,z)});return r.ok?new T.Vector3(...r.at):null;}
const yarnRooms={'Voyage library':'d16-library-2','Community theater':'d16-theater-5','Communal dining':'d16-dining-7','Exercise studio':'d16-gym-3','Observation lounge':'observation-lounge','Neighborhood garden':'commons-10'};
export const yarnPlace=(places,name)=>places.find(p=>p.id===yarnRooms[name]);
