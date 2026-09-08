import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const mat=(name,color,roughness=.65,metalness=0)=>new T.MeshStandardMaterial({name:'Finish_'+name,color,roughness,metalness});
export const FINISH_M={dark:mat('graphite',0x263d49),steel:mat('alloy',0x97aaa9,.35,.65),oak:mat('oak',0xa98762),linen:mat('linen',0xdedaca,.95),sage:mat('sage',0x668477,1),amber:mat('amber',0xd9b272),blue:mat('clinical_blue',0x89b8c4),ink:mat('display',0xb9e2dc),green:mat('leaf',0x58825f,.95)};
const M=FINISH_M;
// Batch fine details in their source item's coordinate system. Keeping the
// source transform also keeps rotated consoles, cabins and machinery aligned.
export function detailKit(root,label,spatial=false){
 root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),batches=new Map(),features={};
 function add(o,g,m,f){o.updateWorldMatrix(true,false);g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));const e=o.matrixWorld.elements,cell=spatial?'|'+[Math.floor(e[12]/50),Math.floor(e[13]/4),Math.floor(e[14]/25)].join(','):'';const key=f+'|'+m.name+cell;if(!batches.has(key))batches.set(key,{m,f,gs:[]});batches.get(key).gs.push(g);features[f]=(features[f]||0)+1;}
 const box=(o,size,p,m,f)=>add(o,new T.BoxGeometry(...size).translate(...p),m,f);
 function bounds(o){o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;return {b,c:b.getCenter(new T.Vector3()),s:b.getSize(new T.Vector3())};}
 function face(o,side){
  const {c,s}=bounds(o),axis=s.x<=s.y&&s.x<=s.z?'x':s.y<=s.z?'y':'z',u=axis==='x'?'z':'x',v=axis==='y'?'z':'y',sign=side??(axis==='x'?-1:1);
  function panel(a,b,w,h,m,f){const p=c.clone(),size=new T.Vector3();p[u]+=a;p[v]+=b;p[axis]+=(s[axis]/2+.004)*sign;size[u]=w;size[v]=h;size[axis]=.006;box(o,size.toArray(),p.toArray(),m,f);}
  return {w:s[u],h:s[v],panel,axis};
 }
 function finish(){for(const {m,f,gs} of batches.values()){const g=mergeGeometries(gs);gs.forEach(g=>g.dispose());const o=new T.Mesh(g,m);o.name='Refined_'+f;o.receiveShadow=true;root.add(o);}root.userData.refinement={revision:1,label,features};return features;}
 return {add,box,bounds,face,finish,features};
}
export const AREA_TREATMENTS={cargo:'cargo_restraints',stores:'inventory_labels',cold:'cabinet_hardware',pharmacy:'inventory_labels',workshop:'tool_storage',community:'tool_storage',logistics:'display_graphics',control:'display_graphics',arrival:'upholstery',security:'screening_equipment',airlock:'locker_hardware',baggage:'conveyor_detail',farm:'grow_lighting',nursery:'grow_lighting',harvest:'wash_station',kitchen:'cookware',air:'machine_grilles',thermal:'machine_grilles',water:'vessel_instruments',recycle:'machine_grilles',power:'cabinet_hardware',ward:'patient_services',isolation:'patient_services',surgery:'patient_services',clinic:'patient_services',imaging:'diagnostic_detail',counseling:'upholstery',shelter:'upholstery',classroom:'desk_equipment',library:'inventory_labels',gym:'fitness_equipment',recreation:'games',theater:'upholstery',childcare:'play_furniture',dining:'table_settings',navigation:'display_graphics',mission:'display_graphics',communications:'display_graphics',crew:'table_settings',briefing:'table_settings',data:'rack_hardware',captain:'table_settings',securityops:'display_graphics',bridge:'display_graphics',reactor:'module_instruments',drivefeed:'pump_detail',enginecontrol:'display_graphics',engineworkshop:'workbench_detail',engineaccess:'hatch_detail',hangar:'shuttle_detail',lifeboats:'lifeboat_detail'};
export function finishShipArea(area,{root,shell,fit}){
 const k=detailKit(fit,area.name),lining=detailKit(shell,area.name+' lining');
 const clinical=['ward','surgery','isolation','clinic','imaging','pharmacy'].includes(area.kind),social=['arrival','counseling','classroom','library','theater','childcare','dining','crew','briefing','captain','shelter'].includes(area.kind),accent=clinical?M.blue:social?M.sage:M.amber;
 const sources=[],modified={};fit.traverse(o=>{if(o.isMesh)sources.push(o);});
 function round(o,f){const p=o.geometry.parameters;if(!p.width)return;o.geometry=new RoundedBoxGeometry(p.width,p.height,p.depth,1,Math.min(.055,p.height*.2,p.width*.15,p.depth*.15));o.material=accent;modified[f]=(modified[f]||0)+1;}
 for(const o of sources){
  const n=o.name,{b,c,s}=k.bounds(o);
  if(/^(Seat|Back|Seat_cushion|Seat_back|Passenger_bench|Passenger_bench_back|Shelter_bench|Evacuation_seat|Evacuation_seat_back)$/.test(n))round(o,'upholstery');
  if(/^(Low_bench|Activity_table|Play_block)$/.test(n))round(o,'play_furniture');
  if(/^(Mattress|Blanket|Pillow)$/.test(n)){round(o,'patient_services');o.material=n==='Blanket'?M.blue:M.linen;}
  if(o.isInstancedMesh)continue;
  if(/^(Display|Status_display|Patient_monitor|Fitness_display|Systems_wall_display|Teaching_screen|Projection_screen|Raised_display|Touchscreen|Mission_display_wall|Briefing_wall|Propulsion_status_wall|Hatch_monitor|Module_instrument_panel)$/.test(n)){
   const f=k.face(o);for(let j=0;j<4;j++)f.panel(-f.w*.12,f.h*(.28-j*.16),f.w*(.58-j*.08),f.h*.035,M.ink,'display_graphics');f.panel(f.w*.33,0,f.w*.05,f.h*.65,accent,'display_graphics');
  }
  if(/^(Worktop|Console_body|Command_arm_console)$/.test(n)){
   k.box(o,[s.x*.56,.022,s.z*.2],[c.x,b.max.y+.015,c.z+s.z*.2],M.dark,'desk_equipment');
   for(let j=0;j<4;j++)k.box(o,[s.x*.085,.025,s.z*.13],[c.x+s.x*(-.20+j*.13),b.max.y+.035,c.z+s.z*.2],M.steel,'desk_equipment');
  }
  if(/^(Shared_table|Meeting_table|Crew_lounge_table)$/.test(n)&&['dining','crew','briefing','captain'].includes(area.kind))for(const dx of [-.25,.25]){
   k.box(o,[Math.min(.65,s.x*.2),.018,Math.min(.4,s.z*.3)],[c.x+dx*s.x,b.max.y+.013,c.z],M.linen,'table_settings');k.add(o,new T.CylinderGeometry(.065,.065,.11,12).translate(c.x+dx*s.x,b.max.y+.072,c.z+.11),M.steel,'table_settings');
  }
  if(/^(Secured_cargo_container|Supply_crate|Book_stack)$/.test(n)){
   const f=k.face(o,1),type=n==='Secured_cargo_container'?'cargo_restraints':'inventory_labels';f.panel(-f.w*.2,0,f.w*.24,f.h*.26,M.linen,type);
   for(let j=0;j<5;j++)f.panel(f.w*(-.29+j*.043),0,f.w*.018,f.h*.17,M.dark,type);
   if(n==='Secured_cargo_container')for(const v of [-.4,.4])f.panel(f.w*v,0,f.w*.025,f.h*.82,M.steel,type);
  }
  if(/^(Insulated_storage|Equipment_cabinet|Power_distribution_cabinet|Coolant_control_cabinet|Suit_locker|Crew_locker|Secure_equipment_locker|Life_support_locker)$/.test(n)){
   const f=k.face(o,1),type=n==='Suit_locker'?'locker_hardware':n==='Life_support_locker'?'lifeboat_detail':'cabinet_hardware';f.panel(f.w*.36,0,.025,Math.min(.35,f.h*.2),M.steel,type);
   for(let j=0;j<5;j++)f.panel(0,f.h*(-.3+j*.045),f.w*.64,.013,M.dark,type);
  }
  if(/^(Tool_board|Engine_workbench|Machine_tool|Maintenance_staging|Engine_inspection_hatch|Rack_module)$/.test(n)){
   const f=k.face(o),type=n==='Tool_board'?'tool_storage':n==='Rack_module'?'rack_hardware':n==='Engine_inspection_hatch'?'hatch_detail':'workbench_detail';
   for(const a of [-.35,.35])for(const v of [-.33,.33])f.panel(f.w*a,f.h*v,Math.min(.05,f.w*.07),Math.min(.05,f.h*.12),M.steel,type);f.panel(0,0,f.w*.52,Math.min(.03,f.h*.15),M.dark,type);
  }
  if(n==='Scanner_crossbar'){const f=k.face(o);f.panel(0,0,f.w*.65,f.h*.16,M.blue,'screening_equipment');}
  if(n==='Baggage_conveyor'||n==='Tray_conveyor')for(let j=0;j<24;j++)k.box(o,[s.x*.002,.006,s.z*.91],[b.min.x+s.x*(j+.5)/24,b.max.y+.005,c.z],M.steel,'conveyor_detail');
  if(n==='Grow_tray'){
   k.box(o,[s.x*.9,.015,.025],[c.x,b.max.y+.018,b.min.z+.035],M.blue,'grow_lighting');k.box(o,[s.x*.8,.026,.10],[c.x,b.max.y+.57,c.z],M.linen,'grow_lighting');
  }
  if(n==='Leaf_cluster'){o.geometry=new T.SphereGeometry(.2,7,5);o.scale.set(1,.75,1);o.material=M.green;modified.grow_lighting=(modified.grow_lighting||0)+1;}
  if(n==='Wash_sink'){k.box(o,[s.x*.82,.012,s.z*.68],[c.x,b.max.y+.008,c.z],M.dark,'wash_station');k.box(o,[.045,.24,.045],[c.x,b.max.y+.12,b.min.z+.07],M.steel,'wash_station');}
  if(n==='Cooking_pot')for(const v of [-1,1])k.box(o,[.16,.045,.08],[c.x+v*(s.x/2+.045),c.y,c.z],M.dark,'cookware');
  if(/^(Air_handling_unit|Heat_exchanger|Recovery_machine|Shielded_power_module|Pump_skid|Drive_feed_pump)$/.test(n)){
   const f=k.face(o,1),type=n==='Shielded_power_module'?'module_instruments':/Pump|pump/.test(n)?'pump_detail':'machine_grilles';
   for(let j=0;j<7;j++)f.panel(f.w*(-.3+j*.1),0,f.w*.035,f.h*.6,M.dark,type);f.panel(f.w*.28,f.h*.32,f.w*.12,f.h*.12,M.blue,type);
  }
  if(n==='Water_treatment_vessel'){k.box(o,[.28,.42,.025],[c.x,c.y,b.max.z+.007],M.dark,'vessel_instruments');k.box(o,[.12,.25,.029],[c.x,c.y,b.max.z+.023],M.blue,'vessel_instruments');}
  if(n==='Patient_bed_base')for(const v of [-1,1])k.box(o,[.035,.18,s.z*.66],[c.x+v*s.x*.46,b.max.y+.09,c.z],M.steel,'patient_services');
  if(n==='Diagnostic_scanner'){const f=k.face(o);for(let j=0;j<5;j++)f.panel(0,f.h*(-.18+j*.09),f.w*.14,.025,M.blue,'diagnostic_detail');}
  if(n==='Treadmill'){k.box(o,[s.x*.77,.006,s.z*.76],[c.x,b.max.y+.005,c.z],M.dark,'fitness_equipment');for(const v of [-1,1])k.box(o,[.025,.008,s.z*.78],[c.x+v*s.x*.39,b.max.y+.008,c.z],M.amber,'fitness_equipment');}
  if(n==='Game_board')for(let ix=0;ix<6;ix++)for(let iz=0;iz<6;iz++)if((ix+iz)%2===0)k.box(o,[s.x/6,.007,s.z/6],[b.min.x+s.x*(ix+.5)/6,b.max.y+.004,b.min.z+s.z*(iz+.5)/6],M.linen,'games');
  if(n==='Shuttle_boarding_door'||n==='Lifeboat_helm'){const f=k.face(o),type=n==='Lifeboat_helm'?'lifeboat_detail':'shuttle_detail';f.panel(0,0,f.w*.67,f.h*.45,M.dark,type);f.panel(0,f.h*.08,f.w*.5,f.h*.045,M.blue,type);}
 }
 const ws=[];shell.traverse(o=>{if(o.isMesh)ws.push(o);});
 for(const o of ws)if(/wall|partition|bulkhead/i.test(o.name)&&o.geometry.parameters.width)for(const sign of [-1,1]){const f=lining.face(o,sign);if(f.h>=1&&f.w>=1)f.panel(0,-f.h*.25,f.w*.94,.08,accent,'wall_trim');}
 const features=k.finish();for(const [f,n]of Object.entries(modified))features[f]=(features[f]||0)+n;lining.finish();
 root.userData.refinement={revision:1,kind:area.kind,treatment:AREA_TREATMENTS[area.kind],features};return root.userData.refinement;
}
