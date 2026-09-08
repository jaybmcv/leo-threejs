import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createFinCrown,CROWN} from '../src/fin-crown.js';
import profile from '../src/assets/fin-cap-closure.json' with {type:'json'};
import {surfaceIndex} from '../src/exterior-finish.js';
const out='output/leo-interior-v01/';
async function load(file){const b=await fs.readFile(out+file),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;});g.scene.updateMatrixWorld(true);return g.scene;}
const original=await load('leo-exterior.glb'),top=surfaceIndex([original.getObjectByName('Swept_tail_cap')],'y');
for(const [x,y,z]of profile)assert.ok(Math.abs(y-(Math.min(top(x,z),CROWN.floor-.55)-.06))<.0001,'Closure must meet the measured original cap');
function check(root){root.updateMatrixWorld(true);const skirt=root.getObjectByName('Crown_underfloor_closure');assert.ok(skirt?.isMesh);assert.ok(!skirt.material.transparent&&skirt.material.color.r>.5);const b=new T.Box3().setFromObject(skirt);assert.ok(b.max.y<CROWN.floor-.49,'Closure must stay below the occupied floor');let rays=0;const ray=new T.Raycaster();
 for(let i=0;i<profile.length;i++){const a=profile[i],b=profile[(i+1)%profile.length],x=(a[0]+b[0])/2,z=(a[2]+b[2])/2,low=(a[1]+b[1])/2,normal=new T.Vector3(b[2]-a[2],0,a[0]-b[0]).normalize();for(const t of [.1,.5,.9]){const y=low+(CROWN.floor-.51-low)*t,center=new T.Vector3(x,y,z);ray.set(center.clone().addScaledVector(normal,1),normal.clone().negate());ray.far=1.02;assert.ok(ray.intersectObject(skirt,false).length,'Unclosed perimeter at '+center.toArray());rays++;}}
 assert.ok(root.getObjectByName('Fin_cap_retained_white_underside'));return rays;
}
const reports=[{model:'factory',rays:check(createFinCrown().root)}];
if(!process.argv.includes('--source-only'))for(const file of ['leo-exterior-refined.glb','leo-aft-systems.glb','leo-full-ship.glb'])reports.push({model:file,rays:check(await load(file))});
console.log({status:'PASS',profileSamples:profile.length,reports});
if(!process.argv.includes('--source-only'))await fs.writeFile(out+'crown-closure-check.json',JSON.stringify({status:'PASS',profileSamples:profile.length,reports},null,2));
