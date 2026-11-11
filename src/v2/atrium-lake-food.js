// G3 Reflection lake and G4 Food hall, option A of each (docs/atrium-areas.md). Visual only: every piece joins the
// static garden mesh (P6_atrium_gardens, atrium-gardens.js), so there is no new draw, the distant copy stays Basic,
// phones drop it with the other garden decor, and colliders, seats, routes and the atrium PVS key are untouched.
//  - Lake (lake-a-natural-edge): rounded shore stones, cattail reeds and lily pads with small white water lilies along
//    the boulevard bank, the far bank, the reflection island and the bays' outer rims. The water itself is shaded in
//    lake-water.js and the taller waterfall is atrium-gardens.js' addWaterfall.
//  - Food hall (food-a-market-awnings): a striped fabric awning over each stall's canopy, timber boards on its counter,
//    potted herbs along the counter and wooden crates of fruit and vegetables at its front. Sign boards keep their text.
import * as T from 'three';
import {GREENS,SHAPES,paint,stem,clump,blade,orient} from '../walk/foliage.js';
import {ATRIUM_LAKE_BRIDGE,phase6LakePolygon,phase6LakeIslands,phase6LakeShore} from '../plan/atrium-v2.js';
import {REFLECTION_BAYS} from './reflection-terraces.js';
import {phase6Programme} from './phase6-programme.js';
import {contains} from '../plan/geometry-v2.js';

const random=seed=>{let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};
// Smooth value noise along an edge, so reeds and stones come in stands and gaps rather than a pattern.
function noise1(seed){const r=random(seed),v=Array.from({length:64},r);return x=>{const i=Math.floor(x),f=x-i,s=f*f*(3-2*f),a=v[((i%64)+64)%64],b=v[(((i+1)%64)+64)%64];return a+(b-a)*s;};}

