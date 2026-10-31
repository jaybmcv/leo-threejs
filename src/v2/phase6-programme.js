import {hydrateHullLayout} from '../plan/envelope-data-v2.js';
import {ATRIUM_ZONES,ATRIUM_PROTOTYPE,phase6Owners} from '../plan/atrium-v2.js';
import {patchDepth,worldPoint} from '../plan/hull-skin-v2.js';
export function phase6Programme(layout){
 const parts=[],rests=[],owners=phase6Owners(layout),y=layout.decks[5].y;
 const add=(room,part,size,at,mat='oak',opts={})=>parts.push({room,part,size,at,mat,yaw:0,deck:6,phase6:true,...opts});
 const seat=(room,x,z,yaw=0,floor=y,deck=6)=>{
  const id='p6-'+room+'-seat-'+rests.filter(s=>s.room===room).length;
  add(room,'seat_cushion',[.62,.16,.60],[x,floor+.49,z],'teal',{yaw,deck});
  add(room,'seat_back',[.62,.44,.10],[x-Math.sin(yaw)*.30,floor+.76,z-Math.cos(yaw)*.30],'teal',{yaw,deck});
  add(room,'seat_pedestal',[.30,.41,.30],[x,floor+.205,z],'metal',{deck});
  rests.push({id,room,kind:'sit',point:[x,floor+.57,z],facing:[Math.sin(yaw),0,Math.cos(yaw)],height:floor+.57,instanced:true,phase4:true,phase6:true});
 };
 const table=(room,x,z,floor=y,deck=6)=>{
  add(room,'table_top',[1.25,.08,1.0],[x,floor+.76,z],'oak',{deck});add(room,'table_pedestal',[.35,.72,.35],[x,floor+.36,z],'metal',{deck});
  seat(room,x,z-1.02,0,floor,deck);seat(room,x,z+1.02,Math.PI,floor,deck);seat(room,x-1.15,z,Math.PI/2,floor,deck);seat(room,x+1.15,z,-Math.PI/2,floor,deck);
 };
 const plant=(room,x,z,floor=y,deck=6)=>{add(room,'plant_pot',[.52,.48,.52],[x,floor+.24,z],'cream',{deck});add(room,'plant_foliage',[.72,.95,.65],[x,floor+.94,z],'green',{round:true,noCollide:true,deck});};
 const sign=(room,text,x,z,w=6,floor=y,deck=6,yaw=0)=>add(room,'sign',[w,.65,.04],[x,floor+2.6,z],'navy',{text,deck,yaw,noCollide:true});
 // The axial boulevard and cross routes remain free.
 for(const x of[-66,-48,-28,-10])for(const z of[-27,-17]){
  add('atrium6-park','p6_tree_trunk',[.44,2.8,.44],[x,y+1.4,z],'oak');
  for(const [dx,dz,dy]of[[-.9,0,0],[.8,.45,.35],[0,-.7,1.0]])add('atrium6-park','p6_tree_crown',[3.4,2.8,3.5],[x+dx,y+3.1+dy,z+dz],'green',{noCollide:true});
 }
 for(const x of[-63,-43,-23])for(const z of[-10.5,-31.5]){seat('atrium6-park',x-.4,z,z<-20?0:Math.PI);seat('atrium6-park',x+.4,z,z<-20?0:Math.PI);add('atrium6-park','sofa_plinth',[1.8,.30,.78],[x,y+.21,z]);}
 sign('atrium6-park','VOYAGER PARK',-70,-11,5);for(const x of[-72,-68])add('atrium6-park','p6_sign_post',[.08,2.8,.08],[x,y+1.4,-11],'metal');
 for(const x of[-28,-10,8,26])for(const z of[12,19,26])table('atrium6-food',x,z);
 for(const x of[-25,-7,11,29]){
  add('atrium6-food','counter_body',[8,.88,1],[x,y+.44,30.5],'cream');
  add('atrium6-food','counter_top',[8.12,.09,1.12],[x,y+.925,30.5]);
  add('atrium6-food','kitchen_base',[8,.85,.8],[x,y+.425,32.1],'metal');
  add('atrium6-food','kitchen_worktop',[8.08,.08,.86],[x,y+.89,32.1],'metal');
  for(const dx of[-2,0,2]){add('atrium6-food','hob',[.7,.035,.55],[x+dx,y+.95,32.1],'navy');add('atrium6-food','kitchen_hood',[1,.25,.8],[x+dx,y+2.6,32.1],'metal',{noCollide:true});}
 }
 for(const x of[-25,-7,11,29]){for(const dx of[-4.3,4.3])add('atrium6-food','p6_stall_post',[.12,3,.12],[x+dx,y+1.5,32.1],'metal');add('atrium6-food','p6_stall_canopy',[8.8,.16,2.4],[x,y+3.05,32.1],'cream',{noCollide:true});add('atrium6-food','reading_light',[8,.025,.12],[x,y+2.96,31.1],'light',{noCollide:true});for(const dx of[-2,0,2])add('atrium6-food','p6_hood_stem',[.035,.245,.035],[x+dx,y+2.8475,32.1],'metal',{noCollide:true});}
 sign('atrium6-food','FRESH / BAKERY / GREENS / COFFEE',4,31.3,12);for(const x of[-1,9])add('atrium6-food','p6_sign_post',[.08,2.8,.08],[x,y+1.4,31.3],'metal');
 for(const x of[-36,38])plant('atrium6-food',x,31);
 // Shallow lake blockout: the actual bed remains 16 cm below the boulevard.
 add('atrium6-lake','p6_lake_bridge',[3,.22,26],[42,y+.11,-20],'oak');
 for(const z of[-30,-24,-18,-12])add('atrium6-lake','p6_bridge_pier',[2.2,.16,.4],[42,y-.08,z],'metal');
 for(const z of[-32,-8])add('atrium6-lake','p6_lake_edge',[70,.12,.22],[43,y+.06,z],'cream');
 for(const x of[8,78])add('atrium6-lake','p6_lake_side',[.22,.12,24],[x,y+.06,-20],'cream');
 sign('atrium6-lake','REFLECTION LAKE / SHALLOW WATER',10,-9.5,7);for(const x of[7,13])add('atrium6-lake','p6_lake_sign_post',[.08,2.96,.08],[x,y+1.32,-9.5],'metal');
 add('atrium6-stage','p6_stage_platform',[14,.36,18],[101,y+.18,25],'oak');
 add('atrium6-stage','p6_stage_backdrop',[.16,3.1,15],[107.8,y+1.91,25],'navy',{noCollide:true});
 for(const x of[70,75,80,85])for(const z of[15,18.3,21.6,24.9,28.2,31.5])seat('atrium6-stage',x,z,Math.PI/2);
 sign('atrium6-stage','THE COMMON STAGE',107.69,25,8,y+.36,6,-Math.PI/2);
 add('atrium6-lobby','counter_body',[6,.88,1],[-107,y+.44,-7],'cream');
 add('atrium6-lobby','counter_top',[6.12,.09,1.12],[-107,y+.925,-7]);
 sign('atrium6-lobby','LEO ATRIUM / RECEPTION',-107,-7.5,7);for(const x of[-109.5,-104.5])add('atrium6-lobby','p6_sign_post',[.08,2.8,.08],[x,y+1.4,-7.5],'metal');
 for(const x of[-114,-110,-106,-102])seat('atrium6-lobby',x,8,Math.PI);
 plant('atrium6-lobby',-116,-9);plant('atrium6-lobby',-82,9);
 // One café; all six hull-facing seats derive from the accepted finished inner skin.
 const r=layout.rooms.find(r=>r.id===ATRIUM_PROTOTYPE.cafe),p=layout.hullPrototypes.prototypes.find(p=>p.id===r.id),floor=r.y,deck=r.deck;
 if(!Array.isArray(p.inner))hydrateHullLayout({hullPrototypes:{prototypes:[p]},cabins:[],rooms:[],windows:[]});
 const ca=(part,size,at,mat='oak',opts={})=>add(r.id,part,size,at,mat,{deck,...opts});
 ca('counter_body',[4,.88,1],[224,floor+.44,3.9],'cream');ca('counter_top',[4.12,.09,1.12],[224,floor+.925,3.9]);
 ca('kitchen_base',[4,.85,.8],[224,floor+.425,5.25],'metal');ca('kitchen_worktop',[4.08,.08,.86],[224,floor+.89,5.25],'metal');
 ca('espresso_machine',[1.15,.65,.70],[224,floor+1.295,3.9],'metal');
 table(r.id,230,-2.6,floor,deck);table(r.id,230,2.6,floor,deck);
 for(const o of p.openings){const u=(o[0]+o[1])/2,v=Math.min(...[.2,.8,1.7].map(h=>patchDepth(p.inner,u,h)))-1.35,at=worldPoint(p.chart,[u,0,v]);seat(r.id,at[0],at[2],Math.PI/2,floor,deck);}
 plant(r.id,222.1,-4.6,floor,deck);plant(r.id,234,4.5,floor,deck);
 sign(r.id,'THE LISTENING ROOM / COFFEE & TEA',224,4.2,5.3,floor,deck);for(const x of[222.3,225.7])ca('p6_menu_stem',[.035,1.43,.035],[x,floor+1.685,4.2],'metal',{noCollide:true});
 return {parts,rests,owners,prototypeCafe:r.id,zones:ATRIUM_ZONES};
}
