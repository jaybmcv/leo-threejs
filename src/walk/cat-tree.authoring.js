import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {seeded} from '../polish-kit.js';

// The Great Cat Tree in the bow of the atrium (Toybox design, concepts/atrium-nose-2026-11): a 39 m cat tree on a mossy
// island forward of the Voyage Commons. A carpeted ramp winds up round its sisal trunk, 135 degrees per deck, to a plush
// landing platform at every deck from 7 to 14 and a ring round the trunk at Deck 15; rope bridges run forward along the
// centre line from the Deck 9 and 12 platforms and the Deck 15 ring to those decks' bow cafes. The canopy is stitched
// felt leaves in four tiers, each fitted inside the stepped opening of Decks 13-15 under the Deck 16 slab that closes the
// nose. Cushions and hammock pods are seats and beds; toys dangle on cords, paper lanterns glow.
// The tree builds its own geometry in every mode, so it never depends on templates captured by a prepared ship.
// Ship coordinates throughout (x forward, y up, z starboard), the same as the v2 layout.
export const TREE={x:187.5,z:0,floor:-19.7,island:13,islandTop:-19.45,top:19.2};
const deckY=n=>TREE.floor+4*(n-6);
// Ramp: s runs 0 at the island to 9 at Deck 15; each deck is 135 degrees, level for 20 degrees either side of it.
const STEP=Math.PI*.75,LAND=20/135,PHI0=-Math.PI*.375,RAMP_W=2.7,GUARD=1.15;
const level=k=>k===0?TREE.islandTop:deckY(6+k);
// The boardwalk runs straight in to the ramp's foot along its tangent, from 2 m inside the island's edge.
const WALK=(()=>{const a=-Math.PI*.375,t={x:-Math.sin(a),z:Math.cos(a)},r=4.6+.05+2.7/2,m={x:TREE.x+Math.cos(a)*r,z:TREE.z+Math.sin(a)*r},L=TREE.island-2;return {t,end:m,start:{x:m.x-t.x*L,z:m.z-t.z*L},len:L};})();
const offWalk=(x,z,pad)=>{const u=Math.max(0,Math.min(WALK.len,(x-WALK.start.x)*WALK.t.x+(z-WALK.start.z)*WALK.t.z)),px=WALK.start.x+WALK.t.x*u,pz=WALK.start.z+WALK.t.z*u;return Math.hypot(x-px,z-pz)>1.3+pad;};
export function rampY(s){const k=Math.min(8,Math.floor(s)),u=s-k;return level(k)+(level(k+1)-level(k))*Math.min(1,Math.max(0,(u-LAND)/(1-2*LAND)));}
const rampAngle=s=>PHI0+s*STEP;
// Trunk radius by height: a straight 4.6 m to 5 m up, tapering to 2.6 m at Deck 15 and 2 m at the top.
export function trunkR(y){const h=y-TREE.floor;return h<5?4.6:h<36?4.5-1.9*(h-5)/31:2.6-.6*Math.min(1,(h-36)/3.2);}
const rampIn=y=>trunkR(y)+.05,rampOut=y=>rampIn(y)+RAMP_W;
// Landing platforms touch the ramp's outer edge with 1 m of overlap; the ring at Deck 15 reaches 8 m round the trunk.
const RADII={7:6,8:5.5,9:6,10:5.5,11:6,12:5.5,13:5.5,14:5};
export const PLATFORMS=Object.entries(RADII).map(([n,r])=>{n=+n;const y=deckY(n),a=rampAngle(n-6),d=rampOut(y)-1+r;return {deck:n,y,r,angle:a,x:TREE.x+Math.cos(a)*d,z:TREE.z+Math.sin(a)*d};});
export const RING={deck:15,y:deckY(15),inner:trunkR(deckY(15))-.05,outer:8,angle:rampAngle(9)};
// The ring is open over the ramp's last approach, from 90 degrees before its landing.
const HOLE=[RING.angle-Math.PI/2,RING.angle];
// Bridges along the centre line to the bow cafes' aft faces (their slab edges are at x 224.5, 211 and 197).
export const BRIDGES=[{deck:9,x1:224.8},{deck:12,x1:211.3},{deck:15,x1:197.3}].map(b=>{const y=deckY(b.deck),p=PLATFORMS.find(p=>p.deck===b.deck);
 const w=2.4,x0=p?p.x+Math.sqrt(p.r*p.r-(Math.abs(p.z)+w/2)**2)-.3:TREE.x+RING.outer-.3;return {...b,y,x0,width:w,disc:p};});
// Canopy tiers [y0,y1,radius], and the openings above: leaves stay inside each slab's opening and under the Deck 16 slab.
// The top tier is a low leafy roof over the Deck 15 ring, 2.2 m clear above it and under the Deck 16 slab.
const CANOPY=[[1,8,20],[8,12.3,16],[12.3,16.3,11],[18.6,19.6,9.5]];
const OPENINGS=[{y:deckY(13),z:30,x:206},{y:deckY(14),z:20,x:201},{y:deckY(15),z:10,x:197},{y:deckY(16),z:0,x:148}];

const C={felt:0x9a6a44,feltDark:0x7a5236,sisal:0xd9b98a,rope:0xefe2c4,carpet:[0xc8553d,0xe0a93b,0x9bb07f,0xf1e3c8],wood:0xa8743f,
 wicker:0xd2a86a,moss:0x7a9a4a,mossDark:0x5e7f38,leaf:[0x6f9a3c,0x557f2e,0x85ab4a],toy:[0xe86a7a,0xf2b84b,0x6fb5d6,0xb07ad0,0xf08a4b],cream:0xf6ead2,ink:0x3a2a1e};

