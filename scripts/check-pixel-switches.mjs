// Per-pixel A/B switches and their line in the Stats readout (src/walk/pixel-switches.js).
import assert from 'node:assert/strict';
import {deskAntialias,heldRes,pixelLine} from '../src/walk/pixel-switches.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const q=s=>new URLSearchParams(s),RES=['High','Med','Low'];

assert.equal(deskAntialias(q(''),true),true);assert.equal(deskAntialias(q(''),false),false);assert.equal(deskAntialias(q('fps=1'),true),true);
assert.equal(deskAntialias(undefined,false),false);pass('without ?deskaa= multisampling is what the Detail level chose');
assert.equal(deskAntialias(q('deskaa=0'),true),false);assert.equal(deskAntialias(q('deskaa=1'),false),true);
assert.equal(deskAntialias(q('deskaa=0'),false),false);assert.equal(deskAntialias(q('deskaa=1'),true),true);pass('?deskaa=0 and ?deskaa=1 set it whatever the Detail level chose');
for(const bad of ['deskaa=','deskaa=off','deskaa=2','deskaa=true','phoneaa=0']){assert.equal(deskAntialias(q(bad),true),true,bad);assert.equal(deskAntialias(q(bad),false),false,bad);}
pass('anything else, and the phone switch, leave it alone');

assert.equal(heldRes(q('res=high'),RES),'High');assert.equal(heldRes(q('res=med'),RES),'Med');assert.equal(heldRes(q('res=low'),RES),'Low');
assert.equal(heldRes(q('res=LOW'),RES),'Low');assert.equal(heldRes(q('fps=1&res=Med&deskaa=0'),RES),'Med');assert.equal(heldRes(q('res=medium'),RES),'Med');
pass('?res=high, med (or medium) and low name the Res button\'s levels, in any case');
for(const bad of ['','res=','res=0.5','res=ultra','res=lowest','resolution=low'])assert.equal(heldRes(q(bad),RES),null,bad);
assert.equal(heldRes(undefined,RES),null);pass('no level asked, or one the button does not have, holds nothing');
// What the walk does with it: a held level is where the saved one would be, so the walk starts there and never steps down.
const start=(query,saved)=>{const level=heldRes(q(query),RES)??saved;return {res:Math.max(0,RES.indexOf(level)),chosen:level!==null};};
assert.deepEqual(start('res=low',null),{res:2,chosen:true});assert.deepEqual(start('res=high','Low'),{res:0,chosen:true});
assert.deepEqual(start('','Med'),{res:1,chosen:true});assert.deepEqual(start('',null),{res:0,chosen:false});assert.deepEqual(start('res=ultra',null),{res:0,chosen:false});
pass('a held level beats the saved one and counts as chosen, so slow frames never step it down');

assert.equal(pixelLine({samples:4,logDepth:true}),'msaa ×4   log depth');assert.equal(pixelLine({samples:8,logDepth:false}),'msaa ×8   linear depth');
assert.equal(pixelLine({samples:0,logDepth:true}),'msaa off   log depth');assert.equal(pixelLine({samples:1,logDepth:false}),'msaa off   linear depth');
assert.equal(pixelLine({samples:null,logDepth:false}),'msaa off   linear depth');assert.equal(pixelLine(),'msaa off   linear depth');
pass('the Stats line says the samples the context really got and which depth it draws with');
console.log(`pixel switches: ${passed} checks passed`);
