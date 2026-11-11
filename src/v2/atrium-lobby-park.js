// Deck 6 atrium ground zones, option A of each (docs/atrium-areas.md, docs/atrium-areas/lobby-park/):
// G1 Arrival lobby, "welcome court": a round welcome desk (timber slats under a cream stone top) in a ring of eight
// low stone planters with flowering shrubs, four lamp posts with classic dark metal lantern cages round warm glowing
// cores (lit at night by atrium-mood.js: pools, halos, uplights), and a round basalt inlay edged in brass, the plaza's
// focal point in the middle ground of the arrival view, just port of the centre line. The walk to the boulevard flows
// round it: 7 m and more to starboard (past the directory sign to the benches), 3 m of open paving to port before the
// reception counter, which the inlay clears.
// The desk and planters collide, as the atrium's counters and planters do: the planters are the boulevard's own
// collidable garden_planter (addPlanterTrims in atrium-gardens.js dresses them), and the desk's drum is stood in for by
// four crossed boxes that nothing draws (atrium-architecture.js hides P4_*_collider).
// G2 Voyager park, "flower meadow": drifts of low flowering beds (soft pink, white, pale yellow) and ornamental grasses
// along the path's edges and round the grove trees, and two more small trees beside two of them, keeping the open lawn
// in the middle. Visual only.
// Everything drawn joins the atrium garden mesh (one vertex-coloured draw) and the lamps' glow joins its lantern draw,
// so this adds no draw call.
import * as T from 'three';
import {GREENS,paint,blade,orient,clump,stem,SHAPES} from '../walk/foliage.js';
import {ATRIUM_ZONES,phase6ParkPath} from '../plan/atrium-v2.js';
import {contains} from '../plan/geometry-v2.js';
import {WELCOME_COURT,COURT_PLANTER,COURT_PLANTERS,COURT_LAMPS,COURT_LANTERN_CORE} from './welcome-court.js';

