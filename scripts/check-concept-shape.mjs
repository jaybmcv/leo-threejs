import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Box3,Vector3,Matrix4} from 'three';
import {applyConceptShape,shapeAft,shapeView,shapeFinPoint,rakeBowPoint,FIN_DROP} from '../src/concept-shape.js';
import {createAft} from '../src/aft.js';
import {applyConceptDetail,hullSurface} from '../src/concept-detail.js';
import {FIN_TOUR} from '../src/aft-tour.js';
// The concept shape pass runs in the viewer on both the lossless and the streamed (quantized) exterior.
const out='output/leo-interior-v01/';
async function load(name){const b=await fs.readFile(out+name);const g=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');g.scene.traverse(o=>{const a=g.parser.associations.get(o);if(a?.nodes!==undefined)o.name=g.parser.json.nodes[a.nodes].name||o.name;else if(o.isMesh&&a?.meshes!==undefined)o.name=o.parent.name;});return g.scene.getObjectByName('01_EXTERIOR_REFINED_V31');}
const bounds=(root,test)=>{const b=new Box3();root.updateMatrixWorld(true);root.traverse(o=>{if(o.isMesh&&test(o))b.union(new Box3().setFromObject(o));});return b;};
const points=(root,test)=>{const v=new Vector3(),p=[];root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh||!test(o))return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)p.push(v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).toArray());});return p;};
const crown=o=>/^Crown_roof$/.test(o.name),hull=o=>/^Smooth_pressure_envelope_/.test(o.name)||/^Smooth_pressure_envelope_/.test(o.parent?.name),pod=o=>/^Sculpted_nacelle_shell/.test(o.name);
// The streamed copy exists once build-public has run.
const streamed=await fs.access(out+'leo-exterior-web.glb').then(()=>true,()=>false);
// The streamed copy has the passes baked in by build-public (scripts/bake-concept.mjs); it is checked against the
// lossless exterior shaped here, at the end.
const baked=streamed&&(await load('leo-exterior-web.glb')).userData.conceptBaked;
for(const name of ['leo-exterior-refined.glb',...(streamed&&!baked?['leo-exterior-web.glb']:[])]){
 const before=await load(name),after=await load(name),t0=performance.now();applyConceptShape(after);const ms=performance.now()-t0;
 // The crown and its lounge sit FIN_DROP lower; the hull is untouched.
 const c0=bounds(before,crown),c1=bounds(after,crown);assert.ok(Math.abs(c0.max.y-c1.max.y-FIN_DROP)<.05,`${name}: crown roof moved ${c0.max.y-c1.max.y}`);
 // The hull moves only where the bow rakes back (above 32 m, forward of x 120: only aft, at most 16 m) or the bow
 // keel lifts (below -33 m, forward of x 190: only up, at most 6 m).
 const h0=points(before,hull),h1=points(after,hull);assert.equal(h0.length,h1.length);
 h0.forEach((p,i)=>{const d=p.map((v,k)=>h1[i][k]-v);if(p[0]>=190&&p[1]<-33)assert.ok(d[1]>=-1e-3&&d[1]<=6.01&&Math.abs(d[0])<1e-3&&Math.abs(d[2])<1e-3,`${name}: keel moved ${d}`);else if(p[0]<120||p[1]<32)assert.ok(Math.hypot(...d)<1e-3,`${name}: hull moved outside the bow`);else assert.ok(d[0]<=1e-3&&d[0]>=-16.01&&Math.abs(d[1])<1e-3&&Math.abs(d[2])<1e-3,`${name}: bow moved ${d}`);});
 // The fin fillet reaches ~48 m ahead of the fin's edge on the hull top and stays within the fin's thickness.
 const fillet=after.getObjectByName('Fin_root_fillet');assert.ok(fillet,`${name}: fillet missing`);const f=bounds(after,o=>o===fillet);
 assert.ok(f.max.x>-140&&f.max.x<-125,`${name}: fillet reaches x ${f.max.x}`);assert.ok(f.max.z<=5.2&&f.min.z>=-5.2,`${name}: fillet much thicker than the fin`);
 // Its faces point outward (the material culls back faces): sides away from the fin's centre plane, nose forward.
 {const pos=fillet.geometry.attributes.position,nor=fillet.geometry.attributes.normal;let inward=0;for(let i=0;i<pos.count;i++){const z=pos.getZ(i);if(Math.abs(z)>.5&&Math.sign(nor.getZ(i))!==Math.sign(z))inward++;}assert.equal(inward,0,`${name}: ${inward} fillet normals face into the fin`);}
 // Pod bows curve back only below the pod interiors' floor (-19.7 m).
 const p0=points(before,pod),p1=points(after,pod);let keel=0;p0.forEach((p,i)=>{const d=Math.hypot(...p.map((v,k)=>v-p1[i][k]));if(p[1]>-20)assert.ok(d<1e-3,`${name}: pod moved above the interior floor`);if(p[1]<-33&&p[0]>-150)keel=Math.max(keel,p[0]-p1[i][0]);});
 assert.ok(keel>3.5&&keel<8,`${name}: pod keel moved back ${keel}`);
 after.traverse(o=>{if(o.isMesh)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v),`${name}: ${o.name} has a non-finite position`);});
 // Detail: the concept spine replaces the saved dorsal pads; the enlarged identity stays in its window-free bays, on the hull.
 const identity=/^(V33_authentic_Mars_Cats_Voyage_logo|Mission_brand|LEO_wordmark|Mission_identifier)$/,surface=hullSurface(before,new Matrix4(),false),standoff=root=>points(root,o=>identity.test(o.name)).map(([x,y,z])=>Math.abs(z)-surface(x,y,z>0?1:0));
 const lift0=standoff(before);
 const t1=performance.now();applyConceptDetail(after);const detailMs=performance.now()-t1;
 // Each letter keeps its height above the hull after growing.
 {const lift1=standoff(after);let worst=0;lift0.forEach((d,i)=>{if(Number.isFinite(d)&&Number.isFinite(lift1[i]))worst=Math.max(worst,Math.abs(lift1[i]-d));});assert.ok(worst<.03,`${name}: identity standoff changed by ${worst} m`);}
 // Pod slots and beacons sit with their pods; the cap beacon with the crown.
 for(const side of ['Port_nacelle','Starboard_nacelle'])for(const mark of ['Nacelle_concept_slot','Nacelle_concept_beacon'])assert.ok(after.getObjectByName(side).getObjectByName(mark),`${name}: ${side} ${mark} missing`);
 assert.ok(after.getObjectByName('Fin_cap_retained_white_underside').parent.getObjectByName('Crown_concept_beacon'),`${name}: cap beacon missing`);
 // A hangar door on each side at the bow's shuttle bay, and a lid on each pod's deck.
 {let sides=new Set();after.traverse(o=>{if(o.isMesh&&o.name==='Hangar_door_panel'){const b=new Box3().setFromObject(o);assert.ok(b.min.x>=135&&b.max.x<=175&&b.max.y<-25,`${name}: hangar door at ${b.min.toArray()}`);sides.add(Math.sign(b.getCenter(new Vector3()).z));}});assert.equal(sides.size,2,`${name}: hangar doors missing`);}
 // Every door triangle rests on the hull (or the thermal panel field over it), never inside it.
 {const door=hullSurface(after,new Matrix4(),false,new Box3(new Vector3(130,-50,40),new Vector3(180,-20,Infinity)),/^(Smooth_pressure_envelope|Lower_thermal_panel_fields)/),v=new Vector3();let worst=Infinity;
  after.traverse(o=>{if(!o.isMesh||!/^Hangar_door_/.test(o.name))return;const p=o.geometry.attributes.position,ix=o.geometry.index;for(let t=0;t<ix.count;t+=3){const c=new Vector3();for(let k=0;k<3;k++)c.add(v.fromBufferAttribute(p,ix.getX(t+k)).applyMatrix4(o.matrixWorld));c.divideScalar(3);const z=door(c.x,c.y,c.z>0?1:0);if(Number.isFinite(z))worst=Math.min(worst,Math.abs(c.z)-z);}});
  assert.ok(worst>.02,`${name}: a hangar door triangle sits ${-worst} m inside the hull`);}
 for(const side of ['Port_nacelle','Starboard_nacelle'])assert.ok(after.getObjectByName(side).getObjectByName('Nacelle_concept_lid'),`${name}: ${side} lid missing`);
 // The spine is one Explode part.
 assert.ok(after.getObjectByName('Dorsal_sensor_assembly')?.getObjectByName('Sensor_mast_tip'),`${name}: spine not grouped`);
 after.traverse(o=>assert.ok(!(o.isMesh&&/^(Dorsal_sensor_rail|Sensor_fairing|Sensor_amber|Dorsal_whiskers)$/.test(o.name)),`${name}: saved dorsal pad left`));
 assert.ok(after.getObjectByName('Dorsal_sensor_spine'),`${name}: spine missing`);
 const panes=points(after,o=>o.name==='V33_passenger_window_reveals');
 for(const [parts,grew] of [[/^(V33_authentic_Mars_Cats_Voyage_logo|Mission_brand)$/,1.45],[/^(LEO_wordmark|Mission_identifier)$/,1.45]])for(const side of [-1,1]){
  const pick=o=>parts.test(o.name)&&Math.sign(new Box3().setFromObject(o).getCenter(new Vector3()).z)===side,b0=bounds(before,pick),b1=bounds(after,pick);
  assert.ok(b1.max.x-b1.min.x>=(b0.max.x-b0.min.x)*grew,`${name}: identity did not grow`);
  const covered=panes.filter(([x,y,z])=>Math.sign(z)===side&&x>b1.min.x&&x<b1.max.x&&y>b1.min.y&&y<b1.max.y).length;assert.equal(covered,0,`${name}: identity covers ${covered} window vertices`);
  const d=points(after,pick);for(const [x,y,z] of d)assert.ok(Math.abs(z)>60&&Math.abs(z)<90,`${name}: identity left the hull side`);
 }
 console.log(`${name}: detail pass ${detailMs.toFixed(0)} ms`);
 console.log(`${name}: shape pass ${ms.toFixed(0)} ms, crown -${(c0.max.y-c1.max.y).toFixed(2)} m, fillet to x ${f.max.x.toFixed(1)}, pod keel back ${keel.toFixed(1)} m`);
}
// The fin skin has long, non-conforming triangles; the drop must keep every straight edge straight on them or cracks open.
const saved=await load('leo-exterior-refined.glb');saved.updateMatrixWorld(true);let skin;saved.traverse(o=>{if(o.isMesh&&/^Swept_cat_tail/.test(o.name))skin=o;});
{const p=skin.geometry.attributes.position,ix=skin.geometry.index,v=new Vector3(),drop=shapeFinPoint;let worst=0;
 for(let t=0;t<ix.count;t+=3){const c=[0,1,2].map(k=>v.fromBufferAttribute(p,ix.getX(t+k)).applyMatrix4(skin.matrixWorld).toArray());const mid=[0,1,2].map(k=>(c[0][k]+c[1][k]+c[2][k])/3);
  const warped=c.map(drop),a=drop(mid),bend=Math.abs(a[1]-(warped[0][1]+warped[1][1]+warped[2][1])/3);worst=Math.max(worst,bend);}
 assert.ok(worst<.02,`fin drop bends the skin's triangles by ${worst} m`);}
