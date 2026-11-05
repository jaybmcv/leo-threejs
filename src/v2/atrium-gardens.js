// 4B "Hanging gardens" for the Deck 6 atrium: planting cascading from the slab edges of Decks 7–15 (in
// irregular clusters), four signature trees, stones along the lake edge and timber decks in the food hall.
// Everything is visual only (noCollide) and lives in the atrium facade root, so the walk, its colliders, seats and
// routes, and the atrium PVS key are untouched. One opaque vertex-coloured material (no transparency, no textures):
// the Basic-material swap of the distant and phone copies keeps vertex colours and instancing, so it survives.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GREENS,BLOOMS,SHAPES,paint,stem,clump,flower,blade,orient,fern,flowerBush} from '../walk/foliage.js';
import {ATRIUM_SIGNATURE_TREES,ATRIUM_LAKE_BRIDGE,ATRIUM_WATERFALL,phase6LakePolygon,phase6LakeIslands} from '../plan/atrium-v2.js';
import {phase6Programme} from './phase6-programme.js';
import {contains,distanceToSegment} from '../plan/geometry-v2.js';

export const gardenMaterial=new T.MeshStandardMaterial({name:'P6_atrium_gardens',color:0xffffff,vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:.82});
const random=seed=>{let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
const OUT=-Math.PI/2; // foliage.js yaw for local -z, the atrium side of a planter.

// ---- Cascades -------------------------------------------------------------------------------------------------
// A planter hung on the outer face of a deck's slab edge, over the atrium (local frame: x along the edge, y up from
// the deck floor, the void toward -z), with planting spilling over it and vines trailing down the fascia and past it.
// Decks 7–15 only: nothing is added above Deck 16 (decisions-v2.json, atrium-centre-clear).
const CASCADE_DECKS=[7,15],SLOT=3.6;
// A trailing vine seen from across the atrium: broad heart leaves alternating down a swaying line (no stem tube; at
// these distances the leaves carry it), largest at the top.
function vine(out,[x,y,z],length,r){
 const n=Math.max(3,Math.round(length/.5)),phase=r()*6;
 for(let i=1;i<=n;i++){const t=i/n,len=.34+.18*(1-t)+r()*.08,p=[x+Math.sin(phase+t*3)*.1*t,y-length*t,z-.08*t+Math.cos(phase+t*2.3)*.06*t];
  out.push(orient(blade(len,len*.85,{segs:2,shape:SHAPES.heart,fold:.3,droop:.2,base:GREENS.mid,mid:i%3?GREENS.lime:GREENS.bright,tip:GREENS.bright}),p,phase+i*2.4,-.55-r()*.4,(r()-.5)*.6));}
}
function cascadeTemplate(variant){
 const r=random(9100+variant*77),out=[],trail=[1.3,2,2.8][variant];
 out.push(paint(new T.BoxGeometry(3.3,.42,.3).translate(0,-.06,-.17),0xe6dcc6));
 for(let k=0;k<4;k++)clump(out,[-1.2+k*.8+(r()-.5)*.25,.2,-.24],{r:.34+r()*.1,rnd:r,leaves:1,detail:0,squash:.75,palette:[GREENS.mid,GREENS.bright,GREENS.bright,GREENS.lime]});
 for(let k=0;k<4;k++)vine(out,[-1.3+k*.87+(r()-.5)*.2,-.05,-.36],trail*(.55+r()*.5),r);
 for(let k=0;k<2;k++)flower(out,[-.9+k*1.8+(r()-.5)*.4,.48+r()*.08,-.3],{r:.13,color:BLOOMS[[0,1,0,3][(variant*2+k)%4]],yaw:OUT,tilt:.5});
 const g=mergeGeometries(out);out.forEach(x=>x.dispose());return g;
}
// Smooth value noise along each deck edge, so planters come in runs and gaps rather than a pattern.
function noise1(seed){const r=random(seed),v=Array.from({length:64},r);return x=>{const i=Math.floor(x),f=x-i,s=f*f*(3-2*f),a=v[((i%64)+64)%64],b=v[(((i+1)%64)+64)%64];return a+(b-a)*s;};}
// The slab edge without its 0.5 m sampling jitter (the same reduction the facade plates use).
function simplifyRing(poly,tol=.1){const pts=[...poly,poly[0]],reduce=p=>{if(p.length<3)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;let best=tol,index=-1;for(let i=1;i<p.length-1;i++){const t=l?Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dz)/l)):0,d=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dz);if(d>best){best=d;index=i;}}return index<0?[a,b]:[...reduce(p.slice(0,index+1)).slice(0,-1),...reduce(p.slice(index))];};return reduce(pts).slice(0,-1);}
export function addHangingGardens(root,layout){
 const chosen=[[],[],[]];
 for(const d of layout.decks){
  if(d.number<CASCADE_DECKS[0]||d.number>CASCADE_DECKS[1]||!d.atrium?.outline)continue;
  const full=d.atrium.outline,ring=simplifyRing(full),noise=noise1(500+d.number*13);let along=0;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<SLOT){along+=len;continue;}
   const ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];let nx=-uz,nz=ux;if(!contains(full,[mid[0]+nx*.5,mid[1]+nz*.5])){nx=-nx;nz=-nz;}
   const slots=Math.floor(len/SLOT),pad=(len-slots*SLOT)/2;
   for(let k=0;k<slots;k++){
    const t=pad+(k+.5)*SLOT,x=a[0]+ux*t,z=a[1]+uz*t,h=Math.abs(Math.sin(x*12.9898+d.number*78.233+z*3.1)*43758.5453)%1;
    if(noise((along+t)/16)<.7&&h>.05)continue; // runs of ~2–6 planters, the odd single one between them
    const m=new T.Matrix4().makeRotationY(Math.atan2(-nx,-nz)).setPosition(x+nx*.02,d.y,z+nz*.02);
    m.multiply(new T.Matrix4().makeScale(.95+h*.1,.8+((h*7)%1)*.4,1));
    chosen[Math.floor((h*31)%1*3)].push(m);
   }
   along+=len;
  }
 }
 const proof={instances:0,trianglesPerVariant:[],draws:0};
 chosen.forEach((list,variant)=>{
  const g=cascadeTemplate(variant);proof.trianglesPerVariant.push(g.attributes.position.count/3);if(!list.length){g.dispose();return;}
  const o=new T.InstancedMesh(g,gardenMaterial,list.length);o.name='P6_hanging_garden_'+variant;o.frustumCulled=false;
  list.forEach((m,i)=>o.setMatrixAt(i,m));o.computeBoundingBox();o.computeBoundingSphere();
  o.userData={noCollide:true,phase6Architecture:true,selectedDesign:'4B',gardenDecor:true};root.add(o);proof.instances+=list.length;proof.draws++;
 });
 return proof;
}