// ---- Lake edges -------------------------------------------------------------------------------------------------
// The reflection island and the bay floors (reflection-terraces.js): rings standing in the water, edged from outside.
const ISLAND={x:44,z:-26.8,r:7.22},BAY={z:-5.8,r:5.62};
const RINGS=[ISLAND,...REFLECTION_BAYS.map(x=>({x,z:BAY.z,r:BAY.r}))];
// Where a lake piece may not go: out of the water, on a dry island or the bridge, at the waterfall, on any Deck 6
// fit-out part or planting bed (as its box), or on a reflection ring's floor.
function lakeGuard(layout,nearWaterfall){
 const lake=phase6LakePolygon(layout.decks[5].atrium.outline),islands=phase6LakeIslands(),[bx0,bx1]=ATRIUM_LAKE_BRIDGE.bounds,p6=phase6Programme(layout);
 const boxes=[...p6.parts,...p6.beds].filter(p=>p.deck===6&&!/^p6_reflection_/.test(p.part)&&p.at[0]>-2&&p.at[0]<126&&p.at[2]<0&&p.at[2]>-62)
  .map(p=>{const turned=Math.abs(Math.sin(p.yaw||0))>1e-3,h=Math.max(p.size[0],p.size[2])/2;return[p.at[0],p.at[2],turned?h:p.size[0]/2,turned?h:p.size[2]/2];});
 return(x,z,m)=>!contains(lake,[x,z])||islands.some(q=>x>q[0][0]-m&&x<q[1][0]+m&&z>q[0][1]-m&&z<q[2][1]+m)||x>bx0-m&&x<bx1+m||nearWaterfall(x,z,m)
  ||boxes.some(([px,pz,hx,hz])=>Math.abs(x-px)<hx+m&&Math.abs(z-pz)<hz+m)||RINGS.some(q=>Math.hypot(x-q.x,z-q.z)<q.r+m*.5);
}
// Every lake edge, sampled about every 0.25 m: a point on it and the unit normal into the water.
function lakeEdges(layout){
 const edges=[],lake=phase6LakePolygon(layout.decks[5].atrium.outline);
 // The boulevard bank (the water lies on its -z side).
 for(let x=4.5;x<119.5;x+=.25){const z=phase6LakeShore(x),dz=(phase6LakeShore(x+.1)-phase6LakeShore(x-.1))/.2,l=Math.hypot(1,dz);edges.push({x,z,nx:dz/l,nz:-1/l,kind:'bank'});}
 // The far bank: the outline's first run, west to east (the water lies on its +z side).
 const turn=lake.findIndex((p,i)=>i&&p[0]<lake[i-1][0]),far=lake.slice(0,turn-1);
 for(let i=0;i+1<far.length;i++){const a=far[i],b=far[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(len/.25));
  for(let k=0;k<n;k++){const t=k/n;edges.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,nx:-(b[1]-a[1])/len,nz:(b[0]-a[0])/len,kind:'far'});}}
 // The reflection island all round, and each bay's water half.
 for(const q of RINGS){const bay=q!==ISLAND;for(let a=0;a<Math.PI*2;a+=.25/q.r){const c=Math.cos(a),s=Math.sin(a);if(bay&&s>-.05)continue;edges.push({x:q.x+c*q.r,z:q.z+s*q.r,nx:c,nz:s,kind:bay?'bay':'island'});}}
 return edges;
}
// A rounded shore stone: a subdivided icosahedron, flattened and lumped, in warm grey-beige.
const STONES=[0xb8ab98,0xa89d8c,0xc9bca6,0x9d9282,0xbfb3a0];
function roundStone(out,[x,y,z],size,r){
 const g=new T.IcosahedronGeometry(1,1),p=g.attributes.position,jit=new Map(),sx=size*(1+r()*.35),sz=size*(.8+r()*.3),tall=.5+r()*.2;
 for(let i=0;i<p.count;i++){const key=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3);if(!jit.has(key))jit.set(key,.9+r()*.18);const k=jit.get(key);p.setXYZ(i,p.getX(i)*sx*k,Math.max(-.3,p.getY(i))*size*tall*k,p.getZ(i)*sz*k);}
 g.rotateY(r()*Math.PI);g.computeVertexNormals();out.push(paint(g.translate(x,y,z),STONES[r()*STONES.length|0]));
}
// A stand of cattails: narrow arching blades and a few stems topped with brown seed heads, rising from the lake bed.
function cattails(out,[x,y,z],height,r){
 for(let i=0,n=9+(r()*5|0);i<n;i++){const a=r()*Math.PI*2,o=r()*.16;
  out.push(orient(blade(height*(.55+r()*.5),.05+r()*.02,{segs:3,shape:SHAPES.strap,fold:.25,droop:.1+r()*.25,base:GREENS.dark,mid:GREENS.mid,tip:r()<.5?GREENS.lime:GREENS.pale}),[x+Math.cos(a)*o,y,z+Math.sin(a)*o],a,1.3+r()*.22,0));}
 for(let k=0,n=2+(r()*3|0);k<n;k++){const a=r()*Math.PI*2,o=r()*.14,h=height*(.95+r()*.3),bx=x+Math.cos(a)*o,bz=z+Math.sin(a)*o,top=[bx+(r()-.5)*.12,y+h,bz+(r()-.5)*.12];
  out.push(stem([[bx,y,bz],top],.007,0x5d7a3a,3));
  out.push(paint(new T.CylinderGeometry(.026,.024,.17,6).translate(top[0],top[1]-.14,top[2]),0x6b4226));}
}
// A white water lily: two rings of cupped white petals round a yellow heart, just above the water.
function waterLily(out,[x,y,z],size,turn){
 for(let ring=0;ring<2;ring++)for(let i=0;i<6;i++)
  out.push(orient(blade(size*(ring?.78:1),size*.42,{segs:2,shape:SHAPES.lance,fold:.25,droop:-.15,base:0xf1e9df,mid:0xffffff,tip:0xfdf8f2}),[x,y,z],turn+(i+ring*.5)/6*Math.PI*2,ring?.8:.35,0));
 out.push(paint(new T.IcosahedronGeometry(size*.22,0).scale(1,.6,1).translate(x,y+size*.12,z),0xf2c94c));
}
// A drift of notched lily pads round (x, z), about a third of them flowering.
function lilyDrift(out,x,z,y,r,blocked){
 let pads=0,flowers=0;
 for(let k=0,n=7+(r()*6|0);k<n;k++){const a=r()*Math.PI*2,d=Math.sqrt(r())*1.4,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d,s=.24+r()*.2,turn=r()*Math.PI*2;if(blocked(px,pz,s+.1))continue;
  out.push(paint(new T.CircleGeometry(s,10,.3,Math.PI*2-.6).rotateX(-Math.PI/2).rotateY(turn).translate(px,y-.003,pz),[GREENS.mid,GREENS.bright,0x5f9a45,0x6fae4f][r()*4|0]));pads++;
  if(r()<.45){waterLily(out,[px+(r()-.5)*s*.4,y+.005,pz+(r()-.5)*s*.4],.12+r()*.05,turn);flowers++;}}
 return {pads,flowers};
}
// Along each edge, a broken line of rounded stones at the waterline, stands of cattails just off it, and lily drifts
// out in the shallows. The bays' rims and the island take fewer, so their designed edges still read.
const EDGE={bank:{stones:.8,reeds:.42,lilies:6},far:{stones:.7,reeds:.48,lilies:8},island:{stones:.85,reeds:.4,lilies:4.5},bay:{stones:.4,reeds:.62,lilies:4}};
export function addLakeEdge(out,layout,nearWaterfall){
 const y=layout.decks[5].y,r=random(6203),blocked=lakeGuard(layout,nearWaterfall),stand=noise1(311),drift=noise1(733);
 let stones=0,reeds=0,pads=0,lilies=0,along=0,nextStone=0,nextReed=0,nextLily=4,last=null;
 for(const e of lakeEdges(layout)){
  if(last&&last.kind===e.kind)along+=Math.hypot(e.x-last.x,e.z-last.z);last=e;const rule=EDGE[e.kind],at=d=>[e.x+e.nx*d,e.z+e.nz*d];
  if(along>=nextStone){nextStone=along+.55+r()*.4;
   if(r()<rule.stones){const size=.2+r()*.24,[x,z]=at(.06+r()*.3);if(!blocked(x,z,.05)){roundStone(out,[x,y-.1,z],size,r);stones++;}
    if(r()<.3){const[x2,z2]=at(.55+r()*.3);if(!blocked(x2,z2,.05)){roundStone(out,[x2,y-.12,z2],size*.6,r);stones++;}}}}
  if(along>=nextReed){nextReed=along+.6+r()*.45;
   if(stand(along/7)>rule.reeds){const[x,z]=at(.45+r()*.55);if(!blocked(x,z,.25)){cattails(out,[x,y-.16,z],e.kind==='bank'?1+r()*.35:1.15+r()*.45,r);reeds++;}}}
  if(along>=nextLily){nextLily=along+rule.lilies*(.7+r()*.6);
   if(drift(along/20)>.2){const[x,z]=at(1.7+r()*1.6),d=lilyDrift(out,x,z,y,r,blocked);pads+=d.pads;lilies+=d.flowers;}}
 }
 return {shoreStones:stones,reedStands:reeds,lilyPadsA:pads,waterLilies:lilies};
}

