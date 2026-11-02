import {launchEFitout} from './launch-e-fitout.js';
import {launchDFitout} from './launch-d-fitout.js';
import {phase6Programme} from './phase6-programme.js';
import{contains}from'../plan/geometry-v2.js';
// Accepted stage-1 kit, rolled out through the normal v2 producers.
export const PHASE4_ROOMS=[...[7,7,6,6,8].flatMap((count,i)=>Array.from({length:count},(_,j)=>'d'+String(i+1).padStart(2,'0')+'-new-'+(j+1))), 'd16-new-1','d16-new-2',...Array.from({length:10},(_,i)=>['neighborhood-'+(i+1)+'-dining','neighborhood-'+(i+1)+'-cafe']).flat()];
export const PHASE4_SHUTTLE='d3-escape-p-1';
export function phase4Programme(layout){
 const parts=[],rests=[],rooms=[];
 const roomStarts=new Map();
 const room=r=>{
  const start=parts.length,restStart=rests.length;roomStarts.set(r.id,start);
  const variant=r.deck%3,accent=['teal','sage','clay'][variant];
  const alongZ=Math.abs(r.door.outward[1])>.5,v=alongZ?[0,-r.door.outward[1]]:[-r.door.outward[0],0],u=[v[1],-v[0]];
  const at=(x,y,z)=>[r.door.center[0]+u[0]*x+v[0]*z,r.y+y,r.door.center[2]+u[1]*x+v[1]*z],yaw=Math.atan2(v[0],v[1]);
  const add=(part,size,p,mat='oak',opts={})=>parts.push({part,size,at:at(...p),mat:mat==='teal'?accent:mat,room:r.id,deck:r.deck,...opts,yaw:yaw+(opts.yaw||0)});
  const seat=(x,z,angle=0)=>{
   const f=[Math.sin(yaw+angle),0,Math.cos(yaw+angle)],index=rests.length-restStart;
   add('seat_cushion',[.62,.16,.60],[x,.49,z],'teal',{yaw:angle});
   add('seat_back',[.62,.44,.10],[x-Math.sin(angle)*.30,.76,z-Math.cos(angle)*.30],'teal',{yaw:angle});
   add('seat_pedestal',[.30,.40,.30],[x,.20,z],'metal');
   rests.push({id:'p4-'+r.id+'-seat-'+index,room:r.id,kind:'sit',point:at(x,.57,z),facing:f,height:r.y+.57,instanced:true,phase4:true});
  };
  const table=(x,z)=>{add('table_top',[1.25,.08,1.0],[x,.76,z]);add('table_pedestal',[.35,.70,.35],[x,.37,z],'metal');seat(x,z-1.02);seat(x,z+1.02,Math.PI);seat(x-1.15,z,Math.PI/2);seat(x+1.15,z,-Math.PI/2);};
  const pendant=(x,z)=>{add('pendant_stem',[.035,.45,.035],[x,3.10,z],'metal',{noCollide:true});add('pendant_shade',[.58,.12,.58],[x,2.84,z],'navy',{noCollide:true});add('pendant_light',[.46,.025,.46],[x,2.765,z],'light',{noCollide:true});};
  const plant=(x,z)=>{add('plant_pot',[.52,.48,.52],[x,.24,z],'cream');add('plant_foliage',[.72,.85+variant*.10,.65],[x,.89+variant*.05,z],'green',{noCollide:true,round:true});};
  const counter=(x,z,w=8)=>{add('counter_body',[w,.88,1.0],[x,.44,z],'cream');add('counter_top',[w+.12,.09,1.12],[x,.925,z]);add('counter_front_strip',[w,.12,.025],[x,.68,z-.515],'teal',{noCollide:true});};
  const kitchen=(x,z,w=8)=>{add('kitchen_base',[w,.85,.8],[x,.425,z],'metal');add('kitchen_worktop',[w+.08,.08,.86],[x,.89,z],'metal');for(const a of [-2,0,2]){add('hob',[.7,.035,.55],[x+a,.95,z],'navy');add('kitchen_hood',[1.0,.25,.8],[x+a,2.6,z],'metal',{noCollide:true});}add('oven',[1.1,1.95,.8],[x+w/2-1,1.0,z],'metal');add('oven_display',[.83,.55,.035],[x+w/2-1,1.25,z-.425],'screen',{noCollide:true});};
  const islandFits=(x,z,w,d)=>[-w/2-2,w/2+2].every(dx=>[-d/2-2,d/2+2].every(dz=>{const q=at(x+dx,0,z+dz);return[r.polygon,...(r.envelope||[]).map(s=>s.polygon)].every(poly=>contains(poly,[q[0],q[2]]));}));
  const sign=(text,x,z,w=4)=>parts.push({part:'sign',text,size:[w,.65,.04],at:at(x,2.60,z),yaw:yaw+Math.PI,mat:'navy',room:r.id,deck:r.deck,noCollide:true});
  if(['d02-new-1','d01-new-1','d03-new-1','d04-new-1','d05-new-1','d16-new-2'].includes(r.id)){
   for(const x of [-4.8-variant*.2,4.8+variant*.2])for(const z of [3.5,7,10.2]){table(x,z);pendant(x,z);}
   counter(0,13.1,8);kitchen(0,15.0,8);sign(r.name.toUpperCase()+'  /  FRESH MEALS',0,13.1,7.5);
   for(const x of [-6,6]){seat(x,15.7);plant(x*1.35,15.7);}
   if(r.id==='d05-new-1')for(const x of[-8.2,8.2])for(const z of[5.2,10.0]){add('garden_planter',[1.1,.42,2.4],[x,.23,z],'cream');for(const dz of[-.75,0,.75])add('recovery_planting',[.72,.85,.72],[x,.865,z+dz],'green',{round:true,noCollide:true});}
   for(const z of [20,24])for(const x of [-5,5])if(islandFits(x,z,3.0,3.0)){table(x,z);pendant(x,z);}
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
  }else if(r.id.startsWith('neighborhood-')){
   const half=Math.min(...r.polygon.map(p=>Math.abs((p[0]-r.door.center[0])*u[0]+(p[1]-r.door.center[2])*u[1]))),wide=half>15,xs=wide?[-11,-4.8,4.8,11]:[-6.8,-2.3,2.3,6.8],shift=wide?0:3;
   for(const x of xs){table(x,2.8);pendant(x,2.8);}
   if(r.id.endsWith('dining')){counter(-7.4+shift,5.7,7.8);kitchen(-7.4+shift,7.5,7.8);sign('NEIGHBOURHOOD '+(r.deck-5)+' DINING',-7.4+shift,5.7,6);for(const x of [5,7,9].map(x=>x-shift))seat(x,7.0,Math.PI);}
   else{counter(-8+shift,5.7,7);kitchen(-8+shift,7.5,7);counter(7.5-shift,5.7,7);sign('CAFÉ   /   BAR',0,7.6,5.0);for(const x of [4.8,7,9.2].map(x=>x-shift))seat(x,wide?4.3:7.1,wide?0:Math.PI);add('espresso_machine',[1.15,.65,.70],[-8+shift,1.30,5.7],'metal');for(const x of [5,7,9].map(x=>x-shift))add('bar_bottle',[.12,.45,.12],[x,1.20,5.7],'green',{noCollide:true});}
   plant(-Math.min(14,half-1.4),6.6);plant(Math.min(14,half-1.4),6.6);
  }else{
   // Shared sizes and generous independent aisles; the through-route starts at the actual plan door.
   const name=r.name.toLowerCase(),isClinic=/maternity|dental|clinic treatment/.test(name),isLounge=/lounge|rest|study|ready/.test(name),isControl=/control|office|welcome/.test(name),isKitchen=/bakery|galley/.test(name),isPlant=/nutrient|gas|power/.test(name),depth=Math.min(...r.polygon.map(p=>(p[0]-r.door.center[0])*v[0]+(p[1]-r.door.center[2])*v[1]).filter(d=>d>1)),back=Math.min(11.8,depth-2.0);
   const desk=(x,z)=>{add('desk_top',[2.4,.09,.85],[x,.78,z]);add('desk_cabinet',[.55,.72,.72],[x-.83,.39,z],'metal');add('console_screen',[1.0,.48,.07],[x,1.18,z+.26],'screen',{noCollide:true});seat(x,z-1.05);};
   const rack=(x,z,cold=false)=>{if(isLounge&&!name.includes('ready')){add('bookshelf_body',[2.4,2.15,.45],[x,1.08,z]);for(const y of[.45,.95,1.45,1.95]){add('bookshelf_shelf',[2.45,.06,.52],[x,y,z]);for(const dx of[-.85,-.5,-.15,.2,.55,.9])add('book_spine',[.18,.31,.20],[x+dx,y+.185,z-.18],dx<0?accent:'cream',{noCollide:true});}return;}if(cold||/ready|welcome/.test(name)){add(cold?'cold_cabinet':'crew_locker',[2.4,2.15,.70],[x,1.08,z],cold?'cream':'metal');add('cabinet_screen',[.42,.20,.025],[x,1.52,z-.365],'screen',{noCollide:true});for(const dx of[-.12,.12])add('cabinet_handle',[.025,.42,.04],[x+dx,1.10,z-.37],'metal',{noCollide:true});return;}add('rack_back',[2.4,2.15,.05],[x,1.08,z+.325],'metal');for(const dx of[-1.16,1.16])add('rack_post',[.08,2.15,.70],[x+dx,1.08,z],'metal');for(const y of[.45,1.05,1.65]){add('rack_shelf',[2.45,.06,.78],[x,y,z]);if(name.includes('leaf')){add('crop_tray',[2.18,.12,.56],[x,y+.09,z],'cream');add('crop_greens',[2.1,.20,.50],[x,y+.25,z],'green',{noCollide:true,round:true});}else for(const dx of[-.72,.72])add('supply_crate',[.56,.35,.54],[x+dx,y+.205,z-.02],name.includes('medical')?'cream':accent);}};
   const sofa=(x,z)=>{for(const dx of [-.48,.48])seat(x+dx,z);add('sofa_plinth',[2.0,.30,.78],[x,.21,z]);add('sofa_arm',[.16,.50,.78],[x-1,.60,z],accent);add('sofa_arm',[.16,.50,.78],[x+1,.60,z],accent);};
   const bed=(x,z,dental=false)=>{add('treatment_base',[.72,.60,1.7],[x,.32,z],'metal');add('treatment_mattress',[.9,.16,2.05],[x,.70,z],'cream');add('treatment_head',[.86,.14,.42],[x,.84,z-.78],accent);rests.push({id:'p4-'+r.id+'-treatment-'+(rests.length-restStart),room:r.id,kind:'lie',point:at(x,.78,z),head:[-v[0],0,-v[1]],length:2.05,height:r.y+.78,instanced:true,phase4:true});if(dental){add('dental_arm',[.08,2.12,.08],[x+1.0,1.10,z-.4],'metal');add('dental_light',[.55,.09,.38],[x+.65,2.20,z-.4],'light',{noCollide:true});}};
   if(isClinic){counter(-5.5,2.8,4);seat(4.5,3);seat(6.5,3);for(const x of [-5,4.5]){bed(x,7.5,name.includes('dental'));add('privacy_screen',[.10,2.25,3.1],[x+1.7,1.14,7.5],accent);rack(x,back);}if(name.includes('maternity')){add('family_cot',[1.1,.72,.72],[0,.37,9.8],'cream');add('cot_mattress',[.94,.08,.58],[0,.77,9.8],accent);for(const dx of[-.5,.5])for(const dz of[-.30,.30])add('cot_rail_post',[.035,.45,.035],[dx,1.03,9.8+dz],'cream',{noCollide:true});for(const dz of[-.30,.30])add('cot_top_rail',[1.05,.035,.035],[0,1.26,9.8+dz],'cream',{noCollide:true});sofa(0,4.2);} }
   else if(isLounge){for(const x of [-5.3,5.3])for(const z of [4.2,8.0]){sofa(x,z);add('low_table',[1.1,.12,.65],[x,.44,z+1.3]);}desk(-5.3,back);desk(5.3,back);for(const x of [-7.9,7.9])rack(x,back);if(name.includes('study'))for(const x of [-2.6,2.6])desk(x,back);}
   else if(isControl){desk(-5,4.5);desk(5,4.5);desk(-5,8.2);desk(5,8.2);for(const x of [-6,0,6])rack(x,back,name.includes('welcome'));if(name.includes('welcome'))counter(0,7.0,4);}
   else if(isKitchen){counter(-4.7,5.1,6);kitchen(-4.7,7.0,6);table(5.0,4.6);for(const x of [-5.8,0,5.8]){add('prep_bench',[2.4,.88,1.0],[x,.45,back],'metal');add('bread_tray',[1.8,.08,.60],[x,.94,back],'cream',{noCollide:true});for(const dx of [-.55,0,.55])add('bread_loaf',[.32,.18,.45],[x+dx,1.07,back],name.includes('bakery')?'oak':'green',{round:true,noCollide:true});}}
   else if(name.includes('container hold')){for(const x of[-4.8,4.8])for(const z of[4.5,8.8]){add('cargo_container',[3.6,2.5,2.2],[x,1.26,z],accent);for(const dx of[-1.3,-.65,0,.65,1.3])add('container_rib',[.05,2.3,.05],[x+dx,1.26,z-1.125],'metal',{noCollide:true});add('container_hazard',[3.4,.12,.035],[x,.48,z-1.13],'orange',{noCollide:true});}desk(0,back);}
   else{for(const x of [-5.6,5.6])for(const z of [4.0,7.5,back])rack(x,z,/cold|harvest/.test(name));desk(0,back);if(isPlant)for(const x of [-2,2]){add('service_tank',[.85,1.9,.85],[x,.97,7],'metal',{round:true});if(x<0)add('pipe_manifold',[4.8,.15,.15],[0,2.75,7],'orange',{noCollide:true});add('tank_riser',[.10,.95,.10],[x,2.25,7],'metal',{noCollide:true});}if(name.includes('sterile')){add('steriliser',[2.4,1.5,.85],[0,.77,6.5],'cream');add('steriliser_display',[1.8,.45,.03],[0,1.02,6.05],'screen',{noCollide:true});add('wash_bench',[2.4,.85,1.0],[0,.45,9.0],'metal');}
    if(name.includes('baggage')){add('baggage_belt',[2.5,.75,5],[0,.40,6.7],'navy');add('belt_surface',[2.25,.03,4.7],[0,.79,6.7],'metal',{noCollide:true});}if(name.includes('baggage'))for(const x of [-2,2])add('baggage_trolley',[1.1,.75,1.6],[x,.4,4.6],'orange');}
   for(const z of[16,20,24])for(const x of[-5,5])if(islandFits(x,z,3.0,2.8)){if(isLounge||isControl)desk(x,z);else if(isKitchen){add('prep_bench',[2.4,.88,1.0],[x,.45,z],'metal');add('pastry_tray',[1.8,.08,.6],[x,.94,z],'cream',{noCollide:true});}else rack(x,z,/cold|harvest/.test(name));}
   sign(r.name.toUpperCase(),0,Math.min(back,10.4),7.4);pendant(-5,5.5);pendant(5,5.5);plant(-7.8,Math.min(back,10.8));plant(7.8,Math.min(back,10.8));
  }
  if(r.id==='d05-new-4')sign('WELLNESS  /  RECEPTION',0,2.2,5.0);
  rooms.push({id:r.id,deck:r.deck,name:r.name,origin:r.door.center,u,v,rests:rests.length-restStart,variant});
 };
 for(const id of PHASE4_ROOMS){const r=layout.rooms.find(r=>r.id===id);if(!r)throw Error('Missing Phase 4 room '+id);room(r);}
 for(const s of layout.shuttles){
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
 rooms.push({id:s.id,deck:s.deck,name:'Escape shuttle',rests:100});
 }
 const launchD=launchDFitout(layout);parts.push(...launchD.parts);rests.push(...launchD.rests);rooms.push(...launchD.rooms);
 const phase6=phase6Programme(layout);parts.push(...phase6.parts);rests.push(...phase6.rests);const launchE=launchEFitout(layout,phase6);parts.push(...launchE.parts);rests.push(...launchE.rests);rooms.push(...launchE.rooms);return{parts,rests,rooms,phase6:phase6.owners};
}
