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
// SIDE -1 turns the spiral clockwise seen from above, so the boardwalk and its sign face aft to starboard.
const STEP=Math.PI*.75,LAND=20/135,PHI0=-Math.PI*.375,SIDE=-1,RAMP_W=2.7,GUARD=1.15;
const level=k=>k===0?TREE.islandTop:deckY(6+k);
// The boardwalk runs straight in to the ramp's foot along its tangent, from 2 m inside the island's edge.
const WALK=(()=>{const a=SIDE*PHI0,t={x:-SIDE*Math.sin(a),z:SIDE*Math.cos(a)},r=4.6+.22+2.7/2,m={x:TREE.x+Math.cos(a)*r,z:TREE.z+Math.sin(a)*r},L=TREE.island-2;return {t,end:m,start:{x:m.x-t.x*L,z:m.z-t.z*L},len:L};})();
const offWalk=(x,z,pad)=>{const u=Math.max(0,Math.min(WALK.len,(x-WALK.start.x)*WALK.t.x+(z-WALK.start.z)*WALK.t.z)),px=WALK.start.x+WALK.t.x*u,pz=WALK.start.z+WALK.t.z*u;return Math.hypot(x-px,z-pz)>1.3+pad;};
export function rampY(s){const k=Math.min(8,Math.floor(s)),u=s-k;return level(k)+(level(k+1)-level(k))*Math.min(1,Math.max(0,(u-LAND)/(1-2*LAND)));}
export const rampAngle=s=>SIDE*(PHI0+s*STEP);
// Trunk radius by height: a straight 4.6 m to 5 m up, tapering to 2.6 m at Deck 15 and 2 m at the top.
export function trunkR(y){const h=y-TREE.floor;return h<5?4.6:h<36?4.5-1.9*(h-5)/31:2.6-.6*Math.min(1,(h-36)/3.2);}
export const rampIn=y=>trunkR(y)+.22,rampOut=y=>rampIn(y)+RAMP_W;
// Landing platforms touch the ramp's outer edge with 1 m of overlap; the ring at Deck 15 reaches 8 m round the trunk.
const RADII={7:6,8:5.5,9:6,10:5.5,11:6,12:5.5,13:5.5,14:5};
export const PLATFORMS=Object.entries(RADII).map(([n,r])=>{n=+n;const y=deckY(n),a=rampAngle(n-6),d=rampOut(y)-1+r;return {deck:n,y,r,angle:a,x:TREE.x+Math.cos(a)*d,z:TREE.z+Math.sin(a)*d};});
export const RING={deck:15,y:deckY(15),inner:trunkR(deckY(15))-.05,outer:8,angle:rampAngle(9)};
// The ring is open over the ramp's last approach, from 90 degrees before its landing (APPROACH is where that starts).
const APPROACH=RING.angle-SIDE*Math.PI/2,HOLE=[Math.min(APPROACH,RING.angle),Math.max(APPROACH,RING.angle)];
// Dens: a room in the trunk at every deck landing from 7 to 14, entered from the landing opposite its platform, 2.2 m wide,
// 2.5 m high and up to 2.6 m deep. The trunk (and its collider) is cut open there; a felt door surround hides the cut.
// The den at the trunk's foot, in a felt dome on the island, opens this way.
export const FOOT_DEN={a:128*Math.PI/180};
// Where the den's axis crosses the boardwalk's centre line (u along the walk from its start): the boardwalk's trunk-side
// fence opens there, so the den is entered straight from the boardwalk.
FOOT_DEN.u=(()=>{const ux=Math.cos(FOOT_DEN.a),uz=Math.sin(FOOT_DEN.a);let best=0,err=1e9;for(let u=0;u<=WALK.len;u+=.05){const x=WALK.start.x+WALK.t.x*u-TREE.x,z=WALK.start.z+WALK.t.z*u-TREE.z,e=Math.abs(-x*uz+z*ux);if(e<err&&x*ux+z*uz>0){err=e;best=u;}}return best;})();
// Island dressing keeps a 1.6 m lane clear in front of it, from its door out to the island's edge.
const offFootDoor=(x,z,pad)=>{const ux=Math.cos(FOOT_DEN.a),uz=Math.sin(FOOT_DEN.a),dx=x-TREE.x,dz=z-TREE.z,u=dx*ux+dz*uz;return u<5||Math.abs(-dx*uz+dz*ux)>1.6+pad;};
export const DENS=Object.keys(RADII).map(Number).map(n=>{const y=deckY(n),a=rampAngle(n-6),front=trunkR(y)*1.045+.02;return {deck:n,y,a,front,back:Math.max(.5,front-2.6),w:1.1,h:2.5};});
const angDiff=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
// Inside a den's opening on the trunk: the angle and height of a point on the trunk wall.
const inDoor=(a,y,r)=>DENS.some(d=>y>d.y-.01&&y<d.y+d.h+.01&&angDiff(a,d.a)*r<d.w+.2);
// Bridges along the centre line to the bow cafes' aft faces (their slab edges are at x 224.5, 211 and 197).
export const BRIDGES=[{deck:9,x1:224.8},{deck:12,x1:211.3},{deck:15,x1:197.3}].map(b=>{const y=deckY(b.deck),p=PLATFORMS.find(p=>p.deck===b.deck);
 const w=2.4,x0=p?p.x+Math.sqrt(p.r*p.r-(Math.abs(p.z)+w/2)**2)-.3:TREE.x+RING.outer-.3;return {...b,y,x0,width:w,disc:p};});
// Canopy tiers [y0,y1,radius], and the openings above: leaves stay inside each slab's opening and under the Deck 16 slab.
// The top tier is a low leafy roof over the Deck 15 ring, 2.2 m clear above it and under the Deck 16 slab.
const CANOPY=[[2.5,7,14],[7,12.3,13],[12.3,16.3,10],[16.3,19,7]];
// The leaf dome: a hemisphere of 15 m centred 23.6 m up the tree, its top 1 m under the Deck 16 slab, so the platforms
// below Deck 12 stand out from under its rim. Where a slab's
// opening cuts into it (Decks 13-15 step in toward the bow and sides), clusters are pulled in toward the trunk.
const DOME={cy:4.1,r:15};
const OPENINGS=[{y:deckY(13),z:30,x:206},{y:deckY(14),z:20,x:201},{y:deckY(15),z:10,x:197},{y:deckY(16),z:0,x:148}];

const C={felt:0xa36d45,feltDark:0x7a4c2c,sisal:0xe2c79a,rope:0xf1e2c2,carpet:[0xd2604a,0xe8b04a,0x9db783,0xf3e6cc],wood:0xc08a52,
 wicker:0xe9cc98,moss:0x86a446,mossDark:0x5f8a34,leaf:[0xc6dd5e,0xa8ca4c,0x88b242],toy:[0xec7a92,0xf2b84b,0x6fa8d6,0xe2604e,0xf08a4b],cream:0xf6ead2,ink:0x3a2a1e,stone:0xe6d3b0,den:0x5a3218};

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
// A plush rail along a run of floor points: a fat padded cream bolster on top, rope uprights every 0.6 m and a sisal post
// every 2.4 m; the ramp and bridges also get a lower rope (the guard collider is built separately by wall()).
function fence(run,light=false){const out=[],pts=run.map(p=>new T.Vector3(p.x,p.y,p.z));let len=0;for(let i=1;i<pts.length;i++)len+=pts[i-1].distanceTo(pts[i]);
 const segs=Math.max(2,Math.ceil(len/.5)),rail=(h,r,radial,color)=>out.push(paint(tube(pts.map(p=>p.clone().setY(p.y+h)),r,segs,radial),color));
 rail(1.02,light?.24:.2,7,C.cream);if(!light)rail(.5,.07,4,C.rope);
 let carry=0,post=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],l=a.distanceTo(b);let d=carry;
  for(;d<l;d+=.6){const q=a.clone().lerp(b,d/l);post+=.6;const thick=post>=2.4;if(thick)post=0;
   out.push(thick?sisal(at(new T.CylinderGeometry(.15,.15,1.05,6,1,true),q.x,q.y+.52,q.z),24):paint(at(new T.CylinderGeometry(.045,.045,.95,4,1,true),q.x,q.y+.48,q.z),C.rope));}
  carry=d-l;}
 return out;}
