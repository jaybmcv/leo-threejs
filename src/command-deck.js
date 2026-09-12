import * as T from 'three';
import {serviceKit,SERVICE_M as M} from './neighborhood-services.js';
import {finishShipArea,detailKit,FINISH_M} from './area-finish.js';
import {fixtureText} from './circulation-finish.js';
const COMMAND_LIGHT=new T.MeshStandardMaterial({name:'Command cool instrument light',color:0xb8e3ed,emissive:0x7eb7cb,emissiveIntensity:.45,roughness:.5});
const RECOVERY_LIGHT=new T.MeshStandardMaterial({name:'Command warm lounge light',color:0xffe2b7,emissive:0xe9bb7c,emissiveIntensity:.35,roughness:.6});
export const COMMAND_AFT_AREAS=[
 {id:'d20-planning-aft',name:'Mission planning studio',kind:'briefing',side:-1,description:'A collaborative planning table, navigation review stations and a mission wall for detailed work away from the bridge.'},
 {id:'d20-recovery-aft',name:'Crew recovery lounge',kind:'crew',side:1,description:'Quiet upholstered seating, a refreshment counter and small conversation tables for command crew between shifts.'},
].map(a=>({...a,deck:20,commandAft:true,special:true,category:'Command & operations',center:[-90,36.3,a.side*15],width:52,depth:20,height:3.5}));
export function createCommandAft(area){
 const root=new T.Group();root.name='Area_'+area.id;root.userData={...area};const {fit,shell,box,text}=serviceKit(root,area.center),s=area.side;
 box('Finished_floor',[52,.02,20],[0,-.01,0],M.floor);box('Ceiling',[52,.1,20],[0,3.4,0],M.wall,shell);
 for(const sign of [-1,1])box('Room_end_wall',[.16,3.4,20],[sign*25.92,1.7,0],M.wall,shell);
 box('Outboard_wall',[52,3.4,.16],[0,1.7,s*9.92],M.wall,shell);
 for(const sign of [-1,1])box('Entry_wall',[24,3.4,.16],[sign*14,1.7,-s*9.92],M.wall,shell);
 box('Entry_header',[4,.8,.16],[0,3,-s*9.92],M.blue,shell);
 text(area.name.toUpperCase(),[0,2.6,s*9.78],s<0?0:Math.PI,.28);
 for(const x of [-20,-10,0,10,20])for(const z of [-6,6])box('Ceiling_light',[5,.04,.18],[x,3.27,z],M.light,shell);
 function chair(x,z,r=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=r;fit.add(g);box('Seat_cushion',[.8,.18,.8],[0,.48,0],M.blue,g);box('Seat_back',[.8,.65,.13],[0,.86,.34],M.blue,g);box('Seat_pedestal',[.2,.39,.2],[0,.195,0],M.metal,g);}
 function table(x,z,len){box('Meeting_table',[len,.1,1.7],[x,.8,z],M.wood);for(const dx of [-len*.3,len*.3])box('Table_support',[.15,.75,1.2],[x+dx,.375,z],M.metal);}
 if(s<0){
  table(-13,0,14);for(const x of [-18,-15,-12,-9])for(const z of [-2.2,2.2])chair(x,z,z<0?Math.PI:0);
  box('Briefing_wall',[15,1.5,.1],[-13,1.8,-9.7],M.dark);
  for(const x of [9,18]){table(x,-5,5);chair(x,-3);box('Raised_display',[2,.6,.08],[x,1.25,-5],M.dark);table(x,5,5);chair(x,7);box('Raised_display',[2,.6,.08],[x,1.25,5],M.dark);}
 }else{
  for(const x of [-19,-11,10,19]){table(x,0,4);for(const z of [-2,2]){chair(x-1,z,z<0?Math.PI:0);chair(x+1,z,z<0?Math.PI:0);}}
  box('Refreshment_counter',[12,.9,1.3],[-13,.45,8.4],M.wood);box('Coffee_machine',[.9,.65,.7],[-15,1.225,8.4],M.metal);
  for(const x of [8,14,20]){box('Passenger_bench',[4,.45,.85],[x,.225,8],M.wood);box('Seat_cushion',[3.9,.14,.8],[x,.52,8],M.blue);box('Seat_back',[3.9,.65,.16],[x,.91,8.34],M.blue);}
 }
 // Each room owns its short doorway link. Port additionally owns the shared
 // aft spine, which meets the existing command corridor at x=-52.
 box('Command_entry_floor',[4,.02,1],[0,-.01,-s*10.5],M.floor);
 box('Command_entry_ceiling',[4,.1,1],[0,3.4,-s*10.5],M.wall,shell);
 for(const x of [-2.08,2.08])box('Command_entry_wall',[.16,3.4,1],[x,1.7,-s*10.5],M.wall,shell);
 if(s<0){
  box('Command_spine_floor',[64,.02,8],[6,-.01,15],M.floor);box('Command_spine_ceiling',[64,.1,8],[6,3.4,15],M.wall,shell);
  box('Command_aft_bulkhead',[.16,3.4,8],[-25.92,1.7,15],M.wall,shell);
  for(const z of [10.92,19.08])for(const [a,b]of [[-26,-2],[2,38]])box('Command_spine_wall',[b-a,3.4,.16],[(a+b)/2,1.7,z],M.wall,shell);
  for(const x of [-20,-8,6,20,32])box('Ceiling_light',[5,.04,.16],[x,3.27,15],M.light,shell);
 }
 finishShipArea(area,{root,fit,shell});return {root,fit,shell,overview:{position:[-41,96,s*79],target:area.center},inside:{position:[-90,38,s*7],target:[-105,37.8,s*15]}};
}
export function polishCommandRoom(area,result){
 const {root,fit,shell}=result;root.updateMatrixWorld(true);const k=detailKit(fit,'Deck 20 command finish'),sources=[];root.traverse(o=>{if(o.isMesh)sources.push(o);});
 let surfaces=0;
 const restful=['crew','captain'].includes(area.kind),light=restful?RECOVERY_LIGHT:COMMAND_LIGHT;
 for(const o of sources){
  const n=o.name;
  if(/Ceiling|wall|lining|Finished_floor|Bridge_floor|Seat_cushion|Seat_back|Console_body|Meeting_table|Refreshment_counter/.test(n)&&!Array.isArray(o.material)){
   o.material=o.material.clone();
   if(/floor/.test(n)){o.material.color.setHex(0x435660);o.material.roughness=.88;}
   else if(/Seat|Console/.test(n)){o.material.color.setHex(restful?0x647c73:0x355b6a);o.material.roughness=.72;}
   else if(/table|counter/.test(n)){o.material.color.setHex(0x9a7854);o.material.roughness=.48;}
   else{o.material.color.setHex(0xc4d1d4);o.material.roughness=.75;}
   surfaces++;
  }
  if(/^(Raised_display|Touchscreen|Mission_display_wall|Briefing_wall)$/.test(n)){
   const side=/wall$/.test(n)?(area.center[2]>0?-1:1):undefined;
   const backing=k.face(o,side,.018),f=k.face(o,side,.028);
   backing.panel(0,0,f.w*.94,f.h*.92,FINISH_M.dark,'command_instruments');
   // Broad mission plots and compact telemetry use different visual hierarchies.
   const plotting=['bridge','navigation','briefing','mission'].includes(area.kind);
   f.panel(0,f.h*.27,f.w*.78,f.h*.025,light,'command_instruments');
   if(plotting){
    for(let i=0;i<4;i++){
     f.panel(-f.w*.29+i*f.w*.13,-f.h*.03,f.w*.004,f.h*.43,FINISH_M.blue,'command_instruments');
     f.panel(-f.w*.1,-f.h*.22+i*f.h*.12,f.w*.54,f.h*.01,FINISH_M.blue,'command_instruments');
     f.panel(-f.w*.29+i*f.w*.13,-f.h*.16+i*f.h*.075,f.w*.025,f.h*.045,light,'command_instruments');
    }
    for(let i=0;i<3;i++)f.panel(f.w*.31,f.h*(.13-i*.16),f.w*.14,f.h*.065,i===2?FINISH_M.amber:light,'command_instruments');
   }else for(let i=0;i<5;i++){
    f.panel(-f.w*.35+i*f.w*.17,-f.h*.10,f.w*.09,f.h*.36,FINISH_M.steel,'command_instruments');
    f.panel(-f.w*.35+i*f.w*.17,-f.h*.17+i*f.h*.02,f.w*.075,f.h*(.12+i*.04),light,'command_instruments');
   }
  }
  if(n==='Ceiling_light')o.material=light;
  if(n==='Entry_header'){fixtureText(k,o,area.name.toUpperCase(),area.center[2]>0?-1:1);}
  if(n==='Meeting_table'||n==='Navigation_plotting_table'){
   const {b,c,s}=k.bounds(o);k.box(o,[s.x*.56,.015,s.z*.55],[c.x,b.max.y+.018,c.z],FINISH_M.blue,'command_planning_surface');
   if(!restful)for(const z of [-.17,0,.17])k.box(o,[s.x*.48,.004,.012],[c.x,b.max.y+.028,c.z+s.z*z],FINISH_M.ink,'command_table_plot');
  }
  if(n==='Command_spine_floor'){const {b,c,s}=k.bounds(o);for(const z of [-3.5,3.5])k.box(o,[s.x-.5,.008,.08],[c.x,b.max.y+.006,c.z+z],FINISH_M.blue,'command_wayfinding');}
  if(n==='Seat_back'){const {b,c,s}=k.bounds(o);k.box(o,[s.x*.82,.035,.02],[c.x,b.max.y-.07,b.max.z+.012],FINISH_M.linen,'command_upholstery');}
  if(n==='Seat_cushion'){
   const {b,c,s}=k.bounds(o);
   for(const sign of [-1,1]){
    k.box(o,[.07,.23,s.z*.65],[c.x+sign*(s.x/2+.045),b.max.y+.10,c.z],FINISH_M.dark,'command_seat_arms');
    k.box(o,[.11,.045,s.z*.72],[c.x+sign*(s.x/2+.045),b.max.y+.235,c.z],restful?FINISH_M.oak:FINISH_M.linen,'command_seat_arms');
   }
  }
 }
 const extras=k.finish();root.userData.commandPolish={surfaces,features:extras,revision:2};return result;
}

export function polishCommandCorridor(root){
 const k=detailKit(root,'Command deck circulation');root.updateMatrixWorld(true);const items=[];root.traverse(o=>{if(o.isMesh)items.push(o);});
 for(const o of items){if(o.name==='Special_spine_floor')for(const z of [-3.5,3.5])k.box(o,[207,.008,.08],[52,36.306,z],FINISH_M.blue,'command_wayfinding');if(o.name==='Special_spine_wall'&&!Array.isArray(o.material)){o.material=o.material.clone();o.material.color.setHex(0xb7c8ce);}}
 const previous=root.userData.refinement,features=k.finish();root.userData.refinement=previous;root.userData.commandPolish={features,revision:1};
}