// ---- geometry helpers: every part ends non-indexed with position, normal and colour, so one merge per material works
function paint(g,color,vary=0,rnd=null){g=g.index?g.toNonIndexed():g;g.deleteAttribute('uv');const n=g.attributes.position.count,c=new Float32Array(n*3),base=new T.Color(color);
 for(let i=0;i<n;i+=3){const k=vary&&rnd?1+(rnd()-.5)*vary:1;for(let j=0;j<3;j++){c[(i+j)*3]=base.r*k;c[(i+j)*3+1]=base.g*k;c[(i+j)*3+2]=base.b*k;}}
 g.setAttribute('color',new T.BufferAttribute(c,3));if(!g.attributes.normal)g.computeVertexNormals();return g;}
// Sisal: pale and dark stripes round the wrap, by height.
function sisal(g,freq=9){g=paint(g,C.sisal);const p=g.attributes.position,c=g.attributes.color;for(let i=0;i<p.count;i++){const k=.86+.14*Math.sign(Math.sin(p.getY(i)*freq));c.setXYZ(i,c.getX(i)*k,c.getY(i)*k,c.getZ(i)*k);}return g;}
const at=(g,x,y,z)=>g.translate(x,y,z);
function between(a,b,r0,r1=r0,seg=8){const d=new T.Vector3().subVectors(b,a),g=new T.CylinderGeometry(r1,r0,d.length(),seg,1,false);g.translate(0,d.length()/2,0);
 g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()));return g.translate(a.x,a.y,a.z);}
function tube(points,r,seg=48,radial=6){return new T.TubeGeometry(new T.CatmullRomCurve3(points),seg,r,radial,false);}
// A wall of thin boxes along a polyline: guard colliders, about 1 m a box.
function wall(points,y0,h,t=.12){const out=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.01)continue;
 const g=new T.BoxGeometry(len+t,h,t);g.rotateY(-Math.atan2(dz,dx));out.push(at(g,(a.x+b.x)/2,((a.y??y0)+(b.y??y0))/2+h/2,(a.z+b.z)/2));}return out;}
// Merge after dropping any attribute not every geometry has (colliders keep only positions).
function merge(gs,only=null){if(!gs.length)return null;gs=gs.map(g=>g.index?g.toNonIndexed():g);const keep=only||Object.keys(gs[0].attributes).filter(k=>gs.every(g=>g.attributes[k]));
 for(const g of gs)for(const k of Object.keys(g.attributes))if(!keep.includes(k))g.deleteAttribute(k);return mergeGeometries(gs);}
function named(parent,name,gs,material,only){const g=merge(gs,only);if(!g)return null;const m=new T.Mesh(g,material);m.name=name;parent.add(m);return m;}

