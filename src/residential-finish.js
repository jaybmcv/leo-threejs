import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {polishInterior} from './interior-polish.js';

// Finishes stay inside the accepted cabin envelope and repeat with its instances.
export function finishCabin({walls,fittings,x,y,z,box:rawBox,material}){
 const box=(name,size,pos,mat,parent=fittings)=>rawBox(name,size,pos,mat,parent);
 const oak=material('Residential_oak',0xa98762,{roughness:.65,metalness:0});
 const felt=material('Residential_sage_felt',0x688477,{roughness:1,metalness:0});
 const linen=material('Residential_warm_linen',0xe7dcc7,{roughness:1,metalness:0});
 const ink=material('Residential_graphite',0x273e49,{roughness:.45,metalness:.25});
 const brass=material('Residential_satin_brass',0xb69a68,{roughness:.35,metalness:.6});
 const glow=material('Residential_warm_diffuser',0xffe8be,{emissive:0xffd598,emissiveIntensity:.7,roughness:.6,metalness:0});
 const round=(name,size,pos,mat,parent=fittings,r=.04)=>{const o=new T.Mesh(new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(v=>v*.45))),mat);o.name=name;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 for(const parent of [walls,fittings])parent.traverse(o=>{
  if(!o.isMesh)return;
  if(/^(Single_bed_base|Single_mattress|Bed_cover|Pillow|Personal_shelf|Shared_desk|Storage)$/.test(o.name)){
   const p=o.geometry.parameters;o.geometry=new RoundedBoxGeometry(p.width,p.height,p.depth,2,Math.min(.07,p.height*.4));
   if(/mattress|Pillow/.test(o.name))o.material=linen;
   if(o.name==='Bed_cover')o.material=felt;
   if(/shelf|desk/.test(o.name))o.material=oak;
  }
 });
 for(const s of [-1,1]){
  round('Upholstered_headboard',[1.05,.9,.12],[x+s*1.38,y+1.02,z+1.79],felt);
  round('Bed_storage_drawer',[.025,.25,1.6],[x+s*.865,y+.23,z+.65],oak);
  round('Bed_drawer_pull',[.045,.035,.28],[x+s*.843,y+.29,z+.65],brass);
  round('Bedside_controls',[.19,.29,.025],[x+s*1.72,y+1.38,z+1.708],ink);
  round('Reading_light_mount',[.15,.15,.04],[x+s*1.38,y+1.96,z+1.8],brass);
  round('Reading_light',[.38,.055,.13],[x+s*1.38,y+1.91,z+1.74],glow);
  // Clear 1.4 m doorway; trim follows the jamb, never crosses the opening.
  box('Oak_door_architrave',[.085,2.4,.08],[x+s*.765,y+1.2,z-2.96],oak,walls);
  box('Cabin_skirting',[.035,.12,5.8],[x+s*1.983,y+.06,z],oak,walls);
  box('Ceiling_cove_housing',[.14,.12,5.65],[x+s*1.88,y+3.06,z],ink,walls);
  box('Ceiling_cove_diffuser',[.095,.025,5.5],[x+s*1.88,y+2.989,z],glow,walls);
 }
 box('Oak_door_header',[1.615,.085,.08],[x,y+2.405,z-2.96],oak,walls);
 round('Door_control_panel',[.16,.27,.035],[x-.96,y+1.25,z-2.975],ink,walls);
 round('Door_status_light',[.08,.025,.04],[x-.96,y+1.34,z-2.95],glow,walls);
 box('Desk_back_panel',[1.85,.85,.05],[x,y+1.32,z+2.97],oak);
 box('Desk_pinboard',[1.55,.5,.035],[x,y+1.43,z+2.935],felt);
 box('Desk_task_light',[1.65,.045,.13],[x,y+1.9,z+2.83],glow);
 for(const s of [-1,1])box('Desk_leg',[.055,.72,.4],[x+s*.78,y+.36,z+2.72],ink);
 round('Wardrobe_front',[.6,2.12,.035],[x-1.55,y+1.1,z-1.977],oak);
 round('Wardrobe_handle',[.035,.32,.035],[x-1.36,y+1.13,z-1.945],brass);
 box('Wardrobe_top_reveal',[.55,.018,.04],[x-1.55,y+1.89,z-1.955],ink);
 for(let i=0;i<4;i++)box('Wardrobe_vent',[.28,.012,.008],[x-1.55,y+.24+i*.045,z-1.954],ink);
 round('Cabin_runner',[1.05,.014,2.5],[x,y+.01,z+.15],material('Residential_carpet',0x9b9b88,{roughness:1,metalness:0}),fittings,.006);
 round('Ensuite_mirror',[.025,.7,.43],[x+.531,y+1.64,z-2.24],material('Residential_mirror',0xb7cacf,{metalness:.95,roughness:.08}));
 round('Ensuite_mirror_light',[.035,.055,.47],[x+.55,y+2.04,z-2.24],glow);
 round('Towel_rail',[.035,.035,.48],[x+.555,y+.95,z-2.15],brass);
 round('Folded_towel',[.035,.35,.31],[x+.58,y+.8,z-2.15],linen);
 polishInterior(fittings,'Twin cabin furnishings');polishInterior(walls,'Twin cabin lining');
}