const random=seed=>{let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
const DEG=Math.PI/180;
const rgb=hex=>new T.Color(hex).toArray();

// ---- G1: the welcome court ----------------------------------------------------------------------------------------
// Where it stands is welcome-court.js's (the walk lights its lanterns at night from there). Its outer brass edge
// (r 7.48) crosses the centre line by 2 m (flat inlay, walkable) and clears the reception counter by 0.45 m. The eight
// planters leave 2.4 m openings fore and aft, toward the boulevard and the lifts, 1.1-1.4 m gaps elsewhere, and a 1.3 m
// aisle round the desk inside.
export {WELCOME_COURT};
const PLANTER=COURT_PLANTER,PLANTERS=COURT_PLANTERS;
const DESK={r:1.9,top:1.97,height:1.1},BAND=[6.6,7.4],BRASS_WIDTH=.08;

/** The court's collidable parts, for phase6Programme (`add` is its part adder, `y` Deck 6's floor). */
export function addWelcomeCourtParts(add,y){
 const {x,z}=WELCOME_COURT;
 // Crossed 45° apart, the four boxes fill the drum to within 0.1 m all round.
 for(let k=0;k<4;k++)add('atrium6-lobby','p6_welcome_desk_collider',[3.7,DESK.height,1.56],[x,y+DESK.height/2,z],'cream',{yaw:k*Math.PI/4});
 for(const[dx,dz]of PLANTERS)add('atrium6-lobby','garden_planter',PLANTER,[x+dx,y+PLANTER[1]/2,z+dz],'stone');
}

// The boulevard inlays' stone and brass (addPromenadeInlays in atrium-gardens.js).
const BASALT=[0x5d5550,0x57504b,0x625955,0x5a524d],JOINT_HEX=0x3a3531,BRASS_LINE=0xc9a253;
const STONE=0xe6dccb,STONE_TOP=0xf0e7d6,WOOD=[0xb3865b,0x93653e],INSET=0x6b4a33,SCREEN=0x24282e,BRONZE=0x3b3530;
// The same stone clouding as the boulevard's slabs: a tone per point, hashed from its position.
const cloud=(x,z)=>{let h=Math.imul(Math.round(x*100),73856093)^Math.imul(Math.round(z*100),19349663);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296;};

// Flat-shaded triangles in one garden geometry; a colour is a hex or a function of the point giving [r,g,b].
function triangles(){
 const pos=[],col=[];
 return {
  tri(a,b,d,colour){for(const p of[a,b,d]){pos.push(...p);col.push(...(typeof colour==='function'?colour(p):rgb(colour)));}},
  geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));
   g.computeVertexNormals();g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));return g;},
 };
}
// A ring sector from r0 to r1 and angle a0 to a1, facing up, in `steps` pieces.
function sector(s,[cx,y,cz],r0,r1,a0,a1,colour,steps=1){
 const p=(r,t)=>[cx+Math.cos(t)*r,y,cz+Math.sin(t)*r];
 for(let i=0;i<steps;i++){const a=a0+(a1-a0)*i/steps,b=a0+(a1-a0)*(i+1)/steps;s.tri(p(r0,a),p(r0,b),p(r1,a),colour);s.tri(p(r1,a),p(r0,b),p(r1,b),colour);}
}
// The round inlay: a basalt band of 36 slabs, each clouded and set off by a 2 cm joint, between two brass lines, 12 mm
// over the floor like the boulevard's.
function courtInlay(s,centre,r){
 const n=36,step=Math.PI*2/n,joint=.02/((BAND[0]+BAND[1])/2);
 sector(s,centre,BAND[0]-BRASS_WIDTH,BAND[0],0,Math.PI*2,BRASS_LINE,108);
 sector(s,centre,BAND[1],BAND[1]+BRASS_WIDTH,0,Math.PI*2,BRASS_LINE,108);
 for(let k=0;k<n;k++){const a=k*step,tone=rgb(BASALT[r()*BASALT.length|0]),clouded=p=>{const f=1+(cloud(p[0],p[2])-.5)*.16;return tone.map(v=>v*f);};
  sector(s,centre,BAND[0],BAND[1],a,a+joint,JOINT_HEX);
  for(const[r0,r1]of[[BAND[0],(BAND[0]+BAND[1])/2],[(BAND[0]+BAND[1])/2,BAND[1]]])sector(s,centre,r0,r1,a+joint,a+step,clouded,3);}
 return n;
}
// The desk: a cream stone plinth, a drum of alternating timber slats, a thin brass band, a cream stone top with a
// leather inset, and two screens on the aft side, toward the lifts.
function welcomeDesk(out,x,y,z){
 const at=(g,h)=>g.translate(x,y+h,z),wood=WOOD.map(rgb),H=DESK.height,drum=H-.18;
 out.push(paint(at(new T.CylinderGeometry(DESK.r-.06,DESK.r-.04,.08,40),.04),STONE));
 // Non-indexed, each of the drum's 56 segments is two faces (six points): alternate their tone.
 out.push(paint(at(new T.CylinderGeometry(DESK.r,DESK.r,drum,56,1,true),.08+drum/2),(p,i)=>wood[Math.floor(i/6)%2]));
 out.push(paint(at(new T.CylinderGeometry(DESK.r+.015,DESK.r+.015,.035,56,1,true),H-.1+.0175),BRASS_LINE));
 out.push(paint(at(new T.CylinderGeometry(DESK.top,DESK.top,.065,56),H-.0325),STONE_TOP));
 out.push(paint(at(new T.CylinderGeometry(DESK.r*.62,DESK.r*.62,.012,32),H+.006),INSET));
 for(const a of[160,200]){const c=Math.cos(a*DEG),s=Math.sin(a*DEG),turn=Math.PI/2-a*DEG,d=DESK.r*.78;
  out.push(paint(new T.BoxGeometry(.06,.12,.06).translate(x+c*d,y+H+.06,z+s*d),BRONZE));
  out.push(paint(new T.BoxGeometry(.58,.36,.035).rotateX(-.12).rotateY(turn).translate(x+c*d,y+H+.3,z+s*d),SCREEN));}
}
// Low flowering shrubs filling a planter: leafy mounds along it, pink and white flowers over them.
function planterBlooms(out,x,top,z,r,first){
 for(const dx of[-.62,0,.62])clump(out,[x+dx+(r()-.5)*.1,top+.14,z+(r()-.5)*.08],{r:.27+r()*.06,rnd:r,leaves:1,detail:0,squash:.6,palette:[GREENS.dark,GREENS.mid,GREENS.bright]});
 const s=triangles();
 for(let k=0;k<22;k++)bloom(s,[x+(r()-.5)*1.85,top+.24+r()*.12,z+(r()-.5)*.55],.09+r()*.03,(k+first)%3?MEADOW.pink:MEADOW.white,r);
 out.push(s.geometry());
}
// A lamp post with a classic lantern, 4.45 m: a dark bronze base and post, then a dark metal cage round a glowing glass
// core 0.48 m tall, wider at the top (the lantern draw): a flared cup and base plate under it, a bar up each corner, a
// rim top and bottom and a mullion down each face, then an eaved pyramid roof and a finial. The light it throws at
// night (a pool under it, a halo round it, the planters' uplights) is atrium-mood.js's.
const METAL=0x2a2623;
// A square frustum by half-widths, its faces square to the ship.
const square=(top,bottom,h)=>new T.CylinderGeometry(top*Math.SQRT2,bottom*Math.SQRT2,h,4).rotateY(Math.PI/4);
const GLASS={bottom:COURT_LANTERN_CORE-.24,top:COURT_LANTERN_CORE+.24,hw0:.115,hw1:.145};
function lampPost(out,glow,x,y,z){
 const at=(g,h)=>g.translate(x,y+h,z),{bottom,top,hw0,hw1}=GLASS,hw=h=>hw0+(hw1-hw0)*(h-bottom)/(top-bottom);
 const bar=(h0,h1,fx,fz,off,r)=>stem([[x+fx*(hw0+off),y+h0,z+fz*(hw0+off)],[x+fx*(hw1+off),y+h1,z+fz*(hw1+off)]],r,METAL,4);
 out.push(paint(at(new T.CylinderGeometry(.14,.17,.05,12),.025),BRONZE));
 out.push(paint(at(new T.CylinderGeometry(.05,.065,3.4,8),.05+1.7),BRONZE));
 out.push(paint(at(new T.CylinderGeometry(.09,.09,.04,10),3.47),BRONZE));
 out.push(paint(at(square(.12,.05,.1),bottom-.085),METAL));
 out.push(paint(at(square(.16,.16,.035),bottom-.0175),METAL));
 glow.push(at(square(hw1,hw0,top-bottom),COURT_LANTERN_CORE));
 for(const fx of[-1,1])for(const fz of[-1,1])out.push(bar(bottom,top,fx,fz,.008,.017));
 for(const[fx,fz]of[[1,0],[-1,0],[0,1],[0,-1]])out.push(bar(bottom,top,fx,fz,.006,.009));
 for(const h of[bottom+.02,top-.02]){const w=hw(h)+.01;
  for(const s of[-1,1])out.push(paint(at(new T.BoxGeometry(2*w+.03,.035,.022),h).translate(0,0,s*w),METAL),paint(at(new T.BoxGeometry(.022,.035,2*w+.03),h).translate(s*w,0,0),METAL));}
 out.push(paint(at(square(.19,.19,.035),top+.0175),METAL));
 out.push(paint(at(square(.025,.17,.17),top+.12),METAL));
 out.push(paint(at(new T.SphereGeometry(.03,8,6),top+.235),METAL));
 out.push(paint(at(new T.ConeGeometry(.012,.08,6),top+.305),METAL));
}
function addWelcomeCourt(out,glow,y){
 const {x,z}=WELCOME_COURT,r=random(6206),s=triangles();
 const inlaySlabs=courtInlay(s,[x,y+.012,z],r);out.push(s.geometry());
 welcomeDesk(out,x,y,z);
 PLANTERS.forEach(([dx,dz],i)=>planterBlooms(out,x+dx,y+PLANTER[1]+.07,z+dz,r,i));
 for(const[dx,dz]of COURT_LAMPS)lampPost(out,glow,x+dx,y,z+dz);
 return {courtInlaySlabs:inlaySlabs,courtPlanters:PLANTERS.length,courtLamps:4};
}

