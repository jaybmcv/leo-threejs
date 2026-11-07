// The walk's look: today's, or film (Voyager's Reach's Stylised 3D, film-look.js), an opt-in preview. A choice made in
// the Graphics detail sheet is remembered on this browser; ?look=film or ?look=today picks one for this visit only.
export const LOOK_CHOICES=Object.freeze(['today','film']);
const STORAGE_KEY='leo-walk-look',listeners=new Set();
const valid=value=>LOOK_CHOICES.includes(value);
const read=()=>{try{return globalThis.localStorage?.getItem(STORAGE_KEY);}catch{return null;}};
const save=value=>{try{globalThis.localStorage?.setItem(STORAGE_KEY,value);}catch{}};
const asked=(()=>{try{return new URLSearchParams(globalThis.location?.search).get('look');}catch{return null;}})();
let look=valid(asked)?asked:valid(read())?read():'today';

export function getLook(){return look;}
export function setLook(value,{persist=true}={}){
 if(!valid(value))throw new RangeError('Unknown look');
 if(persist)save(value);
 if(value!==look){look=value;for(const listener of [...listeners])listener(look);}
 return look;
}
export function subscribeLook(listener){
 if(typeof listener!=='function')throw new TypeError('Look listener must be a function');
 listeners.add(listener);return()=>listeners.delete(listener);
}
