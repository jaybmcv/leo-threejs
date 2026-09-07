import {addPassengerWindows} from './passenger-windows.js';
import * as T from 'three';
import {TessellateModifier} from 'three/addons/modifiers/TessellateModifier.js';

// A small projected-triangle index keeps details on the retained mesh rather
// than recreating the hull from a different version of the profile functions.
export function surfaceIndex(meshes,axis,extreme='max'){
 const bins=new Map(),cell=6,triangles=[],v=new T.Vector3(),uv=axis==='y'?['x','z']:['x','y'];
 for(const mesh of meshes){const p=mesh.geometry.attributes.position,ix=mesh.geometry.index;for(let i=0;i<(ix?.count||p.count);i+=3){const q=[];for(let k=0;k<3;k++){v.fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld);q.push([v[uv[0]],v[uv[1]],axis==='z'?Math.abs(v.z):v.y]);}
  const [a,b,c]=q,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
  const id=triangles.length;triangles.push({q,den});for(let u=Math.floor(Math.min(...q.map(p=>p[0]))/cell);u<=Math.floor(Math.max(...q.map(p=>p[0]))/cell);u++)for(let w=Math.floor(Math.min(...q.map(p=>p[1]))/cell);w<=Math.floor(Math.max(...q.map(p=>p[1]))/cell);w++){const key=u+','+w;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(id);}
 }}
 return (u,w)=>{let height=extreme==='min'?Infinity:-Infinity;for(const id of bins.get(Math.floor(u/cell)+','+Math.floor(w/cell))||[]){const {q:[a,b,c],den}=triangles[id],aa=((b[1]-c[1])*(u-c[0])+(c[0]-b[0])*(w-c[1]))/den,bb=((c[1]-a[1])*(u-c[0])+(a[0]-c[0])*(w-c[1]))/den,cc=1-aa-bb;if(Math.min(aa,bb,cc)>=-1e-6)height=Math[extreme](height,aa*a[2]+bb*b[2]+cc*c[2]);}return height;};
}

