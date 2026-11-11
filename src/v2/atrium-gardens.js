// 4B "Hanging gardens" for the Deck 6 atrium: planting cascading from the slab edges of Decks 7–20 (a continuous
// strip on 7–16, irregular clusters above), cream fascias on those edges, four signature trees, stones along the lake
// edge and timber decks in the food hall; and the boulevard's stone inlays and planter trims (concept B).
// Everything is visual only (noCollide) and lives in the atrium facade root, so the walk, its colliders, seats and
// routes, and the atrium PVS key are untouched. One opaque vertex-coloured material (no transparency, no textures):
// the Basic-material swap of the distant and phone copies keeps vertex colours and instancing, so it survives. The
// exceptions, each with its own draw: the warm glow (lanterns, bulbs, downlights), the tree shade decal and the
// waterfall's streak texture.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GREENS,BLOOMS,SHAPES,paint,stem,clump,flower,blade,orient,fern,flowerBush,tuft,aroid,palm} from '../walk/foliage.js';
import {ATRIUM_TERRACES,ATRIUM_ZONES,ATRIUM_SIGNATURE_TREES,ATRIUM_LAKE_BRIDGE,ATRIUM_WATERFALL,ATRIUM_GARDEN_POCKETS,ATRIUM_BOULEVARD_TREES,ATRIUM_TIMBER_DECKS,ATRIUM_FESTOONS,phase6LakePolygon,phase6LakeIslands,phase6LakeShore,phase6ParkPath} from '../plan/atrium-v2.js';
import {paintTreeShade,SHADE_HALVES,PAVER} from './atrium-daylight.js';
import {walkCanvas} from '../walk/canvas.js';
import {phase6Programme} from './phase6-programme.js';
import {addStageDecor} from './atrium-stage.js';
import {contains,distanceToSegment} from '../plan/geometry-v2.js';