// A running stitch: short cream dashes round a circle, lying just above a surface or standing on a side face.
function stitches(cx,y,cz,r,side=false){const out=[],n=Math.round(r*2*Math.PI/.5);for(let i=0;i<n;i++){const a=i/n*Math.PI*2,d=new T.PlaneGeometry(.26,.06);if(side)d.rotateY(-a+Math.PI/2);else{d.rotateX(-Math.PI/2);d.rotateY(-a+Math.PI/2);}out.push(paint(at(d,cx+Math.cos(a)*r,y,cz+Math.sin(a)*r),C.cream));}return out;}
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
 const bulk=felt(new T.MeshStandardMaterial({name:'Cat_tree_felt',vertexColors:true,roughness:.95,metalness:0,side:T.DoubleSide}));
 const glow=new T.MeshStandardMaterial({name:'Cat_tree_lantern',color:0xffb860,emissive:0xff9a30,emissiveIntensity:2,roughness:.6});
 const denGlow=new T.MeshStandardMaterial({name:'Cat_tree_den',color:0xffb060,emissive:0xff8a30,emissiveIntensity:.9,roughness:.8,side:T.DoubleSide});
 const hidden=new T.MeshBasicMaterial({visible:false});
 const parts=[],lights=[],dens=[],sprigs=[],walls=[],grounds={island:[],ramp:[],platform:[],bridge:[],step:[],cushion:[]},addWall=(...g)=>walls.push(...g);
 const clear=clearOf(),y0=TREE.floor;

 // Island: a felt-moss disc with a low rim, mounds and boulders round the edge.
 {const disc=new T.CylinderGeometry(TREE.island,TREE.island+.3,.25,72);at(disc,TREE.x,y0+.125,TREE.z);parts.push(paint(disc,C.moss,.08,rnd));grounds.island.push(disc.clone());
  const kerb=new T.CylinderGeometry(TREE.island+.7,TREE.island+.75,.32,96,1,true);at(kerb,TREE.x,y0+.16,TREE.z);parts.push(pavers(paint(kerb,C.stone)));
  const lip=new T.RingGeometry(TREE.island-.05,TREE.island+.7,96,1);lip.rotateX(-Math.PI/2);at(lip,TREE.x,y0+.32,TREE.z);parts.push(pavers(paint(lip,C.stone)));
  for(let i=0,made=0;i<120&&made<28;i++){const a=rnd()*Math.PI*2,r=TREE.island-1.1-rnd()*2.6,x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r;if(!clear(x,y0+.3,z,1)||!offWalk(x,z,2.2)||!offFootDoor(x,z,1.6))continue;made++;
   const s=.9+rnd()*.55;for(let k=0;k<3;k++){const o=k===0?[0,0]:[(rnd()-.5)*1.6*s,(rnd()-.5)*1.6*s],r0=s*(k===0?1:.7+rnd()*.2),b=new T.SphereGeometry(r0,11,7);b.scale(1.1,.8,1.1);at(b,x+o[0],y0+.25+r0*.55,z+o[1]);parts.push(paint(b,[C.mossDark,C.moss,C.leaf[1]][k],.06,rnd));
    if(k===0)for(const m of [0,Math.PI/2])for(let q=1;q<10;q++){const t=q/10*Math.PI,d=new T.PlaneGeometry(.2,.05);d.rotateZ(Math.PI/2-t);d.rotateY(m);const cx=Math.cos(t)*r0*1.11,cy=Math.sin(t)*r0*.81;d.translate(Math.cos(m)*cx,cy,-Math.sin(m)*cx);parts.push(paint(at(d,x+o[0],y0+.25+r0*.55,z+o[1]),0xf2d67a));}}
   addWall(new T.CylinderGeometry(s*1.4,s*1.5,s*1.4,10).translate(x,y0+.25+s*.7,z));}
  for(let i=0,made=0;i<40&&made<5;i++){const a=rnd()*Math.PI*2,r=TREE.island-1-rnd()*3,x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r;if(!clear(x,y0+.3,z,.8)||!offWalk(x,z,1)||!offFootDoor(x,z,.8))continue;made++;
   if(made===3){const f=fish(C.toy[2]);f.scale(1.3,1.3,1.3);f.rotateY(a);at(f,x,y0+.55,z);parts.push(f);continue;}
   parts.push(yarn(.8,C.toy[made%2?0:3],rnd,x,y0+1.05,z));addWall(new T.CylinderGeometry(.8,.8,1.6,8).translate(x,y0+1.05,z));}
 }
 // Trunk: a felt lathe with rope bands, a broad buttress root at five places away from the ramp's foot.
 {const ys=[...Array.from({length:40},(_,h)=>y0+.2+h*(TREE.top-y0-.2)/39),...DENS.flatMap(d=>[d.y,d.y+d.h])].sort((a,b)=>a-b);
  const prof=ys.map(y=>{const h=y-y0;return new T.Vector2(trunkR(y)+(h<1.5?.6*(1.5-h):0),y);});prof.push(new T.Vector2(.01,TREE.top+.1));
  const trunk=cutDoors(grooves(new T.LatheGeometry(prof,96)));trunk.translate(TREE.x,0,TREE.z);parts.push(trunk);
  // its collider runs out to the ramp's inner edge, over the grooves, so no gap opens between trunk and ramp
  const proxy=cutDoors(new T.LatheGeometry(prof.map((v,i,all)=>i===all.length-1?v:new T.Vector2(Math.max(v.x,rampIn(v.y-.2)-.02),v.y)),48).toNonIndexed());proxy.translate(TREE.x,0,TREE.z);addWall(proxy);
  for(let i=0;i<260;i++){const a=rnd()*Math.PI*2,y=y0+1.5+rnd()*35,r=trunkR(y)*1.05+.03;if(inDoor(a,y,r)||inDoor(a,y+.4,r))continue;const d=new T.PlaneGeometry(.07,.32);d.rotateY(Math.PI/2-a);parts.push(paint(at(d,TREE.x+Math.cos(a)*r,y,TREE.z+Math.sin(a)*r),0xf2c95a));}
  for(let h=3;h<37;h+=4.6)for(let k=0;k<3;k++){const y=y0+h+k*.34,r=trunkR(y)+.2,d=DENS.find(d=>y>d.y-.3&&y<d.y+d.h+.3),gap=d?2*(d.w+.5)/r:0,band=new T.TorusGeometry(r,.17,4,44,Math.PI*2-gap);band.rotateX(Math.PI/2);if(d)band.rotateY(-(d.a+gap/2));at(band,TREE.x,y,TREE.z);parts.push(paint(band,k===1?0xd6b98a:C.sisal));}
  for(const [deg,len] of [[150,10],[176,11],[201,10],[226,11.5],[250,10]]){const a=deg*Math.PI/180,dir=new T.Vector3(Math.cos(a),0,Math.sin(a)),base=new T.Vector3(TREE.x,y0+.2,TREE.z);
   const root=tube([base.clone().addScaledVector(dir,3.4).setY(y0+5.2),base.clone().addScaledVector(dir,5.2).setY(y0+2.6),base.clone().addScaledVector(dir,len*.75).setY(y0+.8),base.clone().addScaledVector(dir,len).setY(y0+.2)],1.6,20,10);taper(root,1.6,.35);parts.push(paint(root,C.felt,.05,rnd));
   addWall(between(base.clone().addScaledVector(dir,4.4).setY(y0+.2),base.clone().addScaledVector(dir,len).setY(y0+.2),1.7,.4,6));}
 }
 // Ramp: carpet on top, sisal sides; guard posts and two ropes on the outer edge except where a platform joins it.
 {const f=t=>{const s=t*9,y=rampY(s);return {a:rampAngle(s),y,ri:rampIn(y),ro:rampOut(y)};};
  const body=strip(9*48,f,.6);fixNormals(body);grounds.ramp.push(body.clone());parts.push(paint(body,C.sisal));
  const top=strip(9*48,t=>{const o=f(t);return {...o,y:o.y+.03,ri:o.ri+.15,ro:o.ro-.15};},.03);fixNormals(top);parts.push(paint(top,C.carpet[0]));
  const joined=(s,r)=>{const y=rampY(s),a=rampAngle(s),x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r;
   if(PLATFORMS.some(p=>Math.abs(p.y-y)<.05&&Math.hypot(x-p.x,z-p.z)<p.r-.05))return true;return s>8.6&&Math.abs(y-RING.y)<.05;};
  let run=[];const flush=()=>{if(run.length>1){walls.push(...wall(run,0,GUARD));parts.push(...fence(run));}run=[];};
  for(let s=.04;s<=9.001;s+=1/48){const y=rampY(s),r=rampOut(y)-.08,a=rampAngle(s);if(joined(s,r)){flush();continue;}const p={x:TREE.x+Math.cos(a)*r,y,z:TREE.z+Math.sin(a)*r};run.push(p);}
  flush();
  {const edge=[];for(let s=0;s<=9.001;s+=1/24){const y=rampY(s),a=rampAngle(s),r=rampOut(y)-.12;edge.push(new T.Vector3(TREE.x+Math.cos(a)*r,y+.1,TREE.z+Math.sin(a)*r));}parts.push(paint(tube(edge,.14,edge.length,5),C.cream));let inner=[];const flushIn=()=>{if(inner.length>1)parts.push(paint(tube(inner,.13,inner.length,5),C.cream));inner=[];};
  for(let i=0;i<edge.length;i++){const s=i/24,y=rampY(s),a=rampAngle(s),r=rampIn(y)+.14;if(inDoor(a,y+.5,trunkR(y)+.3)){flushIn();continue;}inner.push(new T.Vector3(TREE.x+Math.cos(a)*r,y+.1,TREE.z+Math.sin(a)*r));}flushIn();}
  // Under the ramp's first steep stretch: a sisal skirt to the island and an end wall, so no one wedges underneath.
  const sk=[];for(let s=0;s<=.62;s+=1/48){const y=rampY(s),a=rampAngle(s),r=rampOut(y)-.1;sk.push({x:TREE.x+Math.cos(a)*r,z:TREE.z+Math.sin(a)*r,y});}
  for(let i=1;i<sk.length;i++){const a=sk[i-1],b=sk[i],h=Math.max(.05,b.y-y0-.25),g=new T.BoxGeometry(Math.hypot(b.x-a.x,b.z-a.z)+.1,h,.15);g.rotateY(-Math.atan2(b.z-a.z,b.x-a.x));at(g,(a.x+b.x)/2,y0+.25+h/2,(a.z+b.z)/2);walls.push(g.clone());parts.push(sisal(g,12));}
  {const s=.62,y=rampY(s),a=rampAngle(s),ri=rampIn(y),ro=rampOut(y),h=y-y0-.6,m=new T.Matrix4().makeTranslation(TREE.x,0,TREE.z).multiply(new T.Matrix4().makeRotationY(-a));const e=new T.BoxGeometry(ro-ri,h,.2).translate((ri+ro)/2,y0+.25+h/2,0).applyMatrix4(m);walls.push(e.clone());parts.push(sisal(e,12));}
 }
 // Platforms: carpet discs on a sisal rim, a limb from the trunk underneath, guard posts and ropes round the edge except
 // where the ramp and a bridge join; cushions to sit on, a hammock pod on every other one and a cubby box on three.
 const bridgeAt=(n,x,z)=>BRIDGES.some(b=>b.deck===n&&Math.abs(z)<b.width/2-.1&&x>b.x0-.5);
 const guardRing=(n,cx,cz,R,y,cut)=>{let run=[];const flush=()=>{if(run.length>1){walls.push(...wall(run,0,GUARD));parts.push(...fence(run,true));}run=[];};
  const N=Math.ceil(R*10),start=Math.floor(rnd()*0);let first=null;const pts=[];for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,x=cx+Math.cos(a)*R,z=cz+Math.sin(a)*R;pts.push({x,y,z,cut:cut(x,z)});}
  // start the walk round at a cut so runs don't wrap across the seam
  const k=Math.max(0,pts.findIndex(p=>p.cut));const order=[...pts.slice(k),...pts.slice(1,k+1)];
  for(const p of order){if(p.cut){flush();continue;}run.push(p);}flush();
  };
 PLATFORMS.forEach((p,i)=>{
  const disc=new T.CylinderGeometry(p.r,p.r-.2,.8,48);at(disc,p.x,p.y-.4,p.z);grounds.platform.push(disc.clone());parts.push(sisal(disc,30));
  const pad=new T.CylinderGeometry(p.r-.25,p.r-.25,.06,48);at(pad,p.x,p.y+.01,p.z);parts.push(paint(pad,C.carpet[i%4]));
  const rim=new T.TorusGeometry(p.r-.1,.5,8,48);rim.scale(1,1,.95);rim.rotateX(Math.PI/2);at(rim,p.x,p.y-.38,p.z);parts.push(paint(rim,C.carpet[i%4],.03,rnd));
  const piping=new T.TorusGeometry(p.r+.33,.07,3,48);piping.rotateX(Math.PI/2);at(piping,p.x,p.y-.38,p.z);parts.push(paint(piping,C.cream));
  parts.push(...stitches(p.x,p.y-.38,p.z,p.r+.41,true));
  parts.push(paint(at(new T.CylinderGeometry(.8,.95,2.6,12,1,true),p.x,p.y-2.1,p.z),C.wood));for(let k=0;k<6;k++){const coil=new T.TorusGeometry(.92-k*.02,.13,4,20);coil.rotateX(Math.PI/2);parts.push(paint(at(coil,p.x,p.y-3.2+k*.24,p.z),k%2?0xd6b98a:C.sisal));}
  const out=new T.Vector3(Math.cos(p.angle),0,Math.sin(p.angle)),base=new T.Vector3(TREE.x,p.y-3.8,TREE.z).addScaledVector(out,trunkR(p.y-3.8)-.4);
  parts.push(paint(tube([base,base.clone().addScaledVector(out,3).setY(p.y-2.9),new T.Vector3(p.x,p.y-2.5,p.z)],.75,20,10),C.felt,.05,rnd));
  guardRing(p.deck,p.x,p.z,p.r-.12,p.y,(x,z)=>Math.hypot(x-TREE.x,z-TREE.z)<rampOut(p.y)+.25||bridgeAt(p.deck,x,z));
  // cushions on the far half, away from the ramp joint and the bridge
  const away=p.angle,count=5+(i%2);for(let k=0;k<count;k++){const a=away+(k-(count-1)/2)*.42,r=p.r-(k%2?2.9:1.75),x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(bridgeAt(p.deck,x,z))continue;
   const c=pumpkin(k%2?.85:1.05,k%2?.7:.95);c.rotateY(-a);at(c,x,p.y,z);parts.push(paint(c.clone(),C.carpet[(i+k+2)%4]));const seat=new T.Mesh(c.clone(),hidden);seat.name='Meditation_cushion';seats.add(seat);grounds.cushion.push(c);}
  if(i%2===0){const a=p.angle+1.25,r=p.r-1.9,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!bridgeAt(p.deck,x,z)){
   const bowl=new T.SphereGeometry(1.05,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2);bowl.scale(1,.8,1);at(bowl,x,p.y+.9,z);parts.push(woven(bowl,p.y+.9));{const lip=new T.TorusGeometry(1.03,.11,5,24);lip.rotateX(Math.PI/2);at(lip,x,p.y+.9,z);parts.push(paint(lip,C.wicker));}
   const bed=new T.CylinderGeometry(.85,.85,.12,16);at(bed,x,p.y+.56,z);parts.push(paint(bed.clone(),C.carpet[(i+3)%4]));const m=new T.Mesh(bed,hidden);m.name='Hammock';seats.add(m);
   addWall(new T.CylinderGeometry(1.05,.7,.62,12).translate(x,p.y+.31,z));
   for(let k=0;k<3;k++){const b=k/3*Math.PI*2;parts.push(paint(between(new T.Vector3(x+Math.cos(b)*.95,p.y+.62,z+Math.sin(b)*.95),new T.Vector3(x,p.y+3.6,z),.03),C.rope));}
   parts.push(paint(between(new T.Vector3(x,p.y+3.6,z),new T.Vector3(TREE.x+Math.cos(p.angle)*trunkR(p.y+3.6),p.y+4.2,TREE.z+Math.sin(p.angle)*trunkR(p.y+3.6)),.22,.32,8),C.felt));sprigs.push(new T.Vector3(x,p.y+4.2,z));}}
  {const a=p.angle-.55,r=p.r-1.3,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!bridgeAt(p.deck,x,z)){if(i%2){const f=fish(C.toy[2]);f.scale(1.6,1.6,1.6);f.rotateZ(Math.PI/2);f.rotateY(-a);at(f,x,p.y+.42,z);parts.push(f);}else parts.push(yarn(.55,C.toy[(i+1)%5],rnd,x,p.y+.55,z));}}
  if(i%3===1){const a=p.angle-1.15,r=p.r-1.6,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!bridgeAt(p.deck,x,z)){const box=new T.BoxGeometry(2,1.6,1.7,2,2,2);roundBox(box,.2);box.rotateY(-a);at(box,x,p.y+.8,z);parts.push(paint(box,C.carpet[1]));addWall(box.clone());
   const hole=new T.CircleGeometry(.5,20);hole.rotateY(-a-Math.PI/2);const o=new T.Vector3(Math.cos(a+Math.PI),0,Math.sin(a+Math.PI));at(hole,x+o.x*.87,p.y+.85,z+o.z*.87);parts.push(paint(hole,C.ink));}}
 });
 // The ring at Deck 15: open over the ramp's last approach, with guards round its edge and the opening's far side.
 {const N=128,f=t=>{const a=HOLE[1]+t*Math.PI*2,inHole=((a-HOLE[0])%(Math.PI*2)+Math.PI*2)%(Math.PI*2)<HOLE[1]-HOLE[0];return {a,y:RING.y,ri:inHole?rampOut(RING.y)-.05:RING.inner,ro:RING.outer};};
  const ring=strip(N,f,.5);fixNormals(ring);grounds.platform.push(ring.clone());parts.push(sisal(ring,30));
  const pad=strip(N,t=>{const o=f(t);return {...o,y:o.y+.04,ri:o.ri+.1,ro:o.ro-.25};},.04);fixNormals(pad);parts.push(paint(pad,C.carpet[3]));
  guardRing(15,TREE.x,TREE.z,RING.outer-.12,RING.y,(x,z)=>bridgeAt(15,x,z));
  for(let k=0;k<7;k++){const a=RING.angle+Math.PI*(.55+k*.19),r=k%2?6.6:5.5,x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r;if(bridgeAt(15,x,z)||Math.abs(z)<2.2&&x>TREE.x)continue;
   const c=pumpkin(k%2?.75:.95,k%2?.65:.85);c.rotateY(-a);at(c,x,RING.y,z);parts.push(paint(c.clone(),C.carpet[k%4]));const seat=new T.Mesh(c.clone(),hidden);seat.name='Meditation_cushion';seats.add(seat);grounds.cushion.push(c);}
  // over the opening while the ramp is more than 0.9 m below, and across its start
  const edge=[],r=rampOut(RING.y)+.15;for(let t=0;t<=Math.PI/2-.72;t+=.04){const a=APPROACH+SIDE*t;edge.push({x:TREE.x+Math.cos(a)*r,y:RING.y,z:TREE.z+Math.sin(a)*r});}
  const ri=RING.inner,a0=APPROACH;const radial=[{x:TREE.x+Math.cos(a0)*ri,z:TREE.z+Math.sin(a0)*ri,y:RING.y},{x:TREE.x+Math.cos(a0)*r,z:TREE.z+Math.sin(a0)*r,y:RING.y}];
  for(const run of [edge,[...radial].reverse()]){walls.push(...wall(run,0,GUARD));parts.push(...fence(run));}
 }
 // Bridges: plank decks on the centre line with rope rails and posts; the Deck 9 one hangs on ropes from a limb above.
 for(const b of BRIDGES){const len=b.x1-b.x0,cx=(b.x0+b.x1)/2,deck=new T.BoxGeometry(len,.22,b.width,Math.ceil(len),1,1);at(deck,cx,b.y-.11,0);grounds.bridge.push(deck.clone());parts.push(paint(deck,C.sisal,.05,rnd));parts.push(paint(at(new T.BoxGeometry(len,.03,b.width-.4),cx,b.y+.015,0),C.carpet[0]));
  for(let x=b.x0+.3;x<b.x1;x+=.6)parts.push(paint(at(new T.BoxGeometry(.06,.035,b.width-.4),x,b.y+.02,0),0xa8432f));
  for(const side of [-1,1]){const z=side*(b.width/2-.08),xs=b.disc?Math.max(b.x0,b.disc.x+Math.sqrt(Math.max(0,b.disc.r**2-(z-b.disc.z)**2))-.15):b.x0,run=[{x:xs,y:b.y,z},{x:b.x1,y:b.y,z}];walls.push(...wall(run,0,GUARD));
   parts.push(...fence(run));}
  if(b.deck===9){const limbY=b.y+7.2,top=new T.Vector3(TREE.x+3.6,limbY,0),tip=new T.Vector3(b.x0+16,limbY-.6,0);for(let t=.35;t<=1.001;t+=.13)sprigs.push(top.clone().lerp(tip,t).add(new T.Vector3(0,.7,0)));parts.push(paint(tube([top,new T.Vector3(b.x0+6,limbY+.6,0),tip],.5,24,10),C.felt,.05,rnd));
   for(let x=b.x0+4;x<b.x0+16;x+=3)for(const side of [-1,1])parts.push(paint(between(new T.Vector3(x,b.y+1.05,side*(b.width/2-.08)),new T.Vector3(x,limbY-.2-(x-b.x0)*.04,0),.03),C.rope));}
 }
 // Boardwalk from the island's edge to the ramp's foot, kitten step stumps beside it, the den at the foot of the trunk,
 // lamp posts round the island and the name sign.
 {const a=rampAngle(0);
  const tangent=new T.Vector3(WALK.t.x,0,WALK.t.z),mid=new T.Vector3(TREE.x+Math.cos(a)*(rampIn(TREE.islandTop)+RAMP_W/2),0,TREE.z+Math.sin(a)*(rampIn(TREE.islandTop)+RAMP_W/2));
  const start=mid.clone().addScaledVector(tangent,-(TREE.island-2)),len=TREE.island-2;const bw=new T.BoxGeometry(len,.06,2.6);bw.rotateY(-Math.atan2(tangent.z,tangent.x));at(bw,(start.x+mid.x)/2,TREE.islandTop+.03,(start.z+mid.z)/2);parts.push(paint(bw,C.carpet[0]));
  const side=new T.Vector3(Math.cos(a),0,Math.sin(a));
  for(const o of [-1.35,1.35])for(const [u0,u1] of o<0?[[0,FOOT_DEN.u-1.4],[FOOT_DEN.u+1.4,len-1.2]]:[[0,len-1.2]]){if(u1-u0<.5)continue;const run=[u0,u1].map(u=>{const q=start.clone().addScaledVector(tangent,u).addScaledVector(side,o);return {x:q.x,y:TREE.islandTop,z:q.z};});walls.push(...wall(run,0,GUARD));parts.push(...fence(run));}
  [.3,.6,.9].forEach((h,k)=>{const p=start.clone().addScaledVector(tangent,2.5+k*1.3).addScaledVector(side,2.6);const st=new T.CylinderGeometry(.6,.66,h,16);at(st,p.x,TREE.islandTop+h/2,p.z);grounds.step.push(st.clone());{const b=paint(st,C.wood),q=b.attributes.position,c=b.attributes.color;for(let v=0;v<q.count;v++){const a=Math.atan2(q.getZ(v)-p.z,q.getX(v)-p.x),kk=.75+.25*Math.abs(Math.sin(a*8));c.setXYZ(v,c.getX(v)*kk,c.getY(v)*kk,c.getZ(v)*kk);}parts.push(b);}
   parts.push(paint(at(new T.CylinderGeometry(.58,.58,.04,16),p.x,TREE.islandTop+h+.02,p.z),0xf0dcb0));{const ring=new T.TorusGeometry(.32,.025,3,20);ring.rotateX(Math.PI/2);parts.push(paint(at(ring,p.x,TREE.islandTop+h+.045,p.z),0xc8a06a));}});
  // the sign: a board on two posts by the boardwalk, facing out
  {const p=start.clone().addScaledVector(tangent,.5).addScaledVector(side,2.9),face=-Math.atan2(-tangent.z,-tangent.x);
   const board=new T.CylinderGeometry(1,1,.2,40);board.rotateX(Math.PI/2);board.scale(2.35,1.05,1);board.rotateY(face+Math.PI/2);at(board,p.x,TREE.islandTop+1.75,p.z);parts.push(paint(board,C.wood));
   const edge=new T.TorusGeometry(1,.07,5,40);edge.scale(2.35,1.05,1);edge.rotateY(face+Math.PI/2);at(edge,p.x,TREE.islandTop+1.75,p.z);parts.push(paint(edge,0x8a5a30));
   for(const o of [-1.6,1.6]){const q=p.clone().add(new T.Vector3(0,0,o).applyAxisAngle(new T.Vector3(0,1,0),face));const post=at(new T.CylinderGeometry(.18,.2,1.6,8),q.x,TREE.islandTop+.8,q.z);parts.push(paint(post,0x8a5a30));addWall(post.clone());}
   const label=signLabel();if(label){const m=new T.Mesh(new T.PlaneGeometry(4.45,1.9),label);m.name='Cat_tree_sign';m.rotation.y=face+Math.PI/2;m.position.set(p.x,TREE.islandTop+1.75,p.z).addScaledVector(new T.Vector3(-tangent.x,0,-tangent.z).normalize(),.1);
    m.position.add(new T.Vector3(Math.cos(face),0,-Math.sin(face)).multiplyScalar(0));near.add(m);}}
  // the den: a felt dome against the trunk facing aft, with an arched way in
  {const da=FOOT_DEN.a,dir=new T.Vector3(Math.cos(da),0,Math.sin(da)),c=new T.Vector3(TREE.x,TREE.islandTop,TREE.z).addScaledVector(dir,trunkR(TREE.islandTop)+1.2);
   const dome=new T.SphereGeometry(2.7,24,12,-da+.52,Math.PI*2-1.04,0,Math.PI/2);dome.rotateY(Math.PI);at(dome,c.x,c.y,c.z);
   const shell=dome.clone();parts.push(paint(dome,C.felt,.05,rnd));addWall(shell);
   const door=c.clone().addScaledVector(dir,2.45);{const face=doorSurround(1.5,2.75,1.05,1.3);face.rotateY(Math.PI/2-da);at(face,door.x,c.y,door.z);parts.push(paint(face,C.felt,.04,rnd));}
   for(const [r0,k] of [[1.18,.26]]){const arch=new T.TorusGeometry(r0,k,6,24,Math.PI);arch.rotateY(Math.PI/2-da);at(arch,door.x+dir.x*.1,c.y+1.3,door.z+dir.z*.1);parts.push(sisal(arch,26));
    for(const s2 of [-1,1]){const side=new T.Vector3(-dir.z,0,dir.x).multiplyScalar(s2*r0);parts.push(sisal(at(new T.CylinderGeometry(k,k,1.3,8),door.x+dir.x*.1+side.x,c.y+.65,door.z+dir.z*.1+side.z),26));}}
   const lamp=new T.SphereGeometry(.28,12,8);at(lamp,c.x,c.y+2,c.z);lights.push(lamp);
   {const back=new T.CircleGeometry(2.4,20,0,Math.PI);back.rotateY(Math.PI/2-da);const b=c.clone().addScaledVector(dir,-.9);at(back,b.x,c.y,b.z);dens.push(back);}
   const cushion=new T.BoxGeometry(1.4,.3,1.2,2,1,2);roundBox(cushion,.12);cushion.rotateY(-da);const cp=c.clone().addScaledVector(dir,-.4);at(cushion,cp.x,c.y+.16,cp.z);parts.push(paint(cushion.clone(),C.carpet[2]));const seat=new T.Mesh(cushion.clone(),hidden);seat.name='Meditation_cushion';seats.add(seat);grounds.cushion.push(cushion);}
  for(let i=0;i<8;i++){const b=a+(i+.5)/8*Math.PI*2,x=TREE.x+Math.cos(b)*(TREE.island-.9),z=TREE.z+Math.sin(b)*(TREE.island-.9);
   if(!offWalk(x,z,.8)||!offFootDoor(x,z,.6))continue;
   const post=at(new T.CylinderGeometry(.08,.1,1,8),x,y0+.75,z);parts.push(paint(post,C.wood));addWall(post.clone());lights.push(at(new T.BoxGeometry(.5,.62,.5),x,y0+1.56,z));parts.push(paint(at(new T.BoxGeometry(.62,.08,.62),x,y0+1.91,z),C.wood),paint(at(new T.BoxGeometry(.6,.06,.6),x,y0+1.22,z),C.wood));}
 }
 // Paper lanterns under the platforms' rims, and dens in the trunk (a dark arch with a lamp) between landings.
 for(const p of PLATFORMS){for(let k=0;k<3;k++){const a=p.angle+(k-1)*1.1,x=p.x+Math.cos(a)*(p.r+.2),z=p.z+Math.sin(a)*(p.r+.2);if(!clear(x,p.y-1.2,z,0))continue;
  parts.push(paint(between(new T.Vector3(x,p.y-1,z),new T.Vector3(x,p.y-.2,z),.02),C.rope));lights.push(at(new T.BoxGeometry(.5,.62,.5),x,p.y-1.3,z));parts.push(paint(at(new T.BoxGeometry(.62,.08,.62),x,p.y-.95,z),C.wood),paint(at(new T.BoxGeometry(.58,.06,.58),x,p.y-1.65,z),C.wood));}}
 for(const d of DENS){const n=new T.Vector3(Math.cos(d.a),0,Math.sin(d.a)),side=new T.Vector3(-n.z,0,n.x),depth=d.front-d.back;
  // the room: its own frame has x across the door, y up and z out of the trunk, the doorway at z 0
  const m=new T.Matrix4().makeBasis(side,new T.Vector3(0,1,0),n).setPosition(TREE.x+n.x*d.front,d.y,TREE.z+n.z*d.front),put=g=>g.applyMatrix4(m);
  const slab=(w,h,t,x,y,z)=>put(new T.BoxGeometry(w,h,t).translate(x,y,z));
  const floor=slab(2*d.w+.3,.3,depth+.1,0,-.15,-depth/2+.05);grounds.platform.push(floor.clone());parts.push(paint(floor,C.carpet[0]));
  for(const k of [-1,1]){const wall=slab(.25,d.h+.3,depth,k*(d.w+.125),d.h/2,-depth/2-.05);walls.push(wall.clone());parts.push(paint(wall,0xd08a48,.04,rnd));}
  {const back=slab(2*d.w+.5,d.h+.3,.25,0,d.h/2,-depth-.125);walls.push(back.clone());parts.push(paint(back,0xd08a48));const ceil=slab(2*d.w+.5,.25,depth,0,d.h+.125,-depth/2-.05);walls.push(ceil.clone());parts.push(paint(ceil,0xb87438));}
  // warm planked back wall, a lantern and two cushions to sit on
  {const glowWall=put(new T.PlaneGeometry(2*d.w-.1,d.h-.2).translate(0,d.h/2,-depth+.01));dens.push(glowWall);for(let x=-d.w+.35;x<d.w;x+=.45)parts.push(paint(put(new T.BoxGeometry(.04,d.h-.2,.03).translate(x,d.h/2,-depth+.03)),0x8a4a22));}
  lights.push(put(new T.SphereGeometry(.2,10,6).scale(1,1.3,1).translate(0,d.h-.55,-depth+.35)));parts.push(paint(put(new T.CylinderGeometry(.015,.015,.4,3).translate(0,d.h-.2,-depth+.35)),C.rope));
  for(const k of [-1,1]){const c=put(pumpkin(.5,.42).translate(k*.5,0,-depth+.75));parts.push(paint(c.clone(),[C.carpet[0],C.cream][k<0?0:1]));const seat=new T.Mesh(c.clone(),hidden);seat.name='Meditation_cushion';seats.add(seat);grounds.cushion.push(c);}
  // the felt door surround wrapped on the bark, and its thick rope arch
  {const r=d.w-.12,spring=d.h-r-.05,face=doorSurround(d.w+.65,d.h+.55,r,spring),q=face.attributes.position,R=d.front+.05;for(let v=0;v<q.count;v++){const t=d.a+q.getX(v)/R*-1,y=d.y+q.getY(v);q.setXYZ(v,TREE.x+Math.cos(t)*R,y,TREE.z+Math.sin(t)*R);}
   face.computeVertexNormals();parts.push(paint(face,C.feltDark,.04,rnd));
   const arch=put(new T.TorusGeometry(r+.1,.2,6,20,Math.PI).translate(0,spring,.12));parts.push(sisal(arch,26));
   for(const k of [-1,1])parts.push(sisal(put(new T.CylinderGeometry(.2,.2,spring,6).translate(k*(r+.1),spring/2,.12)),26));}}


 // Canopy: one dome of stitched felt-leaf clusters lying like shingles over the platforms; never inside a walkway or
 // through a slab. Each leaf is a bent card cut out by a felt-leaf texture (where a canvas exists), tinted per cluster.
 {const leaf=leafCard(),slots=[],col=new T.Color(),m=new T.Matrix4(),X=new T.Vector3(),Z=new T.Vector3();
  const roof=y=>y>RING.y+1.8,ok=(x,y,z,sc)=>Math.hypot(x-TREE.x,z-TREE.z)>trunkR(y)+.4&&clear(x,y,z,sc*.45,roof(y)?.12:sc*.45)&&inOpening(x,y,z,y+(roof(y)?.12:sc*.3),roof(y)?.5:sc*.45);
  // the dome, then a low leafy roof over the Deck 15 ring that the dome's crown is too narrow to cover
  for(let i=0,made=0;i<5000&&made<118;i++){const hat=made>=92;
   // even over the dome's surface, from a little below its rim to its top
   const h=hat?1:-.15+rnd()*1.15,el=Math.asin(Math.min(1,h)),th=rnd()*Math.PI*2,k=.92+.08*rnd(),dir=new T.Vector3(Math.cos(th)*Math.cos(el),Math.sin(el),Math.sin(th)*Math.cos(el));
   const cyy=hat?18.8+rnd()*.35:TREE.floor+20+DOME.cy-.5+dir.y*DOME.r*k,sc=(roof(cyy)?2.1:3.6)+rnd()*.9;let cx=0,cz=0,fit=false;
   if(hat){const a=rnd()*Math.PI*2,r=2.5+Math.sqrt(rnd())*7.5;cx=TREE.x+Math.cos(a)*r;cz=TREE.z+Math.sin(a)*r;dir.set(Math.cos(a)*.25,1,Math.sin(a)*.25).normalize();fit=ok(cx,cyy,cz,sc);}
   else for(let f=1;f>.5&&!fit;f-=.06){cx=TREE.x+dir.x*DOME.r*k*f;cz=TREE.z+dir.z*DOME.r*k*f;fit=ok(cx,cyy,cz,sc);}
   if(!fit)continue;made++;
   const radial=new T.Vector3(cx-TREE.x,0,cz-TREE.z).normalize(),N=dir.clone().add(new T.Vector3(0,.55,0)).normalize(),tint=C.leaf[Math.floor(rnd()*3)];
   // one leaf on top, then a ring of eight drooping outward round it
   const ring=[[0,0,0]];for(let q=0;q<7;q++)ring.push([q/7*Math.PI*2+rnd()*.3,1,.35+rnd()*.15]);
   for(const [ang,r1,droop] of ring){const tan=new T.Vector3(Math.cos(ang),0,Math.sin(ang));tan.sub(N.clone().multiplyScalar(tan.dot(N))).normalize();
    const pos=new T.Vector3(cx,cyy,cz).addScaledVector(tan,r1*sc*.62).addScaledVector(N,-r1*sc*.18);if(!ok(pos.x,pos.y,pos.z,sc))continue;
    const n=N.clone().addScaledVector(tan,r1?droop:0).normalize();X.copy(r1?tan:radial).sub(n.clone().multiplyScalar((r1?tan:radial).dot(n))).normalize();Z.crossVectors(X,n);
    slots.push({pos,X:X.clone(),Y:n,Z:Z.clone(),sc:sc*(r1?1:1.1),c:tint,v:(.86+rnd()*.16)*(.92+.2*Math.max(0,Math.min(1,(pos.y-2)/16)))});}}
  for(const q of sprigs)for(let k=0;k<5;k++){const ang=k/5*Math.PI*2+rnd(),tan=new T.Vector3(Math.cos(ang),0,Math.sin(ang)),n=new T.Vector3(0,1,0).addScaledVector(tan,.5).normalize(),pos=q.clone().addScaledVector(tan,.9);
   if(!clear(pos.x,pos.y,pos.z,.8)||!inOpening(pos.x,pos.y,pos.z,pos.y+.5,.8))continue;X.copy(tan).sub(n.clone().multiplyScalar(tan.dot(n))).normalize();Z.crossVectors(X,n);slots.push({pos,X:X.clone(),Y:n,Z:Z.clone(),sc:1.9,c:C.leaf[k%3],v:.95});}
  const map=leafTexture(),leafMat=felt(new T.MeshStandardMaterial({name:'Cat_tree_leaves',color:0xffffff,map,alphaTest:map?.5:0,side:T.DoubleSide,roughness:.95}),.6);
  const leaves=new T.InstancedMesh(leaf,leafMat,slots.length);leaves.name='Cat_tree_leaves';
  slots.forEach((p,i)=>{m.makeBasis(p.X,p.Y,p.Z).scale(new T.Vector3(p.sc,p.sc,p.sc)).setPosition(p.pos);leaves.setMatrixAt(i,m);leaves.setColorAt(i,col.set(p.c).multiplyScalar(p.v));});
  leaves.computeBoundingSphere();near.add(leaves);
  // limbs from the trunk out into each tier carry the canopy
  for(const [ya,yb,R] of CANOPY)for(let k=0;k<5;k++){const a=k/5*Math.PI*2+ya,y=(ya+yb)/2-.5,base=new T.Vector3(TREE.x+Math.cos(a)*trunkR(y)*.8,y-1.5,TREE.z+Math.sin(a)*trunkR(y)*.8),tip=new T.Vector3(TREE.x+Math.cos(a)*R*.72,y+.8,TREE.z+Math.sin(a)*R*.72);
   if(!clear((base.x+tip.x)/2,(base.y+tip.y)/2,(base.z+tip.z)/2,.6)||!clear(tip.x,tip.y,tip.z,.6)||!inOpening(tip.x,tip.y,tip.z,tip.y+.6,.8))continue;parts.push(paint(tube([base,base.clone().lerp(tip,.5).setY(y+.2),tip],.42,14,8),C.felt,.05,rnd));}
  // far: a few big felt blobs per tier
  for(const [ya,yb,R] of CANOPY)for(let k=0;k<7;k++){const a=k/7*Math.PI*2,r=R*.62,b=new T.SphereGeometry(R*.42,10,6);b.scale(1,.55,1);at(b,TREE.x+Math.cos(a)*r,(ya+yb)/2,TREE.z+Math.sin(a)*r);far.add(new T.Mesh(paint(b,C.leaf[k%3]),bulk));}
 }
 // Toys on cords below the canopy and the limbs: pom-poms, feather wands and stuffed fish, all out of reach of walkways.
 {const toys=[];let tries=0;while(toys.length<48&&tries++<1400){const t=CANOPY[Math.floor(rnd()*2)],a=rnd()*Math.PI*2,r=4+rnd()*(t[2]-4),x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r,top=t[0]+.4,len=2+rnd()*5,y=top-len;
   let ok=true;for(let h=y-.8;h<=top;h+=.5)if(!clear(x,h,z,.5)){ok=false;break;}if(!ok||!inOpening(x,y,z,top,1))continue;toys.push({x,y,z,top,kind:[0,1,0,2,1,0,1,0][toys.length%8],c:C.toy[toys.length%5]});}
  for(const t of toys){parts.push(paint(between(new T.Vector3(t.x,t.y,t.z),new T.Vector3(t.x,t.top,t.z),.025,.025,4),C.rope));
   if(t.kind===0)parts.push(yarn(.55,t.c,rnd,t.x,t.y-.5,t.z));
   else if(t.kind===1){parts.push(paint(at(new T.CylinderGeometry(.06,.06,1.2,5),t.x,t.y-.6,t.z),C.wood));parts.push(paint(at(new T.SphereGeometry(.16,8,6),t.x,t.y-1.25,t.z),C.rope));for(let f=0;f<4;f++){const fe=new T.ConeGeometry(.3,1.7,6);fe.scale(1,1,.22);fe.rotateZ(Math.PI+(f-1.5)*.32);fe.rotateY(f*.5);at(fe,t.x+(f-1.5)*.16,t.y-2.1,t.z);parts.push(paint(fe,[0x3fa6a0,0xe2604e,0xf2b84b,0x5d8fd0][f]));}}
   else{const f=fish(C.toy[2]);at(f,t.x,t.y-.4,t.z);parts.push(f);}}
  // wicker baskets with red cushions hanging from the lowest tier, out over the void
  let hung=0;for(let i=0;i<500&&hung<6;i++){const a=rnd()*Math.PI*2,r=7+rnd()*7,x=TREE.x+Math.cos(a)*r,z=TREE.z+Math.sin(a)*r,top=CANOPY[0][0]+.3,y=top-3-rnd()*3;
   let ok=true;for(let h=y-1.2;h<=top;h+=.5)if(!clear(x,h,z,1.3)){ok=false;break;}if(!ok||!inOpening(x,y,z,top,1.5))continue;hung++;
   const bowl=new T.SphereGeometry(1.35,16,8,0,Math.PI*2,Math.PI/2,Math.PI/2);bowl.scale(1,1.05,1);at(bowl,x,y,z);parts.push(woven(bowl,y));
   const lip=new T.TorusGeometry(1.33,.14,5,24);lip.rotateX(Math.PI/2);at(lip,x,y,z);parts.push(paint(lip,C.wicker));const cu=pumpkin(1.05,.75);at(cu,x,y-.55,z);parts.push(paint(cu,C.carpet[0]));
   for(let k=0;k<3;k++){const b=k/3*Math.PI*2+a;parts.push(paint(between(new T.Vector3(x+Math.cos(b),y,z+Math.sin(b)),new T.Vector3(x,y+2.4,z),.035),C.rope));}
   parts.push(paint(between(new T.Vector3(x,y+2.4,z),new T.Vector3(x,top,z),.05),C.rope));}
 }
 // Far version: trunk, discs, ring and bridges, low.
 {const prof=[];for(let h=0;h<=39;h+=3)prof.push(new T.Vector2(trunkR(y0+h),y0+h));const tr=new T.LatheGeometry(prof,12);tr.translate(TREE.x,0,TREE.z);far.add(new T.Mesh(paint(tr,C.felt),bulk));
  for(const p of PLATFORMS){const d=new T.CylinderGeometry(p.r,p.r,.5,16);at(d,p.x,p.y-.25,p.z);far.add(new T.Mesh(paint(d,C.carpet[0]),bulk));}
  for(const b of BRIDGES){const d=new T.BoxGeometry(b.x1-b.x0,.22,b.width);at(d,(b.x0+b.x1)/2,b.y-.11,0);far.add(new T.Mesh(paint(d,C.wood),bulk));}
  const isl=new T.CylinderGeometry(TREE.island,TREE.island,.25,24);at(isl,TREE.x,y0+.12,TREE.z);far.add(new T.Mesh(paint(isl,C.moss),bulk));}

 named(near,'Cat_tree_body',parts,bulk);named(near,'Cat_tree_lanterns',lights,glow);named(near,'Cat_tree_dens',dens,denGlow);near.add(seats);
 // Colliders: walk surfaces named as floors, everything else as walls (src/v2/ground.js reads the names).
 named(solid,'Cat_tree_island_floor',grounds.island,hidden,['position']);named(solid,'Cat_tree_ramp',grounds.ramp,hidden,['position']);named(solid,'Cat_tree_platform',grounds.platform,hidden,['position']);
 named(solid,'Cat_tree_bridge_walkway',grounds.bridge,hidden,['position']);named(solid,'Cat_tree_step_platform',[...grounds.step,...grounds.cushion],hidden,['position']);named(solid,'Cat_tree_guard_wall',walls,hidden,['position']);
 for(const o of near.children)if(o.isMesh)o.userData.noCollide=true;
 group.updateMatrixWorld(true);solid.updateMatrixWorld(true);
 return {group,solid,seats,bounds:{y0:TREE.floor,y1:TREE.top+.5}};
}

