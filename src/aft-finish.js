import * as T from 'three';
import {detailKit,FINISH_M as M} from './area-finish.js';
import {finishCirculation} from './circulation-finish.js';
import {polishInterior} from './interior-polish.js';

export function finishAft(parts){
 const report={};
 for(const key of ['drive','tanks','pods','access','fin']){
  const root=parts[key],k=detailKit(root,'Aft '+key),meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  for(const o of meshes){
   const n=o.name,{b,c,s}=k.bounds(o);
   if(/^(Central_drive_train|Drive_coupling|Power_conditioning_drum|Reservoir_tank|Pod_drive_chamber|Pod_feed_drum)$/.test(n)){
    const r=o.geometry.parameters.radiusTop;
    // Barrel bands follow the cylinder's local Y axis and rotate with it.
    for(const t of [-.31,0,.31]){
     const ring=new T.TorusGeometry(r+.008,.032,6,28);ring.rotateX(Math.PI/2);ring.translate(0,s.y*t,0);k.add(o,ring,M.steel,'machinery_bands');
    }
    k.box(o,[.7,.95,.05],[0,0,r+.018],M.dark,'machinery_instruments');
    k.box(o,[.45,.4,.012],[0,.16,r+.05],M.blue,'machinery_instruments');
    for(const x of [-.2,0,.2])k.box(o,[.07,.045,.016],[x,-.25,r+.06],M.amber,'machinery_instruments');
   }
   if(/^(Pod_control_cabinet|Pod_pump_skid|Isolation_manifold)$/.test(n)){
    const f=k.face(o,1);for(let j=0;j<5;j++)f.panel(0,f.h*(-.3+j*.09),f.w*.6,.025,M.dark,'maintenance_controls');
    f.panel(0,f.h*.26,f.w*.38,f.h*.16,M.blue,'maintenance_controls');
   }
   if(/^(Main_coolant_header|Pod_supply_line|Tank_feed|Tank_isolation_drop)$/.test(n)){
    const r=o.geometry.parameters.radiusTop;
    for(const t of [-.3,.3])k.add(o,new T.CylinderGeometry(r+.008,r+.008,Math.min(.3,s.y*.12),12).translate(0,s.y*t,0),M.amber,'pipe_identification');
   }
   if(/^(Fin_front_spar|Fin_rear_spar|Central_hall_frame|Pod_structural_frame|Wing_gallery_frame)$/.test(n)){
    const r=o.geometry.parameters.radiusTop;k.add(o,new T.CylinderGeometry(r+.007,r+.007,.22,10).translate(0,-s.y*.35,0),M.steel,'structural_collars');
   }
   if(n==='Rail_post'){
    const r=o.geometry.parameters.radiusTop;k.add(o,new T.CylinderGeometry(r+.006,r+.006,.12,10).translate(0,s.y*.26,0),M.amber,'rail_markers');
   }
  }
  report[key]=k.finish();
 }
 // Access doors and stairs use the same finish language as the main ship.
 const accessShell=new T.Group();accessShell.name='Aft_access_finish_shell';parts.access.add(accessShell);
 const a=finishCirculation(parts.access,accessShell,'Aft access');report.access={...report.access,...a.features};
 const finShell=new T.Group();finShell.name='Fin_access_finish_shell';parts.fin.add(finShell);
 const f=finishCirculation(parts.fin,finShell,'Fin access');report.fin={...report.fin,...f.features};
 for(const key of ['drive','tanks','pods','access','fin'])polishInterior(parts[key],'Aft '+key);return report;
}
