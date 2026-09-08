import * as T from 'three';
import {serviceKit,SERVICE_M as M} from './neighborhood-services.js';
import {finishShipArea} from './area-finish.js';
export const VOYAGE_FORUM={id:'d16-voyage-forum-bow',name:'Forward voyage forum',kind:'theater',deck:16,special:true,forum:true,category:'Community assembly',center:[180,20.3,0],width:52,depth:48,height:3.5,description:'A small demonstration stage, 120 modeled seats in two banks, open mobility-device spaces and a rear gathering foyer. A low ramp connects the stage to the floor.'};
export function createVoyageForum(area=VOYAGE_FORUM){
 const root=new T.Group();root.name='Area_'+area.id;root.userData={...area,units:'metres',stage:'Fitted voyage forum',modeledSeats:120};
 const {fit,shell,box,text}=serviceKit(root,area.center);
 box('Finished_floor',[52,.02,48],[0,-.01,0],M.floor);
 box('Ceiling',[52,.1,48],[0,3.4,0],M.wall,shell);
 for(const s of [-1,1])box('Side_wall',[52,3.4,.16],[0,1.7,s*23.92],M.wall,shell);
 box('End_wall',[.16,3.4,48],[25.92,1.7,0],M.wall,shell);
 for(const s of [-1,1])box('Entry_wall',[.16,3.4,21],[-25.92,1.7,s*13.5],M.wall,shell);
 box('Entry_header',[.16,.7,6],[-25.92,3.05,0],M.blue,shell);
 // This room owns its short forward-core approach, so the aft connection on
 // the same deck remains an independent component.
 box('Forum_approach_floor',[16,.02,4],[-34,-.01,0],M.floor);
 box('Forum_approach_ceiling',[6,.1,4],[-29,3.4,0],M.wall,shell);
 for(const s of [-1,1])box('Forum_approach_wall',[6,3.4,.16],[-29,1.7,s*2.08],M.wall,shell);
 for(let x=-21;x<=23;x+=8)for(const z of [-19,-12,0,12,19])box('Ceiling_light',[4,.04,.15],[x,3.27,z],M.light,shell);
 for(const s of [-1,1]){
  for(const x of [-20,-10,0,10,20])box('Acoustic_wall_panel',[5,1.6,.12],[x,1.55,s*23.77],M.blue,shell);
  box('Central_aisle_edge',[38,.012,.06],[-5,.008,s*2],M.amber);
  box('Side_aisle_edge',[24,.012,.06],[-1,.008,s*13.5],M.amber);
 }
 function chair(x,z){const g=new T.Group();g.name='Forum_audience_seat';g.position.set(x,0,z);g.rotation.y=-Math.PI/2;fit.add(g);
  box('Seat_base',[.56,.38,.56],[0,.19,0],M.metal,g);box('Seat',[.76,.16,.75],[0,.46,0],M.blue,g);box('Back',[.76,.68,.14],[0,.82,.32],M.blue,g);
  for(const s of [-1,1])box('Padded_arm',[.08,.08,.55],[s*.4,.68,0],M.blue,g);
 }
 for(let row=0;row<10;row++)for(const s of [-1,1])for(let seat=0;seat<6;seat++)chair(-9+row*1.8,s*(4+seat*1.3));
 for(const s of [-1,1])for(const z of [4.5,8]){
  box('Open_mobility_space',[2,.012,1.5],[-13,.008,s*z],M.linen);
  box('Mobility_space_marker',[1.7,.015,.04],[-13,.012,s*z-.6],M.blue);
 }
 box('Stage',[6,.25,20],[21,.125,0],M.wood);
 box('Stage_edge',[.045,.08,20],[18.01,.2,0],M.amber);
 box('Projection_screen',[.09,1.65,10],[25.72,1.85,0],M.dark);
 box('Presentation_lectern',[.65,1.05,.75],[22,.775,-6.5],M.wood);
 box('Lectern_top',[.8,.07,.9],[22,1.335,-6.5],M.metal);
 text('LEO / VOYAGE FORUM',[25.65,2.93,0],-Math.PI/2,.32);
 // Five-metre run for the 0.25 m stage rise, with a two-metre clear width.
 const p=[],tri=(a,b,c)=>p.push(...a,...b,...c),a=[13,0,8],b=[18,.25,8],c=[18,.25,10],d=[13,0,10],e=[18,0,8],f=[18,0,10];
 tri(a,c,b);tri(a,d,c);tri(a,b,e);tri(d,f,c);tri(e,b,c);tri(e,c,f);tri(a,e,f);tri(a,f,d);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.computeVertexNormals();
 const ramp=new T.Mesh(geo,M.wood);ramp.name='Forum_stage_ramp';ramp.userData={rise:.25,run:5,clearWidth:2};fit.add(ramp);
 for(const z of [8.05,9.95]){const edge=box('Ramp_edge_marker',[Math.hypot(5,.25),.012,.04],[15.5,.13,z],M.amber);edge.rotation.z=Math.atan(.25/5);}
 for(const s of [-1,1]){
  box('Foyer_counter',[4.8,.9,1.2],[-20,.45,s*10],M.wood);box('Countertop',[4.9,.08,1.3],[-20,.94,s*10],M.linen);
  box('Passenger_bench',[5,.45,.8],[-20,.225,s*17],M.wood);box('Seat_cushion',[4.9,.1,.78],[-20,.5,s*17],M.blue);
  box('Equipment_cabinet',[3,2.4,1.2],[21,1.2,s*20],M.metal);
  for(const x of [-6,5]){
   box('Meeting_table',[4,.12,1.2],[x,.82,s*19],M.wood);for(const dx of [-1.4,1.4])box('Table_support',[.15,.76,1],[x+dx,.38,s*19],M.metal);
  }
 }
 finishShipArea(area,{root,fit,shell});
 return {root,fit,shell,overview:{position:[249,95,91],target:[181,21,0]},inside:{position:[159,22,0],target:[202,22.2,0]}};
}
