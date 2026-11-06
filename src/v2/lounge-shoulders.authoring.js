import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import layout from '../plan/selected-layout.js';
import {cutChartMany} from './chart-cut.authoring.js';
import {deinterleaveGeometry} from 'three/addons/utils/BufferGeometryUtils.js';

// Lounge windscreen (1C): each bow shoulder of the observation lounge, the blank wall between the nose row and the side
// row, becomes PANES tapered panes that fan from narrow at the top to wide at the sill. Done at bake time, after the
// colliders were taken, so the glass still stops you: every layer inside a pane is cut away (lining, hull, skin), then
// reveals close the cut edges and glass sits where the hull skin was. The lounge's 25 cm glass step walls along the
// hull go too, so the soffit reads as one smooth line. Window counts and the generated layout are unchanged.
// The room's stepped wall stands up to ~0.9 m room-side of the shoulder glass, so the cut reaches INSIDE=1 m in.
const ROOM='observation-lounge',PANES=4,MULLION=.3,BAR=.35,INSIDE=1,OUTSIDE=3,ROWS=28,EDGE=24,COLS=16,SETBACK=.02,DEPTH=.3;
const CHART={origin:[0,0,0],u:[1,0,0],v:[0,0,1]},CENTRE=new T.Vector3(190,0,0);
const SMALL=1.5,STEP_FROM=5.7,DEEP=1.5,DEEP_BAND=2,FLAP_NOSE=.15,FLAP_SIDE=.5,DEEP_NAMES=new Set(['V2_glass_wall','V2_outer_room_wall','V2_outer_room_ceiling']),v3=a=>new T.Vector3(...a),opaque=m=>m&&!m.transparent&&m.opacity>=1;
// Shell, lining and hull pieces are large; furniture and props (under SMALL metres across) are never cut or sampled.
const shown=o=>{for(let q=o;q;q=q.parent)if(!q.visible)return false;return true;};
const large=(o,box)=>{const g=o.geometry;g.boundingBox||g.computeBoundingBox();box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);const z=box.getSize(new T.Vector3());return Math.max(z.x,z.y,z.z)>=SMALL;};
// The exact bounds of a convex region given by planes: every feasible intersection of three of them.
function regionBox(planes){const box=new T.Box3(),m=new T.Matrix3(),p=new T.Vector3();
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){const [a,b,c]=[planes[i],planes[j],planes[k]];
  m.set(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);if(Math.abs(m.determinant())<1e-9)continue;p.set(-a[3],-b[3],-c[3]).applyMatrix3(m.invert());
  if(planes.every(q=>q[0]*p.x+q[1]*p.y+q[2]*p.z+q[3]>=-1e-6))box.expandByPoint(p);}
 return box.expandByScalar(.05);}

// Per side: the nose row's outer edge (A sill, B top) and the side row's forward edge (C sill, D top), on the wall.
function edges(){
 const ws=layout.windows.filter(w=>w.roomId===ROOM),nose=ws.filter(w=>/--head$/.test(w.prototype)),rows=ws.filter(w=>!/--head$/.test(w.prototype));
 return [-1,1].map(side=>{
  const n=nose.reduce((a,b)=>side*b.center[2]>side*a.center[2]?b:a),s=rows.filter(w=>Math.sign(w.center[2])===side).reduce((a,b)=>b.center[0]>a.center[0]?b:a);
  // Corners run [u0 sill, u1 sill, u1 top, u0 top]; the nose chart's u is z, the side charts' u is x.
  const [A,B]=side<0?[n.corners[0],n.corners[3]]:[n.corners[1],n.corners[2]],[Ai,Bi]=side<0?[n.corners[1],n.corners[2]]:[n.corners[0],n.corners[3]];
  // Each neighbour's glass edge at the junction (E0 sill, E1 top) and its far edge (F0, F1), for the pillar flaps.
  return {side,A:v3(A),B:v3(B),C:v3(s.corners[1]),D:v3(s.corners[2]),nose:{E0:v3(A),E1:v3(B),F0:v3(Ai),F1:v3(Bi)},row:{E0:v3(s.corners[1]),E1:v3(s.corners[2]),F0:v3(s.corners[0]),F1:v3(s.corners[3])}};
 });
}

