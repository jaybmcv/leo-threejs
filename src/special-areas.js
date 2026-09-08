import * as T from 'three';
import {finishShipArea} from './area-finish.js';
import {tintWorldWindow,tintBoxWindow} from './glazing-finish.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {frontPoint} from './hull-profile.js';
import {bowHeight} from './diagonal-profile.js';

const command=[['navigation','Navigation laboratory'],['mission','Mission control'],['communications','Communications'],['crew','Crew ready room'],['briefing','Mission briefing'],['data','Flight data center'],['captain','Captain’s office'],['securityops','Flight security']];
export const SPECIAL_AREAS=[
  ...command.map(([kind,name],i)=>({id:`d20-${kind}-${i+1}`,name,kind,deck:20,category:'Command & operations',center:[[-35,9,53,97][i%4],36.3,i<4?-21:21],width:28,depth:24,height:3.5,special:true,door:'inboard',description:({navigation:'Trajectory workstations, orbital plotting table and navigation displays.',mission:'Flight consoles and a shared mission-status wall.',communications:'Communications workstations, signal racks and antenna control.',crew:'Off-watch seating, refreshments, lockers and a crew briefing table.',briefing:'Mission briefing table, presentation wall and planning stations.',data:'Flight-computer racks, maintenance aisles and monitoring consoles.',captain:'Command desk, private meeting table and records storage.',securityops:'Access-control consoles, incident coordination and security equipment.'})[kind]})),
  {id:'d20-bridge-9',name:'Captain’s bridge',kind:'bridge',deck:20,category:'Command & operations',center:[177,36.3,0],width:47,depth:66,height:9,special:true,description:'Panoramic command bridge aligned with the upper exterior window band, with helm, navigation and flight-control stations.'},
  ...[['reactor','Aft power plant'],['drivefeed','Drive-feed machinery'],['enginecontrol','Engineering control'],['engineworkshop','Engine workshop']].map(([kind,name],i)=>({id:`d07-${kind}-${i+1}`,name,kind,deck:7,category:'Aft engineering',center:[i<2?-249:-199,-15.7,i%2?-17:17],width:34,depth:28,height:3.5,special:true,door:'inboard',description:({reactor:'Three shielded concept power modules, service manifolds and operator stations.',drivefeed:'Drive-feed pump skids, isolation valves and paired supply headers.',enginecontrol:'Propulsion monitoring, machinery status boards and maintenance planning.',engineworkshop:'Engine-component benches, machine tools and spare-parts racks.'})[kind]})),
  {id:'d07-engineaccess-5',name:'Aft engine access',kind:'engineaccess',deck:7,category:'Aft engineering',center:[-282,-15.7,0],width:18,depth:56,height:3.5,special:true,door:'forward',description:'Protected engine-service gallery with paired inspection hatches, removable machinery panels and maintenance staging.'},
  {id:'d02-hangar-9',name:'Shuttle handling bay',kind:'hangar',deck:2,category:'Passenger transfer',center:[184,-35.7,0],width:72,depth:108,height:7.3,special:true,description:'Four docked transfer shuttles, handling lanes, boarding platforms, stores and a control booth. This double-height bay occupies the forward parts of decks 2–3.'},
  ...Array.from({length:5},(_,i)=>({id:`d0${i+1}-lifeboats-10`,name:`Lifeboat banks · Deck ${i+1}`,kind:'lifeboats',deck:i+1,category:'Emergency embarkation',center:[0,-39.7+i*4,0],width:249,depth:139,height:3.5,special:true,description:'Twenty 100-seat lifeboats on this deck, with inboard boarding corridors. Across five decks: 100 craft and 10,000 modeled seats. Survival endurance and evacuation rates are not engineered.'})),
];

const palette={floor:0xbdb7a8,lining:0xdbe1da,navy:0x294655,metal:0x8e9fa2,dark:0x172b36,wood:0x9d7b52,glass:0x6dacc4,amber:0xe6b878,green:0x739c89,screen:0x2b718c,light:0xffe8bc};
const materials=Object.fromEntries(Object.entries(palette).map(([n,color])=>[n,new T.MeshStandardMaterial({name:'Special_'+n,color,roughness:n==='glass'?.18:.75,metalness:n==='metal'?.55:.08,...(n==='screen'||n==='light'?{emissive:color,emissiveIntensity:n==='light'?.85:.2}:{}),...(n==='glass'?{transparent:true,opacity:.19,depthWrite:false,side:T.DoubleSide}:{})})]));
materials.lining.side=T.DoubleSide;