// Felt bark: shallow vertical grooves round the lathe, darker in the grooves (the lathe is still centred on the axis).
function grooves(g){g=g.index?g.toNonIndexed():g;g.deleteAttribute('uv');const p=g.attributes.position,c=new Float32Array(p.count*3),base=new T.Color(C.felt);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z);if(r<.05){c.set([base.r,base.g,base.b],i*3);continue;}const a=Math.atan2(z,x),w=Math.sin(a*17+Math.sin(p.getY(i)*.3)*1.1),k=1+.045*w;p.setX(i,x*k);p.setZ(i,z*k);const d=.58+.42*Math.pow(w*.5+.5,.6);c.set([base.r*d,base.g*d,base.b*d],i*3);}
 g.setAttribute('color',new T.BufferAttribute(c,3));g.computeVertexNormals();return g;}
// Thin a tube from radius r0 at its start to r1 at its end (TubeGeometry rings are laid out along the path).
function taper(g,r0,r1){const p=g.attributes.position,n=g.parameters.tubularSegments,radial=g.parameters.radialSegments,path=g.parameters.path,v=new T.Vector3(),q=new T.Vector3();
 for(let i=0;i<=n;i++){const t=i/n,c=path.getPointAt(t),k=(r0+(r1-r0)*t)/r0;for(let j=0;j<=radial;j++){const idx=i*(radial+1)+j;v.fromBufferAttribute(p,idx);q.copy(v).sub(c).multiplyScalar(k).add(c);p.setXYZ(idx,q.x,q.y,q.z);}}g.computeVertexNormals();return g;}
