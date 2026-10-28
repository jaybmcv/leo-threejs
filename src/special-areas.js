import {anchorArea} from './plan/anchor-area.js';
import * as T from 'three';
import {finishShipArea} from './area-finish.js';
import {tintWorldWindow,tintBoxWindow} from './glazing-finish.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {cutOut} from './cut-out.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {glazedWall,glassSpan,visionGlass} from './room-glazing.js';
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

const palette={floor:0xbdb7a8,lining:0xdbe1da,navy:0x294655,metal:0x8e9fa2,dark:0x172b36,wood:0x9d7b52,glass:0x6dacc4,amber:0xe6b878,green:0x739c89,screen:0x2b718c,light:0xffe8bc,rescue:0xe0662b,teal:0x3aa79c};
const materials=Object.fromEntries(Object.entries(palette).map(([n,color])=>[n,new T.MeshStandardMaterial({name:'Special_'+n,color,roughness:n==='glass'?.18:.75,metalness:n==='metal'?.55:.08,...(n==='screen'||n==='light'||n==='teal'?{emissive:color,emissiveIntensity:n==='light'?.85:.2}:{}),...(n==='glass'?{transparent:true,opacity:.19,depthWrite:false,side:T.DoubleSide}:{})})]));
materials.vision=visionGlass;
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
      // Deck 7's engineering rooms stand right on the aft spine (x -273 to -132, special-circulation.js), so their entry
      // walls are its side walls too: vision glass along them. Deck 20's rooms sit back behind link corridors and stay solid.
      const wall=(name,size,p,glass)=>box(name,size,p,glass?'vision':'lining',shell),len=(w-4)/2;
      for(const side of [-1,1]){const cx=x+side*(w+4)/4;glazedWall(wall,'Entry_wall',[len,h-.2,.16],[cx,y+(h-.2)/2,z+s*(d/2-.08)],area.deck===7?glassSpan(cx-len/2,cx+len/2,-273,-132):null);}
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
  const {box,round,add,cyl,pipe,console,chair,fit,shell}=k,y=area.center[1],rear=156,angles=Array.from({length:65},(_,i)=>-.8+1.6*i/64);
  const facade=(level,a,inset=.75)=>{const p=frontPoint(level,Math.abs(a),a<0?-1:1);return [p[0]*.94-18-inset*Math.cos(a),bowHeight(p[0],level),p[2]-inset*Math.sin(a)];};
  const edge=angles.map(a=>facade(42,a,1.4)),shape=new T.Shape(),outline=[[rear,edge[0][2]],...edge.map(p=>[p[0],p[2]]),[rear,edge.at(-1)[2]]];
  outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const floor=new T.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:false});floor.rotateX(-Math.PI/2);floor.translate(0,y-.3,0);add('Bridge_floor',floor,[0,0,0],'floor');
  function strip(name,lo,hi,m,parent=shell){const p=[],ix=[];angles.forEach(a=>p.push(...lo(a),...hi(a)));for(let i=0;i<64;i++){const j=i*2;ix.push(j,j+2,j+1,j+1,j+2,j+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();add(name,g,[0,0,0],m,parent);}
  strip('Bridge_window_sill',a=>{const p=facade(42,a,1.4);return [p[0],y,p[2]];},a=>facade(42,a),'lining');
  strip('Bridge_glazing_upper_exterior_row',a=>facade(42,a,.3),a=>facade(47,a,.3),'glass');
  strip('Bridge_ceiling',a=>facade(47,a),a=>[rear,44.6,facade(42,a,1.4)[2]],'lining');
  for(const s of [-1,1]){
    const a=s*.8,lo=facade(42,a,1.4),hi=facade(47,a),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([rear,y,lo[2],lo[0],y,lo[2],...lo,...hi,rear,44.6,lo[2]],3));g.setIndex([0,1,2,0,2,3,0,3,4]);g.computeVertexNormals();add('Bridge_side_return',g,[0,0,0],'lining',shell);
    box('Bridge_rear_wall',[.18,8.3,Math.abs(lo[2])-3],[rear,y+4.15,s*(Math.abs(lo[2])+3)/2],'lining',shell);
    for(const x of [160,165,170])console(x,y,s*24,s>0?Math.PI:0);
  }
  box('Bridge_entry_lintel',[.18,5.5,6],[rear,y+5.55,0],'lining',shell);
  for(const a of [-.8,-.53,-.27,0,.27,.53,.8])pipe('Bridge_window_mullion',facade(42,a,.6),facade(47,a,.6),.1,'lining');
  for(const t of [.3,.7]){
    const points=angles.map(a=>{const p=facade(47,a);return new T.Vector3(p[0]*(1-t)+rear*t,p[1]*(1-t)+44.6*t-.2,p[2]*(1-t)+facade(42,a,1.4)[2]*t);});
    const path=new T.CatmullRomCurve3(points);add('Bridge_ceiling_ribbon',new T.TubeGeometry(path,72,.06,6,false),[0,0,0],'light',shell);
  }
  for(const z of [-7,7]){
    round('Helm_floor_inset',[4.3,.016,3.8],[185.3,y+.012,z],'navy',.002);
    const helm=console(186,y,z,-Math.PI/2);
    // Compact physical controls sit beside the existing touch surface.
    for(const side of [-1,1]){
      round('Helm_control_base',[.28,.08,.28],[side*.99,.98,.1],'metal',.03,helm);
      pipe('Helm_control_stick',[side*.99,1.02,.1],[side*.99,1.24,.16],.035,'dark',helm);
      round('Helm_control_grip',[.1,.12,.15],[side*.99,1.25,.16],'navy',.03,helm);
      const pedal=round('Helm_pedal',[.22,.045,.34],[side*.17,.09,.68],'metal',.015,helm);pedal.rotation.x=-.22;
      for(let groove=0;groove<3;groove++)box('Helm_pedal_tread',[.18,.018,.018],[side*.17,.121+groove*.013,.59+groove*.06],'dark',helm);
    }
    box('Helm_mode_strip',[.65,.025,.16],[0,.99,.37],'dark',helm);
    for(let i=0;i<4;i++)box('Helm_mode_key',[.1,.018,.09],[-.23+i*.15,1.012,.37],i===0?'amber':'screen',helm);
  }
  for(const z of [-14,14]){
    round('Navigation_station_floor_inset',[4.3,.016,3.8],[178.3,y+.012,z],'navy',.002);
    console(179,y,z,-Math.PI/2);
  }
  round('Command_plinth',[6,.12,7],[170,y+.06,0],'navy',.2);
  // The captain faces forward, over the helm to the windows.
  const captain=chair(170,y+.12,0,Math.PI/2);captain.name='Captain_command_seat';
  round('Captain_headrest',[.6,.3,.18],[0,1.43,-.3],'navy',.06,captain);
  round('Captain_back_shell',[.82,1.05,.12],[0,1.04,-.42],'metal',.06,captain);
  round('Captain_foot_support',[.68,.055,.34],[0,.18,.45],'metal',.025,captain);
  box('Captain_foot_pad',[.58,.025,.26],[0,.221,.45],'dark',captain);
  for(const s of [-1,1]){
    round('Captain_side_bolster',[.13,.77,.22],[s*.36,.96,-.22],'navy',.045,captain);
    box('Captain_back_piping',[.025,.82,.025],[s*.32,1.01,-.492],'amber',captain);
  }
  for(const s of [-1,1]){
    round('Command_arm_console',[1,.85,.6],[170,y+.55,s*1.1],'navy');
    const touch=box('Touchscreen',[.78,.035,.42],[170,y+1,s*1.1],'screen');touch.rotation.z=-.12;
    round('Captain_console_wrist_pad',[.18,.065,.47],[170.41,y+.99,s*1.1],'dark',.022);
    round('Captain_console_access',[.035,.28,.34],[170.525,y+.53,s*1.1],'metal',.01);
    box('Captain_console_access_pull',[.025,.035,.13],[170.552,y+.55,s*1.1],'dark');
    box('Command_dais_edge',[5.3,.025,.045],[170,y+.132,s*3.2],'amber');
    box('Command_approach_inlay',[11,.008,.055],[179,y+.005,s*3.6],'screen');
  }
  // A compact command chair on a swivel pedestal at the forward end of the central floor, between and just behind the
  // helms and facing the windows. Its back stops below eye level, and the side aisles and helm seats stay clear.
  const forward=new T.Group();forward.name='Forward_command_chair';forward.position.set(182.4,y,0);forward.rotation.y=Math.PI/2;fit.add(forward);
  add('Command_chair_floor_inset',new T.CylinderGeometry(.85,.85,.016,24),[0,.012,0],'navy',forward);
  cyl('Command_chair_base',.36,.05,[0,.045,0],'dark',forward);
  cyl('Command_chair_pedestal',.075,.36,[0,.25,0],'metal',forward);
  cyl('Command_chair_swivel',.17,.05,[0,.455,0],'dark',forward);
  round('Command_chair_seat',[.6,.12,.58],[0,.54,.02],'navy',.05,forward);
  round('Command_chair_back',[.56,.84,.12],[0,1,-.3],'navy',.05,forward);
  round('Command_chair_headrest',[.4,.16,.06],[0,1.27,-.22],'dark',.025,forward);
  box('Command_chair_trim',[.44,.035,.015],[0,1.3,-.368],'amber',forward);
  for(const s of [-1,1]){
    box('Command_chair_arm_post',[.05,.2,.05],[s*.33,.66,-.1],'metal',forward);
    round('Command_chair_arm',[.07,.07,.44],[s*.34,.79,.04],'navy',.025,forward);
    box('Command_chair_arm_panel',[.06,.016,.3],[s*.34,.833,.08],'teal',forward);
  }
  const globe=add('Navigation_globe',new T.IcosahedronGeometry(1.1,2),[162,y+1.9,12],'screen');globe.material=materials.screen;
  globe.material=materials.screen.clone();globe.material.name='Bridge_navigation_projection';globe.material.color.setHex(0x19485c);globe.material.emissive.setHex(0x287f9a);globe.material.emissiveIntensity=.42;globe.material.roughness=.32;
  round('Navigation_plotting_table',[4,.8,4],[162,y+.4,12],'navy');
  const navFoot=add('Navigation_projector_base',new T.CylinderGeometry(1.25,1.4,.12,48),[162,y+.88,12],'metal');
  for(const r of [1.05,1.25]){
    const ring=add('Navigation_projector_ring',new T.TorusGeometry(r,.022,8,64),[162,y+.95,12],'screen');ring.rotation.x=Math.PI/2;
  }
  // Projector calibration marks provide scale without invented live telemetry.
  for(let i=0;i<24;i++){
    const a=i*Math.PI/12,r=1.32;
    const tick=box('Navigation_azimuth_tick',[i%6===0?.15:.075,.012,.02],[162+Math.cos(a)*r,y+.953,12+Math.sin(a)*r],i%6===0?'amber':'light');tick.rotation.y=-a;
  }
  for(const tilt of [0,Math.PI/2]){
    const meridian=add('Navigation_globe_meridian',new T.TorusGeometry(1.115,.013,6,64),[162,y+1.9,12],'light');meridian.rotation.y=tilt;
  }
  const equator=add('Navigation_globe_equator',new T.TorusGeometry(1.115,.013,6,64),[162,y+1.9,12],'light');equator.rotation.x=Math.PI/2;
  for(const latitude of [-.55,.55]){
    const ring=add('Navigation_latitude',new T.TorusGeometry(Math.sqrt(1.115**2-latitude**2),.009,6,64),[162,y+1.9+latitude,12],'screen');ring.rotation.x=Math.PI/2;
  }
  const orbit=add('Navigation_transfer_arc',new T.TorusGeometry(1.53,.018,8,64,Math.PI*1.55),[162,y+1.9,12],'amber');orbit.rotation.set(.45,.3,.2);
  for(const s of [-1,1]){
    box('Navigation_table_control',[.5,.04,2.7],[162+s*1.65,y+.83,12],'screen');
    for(let i=0;i<5;i++){
      box('Navigation_control_tile',[.34,.014,.32],[162+s*1.65,y+.858,11+i*.5],'dark');
      box('Navigation_control_indicator',[.24,.009,.025],[162+s*1.65,y+.871,10.91+i*.5],i===2?'amber':'light');
    }
  }
  for(const side of [-1,1]){
    round('Bridge_status_frame',[.16,2.15,9],[156.22,y+3.7,side*13],'navy',.06);
    box('Bridge_status_display',[.025,1.75,8.55],[156.315,y+3.7,side*13],'dark');
    box('Bridge_status_header',[.03,.045,7.9],[156.34,y+4.35,side*13],'screen');
    box(side<0?'Bridge_flight_status_title':'Bridge_systems_status_title',[.025,.26,7.8],[156.35,y+4.12,side*13],'navy');
    for(let i=0;i<5;i++){
      const z=side*13-3.1+i*1.55;
      box('Bridge_status_module',[.03,.8,1.14],[156.345,y+3.58,z],'navy');
      for(let j=0;j<3;j++)box('Bridge_status_trace',[.025,.04,.72-j*.14],[156.37,y+3.35+j*.22,z],'screen');
    }
    // Keep the entry and eye-level window band open; place panels on the aft wall.
    box('Bridge_rear_accent',[.045,.055,8.9],[156.33,y+2.49,side*13],'amber');
    // Bridge pass 3: shallow rear-wall panels keep the circulation footprint intact.
    for(const z of [6,11,16,21]){
      round('Bridge_acoustic_panel',[.075,1.5,3.8],[156.145,y+6.2,side*z],'navy',.025);
      for(let j=0;j<6;j++)box('Bridge_acoustic_rib',[.025,1.24,.022],[156.195,y+6.2,side*z-1.45+j*.58],'metal');
    }
    box('Bridge_upper_cove',[.06,.035,18],[156.2,y+7.13,side*14],'screen');
    for(const z of [-2.3,2.3])box('Command_dais_end_trim',[.045,.025,1.6],[170+side*2.65,y+.132,z],'metal');
    for(const z of [7,10,13,16,19]){
      round('Bridge_storage_cabinet',[.85,.9,2.7],[156.68,y+.45,side*z],'navy',.045);
      box('Bridge_storage_face',[.025,.72,2.49],[157.12,y+.48,side*z],'metal');
      box('Bridge_storage_seam',[.032,.67,.015],[157.141,y+.48,side*z],'dark');
      for(const d of [-.18,.18])box('Bridge_storage_pull',[.07,.05,.13],[157.17,y+.63,side*z+d],'dark');
    }
    box('Bridge_storage_worktop',[1,.065,15.2],[156.73,y+.94,side*13],'metal');
    box('Bridge_storage_toe_light',[.035,.025,14.4],[157.12,y+.13,side*13],'screen');
    box(side<0?'Bridge_flight_equipment_label':'Bridge_comms_equipment_label',[.025,.23,3],[157.16,y+.56,side*7],'navy');
  }
  box('Bridge_exit_sign',[.04,.4,4],[156.14,y+3.25,0],'navy');
  for(const side of [-1,1]){
    box('Bridge_entry_light',[.05,2.5,.045],[156.16,y+1.3,side*3.07],'screen');
    for(const x of [175,182,189])box('Bridge_aisle_marker',[.34,.01,.09],[x,y+.009,side*4.5],'metal');
  }
  area.overview={position:[234,91,88],target:[179,38,0]};area.inside={position:[159,y+1.7,-7],target:[178,y+1.4,4]};
}