// ---- G2: the flower meadow ----------------------------------------------------------------------------------------
const MEADOW={pink:0xf08cb3,white:0xfdfaf2,yellow:0xf6d257},MEADOW_TONES=[MEADOW.pink,MEADOW.white,MEADOW.yellow],EYE=0xf2c94c;
// A meadow flower as seen from standing height: five kite petals round a yellow eye, the disc tipped up toward the
// viewer by `tilt`. Eleven triangles.
function bloom(s,[x,y,z],size,hex,r){
 const facing=r()*Math.PI*2,tilt=.25+r()*.45,yaw=r()*Math.PI*2,base=rgb(hex).map(v=>v*.86),tip=rgb(hex);
 const lift=a=>Math.cos(a-facing)*Math.sin(tilt),p=(d,a)=>[x+Math.cos(a)*d,y+d*lift(a),z+Math.sin(a)*d],centre=[x,y,z];
 for(let k=0;k<5;k++){const a=yaw+k*72*DEG,l=p(size*.5,a-.5),t=p(size,a),q=p(size*.5,a+.5);
  s.tri(centre,l,t,pt=>pt===centre?base:tip);s.tri(centre,t,q,pt=>pt===centre?base:tip);}
 const e=size*.28;s.tri(...[0,120,240].map(a=>{const q=p(e,yaw+a*DEG);q[1]+=.008;return q;}),EYE);
}
// Ornamental grass: a fountain of slim arching blades, green at the base and straw-pale at the tips.
function grass(out,[x,y,z],r){
 const h=.45+r()*.3,n=11+(r()*4|0);
 for(let i=0;i<n;i++)out.push(orient(blade(h*(.7+r()*.4),.035,{segs:3,shape:SHAPES.lance,fold:.2,droop:.45,base:GREENS.dark,mid:0x8fae5a,tip:0xd9d39b}),[x,y,z],i/n*Math.PI*2+r()*.4,1.05+r()*.35,0));
}
// A small tree like the grove's (addGroveTrees): a slim trunk, three limbs and a faceted crown, `h` to its top.
function smallTree(out,{x,z,h},y0,r){
 out.push(paint(new T.CylinderGeometry(.15,.21,2.5,7).translate(x,y0+1.25,z),0xc39b70));
 const top=y0+h,palette=[GREENS.mid,GREENS.bright,GREENS.bright,GREENS.lime];
 for(let k=0;k<3;k++){const a=k/3*Math.PI*2+r(),c=Math.cos(a),s=Math.sin(a);out.push(stem([[x,y0+2.2,z],[x+c*.5,top-1.4,z+s*.5],[x+c*1,top-.85,z+s*1]],.075,0x6e4a31,4));}
 for(let k=0;k<8;k++){const a=k/8*Math.PI*2+r()*.5,d=k?.9+r()*.5:0,ht=top-.65-(d/1.5)**2*.55+r()*.3;clump(out,[x+Math.cos(a)*d,ht,z+Math.sin(a)*d],{r:.8+r()*.3,rnd:r,palette,squash:.62,leaves:3});}
}
// Two more small trees, each a few metres from a grove tree (-34,-27 and -66,-27), on the lawn beyond the path.
const NEW_TREES=[{x:-37.5,z:-30.5,h:4},{x:-62.5,z:-31,h:3.8}];
// The open lawn kept in the middle: park-wide's foreground, between the path and the boulevard. The cross route at
// x=-79 (src/plan/atrium-v2.js) stays open too.
const OPEN_LAWN=[-46.5,-36.5,-15,-6],CROSS_ROUTE=[-81,-77],PATH_HALF=1.2;

