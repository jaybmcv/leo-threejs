import {geometryKey,mergeKey} from './prepared-geometry-key.js';
const records=new Map();
export function RecordGeometry(site,Type,...args){const key=geometryKey(site,Type,args);const g=new Type(...args);if(!records.has(key))records.set(key,g.clone());return g;}
export function recordMerged(site,merge,geometries,groups){const key=mergeKey(site,geometries,groups),g=merge(geometries,groups);if(g&&!records.has(key))records.set(key,g.clone());return g;}
export const geometryRecords=()=>records;
