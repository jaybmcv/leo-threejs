import {COMMAND_AFT_AREAS,createCommandAft,polishCommandRoom} from './command-deck.js';
import * as T from 'three';
import {LOWER_AFT_AREAS,createLowerAftArea} from './lower-aft.js';
import {VOYAGE_FORUM,createVoyageForum} from './voyage-forum.js';
import {LOWER_BOW_AREAS,createLowerBowArea} from './lower-bow.js';
import {UPPER_AFT_AREAS,createUpperAftArea} from './upper-aft.js';
import {SUPPORT_AREAS,createSupportArea} from './neighborhood-services.js';
import {finishShipArea} from './area-finish.js';
import {unionRectangles,slabGeometry} from './floor-geometry.js';
import {SPECIAL_AREAS,createSpecialArea} from './special-areas.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from './assets/helvetiker-bold.json' with {type:'json'};

const font=new FontLoader().parse(fontData);
const schedules=[
  [1,'Cargo & logistics',[
    ['cargo','Container hold A'],['cargo','Container hold B'],['stores','Mission stores'],['cold','Cold stores'],
    ['workshop','Cargo maintenance'],['logistics','Freight control'],['cargo','Supply hold'],['stores','Spare-parts depot']]],
  [2,'Passenger transfer',[
    ['arrival','Arrival hall'],['security','Passenger screening'],['airlock','Suit-up & airlocks'],['logistics','Transfer control'],
    ['baggage','Baggage reclaim'],['arrival','Embarkation lounge'],['airlock','Emergency embarkation'],['workshop','Shuttle support workshop']]],
  [3,'Food & cultivation',[
    ['farm','Hydroponic garden A'],['farm','Hydroponic garden B'],['nursery','Seed nursery'],['harvest','Harvest processing'],
    ['kitchen','Main galley'],['cold','Refrigerated provisions'],['stores','Dry provisions'],['farm','Leaf-crop cultivation']]],
  [4,'Life support',[
    ['air','Atmosphere processing'],['water','Water treatment'],['thermal','Thermal control'],['recycle','Materials recovery'],
    ['power','Power distribution'],['water','Water reserve & testing'],['workshop','Systems maintenance'],['control','Life-support control']]],
  [5,'Medical & shelter',[
    ['ward','Medical ward'],['surgery','Surgical suite'],['pharmacy','Pharmacy'],['isolation','Isolation ward'],
    ['clinic','General clinic'],['imaging','Diagnostics & imaging'],['counseling','Counseling & quiet rooms'],['shelter','Emergency shelter']]],
  [16,'Education & recreation',[
    ['classroom','Learning center'],['library','Voyage library'],['gym','Exercise studio'],['recreation','Recreation hall'],
    ['theater','Community theater'],['childcare','Young explorers'],['dining','Communal dining'],['community','Community workshop']]],
];