// Felt leaf card: a 1 m square bent into a shallow dome, the leaf's tip along +x, its face up (+y).
function leafCard(){const g=new T.PlaneGeometry(1,1,2,2);g.rotateX(-Math.PI/2);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,-.16*(x*x+z*z)-.06*x);}g.computeVertexNormals();return g;}
// The leaf's texture: a rounded three-lobed felt leaf, darker at its rim, a pale running stitch inside the edge and a
// vein; white elsewhere so each cluster's tint shows. Only where a canvas exists (pages, not plain Node).
function leafTexture(){if(typeof document==='undefined')return null;const S=256,cv=document.createElement('canvas');cv.width=cv.height=S;const g=cv.getContext('2d');if(!g)return null;
 const lobes=[[.52,.5,.3],[.36,.36,.21],[.36,.64,.21],[.68,.33,.19],[.68,.67,.19],[.8,.5,.17]],shape=(inset)=>{g.beginPath();for(const [x,y,r] of lobes){g.moveTo(x*S+(r-inset)*S,y*S);g.arc(x*S,y*S,Math.max(1,(r-inset)*S),0,Math.PI*2);}};
 g.fillStyle='#a9b58c';shape(0);g.fill();g.fillStyle='#eef3e4';shape(.04);g.fill();
 g.strokeStyle='#ffe066';g.lineWidth=9;g.setLineDash([15,10]);for(const [x,y,r] of lobes){g.beginPath();g.arc(x*S,y*S,(r-.05)*S,0,Math.PI*2);g.stroke();}
 g.setLineDash([]);g.fillStyle='#eef3e4';shape(.075);g.fill();g.strokeStyle='#c5cfb3';g.lineWidth=6;g.beginPath();g.moveTo(.16*S,.5*S);g.lineTo(.9*S,.5*S);for(const t of [.4,.6,.75]){g.moveTo(t*S,.5*S);g.lineTo((t+.1)*S,.32*S);g.moveTo(t*S,.5*S);g.lineTo((t+.1)*S,.68*S);}g.stroke();
 g.fillStyle='#c9a46a';g.fillRect(0,.47*S,.2*S,.06*S);
 const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
// Wicker: alternating light and dark weave bands round a basket, by height and angle.
function woven(g,y0){g=paint(g,C.wicker);const p=g.attributes.position,c=g.attributes.color;for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i)),k=.88+.12*Math.sign(Math.sin((p.getY(i)-y0)*9)*Math.sin(a*12));c.setXYZ(i,c.getX(i)*k,c.getY(i)*k,c.getZ(i)*k);}return g;}
// Felt: a fibre grain in the colour (value noise in world space at two scales) and a soft bright rim where surfaces turn
// away from the eye, as fuzz does; still MeshStandardMaterial underneath.
function felt(m,grain=1){m.onBeforeCompile=sh=>{
 const noise='varying vec3 vFeltPos;\nfloat feltHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\n'+
  'float feltNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(feltHash(i),feltHash(i+vec3(1,0,0)),f.x),mix(feltHash(i+vec3(0,1,0)),feltHash(i+vec3(1,1,0)),f.x),f.y),'+
  'mix(mix(feltHash(i+vec3(0,0,1)),feltHash(i+vec3(1,0,1)),f.x),mix(feltHash(i+vec3(0,1,1)),feltHash(i+vec3(1,1,1)),f.x),f.y),f.z);}\n';
 sh.vertexShader='varying vec3 vFeltPos;\n'+sh.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n vFeltPos=(modelMatrix*vec4(transformed,1.0)).xyz;');
 sh.fragmentShader=noise+sh.fragmentShader
  .replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=1.0+'+(.38*grain).toFixed(3)+'*(feltNoise(vFeltPos*6.0)*.45+feltNoise(vFeltPos*42.0)*.55-.5);')
  .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n {float fuzz=pow(1.0-abs(dot(normal,normalize(vViewPosition))),2.5);totalEmissiveRadiance+=diffuseColor.rgb*fuzz*.45;}');};
 m.customProgramCacheKey=()=>'leo-felt-'+grain;return m;}
// A door surround facing +z: a W-half-wide, H-high panel with an arched way in (half-width r, arch springing at y spring)
// cut up from its bottom edge, drawn as one outline so the opening triangulates cleanly.
function doorSurround(W,H,r,spring){const sh=new T.Shape();sh.moveTo(-W,0);sh.lineTo(-r,0);sh.lineTo(-r,spring);sh.absarc(0,spring,r,Math.PI,0,true);sh.lineTo(r,0);sh.lineTo(W,0);sh.lineTo(W,H);sh.lineTo(-W,H);sh.lineTo(-W,0);return new T.ShapeGeometry(sh,12);}
// Remove the bark (or its collider) where it would close a den's doorway: triangles whose centre lies in an opening.
function cutDoors(g){g=g.index?g.toNonIndexed():g;const p=g.attributes.position,keep=[];for(let t=0;t<p.count;t+=3){let x=0,y=0,z=0;for(let k=0;k<3;k++){x+=p.getX(t+k)/3;y+=p.getY(t+k)/3;z+=p.getZ(t+k)/3;}if(!inDoor(Math.atan2(z,x),y,Math.hypot(x,z)))keep.push(t);}
 const out=new T.BufferGeometry();for(const [k,a] of Object.entries(g.attributes)){const n=a.itemSize,arr=new a.array.constructor(keep.length*3*n);keep.forEach((t,i)=>{for(let v=0;v<3;v++)for(let c=0;c<n;c++)arr[(i*3+v)*n+c]=a.array[(t+v)*n+c];});out.setAttribute(k,new T.BufferAttribute(arr,n));}return out;}
// Pavers: alternate tones round the island's kerb, a block every 0.9 m.
function pavers(g){const p=g.attributes.position,c=g.attributes.color;for(let i=0;i<p.count;i+=3){let x=0,z=0;for(let k=0;k<3;k++){x+=p.getX(i+k)-TREE.x;z+=p.getZ(i+k)-TREE.z;}const a=Math.atan2(z,x),n=Math.floor((a+Math.PI)*(TREE.island+.4)/.9),k=n%2?.9:1.04;for(let j=0;j<3;j++)c.setXYZ(i+j,c.getX(i+j)*k,c.getY(i+j)*k,c.getZ(i+j)*k);}return g;}
// A ball of yarn: a sphere banded by wraps in two directions, its centre at (x,y,z).
function yarn(r,color,rnd,x,y,z){const g=paint(new T.SphereGeometry(r,12,8),color),p=g.attributes.position,c=g.attributes.color,u=new T.Vector3(rnd()-.5,rnd()-.5,rnd()-.5).normalize(),w=new T.Vector3(rnd()-.5,rnd()-.5,rnd()-.5).normalize(),v=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).divideScalar(r);const k=.78+.22*Math.max(Math.abs(Math.sin(v.dot(u)*14)),Math.abs(Math.sin(v.dot(w)*14))*.8);c.setXYZ(i,c.getX(i)*k,c.getY(i)*k,c.getZ(i)*k);}
 return at(g,x,y,z);}
