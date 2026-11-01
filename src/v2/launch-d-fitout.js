import {contains} from '../plan/geometry-v2.js';
// The accepted Phase 4 box/rounded-box, material and seat protocol. Every island
// is checked in the room's final door frame, including its standing approach.
export function launchDFitout(layout){
 const parts=[],rests=[],rooms=[];
 for(const r of layout.rooms.filter(r=>r.launchD)){
  const start=rests.length,n=r.door.outward,v=[-n[0],-n[1]],u=[v[1],-v[0]],yaw=Math.atan2(v[0],v[1]),theme=['teal','sage','clay'][r.launchD.variant%3];
  const at=(x,y,z)=>[r.door.center[0]+u[0]*x+v[0]*z,r.y+y,r.door.center[2]+u[1]*x+v[1]*z];
  const coords=r.polygon.map(p=>[(p[0]-r.door.center[0])*u[0]+(p[1]-r.door.center[2])*u[1],(p[0]-r.door.center[0])*v[0]+(p[1]-r.door.center[2])*v[1]]),lo=Math.min(...coords.map(p=>p[0])),hi=Math.max(...coords.map(p=>p[0])),depth=Math.max(...coords.map(p=>p[1]));
  const fits=(x,z,w,d,margin=.22)=>[-1,1].every(a=>[-1,1].every(b=>{const p=at(x+a*(w/2+margin),0,z+b*(d/2+margin));return contains(r.polygon,[p[0],p[2]]);}));
  const add=(part,size,p,mat='oak',opts={})=>parts.push({part,size,at:at(...p),mat:mat==='teal'?theme:mat,room:r.id,deck:r.deck,yaw:yaw+(opts.yaw||0),...opts});
  const sign=(text,x,z,w=4,y=2.8)=>add('sign',[w,.48,.04],[x,y,z],'navy',{text,yaw:yaw+Math.PI,noCollide:true});
  const seat=(x,z,angle=0)=>{if(!fits(x,z,1.35,2.6,.1))return;add('seat_cushion',[.62,.16,.60],[x,.49,z],'teal',{yaw:yaw+angle});add('seat_back',[.62,.44,.10],[x-Math.sin(angle)*.30,.76,z-Math.cos(angle)*.30],'teal',{yaw:yaw+angle});add('seat_pedestal',[.30,.40,.30],[x,.20,z],'metal');rests.push({id:'p4-'+r.id+'-seat-'+(rests.length-start),room:r.id,kind:'sit',point:at(x,.57,z),facing:[Math.sin(yaw+angle),0,Math.cos(yaw+angle)],height:r.y+.57,instanced:true,phase4:true});};
  const rack=(x,z,crop=false)=>{add('rack_back',[2.4,2.15,.05],[x,1.08,z+.325],'metal');for(const a of[-1.16,1.16])add('rack_post',[.08,2.15,.70],[x+a,1.08,z],'metal');for(const y of[.45,1.05,1.65]){add('rack_shelf',[2.45,.06,.78],[x,y,z]);if(crop){add('crop_tray',[2.18,.12,.56],[x,y+.09,z],'cream');for(const dx of[-.8,-.4,0,.4,.8])add('crop_greens',[.26,.22,.32],[x+dx,y+.25,z],r.launchD.kind==='mushrooms'?'cream':'green',{round:true,noCollide:true});}else for(const dx of[-.72,.72])add('supply_crate',[.56,.35,.54],[x+dx,y+.205,z],theme);}};
  const bench=(x,z)=>{add('workbench',[2.4,.90,1.0],[x,.45,z],'metal');add('workbench_top',[2.5,.08,1.1],[x,.94,z]);add('tool_panel',[2.3,1.1,.08],[x,1.72,z+.42],'navy');for(const dx of[-.7,0,.7])add('tool',[.12,.55,.10],[x+dx,1.70,z+.35],'orange',{noCollide:true});};
  const desk=(x,z)=>{add('desk_top',[2.4,.09,.85],[x,.78,z+.8]);add('desk_cabinet',[.55,.72,.72],[x-.83,.39,z+.8],'metal');add('console_screen',[1,.48,.07],[x,1.18,z+1.06],'screen',{noCollide:true});seat(x,z-.5);};
  const island=(x,z)=>{const k=r.launchD.kind;
   if(k==='waiting'||k==='reading'||k==='overlook'){seat(x-.8,z);seat(x+.8,z);if(fits(x,z+2,1.3,1)){add('low_table',[1.25,.08,1],[x,.6,z+2]);if(k!=='waiting')add('book_spine',[.6,.06,.4],[x,.69,z+2],theme,{noCollide:true});}}
   else if(k==='study'||k==='assistance'||k==='consultation'||k==='lab'||k==='inspection')desk(x,z);
   else if(k==='workshop')bench(x,z);
   else if(k==='laundry'){add('cold_cabinet',[2.4,1.35,.85],[x,.68,z],'cream');for(const dx of[-.6,.6]){add('cabinet_screen',[.7,.7,.04],[x+dx,.68,z-.445],'navy',{round:true,noCollide:true});add('folded_towel',[.8,.18,.6],[x+dx,1.46,z],'cream');}}
   else if(k==='studio'){add('stage_pad',[3.2,.14,2.8],[x,.08,z],theme);add('music_stand',[.65,1.15,.12],[x,1.0,z+.8],'metal');add('console_screen',[.55,.35,.03],[x,1.7,z+.72],'screen',{noCollide:true});}
   else if(k==='exhibition'){add('display_plinth',[1.1,.8,1.1],[x,.4,z],'cream');add('exhibit',[.6,.85,.6],[x,1.25,z],theme,{round:true});add('console_screen',[2.3,1.3,.08],[x,1.9,z+1.2],'screen',{noCollide:true});}
   else if(k==='cargo'||k==='marshalling'){add('pallet',[2.4,.16,1.6],[x,.1,z],'oak');for(const a of[-.62,.62])add('supply_crate',[1.05,.9,1.3],[x+a,.64,z],theme);add('loading_lane',[3.0,.015,.10],[x,.024,z-1.4],'orange',{noCollide:true});}
   else rack(x,z,k==='mushrooms'||k==='cultivation');
  };
  // An open, furniture-free entry and a 3 m central aisle read from the street.
  const sx=[Math.max(lo+1.4,-3),Math.min(hi-1.4,3)].filter(x=>Math.abs(x)>1.1);for(const x of new Set(sx))seat(x,2.4);
  if(hi-lo>=10)for(let x=lo+3.2;x<=hi-3.2;x+=6.2){if(Math.abs(x)<2)continue;for(let z=6.0;z<=depth-2.2;z+=5.8)if(fits(x,z,4.5,4.7))island(x,z);}
  const small=hi-lo<10;if(small)for(let z=6;z<=depth-2;z+=5.8){const x=lo+2;if(fits(x,z,2.5,2.5))island(x,z);}
  // Reception marker and entrance plaque use the same per-deck text atlas.
  const plaqueX=lo+(Math.min(4,hi-lo-1))/2+.3;if(r.openPlan)sign('D'+String(r.deck).padStart(2,'0')+'  /  '+r.name.toUpperCase(),plaqueX,.12,Math.min(4,hi-lo-1));
  if(!r.openPlan&&depth>7)sign(r.name.toUpperCase(),(lo+hi)/2,depth-.20,Math.min(7.4,hi-lo-1),2.5);
  if(!r.openPlan)for(let z=4;z<depth-1;z+=9)add('pendant_light',[1.2,.025,.25],[0,3.15,z],'light',{noCollide:true});
  rooms.push({id:r.id,deck:r.deck,name:r.name,origin:r.door.center,u,v,rests:rests.length-start,variant:r.launchD.variant,launchD:true});
 }
 for(const c of layout.circulation.corridors.filter(c=>c.kind==='public-street')){let ordinal=0;for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<6)continue;for(let t=4;t<len;t+=24){const f=t/len,deck=layout.decks[c.deck-1],x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;if(deck.slab.holes.some(h=>contains(h.polygon,[x,z]))||layout.rooms.some(r=>!r.aggregate&&r.deck===c.deck&&contains(r.polygon,[x,z])))continue;parts.push({part:'street_wayfinding',size:[1.7,.018,.14],at:[x,deck.y+.025,z],mat:c.deck<6?'orange':'sage',room:'circulation-'+c.deck,deck:c.deck,yaw:-Math.atan2(b[1]-a[1],b[0]-a[0]),noCollide:true});ordinal++;}}}
 return {parts,rests,rooms};
}
