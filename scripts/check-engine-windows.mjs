import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Vector3} from 'three';
import {surfaceIndex} from '../src/exterior-finish.js';
import {CENTRAL_ENGINE_WINDOWS,POD_ENGINE_WINDOWS} from '../src/engine-window-plan.js';
const out='output/leo-interior-v01/';
async function load(file){const b=await fs.readFile(out+file),g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh)o.name=o.parent.name;});g.scene.updateMatrixWorld(true);return g.scene;}
const source=await load('leo-exterior.glb'),exterior=await load('leo-exterior-refined.glb'),aft=await load('leo-aft-systems.glb');
function meshes(root,name){const m=[];root.traverse(o=>{if(o.isMesh&&o.name===name)m.push(o);});return m;}
const podSource=meshes(source,'Sculpted_nacelle_shell'),pods=meshes(exterior,'Sculpted_nacelle_shell');
const oldOuter=surfaceIndex(podSource,'z'),newOuter=surfaceIndex(pods,'z'),oldInner=surfaceIndex(podSource,'z','min'),newInner=surfaceIndex(pods,'z','min');
let apertureSamples=0,retainedSamples=0;
for(const r of POD_ENGINE_WINDOWS)for(const [u,v]of [[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]]){const x=r.x0+(r.x1-r.x0)*u,y=r.y0+(r.y1-r.y0)*v;assert.ok(Number.isFinite(oldOuter(x,y)));assert.ok(!Number.isFinite(newOuter(x,y))&&!Number.isFinite(newInner(x,y)),'Pod hull still blocks opening');apertureSamples++;}
for(let x=-274;x<-174;x+=.8)for(let y=-22;y<12;y+=.6){if(POD_ENGINE_WINDOWS.some(r=>x>=r.x0-.001&&x<=r.x1+.001&&y>=r.y0-.001&&y<=r.y1+.001))continue;for(const [a,b]of [[oldOuter,newOuter],[oldInner,newInner]]){const v=a(x,y);if(Number.isFinite(v)){assert.ok(Math.abs(v-b(x,y))<.001,'Pod shape moved outside window');retainedSamples++;}}}
let interiorSamples=0;
for(const [name,plan]of [['Machinery_side_enclosure',CENTRAL_ENGINE_WINDOWS],['Pod_side_panel',POD_ENGINE_WINDOWS]]){const wall=surfaceIndex(meshes(aft,name),'z');for(const r of plan){assert.ok(Math.abs(r.y0-r.floor-1.25)<1e-6);for(const [u,v]of [[.5,.5],[.2,.2],[.8,.8]]){assert.ok(!Number.isFinite(wall(r.x0+(r.x1-r.x0)*u,r.y0+(r.y1-r.y0)*v)),name+' blocks window');interiorSamples++;}}}
const panes=[];aft.traverse(o=>{if(o.userData.directionalGlazing)panes.push(o);});assert.equal(panes.filter(o=>o.name==='Central_engine_inner_glazing').length,16);assert.equal(panes.filter(o=>o.name==='Pod_engine_inner_glazing').length,36);
for(const n of ['Central_engine_inner_glazing','Pod_engine_inner_glazing'])for(const m of meshes(aft,n))assert.ok(m.material.transparent&&m.material.opacity<1);
// Exhausts are a separate protected shape: compare every vertex, not just bounds.
let exhaustVertices=0;const v=new Vector3(),w=new Vector3();
for(const name of ['Engine_bell','Engine_nozzle_lip','Engine_throat','Nacelle_exhaust_bulkhead']){const a=meshes(source,name),b=meshes(exterior,name);assert.ok(a.length);assert.equal(a.length,b.length);a.forEach((m,k)=>{const p=m.geometry.attributes.position,q=b[k].geometry.attributes.position;assert.equal(p.count,q.count);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);w.fromBufferAttribute(q,i).applyMatrix4(b[k].matrixWorld);assert.ok(v.distanceTo(w)<.0001,'Exhaust outlet changed');exhaustVertices++;}});}
const report={status:'PASS',centralWindows:16,podWindows:36,totalNewWindows:52,podApertureSamples:apertureSamples,retainedPodSurfaceSamples:retainedSamples,innerWallApertureSamples:interiorSamples,unchangedExhaustVertices:exhaustVertices,scope:'Saved exterior and aft components: actual apertures through pod skins and inner acoustic walls, transparent panes, scheduled sill elevations and unchanged exhaust outlets. Existing machinery layout retained.'};
await fs.writeFile(out+'engine-window-check.json',JSON.stringify(report,null,2));console.log(report);
