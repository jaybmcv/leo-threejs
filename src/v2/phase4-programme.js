// Stage 1 stays limited to these review prototypes.
export const PHASE4_ROOMS=['d02-new-1','d01-new-2','d05-new-4','neighborhood-5-dining','neighborhood-5-cafe'];
export const PHASE4_SHUTTLE='d3-escape-p-1';
export function phase4Programme(layout){
 const parts=[],rests=[],rooms=[];
 const room=r=>{
  const alongZ=Math.abs(r.door.outward[1])>.5,v=alongZ?[0,-r.door.outward[1]]:[-r.door.outward[0],0],u=[v[1],-v[0]];
  const at=(x,y,z)=>[r.door.center[0]+u[0]*x+v[0]*z,r.y+y,r.door.center[2]+u[1]*x+v[1]*z],yaw=Math.atan2(v[0],v[1]);
  const add=(part,size,p,mat='oak',opts={})=>parts.push({part,size,at:at(...p),mat,room:r.id,deck:r.deck,...opts,yaw:yaw+(opts.yaw||0)});
  const seat=(x,z,angle=0)=>{
   const f=[Math.sin(yaw+angle),0,Math.cos(yaw+angle)],index=rests.filter(s=>s.room===r.id).length;
   add('seat_cushion',[.62,.16,.60],[x,.49,z],'teal',{yaw:angle});
   add('seat_back',[.62,.44,.10],[x-Math.sin(angle)*.30,.76,z-Math.cos(angle)*.30],'teal',{yaw:angle});
   add('seat_pedestal',[.30,.40,.30],[x,.20,z],'metal');
   rests.push({id:'p4-'+r.id+'-seat-'+index,room:r.id,kind:'sit',point:at(x,.57,z),facing:f,height:r.y+.57,instanced:true,phase4:true});
  };
  const table=(x,z)=>{add('table_top',[1.25,.08,1.0],[x,.76,z]);add('table_pedestal',[.35,.70,.35],[x,.37,z],'metal');seat(x,z-1.02);seat(x,z+1.02,Math.PI);seat(x-1.15,z,Math.PI/2);seat(x+1.15,z,-Math.PI/2);};
  const pendant=(x,z)=>{add('pendant_stem',[.035,.45,.035],[x,3.10,z],'metal',{noCollide:true});add('pendant_shade',[.58,.12,.58],[x,2.84,z],'navy',{noCollide:true});add('pendant_light',[.46,.025,.46],[x,2.765,z],'light',{noCollide:true});};
  const plant=(x,z)=>{add('plant_pot',[.52,.48,.52],[x,.24,z],'cream');add('plant_foliage',[.72,.85,.65],[x,.89,z],'green',{noCollide:true,round:true});};
  const counter=(x,z,w=8)=>{add('counter_body',[w,.88,1.0],[x,.44,z],'cream');add('counter_top',[w+.12,.09,1.12],[x,.925,z]);add('counter_front_strip',[w,.12,.025],[x,.68,z-.515],'teal',{noCollide:true});};
  const kitchen=(x,z,w=8)=>{add('kitchen_base',[w,.85,.8],[x,.425,z],'metal');add('kitchen_worktop',[w+.08,.08,.86],[x,.89,z],'metal');for(const a of [-2,0,2]){add('hob',[.7,.035,.55],[x+a,.95,z],'navy');add('kitchen_hood',[1.0,.25,.8],[x+a,2.6,z],'metal',{noCollide:true});}add('oven',[1.1,1.95,.8],[x+w/2-1,1.0,z],'metal');add('oven_display',[.83,.55,.035],[x+w/2-1,1.25,z-.425],'screen',{noCollide:true});};
  const sign=(text,x,z,w=4)=>parts.push({part:'sign',text,size:[w,.65,.04],at:at(x,2.60,z),yaw:yaw+Math.PI,mat:'navy',room:r.id,deck:r.deck,noCollide:true});
  if(r.id==='d02-new-1'){
   for(const x of [-5,5])for(const z of [3.5,7,10.2]){table(x,z);pendant(x,z);}
   counter(0,13.1,8);kitchen(0,15.0,8);sign('ARRIVAL FOOD HALL',0,13.1,5.2);sign('FRESH BOWLS  /  BAKERY  /  HOT MEALS',0,14.4,6.8);
   for(const x of [-6,6]){seat(x,15.7);plant(x*1.35,15.7);}
  }else if(r.id==='d01-new-2'){
   for(const x of [-6.7,6.7])for(const z of [4.4,9.8]){add('workbench',[3.2,.90,1.0],[x,.45,z],'metal');add('workbench_top',[3.3,.08,1.1],[x,.94,z]);add('tool_panel',[3.1,1.1,.08],[x,1.72,z+.42],'navy');for(const a of [-.9,0,.9])add('tool',[.12,.55,.10],[x+a,1.70,z+.35],'orange',{noCollide:true});}
   seat(-6.7,3.2);seat(6.7,3.2);
   add('rover_body',[2.2,.60,3.0],[0,.66,9.2],'cream');add('rover_canopy',[1.8,.65,1.6],[0,1.36,9.0],'screen',{noCollide:true});
   for(const x of [-1.18,1.18])for(const z of [8.3,10.2])add('rover_wheel',[.36,.65,.65],[x,.42,z],'navy',{round:true});
   for(const x of [-5,0,5]){add('suit_locker',[1.65,2.35,.65],[x,1.18,14.5],'metal');add('suit_body',[.70,.85,.35],[x,1.3,14.05],'cream',{noCollide:true});add('suit_helmet',[.58,.58,.48],[x,2.0,14.05],'cream',{round:true,noCollide:true});add('suit_visor',[.42,.24,.10],[x,2.02,13.79],'screen',{noCollide:true});for(const side of [-1,1]){add('suit_arm',[.20,.62,.25],[x+side*.40,1.25,14.05],'cream',{noCollide:true});add('suit_leg',[.22,.55,.27],[x+side*.20,.60,14.05],'cream',{noCollide:true});add('suit_boot',[.25,.14,.35],[x+side*.20,.255,13.99],'navy',{noCollide:true});}add('suit_hanger',[1.1,.05,.08],[x,2.31,14.1],'orange',{noCollide:true});}
   sign('ROVER & SUIT WORKSHOP',0,13.7,5.6);pendant(-5,7);pendant(5,7);
  }else if(r.id==='d05-new-4'){
   counter(-5.5,2.6,4);sign('WELLNESS & SPA',-5.5,2.6,4.3);seat(4,3);seat(6,3);
   for(const x of [-5.5,-2])for(const z of [7.5,11.1]){
    add('lounger_frame',[.90,.35,2.25],[x,.23,z]);add('lounger_cushion',[.78,.15,2.05],[x,.48,z],'cream');add('lounger_head',[.78,.20,.38],[x,.65,z-.8],'teal');
    rests.push({id:'p4-'+r.id+'-lounger-'+rests.length,room:r.id,kind:'lie',point:at(x,.555,z),head:[-v[0],0,-v[1]],length:2.05,height:r.y+.555,instanced:true,phase4:true});
   }
   // A shallow tray on the continuous floor, not a new floor opening.
   add('pool_base',[4.2,.16,4.2],[4.5,.10,10.2],'cream');add('pool_water',[3.6,.02,3.6],[4.5,.20,10.2],'water',{noCollide:true});
   for(const s of [-1,1]){add('pool_rim',[4.2,.22,.30],[4.5,.21,10.2+s*1.95],'cream');add('pool_rim',[.30,.22,3.6],[4.5+s*1.95,.21,10.2],'cream');}
   for(const x of [-7.8,7.8]){plant(x,13.4);pendant(x,6);}
   add('towel_rack',[1.5,2.15,.55],[-8.4,1.1,5.4]);for(const z of [0,.25,.5])add('folded_towel',[1.1,.12,.40],[-8.4,.8+z,5.35],'cream',{noCollide:true});
   add('privacy_screen',[.10,2.35,3.5],[-.2,1.18,7.9],'teal');
  }else{
   for(const x of [-11,-4.8,4.8,11]){table(x,2.8);pendant(x,2.8);}
   if(r.id.endsWith('dining')){counter(-7.4,6.0,7.8);kitchen(-7.4,7.8,7.8);sign('NEIGHBOURHOOD DINING',-7.4,6.0,6);for(const x of [5,7,9])seat(x,7.0,Math.PI);}
   else{counter(-8,6.0,7);kitchen(-8,7.8,7);counter(7.5,6.0,7);sign('CAFÉ   /   BAR',0,7.6,5.0);for(const x of [4.8,7,9.2])seat(x,4.6);add('espresso_machine',[1.15,.65,.70],[-8,1.30,6],'metal');for(const x of [5,7,9])add('bar_bottle',[.12,.45,.12],[x,1.20,6],'green',{noCollide:true});}
   plant(-14,5.6);plant(14,5.6);
  }
  rooms.push({id:r.id,deck:r.deck,name:r.name,origin:r.door.center,u,v,rests:rests.filter(s=>s.room===r.id).length});
 };
 for(const id of PHASE4_ROOMS){const r=layout.rooms.find(r=>r.id===id);if(!r)throw Error('Missing Phase 4 room '+id);room(r);}
 const s=layout.shuttles.find(s=>s.id===PHASE4_SHUTTLE);if(!s)throw Error('Missing prototype shuttle');
 const cs=Math.cos(s.yaw),sn=Math.sin(s.yaw),at=(u,y,v)=>[s.x+cs*u+sn*v,s.y+y,s.z-sn*u+cs*v];
 const add=(part,size,p,mat='cream',opts={})=>parts.push({part:'shuttle_'+part,size,at:at(...p),yaw:s.yaw,mat,room:s.roomId,component:s.id,deck:s.deck,...opts});
 add('floor',[21.6,.12,7.5],[0,.066,0],'navy');add('ceiling',[21.6,.10,7.5],[0,2.98,0]);
 for(const side of [-1,1]){add('side_wall',[21.36,2.804,.12],[0,1.528,side*3.69]);for(const u of [-7.5,-3.5,.5,4.5,8.0]){add('overhead_bin',[3.2,.45,.45],[u,2.55,side*3.34]);add('bin_latch',[.32,.06,.035],[u,2.36,side*3.09],'orange',{noCollide:true});add('reading_light',[3.1,.025,.12],[u,2.27,side*3.09],'light',{noCollide:true});}}
 add('bow_bulkhead',[.12,2.804,.50],[10.74,1.528,-3.50]);add('bow_bulkhead',[.12,2.804,5.80],[10.74,1.528,.85]);add('inspection_wall_header',[.12,.60,1.20],[10.74,2.63,-2.65],'orange');for(const side of [-1,1]){add('stern_wall',[.12,2.804,2.65],[-10.74,1.528,side*2.425]);add('door_parked',[.08,2.25,.55],[-10.63,1.25,side*1.48],'orange');}
 add('door_wall_header',[.16,.50,2.2],[-10.74,2.68,0],'navy');
 add('helm',[.68,.95,1.7],[9.85,.60,0],'metal');add('helm_flight_display',[.56,.045,1.5],[9.67,1.15,0],'screen',{roll:.38,noCollide:true});
 for(const v of [-.43,.43])add('helm_raised_screen',[.035,.46,.76],[10.16,1.38,v],'screen',{noCollide:true});
 for(const v of [-.90,.90]){add('control_stick',[.05,.26,.05],[9.52,1.20,v],'navy',{noCollide:true});add('stick_grip',[.09,.10,.09],[9.52,1.38,v],'orange',{noCollide:true});}
 add('view_screen_frame',[.035,1.06,3.8],[10.65,1.86,0],'navy',{noCollide:true});add('view_screen',[.02,.90,3.6],[10.62,1.86,0],'screen',{noCollide:true});
 for(const seat of s.seats){const [u,,v]=seat.local;
  add('seat_cushion',[.58,.16,.48],[u,.50,v],'teal');add('seat_back',[.10,.73,.48],[u-.28,.91,v],'teal');add('seat_base',[.22,.42,.32],[u,.29,v],'metal');
  add('headrest',[.12,.22,.42],[u-.28,1.38,v],'navy',{noCollide:true});for(const dz of [-.14,.14])add('shoulder_harness',[.025,.56,.06],[u-.21,.95,v+dz],'orange',{noCollide:true});add('harness_buckle',[.035,.09,.12],[u-.20,.78,v],'metal',{noCollide:true});
  rests.push({id:seat.id,room:s.roomId,component:s.id,kind:'sit',point:at(u,.58,v),facing:[cs,0,-sn],height:s.y+.58,instanced:true,phase4:true});
 }
 rooms.push({id:s.id,deck:s.deck,name:'Escape shuttle prototype',rests:100});
 return{parts,rests,rooms};
}
