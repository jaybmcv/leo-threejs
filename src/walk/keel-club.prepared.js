import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {KEEL_HULL as K,HALF} from './keel-club-hull.js';

// The Keel Club (concepts/sports-deck-2026-11): one sports hall filling the hull under Deck 1. The main floor
// (y -51.5) runs from a bulkhead at x -157 to one at x 204, up to 102 m wide; the hull curves up and out from its
// edge, and a raised terrace (y -47.5) runs along each side on that curve; the ceiling sits just under Deck 1.
// The Keel Loop, a lazy river, runs round the whole floor: outside it a promenade along the terrace walls (terrace
// stairs, climbing walls, the walk behind two pairs of waterfalls), inside it the centre island, reached over arched
// bridges that carry water cannons. On the island, aft to bow: arrival plaza and lockers round the aft lifts, four
// tennis courts, two five-a-side pitches either side of a basketball court, a beach and a 120 x 64 m wave lagoon,
// the beach club round the forward lifts, and a starfield driving range whose dome screen stands beyond the river.
// Port terrace: padel, cabanas and beach bar, a slide tower, a lounge cafe. Starboard terrace: mini putt, golf
// simulator bays, a slide tower, the range lounge. Slides drop into the river.
// BLOCKOUT: plain masses only, for the proportion and layout gate. Ship coordinates (x forward, y up, z starboard).
export const KEEL={floor:-51.5,terrace:-47.5,ceiling:-40.2,aft:-157,bow:204,terraceX:[-122,148],cores:[-132,132]};
const {floor:FY,terrace:TY,ceiling:CY}=KEEL;

// Inner half-width of the hull at (x, y), bilinear in the generated table.
export function half(x,y){
 const fx=Math.min(K.nx-1.001,Math.max(0,(x-K.x0)/K.dx)),fy=Math.min(K.ny-1.001,Math.max(0,(y-K.y0)/K.dy)),i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j;
 return (HALF[j][i]*(1-u)+HALF[j][i+1]*u)*(1-v)+(HALF[j+1][i]*(1-u)+HALF[j+1][i+1]*u)*v;
}
const front=x=>half(x,FY);                       // terrace front wall: straight up from the floor's edge
const xsBetween=(a,b,step=2)=>{const n=Math.max(1,Math.ceil((b-a)/step));return Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);};
const ysBetween=(a,b,step=.5)=>xsBetween(a,b,step);

// The wave lagoon in the middle of the floor, with the wave machine at its forward end.
export const WATER={lagoon:[-8,112,32],machine:[112,118]};
// The Keel Loop, the lazy river round the whole main floor (Jay, 2026-11-07): a channel `width` wide whose outer bank
// runs `edge` in from the hull, so a promenade along the terrace walls (with the terrace stairs and the climbing walls)
// stays outside it; it crosses the hall just forward of the aft hull and in front of the range's dome screen. Everything
// inside is the centre island; arched bridges (`rise` over the water, for floaters to pass under) cross to it. The
// water is `drop` below the floor over a bed `bed` down.
export const RIVER={edge:4.5,width:7,aft:-150,bow:196,drop:.4,bed:1.3,rise:1.4};
const rOut=x=>front(x)-RIVER.edge,rIn=x=>rOut(x)-RIVER.width;
export {rOut as riverOuter,rIn as riverInner};
// Bridges: across each side channel at x (4 m wide), and across the aft channel at z (along x).
export const BRIDGES={side:[-116,-62,-10,66,120,160],aft:[0],width:4};
// Waterfalls: the terrace edge reaches out over the promenade to the river's outer bank, and a curtain of water falls
// from it into the river; the promenade passes behind the curtain, under the overhang.
export const FALLS=[[-44,-30],[40,54]];
// Each bridge as its deck's centre line, from 2 m inside the centre island's bank to 2 m past the outer bank.
export const BRIDGE_SPANS=[
 ...BRIDGES.side.flatMap(x=>[-1,1].map(s=>({a:[x,s*(rIn(x)-2)],b:[x,s*(rOut(x)+2)]}))),
 ...BRIDGES.aft.map(z=>({a:[RIVER.aft+RIVER.width+2,z],b:[RIVER.aft-2,z]}))];
// Water cannons, two on each bridge's crown, one on each rail, aimed down the channel either way and 10 degrees down:
// {at (the muzzle's pivot), aim (unit), bridge (index in BRIDGE_SPANS)}.
export const CANNONS=BRIDGE_SPANS.flatMap(({a,b},bridge)=>{const m=[(a[0]+b[0])/2,(a[1]+b[1])/2],l=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/l,(b[1]-a[1])/l],n=[-u[1],u[0]],c=Math.cos(.17),d=Math.sin(.17);
 return [-1,1].map(k=>({at:[m[0]+k*n[0]*(BRIDGES.width/2+.25),KEEL.floor+RIVER.rise+1.15,m[1]+k*n[1]*(BRIDGES.width/2+.25)],aim:[k*n[0]*c,-d,k*n[1]*c],bridge}));});