export const gardenMaterial=new T.MeshStandardMaterial({name:'P6_atrium_gardens',color:0xffffff,vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:.82});
const random=seed=>{let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
const OUT=-Math.PI/2; // foliage.js yaw for local -z, the atrium side of a planter.

// ---- Cascades -------------------------------------------------------------------------------------------------
// A planter hung on the outer face of a deck's slab edge, over the atrium (local frame: x along the edge, y up from
// the deck floor, the void toward -z), with planting spilling over it and vines trailing down the fascia and past it.
// Every deck facing the atrium, 7 to 20. They hang on each slab edge and cross none of the void (decisions-v2.json,
// atrium-centre-clear, keeps walkways and solid parts out of it above Deck 16).
// Decks 7–16 (S2 concept B, garden terraces) carry a planter strip along every slab edge: one trough per slot,
// stretched to fill its run, broken by clustered gaps where the cream fascia shows (more of them higher up) and
// where the tower, its bridges or a dining apron meet the edge. The planting thins upward: mostly the lush variant on
// Decks 7–8, mostly medium and light from Deck 12, chosen in clustered runs so no deck reads as a uniform stripe.
// Decks 17–20 keep the irregular runs.
const CASCADE_DECKS=[7,20],STRIP_DECKS=[7,16],SLOT=3.6,LIGHT_BY=5;
const DENSE=0,MEDIUM=1,LIGHT=2;
const TROUGH=0xe3d5bb;
// A leaf seen from across the atrium: one folded diamond (two triangles), along +x from the origin like a blade.
function leaf(len,wid,base,tip){
 const w=wid/2,fold=w*.35,p=[0,0,0,len*.45,fold,-w,len,0,0, 0,0,0,len,0,0,len*.45,fold,w];
 const a=new T.Color(base),b=new T.Color(tip),c=[];for(const v of[a,b,b,a,b,b])c.push(v.r,v.g,v.b);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));
 g.computeVertexNormals();g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(12),2));return g;
}
// A trailing vine: leaves alternating down a swaying line (no stem tube; at these distances the leaves carry it),
// largest at the top, the odd flower among them.
function vine(out,[x,y,z],length,r,flowers){
 const n=Math.max(2,Math.round(length/.42)),phase=r()*6;
 for(let i=1;i<=n;i++){const t=i/n,len=.5+.22*(1-t)+r()*.08,p=[x+Math.sin(phase+t*3)*.12*t,y-length*t,z-.06*t+Math.cos(phase+t*2.3)*.07*t];
  out.push(orient(leaf(len,len*.85,GREENS.mid,i%3?GREENS.bright:GREENS.lime),p,phase+i*2.4,-.6-r()*.5,(r()-.5)*.6));
  if(r()<flowers)blossom(out,[p[0]+(r()-.5)*.12,p[1]+.02,p[2]-.2],.2,blossomColor(r));}
}
// A flower seen from the atrium floor: two crossed cards (four triangles), one level and one hanging, so it shows from
// below and from across the atrium. Stronger pinks than the bush flowers, so they read against the cream walls.
const BLOSSOMS=[0xfbf8f2,0xfbf8f2,0xee8fae,0xf5b7c8];
const blossomColor=r=>BLOSSOMS[Math.floor(r()*BLOSSOMS.length)];
function blossom(out,[x,y,z],size,color){
 out.push(orient(leaf(size,size,color,color),[x,y,z+size/2],OUT,0,0),orient(leaf(size,size*.9,color,color),[x,y+size/2,z],OUT,-Math.PI/2,0));
}
// The leafy mass hanging over the trough's face: rows of large leaves pointing down, darker toward the back, so the
// strip reads as a thick green band below the edge, as in the concept. Blossoms hang in front of it.
function curtain(out,from,to,rows,r){
 rows.forEach((n,row)=>{for(let k=0;k<n;k++){const x=from+(to-from)*(k+.5+(row%2)*.5)/(n+(row%2)*.5)+(r()-.5)*.15,len=.6+r()*.18;
  out.push(orient(leaf(len,len*.75,row?GREENS.dark:GREENS.mid,k%3?GREENS.bright:GREENS.lime),[x,.08-row*.42,-.4-row*.05-r()*.06],OUT+(r()-.5)*.9,-1.15-r()*.3,(r()-.5)*.5));}});
}
// Lush (low decks), medium and light (high decks): fewer and shorter vines, a thinner curtain, fewer blossoms, and
// the light one's foliage gathered to one end of its trough.
const CASCADE_VARIANTS=[
 {clumps:4,curtain:[11,9],vines:7,trail:2,lip:7,blossoms:20,onVines:.3,span:1},
 {clumps:3,curtain:[8,5],vines:5,trail:1.5,lip:5,blossoms:12,onVines:.2,span:1},
 {clumps:2,curtain:[4,3],vines:3,trail:1.1,lip:3,blossoms:5,onVines:.14,span:.55},
];
function cascadeTemplate(variant){
 const v=CASCADE_VARIANTS[variant],r=random(9100+variant*77),out=[],w=SLOT/2,from=-w+.25,to=-w+.25+(SLOT-.5)*v.span;
 const at=k=>from+(to-from)*k;
 // The trough: cream stone, its full slot long (so neighbours abut), sitting on the slab edge, outside the guard.
 out.push(paint(new T.BoxGeometry(SLOT,.26,.28,4,1,1).translate(0,.15,-.19),TROUGH));
 for(let k=0;k<v.clumps;k++)clump(out,[at((k+.5)/v.clumps)+(r()-.5)*.25,.28,-.22],{r:.46+r()*.1,rnd:r,leaves:0,detail:0,squash:.5,palette:[GREENS.dark,GREENS.mid,GREENS.bright,GREENS.lime]});
 // Leaves arching over the lip, so the trough edge disappears under foliage as in the concept.
 for(let k=0;k<v.lip;k++)out.push(orient(leaf(.6+r()*.18,.3,GREENS.mid,GREENS.lime),[at((k+.5)/v.lip)+(r()-.5)*.2,.27,-.34],OUT+(r()-.5)*.8,-.5-r()*.5,0));
 curtain(out,from,to,v.curtain,r);
 for(let k=0;k<v.vines;k++)vine(out,[at((k+.5)/v.vines)+(r()-.5)*.2,-.3,-.45],v.trail*(.6+r()*.5),r,v.onVines);
 // Blossoms scattered over the front of the curtain, where the floor sees them.
 const drop=.42*v.curtain.length;
 for(let k=0;k<v.blossoms;k++)blossom(out,[at((k+r())/v.blossoms),.1-r()*drop,-.78-r()*.1],.2+r()*.06,blossomColor(r));
 const g=mergeGeometries(out);out.forEach(x=>x.dispose());return g;
}
// Smooth value noise along each deck edge, so planters come in runs and gaps rather than a pattern.
function noise1(seed){const r=random(seed),v=Array.from({length:64},r);return x=>{const i=Math.floor(x),f=x-i,s=f*f*(3-2*f),a=v[((i%64)+64)%64],b=v[(((i+1)%64)+64)%64];return a+(b-a)*s;};}
// The slab edge without its 0.5 m sampling jitter (the same reduction the facade plates use).
function simplifyRing(poly,tol=.1){const pts=[...poly,poly[0]],reduce=p=>{if(p.length<3)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;let best=tol,index=-1;for(let i=1;i<p.length-1;i++){const t=l?Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dz)/l)):0,d=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dz);if(d>best){best=d;index=i;}}return index<0?[a,b]:[...reduce(p.slice(0,index+1)).slice(0,-1),...reduce(p.slice(index))];};return reduce(pts).slice(0,-1);}
// Where the tower, its bridges and the dining aprons meet a deck's edge (their footprints, grown 0.3 m): no
// planter or fascia there.
function edgeReservations(layout,d){
 const box=p=>{const xs=p.map(q=>q[0]),zs=p.map(q=>q[1]);return[Math.min(...xs)-.3,Math.max(...xs)+.3,Math.min(...zs)-.3,Math.max(...zs)+.3];};
 const parts=[...layout.circulation.towers,...layout.circulation.bridges,...ATRIUM_TERRACES].filter(t=>t.deck===d.number);
 const boxes=parts.map(t=>box(t.polygon));return p=>boxes.some(b=>p[0]>=b[0]&&p[0]<=b[1]&&p[1]>=b[2]&&p[1]<=b[3]);
}
// The strip's slots on one deck: each run of the edge (simplified) cut into equal slots of about SLOT; on curves,
// consecutive short runs are gathered into chords of at least 1.2 m first.
function stripSlots(ring){
 const slots=[],dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]),lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const place=(a,b)=>{const n=Math.max(1,Math.round(dist(a,b)/SLOT));for(let k=0;k<n;k++)slots.push([lerp(a,b,k/n),lerp(a,b,(k+1)/n)]);};
 let acc=null;const flush=()=>{if(acc&&dist(...acc)>=.6)place(...acc);acc=null;};
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];
  if(dist(a,b)>=1.2){flush();place(a,b);continue;}
  acc=acc?[acc[0],b]:[a,b];if(dist(...acc)>=1.2)flush();}
 flush();return slots;
}
function addPlanterStrip(chosen,d,reserved){
 const full=d.atrium.outline,noise=noise1(700+d.number*17),gaps=noise1(900+d.number*29),t=Math.min(1,(d.number-STRIP_DECKS[0])/LIGHT_BY);
 const pDense=.8-.75*t,pLight=.04+.56*t,pGap=.3+.2*t;let along=0;
 for(const[a,b]of stripSlots(simplifyRing(full))){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;along+=len;
  if(gaps(along/11)<pGap)continue;
  let nx=-uz,nz=ux;if(!contains(full,[x+nx*.5,z+nz*.5])){nx=-nx;nz=-nz;}
  if([a,b,[x,z]].some(p=>reserved([p[0]+nx*.2,p[1]+nz*.2])))continue;
  const h=Math.abs(Math.sin(x*12.9898+d.number*78.233+z*3.1)*43758.5453)%1,u=noise(along/14)*.65+h*.35;
  const variant=u<pDense?DENSE:u>1-pLight?LIGHT:MEDIUM,flip=(h*17)%1<.5?-1:1;
  const m=new T.Matrix4().makeRotationY(Math.atan2(-nx,-nz)).setPosition(x+nx*.02,d.y,z+nz*.02);
  m.multiply(new T.Matrix4().makeScale(flip*len/SLOT,.85+((h*7)%1)*.35-t*.2*((h*13)%1),1));
  chosen[variant].push(m);
 }
}
export function addHangingGardens(root,layout){
 const chosen=[[],[],[]];
 for(const d of layout.decks){
  if(d.number<CASCADE_DECKS[0]||d.number>CASCADE_DECKS[1]||!d.atrium?.outline)continue;
  if(d.number<=STRIP_DECKS[1]){addPlanterStrip(chosen,d,edgeReservations(layout,d));continue;}
  const full=d.atrium.outline,ring=simplifyRing(full),noise=noise1(500+d.number*13);let along=0;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<SLOT){along+=len;continue;}
   const ux=(b[0]-a[0])/len,uz=(b[1]-a[1])/len,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];let nx=-uz,nz=ux;if(!contains(full,[mid[0]+nx*.5,mid[1]+nz*.5])){nx=-nx;nz=-nz;}
   const slots=Math.floor(len/SLOT),pad=(len-slots*SLOT)/2;
   for(let k=0;k<slots;k++){
    const t=pad+(k+.5)*SLOT,x=a[0]+ux*t,z=a[1]+uz*t,h=Math.abs(Math.sin(x*12.9898+d.number*78.233+z*3.1)*43758.5453)%1;
    if(noise((along+t)/16)<.66&&h>.06)continue; // runs of ~2–6 planters, the odd single one between them
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
 const r=random(9900),out=[paint(new T.BoxGeometry(SLOT,.26,.28,4,1,1).translate(0,.15,-.19),TROUGH)];
 clump(out,[0,.32,-.22],{r:.6,rnd:r,leaves:0,detail:0,squash:.5,palette:[GREENS.mid,GREENS.bright,GREENS.lime]});
 for(let k=0;k<6;k++){for(let i=0;i<3;i++)out.push(orient(leaf(.7,.55,i?GREENS.dark:GREENS.mid,GREENS.bright),[-1.5+k*.6,.08-i*.5,-.45],-Math.PI/2+(r()-.5),-1.2,0));
  blossom(out,[-1.5+k*.6+.2,-.2-(k%3)*.25,-.8],.3,blossomColor(r));}
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
 for(const tip of tips)clump(out,[tip[0],tip[1]+.5,tip[2]],{r:1.3+r()*.5,rnd:r,palette,squash:.62,leaves:5});
 const n=Math.round(14+spread*2.5);
 for(let k=0;k<n;k++){const a=r()*Math.PI*2,d=spread*Math.sqrt(r())*.92,h=top-1.4-(d/spread)**2*2.2+r()*.6;
  clump(out,[t.x+Math.cos(a)*d,h,t.z+Math.sin(a)*d],{r:1.05+r()*.65,rnd:r,palette,squash:.6,leaves:4});}
 // A lower, darker skirt of smaller clumps under the umbrella, for depth.
 for(let k=0;k<Math.round(spread*2);k++){const a=r()*Math.PI*2,d=spread*(.5+r()*.4);clump(out,[t.x+Math.cos(a)*d,top-3.2+r()*.6,t.z+Math.sin(a)*d],{r:.7+r()*.3,rnd:r,palette:[GREENS.deep,GREENS.dark,GREENS.mid],squash:.6,leaves:2});}
}
// The park grove and garden-pocket trees: a small faceted canopy on each existing 2.8 m trunk (which stays the
// collider), at the canopy height phase6-programme.js gives it (pocket trees by pocket, grove trees 4.4 m).
export function addGroveTrees(out,layout){
 const y0=layout.decks[5].y;let n=0;
 for(const p of fitoutFootprints(layout)){
  if(p.part!=='p6_tree_trunk'||ATRIUM_SIGNATURE_TREES.some(t=>Math.hypot(t.x-p.x,t.z-p.z)<.01))continue;
  const pocket=ATRIUM_GARDEN_POCKETS.find(q=>Math.abs(q.z-1.1-p.z)<.01&&(Math.abs(q.x-p.x)<.01||Math.abs(q.x-3.5-p.x)<.01))??boulevardTree(p),h=pocket?pocket.canopyHeight:4.4;
  const r=random(Math.round(p.x*31+p.z*17)>>>0),top=y0+h,palette=[GREENS.mid,GREENS.bright,GREENS.bright,GREENS.lime];
  for(let k=0;k<3;k++){const a=k/3*Math.PI*2+r(),c=Math.cos(a),s=Math.sin(a);out.push(stem([[p.x,y0+2.3,p.z],[p.x+c*.5,top-1.5,p.z+s*.5],[p.x+c*1.1,top-.9,p.z+s*1.1]],.08,0x6e4a31,4));}
  for(let k=0;k<8;k++){const a=k/8*Math.PI*2+r()*.5,d=k?1+r()*.5:0,ht=top-.7-(d/1.6)**2*.6+r()*.3;clump(out,[p.x+Math.cos(a)*d,ht,p.z+Math.sin(a)*d],{r:.85+r()*.35,rnd:r,palette,squash:.62,leaves:3});}
  n++;
 }
 return {groveTrees:n};
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
// `tall` scales its height and `floor` flattens its underside (the waterfall's rocks are rounder than these).
function stone(out,[x,y,z],size,r,tall=.5,floor=-.2){
 const g=new T.IcosahedronGeometry(1,0),p=g.attributes.position,jit=new Map(),sx=size*(1.1+r()*.25),sz=size*(.8+r()*.25);
 // One jitter per original corner (the geometry is non-indexed), so neighbouring faces stay welded.
 for(let i=0;i<p.count;i++){const key=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3);if(!jit.has(key))jit.set(key,.85+r()*.3);const k=jit.get(key);p.setXYZ(i,p.getX(i)*sx*k,Math.max(floor,p.getY(i))*size*tall*k,p.getZ(i)*sz*k);}
 g.rotateY(r()*Math.PI);g.computeVertexNormals();
 const tones=[0xd9d2c3,0xcfc7b6,0xe3ddd0,0xc4bba9],tone=new T.Color(tones[r()*tones.length|0]).toArray();out.push(paint(g.translate(x,y,z),()=>tone));
}
// Every Deck 6 fit-out part (and planting bed) as a circle (its larger half-extent plus 0.6 m), for keeping the garden pieces clear.
let footprints;
function fitoutFootprints(layout){const p6=phase6Programme(layout);return footprints??=[...p6.parts,...p6.beds].filter(p=>p.deck===6).map(p=>({x:p.at[0],z:p.at[2],part:p.part,r:Math.max(p.size[0],p.size[2])/2+.6}));}
export function addLakeStones(out,layout){
 const y=layout.decks[5].y,r=random(6061),[bx0,bx1]=ATRIUM_LAKE_BRIDGE.bounds,lake=phase6LakePolygon(layout.decks[5].atrium.outline),islands=phase6LakeIslands();let count=0;
 const parts=fitoutFootprints(layout);
 const inIsland=(x,z)=>islands.some(q=>x>q[0][0]-.15&&x<q[1][0]+.15&&z>q[0][1]-.15&&z<q[2][1]+.15);
 const clear=(x,z)=>x>bx0-1.5&&x<bx1+1.5||!contains(lake,[x,z])||inIsland(x,z)||nearWaterfall(x,z,2)||parts.some(p=>Math.hypot(p.x-x,p.z-z)<p.r);
 for(let x=6;x<119;x+=4+r()*4){const n=2+(r()*3|0);for(let k=0;k<n;k++){const sx=x+k*(.7+r()*.5),sz=phase6LakeShore(sx)-.55-r()*.7;if(clear(sx,sz))continue;stone(out,[sx,y-.08,sz],.32+r()*.3,r);count++;}}
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
function timberDeck(out,{x0,x1,z0,z1,round},y,r){
 const board=.3,tones=[0xa8794f,0xb3865b,0x9d7049,0xae8155];
 for(let z=z0+board/2;z<z1;z+=board){const dz=Math.max(0,round-Math.min(z-z0,z1-z)),inset=round-Math.sqrt(Math.max(0,round*round-dz*dz)),a=x0+inset,b=x1-inset;
  // Boards break at staggered joints every few metres.
  let x=a;while(x<b-.05){const len=Math.min(b-x,2.4+r()*2.2);out.push(paint(new T.BoxGeometry(len-.01,.03,board-.012).translate(x+len/2,y+.015,z),tones[r()*tones.length|0]));x+=len;}}
}
export function addTimberDecks(out,layout){const y=layout.decks[5].y,r=random(3301);for(const d of ATRIUM_TIMBER_DECKS)timberDeck(out,d,y,r);return {decks:ATRIUM_TIMBER_DECKS.length};}

// ---- Planting beds -------------------------------------------------------------------------------------------
// Each atrium planter's fill and each lake-edge reed bed (phase6-programme.js beds): a row of faceted leaf clumps
// with flowers dotted through, or, for the low reed beds standing in the lake, tufts of tall grass.
export function addPlantingBeds(out,layout){
 const y=layout.decks[5].y,r=random(2468);let beds=0,reeds=0;
 for(const b of phase6Programme(layout).beds){
  const[w,h,d]=b.size,[cx,cy,cz]=b.at,base=cy-h/2,n=Math.max(1,Math.round(w/.6));
  if(cy-y<.5){for(let k=0;k<n*2;k++)tuft(out,[cx+(k/(n*2-1||1)-.5)*w*.9+(r()-.5)*.15,base+.2,cz+(r()-.5)*d*.6],{height:.7+r()*.4,blades:5,rnd:r});
   if(r()<.5)flower(out,[cx+(r()-.5)*w*.6,base+.75,cz],{r:.08,color:BLOOMS[2],yaw:r()*6,tilt:.3});reeds++;continue;}
  for(let k=0;k<n;k++){const x=cx+(n>1?(k/(n-1)-.5)*w*.78:0);if(k%3===1){aroid(out,[x,base+h*.4,cz],{size:Math.min(d,.95)*1.1,leaves:5,rnd:r});continue;}if(k%3===2){fern(out,[x,base+h*.45,cz],{spread:Math.min(d,.95)*.8,fronds:6,pairs:4,rnd:r});continue;}clump(out,[x+(r()-.5)*.1,base+h*.55,cz+(r()-.5)*.1],{r:Math.min(d,.95)*.5+r()*.08,rnd:r,leaves:2,detail:0,squash:.85,palette:[GREENS.dark,GREENS.mid,GREENS.bright,GREENS.lime]});}
  for(let k=0;k<Math.max(2,n);k++)flower(out,[cx+(r()-.5)*w*.8,base+h*.95+r()*.08,cz+(r()-.5)*d*.6],{r:.08+r()*.03,color:BLOOMS[[0,1,0,4,3][(beds+k)%5]],yaw:r()*6,tilt:.25});
  beds++;
 }
 return {beds,reedBeds:reeds};
}

// ---- Promenade inlays (concept B, "inlaid promenade") --------------------------------------------------------------
// The boulevard's travertine pavers are a texture on the paving (atrium-daylight.js), joints and all. Its inlays are
// thin vertex-coloured sheets 12 mm over the floor (the paving itself is lifted 6 mm at runtime), laid side by side and
// never stacked: a basalt band along both edges, under the avenue (|z| 4.875..6); a basalt centre stripe edged in brass
// (|z| < 0.975 in all); and a brass compass rose set into the stripe every 20 m, the first just ahead of the boulevard's
// aft end. Slabs are one paver (1.3 m) long, each a little different in tone, and kept only on solid floor. The arrival
// lobby takes the pavers alone.
const INLAY_X=[-96,148],STRIPE=.935,BRASS=.975,BAND=[4.875,6],ROSES={first:-84,last:116,every:20};
// The basalt is a dark neutral grey: under the atrium's light it renders about 116,103,94, the concept's stripe (about
// half the travertine's brightness). Each slab differs a little in tone, clouds softly from point to point, and is set off from the next by a 2 cm
// joint, so the stripe and bands read as laid stone rather than one flat strip.
const BASALT=[0x5d5550,0x57504b,0x625955,0x5a524d],JOINT=.02,JOINT_HEX=0x3a3531,BRASS_LINE=0xc9a253,BRASS_LIGHT=0xe6c473,BRASS_DARK=0xa07832,ROSE_GROUND=0x47413d;
// Stone clouding: a tone per vertex, hashed from its position, so cells and slabs that share a point share its tone.
const cloud=(x,z)=>{let h=Math.imul(Math.round(x*100),73856093)^Math.imul(Math.round(z*100),19349663);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296;};
// Flat triangles facing up, one colour each (or clouded per vertex), as one garden geometry.
function sheet(){
 const pos=[],col=[],c=new T.Color();
 return {
  tri(a,b,d,hex){c.set(hex);for(const p of[a,b,d]){pos.push(...p);col.push(c.r,c.g,c.b);}},
  quad(x0,z0,x1,z1,y,hex){this.tri([x0,y,z0],[x0,y,z1],[x1,y,z0],hex);this.tri([x1,y,z0],[x0,y,z1],[x1,y,z1],hex);},
  // A slab cut into nx by nz cells, its tone drifting by up to 8% either way between points.
  slab(x0,z0,x1,z1,y,hex,nx,nz){
   c.set(hex);const {r,g,b}=c,at=(x,z)=>{const k=1+(cloud(x,z)-.5)*.16;col.push(r*k,g*k,b*k);};
   for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=x0+(x1-x0)*i/nx,e=x0+(x1-x0)*(i+1)/nx,p=z0+(z1-z0)*j/nz,q=z0+(z1-z0)*(j+1)/nz;
    for(const[x,z]of[[a,p],[a,q],[e,p],[e,p],[a,q],[e,q]]){pos.push(x,y,z);at(x,z);}}
  },
  geometry(){const g=new T.BufferGeometry(),n=pos.length/3;g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
   g.setAttribute('normal',new T.Float32BufferAttribute(Array.from({length:n},()=>[0,1,0]).flat(),3));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(n*2),2));
   g.setAttribute('color',new T.Float32BufferAttribute(col,3));return g;},
 };
}
// A compass rose filling the stripe's width at x=cx: the stripe's stone out to the disc, a brass ring, and an
// eight-point star (long points along and across the ship), each point split light and dark, on darker stone. The
// rings and the ground share their 32 samples, so the pieces meet edge to edge.
function compassRose(s,cx,y,stone){
 const N=32,at=(r,a)=>[cx+Math.cos(a)*r,y,Math.sin(a)*r],sq=a=>at(STRIPE/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a))),a),turn=i=>i/N*Math.PI*2;
 for(let i=0;i<N;i++){const a=turn(i),b=turn(i+1);
  s.tri(at(.88,a),sq(a),sq(b),stone);s.tri(at(.88,a),sq(b),at(.88,b),stone);
  s.tri(at(.8,a),at(.88,a),at(.88,b),BRASS_LINE);s.tri(at(.8,a),at(.88,b),at(.8,b),BRASS_LINE);}
 const star=Array.from({length:16},(_,k)=>at(k%4===0?.72:k%2===0?.46:.15,k/16*Math.PI*2)),centre=[cx,y,0];
 for(let k=0;k<16;k+=2){s.tri(centre,star[(k+15)%16],star[k],BRASS_LIGHT);s.tri(centre,star[k],star[k+1],BRASS_DARK);}
 for(let k=0;k<16;k++){const c=at(.8,turn(2*k+1));s.tri(c,at(.8,turn(2*k)),star[k],ROSE_GROUND);s.tri(c,star[k],star[(k+1)%16],ROSE_GROUND);s.tri(c,star[(k+1)%16],at(.8,turn(2*k+2)),ROSE_GROUND);}
}
export function addPromenadeInlays(out,layout){
 const y=layout.decks[5].y+.012,floor=layout.decks[5].atrium.outline,holes=(layout.decks[5].slab?.holes||[]).map(h=>h.polygon),s=sheet(),r=random(4407),L=PAVER.length;
 const solid=(x,z)=>contains(floor,[x,z])&&!holes.some(h=>contains(h,[x,z])),run=(x,e,...zs)=>zs.every(z=>solid(x,z)&&solid(e,z));
 const roses=[];for(let x=ROSES.first;x<=ROSES.last;x+=ROSES.every)if(run(x-STRIPE,x+STRIPE,0,-.9,.9))roses.push(x);
 let slabs=0;
 for(let x=INLAY_X[0];x<INLAY_X[1]-.01;x+=L){
  const e=Math.min(INLAY_X[1],x+L),j=x+JOINT,stone=()=>BASALT[r()*BASALT.length|0];
  for(const side of[-1,1]){
   const[z0,z1]=side<0?[-BAND[1],-BAND[0]]:[BAND[0],BAND[1]];
   if(run(x,e,side*BAND[0],side*(BAND[1]-.05))){s.quad(x,z0,j,z1,y,JOINT_HEX);s.slab(j,z0,e,z1,y,stone(),3,3);slabs++;}
   if(run(x,e,side*BRASS))s.quad(x,side<0?-BRASS:STRIPE,e,side<0?-STRIPE:BRASS,y,BRASS_LINE);
  }
  // The stripe's slab, less any rose's square; a joint where it starts a slab (not where it leaves a rose).
  let pieces=[[x,e]];const tone=stone();
  for(const m of roses)pieces=pieces.flatMap(([a,b])=>b<=m-STRIPE||a>=m+STRIPE?[[a,b]]:[[a,Math.min(b,m-STRIPE)],[Math.max(a,m+STRIPE),b]].filter(([p,q])=>q-p>.01));
  for(const[a,b]of pieces)if(run(a,b,0,-.9,.9)){const from=a===x&&b>j?j:a;if(from>a)s.quad(a,-STRIPE,from,STRIPE,y,JOINT_HEX);s.slab(from,-STRIPE,b,STRIPE,y,tone,3,5);slabs++;}
 }
 for(const m of roses)compassRose(s,m,y,BASALT[0]);
 out.push(s.geometry());
 return {inlaySlabs:slabs,compassRoses:roses.length};
}