// Beyond 140 m (the distant haze copy) a cascade is only a silhouette: the planter, one leaf mass and a curtain of
// a few large leaves. Swapped in after the distant clone so the near copy keeps full detail.
let distantCascade;
function distantCascadeTemplate(){
 if(distantCascade)return distantCascade;
 const r=random(9900),out=[paint(new T.BoxGeometry(3.3,.42,.3).translate(0,-.06,-.17),0xe6dcc6)];
 clump(out,[0,.2,-.24],{r:.6,rnd:r,leaves:0,detail:0,squash:.5,palette:[GREENS.mid,GREENS.bright,GREENS.lime]});
 for(let k=0;k<5;k++)for(let i=1;i<=4;i++){const len=.45;out.push(orient(blade(len,len*.85,{segs:1,shape:SHAPES.heart,fold:.3,droop:.1,base:GREENS.mid,mid:GREENS.lime,tip:GREENS.bright}),[-1.3+k*.65,-.05-i*.5,-.4],-Math.PI/2+(r()-.5),-1.2,0));}
 distantCascade=mergeGeometries(out);out.forEach(x=>x.dispose());return distantCascade;
}
export function simplifyDistantGardens(distant){let triangles=0;distant.traverse(o=>{if(!o.isInstancedMesh||!/^P6_hanging_garden_/.test(o.name))return;o.geometry=distantCascadeTemplate();triangles+=o.geometry.attributes.position.count/3*o.count;});return triangles;}

