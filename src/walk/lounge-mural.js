import * as T from 'three';
import {canvasTexture,seeded} from '../polish-kit.js';

// The Hydro-Nip Lounge's synthwave wall (from tester feedback): a neon sunset over wireframe mountains, painted across the
// back wall, with the same mountains running on along the left wall (the sun stays on the back wall). It is drawn in code
// (no picture is used), as one panorama unrolled along the walls: the left wall's strip comes first (S 0 to 38 m, front to
// back), then the back wall's (S 38 to 83 m, left to right), and the mountains' ridgeline carries on across the corner.
// Each wall is one plane just off its face, in the lounge's own coordinates, drawn unlit so it glows like the neon around it.
const ROOM_X0=109.5,ROOM_X1=154.5,ROOM_Z0=8,ROOM_Z1=46,FLOOR=24.3,HEIGHT=11.2;
// Where the sun sits on the back wall, in the lounge's x, and its size and height up the wall.
const SUN={x:143,r:3.5,v:7};
const HORIZON=4.15;
const SPAN_LEFT=ROOM_Z1-ROOM_Z0,SPAN_BACK=ROOM_X1-ROOM_X0,SUN_S=SPAN_LEFT+SUN.x-ROOM_X0;
// The picture's pixels to a metre of wall.
const PPM=72;

const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
// The colour of a mountain's lines by its distance: pink near, violet between, cyan far.
const LINE=[[255,64,200],[150,92,255],[56,214,255]];
const lineColor=t=>{const s=t*2,i=Math.min(1,Math.floor(s)),f=s-i,a=LINE[i],b=LINE[i+1];return [0,1,2].map(k=>Math.round(mix(a[k],b[k],f)));};

// Paints the panorama between S = s0 and s0 + w / PPM into a w x h canvas (h / PPM is the wall's height, 11.2 m).
export function paintSynthwave(g,w,h,s0){
 const sx=s=>(s-s0)*PPM,sy=v=>h-v*PPM,span=w/PPM;
 // Sky: black at the top, violet toward the horizon, with a cool haze right at it.
 const sky=g.createLinearGradient(0,0,0,sy(HORIZON));
 sky.addColorStop(0,'#03010c');sky.addColorStop(.45,'#0a0430');sky.addColorStop(.8,'#2a0f66');sky.addColorStop(1,'#4a1a8a');
 g.fillStyle=sky;g.fillRect(0,0,w,h);
 const rnd=seeded(168);
 // Stars, a few brighter.
 for(let i=0;i<Math.round(span*16);i++){
  const x=sx(s0+rnd()*span),y=sy(HORIZON+rnd()*(HEIGHT-HORIZON)),b=rnd(),r=.5+b*b*1.9;
  g.fillStyle=`rgba(${215+rnd()*40|0},${200+rnd()*40|0},255,${.25+b*.7})`;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
 }
 // The sun, when it is in this picture: a pink glow, a disc from magenta to amber, and dark bars cutting into its lower half.
 const cx=sx(SUN_S),cy=sy(SUN.v),R=SUN.r*PPM;
 if(cx>-R*3&&cx<w+R*3){
  const halo=g.createRadialGradient(cx,cy,R*.8,cx,cy,R*2.9);halo.addColorStop(0,'rgba(255,60,170,.5)');halo.addColorStop(.35,'rgba(200,50,200,.2)');halo.addColorStop(1,'rgba(120,40,220,0)');
  g.fillStyle=halo;g.fillRect(cx-R*3,cy-R*3,R*6,R*6);
  g.save();g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.clip();
  const disc=g.createLinearGradient(0,cy-R,0,cy+R);disc.addColorStop(0,'#ff2b9c');disc.addColorStop(.5,'#ff6f55');disc.addColorStop(1,'#ffc43a');
  g.fillStyle=disc;g.fillRect(cx-R,cy-R,R*2,R*2);
  // Bars: thin at the middle, wider and closer toward the foot.
  g.fillStyle='#14063c';
  for(let k=0;k<8;k++){const t=k/7,y=cy+R*(.02+.86*t*(.6+.4*t)),th=R*(.018+.075*t);g.fillRect(cx-R,y,R*2,th);}
  g.restore();
 }
 // The mountains: a heightfield seen from a low eye, drawn from the farthest row to the nearest, each cell filled dark so it
 // hides what is behind it, with neon lines along its far and left edges.
 const F=26,EYE=1.6,D0=8,D1=90,ROAD=5.5,seed=seeded(77),lat=[],GRID=64;
 for(let i=0;i<GRID*GRID;i++)lat.push(seed());
 const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),at=(a,b)=>lat[(((a%GRID)+GRID)%GRID)*GRID+(((b%GRID)+GRID)%GRID)];
  return mix(mix(at(ix,iy),at(ix+1,iy),u),mix(at(ix,iy+1),at(ix+1,iy+1),u),v);};
 // The ground's height at X across the sun's axis and depth d: flat road between the mountains, which rise in ridges.
 const ground=(X,d)=>{
  const ax=Math.abs(X),rise=smooth(ROAD,ROAD+7+d*.12,ax);if(rise<=0)return 0;
  const ridge=1-Math.abs(noise(X*.17+40,d*.11)*2-1),bump=noise(X*.45,d*.3);
  return rise*(.9+.17*d)*(.2+.8*(ridge*ridge*.75+bump*.25));
 };
 const proj=(X,d,y)=>[sx(SUN_S+X*F/d),sy(HORIZON+(y-EYE)*F/d)];
 const rows=[];for(let d=D0;d<D1;d+=Math.max(.3,d*.03))rows.push(d);rows.push(D1);
 // The columns (every half unit across) whose screen position can fall in the picture at depth d, with a margin.
 const STEP=.5,cols=(d,e)=>[Math.floor(Math.min((s0-3-SUN_S)*d,(s0-3-SUN_S)*e)/F/STEP),Math.ceil(Math.max((s0+span+3-SUN_S)*d,(s0+span+3-SUN_S)*e)/F/STEP)];
 g.lineJoin='round';g.lineCap='round';
 const lineW=t=>mix(3.2,1.3,t)*PPM/91;
 let prev=null;// the next row out's points
 // The ground beyond the farthest row is one dark band under a bright horizon line.
 const edge=sy(HORIZON-EYE*F/D1);
 g.fillStyle='#0b0430';g.fillRect(0,edge,w,h-edge);
 const haze=g.createLinearGradient(0,edge-1.6*PPM,0,edge);haze.addColorStop(0,'rgba(60,210,255,0)');haze.addColorStop(1,'rgba(70,220,255,.55)');
 g.fillStyle=haze;g.fillRect(0,edge-1.6*PPM,w,1.6*PPM);
 for(let k=rows.length-1;k>=0;k--){
  const d=rows[k],t=(d-D0)/(D1-D0),far=k===rows.length-1?null:rows[k+1];
  // Row k's points, found as they are asked for; the next row out was the previous pass's.
  const pts=new Map(),at=i=>{let p=pts.get(i);if(!p)pts.set(i,p=proj(i*STEP,d,ground(i*STEP,d)));return p;};
  if(far!==null){
   const col=lineColor(Math.pow(t,.7));
   const [ia,ib]=cols(d,far);
   for(let i=ia;i<ib;i++){
    const p0=at(i),p1=at(i+1),q0=prev(i),q1=prev(i+1);
    if(Math.max(p0[0],p1[0],q0[0],q1[0])<-40||Math.min(p0[0],p1[0],q0[0],q1[0])>w+40)continue;
    // Fill from the far edge down to the near one, a deeper violet in the valleys, a little lighter on the ridges.
    const lift=Math.min(1,Math.max(0,ground((i+.5)*STEP,d)/(1.5+.17*d)));
    g.fillStyle=`rgb(${10+lift*18|0},${4+lift*6|0},${34+lift*36|0})`;
    g.beginPath();g.moveTo(...q0);g.lineTo(...q1);g.lineTo(...p1);g.lineTo(...p0);g.closePath();g.fill();
    g.strokeStyle=`rgba(${col},.2)`;g.lineWidth=lineW(t)*3.1;
    g.beginPath();g.moveTo(...p0);g.lineTo(...q0);g.lineTo(...q1);g.stroke();
    g.strokeStyle=`rgb(${col})`;g.lineWidth=lineW(t);
    g.beginPath();g.moveTo(...p0);g.lineTo(...q0);g.lineTo(...q1);g.stroke();
   }
  }
  prev=at;
 }
}