// ---- Planters (concept B) ----------------------------------------------------------------------------------------
// The atrium's box planters read as low stone planters (phase6-programme.js gives their collidable boxes, unchanged in
// size and place, a stone finish): a paler stone coping 4 cm proud all round, timber bench boards along both long edges
// and across the ends, dark soil between, and leaves spilling over the long sides. Visual only, like the beds.
export function addPlanterTrims(out,layout){
 const r=random(7717),wood=[0xa8794f,0xb3865b,0x9d7049,0xae8155],B=.26;let planters=0;
 for(const p of phase6Programme(layout).parts){
  if(p.deck!==6||p.part!=='garden_planter'||!p.room.startsWith('atrium6-'))continue;
  const[w,h,d]=p.size,[cx,cy,cz]=p.at,top=cy+h/2;
  out.push(paint(new T.BoxGeometry(w+.08,.06,d+.08).translate(cx,top+.01,cz),0xddd3c0));
  for(const s of[-1,1]){
   out.push(paint(new T.BoxGeometry(w,.06,B).translate(cx,top+.06,cz+s*(d-B)/2),wood[r()*wood.length|0]));
   out.push(paint(new T.BoxGeometry(B,.06,d-2*B).translate(cx+s*(w-B)/2,top+.06,cz),wood[r()*wood.length|0]));
  }
  out.push(paint(new T.BoxGeometry(w-2*B,.04,d-2*B).translate(cx,top+.05,cz),0x4a3a2a));
  for(const s of[-1,1])for(let k=0;k<4;k++){const x=cx+(k/3-.5)*(w-.6)+(r()-.5)*.3,len=.42+r()*.2;
   out.push(orient(blade(len,len*.4,{segs:2,shape:SHAPES.lance,fold:.25,droop:.8,base:GREENS.mid,mid:GREENS.bright,tip:GREENS.lime}),[x,top+.08,cz+s*(d/2-B)],s*Math.PI/2+(r()-.5)*.6,.3+r()*.3,0));}
  planters++;
 }
 return {planterTrims:planters};
}

