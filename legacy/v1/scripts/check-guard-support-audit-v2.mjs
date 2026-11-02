import assert from 'node:assert/strict';import *as T from 'three';import {auditGuardSupport}from './guard-support-audit-v2.mjs';
const row=[19,0,0,.1666666667,0,32.3],ground={raycastGround(ray){if(Math.abs(ray.origin.z+.1)>.011)return null;return{point:new T.Vector3(ray.origin.x,32.3,ray.origin.z)};}};
assert.equal(auditGuardSupport([row],ground).length,1,'A real 22 mm floor strip between coarse lateral rays supports the guard');
assert.equal(auditGuardSupport([[...row.slice(0,5),34.3]],ground).length,0,'A guard 2 m above the floor remains rejected');
assert.equal(auditGuardSupport([row],{raycastGround:()=>null}).length,0,'A truly unsupported guard remains rejected');
assert.equal(auditGuardSupport([row],{raycastGround:ray=>({point:new T.Vector3(ray.origin.x,32.3-.23,ray.origin.z)})}).length,0,'The 22 cm vertical support limit is not widened');
console.log('PASS: dense actual-floor guard audit, narrow-strip support and floating/unsupported negatives');