// ---- Signature trees ------------------------------------------------------------------------------------------
// A broad, low-poly shade tree: a flared trunk forking into limbs, under a wide umbrella of faceted leaf clumps.
// The canopy shrinks until it clears every deck edge it rises past by 1.5 m (the overhanging upper decks).
function canopyFits(layout,t,spread,y0){
 for(const d of layout.decks){if(d.number<7||!d.atrium?.outline||d.y<y0+t.height*.35||d.y>y0+t.height+1)continue;
  const ring=d.atrium.outline,need=spread+1.5;
  for(let a=0;a<16;a++){const q=[t.x+Math.cos(a/16*Math.PI*2)*need,t.z+Math.sin(a/16*Math.PI*2)*need];if(!contains(ring,q))return false;}
  if(ring.some((p,i)=>distanceToSegment([t.x,t.z],p,ring[(i+1)%ring.length])<need))return false;}
 return true;
}
function signatureTree(out,t,y0,spread){
 const r=random(t.seed*977),bark=0x6e4a31,barkLight=0x8a6040,fork=t.height*.42;
 // Trunk: a bole only a little wider than its 0.44 m collider (phase6-programme.js keeps it), with a low root flare.
 out.push(paint(new T.CylinderGeometry(.25,.33,fork,9,2).translate(t.x,y0+fork/2,t.z),p=>new T.Color(bark).lerp(new T.Color(barkLight),(p.y-y0)/fork*.6).toArray()));
 for(let k=0;k<5;k++){const a=k/5*Math.PI*2+r(),l=.9+r()*.5;out.push(stem([[t.x,y0+.5,t.z],[t.x+Math.cos(a)*l*.5,y0+.12,t.z+Math.sin(a)*l*.5],[t.x+Math.cos(a)*l,y0-.02,t.z+Math.sin(a)*l]],.12,bark,5));}
 const limbs=4+(r()*2|0),tips=[];
 for(let k=0;k<limbs;k++){
  const a=k/limbs*Math.PI*2+r()*.6,reach=spread*(.55+r()*.25),rise=t.height*(.68+r()*.14),c=Math.cos(a),s=Math.sin(a);
  const tip=[t.x+c*reach,y0+rise,t.z+s*reach];tips.push(tip);
  out.push(stem([[t.x,y0+fork-.4,t.z],[t.x+c*reach*.35,y0+fork+(rise-fork)*.45,t.z+s*reach*.35],[t.x+c*reach*.75,y0+rise-.4,t.z+s*reach*.75],tip],.2,bark,6));
  // A twig or two off each limb, into the crown.
  for(let j=0;j<2;j++){const f=.5+j*.25,from=[t.x+c*reach*f,y0+fork+(rise-fork)*(.55+j*.2),t.z+s*reach*f],b=a+(j?.7:-.7),to=[from[0]+Math.cos(b)*spread*.3,from[1]+1.1,from[2]+Math.sin(b)*spread*.3];tips.push(to);out.push(stem([from,to],.08,bark,4));}
 }
 // Canopy: a wide, slightly domed umbrella of clumps, densest over the limb tips, light on top and dark beneath.
 const top=y0+t.height,palette=[GREENS.mid,GREENS.bright,GREENS.bright,GREENS.lime];
 for(const tip of tips)clump(out,[tip[0],tip[1]+.5,tip[2]],{r:1.3+r()*.5,rnd:r,palette,squash:.62,leaves:2});
 const n=Math.round(14+spread*2.5);
 for(let k=0;k<n;k++){const a=r()*Math.PI*2,d=spread*Math.sqrt(r())*.92,h=top-1.4-(d/spread)**2*2.2+r()*.6;
  clump(out,[t.x+Math.cos(a)*d,h,t.z+Math.sin(a)*d],{r:1.05+r()*.65,rnd:r,palette,squash:.6,leaves:1});}
}
export function addSignatureTrees(out,layout){
 const y0=layout.decks[5].y,trees=[];
 for(const t of ATRIUM_SIGNATURE_TREES){let spread=t.spread;while(spread>3&&!canopyFits(layout,t,spread,y0))spread-=.25;
  signatureTree(out,t,y0,spread);trees.push({id:t.id,spread,height:t.height});}
 return trees;
}

