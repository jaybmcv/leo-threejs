import * as T from 'three';
import {serviceKit,SERVICE_M as M,glassWall} from './neighborhood-services.js';
import {glazedWall} from './room-glazing.js';
import {finishShipArea,detailKit,FINISH_M} from './area-finish.js';
import {fixtureText} from './circulation-finish.js';
const COMMAND_LIGHT=new T.MeshStandardMaterial({name:'Command cool instrument light',color:0xb8e3ed,emissive:0x7eb7cb,emissiveIntensity:.45,roughness:.5});
const RECOVERY_LIGHT=new T.MeshStandardMaterial({name:'Command warm lounge light',color:0xffe2b7,emissive:0xe9bb7c,emissiveIntensity:.35,roughness:.6});
// The recovery lounge's pod side: dark shells in champagne frames, warm strip light, a coffee bar and dim cove light.
const POD_M={shell:new T.MeshStandardMaterial({name:'Recovery_pod_shell',color:0x22262b,roughness:.42,metalness:.25}),frame:new T.MeshStandardMaterial({name:'Recovery_pod_frame',color:0xc8aa72,roughness:.3,metalness:.7}),
 linen:new T.MeshStandardMaterial({name:'Recovery_pod_linen',color:0xf0ebe1,roughness:.9}),throw:new T.MeshStandardMaterial({name:'Recovery_pod_throw',color:0x8a6f55,roughness:.95}),curtain:new T.MeshStandardMaterial({name:'Recovery_pod_curtain',color:0x6e665c,roughness:.95}),
 glow:new T.MeshStandardMaterial({name:'Recovery_pod_glow',color:0xffd8a8,emissive:0xffb868,emissiveIntensity:1.1}),screen:new T.MeshStandardMaterial({name:'Recovery_pod_screen',color:0x0d2430,emissive:0x4fc3e8,emissiveIntensity:.8}),
 carpet:new T.MeshStandardMaterial({name:'Recovery_pod_carpet',color:0x2b2630,roughness:.95}),stone:new T.MeshStandardMaterial({name:'Recovery_coffee_stone',color:0x1b1d21,roughness:.3,metalness:.1}),
 dim:new T.MeshStandardMaterial({name:'Recovery_pod_dim_light',color:0x4a3828,emissive:0xffa860,emissiveIntensity:.28})};