// Stairs from the main floor up to each terrace: a 23-riser flight running forward along the terrace front wall,
// then a landing at terrace height and a gap in the rail onto the terrace promenade.
export const STAIRS=[-112,-58,124];const RISERS=23,TREAD=.28,STAIR_W=3;
const PROM=3.5;                                  // terrace promenade along the rail
// The two transit cores (TRANSIT_CORES in src/plan/v1.js; check-keel-club.mjs holds these to it): each core's lifts
// (cars at z ±6) get a Keel Club stop in a shaft with its landing door facing the lobby between them, and the
// starboard stair tower carries on down from Deck 1 (whose slab opens over it, layout-v2.js) in three storeys of the
// tower's own switchback: 12 risers up the inner flight, a half landing, 12 back along the outer one.
export const CORES=[{id:'forward',x:132,stairX:141.3,stairZ:5.3},{id:'aft',x:-132,stairX:-133,stairZ:13.5}];
export const DECK1=-39.7,STOREY=(DECK1-KEEL.floor)/3,LIFT_SHAFT={half:1.75,inner:4.05,outer:7.85};

// Blockout colours by role.
const C={floor:0xb9b3a8,lining:0xd9d4cb,ceiling:0xf3e7d2,bulkhead:0xcfc8bc,terraceDeck:0xc8bba6,terraceFront:0xa89c88,prom:0xd6c9b2,
 tennis:0x4f86c6,tennisRun:0x3f6e9c,pitch:0x5fae5a,board:0xf2f2f2,court:0xd98c4a,sand:0xecd49a,water:0x3fb6e0,basin:0x2c7fa3,river:0x55c8e8,
 lobby:0xcbbfb2,locker:0x8a95a5,core:0x6f7d8c,machine:0x7f8a94,range:0x8fc46a,bay:0x6f6a60,dome:0x1d3557,climb:0xe07a5f,
 padel:0x3d7fc4,cabana:0xf4e3c1,bar:0x9b6a3c,slide:0xf2b134,slideTube:0x2f8fd8,lounge:0xe8c9a0,golf:0x9ccc65,sim:0x55606b,putt:0x7cbf50,rail:0x9fd4e6,stair:0xb7aa94};

function paint(g,color){g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal')g.deleteAttribute(k);
 if(!g.attributes.normal)g.computeVertexNormals();const n=g.attributes.position.count,c=new Float32Array(n*3),col=new T.Color(color);
 for(let i=0;i<n;i++)col.toArray(c,i*3);g.setAttribute('color',new T.BufferAttribute(c,3));return g;}
const box=(x0,x1,y0,y1,z0,z1)=>{[x0,x1]=[Math.min(x0,x1),Math.max(x0,x1)];[z0,z1]=[Math.min(z0,z1),Math.max(z0,z1)];return new T.BoxGeometry(x1-x0,y1-y0,z1-z0).translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);};
// Horizontal quad facing up (or down), from x0..x1, z0..z1, at y.
function quad(x0,x1,z0,z1,y,down=false){const p=down?[x0,y,z0,x0,y,z1,x1,y,z1,x0,y,z0,x1,y,z1,x1,y,z0]:[x0,y,z0,x1,y,z1,x0,y,z1,x0,y,z0,x1,y,z0,x1,y,z1];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;}
// A grid surface from a point function f(i,j) over ni x nj samples; flip reverses the winding.
function grid(ni,nj,f,flip=false){const P=[];for(let i=0;i<ni-1;i++)for(let j=0;j<nj-1;j++){const a=f(i,j),b=f(i+1,j),c=f(i+1,j+1),d=f(i,j+1);
  if(flip)P.push(...a,...c,...b,...a,...d,...c);else P.push(...a,...b,...c,...a,...c,...d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.computeVertexNormals();return g;}
// Horizontal polygon (x, z points) with holes, facing up unless down.
function flat(outline,holes,y){const s=new T.Shape(outline.map(([x,z])=>new T.Vector2(x,-z)));for(const h of holes)s.holes.push(new T.Path(h.map(([x,z])=>new T.Vector2(x,-z))));
 const g=new T.ShapeGeometry(s,2);g.rotateX(-Math.PI/2);g.translate(0,y,0);return g;}
const rect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
// Only up-facing triangles of a walk surface reach the walk's ground.
function upward(g){g=g.index?g.toNonIndexed():g;const p=g.attributes.position,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),keep=[];
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);const n=b.clone().sub(a).cross(c.clone().sub(a));
  if(n.y>1e-6*n.length())keep.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);else if(n.y<-1e-6*n.length())keep.push(a.x,a.y,a.z,c.x,c.y,c.z,b.x,b.y,b.z);}
 const o=new T.BufferGeometry();o.setAttribute('position',new T.Float32BufferAttribute(keep,3));o.computeVertexNormals();return o;}