// ---- Lake stones ------------------------------------------------------------------------------------------------
// Pale faceted stones in loose groups along the lake's boulevard edge and round the dry garden, sitting in the
// shallow water (bed 16 cm down). A stone goes only where it is in the water and clear of every atrium fit-out part
// (bridge, sign posts, planters, reeds, the reflection terraces).
function stone(out,[x,y,z],size,r){
 const g=new T.IcosahedronGeometry(1,0),p=g.attributes.position,jit=new Map(),sx=size*(1.1+r()*.25),sz=size*(.8+r()*.25);
 // One jitter per original corner (the geometry is non-indexed), so neighbouring faces stay welded.
 for(let i=0;i<p.count;i++){const key=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3);if(!jit.has(key))jit.set(key,.85+r()*.3);const k=jit.get(key);p.setXYZ(i,p.getX(i)*sx*k,Math.max(-.2,p.getY(i))*size*.5*k,p.getZ(i)*sz*k);}
 g.rotateY(r()*Math.PI);g.computeVertexNormals();
 const tones=[0xd9d2c3,0xcfc7b6,0xe3ddd0,0xc4bba9],tone=new T.Color(tones[r()*tones.length|0]).toArray();out.push(paint(g.translate(x,y,z),()=>tone));
}
// Every Deck 6 fit-out part as a circle (its larger half-extent plus 0.6 m), for keeping the garden pieces clear.
let footprints;
function fitoutFootprints(layout){return footprints??=phase6Programme(layout).parts.filter(p=>p.deck===6).map(p=>({x:p.at[0],z:p.at[2],part:p.part,r:Math.max(p.size[0],p.size[2])/2+.6}));}
export function addLakeStones(out,layout){
 const y=layout.decks[5].y,r=random(6061),[bx0,bx1]=ATRIUM_LAKE_BRIDGE.bounds,lake=phase6LakePolygon(layout.decks[5].atrium.outline),islands=phase6LakeIslands();let count=0;
 const parts=fitoutFootprints(layout);
 const inIsland=(x,z)=>islands.some(q=>x>q[0][0]-.15&&x<q[1][0]+.15&&z>q[0][1]-.15&&z<q[2][1]+.15);
 const clear=(x,z)=>x>bx0-1.5&&x<bx1+1.5||!contains(lake,[x,z])||inIsland(x,z)||nearWaterfall(layout,x,z,2)||parts.some(p=>Math.hypot(p.x-x,p.z-z)<p.r);
 for(let x=6;x<119;x+=4+r()*4){const n=2+(r()*3|0);for(let k=0;k<n;k++){const sx=x+k*(.7+r()*.5),sz=-6.55-r()*.7;if(clear(sx,sz))continue;stone(out,[sx,y-.08,sz],.32+r()*.3,r);count++;}}
 // Round the dry garden island, leaving its approach open.
 const [x0,x1,z0,z1]=[6,18,-48,-40],per=2*((x1-x0)+(z1-z0));
 for(let k=0;k<26;k++){const d=k/26*per;let px,pz;
  if(d<x1-x0){px=x0+d;pz=z1+.45;}else if(d<x1-x0+z1-z0){px=x1+.45;pz=z1-(d-(x1-x0));}else if(d<2*(x1-x0)+z1-z0){px=x1-(d-(x1-x0)-(z1-z0));pz=z0-.45;}else{px=x0-.45;pz=z0+(d-2*(x1-x0)-(z1-z0));}
  if(Math.abs(px-12)<2.2&&pz<z0+.1||r()<.3||clear(px,pz))continue;stone(out,[px+(r()-.5)*.3,y-.08,pz+(r()-.5)*.3],.3+r()*.35,r);count++;}
 return {stones:count};
}