// A polar strip from angle a0 to a1 with inner and outer radii and a top height, each a function of the parameter; used
// for the ramp (top, outer side, inner side and underside) and the ring.
function strip(n,f,thick){const P=[],add=(...v)=>P.push(...v);
 for(let i=0;i<n;i++){const A=f(i/n),B=f((i+1)/n),q=(o,r,y)=>[TREE.x+Math.cos(o.a)*r,y,TREE.z+Math.sin(o.a)*r];
  const a=[q(A,A.ri,A.y),q(A,A.ro,A.y),q(A,A.ri,A.y-thick),q(A,A.ro,A.y-thick)],b=[q(B,B.ri,B.y),q(B,B.ro,B.y),q(B,B.ri,B.y-thick),q(B,B.ro,B.y-thick)];
  const quad=(p,r,s,t)=>add(...p,...r,...s,...p,...s,...t);
  quad(a[0],b[0],b[1],a[1]);quad(a[1],b[1],b[3],a[3]);quad(a[2],b[2],b[0],a[0]);quad(a[3],b[3],b[2],a[2]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.computeVertexNormals();return g;}

// ---- clearance: where people walk, nothing grows (leaves, toys, cords)
function clearOf(){
 const ramp=[];for(let s=0;s<=9;s+=1/40){const y=rampY(s),a=rampAngle(s),r=(rampIn(y)+rampOut(y))/2;ramp.push([TREE.x+Math.cos(a)*r,y,TREE.z+Math.sin(a)*r]);}
 return (x,y,z,pad,vpad=pad)=>{
  for(const [px,py,pz] of ramp)if(Math.hypot(x-px,z-pz)<RAMP_W/2+pad+.4&&y>py-.6-pad&&y<py+2.8+pad)return false;
  for(const p of PLATFORMS)if(Math.hypot(x-p.x,z-p.z)<p.r+pad&&y>p.y-.7-vpad&&y<p.y+2.9+vpad)return false;
  {const r=Math.hypot(x-TREE.x,z-TREE.z);if(r<RING.outer+pad&&y>RING.y-.7-vpad&&y<RING.y+2.2+vpad)return false;}
  for(const b of BRIDGES)if(x>b.x0-pad&&x<b.x1+pad&&Math.abs(z)<b.width/2+pad+.3&&y>b.y-.6-pad&&y<b.y+2.8+pad)return false;
  return true;};
}
// Inside the stepped opening and under the Deck 16 slab, with `pad` metres to spare.
const inOpening=(x,y,z,top,pad)=>OPENINGS.every(o=>top<o.y-.5||(Math.abs(z)<o.z-pad&&x<o.x-pad));

export function createCatTree(ship){
 if(ship&&ship.v2Layout===false)return null;
 const rnd=seeded(1105),group=new T.Group(),near=new T.Group(),far=new T.Group(),solid=new T.Group(),seats=new T.Group();
 group.name='Great_cat_tree';solid.name='Great_cat_tree_solid';near.name='Great_cat_tree_near';far.name='Great_cat_tree_far';seats.name='Great_cat_tree_seats';
 const lod=new T.LOD();lod.position.set(TREE.x,0,TREE.z);lod.addLevel(near,0);lod.addLevel(far,150);group.add(lod);near.position.set(-TREE.x,0,-TREE.z);far.position.copy(near.position);
 const bulk=new T.MeshStandardMaterial({name:'Cat_tree_felt',vertexColors:true,roughness:.92,metalness:0,side:T.DoubleSide});
 const glow=new T.MeshStandardMaterial({name:'Cat_tree_lantern',color:0xffd89a,emissive:0xffb85c,emissiveIntensity:1.3,roughness:.6});
 const hidden=new T.MeshBasicMaterial({visible:false});
 const parts=[],lights=[],walls=[],grounds={island:[],ramp:[],platform:[],bridge:[],step:[],cushion:[]},addWall=(...g)=>walls.push(...g);
 const clear=clearOf(),y0=TREE.floor;

 // Island: a felt-moss disc with a low rim, mounds and boulders round the edge.
 {const disc=new T.CylinderGeometry(TREE.island,TREE.island+.3,.25,72);at(disc,TREE.x,y0+.125,TREE.z);parts.push(paint(disc,C.moss,.08,rnd));grounds.island.push(disc.clone());
  const rim=new T.TorusGeometry(TREE.island+.2,.18,6,96);rim.rotateX(Math.PI/2);at(rim,TREE.x,y0+.2,TREE.z);parts.push(paint(rim,C.sisal));
  for(let i=0;i<26;i++){const a=rnd()*Math.PI*2,r=TREE.island-1-rnd()*2.2,x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r;if(!clear(x,y0+.3,z,.6)||!offWalk(x,z,1.6))continue;
   const s=.6+rnd()*.9,m=new T.SphereGeometry(s,12,8);m.scale(1.3,.55,1.1);at(m,x,y0+.25,z);parts.push(paint(m,rnd()<.5?C.moss:C.mossDark,.1,rnd));if(s>.9)addWall(new T.CylinderGeometry(s*1.1,s*1.2,s*.6,10).translate(x,y0+.25+s*.3,z));}
 }
 // Trunk: a felt lathe with rope bands, a broad buttress root at five places away from the ramp's foot.
 {const prof=[];for(let h=0;h<=39;h+=1)prof.push(new T.Vector2(trunkR(y0+h)+(h<1.5?.6*(1.5-h):0),y0+.2+h*(TREE.top-y0-.2)/39));prof.push(new T.Vector2(.01,TREE.top+.1));
  const trunk=new T.LatheGeometry(prof,56);trunk.translate(TREE.x,0,TREE.z);parts.push(paint(trunk,C.felt,.06,rnd));
  const proxy=new T.LatheGeometry(prof.filter((p,i)=>i%3===0||i===prof.length-1),24);proxy.translate(TREE.x,0,TREE.z);addWall(proxy);
  for(let h=3;h<37;h+=3.4){const y=y0+h,band=new T.TorusGeometry(trunkR(y)+.08,.22,6,48);band.rotateX(Math.PI/2);at(band,TREE.x,y,TREE.z);parts.push(sisal(band,40));}
  for(const deg of [118,165,212,258,300]){const a=deg*Math.PI/180,dir=new T.Vector3(Math.cos(a),0,Math.sin(a)),base=new T.Vector3(TREE.x,y0+.2,TREE.z);
   const root=tube([base.clone().addScaledVector(dir,4).setY(y0+2.6),base.clone().addScaledVector(dir,6.2).setY(y0+1.2),base.clone().addScaledVector(dir,8).setY(y0+.25)],.55,16,8);parts.push(paint(root,C.feltDark,.05,rnd));
   addWall(between(base.clone().addScaledVector(dir,4).setY(y0+.2),base.clone().addScaledVector(dir,8).setY(y0+.2),.55,.4,6));}
 }
 // Ramp: carpet on top, sisal sides; guard posts and two ropes on the outer edge except where a platform joins it.
 {const f=t=>{const s=t*9,y=rampY(s);return {a:rampAngle(s),y,ri:rampIn(y),ro:rampOut(y)};};
  const body=strip(9*48,f,.35);fixNormals(body);grounds.ramp.push(body.clone());parts.push(paint(body,C.sisal));
  const top=strip(9*48,t=>{const o=f(t);return {...o,y:o.y+.03,ri:o.ri+.15,ro:o.ro-.15};},.03);fixNormals(top);parts.push(paint(top,C.carpet[0]));
  const joined=(s,r)=>{const y=rampY(s),a=rampAngle(s),x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r;
   if(PLATFORMS.some(p=>Math.abs(p.y-y)<.05&&Math.hypot(x-p.x,z-p.z)<p.r-.05))return true;return s>8.6&&Math.abs(y-RING.y)<.05;};
  let run=[];const flush=()=>{if(run.length>1){walls.push(...wall(run,0,GUARD).map((g,i)=>g));const rope=h=>tube(run.map(p=>new T.Vector3(p.x,p.y+h,p.z)),.05,run.length,4);parts.push(paint(rope(1.05),C.rope),paint(rope(.55),C.rope));}run=[];};
  for(let s=.04;s<=9.001;s+=1/48){const y=rampY(s),r=rampOut(y)-.08,a=rampAngle(s);if(joined(s,r)){flush();continue;}const p={x:TREE.x+Math.cos(a)*r,y,z:TREE.z+Math.sin(a)*r};run.push(p);}
  flush();
  for(let s=.1;s<9;s+=.1){const y=rampY(s),r=rampOut(y)-.08,a=rampAngle(s);if(joined(s,r))continue;const x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r;parts.push(sisal(at(new T.CylinderGeometry(.07,.07,1.1,6),x,y+.55,z),30));}
  // Under the ramp's first steep stretch: a sisal skirt to the island and an end wall, so no one wedges underneath.
  const sk=[];for(let s=0;s<=.62;s+=1/48){const y=rampY(s),a=rampAngle(s),r=rampOut(y)-.1;sk.push({x:TREE.x+Math.cos(a)*r,z:TREE.z+Math.sin(a)*r,y});}
  for(let i=1;i<sk.length;i++){const a=sk[i-1],b=sk[i],h=Math.max(.05,b.y-y0-.25),g=new T.BoxGeometry(Math.hypot(b.x-a.x,b.z-a.z)+.1,h,.15);g.rotateY(-Math.atan2(b.z-a.z,b.x-a.x));at(g,(a.x+b.x)/2,y0+.25+h/2,(a.z+b.z)/2);walls.push(g.clone());parts.push(sisal(g,12));}
  {const s=.62,y=rampY(s),a=rampAngle(s),ri=rampIn(y),ro=rampOut(y),h=y-y0-.6,m=new T.Matrix4().makeTranslation(TREE.x,0,TREE.z).multiply(new T.Matrix4().makeRotationY(-a));const e=new T.BoxGeometry(ro-ri,h,.2).translate((ri+ro)/2,y0+.25+h/2,0).applyMatrix4(m);walls.push(e.clone());parts.push(sisal(e,12));}
 }
 // Platforms: carpet discs on a sisal rim, a limb from the trunk underneath, guard posts and ropes round the edge except
 // where the ramp and a bridge join; cushions to sit on, a hammock pod on every other one and a cubby box on three.
 const bridgeAt=(n,x,z)=>BRIDGES.some(b=>b.deck===n&&Math.abs(z)<b.width/2-.1&&x>b.x0-.5);
 const guardRing=(n,cx,cz,R,y,cut)=>{let run=[];const flush=()=>{if(run.length>1){walls.push(...wall(run,0,GUARD));const rope=h=>tube(run.map(p=>new T.Vector3(p.x,y+h,p.z)),.05,run.length,4);parts.push(paint(rope(1.05),C.rope),paint(rope(.55),C.rope));}run=[];};
  const N=Math.ceil(R*10),start=Math.floor(rnd()*0);let first=null;const pts=[];for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,x=cx+Math.cos(a)*R,z=cz+Math.sin(a)*R;pts.push({x,y,z,cut:cut(x,z)});}
  // start the walk round at a cut so runs don't wrap across the seam
  const k=Math.max(0,pts.findIndex(p=>p.cut));const order=[...pts.slice(k),...pts.slice(1,k+1)];
  for(const p of order){if(p.cut){flush();continue;}run.push(p);}flush();
  for(let i=0;i<N;i+=4){const p=pts[i];if(!p.cut)parts.push(sisal(at(new T.CylinderGeometry(.08,.08,1.1,6),p.x,y+.55,p.z),30));}};
 PLATFORMS.forEach((p,i)=>{
  const disc=new T.CylinderGeometry(p.r,p.r-.2,.8,48);at(disc,p.x,p.y-.4,p.z);grounds.platform.push(disc.clone());parts.push(sisal(disc,30));
  const pad=new T.CylinderGeometry(p.r-.25,p.r-.25,.06,48);at(pad,p.x,p.y+.01,p.z);parts.push(paint(pad,C.carpet[i%4]));
  const rim=new T.TorusGeometry(p.r-.05,.42,8,64);rim.scale(1,1,.9);rim.rotateX(Math.PI/2);at(rim,p.x,p.y-.38,p.z);parts.push(paint(rim,C.carpet[(i+1)%4]));
  const cup=new T.ConeGeometry(p.r*.55,2.4,24,1,true);cup.rotateX(Math.PI);at(cup,p.x,p.y-1.6,p.z);parts.push(paint(cup,C.feltDark,.05,rnd));
  const out=new T.Vector3(Math.cos(p.angle),0,Math.sin(p.angle)),base=new T.Vector3(TREE.x,p.y-3.8,TREE.z).addScaledVector(out,trunkR(p.y-3.8)-.4);
  parts.push(paint(tube([base,base.clone().addScaledVector(out,3).setY(p.y-2.9),new T.Vector3(p.x,p.y-2.5,p.z)],.75,20,10),C.felt,.05,rnd));
  guardRing(p.deck,p.x,p.z,p.r-.12,p.y,(x,z)=>Math.hypot(x-TREE.x,z-TREE.z)<rampOut(p.y)+.25||bridgeAt(p.deck,x,z));
  // cushions on the far half, away from the ramp joint and the bridge
  const away=p.angle,count=3+(i%2);for(let k=0;k<count;k++){const a=away+(k-(count-1)/2)*.62,r=p.r-1.7,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(bridgeAt(p.deck,x,z))continue;
   const c=pumpkin(.7,.36);c.rotateY(-a);at(c,x,p.y,z);parts.push(paint(c.clone(),C.carpet[(i+k+2)%4]));const seat=new T.Mesh(c.clone(),hidden);seat.name='Meditation_cushion';seats.add(seat);grounds.cushion.push(c);}
  if(i%2===0){const a=p.angle+1.25,r=p.r-1.9,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!bridgeAt(p.deck,x,z)){
   const bowl=new T.SphereGeometry(1.05,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2);bowl.scale(1,.55,1);at(bowl,x,p.y+.62,z);parts.push(paint(bowl,C.wicker,.06,rnd));
   const bed=new T.CylinderGeometry(.85,.85,.12,16);at(bed,x,p.y+.56,z);parts.push(paint(bed.clone(),C.carpet[(i+3)%4]));const m=new T.Mesh(bed,hidden);m.name='Hammock';seats.add(m);
   addWall(new T.CylinderGeometry(1.05,.7,.62,12).translate(x,p.y+.31,z));
   for(let k=0;k<3;k++){const b=k/3*Math.PI*2;parts.push(paint(between(new T.Vector3(x+Math.cos(b)*.95,p.y+.62,z+Math.sin(b)*.95),new T.Vector3(x,p.y+3.6,z),.03),C.rope));}
   parts.push(paint(between(new T.Vector3(x,p.y+3.6,z),new T.Vector3(TREE.x+Math.cos(p.angle)*trunkR(p.y+3.6),p.y+4.2,TREE.z+Math.sin(p.angle)*trunkR(p.y+3.6)),.22,.32,8),C.felt));}}
  if(i%3===1){const a=p.angle-1.15,r=p.r-1.6,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!bridgeAt(p.deck,x,z)){const box=new T.BoxGeometry(2,1.6,1.7,2,2,2);roundBox(box,.2);box.rotateY(-a);at(box,x,p.y+.8,z);parts.push(paint(box,C.carpet[(i+2)%4]));addWall(box.clone());
   const hole=new T.CircleGeometry(.5,20);hole.rotateY(-a-Math.PI/2);const o=new T.Vector3(Math.cos(a+Math.PI),0,Math.sin(a+Math.PI));at(hole,x+o.x*.87,p.y+.85,z+o.z*.87);parts.push(paint(hole,C.ink));}}
 });
 // The ring at Deck 15: open over the ramp's last approach, with guards round its edge and the opening's far side.
 {const N=128,f=t=>{const a=HOLE[1]+t*Math.PI*2,inHole=((a-HOLE[0])%(Math.PI*2)+Math.PI*2)%(Math.PI*2)<HOLE[1]-HOLE[0];return {a,y:RING.y,ri:inHole?rampOut(RING.y)-.05:RING.inner,ro:RING.outer};};
  const ring=strip(N,f,.5);fixNormals(ring);grounds.platform.push(ring.clone());parts.push(sisal(ring,30));
  const pad=strip(N,t=>{const o=f(t);return {...o,y:o.y+.04,ri:o.ri+.1,ro:o.ro-.25};},.04);fixNormals(pad);parts.push(paint(pad,C.carpet[3]));
  guardRing(15,TREE.x,TREE.z,RING.outer-.12,RING.y,(x,z)=>bridgeAt(15,x,z));
  // over the opening while the ramp is more than 0.9 m below, and across its start
  const edge=[],r=rampOut(RING.y)+.15;for(let a=HOLE[0];a<=HOLE[1]-.72;a+=.04)edge.push({x:TREE.x+Math.cos(a)*r,y:RING.y,z:TREE.z+Math.sin(a)*r});
  const ri=RING.inner,a0=HOLE[0];const radial=[{x:TREE.x+Math.cos(a0)*ri,z:TREE.z+Math.sin(a0)*ri,y:RING.y},{x:TREE.x+Math.cos(a0)*r,z:TREE.z+Math.sin(a0)*r,y:RING.y}];
  for(const run of [edge,[...radial].reverse().concat([])]){walls.push(...wall(run,0,GUARD));parts.push(paint(tube(run.map(p=>new T.Vector3(p.x,p.y+1.05,p.z)),.05,run.length,4),C.rope));}
 }
 // Bridges: plank decks on the centre line with rope rails and posts; the Deck 9 one hangs on ropes from a limb above.
 for(const b of BRIDGES){const len=b.x1-b.x0,cx=(b.x0+b.x1)/2,deck=new T.BoxGeometry(len,.22,b.width,Math.ceil(len),1,1);at(deck,cx,b.y-.11,0);grounds.bridge.push(deck.clone());parts.push(paint(deck,C.sisal,.05,rnd));parts.push(paint(at(new T.BoxGeometry(len,.03,b.width-.4),cx,b.y+.015,0),C.carpet[0]));
  for(let x=b.x0+.3;x<b.x1;x+=.6)parts.push(paint(at(new T.BoxGeometry(.06,.035,b.width-.4),x,b.y+.02,0),0xa8432f));
  for(const side of [-1,1]){const z=side*(b.width/2-.08),xs=b.disc?Math.max(b.x0,b.disc.x+Math.sqrt(Math.max(0,b.disc.r**2-(z-b.disc.z)**2))-.15):b.x0,run=[{x:xs,y:b.y,z},{x:b.x1,y:b.y,z}];walls.push(...wall(run,0,GUARD));
   for(const h of [.55,1.05])parts.push(paint(tube([new T.Vector3(xs,b.y+h,z),new T.Vector3((xs+b.x1)/2,b.y+h-.12,z),new T.Vector3(b.x1,b.y+h,z)],.05,24,5),C.rope));
   for(let x=xs+.2;x<b.x1;x+=2)parts.push(sisal(at(new T.CylinderGeometry(.09,.09,1.1,6),x,b.y+.55,z),30));}
  if(b.deck===9){const limbY=b.y+7.2,top=new T.Vector3(TREE.x+3.6,limbY,0),tip=new T.Vector3(b.x0+16,limbY-.6,0);parts.push(paint(tube([top,new T.Vector3(b.x0+6,limbY+.6,0),tip],.5,24,10),C.felt,.05,rnd));
   for(let x=b.x0+4;x<b.x0+16;x+=3)for(const side of [-1,1])parts.push(paint(between(new T.Vector3(x,b.y+1.05,side*(b.width/2-.08)),new T.Vector3(x,limbY-.2-(x-b.x0)*.04,0),.03),C.rope));}
 }
 // Boardwalk from the island's edge to the ramp's foot, kitten step stumps beside it, the den at the foot of the trunk,
 // lamp posts round the island and the name sign.
 {const a=PHI0,foot=new T.Vector3(TREE.x+Math.cos(a)*rampOut(TREE.islandTop)-.2,0,TREE.z+Math.sin(a)*rampOut(TREE.islandTop)).setY(0);
  const tangent=new T.Vector3(-Math.sin(a),0,Math.cos(a)),mid=new T.Vector3(TREE.x+Math.cos(a)*(rampIn(TREE.islandTop)+RAMP_W/2),0,TREE.z+Math.sin(a)*(rampIn(TREE.islandTop)+RAMP_W/2));
  const start=mid.clone().addScaledVector(tangent,-(TREE.island-2)),len=TREE.island-2;const bw=new T.BoxGeometry(len,.06,2.6);bw.rotateY(-Math.atan2(tangent.z,tangent.x));at(bw,(start.x+mid.x)/2,TREE.islandTop+.03,(start.z+mid.z)/2);parts.push(paint(bw,C.carpet[0]));
  const side=new T.Vector3(Math.cos(a),0,Math.sin(a));
  [.3,.6,.9].forEach((h,k)=>{const p=start.clone().addScaledVector(tangent,2.5+k*1.3).addScaledVector(side,2.6);const st=new T.CylinderGeometry(.55,.6,h,14);at(st,p.x,TREE.islandTop+h/2,p.z);grounds.step.push(st.clone());parts.push(paint(st,C.wood,.05,rnd));parts.push(paint(at(new T.CylinderGeometry(.5,.5,.04,14),p.x,TREE.islandTop+h+.02,p.z),C.carpet[(k+1)%4]));});
  // the sign: a board on two posts by the boardwalk, facing out
  {const p=start.clone().addScaledVector(tangent,1.2).addScaledVector(side,-2.4),face=-Math.atan2(-tangent.z,-tangent.x);
   const board=new T.BoxGeometry(.18,1.15,3.4);roundBox(board,.08);board.rotateY(face);at(board,p.x,TREE.islandTop+1.55,p.z);parts.push(paint(board,C.wood));
   for(const o of [-1.3,1.3]){const q=p.clone().add(new T.Vector3(0,0,o).applyAxisAngle(new T.Vector3(0,1,0),face));const post=at(new T.CylinderGeometry(.1,.1,2.1,8),q.x,TREE.islandTop+1.05,q.z);parts.push(sisal(post,30));addWall(post.clone());}
   const label=signLabel();if(label){const m=new T.Mesh(new T.PlaneGeometry(3.1,.95),label);m.name='Cat_tree_sign';m.rotation.y=face-Math.PI/2;m.position.set(p.x,TREE.islandTop+1.55,p.z).addScaledVector(new T.Vector3(-tangent.x,0,-tangent.z).normalize(),.1);
    m.position.add(new T.Vector3(Math.cos(face),0,-Math.sin(face)).multiplyScalar(0));near.add(m);}}
  // the den: a felt dome against the trunk facing aft, with an arched way in
  {const da=Math.PI,dir=new T.Vector3(Math.cos(da),0,Math.sin(da)),c=new T.Vector3(TREE.x,TREE.islandTop,TREE.z).addScaledVector(dir,trunkR(TREE.islandTop)+1.2);
   const dome=new T.SphereGeometry(2.7,24,12,da-Math.PI/2+.42,Math.PI*2-.84,0,Math.PI/2);dome.rotateY(Math.PI);at(dome,c.x,c.y,c.z);
   const shell=dome.clone();parts.push(paint(dome,C.felt,.05,rnd));addWall(shell);
   const arch=new T.TorusGeometry(1.05,.16,6,24,Math.PI);arch.rotateY(da-Math.PI/2);const door=c.clone().addScaledVector(dir,2.62);at(arch,door.x,c.y+1.15,door.z);parts.push(sisal(arch,30));
   const lamp=new T.SphereGeometry(.28,12,8);at(lamp,c.x,c.y+2,c.z);lights.push(lamp);
   const cushion=new T.BoxGeometry(1.4,.3,1.2,2,1,2);roundBox(cushion,.12);cushion.rotateY(-da);const cp=c.clone().addScaledVector(dir,-.4);at(cushion,cp.x,c.y+.16,cp.z);parts.push(paint(cushion.clone(),C.carpet[2]));const seat=new T.Mesh(cushion.clone(),hidden);seat.name='Meditation_cushion';seats.add(seat);grounds.cushion.push(cushion);}
  for(let i=0;i<8;i++){const b=a+(i+.5)/8*Math.PI*2,x=TREE.x+Math.cos(b)*(TREE.island-.9),z=TREE.z+Math.sin(b)*(TREE.island-.9);
   if(!offWalk(x,z,.8))continue;
   const post=at(new T.CylinderGeometry(.09,.12,2.4,8),x,y0+1.45,z);parts.push(paint(post,C.cream));addWall(post.clone());lights.push(at(new T.SphereGeometry(.36,12,8).scale(1,1.2,1),x,y0+2.9,z));}
 }
 // Paper lanterns under the platforms' rims, and dens in the trunk (a dark arch with a lamp) between landings.
 for(const p of PLATFORMS){for(let k=0;k<3;k++){const a=p.angle+(k-1)*1.1,x=p.x+Math.cos(a)*(p.r+.2),z=p.z+Math.sin(a)*(p.r+.2);if(!clear(x,p.y-1.2,z,0))continue;
  parts.push(paint(between(new T.Vector3(x,p.y-1,z),new T.Vector3(x,p.y-.2,z),.02),C.rope));lights.push(at(new T.SphereGeometry(.32,10,8).scale(1,1.25,1),x,p.y-1.25,z));}}
 for(const s of [1.5,3.5,5.5,7.5]){const y=rampY(s)+1.3,a=rampAngle(s)+Math.PI*.55,r=trunkR(y)+.02,x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r;
  if(!clear(x+Math.cos(a)*.3,y,z+Math.sin(a)*.3,-.2))continue;const n=new T.Vector3(Math.cos(a),0,Math.sin(a));
  const back=new T.CircleGeometry(.95,20,0,Math.PI);back.rotateY(Math.PI/2-a);at(back,x,y,z);lights.push(back);
  const box=new T.PlaneGeometry(1.9,1.4);box.rotateY(Math.PI/2-a);at(box,x,y-.7,z);lights.push(box);
  const arch=new T.TorusGeometry(1,.15,6,20,Math.PI);arch.rotateY(Math.PI/2-a);at(arch,x+n.x*.05,y,z+n.z*.05);parts.push(sisal(arch,30));lights.push(at(new T.SphereGeometry(.18,8,6),x+n.x*.1,y-.2,z+n.z*.1));}

 // Canopy: stitched felt leaves in four tiers, never inside a walkway or through a slab.
 {const leaf=feltLeaf(),slots=[],tmp=new T.Object3D(),col=new T.Color();
  const total=CANOPY.reduce((t,c)=>t+c[2]*c[2],0);
  for(const [ya,yb,R] of CANOPY){const hat=ya>RING.y,cy=(ya+yb)/2,ry=hat?(yb-ya)/2:(yb-ya)/2+1.2,n=Math.round(720*R*R/total),first=slots.length;
   for(let i=0;i<n*12&&slots.length-first<n;i++){const u=rnd()*2-1,th=rnd()*Math.PI*2,k=.62+.38*Math.cbrt(rnd()),s=Math.sqrt(1-u*u),x=TREE.x+Math.cos(th)*s*R*k,z=TREE.z+Math.sin(th)*s*R*k,y=cy+u*ry*k;
    if(y<ya-.5||Math.hypot(x-TREE.x,z-TREE.z)<trunkR(y)+.6)continue;const sc=hat?1.4+rnd()*.6:2.4+rnd()*1.4;if(!clear(x,y,z,sc*.8,hat?.15:sc*.8)||!inOpening(x,y,z,y+(hat?.12:sc*.5),hat?.6:sc*.7))continue;
    slots.push({x,y,z,sc,out:new T.Vector3((x-TREE.x)/R*(hat?.25:.7),1+(y-cy)/ry*.3,(z-TREE.z)/R*(hat?.25:.7)).normalize(),roll:rnd()*Math.PI*2,c:C.leaf[Math.floor(rnd()*3)],v:.9+rnd()*.2});}}
  const leaves=new T.InstancedMesh(leaf,new T.MeshStandardMaterial({name:'Cat_tree_leaves',vertexColors:true,roughness:.95}),slots.length);leaves.name='Cat_tree_leaves';
  slots.forEach((p,i)=>{tmp.position.set(p.x,p.y,p.z);tmp.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),p.out);tmp.rotateY(p.roll);tmp.scale.setScalar(p.sc);tmp.updateMatrix();leaves.setMatrixAt(i,tmp.matrix);leaves.setColorAt(i,col.set(p.c).multiplyScalar(p.v));});
  leaves.computeBoundingSphere();near.add(leaves);
  // limbs from the trunk out into each tier carry the canopy
  for(const [ya,yb,R] of CANOPY)for(let k=0;k<5;k++){const a=k/5*Math.PI*2+ya,y=(ya+yb)/2-.5,base=new T.Vector3(TREE.x+Math.cos(a)*trunkR(y)*.8,y-1.5,TREE.z+Math.sin(a)*trunkR(y)*.8),tip=new T.Vector3(TREE.x+Math.cos(a)*R*.72,y+.8,TREE.z+Math.sin(a)*R*.72);
   if(!clear((base.x+tip.x)/2,(base.y+tip.y)/2,(base.z+tip.z)/2,.6)||!clear(tip.x,tip.y,tip.z,.6)||!inOpening(tip.x,tip.y,tip.z,tip.y+.6,.8))continue;parts.push(paint(tube([base,base.clone().lerp(tip,.5).setY(y+.2),tip],.42,14,8),C.felt,.05,rnd));}
  // far: a few big felt blobs per tier
  for(const [ya,yb,R] of CANOPY)for(let k=0;k<7;k++){const a=k/7*Math.PI*2,r=R*.62,b=new T.SphereGeometry(R*.42,10,6);b.scale(1,.55,1);at(b,TREE.x+Math.cos(a)*r,(ya+yb)/2,TREE.z+Math.sin(a)*r);far.add(new T.Mesh(paint(b,C.leaf[k%3]),bulk));}
 }
 // Toys on cords below the canopy and the limbs: pom-poms, feather wands and stuffed fish, all out of reach of walkways.
 {const toys=[];let tries=0;while(toys.length<34&&tries++<900){const t=CANOPY[Math.floor(rnd()*2)],a=rnd()*Math.PI*2,r=4+rnd()*(t[2]-4),x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r,top=t[0]+.4,len=2+rnd()*5,y=top-len;
   let ok=true;for(let h=y-.8;h<=top;h+=.5)if(!clear(x,h,z,.5)){ok=false;break;}if(!ok||!inOpening(x,y,z,top,1))continue;toys.push({x,y,z,top,kind:toys.length%3,c:C.toy[toys.length%5]});}
  for(const t of toys){parts.push(paint(between(new T.Vector3(t.x,t.y,t.z),new T.Vector3(t.x,t.top,t.z),.025,.025,4),C.rope));
   if(t.kind===0){const b=new T.IcosahedronGeometry(.55,1);at(b,t.x,t.y-.5,t.z);parts.push(paint(b,t.c,.15,rnd));}
   else if(t.kind===1){parts.push(paint(at(new T.CylinderGeometry(.05,.05,1.6,5),t.x,t.y-.8,t.z),C.wood));for(let f=0;f<3;f++){const fe=new T.ConeGeometry(.22,1.1,5);fe.scale(1,1,.25);fe.rotateZ(Math.PI+(f-1)*.4);at(fe,t.x+(f-1)*.18,t.y-1.9,t.z);parts.push(paint(fe,C.toy[(f+2)%5]));}}
   else{const body=new T.SphereGeometry(.5,12,8);body.scale(1.6,.75,.55);at(body,t.x,t.y-.4,t.z);parts.push(paint(body,t.c));const tail=new T.ConeGeometry(.35,.6,4);tail.rotateZ(-Math.PI/2);at(tail,t.x-.95,t.y-.4,t.z);parts.push(paint(tail,C.toy[(toys.indexOf(t)+1)%5]));}}
 }
 // Far version: trunk, discs, ring and bridges, low.
 {const prof=[];for(let h=0;h<=39;h+=3)prof.push(new T.Vector2(trunkR(y0+h),y0+h));const tr=new T.LatheGeometry(prof,12);tr.translate(TREE.x,0,TREE.z);far.add(new T.Mesh(paint(tr,C.felt),bulk));
  for(const p of PLATFORMS){const d=new T.CylinderGeometry(p.r,p.r,.5,16);at(d,p.x,p.y-.25,p.z);far.add(new T.Mesh(paint(d,C.carpet[0]),bulk));}
  for(const b of BRIDGES){const d=new T.BoxGeometry(b.x1-b.x0,.22,b.width);at(d,(b.x0+b.x1)/2,b.y-.11,0);far.add(new T.Mesh(paint(d,C.wood),bulk));}
  const isl=new T.CylinderGeometry(TREE.island,TREE.island,.25,24);at(isl,TREE.x,y0+.12,TREE.z);far.add(new T.Mesh(paint(isl,C.moss),bulk));}

 named(near,'Cat_tree_body',parts,bulk);named(near,'Cat_tree_lanterns',lights,glow);near.add(seats);
 // Colliders: walk surfaces named as floors, everything else as walls (src/v2/ground.js reads the names).
 named(solid,'Cat_tree_island_floor',grounds.island,hidden,['position']);named(solid,'Cat_tree_ramp',grounds.ramp,hidden,['position']);named(solid,'Cat_tree_platform',grounds.platform,hidden,['position']);
 named(solid,'Cat_tree_bridge_walkway',grounds.bridge,hidden,['position']);named(solid,'Cat_tree_step_platform',[...grounds.step,...grounds.cushion],hidden,['position']);named(solid,'Cat_tree_guard_wall',walls,hidden,['position']);
 for(const o of near.children)if(o.isMesh)o.userData.noCollide=true;
 group.updateMatrixWorld(true);solid.updateMatrixWorld(true);
 return {group,solid,seats,bounds:{y0:TREE.floor,y1:TREE.top+.5}};
}

