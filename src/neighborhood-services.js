import * as T from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from './assets/helvetiker-bold.json' with {type:'json'};
import {finishShipArea} from './area-finish.js';
import {finishCirculation} from './circulation-finish.js';

export const SUPPORT_AREAS=[
 {deck:14,service:'laundry',kind:'stores',name:'Laundry & linen exchange',side:-1,description:'Paired washer and dryer stacks, folding islands, hanging rails, linen stores and a waiting bench.'},
 {deck:14,service:'parcels',kind:'logistics',name:'Parcel collection & returns',side:1,description:'Numbered collection lockers, a staffed help counter, packing benches and reusable-container returns.'},
 {deck:15,service:'repair',kind:'workshop',name:'Neighborhood repair studio',side:-1,description:'Repair benches, sewing stations, hand-tool boards and a parts library for everyday belongings.'},
 {deck:15,service:'library',kind:'stores',name:'Shared equipment & storage',side:1,description:'A library of shared equipment, household storage lockers, inspection benches and a checkout counter.'},
].map(a=>({...a,id:`d${a.deck}-${a.service}-aft`,category:'Neighborhood services',special:true,support:true,center:[-221,-39.7+(a.deck-1)*4,a.side*15],width:80,depth:20,height:3.5,entryX:-205}));
const font=new FontLoader().parse(fontData);
const mat=(name,color)=>new T.MeshStandardMaterial({name:'Support_'+name,color,roughness:.72});
const M={wall:mat('lining',0xe0e4dc),floor:mat('floor',0xc5c8be),wood:mat('oak',0xa78a65),metal:mat('alloy',0x91a4a7),dark:mat('graphite',0x243d48),linen:mat('linen',0xd4dece),blue:mat('blue',0x6b9dab),amber:mat('amber',0xc6a575)};
M.light=new T.MeshStandardMaterial({name:'Support_light',color:0xffe5bc,emissive:0xffd497,emissiveIntensity:.55});
function kit(root,origin=[0,0,0]){
 const fit=new T.Group(),shell=new T.Group();fit.name='Room_fittings';shell.name='Walls_and_ceiling';root.add(fit,shell);root.position.set(...origin);
 function box(name,size,pos,m=M.wall,parent=fit){const o=new T.Mesh(new T.BoxGeometry(...size),m);o.name=name;o.position.set(...pos);parent.add(o);o.receiveShadow=true;return o;}
 function text(label,pos,rotation=0,size=.28,parent=fit){const g=new TextGeometry(label,{font,size,depth:.004,curveSegments:1});g.computeBoundingBox();g.translate(-g.boundingBox.max.x/2,0,0);const o=new T.Mesh(g,M.dark);o.name='Service_wayfinding';o.position.set(...pos);o.rotation.y=rotation;parent.add(o);return o;}
 return {root,fit,shell,box,text};
}
export function createSupportArea(area){
 const root=new T.Group();root.name='Area_'+area.id;root.userData={...area,units:'metres',stage:'Fitted neighborhood service area'};
 const k=kit(root,area.center),{fit,shell,box,text}=k,s=area.side,accent=area.deck===14?M.blue:M.amber;
 box('Finished_floor',[80,.02,20],[0,-.01,0],M.floor);
 box('Ceiling',[80,.1,20],[0,3.4,0],M.wall,shell);
 for(const side of [-1,1])box('End_wall',[.16,3.4,20],[side*39.92,1.7,0],M.wall,shell);
 box('Outboard_wall',[80,3.4,.16],[0,1.7,s*9.92],M.wall,shell);
 // Four-metre entry opens on the central aft passage, aligned with a clear
 // transverse aisle at x=-205. Furniture stays away from both room aisles.
 for(const [a,b] of [[-40,14],[18,40]])box('Entry_wall',[b-a,3.4,.16],[(a+b)/2,1.7,-s*9.92],M.wall,shell);
 box('Entry_header',[4,.7,.16],[16,3.05,-s*9.92],accent,shell);
 text(area.name.toUpperCase(),[0,2.45,s*9.78],s<0?0:Math.PI,.37);
 for(const z of [-2,2])box('Service_aisle_edge',[78,.012,.055],[0,.008,z],accent);
 for(let x=-34;x<40;x+=10)for(const z of [-5,5])box('Ceiling_light',[5,.04,.2],[x,3.27,z],M.light,shell);
 function table(x,z,len=5){box('Worktop',[len,.12,1.6],[x,.82,z],M.wood);for(const dx of [-len*.35,len*.35])box('Bench_support',[.16,.76,1.25],[x+dx,.38,z],M.metal);}
 function storage(x,z,linen=false){for(const dx of [-2.4,2.4])box('Rack_post',[.09,2.7,1.4],[x+dx,1.35,z],M.metal);for(let j=0;j<3;j++){
  box('Shelf',[5,.1,1.4],[x,.2+j*.85,z],M.metal);
  for(let i=0;i<4;i++)box(linen?'Folded_linen':'Supply_crate',[.9,linen?.25:.5,1.1],[x-1.75+i*1.15,.38+j*.85,z],linen?M.linen:accent);
 }}
 function counter(x,z){box('Service_counter',[6,.9,1.2],[x,.45,z],M.wood);box('Countertop',[6.1,.08,1.3],[x,.94,z],M.linen);box('Status_display',[.8,.45,.06],[x,1.24,z-.3],M.dark);}
 function chair(x,z){box('Seat',[.7,.15,.7],[x,.46,z],accent);box('Back',[.7,.6,.12],[x,.8,z+.3],accent);box('Seat_base',[.45,.4,.45],[x,.2,z],M.wood);}
 const stations=[-34,-26,-18,-10,-2,6,24,32];
 if(area.service==='laundry'){
  for(const x of stations)for(const z of [-6.5,6.5]){
   const facing=z>0?-1:1;
   box('Laundry_machine_stack',[1.4,2.6,1.4],[x,1.3,z],M.metal);
   for(const y of [.65,1.9]){
    const o=new T.Mesh(new T.TorusGeometry(.38,.065,8,24),M.dark);o.name='Laundry_round_door';o.position.set(x,y,z+facing*.74);fit.add(o);
    const pane=new T.Mesh(new T.CircleGeometry(.32,24),M.blue);pane.name='Laundry_drum_face';pane.position.set(x,y,z+facing*.75);if(facing<0)pane.rotation.y=Math.PI;fit.add(pane);
    box('Machine_control_panel',[.55,.17,.04],[x,y+.45,z+facing*.73],M.dark);
   }
  }
  for(const x of [-28,-10,28])for(const z of [-3.5,3.5])table(x,z,5);
  storage(7,8.3,true);storage(7,-8.3,true);
  box('Passenger_bench',[5,.45,.65],[24,.225,8.8],M.wood);box('Seat_cushion',[4.8,.09,.62],[24,.49,8.8],accent);
  for(const z of [-8.5,8.5]){box('Hanging_rail',[6,.05,.05],[-20,2.35,z],M.metal);for(const dx of [-3,3])box('Hanging_rail_post',[.05,2.35,.05],[-20+dx,1.175,z],M.metal);}
  // Issue crates identify clean/returned linen separately from the machines.
  for(const x of [-37,36])box('Supply_crate',[1.2,.7,1],[x,.35,8],M.linen);
 }else if(area.service==='parcels'){
  for(const x of stations.slice(0,6))for(const z of [-7,7]){
   box('Parcel_locker_bank',[5.6,2.7,1],[x,1.35,z],M.metal);
   const face=z>0?-1:1;
   for(let r=0;r<3;r++)for(let c=0;c<6;c++){
    const xx=x-2.3+c*.92,yy=.48+r*.85;
    box('Parcel_locker_door',[.83,.74,.05],[xx,yy,z+face*.54],accent);
    box('Locker_handle',[.035,.18,.03],[xx+.3,yy,z+face*.58],M.dark);
    text(String(1+stations.indexOf(x)*36+(z>0?18:0)+r*6+c).padStart(3,'0'),[xx,yy,z+face*.59],face>0?0:Math.PI,.12);
   }
  }
  for(const x of [-28,-8])for(const z of [-3.5,3.5])table(x,z);
  counter(28,6);box('Systems_wall_display',[5,1.2,.08],[29,2.1,9.6],M.dark);
  storage(28,-7);for(const x of [23,28,33])box('Return_container',[2,.7,1.8],[x,.35,-3.8],accent);
 }else if(area.service==='repair'){
  for(const x of [-32,-20,-8,4,28])for(const z of [-6,6]){
   table(x,z,6);chair(x,z+1.35);
   box('Tool_board',[5,1.25,.12],[x,1.9,z-1],M.wood);
   for(let i=-4;i<=4;i++)box('Hand_tool',[.07,.4,.07],[x+i*.5,1.95,z-.88],M.metal);
   if(x<-10){box('Sewing_machine',[.6,.55,.35],[x,1.155,z],M.linen);box('Sewing_machine_arm',[.5,.1,.15],[x+.2,1.38,z+.08],M.dark);}
   else {box('Repair_mat',[2,.02,1],[x,.9,z],accent);box('Parts_tray',[.6,.12,.4],[x+1.5,.96,z],M.metal);}
  }
  for(const x of [-34,-20,-6,28])storage(x,8.8);
 }else{
  for(const x of [-32,-20,-8,4,28])for(const z of [-7,7]){
   storage(x,z);
   box('Equipment_cabinet',[2,2.5,1],[x+4,1.25,z],M.metal);
   box('Cabinet_door',[1.85,2.3,.035],[x+4,1.25,z+.52],accent);
  }
  for(const x of [-28,-8])table(x,3.5,6);
  counter(28,3.7);box('Shared_equipment_trolley',[2,.8,1.1],[5,.4,-3.8],accent);
  for(const x of [-28,-8]){box('Inspection_mat',[1.5,.02,1],[x,.89,3.5],accent);box('Equipment_case',[.9,.35,.6],[x,1.075,3.5],M.dark);}
 }
 finishShipArea(area,{root,shell,fit});
 const y=area.center[1];return {root,shell,fit,overview:{position:[-153,y+69,area.side*83],target:[-221,y,area.side*15]},inside:{position:[-205,y+1.7,area.side*7.8],target:[-227,y+1.4,area.side*15]}};
}
export function createSupportCirculation(deck){
 if(![14,15].includes(deck))return null;
 const root=new T.Group();root.name=`Deck_${deck}_special_area_connections`;root.userData={deck,clearSpineWidth:8};
 const y=-39.7+(deck-1)*4,{fit,shell,box,text}=kit(root,[0,y,0]);
 box('Support_spine_floor',[87,.02,8],[-217.5,-.01,0],M.floor);
 box('Support_spine_ceiling',[87,.1,8],[-217.5,3.4,0],M.wall,shell);
 box('Support_aft_wall',[.16,3.4,8],[-260.92,1.7,0],M.wall,shell);
 for(const s of [-1,1]){
  for(const [a,b]of [[-261,-207],[-203,-174]])box('Support_spine_wall',[b-a,3.4,.16],[(a+b)/2,1.7,s*4.08],M.wall,shell);
  box('Room_link_floor',[4,.02,1],[-205,-.01,s*4.5],M.floor);
  box('Room_link_ceiling',[4,.1,1],[-205,3.4,s*4.5],M.wall,shell);
  for(const x of [-207.08,-202.92])box('Room_link_wall',[.16,3.4,1],[x,1.7,s*4.5],M.wall,shell);
 }
 for(let x=-256;x<-174;x+=10)box('Connection_light',[4,.04,.24],[x,3.27,0],M.light,shell);
 text('D'+deck+' / '+(deck===14?'LAUNDRY + PARCELS':'REPAIR + SHARED EQUIPMENT'),[-260.8,2.4,0],Math.PI/2,.25);
 finishCirculation(root,shell,'Neighborhood service passage',deck);
 return {root,shell};
}
