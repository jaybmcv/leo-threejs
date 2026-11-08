import assert from 'node:assert/strict';
const key='leo-walk-geometry-detail',checks=[],original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
let serial=0;
const fresh=()=>import('../src/v2/atrium-quality.js?fixture='+serial++);
const install=value=>Object.defineProperty(globalThis,'localStorage',{configurable:true,value});
const check=async(name,fn)=>{await fn();checks.push(name);};
try{
 await check('no browser storage defaults to balanced',async()=>{
  delete globalThis.localStorage;const q=await fresh();assert.equal(q.getAtriumQuality(),'balanced');
  assert.equal(q.setAtriumQuality('high'),'high');
 });
 await check('valid preferences restore on a new module session',async()=>{
  for(const value of ['high','balanced','performance']){install({getItem:k=>(assert.equal(k,key),value)});assert.equal((await fresh()).getAtriumQuality(),value);}
 });
 await check('invalid stored preferences are ignored',async()=>{
  for(const value of [null,'','ultra','HIGH',{},42]){install({getItem:()=>value});assert.equal((await fresh()).getAtriumQuality(),'balanced');}
 });
 await check('blocked storage access and writes preserve runtime selection',async()=>{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('blocked');}});
  let q=await fresh();assert.equal(q.getAtriumQuality(),'balanced');assert.equal(q.setAtriumQuality('performance'),'performance');
  install({getItem(){throw Error('read blocked');},setItem(){throw Error('quota');}});
  q=await fresh();assert.equal(q.setAtriumQuality('high'),'high');
 });
 await check('explicit choices persist even when matching the default',async()=>{
  const writes=[];install({getItem:()=>null,setItem:(...a)=>writes.push(a)});const q=await fresh();
  q.setAtriumQuality('balanced');q.setAtriumQuality('high');assert.deepEqual(writes,[[key,'balanced'],[key,'high']]);
 });
 await check('diagnostic overrides can avoid persistence',async()=>{
  const writes=[];install({getItem:()=>null,setItem:(...a)=>writes.push(a)});const q=await fresh();
  q.setAtriumQuality('performance',{persist:false});assert.equal(q.getAtriumQuality(),'performance');assert.deepEqual(writes,[]);
 });
 await check('listeners fire only on change and support unsubscribe',async()=>{
  install(undefined);const q=await fresh(),seen=[];const stop=q.subscribeAtriumQuality(v=>seen.push(v));
  q.setAtriumQuality('high');q.setAtriumQuality('high');q.setAtriumQuality('performance');stop();stop();q.setAtriumQuality('balanced');
  assert.deepEqual(seen,['high','performance']);assert.throws(()=>q.subscribeAtriumQuality(null),TypeError);
 });
 await check('invalid presets cannot mutate state or persistence',async()=>{
  const writes=[];install({getItem:()=>null,setItem:(...a)=>writes.push(a)});const q=await fresh();
  for(const value of [null,undefined,0,'low','__proto__',{}])assert.throws(()=>q.setAtriumQuality(value),RangeError);
  assert.equal(q.getAtriumQuality(),'balanced');assert.deepEqual(writes,[]);
  assert(Object.isFrozen(q.ATRIUM_QUALITY_PRESETS));
 });

 await check('automatic starts conservatively from device hints',async()=>{
  install(undefined);const q=await fresh();assert.equal(q.getAtriumQualitySelection(),'auto');
  for(const hints of [{cores:4},{memory:4},{coarse:true},{saveData:true}])assert.equal(q.recommendAtriumQuality(hints),'performance');
  assert.equal(q.recommendAtriumQuality({cores:16,memory:16,coarse:false,saveData:false}),'balanced');
 });
 await check('sustained load lowers auto detail and smooth windows can restore it',async()=>{
  const q=await fresh(),seen=[],a=q.createAtriumAutoController({initial:'high',onChange:v=>seen.push(v)});
  let now=0;for(;now<11000;now+=60)a.sample(60,now);assert.equal(a.level,'performance');
  for(;now<45000;now+=16.7)a.sample(16.7,now);assert.equal(a.level,'high');assert.deepEqual(seen,['performance','balanced','high']);
 });
 await check('hidden, unfocused and throttled frames cannot choose a lower level',async()=>{
  const q=await fresh(),a=q.createAtriumAutoController({initial:'high'});for(let t=0;t<60000;t+=60)a.sample(60,t,{active:false});assert.equal(a.level,'high');
  for(let t=60000;t<120000;t+=1000)a.sample(1000,t);assert.equal(a.level,'high');
 });
 await check('a higher auto default starts there unless the last auto level or a manual choice says otherwise',async()=>{
  const auto='leo-walk-auto-geometry-detail',data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};install(storage);
  let q=await fresh(),seen=[];q.subscribeAtriumQuality(v=>seen.push(v));q.setAtriumAutoDefault('high');
  assert.equal(q.getAtriumQualitySelection(),'auto');assert.equal(q.getAtriumQuality(),'high');assert.deepEqual(seen,['high']);
  for(let t=0;t<16000;t+=60)q.observeAtriumFrame(60,t);assert.equal(q.getAtriumQuality(),'performance');
  for(const [last,start] of [['balanced','balanced'],['performance','performance'],['high','high']]){
   data.set(auto,last);q=await fresh();q.setAtriumAutoDefault('high');assert.equal(q.getAtriumQuality(),start);}
  data.set(key,'balanced');q=await fresh();q.setAtriumAutoDefault('high');assert.equal(q.getAtriumQualitySelection(),'balanced');assert.equal(q.getAtriumQuality(),'balanced');
  data.delete(key);data.set(auto,'high');q=await fresh();assert.equal(q.getAtriumQuality(),'balanced');
  assert.throws(()=>q.setAtriumAutoDefault('auto'),RangeError);assert.throws(()=>q.setAtriumAutoDefault('ultra'),RangeError);
 });
 await check('manual overrides stay fixed; auto downgrade is remembered separately',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};install(storage);let q=await fresh();
  q.setAtriumQuality('high');for(let t=0;t<30000;t+=60)q.observeAtriumFrame(60,t);assert.equal(q.getAtriumQuality(),'high');
  q.setAtriumQuality('auto');for(let t=0;t<16000;t+=60)q.observeAtriumFrame(60,t);assert.equal(q.getAtriumQuality(),'performance');
  q=await fresh();assert.equal(q.getAtriumQualitySelection(),'auto');assert.equal(q.getAtriumQuality(),'performance');
  q.setAtriumQuality('balanced');q=await fresh();assert.equal(q.getAtriumQualitySelection(),'balanced');assert.equal(q.getAtriumQuality(),'balanced');
 });
 console.log(JSON.stringify({status:'PASS',checks},null,2));
}finally{
 if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;
}