// A wall's plane in the lounge's coordinates: from (x0,y0,z0) to (x1,y1,z1) across it, facing `n` (a unit vector, into the room),
// with the picture's [u0,u1] x [v0,v1] shown, laid just `lift` m off the wall.
const plane=(a,b,u,v)=>{
 const g=new T.BufferGeometry(),pos=[a[0],a[1],a[2], b[0],a[1],b[2], b[0],b[1],b[2], a[0],b[1],a[2]];
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 g.setAttribute('uv',new T.Float32BufferAttribute([u[0],v[0], u[1],v[0], u[1],v[1], u[0],v[1]],2));
 g.setIndex([0,1,2,0,2,3]);return g;
};

// The mural's meshes, one group the walk draws while any of the deck bands the walls span is in view. `frame` takes the
// lounge's own coordinates to the world's; `back` and `left` are the walls' lowest standing heights (a wall opened up to the
// next commons below a header, as on Deck 17, has only the header to cover).
export function createLoungeMural(frame,{back=FLOOR,left=FLOOR}={}){
 if(typeof document==='undefined')return null;
 const group=new T.Group();group.name='Walk_lounge_mural';
 const material=(map,name)=>{map.wrapS=map.wrapT=T.ClampToEdgeWrapping;map.anisotropy=8;return new T.MeshBasicMaterial({name,map,color:0xe6e6e6,toneMapped:false,side:T.DoubleSide});};
 const lift=.008,top=FLOOR+HEIGHT;
 const mesh=(name,map,a,b,u,v)=>{const g=plane(a,b,u,v).applyMatrix4(frame),o=new T.Mesh(g,material(map,name));o.name=name;o.frustumCulled=false;group.add(o);return o;};
 // The back wall: its inner face is at z 45.9; the left wall's at x 109.6.
 const backMap=canvasTexture(Math.round(SPAN_BACK*PPM),Math.round(HEIGHT*PPM),(g,w,h)=>paintSynthwave(g,w,h,SPAN_LEFT));
 mesh('Lounge_mural_back',backMap,[ROOM_X0,back,ROOM_Z1-.1-lift],[ROOM_X1,top,ROOM_Z1-.1-lift],[0,1],[(back-FLOOR)/HEIGHT,1]);
 const leftMap=canvasTexture(Math.round(SPAN_LEFT*PPM),Math.round(HEIGHT*PPM),(g,w,h)=>paintSynthwave(g,w,h,0));
 mesh('Lounge_mural_left',leftMap,[ROOM_X0+.1+lift,left,ROOM_Z0],[ROOM_X0+.1+lift,top,ROOM_Z1],[0,1],[(left-FLOOR)/HEIGHT,1]);
 // Bands (4 m, from collision.js) it reaches, for the walk to draw it by.
 return {group,low:Math.min(back,left),top};
}