// Pane k lies between vertical divider planes k and k+1; each divider holds a sill point and a top point spaced evenly
// along the two chords. Inside means every plane [a,b,c,d] gives a*x+b*y+c*z+d >= 0.
function panes(){
 const out=[];
 for(const {side,A,B,C,D,nose,row}of edges()){
  const across=C.clone().sub(A),S=k=>A.clone().lerp(C,k/PANES),P=k=>B.clone().lerp(D,k/PANES);
  const divider=k=>{const e=P(k).sub(S(k)),n=new T.Vector3(-e.z,0,e.x).normalize();if(n.dot(across)<0)n.negate();return {k,n,d:-n.dot(S(k))};};
  for(let k=0;k<PANES;k++){
   const a=divider(k),b=divider(k+1),ga=k?MULLION/2:MULLION,gb=k+1<PANES?MULLION/2:MULLION,corners=[S(k),S(k+1),P(k+1),P(k)];
   const c=corners.reduce((s,q)=>s.add(q),new T.Vector3()).multiplyScalar(.25),m=new T.Vector3().crossVectors(corners[2].clone().sub(corners[0]),corners[3].clone().sub(corners[1])).normalize();
   if(m.x*(c.x-CENTRE.x)+m.z*(c.z-CENTRE.z)<0)m.negate();
   const planes=[[a.n.x,0,a.n.z,a.d-ga],[-b.n.x,0,-b.n.z,-b.d-gb],[0,1,0,-A.y],[0,-1,0,B.y],[m.x,m.y,m.z,INSIDE-m.dot(c)],[-m.x,-m.y,-m.z,OUTSIDE+m.dot(c)]];
   const box=regionBox(planes),slab=planes.slice(2);
   // Inner dividers are cut right across (the panes' cuts meet, 1 cm overlapped): a mullion left as a strip of the old
   // wall showed its 25 cm steps and hull facets, so each is rebuilt as a clean bar (mullionBar).
   const cutPlanes=[k?[a.n.x,0,a.n.z,a.d+.005]:planes[0],k+1<PANES?[-b.n.x,0,-b.n.z,-b.d+.005]:planes[1],...slab];
   // The outer gaps (next to the nose row and the side row) are cut as well and closed by a flat mullion face.
   // Each outer gap: [outer bound, inner bound]. Its deep (top band) cut reaches a flap's width past the junction, under
   // the pillar face, to take the neighbouring window's stepped jamb with it.
   const endDefs=[...(k?[]:[{two:[[a.n.x,0,a.n.z,a.d],[-a.n.x,0,-a.n.z,ga-a.d+.005]],flap:FLAP_NOSE,nb:nose}]),...(k+1<PANES?[]:[{two:[[-b.n.x,0,-b.n.z,-b.d],[b.n.x,0,b.n.z,b.d+gb+.005]],flap:FLAP_SIDE,nb:row}])];
   const ends=endDefs.map(e=>prism([...e.two,...slab]));
   // Near the neck the room's envelope sections step inward up to ~0.8 m above the panes' upper part; their walls are
   // cut deeper there (only room-shell and hull-room walls get these cuts, so furniture and signs are untouched).
   const deepen=q=>q.map(r=>r===planes[2]?[0,1,0,-(B.y-DEEP_BAND)]:r===planes[4]?[m.x,m.y,m.z,DEEP-m.dot(c)]:r);
   const deep=[prism(deepen(planes)),...endDefs.map(e=>prism(deepen([[e.two[0][0],0,e.two[0][2],e.two[0][3]+e.flap],e.two[1],...slab]).map(r=>r===planes[3]?[0,-1,0,B.y-.03]:r)))];
   out.push({side,k,a,b,ga,gb,ySill:A.y,yTop:B.y,nbA:k?null:nose,nbB:k+1<PANES?null:row,S0:S(k),P0:P(k),S1:S(k+1),P1:P(k+1),m,c,planes,box,ends,deep,cut:prism(cutPlanes),head:headBand(cutPlanes[0],cutPlanes[1],m,c,B.y)});
  }
 }
 return out;
}

