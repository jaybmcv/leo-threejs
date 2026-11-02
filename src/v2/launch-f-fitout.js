import {contains,rectangle,bounds,overlaps} from '../plan/geometry-v2.js';
export function launchFCafeFitout(layout,phase6){
 const parts=[],rests=[],rooms=[];
 for(const r of layout.rooms.filter(r=>r.launchF)){
  const x0=r.launchF.threshold,accent=['teal','sage','clay'][(r.deck-6)%3],existing=phase6.parts.filter(p=>p.room===r.id&&!p.noCollide),occupied=existing.map(p=>({polygon:rectangle(p.at[0],p.at[2],p.size[0]+.5,p.size[2]+.5,p.yaw),y:p.at[1]})),zones=[];const counterSide=[1,-1,1,1,1,-1,1,1,1,1][r.deck-6],counterZ=counterSide*(r.deck===6?5:9.4),queue=rectangle(x0+3,counterZ-counterSide*2,5.6,2.6);occupied.push({polygon:queue});
  const add=(part,size,at,mat='oak',opts={})=>parts.push({room:r.id,deck:r.deck,part,size,at,mat,yaw:0,launchE:true,launchF:true,...opts});
  const seat=(x,z,yaw=0)=>{const id='f-'+r.id+'-'+rests.filter(s=>s.room===r.id).length;add('seat_cushion',[.62,.16,.6],[x,r.y+.49,z],accent,{yaw,restId:id});add('seat_back',[.62,.44,.1],[x-Math.sin(yaw)*.3,r.y+.76,z-Math.cos(yaw)*.3],accent,{yaw,restId:id});add('seat_pedestal',[.3,.41,.3],[x,r.y+.205,z],'metal',{restId:id});rests.push({id,room:r.id,kind:'sit',point:[x,r.y+.57,z],facing:[Math.sin(yaw),0,Math.cos(yaw)],height:r.y+.57,instanced:true,phase4:true,launchE:true,launchF:true});};
  const reserve=(x,z,w,d)=>{const poly=rectangle(x,z,w,d);if(!poly.every(q=>contains(r.polygon,q))||occupied.some(o=>overlaps(poly,o.polygon))||zones.some(o=>overlaps(poly,o)))return false;zones.push(poly);return true;};
  const table=(x,z)=>{if(!reserve(x,z,3.5,3.5))return false;add('table_top',[1.25,.08,1],[x,r.y+.76,z]);add('table_pedestal',[.35,.72,.35],[x,r.y+.36,z],'metal');seat(x,z-1.05,0);seat(x,z+1.05,Math.PI);seat(x-1.15,z,Math.PI/2);seat(x+1.15,z,-Math.PI/2);return true;};
  const lounge=(x,z,sign)=>{if(!reserve(x,z,3.2,3.6))return false;for(const dx of[-.6,.6])seat(x+dx,z-sign*.7,sign>0?0:Math.PI);add('low_table',[1.1,.10,.7],[x,r.y+.42,z+sign*.65]);add('f_lounge_planter',[.55,.5,.55],[x+1.05,r.y+.25,z+sign*.6],'cream');return true;};
  const communal=(x,z)=>{if(!reserve(x,z,4.7,4.1))return false;add('community_table',[3.6,.08,1.2],[x,r.y+.76,z]);for(const dx of[-1.6,1.6])add('table_pedestal',[.35,.72,.7],[x+dx,r.y+.36,z],'metal');for(const dx of[-1.2,0,1.2]){seat(x+dx,z-1.25,0);seat(x+dx,z+1.25,Math.PI);}return true;};
  // A dedicated viewing pair faces the restored atrium through the aft glass.
  const viewZ=-counterSide*8;if(reserve(x0+1.65,viewZ,3.1,3.0)){for(const dz of[-.6,.6])seat(x0+2.1,viewZ+dz,-Math.PI/2);add('low_table',[.7,.1,1.0],[x0+.8,r.y+.42,viewZ]);}
  // Forward social bay, side dining bays, and a quieter pair on the atrium glass.
  communal(x0+15.6,0);
  for(const side of (r.deck%2?[-1,1]:[1,-1]))for(const [dx,z]of [[16.1,5.5],[16.1,9.5],[3,6.7],[3,13],[4.5,15]]){if(phase6.rests.filter(s=>s.room===r.id).length+rests.filter(s=>s.room===r.id).length>=48)break;table(x0+dx,side*z);}
  for(const side of[-1,1])for(const [dx,z]of [[2.2,4.5],[5.2,6.7],[14.8,6.5],[16,9]]){if(phase6.rests.filter(s=>s.room===r.id).length+rests.filter(s=>s.room===r.id).length>=48)break;lounge(x0+dx,side*z,side);}
  // Compact window pairs occupy surviving side pockets; the centre arrival route stays clear.
  for(const side of[-1,1])for(const dx of[1.5,4.5,15,16.5])for(const z of[9,13,16]){const x=x0+dx,zz=side*z;if(phase6.rests.filter(s=>s.room===r.id).length+rests.filter(s=>s.room===r.id).length>=44)break;if(reserve(x,zz,2.6,2.5)){for(const dz of[-.6,.6])seat(x,zz+dz,-side*Math.PI/2);add('low_table',[.7,.1,.8],[x-side*.9,r.y+.42,zz]);}}
  const bistro=(x,z)=>{if(!reserve(x,z,2.2,3.05))return false;add('table_top',[.8,.08,.65],[x,r.y+.76,z]);add('table_pedestal',[.25,.72,.25],[x,r.y+.36,z],'metal');seat(x,z-.9,0);seat(x,z+.9,Math.PI);return true;};
  for(const side of[-1,1])for(const dx of[1.6,4.4,7.2,10,13.3,16.3])for(const z of[4.4,7.8,11.2,14.6]){if(phase6.rests.filter(s=>s.room===r.id).length+rests.filter(s=>s.room===r.id).length>=44)break;bistro(x0+dx,side*z);}
  add('sign',[5.2,.6,.04],[x0+1,r.y+2.7,4.9],'navy',{text:r.name.split(' · ')[0].toUpperCase(),noCollide:true});
  rooms.push({id:r.id,queue,counterLength:5.6,staffClearWidth:1.1,seats:phase6.rests.filter(s=>s.room===r.id).length+rests.filter(s=>s.room===r.id).length});
 }
 // Keep complete table groups clear of the original 4m cafe door approaches.
 // The Deck 11 group also needs room behind its aft chair on the full-ship grid.
 const relocations=[
  ["nose-commons-04",235,-4.4,[28,29],0.7],
  ["nose-commons-06",232.1,-9.5,[6,7,8,9],0.75],
  ["nose-commons-07",218.7,-4.4,[26,27],0.7],
  ["nose-commons-07",221.5,-4.4,[28,29],0.7],
  ["nose-commons-08",213.7,-4.4,[20,21],0.7],
  ["nose-commons-08",216.5,-4.4,[22,23],0.7],
  ["nose-commons-09",208.7,-4.4,[20,21],0.7],
  ["nose-commons-09",211.5,-4.4,[22,23],0.7],
 ];
 for(const [room,x,z,indices,dz]of relocations){const ids=new Set(indices.map(i=>'f-'+room+'-'+i));for(const s of rests)if(ids.has(s.id))s.point[2]+=dz;for(const p of parts)if(ids.has(p.restId)||(p.room===room&&['table_top','table_pedestal'].includes(p.part)&&Math.abs(p.at[0]-x)<.01&&Math.abs(p.at[2]-z)<.01))p.at[2]+=dz;}
 // The prepared 2m-capsule flood found these ten chairs had no safe approach.
 // Keep the bay floors and three-sided tables; remove empty two-seat tables too.
 const blocked=new Set(['f-nose-commons-03-24','f-nose-commons-03-28','f-nose-commons-03-29','f-nose-commons-04-6','f-nose-commons-04-24','f-nose-commons-04-25','f-nose-commons-04-26','f-nose-commons-04-27','f-nose-commons-07-22','f-nose-commons-07-23']);
 const empty=[['nose-commons-03',233.9,14.6],['nose-commons-04',225.6,16],['nose-commons-04',228.6,16],['nose-commons-07',212.1,16]];
 const keptRests=rests.filter(s=>!blocked.has(s.id)),keptParts=parts.filter(p=>!blocked.has(p.restId)&&!empty.some(([room,x,z])=>p.room===room&&['low_table','table_top','table_pedestal'].includes(p.part)&&Math.abs(p.at[0]-x)<.01&&Math.abs(p.at[2]-z)<.01));
 for(const r of rooms)r.seats-=rests.filter(s=>s.room===r.id&&blocked.has(s.id)).length;
 return{parts:keptParts,rests:keptRests,rooms};
}
