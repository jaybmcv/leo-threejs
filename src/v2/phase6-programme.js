import {hydrateHullLayout} from '../plan/envelope-data-v2.js';
import {ATRIUM_ZONES,ATRIUM_TERRACES,ATRIUM_LAKE_BRIDGE,phase6Owners,BOW_CAFE_THEMES,phase6LakePolygon,ATRIUM_GARDEN_POCKETS} from '../plan/atrium-v2.js';
import {patchDepth,worldPoint} from '../plan/hull-skin-v2.js';
import {contains,distanceToSegment,bounds} from '../plan/geometry-v2.js';
export function phase6Programme(layout){
 const parts=[],rests=[],owners=phase6Owners(layout),y=layout.decks[5].y,outline=layout.decks[5].atrium.outline;
 const add=(room,part,size,at,mat='oak',opts={})=>parts.push({room,part,size,at,mat,yaw:0,deck:6,phase6:true,...opts});
 const fits=(x,z,w,d,clear=2.4)=>[-w/2,0,w/2].every(dx=>[-d/2,0,d/2].every(dz=>{const q=[x+dx,z+dz];return contains(outline,q)&&outline.every((a,i)=>distanceToSegment(q,a,outline[(i+1)%outline.length])>=clear);}));
 const seat=(room,x,z,yaw=0,floor=y,deck=6,accent='teal')=>{
  const id='p6-'+room+'-seat-'+rests.filter(s=>s.room===room).length;
  add(room,'seat_cushion',[.62,.16,.60],[x,floor+.49,z],accent,{yaw,deck});
  add(room,'seat_back',[.62,.44,.10],[x-Math.sin(yaw)*.30,floor+.76,z-Math.cos(yaw)*.30],accent,{yaw,deck});
  add(room,'seat_pedestal',[.30,.41,.30],[x,floor+.205,z],'metal',{deck});
  rests.push({id,room,kind:'sit',point:[x,floor+.57,z],facing:[Math.sin(yaw),0,Math.cos(yaw)],height:floor+.57,instanced:true,phase4:true,phase6:true});
 };
 const table=(room,x,z,floor=y,deck=6,accent='teal')=>{
  add(room,'table_top',[1.25,.08,1.0],[x,floor+.76,z],'oak',{deck});add(room,'table_pedestal',[.35,.72,.35],[x,floor+.36,z],'metal',{deck});
  seat(room,x,z-1.02,0,floor,deck,accent);seat(room,x,z+1.02,Math.PI,floor,deck,accent);seat(room,x-1.15,z,Math.PI/2,floor,deck,accent);seat(room,x+1.15,z,-Math.PI/2,floor,deck,accent);
 };
 const plant=(room,x,z,floor=y,deck=6)=>{add(room,'plant_pot',[.52,.48,.52],[x,floor+.24,z],'cream',{deck});add(room,'plant_foliage',[.72,.95,.65],[x,floor+.94,z],'green',{round:true,noCollide:true,deck});};
 const sign=(room,text,x,z,w=6,floor=y,deck=6,yaw=0)=>add(room,'sign',[w,.65,.04],[x,floor+2.6,z],'navy',{text,deck,yaw,noCollide:true});
 const bench=(room,x,z,yaw=0,floor=y,deck=6)=>{for(const dx of[-.4,.4])seat(room,x+Math.cos(yaw)*dx,z-Math.sin(yaw)*dx,yaw,floor,deck,'sage');add(room,'sofa_plinth',[1.8,.30,.78],[x,floor+.21,z],'oak',{yaw,deck});};
 // Six planted pockets sit between the real wing approaches. Keep 2.4 m
 // around their full footprint and reserve the z=0 boulevard throughout.
 const gardenPockets=ATRIUM_GARDEN_POCKETS.filter(p=>fits(p.x,p.z,p.width,p.depth));
 const inPocket=(x,z,w=0,d=0)=>gardenPockets.some(p=>Math.abs(x-p.x)<p.width/2+w/2+2.4&&Math.abs(z-p.z)<p.depth/2+d/2+2.4);
 const tree=(room,x,z,h=4.4)=>{add(room,'p6_tree_trunk',[.44,2.8,.44],[x,y+1.4,z],'oak');for(const[ox,oz,dy]of[[-.65,0,0],[.65,.35,.25],[0,-.45,.6]])add(room,'p6_tree_crown',[2.8,2.2,2.8],[x+ox,y+h-1.7+dy,z+oz],'green',{noCollide:true});};
 for(const p of gardenPockets){
  const room=p.z<0&&p.x>0?'atrium6-lake':p.z<0?'atrium6-park':'atrium6-food';
  for(const dx of[-3.5,0])tree(room,p.x+dx,p.z-1.1,p.canopyHeight);
  for(const dx of[-4.5,-1.5,1.5,4.5])for(const dz of[-3.1,3.1]){if(p.x>0&&p.z<0&&dz<0&&Math.abs(dx)<3)continue;add(room,'garden_planter',[2.4,.32,1.1],[p.x+dx,y+.16,p.z+dz],'cream');add(room,'recovery_planting',[2.1,.85,1],[p.x+dx,y+.74,p.z+dz],'green',{round:true,noCollide:true});}
  for(const dz of[-1.5,1.5])bench(room,p.x+3.8,p.z+dz,-Math.PI/2);
 }
 // Retain a looser park grove between the garden pockets and the boulevard.
 for(const x of[-82,-66,-50,-34,-18])for(const z of[-27,-14])if(fits(x,z,6,6)&&!inPocket(x,z,6,6)){tree('atrium6-park',x,z);if(fits(x+3.8,z,2,1.2))bench('atrium6-park',x+3.8,z,Math.PI/2);}
 sign('atrium6-park','VOYAGER GARDENS',-84,-8.8,6);for(const x of[-86,-82])add('atrium6-park','p6_sign_post',[.08,2.8,.08],[x,y+1.4,-8.8],'metal');
 // Existing table design, redistributed into courts. 8 m table pitch gives
 // over 4 m clear between occupied seats; 4 m aisles flank every stall row.
 for(const x of[-84,-76,-68,-60,-52,-44,-36,-28,-20,-12,8,16,24,32,40,48,56])for(const z of[22,40,52])if(fits(x,z,3.6,3.1)&&!inPocket(x,z,3.6,3.1))table('atrium6-food',x,z);
 const stallNames=['BAKERY','GREENS','NOODLES','FRUIT','TEA','PANTRY','FLOWERS','COFFEE','SOUP','FRESH MEALS','SPICES','JUICE','BREAD','SEED EXCHANGE'];
 let stallIndex=0;
 for(const z of[14,30])for(const x of[-84,-72,-60,-48,-36,-24,-12]){
  if(!fits(x,z,4,3))continue;
  add('atrium6-food','counter_body',[4,.88,.8],[x,y+.44,z-1.1],'cream');add('atrium6-food','counter_top',[4,.09,.9],[x,y+.925,z-1.1]);
  add('atrium6-food','kitchen_base',[4,.85,.6],[x,y+.425,z+1.2],'metal');add('atrium6-food','kitchen_worktop',[4,.08,.7],[x,y+.89,z+1.2],'metal');
  for(const dx of[-1.9,1.9])add('atrium6-food','p6_stall_post',[.10,2.8,.10],[x+dx,y+1.4,z+1.4],'metal');
  add('atrium6-food','p6_stall_canopy',[4,.12,3],[x,y+2.86,z],'cream',{noCollide:true});add('atrium6-food','reading_light',[3.6,.025,.12],[x,y+2.78,z-.9],'light',{noCollide:true});
  sign('atrium6-food',stallNames[stallIndex++],x,z-1.3,3.6,y-.125);
 }
 // Destination beyond the stage; the central 12 m boulevard remains open.
 if(fits(162,0,24,36)){
  add('atrium6-commons','community_table',[12,.10,2],[162,y+.76,10],'oak');
  for(const dx of[-4.8,0,4.8])add('atrium6-commons','table_pedestal',[.4,.71,1.4],[162+dx,y+.355,10],'metal');
  for(const dx of[-4.8,-3.2,-1.6,0,1.6,3.2,4.8]){seat('atrium6-commons',162+dx,8.3,0);seat('atrium6-commons',162+dx,11.7,Math.PI);}
  for(const x of[153,162,171]){add('atrium6-commons','p6_exhibition_plinth',[3,.45,1],[x,y+.225,-12],'cream');add('atrium6-commons','p6_exhibition_panel',[3,1.6,.10],[x,y+1.45,-12],'teal');sign('atrium6-commons',['VOYAGE COMMONS','CREW EXHIBITION','SHARE YOUR NEXT IDEA'][[153,162,171].indexOf(x)],x,-11.92,2.8,y-1.15);}
  for(const x of[152,172])plant('atrium6-commons',x,15);
 }
 const lake=phase6LakePolygon(outline);
 // Lake has a 16cm shallow bed throughout, so no hidden deep-water drop.
 {const b=ATRIUM_LAKE_BRIDGE,[x0,x1,z0,z1]=b.bounds;add('atrium6-lake','p6_lake_bridge',[x1-x0,b.rise,z1-z0],[(x0+x1)/2,y+b.rise/2,(z0+z1)/2],'oak');}
 for(const z of[-53,-45,-37,-29,-21,-13])add('atrium6-lake','p6_bridge_pier',[2.2,.16,.4],[60,y-.08,z],'metal');
 for(const x of[11,21,53,69,93,105,115])for(const z of[-52,-9])if(fits(x,z,2.4,1.8)&&!(x===11&&z===-52)){ // Keep the dry garden approach open.
const bed=contains(lake,[x,z])?y-.16:y;add('atrium6-lake','garden_planter',[2.4,.42,1.1],[x,bed+.21,z],'cream');for(const dx of[-.75,0,.75])add('atrium6-lake','recovery_planting',[.6,.85,.6],[x+dx,bed+.845,z],'green',{round:true,noCollide:true});}
 // Reeds follow the notched lake edge, with gaps at the crossing and dry garden.
 for(let x=22;x<118;x+=6){if(Math.abs(x-60)<4)continue;const edge=lake.filter(q=>Math.abs(q[0]-x)<.26&&q[1]<-10).reduce((z,q)=>Math.max(z,q[1]),-56);for(const z of[edge+1.25,-8.2])if(fits(x,z,2.4,1.1)){add('atrium6-lake','recovery_planting',[2.1,.85,1],[x,y+.35,z],'green',{round:true,noCollide:true});}}
 sign('atrium6-lake','REFLECTION LAKE / SHALLOW EDGE',17,-8,8);for(const x of[14,20])add('atrium6-lake','p6_lake_sign_post',[.08,2.96,.08],[x,y+1.32,-8],'metal');
 add('atrium6-stage','p6_stage_platform',[14,.36,32],[113,y+.18,30],'oak');add('atrium6-stage','p6_stage_backdrop',[.16,3.1,29],[119.8,y+1.91,30],'navy',{noCollide:true});
 for(const x of Array.from({length:10},(_,i)=>70+i*3.5))for(const z of Array.from({length:20},(_,i)=>11+i*2))if(fits(x,z,1,1))seat('atrium6-stage',x,z,Math.PI/2);
 sign('atrium6-stage','THE COMMON STAGE',119.69,30,9,y+.36,6,-Math.PI/2);
 add('atrium6-lobby','counter_body',[6,.88,1],[-109,y+.44,-14],'cream');add('atrium6-lobby','counter_top',[6.12,.09,1.12],[-109,y+.925,-14]);
 sign('atrium6-lobby','LEO ATRIUM / RECEPTION',-109,-14.5,7);for(const x of[-111.5,-106.5])add('atrium6-lobby','p6_sign_post',[.08,2.8,.08],[x,y+1.4,-14.5],'metal');
 for(const x of[-117,-112,-107,-102])for(const z of[14,23])if(fits(x,z,2,1.5))bench('atrium6-lobby',x,z,Math.PI);
 add('atrium6-lobby','directory_base',[3,.22,1],[-109,y+.11,7],'metal');add('atrium6-lobby','directory_stem',[.18,1.405,.18],[-109,y+.9225,7],'metal');
 add('atrium6-lobby','sign',[5,1.25,.12],[-109,y+2.25,7],'navy',{text:'DECK 6 / ATRIUM\nFORWARD: PARK / LAKE / FOOD / STAGE\nAFT: LIFTS + STAIRS / MEET HERE',yaw:Math.PI,noCollide:true});
 for(const z of[-27,29])plant('atrium6-lobby',-103,z);
 const cafes=[];
 for(const r of layout.rooms.filter(r=>r.id.startsWith('nose-commons-'))){const p=layout.hullPrototypes.prototypes.find(p=>p.id===r.id),floor=r.y,deck=r.deck,k=deck-6,b=bounds(r.polygon),x=b.x0,accent=['teal','sage','clay'][k%3];
  if(!Array.isArray(p.inner))hydrateHullLayout({hullPrototypes:{prototypes:[p]},cabins:[],rooms:[],windows:[]});
  const ca=(part,size,at,mat='oak',opts={})=>add(r.id,part,size,at,mat,{deck,...opts});
  const counterZ=[3.9,-3.9,3.9,3.9,3.9,-3.9,3.9,3.9,3.9,3.9][k],counterX=x+3.5;
  ca('counter_body',[4,.88,1],[counterX,floor+.44,counterZ],'cream');ca('counter_top',[4.12,.09,1.12],[counterX,floor+.925,counterZ]);
  ca('kitchen_base',[4,.85,.8],[counterX,floor+.425,counterZ+Math.sign(counterZ)*1.35],'metal');ca('kitchen_worktop',[4.08,.08,.86],[counterX,floor+.89,counterZ+Math.sign(counterZ)*1.35],'metal');
  ca('espresso_machine',[1.15,.65,.70],[counterX,floor+1.295,counterZ],'metal');
  const layouts=[[[9,-2.6],[9,2.6]],[[10,-2.6],[10,2.6]],[[9,-2.6],[12,2.6]],[[7,-2.5],[12,2.5]],[[9.5,-2.6],[9.5,2.6]],[[9.5,-2.5],[12,2.5]],[[9,0]],[[11,0]],[],[[10,-2.6],[13,2.5]]];
  for(const[a,z]of layouts[k])table(r.id,x+a,z,floor,deck,accent);
  if(k===1){ca('bookshelf_body',[.45,2.1,3],[x+1.2,floor+1.05,2.7]);for(const dz of[-.9,-.45,0,.45,.9])ca('book_spine',[.2,.35,.22],[x+1.45,floor+1.45,2.7+dz],accent,{noCollide:true});}
  if(k===2){ca('art_easel',[.12,1.8,.12],[x+2,floor+.9,-4.4],'metal');ca('p6_art_panel',[.05,1.1,1.5],[x+2,floor+1.5,-4.4],'cream',{noCollide:true});ca('resident_artwork',[.025,.45,.75],[x+1.9625,floor+1.5,-4.4],'resident',{noCollide:true});}
  if(k===3){ca('play_table',[1.5,.38,1],[x+3,floor+.19,-2.8],accent);ca('toy_blocks',[.9,.2,.5],[x+3,floor+.48,-2.8],'orange',{noCollide:true});}
  if(k===4){ca('keyboard_case',[2.4,.12,.6],[x+3,floor+.87,-3.7],'navy');for(const dx of[-1,1])ca('keyboard_stand',[.07,.81,.45],[x+3+dx,floor+.405,-3.7],'metal');for(let i=0;i<24;i++)ca('keyboard_key',[.075,.025,.42],[x+2.1+i*.078,floor+.9425,-3.65],i%7===1||i%7===3||i%7===6?'navy':'cream',{noCollide:true});seat(r.id,x+3,-2.5,Math.PI,floor,deck,accent);seat(r.id,x+5.1,-2.6,Math.PI/2,floor,deck,accent);}
  if(k===5)for(const[a,z]of layouts[k])ca('game_board',[.65,.025,.65],[x+a,floor+.8125,z],'navy',{noCollide:true});
  if(k===6)for(const z of[-3,3]){seat(r.id,x+12,z,Math.PI/2,floor,deck,accent);ca('low_table',[.7,.10,.7],[x+13,floor+.42,z]);}
  if(k===7){ca('workbench',[3,.9,.8],[x+3,floor+.45,-3.7],'metal');ca('tool_panel',[3,.75,.06],[x+3,floor+1.4,-4.08],accent,{noCollide:true});seat(r.id,x+3,-2.5,Math.PI,floor,deck,accent);seat(r.id,x+4.5,-2.5,Math.PI,floor,deck,accent);}
  if(k===8){ca('community_table',[6,.08,1.2],[x+8.5,floor+.76,0]);for(const dx of[-2.4,2.4])ca('table_pedestal',[.35,.72,.8],[x+8.5+dx,floor+.36,0],'metal');for(const a of[6.1,7.7,9.3,10.9]){seat(r.id,x+a,-1.2,0,floor,deck,accent);seat(r.id,x+a,1.2,Math.PI,floor,deck,accent);}}
  const windowStart=rests.filter(s=>s.room===r.id).length;
  for(const o of p.openings){const u=(o[0]+o[1])/2,v=Math.min(...[.2,.8,1.7].map(h=>patchDepth(p.inner,u,h)))-1.35,at=worldPoint(p.chart,[u,0,v]);seat(r.id,at[0],at[2],Math.PI/2,floor,deck,accent);}
  plant(r.id,x+1.1,counterZ>0?-4.6:4.6,floor,deck);if(k!==9)plant(r.id,x+13.5,4.5,floor,deck);else for(const z of[-4.7,0,4.7])plant(r.id,x+13.5,z,floor,deck);
  sign(r.id,r.name.toUpperCase(),counterX,counterZ-Math.sign(counterZ)*.3,5.4,floor,deck,counterZ>0?0:Math.PI);
  for(const dx of[-1.7,1.7])ca('p6_menu_stem',[.035,1.43,.035],[counterX+dx,floor+1.685,counterZ-Math.sign(counterZ)*.3],'metal',{noCollide:true});
  cafes.push({id:r.id,deck,theme:BOW_CAFE_THEMES[k],windowStart,windowSeats:p.openings.length,seats:rests.filter(s=>s.room===r.id).length});
 }
 for(const t of ATRIUM_TERRACES){const floor=layout.decks[t.deck-1].y,z=t.side*13.7,x=-124.9;
  // Deck6 already has a continuous atrium floor. Upper aprons attach directly to the aft core.
  // Floor is produced from the shared circulation.balconies plan by model.js.
  for(const dz of[-2.25,-.75,.75,2.25])seat(t.id,x,z+dz,Math.PI/2,floor,t.deck,'sage');
  for(const[part,size,at,mat]of[['p6_terrace_glass',[.06,1.10,6.6],[-123.8,floor+.55,z],'glass'],['p6_terrace_rail',[.07,.05,6.6],[-123.8,floor+1.125,z],'metal'],...[-1,1].flatMap(s=>[['p6_terrace_glass',[2.2,1.10,.06],[x,floor+.55,z+s*3.3],'glass'],['p6_terrace_rail',[2.2,.05,.07],[x,floor+1.125,z+s*3.3],'metal']])])add(t.id,part,size,at,mat,{deck:t.deck});
 }
 // Restrained planting and benches on the existing front gallery floors.
 for(const r of layout.rooms.filter(r=>r.kind==='garden'&&r.id!=='commons-1')){const b=bounds(r.polygon),side=Math.sign((b.z0+b.z1)/2),z=side*27.1;for(const deck of[17,18,19]){const floor=layout.decks[deck-1].y;for(const x of[b.x0+8,b.x1-8]){bench(r.id,x,z,side<0?0:Math.PI,floor,deck);plant(r.id,x+2.4,z,floor,deck);}}}
 for(const side of[-1,1]){const z=side*12.5,floor=layout.decks[19].y;add('p6-crew-gallery','p6_service_cabinet',[.6,1.6,1.2],[135.3,floor+.8,z],'metal',{deck:20});add('p6-crew-gallery','p6_service_cabinet_seam',[.02,1.4,.015],[134.99,floor+.8,z],'navy',{deck:20,noCollide:true});for(const dz of[-.12,.12])add('p6-crew-gallery','p6_service_cabinet_handle',[.06,.16,.025],[134.97,floor+.85,z+dz],'metal',{deck:20,noCollide:true});}
 for(const side of[-1,1])for(const x of[128.3,135.7]){const z=side*12.5;add('p6-crew-gallery','p6_service_duct',[.20,.22,6],[x,layout.decks[19].y-.35,z],'metal',{deck:20,noCollide:true});add('p6-crew-gallery','p6_service_light',[.12,.025,5.8],[x,layout.decks[19].y-.4725,z],'light',{deck:20,noCollide:true});}
 return{parts,rests,owners,prototypeCafe:'nose-commons-05',cafes,terraces:ATRIUM_TERRACES,zones:ATRIUM_ZONES};
}
