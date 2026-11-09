import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {KEEL_HULL as K,HALF,KEEL_BOTTOM as KB,BOTTOM} from './keel-club-hull.js';

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
// The hull's bottom (its outer skin) at (x, z), bilinear in the generated table. The hull's bottom is only 1-3.5 m under
// the floor, and it rises steeply under the floor's edges and at both ends, so every basin below the floor keeps
// SKIN_GAP above it (the full nightly's skin gate, check-skin-clearance-v2.mjs, found the river bed and the lagoon's
// deep end through it on 2026-11-09; check-keel-club.mjs audits the club against the finished web skin the same way).
export function hullBottom(x,z){
 const fx=Math.min(KB.nx-1.001,Math.max(0,(x-KB.x0)/KB.dx)),fz=Math.min(KB.nz-1.001,Math.abs(z)/KB.dz),i=Math.floor(fx),k=Math.floor(fz),u=fx-i,v=fz-k;
 return (BOTTOM[i][k]*(1-v)+BOTTOM[i][k+1]*v)*(1-u)+(BOTTOM[i+1][k]*(1-v)+BOTTOM[i+1][k+1]*v)*u;
}
const SKIN_GAP=.05;
const front=x=>half(x,FY);                       // terrace front wall: straight up from the floor's edge
const xsBetween=(a,b,step=2)=>{const n=Math.max(1,Math.ceil((b-a)/step));return Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);};
const ysBetween=(a,b,step=.5)=>xsBetween(a,b,step);

// The wave lagoon in the middle of the floor, with the wave machine at its forward end.
export const WATER={lagoon:[-8,112,32],machine:[112,118]};
// The Keel Loop, the lazy river round the whole main floor (Jay, 2026-11-07): a channel `width` wide whose outer bank
// runs `edge` in from the hull, so a promenade along the terrace walls (with the terrace stairs and the climbing walls)
// stays outside it; it crosses the hall just forward of the aft hull and in front of the range's dome screen. Everything
// inside is the centre island; arched bridges (`rise` over the water, for floaters to pass under) cross to it. The
// water is `drop` below the floor over a bed `bed` down. The bridges' decks are `deck` thick: a seated tube rider's
// head clears every bridge's underside anywhere a tube can go (check-keel-club.mjs).
export const RIVER={edge:4.5,width:7,aft:-150,bow:196,drop:.8,bed:1.6,rise:1.8,deck:.3};
const rOut=x=>front(x)-RIVER.edge,rIn=x=>rOut(x)-RIVER.width;
export {rOut as riverOuter,rIn as riverInner};
// Where the water can be: inside rOut, and only where the hull's bottom is at least SHORE below the water, so its bed
// fits above the skin. That pulls the outer bank in at the aft corners and a little at the bow corners, where the hull
// rises under the river's ends; along the sides the bed shoals to a few centimetres at the outer bank instead (bedAt).
const SHORE=.05,riverWet=(x,z)=>Math.abs(z)<=rOut(x)&&hullBottom(x,z)<=FY-RIVER.drop-SHORE;
// The outer bank's |z| at x: rOut, or nearer the middle where riverWet stops (the hull's bottom rises outwards).
export function riverBank(x){let z=rOut(x);if(riverWet(x,z))return z;let lo=0;for(let n=0;n<24;n++){const m=(lo+z)/2;if(riverWet(x,m))lo=m;else z=m;}return lo;}
// The river's bed at (x, z): RIVER.bed down, raised to keep SKIN_GAP above the hull's bottom, and always just under the water.
const bedAt=(x,z)=>Math.min(FY-RIVER.drop-.02,Math.max(FY-RIVER.bed,hullBottom(x,z)+SKIN_GAP));
export {bedAt as riverBed};
// Bridges: across each side channel at x (4 m wide), and across the aft channel at z (along x).
export const BRIDGES={side:[-116,-62,-10,66,120,160],aft:[0],width:4};
// Waterfalls: the terrace edge reaches out over the promenade to the river's outer bank, and a curtain of water falls
// from it into the river; the promenade passes behind the curtain, under the overhang.
export const FALLS=[[-44,-30],[40,54]];
// Each bridge as its deck's centre line, from LAND m inside the centre island's bank to LAND m past the outer bank: a
// 13 m span, so the arch is still high over a tube steered right up to either bank (and no steeper than 23 degrees).
const LAND=3;
export const BRIDGE_SPANS=[
 ...BRIDGES.side.flatMap(x=>[-1,1].map(s=>({a:[x,s*(rIn(x)-LAND)],b:[x,s*(rOut(x)+LAND)]}))),
 ...BRIDGES.aft.map(z=>({a:[RIVER.aft+RIVER.width+LAND,z],b:[RIVER.aft-LAND,z]}))];
// Water cannons, two on each bridge's crown, one on each rail, aimed down the channel either way and 10 degrees down:
// {at (the muzzle's pivot), aim (unit), bridge (index in BRIDGE_SPANS)}.
export const CANNONS=BRIDGE_SPANS.flatMap(({a,b},bridge)=>{const m=[(a[0]+b[0])/2,(a[1]+b[1])/2],l=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/l,(b[1]-a[1])/l],n=[-u[1],u[0]],c=Math.cos(.17),d=Math.sin(.17);
 return [-1,1].map(k=>({at:[m[0]+k*n[0]*(BRIDGES.width/2+.25),KEEL.floor+RIVER.rise+1.15,m[1]+k*n[1]*(BRIDGES.width/2+.25)],aim:[k*n[0]*c,-d,k*n[1]*c],bridge}));});
// The underside of whichever bridge deck is over (x, z), or Infinity: the arch's half sine over its span, less `deck`.
export function bridgeUnderside(x,z){let low=Infinity;for(const {a,b} of BRIDGE_SPANS){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],dx=x-a[0],dz=z-a[1],t=(dx*u[0]+dz*u[1])/L,w=Math.abs(-dx*u[1]+dz*u[0]);
 if(t<0||t>1||w>BRIDGES.width/2+.05)continue;low=Math.min(low,KEEL.floor+RIVER.rise*Math.sin(Math.PI*t)-RIVER.deck);}return low;}

// ---- Floating the Keel Loop (round 2) ----
// The river's centre line as one closed loop, the way its water flows: forward along port, across the bow, aft along
// starboard, across the aft end. Sampled about every metre, its corners rounded by a moving average (`ROUND` samples
// either side), with the arc length at each sample. A frame's `right` points to the centre island.
// A floating tube's underside: createTubeMesh's torus (.55 round, .24 thick) floats .08 over the water (main.js), so its
// lowest ring, TUBE_KEEL round its centre, is .16 under the water; the steering keeps it TUBE_DRAFT (2 cm more) over the bed.
const ROUND=6,TUBE_RING=.9,TUBE_KEEL=.55,TUBE_DRAFT=.18;
export const RIVER_PATH=(()=>{const {aft:ra,bow:rb,width:W}=RIVER,xa=ra+W/2,xb=rb-W/2,zc=x=>rIn(x)+W/2,raw=[];
 const leg=(x0,z0,x1,z1)=>{const n=Math.max(1,Math.round(Math.hypot(x1-x0,z1-z0)));for(let i=0;i<n;i++)raw.push([x0+(x1-x0)*i/n,z0+(z1-z0)*i/n]);};
 for(let x=xa;x<xb;x+=1)raw.push([x,-zc(x)]);leg(xb,-zc(xb),xb,zc(xb));for(let x=xb;x>xa;x-=1)raw.push([x,zc(x)]);leg(xa,zc(xa),xa,-zc(xa));
 const n=raw.length,pts=raw.map((_,i)=>{let x=0,z=0;for(let k=-ROUND;k<=ROUND;k++){const q=raw[(i+k+n)%n];x+=q[0];z+=q[1];}return [x/(2*ROUND+1),z/(2*ROUND+1)];});
 const len=[0];for(let i=1;i<=n;i++)len.push(len[i-1]+Math.hypot(pts[i%n][0]-pts[i-1][0],pts[i%n][1]-pts[i-1][1]));
 // How far a tube may steer either way at each sample: its whole ring (TUBE_RING) still in the water. Rounding the
 // corners pulls the line towards the island, so near a corner the island side narrows.
 const wet=(x,z)=>x>=ra&&x<=rb&&riverWet(x,z)&&!(x>ra+W&&x<rb-W&&Math.abs(z)<rIn(x));
 // Its underside must clear the bed too, which shoals towards the outer bank over the hull's bottom (bedAt).
 const ring=(x,z)=>{for(let a=0;a<12;a++){const c=Math.cos(a*Math.PI/6),n=Math.sin(a*Math.PI/6);
  if(!wet(x+c*TUBE_RING,z+n*TUBE_RING)||bedAt(x+c*TUBE_KEEL,z+n*TUBE_KEEL)>FY-RIVER.drop-TUBE_DRAFT)return false;}return true;};
 const lo=[],hi=[];pts.forEach((p,i)=>{const a=pts[(i-1+n)%n],b=pts[(i+1)%n],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1,rx=-(b[1]-a[1])/l,rz=(b[0]-a[0])/l;
  const reach=sgn=>{let d=0;while(d<W/2&&ring(p[0]+rx*(d+.05)*sgn,p[1]+rz*(d+.05)*sgn))d+=.05;return d-.1;};hi.push(Math.max(0,reach(1)));lo.push(-Math.max(0,reach(-1)));});
 return {pts,len,total:len[n],lo,hi};})();
// The point, the unit tangent (downstream) and `right` (to the island) at arc length s, wrapped round the loop.
export function riverFrame(s){const {pts,len,total}=RIVER_PATH,n=pts.length;s=((s%total)+total)%total;
 let lo=0,hi=n;while(hi-lo>1){const m=(lo+hi)>>1;if(len[m]<=s)lo=m;else hi=m;}
 const a=pts[lo],b=pts[(lo+1)%n],seg=len[lo+1]-len[lo]||1,u=(s-len[lo])/seg,tx=(b[0]-a[0])/seg,tz=(b[1]-a[1])/seg;
 const j=(lo+1)%n;return {x:a[0]+(b[0]-a[0])*u,z:a[1]+(b[1]-a[1])*u,tx,tz,rx:-tz,rz:tx,lo:Math.max(RIVER_PATH.lo[lo],RIVER_PATH.lo[j]),hi:Math.min(RIVER_PATH.hi[lo],RIVER_PATH.hi[j])};}
// The loop's arc length and offset nearest to (x, z).
export function riverNearest(x,z){const {pts,len}=RIVER_PATH;let best=0,bd=Infinity;pts.forEach((p,i)=>{const d=(p[0]-x)**2+(p[1]-z)**2;if(d<bd){bd=d;best=i;}});
 const f=riverFrame(len[best]);return {s:len[best],d:(x-f.x)*f.rx+(z-f.z)*f.rz};}
// A tube (numbers from Astra's review, 2026-11-08): the current carries it at `current`; forward keys add `paddle`,
// back keys brake by `brake` (it still drifts downstream); side keys steer at `steer`, eased over `ease` seconds. A hit
// adds `kick` (capped at `kickMax`), decaying with time constant `kickDecay`; speed is capped at `max`. It stays
// `radius` clear of both banks; a rider sits `seat` above the water. Docks: `reach` to take a tube, `capture` (along
// the loop) to be let out at one.
export const TUBE={current:.9,paddle:.8,brake:.6,steer:.7,ease:.2,kick:.7,kickMax:1,kickDecay:.4,max:2.2,radius:TUBE_RING,seat:.25,reach:2.2,capture:2.5};
export const TUBE_RANGE=RIVER.width/2-TUBE.radius;
// Tube docks on the centre island's bank, four a side, clear of the bridges: `at` is where you stand to take a tube
// and where you are let out; `s` is its place on the loop.
export const DOCKS=[-95,-30,15,112].flatMap(x=>[-1,1].map(side=>{const at=[x,KEEL.floor,side*(rIn(x)-1.2)];return {x,side,at,s:riverNearest(at[0],at[2]).s};}));
export const tubeBoard=dock=>({s:dock.s,d:Math.min(TUBE_RANGE*.6,riverFrame(dock.s).hi),vs:TUBE.current*.5,vd:0,ks:0,kd:0});
// One step of a tube: `wish` is the walker's camera-relative move (x, z), any length.
export function tubeStep(st,dt,wish){const f=riverFrame(st.s),m=wish?Math.hypot(wish.x,wish.z):0,k=m>.05?1/Math.max(1,m):0;
 const along=Math.max(-1,Math.min(1,((wish?.x||0)*f.tx+(wish?.z||0)*f.tz)*k)),across=Math.max(-1,Math.min(1,((wish?.x||0)*f.rx+(wish?.z||0)*f.rz)*k));
 const e=1-Math.exp(-dt/TUBE.ease),d=Math.exp(-dt/TUBE.kickDecay);
 st.vs+=(TUBE.current+(along>0?along*TUBE.paddle:along*TUBE.brake)-st.vs)*e;st.vd+=(across*TUBE.steer-st.vd)*e;st.ks*=d;st.kd*=d;
 const vs=Math.max(TUBE.current-TUBE.brake,Math.min(TUBE.max,st.vs+st.ks));
 st.s=((st.s+vs*dt)%RIVER_PATH.total+RIVER_PATH.total)%RIVER_PATH.total;
 // it steers within the water at its new place (riverFrame's lo..hi), and stops steering at a bank
 const g=riverFrame(st.s),nd=st.d+(st.vd+st.kd)*dt;st.d=Math.max(g.lo,Math.min(g.hi,nd));if(st.d!==nd){st.vd=0;st.kd=0;}return st;}
// A hit's push, (x, z) world direction, into the tube's frame, capped.
export function tubeKick(st,dir){const f=riverFrame(st.s),m=Math.hypot(dir[0],dir[1])||1,a=(dir[0]*f.tx+dir[1]*f.tz)/m,c=(dir[0]*f.rx+dir[1]*f.rz)/m;
 st.ks=Math.max(-TUBE.kickMax,Math.min(TUBE.kickMax,st.ks+a*TUBE.kick));st.kd=Math.max(-TUBE.kickMax,Math.min(TUBE.kickMax,st.kd+c*TUBE.kick));return st;}
