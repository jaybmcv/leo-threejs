import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {Box3,Vector3,Matrix4,Raycaster} from 'three';
import {applyConceptShape,shapeAft,shapeView,shapeFinPoint,rakeBowPoint,shapeInterior,FIN_DROP} from '../src/concept-shape.js';
import {createShip} from '../src/model.js';
import {noseWarp,NOSE} from '../src/nose-fairing.js';
import {SHIP_AREAS,createShipArea} from '../src/areas.js';
import {createNoseCommons} from '../src/nose-commons.js';
import {createAft} from '../src/aft.js';
import {applyConceptDetail,hullSurface} from '../src/concept-detail.js';
import {FIN_TOUR} from '../src/aft-tour.js';
import {LIFTS} from '../src/walk/lifts.js';
import {FIN_GATE} from '../src/fin-crown.js';
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
  // The nose (nose-fairing.js): moves across only, outward by the bumper (< 1.6 m) or inward along the cheek.
  if(p[0]>=110&&p[1]>=-40&&p[1]<=20){assert.ok(Math.abs(d[1])<1e-3&&Math.hypot(d[0],d[2])<8,`${name}: nose moved ${d.map(v=>v.toFixed(2))} at ${p.map(v=>v.toFixed(1))}`);return;}
  if(p[0]>=190&&p[1]<-42)assert.ok(d[1]>=-1e-3&&d[1]<=6.01&&Math.abs(d[0])<1e-3&&Math.abs(d[2])<1e-3,`${name}: keel moved ${d}`);else if(p[0]<120||p[1]<32)assert.ok(Math.hypot(...d)<1e-3,`${name}: hull moved outside the bow at ${p.map(v=>v.toFixed(1))} by ${d.map(v=>v.toFixed(3))}`);else assert.ok(d[0]<=1e-3&&d[0]>=-16.01&&Math.abs(d[1])<1e-3&&Math.abs(d[2])<1e-3,`${name}: bow moved ${d}`);});
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
 if(baked){const web=await load('leo-exterior-web.glb');assert.ok(web.userData.hullFairing?.mm,'baked exterior lost its fairing offsets');assert.ok(web.userData.noseFairing?.mm,'baked exterior lost its nose offsets');}}