// ---- Market stalls ------------------------------------------------------------------------------------------------
// Flat triangles in one colour each (or a fan of them), as one garden geometry.
function sheet(){
 const pos=[],col=[],c=new T.Color();
 return {
  tri(a,b,d,hex){c.set(hex);for(const p of[a,b,d]){pos.push(...p);col.push(c.r,c.g,c.b);}},
  fan(points,hex){for(let i=1;i+1<points.length;i++)this.tri(points[0],points[i],points[i+1],hex);},
  geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();
   g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));return g;},
 };
}
const CREAM=0xf3e9d2,STRIPES=[0xc4673f,0x8eaa78,0xdcae45]; // terracotta, sage, mustard
// The awning over a stall's 4 x 3 m canopy (phase6-programme.js, its top 2.92 m up): a striped roof rising from just
// over the canopy's front to 3.5 m at its back (under the Deck 7 slab, 3.64 m up), scalloped valances hanging front and
// back to just above the sign board's top, and striped side panels closing it down to the canopy.
const AWNING={x:2.12,front:-1.86,back:1.62,low:3.04,high:3.5,bulge:.05,hem:2.84,tip:2.74,stripes:14,sides:12};
function awning(s,x,z,y,colour){
 const{x:hw,front,back,low,high,bulge,hem,tip,stripes,sides}=AWNING,z0=z+front,z1=z+back;
 const roof=t=>y+low+(high-low)*t+bulge*Math.sin(Math.PI*t),at=(px,t)=>[px,roof(t),z0+(z1-z0)*t];
 const stripe=k=>k%2?colour:CREAM;
 for(let k=0;k<stripes;k++){const xa=x-hw+2*hw*k/stripes,xb=x-hw+2*hw*(k+1)/stripes,xm=(xa+xb)/2;
  for(let j=0;j<4;j++){const ta=j/4,tb=(j+1)/4;s.fan([at(xa,ta),at(xb,ta),at(xb,tb),at(xa,tb)],stripe(k));}
  // Valance tongues, front and back, each down from the roof's edge.
  for(const[zz,t]of[[z0,0],[z1,1]])s.fan([[xa,roof(t),zz],[xb,roof(t),zz],[xb,y+hem,zz],[xm,y+tip,zz],[xa,y+hem,zz]],stripe(k));
 }
 for(const side of[-1,1]){const px=x+side*hw;
  for(let j=0;j<sides;j++){const ta=j/sides,tb=(j+1)/sides,za=z0+(z1-z0)*ta,zb=z0+(z1-z0)*tb,zm=(za+zb)/2;
   s.fan([[px,roof(ta),za],[px,roof(tb),zb],[px,y+hem,zb],[px,y+tip,zm],[px,y+hem,za]],j%2?colour:CREAM);}}
}
// Timber boards over the counter's front and ends (the counter is 4 m x 0.8 m x 0.88 m, its front 1.5 m ahead of the
// stall's centre), on a dark backing so the joints read, with a dark kick strip.
const WOOD=[0xb07d4f,0xa47148,0xbb8a5a,0x9b6a43];
function counterBoards(out,x,z,y,r){
 const front=z-1.5,box=(w,h,d,cx,cy,cz,hex)=>out.push(paint(new T.BoxGeometry(w,h,d).translate(cx,cy,cz),hex));
 box(4.02,.83,.01,x,y+.445,front-.005,0x5a3d26);
 for(let i=0;i<28;i++)box(.133,.83,.022,x-2+(i+.5)*4/28,y+.445,front-.021,WOOD[r()*WOOD.length|0]);
 for(const side of[-1,1]){box(.01,.83,.8,x+side*2.005,y+.445,z-1.1,0x5a3d26);for(let i=0;i<6;i++)box(.022,.83,.123,x+side*2.021,y+.445,front+(i+.5)*.8/6,WOOD[r()*WOOD.length|0]);}
 box(4.06,.05,.03,x,y+.025,front-.035,0x4a3424);
}
// Six terracotta pots of herbs along the counter's front half (its top is 0.97 m up): leafy clumps, or upright
// rosemary-like sprigs.
function herbs(out,x,z,y,r){
 const top=y+.97,cz=z-1.36;
 for(let i=0;i<6;i++){const px=x-1.6+i*.64+(r()-.5)*.06;
  out.push(paint(new T.CylinderGeometry(.08,.062,.14,8).translate(px,top+.07,cz),0xb8643e));
  out.push(paint(new T.CylinderGeometry(.086,.086,.025,8).translate(px,top+.13,cz),0xc47249));
  if(i%3===1)for(let k=0;k<9;k++)out.push(orient(blade(.2+r()*.08,.025,{segs:2,shape:SHAPES.strap,fold:.2,droop:.1,base:GREENS.deep,mid:GREENS.dark,tip:GREENS.mid}),[px+(r()-.5)*.06,top+.13,cz+(r()-.5)*.06],r()*Math.PI*2,1.2+r()*.3,0));
  else clump(out,[px,top+.22,cz],{r:.11+r()*.04,rnd:r,leaves:3,detail:0,squash:1.05,palette:[GREENS.dark,GREENS.mid,GREENS.bright,GREENS.lime]});
 }
}
// Produce for the crates: a colour (each piece a little lighter or darker), a size, and how it is shaped.
const PRODUCE=[
 {hex:0xc23b2e,r:.058},{hex:0xf0c63e,r:.05,stretch:1.3},{hex:0xe98b2f,r:.06},{hex:0x93c25a,r:.09},
 {hex:0xd9432f,r:.05},{hex:0xe9792a,r:.03,carrot:true},{hex:0x5a3566,r:.045,stretch:1.9},{hex:0x7fb547,r:.045},
]; // apples, lemons, oranges, cabbages, tomatoes, carrots, aubergines, limes
// A wooden crate (slatted sides and ends, corner posts) on the floor, filled to its rim with one kind of produce.
function crate(out,[x,y,z],kind,r){
 const w=.66,d=.34,h=.28,box=(bw,bh,bd,cx,cy,cz,hex)=>out.push(paint(new T.BoxGeometry(bw,bh,bd).translate(cx,cy,cz),hex)),wood=WOOD[r()*WOOD.length|0];
 box(w,.02,d,x,y+.02,z,wood);
 for(const hy of[.08,.21]){for(const s of[-1,1]){box(w,.1,.016,x,y+hy,z+s*(d/2-.008),wood);box(.016,.1,d-.032,x+s*(w/2-.008),y+hy,z,wood);}}
 for(const sx of[-1,1])for(const sz of[-1,1])box(.035,h,.035,x+sx*(w/2-.018),y+h/2,z+sz*(d/2-.018),WOOD[3]);
 const p=PRODUCE[kind],c=new T.Color(),cols=Math.max(2,Math.floor((w-.06)/(p.r*2.2))),rows=Math.max(1,Math.floor((d-.06)/(p.r*2.2)));
 for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
  const px=x-(w-.06)/2+(i+.5)*(w-.06)/cols+(r()-.5)*.02,pz=z-(d-.06)/2+(j+.5)*(d-.06)/rows+(r()-.5)*.02,py=y+h-p.r*.4+r()*.03,tone=c.set(p.hex).multiplyScalar(.85+r()*.3).getHex();
  if(p.carrot){out.push(paint(new T.ConeGeometry(p.r,.17,5).rotateZ(Math.PI/2).rotateY(r()*.6-.3).translate(px,py,pz),tone));out.push(paint(new T.ConeGeometry(.02,.07,4).rotateZ(-Math.PI/2).translate(px+.11,py,pz),GREENS.bright));continue;}
  out.push(paint(new T.IcosahedronGeometry(p.r,p.r>.07?1:0).scale(p.stretch||1,.9,1).rotateY(r()*Math.PI).translate(px,py,pz),tone));
 }
}
// Every food-hall stall: its awning (stripe colour varied along each row and between the rows), counter boards, herbs
// and four crates on the floor against its counter, under the awning's front edge (0.37 m deep, so the aisles and the
// gap in front of every stall stay open).
export function addMarketStalls(out,layout){
 const y=layout.decks[5].y,r=random(5521),s=sheet(),stalls=phase6Programme(layout).parts.filter(p=>p.part==='p6_stall_canopy'&&p.room==='atrium6-food');
 const rowsZ=[...new Set(stalls.map(p=>p.at[2]))].sort((a,b)=>a-b),colsX=[...new Set(stalls.map(p=>p.at[0]))].sort((a,b)=>a-b);let crates=0;
 for(const p of stalls){const[x,,z]=p.at,row=rowsZ.indexOf(z),col=colsX.indexOf(x);
  awning(s,x,z,y,STRIPES[(col+row*2)%3]);counterBoards(out,x,z,y,r);herbs(out,x,z,y,r);
  const kinds=[0,1,2,3,4,5,6,7].map(k=>[k,r()]).sort((a,b)=>a[1]-b[1]).map(([k])=>k);
  [-1.4,-.47,.47,1.4].forEach((dx,k)=>{crate(out,[x+dx,y,z-1.5-.03-.17],kinds[k],r);crates++;});
 }
 out.push(s.geometry());
 return {stallAwnings:stalls.length,stallCrates:crates,herbPots:stalls.length*6};
}

export function addLakeFood(out,layout,nearWaterfall){return {...addLakeEdge(out,layout,nearWaterfall),...addMarketStalls(out,layout)};}