// Where the rider sits (the tube's top, over the water), facing downstream.
export function tubeSeat(st){const f=riverFrame(st.s);return {x:f.x+f.rx*st.d,y:KEEL.floor-RIVER.drop+TUBE.seat,z:f.z+f.rz*st.d,yaw:Math.atan2(f.tx,f.tz)};}
// The dock a tube can be let out at, or null: within `capture` of it along the loop.
export function tubeDock(st){const T0=RIVER_PATH.total;for(const dock of DOCKS){let ds=Math.abs(st.s-dock.s);ds=Math.min(ds,T0-ds);if(ds<=TUBE.capture)return dock;}return null;}
// A tube's bright ring: one geometry and one material for every rider's tube, so a tube needs no disposing.
let tubeShape=null,tubeMaterial=null;
export function createTubeMesh(){tubeShape??=new T.TorusGeometry(.55,.24,10,28).rotateX(Math.PI/2);tubeMaterial??=new T.MeshStandardMaterial({name:'Keel_club_tube',color:0xf07c3c,roughness:.45});
 const m=new T.Mesh(tubeShape,tubeMaterial);m.name='Keel_club_tube';return m;}
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

// Colours by role: the ship's warm interior whites and stone (the arrival hall, the atrium), teal accents, light wood
// decks, and court colours.
const C={floor:0xe4d8c4,lining:0xf1e8da,ceiling:0xfff3df,bulkhead:0xe8dccb,terraceDeck:0xcda06e,terraceFront:0xe9dac4,prom:0xecdfc8,
 tennis:0x3b74b4,tennisRun:0x2e5a8a,pitch:0x4f9b49,board:0xf4f4f0,court:0xcf9a5e,sand:0xf1dfae,water:0x22c6cf,basin:0x1f6f88,river:0x37d0d9,
 lobby:0xe4dccb,locker:0x2f707b,core:0x5e6c79,machine:0x6b7783,range:0x77b95a,bay:0x3c4550,dome:0x1d3557,climb:0xd9775c,
 padel:0x2f6db3,cabana:0xf7ecd6,bar:0x8a5a33,slide:0xf2b134,slideTube:0x2f8fd8,lounge:0xd9b98f,golf:0x8dc35a,sim:0x2a3138,putt:0x5aab48,rail:0xbfe3ee,stair:0xd2c6b0,
 line:0xfbfbf6,net:0x27323a,wood:0xa77b4f,lounger:0xf3f1ea,teal:0x2a9d9a,orange:0xf07c3c,canopyA:0xf6f1e4,canopyB:0x2a9d9a,screen:0x2f6fb8,cup:0x1e2328,mat:0x2f6e3a,rim:0xe0662a,lamp:0xfff1dc,shaft:0xdfe3e1,beam:0xefe7dc,rib:0xf7efe3,recess:0x24304a,cove:0xffd9a3,glowEdge:0x8ff4ff,railLed:0xffd59a,
 lantern:0xffc46e,brass:0xc9a15a,leaf:0x3f8a3c,leafDark:0x2f6b33,flower:0xe0413a,flowerPink:0xf08bb4,blossom:0xf5a9c8,wicker:0xc79a62,cushion:0xf3ece0,marble:0xf4f1ec,frame:0x2b3036,
 thatch:0xc99a5c,curtain:0xfbf7ef,rock:0xa9a196,climbWall:0xeee3d1,simWall:0x3f6e4f,turf:0x5fae48,bed:0x56733b,bag:0x22262b,crest:0xe9fbfb};

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
function merge(gs,keep=['position','normal','color']){gs=gs.filter(Boolean).map(g=>{g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(!keep.includes(k))g.deleteAttribute(k);return g;});return gs.length?mergeGeometries(gs):null;}
// A grid surface like grid(), with texture coordinates uv(i,j).
function gridUV(ni,nj,f,uv,flip=false){const P=[],U=[];for(let i=0;i<ni-1;i++)for(let j=0;j<nj-1;j++){const q=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]],o=flip?[0,2,1,0,3,2]:[0,1,2,0,2,3];
  for(const k of o){P.push(...f(...q[k]));U.push(...uv(...q[k]));}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.computeVertexNormals();return g;}
// Split a merged, non-indexed geometry into `n` sections along x (by each triangle's centre), so each section has its
// own bounds and the walk culls what is out of view; triangles longer than a section (the big floor and ceiling
// polygons) go in a section of their own.
function sections(g,n,x0=KEEL.aft,x1=KEEL.bow){if(!g)return [];const p=g.attributes.position.array,tris=p.length/9,w=(x1-x0)/n,bins=Array.from({length:n+1},()=>[]);
 for(let t=0;t<tris;t++){const a=p[t*9],b=p[t*9+3],c=p[t*9+6],span=Math.max(a,b,c)-Math.min(a,b,c),k=span>w?n:Math.max(0,Math.min(n-1,Math.floor(((a+b+c)/3-x0)/w)));bins[k].push(t);}
 return bins.filter(b=>b.length).map(list=>{const out=new T.BufferGeometry();for(const [name,attr] of Object.entries(g.attributes)){const s=attr.itemSize,src=attr.array,dst=new Float32Array(list.length*3*s);
   list.forEach((t,i)=>dst.set(src.subarray(t*3*s,(t+1)*3*s),i*3*s));out.setAttribute(name,new T.BufferAttribute(dst,s));}out.computeBoundingSphere();return out;});}
