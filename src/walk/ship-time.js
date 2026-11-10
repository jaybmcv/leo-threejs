// The ship's clock: everyone aboard shares one time of day, New York's, whatever the visitor's own time zone. The atrium
// light follows it (atrium-mood.js): night from 20:00 to 06:00, easing in over the half hour before 20:00 and out over
// the half hour after 06:00. A choice of Day or Night in the Graphics detail sheet holds one instead and is remembered on
// this browser; ?time=day or ?time=night picks one for this visit only (repeatable captures).
export const TIME_CHOICES=Object.freeze(['auto','day','night']);
export const SHIP_TIME_ZONE='America/New_York';
const STORAGE_KEY='leo-walk-time',listeners=new Set();
const NIGHT_FROM=20,NIGHT_TO=6,BLEND=.5; // hours
const valid=value=>TIME_CHOICES.includes(value);
const read=()=>{try{return globalThis.localStorage?.getItem(STORAGE_KEY);}catch{return null;}};
const save=value=>{try{globalThis.localStorage?.setItem(STORAGE_KEY,value);}catch{}};
const asked=(()=>{try{return new URLSearchParams(globalThis.location?.search).get('time');}catch{return null;}})();
let choice=asked==='day'||asked==='night'?asked:valid(read())?read():'auto';

const clock=new Intl.DateTimeFormat('en-US',{timeZone:SHIP_TIME_ZONE,hourCycle:'h23',hour:'numeric',minute:'numeric',second:'numeric'});
// The hour on the ship's clock, 0 to 24 with fractions.
export function shipHour(date=new Date()){
 const part={};for(const {type,value}of clock.formatToParts(date))part[type]=Number(value);
 return (part.hour%24)+part.minute/60+part.second/3600;
}
// How far into night the clock is, 0 (day) to 1 (night).
export function nightAt(hour){
 const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
 if(hour>=NIGHT_FROM||hour<NIGHT_TO)return 1;
 if(hour>=NIGHT_FROM-BLEND)return smooth((hour-(NIGHT_FROM-BLEND))/BLEND);
 if(hour<NIGHT_TO+BLEND)return 1-smooth((hour-NIGHT_TO)/BLEND);
 return 0;
}
// What the atrium should show now: the chosen time, or the ship's clock.
export function nightTarget(date=new Date()){return choice==='day'?0:choice==='night'?1:nightAt(shipHour(date));}

export function getTimeChoice(){return choice;}
export function setTimeChoice(value,{persist=true}={}){
 if(!valid(value))throw new RangeError('Unknown time of day');
 if(persist)save(value);
 if(value!==choice){choice=value;for(const listener of [...listeners])listener(choice);}
 return choice;
}
export function subscribeTime(listener){
 if(typeof listener!=='function')throw new TypeError('Time listener must be a function');
 listeners.add(listener);return()=>listeners.delete(listener);
}