// The nose leans inward from its navy bumper to the windows with no vertical band or kink, and nothing inside pokes out.
{const shaped=await load('leo-exterior-refined.glb');applyConceptShape(shaped);shaped.updateMatrixWorld(true);const {radius}=noseWarp(shaped,new Matrix4());
 // Convex from the bumper's top to the windows: the saved nose had an S-bend there (a flat, near-vertical band, then a
 // kink), which read as a straight-up wall and shaded as streaks.
 for(const deg of [0,10,20,30,40,50]){const c=deg/NOSE.step,at=y=>radius[0][Math.round(y-NOSE.y0)][c];
  // Averaged over neighbouring angles and heights: the sampled radius jitters per metre (triangle edges, window
  // cut-outs); the S-bend is broad. Saved nose: 0.8-2.0; reshaped: 0.3-0.7.
  const sm=(y)=>{let s=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dc=-1;dc<=1;dc++){const v=radius[0][Math.round(y-NOSE.y0)+dy]?.[Math.max(0,c+dc)];if(Number.isFinite(v)){s+=v;n++;}}return s/n;};
  let bend=-Infinity;for(let y=-8;y<=10;y++)bend=Math.max(bend,sm(y+4)-2*sm(y)+sm(y-4));assert.ok(bend<.9,`nose section ${deg}°: bends outward by ${bend.toFixed(2)} (S-bend)`);
  const navy=[...Array(29).keys()].map(i=>at(-40+i));assert.ok(Math.max(...navy)>=at(-12),`nose section ${deg}°: bumper not widest`);}
 const ship=createShip({deferExterior:true});for(const n of [6,7,8,9,10,11,12,13,14,15])ship.ensureResidentialDeck(n);ship.ensureGardens();ship.ensureObservation();ship.ensureTransit();
 [...SHIP_AREAS.map(a=>createShipArea(a).root),createNoseCommons(10).root,ship.detail.root].forEach(r=>ship.inside.add(r));shapeInterior(shaped,ship.inside);ship.root.updateMatrixWorld(true);
 let out=0,worst=0;for(const [x,y,z] of points(ship.inside,()=>true)){if(x<NOSE.fade[0]||y<NOSE.y0||y>NOSE.y1)continue;const a=Math.abs(z),deg=Math.atan2(a,x-NOSE.cx)*180/Math.PI,R=radius[z>0?0:1][Math.round(y-NOSE.y0)][Math.round(deg/NOSE.step)];
  if(Number.isFinite(R)&&Math.hypot(x-NOSE.cx,a)>R+.05){out++;worst=Math.max(worst,Math.hypot(x-NOSE.cx,a)-R);}}
 assert.equal(out,0,`${out} interior vertices poke through the nose (worst ${worst.toFixed(2)} m)`);console.log('nose: sections lean in from the bumper; interiors inside');
 // It shades as its shape: each outer-skin vertex normal within a few degrees of its faces' (on #34 the band over the
 // lowest windows, y 16-22, shaded 12-40 degrees off, as a flat streak).
 {const rows=new Map(),a=new Vector3(),b=new Vector3(),c=new Vector3(),n=new Vector3(),f=new Vector3();
  shaped.traverse(o=>{if(!o.isMesh||!/^Smooth_pressure_envelope/.test(o.name))return;const p=o.geometry.attributes.position,q=o.geometry.attributes.normal,ix=o.geometry.index,W=o.matrixWorld,acc=new Float32Array(p.count*3);
   for(let t=0;t<ix.count;t+=3){const v3=[0,1,2].map(m=>ix.getX(t+m));a.fromBufferAttribute(p,v3[0]).applyMatrix4(W);b.fromBufferAttribute(p,v3[1]).applyMatrix4(W);c.fromBufferAttribute(p,v3[2]).applyMatrix4(W);f.subVectors(b,a).cross(c.sub(a));
    for(const v of v3){n.fromBufferAttribute(q,v).transformDirection(W);const sg=f.dot(n)<0?-1:1;acc[v*3]+=sg*f.x;acc[v*3+1]+=sg*f.y;acc[v*3+2]+=sg*f.z;}}
   for(let v=0;v<p.count;v++){a.fromBufferAttribute(p,v).applyMatrix4(W);if(a.x<115||a.y<14||a.y>24)continue;n.fromBufferAttribute(q,v).transformDirection(W);if((n.x*(a.x-NOSE.cx)+n.z*a.z)/Math.hypot(a.x-NOSE.cx,a.z)<.2)continue;
    f.set(acc[v*3],acc[v*3+1],acc[v*3+2]).normalize();const r=Math.round(a.y/2)*2;(rows.get(r)??rows.set(r,[]).get(r)).push(Math.acos(Math.min(1,n.dot(f)))*180/Math.PI);}});
  assert.ok(rows.size>=5,`nose normals: only ${rows.size} rows sampled`);
  for(const [y,v] of rows){v.sort((x,z)=>x-z);assert.ok(v[v.length>>1]<5,`nose normals at y ${y}: ${v[v.length>>1].toFixed(1)} degrees off the surface`);}}
 // The bow's seams sit just off the hull, measured by a ray cast inward to it: the chine ~0.2 m, the lower reveal one
 // continuous strip per side (the dashed run and the joints' feet along it gone) 0.1-0.35 m, up to 0.6 m where it
 // bridges the hull's three small panel steps (0.45 m drops at 20, 24 and 29 degrees round).
 {const hullMeshes=[];shaped.traverse(o=>{if(o.isMesh&&/^Smooth_pressure_envelope/.test(o.name))hullMeshes.push(o);});const rc=new Raycaster(),v=new Vector3();
  const gaps=name=>{const d=[];shaped.traverse(o=>{if(!o.isMesh||o.name!==name)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.x<130||v.y<-18||v.y>2)continue;
   const th=Math.atan2(Math.abs(v.z),v.x-NOSE.cx),dir=new Vector3(-Math.cos(th),0,-Math.sign(v.z)*Math.sin(th));rc.set(new Vector3(NOSE.cx,v.y,0).addScaledVector(dir,-400),dir);const h=rc.intersectObjects(hullMeshes,false)[0];if(h)d.push(Math.hypot(v.x-NOSE.cx,v.z)-(400-h.distance));}});return d.sort((x,y)=>x-y);};
  const chine=gaps('Continuous_chine'),at=q=>chine[Math.floor(chine.length*q)];assert.ok(at(.05)>.1&&at(.5)<.3&&at(.95)<.45,`chine floats ${at(.05).toFixed(2)}-${at(.95).toFixed(2)} m off the bow`);
  let lines=0;shaped.traverse(o=>{if(o.isMesh&&o.name==='Bow_reveal_line')lines++;});assert.equal(lines,2,`${lines} bow reveal strips`);
  const strip=gaps('Bow_reveal_line');assert.ok(strip.length>100&&strip[0]>.05&&strip.at(-1)<.65&&strip[Math.floor(strip.length*.95)]<.35,`bow reveal strip ${strip[0]?.toFixed(2)}-${strip.at(-1)?.toFixed(2)} m off the hull`);
  console.log(`nose: shades as its shape; chine ${at(.5).toFixed(2)} m and reveal strip ${strip[strip.length>>1].toFixed(2)} m off the hull`);}
 // The bow centreline: the hull halves share their normals there (no shading line down the bumper); the stray chine
 // fragment (a chevron at y -19) is gone; the chine reaches the centre on its full profile (not pinched).
 {const v=new Vector3(),n=new Vector3();let lean=0,welded=0,stray=0;const sec={};
  shaped.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;
   if(/^Smooth_pressure_envelope/.test(o.name)){const q=o.geometry.attributes.normal;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.x>110&&v.y>-40&&v.y<28&&Math.abs(v.z)<.02){welded++;lean=Math.max(lean,Math.abs(n.fromBufferAttribute(q,i).transformDirection(o.matrixWorld).z));}}}
   // Chine profiles at the centre and ~1 m out, per line (y -12 and -21) and side: their height spans.
   if(o.name==='Continuous_chine'){const ix=o.geometry.index;for(let t=0;t<ix.count;t++){v.fromBufferAttribute(p,ix.getX(t)).applyMatrix4(o.matrixWorld);if(v.x>240&&v.y>-20&&v.y<-18&&Math.abs(v.z)<5)stray++;
    const az=Math.abs(v.z),at=az<.02?'c':az>.8&&az<1.4?'a':null,ln=v.y>-13&&v.y<-11?'upper':v.y>-22&&v.y<-20?'lower':null;if(v.x>200&&at&&ln){const k=`${o.parent.name} ${ln} ${at}`;(sec[k]??=[]).push(v.y);}}}});
  assert.ok(welded>10&&lean<.01,`bow hull halves lean apart at the centreline (normal z ${lean.toFixed(3)} over ${welded})`);assert.equal(stray,0,'stray chine fragment at the bow');
  // Distinct heights (3 cm apart) in each profile: a collapsed or pinched centre profile has fewer than its neighbour.
  const rows=a=>{if(!a?.length)return 0;const y=[...a].sort((p,q)=>p-q);let n=1;for(let i=1;i<y.length;i++)if(y[i]-y[i-1]>.03)n++;return n;};
  for(const side of ['Port_shell','Starboard_shell'])for(const ln of ['upper','lower']){const c=rows(sec[`${side} ${ln} c`]),a=rows(sec[`${side} ${ln} a`]);
   assert.ok(a>=3&&c>=a,`${side} ${ln} chine: centre profile has ${c} rows, beside it ${a} (pinched)`);}
  const ss=[Math.min(...sec['Starboard_shell upper c']),Math.max(...sec['Starboard_shell upper c'])];
  console.log(`nose: centreline welded (normal z ${lean.toFixed(3)}), chine halves meet at ${ss.map(y=>y.toFixed(2)).join('..')}`);}}