// ---- Timber decks -----------------------------------------------------------------------------------------------
// Two rounded timber decks under the food hall's outer table courts: 3 cm boards, each a slightly different tone, laid
// along the ship, on top of the paving (walkers and furniture stand where they always did).
export const ATRIUM_TIMBER_DECKS=[{x0:22,x1:56,z0:35.4,z1:55.2,round:4},{x0:-72,x1:-44,z0:35.4,z1:55.2,round:4}];
function timberDeck(out,{x0,x1,z0,z1,round},y,r){
 const board=.3,tones=[0xa8794f,0xb3865b,0x9d7049,0xae8155];
 for(let z=z0+board/2;z<z1;z+=board){const dz=Math.max(0,round-Math.min(z-z0,z1-z)),inset=round-Math.sqrt(Math.max(0,round*round-dz*dz)),a=x0+inset,b=x1-inset;
  // Boards break at staggered joints every few metres.
  let x=a;while(x<b-.05){const len=Math.min(b-x,2.4+r()*2.2);out.push(paint(new T.BoxGeometry(len-.01,.03,board-.012).translate(x+len/2,y+.015,z),tones[r()*tones.length|0]));x+=len;}}
}
export function addTimberDecks(out,layout){const y=layout.decks[5].y,r=random(3301);for(const d of ATRIUM_TIMBER_DECKS)timberDeck(out,d,y,r);return {decks:ATRIUM_TIMBER_DECKS.length};}

