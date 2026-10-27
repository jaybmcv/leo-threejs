import {findRestSpots as original,solidSpots,spotIndex,SPACING} from '../walk/rest.js';
import {berthSpots} from './cabins.js';
export {solidSpots,spotIndex,SPACING};
export const findRestSpots=root=>[...original(root),...berthSpots()];