// The aft interiors' crown follows, and the tour stops and their text name the lowered crown.
const aft=createAft(),r0=bounds(aft.root,crown).max.y;shapeAft(aft.root);assert.ok(Math.abs(r0-bounds(aft.root,crown).max.y-FIN_DROP)<.05,'aft crown did not follow');
// Every fin landing's gate frames exactly the landing door (the lift's door width, the walk's 2.75 m shutter), after the drop.
{const fin=LIFTS.find(l=>l.id==='crown').stops.filter(st=>/^Fin platform/.test(st.label));assert.equal(fin.length,6);
 const parts=n=>{const p=[];aft.root.traverse(o=>{if(o.isMesh&&o.name===n)p.push(new Box3().setFromObject(o));});return p;},headers=parts('Crown_lift_platform_header'),jambs=parts('Crown_lift_platform_jamb');
 for(const st of fin){
  const h=headers.find(b=>b.min.y>st.y+1.5&&b.min.y<st.y+4),near=jambs.filter(b=>Math.abs(b.min.y-st.y)<.05);
  assert.ok(h&&near.length===2,`${st.label}: gate not found`);
  assert.ok(Math.abs(h.min.y-st.y-FIN_GATE.height)<.01,`${st.label}: gate opening is ${(h.min.y-st.y).toFixed(3)} m high, the door ${FIN_GATE.height}`);
  const [lo,hi]=near.sort((p,q)=>p.min.z-q.min.z);assert.ok(Math.abs(hi.min.z-lo.max.z-FIN_GATE.width)<.01,`${st.label}: gate opening is ${(hi.min.z-lo.max.z).toFixed(3)} m wide, the door ${FIN_GATE.width}`);
  assert.ok(Math.abs(near[0].max.y-near[0].min.y-FIN_GATE.height-FIN_GATE.header)<.01,`${st.label}: jambs do not reach the header`);
 }
 assert.equal(LIFTS.find(l=>l.id==='crown').door.width,FIN_GATE.width);}
const lobby=shapeView(FIN_TOUR.find(s=>s.name==='Panorama arrival lobby'));assert.equal(lobby.position[1],134-FIN_DROP);assert.match(lobby.detail,/120\.3 m/);
console.log('Concept shape verified: exterior, aft interiors and tour stops agree.');