// Mars sits dead ahead, where the centred nose row put a mullion. The two middle nose windows become one 6.3 m pane: the
// pier between them (and FRAME of each window's edge) is cut through and glazed like a shoulder pane, without a bar.
const FRAME=.06;
function centrePane(){
 const nose=layout.windows.filter(w=>w.roomId===ROOM&&/--head$/.test(w.prototype));
 // Only an even row has a mullion on the centreline; a window already spanning it needs nothing.
 if(nose.some(w=>w.corners.some(q=>q[2]<0)&&w.corners.some(q=>q[2]>0)))return null;
 const L=nose.filter(w=>w.center[2]<0).reduce((a,b)=>b.center[2]>a.center[2]?b:a,{center:[0,0,-1e9]}),R=nose.filter(w=>w.center[2]>0).reduce((a,b)=>b.center[2]<a.center[2]?b:a,{center:[0,0,1e9]});
 if(!L.corners||!R.corners)return null;
 // Each window's inner edge, moved FRAME into the window along its sill and head (corners run u0 sill, u1 sill, u1 top, u0 top).
 const inset=(w,e,o)=>v3(w.corners[e]).lerp(v3(w.corners[o]),FRAME/w.width),S0=inset(L,1,0),P0=inset(L,2,3),S1=inset(R,0,1),P1=inset(R,3,2);
 const across=S1.clone().sub(S0),divider=(S,P)=>{const e=P.clone().sub(S),n=new T.Vector3(-e.z,0,e.x).normalize();if(n.dot(across)<0)n.negate();return {n,d:-n.dot(S)};};
 const a=divider(S0,P0),b=divider(S1,P1),corners=[S0,S1,P1,P0],c=corners.reduce((s,q)=>s.add(q),new T.Vector3()).multiplyScalar(.25);
 const m=new T.Vector3().crossVectors(corners[2].clone().sub(corners[0]),corners[3].clone().sub(corners[1])).normalize();if(m.x*(c.x-CENTRE.x)+m.z*(c.z-CENTRE.z)<0)m.negate();
 const planes=[[a.n.x,0,a.n.z,a.d+.005],[-b.n.x,0,-b.n.z,-b.d+.005],[0,1,0,-S0.y],[0,-1,0,P0.y],[m.x,m.y,m.z,INSIDE-m.dot(c)],[-m.x,-m.y,-m.z,OUTSIDE+m.dot(c)]];
 // One sheet of glass spans both windows (their own glass is cut out), so no seam shows where two panes would meet.
 const G=[v3(L.corners[0]),v3(R.corners[1]),v3(R.corners[2]),v3(L.corners[3])],ga=divider(G[0],G[3]),gb=divider(G[1],G[2]);
 const sheet=prism([[ga.n.x,0,ga.n.z,ga.d+.01],[-gb.n.x,0,-gb.n.z,-gb.d+.01],[0,1,0,.01-S0.y],[0,-1,0,P0.y+.01],[m.x,m.y,m.z,.4-m.dot(c)],[-m.x,-m.y,-m.z,.4+m.dot(c)]]);
 return {side:0,k:1,direct:true,a,b,ga:0,gb:0,ySill:S0.y,yTop:P0.y,S0,P0,S1,P1,G,m,c,planes,box:regionBox(planes),ends:[],deep:[],cut:prism(planes),head:headBand(planes[0],planes[1],m,c,P0.y),sheet};
}