// The bow rake must keep the hull's triangles nearly straight, or its window cut-outs would crack.
{let worst=0;saved.traverse(o=>{if(!o.isMesh||!/^Smooth_pressure_envelope/.test(o.name)&&!/^Smooth_pressure_envelope/.test(o.parent?.name))return;const p=o.geometry.attributes.position,ix=o.geometry.index,v=new Vector3();
 for(let t=0;t<(ix?ix.count:p.count);t+=3){const c=[0,1,2].map(k=>v.fromBufferAttribute(p,ix?ix.getX(t+k):t+k).applyMatrix4(o.matrixWorld).toArray());if(c.every(q=>q[0]<120||q[1]<32))continue;
  const mid=[0,1,2].map(k=>(c[0][k]+c[1][k]+c[2][k])/3),bent=rakeBowPoint(mid)[0]-c.reduce((s,q)=>s+rakeBowPoint(q)[0],0)/3;worst=Math.max(worst,Math.abs(bent));}});
 assert.ok(worst<.08,`bow rake bends hull triangles by ${worst} m`);}
if(baked){
 const shaped=await load('leo-exterior-refined.glb'),web=await load('leo-exterior-web.glb');applyConceptShape(shaped);applyConceptDetail(shaped);
 const names=root=>{const m=new Map();root.traverse(o=>{if(o.isMesh)m.set(o.name,(m.get(o.name)||0)+1);});return m;},a=names(shaped),b=names(web);
 for(const k of new Set([...a.keys(),...b.keys()]))assert.equal(b.get(k),a.get(k),`baked exterior: ${k} count differs`);
 for(const part of ['Crown_roof','Fin_root_fillet','Dorsal_sensor_assembly','Hangar_door_panel']){const x=bounds(shaped,o=>o.name===part||o.parent?.name===part),y=bounds(web,o=>o.name===part||o.parent?.name===part);assert.ok(x.min.distanceTo(y.min)<.05&&x.max.distanceTo(y.max)<.05,`baked exterior: ${part} moved`);}
 console.log('leo-exterior-web.glb: baked, matches the shaped lossless exterior');
}
// The aft interiors' crown follows, and the tour stops and their text name the lowered crown.
const aft=createAft(),r0=bounds(aft.root,crown).max.y;shapeAft(aft.root);assert.ok(Math.abs(r0-bounds(aft.root,crown).max.y-FIN_DROP)<.05,'aft crown did not follow');
const lobby=shapeView(FIN_TOUR.find(s=>s.name==='Panorama arrival lobby'));assert.equal(lobby.position[1],134-FIN_DROP);assert.match(lobby.detail,/120\.3 m/);
console.log('Concept shape verified: exterior, aft interiors and tour stops agree.');
