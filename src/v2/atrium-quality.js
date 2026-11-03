// Browser preference only. This does not alter authored geometry or visibility.
export const ATRIUM_QUALITY_PRESETS=Object.freeze(['high','balanced','performance']);
const STORAGE_KEY='leo-walk-geometry-detail',listeners=new Set();
const valid=value=>ATRIUM_QUALITY_PRESETS.includes(value);
function readPreference(){
 try{const value=globalThis.localStorage?.getItem(STORAGE_KEY);if(valid(value))return value;}catch{}
 return 'balanced';
}
let quality=readPreference();
export function getAtriumQuality(){return quality;}
export function setAtriumQuality(value,{persist=true}={}){
 if(!valid(value))throw new RangeError('Unknown geometry detail preset');
 if(persist)try{globalThis.localStorage?.setItem(STORAGE_KEY,value);}catch{}
 if(quality!==value){quality=value;for(const listener of [...listeners])listener(value);}
 return quality;
}
export function subscribeAtriumQuality(listener){
 if(typeof listener!=='function')throw new TypeError('Geometry detail listener must be a function');
 listeners.add(listener);return()=>listeners.delete(listener);
}
