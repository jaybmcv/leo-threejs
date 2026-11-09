import assert from 'node:assert/strict';
import * as T from 'three';
import {mergeCallLights} from '../src/walk/call-lights.js';

// The lifts' call lights (src/walk/call-lights.js), without a GPU: each deck band's lights become one mesh, every band's
// mesh draws with the same material, and lighting one light marks only its own vertices, in its own band.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
const OFF=new T.MeshStandardMaterial({name:'Lift_call_off',map:new T.Texture()}),ON=new T.MeshStandardMaterial({name:'Lift_call_on',map:new T.Texture()});
const light=(parent,x,y,lit=false)=>{const o=new T.Mesh(new T.CircleGeometry(.07,8),lit?ON:OFF);o.position.set(x,y,0);const l={lit(on){o.material=on?ON:OFF;},material:on=>on?ON:OFF};o.userData.callLight=l;parent.add(o);return l;};
const parent=new T.Group(),bands=[0,4.3,8.6],lights=bands.flatMap(y=>[light(parent,0,y+1.3),light(parent,3,y+1.3,y===4.3),light(parent,6,y+1.3)]);
const placed=[];const merged=mergeCallLights(parent,y=>bands.findLastIndex(b=>b<=y),(mesh,y)=>placed.push({mesh,y}));
assert.equal(merged,9);assert.equal(placed.length,3);assert.equal(parent.children.length,0);pass('each band\'s lights merge into one mesh, placed by band');
const [a,b,c]=placed.map(p=>p.mesh);assert(a.material===b.material&&b.material===c.material);assert.equal(a.material.name,'Walk_call_lights');pass('every band draws with one shared material');
const litOf=mesh=>Array.from(mesh.geometry.attributes.callLit.array);const count=a.geometry.attributes.position.count/3;
assert(litOf(b).slice(count,2*count).every(v=>v===1)&&litOf(b).filter(v=>v===1).length===count&&litOf(a).every(v=>v===0));pass('a light lit when merged starts lit, the others unlit');
lights[0].lit(true);assert(litOf(a).slice(0,count).every(v=>v===1)&&litOf(a).filter(v=>v===1).length===count);assert(litOf(c).every(v=>v===0));
lights[4].lit(false);assert(litOf(b).every(v=>v===0));pass('lighting or dimming a light changes only its own vertices, in its own band');
console.log(`call lights: ${checks} checks passed`);