// Felt leaf: a puffy rounded leaf with a darker stitched rim and a central vein, about 1 m long before scaling.
function feltLeaf(){const g=new T.SphereGeometry(.5,12,4);g.scale(1,.1,.86);const out=g.toNonIndexed();out.deleteAttribute('uv');
 const p=out.attributes.position,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),rim=Math.hypot(x/.5,z/.43),k=rim>.86?.72:Math.abs(z)<.03&&x>-.3?.82:1;c[i*3]=c[i*3+1]=c[i*3+2]=k;}
 out.setAttribute('color',new T.BufferAttribute(c,3));out.computeVertexNormals();return out;}
// A pumpkin cushion: a squashed sphere with eight soft grooves, its base flat at y 0.
function pumpkin(r,h){const g=new T.SphereGeometry(r,24,10);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),k=1-.07*Math.pow(Math.abs(Math.cos(a*4)),.6);p.setXYZ(i,x*k,(y/r)*h/2+h/2,z*k);}g.computeVertexNormals();return g;}
// Round off a box's corners by pulling its vertices toward a rounded-rectangle shell of radius r.
function roundBox(g,r){g.computeBoundingBox();const b=g.boundingBox,h=b.getSize(new T.Vector3()).multiplyScalar(.5),c=b.getCenter(new T.Vector3()),p=g.attributes.position,v=new T.Vector3(),q=new T.Vector3();
 const inner=h.clone().subScalar(r).max(new T.Vector3());for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).sub(c);q.copy(v).clamp(inner.clone().negate(),inner);const d=v.clone().sub(q);if(d.lengthSq()>1e-8)d.setLength(r);p.setXYZ(i,c.x+q.x+d.x,c.y+q.y+d.y,c.z+q.z+d.z);}
 g.computeVertexNormals();return g;}
