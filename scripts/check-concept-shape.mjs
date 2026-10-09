import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Box3,Vector3,Matrix4,Raycaster} from 'three';
import {applyConceptShape,shapeAft,shapeView,shapeFinPoint,rakeBowPoint,shapeInterior,FIN_DROP} from '../src/concept-shape.js';
import {createShip} from '../src/model.js';
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
 // The hull moves only where it is faired (below), where the bow rakes back (above 32 m, forward of x 120: only aft, at most 16 m) or the bow
 // keel lifts (below -33 m, forward of x 190: only up, at most 6 m).
 const h0=points(before,hull),h1=points(after,hull);assert.equal(h0.length,h1.length);
 h0.forEach((p,i)=>{const d=p.map((v,k)=>h1[i][k]-v);
  // The fairing (hull-fairing.js): upper sides move across (inward, under 4 m); the crown's aft slope moves up or down.
  const inSide=p[0]>=-150&&p[0]<=75&&p[1]>=6&&p[1]<=55&&Math.abs(p[2])>5,inCrown=p[0]>=-125&&p[0]<=0&&p[1]>=38&&Math.abs(p[2])<=48;
  if((inSide||inCrown)&&Math.abs(d[0])<1e-3){assert.ok(Math.abs(d[2])<(inSide?4:1e-3)&&Math.abs(d[1])<(inCrown?7.5:.05),`${name}: faired by ${d.map(v=>v.toFixed(3))} at ${p.map(v=>v.toFixed(1))}`);return;}
  if(p[0]>=190&&p[1]<-33)assert.ok(d[1]>=-1e-3&&d[1]<=6.01&&Math.abs(d[0])<1e-3&&Math.abs(d[2])<1e-3,`${name}: keel moved ${d}`);else if(p[0]<120||p[1]<32)assert.ok(Math.hypot(...d)<1e-3,`${name}: hull moved outside the bow at ${p.map(v=>v.toFixed(1))} by ${d.map(v=>v.toFixed(3))}`);else assert.ok(d[0]<=1e-3&&d[0]>=-16.01&&Math.abs(d[1])<1e-3&&Math.abs(d[2])<1e-3,`${name}: bow moved ${d}`);});
 // The fin fillet reaches ~48 m ahead of the fin's edge on the hull top and stays within the fin's thickness.
 const fillet=after.getObjectByName('Fin_root_fillet');assert.ok(fillet,`${name}: fillet missing`);const f=bounds(after,o=>o===fillet);
 assert.ok(f.max.x>-140&&f.max.x<-125,`${name}: fillet reaches x ${f.max.x}`);assert.ok(f.max.z<=5.2&&f.min.z>=-5.2,`${name}: fillet much thicker than the fin`);
 // Its faces point outward (the material culls back faces): sides away from the fin's centre plane, nose forward.
 {const pos=fillet.geometry.attributes.position,nor=fillet.geometry.attributes.normal;let inward=0;for(let i=0;i<pos.count;i++){const z=pos.getZ(i);if(Math.abs(z)>.5&&Math.sign(nor.getZ(i))!==Math.sign(z))inward++;}assert.equal(inward,0,`${name}: ${inward} fillet normals face into the fin`);}
 // Faired hull: ahead of the fin the upper sides are no wider than midship, and the crown's aft step is a slope.
 {const hullMeshes=[];after.traverse(o=>{if(o.isMesh&&(/^Smooth_pressure_envelope/.test(o.name)||/^Smooth_pressure_envelope/.test(o.parent?.name)))hullMeshes.push(o);});
  const rc=new Raycaster(),cast=(o,d)=>{rc.set(new Vector3(...o),new Vector3(...d));return rc.intersectObjects(hullMeshes,false)[0]?.point;};
  for(const y of [25,33,40]){const mid=[30,25,20,35,60,55,65].map(x=>cast([x,y,200],[0,0,-1])).find(Boolean)?.z;assert.ok(Number.isFinite(mid),`${name}: no midship hull at y ${y}`);for(const x of [-100,-80,-60,-40]){const p=cast([x,y,200],[0,0,-1]);if(p)assert.ok(p.z<=mid+.6,`${name}: side swells at x ${x}, y ${y}: ${p.z.toFixed(2)} vs midship ${mid.toFixed(2)}`);}}
  let steep=0;for(let x=-90;x<-30;x+=2){const a=cast([x,200,0],[0,-1,0]),b=cast([x+2,200,0],[0,-1,0]);if(a&&b)steep=Math.max(steep,(b.y-a.y)/2);}
  assert.ok(steep<.45,`${name}: crown step still rises ${steep.toFixed(2)} m per metre`);}
 // Pod bows curve back only below the pod interiors' floor (-19.7 m).
 const p0=points(before,pod),p1=points(after,pod);let keel=0;p0.forEach((p,i)=>{const d=Math.hypot(...p.map((v,k)=>v-p1[i][k]));if(p[1]>-20)assert.ok(d<1e-3,`${name}: pod moved above the interior floor`);if(p[1]<-33&&p[0]>-150)keel=Math.max(keel,p[0]-p1[i][0]);});
 assert.ok(keel>3.5&&keel<8,`${name}: pod keel moved back ${keel}`);
 after.traverse(o=>{if(o.isMesh)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v),`${name}: ${o.name} has a non-finite position`);});
 // Detail: the concept spine replaces the saved dorsal pads; the enlarged identity stays in its window-free bays, on the hull.
 const identity=/^(V33_authentic_Mars_Cats_Voyage_logo|Mission_brand|LEO_wordmark|Mission_identifier)$/,surface=hullSurface(after,new Matrix4(),false),standoff=root=>points(root,o=>identity.test(o.name)).map(([x,y,z])=>Math.abs(z)-surface(x,y,z>0?1:0));
 // Measured on the shaped (faired) hull, before and after the detail pass grows the identity.
 const lift0=standoff(after);
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
// The deck plates reach the hull wall; once faired with it (shapeInterior) none pokes through the faired sides.
{const shaped=await load('leo-exterior-refined.glb');applyConceptShape(shaped);shaped.updateMatrixWorld(true);
 const surface=hullSurface(shaped,new Matrix4(),false,new Box3(new Vector3(-155,0,15),new Vector3(80,58,Infinity))),ship=createShip({deferExterior:true});
 ship.root.updateMatrixWorld(true);const slabs=[];ship.inside.traverse(o=>{if(o.name==='Deck_slab')slabs.push(o);});const slabsBefore=slabs.map(o=>points(o,()=>true));
 shapeInterior(shaped,ship.inside);ship.root.updateMatrixWorld(true);let worst=-Infinity;
 // Holes cut for the commons (Decks 18-19, edges at |z| 43.5-46) keep their edges where they lie inside the plate's
 // outline; at the aft corner, where the hull narrows onto them, they are the outline and move with it.
 {let holeMove=0;slabs.forEach((o,k)=>{const out=o.userData.outline,after=points(o,()=>true),at=x=>{for(let i=1;i<out.length;i++)if(x<=out[i][0]){const [a,wa]=out[i-1],[b,wb]=out[i];return wa+(wb-wa)*(x-a)/(b-a||1);}return out.at(-1)[1];};
   slabsBefore[k].forEach((p,i)=>{if(p[1]>27&&p[1]<33&&Math.abs(p[2])>40&&Math.abs(p[2])<at(p[0])-1.5)holeMove=Math.max(holeMove,Math.abs(after[i][2]-p[2]));});});
  assert.ok(holeMove<.05,`commons hole edges moved ${holeMove.toFixed(2)} m`);}
 for(const [x,y,z] of points(ship.inside,o=>o.name==='Deck_slab'))if(x>-150&&x<75&&y>6&&y<55&&Math.abs(z)>15){const w=surface(x,y,z>0?1:0);if(Number.isFinite(w))worst=Math.max(worst,Math.abs(z)-w);}
 assert.ok(worst<.02,`a deck plate pokes ${worst.toFixed(2)} m through the faired hull`);console.log(`deck plates clear the faired hull (closest ${(-worst).toFixed(2)} m inside)`);
 if(baked)assert.ok((await load('leo-exterior-web.glb')).userData.hullFairing?.mm,'baked exterior lost its fairing offsets');}
// The aft interiors' crown follows, and the tour stops and their text name the lowered crown.
const aft=createAft(),r0=bounds(aft.root,crown).max.y;shapeAft(aft.root);assert.ok(Math.abs(r0-bounds(aft.root,crown).max.y-FIN_DROP)<.05,'aft crown did not follow');
const lobby=shapeView(FIN_TOUR.find(s=>s.name==='Panorama arrival lobby'));assert.equal(lobby.position[1],134-FIN_DROP);assert.match(lobby.detail,/120\.3 m/);
console.log('Concept shape verified: exterior, aft interiors and tour stops agree.');
