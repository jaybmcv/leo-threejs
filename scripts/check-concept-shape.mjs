import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Box3,Vector3} from 'three';
import {applyConceptShape,shapeAft,shapeView,shapeFinPoint,FIN_DROP} from '../src/concept-shape.js';
import {createAft} from '../src/aft.js';
import {FIN_TOUR} from '../src/aft-tour.js';
// The concept shape pass runs in the viewer on both the lossless and the streamed (quantized) exterior.
const out='output/leo-interior-v01/';
async function load(name){const b=await fs.readFile(out+name);const g=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh&&a?.meshes!==undefined)o.name=o.parent.name;});return g.scene.getObjectByName('01_EXTERIOR_REFINED_V31');}
const bounds=(root,test)=>{const b=new Box3();root.updateMatrixWorld(true);root.traverse(o=>{if(o.isMesh&&test(o))b.union(new Box3().setFromObject(o));});return b;};
const points=(root,test)=>{const v=new Vector3(),p=[];root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh||!test(o))return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)p.push(v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).toArray());});return p;};
const crown=o=>/^Crown_roof$/.test(o.name),hull=o=>/^Smooth_pressure_envelope_/.test(o.name)||/^Smooth_pressure_envelope_/.test(o.parent?.name),pod=o=>/^Sculpted_nacelle_shell/.test(o.name);
// The streamed copy exists once build-public has run.
const streamed=await fs.access(out+'leo-exterior-web.glb').then(()=>true,()=>false);
for(const name of ['leo-exterior-refined.glb',...(streamed?['leo-exterior-web.glb']:[])]){
 const before=await load(name),after=await load(name),t0=performance.now();applyConceptShape(after);const ms=performance.now()-t0;
 // The crown and its lounge sit FIN_DROP lower; the hull is untouched.
 const c0=bounds(before,crown),c1=bounds(after,crown);assert.ok(Math.abs(c0.max.y-c1.max.y-FIN_DROP)<.05,`${name}: crown roof moved ${c0.max.y-c1.max.y}`);
 const h0=points(before,hull),h1=points(after,hull);assert.equal(h0.length,h1.length);h0.forEach((p,i)=>assert.ok(Math.hypot(...p.map((v,k)=>v-h1[i][k]))<1e-3,`${name}: hull moved`));
 // The fin fillet reaches ~48 m ahead of the fin's edge on the hull top and stays within the fin's thickness.
 const fillet=after.getObjectByName('Fin_root_fillet');assert.ok(fillet,`${name}: fillet missing`);const f=bounds(after,o=>o===fillet);
 assert.ok(f.max.x>-140&&f.max.x<-125,`${name}: fillet reaches x ${f.max.x}`);assert.ok(f.max.z<=5.2&&f.min.z>=-5.2,`${name}: fillet much thicker than the fin`);
 // Its faces point outward (the material culls back faces): sides away from the fin's centre plane, nose forward.
 {const pos=fillet.geometry.attributes.position,nor=fillet.geometry.attributes.normal;let inward=0;for(let i=0;i<pos.count;i++){const z=pos.getZ(i);if(Math.abs(z)>.5&&Math.sign(nor.getZ(i))!==Math.sign(z))inward++;}assert.equal(inward,0,`${name}: ${inward} fillet normals face into the fin`);}
 // Pod bows curve back only below the pod interiors' floor (-19.7 m).
 const p0=points(before,pod),p1=points(after,pod);let keel=0;p0.forEach((p,i)=>{const d=Math.hypot(...p.map((v,k)=>v-p1[i][k]));if(p[1]>-20)assert.ok(d<1e-3,`${name}: pod moved above the interior floor`);if(p[1]<-33&&p[0]>-150)keel=Math.max(keel,p[0]-p1[i][0]);});
 assert.ok(keel>3.5&&keel<8,`${name}: pod keel moved back ${keel}`);
 after.traverse(o=>{if(o.isMesh)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v),`${name}: ${o.name} has a non-finite position`);});
 console.log(`${name}: shape pass ${ms.toFixed(0)} ms, crown -${(c0.max.y-c1.max.y).toFixed(2)} m, fillet to x ${f.max.x.toFixed(1)}, pod keel back ${keel.toFixed(1)} m`);
}
// The fin skin has long, non-conforming triangles; the drop must keep every straight edge straight on them or cracks open.
const saved=await load('leo-exterior-refined.glb');saved.updateMatrixWorld(true);let skin;saved.traverse(o=>{if(o.isMesh&&/^Swept_cat_tail/.test(o.name))skin=o;});
{const p=skin.geometry.attributes.position,ix=skin.geometry.index,v=new Vector3(),drop=shapeFinPoint;let worst=0;
 for(let t=0;t<ix.count;t+=3){const c=[0,1,2].map(k=>v.fromBufferAttribute(p,ix.getX(t+k)).applyMatrix4(skin.matrixWorld).toArray());const mid=[0,1,2].map(k=>(c[0][k]+c[1][k]+c[2][k])/3);
  const warped=c.map(drop),a=drop(mid),bend=Math.abs(a[1]-(warped[0][1]+warped[1][1]+warped[2][1])/3);worst=Math.max(worst,bend);}
 assert.ok(worst<.02,`fin drop bends the skin's triangles by ${worst} m`);}
// The aft interiors' crown follows, and the tour stops and their text name the lowered crown.
const aft=createAft(),r0=bounds(aft.root,crown).max.y;shapeAft(aft.root);assert.ok(Math.abs(r0-bounds(aft.root,crown).max.y-FIN_DROP)<.05,'aft crown did not follow');
const lobby=shapeView(FIN_TOUR.find(s=>s.name==='Panorama arrival lobby'));assert.equal(lobby.position[1],134-FIN_DROP);assert.match(lobby.detail,/120\.3 m/);
console.log('Concept shape verified: exterior, aft interiors and tour stops agree.');
