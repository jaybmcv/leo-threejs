import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Mudwater Arena (MUDWATER_ARENA.md): the Deck 16 room that was the learning center, refitted as a card-game hall for
// Mudwater: Swamp Origins in the game's black-and-gold art deco, coloured from its community brand kit: Bog black,
// Bayou walls, Mist upholstery and light, Champagne metal shading to a deep Swamp Brass. A raised stage carries a
// giant 3 × 3 board between two player podiums, with hologram cards standing on five squares; spectator tiers face it
// from both long walls, match tables fill the entry half, a vault counter by the door holds the giveaway packs and a
// match screen sits on the end wall under the room's name. The card art is stand-in colour until real art is supplied.
// Room coordinates: the entry is at x = −26 (door at z −2…2), the end wall at x = +26, the long walls at z = ±17;
// the Deck 16 stair lobby takes x −26…−12, z 9…17. Floor at y = 0, ceiling at 3.37.
export const ARENA_ID='d16-arena-1';
export const STAGE={x0:0,x1:16,z:7,h:.45},BOARD={x:8,size:11.4};
export const TABLES=[[-9,-13],[-9,-8],[-9,8],[-9,13],[-3.5,-13],[-3.5,-8],[-3.5,8],[-3.5,13],[21,-12],[21,12]];
export const PODIUMS=[1.6,14.4];
export const COUNTER={x:-19,z:-9,length:7};
// Where the walk offers the game and the giveaway (walk/mudwater.js): standing points in room coordinates.
export const TRIGGERS=[
 {kind:'mudwater',at:[24.6,0,0]},
 ...PODIUMS.map(x=>({kind:'mudwater',at:[x+Math.sign(BOARD.x-x)*1.1,STAGE.h,0]})),
 {kind:'packs',at:[COUNTER.x,0,COUNTER.z+1.3]},
];
// Brand pieces the walk dresses with the brand kit's art (walk/mudwater.js); the ship viewer shows them plain.
// Two life-size pack standees flank the aisle inside the door, a gold coin is set in the floor between them, and two
// more hang either side of the match screen.
export const STANDEE={w:1.25,h:1.93,base:.15},STANDEES=[[-23,-4],[-23,4]];
export const VAULT={x:COUNTER.x,y:1.3,z:-15.73,r:.95},FLOOR_COIN={x:-20.6,z:0,r:1.05},WALL_COINS=[-5.95,5.95];
// The card gallery: two rows on the end wall either side of the screen and on both long walls by the tables. Each card
// is its centre and the way it faces (+x or ±z).
export const GALLERY=[.85,1.95].flatMap(y=>[
 ...[-1,1].flatMap(s=>Array.from({length:8},(_,i)=>({p:[25.85,y,s*(8.3+i*1.05)],face:-1,axis:'x'}))),
 ...[-1,1].flatMap(s=>Array.from({length:10},(_,i)=>({p:[-11+i*1.1,y,s*16.8],face:-s,axis:'z'}))),
]);
// The packs fanned on the counter: centre and turn of each.
export const PACK_FOILS=Array.from({length:6},(_,i)=>COUNTER.x-2.6+i*1.04).flatMap(px=>Array.from({length:4},(_,j)=>({at:[px-.25+j*.16,1.18,COUNTER.z+.25],turn:(j-1.5)*.15})));
// Hologram cards: board square (column, row), turn, and colour.
const HOLOGRAMS=[[-1,-1,.6,0x3fd6e0],[0,-1,-.3,0x8f6bff],[1,0,.5,0xffa040],[0,1,.2,0x5fe07a],[-1,1,-.6,0xff5f8a]];
// Stand-in card art colours, in Mudwater's swampy, saturated range (the card art isn't in the brand kit).
const ART=[0x2e8f8a,0x6b4bb0,0x4f7a2e,0xb4552d,0xc9a13a,0xc0507a,0x3f74b8,0x8a5a3c,0x1f6b52,0x9a3b5e];

