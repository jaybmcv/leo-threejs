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
 console.log(JSON.stringify({status:'PASS',checks},null,2));
}finally{
 if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;
}
