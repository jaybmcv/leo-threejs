import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const seam=new T.MeshStandardMaterial({name:'Polish_tailored_seam',color:0xa1b4a7,roughness:1});
const trim=new T.MeshStandardMaterial({name:'Polish_satin_edge',color:0x819b9f,roughness:.29,metalness:.65});
const ink=new T.MeshStandardMaterial({name:'Polish_recess',color:0x162e3b,roughness:.66});
const warm=new T.MeshStandardMaterial({name:'Polish_warm_wayfinder',color:0xe5cf9b,emissive:0xffd5a1,emissiveIntensity:.28,roughness:.6});
const cushion=/seat|cushion|pillow|mattress|headboard|banquette|soft_back|padded_arm|bed_cover|blanket/i;
const joinery=/cabinet|locker|crate|container|counter|worktop|table|desk|shelf|drawer|wardrobe|planter|bench|console_body|bed_base|machine|pump_skid|handling_unit|exchanger|module|tool_board|play_block|treadmill|scanner/i;
const display=/display|touchscreen|monitor|instrument_panel|call_panel|control_panel|bedside_controls/i;

// Source-relative details travel with their fixture, including mirrored cabins.
// No finish changes a floor, stair, doorway or the accepted room footprint.
export function polishInterior(root,label){
 if(root.userData.polish)return root.userData.polish;
 root.updateWorldMatrix(true,true);const inv=root.matrixWorld.clone().invert(),meshes=[],batches=new Map(),materials=new Map(),report={label,revision:2,softenedFixtures:0,tailoredSeams:0,instrumentBezels:0,metalCollars:0,materialFinishes:0};
 root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!o.name.startsWith('Polish_'))meshes.push(o);});
 function add(o,size,p,mat,feature){const g=new T.BoxGeometry(...size).translate(...p).applyMatrix4(inv.clone().multiply(o.matrixWorld));const wp=o.getWorldPosition(new T.Vector3()),key=feature+'|'+[Math.floor(wp.x/40),Math.floor(wp.y/4),Math.floor(wp.z/20)].join(',');if(!batches.has(key))batches.set(key,{mat,feature,gs:[]});batches.get(key).gs.push(g);}
 for(const o of meshes){
  const n=o.name,p=o.geometry.parameters||{};
  if(p.width&&(cushion.test(n)||joinery.test(n))&&!/wall|ceiling|floor|roof|glazing|window|light|barrier|frame|refined_/i.test(n)){
   const r=Math.min(cushion.test(n)?.045:.025,p.width*.15,p.height*.18,p.depth*.15);if(r>.002){o.geometry=new RoundedBoxGeometry(p.width,p.height,p.depth,2,r);report.softenedFixtures++;}
  }
  if(!/glass|glazing|light|diffuser|screen/i.test(n)){
   const source=Array.isArray(o.material)?o.material:[o.material];o.material=source.map(m=>{if(m.transparent)return m;if(materials.has(m))return materials.get(m);const a=m.clone();a.name=m.name+'_polished';if(/fabric|felt|upholstery|linen|sage|carpet/.test(m.name))a.roughness=.96;else if(/wood|oak|timber/i.test(m.name)){a.roughness=.58;a.metalness=0;}else if(/metal|alloy|bronze|brass/i.test(m.name)){a.roughness=.32;a.metalness=.65;}else if(/lining|white|ceramic|stone/i.test(m.name)){a.roughness=.58;a.metalness=.04;}materials.set(m,a);report.materialFinishes++;return a;});if(!Array.isArray(o.material)||o.material.length===1)o.material=o.material[0];
  }
  o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,s=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());
  if(cushion.test(n)&&p.width&&s.x>.3&&s.z>.25&&s.y<.8){
   const inset=Math.min(.075,s.z*.12);for(const z of [b.min.z+inset,b.max.z-inset])add(o,[s.x*.86,.003,.008],[c.x,b.max.y-.002,z],seam,'tailored_seam');report.tailoredSeams+=2;
  }
  if(display.test(n)&&!n.startsWith('Refined_')){
   const axis=s.x<=s.y&&s.x<=s.z?'x':s.y<=s.z?'y':'z',u=axis==='x'?'z':'x',v=axis==='y'?'z':'y';
   for(const sign of [-1,1])for(const [which,offset]of [[u,-.46],[u,.46],[v,-.43],[v,.43]]){const size=new T.Vector3(),pos=c.clone();pos[axis]+=sign*(s[axis]/2+.002);pos[which]+=s[which]*offset;size[axis]=.003;size[which]=.015;size[which===u?v:u]=s[which===u?v:u]*.9;add(o,size.toArray(),pos.toArray(),trim,'instrument_bezel');report.instrumentBezels++;}
  }
  if(/^(Rail_post|Handrail_post|Seat_pedestal|Table_pedestal|Crown_bar_stool_stem)$/.test(n)&&p.radiusTop){
   const ring=new T.TorusGeometry(p.radiusTop+.002,.012,6,16);ring.rotateX(Math.PI/2);ring.translate(0,-s.y*.32,0);ring.applyMatrix4(inv.clone().multiply(o.matrixWorld));const key='metal_collar|'+Math.floor(o.position.y/4);if(!batches.has(key))batches.set(key,{mat:trim,feature:'metal_collar',gs:[]});batches.get(key).gs.push(ring);report.metalCollars++;
  }
  if(/^(Stair_tread_up|Stair_tread_return|Aft_stair_up|Aft_stair_return|Gallery_stair)$/.test(n)){
   for(const x of [b.min.x+.09,b.max.x-.09])add(o,[.045,.004,s.z*.75],[x,b.max.y+.002,c.z],warm,'stair_edge_marker');report.stairMarkers=(report.stairMarkers||0)+2;
  }
  if(/^(Closed_lift_landing_door|Aft_lift_landing_door|Crown_lift_platform_door)$/.test(n)){
   const axis=s.x<s.z?'x':'z',u=axis==='x'?'z':'x';for(const sign of [-1,1]){const size=new T.Vector3(.015,s.y*.88,.015),pos=c.clone();size[u]=.018;pos[axis]+=sign*(s[axis]/2+.002);add(o,size.toArray(),pos.toArray(),ink,'lift_door_reveal');}report.liftReveals=(report.liftReveals||0)+2;
  }
 }
 for(const {mat,feature,gs}of batches.values()){const m=new T.Mesh(mergeGeometries(gs),mat);m.name='Polish_'+feature;m.castShadow=false;m.receiveShadow=true;root.add(m);gs.forEach(g=>g.dispose());}
 root.userData.polish=report;return report;
}