// ---- Lawn and lake-edge detail -------------------------------------------------------------------------------------
// Tufts of longer grass and small wildflowers scattered over the park lawn and the garden-bed lawns (low and visual
// only, like the reeds), and ferns with flowering shrubs in the shallows along the boulevard edge between the stones.
export function addLawnDetail(out,layout,clearGround,clearWater){
 const y=layout.decks[5].y,r=random(9393),park=ATRIUM_ZONES.find(z=>z.id==='atrium6-park'),floor=layout.decks[5].atrium.outline;let tufts=0,blooms=0,margin=0;
 const[x0,x1,z0,z1]=park.bounds;
 const path=phase6ParkPath();for(let k=0;k<420;k++){const x=x0+r()*(x1-x0),z=z0+r()*(z1-z0),kind=r();if(!contains(floor,[x,z])||contains(path,[x,z])||clearGround(x,z,.35))continue;
  if(kind<.78){tuft(out,[x,y,z],{height:.18+r()*.2,blades:5,rnd:r});tufts++;}else{flower(out,[x,y+.1+r()*.08,z],{r:.06,color:BLOOMS[(k%3)?1:[0,2,4][k%3]],tilt:.2,yaw:r()*6});blooms++;}}
 for(let x=7;x<118;x+=3+r()*3){const z=phase6LakeShore(x)-.7-r()*.5;if(clearWater(x,z,.4))continue;if(r()<.5)fern(out,[x,y-.1,z],{spread:.7,fronds:6,pairs:4,rnd:r,facing:-Math.PI/2,arc:3});else flowerBush(out,[x,y-.12,z],{spread:.6,rnd:r,color:BLOOMS[[0,1,3][margin%3]],blooms:6});margin++;}
 return {lawnTufts:tufts,lawnFlowers:blooms,lakeMargin:margin};
}

