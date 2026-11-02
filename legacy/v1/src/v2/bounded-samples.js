// Offline memoization only: eviction changes reuse, never the sampled value.
export const SAMPLE_CACHE_LIMIT=65536;
export function rememberSample(cache,key,value,limit=SAMPLE_CACHE_LIMIT){if(cache.size>=limit&&!cache.has(key))cache.clear();cache.set(key,value);return value;}
export function releaseEnvelopeProfiles(layout){let count=0;for(const p of layout.hullPrototypes?.prototypes||[]){count++;for(const key of Object.keys(p))if(Array.isArray(p[key])&&!['polygon','rect'].includes(key))p[key]=[];}if(layout.hullPrototypes)layout.hullPrototypes.prototypes=[];for(const c of [...layout.cabins,...layout.rooms])delete c.hullPrototype;layout.windows=[];return count;}
