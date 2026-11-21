import assert from 'node:assert/strict';
import * as T from 'three';
import {Colliders,solid} from '../src/walk/collision.js';

// Probe the actual landing trim, including mirrored doorways, without starting a browser.
// Canvas art is unrelated to these geometry probes; omit its painting and native font setup.
const context=new Proxy({
 createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
 createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),getImageData:()=>({}),
 measureText:s=>({width:s.length*10}),
},{get:(o,k)=>o[k]??(()=>{})});
globalThis.document={createElement:()=>({getContext:()=>context})};
const {createLifts}=await import('../src/walk/lift-ride.js'),{createLifts:authoringLifts}=await import('../src/walk/lift-ride.authoring.js');
let landings=0;
for(const create of [createLifts,authoringLifts]){
 const scene=new T.Scene(),rides=create(scene,new Colliders());scene.updateMatrixWorld(true);
 const ray=new T.Raycaster(),up=new T.Vector3(0,1,0);
 for(const l of rides.lifts){
  const mesh=l.root.getObjectByName('Lift_landing_casing'),standard=/^(forward|aft)-(port|starboard)$/.test(l.spec.id);
  assert.equal(!!mesh,standard,'Only standard passenger shafts get trim');if(!standard)continue;
  assert.equal(l.root.children.filter(o=>o.name==='Lift_landing_casing').length,1,'One draw per shaft');
  assert(!solid(mesh),'Trim must not add collision inside the doorway');
  const hits=(s,x,y,out=1)=>{
   ray.set(s.base.clone().addScaledVector(s.along,x).addScaledVector(up,y).addScaledVector(s.frontOf,out),s.frontOf.clone().negate());
   ray.far=2;return ray.intersectObject(mesh,false);
  };
  for(const s of l.stops){
   // The old jamb starts 5 cm beyond the blade edge, and the old head starts at 2.8 m.
   for(const side of [-1,1])for(const y of [.02,1.3,2.74]){
    const hit=hits(s,side*(s.width/2+.025),y)[0];assert(hit,'Side seam must be covered');
    assert(Math.abs(hit.distance-.86)<1e-4,'Trim must reach the lobby face of the surround');
   }
   for(const x of [-s.width/2,0,s.width/2])assert(hits(s,x,2.775).length,'Top seam must be covered');
   for(const x of [-s.width/2+.001,0,s.width/2-.001])for(const y of [.01,1.4,2.749]){
    assert.equal(hits(s,x,y).length,0,'Full shutter opening must stay visible');
   }
   // The return covers the full depth between the landing and the cab's door plane.
   for(const out of [-.24,0,.12]){
    ray.set(s.base.clone().addScaledVector(up,1.4).addScaledVector(s.frontOf,out),s.along.clone());ray.far=2;
    const side=ray.intersectObject(mesh,false)[0];assert(side&&Math.abs(side.distance-s.width/2)<1e-4,'Jamb return must meet the shutter edge');
   }
   landings++;
  }
 }
}
delete globalThis.document;
console.log('PASS '+landings+' passenger landings in source and authoring: side/head seams covered, full shutter aperture clear, trim has no collision.');