// ---- Lake: lily pads, the waterfall, flowering shrubs -------------------------------------------------------------
// The waterfall is the lake's focal point (ATRIUM_WATERFALL): a stepped mound of pale faceted rocks standing in the
// shallow water, two tiers of falling water, foam on the ledge and spray where it meets the lake. It is built in a
// local frame (x across the fall, the water falling toward +z), then turned by its yaw onto its rock line. Visual only,
// like the stones and reeds.
const fallFrame=()=>{const{x,z,yaw}=ATRIUM_WATERFALL;return new T.Matrix4().makeRotationY(yaw).setPosition(x,0,z);};
// Inside the waterfall's footprint plus a margin m: its rocks reach about 4.1 m behind the rock line and 3.8 m in front,
// the shrubs at its sides about 1.4 m past its width.
function nearWaterfall(x,z,m){const{x:wx,z:wz,width,yaw}=ATRIUM_WATERFALL,dx=x-wx,dz=z-wz,c=Math.cos(yaw),s=Math.sin(yaw),lx=c*dx-s*dz,lz=s*dx+c*dz;return Math.abs(lx)<width/2+1.4+m&&lz>-4.1-m&&lz<3.8+m;}
// A falling sheet, x0..x1 across, from top down to bottom, leaning out by `lean` toward +z at its foot. Its UVs run in
// metres (u across, v up) for the falling-water streaks.
function waterSheet(out,x0,x1,top,bottom,z,lean){
 const g=new T.PlaneGeometry(x1-x0,top-bottom,6,4),p=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){const k=((top-bottom)/2-p.getY(i))/(top-bottom);p.setZ(i,lean*k*k+Math.sin(p.getX(i)*3.1)*.03);uv.setXY(i,uv.getX(i)*(x1-x0)/1.6,uv.getY(i)*(top-bottom)/2.4);}
 g.translate((x0+x1)/2,(top+bottom)/2,z);g.computeVertexNormals();
 out.push(paint(g,q=>new T.Color(0xf4fbfd).lerp(new T.Color(0x8fd0dc),Math.min(1,(top-q.y)/(top-bottom))*.75).toArray()));
}
// Rocks, foam and planting go to `out` (the garden mesh); the falling sheets to `water` (addFallingWater).
export function addWaterfall(out,water,layout){
 const{width:w,seed=4477}=ATRIUM_WATERFALL,y0=layout.decks[5].y,r=random(seed),Y=v=>y0+v,rock=[],sheets=[],st=(p,size)=>stone(rock,p,size,r,.9,-.25);
 // Rocks: rounded boulders in three tiers, each resting on the one below (the base runs down into the lake bed), the
 // middle of each tier set back so the falls stand clear of it; stones framing the ledge; boulders at the foot.
 const back=x=>Math.abs(x)<2.2?-.7:0;
 for(let k=0;k<6;k++){const x=-w/2+.8+k*(w-1.6)/5;st([x,Y(.5),-.5+back(x)],1.9+r()*.4);}
 for(let k=0;k<5;k++){const x=-w/2+1.3+k*(w-2.6)/4;st([x,Y(2.3),-.9+back(x)],1.4+r()*.4);}
 for(let k=0;k<5;k++)st([-2.8+k*1.4,Y(3.7),-1.5],1.05+r()*.3);
 for(const x of[-1.2,1.2])st([x,Y(3.3),-2.4],1.5);
 for(const x of[-2.7,2.7])st([x,Y(2.6),.9],.6+r()*.2);
 for(let k=0;k<6;k++)st([-w/2+.8+k*(w-1.6)/5+(r()-.5)*.4,Y(.15),2.3+r()*.6],.55+r()*.35);
 // Water: an upper fall from the crown to the ledge, then a wider fall to the lake.
 waterSheet(sheets,-1.3,1.3,Y(4.4),Y(2.6),.5,.5);
 waterSheet(sheets,-2,2,Y(2.65),y0-.01,1.3,.7);
 // Foam on the ledge and at the foot, with spray: small pale stones of water where the fall meets the lake.
 rock.push(paint(new T.CircleGeometry(1.3,12).rotateX(-Math.PI/2).scale(1.2,1,.7).translate(0,Y(2.66),1.1),0xf4fbfd));
 rock.push(paint(new T.CircleGeometry(1.9,14).rotateX(-Math.PI/2).scale(1.3,1,.6).translate(0,y0-.004,2.1),0xeef8f8));
 for(let k=0;k<16;k++)rock.push(paint(new T.IcosahedronGeometry(.12+r()*.14,0).translate((r()-.5)*4,y0+.04+r()*.12,1.8+r()*.9),0xf6fcff));
 // Ferns and flowering shrubs along the crown and the ledge, shrubs at both ends.
 for(let k=0;k<4;k++)fern(rock,[-w/2+1.2+k*(w-2.4)/3,Y(4.3),-1.1],{spread:.9,fronds:6,pairs:4,rnd:r,droop:1.1});
 for(const x of[-3.3,3.3])flowerBush(rock,[x,Y(3.1),-.2],{spread:.8,rnd:r,color:BLOOMS[1],blooms:8});
 for(const[x,y,z]of[[-3.6,1.9,.6],[3.6,1.9,.6],[-2.2,4.5,-1.9],[2.2,4.5,-1.9]])clump(rock,[x,Y(y),z],{r:.7,rnd:r,leaves:2,detail:0,squash:.7,palette:[GREENS.dark,GREENS.mid,GREENS.bright,GREENS.lime]});
 for(const dx of[-w/2-.3,w/2+.3])flowerBush(rock,[dx,y0-.05,1.6],{spread:.9,rnd:r,color:BLOOMS[0],blooms:10});
 const m=fallFrame();for(const g of rock)out.push(g.applyMatrix4(m));for(const g of sheets)water.push(g.applyMatrix4(m));
 return {x:ATRIUM_WATERFALL.x,z:ATRIUM_WATERFALL.z,width:w};
}
// The falling water: one opaque Basic mesh with a streak texture (one draw), scrolled by atrium-mood.js while the walker
// is in the open atrium; the distant copy shares the texture. Without a canvas (headless producers) the sheets join the
// garden mesh as still water.
function addFallingWater(root,sheets,out){
 const c=walkCanvas();if(!c){out.push(...sheets);return {fallingWater:0};}
 if(typeof c.data==='function')Object.defineProperty(c,'data',{value:undefined});
 const map=new T.CanvasTexture(paintFallingWater(c));map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
 const g=mergeGeometries(sheets);sheets.forEach(x=>x.dispose());g.computeBoundingBox();g.computeBoundingSphere();
 const o=new T.Mesh(g,new T.MeshBasicMaterial({name:'P6_atrium_waterfall',map,vertexColors:true,side:T.DoubleSide}));o.name='P6_atrium_waterfall';o.frustumCulled=false;
 o.userData={noCollide:true,phase6Architecture:true,selectedDesign:'4B',gardenDecor:true};root.add(o);return {fallingWater:1};
}
// Pale streaks of differing length and brightness on blue-white, wrapping top to bottom so the scroll has no seam.
function paintFallingWater(c){
 const W=64,H=256,g=c.getContext('2d'),r=random(8181);c.width=W;c.height=H;g.fillStyle='#c6dfe6';g.fillRect(0,0,W,H);
 for(let i=0;i<70;i++){const x=r()*W,w=1+r()*3.5,y=r()*H,len=30+r()*110,a=.35+r()*.6;
  for(const dy of[0,-H]){const gr=g.createLinearGradient(0,y+dy,0,y+dy+len);gr.addColorStop(0,`rgba(255,255,255,0)`);gr.addColorStop(.5,`rgba(255,255,255,${a})`);gr.addColorStop(1,`rgba(255,255,255,0)`);g.fillStyle=gr;g.fillRect(x,y+dy,w,len);}}
 return c;
}
// Lily pads: notched discs in loose drifts on the open water, a few pink lotus flowers among them.
export function addLilyPads(out,layout,clear){
 const y=layout.decks[5].y,r=random(7123);let pads=0,flowers=0;
 for(const[cx,cz]of[[30,-30],[44,-20],[78,-38],[96,-24],[108,-44],[24,-50],[66,-48],[16,-14],[20,-20]])for(let k=0;k<14;k++){
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
 // Big-leaved understory (aroids, ferns, the odd palm) round every tree, signature and grove alike.
 let understory=0;
 // (Not the boulevard avenue's trees: their planters carry their own beds.)
 for(const p of fitoutFootprints(layout))if(p.part==='p6_tree_trunk'&&!boulevardTree(p))for(let k=0;k<6;k++){const a=k/6*Math.PI*2+r(),d=.8+r()*.9,x=p.x+Math.cos(a)*d,z=p.z+Math.sin(a)*d,kind=(k+Math.round(p.x))%3,size=.7+r()*.4;if(clear(x,z,.55))continue;
  if(kind===0)aroid(out,[x,y,z],{size,leaves:6,rnd:r});else if(kind===1)fern(out,[x,y,z],{spread:size*.9,fronds:7,pairs:5,rnd:r});else palm(out,[x,y,z],{height:1.2+r()*.5,canes:2,rnd:r});understory++;}
 return {bushes,understory};
}

// ---- Soffits ------------------------------------------------------------------------------------------------------
// A cream sheet just under every overhang: the part of deck d's slab that hangs over deck d-1's open atrium. The baked
// deck slabs (their underside is 0.36 m below the deck's floor) keep their shared finish; this sheet sits 2.5 cm under
// them, only over open air, so it is seen from the atrium and never from inside a room. Built per 0.5 m column by
// scanline: inside deck d-1's atrium outline, minus deck d's own atrium outline and slab holes (stairs, lifts).
const SOFFIT_DROP=.385,COLUMN=.5;
function crossings(poly,x){const z=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[0]<=x)!==(b[0]<=x))z.push(a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]));}z.sort((p,q)=>p-q);const out=[];for(let i=0;i+1<z.length;i+=2)out.push([z[i],z[i+1]]);return out;}
function subtract(list,cut){let out=list;for(const[c0,c1]of cut)out=out.flatMap(([a,b])=>c1<=a||c0>=b?[[a,b]]:[[a,Math.min(b,c0)],[Math.max(a,c1),b]].filter(([p,q])=>q-p>.02));return out;}
// `cream` adds the fascias' limestone faces (addFascias) to the same draw.
export function addSoffits(root,layout,cream=[]){
 const pos=[];let area=0;for(const v of cream)pos.push(v);
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

// ---- Fascias ------------------------------------------------------------------------------------------------------
// S2 (concept A's finish): the slab edges of Decks 7–16, once a dark band, clad in cream limestone under a slim
// warm-oak top band with a thin brushed-bronze line between them. The limestone is the soffit's own material (one
// stone with the cream undersides; addSoffits draws it), the oak and bronze join the static garden draw. Every piece
// stays at or below its deck's floor, hugs the true edge (simplified to 1.5 cm) just outside the slab, and stops
// where the tower, its bridges and the dining aprons meet the edge. Faces only: front, and the limestone's underside.
const FASCIA_OUT=.03,FASCIA_BOTTOM=-.40,BRONZE=[-.095,-.07],OAK=[-.07,0],OAK_COLOR=0xb98552,BRONZE_COLOR=0x8f6c42;
// Each vertex moved `by` toward the ring's interior (for an atrium outline, into the void), along its mitre.
function offsetRing(ring,by){
 const n=ring.length;let area=0;for(let i=0;i<n;i++){const a=ring[i],b=ring[(i+1)%n];area+=a[0]*b[1]-b[0]*a[1];}
 const s=Math.sign(area),normal=(a,b)=>{const l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return[-s*(b[1]-a[1])/l,s*(b[0]-a[0])/l];};
 return ring.map((p,i)=>{const n1=normal(ring[(i+n-1)%n],p),n2=normal(p,ring[(i+1)%n]),k=by/Math.max(.1,1+n1[0]*n2[0]+n1[1]*n2[1]);return[p[0]+(n1[0]+n2[0])*k,p[1]+(n1[1]+n2[1])*k];});
}
// Two triangles a-b-c, a-c-d, wound to face `normal`.
function quad(out,a,b,c,d,normal){
 const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const tris=n[0]*normal[0]+n[1]*normal[1]+n[2]*normal[2]>=0?[a,b,c,a,c,d]:[a,c,b,a,d,c];for(const p of tris)out.push(p[0],p[1],p[2]);
}
function trim(positions,color){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();
 const c=new T.Color(color),col=new Float32Array(positions.length);for(let i=0;i<col.length;i+=3){col[i]=c.r;col[i+1]=c.g;col[i+2]=c.b;}
 g.setAttribute('color',new T.BufferAttribute(col,3));g.setAttribute('uv',new T.BufferAttribute(new Float32Array(positions.length/3*2),2));return g;
}
// The walkway ceilings over the atrium edge of Decks 7–16, once a grey band seen over the guards: a cream sheet in
// the soffit's material just under the deck above (below its slab and terrace plate), from the edge inboard up to
// WALKWAY_DEPTH. It stops short of the void above or below, slab holes and any room (whose own ceiling it would
// otherwise show through), so it is seen only where the slab's underside was.
const WALKWAY_DEPTH=3.5,WALKWAY_STEP=.25,WALKWAY_DROP=.37;
function walkwayStops(layout,d,above){
 const box=p=>{const xs=p.map(q=>q[0]),zs=p.map(q=>q[1]);return[Math.min(...xs),Math.max(...xs),Math.min(...zs),Math.max(...zs)];};
 const y=above.y-WALKWAY_DROP,rooms=layout.rooms.filter(r=>!r.aggregate&&r.y<y+.05&&r.y+r.height>y-.6).map(r=>r.polygon);
 const polys=[...rooms,...[d,above].flatMap(k=>(k.slab?.holes||[]).filter(h=>h.id!=='atrium').map(h=>h.polygon))].map(p=>({p,b:box(p)}));
 return q=>contains(d.atrium.outline,q)||contains(above.atrium.outline,q)||polys.some(({p,b})=>q[0]>=b[0]&&q[0]<=b[1]&&q[1]>=b[2]&&q[1]<=b[3]&&contains(p,q));
}
export function walkwayCeilings(layout){
 const pos=[];
 for(const d of layout.decks){
  const above=layout.decks[d.number];if(d.number<STRIP_DECKS[0]||d.number>STRIP_DECKS[1]||!d.atrium?.outline||!above?.atrium?.outline)continue;
  // The edge, sampled every 0.75 m or less, so a room along a long straight run still stops the sheet.
  const edge=simplifyRing(d.atrium.outline,.015),ring=edge.flatMap((a,i)=>{const b=edge[(i+1)%edge.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.75));return Array.from({length:n},(_,k)=>[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);});
  const unit=offsetRing(ring,-1),stops=walkwayStops(layout,d,above),y=above.y-WALKWAY_DROP;
  // How far in each vertex's sheet may run, along its mitre, before it meets a stop.
  const depth=ring.map((p,i)=>{const dir=[unit[i][0]-p[0],unit[i][1]-p[1]];let reach=0;
   for(let s=WALKWAY_STEP;s<=WALKWAY_DEPTH+1e-6;s+=WALKWAY_STEP){if(stops([p[0]+dir[0]*s,p[1]+dir[1]*s]))break;reach=s;}
   return {dir,reach:stops([p[0]+dir[0]*.05,p[1]+dir[1]*.05])?0:reach};});
  for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length,a=depth[i],b=depth[j];if(a.reach<WALKWAY_STEP||b.reach<WALKWAY_STEP)continue;
   const at=(k,s)=>[ring[k][0]+depth[k].dir[0]*s,y,ring[k][1]+depth[k].dir[1]*s];
   quad(pos,at(i,0),at(j,0),at(j,b.reach),at(i,a.reach),[0,-1,0]);}
 }
 return pos;
}
export function addFascias(out,layout){
 const cream=[],oak=[],bronze=[];let length=0;
 for(const d of layout.decks){
  if(d.number<STRIP_DECKS[0]||d.number>STRIP_DECKS[1]||!d.atrium?.outline)continue;
  const ring=simplifyRing(d.atrium.outline,.015),reserved=edgeReservations(layout,d),y=d.y;
  const face=offsetRing(ring,FASCIA_OUT),back=offsetRing(ring,-.02),band=offsetRing(ring,FASCIA_OUT+.01),line=offsetRing(ring,FASCIA_OUT+.005);
  for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length,a=ring[i],b=ring[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.005)continue;
   const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],out2=[(face[i][0]+face[j][0])/2-mid[0],(face[i][1]+face[j][1])/2-mid[1]],l=Math.hypot(...out2)||1,n=[out2[0]/l,0,out2[1]/l];
   if(reserved([mid[0]+n[0]*.2,mid[1]+n[2]*.2]))continue;length+=len;
   const at=(r,k,h)=>[r[k][0],y+h,r[k][1]];
   quad(cream,at(face,i,FASCIA_BOTTOM),at(face,j,FASCIA_BOTTOM),at(face,j,BRONZE[0]),at(face,i,BRONZE[0]),n);
   quad(cream,at(back,i,FASCIA_BOTTOM),at(back,j,FASCIA_BOTTOM),at(face,j,FASCIA_BOTTOM),at(face,i,FASCIA_BOTTOM),[0,-1,0]);
   quad(bronze,at(line,i,BRONZE[0]),at(line,j,BRONZE[0]),at(line,j,BRONZE[1]),at(line,i,BRONZE[1]),n);
   quad(oak,at(band,i,OAK[0]),at(band,j,OAK[0]),at(band,j,OAK[1]),at(band,i,OAK[1]),n);
  }
 }
 out.push(trim(oak,OAK_COLOR),trim(bronze,BRONZE_COLOR));
 return {cream,fasciaLength:Math.round(length),fasciaTriangles:(cream.length+oak.length+bronze.length)/9};
}