const STANDARD_AREAS=schedules.flatMap(([deck,category,rooms])=>rooms.map(([kind,name],i)=>({
  id:`d${String(deck).padStart(2,'0')}-${kind}-${i+1}`,name,kind,category,deck,
  center:[[-115,-45,25,95][i%4],-40+(deck-1)*4+.3,(i<4?-1:1)*(deck===16&&i%4===0?26:38)],
  width:52,depth:34,height:3.5,
  description:({cargo:'Secured freight modules, handling lanes and cargo restraints.',stores:'Inventory racks with an inspection and issue counter.',cold:'Insulated storage banks and a packing bench.',workshop:'Repair benches, tool storage and maintenance equipment.',logistics:'Dispatch consoles, status boards and transfer coordination.',arrival:'Seating, check-in counters and passenger circulation.',security:'Screening lanes, inspection stations and staff workpoints.',airlock:'Suit racks, preparation benches and paired pressure-door chambers.',baggage:'Reclaim conveyors, luggage storage and a service counter.',farm:'Stacked growing beds, irrigation lines and harvest aisles.',nursery:'Seedling benches, propagation shelves and cultivation workstations.',harvest:'Produce washing, sorting and packing worktables.',kitchen:'Preparation islands, cooking lines, sinks and meal service.',air:'Air-handling banks, filter housings and monitoring stations.',water:'Treatment tanks, filter vessels, pipe manifolds and testing benches.',thermal:'Heat-exchanger banks, coolant manifolds and maintenance access.',recycle:'Sorting stations, compactors and recovery bins.',power:'Electrical cabinets, distribution buswork and monitoring.',control:'Operator consoles and shared systems-status displays.',ward:'Patient beds, bedside services and a nursing station.',surgery:'Procedure stations, instrument carts and scrub facilities.',pharmacy:'Dispensing counter, secure cabinets and preparation benches.',isolation:'Separated patient bays and a staff preparation area.',clinic:'Consultation bays, examination beds and reception.',imaging:'Diagnostic scanner, examination stations and operator consoles.',counseling:'Small conversation settings, privacy screens and quiet seating.',shelter:'Emergency seating, supplies, hygiene stations and coordination.',classroom:'Teaching spaces, student desks and collaborative tables.',library:'Book stacks, study desks and shared reading tables.',gym:'Exercise machines, stretching space and changing lockers.',recreation:'Games, social tables and an open activity floor.',theater:'A small stage, tier-free seating and projection screens.',childcare:'Low play furniture, activity tables and supervised learning.',dining:'Shared meal tables, service counters and a wash-up station.',community:'Maker benches, materials storage and collaborative work areas.'})[kind],
})));

export const SHIP_AREAS=[...STANDARD_AREAS,...SPECIAL_AREAS,...SUPPORT_AREAS,...UPPER_AFT_AREAS,...LOWER_BOW_AREAS,VOYAGE_FORUM,...LOWER_AFT_AREAS,...COMMAND_AFT_AREAS];