// A small seeded random, so the club builds the same every time (the prepared walk is fingerprinted).
function seeded(seed){let s=seed%2147483647||1;return ()=>(s=s*16807%2147483647)/2147483647;}
// Canvas textures exist only in a browser; the node checks build the club without them.
function canvasTexture(w,h,draw){if(typeof document==='undefined')return null;const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
// The labels on the club's signs, one row each of one texture.
export const SIGNS=['KEEL CLUB','KEEL CLUB  ↓','TENNIS','5-A-SIDE','BASKETBALL','BEACH','WAVE LAGOON','DRIVING RANGE','PADEL','CABANAS · BEACH BAR','MINI PUTT','GOLF SIMS','CLIMBING WALLS','KEEL LOOP','FLOAT THE KEEL LOOP'];

export function createKeelClub(ship){
 if(ship&&ship.v2Layout===false)return null;
 const group=new T.Group(),solid=new T.Group(),seats=new T.Group();
 group.name='Keel_club';solid.name='Keel_club_solid';seats.name='Keel_club_seats';
 const parts=[],glass=[],glow=[],grounds=[],walls=[],stars=[],lamps=[],signs=[],curtains=[],skyPanel=[],hiddenSeat=new T.MeshBasicMaterial({visible:false});
 // What stands on Deck 1 itself (each stair's balustrade and sign) draws with Deck 1, not with the hall.
 const d1={parts:[],glass:[],signs:[]};
 // A walkable box (a tread, a landing, an overhang) also blocks: its sides are walls, or walkers pass into it.
 const add=(g,color,{ground=false,wall=false}={})=>{parts.push(paint(g.clone(),color));if(ground)grounds.push(upward(g));if(wall||(ground&&g.type==='BoxGeometry'))walls.push(g);};
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
 skyPanel.push(flat(ceilOut,ceilHoles,CY));walls.push(flat(ceilOut,ceilHoles,CY));

 // Main floor: the promenade outside the Keel Loop, and the centre island inside it with the lagoon cut out.
 const floorOut=[...xsHall.map(x=>[x,-front(x)]),...xsHall.slice().reverse().map(x=>[x,front(x)])];
 const {aft:ra,bow:rb,width:RW}=RIVER,xo=xsBetween(ra,rb),xi=xsBetween(ra+RW,rb-RW);
 // The river's outlines (its outer bank where the hull allows, riverBank), each end in 1 m steps so its bank meets the bed.
 const across=(x,b,up)=>{const zs=xsBetween(-b,b,1).slice(1,-1);return (up?zs:zs.reverse()).map(z=>[x,z]);};
 const ringOut=[...xo.map(x=>[x,-riverBank(x)]),...across(rb,riverBank(rb),true),...xo.slice().reverse().map(x=>[x,riverBank(x)]),...across(ra,riverBank(ra),false)],
  ringIn=[...xi.map(x=>[x,-rIn(x)]),...across(rb-RW,rIn(rb-RW),true),...xi.slice().reverse().map(x=>[x,rIn(x)]),...across(ra+RW,rIn(ra+RW),false)];
 add(flat(floorOut,[ringOut],FY),C.floor,{ground:true});
 const [lx0,lx1,lz]=WATER.lagoon;
 add(flat(ringIn,[rect(lx0,lx1,-lz,lz)],FY),C.floor,{ground:true});
 // Water: the lagoon and the river, both RIVER.drop below the floor. The lagoon's floor deepens from the beach (.6 m)
 // to the wave machine (3 m) and shoals towards its sides to keep SKIN_GAP above the hull; the river's bed is bedAt.
 const WY=FY-RIVER.drop,lagoonFloor=(x,z)=>Math.max(FY-.6-2.4*(x-lx0)/(lx1-lx0),hullBottom(x,z)+SKIN_GAP);
 {const xs=xsBetween(lx0,lx1,4),zs=xsBetween(-lz,lz,1);parts.push(paint(grid(xs.length,zs.length,(i,j)=>[xs[i],lagoonFloor(xs[i],zs[j]),zs[j]],true),C.basin));}
 // The river's bed: along each side channel from bank to bank, and right across each end.
 for(const s of [-1,1])parts.push(paint(grid(xi.length,8,(i,j)=>{const x=xi[i],z=rIn(x)+(riverBank(x)-rIn(x))*j/7;return [x,bedAt(x,z),s*z];},s>0),C.basin));
 for(const [x0,x1] of [[ra,ra+RW],[rb-RW,rb]]){const xs=xsBetween(x0,x1,1),n=Math.ceil(2*Math.max(...xs.map(riverBank)))+1;
  parts.push(paint(grid(xs.length,n,(i,j)=>{const x=xs[i],b=riverBank(x),z=-b+2*b*j/(n-1);return [x,bedAt(x,z),z];},true),C.basin));}
 // Basin walls: the lagoon's and both river banks, from the basin's floor up to the main floor (a strip along each outline).
 const strip=(poly,y0,y1)=>{const P=[],lo=typeof y0==='function'?y0:()=>y0;for(let i=0;i<poly.length;i++){const [ax,az]=poly[i],[bx,bz]=poly[(i+1)%poly.length],ay=lo(ax,az),by=lo(bx,bz);P.push(ax,ay,az,bx,by,bz,bx,y1,bz,ax,ay,az,bx,y1,bz,ax,y1,az);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.computeVertexNormals();return g;};
 {const xs=xsBetween(lx0,lx1,4),zs=xsBetween(-lz,lz,1);parts.push(paint(strip([...xs.map(x=>[x,-lz]),...zs.slice(1,-1).map(z=>[lx1,z]),...xs.slice().reverse().map(x=>[x,lz]),...zs.slice(1,-1).reverse().map(z=>[lx0,z])],lagoonFloor,FY),C.basin));}
 for(const poly of [ringOut,ringIn])parts.push(paint(strip(poly,bedAt,FY),C.basin));
 // An invisible guard along every water edge for the walk-only round, open only where a bridge lands (its rails close
 // the sides). Along a side channel's banks it follows the hull's curve; across the ends it runs straight.
 const BW=BRIDGES.width/2,G=1.1;
 const openings=(list,lo,hi)=>{const out=[];let a=lo;for(const c of [...list].sort((p,q)=>p-q)){if(c+BW<lo||c-BW>hi)continue;if(c-BW>a)out.push([a,c-BW]);a=Math.max(a,c+BW);}if(hi>a)out.push([a,hi]);return out;};
 const guardCurve=(f,s,x0,x1)=>{for(const [a,b] of openings(BRIDGES.side,x0,x1)){const xs=xsBetween(a,b);walls.push(grid(xs.length,2,(i,j)=>[xs[i],j?FY+G:FY-.2,s*f(xs[i])]));}};
 const guardLine=(x,z0,z1,open)=>{for(const [a,b] of openings(open,z0,z1))walls.push(box(x-.05,x+.05,FY-.2,FY+G,a,b));};
 for(const s of [-1,1]){guardCurve(riverBank,s,ra,rb);guardCurve(rIn,s,ra+RW,rb-RW);}
 guardLine(ra,-riverBank(ra),riverBank(ra),BRIDGES.aft);guardLine(ra+RW,-rIn(ra+RW),rIn(ra+RW),BRIDGES.aft);guardLine(rb,-riverBank(rb),riverBank(rb),[]);guardLine(rb-RW,-rIn(rb-RW),rIn(rb-RW),[]);
 for(const z of [-lz,lz])walls.push(box(lx0,lx1,FY,FY+G,z-.05,z+.05));for(const x of [lx0,lx1])walls.push(box(x-.05,x+.05,FY,FY+G,-lz,lz));
 // Arched footbridges: the deck rises RIVER.rise over the water (a half sine over its span, at most 22 degrees), with a
 // solid rail on each side; two water cannons stand on the crown.
 for(const {a,b} of BRIDGE_SPANS){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/L,(b[1]-a[1])/L],n=[-u[1],u[0]],N=24;
  const at=(t,k)=>[a[0]+u[0]*t*L+n[0]*k*BW,FY+RIVER.rise*Math.sin(Math.PI*t),a[1]+u[1]*t*L+n[1]*k*BW];
  // Wound so the deck faces up whichever way the span runs.
  const up=(n[0]*u[1]-n[1]*u[0])>0,deck=grid(N+1,2,(i,j)=>at(i/N,j?1:-1),up);add(deck,C.prom,{ground:true});
  parts.push(paint(grid(N+1,2,(i,j)=>{const p=at(i/N,j?1:-1);return [p[0],Math.max(FY-.05,p[1]-RIVER.deck),p[2]];},!up),C.rib));
  // each side: a white fascia over the deck's edge, a glass rail above it and a warm LED handrail along its top
  for(const k of [-1,1]){const side=(y0,y1)=>grid(N+1,2,(i,j)=>{const p=at(i/N,k);return [p[0],p[1]+(j?y1:y0),p[2]];});
   parts.push(paint(side(-RIVER.deck,.14),C.rib));glass.push(paint(side(.14,G),C.rail));walls.push(side(-RIVER.deck,G));lamps.push(paint(side(G,G+.07),C.railLed));}
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
  curtains.push({x0:x0+.4,x1:x1-.4,z:s*(zo-.7),s});
  glow.push(paint(box(x0+.3,x1-.3,TY-.42,TY-.3,s*(zo-.2),s*(zo-.9)),C.river));
  lamps.push(paint(box(x0,x1,TY-.26,TY-.06,s*(zo-.07),s*(zo-.02)),C.cove));
  parts.push(paint(quad(x0,x1,s*zo,s*zf,TY-.305,true),0xc69a6a));for(let z=zo+.1;z<zf;z+=.22)parts.push(paint(box(x0,x1,TY-.35,TY-.305,s*z,s*(z+.1)),0x9a6a40));
  for(let x=x0+1.5;x<x1-1;x+=2.5)lamps.push(paint(new T.CircleGeometry(.16,10).rotateX(Math.PI/2).translate(x,TY-.37,s*(zf-1.7)),C.lantern));
 }
 // Wave machine at the lagoon's forward end.
 add(box(...WATER.machine,FY,FY+3,-lz,lz),C.machine,{wall:true});

 // Terraces: front wall, deck, end walls, glass rail with gaps at the stair landings.
 const [tx0,tx1]=KEEL.terraceX,xsT=xsBetween(tx0,tx1),ysT=ysBetween(FY,TY);
 for(const s of [-1,1]){
  add(grid(xsT.length,2,(i,j)=>[xsT[i],j?TY:FY,s*front(xsT[i])],s<0),C.terraceFront,{wall:true});
  lamps.push(paint(grid(xsT.length,2,(i,j)=>[xsT[i],TY-.2+j*.1,s*(front(xsT[i])-.02)],s<0),C.cove));
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
    const r=grid(2,2,(i,j)=>[i?b:x,TY+(j?1.1:0),s*(i?z1:z0)]);glass.push(paint(r,C.rail));walls.push(r);
    lamps.push(paint(grid(2,2,(i,j)=>[i?b:x,TY+1.1+j*.05,s*(i?z1:z0)]),C.railLed));}a=g1;}
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
  for(const x of [c.x-sh,c.x+sh])add(box(x-.1,x+.1,FY,CY,s*si,s*(so+.1)),C.shaft,{wall:true});
  add(box(c.x-sh-.1,c.x+sh+.1,FY,CY,s*so,s*(so+.1)),C.shaft,{wall:true});
  for(const [x0,x1] of [[c.x-sh,c.x-DOOR],[c.x+DOOR,c.x+sh]])add(box(x0,x1,FY,CY,s*(si-.02),s*(si+.18)),C.shaft,{wall:true});
  add(box(c.x-DOOR,c.x+DOOR,DOOR_TOP,CY,s*(si-.02),s*(si+.18)),C.shaft,{wall:true});
  // a teal band round the shaft at door-head height
  {const y0=DOOR_TOP+.1,y1=DOOR_TOP+.5;for(const g of [box(c.x-sh-.12,c.x+sh+.12,y0,y1,s*(si-.06),s*(si-.02)),box(c.x-sh-.12,c.x+sh+.12,y0,y1,s*(so+.1),s*(so+.14)),box(c.x-sh-.14,c.x-sh-.1,y0,y1,s*(si-.06),s*(so+.14)),box(c.x+sh+.1,c.x+sh+.14,y0,y1,s*(si-.06),s*(so+.14))])parts.push(paint(g,C.teal));}
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
  add(box(x-2.5,x+2.5,FY,DECK1-.3,zz-.3,zz+.3),C.shaft,{wall:true});
  // At Deck 1 the spine carries on as a glass balustrade between the flight up and the flight down.
  {const g=box(x-2.5,x+2.5,DECK1-.3,DECK1+1.1,zz-.05,zz+.05);d1.glass.push(paint(g.clone(),C.rail));walls.push(g);}
  add(box(x-4.64,x+4.64,FY,CY,zz+2.5,zz+2.64),C.shaft,{wall:true});
  for(const e of [-1,1])add(box(x+e*4.5,x+e*4.64,FY,CY,zz-2.64,zz+2.64),C.shaft,{wall:true});
  const inner=box(x-2.5,x+4.5,FY,CY,zz-2.64,zz-2.5),lintel=box(x-4.5,x-2.5,FY+2.75,CY,zz-2.64,zz-2.5);
  for(const g of [inner,lintel]){glass.push(paint(g.clone(),C.rail));walls.push(g);}
 }

 // ---- Main floor zones (flat inlays 3 cm proud of the floor; lines 6 cm) ----
 const inlay=(x0,x1,z0,z1,color,y=FY)=>parts.push(paint(quad(x0,x1,z0,z1,y+.03),color));
 // A painted line from (x0, z0) to (x1, z1) at height y, w wide; a ring of them for arcs.
 const line=(x0,z0,x1,z1,y=FY+.06,w=.07)=>{const dx=x1-x0,dz=z1-z0,l=Math.hypot(dx,dz)||1,nx=-dz/l*w/2,nz=dx/l*w/2,g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute([x0+nx,y,z0+nz,x1+nx,y,z1+nz,x1-nx,y,z1-nz,x0+nx,y,z0+nz,x1-nx,y,z1-nz,x0-nx,y,z0-nz],3));g.computeVertexNormals();parts.push(paint(g,C.line));};
 const lines=(x0,x1,z0,z1,y)=>{line(x0,z0,x1,z0,y);line(x1,z0,x1,z1,y);line(x1,z1,x0,z1,y);line(x0,z1,x0,z0,y);};
 const arc=(cx,cz,r,a0,a1,y,n=24)=>{for(let i=0;i<n;i++){const a=a0+(a1-a0)*i/n,b=a0+(a1-a0)*(i+1)/n;line(cx+r*Math.cos(a),cz+r*Math.sin(a),cx+r*Math.cos(b),cz+r*Math.sin(b),y);}};
 const rnd=seeded(7117);
 // Seats the walk can use (rest.js names): hidden markers in `seats`, the visible furniture in parts.
 const marker=(name,g)=>{const m=new T.Mesh(g,hiddenSeat);m.name=name;seats.add(m);};
 // A sun lounger along x or z: a lie-down spot (rest.js reads 'Hammock' as a bed with no pillow).
 const lounger=(cx,y,cz,alongX=true)=>{const L=1.95,W=.68,b=alongX?box(cx-L/2,cx+L/2,y,y+.32,cz-W/2,cz+W/2):box(cx-W/2,cx+W/2,y,y+.32,cz-L/2,cz+L/2);add(b,C.lounger,{wall:true});
  const head=alongX?box(cx+L/2-.45,cx+L/2,y+.32,y+.62,cz-W/2,cz+W/2):box(cx-W/2,cx+W/2,y+.32,y+.62,cz+L/2-.45,cz+L/2);parts.push(paint(head,C.teal));
  marker('Hammock',alongX?box(cx-L/2+.1,cx+L/2-.1,y+.28,y+.34,cz-W/2+.05,cz+W/2-.05):box(cx-W/2+.05,cx+W/2-.05,y+.28,y+.34,cz-L/2+.1,cz+L/2-.1));};
 const umbrella=(x,y,z,color)=>{parts.push(paint(new T.CylinderGeometry(.04,.04,2.4,6).translate(x,y+1.2,z),C.wood));parts.push(paint(new T.ConeGeometry(1.5,.55,10).translate(x,y+2.5,z),color));};
 const stool=(x,y,z)=>{add(new T.CylinderGeometry(.2,.17,.72,10).translate(x,y+.36,z),C.wood,{wall:true});marker('Seat',box(x-.18,x+.18,y+.7,y+.74,z-.18,z+.18));};
 // A bench facing `face` (+1/-1 in z): seat, and its back on the far side, as rest.js seats.
 const bench=(x,y,z,face)=>{add(box(x-.9,x+.9,y,y+.45,z-.22,z+.22),C.wood,{wall:true});const bz=z-face*.25;parts.push(paint(box(x-.9,x+.9,y+.45,y+.9,bz-.04,bz+.04),C.wood));
  marker('Bench_cushion',box(x-.85,x+.85,y+.43,y+.47,z-.2,z+.2));marker('Bench_back',box(x-.85,x+.85,y+.5,y+.85,bz-.03,bz+.03));};
 // ---- Dressing (refinement round 2): the furniture, planters, lanterns and lamps of the concept renders ----
 const dr=seeded(4243);
 // A lantern: a glowing drum under a brass cap (on a table, or bigger on the deck).
 const lantern=(x,y,z,h=.3,r=.11)=>{lamps.push(paint(new T.CylinderGeometry(r,r,h,8).translate(x,y+h/2,z),C.lantern));parts.push(paint(new T.CylinderGeometry(r*1.2,r*1.2,.04,8).translate(x,y+h+.02,z),C.brass));};
 // A flowering bush (radius r) standing at (x, y, z).
 const bush=(x,y,z,r=.5)=>{parts.push(paint(new T.IcosahedronGeometry(r,1).scale(1,.7,1).translate(x,y+r*.55,z),dr()<.5?C.leaf:C.leafDark));
  for(let k=0;k<5;k++){const a=k*1.26+dr()*.6,d=r*(.45+dr()*.4);parts.push(paint(new T.IcosahedronGeometry(.07+dr()*.05,0).translate(x+Math.cos(a)*d,y+r*(.75+dr()*.4),z+Math.sin(a)*d),k%2?C.flower:C.flowerPink));}};
 // A brass planter with a flowering bush in it; solid unless it stands on top of something (free).
 const planter=(x,y,z,r=.45,free=false)=>{parts.push(paint(new T.CylinderGeometry(r,r*.88,.5,12).translate(x,y+.25,z),C.brass));bush(x,y+.4,z,r*1.05);if(!free)walls.push(box(x-r,x+r,y,y+1,z-r,z+r));};
 // A rattan armchair facing yaw (a multiple of 90 degrees; 0 faces +z): wicker seat, back and arms, a cushion, and the
 // seat and back markers rest.js sits on.
 const chair=(x,y,z,yaw)=>{const put=g=>g.rotateY(yaw).translate(x,y,z);
  add(put(box(-.34,.34,0,.42,-.3,.3)),C.wicker,{wall:true});parts.push(paint(put(box(-.36,.36,.42,.95,-.34,-.24)),C.wicker));
  for(const e of [-1,1])parts.push(paint(put(box(e*.36-.05,e*.36+.05,.42,.62,-.3,.26)),C.wicker));
  parts.push(paint(put(box(-.29,.29,.42,.52,-.24,.26)),C.cushion));marker('Seat',put(box(-.2,.2,.44,.48,-.18,.22)));marker('Seat_back',put(box(-.3,.3,.6,.9,-.31,-.27)));};
 // A round marble table on a brass stem with a lantern on it, and n chairs round it facing in (n = 2: along x; 4: x and z).
 const cafe=(x,y,z,n=2)=>{add(new T.CylinderGeometry(.07,.2,.72,8).translate(x,y+.36,z),C.brass,{wall:true});parts.push(paint(new T.CylinderGeometry(.46,.46,.04,16).translate(x,y+.74,z),C.marble));
  lantern(x,y+.76,z);for(let k=0;k<n;k++){const a=Math.PI/2+k*Math.PI*2/n;chair(x+Math.round(Math.sin(a))*.95,y,z+Math.round(Math.cos(a))*.95,a+Math.PI);}};
 // A dark lamp post with a glowing lantern head; a short glowing bollard.
 const lampPost=(x,y,z,h=3.4)=>{add(new T.CylinderGeometry(.05,.08,h,6).translate(x,y+h/2,z),C.frame,{wall:true});lamps.push(paint(new T.CylinderGeometry(.15,.12,.42,8).translate(x,y+h+.21,z),C.lantern));parts.push(paint(new T.ConeGeometry(.22,.16,8).translate(x,y+h+.5,z),C.frame));};
 const bollard=(x,y,z)=>{parts.push(paint(new T.CylinderGeometry(.08,.08,.5,8).translate(x,y+.25,z),C.frame));lamps.push(paint(new T.CylinderGeometry(.085,.085,.22,8).translate(x,y+.61,z),C.lantern));};
 // A vertical panel from (x0, z0) to (x1, z1), y0 to y1 (a mesh fence when painted dark into glass).
 const vpanel=(x0,z0,x1,z1,y0,y1)=>grid(2,2,(i,j)=>[i?x1:x0,j?y1:y0,i?z1:z0]);
 // A thin rod from p to q (ropes, cords).
 const rod=(p,q,r,color)=>{const a=new T.Vector3(...p),b=new T.Vector3(...q),d=b.clone().sub(a),g=new T.CylinderGeometry(r,r,d.length(),4).translate(0,d.length()/2,0);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));parts.push(paint(g.translate(a.x,a.y,a.z),color));};
 const screens={range:[],sims:[]};

 // Arrival plaza and lockers round the aft lifts; beach club and lockers round the forward lifts.
 for(const [x0,x1] of [[-142,-121],[124,146]]){inlay(x0,x1,-30,30,C.lobby);for(const s of [-1,1]){add(box(x0+3,x1-3,FY,FY+2.2,s*22,s*24),C.locker,{wall:true});
  const face=s<0?-21.99:21.99;for(let x=x0+3.6;x<x1-3.4;x+=.6)parts.push(paint(box(x,x+.02,FY+.1,FY+2.1,face-.01,face+.01),C.teal));
  lamps.push(paint(box(x0+3,x1-3,FY+2.2,FY+2.25,s*22.2,s*23.8),C.lantern));for(const x of [x0+1.6,x1-1.6]){planter(x,FY,s*22.6,.55);lantern(x,FY,s*20.6,.55,.17);}}}
 // the walk out of each core's lifts, lined with planters and floor lanterns, and soft sofas facing it
 for(const xs of [-123,123])for(const s of [-1,1]){const z=s*7.2,bz=z+s*.45;add(box(xs-1.4,xs+1.4,FY,FY+.42,z-.42,z+.42),C.cushion,{wall:true});parts.push(paint(box(xs-1.4,xs+1.4,FY+.42,FY+.95,bz-.12,bz+.12),C.cushion));
  for(const e of [-1,1])parts.push(paint(box(xs+e*1.4-.12,xs+e*1.4+.12,FY,FY+.62,z-.42,z+.42),C.cushion));lamps.push(paint(box(xs-1.4,xs+1.4,FY+.02,FY+.06,z-s*.44,z-s*.4),C.lantern));
  marker('Bench_cushion',box(xs-1.2,xs+1.2,FY+.4,FY+.44,z-.35,z+.35));marker('Bench_back',box(xs-1.2,xs+1.2,FY+.5,FY+.9,bz-.05,bz+.05));}
 for(const [xs,dir] of [[-127,1],[127,-1]])for(const s of [-1,1])for(let k=0;k<3;k++){const x=xs+dir*k*3.5;planter(x,FY,s*3.4,.5);lantern(x+dir*1.75,FY,s*3.4,.5,.16);}
 // Four tennis courts, 36.6 x 18.3 m each with run-off, nets across the middle, lines to the real court.
 for(let k=0;k<4;k++){const z0=-36.6+k*18.3,cz=z0+9.15,cx=-99.7,y=FY+.06;inlay(-118,-81.4,z0,z0+18.3,C.tennisRun);parts.push(paint(quad(-111.585,-87.815,cz-5.485,cz+5.485,FY+.05),C.tennis));
  lines(cx-11.885,cx+11.885,cz-5.485,cz+5.485,y);for(const z of [cz-4.115,cz+4.115])line(cx-11.885,z,cx+11.885,z,y);for(const x of [cx-6.4,cx+6.4])line(x,cz-4.115,x,cz+4.115,y);line(cx-6.4,cz,cx+6.4,cz,y);
  add(box(-99.75,-99.65,FY,FY+.95,z0+2.6,z0+15.7),C.net,{wall:true});for(const z of [z0+2.6,z0+15.7])add(box(-99.78,-99.62,FY,FY+1.07,z-.08,z+.08),C.board);}
 // Two five-a-side pitches (40 x 25 inside boards) either side of a full-size basketball court.
 for(const s of [-1,1]){const z0=s*11,z1=s*36,zl=Math.min(z0,z1),zh=Math.max(z0,z1),zc=(zl+zh)/2,y=FY+.06;inlay(-78,-34,zl,zh,C.pitch);
  // Boards all round; the long board facing the basketball court has a 3 m gate near each end.
  const zIn=s<0?[zh-.15,zh]:[zl,zl+.15];
  for(const g of [box(-78,-75,FY,FY+1,...zIn),box(-72,-40,FY,FY+1,...zIn),box(-37,-34,FY,FY+1,...zIn),box(-78,-34,FY,FY+1,...(s<0?[zl,zl+.15]:[zh-.15,zh])),box(-78,-77.85,FY,FY+1,zl,zh),box(-34.15,-34,FY,FY+1,zl,zh)])add(g,C.board,{wall:true});
  lines(-77.5,-34.5,zl+.4,zh-.4,y);line(-56,zl+.4,-56,zh-.4,y);arc(-56,zc,3,0,Math.PI*2,y,32);arc(-77.5,zc,6,-Math.PI/2,Math.PI/2,y);arc(-34.5,zc,6,Math.PI/2,Math.PI*1.5,y);
  // goals: posts and crossbar, a dark net behind
  for(const [x,d] of [[-77.5,-1],[-34.5,1]]){for(const z of [zc-1.5,zc+1.5])add(box(x-.06,x+.06,FY,FY+2,z-.06,z+.06),C.board,{wall:true});parts.push(paint(box(x-.06,x+.06,FY+1.94,FY+2.06,zc-1.56,zc+1.56),C.board));
   glass.push(paint(box(x+d*.2,x+d*.22,FY,FY+2,zc-1.5,zc+1.5),C.net));}
  // a dark mesh fence over the boards (open over the gates), on posts, with a top rail
  const zi=(zIn[0]+zIn[1])/2,zo=s<0?zl+.07:zh-.07;
  for(const [x0,z0,x1,z1] of [[-78,zi,-75,zi],[-72,zi,-40,zi],[-37,zi,-34,zi],[-78,zo,-34,zo],[-77.93,zl,-77.93,zh],[-34.07,zl,-34.07,zh]]){glass.push(paint(vpanel(x0,z0,x1,z1,FY+1,FY+4.5),C.net));
   const L=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.round(L/4));for(let k=0;k<=n;k++){const x=x0+(x1-x0)*k/n,z=z0+(z1-z0)*k/n;parts.push(paint(box(x-.05,x+.05,FY,FY+4.55,z-.05,z+.05),C.frame));}
   parts.push(paint(box(Math.min(x0,x1)-.04,Math.max(x0,x1)+.04,FY+4.47,FY+4.55,Math.min(z0,z1)-.04,Math.max(z0,z1)+.04),C.frame));}}
 // Basketball: a full court in maple, lines, keys and three-point arcs, glass backboards and orange rims.
 {const y=FY+.06;inlay(-72,-40,-9.5,9.5,C.court);lines(-70.5,-41.5,-7.5,7.5,y);line(-56,-7.5,-56,7.5,y);arc(-56,0,1.8,0,Math.PI*2,y,28);
  for(const [x,d] of [[-70.5,1],[-41.5,-1]]){lines(Math.min(x,x+d*5.8),Math.max(x,x+d*5.8),-2.45,2.45,y);const hx=x+d*1.575,A=Math.asin(6.6/6.75);
   if(d>0)arc(hx,0,6.75,-A,A,y,28);else arc(hx,0,6.75,Math.PI-A,Math.PI+A,y,28);
   for(const z of [-6.6,6.6])line(x,z,hx+d*6.75*Math.cos(A),z,y);
   add(box(x-d*.35-.12,x-d*.35+.12,FY,FY+3.95,-.12,.12),C.core,{wall:true});glass.push(paint(box(Math.min(x+d*.95,x+d*1.0),Math.max(x+d*.95,x+d*1.0),FY+2.9,FY+3.95,-.9,.9),C.rail));
   parts.push(paint(new T.TorusGeometry(.23,.02,6,16).rotateX(Math.PI/2).translate(hx,FY+3.05,0),C.rim));parts.push(paint(box(Math.min(x-d*.35,x+d*.97),Math.max(x-d*.35,x+d*.97),FY+3.4,FY+3.5,-.06,.06),C.core));}}
 // Beach: loungers in rows under umbrellas, facing the lagoon.
 inlay(-30,lx0,-36,36,C.sand);
 for(let r=0;r<3;r++)for(let k=0;k<8;k++){const x=-25+r*6.2,z=-31+k*8.85;lounger(x,FY,z-1.1);lounger(x,FY,z+1.1);umbrella(x+1.6,FY,z,k%2?C.canopyB:C.curtain);}
 for(const s of [-1,1])inlay(lx0,lx1,s<0?-36:lz,s<0?-lz:36,C.prom);
 // Benches along the river promenade, facing the water, clear of the bridges, the terrace stairs and the climbing walls.
 for(const s of [-1,1])for(let x=-140;x<=188;x+=12){if(BRIDGES.side.some(c=>Math.abs(x-c)<4.5)||STAIRS.some(x0=>x>x0-2.5&&x<x0+RISERS*TREAD+STAIR_W+1.5)||(x>146&&x<183))continue;
  bench(x,FY,s*(front(x)-1.05),-s);}
 for(const s of [-1,1])for(let x=-137;x<=188;x+=24){if(BRIDGES.side.some(c=>Math.abs(x-c)<4.5)||STAIRS.some(x0=>x>x0-2.5&&x<x0+RISERS*TREAD+STAIR_W+1.5)||FALLS.some(([a,b])=>x>a-1.5&&x<b+1.5)||(x>146&&x<183))continue;
  lampPost(x,FY,s*(front(x)-.45));}
 // Starfield driving range: tee bays with mats, turf with target rings down to the river's bow channel, and beyond it a
 // curved 40 m dome screen of stars, so the Keel Loop floats past in front of them.
 inlay(152,rb-RW,-30,30,C.range);
 for(let k=0;k<8;k++){const z0=-24+k*6;add(box(152,156,FY,FY+1.2,z0+.2,z0+.4),C.bay,{wall:true});lantern(155.6,FY+1.2,z0+.3,.3,.12);if(k<7)parts.push(paint(quad(156.4,158.4,z0+1.6,z0+4.8,FY+.05),C.mat));}
 add(box(152,152.4,FY,FY+1,-24,24),C.bay,{wall:true});
 lamps.push(paint(box(152,152.4,FY+1,FY+1.05,-24,24),C.cove));
 for(let k=0;k<7;k++){const z=-24+k*6+5.4;parts.push(paint(new T.CylinderGeometry(.15,.13,.85,8).translate(153.2,FY+.43,z),C.bag));for(let j=0;j<3;j++)parts.push(paint(box(153.1+j*.08,153.16+j*.08,FY+.85,FY+1.05,z-.05,z+.05),C.line));}
 for(const [x,z,r,c] of [[166,-12,2.4,C.orange],[172,8,3,C.line],[178,-4,3.6,C.screen],[184,14,2.6,C.orange],[184,-18,2.6,C.line]])for(const k of [1,.62,.3])parts.push(paint(new T.RingGeometry(r*k-.18,r*k,28).rotateX(-Math.PI/2).translate(x,FY+.05+k*.002,z),k===.62?C.line:c));
 for(const [x,z] of [[166,-12],[172,8],[178,-4],[184,14],[184,-18]]){parts.push(paint(new T.CylinderGeometry(.02,.02,1.6,4).translate(x,FY+.8,z),C.line));const f=new T.BufferGeometry();f.setAttribute('position',new T.Float32BufferAttribute([x,FY+1.6,z,x,FY+1.3,z,x,FY+1.45,z-.5],3));f.computeVertexNormals();parts.push(paint(f,C.orange));}
 {const zs=xsBetween(-20,20,1),domeX=z=>200-3*(z/20)**2,dome=gridUV(zs.length,2,(i,j)=>[domeX(zs[i]),j?CY-.6:FY,zs[i]],(i,j)=>[i/(zs.length-1),j?1:0]);screens.range.push(dome);walls.push(dome.clone());}
 // Climbing walls on the bow hull, floor to ceiling, both sides, with holds, and crash mats at their foot.
 for(const s of [-1,1]){const xs=xsBetween(150,180),ys=ysBetween(FY,CY);add(grid(xs.length,2,(i,j)=>[xs[i],j?CY:FY,s*(front(xs[i])+.05)],s>0),C.climbWall,{wall:true});
  for(const x of [150,180])parts.push(paint(grid(2,ys.length,(i,j)=>[x,ys[j],s*(i?half(x,ys[j]):front(x)+.05)]),C.climbWall));
  inlay(150,180,s<0?-front(165):front(165)-2.2,s<0?-(front(165)-2.2):front(165),C.screen);
  for(let k=0;k<240;k++){const x=150.6+rnd()*28.8,y=FY+.4+rnd()*(CY-FY-1.6),z=s*(front(x)-.02);parts.push(paint(new T.IcosahedronGeometry(.1+rnd()*.14,0).scale(1,1,.6).translate(x,y,z),[C.orange,C.teal,C.flowerPink,C.slide,C.screen,0x8a5cc9][k%6]));}
  for(let k=0;k<26;k++){const x=151+dr()*28,y=FY+1+dr()*(CY-FY-2.4);parts.push(paint(new T.TetrahedronGeometry(.35+dr()*.35).scale(1,1,.5).translate(x,y,s*(front(x)-.05)),[C.screen,C.slide,C.orange,C.teal][k%4]));}
  // a rope from each top anchor down to the mats
  for(let x=151.5;x<179;x+=2.5){const yt=CY-.8;parts.push(paint(box(x-.08,x+.08,yt-.08,yt+.08,s*(front(x)-.2),s*(front(x)+.05)),C.frame));rod([x,yt,s*(front(x)-.15)],[x,FY+1,s*(front(x)-.5)],.015,C.slide);}}

 // ---- Terrace zones (port z<0, starboard z>0), between the promenade and the hull ----
 const tz=(x,s)=>[s*(front(x)+PROM),s*(half(x,TY)-.2)];
 const tinlay=(x0,x1,s,color)=>{const xs=xsBetween(x0,x1,2);parts.push(paint(grid(xs.length,2,(i,j)=>[xs[i],TY+.03,tz(xs[i],s)[j]],s>0),color));};
 const tblock=(x0,x1,s,h,color,inset=.6)=>{const [a,b]=tz((x0+x1)/2,s).map(Math.abs),z0=a+inset,z1=b-inset;add(box(x0,x1,TY,TY+h,s*z0,s*z1),color,{wall:true});};
 // port: six padel courts (glass ends, a net, lines), cabanas and the beach bar, the lounge cafe
 for(let k=0;k<6;k++){const x0=-122+k*20.5,[a,b]=tz(x0+10,-1).map(Math.abs),zm=-(a+b)/2,y=TY+.06;tinlay(x0+.25,x0+20.25,-1,C.padel);
  for(const x of [x0+.25,x0+20.05]){const g=box(x,x+.2,TY,TY+3,-(a+.3),-(b-.3));glass.push(paint(g.clone(),C.rail));walls.push(g);}
  // the cage: mesh above the glass ends, glass then mesh along each side for 4 m from each end, dark frames throughout
  {const za=-(a+.3),zb=-(b-.3),ends=[x0+.35,x0+20.15];
   for(const x of ends){glass.push(paint(vpanel(x,za,x,zb,TY+3,TY+4),C.net));for(const y of [TY+3,TY+4])parts.push(paint(box(x-.05,x+.05,y-.05,y+.05,zb,za),C.frame));
    for(let k=0;k<=5;k++){const z=za+(zb-za)*k/5;parts.push(paint(box(x-.05,x+.05,TY,TY+4,z-.05,z+.05),C.frame));}}
   for(const z of [za,zb])for(const [p,q] of [[ends[0],ends[0]+4],[ends[1]-4,ends[1]]]){const g=box(p,q,TY,TY+2,z-.02,z+.02);glass.push(paint(g.clone(),C.rail));walls.push(g);glass.push(paint(vpanel(p,z,q,z,TY+2,TY+3),C.net));
    for(const x of [p,(p+q)/2,q])parts.push(paint(box(x-.05,x+.05,TY,TY+3,z-.05,z+.05),C.frame));parts.push(paint(box(p,q,TY+2.95,TY+3.05,z-.05,z+.05),C.frame));}}
  (k%2?planter:lampPost)(x0+10.25,TY,-(a-.45));
  add(box(x0+10.2,x0+10.3,TY,TY+.88,-(a+.6),-(b-.6)),C.net,{wall:true});lines(x0+.6,x0+19.9,-(b-.6),-(a+.6),y);for(const x of [x0+10.25-6.95,x0+10.25+6.95])line(x,-(a+.6),x,-(b-.6),y);line(x0+10.25-6.95,zm,x0+10.25+6.95,zm,y);}
 tinlay(5,62,-1,C.cabana);
 for(let k=0;k<6;k++){const x0=6.5+k*7.5,[a]=tz(x0,-1).map(Math.abs),z0=a+1,z1=a+6.4;
  const xm=x0+2.5,zm=-(z0+z1)/2,e0=-(z0-.25),e1=-(z1+.25);
  for(const x of [x0,x0+5])for(const z of [z0,z1]){add(box(x-.07,x+.07,TY,TY+2.6,-z-.07,-z+.07),C.rib,{wall:true});
   parts.push(paint(new T.CylinderGeometry(.12,.24,2.35,8).translate(x+Math.sign(x-xm)*.2,TY+1.2,-z+Math.sign(-z-zm)*.2),C.curtain));}
  parts.push(paint(box(x0-.25,x0+5.25,TY+2.6,TY+2.72,e1,e0),C.curtain));parts.push(paint(new T.ConeGeometry(3.9,.8,4).rotateY(Math.PI/4).scale(1,1,1.1).translate(xm,TY+3.12,zm),C.curtain));
  for(const g of [box(x0-.25,x0+5.25,TY+2.28,TY+2.6,e0-.02,e0+.02),box(x0-.25,x0+5.25,TY+2.28,TY+2.6,e1-.02,e1+.02),box(x0-.27,x0-.23,TY+2.28,TY+2.6,e1,e0),box(x0+5.23,x0+5.27,TY+2.28,TY+2.6,e1,e0)])parts.push(paint(g,C.curtain));
  parts.push(paint(box(x0+.1,x0+4.9,TY+.05,TY+2.3,-z1-.12,-z1-.08),C.curtain));lamps.push(paint(box(x0-.25,x0+5.25,TY+2.26,TY+2.29,e0-.03,e0+.03),C.cove));
  lantern(x0+4.45,TY,-(z0+2.45),.45,.15);
  lounger(x0+2.5,TY,-(z0+1.3));lounger(x0+2.5,TY,-(z0+3.6));}
 tblock(52,60,-1,1.1,C.bar,2);{const [a,b]=tz(56,-1).map(Math.abs);for(let x=52.6;x<60;x+=1.25)stool(x,TY,-(a+1.35));
  parts.push(paint(box(51.9,60.1,TY+1.1,TY+1.16,-(a+1.9),-(b-1.9)),C.marble));lamps.push(paint(box(52,60,TY+.12,TY+.18,-(a+1.95),-(a+2.0)),C.cove));
  lamps.push(paint(box(52.4,59.6,TY+1.4,TY+2.3,-(b-1.75),-(b-1.7)),C.lantern));
  for(const x of [50.6,61.4])for(const z of [a+.9,b-.6])add(box(x-.12,x+.12,TY,TY+3.2,-z-.12,-z+.12),C.wood,{wall:true});
  const z0=a+.3,z1=b-.1,hx=6.2,hz=(z1-z0)/2,zc=-(z0+z1)/2;
  parts.push(paint(new T.ConeGeometry(1,2.3,4).rotateY(Math.PI/4).scale(hx/Math.SQRT1_2,1,hz/Math.SQRT1_2).translate(56,TY+3.2+1.15,zc),C.thatch));
  for(const g of [box(56-hx,56+hx,TY+2.95,TY+3.25,-z0-.04,-z0+.04),box(56-hx,56+hx,TY+2.95,TY+3.25,-z1-.04,-z1+.04),box(56-hx-.04,56-hx+.04,TY+2.95,TY+3.25,-z1,-z0),box(56+hx-.04,56+hx+.04,TY+2.95,TY+3.25,-z1,-z0)])parts.push(paint(g,C.thatch));
  for(let x=51;x<=61;x+=1.25){rod([x,TY+3.2,-(z0+.45)],[x,TY+2.62,-(z0+.45)],.01,C.frame);lantern(x,TY+2.3,-(z0+.45),.3,.12);}}
 for(const s of [-1,1]){tinlay(118,148,s,C.lounge);const [a]=tz(130,s).map(Math.abs);
  const [,b]=tz(130,s).map(Math.abs);
  for(let x=121;x<147;x+=5){cafe(x,TY,s*(a+3.2),4);if(x<146)planter(x+2.5,TY,s*(a+5.7),.4);cafe(x,TY,s*(a+8),2);}
  for(let x=120;x<148;x+=7)lantern(x,TY,s*(b-1.3),.6,.2);}
 // starboard: 18-hole mini putt (cups and flags), twelve golf simulator bays (screens, mats), the range lounge
  {const [a,b]=tz(-66,1).map(Math.abs),zm=(a+b)/2;for(let i=0;i<18;i++){const x=-118+i*6,z=i%2?a+3:b-3,zo=i%2?b-3:a+3,rx=2.5+(i%3)*.25,rz=1.55,cx=x+(i%2?.9:-.9);
  // the green: an oval of turf in a wooden kerb, the cup and its flag near the far end
  parts.push(paint(new T.CircleGeometry(1,28).scale(rx,rz,1).rotateX(-Math.PI/2).translate(x,TY+.06,z),C.turf));
  parts.push(paint(new T.CylinderGeometry(1,1,.16,28,1,true).scale(rx+.08,1,rz+.08).translate(x,TY+.08,z),C.wood));
  parts.push(paint(new T.CircleGeometry(.12,12).rotateX(-Math.PI/2).translate(cx,TY+.075,z),C.cup));
  parts.push(paint(new T.CylinderGeometry(.015,.015,1.3,4).translate(cx,TY+.65,z),C.line));
  const flag=new T.BufferGeometry();flag.setAttribute('position',new T.Float32BufferAttribute([cx,TY+1.3,z,cx+.45,TY+1.18,z,cx,TY+1.06,z],3));flag.computeVertexNormals();parts.push(paint(flag,C.orange));
  parts.push(paint(new T.CircleGeometry(1,20).scale(2.6,1.7,1).rotateX(-Math.PI/2).translate(x,TY+.04,zo),C.bed));
  // where this hole has no green in the other row: a flowering bush and a rock (or a blossom tree), and a bollard by the path
  if(i%4===1){add(new T.CylinderGeometry(.1,.14,1.6,6).translate(x,TY+.8,zo),C.wood,{wall:true});parts.push(paint(new T.IcosahedronGeometry(1.25,1).scale(1,.75,1).translate(x,TY+2.2,zo),C.blossom));bush(x+1.6,TY,zo,.55);}
  else{bush(x-.9,TY,zo,.6);walls.push(box(x-1.5,x-.3,TY,TY+1,zo-.6,zo+.6));const r=.45+dr()*.3;add(new T.IcosahedronGeometry(r,0).scale(1.2,.75,1).translate(x+1,TY+r*.5,zo+.2),C.rock,{wall:true});}
  bollard(x+3,TY,zm+(i%2?-1.1:1.1));}}
 {const [,b]=tz(28,1).map(Math.abs),d0=b-5;
  for(let k=0;k<13;k++){const x=-5+k*5.4,g=box(x,x+.2,TY,TY+2.9,d0,b);parts.push(paint(g.clone(),C.simWall));walls.push(g);}
  parts.push(paint(box(-5,60.2,TY+2.9,TY+3.1,d0-.1,b),C.simWall));lamps.push(paint(box(-5,60.2,TY+2.84,TY+2.9,d0-.1,d0-.04),C.cove));
  for(let k=0;k<12;k++){const x0=-4.8+k*5.4,x1=x0+5.2,xm=(x0+x1)/2;parts.push(paint(quad(x0,x1,d0,b-.3,TY+.03),C.turf));parts.push(paint(box(x0,x1,TY,TY+2.9,b-.3,b),C.simWall));
   screens.sims.push(new T.PlaneGeometry(x1-x0-.5,2.3).rotateY(Math.PI).translate(xm,TY+1.5,b-.34));parts.push(paint(quad(xm-.8,xm+.8,d0+1.4,d0+2.8,TY+.05),C.mat));
   add(box(x0+.3,x0+.9,TY,TY+.45,d0+.3,d0+.9),C.wicker,{wall:true});marker('Seat',box(x0+.35,x0+.85,TY+.43,TY+.47,d0+.35,d0+.85));
   parts.push(paint(new T.CylinderGeometry(.15,.13,.85,8).translate(x1-.5,TY+.43,d0+.6),C.bag));for(let j=0;j<3;j++)parts.push(paint(box(x1-.6+j*.08,x1-.54+j*.08,TY+.85,TY+1.05,d0+.55,d0+.65),C.line));
   planter(xm,TY+3.1,d0+.2,.32,true);lamps.push(paint(quad(x0+.7,x1-.7,d0+.8,d0+3.6,TY+2.88,true),C.lamp));}}
 // Slide towers, one per terrace, slides dropping over the rail into the river.
 // An open tower round a white column (eight posts, a glass-railed platform on top under a round canopy); a yellow slide
 // and a blue one spiral down round it (the blue one, outside, three quarters of a turn, so the yellow one's run out passes
 // through its gap), then run side by side out over the rail, high over the walkways, and down into the river.
 for(const s of [-1,1]){const [a,b]=tz(89,s).map(Math.abs),zc=s*(a+b)/2,xc=89,top=TY+4.6,R=3.5;
  walls.push(new T.CylinderGeometry(4,4,CY-.8-TY,20).translate(xc,(TY+CY-.8)/2,zc));
  parts.push(paint(new T.CylinderGeometry(1,1,CY-TY,16).translate(xc,(TY+CY)/2,zc),C.rib));
  for(let k=0;k<8;k++){const t=k/8*Math.PI*2;parts.push(paint(new T.CylinderGeometry(.09,.09,CY-.9-TY,6).translate(xc+Math.cos(t)*R,(TY+CY-.9)/2,zc+Math.sin(t)*R),C.rib));}
  parts.push(paint(new T.CylinderGeometry(R+.3,R+.3,.22,24).translate(xc,top-.11,zc),C.rib));glass.push(paint(new T.CylinderGeometry(R+.25,R+.25,1,24,1,true).translate(xc,top+.5,zc),C.rail));
  lamps.push(paint(new T.TorusGeometry(R+.25,.04,4,32).rotateX(Math.PI/2).translate(xc,top+1.02,zc),C.railLed));lamps.push(paint(new T.TorusGeometry(R+.31,.05,4,32).rotateX(Math.PI/2).translate(xc,top-.2,zc),C.cove));
  parts.push(paint(new T.CylinderGeometry(R+.6,R+.6,.18,24).translate(xc,CY-.86,zc),C.curtain));lamps.push(paint(new T.TorusGeometry(R+.6,.05,4,32).rotateX(Math.PI/2).translate(xc,CY-.96,zc),C.cove));
  for(const [r,turn,color] of [[4.4,2.5,C.slide],[5.5,1.5,C.slideTube]]){const te=s>0?Math.PI:0,xe=xc+Math.cos(te)*r,pts=[];
   for(let i=0;i<=40;i++){const u=i/40,t=te-(1-u)*Math.PI*turn;pts.push(new T.Vector3(xc+Math.cos(t)*r,top-.3-u*1.3,zc+Math.sin(t)*r));}
   for(const [y,z] of [[TY+2.75,front(xe)+.3],[FY+3,front(xe)-2.6],[FY+2.1,front(xe)-4.6],[FY+.6,front(xe)-6.3],[WY+.15,front(xe)-7.9]])pts.push(new T.Vector3(xe,y,s*z));
   parts.push(paint(new T.TubeGeometry(new T.CatmullRomCurve3(pts),180,.45,10),color));}}

 // Wall lanterns along the terrace front walls, over the promenade.
 for(const s of [-1,1])for(let x=KEEL.terraceX[0]+6;x<KEEL.terraceX[1]-2;x+=6){if(STAIRS.some(x0=>x>x0-1&&x<x0+RISERS*TREAD+STAIR_W+1))continue;
  lantern(x,FY+2.1,s*(front(x)-.16),.38,.1);parts.push(paint(box(x-.04,x+.04,FY+1.95,FY+2.12,s*(front(x)-.06),s*(front(x)-.02)),C.brass));}
 // Cafe tables along the terrace rails: starboard by the putt and the sims, port by the cabanas.
 const railFree=x=>!STAIRS.some(x0=>x>x0+RISERS*TREAD-2&&x<x0+RISERS*TREAD+STAIR_W+2)&&!FALLS.some(([a,b])=>x>a-2.5&&x<b+2.5);
 for(const x of [-116,-96,-80,-64,-24,-10,4,18,32,60])if(railFree(x))cafe(x,TY,front(x)+1.1,2);
 for(const x of [10,24,34,62])if(railFree(x))cafe(x,TY,-(front(x)+1.1),2);
 // and a lantern table against the terrace wall behind each waterfall
 for(const s of [-1,1])for(const [x0,x1] of FALLS){const m=(x0+x1)/2;cafe(m,FY,s*(front(m)-1.15),2);}

 // ---- Light and sky (refinement round 1: the finish of the Keel Club concept renders) ----
 // The ceiling's beam grid: beams along the hall every 11 m across it, and cross beams every 15 m, just under the
 // sky panel, each with a warm light line along its underside (in lengths, so the walk can cull them by section).
 const beamY=CY-.28;
 for(const z of [0,-11,11,-22,22,-33,33,-44,44])for(let x=KEEL.aft+3;x<KEEL.bow-3;x+=15){const x1=Math.min(x+15,KEEL.bow-3);if(Math.min(half(x,CY),half(x1,CY))<Math.abs(z)+1)continue;
  parts.push(paint(box(x,x1,beamY+.12,CY-.02,z-.13,z+.13),C.beam));lamps.push(paint(box(x,x1,beamY+.09,beamY+.12,z-.05,z+.05),C.lamp));}
 for(let x=KEEL.aft+3;x<KEEL.bow-3;x+=15){const w=half(x,CY)-.6;if(w>2)parts.push(paint(box(x-.11,x+.11,beamY+.12,CY-.02,-w,w),C.beam));}
 // The hull's arched ribs every 12 m: from the floor (or the terrace) to the ceiling, standing proud of the lining.
 const ribs=[];for(let x=KEEL.aft+7;x<KEEL.bow-4;x+=12)ribs.push(x);
 for(const s of [-1,1])for(const x of ribs){const y0=x>KEEL.terraceX[0]&&x<KEEL.terraceX[1]?TY:FY,ys=ysBetween(y0,CY-.05,.5);
  for(const [a,b] of [[-.3,.3]])parts.push(paint(grid(2,ys.length,(i,j)=>[x+(i?b:a),ys[j],s*(half(x,ys[j])-.32)],s<0),C.rib));
  for(const e of [-.3,.3])parts.push(paint(grid(2,ys.length,(i,j)=>[x+e,ys[j],s*(half(x,ys[j])-(i?.32:0))],(e<0)!==(s>0)),C.rib));}
 // Oval starfield portholes between the ribs, high on the hull (inside only: the stars are a lit panel, the hull
 // has no cutouts), each in a dark recess.
 for(const s of [-1,1])for(let k=0;k<ribs.length-1;k++){const cx=(ribs[k]+ribs[k+1])/2,inTer=cx>KEEL.terraceX[0]&&cx<KEEL.terraceX[1],cy=inTer?TY+4.7:FY+7.6,a=4.2,b=inTer?1.35:1.6;
  if(cx>148&&cx<182)continue; // the climbing walls
  const N=24,M=4,oval=(r,off)=>(i,j)=>{const t=i/N*Math.PI*2,q=j/M*r,x=cx+Math.cos(t)*a*q,y=cy+Math.sin(t)*b*q;return [x,y,s*(half(x,y)-off)];};
  stars.push(gridUV(N+1,M+1,oval(1,.07),(i,j)=>{const t=i/N*Math.PI*2,q=j/M;return [.5+Math.cos(t)*q*.32+((k*.37)%1)*.3,.5+Math.sin(t)*q*.18];},s<0));
  parts.push(paint(grid(N+1,2,(i,j)=>{const t=i/N*Math.PI*2,q=j?1.12:1,x=cx+Math.cos(t)*a*q,y=cy+Math.sin(t)*b*q;return [x,y,s*(half(x,y)-.06)];},s>0),C.recess));}
 // Warm cove lines along the hull: one just under the ceiling, one along the terraces' back wall above the decks.
 for(const s of [-1,1]){const xs=xsBetween(KEEL.aft+1,KEEL.bow-1,3);
  lamps.push(paint(grid(xs.length,2,(i,j)=>[xs[i],CY-.6+j*.12,s*(half(xs[i],CY-.6)-.1)],s<0),C.cove));
  const xt=xsBetween(KEEL.terraceX[0],KEEL.terraceX[1],3);lamps.push(paint(grid(xt.length,2,(i,j)=>[xt[i],TY+2.9+j*.1,s*(half(xt[i],TY+2.9)-.1)],s<0),C.cove));}
 // Glowing edges along the river's and the lagoon's banks, just above the water.
 {const edge=(poly)=>{const P=[];for(let i=0;i<poly.length;i++){const [ax,az]=poly[i],[bx,bz]=poly[(i+1)%poly.length],y0=WY+.04,y1=WY+.16;P.push(ax,y0,az,bx,y0,bz,bx,y1,bz,ax,y0,az,bx,y1,bz,ax,y1,az);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.computeVertexNormals();return g;};
  for(const poly of [ringOut,ringIn,rect(lx0,lx1,-lz,lz)])lamps.push(paint(edge(poly),C.glowEdge));}
 // Palms: in planters along the promenades, round the lagoon, at the beach, on the terraces and in the lobbies; one
 // instanced draw for the trunks and one for the fronds (made below), each trunk solid.
 const palms=[],palm=(x,y,z,h=5)=>{palms.push([x,y,z,h]);walls.push(box(x-.22,x+.22,y,y+2.4,z-.22,z+.22));};
 const clear=x=>!BRIDGES.side.some(c=>Math.abs(x-c)<4.5)&&!STAIRS.some(x0=>x>x0-2.5&&x<x0+RISERS*TREAD+STAIR_W+1.5)&&!FALLS.some(([a,b])=>x>a-1.5&&x<b+1.5)&&!(x>146&&x<183)&&Math.abs(x-89)>7;
 for(const s of [-1,1])for(let x=-134;x<=188;x+=12)if(clear(x))palm(x,FY,s*(front(x)-.75),5.5+((x*7)%3)*.4);
 for(const s of [-1,1])for(let x=-2;x<=110;x+=14)palm(x,FY,s*35.2,5+((x*3)%4)*.3);
 for(const [x,z] of [[-28,-33],[-28,33],[-12,-34],[-12,34],[-29,-12],[-29,12]])palm(x,FY,z,4.6);
 for(const s of [-1,1])for(const x of [-138,-125,128,142])palm(x,FY,s*27,5.2);
 for(const s of [-1,1])for(let x=4;x<=146;x+=9){if(Math.abs(x-89)<7||(s>0&&x<62))continue;const [,b]=[0,half(x,TY)-1.4];palm(x,TY,s*b,4.6);}
 for(const s of [-1,1])for(let x=-118;x<=-14;x+=13)if(s>0)palm(x,TY,s*(half(x,TY)-.7),4.6);
 // ---- Signs: one texture, a row per label (SIGNS); `yaw` turns the sign's face from +z ----
 const sign=(label,cx,cy,cz,w,h,yaw,twoSided=true,out={signs,parts})=>{const row=SIGNS.indexOf(label),v0=1-(row+1)/SIGNS.length,v1=1-row/SIGNS.length,c=Math.cos(yaw),sn=Math.sin(yaw);
  for(const sd of twoSided?[1,-1]:[1]){const ax=c*sd,az=-sn*sd,nx=sn*.03*sd,nz=c*.03*sd,P=[],U=[];
   const pt=(u,v)=>[cx+ax*(u-.5)*w+nx,cy+(v-.5)*h,cz+az*(u-.5)*w+nz];
   for(const [u,v] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){P.push(...pt(u,v));U.push(u,v0+(v1-v0)*v);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.computeVertexNormals();out.signs.push(g);}
  // the board behind, thinner than the faces' offset so both faces show
  const hx=Math.abs(c)*(w/2+.06)+Math.abs(sn)*.01,hz=Math.abs(sn)*(w/2+.06)+Math.abs(c)*.01;out.parts.push(paint(box(cx-hx,cx+hx,cy-h/2-.06,cy+h/2+.06,cz-hz,cz+hz),C.core));};
 const hang=(label,x,y,z,w,h,yaw)=>{sign(label,x,y,z,w,h,yaw);for(const k of [-1,1]){const dx=Math.cos(yaw)*k*w*.4,dz=-Math.sin(yaw)*k*w*.4;parts.push(paint(box(x+dx-.01,x+dx+.01,y+h/2,CY,z+dz-.01,z+dz+.01),C.core));}};
 // over each lift lobby, and on Deck 1 at each stair landing's end wall, pointing down
 for(const c of CORES){hang('KEEL CLUB',c.x,FY+5.2,0,6.4,1.6,Math.PI/2);sign('KEEL CLUB  ↓',c.stairX-4.47,DECK1+1.9,c.stairZ,3.2,.8,Math.PI/2,false,d1);}
 hang('TENNIS',-80.5,FY+5,0,5,1.25,Math.PI/2);hang('BASKETBALL',-56,FY+7,0,6,1.4,Math.PI/2);hang('BEACH',-31,FY+5,0,5,1.25,Math.PI/2);hang('WAVE LAGOON',50,FY+6,0,7,1.6,Math.PI/2);
 hang('DRIVING RANGE',150,FY+5.5,0,7,1.6,Math.PI/2);for(const s of [-1,1])hang('5-A-SIDE',-56,FY+5,s*23.5,5,1.25,Math.PI/2);
 for(const c of BRIDGES.side.slice(1,5))for(const s of [-1,1])hang('KEEL LOOP',c,FY+6.5,s*(rIn(c)+RW/2),5,1.2,0);
 // terrace signs on the terrace front walls, facing the hall
 for(const [label,x,s] of [['PADEL',-100,-1],['CABANAS · BEACH BAR',30,-1],['MINI PUTT',-90,1],['GOLF SIMS',28,1]])sign(label,x,FY+2.9,s*(front(x)-.03),label.length>12?8:5,1.2,s<0?0:Math.PI,false);
 for(const s of [-1,1])sign('CLIMBING WALLS',165,FY+3.2,s*(front(165)-.5),6,1.3,s<0?0:Math.PI,false);

 // Tube docks: beside each dock's spot along the bank (so the camera behind someone facing the river, or floating
 // in, stays clear of it), a rack of tubes standing on edge, and the sign on two posts over it, facing the river.
 for(const {at:[x,,z],side} of DOCKS){const xr=x-3.4;add(box(xr-1.4,xr+1.4,FY,FY+.25,z-.55,z+.55),C.wood,{wall:true});walls.push(box(xr-1.4,xr+1.4,FY,FY+1.9,z-.8,z+.8));
  for(const e of [-1,1])parts.push(paint(box(xr+e*1.4-.06,xr+e*1.4+.06,FY,FY+2.9,z-.06,z+.06),C.core));
  [C.orange,C.teal,C.slide,C.orange,C.teal].forEach((c,k)=>parts.push(paint(new T.TorusGeometry(.55,.2,8,20).rotateY(Math.PI/2).translate(xr-1+k*.5,FY+1,z),c)));
  sign('FLOAT THE KEEL LOOP',xr,FY+2.55,z,2.6,.6,side<0?Math.PI:0,true);}

 // ---- Materials and draws ----
 const opaque=new T.MeshStandardMaterial({name:'Keel_club_finish',vertexColors:true,roughness:.72,metalness:0,side:T.DoubleSide});
 const lit=new T.MeshStandardMaterial({name:'Keel_club_glow',vertexColors:true,roughness:1,emissive:0xffffff,emissiveIntensity:.35,side:T.DoubleSide});
 const see=new T.MeshStandardMaterial({name:'Keel_club_glass',vertexColors:true,roughness:.1,transparent:true,opacity:.2,depthWrite:false,side:T.DoubleSide});
 const stripMat=new T.MeshBasicMaterial({name:'Keel_club_light_strip',vertexColors:true,toneMapped:false});
 const starTex=canvasTexture(1024,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#05081a');g.addColorStop(1,'#0c1636');c.fillStyle=g;c.fillRect(0,0,w,h);
  const r=seeded(31);for(const [x,y,rad,col] of [[.2,.4,.22,'rgba(120,70,190,.22)'],[.7,.6,.28,'rgba(40,150,170,.18)'],[.45,.2,.18,'rgba(220,110,80,.14)']]){const n=c.createRadialGradient(x*w,y*h,0,x*w,y*h,rad*w);n.addColorStop(0,col);n.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=n;c.fillRect(0,0,w,h);}
  for(let i=0;i<2200;i++){const b=r(),s=b>.985?2.2:b>.93?1.4:.8;c.fillStyle=`rgba(${230+r()*25|0},${230+r()*25|0},255,${.4+r()*.6})`;c.beginPath();c.arc(r()*w,r()*h,s,0,Math.PI*2);c.fill();}});
 if(starTex)starTex.wrapS=starTex.wrapT=T.RepeatWrapping;
 const sky=new T.MeshBasicMaterial({name:'Keel_club_stars',map:starTex,color:starTex?0xffffff:C.dome,toneMapped:false,side:T.DoubleSide});
 const signTex=canvasTexture(1024,SIGNS.length*128,(c,w,h)=>{const rh=h/SIGNS.length;SIGNS.forEach((s,i)=>{const y=i*rh;c.fillStyle='#173a4a';c.fillRect(0,y,w,rh);c.fillStyle='#f07c3c';c.fillRect(w*.38,y+rh-22,w*.24,6);
  c.fillStyle='#f6f2e8';c.textAlign='center';c.textBaseline='middle';let size=70;do{c.font=`600 ${size}px "Inter","Segoe UI",Arial,sans-serif`;size-=4;}while(c.measureText(s).width>w-60&&size>24);c.fillText(s,w/2,y+rh/2-6);});});
 const signMat=new T.MeshBasicMaterial({name:'Keel_club_signs',map:signTex,color:signTex?0xffffff:0x173a4a,toneMapped:false,side:T.DoubleSide});
 // The ceiling's sky panel: a warm sunset with soft clouds, mapped once across the hall (its UVs are x, -z in metres).
 const sunset=canvasTexture(2048,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#c9a8d8');g.addColorStop(.2,'#efbcc6');g.addColorStop(.38,'#fbd0b2');g.addColorStop(.5,'#ffe1bf');g.addColorStop(.62,'#fbcfb1');g.addColorStop(.8,'#edb9c6');g.addColorStop(1,'#c5a4d6');
  c.fillStyle=g;c.fillRect(0,0,w,h);const r=seeded(91);for(let i=0;i<420;i++){const x=r()*w,y=r()*h,rx=30+r()*110,ry=rx*(.35+r()*.3),a=.22+r()*.3,lit=r()<.7;const cl=c.createRadialGradient(x,y,0,x,y,rx);cl.addColorStop(0,lit?`rgba(255,244,232,${a})`:`rgba(196,140,190,${a*.6})`);cl.addColorStop(.55,lit?`rgba(255,226,206,${a*.5})`:`rgba(196,140,190,${a*.3})`);cl.addColorStop(1,'rgba(255,240,230,0)');
   c.save();c.translate(x,y);c.scale(1,ry/rx);c.translate(-x,-y);c.fillStyle=cl;c.beginPath();c.arc(x,y,rx,0,Math.PI*2);c.fill();c.restore();}});
 if(sunset){sunset.repeat.set(1/(KEEL.bow-KEEL.aft),1/120);sunset.offset.set(-KEEL.aft/(KEEL.bow-KEEL.aft),.5);}
 const skyMat=new T.MeshBasicMaterial({name:'Keel_club_sky',map:sunset,color:sunset?0xf0e6e0:C.ceiling,toneMapped:false,side:T.DoubleSide});
 // The range's dome screen: a floodlit fairway with target greens under a starry sky and mountains. The sims' screens:
 // a sunny fairway between trees, a pond and a flag on the green.
 const fairway=(c,w,h,hz,grass,stripe)=>{c.fillStyle=grass;c.beginPath();c.moveTo(w*.08,h);c.lineTo(w*.44,hz);c.lineTo(w*.56,hz);c.lineTo(w*.92,h);c.fill();
  for(let i=0;i<10;i++){c.fillStyle=i%2?stripe:'rgba(0,0,0,0)';const t0=i/10,t1=(i+1)/10,y0=hz+(h-hz)*t0*t0,y1=hz+(h-hz)*t1*t1,l=t=>w*(.44-.36*t),r=t=>w*(.56+.36*t);
   c.beginPath();c.moveTo(l(t0*t0),y0);c.lineTo(r(t0*t0),y0);c.lineTo(r(t1*t1),y1);c.lineTo(l(t1*t1),y1);c.fill();}};
 const rangeTex=canvasTexture(2048,576,(c,w,h)=>{const hz=h*.5,g=c.createLinearGradient(0,0,0,hz);g.addColorStop(0,'#060b26');g.addColorStop(.7,'#1d2d6b');g.addColorStop(1,'#3b4f8f');c.fillStyle=g;c.fillRect(0,0,w,hz);
  const r=seeded(77);for(let i=0;i<1400;i++){c.fillStyle=`rgba(255,255,255,${.3+r()*.7})`;c.beginPath();c.arc(r()*w,r()*hz*.9,r()<.05?2:1,0,Math.PI*2);c.fill();}
  const n=c.createRadialGradient(w*.62,hz*.35,0,w*.62,hz*.35,w*.25);n.addColorStop(0,'rgba(120,90,200,.25)');n.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=n;c.fillRect(0,0,w,hz);
  for(const [col,amp,base] of [['#24325e',.16,.92],['#1a2648',.1,.97]]){c.fillStyle=col;c.beginPath();c.moveTo(0,hz);for(let x=0;x<=w;x+=16)c.lineTo(x,hz*(base-amp*(.5+.5*Math.sin(x*.004+r()*.3)*Math.sin(x*.0013+1))));c.lineTo(w,hz);c.fill();}
  const gg=c.createLinearGradient(0,hz,0,h);gg.addColorStop(0,'#2f6b3a');gg.addColorStop(1,'#4f9a45');c.fillStyle=gg;c.fillRect(0,hz,w,h-hz);
  fairway(c,w,h,hz,'#5aa94f','rgba(255,255,255,.07)');
  for(const [x,y,rx,col] of [[.3,.58,.05,'#7cc463'],[.55,.62,.07,'#86cf6a'],[.72,.56,.04,'#7cc463'],[.42,.72,.09,'#86cf6a'],[.82,.7,.07,'#7cc463']]){c.fillStyle=col;c.beginPath();c.ellipse(x*w,y*h,rx*w,rx*w*.18,0,0,Math.PI*2);c.fill();
   c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=2;for(const k of [.5,.9]){c.beginPath();c.ellipse(x*w,y*h,rx*w*k,rx*w*.18*k,0,0,Math.PI*2);c.stroke();}c.fillStyle='#f07c3c';c.fillRect(x*w,y*h-28,10,10);c.fillStyle='#fff';c.fillRect(x*w,y*h-28,2,28);}
  const glowH=c.createLinearGradient(0,hz-30,0,hz+40);glowH.addColorStop(0,'rgba(255,220,160,0)');glowH.addColorStop(.5,'rgba(255,220,160,.25)');glowH.addColorStop(1,'rgba(255,220,160,0)');c.fillStyle=glowH;c.fillRect(0,hz-30,w,70);});
 const simTex=canvasTexture(1024,512,(c,w,h)=>{const hz=h*.42,g=c.createLinearGradient(0,0,0,hz);g.addColorStop(0,'#5f9fe0');g.addColorStop(1,'#cfe6f7');c.fillStyle=g;c.fillRect(0,0,w,hz);
  const r=seeded(13);for(let i=0;i<14;i++){c.fillStyle='rgba(255,255,255,.75)';c.beginPath();c.ellipse(r()*w,r()*hz*.6,40+r()*70,10+r()*12,0,0,Math.PI*2);c.fill();}
  c.fillStyle='#7e9fb3';c.beginPath();c.moveTo(0,hz);for(let x=0;x<=w;x+=8)c.lineTo(x,hz-30-28*Math.sin(x*.012)*Math.sin(x*.005+1));c.lineTo(w,hz);c.fill();
  c.fillStyle='#3f7d3a';c.fillRect(0,hz,w,h-hz);fairway(c,w,h,hz,'#7cc85c','rgba(255,255,255,.08)');
  for(let i=0;i<60;i++){const side=i%2,x=side?w*(.62+r()*.38):w*r()*.38,y=hz+r()*h*.18,rr=14+r()*18;c.fillStyle=r()<.5?'#2f6b2f':'#3d7d36';c.beginPath();c.arc(x,y-rr,rr,0,Math.PI*2);c.fill();}
  c.fillStyle='#4aa3c8';c.beginPath();c.ellipse(w*.78,h*.78,w*.1,h*.05,0,0,Math.PI*2);c.fill();
  c.fillStyle='#93db74';c.beginPath();c.ellipse(w*.5,hz+22,46,9,0,0,Math.PI*2);c.fill();c.fillStyle='#fff';c.fillRect(w*.5,hz-8,2,26);c.fillStyle='#e0413a';c.fillRect(w*.5+2,hz-8,12,8);});
 const screenMat=(map,color,name)=>new T.MeshBasicMaterial({name,map,color:map?0xffffff:color,toneMapped:false,side:T.DoubleSide});
 const rangeMat=screenMat(rangeTex,C.dome,'Keel_club_range_screen'),simMat=screenMat(simTex,C.screen,'Keel_club_sim_screens');
 // Palms: a trunk and a crown of fronds, one instanced draw each, every palm turned and sized a little differently.
 if(palms.length){const r=seeded(211),trunk=new T.CylinderGeometry(.14,.26,1,8).translate(0,.5,0),frond=new T.BufferGeometry(),P=[];
  for(let k=0;k<9;k++){const a=k/9*Math.PI*2,c=Math.cos(a),n=Math.sin(a);let prev=null;for(let i=0;i<=6;i++){const t=i/6,L=2.6*t,y=.25*Math.sin(t*Math.PI)-t*t*1.1,w=.42*Math.sin(Math.PI*Math.min(1,t*1.15)+.15);
    const pt=[c*L,y,n*L],l=[pt[0]-n*w,pt[1],pt[2]+c*w],q=[pt[0]+n*w,pt[1],pt[2]-c*w];if(prev)P.push(...prev[0],...l,...q,...prev[0],...q,...prev[1]);prev=[l,q];}}
  frond.setAttribute('position',new T.Float32BufferAttribute(P,3));frond.computeVertexNormals();
  const trunks=new T.InstancedMesh(trunk,new T.MeshStandardMaterial({name:'Keel_club_palm_trunk',color:0x8a6a4a,roughness:.9}),palms.length),crowns=new T.InstancedMesh(frond,new T.MeshStandardMaterial({name:'Keel_club_palm_fronds',color:0x4f9a45,roughness:.8,side:T.DoubleSide}),palms.length);
  const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler();palms.forEach(([x,y,z,h],i)=>{const lean=(r()-.5)*.12,turn=r()*Math.PI*2;
   trunks.setMatrixAt(i,m.compose(new T.Vector3(x,y,z),q.setFromEuler(e.set(lean,turn,lean*.6)),new T.Vector3(1,h,1)));
   crowns.setMatrixAt(i,m.compose(new T.Vector3(x+Math.sin(lean*.6)*h*-.1,y+h,z+Math.sin(lean)*h*.1),q.setFromEuler(e.set(0,turn,0)),new T.Vector3(1,1,1).multiplyScalar(.9+r()*.3)));});
  for(const im of [trunks,crowns]){im.name=im.material.name;im.computeBoundingSphere();group.add(im);}}
 // Static draws in four sections along the hall, so the walk culls the far ones when they're out of view.
 const draw=(g,m,name)=>{for(const part of sections(g,4)){const mesh=new T.Mesh(part,m);mesh.name=name;group.add(mesh);}};
 draw(merge(parts),opaque,'Keel_club_finish');draw(merge(glow),lit,'Keel_club_glow');draw(merge(glass),see,'Keel_club_glass');draw(merge(lamps),stripMat,'Keel_club_light_strip');
 draw(merge(stars,['position','normal','uv']),sky,'Keel_club_stars');draw(merge(skyPanel,['position','normal','uv']),skyMat,'Keel_club_sky');
 draw(merge(screens.range,['position','normal','uv']),rangeMat,'Keel_club_range_screen');draw(merge(screens.sims,['position','normal','uv']),simMat,'Keel_club_sim_screens');{const g=merge(signs,['position','normal','uv']);if(g){const m=new T.Mesh(g,signMat);m.name='Keel_club_signs';group.add(m);}}
 // Water, each body its own draw so its ripples move their own way: the river flows round the loop (forward along
 // port, across the bow, aft along starboard, across the aft end), the lagoon's waves roll aft from the wave machine,
 // and the waterfalls fall.
 const ripples=canvasTexture(256,256,(c,w,h)=>{c.fillStyle='#ffffff';c.fillRect(0,0,w,h);const r=seeded(57);c.lineCap='round';
  for(let i=0;i<70;i++){const x=r()*w,y=r()*h,l=20+r()*60,a=r()*Math.PI;c.strokeStyle=`rgba(${150+r()*60|0},${210+r()*40|0},255,${.35+r()*.4})`;c.lineWidth=1.5+r()*3;
   for(const dx of [-w,0,w])for(const dy of [-h,0,h]){c.beginPath();c.moveTo(x+dx,y+dy);c.quadraticCurveTo(x+dx+Math.cos(a)*l/2+10,y+dy+Math.sin(a)*l/2-10,x+dx+Math.cos(a)*l,y+dy+Math.sin(a)*l);c.stroke();}}});
 // The falls: streaks and drops of water on clear, scrolled down the curtain.
 const streaks=canvasTexture(256,512,(c,w,h)=>{c.clearRect(0,0,w,h);const r=seeded(203);c.lineCap='round';
  for(let i=0;i<170;i++){const x=r()*w,y=r()*h,l=60+r()*260,a=.25+r()*.6;c.strokeStyle=`rgba(255,255,255,${a})`;c.lineWidth=1+r()*2.5;for(const dy of [-h,0,h]){c.beginPath();c.moveTo(x,y+dy);c.lineTo(x+(r()-.5)*3,y+dy+l);c.stroke();}}
  for(let i=0;i<500;i++){c.fillStyle=`rgba(255,255,255,${.3+r()*.6})`;c.beginPath();c.arc(r()*w,r()*h,.8+r()*1.6,0,Math.PI*2);c.fill();}});
 const flows=[];
 const water=(geometry,color,{rep=1/6,flow=[0,0],opacity=.84,name='Keel_club_water',bright=.12,tex=ripples}={})=>{const map=tex?tex.clone():null;if(map){map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(rep,rep);map.needsUpdate=true;}
  const m=new T.MeshStandardMaterial({name,color,map,roughness:.12,metalness:.05,transparent:true,opacity,depthWrite:false,side:T.DoubleSide,emissive:color,emissiveIntensity:bright});
  const mesh=new T.Mesh(geometry,m);mesh.name=name;group.add(mesh);if(map)flows.push({map,flow:flow.map(v=>v*rep)});};
 const side=s=>{const xs=xsBetween(ra+RW,rb-RW);return flat([...xs.map(x=>[x,s*riverBank(x)]),...xs.slice().reverse().map(x=>[x,s*rIn(x)])],[],WY);};
 const cross=(x0,x1)=>{const xs=xsBetween(x0,x1,1);return flat([...xs.map(x=>[x,-riverBank(x)]),...xs.slice().reverse().map(x=>[x,riverBank(x)])],[],WY);};
 // a shape's v runs along -z, so a flow towards +z scrolls v the other way
 water(side(-1),C.river,{flow:[-.7,0]});water(side(1),C.river,{flow:[.7,0]});water(cross(rb-RW,rb),C.river,{flow:[0,.7]});water(cross(ra,ra+RW),C.river,{flow:[0,-.7]});
 water(flat(rect(lx0,lx1,-lz,lz),[],WY),C.water,{rep:1/9,flow:[1.1,0],name:'Keel_club_lagoon'});
 {const P=[],U=[];for(const {x0,x1,z} of curtains)for(const [x,y] of [[x0,TY-.3],[x1,TY-.3],[x1,WY],[x0,TY-.3],[x1,WY],[x0,WY]]){P.push(x,y,z);U.push(x/2.5,y/2.5);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.computeVertexNormals();
  water(g,0xe6fbff,{rep:1,flow:[0,1.6],opacity:streaks?.95:.7,name:'Keel_club_waterfall',bright:.6,tex:streaks});}
 const deck1=new T.Group();deck1.name='Keel_club_deck1';
 for(const [g,m,name] of [[merge(d1.parts),opaque,'Keel_club_deck1_finish'],[merge(d1.glass),see,'Keel_club_deck1_glass'],[merge(d1.signs,['position','normal','uv']),signMat,'Keel_club_deck1_signs']])if(g){const mesh=new T.Mesh(g,m);mesh.name=name;deck1.add(mesh);}
 const hidden=new T.MeshBasicMaterial({visible:false});
 for(const [gs,name] of [[grounds,'Keel_club_walkway'],[walls,'Keel_club_guard_wall']]){const g=merge(gs.map(g=>{g=g.index?g.toNonIndexed():g.clone();for(const k of Object.keys(g.attributes))if(k!=='position')g.deleteAttribute(k);return g;}));if(g){const m=new T.Mesh(g,hidden);m.name=name;solid.add(m);}}
 // Water cannons: E on a bridge's crown fires the nearest one (fire(i)) for a second and a half. Its jet is droplets
 // on a ballistic arc (one instanced draw for all of them) that leave splash rings where they hit the river (another).
 const DROPS=720,RINGS=40,SPEED=14,GRAV=9.8,JET=1.5,RATE=140,REACH=2.6;
 const dropMesh=new T.InstancedMesh(new T.IcosahedronGeometry(.16,0),new T.MeshBasicMaterial({name:'Keel_club_cannon_drop',color:0xffffff,toneMapped:false,transparent:true,opacity:.95,depthWrite:false}),DROPS);
 const ringMesh=new T.InstancedMesh(new T.RingGeometry(.25,.45,18).rotateX(-Math.PI/2),new T.MeshBasicMaterial({name:'Keel_club_cannon_splash',color:0xffffff,toneMapped:false,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide}),RINGS);
 for(const m of [dropMesh,ringMesh]){m.name='Keel_club_cannon_water';m.frustumCulled=false;m.count=0;m.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(m);}
 const drops=[],rings=[],jets=[],hitShots=new Map(),M=new T.Matrix4(),Q=new T.Quaternion(),S=new T.Vector3(),P=new T.Vector3();
 // Shots run on a fixed clock of STEP seconds (catching up at most CATCH_UP a frame), and a shot emits its droplets by
 // its age, so every page simulating it from the same `seed` sees the same jet whatever its frame rate. A shot is
 // cannon i's jet for JET seconds; `id` names it (one hit per shot per rider) and `who` the shooter (a visitor id, or
 // 'me'). Online, the server decides which shots happen and every page, the shooter's too, fires what it accepts
 // (net/live.js); offline, a page fires its own, at most one per cannon every GAP seconds, as the server allows.
 const STEP=1/60,CATCH_UP=.25,GAP=1.4,lastShot=[];let clock=0,lag=0,shots=0;
 const seed=()=>(Math.random()*2147483646|0)+1;
 const fire=(i,{id=null,seed:s=null,who='me'}={})=>{if(!CANNONS[i])return null;
  if(id===null&&clock-(lastShot[i]??-Infinity)<GAP)return null;lastShot[i]=clock;s??=seed();id??='me-'+(++shots);
  const shot={i,age:0,emitted:0,id,who,rnd:seeded(s)},old=jets.findIndex(j=>j.i===i);if(old>=0)jets[old]=shot;else jets.push(shot);return {i,seed:s,id};};
 // E's target here: a water cannon on a bridge's crown (of those within reach, the one aimed most nearly the way the
 // walker faces: heading as main.js keeps it, facing sin, cos in x, z; without a heading, the nearest), else a tube dock.
 const near=(p,heading)=>{let best=-1,bs=-Infinity;CANNONS.forEach((c,i)=>{const d=Math.hypot(p.x-c.at[0],p.z-c.at[2]);if(d>=REACH||Math.abs(p.y-(FY+RIVER.rise))>=1.2)return;
  const score=heading===undefined?-d:c.aim[0]*Math.sin(heading)+c.aim[2]*Math.cos(heading)-d*.01;if(score>bs){bs=score;best=i;}});
  if(best>=0)return {kind:'cannon',cannon:best,label:'Fire the water cannon'};
  if(Math.abs(p.y-FY)<1)for(const dock of DOCKS)if(Math.hypot(p.x-dock.at[0],p.z-dock.at[2])<TUBE.reach)return {kind:'tube',dock,label:'Float the Keel Loop'};
  return null;};
 // A droplet's path this step, from q to p (cut off where it meets the water), against a rider's sphere: centre c, radius R_HIT.
 const R_HIT=.8;
 const crosses=(d,c)=>{let ex=d.p[0],ey=d.p[1],ez=d.p[2];if(ey<WY&&d.q[1]>WY){const f=(d.q[1]-WY)/(d.q[1]-ey);ex=d.q[0]+(ex-d.q[0])*f;ey=WY;ez=d.q[2]+(ez-d.q[2])*f;}
  const ax=d.q[0]-c[0],ay=d.q[1]-c[1],az=d.q[2]-c[2],bx=ex-d.q[0],by=ey-d.q[1],bz=ez-d.q[2],bb=bx*bx+by*by+bz*bz||1e-9,t=Math.max(0,Math.min(1,-(ax*bx+ay*by+az*bz)/bb));
  const x=ax+bx*t,y=ay+by*t,z=az+bz*t;return x*x+y*y+z*z<=R_HIT*R_HIT;};
 // One step: shots emit, droplets fly; with a rider (their tube's centre), each droplet's step is tested before a
 // droplet that reaches the water is retired. A shot's first droplet to reach the rider is its hit, pushed onto `out`
 // ({id, who, dir: the droplet's x, z heading}); its droplets that reach the rider after that splash on them too.
 function step(h,rider,out){
  for(let k=jets.length-1;k>=0;k--){const j=jets[k],{at,aim}=CANNONS[j.i];j.age+=h;const due=Math.floor(Math.min(JET,j.age)*RATE);
   for(;j.emitted<due;j.emitted++){const sp=SPEED*(.94+j.rnd()*.12),jit=()=>(j.rnd()-.5)*.04,p=[at[0]+aim[0]*1.1,at[1]+.08+aim[1]*1.1,at[2]+aim[2]*1.1];
    if(drops.length<DROPS)drops.push({p,q:p.slice(),v:[(aim[0]+jit())*sp,(aim[1]+jit())*sp,(aim[2]+jit())*sp],shot:j.id,who:j.who});}
   if(j.age>=JET)jets.splice(k,1);}
  for(let k=drops.length-1;k>=0;k--){const d=drops[k];d.q[0]=d.p[0];d.q[1]=d.p[1];d.q[2]=d.p[2];d.v[1]-=GRAV*h;for(let a=0;a<3;a++)d.p[a]+=d.v[a]*h;
   if(rider&&crosses(d,rider)){if(!hitShots.has(d.shot)){hitShots.set(d.shot,JET+2);out.push({id:d.shot,who:d.who,dir:[d.v[0],d.v[2]]});}
    drops.splice(k,1);if(rings.length<RINGS)rings.push({p:[rider[0]+(d.p[0]-rider[0])*.5,WY+.02,rider[2]+(d.p[2]-rider[2])*.5],t:0});continue;}
   if(d.p[1]<=WY){drops.splice(k,1);if(rings.length<RINGS&&Math.random()<.3)rings.push({p:[d.p[0],WY+.02,d.p[2]],t:0});}}
  for(let k=rings.length-1;k>=0;k--){rings[k].t+=h;if(rings[k].t>.6)rings.splice(k,1);}
  for(const [id,left] of hitShots){if(left<=h)hitShots.delete(id);else hitShots.set(id,left-h);}
 }
 // Each frame: the ripples move, and the shots catch up on their clock. `rider` is our tube's centre (x, y, z) while we
 // float, else null. Returns the hits on us this frame.
 // The lagoon's waves: crests that rise by the wave machine, roll aft across the lagoon and die away at the beach.
 const crestShape=paint(new T.CylinderGeometry(.5,.5,2*lz-2,14,1,false,Math.PI/2,Math.PI).rotateX(Math.PI/2),C.crest);
 {const p=crestShape.attributes.position,c=crestShape.attributes.color,lo=new T.Color(C.water),hi=new T.Color(C.crest),t=new T.Color();for(let i=0;i<p.count;i++){t.copy(lo).lerp(hi,Math.min(1,Math.max(0,p.getY(i)/.5))**4);t.toArray(c.array,i*3);}}
 const CRESTS=4,crestMesh=new T.InstancedMesh(crestShape,new T.MeshStandardMaterial({name:'Keel_club_wave_crest',vertexColors:true,roughness:.3,emissive:0xffffff,emissiveIntensity:.12}),CRESTS);
 let waveT=0;const waves=dt=>{waveT+=dt;const run=lx1-6-(lx0+3);for(let i=0;i<CRESTS;i++){const f=((waveT*2.6+i*run/CRESTS)%run)/run,g=Math.sin(Math.PI*Math.min(1,f*1.1));
   crestMesh.setMatrixAt(i,M.compose(P.set(lx1-6-f*run,WY+.02,0),Q.identity(),S.set(3.4,Math.max(.01,g)*3,1)));}crestMesh.instanceMatrix.needsUpdate=true;};
 // Empty tubes drifting round the Keel Loop with the current, bobbing and turning slowly.
 const FLOATS=18,UP=new T.Vector3(0,1,0),floatMesh=new T.InstancedMesh(new T.TorusGeometry(.55,.22,8,20).rotateX(Math.PI/2),new T.MeshStandardMaterial({name:'Keel_club_drift_tube',roughness:.45}),FLOATS),floats=[];
 {const r=seeded(919),col=new T.Color();for(let i=0;i<FLOATS;i++){floats.push({s:(i+r()*.6)/FLOATS*RIVER_PATH.total,d:(r()-.5)*2,v:TUBE.current*(.8+r()*.3),spin:(r()-.5)*.6,a:r()*6});floatMesh.setColorAt(i,col.setHex([C.slide,C.orange,C.teal,0xf6e05a][i%4]));}}
 const drift=dt=>{floats.forEach((f,i)=>{f.s+=f.v*dt;f.a+=f.spin*dt;const fr=riverFrame(f.s),d=Math.max(fr.lo,Math.min(fr.hi,f.d));
   floatMesh.setMatrixAt(i,M.compose(P.set(fr.x+fr.rx*d,WY+.1+Math.sin(f.s*1.7+i)*.03,fr.z+fr.rz*d),Q.setFromAxisAngle(UP,f.a),S.set(1,1,1)));});floatMesh.instanceMatrix.needsUpdate=true;};
 for(const m of [crestMesh,floatMesh]){m.name=m.material.name;m.frustumCulled=false;m.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(m);}
 waves(0);drift(0);
 const update=(dt,rider=null)=>{
  const t=Math.min(dt,.1);for(const {map,flow} of flows){map.offset.x+=flow[0]*t;map.offset.y+=flow[1]*t;}
  waves(t);drift(t);
  const out=[],busy=jets.length||drops.length||rings.length||hitShots.size;lag+=Math.min(dt,CATCH_UP);
  while(lag>=STEP){lag-=STEP;clock+=STEP;if(busy)step(STEP,rider,out);}
  if(busy){drops.forEach((d,i)=>dropMesh.setMatrixAt(i,M.makeTranslation(d.p[0],d.p[1],d.p[2])));dropMesh.count=drops.length;
   rings.forEach((r,i)=>{const g=1+r.t*4;ringMesh.setMatrixAt(i,M.compose(P.set(...r.p),Q.identity(),S.set(g,1,g)));});ringMesh.count=rings.length;
   dropMesh.instanceMatrix.needsUpdate=true;ringMesh.instanceMatrix.needsUpdate=true;}
  return out;
 };
 // Its top band stops under Deck 1's: the walk draws it from Deck 1 (down the stair tower and lift shafts) and below, never from Deck 2 up.
 // In the hall the walk's indoor fog (solid at 148 m) would grey out its far half: from below Deck 1, the fog opens to the
 // hall's own length. Called each frame after the atrium has set the fog, before drawing; elsewhere it leaves the fog alone.
 // The haze in the hall is warm, like the concept renders' sunset; leaving the hall gives the fog its own colour back.
 // So is its light (the walk's hemisphere and fill, `light`): golden from the sky panel, warm off the floor. Like the
 // other room moods, it keeps what it found on the way in and puts it back on the way out.
 const HAZE=new T.Color(0xf3dcc8),SKY=new T.Color(0xffdcb6),GROUND=new T.Color(0xb98d66);let saved=null;
 const mood=(fog,eye,light=null)=>{if(!fog?.isFog)return;const inside=!(eye.y>DECK1-.4||eye.y<FY-4||eye.x<KEEL.aft-2||eye.x>KEEL.bow+2||Math.abs(eye.z)>half(eye.x,Math.max(eye.y,FY))+.5);
  if(!inside){if(saved){fog.color.copy(saved.fog);if(saved.hemi){const {hemi,fill}=saved.light;hemi.color.copy(saved.sky);hemi.groundColor.copy(saved.ground);hemi.intensity=saved.hemi;fill.intensity=saved.fill;}saved=null;}return;}
  if(!saved){saved={fog:fog.color.clone()};if(light?.hemi&&light?.fill)Object.assign(saved,{light,sky:light.hemi.color.clone(),ground:light.hemi.groundColor.clone(),hemi:light.hemi.intensity,fill:light.fill.intensity});}
  fog.color.copy(HAZE);fog.near=Math.max(fog.near,170);fog.far=Math.max(fog.far,440);
  if(saved.hemi){const {hemi,fill}=saved.light;hemi.color.copy(SKY);hemi.groundColor.copy(GROUND);hemi.intensity=saved.hemi*1.1;fill.intensity=saved.fill*.85;}};
 return {group,deck1,solid,seats,update,near,fire,seed,mood,bounds:{y0:FY-3,y1:CY-.6},deck1Bounds:{y0:DECK1-.5,y1:DECK1+2.5}};
}