export function fitMudwaterArena({box,add,mat,text,fit,shell}){
 // (Matte finishes: the walk's environment light washes glossy dark surfaces out to grey, and the polish pass,
 // interior-polish.js, resets the roughness of materials named for linings and stone.)
 const M={
  black:mat('Arena_bog_lacquer',0x080806,{roughness:.72}),charcoal:mat('Arena_bayou_wall',0x1b1804,{roughness:.92}),
  gold:mat('Arena_champagne_metal',0xaea35d,{metalness:.75,roughness:.32}),deep:mat('Arena_swamp_brass_metal',0x6f6630,{metalness:.75,roughness:.38}),
  cream:mat('Arena_mist_upholstery',0xdcd7b7),
  felt:mat('Arena_bog_felt',0x0d0c05,{roughness:.95}),floor:mat('Arena_floor_slate',0x2a2717,{roughness:.82}),ceiling:mat('Arena_ceiling',0x121004,{roughness:.95}),
  rug:mat('Arena_fog_rug',0x3b392f,{roughness:.95}),glow:mat('Arena_mist_light',0xf1ecd0,{emissive:0xe9e1b4,emissiveIntensity:1.1}),
  screen:mat('Arena_screen',0x141205,{emissive:0x2a2610,emissiveIntensity:1}),lit:mat('Arena_lit_champagne',0xd8cf8f,{emissive:0xc9bd70,emissiveIntensity:.9}),
  teal:mat('Arena_score_teal',0x2fd6c5,{emissive:0x2fd6c5,emissiveIntensity:.8}),orange:mat('Arena_score_orange',0xf85800,{emissive:0xf85800,emissiveIntensity:.8}),
 };
 const art=ART.map((c,i)=>mat('Arena_card_art_'+i,c,{emissive:c,emissiveIntensity:.18,roughness:.6})),litArt=ART.map((c,i)=>mat('Arena_screen_art_'+i,c,{emissive:c,emissiveIntensity:.9}));
 // Repeated small parts are gathered per name (and material, where given) and drawn as one mesh each; the rest take
 // the material passed to flush, or what it picks for the name.
 const bins=new Map();
 const geo=(name,g,m=null)=>{const k=name+'|'+(m?.name||'');if(!bins.has(k))bins.set(k,{name,m,gs:[]});bins.get(k).gs.push(g);};
 const put=(name,size,p,ry=0,m=null)=>{const g=new T.BoxGeometry(...size);if(ry)g.rotateY(ry);geo(name,g.translate(...p),m);};
 const flush=(pick)=>{for(const {name,m,gs} of bins.values()){const o=add(name,mergeGeometries(gs),m||(typeof pick==='function'?pick(name):pick));o.castShadow=false;gs.forEach(g=>g.dispose());}bins.clear();};

 // The shell goes dark: Bayou walls, an olive-black floor and ceiling, a Bog identity panel and Champagne aisle lines.
 for(const root of [shell,fit])root.traverse(o=>{if(!o.isMesh)return;
  if(o.name==='Finished_floor')o.material=M.floor;
  else if(o.name==='Ceiling')o.material=M.ceiling;
  else if(o.name==='Area_identity_panel')o.material=M.black;
  else if(o.name==='Main_aisle_edge')o.material=M.gold;
  else if(o.material?.name==='Area_lining')o.material=M.charcoal;
 });
 // Art deco trim: a Champagne crown band and skirting on every wall run, Swamp Brass pilasters on the end wall.
 for(const s of [-1,1]){const inboard=s===1,x0=inboard?-12:-26,len=26-x0;
  for(const y of [3.12,.12])put('Arena_wall_trim',[len,y>1?.08:.06,.04],[x0+len/2,y,s*16.82]);}
 for(const y of [3.12,.12])put('Arena_wall_trim',[.04,y>1?.08:.06,33.6],[25.82,y,0]);
 for(const z of [-16.4,-7.6,-4.3,4.3,7.6,16.4])put('Arena_pilaster',[.1,3.3,.22],[25.79,1.65,z]);
 for(const x of [-11.9,.4])for(const s of [-1,1])put('Arena_pilaster',[.22,3.3,.1],[x,1.65,s*16.79]);
 flush(n=>n==='Arena_pilaster'?M.deep:M.gold);

 const {x0,x1,z:sz,h}=STAGE,mid=(x0+x1)/2,len=x1-x0;
 // The floor: concentric Champagne rings around the stage like ripples on dark water, and Fog rugs under the tables.
 for(const [i,d] of [[0,1.2],[1,2.3],[2,3.6]]){const w=len+2*d,dz=sz*2+2*d,t=.05-i*.012;
  if(dz/2<10.3){put('Arena_floor_inlay',[w,.012,t],[mid,.006,dz/2]);put('Arena_floor_inlay',[w,.012,t],[mid,.006,-dz/2]);}
  for(const x of [x0-d,x1+d])put('Arena_floor_inlay',[t,.012,dz],[x,.006,0]);}
 flush(M.gold);
 for(const [x,z] of TABLES)box('Table_rug',[3.4,.015,2.3],[x,.008,z],M.rug);

 // Stage: black lacquer with a brass fascia and a warm kick light, a step at each end.
 box('Mudwater_stage',[len,h,sz*2],[mid,h/2,0],M.black);
 for(const s of [-1,1]){put('Stage_fascia_trim',[len+.02,.05,.03],[mid,h-.03,s*(sz+.01)]);put('Stage_fascia_trim',[.03,.05,sz*2+.02],[s<0?x0-.01:x1+.01,h-.03,0]);}
 for(const x of [x0-.5,x1+.5]){box('Stage_step',[1,.22,6],[x,.11,0],M.black);put('Stage_fascia_trim',[1.02,.03,6.02],[x,.215,0]);}
 flush(M.gold);
 for(const s of [-1,1])put('Stage_kick_light',[len-.4,.035,.02],[mid,.05,s*(sz+.012)]);
 flush(M.glow);
 // The board: dark felt in a brass frame with stepped corner blocks, rays fanning out from the centre square as on the
 // game's board, and the 3 × 3 grid (its lines are the finishing pass's, area-finish.js).
 const bs=BOARD.size,top=h+.04;
 box('Mudwater_grid',[bs,.04,bs],[BOARD.x,h+.02,0],M.felt);
 for(const s of [-1,1]){put('Board_frame',[bs+.5,.07,.25],[BOARD.x,h+.035,s*(bs/2+.125)]);put('Board_frame',[.25,.07,bs],[BOARD.x+s*(bs/2+.125),h+.035,0]);}
 for(const sx of [-1,1])for(const sz2 of [-1,1]){put('Board_frame',[.6,.1,.6],[BOARD.x+sx*(bs/2+.12),h+.05,sz2*(bs/2+.12)]);put('Board_frame',[.34,.14,.34],[BOARD.x+sx*(bs/2+.12),h+.07,sz2*(bs/2+.12)]);}
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2,c=Math.cos(a),sn=Math.sin(a),r0=bs/6*1.05,reach=bs/2/Math.max(Math.abs(c),Math.abs(sn))-.05;
  put('Board_ray_inlay',[reach-r0,.004,.025],[BOARD.x+c*(r0+reach)/2,top+.002,sn*(r0+reach)/2],-a);}
 flush(M.gold);
 // Two podiums at the board's ends, each with a slanted console screen toward its stool.
 for(const x of PODIUMS){const s=Math.sign(BOARD.x-x);
  box('Mudwater_podium',[.9,1.05,1.5],[x,h+.525,0],M.black);put('Podium_trim',[.94,.05,1.54],[x,h+1.03,0]);put('Podium_trim',[.94,.04,1.54],[x,h+.06,0]);
  const scr=box('Mudwater_podium_screen',[.5,.03,1.1],[x-s*.1,h+1.08,0],M.screen);scr.rotation.z=s*.25;
  box('Seat',[.55,.1,.55],[x-s*.85,h+.62,0],M.cream);box('Back',[.1,.5,.55],[x-s*1.12,h+.93,0],M.cream);
  put('Stool_frame',[.08,.57,.08],[x-s*.85,h+.285,0]);put('Stool_frame',[.45,.03,.45],[x-s*.85,h+.015,0]);
 }
 flush(n=>n==='Stool_frame'?M.deep:M.gold);
 // Hologram cards: a brass emitter on the felt, a faint beam, and the card itself (a group of its own, which the walk
 // turns slowly: walk/mudwater.js).
 const sq=bs/3,beam=new T.ConeGeometry(.55,1.9,20,1,true);
 HOLOGRAMS.forEach(([i,j,r,c],n)=>{const x=BOARD.x+i*sq,z=j*sq,m=new T.MeshStandardMaterial({name:'Arena_hologram_'+n,color:c,emissive:c,emissiveIntensity:1.3,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide});
  const fm=new T.MeshStandardMaterial({name:'Arena_hologram_frame_'+n,color:0xe9e1b4,emissive:0xd8cf8f,emissiveIntensity:1.2,transparent:true,opacity:.85,depthWrite:false});
  add('Hologram_emitter',new T.CylinderGeometry(.42,.48,.06,24),M.gold,[x,top+.03,z]);
  const b=add('Hologram_beam_glow',beam,new T.MeshBasicMaterial({name:'Arena_hologram_beam_'+n,color:c,transparent:true,opacity:.12,depthWrite:false,side:T.DoubleSide}),[x,top+1.01,z]);b.rotation.x=Math.PI;b.castShadow=false;
  const g=new T.Group();g.name='Mudwater_hologram';g.position.set(x,top+1.25,z);g.rotation.y=r;fit.add(g);
  const card=add('Hologram_card_glow',new T.BoxGeometry(1,1.4,.03),m,[0,0,0],g);card.castShadow=false;
  const frame=[];for(const s of [-1,1]){frame.push(new T.BoxGeometry(1.04,.04,.04).translate(0,s*.7,0),new T.BoxGeometry(.04,1.44,.04).translate(s*.5,0,0));}
  for(const [dx,dy] of [[0,.52],[0,-.52],[-.38,0],[.38,0]])frame.push(new T.BoxGeometry(.16,.16,.035).translate(dx,dy,0));
  const f=add('Hologram_frame_art',mergeGeometries(frame),fm,[0,0,0],g);f.castShadow=false;
 });
 // Ceiling cans aimed at the stage.
 for(const x of [2,6,10,14])for(const s of [-1,1])put('Stage_spot_light',[.36,.3,.36],[x,3.18,s*(sz+.8)]);
 flush(M.black);
 for(const x of [2,6,10,14])for(const s of [-1,1])put('Stage_spot_light_glow',[.26,.02,.26],[x,3.025,s*(sz+.8)]);
 flush(M.glow);

 // Spectator tiers on both long walls: a bench on the floor, one on a 0.35 m tier, one on a 0.7 m tier with a walkway
 // behind to the wall. The tiers run a metre past the benches so the ends are stepped up onto.
 for(const s of [-1,1]){
  box('Bleacher_tier',[14,.35,1.35],[mid,.175,s*12.125],M.black);
  box('Bleacher_tier',[14,.7,4.1],[mid,.35,s*14.85],M.black);
  put('Tier_edge_stripe',[14,.02,.05],[mid,.355,s*11.475]);put('Tier_edge_stripe',[14,.02,.05],[mid,.705,s*12.825]);
  for(const [y,z] of [[0,10.8],[.35,12.15],[.7,13.5]]){
   box('Bench_frame',[12,.36,.42],[mid,y+.18,s*z],M.black);
   box('Bench_cushion',[12,.1,.5],[mid,y+.41,s*z],M.cream);
   box('Bench_back',[12,.5,.08],[mid,y+.71,s*(z+.27)],M.cream);
  }
 }
 flush(M.gold);

 // Match tables: black tops with a brass edge and a felt inset carrying the 3 × 3 grid, cream chairs facing across,
 // and a brass pendant over each.
 for(const [x,z] of TABLES){
  box('Match_table',[1.6,.08,1.6],[x,.76,z],M.black);box('Match_table_pedestal',[.3,.72,.3],[x,.36,z],M.black);
  put('Table_edge_trim',[1.64,.03,1.64],[x,.735,z]);put('Table_edge_trim',[.7,.03,.7],[x,.015,z]);
  box('Mudwater_grid',[1.2,.01,1.2],[x,.805,z],M.felt);
  for(const s of [-1,1]){
   box('Crew_seat',[.55,.1,.55],[x+s*1.25,.46,z],M.cream);box('Crew_seat_back',[.08,.55,.55],[x+s*1.5,.78,z],M.cream);
   for(const dx of [-.22,.22])for(const dz of [-.22,.22])put('Chair_leg',[.04,.41,.04],[x+s*1.25+dx,.205,z+dz]);
  }
  put('Pendant_lamp_shade',[.5,.18,.5],[x,2.42,z]);put('Pendant_lamp_cord',[.02,.85,.02],[x,2.93,z]);
 }
 flush(n=>n==='Chair_leg'?M.black:M.gold);
 for(const [x,z] of TABLES)put('Pendant_lamp_glow',[.4,.02,.4],[x,2.325,z]);
 flush(M.glow);

 // The pack counter by the door, faced toward the aisle with brass rays and the game's name; packs and sealed boxes on
 // top. The vault behind it on the long wall: a round brass door between lit shelves of boxes.
 const {x:cx,z:cz,length:cl}=COUNTER,front=cz+.56;
 box('Mudwater_pack_counter',[cl,1,1.1],[cx,.5,cz],M.black);
 box('Pack_counter_top',[cl+.2,.06,1.25],[cx,1.03,cz],M.black);put('Counter_trim',[cl+.24,.03,1.29],[cx,1.005,cz]);put('Counter_trim',[cl+.02,.06,.02],[cx,.06,front]);
 // (The rays fan up from a point low on the counter's face; a brass ring sits either side of the name.)
 for(let i=0;i<11;i++){const g=new T.BoxGeometry(.5,.025,.012).translate(.08,0,0).rotateZ(Math.PI*(i+1)/12);geo('Counter_front_art',g.translate(cx,.1,front+.006));}
 for(const dx of [-2.6,2.6])geo('Counter_front_art',new T.TorusGeometry(.3,.025,6,24).translate(cx+dx,.55,front+.01));
 flush(M.gold);
 text('MUDWATER',[cx,.66,front+.02],0,.2);
 for(let i=0;i<6;i++){const px=cx-2.6+i*1.04;
  for(let j=0;j<3;j++){put('Pack_box',[.36,.11,.26],[px,1.115+j*.115,cz-.25]);put('Pack_box_band',[.37,.025,.265],[px,1.115+j*.115,cz-.25]);}
  for(const {at:[fx,fy,fz],turn:a} of PACK_FOILS.filter(f=>Math.abs(f.at[0]-px)<.5)){put('Pack_foil',[.15,.24,.03],[fx,fy,fz],a);put('Pack_foil_logo_art',[.08,.08,.005],[fx+Math.sin(a)*.018,fy+.02,fz+.018],a);}
 }
 flush(n=>/band|logo/.test(n)?M.lit:M.black);
 box('Mudwater_pack_vault',[cl,2.6,1],[cx,1.3,-16.3],M.black);
 const door=add('Vault_door',new T.CylinderGeometry(VAULT.r,VAULT.r,.14,40),M.gold,[VAULT.x,VAULT.y,VAULT.z]);door.rotation.x=Math.PI/2;
 const hub=add('Vault_door_handle',new T.TorusGeometry(.32,.04,8,28),M.black,[cx,1.3,-15.64]);hub.castShadow=false;
 for(let i=0;i<3;i++){const sp=box('Vault_door_handle',[.9,.05,.05],[cx,1.3,-15.62],M.black);sp.rotation.z=i*Math.PI/3;}
 for(const dx of [-2.35,2.35]){
  box('Vault_shelf_niche',[1.9,2,.08],[cx+dx,1.25,-15.79],M.charcoal);
  for(const y of [.5,1.15,1.8]){put('Vault_shelf',[1.9,.04,.4],[cx+dx,y,-15.6]);put('Vault_shelf_light',[1.7,.015,.04],[cx+dx,y+.6,-15.45]);
   for(let i=0;i<4;i++)for(const dy of [.075,.19]){put('Pack_box',[.36,.11,.26],[cx+dx-.66+i*.44,y+dy,-15.6]);put('Pack_box_band',[.37,.025,.265],[cx+dx-.66+i*.44,y+dy,-15.6]);}}
 }
 flush(n=>n==='Vault_shelf_light'?M.glow:n==='Pack_box'?M.black:n==='Pack_box_band'?M.lit:M.gold);

 // The match screen on the end wall, under the room's name: a live board between the two scores.
 box('Mudwater_match_screen',[.12,1.7,7.4],[25.78,1.35,0],M.black);
 box('Match_screen_glow',[.02,1.5,7.2],[25.71,1.35,0],M.screen);
 const sx=25.69;
 for(let j=0;j<4;j++){put('Match_screen_graphics',[.006,.03,1.2],[sx,.75+j*.4,0]);put('Match_screen_graphics',[.006,1.2,.03],[sx,1.35,-.6+j*.4]);}
 flush(M.lit);
 for(const [i,j,c] of [[0,0,0],[1,1,1],[2,0,2],[1,2,3],[0,2,4]])put('Match_screen_card_graphics',[.004,.32,.24],[sx-.002,.95+j*.4,-.4+i*.4],0,litArt[c]);
 flush();
 box('Match_score_graphics',[.006,.5,1.1],[sx,1.35,-2.6],M.teal);box('Match_score_graphics',[.006,.5,1.1],[sx,1.35,2.6],M.orange);

 // The card gallery: each card a brass frame round its art and a cream caption strip, with a picture light over the
 // top row.
 GALLERY.forEach(({p:[x,y,z],face,axis},n)=>{
  const ry=axis==='x'?Math.PI/2:0,o=(d,dy=0)=>axis==='x'?[x+face*d,y+dy,z]:[x,y+dy,z+face*d];
  put('Card_frame',[.72,1,.04],o(0),ry);
  put('Card_art',[.6,.74,.012],o(.026,.07),ry,art[n*7%ART.length]);
  put('Card_caption_label',[.6,.1,.012],o(.026,-.38),ry);
  if(y>1.5)put('Card_picture_light',[.5,.04,.08],[...o(.09)].map((v,i)=>i===1?2.56:v),ry);
 });
 flush(n=>n==='Card_frame'?M.gold:n==='Card_caption_label'?M.cream:M.glow);

 // The pack standees: a black board on a plinth with a brass edge, the pack's art on both faces in the walk.
 for(const [x,z] of STANDEES){const {w,h,base}=STANDEE;
  box('Pack_standee',[.06,h,w],[x,base+h/2,z],M.black);box('Pack_standee_base',[.5,base,w+.1],[x,base/2,z],M.black);
  for(const s of [-1,1])put('Pack_standee_trim',[.08,h+.04,.03],[x,base+h/2,z+s*(w/2+.015)]);put('Pack_standee_trim',[.08,.03,w+.06],[x,base+h+.015,z]);
 }
 flush(M.gold);
}