// ---- Lake: lily pads, a rock waterfall, flowering shrubs ----------------------------------------------------------
// The waterfall stands in the shallow lake against its far (hull-side) bank: a mound of pale faceted rocks with two
// tiers of falling water (opaque, vertex-coloured sheets) and a ring of foam where it meets the lake. The reeds that
// stood there give way (phase6-programme.js); like them and the stones, it is visual only.
// Inside the waterfall's footprint plus a margin (its rocks reach about 3 m out from the bank).
function nearWaterfall(layout,x,z,m){const{x:wx,width}=ATRIUM_WATERFALL,edge=lakeSouthEdge(phase6LakePolygon(layout.decks[5].atrium.outline),wx);return Math.abs(x-wx)<width/2+m&&z<edge+3.4+m;}
function lakeSouthEdge(lake,x){return lake.filter(q=>Math.abs(q[0]-x)<.26&&q[1]<-10).reduce((z,q)=>Math.max(z,q[1]),-56);}
function waterSheet(out,x0,x1,top,bottom,z,lean){
 const g=new T.PlaneGeometry(x1-x0,top-bottom,6,4),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const k=((top-bottom)/2-p.getY(i))/(top-bottom);p.setZ(i,lean*k*k+Math.sin(p.getX(i)*3.1)*.03);}
 g.translate((x0+x1)/2,(top+bottom)/2,z);g.computeVertexNormals();
 out.push(paint(g,q=>new T.Color(0xf4fbfd).lerp(new T.Color(0x8fd0dc),Math.min(1,(top-q.y)/(top-bottom))*.75).toArray()));
}
export function addWaterfall(out,layout){
 const y=layout.decks[5].y,r=random(4477),lake=phase6LakePolygon(layout.decks[5].atrium.outline),{x,width}=ATRIUM_WATERFALL,z0=lakeSouthEdge(lake,x)+.4;
 // Rocks: a back wall of big stones, a ledge, and loose boulders at the foot.
 for(let k=0;k<7;k++)stone(out,[x-width/2+.5+k*(width-1)/6,y+1.1+r()*.6,z0+.6],1.1+r()*.5,r);
 for(let k=0;k<5;k++)stone(out,[x-width/2+1+k*(width-2)/4,y+2.6+r()*.3,z0+.4],.9+r()*.35,r);
 for(let k=0;k<6;k++)stone(out,[x-width/2+.8+k*(width-1.6)/5+(r()-.5)*.4,y+.2,z0+2.1+r()*.6],.55+r()*.35,r);
 // Water: an upper fall from the top lip to the ledge, then a wider fall to the pool.
 waterSheet(out,x-1.1,x+1.1,y+3.15,y+1.75,z0+1.15,.35);
 waterSheet(out,x-1.7,x+1.7,y+1.8,y-.01,z0+1.65,.55);
 out.push(paint(new T.CircleGeometry(1.9,14).rotateX(-Math.PI/2).scale(1.3,1,.6).translate(x,y-.004,z0+2.35),0xeef8f8));
 // Ferns along the top and flowering shrubs at both ends.
 for(let k=0;k<4;k++)fern(out,[x-width/2+.8+k*(width-1.6)/3,y+3.2,z0+.4],{spread:.8,fronds:6,pairs:4,rnd:r,droop:1.1});
 for(const dx of[-width/2-.3,width/2+.3])flowerBush(out,[x+dx,y-.05,z0+1.6],{spread:.9,rnd:r,color:BLOOMS[0],blooms:10});
 return {x,z:z0,width};
}
// Lily pads: notched discs in loose drifts on the open water, a few pink lotus flowers among them.
export function addLilyPads(out,layout,clear){
 const y=layout.decks[5].y,r=random(7123);let pads=0,flowers=0;
 for(const[cx,cz]of[[30,-30],[44,-20],[78,-38],[96,-24],[108,-44],[24,-50],[66,-48]])for(let k=0;k<14;k++){
  const a=r()*Math.PI*2,d=Math.sqrt(r())*3.2,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d,s=.32+r()*.28,turn=r()*Math.PI*2,tone=[GREENS.mid,GREENS.bright,0x5f9a45][r()*3|0],bloom=r()<.22;if(clear(x,z,s+.2))continue;
  out.push(paint(new T.CircleGeometry(s,9,.35,Math.PI*2-.35).rotateX(-Math.PI/2).rotateY(turn).translate(x,y-.003,z),tone));pads++;
  if(bloom){flower(out,[x,y+.04,z],{r:.13,color:BLOOMS[0],tilt:.15,yaw:turn});flowers++;}}
 return {pads,flowers};
}
// Flowering shrubs at the foot of each signature tree, clear of its trunk, planters and benches.
export function addTreeBeds(out,layout,clear){
 const y=layout.decks[5].y,r=random(5150);let bushes=0;
 for(const t of ATRIUM_SIGNATURE_TREES)for(let k=0;k<7;k++){const a=k/7*Math.PI*2+r(),d=1.6+r()*1.2,x=t.x+Math.cos(a)*d,z=t.z+Math.sin(a)*d,spread=.55+r()*.25;if(clear(x,z,.7))continue;
  flowerBush(out,[x,y,z],{spread,rnd:r,color:BLOOMS[[0,1,0,3][k%4]],blooms:7});bushes++;}
 return {bushes};
}

