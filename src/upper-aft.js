import * as T from 'three';
import {serviceKit,SERVICE_M as M} from './neighborhood-services.js';
import {finishShipArea} from './area-finish.js';
import {finishCirculation} from './circulation-finish.js';
export const UPPER_AFT_AREAS=[
 {deck:16,side:-1,kind:'briefing',id:'d16-training-aft',name:'Voyage training & briefing',description:'A shared briefing table, practical learning stations and a presentation wall for voyage orientation and crew-led workshops.'},
 {deck:17,side:1,kind:'arrival',id:'d17-fin-lounge-aft',name:'Fin lift arrival lounge',description:'A relaxed waiting lounge with upholstered seating, a refreshment counter and a fin-route display, connected to the existing panoramic-bar lift gallery.'},
].map(a=>({...a,upperAft:true,special:true,category:'Upper aft commons',center:[-209,-39.7+(a.deck-1)*4,a.side*13],width:48,depth:16,height:3.5,entryX:-205}));
export function createUpperAftArea(area){
 const root=new T.Group();root.name='Area_'+area.id;root.userData={...area,units:'metres',stage:'Fitted upper aft commons'};
 const {fit,shell,box,text}=serviceKit(root,area.center),s=area.side;
 box('Finished_floor',[48,.02,16],[0,-.01,0],M.floor);
 box('Ceiling',[48,.1,16],[0,3.4,0],M.wall,shell);
 for(const sign of [-1,1])box('End_wall',[.16,3.4,16],[sign*23.92,1.7,0],M.wall,shell);
 box('Outboard_wall',[48,3.4,.16],[0,1.7,s*7.92],M.wall,shell);
 for(const [a,b]of [[-24,2],[6,24]])box('Entry_wall',[b-a,3.4,.16],[(a+b)/2,1.7,-s*7.92],M.wall,shell);
 box('Entry_header',[4,.7,.16],[4,3.05,-s*7.92],M.blue,shell);
 text(area.name.toUpperCase(),[0,2.7,s*7.78],s<0?0:Math.PI,.29);
 for(let x=-19;x<24;x+=8)for(const z of [-4,4])box('Ceiling_light',[4,.04,.2],[x,3.27,z],M.light,shell);
 for(const z of [-1.7,1.7])box('Aisle_inlay',[46,.012,.05],[0,.008,z],M.amber);
 function chair(x,z,rotation=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;fit.add(g);box('Seat',[.75,.15,.75],[0,.45,0],M.blue,g);box('Back',[.75,.65,.13],[0,.78,.33],M.blue,g);box('Seat_base',[.55,.38,.55],[0,.19,0],M.wood,g);}
 function table(x,z,len=6){box('Meeting_table',[len,.12,1.3],[x,.8,z],M.wood);for(const dx of [-len*.33,len*.33])box('Table_support',[.16,.74,1],[x+dx,.37,z],M.metal);}
 if(area.deck===16){
  table(-12,-4,13);for(const x of [-17,-14,-11,-8]){chair(x,-6);chair(x,-2.7,Math.PI);}
  box('Briefing_wall',[.08,1.6,5],[23.75,1.65,0],M.dark);
  for(const x of [-17,-8,13]){table(x,4.5,5);chair(x,6);box('Worktop',[2,.08,.8],[x,.93,4.5],M.metal);box('Training_console',[1.3,.35,.5],[x,1.14,4.5],M.blue);}
  for(const z of [-4.5,4.5]){box('Equipment_cabinet',[2,2.5,1.2],[20,1.25,z],M.metal);box('Status_display',[1,.4,.04],[20,1.9,z+.63],M.dark);}
  table(13,-4.5,7);for(const x of [11,14,17])chair(x,-6);
 }else{
  for(const x of [-17,-8,13])for(const z of [-4.7,4.7]){
   box('Passenger_bench',[4,.45,.8],[x,.225,z],M.wood);box('Seat_cushion',[3.9,.12,.78],[x,.51,z],M.blue);box('Seat_back',[4,.65,.14],[x,.82,z+Math.sign(z)*.4],M.blue);
   box('Coffee_table',[2,.1,.8],[x,.52,z-Math.sign(z)*1.4],M.wood);for(const dx of [-.65,.65])box('Table_support',[.1,.47,.6],[x+dx,.235,z-Math.sign(z)*1.4],M.metal);
  }
  box('Service_counter',[5,.9,1.2],[20,.45,4.7],M.wood);box('Countertop',[5.1,.08,1.3],[20,.94,4.7],M.linen);
  box('Refreshment_machine',[.8,.65,.6],[20,1.305,4.7],M.metal);
  box('Fin_route_display',[.08,1.5,4],[23.7,1.75,0],M.dark);
  text('PANORAMA / FIN LIFT',[-23.7,2.3,0],Math.PI/2,.27);
  for(const x of [-21,20])box('Equipment_cabinet',[1.1,1.7,.7],[x,.85,-6.8],M.metal);
 }
 finishShipArea(area,{root,fit,shell});
 const y=area.center[1];return {root,fit,shell,overview:{position:[-161,y+50,s*62],target:[-209,y,s*13]},inside:{position:[-205,y+1.7,s*7],target:[-218,y+1.4,s*13]}};
}
export function createUpperAftCirculation(deck){
 if(![16,17].includes(deck))return null;
 const root=new T.Group();root.name=`Deck_${deck}_special_area_connections`;root.userData={deck,clearEntryWidth:4};
 const y=-39.7+(deck-1)*4,{shell,box,text}=serviceKit(root,[0,y,0]),s=deck===16?-1:1;
 if(deck===16){
  box('Upper_aft_spine_floor',[59,.02,6],[-203.5,-.01,0],M.floor);
  box('Upper_aft_spine_ceiling',[59,.1,6],[-203.5,3.4,0],M.wall,shell);
  box('Aft_end_wall',[.16,3.4,6],[-232.92,1.7,0],M.wall,shell);
  box('Spine_wall',[59,3.4,.16],[-203.5,1.7,3.08],M.wall,shell);
  for(const [a,b]of [[-233,-207],[-203,-174]])box('Spine_wall',[b-a,3.4,.16],[(a+b)/2,1.7,-3.08],M.wall,shell);
  for(let x=-227;x<-174;x+=9)box('Connection_light',[4,.04,.2],[x,3.27,0],M.light,shell);
 }
 // On Deck 17 the existing gallery remains the sole central floor. Its rail
 // opens at this connector; the connector walls protect the two exposed edges.
 box('Upper_room_link_floor',[4,.02,2],[-205,-.01,s*4],M.floor);
 box('Upper_room_link_ceiling',[4,.1,2],[-205,3.4,s*4],M.wall,shell);
 for(const x of [-207.08,-202.92])box('Upper_room_link_wall',[.16,3.4,2],[x,1.7,s*4],M.wall,shell);
 text(deck===16?'TRAINING':'FIN ARRIVAL LOUNGE',[-205,2.7,s*4.95],s<0?0:Math.PI,.19);
 finishCirculation(root,shell,'Upper aft commons connection',deck);return {root,shell};
}