function merge(gs){gs=gs.filter(Boolean).map(g=>{g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal'&&k!=='color')g.deleteAttribute(k);return g;});return gs.length?mergeGeometries(gs):null;}

export function createKeelClub(ship){
 if(ship&&ship.v2Layout===false)return null;
 const group=new T.Group(),solid=new T.Group(),seats=new T.Group();
 group.name='Keel_club';solid.name='Keel_club_solid';seats.name='Keel_club_seats';
 const parts=[],glass=[],glow=[],waterG=[],grounds=[],walls=[];
 const add=(g,color,{ground=false,wall=false}={})=>{parts.push(paint(g.clone(),color));if(ground)grounds.push(upward(g));if(wall)walls.push(g);};
 const xsHall=xsBetween(KEEL.aft,KEEL.bow),ysHall=ysBetween(FY,CY);

 // Shell. Hull lining both sides, floor edge to ceiling.
 for(const s of [-1,1])add(grid(xsHall.length,ysHall.length,(i,j)=>[xsHall[i],ysHall[j],s*half(xsHall[i],ysHall[j])],s>0),C.lining,{wall:true});
 // The hull curves out above the floor's edge, so a hidden kerb along the edge keeps walkers off the gap behind it.
 for(const s of [-1,1])walls.push(grid(xsHall.length,2,(i,j)=>[xsHall[i],j?FY+2.2:FY-.3,s*front(xsHall[i])],s>0));
 // Bulkheads closing the hall aft and at the bow.
 for(const [x,flip] of [[KEEL.aft,false],[KEEL.bow,true]])add(grid(2,ysHall.length,(i,j)=>[x,ysHall[j],(i?1:-1)*half(x,ysHall[j])],flip),C.bulkhead,{wall:true});
 // Ceiling under Deck 1: a glowing sky panel (blockout: flat warm white).
 const ceilOut=[...xsHall.map(x=>[x,-half(x,CY)]),...xsHall.slice().reverse().map(x=>[x,half(x,CY)])];
 // It opens over each lift shaft and each core's stair tower.
 const ceilHoles=CORES.flatMap(c=>[rect(c.x-LIFT_SHAFT.half,c.x+LIFT_SHAFT.half,-LIFT_SHAFT.outer,-LIFT_SHAFT.inner),rect(c.x-LIFT_SHAFT.half,c.x+LIFT_SHAFT.half,LIFT_SHAFT.inner,LIFT_SHAFT.outer),
  rect(c.stairX-4.64,c.stairX+4.64,c.stairZ-2.64,c.stairZ+2.64)]);
 glow.push(paint(flat(ceilOut,ceilHoles,CY),C.ceiling));walls.push(flat(ceilOut,ceilHoles,CY));

 // Main floor: the promenade outside the Keel Loop, and the centre island inside it with the lagoon cut out.
 const floorOut=[...xsHall.map(x=>[x,-front(x)]),...xsHall.slice().reverse().map(x=>[x,front(x)])];
 const {aft:ra,bow:rb,width:RW}=RIVER,xo=xsBetween(ra,rb),xi=xsBetween(ra+RW,rb-RW);
 const ringOut=[...xo.map(x=>[x,-rOut(x)]),...xo.slice().reverse().map(x=>[x,rOut(x)])],ringIn=[...xi.map(x=>[x,-rIn(x)]),...xi.slice().reverse().map(x=>[x,rIn(x)])];
 add(flat(floorOut,[ringOut],FY),C.floor,{ground:true});
 const [lx0,lx1,lz]=WATER.lagoon;
 add(flat(ringIn,[rect(lx0,lx1,-lz,lz)],FY),C.floor,{ground:true});
 // Water: the lagoon (deepening from the beach to the wave machine) and the river, both RIVER.drop below the floor.
 const WY=FY-RIVER.drop,BED=FY-RIVER.bed;
 waterG.push(paint(flat(rect(lx0,lx1,-lz,lz),[],WY),C.water));
 waterG.push(paint(flat(ringOut,[ringIn],WY),C.river));
 parts.push(paint(grid(2,2,(i,j)=>[i?lx1:lx0,FY-(i?3:.6),j?lz:-lz]),C.basin));
 parts.push(paint(flat(ringOut,[ringIn],BED),C.basin));
 // Basin walls: the lagoon's, and both river banks down to the bed (a vertical strip along each outline).
 const ring=(x0,x1,z0,z1,y0,y1)=>[box(x0,x1,y0,y1,z0-.1,z0),box(x0,x1,y0,y1,z1,z1+.1),box(x0-.1,x0,y0,y1,z0,z1),box(x1,x1+.1,y0,y1,z0,z1)];
 for(const g of ring(lx0,lx1,-lz,lz,FY-3,FY))parts.push(paint(g,C.basin));
 const strip=(poly,y0,y1)=>{const P=[];for(let i=0;i<poly.length;i++){const [ax,az]=poly[i],[bx,bz]=poly[(i+1)%poly.length];P.push(ax,y0,az,bx,y0,bz,bx,y1,bz,ax,y0,az,bx,y1,bz,ax,y1,az);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.computeVertexNormals();return g;};
 for(const poly of [ringOut,ringIn])parts.push(paint(strip(poly,BED,FY),C.basin));
 // An invisible guard along every water edge for the walk-only round, open only where a bridge lands (its rails close
 // the sides). Along a side channel's banks it follows the hull's curve; across the ends it runs straight.
 const BW=BRIDGES.width/2,G=1.1;
 const openings=(list,lo,hi)=>{const out=[];let a=lo;for(const c of [...list].sort((p,q)=>p-q)){if(c+BW<lo||c-BW>hi)continue;if(c-BW>a)out.push([a,c-BW]);a=Math.max(a,c+BW);}if(hi>a)out.push([a,hi]);return out;};
 const guardCurve=(f,s,x0,x1)=>{for(const [a,b] of openings(BRIDGES.side,x0,x1)){const xs=xsBetween(a,b);walls.push(grid(xs.length,2,(i,j)=>[xs[i],j?FY+G:FY-.2,s*f(xs[i])]));}};
 const guardLine=(x,z0,z1,open)=>{for(const [a,b] of openings(open,z0,z1))walls.push(box(x-.05,x+.05,FY-.2,FY+G,a,b));};
 for(const s of [-1,1]){guardCurve(rOut,s,ra,rb);guardCurve(rIn,s,ra+RW,rb-RW);}
 guardLine(ra,-rOut(ra),rOut(ra),BRIDGES.aft);guardLine(ra+RW,-rIn(ra+RW),rIn(ra+RW),BRIDGES.aft);guardLine(rb,-rOut(rb),rOut(rb),[]);guardLine(rb-RW,-rIn(rb-RW),rIn(rb-RW),[]);
 for(const z of [-lz,lz])walls.push(box(lx0,lx1,FY,FY+G,z-.05,z+.05));for(const x of [lx0,lx1])walls.push(box(x-.05,x+.05,FY,FY+G,-lz,lz));
 // Arched footbridges: the deck rises RIVER.rise over the water (a half sine over its span, at most 22 degrees), with a
 // solid rail on each side; two water cannons stand on the crown.
 for(const {a,b} of BRIDGE_SPANS){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[-u[1],u[0]],N=24;
  const at=(t,k)=>[a[0]+u[0]*t*L+n[0]*k*BW,FY+RIVER.rise*Math.sin(Math.PI*t),a[1]+u[1]*t*L+n[1]*k*BW];
  // Wound so the deck faces up whichever way the span runs.
  const up=(n[0]*u[1]-n[1]*u[0])>0,deck=grid(N+1,2,(i,j)=>at(i/N,j?1:-1),up);add(deck,C.prom,{ground:true});
  parts.push(paint(grid(N+1,2,(i,j)=>{const p=at(i/N,j?1:-1);return [p[0],Math.max(FY-.05,p[1]-.35),p[2]];},!up),C.bay));
  for(const k of [-1,1]){const r=grid(N+1,2,(i,j)=>{const p=at(i/N,k);return [p[0],p[1]+(j?G:-.35),p[2]];});add(r,C.rail,{wall:true});}
 }
 for(const {at:[x,y,z],aim} of CANNONS){
  add(new T.CylinderGeometry(.22,.28,1.05,10).translate(x,y-.52,z),C.machine);
  // the barrel, built along +z from the pivot, turned onto the aim
  const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...aim).normalize());
  const barrel=new T.CylinderGeometry(.13,.16,1.3,10).rotateX(Math.PI/2).translate(0,0,.45).applyQuaternion(q).translate(x,y+.08,z);
  parts.push(paint(barrel,C.climb));parts.push(paint(new T.BoxGeometry(.5,.32,.42).translate(x,y+.08,z),C.machine));
 }
 // Waterfalls off the terrace edge: an overhang slab out to the river's outer bank (walkable, glass-railed), and a
 // curtain of water from under it into the river; the promenade runs on behind the curtain.
 for(const s of [-1,1])for(const [x0,x1] of FALLS){const m=(x0+x1)/2,zo=rOut(m),zf=front(m);
  add(box(x0,x1,TY-.3,TY,s*zo,s*(zf+.3)),C.terraceDeck,{ground:true});
  for(const g of [box(x0,x1,TY,TY+G,s*zo-.05,s*zo+.05),box(x0-.05,x0+.05,TY,TY+G,s*zo,s*zf),box(x1-.05,x1+.05,TY,TY+G,s*zo,s*zf)]){glass.push(paint(g.clone(),C.rail));walls.push(g);}
  waterG.push(paint(grid(2,2,(i,j)=>[i?x1-.4:x0+.4,j?TY-.3:WY,s*(zo-.7)],s>0),C.river));
  glow.push(paint(box(x0+.3,x1-.3,TY-.42,TY-.3,s*(zo-.2),s*(zo-.9)),C.river));
 }
 // Wave machine at the lagoon's forward end.
 add(box(...WATER.machine,FY,FY+3,-lz,lz),C.machine,{wall:true});

 // Terraces: front wall, deck, end walls, glass rail with gaps at the stair landings.
 const [tx0,tx1]=KEEL.terraceX,xsT=xsBetween(tx0,tx1),ysT=ysBetween(FY,TY);
 for(const s of [-1,1]){
  add(grid(xsT.length,2,(i,j)=>[xsT[i],j?TY:FY,s*front(xsT[i])],s<0),C.terraceFront,{wall:true});
  add(grid(xsT.length,2,(i,j)=>[xsT[i],TY,s*(j?half(xsT[i],TY):front(xsT[i]))],s>0),C.terraceDeck,{ground:true});
  for(const x of [tx0,tx1])add(grid(2,ysT.length,(i,j)=>[x,ysT[j],s*(i?half(x,ysT[j]):front(x))],(x===tx0)!==(s>0)),C.terraceFront,{wall:true});
  // a hidden kerb where the deck meets the hull, which curves out above it, and glass rails across both ends of the deck
  walls.push(grid(xsT.length,2,(i,j)=>[xsT[i],j?TY+2.2:TY-.3,s*half(xsT[i],TY)],s>0));
  for(const x of [tx0,tx1]){const r=grid(2,2,(i,j)=>[x,TY+(j?1.1:0),s*(i?half(x,TY):front(x))]);glass.push(paint(r,C.rail));walls.push(r);}
  // promenade strip along the rail
  parts.push(paint(grid(xsT.length,2,(i,j)=>[xsT[i],TY+.02,s*(front(xsT[i])+(j?PROM:0))],s>0),C.prom));
  // rail: segments between stair landings and waterfall overhangs
  const gaps=[...STAIRS.map(x=>[x+RISERS*TREAD,x+RISERS*TREAD+STAIR_W]),...FALLS].sort((p,q)=>p[0]-q[0]);let a=tx0;
  for(const [g0,g1] of [...gaps,[tx1,tx1]]){for(const x of xsBetween(a,g0,4).slice(0,-1)){const b=Math.min(g0,x+4),z0=front(x),z1=front(b);
    const r=grid(2,2,(i,j)=>[i?b:x,TY+(j?1.1:0),s*(i?z1:z0)]);glass.push(paint(r,C.rail));walls.push(r);}a=g1;}
 }
 // Stairs up to the terraces, on the floor along the front wall, rising forward.
 for(const s of [-1,1])for(const x0 of STAIRS){const zf=front(x0+RISERS*TREAD),zi=zf-STAIR_W,rise=(TY-FY)/RISERS;
  for(let k=0;k<RISERS;k++){const x=x0+k*TREAD,top=FY+(k+1)*rise;add(box(x,x+TREAD,FY,top,s*zi,s*zf),C.stair,{ground:true});}
  // the landing reaches into the terrace's edge, which is wider at its forward end where the hull widens
  const lx=x0+RISERS*TREAD;add(box(lx,lx+STAIR_W,FY,TY,s*zi,s*(Math.max(zf,front(lx+STAIR_W))+.4)),C.stair,{ground:true});
  // open side of the flight and the landing gets a rail
  const g=box(x0,lx+STAIR_W,FY,TY+1.1,s*zi-.05,s*zi+.05);glass.push(paint(g.clone(),C.rail));walls.push(g);
  walls.push(box(lx+STAIR_W,lx+STAIR_W+.1,TY,TY+1.1,s*zi,s*zf));}

 // Lift shafts: end walls, an outer wall and a lobby wall with the landing doorway (2.2 x 2.75 m; lift-ride.js hangs
 // the landing doors, plaque and call light on it). Shafts run from the floor up through the ceiling to Deck 1.
 const {half:sh,inner:si,outer:so}=LIFT_SHAFT,DOOR=1.1,DOOR_TOP=FY+2.75;
 for(const c of CORES)for(const s of [-1,1]){
  for(const x of [c.x-sh,c.x+sh])add(box(x-.1,x+.1,FY,CY,s*si,s*(so+.1)),C.core,{wall:true});
  add(box(c.x-sh-.1,c.x+sh+.1,FY,CY,s*so,s*(so+.1)),C.core,{wall:true});
  for(const [x0,x1] of [[c.x-sh,c.x-DOOR],[c.x+DOOR,c.x+sh]])add(box(x0,x1,FY,CY,s*(si-.02),s*(si+.18)),C.core,{wall:true});
  add(box(c.x-DOOR,c.x+DOOR,DOOR_TOP,CY,s*(si-.02),s*(si+.18)),C.core,{wall:true});
 }
 // Stair towers, starboard of each core: three storeys from the floor up to Deck 1's landing, inside glass-and-steel
 // walls with one doorway, from the bottom landing onto the hall. A spine between the flights stops anyone
 // slipping through, and closes the stairwell from the walk's point of view.
 for(const c of CORES){const x=c.stairX,zz=c.stairZ,run=5/12,rise=STOREY/24,tread=.14;
  for(let k=0;k<3;k++){const y=FY+k*STOREY;
   for(let i=0;i<12;i++){const top=y+(i+1)*rise,bot=k===0?FY:top-tread;
    add(box(x-2.5+i*run,x-2.5+(i+1)*run,bot,top,zz-2.5,zz-.3),C.stair,{ground:true});
    const top2=y+STOREY/2+(i+1)*rise;add(box(x+2.5-(i+1)*run,x+2.5-i*run,top2-tread,top2,zz+.3,zz+2.5),C.stair,{ground:true});}
   add(box(x+2.5,x+4.5,y+STOREY/2-.18,y+STOREY/2,zz-2.5,zz+2.5),C.stair,{ground:true});
   if(k<2)add(box(x-4.5,x-2.5,y+STOREY-.18,y+STOREY,zz-2.5,zz+2.5),C.stair,{ground:true});
  }
  add(box(x-2.5,x+2.5,FY,DECK1-.3,zz-.3,zz+.3),C.core,{wall:true});
  // At Deck 1 the spine carries on as a glass balustrade between the flight up and the flight down.
  {const g=box(x-2.5,x+2.5,DECK1-.3,DECK1+1.1,zz-.05,zz+.05);glass.push(paint(g.clone(),C.rail));walls.push(g);}
  add(box(x-4.64,x+4.64,FY,CY,zz+2.5,zz+2.64),C.core,{wall:true});
  for(const e of [-1,1])add(box(x+e*4.5,x+e*4.64,FY,CY,zz-2.64,zz+2.64),C.core,{wall:true});
  const inner=box(x-2.5,x+4.5,FY,CY,zz-2.64,zz-2.5),lintel=box(x-4.5,x-2.5,FY+2.75,CY,zz-2.64,zz-2.5);
  for(const g of [inner,lintel]){glass.push(paint(g.clone(),C.rail));walls.push(g);}
 }

 // ---- Main floor zones (flat inlays 3 cm proud of the floor) ----
 const inlay=(x0,x1,z0,z1,color,y=FY)=>parts.push(paint(quad(x0,x1,z0,z1,y+.03),color));
 // Arrival plaza and lockers round the aft lifts; beach club and lockers round the forward lifts.
 for(const [x0,x1] of [[-142,-121],[124,146]]){inlay(x0,x1,-30,30,C.lobby);for(const s of [-1,1])add(box(x0+3,x1-3,FY,FY+2.2,s*22,s*24),C.locker,{wall:true});}
 // Four tennis courts, 36.6 x 18.3 m each with run-off, nets across the middle.
 for(let k=0;k<4;k++){const z0=-36.6+k*18.3;inlay(-118,-81.4,z0,z0+18.3,C.tennisRun);parts.push(paint(quad(-111.4,-88,z0+3.2,z0+15.1,FY+.05),C.tennis));add(box(-99.75,-99.65,FY,FY+.95,z0+2.6,z0+15.7),C.board,{wall:true});}
 // Two five-a-side pitches (40 x 25 inside boards) either side of a full-size basketball court.
 for(const s of [-1,1]){const z0=s*11,z1=s*36,zl=Math.min(z0,z1),zh=Math.max(z0,z1);inlay(-78,-34,zl,zh,C.pitch);
  // Boards all round; the long board facing the basketball court has a 3 m gate near each end.
  const zi=s<0?zh:zl,zIn=s<0?[zh-.15,zh]:[zl,zl+.15];
  for(const g of [box(-78,-75,FY,FY+1,...zIn),box(-72,-40,FY,FY+1,...zIn),box(-37,-34,FY,FY+1,...zIn),box(-78,-34,FY,FY+1,...(s<0?[zl,zl+.15]:[zh-.15,zh])),box(-78,-77.85,FY,FY+1,zl,zh),box(-34.15,-34,FY,FY+1,zl,zh)])add(g,C.board,{wall:true});
  for(const x of [-77.4,-35.2])add(box(x-.4,x+.4,FY,FY+2,(zl+zh)/2-1.5,(zl+zh)/2+1.5),C.board);}
 inlay(-72,-40,-9.5,9.5,C.court);for(const x of [-70.6,-41.4])add(box(x-.15,x+.15,FY,FY+3.95,-.9,.9),C.board,{wall:true});
 // Beach, promenades round the lagoon.
 inlay(-30,lx0,-36,36,C.sand);
 for(const s of [-1,1])inlay(lx0,lx1,s<0?-36:lz,s<0?-lz:36,C.prom);
 // Starfield driving range: tee line of bays aft, turf down to the river's bow channel, and beyond it a curved 40 m
 // dome screen, so the Keel Loop floats past in front of the stars.
 inlay(152,rb-RW,-30,30,C.range);
 for(let k=0;k<8;k++){const z0=-24+k*6;add(box(152,156,FY,FY+2.6,z0+.2,z0+.4),C.bay,{wall:true});}
 add(box(152,152.4,FY,FY+2.6,-24,24),C.bay,{wall:true});
 {const zs=xsBetween(-20,20,2),domeX=z=>200-3*(z/20)**2,dome=grid(zs.length,2,(i,j)=>[domeX(zs[i]),j?CY-.6:FY,zs[i]]);glow.push(paint(dome,C.dome));walls.push(dome);}
 // Climbing walls on the bow hull, floor to ceiling, both sides.
 for(const s of [-1,1]){const xs=xsBetween(150,180),ys=ysBetween(FY,CY-.6);add(grid(xs.length,ys.length,(i,j)=>[xs[i],ys[j],s*(half(xs[i],ys[j])-.4)],s>0),C.climb);}

 // ---- Terrace zones (port z<0, starboard z>0), between the promenade and the hull ----
 const tz=(x,s)=>[s*(front(x)+PROM),s*(half(x,TY)-.2)];
 const tinlay=(x0,x1,s,color)=>{const xs=xsBetween(x0,x1,2);parts.push(paint(grid(xs.length,2,(i,j)=>[xs[i],TY+.03,tz(xs[i],s)[j]],s>0),color));};
 const tblock=(x0,x1,s,h,color,inset=.6)=>{const [a,b]=tz((x0+x1)/2,s).map(Math.abs),z0=a+inset,z1=b-inset;add(box(x0,x1,TY,TY+h,s*z0,s*z1),color,{wall:true});};
 // port
 for(let k=0;k<6;k++){const x0=-122+k*20.5;tinlay(x0+.25,x0+20.25,-1,C.padel);for(const x of [x0+.25,x0+20.05])tblock(x,x+.2,-1,3,C.rail,0);}
 tinlay(5,62,-1,C.cabana);for(let k=0;k<6;k++)tblock(8+k*8,11+k*8,-1,2.6,C.cabana,2.5);tblock(52,60,-1,1.1,C.bar,2);
 tinlay(118,148,-1,C.lounge);
 // starboard
 tinlay(-122,-10,1,C.putt);tinlay(-5,60,1,C.golf);for(let k=0;k<13;k++)tblock(-5+k*5.4,-4.8+k*5.4,1,2.6,C.sim,0);
 tinlay(118,148,1,C.lounge);
 // Slide towers, one per terrace, slides dropping over the rail into the river.
 for(const s of [-1,1]){const [a,b]=tz(89,s).map(Math.abs),zc=s*(a+b)/2;add(new T.CylinderGeometry(4,4,CY-.8-TY,20).translate(89,(TY+CY-.8)/2,zc),C.slide,{wall:true});
  for(const [x0,x1] of [[80,93],[93,106]]){const P=new T.CatmullRomCurve3([new T.Vector3(89,CY-1.6,zc),new T.Vector3((x0+x1)/2,TY+1,s*(front(x0)+1)),new T.Vector3(x1,FY-.2,s*(rIn(x1)+RW/2))]);parts.push(paint(new T.TubeGeometry(P,24,.7,8),C.slideTube));}}

 // ---- Merge into a few draws ----
 const opaque=new T.MeshStandardMaterial({name:'Keel_club_blockout',vertexColors:true,roughness:.85,metalness:0,side:T.DoubleSide});
 const lit=new T.MeshStandardMaterial({name:'Keel_club_glow',vertexColors:true,roughness:1,emissive:0xffffff,emissiveIntensity:.35,side:T.DoubleSide});
 const see=new T.MeshStandardMaterial({name:'Keel_club_glass',vertexColors:true,roughness:.1,transparent:true,opacity:.35,depthWrite:false,side:T.DoubleSide});
 const wet=new T.MeshStandardMaterial({name:'Keel_club_water',vertexColors:true,roughness:.08,transparent:true,opacity:.78,depthWrite:false,side:T.DoubleSide});
 for(const [gs,m,name] of [[parts,opaque,'Keel_club_blockout'],[glow,lit,'Keel_club_glow'],[glass,see,'Keel_club_glass'],[waterG,wet,'Keel_club_water']]){const g=merge(gs);if(!g)continue;const mesh=new T.Mesh(g,m);mesh.name=name;group.add(mesh);}
 const hidden=new T.MeshBasicMaterial({visible:false});
 for(const [gs,name] of [[grounds,'Keel_club_walkway'],[walls,'Keel_club_guard_wall']]){const g=merge(gs.map(g=>{g=g.index?g.toNonIndexed():g.clone();for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);return g;}));if(g){const m=new T.Mesh(g,hidden);m.name=name;solid.add(m);}}
 // Water cannons: E on a bridge's crown fires the nearest one (fire(i)) for a second and a half. Its jet is droplets
 // on a ballistic arc (one instanced draw for all of them) that leave splash rings where they hit the river (another).
 const DROPS=720,RINGS=40,SPEED=14,GRAV=9.8,JET=1.5,RATE=140,REACH=2.6;
 const dropMesh=new T.InstancedMesh(new T.IcosahedronGeometry(.16,0),new T.MeshBasicMaterial({name:'Keel_club_cannon_drop',color:0xffffff,toneMapped:false,transparent:true,opacity:.95,depthWrite:false}),DROPS);
 const ringMesh=new T.InstancedMesh(new T.RingGeometry(.25,.45,18).rotateX(-Math.PI/2),new T.MeshBasicMaterial({name:'Keel_club_cannon_splash',color:0xffffff,toneMapped:false,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide}),RINGS);
 for(const m of [dropMesh,ringMesh]){m.name='Keel_club_cannon_water';m.frustumCulled=false;m.count=0;m.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(m);}
 const drops=[],rings=[],jets=[],M=new T.Matrix4(),Q=new T.Quaternion(),S=new T.Vector3(),P=new T.Vector3();
 const fire=i=>{if(!CANNONS[i])return;const j=jets.find(j=>j.i===i);if(j)j.t=0;else jets.push({i,t:0,acc:0});};
 // Of the cannons within reach, the one aimed most nearly the way the walker faces (heading, as main.js keeps it:
 // facing sin, cos in x, z); without a heading, the nearest.
 const near=(p,heading)=>{let best=-1,bs=-Infinity;CANNONS.forEach((c,i)=>{const d=Math.hypot(p.x-c.at[0],p.z-c.at[2]);if(d>=REACH||Math.abs(p.y-(FY+RIVER.rise))>=1.2)return;
  const score=heading===undefined?-d:c.aim[0]*Math.sin(heading)+c.aim[2]*Math.cos(heading)-d*.01;if(score>bs){bs=score;best=i;}});
  return best<0?null:{kind:'cannon',cannon:best,label:'Fire the water cannon'};};
 const update=dt=>{
  if(!jets.length&&!drops.length&&!rings.length)return;dt=Math.min(dt,.05);
  for(let k=jets.length-1;k>=0;k--){const j=jets[k],{at,aim}=CANNONS[j.i];j.t+=dt;if(j.t>JET){jets.splice(k,1);continue;}j.acc+=dt*RATE;
   for(;j.acc>=1&&drops.length<DROPS;j.acc--){const sp=SPEED*(.94+Math.random()*.12),jit=()=>(Math.random()-.5)*.04;
    drops.push({p:[at[0]+aim[0]*1.1,at[1]+.08+aim[1]*1.1,at[2]+aim[2]*1.1],v:[(aim[0]+jit())*sp,(aim[1]+jit())*sp,(aim[2]+jit())*sp]});}}
  for(let k=drops.length-1;k>=0;k--){const d=drops[k];d.v[1]-=GRAV*dt;for(let a=0;a<3;a++)d.p[a]+=d.v[a]*dt;
   if(d.p[1]<=WY){drops.splice(k,1);if(rings.length<RINGS&&Math.random()<.3)rings.push({p:[d.p[0],WY+.02,d.p[2]],t:0});}}
  for(let k=rings.length-1;k>=0;k--){rings[k].t+=dt;if(rings[k].t>.6)rings.splice(k,1);}
  drops.forEach((d,i)=>dropMesh.setMatrixAt(i,M.makeTranslation(d.p[0],d.p[1],d.p[2])));dropMesh.count=drops.length;
  rings.forEach((r,i)=>{const g=1+r.t*4;ringMesh.setMatrixAt(i,M.compose(P.set(...r.p),Q.identity(),S.set(g,1,g)));});ringMesh.count=rings.length;
  dropMesh.instanceMatrix.needsUpdate=true;ringMesh.instanceMatrix.needsUpdate=true;
 };
 // Its top band stops under Deck 1's: the walk draws it from Deck 1 (down the stair tower and lift shafts) and below, never from Deck 2 up.
 return {group,solid,seats,update,near,fire,bounds:{y0:FY-3,y1:CY-.6}};
}
