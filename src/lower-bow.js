import * as T from 'three';
import {serviceKit,SERVICE_M as M} from './neighborhood-services.js';
import {finishShipArea} from './area-finish.js';
import {finishCirculation} from './circulation-finish.js';
export const LOWER_BOW_AREAS=[
 {deck:1,kind:'stores',id:'d01-expedition-bow',name:'Expedition stores & outfitting',description:'Mission-pack racks, reusable equipment cases, issue counters and packing tables for arrival preparations.'},
 {deck:4,kind:'farm',id:'d04-cultivation-bow',name:'Fresh food cultivation & preparation',description:'Low growing racks, propagation trays, a produce wash station and sorting benches beneath dedicated grow lighting.'},
 {deck:5,kind:'gym',id:'d05-rehabilitation-bow',name:'Rehabilitation & movement',description:'An open movement room with parallel bars, low stepping platforms, walking machines, stretching mats and rest seating.'},
].map(a=>({...a,lowerBow:true,special:true,category:'Lower bow facilities',center:[196,-39.7+(a.deck-1)*4,0],width:64,depth:60,height:3.5,entryX:164}));
export function createLowerBowArea(area){
 const root=new T.Group();root.name='Area_'+area.id;root.userData={...area,units:'metres',stage:'Fitted lower bow concept'};
 const {fit,shell,box,text}=serviceKit(root,area.center),accent=area.deck===4?M.linen:area.deck===5?M.blue:M.amber;
 box('Finished_floor',[64,.02,60],[0,-.01,0],M.floor);box('Ceiling',[64,.1,60],[0,3.4,0],M.wall,shell);
 for(const s of [-1,1])box('Side_wall',[64,3.4,.16],[0,1.7,s*29.92],M.wall,shell);
 box('End_wall',[.16,3.4,60],[31.92,1.7,0],M.wall,shell);
 for(const s of [-1,1])box('Entry_wall',[.16,3.4,27],[-31.92,1.7,s*16.5],M.wall,shell);
 box('Entry_header',[.16,.7,6],[-31.92,3.05,0],M.blue,shell);
 text(area.name.toUpperCase(),[31.75,2.5,0],-Math.PI/2,.37);
 for(const z of [-2.7,2.7])box('Bow_aisle_inlay',[62,.012,.055],[0,.008,z],M.amber);
 for(let x=-25;x<30;x+=10)for(const z of [-24,-12,0,12,24])box('Ceiling_light',[5,.04,.18],[x,3.27,z],M.light,shell);
 function table(x,z,len=6){box('Worktop',[len,.12,1.6],[x,.82,z],M.wood);for(const dx of [-len*.35,len*.35])box('Table_support',[.15,.76,1.3],[x+dx,.38,z],M.metal);}
 function bench(x,z){box('Passenger_bench',[4,.45,.75],[x,.225,z],M.wood);box('Seat_cushion',[3.9,.12,.73],[x,.51,z],M.blue);box('Seat_back',[4,.6,.14],[x,.8,z+.35],M.blue);}
 function shelf(x,z,plants=false){
  for(const dx of [-3.1,3.1])for(const dz of [-.8,.8])box('Rack_post',[.1,2.8,.1],[x+dx,1.4,z+dz],M.metal);
  for(let j=0;j<3;j++){
   const y=.2+j*.86;box('Shelf',[6.4,.1,1.8],[x,y,z],M.metal);
   for(let k=0;k<6;k++){
    if(plants){
     box('Grow_tray',[.88,.13,1.4],[x-2.65+k*1.06,y+.12,z],M.dark);
     for(const dz of [-.4,0,.4]){const leaf=new T.Mesh(new T.SphereGeometry(.18,8,6),M.linen);leaf.name='Leaf_cluster';leaf.position.set(x-2.65+k*1.06,y+.35,z+dz);fit.add(leaf);}
    }else box('Supply_crate',[.85,.57,1.4],[x-2.65+k*1.06,y+.335,z],accent);
   }
  }
 }
 if(area.deck===1){
  for(const x of [-24,-12,0])for(const z of [-24,-14,-7,7,14,24])shelf(x,z);
  for(const x of [12,24])for(const z of [-22,-10,10,22]){
   table(x,z);for(const dx of [-1.5,1.5])box('Mission_equipment_case',[1.2,.5,.85],[x+dx,1.13,z],M.dark);
  }
  for(const s of [-1,1]){box('Service_counter',[7,.9,1.3],[23,.45,s*5],M.wood);box('Countertop',[7.1,.08,1.4],[23,.94,s*5],M.linen);box('Status_display',[1,.5,.07],[23,1.26,s*5],M.dark);}
  for(const z of [-27,27])for(const x of [8,16,24])box('Equipment_cabinet',[2.5,2.5,1.1],[x,1.25,z],M.metal);
 }else if(area.deck===4){
  for(const x of [-24,-12,0,12])for(const z of [-23,-13,-7,7,13,23])shelf(x,z,true);
  for(const z of [-22,-10,10,22]){
   table(24,z,6);box('Harvest_tray',[2,.16,1.2],[24,.98,z],M.linen);
  }
  for(const s of [-1,1]){
   box('Wash_sink',[3.6,.9,1.3],[24,.45,s*5],M.metal);
   box('Preparation_counter',[5,.9,1.2],[11,.45,s*27],M.wood);
  }
 }else{
  for(const x of [-23,-11,1])for(const z of [-21,-10,10,21]){
   box('Movement_mat',[6,.04,4],[x,.02,z],M.blue);
   if(Math.abs(z)===10){
    for(const s of [-1,1]){box('Parallel_bar',[4.8,.07,.07],[x,1,z+s*.7],M.metal);for(const dx of [-2,2])box('Parallel_bar_post',[.07,1,.07],[x+dx,.5,z+s*.7],M.metal);}
   }else for(let i=0;i<4;i++)box('Low_step',[.85,.08+i*.04,1.2],[x-1.6+i*1.05,(.08+i*.04)/2+.04,z],M.linen);
  }
  for(const z of [-24,-16,16,24]){
   box('Treadmill',[2.7,.25,1.1],[23,.165,z],M.dark);
   for(const s of [-1,1])box('Walking_machine_rail',[2.7,.06,.06],[23,1,z+s*.65],M.metal);
   box('Fitness_display',[.1,.5,.8],[24.1,1.1,z],M.blue);
   for(const dx of [-1,1])for(const s of [-1,1])box('Rail_post',[.055,.85,.055],[23+dx,.575,z+s*.65],M.metal);
  }
  for(const x of [-23,-11,1,14,24])for(const s of [-1,1])bench(x,s*27.5);
  for(const x of [12,21])for(const z of [-7,7])box('Stretching_mat',[2,.04,.9],[x,.02,z],M.blue);
  box('Equipment_cabinet',[3,2.2,1.1],[26,1.1,8],M.metal);
 }
 finishShipArea(area,{root,fit,shell});const y=area.center[1];
 return {root,fit,shell,overview:{position:[261,y+78,81],target:[196,y,0]},inside:{position:[168,y+1.7,0],target:[197,y+1.4,10]}};
}
export function createLowerBowCirculation(deck){
 if(![1,4,5].includes(deck))return null;
 const root=new T.Group();root.name=`Deck_${deck}_special_area_connections`;root.userData={deck,clearApproachWidth:4};
 const y=-39.7+(deck-1)*4,{shell,box,text}=serviceKit(root,[0,y,0]);
 // The four-metre finish passes between the forward stair towers. Enclosure
 // begins beyond the towers so it does not close their existing landings.
 box('Lower_bow_link_floor',[26,.02,4],[151,-.01,0],M.floor);
 box('Lower_bow_link_ceiling',[16,.1,4],[156,3.4,0],M.wall,shell);
 for(const s of [-1,1])box('Lower_bow_link_wall',[16,3.4,.16],[156,1.7,s*2.08],M.wall,shell);
 for(const x of [151,159])box('Connection_light',[3,.04,.2],[x,3.27,0],M.light,shell);
 text('D'+deck+' / FORWARD COMMONS',[163.9,2.65,0],-Math.PI/2,.19);
 finishCirculation(root,shell,'Lower bow connection',deck);return {root,shell};
}
