import {findRestSpots as original,solidSpots,spotIndex,SPACING} from '../walk/rest.js';
import {cabinRestSpots} from './cabins.js';
export {solidSpots,spotIndex,SPACING};
export const findRestSpots=root=>[...original(root),...cabinRestSpots()];
