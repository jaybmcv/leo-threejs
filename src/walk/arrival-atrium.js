import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from '../assets/helvetiker-bold.json' with {type:'json'};
import {cutOut} from '../cut-out.js';
import {kittenFigure} from './kittens.js';

// The Deck 2 arrival hall, the first room every visitor sees, as a garden atrium (Jay's pick of three concepts,
// 2026-10-26). The middle of its ceiling opens in an oval into Hydroponic garden A on Deck 3, where a glass balustrade
// with a planter of trailing vines rings the opening under a grow-light panel. A climbing cat tree rises through it from
// a ring of seats on Deck 2; its top platform is level with the garden floor and a plank bridge runs from it through a
// gap in the balustrade, so the tree is a way up into the garden (and a quick way down). Round planters with seats
// facing out, timber shelves along the walls to hop along, lanterns, a warm timber floor and slatted ceiling and a
// WELCOME, VOYAGER sign on the end wall replace the rows of benches, the counter and the desk.
// Applied before the colliders are built (world.js prepareExteriorForWalking), so it is solid, sittable and checked.
// Room frame, shared by the hall and the garden above (both centred on x -115, z -38): x -26 (the entry) to 26 along the
// hall, z -17 (outboard) to 17; the hall's floor at 0 and its ceiling's underside at 3.3, the garden's floor at 4 and its
// ceiling's underside at 7.3. The garden's racks stand in rows from |z| 6.2 out, so the opening takes its central aisle
// and leaves a 1.7 m walk either side of the balustrade. Visitors arrive at x -20 looking down the hall.
const HALL='Area_d02-arrival-1',GARDEN='Area_d03-farm-1',CEILING=3.3,UPPER=4,TOP=7.3,WALL=16.84;
// The opening: its centre (toward the arrival end, so the tree is close when you come aboard) and half axes. The cut is
// the rectangle around it, `margin` wider, and the balustrade stands `rail` back from the edge.
export const ATRIUM={x:-4,a:9.5,b:4.1,margin:.6,rail:.35};
// The tree stands inboard of the hall's centre line, so the sign on the end wall shows past it from the arrival spot.
// Its platforms [angle around the trunk, cushion height] climb a quarter turn and about a metre at a time (a jump is
// 2.2 m), `reach` out from the trunk and clear of it and of one another; the last is level with the garden floor at the
// opening's edge, where the bridge goes. Every platform above 1.3 m is inside the opening, so a 2 m walker stands on it
// clear of the ceiling.
export const TREE={x:-2.5,z:2.2,reach:1.15,radius:.65,trunk:.42,planter:2,platforms:[[Math.PI,1.25],[-Math.PI/2,2.25],[0,3.2],[Math.PI/2,UPPER]]};
// Seating islands [x, z, planter radius]; each planter has seats all round, facing out, backed by its wall.
const ISLANDS=[[-13,-9.5,1.2],[-12.5,9.5,1.2],[13,-9.5,1.2],[13.5,9.5,1.2]];
// Wall shelves to hop along [side, [x, top]...] (side -1 outboard, 1 inboard): none above 1.3 m, where a 2 m walker
// still fits under the ceiling, and none in front of the painting (x -4.4..-0.6) or the ship log board (-13.5..-9.5).
const SHELVES=[[-1,[[-23,.5],[-20.8,.9],[-18.6,1.3],[-16.4,.9]]],[-1,[[6.5,.5],[8.7,.9],[10.9,1.3],[13.1,.9],[15.3,1.3],[17.5,.9]]],
 [1,[[-21.6,.5],[-19.4,.9],[-17.2,1.3]]],[1,[[5.5,.9],[7.7,1.3],[9.9,.9],[12.1,.5],[14.3,.9],[16.5,1.3]]]];
// Cat cubbies high on the walls [side, x], clear of the shelves below them.
const CUBBIES=[[-1,-14.2],[-1,4.5],[-1,19.6],[1,-15],[1,3.4],[1,18.6]];
// Potted plants [x, z, size] in the corners, beside the sign and between the shelves.
const POTS=[[-24.6,-15.6,1.1],[24.4,-15.6,1.2],[24.4,15.6,1.2],[24.6,-4.6,.9],[24.6,4.6,.9],[2.6,-15.9,.9],[-6.6,15.9,.9],[21.4,-15.9,.9],[20.6,15.9,.9]];
// In the garden, the racks either side of the opening [x, z] give way to beds of tall greenery that show from the hall.
const GARDEN_BEDS=[[-9,-7],[0,-7],[-9,7],[0,7]];
// Pillows, lanterns, branches, hanging baskets, the ceiling trellis and the vines' stems are dressing: no walker stops
// on them.
const DRESSING=new Set(['Atrium_pillow','Cat_tree_branch','Atrium_shelf_bracket','Atrium_basket','Atrium_trellis']);
// Where the room frame's origin is in the ship (the hall's floor; the garden's is 4 m up).
const ROOM={x:-115,y:-35.7,z:-38};