// The x spans (in a room's own frame) of the aft rooms' entry walls, where they face the aft spine.
const AFT_GLASS=[[-26,-2],[2,26]];
export const COMMAND_AFT_AREAS=[
 {id:'d20-planning-aft',name:'Mission planning studio',kind:'briefing',side:-1,description:'A collaborative planning table, navigation review stations and a mission wall for detailed work away from the bridge.'},
 {id:'d20-recovery-aft',name:'Crew recovery lounge',kind:'crew',side:1,description:'Sleeping pods and a coffee bar in a dim forward half, with quiet upholstered seating, a refreshment counter and small conversation tables for command crew between shifts.'},
].map(a=>({...a,deck:20,commandAft:true,special:true,category:'Command & operations',center:[-90,36.3,a.side*15],width:52,depth:20,height:3.5}));
export function createCommandAft(area){
 const root=new T.Group();root.name='Area_'+area.id;root.userData={...area};const {fit,shell,box,text}=serviceKit(root,area.center),s=area.side;
 box('Finished_floor',[52,.02,20],[0,-.01,0],M.floor);box('Ceiling',[52,.1,20],[0,3.4,0],M.wall,shell);
 for(const sign of [-1,1])box('Room_end_wall',[.16,3.4,20],[sign*25.92,1.7,0],M.wall,shell);
 box('Outboard_wall',[52,3.4,.16],[0,1.7,s*9.92],M.wall,shell);
 // The entry walls face the aft spine across a 0.8 m gap behind its own wall, glazed pane for pane with them.
 for(const sign of [-1,1])glazedWall(glassWall(box,shell),'Entry_wall',[24,3.4,.16],[sign*14,1.7,-s*9.92],AFT_GLASS[sign<0?0:1]);
 box('Entry_header',[4,.8,.16],[0,3,-s*9.92],M.blue,shell);
 text(area.name.toUpperCase(),[0,2.6,s*9.78],s<0?0:Math.PI,.28);
 // The recovery lounge's pod side has dim cove light instead of the ceiling panels.
 for(const x of s>0?[-20,-10,0]:[-20,-10,0,10,20])for(const z of [-6,6])box('Ceiling_light',[5,.04,.18],[x,3.27,z],M.light,shell);
 function chair(x,z,r=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=r;fit.add(g);box('Seat_cushion',[.8,.18,.8],[0,.48,0],M.blue,g);box('Seat_back',[.8,.65,.13],[0,.86,.34],M.blue,g);box('Seat_pedestal',[.2,.39,.2],[0,.195,0],M.metal,g);}
 function table(x,z,len){box('Meeting_table',[len,.1,1.7],[x,.8,z],M.wood);for(const dx of [-len*.3,len*.3])box('Table_support',[.15,.75,1.2],[x+dx,.375,z],M.metal);}
 if(s<0){
  table(-13,0,14);for(const x of [-18,-15,-12,-9])for(const z of [-2.2,2.2])chair(x,z,z<0?Math.PI:0);
  box('Briefing_wall',[15,1.5,.1],[-13,1.8,-9.7],M.dark);
  for(const x of [9,18]){table(x,-5,5);chair(x,-3);box('Raised_display',[2,.6,.08],[x,1.25,-5],M.dark);table(x,5,5);chair(x,7);box('Raised_display',[2,.6,.08],[x,1.25,5],M.dark);}
 }else{
  for(const x of [-19,-11]){table(x,0,4);for(const z of [-2,2]){chair(x-1,z,z<0?Math.PI:0);chair(x+1,z,z<0?Math.PI:0);}}
  box('Refreshment_counter',[12,.9,1.3],[-13,.45,8.4],M.wood);box('Coffee_machine',[.9,.65,.7],[-15,1.225,8.4],M.metal);
  podLounge();
 }
 // The forward half of the recovery lounge (from tester feedback): seven sleeping pods along the outboard wall, open to
 // the room on their long side, each with a mattress and pillow to lie down on (the walk's rest.js finds them by name),
 // a warm strip light, a small screen and a curtain; a coffee bar on the end wall; low lounge chairs; dark carpet and
 // dim cove light instead of the ceiling panels.
 function podLounge(){
  box('Pod_lounge_carpet',[23.8,.012,19.6],[14,.006,0],POD_M.carpet);
  box('Pod_lounge_cove_light',[22,.05,.05],[14,3.12,9.78],POD_M.dim,shell);
  const L=2.5,H=1.95,D=1.5,R=.3;
  // The front frame: a rounded panel with a rounded opening above the bed base.
  const outer=new T.Shape();outer.moveTo(-L/2+R,0);outer.lineTo(L/2-R,0);outer.quadraticCurveTo(L/2,0,L/2,R);outer.lineTo(L/2,H-R);outer.quadraticCurveTo(L/2,H,L/2-R,H);outer.lineTo(-L/2+R,H);outer.quadraticCurveTo(-L/2,H,-L/2,H-R);outer.lineTo(-L/2,R);outer.quadraticCurveTo(-L/2,0,-L/2+R,0);
  const w=L-.36,y0=.44,y1=H-.18,r=.24,hole=new T.Path();hole.moveTo(-w/2+r,y0);hole.lineTo(w/2-r,y0);hole.quadraticCurveTo(w/2,y0,w/2,y0+r);hole.lineTo(w/2,y1-r);hole.quadraticCurveTo(w/2,y1,w/2-r,y1);hole.lineTo(-w/2+r,y1);hole.quadraticCurveTo(-w/2,y1,-w/2,y1-r);hole.lineTo(-w/2,y0+r);hole.quadraticCurveTo(-w/2,y0,-w/2+r,y0);
  outer.holes.push(hole);const frame=new T.ExtrudeGeometry(outer,{depth:.08,bevelEnabled:false,curveSegments:6}).translate(0,0,-D/2-.04);
  for(let i=0;i<7;i++){
   const g=new T.Group();g.position.set(5+i*2.8,0,9.84-D/2);fit.add(g);
   const f=new T.Mesh(frame,POD_M.frame);f.name='Sleep_pod_frame';g.add(f);
   box('Sleep_pod_base',[L-.1,.42,D-.1],[0,.21,0],POD_M.shell,g);
   box('Sleep_pod_roof',[L,.08,D],[0,H-.04,0],POD_M.shell,g);
   for(const x of [-1,1])box('Sleep_pod_end',[.08,H,D],[x*(L/2-.04),H/2,0],POD_M.shell,g);
   box('Sleep_pod_back',[L,H,.06],[0,H/2,D/2-.03],POD_M.shell,g);
   box('Mattress',[2.1,.16,1.05],[0,.5,.08],POD_M.linen,g);
   box('Pillow',[.38,.12,.72],[-.82,.64,.08],POD_M.linen,g);
   box('Pod_throw',[.8,.04,1.07],[.6,.6,.08],POD_M.throw,g);
   box('Sleep_pod_light',[L-.4,.03,.05],[0,H-.13,-D/2+.16],POD_M.glow,g);
   box('Sleep_pod_glow',[L-.4,.03,.03],[0,1.02,D/2-.08],POD_M.glow,g);
   box('Sleep_pod_screen_housing',[.04,.3,.46],[L/2-.1,1.12,.12],POD_M.shell,g);
   box('Sleep_pod_screen_display',[.012,.24,.4],[L/2-.126,1.12,.12],POD_M.screen,g);
   box('Sleep_pod_curtain',[.34,1.28,.1],[L/2-.36,1.1,-D/2+.1],POD_M.curtain,g);
  }
  // The coffee bar on the forward end wall, with three stools.
  box('Coffee_bar_counter',[.85,1,6.4],[25.3,.5,-4.6],POD_M.shell);
  box('Coffee_bar_top',[.95,.05,6.6],[25.27,1.025,-4.6],POD_M.stone);
  box('Coffee_bar_backsplash',[.05,1.2,6.4],[25.82,1.75,-4.6],POD_M.stone);
  box('Coffee_bar_light',[.03,.03,6.2],[24.86,.86,-4.6],POD_M.glow);
  box('Coffee_bar_shelf',[.3,.04,5],[25.66,2.05,-4.6],POD_M.frame);
  for(const z of [-6.7,-2.6]){box('Coffee_machine',[.55,.5,.7],[25.4,1.3,z],POD_M.frame);box('Coffee_machine_front',[.03,.3,.5],[25.11,1.32,z],POD_M.shell);}
  for(let i=0;i<8;i++){const c=new T.Mesh(new T.CylinderGeometry(.045,.035,.1,12),POD_M.linen);c.name='Coffee_cup';c.position.set(25.66,2.12,-6.4+i*.5);fit.add(c);}
  const sign=text('COFFEE',[25.78,2.45,-4.6],-Math.PI/2,.22);sign.material=POD_M.frame;
  for(const z of [-6.2,-4.6,-3]){const st=new T.Mesh(new T.CylinderGeometry(.22,.22,.08,20),POD_M.linen);st.name='Seat';st.position.set(24.35,.74,z);fit.add(st);box('Stool_post',[.08,.7,.08],[24.35,.35,z],POD_M.frame);}
  // Low lounge chairs round two coffee tables.
  for(const x of [11,18]){
   const t=new T.Mesh(new T.CylinderGeometry(.5,.5,.06,24),POD_M.stone);t.name='Coffee_table';t.position.set(x,.45,-3);fit.add(t);box('Coffee_table_base',[.14,.42,.14],[x,.21,-3],POD_M.frame);
   chair(x,-4.2,Math.PI);chair(x,-1.8);
  }
 }
 // Each room owns its short doorway link. Port additionally owns the shared
 // aft spine, which meets the existing command corridor at x=-52.
 box('Command_entry_floor',[4,.02,1],[0,-.01,-s*10.5],M.floor);
 box('Command_entry_ceiling',[4,.1,1],[0,3.4,-s*10.5],M.wall,shell);
 for(const x of [-2.08,2.08])box('Command_entry_wall',[.16,3.4,1],[x,1.7,-s*10.5],M.wall,shell);
 if(s<0){
  box('Command_spine_floor',[64,.02,8],[6,-.01,15],M.floor);box('Command_spine_ceiling',[64,.1,8],[6,3.4,15],M.wall,shell);
  box('Command_aft_bulkhead',[.16,3.4,8],[-25.92,1.7,15],M.wall,shell);
  for(const z of [10.92,19.08])for(const [a,b]of [[-26,-2],[2,38]])glazedWall(glassWall(box,shell),'Command_spine_wall',[b-a,3.4,.16],[(a+b)/2,1.7,z],AFT_GLASS[a<0?0:1]);
  for(const x of [-20,-8,6,20,32])box('Ceiling_light',[5,.04,.16],[x,3.27,15],M.light,shell);
 }
 finishShipArea(area,{root,fit,shell});return {root,fit,shell,overview:{position:[-41,96,s*79],target:area.center},inside:{position:[-90,38,s*7],target:[-105,37.8,s*15]}};
}
export function polishCommandRoom(area,result){
 const {root,fit,shell}=result;root.updateMatrixWorld(true);const k=detailKit(fit,'Deck 20 command finish'),sources=[];root.traverse(o=>{if(o.isMesh)sources.push(o);});
 let surfaces=0,station=0,rack=0;
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
  if(n==='Bridge_ceiling_ribbon')o.material=COMMAND_LIGHT;
  if(n==='Bridge_flight_status_title')fixtureText(k,o,'FLIGHT / NAVIGATION',1);
  if(n==='Bridge_systems_status_title')fixtureText(k,o,'SYSTEMS / COMMUNICATIONS',1);
  if(n==='Bridge_exit_sign')fixtureText(k,o,'DECK 20 / COMMAND CORRIDOR',1);
  if(n==='Bridge_flight_equipment_label')fixtureText(k,o,'FLIGHT EQUIPMENT',1);
  if(n==='Bridge_comms_equipment_label')fixtureText(k,o,'COMMUNICATIONS EQUIPMENT',1);
  // Bridge pass 1: hardware stays attached to each station's local transform.
  if(area.kind==='bridge'&&n==='Console_body'){
   const {b,c,s}=k.bounds(o);
   for(let i=0;i<7;i++)k.box(o,[.075,.012,.017],[c.x+(i-3)*.13,b.min.y+.23,b.max.z+.021],FINISH_M.dark,'bridge_console_vents');
   for(const sign of [-1,1]){
    k.box(o,[.16,.045,.19],[c.x+sign*s.x*.37,b.max.y+.033,c.z+s.z*.28],FINISH_M.dark,'bridge_switch_housing');
    k.box(o,[.075,.052,.085],[c.x+sign*s.x*.37,b.max.y+.074,c.z+s.z*.28],sign<0?FINISH_M.amber:FINISH_M.steel,'bridge_switches');
   }
  }
  if(area.kind==='bridge'&&n==='Raised_display'){
   const {b,c,s}=k.bounds(o);
   for(const sign of [-1,1])k.box(o,[.018,s.y*.88,.018],[c.x+sign*s.x*.48,c.y,b.max.z+.023],FINISH_M.steel,'bridge_display_bezel');
   k.box(o,[s.x*.9,.018,.018],[c.x,b.max.y-.013,b.max.z+.023],FINISH_M.steel,'bridge_display_bezel');
  }
  // Bridge pass 2: close-up upholstery and the projector's working edge.
  if(area.kind==='bridge'&&n==='Seat_cushion'){
   const {b,c,s}=k.bounds(o);
   for(const sign of [-1,1])k.box(o,[.009,.006,s.z*.72],[c.x+sign*s.x*.35,b.max.y+.004,c.z],FINISH_M.linen,'bridge_seat_seams');
  }
  if(area.kind==='bridge'&&n==='Seat_back'){
   const {b,c,s}=k.bounds(o);
   k.box(o,[s.x*.69,.14,.025],[c.x,c.y-.13,b.max.z+.023],FINISH_M.dark,'bridge_lumbar_panel');
  }
  if(n==='Navigation_plotting_table'){
   const {b,c,s}=k.bounds(o);
   for(const sign of [-1,1]){
    k.box(o,[s.x-.14,.055,.06],[c.x,b.max.y-.08,c.z+sign*(s.z/2+.02)],FINISH_M.steel,'bridge_projector_edge');
    for(const x of [-1,1])k.box(o,[.12,.52,.08],[c.x+x*(s.x/2-.16),c.y,c.z+sign*(s.z/2+.02)],FINISH_M.steel,'bridge_projector_corner');
   }
   fixtureText(k,o,'NAVIGATION / ORBITAL PLOT',1);
  }
  if(n==='Console_body'){
   const {b,c,s}=k.bounds(o),f=k.face(o,1);
   const titles={bridge:'FLIGHT',navigation:'NAVIGATION',mission:'MISSION',communications:'COMMS',securityops:'SECURITY',data:'SYSTEMS',captain:'COMMAND',briefing:'PLANNING'};
   // Labels follow each console's local transform, including the curved bridge stations.
   const stationTitle=area.kind==='bridge'?(o.parent.position.x>184?'HELM':o.parent.position.x>175?'NAVIGATION':o.parent.position.z<0?'SYSTEMS':'COMMS'):(titles[area.kind]||'OPERATIONS');
   fixtureText(k,o,stationTitle+' '+String(++station).padStart(2,'0'),1);
   k.box(o,[s.x*.88,.035,.025],[c.x,b.max.y-.12,b.max.z+.02],FINISH_M.steel,'command_console_trim');
   for(const sign of [-1,1])k.box(o,[.045,s.y*.62,.025],[c.x+sign*s.x*.43,c.y,b.max.z+.02],FINISH_M.steel,'command_console_trim');
   k.box(o,[s.x*.68,.055,.12],[c.x,b.min.y+.16,b.max.z+.09],FINISH_M.dark,'command_console_footrail');
  }
  if(/^(Flight_computer_rack|Signal_rack|Command_records|Crew_locker|Secure_equipment_locker)$/.test(n)){
   const {b,c,s}=k.bounds(o);
   // A small separate plaque keeps the identifier above module faces and handles.
   const plaque=new T.Mesh(new T.BoxGeometry(s.x*.74,.17,.02));plaque.position.set(c.x,b.max.y-.14,b.max.z+.025);o.add(plaque);plaque.updateWorldMatrix(true,false);
   k.box(plaque,[s.x*.74,.17,.02],[0,0,0],FINISH_M.dark,'command_storage_labels');
   fixtureText(k,plaque,(n==='Crew_locker'?'CREW':n==='Command_records'?'ARCHIVE':'SYSTEM')+' '+String(++rack).padStart(2,'0'),1);
   o.remove(plaque);plaque.geometry.dispose();plaque.material.dispose();
  }
  if(n==='Refreshment_counter'){
   const {b,c,s}=k.bounds(o);
   k.box(o,[1.5,.025,.8],[c.x+s.x*.26,b.max.y+.014,c.z],FINISH_M.dark,'command_refreshments');
   for(let i=0;i<3;i++){
    const x=c.x+s.x*.26-.45+i*.45;
    k.add(o,new T.CylinderGeometry(.09,.07,.15,12).translate(x,b.max.y+.102,c.z),FINISH_M.linen,'command_refreshments');
   }
   k.box(o,[s.x*.86,.025,.015],[c.x,b.max.y-.16,b.max.z+.014],RECOVERY_LIGHT,'command_counter_light');
  }
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
 const extras=k.finish();root.userData.commandPolish={surfaces,features:extras,revision:3};return result;
}

export function polishCommandCorridor(root){
 const k=detailKit(root,'Command deck circulation');root.updateMatrixWorld(true);const items=[];root.traverse(o=>{if(o.isMesh)items.push(o);});
 for(const o of items){if(o.name==='Special_spine_floor')for(const z of [-3.5,3.5])k.box(o,[207,.008,.08],[52,36.306,z],FINISH_M.blue,'command_wayfinding');if(o.name==='Special_spine_wall'&&!Array.isArray(o.material)){o.material=o.material.clone();o.material.color.setHex(0xb7c8ce);}}
 const previous=root.userData.refinement,features=k.finish();root.userData.refinement=previous;root.userData.commandPolish={features,revision:1};
}