// ---- Tree shade -------------------------------------------------------------------------------------------------
// The dappled shadows in the concept are shade under the trees, not a floor pattern: one soft transparent decal per
// tree, the size of its canopy, just above the paving (1.6 cm, over the 6 mm paving lift and the tile joints), shifted
// away from the ship's fill light (it shines from +x+z, high up). One draw; it needs a canvas, so headless producers
// without one skip it.
// A decal samples one half of the shade texture (paintTreeShade): the tree's crown shade or the boulevard's dapple.
const shadeHalf=(g,at)=>{const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,at+uv.getX(i)*.5);return g;};
export function addTreeShade(root,layout,signatures){
 const c=walkCanvas();if(!c)return {treeShade:0};
 const y=layout.decks[5].y+.016,sig=new Map(signatures.map(t=>[t.id,t])),geos=[];
 for(const p of fitoutFootprints(layout)){if(p.part!=='p6_tree_trunk')continue;
  // Concept B: the avenue's shade is broader and drawn out along the boulevard, so the paving reads dappled.
  const s=ATRIUM_SIGNATURE_TREES.find(t=>Math.hypot(t.x-p.x,t.z-p.z)<.01),avenue=!s&&boulevardTree(p),radius=s?(sig.get(s.id)?.spread??s.spread)*1.05:avenue?3.4:2.1,h=s?s.height*.7:3.8;
  geos.push(shadeHalf(new T.CircleGeometry(radius,28).rotateX(-Math.PI/2).rotateY(p.x*.37).scale(avenue?1.3:1,1,1).translate(p.x-h*.15,y,p.z-h*.1),SHADE_HALVES.tree));}
 const count=geos.length;
 // Concept B: the open boulevard between the trees is dappled too, as if the avenue's crowns met overhead: lighter,
 // more broken patches every few metres, alternating sides of the stripe, kept to solid floor.
 const floor=layout.decks[5].atrium.outline,holes=(layout.decks[5].slab?.holes||[]).map(q=>q.polygon),r=random(5150);
 const solid=(x,z)=>contains(floor,[x,z])&&!holes.some(q=>contains(q,[x,z]));
 for(let x=INLAY_X[0]+2,i=0;x<INLAY_X[1]-2;x+=4.2,i++){const z=(i%2?1:-1)*(1.4+r()*1.4),rad=2.2+r()*.9,turn=r()*Math.PI*2;
  if([[0,0],[rad*1.3,0],[-rad*1.3,0],[0,rad],[0,-rad]].every(([dx,dz])=>solid(x+dx,z+dz)))
   geos.push(shadeHalf(new T.CircleGeometry(rad,24).rotateX(-Math.PI/2).rotateY(turn).scale(1.3,1,1).translate(x,y,z),SHADE_HALVES.dapple));}
 if(typeof c.data==='function')Object.defineProperty(c,'data',{value:undefined});
 const map=new T.CanvasTexture(paintTreeShade(c,77));map.colorSpace=T.SRGBColorSpace;
 const m=new T.MeshBasicMaterial({name:'P6_atrium_tree_shade',map,transparent:true,opacity:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const o=new T.Mesh(mergeGeometries(geos),m);const dapples=geos.length-count;geos.forEach(g=>g.dispose());o.name='P6_atrium_tree_shade';o.frustumCulled=false;o.renderOrder=-1; // floor decal: before any glass
 o.userData={noCollide:true,phase6Architecture:true,selectedDesign:'4B',gardenDecor:true};root.add(o);return {treeShade:count,boulevardDapples:dapples};
}

// ---- Glow: warm downlights under the overhanging deck soffits, lanterns on the timber decks ---------------------
export const gardenGlowMaterial=new T.MeshBasicMaterial({name:'P6_atrium_glow',color:0xffe3b8});
// The cream soffit sheets (addSoffits) read warm and light, as in the concept, rather than grey or navy. The emissive
// floor holds them up whatever the room light does; the Basic distant copy keeps the cream colour.
export const atriumSoffitMaterial=new T.MeshStandardMaterial({name:'V2_atrium_soffit',color:0xefdcc0,roughness:.85,emissive:0xf8dcb0,emissiveIntensity:.38});
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

// One merged draw for the static garden pieces, one for the warm lanterns, one for the falling water, plus the
// instanced cascades and downlights.
// String lights between the festoon posts (phase6-programme.js): a dark cable sagging up to 45 cm from the 2.72 m
// post tops, warm bulbs every ~0.8 m (in the lantern draw).
function addFestoons(out,glow,y){
 let bulbs=0;const top=y+2.72;
 for(const{posts,strings}of ATRIUM_FESTOONS){
  for(const[i,j]of strings){const a=posts[i],b=posts[j],sag=Math.min(.45,Math.hypot(b[0]-a[0],b[1]-a[1])*.04);
   const n=Math.max(4,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/.8)),at=t=>[a[0]+(b[0]-a[0])*t,top-sag*4*t*(1-t),a[1]+(b[1]-a[1])*t];
   out.push(stem(Array.from({length:n+1},(_,k)=>at(k/n)),.012,0x2e2a26,3));
   for(let k=1;k<n;k++){const[x,yy,z]=at(k/n);out.push(paint(new T.BoxGeometry(.03,.05,.03).translate(x,yy-.035,z),0x2e2a26));glow.push(new T.BoxGeometry(.07,.09,.07).translate(x,yy-.1,z));bulbs++;}}}
 return bulbs;
}
const boulevardTree=p=>ATRIUM_BOULEVARD_TREES.find(t=>Math.abs(t.x-p.x)<.01&&Math.abs(t.z-p.z)<.01);

// One merged draw for the static garden pieces, one for the warm lanterns, one for the falling water, plus the
// instanced cascades and downlights.
export function addAtriumGardens(root,layout){
 const y=layout.decks[5].y,lake=phase6LakePolygon(layout.decks[5].atrium.outline),islands=phase6LakeIslands(),parts=fitoutFootprints(layout),[bx0,bx1]=ATRIUM_LAKE_BRIDGE.bounds;
 const inIsland=(x,z,m)=>islands.some(q=>x>q[0][0]-m&&x<q[1][0]+m&&z>q[0][1]-m&&z<q[2][1]+m);
 const clearWater=(x,z,m)=>!contains(lake,[x,z])||inIsland(x,z,m)||x>bx0-m-1&&x<bx1+m+1||nearWaterfall(x,z,3)||parts.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+m-.6);
 const clearGround=(x,z,m)=>parts.some(p=>p.part!=='p6_tree_trunk'&&Math.hypot(p.x-x,p.z-z)<p.r+m-.6)||ATRIUM_SIGNATURE_TREES.some(t=>Math.hypot(t.x-x,t.z-z)<1.1);
 const out=[],glow=[],trees=addSignatureTrees(out,layout),grove=addGroveTrees(out,layout),planting=addPlantingBeds(out,layout),stones=addLakeStones(out,layout),decks=addTimberDecks(out,layout),water=[],waterfall=addWaterfall(out,water,layout),lily=addLilyPads(out,layout,clearWater),beds=addTreeBeds(out,layout,clearGround),lawn=addLawnDetail(out,layout,clearGround,clearWater),inlays=addPromenadeInlays(out,layout),trims=addPlanterTrims(out,layout),lanterns=addDeckLanterns(out,glow,y+.03),festoonBulbs=addFestoons(out,glow,y+.03),{cream,...fascias}=addFascias(out,layout);
 const falling=addFallingWater(root,water,out);
 // The Common stage's timber terraces, deck and cushions (atrium-stage.js), in this one draw.
 addStageDecor(out,layout);
 const g=mergeGeometries(out);out.forEach(x=>x.dispose());g.computeBoundingBox();g.computeBoundingSphere();
 const o=new T.Mesh(g,gardenMaterial);o.name='P6_atrium_gardens';o.frustumCulled=false;o.userData={noCollide:true,phase6Architecture:true,selectedDesign:'4B',gardenDecor:true};root.add(o);
 const gg=mergeGeometries(glow.map(x=>x.toNonIndexed()));glow.forEach(x=>x.dispose());gg.computeBoundingBox();gg.computeBoundingSphere();
 const lo=new T.Mesh(gg,gardenGlowMaterial);lo.name='P6_atrium_lanterns';lo.frustumCulled=false;lo.userData={...o.userData};root.add(lo);
 const cascades=addHangingGardens(root,layout),downlights=addDownlights(root,layout),soffits=addSoffits(root,layout,cream.concat(walkwayCeilings(layout))),shade=addTreeShade(root,layout,trees);
 return {trees,...grove,...planting,...stones,...decks,waterfall,...falling,...lily,...beds,...lawn,...inlays,...trims,lanterns,festoonBulbs,...fascias,...downlights,...soffits,...shade,staticTriangles:g.attributes.position.count/3,cascades};
}
