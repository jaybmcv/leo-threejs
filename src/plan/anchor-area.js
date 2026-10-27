import {anchorObject,anchoredPoint} from './rooms.js';
export function anchorArea(part,id){anchorObject(part.root,id);for(const key of ['overview','inside'])if(part[key])for(const k of ['position','target'])if(part[key][k])part[key][k]=anchoredPoint(id,part[key][k]);return part;}