// A stuffed felt fish, nose along +x: a squashed body, a tail and a darker eye.
function fish(color){const body=new T.SphereGeometry(.5,12,8);body.scale(1.5,.8,.5);const tail=new T.ConeGeometry(.42,.6,4);tail.rotateZ(Math.PI/2);tail.scale(1,1,.35);tail.translate(-.95,0,0);
 const eye=new T.SphereGeometry(.09,6,4);eye.translate(.5,.12,.22);return merge([paint(body,color),paint(tail,0x4f86b8),paint(eye,C.ink)]);}
// A pumpkin cushion: a squashed sphere with eight soft grooves, its base flat at y 0.
function pumpkin(r,h){const g=new T.SphereGeometry(r,12,6);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),k=1-.09*Math.pow(Math.abs(Math.cos(a*3)),.6);p.setXYZ(i,x*k,(y/r)*h/2+h/2,z*k);}g.computeVertexNormals();return g;}
// Round off a box's corners by pulling its vertices toward a rounded-rectangle shell of radius r.
function roundBox(g,r){g.computeBoundingBox();const b=g.boundingBox,h=b.getSize(new T.Vector3()).multiplyScalar(.5),c=b.getCenter(new T.Vector3()),p=g.attributes.position,v=new T.Vector3(),q=new T.Vector3();
 const inner=h.clone().subScalar(r).max(new T.Vector3());for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).sub(c);q.copy(v).clamp(inner.clone().negate(),inner);const d=v.clone().sub(q);if(d.lengthSq()>1e-8)d.setLength(r);p.setXYZ(i,c.x+q.x+d.x,c.y+q.y+d.y,c.z+q.z+d.z);}
 g.computeVertexNormals();return g;}