// Strip quads are wound so their faces point outward; recompute normals after any later reshaping.
function fixNormals(g){g.computeVertexNormals();return g;}
// The sign's face: cream letters on a dark stained board, with a paw. Only where a canvas exists (pages, not plain Node).
function signLabel(){if(typeof document==='undefined')return null;const cv=document.createElement('canvas');cv.width=1024;cv.height=320;const g=cv.getContext('2d');if(!g)return null;
 g.fillStyle='#7a4f2a';g.fillRect(0,0,1024,320);g.strokeStyle='#f1e3c8';g.lineWidth=10;g.strokeRect(18,18,988,284);g.fillStyle='#f6ead2';g.textAlign='center';g.textBaseline='middle';
 g.font='bold 104px "Trebuchet MS", Arial, sans-serif';g.fillText('THE GREAT',512,112);g.fillText('CAT TREE',512,222);
 g.fillStyle='#f6ead2';const paw=(x,y,s)=>{g.beginPath();g.ellipse(x,y,26*s,22*s,0,0,Math.PI*2);g.fill();for(const [dx,dy] of [[-30,-34],[-10,-48],[12,-48],[32,-34]]){g.beginPath();g.ellipse(x+dx*s,y+dy*s,9*s,11*s,0,0,Math.PI*2);g.fill();}};
 paw(900,250,1);const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return new T.MeshStandardMaterial({map:t,roughness:.85});}
