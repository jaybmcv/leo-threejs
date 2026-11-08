import assert from 'node:assert/strict';
import {Fog} from 'three';
import {DETAIL,closeHaze} from '../src/walk/detail-levels.js';
import {ATRIUM_QUALITY_PRESETS} from '../src/v2/atrium-quality.js';
import {ATRIUM_VIEW} from '../src/v2/atrium-render-policy.js';

// The Detail menu on the desktop's merged drawing (src/walk/detail-levels.js).
const checks=[],check=(name,fn)=>{fn();checks.push(name);};
const INDOOR=[70,148],at=level=>{const f=new Fog(0,ATRIUM_VIEW.fogNear,ATRIUM_VIEW.fogFar);closeHaze(f,level);return [f.near,f.far];};
check('every atrium quality preset has a level',()=>assert.deepEqual(Object.keys(DETAIL).sort(),[...ATRIUM_QUALITY_PRESETS].sort()));
check('the indoor haze is the same at every level',()=>{for(const level of ATRIUM_QUALITY_PRESETS){const f=new Fog(0,...INDOOR);closeHaze(f,level);assert.deepEqual([f.near,f.far],INDOOR,level);}});
check('High keeps the atrium clear to its far plane',()=>assert.deepEqual(at('high'),[ATRIUM_VIEW.fogNear,ATRIUM_VIEW.fogFar]));
check('Balanced closes the atrium haze inside the far plane',()=>{const [near,far]=at('balanced');assert(near<far&&far<ATRIUM_VIEW.far&&far>INDOOR[1],`${near}-${far}`);});
check('Performance brings the atrium haze to the corridors',()=>assert.deepEqual(at('performance'),INDOOR));
check('only Performance drops edge smoothing and corner shading',()=>{
 for(const level of ATRIUM_QUALITY_PRESETS){const p=level==='performance';assert.equal(DETAIL[level].antialias,!p,level);assert.equal(DETAIL[level].corner,!p,level);}});
check('a nearer haze is never pushed out',()=>{const f=new Fog(0,10,40);closeHaze(f,'balanced');assert.deepEqual([f.near,f.far],[10,40]);});
check('the levels cannot be changed',()=>{assert(Object.isFrozen(DETAIL));for(const d of Object.values(DETAIL))assert(Object.isFrozen(d));});
console.log(JSON.stringify({status:'PASS',checks},null,2));
