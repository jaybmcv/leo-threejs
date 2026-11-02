import {launchFCafeFitout} from './launch-f-fitout.js';
import {contains,bounds,distanceToSegment} from '../plan/geometry-v2.js';
// Stream E uses the existing Phase 4 instancing, collision and registered-seat protocol.
export function launchEFitout(layout,phase6){
 const parts=[],rests=[],rooms=[];
 const add=(r,part,size,at,mat='oak',opts={})=>parts.push({room:r.id,deck:r.deck,part,size,at,mat,yaw:0,launchE:true,...opts});
 const seat=(r,x,z,yaw=0,rise=0,accent='teal')=>{const y=r.y+rise,id='e-'+r.id+'-'+rests.filter(s=>s.room===r.id).length;
 add(r,'seat_cushion',[.62,.16,.60],[x,y+.49,z],accent,{yaw});add(r,'seat_back',[.62,.44,.10],[x-Math.sin(yaw)*.30,y+.76,z-Math.cos(yaw)*.30],accent,{yaw});add(r,'seat_pedestal',[.30,.41,.30],[x,y+.205,z],'metal');
 rests.push({id,room:r.id,kind:'sit',point:[x,y+.57,z],facing:[Math.sin(yaw),0,Math.cos(yaw)],height:y+.57,instanced:true,phase4:true,launchE:true});};
 const table=(r,x,z,accent='teal')=>{add(r,'table_top',[1.25,.08,1],[x,r.y+.76,z]);add(r,'table_pedestal',[.35,.72,.35],[x,r.y+.36,z],'metal');seat(r,x,z-1.02,0,0,accent);seat(r,x,z+1.02,Math.PI,0,accent);seat(r,x-1.15,z,Math.PI/2,0,accent);seat(r,x+1.15,z,-Math.PI/2,0,accent);};
 const sign=(r,text,x,z,w=5)=>add(r,'sign',[w,.6,.04],[x,r.y+2.7,z],'navy',{text,noCollide:true});
 const cafes=launchFCafeFitout(layout,phase6);parts.push(...cafes.parts);rests.push(...cafes.rests);rooms.push(...cafes.rooms);
 const forum=layout.rooms.find(r=>r.id==='d16-voyage-forum-bow');
 if(forum){const r=forum;
  add(r,'e_stage_platform',[6,.24,20],[158,r.y+.12,0]);add(r,'e_stage_screen',[.12,3.3,13],[154.2,r.y+2.3,0],'navy',{noCollide:true});add(r,'e_lectern',[.8,1.05,.8],[159.5,r.y+.765,-6],'oak');add(r,'sign',[8,1,.04],[154.3,r.y+2.1,0],'navy',{text:'VOYAGE FORUM',yaw:Math.PI/2,noCollide:true});
  // Eighteen curved rows fit within the 44 x 80 m oval. Central and radial aisles remain open.
  for(let row=0;row<18;row++){const rx=11+row*1.75,rz=15+row*1.35,rise=Math.floor(row/4)*.06,n=28+2*Math.floor(row/3);for(let i=0;i<n;i++){const a=-1.22+2.44*i/(n-1);if((row===1||row===2)&&(i===1||i===2||i===n-3||i===n-2))continue;if(Math.abs(a)<.11||Math.abs(Math.abs(a)-.65)<.065)continue;const x=158+rx*Math.cos(a),z=rz*Math.sin(a);seat(r,x,z,Math.atan2(158-x,-z),rise,'teal');}}
  for(const z of[-51,51]){add(r,'e_foyer_counter',[5,.9,1.2],[157,r.y+.45,z],'cream');sign(r,'VOYAGE FORUM',156.5,z,6);}
  for(const x of[162,172,182,192])for(const z of[-38,38])add(r,'e_acoustic_light',[3,.06,1.0],[x,r.y+3.35,z],'light',{noCollide:true});
  rooms.push({id:r.id,seats:rests.filter(s=>s.room===r.id).length});
 }
 const r=layout.rooms.find(r=>r.id==='observation-lounge');if(r){
  const polys=[r.polygon,...(r.envelope||[]).filter(s=>s.rise<=2&&s.rise+s.height>=1.6).map(s=>s.polygon)];
  const fits=(x,z,w=4,d=4)=>polys.every(p=>[-w/2,w/2].every(dx=>[-d/2,d/2].every(dz=>contains(p,[x+dx,z+dz]))));
  // A 6 m axial route remains clear to the telescope; book collections sit in the aft-side reading bays.
  for(const s of[-1,1])for(const z of[16,27,38]){const zz=s*z;if(!fits(176,zz,7,7))continue;add(r,'e_bookshelf',[.5,2.1,5.6],[173.2,r.y+1.05,zz],'oak');for(let i=0;i<15;i++)add(r,'e_book',[.23,.36,.19],[173.5,r.y+.65+(i%3)*.48,zz-2.4+Math.floor(i/3)*1.0],['teal','clay','cream'][i%3],{noCollide:true});table(r,178,zz,'sage');}
  for(const x of[186,195,203])for(const s of[-1,1])for(const z of[11,23,35]){const zz=s*z;if(!fits(x,zz,5,5))continue;table(r,x,zz,'clay');}
  for(const s of[-1,1])for(const x of[175,182,189,196,203])for(const z of[18,29,40,47]){const zz=s*z;if(!fits(x,zz,2.2,2.2)||fits(x,zz+s*5,2,2))continue;if(rests.some(q=>q.room===r.id&&Math.hypot(q.point[0]-x,q.point[2]-zz)<4))continue;seat(r,x,zz,Math.atan2(10,s*6),0,'teal');}
  for(let x=175;x<=205;x+=5)for(const s of[-1,1]){let z=52;while(z>8&&!fits(x,s*z,3.4,2.8))z-=.25;if(z<=8||rests.some(q=>q.room===r.id&&Math.hypot(q.point[0]-x,q.point[2]-s*z)<3.5))continue;const yaw=Math.atan2(.45,s*.89);for(const dx of[-.65,.65])seat(r,x+dx,s*z,yaw,0,'teal');add(r,'low_table',[1.0,.10,.7],[x,r.y+.42,s*(z-1.8)],'oak');}
  sign(r,'READING COLLECTIONS',174,30,5);sign(r,'QUIET SOCIAL',190,-5,5);
  sign(r,'OBSERVATION / READING / QUIET CONVERSATION',175,5,8);rooms.push({id:r.id,seats:rests.filter(s=>s.room===r.id).length});
 }
 return{parts,rests,rooms};
}