function commandRoom(area,k){
  k.roomShell();const {box,round,console,table,rack,chair,cyl}=k,[x,y,z]=area.center;
  const consoles=()=>{for(const dx of [-8,0,8])for(const dz of [-6,5])console(x+dx,y,z+dz);};
  if(['navigation','mission','communications','securityops'].includes(area.kind)){
    consoles();box('Mission_display_wall',[18,1.35,.1],[x,y+2,z+Math.sign(z)*11.75],'screen');
    if(area.kind==='navigation'){cyl('Orbital_plotting_table',2,.8,[x,y+.4,z]);const ring=k.add('Orbit_projection',new T.TorusGeometry(1.5,.04,8,48),[x,y+1.5,z],'screen');ring.rotation.x=.7;}
    if(area.kind==='communications')for(const dx of [-11,-9,-7,7,9,11])rack(x+dx,y,z+10,'Signal_rack');
    if(area.kind==='securityops')for(const dx of [-10,-7,7,10])round('Secure_equipment_locker',[1.8,2.4,1],[x+dx,y+1.2,z+10],'metal');
  }else if(area.kind==='data'){
    for(const dx of [-10,-6,-2,2,6,10])for(const dz of [-8,-4,4,8])rack(x+dx,y,z+dz,'Flight_computer_rack');console(x,y,z);
  }else if(area.kind==='crew'){
    table(x+3,y,z+5,9);for(const dx of [-9,-5,-1,3,7,11])chair(x+dx,y,z-5);round('Crew_lounge_table',[16,.08,2],[x,y+.5,z-7],'wood');
    round('Refreshment_counter',[6,.95,1.3],[x-8,y+.475,z+10],'wood');for(const dx of [4,7,10])round('Crew_locker',[2,2.4,1],[x+dx,y+1.2,z+10],'metal');
  }else if(area.kind==='briefing'){
    table(x,y,z,17);box('Briefing_wall',[20,1.7,.12],[x,y+1.7,z+Math.sign(z)*11.75],'screen');console(x-8,y,z+8);console(x+8,y,z+8);
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
    // The status wall hangs on the outboard wall, so the spine looks in through the glass past the crew to it.
    for(const dx of [-10,-3,4,11])for(const dz of [-6,6])console(x+dx,y,z+dz,Math.PI);
    box('Propulsion_status_wall',[27,1.3,.12],[x,y+2,z+13.7],'screen');
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
  k.roomShell();const {box,round,add,cyl,console,pipe,chair}=k,[x,y,z]=area.center;
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const g=new T.Group();g.name='Transfer_shuttle';g.position.set(x+sx*17,y,sz*27);k.fit.add(g);
    round('Shuttle_lower_hull',[21,1.2,8],[0,.9,0],'navy',.5,g);
    // The cabin can be boarded: a doorway on the platform side and the windscreen are cut through its shell (which
    // then collides as its own curved surface), with a floor on the lower hull, seat rows and a two-seat flight deck.
    const cabin=round('Shuttle_cabin',[16,2.8,7],[-1,2.4,0],'lining',1.2,g);cabin.removeFromParent();
    const door=-sz*3.05;cutOut(cabin,new T.Box3(new T.Vector3(-1.05,1.45,door-.55),new T.Vector3(1.05,3.7,door+.55)));
    cutOut(cabin,new T.Box3(new T.Vector3(6.2,2.3,-2.2),new T.Vector3(7.3,3,2.2)));
    // Cabin windows beside the seat rows, both sides, glazed just inside the shell. On the boarding side the door
    // panel slides over the row by the doorway, so that side has no window there or in the doorway.
    const windows=[];
    for(const side of [-1,1])for(const wx of [-5.2,-3.7,-2.2,0,2.2,3.4]){
      if(side===-sz&&wx>-3&&wx<1)continue;windows.push([wx,side]);
      cutOut(cabin,new T.Box3(new T.Vector3(wx-.28,2.23,side*3.1-.6),new T.Vector3(wx+.28,2.97,side*3.1+.6)));
    }
    g.add(cabin);
    // A slim navy surround lines each opening through the shell, so it reads as a window inside and out.
    const surround=()=>mergeGeometries([[.64,.06,0,.37],[.64,.06,0,-.37],[.06,.8,.29,0],[.06,.8,-.29,0]].map(([w,h,dx,dy])=>new T.BoxGeometry(w,h,.16).translate(dx,dy,0)));
    for(const [wx,side] of windows){box('Shuttle_cabin_window',[.6,.76,.04],[wx,2.6,side*3.42],'glass',g);add('Shuttle_window_reveal',surround(),[wx,2.6,side*3.43],'navy',g);}
    round('Shuttle_glazing',[.2,1.1,5.6],[7.05,2.8,0],'glass',.1,g);
    box('Shuttle_cabin_floor',[12.4,.12,5.4],[-.1,1.56,0],'floor',g);
    box('Shuttle_aft_bulkhead',[.12,2.2,5.2],[-6.3,2.6,0],'lining',g);
    box('Shuttle_cabin_light',[10,.03,.3],[-.5,3.77,0],'light',g);
    for(const dx of [-5.2,-3.7,-2.2,2.2])for(const dz of [-2.2,-1.5,1.5,2.2])chair(dx,1.62,dz,Math.PI/2,g);
    box('Shuttle_flight_deck',[.8,.8,3.6],[5.6,2.02,0],'navy',g);
    const screen=box('Touchscreen',[.6,.05,3.2],[5.5,2.45,0],'screen',g);screen.rotation.z=.25;
    for(const dz of [-.9,.9])chair(4.5,1.62,dz,Math.PI/2,g);
    // Flight deck instruments: a display in front of each pilot, a side console and stick outboard of each seat, a
    // throttle pedestal between them and an overhead switch panel above the windscreen.
    for(const s of [-1,1]){
      const display=box('Raised_display',[.05,.3,.62],[5.17,2.17,s*.9],'screen',g);display.rotation.z=-.3;
      round('Shuttle_side_console',[.7,.46,.24],[4.65,1.85,s*1.5],'navy',.04,g);
      const stick=cyl('Side_stick',.025,.2,[4.75,2.18,s*1.5],'dark',g);stick.rotation.z=-.15;
      box('Throttle_handle',[.04,.16,.04],[4.78,2.2,s*.07],'metal',g);box('Throttle_handle',[.07,.04,.1],[4.78,2.29,s*.07],'dark',g);
    }
    round('Shuttle_throttle_pedestal',[.8,.5,.34],[4.7,1.87,0],'navy',.04,g);
    box('Pedestal_status',[.3,.012,.24],[4.5,2.126,0],'screen',g);
    round('Shuttle_overhead_panel',[.9,.1,1.8],[5.5,3.69,0],'navy',.04,g);
    for(const [dx,m] of [[-.25,'screen'],[0,'amber'],[.25,'green']])box('Overhead_switch_status',[.06,.016,1.5],[5.5+dx,3.632,0],m,g);
    for(const s of [-1,1]){round('Shuttle_engine',[6,1.8,2.2],[-6,1.8,s*5.1],'metal',.6,g);box('Shuttle_wing',[9,.22,3],[-3,1.5,s*3.9],'lining',g);}
    box('Shuttle_tail',[4,3,.3],[-8.5,3.2,0],'lining',g);
    for(const dx of [-7,7])for(const side of [-1,1])box('Docking_cradle',[1,.4,1],[dx,.2,side*3.2],'amber',g);
    const px=x+sx*17,pz=sz*20;
    box('Boarding_platform',[15,1.5,3],[px,y+.75,pz],'floor');
    for(let i=0;i<8;i++)box('Boarding_step',[3,(i+1)*.1875,.4],[px-6,y+(i+1)*.09375,pz-sz*(4.3-i*.4)],'lining');
    box('Shuttle_boarding_bridge',[3,.12,2.6],[px,y+1.44,sz*22.5],'floor');
    box('Shuttle_boarding_door',[2.1,2,.1],[px-2.2,y+2.5,sz*23.58],'navy');
    for(const side of [-1,1])pipe('Platform_rail',[px+side*7.2,y+2.6,pz-1],[px+side*7.2,y+2.6,pz+1],.045);
    // Pad identity: orange safety edging, a guide line from the handling lane to the boarding steps, a large
    // floor number that reads upright from the centre lane, and a teal status beacon at the dock corner.
    const pad=(sz<0?0:2)+(sx<0?1:2);
    for(const s of [-1,1]){box('Pad_safety_edge',[24,.018,.15],[px,y+.012,sz*(23.25+s*11.25)],'rescue');box('Pad_safety_edge',[.15,.018,22.5],[px+s*12,y+.012,sz*23.25],'rescue');}
    box('Pad_guide_line',[.12,.022,5.5],[px-6,y+.013,sz*12.75],'amber');
    const strokes={0:'abcdef',1:'bc',2:'abged',3:'abgcd',4:'fgbc'},parts={a:[0,1.85,1],b:[.85,.92,0],c:[.85,-.92,0],d:[0,-1.85,1],e:[-.85,-.92,0],f:[-.85,.92,0],g:[0,0,1]};
    [0,pad].forEach((n,i)=>{const cx=px+3+sz*(i?-1.2:1.2);for(const p of strokes[n]){const [u,v,h]=parts[p];box('Pad_number_stencil',h?[1.7,.016,.32]:[.32,.016,1.7],[cx-sz*u,y+.011,sz*(15+v)],'navy');}});
    cyl('Pad_beacon_post',.09,1.2,[px+11,y+.6,sz*13]);cyl('Pad_status_beacon',.16,.22,[px+11,y+1.31,sz*13],'screen');
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
  // Fit-out repeated in every craft goes in one instanced mesh per part, like the seats: name, geometry, finish and
  // one transform per copy.
  const repeats=new Map(),repeat=(name,geometry,m,p,rot=[0,0,0])=>{let r=repeats.get(name);if(!r)repeats.set(name,r={geometry:geometry(),m,list:[]});r.list.push(new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...rot)),new T.Vector3(1,1,1)));};
  const slab=size=>()=>new T.BoxGeometry(...size),soft=(size,r)=>()=>new RoundedBoxGeometry(...size,2,r),rod=(r,h)=>()=>new T.CylinderGeometry(r,r,h,12);
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
      // Craft, not corridor: rounded bow and stern caps, a rescue-orange band with rub rails and portholes on the
      // boarding side, and an orange hatch frame with a ready lamp over the door.
      round('Lifeboat_bow_fairing',[.6,2.5,7],[x+10.88,y+1.4,z],'lining',.28);
      round('Lifeboat_stern_cap',[.6,2.5,7],[x-10.88,y+1.4,z],'lining',.28);
      box('Lifeboat_front_glazing',[.08,.8,4],[x+11.2,y+1.7,z],'screen');
      for(const dz of [-2.4,2.4]){const nozzle=k.cyl('Lifeboat_thruster',.45,.3,[x-11.3,y+.9,z+dz],'dark');nozzle.rotation.z=Math.PI/2;}
      const out=-side,face=z+out*3.83;
      for(const dx of [-6,6]){
        box('Lifeboat_livery_band',[9,.34,.03],[x+dx,y+1.02,face+out*.015],'rescue');
        round('Lifeboat_rub_rail',[9,.14,.16],[x+dx,y+.32,face+out*.08],'metal',.06);
        for(const px of [-3,0,3]){
          const glass=k.cyl('Lifeboat_porthole',.27,.24,[x+dx+px,y+1.68,z+out*3.75],'screen');glass.rotation.x=Math.PI/2;
          const ring=k.cyl('Lifeboat_porthole_ring',.36,.024,[x+dx+px,y+1.68,face+out*.012],'metal');ring.rotation.x=Math.PI/2;
        }
      }
      round('Lifeboat_rub_rail',[21.4,.14,.16],[x,y+2.74,face+out*.08],'metal',.06);
      for(const s of [-1,1])box('Lifeboat_hatch_frame',[.14,2.35,.08],[x+s*1.57,y+1.175,face+out*.04],'rescue');
      box('Lifeboat_ready_lamp',[.6,.1,.05],[x,y+2.45,face+out*.11],'green');
      box('Boarding_light',[8,.03,.18],[x,y+3.24,side*58.9],'light',shell);
      // Inside: a helm with a sloped flight display, two raised screens, twin control sticks and a forward view screen
      // on the bow bulkhead; overhead stowage bins with orange latches and a reading-light strip along both long walls.
      repeat('Helm_flight_display',slab([.62,.05,1.6]),'screen',[x+9.3,y+1.2,z],[0,0,.38]);
      repeat('Helm_display_bezel',slab([.08,.56,1.72]),'dark',[x+9.84,y+1.4,z]);
      for(const dz of [-.43,.43])repeat('Helm_raised_screen',slab([.03,.46,.78]),'screen',[x+9.79,y+1.42,z+dz]);
      for(const dz of [-.92,.92]){repeat('Helm_control_stick',rod(.025,.26),'dark',[x+9.06,y+1.24,z+dz]);repeat('Helm_stick_grip',rod(.045,.09),'rescue',[x+9.06,y+1.4,z+dz]);}
      repeat('Helm_status_lamps',slab([.04,.05,1.2]),'green',[x+8.88,y+.98,z]);
      repeat('Bow_view_screen_frame',slab([.04,1.06,3.8]),'dark',[x+10.4,y+1.86,z]);
      repeat('Bow_view_screen',slab([.02,.9,3.6]),'screen',[x+10.37,y+1.86,z]);
      for(const wall of [-1,1])for(const half of [-1,1]){
        const wz=z+wall*3.395;
        for(let b=0;b<4;b++){const bx=x+half*(2.55+b*1.95);repeat('Overhead_stowage_bin',soft([1.9,.5,.55],.05),'lining',[bx,y+2.53,wz]);repeat('Stowage_bin_latch',slab([.32,.06,.02]),'rescue',[bx,y+2.36,wz-wall*.28]);}
        repeat('Cabin_reading_light',slab([7.7,.025,.12]),'light',[x+half*5.48,y+2.27,z+wall*3.27]);
      }
    }
  }
  const positions=[];
  for(const [x,z]of centers)for(let row=0;row<20;row++)for(const dz of [-2.2,-1.4,.5,1.3,2.1])positions.push([x+(row<10?-8.2+row*.8:1+(row-10)*.8),y,z+dz]);
  // Each seat also gets a headrest, an orange shoulder harness and a chest buckle.
  for(const p of positions){repeat('Evacuation_headrest',soft([.12,.22,.42],.05),'dark',[p[0]-.28,p[1]+1.38,p[2]]);for(const dz of [-.14,.14])repeat('Evacuation_harness_strap',slab([.02,.56,.06]),'rescue',[p[0]-.21,p[1]+.95,p[2]+dz]);repeat('Evacuation_harness_buckle',slab([.03,.09,.12]),'metal',[p[0]-.2,p[1]+.78,p[2]]);}
  for(const [name,r]of repeats){const mesh=new T.InstancedMesh(r.geometry,materials[r.m],r.list.length);mesh.name=name;r.list.forEach((m,i)=>mesh.setMatrixAt(i,m));fit.add(mesh);}
  for(const [name,size,offset,material]of [['Evacuation_seat',[.62,.16,.6],[0,.48,0],'navy'],['Evacuation_seat_back',[.12,.73,.62],[-.28,.91,0],'navy'],['Evacuation_seat_base',[.08,.4,.45],[0,.2,0],'metal']]){
    const mesh=new T.InstancedMesh(new T.BoxGeometry(...size),materials[material],positions.length);mesh.name=name;
    positions.forEach((p,i)=>mesh.setMatrixAt(i,new T.Matrix4().makeTranslation(p[0]+offset[0],p[1]+offset[1],p[2]+offset[2])));fit.add(mesh);
  }
  k.root.userData={...k.root.userData,craft:20,seatsPerCraft:100,seats:2000,layout:'100 physical seat positions per craft; endurance and egress not sized'};
  area.overview={position:[205,y+235,255],target:[0,y,0]};area.inside={position:[-104,y+1.7,65.15],target:[-122,y+1.3,65.15]};
}

