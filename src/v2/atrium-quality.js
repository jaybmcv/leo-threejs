// A saved manual choice always wins. Automatic selection never changes visibility.
export const ATRIUM_QUALITY_PRESETS=Object.freeze(['high','balanced','performance']);
export const ATRIUM_QUALITY_CHOICES=Object.freeze(['auto',...ATRIUM_QUALITY_PRESETS]);
const STORAGE_KEY='leo-walk-geometry-detail',AUTO_KEY='leo-walk-auto-geometry-detail',listeners=new Set();
const valid=value=>ATRIUM_QUALITY_CHOICES.includes(value);
const read=key=>{try{return globalThis.localStorage?.getItem(key);}catch{return null;}};
const save=(key,value)=>{try{globalThis.localStorage?.setItem(key,value);}catch{}};
export function recommendAtriumQuality({memory=globalThis.navigator?.deviceMemory,cores=globalThis.navigator?.hardwareConcurrency,coarse=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches,saveData=globalThis.navigator?.connection?.saveData}={}){
 return (Number.isFinite(memory)&&memory>0&&memory<=4)||(Number.isFinite(cores)&&cores>0&&cores<=4)||coarse||saveData?'performance':'balanced';
}
export function createAtriumAutoController({initial='balanced',onChange=()=>{}}={}){
 let level=initial,from=null,warmUntil=null,lastChange=-Infinity,samples=[],good=0;
 const reset=()=>{from=null;samples=[];good=0;};
 return {get level(){return level;},sample(ms,now,{active=true}={}){
  if(!active||!Number.isFinite(ms)||!Number.isFinite(now)||ms<=0||ms>250){reset();warmUntil=null;return level;}
  if(warmUntil===null)warmUntil=now+4000;
  if(now<warmUntil)return level;
  if(from===null)from=now;samples.push(ms);if(now-from<6000)return level;
  const enough=samples.length>=24,median=samples.sort((a,b)=>a-b)[samples.length>>1];from=null;samples=[];
  if(!enough){good=0;return level;}
  let next=level;
  if(median>50)next='performance';
  else if(level==='high'&&median>26)next='balanced';
  else if(level==='balanced'&&median>34)next='performance';
  const smooth=level==='performance'?median<22:level==='balanced'&&median<18;
  good=smooth?good+1:0;
  if(next===level&&good>=2)next=level==='performance'?'balanced':'high';
  if(next!==level&&now-lastChange>=12000){level=next;lastChange=now;good=0;onChange(level);}
  return level;
 }};
}
const stored=read(STORAGE_KEY);let selection=valid(stored)?stored:'auto';
const automaticStart=()=>recommendAtriumQuality()==='performance'||read(AUTO_KEY)==='performance'?'performance':'balanced';
let quality=selection==='auto'?automaticStart():selection;
const notify=()=>{for(const listener of [...listeners])listener(quality);};
const makeAuto=()=>createAtriumAutoController({initial:quality,onChange(value){if(selection!=='auto')return;quality=value;save(AUTO_KEY,value);notify();}});
let automatic=makeAuto();
export function getAtriumQuality(){return quality;}
export function getAtriumQualitySelection(){return selection;}
export function setAtriumQuality(value,{persist=true}={}){
 if(!valid(value))throw new RangeError('Unknown geometry detail preset');
 if(persist)save(STORAGE_KEY,value);
 const previous=selection,previousQuality=quality;selection=value;quality=value==='auto'?automaticStart():value;automatic=makeAuto();
 if(previous!==selection||previousQuality!==quality)notify();return quality;
}
export function observeAtriumFrame(ms,now,{active=true}={}){return automatic.sample(ms,now,{active:active&&selection==='auto'});}
export function subscribeAtriumQuality(listener){
 if(typeof listener!=='function')throw new TypeError('Geometry detail listener must be a function');
 listeners.add(listener);return()=>listeners.delete(listener);
}