// ---- Soffits ------------------------------------------------------------------------------------------------------
// A cream sheet just under every overhang: the part of deck d's slab that hangs over deck d-1's open atrium. The baked
// deck slabs (their underside is 0.36 m below the deck's floor) keep their shared finish; this sheet sits 5 mm under
// them, only over open air, so it is seen from the atrium and never from inside a room. Built per 0.5 m column by
// scanline: inside deck d-1's atrium outline, minus deck d's own atrium outline and slab holes (stairs, lifts).
const SOFFIT_DROP=.365,COLUMN=.5;
function crossings(poly,x){const z=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[0]<=x)!==(b[0]<=x))z.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));}z.sort((p,q)=>p-q);const out=[];for(let i=0;i+1<z.length;i+=2)out.push([z[i],z[i+1]]);return out;}
function subtract(list,cut){let out=list;for(const[c0,c1]of cut)out=out.flatMap(([a,b])=>c1<=a||c0>=b?[[a,b]]:[[a,Math.min(b,c0)],[Math.max(a,c1),b]].filter(([p,q])=>q-p>.02));return out;}
export function addSoffits(root,layout){
 const pos=[];let area=0;
 for(const d of layout.decks){
  if(d.number<7||d.number>16||!d.atrium?.outline)continue;const below=layout.decks[d.number-2]?.atrium?.outline;if(!below)continue;
  const y=d.y-SOFFIT_DROP,holes=(d.slab?.holes||[]).map(h=>h.polygon),xs=below.map(p=>p[0]),x0=Math.min(...xs),x1=Math.max(...xs);
  for(let x=Math.floor(x0/COLUMN)*COLUMN;x<x1;x+=COLUMN){const xm=x+COLUMN/2;
   let spans=subtract(crossings(below,xm),crossings(d.atrium.outline,xm));for(const h of holes)spans=subtract(spans,crossings(h,xm));
   for(const[z0,z1]of spans){area+=(z1-z0)*COLUMN;
    // Two triangles facing down.
    pos.push(x,y,z0, x+COLUMN,y,z0, x,y,z1, x+COLUMN,y,z0, x+COLUMN,y,z1, x,y,z1);}
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 const o=new T.Mesh(g,atriumSoffitMaterial);o.name='P6_atrium_soffits';o.frustumCulled=false;o.userData={noCollide:true,phase6Architecture:true,selectedDesign:'4B',gardenDecor:true};root.add(o);
 return {soffitArea:Math.round(area),soffitTriangles:pos.length/9};
}

// ---- Glow: warm downlights under the overhanging deck soffits, lanterns on the timber decks ---------------------
export const gardenGlowMaterial=new T.MeshBasicMaterial({name:'P6_atrium_glow',color:0xffe3b8});
// The cream soffit sheets (addSoffits) read warm and light, as in the concept, rather than grey or navy. The emissive
// floor holds them up whatever the room light does; the Basic distant copy keeps the cream colour.
export const atriumSoffitMaterial=new T.MeshStandardMaterial({name:'V2_atrium_soffit',color:0xe7dfd0,roughness:.85,emissive:0xf1e4cc,emissiveIntensity:.3});
export function addDownlights(root,layout){
 const mats=[];
 for(const d of layout.decks){
  if(d.number<7||d.number>16||!d.atrium?.outline)continue;const below=layout.decks[d.number-2]?.atrium?.outline;if(!below)continue;
  const full=d.atrium.outline,ring=simplifyRing(full);
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<SLOT)continue;
   const ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];let nx=-uz,nz=ux;if(!contains(full,[mid[0]+nx*.5,mid[1]+nz*.5])){nx=-nx;nz=-nz;}
   for(let t=SLOT;t<len-.5;t+=SLOT){const x=a[0]+ux*t-nx*1.1,z=a[1]+uz*t-nz*1.1;
    // Only where the soffit is open to the atrium below (an overhang), never over a cabin or room under the slab.
    if(!contains(below,[x,z])||!contains(below,[x-nx*.6,z-nz*.6]))continue;
    mats.push(new T.Matrix4().makeTranslation(x,d.y-SOFFIT_DROP-.004,z));}
  }
 }
 const g=new T.CircleGeometry(.16,10).rotateX(Math.PI/2),o=new T.InstancedMesh(g,gardenGlowMaterial,Math.max(1,mats.length));
 mats.forEach((m,i)=>o.setMatrixAt(i,m));o.count=mats.length;o.name='P6_atrium_downlights';o.frustumCulled=false;o.computeBoundingBox();o.computeBoundingSphere();
 o.userData={noCollide:true,phase6Architecture:true,selectedDesign:'4B',gardenDecor:true};root.add(o);return {downlights:mats.length};
}
// Warm lanterns along the far rim of each timber deck.
function addDeckLanterns(out,glow,y){
 let n=0;
 for(const{x0,x1,z1}of ATRIUM_TIMBER_DECKS)for(let k=0;k<6;k++){const x=x0+5+k*(x1-x0-10)/5,z=z1-.6;
  out.push(paint(new T.BoxGeometry(.06,.5,.06).translate(x,y+.25,z),0x3b3530));
  glow.push(new T.BoxGeometry(.2,.26,.2).translate(x,y+.62,z));out.push(paint(new T.BoxGeometry(.24,.04,.24).translate(x,y+.77,z),0x3b3530));n++;}
 return n;
}