// Strip quads are wound so their faces point outward; recompute normals after any later reshaping.
function fixNormals(g){g.computeVertexNormals();return g;}
// The sign's face: cream letters on a dark stained board, with a paw. Only where a canvas exists (pages, not plain Node).
function signLabel(){if(typeof document==='undefined')return null;const cv=document.createElement('canvas');cv.width=1024;cv.height=434;const g=cv.getContext('2d');if(!g)return null;
 g.clearRect(0,0,1024,434);g.fillStyle='#e0b47a';g.beginPath();g.ellipse(512,217,500,210,0,0,Math.PI*2);g.fill();g.strokeStyle='#b8834e';g.lineWidth=10;g.beginPath();g.ellipse(512,217,470,184,0,0,Math.PI*2);g.stroke();
 g.fillStyle='#5a3418';g.textAlign='center';g.textBaseline='middle';g.font='bold 118px "Trebuchet MS", Arial, sans-serif';g.fillText('THE GREAT',512,150);g.fillText('CAT TREE',512,272);
 const paw=(x,y,s)=>{g.beginPath();g.ellipse(x,y,26*s,22*s,0,0,Math.PI*2);g.fill();for(const [dx,dy] of [[-30,-34],[-10,-48],[12,-48],[32,-34]]){g.beginPath();g.ellipse(x+dx*s,y+dy*s,9*s,11*s,0,0,Math.PI*2);g.fill();}};paw(512,372,.9);
 g.strokeStyle='#6b7a3a';g.lineWidth=7;for(const side of [-1,1]){g.beginPath();g.moveTo(512+side*150,370);g.quadraticCurveTo(512+side*250,360,512+side*300,320);g.stroke();for(let k=0;k<4;k++){const x=512+side*(170+k*35),y=368-k*11;g.beginPath();g.ellipse(x,y-12,14,7,side*.6,0,Math.PI*2);g.fillStyle='#6b7a3a';g.fill();}}
 const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return new T.MeshStandardMaterial({map:t,roughness:.85,transparent:true,alphaTest:.5});}