// Above a pane's head the hull's underside slopes down into the room to meet the glass (it showed as a lavender band):
// HEAD_BAND cuts it away between the head and just under the ceiling, out to HEAD_IN room-side, for the soffit to close.
const HEAD_IN=2.5;
function headBand(a,b,m,c,yTop){const r=layout.rooms.find(q=>q.id===ROOM);return prism([a,b,[0,1,0,-yTop],[0,-1,0,r.y+r.height-.11],[m.x,m.y,m.z,HEAD_IN-m.dot(c)],[-m.x,-m.y,-m.z,OUTSIDE+m.dot(c)]]);}

function prism(planes){const box=regionBox(planes);return {p:{chart:CHART},rect:[box.min.x,box.max.x,box.min.y,box.max.y],v0:box.min.z,v1:box.max.z,chartPlanes:planes,ignoreOwner:true,box};}

// A cut's plan section at height y, as an [x,z] polygon: its box's square clipped by each plane's half-plane.
function sliceAt(c,y){
 let poly=[[c.box.min.x,c.box.min.z],[c.box.max.x,c.box.min.z],[c.box.max.x,c.box.max.z],[c.box.min.x,c.box.max.z]];
 for(const [a,b,e,d] of c.chartPlanes){const f=q=>a*q[0]+e*q[1]+b*y+d,next=[];
  for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],fp=f(p),fq=f(q);if(fp>=0)next.push(p);
   if(fp*fq<0){const t=fp/(fp-fq);next.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}}
  poly=next;if(poly.length<3)return [];}
 return poly;
}
// The shoulder panes' plan footprints between heights lo and hi, so the facade's deck plates (terraces between the room
// and the hull) are holed where the glass now is, as they are for window prototypes. The centre pane is left out: its
// 0.4 m strip only crosses the pier, and re-holing the terrace mesh runs the authoring renderer out of memory.
let paneCache=null;
export function loungeShoulderFootprints(lo,hi){
 if(!layout.rooms.some(r=>r.id===ROOM))return [];paneCache||=panes();const out=[];
 for(const p of paneCache)for(const c of [p.cut,...p.ends])for(const y of [lo,(lo+hi)/2,hi]){const poly=sliceAt(c,y);if(poly.length>2)out.push(poly);}
 return out;
}

// Opaque triangles near the shoulders, before any cut, for finding the wall's inner and outer faces.
function wallField(root,region){
 const tri=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),t=new T.Box3(),mb=new T.Box3();
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||!shown(o)||![].concat(o.material).every(opaque)||!large(o,mb))return;const g=o.geometry,p=g.attributes.position;if(!p)return;
  g.boundingBox||g.computeBoundingBox();if(!mb.copy(g.boundingBox).applyMatrix4(o.matrixWorld).intersectsBox(region))return;const ix=g.index?.array,n=ix?ix.length:p.count;
  for(let k=0;k+2<n;k+=3){a.fromBufferAttribute(p,ix?ix[k]:k).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,ix?ix[k+1]:k+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,ix?ix[k+2]:k+2).applyMatrix4(o.matrixWorld);
   if(t.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c).intersectsBox(region))tri.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);}
 });
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(tri),3));return new MeshBVH(g);
}

// The wall's inner and outer faces along a horizontal ray, near where the chord says the wall is.
function wallAlong(bvh,origin,dir,expect){
 const hits=bvh.raycast(new T.Ray(origin,dir),T.DoubleSide).filter(h=>h.distance>expect-1.2&&h.distance<expect+OUTSIDE).sort((p,q)=>p.distance-q.distance).filter((h,i,a)=>!i||h.distance-a[i-1].distance>.001);
 if(!hits.length)return null;const inner=hits[0].point,last=hits.filter(h=>h.distance<=hits[0].distance+1).at(-1);
 return {origin,dir,inner,outer:last===hits[0]?inner.clone().addScaledVector(dir,DEPTH):last.point,depth:hits[0].distance};
}
const wallAt=(bvh,origin,target)=>{const dir=target.clone().sub(origin).setY(0),expect=dir.length();return wallAlong(bvh,origin,dir.normalize(),expect);};