function kit(area){
  const root=new T.Group();root.name=`Area_${area.id}`;root.userData={...area,units:'metres',stage:'Furnished concept'};
  const shell=new T.Group();shell.name='Walls_and_ceiling';root.add(shell);const fit=new T.Group();fit.name='Room_fittings';root.add(fit);
  const add=(name,geometry,p,m='lining',parent=fit)=>{const o=new T.Mesh(geometry,materials[m]);o.name=name;o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(name,size,p,m='lining',parent=fit)=>add(name,new T.BoxGeometry(...size),p,m,parent);
  const round=(name,size,p,m='lining',r=.15,parent=fit)=>add(name,new RoundedBoxGeometry(...size,2,r),p,m,parent);
  const cyl=(name,r,h,p,m='metal',parent=fit)=>add(name,new T.CylinderGeometry(r,r,h,20),p,m,parent);
  function pipe(name,a,b,r=.08,m='metal',parent=fit){const va=new T.Vector3(...a),vb=new T.Vector3(...b),mid=va.clone().add(vb).multiplyScalar(.5),o=cyl(name,r,va.distanceTo(vb),mid.toArray(),m,parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return o;}
  function chair(x,y,z,r=0,parent=fit){const g=new T.Group();g.name='Crew_seat';g.position.set(x,y,z);g.rotation.y=r;parent.add(g);round('Seat_cushion',[.65,.16,.65],[0,.5,0],'navy',.06,g);round('Seat_back',[.66,.72,.16],[0,.92,-.3],'navy',.06,g);cyl('Seat_pedestal',.12,.43,[0,.215,0],'metal',g);box('Seat_foot',[.55,.04,.55],[0,.02,0],'dark',g);return g;}
  function console(x,y,z,r=0,parent=fit){const g=new T.Group();g.name='Flight_console';g.position.set(x,y,z);g.rotation.y=r;parent.add(g);round('Console_body',[2.4,.9,1],[0,.45,0],'navy',.12,g);const s=box('Touchscreen',[2,.06,.72],[0,.94,0],'screen',g);s.rotation.x=-.17;box('Raised_display',[1.8,.6,.09],[0,1.26,-.32],'screen',g);chair(0,0,1.1,Math.PI,g);return g;}
  function table(x,y,z,length=6){round('Meeting_table',[length,.1,2],[x,y+.78,z],'wood');for(const dx of [-length/3,length/3])box('Table_support',[.2,.72,1.3],[x+dx,y+.36,z],'metal');for(let dx=-length/2+1;dx<length/2;dx+=1.6)for(const s of [-1,1])chair(x+dx,y,z+s*1.55,s>0?Math.PI:0);}
  function rack(x,y,z,label='Systems_rack'){round(label,[1.1,2.6,.9],[x,y+1.3,z],'metal',.06);for(let k=0;k<8;k++){box('Rack_module',[.96,.23,.025],[x,y+.25+k*.29,z+.465],'dark');box('Rack_indicator',[.18,.045,.035],[x+.3,y+.25+k*.29,z+.48],'screen');}}
  function roomShell(){
    const [x,y,z]=area.center,w=area.width,d=area.depth,h=area.height;
    box('Finished_floor',[w,.25,d],[x,y-.125,z],'floor');box('Ceiling',[w,.14,d],[x,y+h-.13,z],'lining',shell);
    if(area.door==='inboard'){
      const s=z<0?1:-1;
      for(const side of [-1,1])box('Room_end_wall',[.16,h-.2,d],[x+side*(w/2-.08),y+(h-.2)/2,z],'lining',shell);
      box('Outboard_wall',[w,h-.2,.16],[x,y+(h-.2)/2,z-s*(d/2-.08)],'lining',shell);
      for(const side of [-1,1])box('Entry_wall',[(w-4)/2,h-.2,.16],[x+side*(w+4)/4,y+(h-.2)/2,z+s*(d/2-.08)],'lining',shell);
      box('Entry_header',[4,h-2.6,.16],[x,y+2.6+(h-2.6)/2,z+s*(d/2-.08)],'navy',shell);
    }else{
      for(const side of [-1,1])box('Side_wall',[w,h-.2,.16],[x,y+(h-.2)/2,z+side*(d/2-.08)],'lining',shell);
      const direction=area.door==='forward'?-1:1;
      box('Closed_end_wall',[.16,h-.2,d],[x+direction*(w/2-.08),y+(h-.2)/2,z],'lining',shell);
      for(const side of [-1,1])box('Entry_wall',[.16,h-.2,(d-6)/2],[x-direction*(w/2-.08),y+(h-.2)/2,z+side*(d+6)/4],'lining',shell);
    }
    for(const dz of [-d/3,0,d/3])box('Ceiling_light',[w-3,.035,.24],[x,y+h-.25,z+dz],'light',shell);
  }
  return {root,shell,fit,add,box,round,cyl,pipe,chair,console,table,rack,roomShell};
}

function bridge(area,k){
  const {box,round,add,pipe,console,chair,fit,shell}=k,y=area.center[1],rear=156,angles=Array.from({length:65},(_,i)=>-.8+1.6*i/64);
  const facade=(level,a,inset=.75)=>{const p=frontPoint(level,Math.abs(a),a<0?-1:1);return [p[0]*.94-18-inset*Math.cos(a),bowHeight(p[0],level),p[2]-inset*Math.sin(a)];};
  const edge=angles.map(a=>facade(42,a,1.4)),shape=new T.Shape(),outline=[[rear,edge[0][2]],...edge.map(p=>[p[0],p[2]]),[rear,edge.at(-1)[2]]];
  outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const floor=new T.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:false});floor.rotateX(-Math.PI/2);floor.translate(0,y-.3,0);add('Bridge_floor',floor,[0,0,0],'floor');
  function strip(name,lo,hi,m,parent=shell){const p=[],ix=[];angles.forEach(a=>p.push(...lo(a),...hi(a)));for(let i=0;i<64;i++){const j=i*2;ix.push(j,j+2,j+1,j+1,j+2,j+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();add(name,g,[0,0,0],m,parent);}
  strip('Bridge_window_sill',a=>{const p=facade(42,a,1.4);return [p[0],y,p[2]];},a=>facade(42,a),'lining');
  strip('Bridge_glazing_upper_exterior_row',a=>facade(42,a,.3),a=>facade(47,a,.3),'glass');
  strip('Bridge_ceiling',a=>facade(47,a),a=>[rear,44.6,facade(42,a,1.4)[2]],'lining');
  for(const s of [-1,1]){
    const a=s*.8,lo=facade(42,a,1.4),hi=facade(47,a),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([rear,y,lo[2],...lo,...hi,rear,44.6,lo[2]],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();add('Bridge_side_return',g,[0,0,0],'lining',shell);
    box('Bridge_rear_wall',[.18,8.3,Math.abs(lo[2])-3],[rear,y+4.15,s*(Math.abs(lo[2])+3)/2],'lining',shell);
    for(const x of [160,165,170])console(x,y,s*24,s>0?Math.PI:0);
  }
  box('Bridge_entry_lintel',[.18,5.5,6],[rear,y+5.55,0],'lining',shell);
  for(const a of [-.8,-.53,-.27,0,.27,.53,.8])pipe('Bridge_window_mullion',facade(42,a,.6),facade(47,a,.6),.1,'lining');
  for(const t of [.3,.7]){
    const points=angles.map(a=>{const p=facade(47,a);return new T.Vector3(p[0]*(1-t)+rear*t,p[1]*(1-t)+44.6*t-.2,p[2]*(1-t)+facade(42,a,1.4)[2]*t);});
    const path=new T.CatmullRomCurve3(points);add('Bridge_ceiling_ribbon',new T.TubeGeometry(path,72,.06,6,false),[0,0,0],'light',shell);
  }
  for(const z of [-7,7])console(186,y,z,-Math.PI/2);
  for(const z of [-14,14])console(179,y,z,-Math.PI/2);
  round('Command_plinth',[6,.12,7],[170,y+.06,0],'navy',.2);chair(170,y+.12,0,-Math.PI/2);
  for(const s of [-1,1])round('Command_arm_console',[1,.85,.6],[170,y+.55,s*1.1],'navy');
  const globe=add('Navigation_globe',new T.IcosahedronGeometry(1.1,2),[162,y+1.9,12],'screen');globe.material=materials.screen;
  round('Navigation_plotting_table',[4,.8,4],[162,y+.4,12],'navy');
  area.overview={position:[234,91,88],target:[179,38,0]};area.inside={position:[167,y+1.7,4],target:[200,39.5,0]};
}

function commandRoom(area,k){
  k.roomShell();const {box,round,console,table,rack,chair,cyl}=k,[x,y,z]=area.center;
  const consoles=()=>{for(const dx of [-8,0,8])for(const dz of [-6,5])console(x+dx,y,z+dz);};
  if(['navigation','mission','communications','securityops'].includes(area.kind)){
    consoles();box('Mission_display_wall',[18,1.35,.1],[x,y+2,z-11.75],'screen');
    if(area.kind==='navigation'){cyl('Orbital_plotting_table',2,.8,[x,y+.4,z]);const ring=k.add('Orbit_projection',new T.TorusGeometry(1.5,.04,8,48),[x,y+1.5,z],'screen');ring.rotation.x=.7;}
    if(area.kind==='communications')for(const dx of [-11,-9,-7,7,9,11])rack(x+dx,y,z+10,'Signal_rack');
    if(area.kind==='securityops')for(const dx of [-10,-7,7,10])round('Secure_equipment_locker',[1.8,2.4,1],[x+dx,y+1.2,z+10],'metal');
  }else if(area.kind==='data'){
    for(const dx of [-10,-6,-2,2,6,10])for(const dz of [-8,-4,4,8])rack(x+dx,y,z+dz,'Flight_computer_rack');console(x,y,z);
  }else if(area.kind==='crew'){
    table(x+3,y,z+5,9);for(const dx of [-9,-5,-1,3,7,11])chair(x+dx,y,z-5);round('Crew_lounge_table',[16,.08,2],[x,y+.5,z-7],'wood');
    round('Refreshment_counter',[10,.95,1.3],[x-5,y+.475,z+10],'wood');for(const dx of [4,7,10])round('Crew_locker',[2,2.4,1],[x+dx,y+1.2,z+10],'metal');
  }else if(area.kind==='briefing'){
    table(x,y,z,17);box('Briefing_wall',[20,1.7,.12],[x,y+1.7,z-11.75],'screen');console(x-8,y,z+8);console(x+8,y,z+8);
  }else if(area.kind==='captain'){
    console(x+6,y,z-5);table(x-5,y,z+4,7);for(const dx of [-10,-7,-4])rack(x+dx,y,z-10,'Command_records');chair(x+8,y,z+6);chair(x+10,y,z+8,Math.PI/2);
  }
}

function engineering(area,k){
  k.roomShell();const {box,round,cyl,pipe,console,rack}=k,[x,y,z]=area.center;
  if(area.kind==='reactor'){
    for(const dx of [-10,0,10]){
      cyl('Shielded_power_module',3,2.5,[x+dx,y+1.25,z]);
      for(const h of [.3,1.1,1.9]){const ring=k.add('Power_module_service_ring',new T.TorusGeometry(3.05,.12,8,32),[x+dx,y+h,z],'navy');ring.rotation.x=Math.PI/2;}
      box('Module_instrument_panel',[1.3,.7,.12],[x+dx,y+1.2,z+3.1],'screen');
      for(const s of [-1,1]){
        pipe('Module_service_riser',[x+dx,y+.8,z+s*3],[x+dx,y+2.85,z+s*3],.2,s>0?'amber':'screen');
        pipe('Power_coolant_branch',[x+dx,y+2.85,z+s*3],[x+dx,y+2.85,z+s*10],.2,s>0?'amber':'screen');
      }
    }
    for(const s of [-1,1]){
      pipe('Power_coolant_header',[x-15,y+2.85,z+s*10],[x+15,y+2.85,z+s*10],.23,s>0?'amber':'screen');
      for(const dx of [-15,15])round('Coolant_control_cabinet',[1.2,3,1.2],[x+dx,y+1.5,z+s*10],'metal');
    }
    console(x-10,y,z+10);console(x+10,y,z+10);
    area.inside={position:[x-5,y+1.7,z-10],target:[x+3,y+1.4,z+3]};
  }else if(area.kind==='drivefeed'){
    for(const dx of [-10,0,10])for(const dz of [-7,7]){
      round('Pump_skid',[6,.24,4],[x+dx,y+.12,z+dz],'navy');const pump=cyl('Drive_feed_pump',1.1,4,[x+dx,y+1.3,z+dz]);pump.rotation.z=Math.PI/2;
      pipe('Pump_discharge',[x+dx,y+1,z+dz],[x+dx,y+1,z+Math.sign(dz)*11],.25,'screen');
      const valve=k.add('Isolation_valve',new T.TorusGeometry(.45,.06,8,20),[x+dx,y+1.5,z+Math.sign(dz)*10],'amber');valve.rotation.x=Math.PI/2;
    }
    for(const dz of [-11,11])pipe('Drive_feed_header',[x-15,y+1,z+dz],[x+15,y+1,z+dz],.35,'screen');
  }else if(area.kind==='enginecontrol'){
    for(const dx of [-10,-3,4,11])for(const dz of [-6,6])console(x+dx,y,z+dz);
    box('Propulsion_status_wall',[27,1.3,.12],[x,y+2,z-13.7],'screen');
  }else if(area.kind==='engineworkshop'){
    for(const dx of [-10,0,10])for(const dz of [-7,7]){
      round('Engine_workbench',[7,.95,1.8],[x+dx,y+.475,z+dz],'wood');
      cyl('Engine_component',.55,.6,[x+dx,y+1.25,z+dz]);box('Machine_tool',[1.3,1.5,1.3],[x+dx+2.2,y+1.7,z+dz],'metal');
    }
    for(const dx of [-13,-10,-7,7,10,13])rack(x+dx,y,z+12,'Engine_spares');
  }else{
    for(const s of [-1,1])for(const dz of [-20,-10,10,20]){
      round('Engine_inspection_hatch',[.2,2.7,5],[x+s*8.75,y+1.35,z+dz],'navy');
      box('Hatch_monitor',[.08,.45,.65],[x+s*8.6,y+1.5,z+dz],'screen');
    }
    for(const dz of [-20,20])round('Maintenance_staging',[8,.15,7],[x,y+.075,z+dz],'amber');
  }
}

function hangar(area,k){
  k.roomShell();const {box,round,add,console,pipe}=k,[x,y,z]=area.center;
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const g=new T.Group();g.name='Transfer_shuttle';g.position.set(x+sx*17,y,sz*27);k.fit.add(g);
    round('Shuttle_lower_hull',[21,1.2,8],[0,.9,0],'navy',.5,g);
    round('Shuttle_cabin',[16,2.8,7],[-1,2.4,0],'lining',1.2,g);
    round('Shuttle_glazing',[.2,1.1,5.6],[7.05,2.8,0],'glass',.1,g);
    for(const s of [-1,1]){round('Shuttle_engine',[6,1.8,2.2],[-6,1.8,s*5.1],'metal',.6,g);box('Shuttle_wing',[9,.22,3],[-3,1.5,s*3.9],'lining',g);}
    box('Shuttle_tail',[4,3,.3],[-8.5,3.2,0],'lining',g);
    for(const dx of [-7,7])for(const side of [-1,1])box('Docking_cradle',[1,.4,1],[dx,.2,side*3.2],'amber',g);
    const px=x+sx*17,pz=sz*20;
    box('Boarding_platform',[15,1.5,3],[px,y+.75,pz],'floor');
    for(let i=0;i<8;i++)box('Boarding_step',[3,(i+1)*.1875,.4],[px-6,y+(i+1)*.09375,pz-sz*(4.3-i*.4)],'lining');
    box('Shuttle_boarding_bridge',[3,.12,2.6],[px,y+1.44,sz*22.5],'floor');
    box('Shuttle_boarding_door',[2.1,2,.1],[px,y+2.5,sz*23.45],'navy');
    for(const side of [-1,1])pipe('Platform_rail',[px+side*7.2,y+2.6,pz-1],[px+side*7.2,y+2.6,pz+1],.045);
  }
  for(const dz of [-10,10])box('Handling_lane',[67,.018,.12],[x,y+.012,dz],'amber');
  for(const dx of [-27,0,27]){box('Gantry_column',[.4,6.4,.4],[x+dx,y+3.2,-51],'metal');box('Overhead_handling_beam',[.5,.6,102],[x+dx,y+6.55,0],'metal');}
  for(const dz of [-44,-38,38,44])console(x-32,y,dz,-Math.PI/2);
  round('Flight_ready_counter',[18,1,1.2],[x,y+.5,-50],'wood');
  box('Shuttle_transfer_bulkhead',[.2,6.5,18],[x+35.75,y+3.25,0],'navy');
  area.inside={position:[x-29,y+1.7,-9],target:[x+14,y+2,26]};
}

function lifeboats(area,k){
  const {box,round,fit,shell}=k,y=area.center[1],centers=[];
  for(const side of [-1,1]){
    box('Lifeboat_boarding_corridor',[249,.25,4],[0,y-.125,side*58.9],'floor');
    box('Boarding_corridor_ceiling',[249,.14,4],[0,y+3.37,side*58.9],'lining',shell);
    for(let i=0;i<10;i++){
      const x=-112.5+i*25,z=side*65.5;centers.push([x,z]);
      round('Lifeboat_floor',[22,.22,8],[x,y-.11,z],'navy',.7);
      round('Lifeboat_ceiling',[21,.14,7.6],[x,y+2.9,z],'lining',.6,shell);
      for(const s of [-1,1]){
        box('Lifeboat_end_bulkhead',[.16,2.85,7],[x+s*10.5,y+1.425,z],'lining',shell);
        if(s===side)box('Lifeboat_outboard_wall',[21,2.8,.16],[x,y+1.4,z+s*3.75],'lining',shell);
        else for(const dx of [-6,6])box('Lifeboat_entry_wall',[9,2.8,.16],[x+dx,y+1.4,z+s*3.75],'lining',shell);
      }
      box('Lifeboat_entry_header',[3,.5,.16],[x,y+2.6,z-side*3.75],'navy',shell);
      box('Boarding_bridge',[3,.12,1.2],[x,y-.06,side*61.5],'floor');
      box('Lifeboat_helm',[1,1.1,2],[x+9.4,y+.55,z],'metal');
      box('Lifeboat_cross_aisle',[1.3,.018,7],[x,y+.012,z],'floor');
      box('Life_support_locker',[1.2,2,5],[x-9.5,y+1,z],'metal');
      box('Lifeboat_front_glazing',[.08,.8,4],[x+10.61,y+1.7,z],'screen');
      for(const dz of [-2.4,2.4]){const nozzle=k.cyl('Lifeboat_thruster',.45,.3,[x-10.7,y+.9,z+dz],'dark');nozzle.rotation.z=Math.PI/2;}
      box('Boarding_light',[8,.03,.18],[x,y+3.24,side*58.9],'light',shell);
    }
  }
  const positions=[];
  for(const [x,z]of centers)for(let row=0;row<20;row++)for(const dz of [-2.2,-1.4,.5,1.3,2.1])positions.push([x+(row<10?-8.2+row*.8:1+(row-10)*.8),y,z+dz]);
  for(const [name,size,offset,material]of [['Evacuation_seat',[.62,.16,.6],[0,.48,0],'navy'],['Evacuation_seat_back',[.12,.73,.62],[-.28,.91,0],'navy'],['Evacuation_seat_base',[.08,.4,.45],[0,.2,0],'metal']]){
    const mesh=new T.InstancedMesh(new T.BoxGeometry(...size),materials[material],positions.length);mesh.name=name;
    positions.forEach((p,i)=>mesh.setMatrixAt(i,new T.Matrix4().makeTranslation(p[0]+offset[0],p[1]+offset[1],p[2]+offset[2])));fit.add(mesh);
  }
  k.root.userData={...k.root.userData,craft:20,seatsPerCraft:100,seats:2000,layout:'100 physical seat positions per craft; endurance and egress not sized'};
  area.overview={position:[205,y+235,255],target:[0,y,0]};area.inside={position:[-104,y+1.7,65.15],target:[-122,y+1.3,65.15]};
}

export function createSpecialArea(area){
  // Keep descriptors immutable: camera poses belong to this built area instance.
  area={...area};const k=kit(area);
  if(area.kind==='bridge')bridge(area,k);
  else if(area.kind==='hangar')hangar(area,k);
  else if(area.kind==='lifeboats')lifeboats(area,k);
  else if(area.category==='Aft engineering')engineering(area,k);
  else commandRoom(area,k);
  finishShipArea(area,k);
  k.root.traverse(o=>{if(!o.isMesh)return;if(o.name==='Bridge_glazing_upper_exterior_row')tintWorldWindow(o,p=>new T.Vector3(Math.max(1,p.x-160),.5,p.z));if(o.name==='Shuttle_glazing'||o.name==='Lifeboat_front_glazing')tintBoxWindow(o,'x',1);});
  const [x,y,z]=area.center;
  return {...k,area,overview:area.overview||{position:[x+area.width*.9,y+Math.max(area.width,area.depth)*.9,z+area.depth*1.1],target:[x,y+1,z]},inside:area.inside||{position:[x,y+1.7,z+(z>0?-1:1)*(area.depth/2-2)],target:[x+3,y+1.3,z]}};
}