function buildcreateSpecialArea(area){
  // Keep descriptors immutable: camera poses belong to this built area instance.
  area={...area};const k=kit(area);
  if(area.kind==='bridge')bridge(area,k);
  else if(area.kind==='hangar')hangar(area,k);
  else if(area.kind==='lifeboats')lifeboats(area,k);
  else if(area.category==='Aft engineering')engineering(area,k);
  else commandRoom(area,k);
  finishShipArea(area,k);
  k.root.traverse(o=>{if(!o.isMesh)return;if(o.name==='Bridge_glazing_upper_exterior_row')tintWorldWindow(o,p=>new T.Vector3(Math.max(1,p.x-160),.5,p.z));if(o.name==='Shuttle_glazing'||o.name==='Lifeboat_front_glazing')tintBoxWindow(o,'x',1);if(o.name==='Shuttle_cabin_window')tintBoxWindow(o,'z',Math.sign(o.position.z));});
  const [x,y,z]=area.center;
  return {...k,area,overview:area.overview||{position:[x+area.width*.9,y+Math.max(area.width,area.depth)*.9,z+area.depth*1.1],target:[x,y+1,z]},inside:area.inside||{position:[x,y+1.7,z+(z>0?-1:1)*(area.depth/2-2)],target:[x+3,y+1.3,z]}};
}

export function createSpecialArea(area){return anchorArea(buildcreateSpecialArea(area),area.id);}