export function forumTerraces(){return Array.from({length:5},(_,tier)=>{const start=tier*4,end=Math.min(17,start+3),inner=[9.9+start*1.75,14+start*1.35],outer=tier<4?[9.9+(tier+1)*4*1.75,14+(tier+1)*4*1.35]:[12+end*1.75,16+end*1.35],arc=(r,reverse)=>Array.from({length:81},(_,i)=>{const a=-1.30+2.60*(reverse?80-i:i)/80;return[158+r[0]*Math.cos(a),r[1]*Math.sin(a)];});return{polygon:[...arc(outer,false),...arc(inner,true)],rise:tier*.06,tier};}).filter(t=>t.rise>0);}

export function forumUpperPlan(layout,room){const e=room.ceilingExtension,ramp=layout.circulation.ramps.find(r=>r.id==='observation-lounge-ramp'),b=bounds(e.polygon),clearance=2.2,cut=Math.max(b.x0,ramp.points[0][0]+(e.y+e.height-ramp.points[0][1]-clearance)*ramp.run/ramp.rise),width=ramp.width+.6;return{ceilingHoles:cut<b.x1?[ [[cut,-width/2],[b.x1,-width/2],[b.x1,width/2],[cut,width/2]] ]:[],portals:[b.x0,b.x1].map(x=>({center:[x,e.y,0],width})),rampHeadroom:clearance};}
