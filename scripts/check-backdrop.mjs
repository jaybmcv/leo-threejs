import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {aftScreenFlow} from '../src/space-backdrop.js';
// A viewport with no height gives the camera a NaN aspect; the speed lines must read that as no motion, not NaN.
const camera=new PerspectiveCamera(40,0/0,1,1000);camera.position.set(0,0,100);camera.updateProjectionMatrix();
const flow=aftScreenFlow(camera,new Vector3());
for(const value of Object.values(flow))assert.ok(Number.isFinite(value),JSON.stringify(flow));
console.log('PASS: speed-line flow stays finite for a zero-size viewport.');