// One pane's reveal strips and glass, from rays along its four cut edges and across its face.
function glaze(bvh,p){
 // Glass, bars and reveal ends sit on the pane's own plane (through its corners), not on the sampled hull, whose
 // facets made them jagged; the hull there is cut away, so only the inner (room) face is taken from the samples.
 const flat=h=>{if(h){const t=(p.m.dot(p.c)-p.m.dot(h.origin))/p.m.dot(h.dir);h.outer=h.origin.clone().addScaledVector(h.dir,t);}return h;};
 const reveal=[],glass=[],mullion=[],strip=s=>{for(let i=1;i<s.length;i++)if(s[i-1]&&s[i])reveal.push(s[i-1].inner,s[i-1].outer,s[i].outer,s[i-1].inner,s[i].outer,s[i].inner);};
 const rayAt=(div,gap,sign,S0,P0,j)=>{const n=div.n,f=j/ROWS,y=p.ySill+(p.yTop-p.ySill)*f,chord=S0.clone().lerp(P0,f).addScaledVector(n,sign*gap),o=new T.Vector3(CENTRE.x,y,CENTRE.z);
  o.addScaledVector(n,-(n.dot(o)+div.d-sign*gap));return flat(wallAt(bvh,o,chord));};
 const sideOf=(div,gap,sign,S0,P0)=>Array.from({length:ROWS+1},(_,j)=>rayAt(div,gap,sign,S0,P0,j));
 const left=sideOf(p.a,p.ga,1,p.S0,p.P0),right=sideOf(p.b,p.gb,-1,p.S1,p.P1),outerA=!p.k,outerB=p.k===PANES-1;
 // Flat mullion face over an outer gap, from the glass edge across to the neighbouring row, just room-side of the glass.
 // It runs on past the junction as a flap (an A-pillar) laid on the neighbouring window's own glass plane (from its layout
 // corners, 5 cm room-side), covering the seam and the cut jamb behind it.
 const face=(col,n,shift,nb,flap)=>{const e=col.map(h=>h&&h.outer.clone().addScaledVector(h.dir,-SETBACK-.03));
  const t=flap/nb.E0.distanceTo(nb.F0),nr=new T.Vector3().crossVectors(nb.E1.clone().sub(nb.E0),nb.F0.clone().sub(nb.E0)).normalize();
  if(nr.dot(CENTRE.clone().sub(nb.E0))<0)nr.negate();
  const lo=nb.E0.clone().lerp(nb.F0,t),hi=nb.E1.clone().lerp(nb.F1,t),flapAt=j=>lo.clone().lerp(hi,j/ROWS).addScaledVector(nr,.05);
  for(let j=0;j<ROWS;j++)if(e[j]&&e[j+1]){const q=[e[j],e[j+1]],r=q.map(v=>v.clone().addScaledVector(n,shift)),f=[flapAt(j),flapAt(j+1)];
   mullion.push(q[0],r[0],r[1],q[0],r[1],q[1],r[0],f[0],f[1],r[0],f[1],r[1]);}};
 if(outerA)face(left,p.a.n,-p.ga,p.nbA,FLAP_NOSE);
 if(outerB)face(right,p.b.n,p.gb,p.nbB,FLAP_SIDE);
 // Sill and head strips run on to each divider, so they meet under (and over) a mullion bar or an outer gap's face.
 for(const j of [0,ROWS]){strip([rayAt(p.a,0,1,p.S0,p.P0,j),left[j]]);strip([right[j],rayAt(p.b,0,-1,p.S1,p.P1,j)]);}
 // Across a row, rays sweep from the left divider's ray to the right one's, so the ends stay on the divider planes.
 const sweep=(j,n)=>{const L=left[j],R=right[j];if(!L||!R)return Array(n+1).fill(null);
  return Array.from({length:n+1},(_,i)=>{const s=i/n;if(!i)return L;if(i===n)return R;return flat(wallAlong(bvh,L.origin.clone().lerp(R.origin,s),L.dir.clone().lerp(R.dir,s).normalize(),L.depth+(R.depth-L.depth)*s));});};
 const headRow=sweep(ROWS,EDGE);strip(sweep(0,EDGE));strip(headRow);
 // The head reveal's room edge, divider to divider, for the soffit above it.
 const head=[rayAt(p.a,0,1,p.S0,p.P0,ROWS),...headRow,rayAt(p.b,0,-1,p.S1,p.P1,ROWS)].filter(Boolean).map(h=>h.outer.clone().addScaledVector(h.dir,-SETBACK-.01));
 const grid=[];for(let j=0;j<=ROWS;j++)grid.push(sweep(j,COLS).map(h=>h?h.outer.clone().addScaledVector(h.dir,-SETBACK):null));
 for(let j=0;j<ROWS;j++)for(let i=0;i<COLS;i++){const q=[grid[j][i],grid[j][i+1],grid[j+1][i+1],grid[j+1][i]];if(q.every(Boolean))glass.push(q[0],q[1],q[2],q[0],q[2],q[3]);}
 return {reveal,glass,mullion,left,right,head};
}