// One merged draw for the static garden pieces, one for the warm lanterns, plus the instanced cascades and downlights.
export function addAtriumGardens(root,layout){
 const y=layout.decks[5].y,lake=phase6LakePolygon(layout.decks[5].atrium.outline),islands=phase6LakeIslands(),parts=fitoutFootprints(layout),[bx0,bx1]=ATRIUM_LAKE_BRIDGE.bounds;
 const inIsland=(x,z,m)=>islands.some(q=>x>q[0][0]-m&&x<q[1][0]+m&&z>q[0][1]-m&&z<q[2][1]+m);
 const clearWater=(x,z,m)=>!contains(lake,[x,z])||inIsland(x,z,m)||x>bx0-m-1&&x<bx1+m+1||nearWaterfall(layout,x,z,3)||parts.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+m-.6);
 const clearGround=(x,z,m)=>parts.some(p=>p.part!=='p6_tree_trunk'&&Math.hypot(p.x-x,p.z-z)<p.r+m-.6)||ATRIUM_SIGNATURE_TREES.some(t=>Math.hypot(t.x-x,t.z-z)<1.1);
 const out=[],glow=[],trees=addSignatureTrees(out,layout),stones=addLakeStones(out,layout),decks=addTimberDecks(out,layout),waterfall=addWaterfall(out,layout),lily=addLilyPads(out,layout,clearWater),beds=addTreeBeds(out,layout,clearGround),lanterns=addDeckLanterns(out,glow,y+.03);
 const g=mergeGeometries(out);out.forEach(x=>x.dispose());g.computeBoundingBox();g.computeBoundingSphere();
 const o=new T.Mesh(g,gardenMaterial);o.name='P6_atrium_gardens';o.frustumCulled=false;o.userData={noCollide:true,phase6Architecture:true,selectedDesign:'4B',gardenDecor:true};root.add(o);
 const gg=mergeGeometries(glow.map(x=>x.toNonIndexed()));glow.forEach(x=>x.dispose());gg.computeBoundingBox();gg.computeBoundingSphere();
 const lo=new T.Mesh(gg,gardenGlowMaterial);lo.name='P6_atrium_lanterns';lo.frustumCulled=false;lo.userData={...o.userData};root.add(lo);
 const cascades=addHangingGardens(root,layout),downlights=addDownlights(root,layout),soffits=addSoffits(root,layout);
 return {trees,...stones,...decks,waterfall,...lily,...beds,lanterns,...downlights,...soffits,staticTriangles:g.attributes.position.count/3,cascades};
}
