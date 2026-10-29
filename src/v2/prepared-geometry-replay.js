import {preparedResource} from './prepared-resource.js';
import {geometryKey,mergeKey} from './prepared-geometry-key.js';
function take(key){const source=preparedResource.geometryTemplates.get(key);if(!source)throw Error('Prepared walk is missing a fixed geometry template: '+key.slice(0,180));const g=source.clone();g.parameters=source.parameters;return g;}
export function ReplayGeometry(site,Type,...args){return take(geometryKey(site,Type,args));}
export function replayMerged(site,ignoredMerge,geometries,groups){return take(mergeKey(site,geometries,groups));}
