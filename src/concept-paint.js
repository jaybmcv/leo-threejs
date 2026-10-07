import * as T from 'three';

// Brings the saved exterior's finish closer to the concept sheet without touching its geometry: cool lavender-grey
// ceramic, indigo slate navy, and passenger windows that read as quiet pale panes instead of dark openings.
const HULL={V32_Ceramic_satin:[0xb8bbc6,.42,.14],V32_Thermal_navy:[0x262d3f,.42,.32],V32_Thermal_service_panels:[0x2f3749,.52,.36],V32_Ceramic_access_panels:[0xb3b7c3,.5,.26],V32_Dorsal_service_covers:[0xb7bbc6,.48,.24],
 // The sheet's hull is covered in crisp dark panel lines; the saved seams are a mid grey that barely shows on the ceramic.
 V32_Panel_reveal:[0x394355,.72,.12],V32_fine_panel_joint:[0x394355,.72,.12],
 // Its windows are slim light dashes that recede into the hull, so the frames take the ceramic's tone, not bright alloy.
 V33_window_frames:[0xa4aab7,.48,.18]};
const PASSENGER_GLASS=/^V3[345]_(fin_|pod_outer_|pod_inner_)?passenger_glazing$/,BOW_GLASS=/^(Forward_observation_panes|Forward_side_vent_glass|Forward_navigation_sensor_glass)$/;
// Panes above the navy waterline read pale, as on the sheet; those set into the navy keep a dark tint so the lower hull
// stays one plain band. Each vertex carries its colour, so this is decided once at load.
const PANE=[new T.Color(0x9ba5b5),new T.Color(0x1e2a3b)],REVEAL=[new T.Color(0x8a92a1),new T.Color(0x233c4a)],WATERLINE_BIN=10;
const paneGlass=new T.MeshPhysicalMaterial({name:'LEO_glass_concept_pane',vertexColors:true,roughness:.32,metalness:.3,transparent:true,opacity:.94,side:T.FrontSide,depthWrite:false});
const bowGlass=new T.MeshPhysicalMaterial({name:'LEO_glass_concept_bow',color:0x2c4566,roughness:.1,metalness:.3,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.92,side:T.FrontSide,depthWrite:false});
const reveal=new T.MeshStandardMaterial({name:'LEO_concept_window_reveal',vertexColors:true,roughness:.6,side:T.DoubleSide});
// The fin cap's outer skin uses the crown lounge's ceramic; match it to the hull so the cap doesn't glow from above.
const CROWN_SKIN=/^(Crown_roof|Crown_window_header|Fin_cap_retained_white_underside|Crown_white_underfloor_rim|Crown_underfloor_closure)$/;
// On the sheet each engine pod is navy along its lower part; the saved shell only has a thin navy belly.
const POD_NAVY_SHARE=.5;
// The pod sides are nearly flat, so a satin navy mirrors the key light straight back in side-on views; matte tiles don't.
const POD_NAVY_ROUGHNESS=.72;
// The sheet's small orange markers catch the eye; a faint glow keeps ours visible against the darker ceramic.
const AMBER_GLOW=0xd9822f,AMBER_GLOW_INTENSITY=.45;

function splitPodPaint(material,line){
 const pod=material.clone();pod.name=material.name+'_pod_split';
 pod.onBeforeCompile=shader=>{
  const [navy,,metalness]=HULL.V32_Thermal_navy;
  Object.assign(shader.uniforms,{podLine:{value:line},podNavy:{value:new T.Color(navy)},podNavyFinish:{value:new T.Vector2(POD_NAVY_ROUGHNESS,metalness)}});
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vPodY;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPodY=(modelMatrix*vec4(transformed,1.)).y;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float podLine;uniform vec3 podNavy;uniform vec2 podNavyFinish;varying float vPodY;').replace('#include <color_fragment>','#include <color_fragment>\nif(vPodY<podLine)diffuseColor.rgb=podNavy;')
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nif(vPodY<podLine)roughnessFactor=podNavyFinish.x;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nif(vPodY<podLine)metalnessFactor=podNavyFinish.y;');
 };
 pod.customProgramCacheKey=()=>'leo-pod-split';
 return pod;
}