/** A drift: blooms over leafy mounds, scattered over a region by `sample` (which gives a point, or null to skip). */
function drift(out,s,sample,area,colour,r,ok){
 let blooms=0;
 for(let k=0;k<Math.round(area*2.2);k++){const q=sample();if(!q||!ok(q[0],q[1],.2))continue;clump(out,[q[0],q[2]+.1,q[1]],{r:.22+r()*.1,rnd:r,leaves:2,detail:0,squash:.72,palette:[GREENS.mid,GREENS.bright,GREENS.bright,GREENS.dark]});}
 for(let k=0;k<Math.round(area*16);k++){const q=sample();if(!q||!ok(q[0],q[1],.15))continue;
  bloom(s,[q[0],q[2]+.22+r()*.16,q[1]],.11+r()*.05,r()<.65?MEADOW_TONES[colour]:MEADOW_TONES[r()*3|0],r);blooms++;}
 return blooms;
}
function addFlowerMeadow(out,layout,blocked,trees){
 const y=layout.decks[5].y,floor=layout.decks[5].atrium.outline,r=random(7311),s=triangles(),[x0,x1,z0]=ATRIUM_ZONES.find(q=>q.id==='atrium6-park').bounds;
 // The path's centre line, from its outline's lower edge (phase6ParkPath samples x=-88..-4 every metre).
 const path=phase6ParkPath(),edge=path.slice(0,path.length/2),centre=x=>{const i=Math.max(0,Math.min(edge.length-2,Math.floor(x-edge[0][0]))),a=edge[i],b=edge[i+1];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])+PATH_HALF;};
 const onPath=(x,z,m)=>x>edge[0][0]-m&&x<edge.at(-1)[0]+m&&Math.abs(z-centre(x))<PATH_HALF+m;
 const ok=(x,z,m)=>x>x0&&x<x1&&z>z0&&z<-6.6&&contains(floor,[x,z])&&!onPath(x,z,m+.1)&&!(x>OPEN_LAWN[0]&&x<OPEN_LAWN[1]&&z>OPEN_LAWN[2]&&z<OPEN_LAWN[3])&&!(x>CROSS_ROUTE[0]&&x<CROSS_ROUTE[1])&&!blocked(x,z,m)&&NEW_TREES.every(t=>Math.hypot(t.x-x,t.z-z)>.5);
 let drifts=0,blooms=0,grasses=0;
 // Along both edges of the path: drifts 4-8 m long hugging the edge, grasses in the gaps between them.
 for(const side of[-1,1]){
  let x=edge[0][0]+.5+r()*2.5;
  while(x<edge.at(-1)[0]-1){
   const len=4+r()*4,depth=1.3+r()*1.1,from=x,colour=r()*3|0;
   const sample=()=>{const u=r()*2-1,px=from+(u+1)/2*len,v=r()*depth*Math.sqrt(1-u*u);return px<edge.at(-1)[0]?[px,centre(px)+side*(PATH_HALF+.3+v),y]:null;};
   blooms+=drift(out,s,sample,len*depth*Math.PI/4,colour,r,ok);drifts++;
   // A few grasses rising behind the flowers, along the drift's back edge.
   for(let g=from+1+r();g<from+len-1;g+=2.2+r()*1.2){const back=depth*Math.sqrt(1-((g-from)/len*2-1)**2)*.85,gz=centre(g)+side*(PATH_HALF+.3+back);if(ok(g,gz,.3)){grass(out,[g,y,gz],r);grasses++;}}
   x+=len;const gap=1.4+r()*2.4;
   for(let g=x+.8;g<x+gap-.5;g+=1.1+r()*.6){const gz=centre(g)+side*(PATH_HALF+.5+r()*.3);if(ok(g,gz,.3)){grass(out,[g,y,gz],r);grasses++;}}
   x+=gap;
  }
 }
 // Round each grove tree and the two new ones: a drift beside the trunk, off to one side.
 const grove=[...trees.filter(t=>t.x>x0&&t.x<x1&&t.z<-10&&t.z>-30),...NEW_TREES];
 for(const t of grove){const a=r()*Math.PI*2,cx=t.x+Math.cos(a)*1.4,cz=t.z+Math.sin(a)*1.4,ra=2+r()*.8,rb=1.1+r()*.4,turn=r()*Math.PI,colour=r()*3|0;
  const sample=()=>{const u=Math.sqrt(r()),w=r()*Math.PI*2,lx=Math.cos(w)*u*ra,lz=Math.sin(w)*u*rb,px=cx+lx*Math.cos(turn)-lz*Math.sin(turn),pz=cz+lx*Math.sin(turn)+lz*Math.cos(turn);return Math.hypot(px-t.x,pz-t.z)<.75?null:[px,pz,y];};
  blooms+=drift(out,s,sample,Math.PI*ra*rb,colour,r,ok);drifts++;}
 for(const t of NEW_TREES)smallTree(out,t,y,r);
 out.push(s.geometry());
 return {meadowDrifts:drifts,meadowBlooms:blooms,meadowGrasses:grasses,parkNewTrees:NEW_TREES.length};
}

/** G1 and G2 dressing for addAtriumGardens: `out` is the garden mesh, `glow` the lantern draw, `blocked(x,z,m)` its
 * ground test (fit-out parts and signature trunks), `parts` its fit-out footprints. */
export function addLobbyPark(out,glow,layout,blocked,parts){
 const trees=parts.filter(p=>p.part==='p6_tree_trunk');
 return {...addWelcomeCourt(out,glow,layout.decks[5].y),...addFlowerMeadow(out,layout,blocked,trees)};
}