// A seeded random sequence, so the planting is the same on every visit.
function random(seed){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
// A point (room frame) on the opening's edge at angle t, `d` out along its normal; whether a point is in the
// balustrade's gap for the bridge.
function edgeAt(t,d=0){const {x:cx,a,b}=ATRIUM,c=Math.cos(t),s=Math.sin(t),nx=c/a,nz=s/b,l=Math.hypot(nx,nz);return [cx+a*c+nx/l*d,b*s+nz/l*d];}
const inGap=(x,z)=>z>0&&Math.abs(x-TREE.x)<.8;
// The tree's platform centres (room frame) with their cushion heights.
const platformAt=([t,y])=>[TREE.x+Math.cos(t)*TREE.reach,y,TREE.z+Math.sin(t)*TREE.reach];

// The opening on the Deck 3 ship map: deck-map.js draws floors from deck plans taken before the cut, so it asks here
// which ship points (x, z) are open, which of those are footing at the garden's level (the top platform and the
// bridge), and where the balustrade runs, as points `step` apart.
export function openingPlan(step=.25){
 const {x:cx,a,b,rail}=ATRIUM,[px,,pz]=platformAt(TREE.platforms.at(-1)),n=Math.ceil(2*Math.PI*Math.max(a,b)/step),rails=[];
 for(let i=0;i<n;i++){const [x,z]=edgeAt(i/n*Math.PI*2,rail);if(!inGap(x,z))rails.push([ROOM.x+x,ROOM.z+z]);}
 return {deck:3,rail:rails,
  open:(x,z)=>((x-ROOM.x-cx)/a)**2+((z-ROOM.z)/b)**2<1,
  footing:(x,z)=>{x-=ROOM.x;z-=ROOM.z;return Math.hypot(x-px,z-pz)<TREE.radius||Math.abs(x-TREE.x)<.6&&z>pz;},
  bounds:[ROOM.x+cx-a,ROOM.x+cx+a,ROOM.z-b,ROOM.z+b]};
}

export function openArrivalAtrium(ship){
 const hall=ship.inside.getObjectByName(HALL),garden=ship.inside.getObjectByName(GARDEN);if(!hall||!garden)return false;
 const fit=hall.getObjectByName('Room_fittings'),shell=hall.getObjectByName('Walls_and_ceiling');if(!fit||!shell)return false;
 const gardenFloor=garden.getObjectByName('Finished_floor')?.material;
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Atrium_'+name,color,roughness:.75,...o});
 const leafy=(name,color)=>mat(name,color,{roughness:.8,flatShading:true,side:T.DoubleSide});
 const M={floor:mat('floor',0xd2a876,{roughness:.55}),seam:mat('floor_seam',0xbd9263,{roughness:.6}),
  ceiling:mat('ceiling',0xcf9a60,{roughness:.7}),slat:mat('ceiling_slat',0xb98650,{roughness:.8}),
  wall:mat('wall',0xf1e9db,{roughness:.85}),trim:mat('trim',0xc28a52,{roughness:.6}),cap:mat('cap',0xf6f1e7,{roughness:.6,side:T.DoubleSide}),
  rim:mat('rim',0xc8925a,{roughness:.65,side:T.DoubleSide}),paw:mat('paw_print',0x7d5a3c,{roughness:.9}),gardenCeiling:mat('garden_ceiling',0xf0e2c6,{roughness:.85}),
  light:mat('light_strip',0xfff1d6,{emissive:0xffe2b0,emissiveIntensity:1}),cove:mat('cove_glow',0xfff0d0,{emissive:0xffd9a0,emissiveIntensity:1.1,side:T.DoubleSide}),
  sky:mat('skylight_glow',0xfff8e8,{emissive:0xfff1d4,emissiveIntensity:.95}),
  wood:mat('wood',0xc48b52,{roughness:.6}),dark:mat('wood_dark',0x8a5a33,{roughness:.6}),bark:mat('bark',0xb27a46,{roughness:.85}),
  planter:mat('planter',0xcb965d,{roughness:.65}),soil:mat('soil',0x4a3626,{roughness:1}),pot:mat('pot',0xe8ddcb,{roughness:.8}),
  sage:mat('cushion_sage',0xa8ba8e,{roughness:.95}),cream:mat('cushion_cream',0xefe5cf,{roughness:.95}),pillow:mat('pillow',0xdbe4c8,{roughness:.95}),
  rugSage:mat('rug_sage',0xb3c49c,{roughness:1}),rugCream:mat('rug_cream',0xebe2cb,{roughness:1}),
  glass:new T.MeshStandardMaterial({name:'Atrium_glass',color:0xd9eef0,roughness:.08,metalness:.1,transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide}),
  lamp:mat('lamp_glow',0xffe6b8,{emissive:0xffc978,emissiveIntensity:1.4}),frame:mat('lamp_frame',0x5b4330,{roughness:.6}),hole:mat('cubby_hole',0x3a2a1e,{roughness:1}),
  letters:mat('sign_lettering',0xfff4dc,{emissive:0xfff0d0,emissiveIntensity:.9}),
  leaves:[leafy('leaf_a',0x4f8f3f),leafy('leaf_b',0x3c7a34),leafy('leaf_c',0x6fa850),leafy('leaf_d',0x2f6a32)]};

 // The benches, counter, desk (with its resident and kit), aisle lines and identity panel go; the floor and the entry's
 // deck label stay. The shell keeps its walls, glazing and ceiling, refinished warm.
 const old=[];hall.traverse(o=>{if(o.isMesh&&o.parent!==shell&&o.name!=='Finished_floor'&&!(o.name==='Wayfinding_text'&&o.position.x<0))old.push(o);});
 for(const o of old){const p=o.parent;o.removeFromParent();if(p!==fit&&p!==hall&&!p.children.length)p.removeFromParent();}
 fit.getObjectByName('Finished_floor').material=M.floor;
 for(const o of shell.children)if(o.isMesh)o.material=o.name==='Ceiling'?M.ceiling:o.name==='Ceiling_light'?M.light:o.name==='Refined_wall_trim'?M.trim:
  /^(Side_wall|End_wall|Entry_wall|Entry_header|Wall_sill|Wall_header|Wall_pier)$/.test(o.name)?M.wall:o.material;

 // The opening: the hall's ceiling, the deck plate and the garden's floor cut back to a rectangle around the oval, which
 // a collar fills (garden floor on top, ceiling beneath, a timber rim between). The garden's ceiling strip over it gives
 // way to the grow-light panel.
 hall.updateWorldMatrix(true,false);const O=new T.Vector3().setFromMatrixPosition(hall.matrixWorld);
 const {x:cx,a,b,margin,rail}=ATRIUM,A=a+margin,B=b+margin;
 const region=(y0,y1)=>new T.Box3(new T.Vector3(O.x+cx-A,O.y+y0,O.z-B),new T.Vector3(O.x+cx+A,O.y+y1,O.z+B));
 cutOut(ship.inside,region(CEILING-.2,UPPER+.1));
 cutOut(ship.inside,region(TOP-.1,TOP-.005),o=>o.name==='Ceiling_light');

 const group=new T.Group();group.name='Arrival_garden_atrium';hall.add(group);
 const parts=new Map();
 const put=(name,material,g)=>{const k=name+'|'+material.name;let p=parts.get(k);if(!p)parts.set(k,p={name,material,list:[]});
  g=g.index?g.toNonIndexed():g;for(const n of Object.keys(g.attributes))if(!['position','normal','uv'].includes(n))g.deleteAttribute(n);p.list.push(g);return g;};
 const own=(name,material,g,at=[0,0,0])=>{const o=new T.Mesh(g,material);o.name=name;o.position.set(...at);group.add(o);return o;};
 const box=(w,h,d,x,y,z,ry=0)=>new T.BoxGeometry(w,h,d).rotateY(ry).translate(x,y,z);
 const cyl=(rt,rb,h,x,y,z,seg=16,open=false)=>new T.CylinderGeometry(rt,rb,h,seg,1,open).translate(x,y,z);
 const oval=(ra,rb,n=96)=>Array.from({length:n},(_,i)=>{const t=i/n*Math.PI*2;return new T.Vector2(ra*Math.cos(t),rb*Math.sin(t));});
 const collar=()=>{const s=new T.Shape([new T.Vector2(-A,-B),new T.Vector2(A,-B),new T.Vector2(A,B),new T.Vector2(-A,B)]);s.holes.push(new T.Path(oval(a,b)));return s;};
 // The oval's half width (in x) at z.
 const edge=edgeAt,halfWidth=z=>Math.abs(z)<b?a*Math.sqrt(1-z*z/(b*b)):0;
 own('Atrium_garden_floor',gardenFloor||M.cream,new T.ShapeGeometry(collar(),1).rotateX(-Math.PI/2).translate(cx,UPPER,0));
 own('Atrium_ceiling',M.ceiling,new T.ShapeGeometry(collar(),1).rotateX(Math.PI/2).translate(cx,CEILING,0));
 put('Atrium_rim',M.rim,cyl(1,1,UPPER-CEILING,0,(CEILING+UPPER)/2,0,96,true).scale(a,1,b).translate(cx,0,0));
 put('Atrium_cove_glow',M.cove,cyl(1,1,.06,0,CEILING+.03,0,96,true).scale(a-.01,1,b-.01).translate(cx,0,0));
 put('Atrium_skylight_glow',M.sky,new T.ShapeGeometry(new T.Shape(oval(a+.4,b+.4)),1).rotateX(Math.PI/2).translate(cx,TOP-.03,0));
 {const s=new T.Shape(oval(a+.6,b+.6));s.holes.push(new T.Path(oval(a+.4,b+.4)));put('Atrium_skylight_frame',M.cap,new T.ShapeGeometry(s,1).rotateX(Math.PI/2).translate(cx,TOP-.035,0));}

 // Leaves: a creased blade `len` long, tilted `tilt` from upright, arching over at the tip.
 function leaf(x,y,z,yaw,tilt,len,wid,material,droop=.3){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,len*.45,len*.08,-wid/2,len*.45,len*.12,0,len*.45,len*.08,wid/2,len,-len*droop,0],3));
  g.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);g.rotateZ(Math.PI/2-tilt).rotateY(-yaw).translate(x,y,z);
  const n=g.toNonIndexed();n.computeVertexNormals();n.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(n.attributes.position.count*2),2));put('Atrium_leaf',material,n);
 }
 const blob=(x,y,z,r,material,squash=.75)=>put('Atrium_foliage',material,new T.IcosahedronGeometry(r,0).scale(1,squash,1).translate(x,y,z));
 // A broad-leaved plant: a fan of blades and a bushy heart.
 function plant(x,y,z,size,seed){
  const r=random(seed),n=8+Math.floor(r()*5);
  for(let i=0;i<n;i++)leaf(x,y,z,i/n*Math.PI*2+r()*.5,.3+r()*.8,(.55+r()*.4)*size,.36*size,M.leaves[Math.floor(r()*4)]);
  blob(x,y+.12*size,z,.3*size,M.leaves[Math.floor(r()*4)]);
 }

 // Seating islands: a timber planter, seats all the way round facing out, backed by the planter wall.
 const annulus=(r0,r1,h)=>{const s=new T.Shape().absarc(0,0,r1,0,Math.PI*2,false);s.holes.push(new T.Path().absarc(0,0,r0,0,Math.PI*2,true));
  return new T.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:40}).rotateX(-Math.PI/2);};
 function island(x,z,R,seed,{lush=true}={}){
  put('Atrium_planter',M.planter,cyl(R,R,.85,x,.425,z,32));
  put('Atrium_planter_rim',M.cap,annulus(R-.08,R+.03,.05).translate(x,.85,z));
  put('Atrium_soil',M.soil,cyl(R-.08,R-.08,.02,x,.8,z,24));
  put('Atrium_seat_base',M.wood,annulus(R+.14,R+.74,.3).translate(x,0,z));
  own('Atrium_curved_seat',M.cream,annulus(R+.14,R+.74,.15).translate(0,.3,0),[x,0,z]);
  own('Atrium_curved_back',M.sage,annulus(R,R+.14,.4).translate(0,.45,0),[x,0,z]);
  const r=random(seed);
  for(let i=0;i<4;i++){const t=i/4*Math.PI*2+r(),p=box(.42,.36,.14,0,0,0).rotateX(-.25).rotateY(Math.PI/2-t).translate(x+Math.cos(t)*(R+.26),.66,z+Math.sin(t)*(R+.26));put('Atrium_pillow',M.pillow,p);}
  if(lush){plant(x,.8,z,2,seed);for(let i=0;i<6;i++){const t=i/6*Math.PI*2+r(),d=R*.6;plant(x+Math.cos(t)*d,.8,z+Math.sin(t)*d,1.1+r()*.4,seed*7+i);}
   for(let i=0;i<2;i++){const t=r()*Math.PI*2;lantern(x+Math.cos(t)*(R-.3),.8,z+Math.sin(t)*(R-.3),.8);}}
 }
 function lantern(x,y,z,s=1){
  put('Atrium_lamp_frame',M.frame,box(.2*s,.03*s,.2*s,x,y+.015*s,z));put('Atrium_lamp_frame',M.frame,box(.22*s,.03*s,.22*s,x,y+.3*s,z));
  put('Atrium_lamp_frame',M.frame,cyl(.02*s,.02*s,.1*s,x,y+.36*s,z,6));put('Atrium_lamp_glow',M.lamp,cyl(.08*s,.08*s,.26*s,x,y+.16*s,z,8));
 }
 ISLANDS.forEach(([x,z,R],i)=>{island(x,z,R,11+i*37);
  // A drum side table with a lantern, toward the hall's centre.
  const tx=x-Math.sign(x)*2.7,tz=z-Math.sign(z)*1.6;put('Atrium_side_table',M.wood,cyl(.34,.3,.5,tx,.25,tz,20));put('Atrium_side_table',M.cream,cyl(.36,.36,.04,tx,.52,tz,20));lantern(tx,.54,tz);});

 // The cat tree: its planter ringed with seats, a trunk to the garden's ceiling, the platforms with their branches and
 // lanterns, the bridge to the garden and a canopy up in the opening.
 island(TREE.x,TREE.z,TREE.planter,5,{lush:false});
 // Low planting round the trunk, kept out from under the first platform (toward -x, 1.25 m up).
 {const r=random(3);[-2.4,-1.6,-.8,0,.8,1.6,2.2].forEach((t,i)=>{const d=1.45+r()*.3;plant(TREE.x+Math.cos(t)*d,.8,TREE.z+Math.sin(t)*d,.55+r()*.1,90+i);});}
 const trunk=new T.CatmullRomCurve3([[0,.7,0],[.03,2.2,-.02],[-.02,3.8,.03],[.02,5.4,-.02],[0,6.9,0]].map(([x,y,z])=>new T.Vector3(TREE.x+x,y,TREE.z+z)));
 put('Cat_tree_trunk',M.bark,new T.TubeGeometry(trunk,24,TREE.trunk,12,false));
 put('Cat_tree_trunk',M.bark,cyl(TREE.trunk,.8,.55,TREE.x,1.05,TREE.z,12));
 const branch=(p0,p1,p2,r=.09)=>put('Cat_tree_branch',M.bark,new T.TubeGeometry(new T.QuadraticBezierCurve3(new T.Vector3(...p0),new T.Vector3(...p1),new T.Vector3(...p2)),8,r,6,false));
 TREE.platforms.forEach(([t,y],i)=>{
  const c=Math.cos(t),s=Math.sin(t),x=TREE.x+c*TREE.reach,z=TREE.z+s*TREE.reach;
  put('Cat_tree_platform',M.wood,cyl(TREE.radius,TREE.radius,.12,x,y-.12,z,24));
  put('Cat_tree_platform',M.sage,cyl(TREE.radius-.07,TREE.radius-.07,.06,x,y-.03,z,24));
  branch([TREE.x+c*.3,y-.8,TREE.z+s*.3],[TREE.x+c*.7,y-.45,TREE.z+s*.7],[x,y-.2,z]);
  if(i<3)lantern(x+c*.5,y,z+s*.5,.8);
 });
 // The bridge: the top platform out to the opening's edge, flush with the garden floor (2 mm under it where they meet).
 {const [,y]=TREE.platforms.at(-1),z0=TREE.z+TREE.reach+.45,x=Math.min(Math.abs(TREE.x-cx-.6),Math.abs(TREE.x-cx+.6)),z1=b*Math.sqrt(1-x*x/(a*a))+.03;
  put('Cat_tree_bridge',M.wood,box(1.2,.08,z1-z0,TREE.x,y-.042,(z0+z1)/2));
  for(const dx of [-.3,0,.3])put('Cat_tree_bridge_seam',M.dark,box(.015,.004,z1-z0,TREE.x+dx,y-.001,(z0+z1)/2));
  branch([TREE.x,y-1.2,TREE.z+.3],[TREE.x,y-.5,z0],[TREE.x,y-.12,(z0+z1)/2],.08);}
 // The canopy: limbs spreading at the garden's head height, clumps of foliage along them and fans of leaves spilling out.
 {const r=random(7);
  for(let i=0;i<6;i++){const t=i/6*Math.PI*2+.4,d=1.4+r()*.6,ex=TREE.x+Math.cos(t)*d,ez=TREE.z+Math.sin(t)*d,ey=6.3+r()*.5;
   branch([TREE.x,5.1+r()*.4,TREE.z],[TREE.x+Math.cos(t)*.5,5.9,TREE.z+Math.sin(t)*.5],[ex,ey,ez],.08);
   for(let k=0;k<4;k++){const f=.45+k*.2;blob(TREE.x+(ex-TREE.x)*f+(r()-.5)*.4,6.15+(ey-6.15)*f+r()*.4,TREE.z+(ez-TREE.z)*f+(r()-.5)*.4,.32+r()*.22,M.leaves[Math.floor(r()*4)],.7);}
   for(let k=0;k<5;k++)leaf(ex,ey+.05,ez,t+(r()-.5)*1.6,.9+r()*.8,.7+r()*.4,.3,M.leaves[Math.floor(r()*4)],.4);}
  for(let i=0;i<8;i++){const t=r()*Math.PI*2,d=r()*.7;blob(TREE.x+Math.cos(t)*d,6.75+r()*.35,TREE.z+Math.sin(t)*d,.38+r()*.2,M.leaves[Math.floor(r()*4)],.7);}}

 // Up in the garden: the balustrade (glass between posts under a timber cap) and, between it and the edge, a trough of
 // greenery with vines trailing down into the hall; both open for the bridge.
 const gap=inGap,N=80;
 for(let i=0;i<N;i++){
  const t0=i/N*Math.PI*2,t1=(i+1)/N*Math.PI*2,[x0,z0]=edge(t0,rail),[x1,z1]=edge(t1,rail),mx=(x0+x1)/2,mz=(z0+z1)/2;
  const [u0,w0]=edge(t0,.17),[u1,w1]=edge(t1,.17);
  if(gap(mx,mz)){if(!gap(x0,z0))put('Atrium_rail_post',M.dark,cyl(.03,.03,1,x0,UPPER+.5,z0,8));if(!gap(x1,z1))put('Atrium_rail_post',M.dark,cyl(.03,.03,1,x1,UPPER+.5,z1,8));continue;}
  const len=Math.hypot(x1-x0,z1-z0),yaw=-Math.atan2(z1-z0,x1-x0);
  put('Atrium_glass_rail',M.glass,box(len-.03,.9,.02,mx,UPPER+.5,mz,yaw));
  put('Atrium_rail_cap',M.wood,box(len+.01,.05,.09,mx,UPPER+.98,mz,yaw));
  put('Atrium_rail_post',M.dark,cyl(.025,.025,.95,x0,UPPER+.475,z0,8));
  put('Atrium_trough',M.planter,box(Math.hypot(u1-u0,w1-w0)+.02,.3,.24,(u0+u1)/2,UPPER+.15,(w0+w1)/2,-Math.atan2(w1-w0,u1-u0)));
  // Its planting spills over the edge: a clump, and blades leaning out over the opening.
  const ux=(u0+u1)/2,wz=(w0+w1)/2,out=Math.atan2(-((w0+w1)/2)/(b*b),-((u0+u1)/2-cx)/(a*a));
  blob(ux,UPPER+.38,wz,.22+(i%3)*.05,M.leaves[i%4],.65);
  for(let k=0;k<3;k++)leaf(ux,UPPER+.3,wz,out+(k-1)*.6,1.3+k*.25,.55+(i*7+k)%4*.08,.24,M.leaves[(i+k)%4],.45);
 }
 {const r=random(21);
  for(let i=0;i<110;i++){const t=i/110*Math.PI*2+r()*.02,[x,z]=edge(t,-.05);if(gap(x,z)||r()<.22)continue;
   const top=UPPER+.28,length=.9+r()*1.5,n=Math.floor(length/.15),m=M.leaves[Math.floor(r()*4)];
   put('Atrium_vine_foliage',M.leaves[1],box(.012,length,.012,x,top-length/2,z));
   for(let j=0;j<n;j++)leaf(x+(r()-.5)*.08,top-j*.15-r()*.05,z+(r()-.5)*.08,r()*Math.PI*2,1.1+r()*.7,.17,.1,m,.15);}}

 // So that looking up from the hall shows a garden, not a ceiling: the racks beside the opening (and their grow lights)
 // give way to timber beds of small trees and broad-leaved plants that stand over the balustrade, and baskets of trailing
 // greenery hang from the garden's ceiling round the grow-light panel, above head height.
 garden.updateWorldMatrix(true,true);
 const racks=[];garden.traverse(o=>{if(o.name!=='Hydroponic_rack')return;const c=new T.Box3().setFromObject(o).getCenter(new T.Vector3());
  if(GARDEN_BEDS.some(([x,z])=>Math.abs(c.x-O.x-x)<1&&Math.abs(c.z-O.z-z)<1))racks.push(o);});
 for(const o of racks)o.removeFromParent();
 GARDEN_BEDS.forEach(([x,z],i)=>{
  cutOut(ship.inside,new T.Box3(new T.Vector3(O.x+x-2.7,O.y+UPPER,O.z+z-1),new T.Vector3(O.x+x+2.7,O.y+TOP-.05,O.z+z+1)),o=>o.name==='Refined_grow_lighting');
  put('Atrium_garden_bed',M.planter,box(5,.6,1.6,x,UPPER+.3,z));put('Atrium_soil',M.soil,box(4.8,.02,1.4,x,UPPER+.6,z));
  const r=random(300+i);
  for(const dx of [-1.4,1.4]){const tx=x+dx+(r()-.5)*.3,tz=z+(r()-.5)*.3,h=1.7+r()*.4;
   put('Atrium_garden_tree',M.bark,cyl(.07,.11,h,tx,UPPER+.6+h/2,tz,8));
   for(let k=0;k<7;k++){const t=r()*Math.PI*2,d=r()*.65;blob(tx+Math.cos(t)*d,UPPER+.3+h+r()*.35,tz+Math.sin(t)*d,.32+r()*.2,M.leaves[Math.floor(r()*4)],.75);}}
  for(const dx of [-2,0,2])plant(x+dx,UPPER+.6,z,1.3+r()*.4,320+i*5+dx);
 });
 // A leafy timber trellis on the garden's ceiling round the grow-light panel, reaching further at the ends of the oval,
 // where no light strip runs (the strips are at |z| 0, 6 and 12; the middle one gives way to it), and a warmer garden
 // ceiling: from the hall, the view up past the panel is far enough to show a wide band of it.
 {const r=random(57),inner=[.65,.65],outer=[3.2,1.7],at=(t,f)=>{const ra=a+inner[0]+(outer[0]-inner[0])*f,rb=b+inner[1]+(outer[1]-inner[1])*f;return [cx+ra*Math.cos(t),rb*Math.sin(t)];};
  const ceiling=garden.getObjectByName('Walls_and_ceiling')?.getObjectByName('Ceiling');if(ceiling)ceiling.material=M.gardenCeiling;
  cutOut(ship.inside,new T.Box3(new T.Vector3(O.x+cx-a-outer[0]-.2,O.y+TOP-.1,O.z-.3),new T.Vector3(O.x+cx+a+outer[0]+.2,O.y+TOP-.005,O.z+.3)),o=>o.name==='Ceiling_light');
  const slat=([x0,z0],[x1,z1])=>put('Atrium_trellis',M.wood,box(Math.hypot(x1-x0,z1-z0)+.04,.05,.06,(x0+x1)/2,TOP-.08,(z0+z1)/2,-Math.atan2(z1-z0,x1-x0)));
  for(let i=0;i<96;i++)for(const f of [0,.5,1])slat(at(i/96*Math.PI*2,f),at((i+1)/96*Math.PI*2,f));
  for(let i=0;i<64;i++){const t=i/64*Math.PI*2;slat(at(t,0),at(t,1));}
  for(let i=0;i<240;i++){const [x,z]=at(r()*Math.PI*2,r());blob(x,TOP-.16-r()*.12,z,.2+r()*.16,M.leaves[Math.floor(r()*4)],.5);}
  for(let i=0;i<70;i++){const [x,z]=at(r()*Math.PI*2,r()),m=M.leaves[Math.floor(r()*4)],length=.25+r()*.55;
   for(let j=0;j*.13<length;j++)leaf(x+(r()-.5)*.06,TOP-.2-j*.13,z+(r()-.5)*.06,r()*Math.PI*2,1.3+r()*.5,.16,.09,m,.15);}}
 {const r=random(41);
  for(let i=0;i<16;i++){const [x,z]=edgeAt(i/16*Math.PI*2+.1,.9);if(inGap(x,z))continue;const y=6.35;
   put('Atrium_basket',M.wood,cyl(.26,.18,.22,x,y,z,10));
   for(let k=0;k<3;k++){const t=k/3*Math.PI*2;put('Atrium_basket',M.frame,new T.CylinderGeometry(.006,.006,TOP-y-.1,4).translate(0,(TOP-y-.1)/2,0).rotateZ(.12).rotateY(-t).translate(x+Math.cos(t)*.22,y+.1,z+Math.sin(t)*.22));}
   blob(x,y+.12,z,.24,M.leaves[i%4],.6);
   for(let k=0;k<6;k++){const t=k/6*Math.PI*2+r(),length=.4+r()*.5,m=M.leaves[(i+k)%4];
    for(let j=0;j*.13<length;j++)leaf(x+Math.cos(t)*.2,y-.05-j*.13,z+Math.sin(t)*.2,t+(r()-.5),1.3+r()*.5,.16,.09,m,.15);}}}

 // The floor: timber boards along the hall and a round rug about the tree. The ceiling: timber slats, broken by the opening.
 for(let z=-16.5;z<=16.51;z+=.6)put('Atrium_floor_seam',M.seam,box(51.7,.003,.025,0,.0015,z));
 [[2.95,3.6,M.rugCream],[3.6,3.95,M.rugSage],[3.95,5.05,M.rugCream],[5.05,5.5,M.rugSage]].forEach(([r0,r1,m],i)=>
  put('Atrium_rug_inlay',m,new T.RingGeometry(r0,r1,72).rotateX(-Math.PI/2).translate(TREE.x,.005+i*.0005,TREE.z)));
 for(let z=-16.65;z<=16.66;z+=.45){const w=halfWidth(z),y=CEILING-.004;
  if(!w)put('Atrium_ceiling_seam',M.slat,box(51.7,.006,.035,0,y,z));
  else for(const [x0,x1] of [[-25.85,cx-w-.05],[cx+w+.05,25.85]])put('Atrium_ceiling_seam',M.slat,box(x1-x0,.006,.035,(x0+x1)/2,y,z));}

 // Shelves to hop along, cubbies above, and potted plants.
 for(const [s,run] of SHELVES)for(const [x,y] of run){put('Atrium_cat_shelf',M.wood,box(1.8,.08,.75,x,y-.04,s*(WALL-.375)));
  for(const dx of [-.6,.6])put('Atrium_shelf_bracket',M.dark,box(.05,.3,.45,x+dx,y-.23,s*(WALL-.25)));}
 for(const [s,x] of CUBBIES){const z=s*(WALL-.3);put('Atrium_cat_cubby',M.wood,box(.8,.65,.6,x,2.5,z));put('Atrium_cat_shelf',M.wood,box(1.2,.06,.66,x,2.14,s*(WALL-.33)));
  put('Atrium_cubby_hole_inlay',M.hole,new T.CircleGeometry(.2,16).rotateY(s>0?Math.PI:0).translate(x,2.48,z-s*.301));}
 POTS.forEach(([x,z,s],i)=>{put('Atrium_pot',M.pot,cyl(.38*s,.3*s,.55*s,x,.275*s,z,16));put('Atrium_soil',M.soil,cyl(.34*s,.34*s,.02,x,.54*s,z,12));plant(x,.54*s,z,1.25*s,200+i);});

 // WELCOME, VOYAGER on a timber board hung on the end wall, where the room's identity panel was.
 {const g=new TextGeometry('WELCOME, VOYAGER',{font:new FontLoader().parse(fontData),size:.5,depth:.012,curveSegments:3});g.computeBoundingBox();const tb=g.boundingBox;
  put('Atrium_sign_lettering',M.letters,g.translate(-(tb.min.x+tb.max.x)/2,-(tb.min.y+tb.max.y)/2,0).rotateY(-Math.PI/2).translate(25.73,2.55,0));
  put('Atrium_welcome_sign',M.dark,box(.08,1.05,7.6,25.78,2.55,0));
  for(const z of [-3.2,3.2])put('Atrium_welcome_sign',M.frame,cyl(.015,.015,.24,25.78,3.18,z,6));}

 // The way up, for anyone new: a trail of paw prints from where visitors arrive to the foot of the tree, a pair on each
 // platform pointing to the next, more over the bridge into the garden, and a signpost by the tree.
 // A print: a main pad and four toe beans, toes toward yaw (the direction (cos, sin)).
 function paw(x,y,z,yaw,s=1){
  const f=[Math.cos(yaw),Math.sin(yaw)],r=[-f[1],f[0]],at=(u,v)=>[x+f[0]*u+r[0]*v,z+f[1]*u+r[1]*v];
  const disc=(rad,[px,pz],wide=1)=>put('Atrium_paw_decal',M.paw,new T.CircleGeometry(rad,12).scale(1,wide,1).rotateX(-Math.PI/2).rotateY(-yaw).translate(px,y,pz));
  disc(.06*s,at(0,0),1.15);
  for(const [u,v] of [[.075,-.065],[.1,-.022],[.1,.022],[.075,.065]])disc(.025*s,at(u*s,v*s));
 }
 const trail=(from,to,y,step=.42)=>{const dx=to[0]-from[0],dz=to[1]-from[1],len=Math.hypot(dx,dz),yaw=Math.atan2(dz,dx),n=Math.max(1,Math.round(len/step));
  for(let i=0;i<=n;i++){const t=i/n,side=i%2?.09:-.09;paw(from[0]+dx*t-Math.sin(yaw)*side,y,from[1]+dz*t+Math.cos(yaw)*side,yaw);}};
 {const pts=[[-18.2,.2],[-14,.9],[-10,1.9],[-6.1,2.2]];for(let i=0;i+1<pts.length;i++)trail(pts[i],pts[i+1],.008);
  const P=TREE.platforms.map(platformAt);
  P.forEach(([x,y,z],i)=>{const [nx,,nz]=i+1<P.length?P[i+1]:[x,y,z+1],yaw=Math.atan2(nz-z,nx-x),c=Math.cos(yaw),s=Math.sin(yaw);
   for(const [u,v] of [[-.1,-.09],[.12,.09]])paw(x+c*u-s*v,y+.003,z+s*u+c*v,yaw);});
  const [bx,by,bz]=P.at(-1);trail([bx,bz+.75],[bx,bz+2.5],by+.003,.38);}
 {const t=Math.PI+.75,x=TREE.x+Math.cos(t)*3.1,z=TREE.z+Math.sin(t)*3.1,font=new FontLoader().parse(fontData);
  put('Atrium_climb_sign',M.dark,cyl(.04,.04,1.6,x,.8,z,8));put('Atrium_climb_sign',M.dark,box(.05,.5,1.05,x-.05,1.35,z));
  [['CLIMB TO',1.43],['THE GARDEN',1.25]].forEach(([line,y])=>{const g=new TextGeometry(line,{font,size:.1,depth:.006,curveSegments:2});g.computeBoundingBox();
   put('Atrium_sign_lettering',M.letters,g.translate(-g.boundingBox.min.x,-(g.boundingBox.min.y+g.boundingBox.max.y)/2,0).rotateY(-Math.PI/2).translate(x-.08,y,z-.17));});
  const arrow=new T.Shape([[0,.13],[.09,.03],[.032,.03],[.032,-.12],[-.032,-.12],[-.032,.03],[-.09,.03]].map(([u,v])=>new T.Vector2(u,v)));
  put('Atrium_sign_lettering',M.letters,new T.ShapeGeometry(arrow).rotateY(-Math.PI/2).translate(x-.08,1.34,z-.33));}

 for(const {name,material,list} of parts.values()){const o=own(name,material,mergeGeometries(list));if(DRESSING.has(name))o.userData.noCollide=true;}
 return true;
}

// Kittens on the cat tree, dressed from the Cosmo kit by the walk page (kittens.js): one on each of the upper three
// platforms, looking out over the hall, at the edge away from where a climber lands and takes off (the second's and
// third's lanterns stand nearby). Dressing only: they don't collide.
export function createAtriumKittens(ship,kit){
 const hall=ship.root.getObjectByName(HALL);if(!hall||!kit)return null;
 hall.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Arrival_atrium_kittens';hall.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 // [platform, angle from its centre (world plan, x toward the hall's end), pose, look]
 for(const [i,t,pose,look] of [[1,-Math.PI/2+.6,'sit',2],[2,-.6,'pounce',1],[3,Math.PI,'sit',3]]){
  const [x,y,z]=platformAt(TREE.platforms[i]),g=kittenFigure(kit,pose,look);
  g.position.set(x+Math.cos(t)*.4,y,z+Math.sin(t)*.4);g.rotation.y=Math.atan2(Math.cos(t),Math.sin(t));group.add(g);
 }
 return group;
}
