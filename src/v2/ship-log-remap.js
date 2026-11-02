import layout from '../plan/selected-layout.js';
import {CABINS} from '../plan/v1.js';
import {createLegacyCorridorRemapper,legacyFeatureSpot} from './legacy-corridors.js';
const corridors=createLegacyCorridorRemapper(layout,CABINS);
export const remapLegacyCorridor=(spot,room)=>legacyFeatureSpot(spot)||corridors.remap(spot,room);