export function refineExterior(exterior){
 exterior.updateMatrixWorld(true);const hull=[];exterior.traverse(o=>{if(o.isMesh&&(/^Smooth_pressure_envelope_/.test(o.name)||/^Smooth_pressure_envelope_/.test(o.parent?.name)))hull.push(o);});
 if(!hull.length)throw new Error('Saved exterior hull was not identified');
 const side=surfaceIndex(hull,'z'),top=surfaceIndex(hull,'y'),stats={projectedVertices:0,projectedMeshes:0,unresolved:0,unresolvedMeshes:{}};
 const seen=new Map();
 // Move only the aft sensor pad forward onto the short crown. Its attached
 // antenna and amber cap travel with it; the rail's aft endpoint is shortened.
 const padShift=49.24; // physical metres: centre -61.24 -> -12, toward the nose
 stats.roofPad={shiftForwardM:padShift,previousCentreX:-61.24,centreX:-12};
 exterior.traverse(o=>{
  if(!o.isMesh||!['Sensor_fairing','Sensor_amber','Dorsal_whiskers','Dorsal_sensor_rail'].includes(o.name))return;
  o.geometry=o.geometry.clone();const p=o.geometry.attributes.position,v=new T.Vector3(),inv=o.matrixWorld.clone().invert();
  for(let i=0;i<p.count;i++){
   v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
   if(o.name==='Dorsal_sensor_rail')v.x=-19.52+(v.x+68.76)*(91.04+19.52)/(91.04+68.76);
   else if(v.x<0)v.x+=padShift;
   v.applyMatrix4(inv);p.setXYZ(i,v.x,v.y,v.z);
  }
  p.needsUpdate=true;o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
 });
 const palette={V31_Ceramic_satin:[0xd0d5d5,.4,.24],V31_Thermal_navy:[0x26384c,.5,.36],V31_Edge_alloy:[0x738995,.28,.72],V31_Recess:[0x0d1c29,.62,.25],V31_Panel_reveal:[0x71818b,.68,.18],V31_Observation_glass:[0x153849,.13,.56],V31_Amber_markers:[0xd89343,.45,.35],V31_Identity_ink:[0x18334b,.72,.05],V31_Ceramic_access_panels:[0xb9c4ca,.5,.3],V31_Thermal_service_panels:[0x304459,.54,.4],V31_Glazing_seals:[0x0b1c27,.78,.08],V31_Dorsal_service_covers:[0xbec8cd,.48,.26]};
 exterior.traverse(o=>{if(!o.isMesh)return;const replace=m=>{if(seen.has(m))return seen.get(m);const n=m.clone(),p=palette[m.name];if(p){n.color.setHex(p[0]);n.roughness=p[1];n.metalness=p[2];n.name=m.name.replace('V31_','V32_');}if(m.name==='V31_Engine_idle_glow'){n.color.setHex(0x508999);n.emissive.setHex(0x2b778b);n.emissiveIntensity=.55;}if(m.name==='V31_Inhabited_windows'){n.color.setHex(0x2a4855);n.emissive.setHex(0xa6c6d1);n.emissiveIntensity=.11;}seen.set(m,n);return n;};o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);});
 const sideDetails=/^(LEO_wordmark|Mission_identifier|Mission_brand|Crest_|Individual_deck_windows|Lower_thermal_panel_fields|Thermal_panel_joint|Service_access_|Thermal_amber_|Upper_service_hatch|Upper_hatch_latch|Bow_access_|Lifeboat_|Bay_amber|Transfer_hangar_|Hangar_door_)/;
 const topDetails=/^(Dorsal_service_cover|Dorsal_cover_latch|Dorsal_maintenance_hatch|Dorsal_hatch_front|Roof_mission)$/;
 const seams=/^(Hull_panel_seams|Continuous_chine|Bow_cheek_panel_joint|Bow_horizontal_panel_reveal)$/;
 exterior.traverse(o=>{if(!o.isMesh||!(sideDetails.test(o.name)||topDetails.test(o.name)||seams.test(o.name)))return;
  o.geometry=/^(LEO_wordmark|Mission_identifier|Mission_brand|Crest_)/.test(o.name)?new TessellateModifier(.6,7).modify(o.geometry):o.geometry.clone();const p=o.geometry.attributes.position,norm=o.geometry.attributes.normal,normalMatrix=new T.Matrix3().getNormalMatrix(o.matrixWorld),inv=o.matrixWorld.clone().invert(),v=new T.Vector3(),normal=new T.Vector3();let moved=false;
  let layer=.2;if(/recess|inset|seal|joint|seam|reveal/i.test(o.name))layer=.23;if(/rib|latch|marker|amber/i.test(o.name))layer=.34;if(/Crest_cat/.test(o.name))layer=.34;if(/Crest_eye|Crest_nose/.test(o.name))layer=.48;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);const z=side(v.x,v.y),y=top(v.x,v.z);let useTop=topDetails.test(o.name);if(seams.test(o.name))useTop=Number.isFinite(y)&&Math.abs(y-v.y)<Math.abs(z-Math.abs(v.z));
   const tube=/joint|seam|reveal|rib|hatch|chine/i.test(o.name)&&!/_panels|latch|fields/.test(o.name);if(norm)normal.fromBufferAttribute(norm,i).applyMatrix3(normalMatrix).normalize();
   if(useTop&&Number.isFinite(y)){v.y=y+layer+(tube?.055*normal.y:0);}else if(!useTop&&Number.isFinite(z)){const s=Math.sign(v.z||1);v.z=s*(z+layer)+(tube?.055*normal.z:0);}else{
    // End caps on a seam tube can extend beyond the rounded bow's last sample.
    let recovered=false;for(const dx of [-.1,-.25,-.5,-1,-2]){const zz=side(v.x+dx,v.y);if(Number.isFinite(zz)){v.x+=dx;v.z=Math.sign(v.z||1)*(zz+layer);recovered=true;break;}}
    if(!recovered){stats.unresolved++;stats.unresolvedMeshes[o.name]=(stats.unresolvedMeshes[o.name]||0)+1;continue;}
   }
   v.applyMatrix4(inv);p.setXYZ(i,v.x,v.y,v.z);stats.projectedVertices++;moved=true;
  }
  if(moved){stats.projectedMeshes++;p.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();o.castShadow=false;o.receiveShadow=false;}
 });
 // Bring the glazing frames forward as physical trim, preserving pane outlines.
 exterior.traverse(o=>{if(!o.isMesh||!['Individual_glazing_frames','Forward_side_vent_frame'].includes(o.name))return;
  o.geometry=o.geometry.clone();const a=o.geometry.attributes.position,inv=o.matrixWorld.clone().invert(),v=new T.Vector3();for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);const n=new T.Vector3(Math.max(0,(v.x-125)/110),.7,v.z/70).normalize();v.addScaledVector(n,.18).applyMatrix4(inv);a.setXYZ(i,v.x,v.y,v.z);}a.needsUpdate=true;o.geometry.computeVertexNormals();o.castShadow=false;
 });
 const group=new T.Group();group.name='V32_surface_refinements';const owner=exterior.getObjectByName('01_EXTERIOR_REFINED_V31')||exterior;group.matrixAutoUpdate=false;group.matrix.copy(owner.matrixWorld).invert();owner.add(group);
 const seamMat=new T.MeshStandardMaterial({name:'V32_fine_panel_joint',color:0x627783,roughness:.65,metalness:.3});
 const steel=new T.MeshStandardMaterial({name:'V32_brushed_rim',color:0x7b8d95,roughness:.3,metalness:.8});
 const lamp=new T.MeshStandardMaterial({name:'V32_warm_locator',color:0xe7b66c,emissive:0xf1ae58,emissiveIntensity:.3,roughness:.45});
 const recess=new T.MeshStandardMaterial({name:'V32_engine_service_recess',color:0x142635,roughness:.66,metalness:.3});
 function line(name,points,r,mat=seamMat){if(points.length<2)return;const geo=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(points.length*2,24),r,5,false),o=new T.Mesh(geo,mat);o.name=name;o.castShadow=false;o.receiveShadow=false;group.add(o);}
 // Restrained longitudinal roof joints leave the smooth aft blend uninterrupted.
 for(const z of [-23,23]){const p=[];for(let x=-26;x<=150;x+=2){const y=top(x,z);if(Number.isFinite(y))p.push([x,y+.15,z]);}line('V32_roof_panel_joint',p,.06);}
 for(const s of [-1,1]){
  // Fine continuous rim and regularly spaced docking locators on the lower hull.
  const p=[];for(let x=-115;x<=200;x+=2){const z=side(x,-15);if(Number.isFinite(z))p.push([x,-15,s*(z+.3)]);}line('V32_thermal_belt_trim',p,.12,steel);
  for(let x=-108;x<=177;x+=19){const z=side(x,-14.5);if(!Number.isFinite(z))continue;const o=new T.Mesh(new T.BoxGeometry(1.6,.18,.08),lamp);o.name='V32_docking_locator';o.position.set(x,-14.5,s*(z+.35));group.add(o);}
 }
 for(const sideName of ['Port','Starboard']){
  const pod=exterior.getObjectByName(sideName+'_nacelle');if(!pod)continue;const plate=pod.getObjectByName('Nacelle_exhaust_bulkhead'),bb=new T.Box3().setFromObject(plate),x=bb.min.x-.22,z=(bb.min.z+bb.max.z)/2;
  for(const dz of [-7.5,7.5]){
   const panel=new T.Mesh(new T.BoxGeometry(.12,5.8,8),recess);panel.name='V32_engine_service_panel';panel.position.set(x,5,z+dz);group.add(panel);
   line('V32_engine_service_frame',[[x-.08,2.1,z+dz-4],[x-.08,7.9,z+dz-4],[x-.08,7.9,z+dz+4],[x-.08,2.1,z+dz+4],[x-.08,2.1,z+dz-4]],.08,steel);
   for(const yy of [3.3,4.7,6.1]){const slit=new T.Mesh(new T.BoxGeometry(.08,.22,5.4),steel);slit.name='V32_engine_panel_vent';slit.position.set(x-.12,yy,z+dz);group.add(slit);}
   for(const yy of [2.65,7.35])for(const zz of [-3.5,3.5]){const bolt=new T.Mesh(new T.CylinderGeometry(.15,.15,.13,6),steel);bolt.name='V32_engine_panel_fastener';bolt.rotation.z=Math.PI/2;bolt.position.set(x-.16,yy,z+dz+zz);group.add(bolt);}
  }
 }
 // Separate the nozzle liners from their structural collars and heat shields.
 exterior.traverse(o=>{if(!o.isMesh)return;if(o.name==='Engine_bell'){o.material=o.material.clone();o.material.color.setHex(0x172733);o.material.roughness=.32;o.material.metalness=.8;}if(o.name==='Nozzle_internal_cooling_ring'){o.material=o.material.clone();o.material.color.setHex(0x826c56);o.material.roughness=.4;}if(o.name==='Engine_nozzle_lip'){o.material=o.material.clone();o.material.color.setHex(0xa2adb3);o.material.roughness=.24;}if(o.name==='Aft_service_louver'){o.material=o.material.clone();o.material.color.setHex(0x7b8991);o.material.metalness=.75;}});
 stats.passengerWindows=addPassengerWindows(exterior,hull,side,surfaceIndex);
 exterior.userData={...exterior.userData,revision:'35',scope:'Retained silhouette; projected markings and seams, glazing trim, satin ceramic and thermal finishes, nozzle detailing',surfaceRefinement:stats};exterior.updateMatrixWorld(true);return stats;
}