// The centre pane spans two windows' open frames, where rays find no wall to sample: its glass is the corner quad, and
// its sill and head reveals run REVEAL back toward the room, as deep as the windows' own.
const REVEAL=.31;
function glazeDirect(p){
 const back=v=>v.clone().addScaledVector(v.clone().sub(CENTRE).setY(0).normalize(),-REVEAL),onGlass=v=>v.clone().addScaledVector(p.m,-SETBACK);
 const [s0,s1,p1,p0]=[p.S0,p.S1,p.P1,p.P0].map(onGlass),g=p.G.map(onGlass),reveal=[],glass=[g[0],g[1],g[2],g[0],g[2],g[3]];
 for(const [a,b] of [[s0,s1],[p0,p1]])reveal.push(a,b,back(b),a,back(b),back(a));
 return {reveal,glass,mullion:[],left:[],right:[],head:[p0,p1]};
}

// Above a pane's head (with the head band cut away) a fascia rises on the glass line to just above the ceiling's
// underside, and a ceiling infill runs SOFFIT room-side from it, hidden wherever the ceiling is.
// HEAD_IN is measured along the leaning pane normal, which reaches ~HEAD_IN/0.6 across the floor plan.
const SOFFIT=HEAD_IN/.6,OVERLAP=.5;
function soffit(line,top){
 // Neighbouring panes lie on slightly different planes, so each fascia runs OVERLAP past its ends to close the seams.
 if(line.length>1){const ext=(a,b)=>a.clone().addScaledVector(a.clone().sub(b).normalize(),OVERLAP);line=[ext(line[0],line[1]),...line,ext(line.at(-1),line.at(-2))];}
 const out=[],up=v=>v.clone().setY(top),inward=v=>up(v).addScaledVector(v.clone().sub(CENTRE).setY(0).normalize(),-SOFFIT),quad=(a,b,c,d)=>out.push(a,b,c,a,c,d);
 for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];quad(a,b,up(b),up(a));quad(up(a),up(b),inward(b),inward(a));}
 return out;
}

// A mullion between two panes: a closed bar from the sill to the head, its back on the two glass edges and its face
// BAR metres room-side, so it no longer shows the old wall's steps. The sill strip closes its foot.
function mullionBar(L,R){
 const out=[],at=(h,deep)=>h.outer.clone().addScaledVector(h.dir,-SETBACK-deep),quad=(a,b,c,d)=>out.push(a,b,c,a,c,d);
 const ring=j=>L[j]&&R[j]?[at(L[j],0),at(L[j],BAR),at(R[j],BAR),at(R[j],0)]:null;
 for(let j=0;j<ROWS;j++){const a=ring(j),b=ring(j+1);if(!a||!b)continue;for(let e=0;e<4;e++)quad(a[e],a[(e+1)%4],b[(e+1)%4],b[e]);}
 // A cap 2 mm above the head, clear of the head strip, so the bar's top never shows open.
 const top=ring(ROWS);if(top)quad(...top.map(v=>v.clone().setY(v.y+.002)));
 return out;
}