const materials=new Map();
function mat(name,color,extra={}){if(!materials.has(name))materials.set(name,new T.MeshStandardMaterial({name,color,roughness:.8,metalness:.08,...extra}));return materials.get(name);}
export function createShipArea(area){
  if(area.deck===20)return polishCommandRoom(area,area.commandAft?createCommandAft(area):createSpecialArea(area));
  if(area.lowerAft)return createLowerAftArea(area);
  if(area.forum)return createVoyageForum(area);
  if(area.lowerBow)return createLowerBowArea(area);
  if(area.upperAft)return createUpperAftArea(area);
  if(area.support)return createSupportArea(area);
  if(area.special)return createSpecialArea(area);
  const root=new T.Group();root.name=`Area_${area.id}`;root.position.set(...area.center);root.userData={...area,stage:'Furnished concept',units:'metres'};
  const shell=new T.Group();shell.name='Walls_and_ceiling';root.add(shell);
  const fit=new T.Group();fit.name='Room_fittings';root.add(fit);
  const cream=mat('Area_lining',0xd9ddd6),floor=mat('Area_floor',0xb8b6a9),navy=mat('Area_navy',0x304e61),wood=mat('Area_timber',0x9c7b55),silver=mat('Area_equipment',0x8da0a3),blue=mat('Area_screen',0x285972,{emissive:0x1a495f,emissiveIntensity:.25}),green=mat('Area_green',0x62977c),dark=mat('Area_dark',0x24333a),linen=mat('Area_linen',0xacc6cf),amber=mat('Area_amber',0xd3a65e),glow=mat('Area_light',0xffebc7,{emissive:0xffe6b6,emissiveIntensity:.8});
  const add=(name,geo,material,p=[0,0,0],parent=fit)=>{const o=new T.Mesh(geo,material);o.name=name;o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(name,size,p,material=cream,parent=fit)=>add(name,new T.BoxGeometry(...size),material,p,parent);
  const cylinder=(name,r,h,p,material=silver)=>add(name,new T.CylinderGeometry(r,r,h,16),material,p);
  const tube=(name,a,b,r=.06,material=silver)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),o=add(name,new T.CylinderGeometry(r,r,va.distanceTo(vb),10),material,va.clone().add(vb).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return o;};
  function text(label,p,rotation=Math.PI/2,size=.32){const geo=new TextGeometry(label,{font,size,depth:.006,curveSegments:2});geo.computeBoundingBox();geo.translate(-geo.boundingBox.max.x/2,0,0);const o=add('Wayfinding_text',geo,glow,p);o.rotation.y=rotation;return o;}
  const coreNotch=area.deck===16&&area.center[0]===-115;
  const inboard=-Math.sign(area.center[2]),notch={x0:-26,x1:-12,z0:Math.min(inboard*17,inboard*9),z1:Math.max(inboard*17,inboard*9)};
  const floorPolys=coreNotch?unionRectangles([{x0:-26,x1:26,z0:-17,z1:17}],[notch]):null;
  if(coreNotch)add('Finished_floor',slabGeometry(floorPolys,0,.25),floor);else box('Finished_floor',[52,.25,34],[0,-.125,0],floor);
  for(const s of [-1,1])if(coreNotch&&s===inboard)box('Side_wall',[38,3.3,.16],[7,1.65,s*16.92],cream,shell);else box('Side_wall',[52,3.3,.16],[0,1.65,s*16.92],cream,shell);
  if(coreNotch){box('Stair_lobby_return_wall',[.16,3.3,8],[-12.08,1.65,inboard*13],cream,shell);box('Stair_lobby_partition',[14,3.3,.16],[-19,1.65,inboard*9.08],cream,shell);}
  box('End_wall',[.16,3.3,34],[25.92,1.65,0],cream,shell);
  for(const s of [-1,1])box('Entry_wall',[.16,3.3,15],[-25.92,1.65,s*9.5],cream,shell);
  box('Entry_header',[.16,.5,4],[-25.92,3.05,0],cream,shell);
  if(coreNotch)add('Ceiling',slabGeometry(floorPolys,3.44,.14),cream,[0,0,0],shell);else box('Ceiling',[52,.14,34],[0,3.37,0],cream,shell);
  for(const z of [-12,-6,0,6,12])box('Ceiling_light',[coreNotch&&z*inboard>9?33:43,.04,.22],[coreNotch&&z*inboard>9?5:0,3.27,z],glow,shell);
  for(const z of [-2,2])box('Main_aisle_edge',[49,.014,.055],[0,.012,z],amber);
  box('Area_identity_panel',[.08,.65,14],[25.8,2.55,0],navy);
  text(area.name.toUpperCase(),[25.72,2.4,0],-Math.PI/2,.34);
  text(`D${area.deck} / ${area.category.toUpperCase()}`,[-25.8,2.96,0],Math.PI/2,.16);
  function chair(x,z,rotation=0,y=0){const g=new T.Group();g.name='Chair';g.position.set(x,y,z);g.rotation.y=rotation;fit.add(g);box('Seat',[.66,.16,.7],[0,.46,0],navy,g);box('Back',[.68,.65,.12],[0,.85,-.3],navy,g);for(const sx of [-1,1])for(const sz of [-1,1])box('Leg',[.06,.4,.06],[sx*.25,.2,sz*.25],wood,g);}
  function desk(x,z,screen=true){box('Worktop',[2.4,.12,1.05],[x,.82,z],wood);for(const s of [-1,1])box('Desk_support',[.14,.76,.8],[x+s,.38,z],silver);chair(x,z+1.2,Math.PI);if(screen){box('Display',[1,.55,.08],[x,1.2,z-.25],blue);box('Display_stand',[.1,.3,.1],[x,.94,z-.25],silver);}}
  function rack(x,z,contents='crate'){const g=new T.Group();g.name=contents==='plants'?'Hydroponic_rack':'Storage_rack';fit.add(g);for(const sx of [-1,1])for(const sz of [-1,1])box('Rack_post',[.08,2.8,.08],[x+sx*2.4,1.4,z+sz*.75],silver,g);for(let level=0;level<3;level++){const y=.3+level*.88;box('Shelf',[5,.1,1.65],[x,y,z],silver,g);for(let j=0;j<6;j++){if(contents==='plants'){box('Grow_tray',[.68,.15,1.2],[x-2+j*.8,y+.13,z],dark,g);for(let k=0;k<3;k++)add('Leaf_cluster',new T.IcosahedronGeometry(.2,0),green,[x-2+j*.8,y+.42,z-.35+k*.35],g);}else box(contents==='books'?'Book_stack':'Supply_crate',[.68,contents==='books'?.42:.6,1.25],[x-2+j*.8,y+.36,z],contents==='books'?wood:amber,g);}}}
  function cabinet(x,z,label='Equipment_cabinet'){box(label,[2.2,2.6,1.1],[x,1.3,z],silver);box('Cabinet_door',[2,.02,.04],[x,1.3,z+.57],dark);box('Status_display',[.5,.24,.03],[x,2,z+.58],blue);}
  function table(x,z,seats=4){box('Shared_table',[3.4,.12,1.5],[x,.78,z],wood);for(const s of [-1,1])box('Table_leg',[.14,.72,1],[x+s*1.35,.36,z],silver);for(let i=0;i<seats/2;i++)for(const s of [-1,1])chair(x-1+i*2,z+s*1.25,s===1?Math.PI:0);}
  function counter(x,z,length=8){box('Service_counter',[length,.9,1.1],[x,.45,z],cream);box('Countertop',[length+.1,.08,1.25],[x,.94,z],wood);}
  function bed(x,z,isolation=false){box('Patient_bed_base',[1.15,.42,2.2],[x,.3,z],silver);box('Mattress',[1.1,.2,2.1],[x,.61,z],cream);box('Blanket',[1.11,.035,1.5],[x,.73,z-.15],linen);box('Pillow',[.8,.12,.4],[x,.79,z+.8],cream);box('Bedside_cabinet',[.55,.7,.65],[x+.95,.35,z+.55],silver);box('Patient_monitor',[.48,.4,.08],[x+.95,1.05,z+.45],blue);tube('IV_stand',[x-.85,0,z+.5],[x-.85,1.9,z+.5],.025);if(isolation){box('Privacy_partition',[.12,2.7,4.5],[x-2.4,1.35,z],cream);box('Patient_bay_back',[4.8,2.7,.12],[x,1.35,z+2.2],cream);}}
  const grid=(xs,zs,fn)=>{for(const x of xs)for(const z of zs)fn(x,z);};
  switch(area.kind){
    case 'cargo':grid([-18,-9,0,9,18],[-11,10],(x,z)=>{for(let level=0;level<2;level++){box('Secured_cargo_container',[6,1.3,4.5],[x,.7+level*1.35,z],amber);for(const d of [-2,0,2])box('Container_reinforcement',[.08,1.3,4.58],[x+d,.7+level*1.35,z],navy);}for(const dz of [-2.7,2.7])box('Cargo_restraint_rail',[6.6,.12,.14],[x,.1,z+dz],silver);});desk(-20,4);break;
    case 'stores':case 'cold':case 'pharmacy':grid([-18,-9,0,9,18],[-12,-7,7,12],(x,z)=>{if(area.kind==='cold')cabinet(x,z,'Insulated_storage');else rack(x,z);});counter(-20,4,7);break;
    case 'workshop':case 'community':grid([-16,-5,6,17],[-9,9],(x,z)=>{counter(x,z,6);for(let j=0;j<4;j++)box('Tool',[.35,.2,.25],[x-2+j*1.1,1.1,z],navy);box('Tool_board',[5,1.1,.12],[x,1.8,z-.55],silver);});grid([-19,-12,-5,2,9,16],[-15],cabinet);break;
    case 'logistics':case 'control':grid([-15,-7,1,9,17],[-8,7],desk);for(const z of [-10,-5,0,5,10])box('Systems_wall_display',[.08,1.45,3.6],[25.75,1.3,z],blue);table(-17,12);break;
    case 'arrival':grid([-16,-7,2,11,20],[-10,-6,6,10],(x,z)=>{box('Passenger_bench',[5,.48,.75],[x,.24,z],navy);box('Passenger_bench_back',[5,.65,.12],[x,.72,z-.32],navy);});counter(17,14,10);desk(-19,13);break;
    case 'security':for(const z of [-10,-5,5,10]){box('Screening_lane',[28,.035,.07],[0,.03,z],amber);for(const s of [-1,1])box('Scanner_upright',[.4,2.6,.4],[0,1.3,z+s*1.3],silver);box('Scanner_crossbar',[.4,.35,3],[0,2.7,z],silver);box('Tray_conveyor',[9,.75,1],[10,.38,z],navy);desk(-12,z);}break;
    case 'airlock':
      for(const z of [-10,10])for(const x of [-12,2,16]){
        box('Pressure_chamber_floor',[9,.08,8],[x,.04,z],silver);
        for(const dz of [-3.9,3.9])box('Pressure_chamber_side',[9,2.9,.2],[x,1.45,z+dz],cream);
        box('Pressure_chamber_roof',[9,.16,8],[x,2.98,z],cream,shell);
        for(const dx of [-4.4,4.4]){
          for(const dz of [-2.7,2.7])box('Airlock_door_frame',[.22,2.9,2.4],[x+dx,1.45,z+dz],navy);
          box('Airlock_header',[.22,.5,3],[x+dx,2.65,z],navy);
          // Stowed paired leaves make the central 3 m passage legible in the concept view.
          for(const s of [-1,1])box('Pressure_door_leaf_stowed',[.12,2.35,1.45],[x+dx-.15,1.2,z+s*2.25],silver);
          box('Pressure_cycle_panel',[.12,.5,.35],[x+dx-.23,1.4,z-1.72],blue);
          box('Pressure_door_threshold',[.35,.04,3],[x+dx,.1,z],amber);
        }
        for(const s of [-1,1]){
          box('Airlock_preparation_bench',[5,.48,.6],[x,.3,z+s*3.35],wood);
          tube('Airlock_grab_rail',[x-2,1.2,z+s*3.7],[x+2,1.2,z+s*3.7],.04);
        }
      }
      for(const z of [-15,15])for(let x=-20;x<=20;x+=4){box('Suit_locker',[1.6,2.5,.8],[x,1.25,z],cream);add('Suit_helmet',new T.SphereGeometry(.22,10,8),navy,[x,2,z-.5]);}
      break;
    case 'baggage':for(const z of [-9,9]){box('Baggage_conveyor',[35,.75,4],[1,.375,z],navy);for(let i=0;i<9;i++)box('Luggage',[1,.7,.65],[-14+i*3.7,1.1,z+(i%2?1:-1)],amber);}counter(-19,4,7);break;
    case 'farm':case 'nursery':grid([-18,-9,0,9,18],[-12,-7,7,12],(x,z)=>rack(x,z,'plants'));for(const z of [-14,14])tube('Irrigation_manifold',[-22,.15,z],[23,.15,z],.09,blue);desk(-21,4);break;
    case 'harvest':case 'kitchen':grid([-17,-6,5,16],[-9,9],(x,z)=>{counter(x,z,7);box(area.kind==='kitchen'?'Cooking_surface':'Wash_sink',[2,.08,.8],[x,1.02,z],silver);for(let j=0;j<3;j++)cylinder(area.kind==='kitchen'?'Cooking_pot':'Produce_bin',.32,.3,[x-2+j*1.5,1.18,z],area.kind==='kitchen'?silver:green);});grid([-18,-9,0,9,18],[-15],cabinet);break;
    case 'air':case 'thermal':grid([-17,-6,5,16],[-10,10],(x,z)=>{box(area.kind==='air'?'Air_handling_unit':'Heat_exchanger',[7,2.4,4],[x,1.2,z],silver);for(let i=0;i<9;i++)box('Exchanger_fins',[.09,2,4.05],[x-2.8+i*.7,1.2,z],navy);tube('Service_pipe',[x,2.6,z],[x,2.6,z>0?3:-3],.18,blue);});desk(-20,4);break;
    case 'water':grid([-17,-6,5,16],[-10,10],(x,z)=>{cylinder('Water_treatment_vessel',1.9,2.65,[x,1.35,z]);tube('Tank_manifold',[x,1,z],[x,1,z>0?4:-4],.17,blue);cylinder('Filter_vessel',.5,1.8,[x+3.3,.9,z],navy);});counter(-18,4,7);break;
    case 'recycle':grid([-17,-6,5,16],[-10,10],(x,z)=>{box('Recovery_machine',[6,2.2,3.5],[x,1.1,z],silver);box('Feed_hopper',[3,.65,2.5],[x,2.45,z],navy);for(const s of [-1,1])box('Sorting_bin',[1.8,1.1,1.8],[x+s*3.5,.55,z],s===1?green:amber);});desk(-20,4);break;
    case 'power':grid([-20,-14,-8,-2,4,10,16,22],[-12,-7,7,12],(x,z)=>cabinet(x,z,'Power_distribution_cabinet'));for(const z of [-13,13])tube('Overhead_busbar',[-22,2.95,z],[23,2.95,z],.13,amber);desk(-20,3.5);break;
    case 'ward':case 'isolation':
      grid([-18,-10,-2,6,14,22],[-12,-5.5,5.5,12],(x,z)=>{
        bed(x,z,area.kind==='isolation');
        box('Bedhead_services',[3.8,.42,.12],[x,1.1,z+1.7],navy);
        if(area.kind==='ward'){
          box('Patient_bay_screen',[.08,1.75,3.8],[x-2.6,.875,z+.15],linen);
          tube('Curtain_track',[x-2.6,2.55,z-1.8],[x-2.6,2.55,z+2.1],.03);
        }
      });
      desk(-23,-5);box('Nursing_station',[1.1,.95,6],[-24,.475,8],wood);
      box('Nursing_records',[.8,.6,2],[-24,1.25,8],silver);
      break;
    case 'surgery':grid([-15,0,15],[-9,9],(x,z)=>{bed(x,z);cylinder('Instrument_cart',.45,.8,[x+2,.4,z-1]);tube('Surgical_light_arm',[x,3.1,z],[x,2.35,z],.04);cylinder('Surgical_light',.5,.12,[x,2.35,z],glow);box('Procedure_partition',[.1,2.8,10],[x-6,1.4,z],cream);});counter(-20,4,6);break;
    case 'clinic':grid([-16,-4,8,20],[-10,10],(x,z)=>{bed(x,z);desk(x+3,z-1);box('Consultation_partition',[.1,2.6,10],[x-5,1.3,z],cream);});counter(-18,4,6);break;
    case 'imaging':for(const z of [-10,10]){const scanner=add('Diagnostic_scanner',new T.TorusGeometry(1.1,.36,12,28),silver,[8,1.55,z]);scanner.rotation.y=Math.PI/2;box('Scanner_patient_table',[5,.55,.85],[5,.5,z],cream);desk(-5,z);box('Scanner_control_partition',[.1,2.6,10],[-12,1.3,z],cream);}grid([-21,-16],[-12,12],cabinet);break;
    case 'counseling':grid([-16,-4,8,20],[-9,9],(x,z)=>{table(x,z);box('Privacy_screen',[.14,2.5,9],[x-5,1.25,z],cream);box('Soft_rug',[8,.025,7],[x,.02,z],green);});break;
    case 'shelter':for(const x of [-18,-10,-2,6,14,22])for(const z of [-12,-8,8,12])box('Shelter_bench',[5,.45,1],[x,.225,z],navy);grid([-20,-12,-4,4,12,20],[-15],cabinet);counter(-19,4,7);break;
    case 'classroom':grid([-18,-10,-2,6,14,22],[-11,-6,6,11],(x,z)=>desk(x,z,false));for(const z of [-9,9])box('Teaching_screen',[.09,1.5,6],[25.75,1.4,z],blue);break;
    case 'library':grid([-18,-9,0,9,18],[-12,-7],(x,z)=>rack(x,z,'books'));grid([-16,-4,8,20],[8,13],table);break;
    case 'gym':grid([-18,-10,-2,6,14,22],[-10],(x,z)=>{box('Treadmill',[1.3,.22,2.6],[x,.15,z],navy);tube('Treadmill_handle',[x-.5,.3,z-1],[x-.5,1.35,z-1]);tube('Treadmill_handle',[x+.5,.3,z-1],[x+.5,1.35,z-1]);box('Fitness_display',[1,.4,.16],[x,1.4,z-1],blue);});grid([-17,-7,3,13],[8,12],(x,z)=>box('Stretching_mat',[6,.05,2.6],[x,.04,z],green));grid([-20,-14,-8,-2,4,10,16,22],[-15],cabinet);break;
    case 'recreation':grid([-15,0,15],[-9,9],(x,z)=>{table(x,z);box('Game_board',[1.3,.025,1],[x,.86,z],green);});box('Activity_floor',[15,.03,9],[0,.025,0],navy);break;
    case 'theater':box('Stage',[7,.3,22],[21,.15,0],wood);box('Projection_screen',[.1,2.4,16],[25.75,1.5,0],blue);for(let x=-19;x<=12;x+=3.8)for(const z of [-12,-9,-6,6,9,12])chair(x,z,Math.PI/2);break;
    case 'childcare':grid([-16,-3,10],[-9,9],(x,z)=>{box('Play_rug',[9,.03,8],[x,.02,z],green);box('Activity_table',[3,.55,1.7],[x,.275,z],wood);for(const s of [-1,1])box('Low_bench',[3,.3,.6],[x,.15,z+s*1.5],navy);for(let i=0;i<4;i++)box('Play_block',[.65,.65,.65],[x-3+i*.8,.34,z+2.7],i%2?amber:linen);});counter(21,11,6);break;
    case 'dining':grid([-17,-6,5,16],[-10,-5,5,10],(x,z)=>table(x,z,4));counter(0,15,39);for(const x of [-15,-5,5,15])box('Meal_service_station',[2,.5,.85],[x,1.2,15],silver);break;
  }
  // A scale figure keeps even the industrial rooms legible as inhabited spaces.
  const figure=new T.Group();figure.name='Resident_scale_1_75m';figure.position.set(-12,0,-2.6);fit.add(figure);
  box('Torso',[.45,.62,.3],[0,1,0],navy,figure);for(const s of [-1,1])box('Leg',[.15,.7,.17],[s*.13,.35,0],navy,figure);add('Cat_head',new T.SphereGeometry(.19,10,8),amber,[0,1.54,0],figure);for(const s of [-1,1])add('Cat_ear',new T.ConeGeometry(.08,.17,3),amber,[s*.11,1.73,0],figure);
  root.updateMatrixWorld(true);
  if(coreNotch){
    const reserved=new T.Box3(new T.Vector3(area.center[0]+notch.x0,area.center[1],area.center[2]+notch.z0),new T.Vector3(area.center[0]+notch.x1,area.center[1]+3.5,area.center[2]+notch.z1));
    for(const o of [...fit.children])if(o.name!=='Finished_floor'&&new T.Box3().setFromObject(o).intersectsBox(reserved))fit.remove(o);
    root.userData.stairLobbyNotch=notch;
  }
  finishShipArea(area,{root,shell,fit});
  return {root,shell,fit,area,overview:{position:[area.center[0]+56,area.center[1]+53,area.center[2]+48],target:[...area.center]},inside:{position:[area.center[0]-19,area.center[1]+1.7,area.center[2]+1],target:[area.center[0]+10,area.center[1]+1.4,area.center[2]-5]}};
}