function podShells(exterior){
 return ['Port_nacelle','Starboard_nacelle'].map(side=>{
  const shells=[];exterior.getObjectByName(side)?.traverse(o=>{if(o.isMesh&&o.name==='Sculpted_nacelle_shell')shells.push(o);});
  const box=new T.Box3();for(const o of shells)box.expandByObject(o);
  return {shells,line:box.min.y+POD_NAVY_SHARE*(box.max.y-box.min.y)};
 }).filter(p=>p.shells.length);
}

function paintPods(pods){
 for(const {shells,line} of pods)for(const o of shells){const split=m=>m.name==='V32_Ceramic_satin'?splitPodPaint(m,line):m;o.material=Array.isArray(o.material)?o.material.map(split):split(o.material);}
}

function navyWaterline(exterior){
 const top=new Map(),v=new T.Vector3();
 exterior.traverse(o=>{if(!o.isMesh||!/^Smooth_pressure_envelope/.test(o.name))return;const mats=Array.isArray(o.material)?o.material:[o.material];if(!mats.some(m=>m.name==='V32_Thermal_navy'))return;
  const p=o.geometry.attributes.position,groups=Array.isArray(o.material)?o.geometry.groups.filter(g=>o.material[g.materialIndex].name==='V32_Thermal_navy'):[{start:0,count:o.geometry.index?.count??p.count}],ix=o.geometry.index;
  for(const g of groups)for(let i=g.start;i<g.start+g.count;i++){v.fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(o.matrixWorld);const k=Math.round(v.x/WATERLINE_BIN);top.set(k,Math.max(top.get(k)??-Infinity,v.y));}
 });
 return x=>top.get(Math.round(x/WATERLINE_BIN))??-Infinity;
}

// [on ceramic, on navy]; the reveals around each pane follow the same line, since they show through the glass.
function tintByWaterline(mesh,waterline,[onCeramic,onNavy]){
 const p=mesh.geometry.attributes.position,colors=new Float32Array(p.count*3),v=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);const c=v.y<waterline(v.x)+.5?onNavy:onCeramic;colors.set([c.r,c.g,c.b],i*3);}
 mesh.geometry.setAttribute('color',new T.BufferAttribute(colors,3));
}

export function applyConceptPaint(exterior){
 exterior.updateMatrixWorld(true);
 const seen=new Map(),waterline=navyWaterline(exterior),pods=podShells(exterior),podLine=Math.max(...pods.map(p=>p.line));
 // Clones are cached per source material and palette entry, so shared materials stay shared.
 const repaint=(m,key=m.name)=>{
  const p=HULL[key];if(!p&&key!=='V32_Amber_markers')return m;const id=m.uuid+key;
  if(!seen.has(id)){const n=m.clone();if(p){n.color.setHex(p[0]);n.roughness=p[1];n.metalness=p[2];}else{n.emissive.setHex(AMBER_GLOW);n.emissiveIntensity=AMBER_GLOW_INTENSITY;}seen.set(id,n);}
  return seen.get(id);
 };
 exterior.traverse(o=>{
  if(!o.isMesh)return;
  // Only the outward-facing glass half changes, so the view out from inside the ship is unchanged. The saved GLB
  // splits each glazing mesh into one child per material; the file: build keeps them as a material array.
  const glass=PASSENGER_GLASS.test(o.name)?paneGlass:BOW_GLASS.test(o.name)?bowGlass:null;
  // Fin windows all sit in ceramic; the hull's lower decks and the pods' lower windows run below a navy line.
  const line=/^V33_/.test(o.name)?waterline:/_pod_/.test(o.name)?()=>podLine:()=>-Infinity;
  if(/^V3[345]_(fin_|pod_outer_|pod_inner_)?passenger_window_reveals$/.test(o.name)){tintByWaterline(o,line,REVEAL);o.material=reveal;return;}
  if(glass===paneGlass)tintByWaterline(o,line,PANE);
  const swap=m=>glass&&m.name==='LEO_glass_exterior_tint'?glass:CROWN_SKIN.test(o.name)&&m.name==='Crown ceramic_polished'?repaint(m,'V32_Ceramic_satin'):repaint(m);
  o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);
 });
 paintPods(pods);
}