// Triangles (point triples) wound so each one's normal faces the target point.
function facing(points,target){
 const out=[],n=new T.Vector3(),e=new T.Vector3();
 for(let i=0;i+2<points.length;i+=3){const [a,b,c]=[points[i],points[i+1],points[i+2]];n.subVectors(b,a).cross(e.subVectors(c,a));
  out.push(...(n.dot(e.copy(target).sub(a))<0?[a,c,b]:[a,b,c]));}
 return out;
}

function meshOf(parent,name,points,material){
 const g=new T.BufferGeometry().setFromPoints(points);g.computeVertexNormals();g.applyMatrix4(parent.matrixWorld.clone().invert());
 const o=new T.Mesh(g,material);o.name=name;o.userData={room:ROOM,loungeShoulder:true};parent.add(o);return o;
}

// Whether any triangle of the mesh has bounds overlapping one of the (world) boxes, tested in the mesh's own space.
function touches(o,boxes){
 const inv=o.matrixWorld.clone().invert(),local=boxes.map(b=>b.clone().applyMatrix4(inv)),g=o.geometry,p=g.attributes.position,ix=g.index?.array,n=ix?ix.length:p.count,t=new T.Box3(),v=new T.Vector3();
 for(let k=0;k+2<n;k+=3){t.makeEmpty();for(let e=0;e<3;e++)t.expandByPoint(v.fromBufferAttribute(p,ix?ix[k+e]:k+e));if(local.some(b=>b.intersectsBox(t)))return true;}
 return false;
}

export function glazeLoungeShoulders(root){
 const t0=performance.now(),room=layout.rooms.find(r=>r.id===ROOM),list=room?panes():[];if(!list.length)return {panes:0};const centre=centrePane(),all=centre?[...list,centre]:list;
if(root.userData.loungeShouldersGlazed)return root.userData.loungeShouldersGlazed;
 root.updateMatrixWorld(true);const shell=root.getObjectByName('V2_shell_'+ROOM)||root,materials=new Map();
 root.traverse(o=>{if(o.isMesh)for(const m of [].concat(o.material))if(m&&!materials.has(m.name))materials.set(m.name,m);});
 const glassMat=materials.get('V2_prototype_hull_glass')||new T.MeshStandardMaterial({name:'V2_prototype_hull_glass',color:0x83b4c4,transparent:true,opacity:.18,depthWrite:false,roughness:.16,metalness:.12,side:T.DoubleSide});
 const rimMat=materials.get('V2_prototype_window_rim')||new T.MeshStandardMaterial({name:'V2_prototype_window_rim',color:0x586e7b,roughness:.35,metalness:.55,side:T.DoubleSide});
 const region=all.reduce((b,p)=>b.union(p.box).union(p.head.box),new T.Box3()).expandByScalar(1),bvh=wallField(root,region);
 const parts=list.map(p=>glaze(bvh,p)),middle=centre?[glazeDirect(centre)]:[],cut=new Map(),cuts=all.flatMap(p=>[p.cut,...p.ends,p.head]),deepCuts=list.flatMap(p=>p.deep);
 // The lounge's own step walls (glass, 25 cm sections in its top band, y+5.7 up) are retired aft of the entry wall at x 170.
 const steps=[{p:{chart:CHART},rect:[171,260,room.y+STEP_FROM,room.y+room.height+.03],v0:-80,v1:80,ignoreOwner:true}];
 // Only meshes with triangles inside a pane (or the step walls) are cut. Interleaved ones (loaded props) are left whole,
 // except one that reaches into a pane (deck 17's hull glass batch): it is de-interleaved first, or its facets stay.
 // The cuts bypass the build cache: packing the big hull meshes for it in the renderer runs out of memory, and the
 // few touched meshes cut in well under a second.
 const stepBox=new T.Box3(new T.Vector3(171,STEP_FROM+room.y,-80),new T.Vector3(260,room.y+room.height+.03,80)),boxes=all.flatMap(p=>[p.cut.box,p.head.box,...(p.sheet?[p.sheet.box]:[]),...p.ends.map(e=>e.box)]);
 const meshes=[],skipped=[],unpacked=[],mb=new T.Box3();root.traverse(o=>{if(!o.isMesh||o.userData.loungeShoulder)return;const big=large(o,mb),pane=big&&mb.intersectsBox(region);
  const step=[].concat(o.material).every(m=>m?.name==='V2_smart_glass')&&mb.intersectsBox(stepBox),deep=DEEP_NAMES.has(o.name)&&mb.intersectsBox(region);if(!pane&&!step&&!deep)return;
  if(Object.values(o.geometry.attributes).some(a=>a.isInterleavedBufferAttribute)){if(!pane||!touches(o,boxes)){skipped.push(o.name);return;}deinterleaveGeometry(o.geometry);unpacked.push(o.name);}meshes.push({o,pane,step,deep});});
 const cache=globalThis.__LEOBuildGeometryCache;globalThis.__LEOBuildGeometryCache=null;
 try{for(const {o,pane,step,deep} of meshes){
  let n=pane&&touches(o,boxes)?cutChartMany(o,cuts):0;
  if(step)n+=cutChartMany(o,steps);
  if(deep)n+=cutChartMany(o,deepCuts);
  if(centre&&pane&&!o.userData.collisionOnly&&[].concat(o.material).every(q=>q?.transparent)&&touches(o,[centre.sheet.box]))n+=cutChartMany(o,[centre.sheet]);
  if(n)cut.set(o.name,(cut.get(o.name)||0)+n);
 }}finally{globalThis.__LEOBuildGeometryCache=cache;}
 // Reveal faces turn toward the room's middle (sill strips up, head strips down), so the head soffit takes the same
 // shade as the side rows' window heads instead of the sky light an upward face catches.
 const reveal=facing([...parts,...middle].flatMap(q=>q.reveal),new T.Vector3(CENTRE.x,room.y+room.height/2,CENTRE.z)),glass=[...parts,...middle].flatMap(q=>q.glass);
 if(reveal.length)meshOf(shell,'V2_lounge_shoulder_reveal',reveal,rimMat);
 const bars=list.flatMap((p,i)=>p.k?mullionBar(parts[i-1].right,parts[i].left):[]);
 const mullion=[...parts.flatMap(q=>q.mullion),...bars];// Two-sided: the pillar faces are wound by construction, not toward the room, and single-sided ones were culled.
 const lining=materials.get('V2_lining'),pillar=lining?lining.clone():rimMat.clone();pillar.side=T.DoubleSide;
 if(mullion.length)meshOf(shell,'V2_lounge_shoulder_mullion',mullion,pillar);
 const fascia=facing([...parts,...middle].flatMap(q=>soffit(q.head,room.y+room.height-.08)),new T.Vector3(CENTRE.x,room.y+room.height/2,CENTRE.z));
 if(fascia.length)meshOf(shell,'V2_lounge_shoulder_soffit',fascia,pillar);
 if(glass.length)meshOf(shell,'V2_lounge_shoulder_glass',glass,glassMat);
 const stats={panes:list.length,centrePane:!!centre,revealTriangles:reveal.length/3,glassTriangles:glass.length/3,barTriangles:bars.length/3,soffitTriangles:fascia.length/3,cut:Object.fromEntries(cut),skipped,unpacked,ms:Math.round(performance.now()-t0)};
 root.userData.loungeShouldersGlazed=stats;console.log('Lounge shoulders',JSON.stringify(stats));return stats;
}
