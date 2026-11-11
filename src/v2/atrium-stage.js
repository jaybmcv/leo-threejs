import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// G5 Common stage, option A (docs/atrium-areas.md, concept stage-a-amphitheatre): curved terraces of warm timber with
// cream cushions, stepping down from the back of the zone to a short apron in front of the stage's timber deck and cream
// back wall. Metres in the Deck 6 frame (y from the deck).
//
// Four tiers about CENTRE (the stage's front middle), each 0.24 m up: under the walker's 0.4 m step (BODY.step,
// src/walk/collision.js), so every tread is walked onto from the one in front, anywhere along the arc, and the top (0.96 m)
// stays under the 1 m drop the walk check allows without a guard (scripts/v2-walk.mjs). The deep treads carry 0.3 m timber
// benches, one per row, so seat rows step all the way down to the stage. The stage-wide viewpoint (x 68) stands on the top
// tier, as in the concept.
const CENTRE=[108,30],RISE=.24,BENCH={depth:.65,height:.3};
const TIERS=[
 {inner:6.5,outer:26.6,benches:[10.8,15.1,19.4,23.4]},
 {inner:26.6,outer:32.6,benches:[29.6]},
 {inner:32.6,outer:36.6,benches:[]},
 {inner:36.6,outer:41.5,benches:[]},
];
// Where a tier may reach: inside G5, 2.5 m off the boulevard planters (z 6), 1.4 m short of the stage (x 106), and 2.57 m
// clear of the room recess at x 70.75..89.25, z >= 37.57 (phase6-sanity keeps 2.4 m off the atrium outline).
const allowed=(x,z)=>x>=66.45&&x<=104.6&&z>=8.45&&z<=51.5&&!(x>68&&x<92&&z>35.05);
// Cushions: one row per step or bench, just behind its nosing, facing the centre, at least 1 m in from the ends (so no one
// standing on a cushion steps straight off an end), about 1.6 m apart along the row.
const CUSHION=[.7,.08,.55],CUSHION_IN=.36,CUSHION_PITCH=1.6,END_CLEAR=1;
// A pale nosing along each step's and bench's front edge: 7 cm on top, just proud, lapping 3 cm down the front.
const NOSING={depth:.07,proud:.006,lap:.03,overhang:.005};
const ARC_STEP=1.25*Math.PI/180;
const at=(r,t)=>[CENTRE[0]+r*Math.cos(t),CENTRE[1]+r*Math.sin(t)];

// Each tier is cut into bands, one per seat row (the step at its front, then each bench). Angles run from pi (straight back
// from the stage) towards +z (smaller) and -z (larger); a band reaches as far round as `allowed` lets all of it, so the
// inner bands wrap round the stage and the outer ones stop short of the recess.
function reach(inner,outer,sign){
 const radii=[];for(let r=inner;r<outer;r+=.25)radii.push(r);radii.push(outer);
 let a=0;for(let next=.002;next<Math.PI/2;next+=.002){if(!radii.every(r=>allowed(...at(r,Math.PI+sign*next))))break;a=next;}
 return Math.max(0,a-.002);
}
let bands;
export function stageBands(){
 return bands??=TIERS.flatMap((t,i)=>{const edges=[t.inner,...t.benches,t.outer];
  return edges.slice(0,-1).map((inner,k)=>{const outer=edges[k+1];return {tier:i+1,rise:(i+1)*RISE,inner,outer,start:Math.PI-reach(inner,outer,-1),end:Math.PI+reach(inner,outer,1),bench:k>0};});});
}
const benchOf=b=>{const m=END_CLEAR/b.inner;return {inner:b.inner,outer:b.inner+BENCH.depth,start:b.start+m,end:b.end-m,y0:b.rise,y1:b.rise+BENCH.height};};
const arcPolygon=(inner,outer,start,end)=>{const n=Math.ceil((end-start)/ARC_STEP),arc=(r,reverse)=>Array.from({length:n+1},(_,k)=>at(r,start+(end-start)*(reverse?n-k:k)/n));return [...arc(outer,false),...arc(inner,true)];};
// The walkable tops in plan, for plannedStanding (standing.js): every band's tread and every bench's top.
export function stageTiers(){
 return stageBands().flatMap(b=>[{rise:b.rise,polygon:arcPolygon(b.inner,b.outer,b.start,b.end)},...(b.bench?[(c=>({rise:c.y1,polygon:arcPolygon(c.inner,c.outer,c.start,c.end)}))(benchOf(b))]:[])]);
}
export function stageSeats(){
 const seats=[];
 stageBands().forEach((b,band)=>{
  const r=b.inner+CUSHION_IN,clear=END_CLEAR+(b.bench?END_CLEAR*.5:0)+CUSHION[0]/2,span=b.end-b.start-2*clear/r;if(span<=0)return;
  const n=Math.floor(span*r/CUSHION_PITCH)+1,top=b.rise+(b.bench?BENCH.height:0)+CUSHION[1];
  for(let k=0;k<n;k++){const a=b.start+clear/r+span*(n>1?k/(n-1):.5),[x,z]=at(r,a),facing=[-Math.cos(a),0,-Math.sin(a)];
   seats.push({tier:b.tier,band,row:b.bench?'bench':'step',index:seats.filter(s=>s.tier===b.tier).length,x,z,top,facing,yaw:Math.atan2(facing[0],facing[2])});}
 });
 return seats;
}

// The collidable shapes, drawn by nothing (atrium-architecture.js hides them, as it does the terrace guards): the stage
// draws in the atrium's vertex-coloured garden mesh instead (addStageDecor), so its warm timber adds no draw. The back
// wall is the one visible furnishing.
export function stageGeometry(part){
 const spec=part.stageShape;if(!spec)return null;
 // The shapes are laid out from the deck (spec.floor); the part's centre is in the ship frame.
 const [ox,,oz]=part.at,oy=part.at[1]-spec.floor;
 if(spec.kind==='tiers'){const b=stageBands();return arcSolids([...b.map(b=>({...b,y0:0,y1:b.rise})),...b.filter(b=>b.bench).map(benchOf)],ox,oy,oz);}
 if(spec.kind==='cushions'){
  const list=stageSeats().filter(s=>s.band===spec.band).map(s=>new T.BoxGeometry(...CUSHION).rotateY(s.yaw).translate(s.x-ox,s.top-CUSHION[1]/2-oy,s.z-oz));
  const g=mergeGeometries(list);list.forEach(x=>x.dispose());return g;
 }
 // The back wall faces aft, away from the atrium's sun, where a cream face renders tan. Its face is shaded as if it
 // leaned back towards the light (normals only, as atrium-architecture.js does for the lift tower), so it reads cream.
 if(spec.kind==='wall'){
  const g=new T.BoxGeometry(...part.size),n=g.attributes.normal,lit=new T.Vector3(-1,1.6,0).normalize();
  for(let i=0;i<n.count;i++)if(n.getX(i)<-.5)n.setXYZ(i,lit.x,lit.y,lit.z);
  return g;
 }
 return null;
}
// Closed curved solids about CENTRE between radii inner..outer, angles start..end and heights y0..y1 above the deck (no
// underside): top, inner face, outer face and both ends. `quad(corners, normals, outward, face)` emits each face.
function arcFaces(list,quad){
 for(const t of list){
  const n=Math.ceil((t.end-t.start)/ARC_STEP),angle=k=>t.start+(t.end-t.start)*k/n,{y0,y1}=t;
  for(let k=0;k<n;k++){
   const a=angle(k),b=angle(k+1),[ia,ib,oa,ob]=[[t.inner,a],[t.inner,b],[t.outer,a],[t.outer,b]].map(([r,q])=>at(r,q)),ra=[Math.cos(a),0,Math.sin(a)],rb=[Math.cos(b),0,Math.sin(b)],up=[0,1,0],inA=ra.map(v=>-v),inB=rb.map(v=>-v);
   if(!t.noTop)quad([[ia[0],y1,ia[1]],[oa[0],y1,oa[1]],[ob[0],y1,ob[1]],[ib[0],y1,ib[1]]],[up,up,up,up],up,'top');
   quad([[ia[0],y0,ia[1]],[ib[0],y0,ib[1]],[ib[0],y1,ib[1]],[ia[0],y1,ia[1]]],[inA,inB,inB,inA],[-(ra[0]+rb[0]),0,-(ra[2]+rb[2])],'front');
   quad([[oa[0],y0,oa[1]],[ob[0],y0,ob[1]],[ob[0],y1,ob[1]],[oa[0],y1,oa[1]]],[ra,rb,rb,ra],[ra[0]+rb[0],0,ra[2]+rb[2]],'back');
  }
  for(const [q,sign] of [[t.start,-1],[t.end,1]]){
   const [i,o]=[at(t.inner,q),at(t.outer,q)],side=[-Math.sin(q)*sign,0,Math.cos(q)*sign];
   quad([[i[0],y0,i[1]],[o[0],y0,o[1]],[o[0],y1,o[1]],[i[0],y1,i[1]]],[side,side,side,side],side,'end');
  }
 }
}
const wound=(corners,out)=>{const [a,b,c]=[0,1,2].map(k=>new T.Vector3(...corners[k])),face=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a));return face.dot(new T.Vector3(...out))>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2];};
function arcSolids(list,ox,oy,oz){
 const pos=[],nor=[],index=[];
 arcFaces(list,(corners,normals,out)=>{const base=pos.length/3;corners.forEach((c,k)=>{pos.push(c[0]-ox,c[1]-oy,c[2]-oz);nor.push(...normals[k]);});index.push(...wound(corners,out).map(k=>base+k));});
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(new Array(pos.length/3*2).fill(0),2));g.setIndex(index);return g;
}

// ---- What the stage looks like (into atrium-gardens.js' merged, vertex-coloured garden mesh) ----------------------------
// Honey timber boards (concentric, a few metres long, each a slightly different tone), darker fronts and ends, pale
// nosings, cream cushions, and the stage deck's boards. Colours are sRGB hex, converted as everywhere in the garden mesh.
const BOARDS=[0xb67d47,0xbf8450,0xad7441,0xb9804a,0xb27a44,0xc28a55],FACE=0x9c6538,NOSE=0xdcae78,CUSHION_TONE=0xf1e1c4,BOARD_W=.3;
function random(seed){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
export function addStageDecor(out,layout){
 const y=layout.decks[5].y,rnd=random(5501),pos=[],col=[],c=new T.Color();
 const quad=(corners,colour,outward)=>{c.set(colour);for(const k of wound(corners,outward)){const p=corners[k];pos.push(p[0],p[1]+y,p[2]);col.push(c.r,c.g,c.b);}};
 const tone=()=>new T.Color(BOARDS[rnd()*BOARDS.length|0]).multiplyScalar(.95+rnd()*.1);
 // Boards on an arc band's top: strips about 0.3 m wide, each broken into boards 2.4-4.4 m long.
 const boards=(inner,outer,start,end,h)=>{const n=Math.max(1,Math.round((outer-inner)/BOARD_W));
  for(let j=0;j<n;j++){const r0=inner+(outer-inner)*j/n,r1=inner+(outer-inner)*(j+1)/n,rm=(r0+r1)/2;let a=start;
   while(a<end-1e-6){const b=Math.min(end,a+(2.4+rnd()*2)/rm),colour=tone(),m=Math.max(1,Math.ceil((b-a)/ARC_STEP));
    for(let k=0;k<m;k++){const p=a+(b-a)*k/m,q=a+(b-a)*(k+1)/m,[ia,ib,oa,ob]=[[r0,p],[r0,q],[r1,p],[r1,q]].map(([r,t])=>at(r,t));quad([[ia[0],h,ia[1]],[oa[0],h,oa[1]],[ob[0],h,ob[1]],[ib[0],h,ib[1]]],colour,[0,1,0]);}
    a=b;}}};
 const solid=list=>arcFaces(list.map(s=>({...s,noTop:true})),(corners,normals,outward)=>quad(corners,FACE,outward));
 const nosing=(inner,start,end,h)=>arcFaces([{inner:inner-NOSING.overhang,outer:inner+NOSING.depth,start,end,y0:h-NOSING.lap,y1:h+NOSING.proud}],(corners,normals,outward,face)=>{if(face!=='back')quad(corners,NOSE,outward);});
 const b=stageBands();
 for(const band of b){boards(band.inner,band.outer,band.start,band.end,band.rise);if(!band.bench)nosing(band.inner,band.start,band.end,band.rise);}
 solid(b.map(band=>({...band,y0:0,y1:band.rise})));
 for(const bench of b.filter(band=>band.bench).map(benchOf)){boards(bench.inner,bench.outer,bench.start,bench.end,bench.y1);solid([bench]);nosing(bench.inner,bench.start,bench.end,bench.y1);}
 // The stage deck: boards across the stage (14 x 32 m, 0.36 m up), a darker front and sides, and the same pale nosing.
 const [x0,x1,z0,z1,h]=[106,120,14,46,.36];
 for(let x=x0;x<x1-1e-6;x+=BOARD_W){const xb=Math.min(x1,x+BOARD_W);let z=z0;while(z<z1-1e-6){const zb=Math.min(z1,z+2.4+rnd()*2);quad([[x,h,z],[xb,h,z],[xb,h,zb],[x,h,zb]],tone(),[0,1,0]);z=zb;}}
 quad([[x0,0,z0],[x0,0,z1],[x0,h,z1],[x0,h,z0]],FACE,[-1,0,0]);
 for(const [z,s] of [[z0,-1],[z1,1]])quad([[x0,0,z],[x1,0,z],[x1,h,z],[x0,h,z]],FACE,[0,0,s]);
 const xn=x0-NOSING.overhang,hp=h+NOSING.proud;
 quad([[xn,hp,z0],[x0+NOSING.depth,hp,z0],[x0+NOSING.depth,hp,z1],[xn,hp,z1]],NOSE,[0,1,0]);
 quad([[xn,h-NOSING.lap,z0],[xn,h-NOSING.lap,z1],[xn,hp,z1],[xn,hp,z0]],NOSE,[-1,0,0]);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();
 g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));g.setAttribute('color',new T.Float32BufferAttribute(col,3));out.push(g);
 // Cushions, where the (hidden) collidable cushions are.
 const cream=new T.Color(CUSHION_TONE);let cushionTriangles=0;
 for(const s of stageSeats()){const r=new RoundedBoxGeometry(...CUSHION,1,.02).rotateY(s.yaw).translate(s.x,y+s.top-CUSHION[1]/2,s.z),k=r.index?r.toNonIndexed():r,count=k.attributes.position.count;
  k.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(count*3).map((_,i)=>[cream.r,cream.g,cream.b][i%3]),3));
  for(const name of Object.keys(k.attributes))if(!['position','normal','uv','color'].includes(name))k.deleteAttribute(name);
  out.push(k);cushionTriangles+=count/3;}
 return {stageTriangles:pos.length/9+cushionTriangles};
}

// Replaces the flat stage box, navy backdrop and 145 teal theatre chairs. The stage keeps its 14 x 32 m deck (0.36 m, one
// step up, collidable) and its sign (phase6-programme.js); the backdrop becomes a cream stone wall, its face where it was.
export function addAtriumStage({parts,rests,y}){
 const room='atrium6-stage',add=(part,size,centre,mat,options={})=>parts.push({room,part,size,at:centre,mat,yaw:0,deck:6,phase6:true,selectedDesign:'stage-a',...options});
 add('p6_stage_platform',[14,.36,32],[113,y+.18,30],'oak');
 add('p6_stage_backdrop',[.28,3.1,29],[119.86,y+1.91,30],'cream',{noCollide:true,stageShape:{kind:'wall',floor:y}});
 const box=points=>{const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);return {size:[x1-x0,z1-z0],centre:[(x0+x1)/2,(z0+z1)/2]};};
 const tiers=box(stageTiers().flatMap(t=>t.polygon)),top=TIERS.length*RISE;
 add('p6_stage_tiers',[tiers.size[0],top,tiers.size[1]],[tiers.centre[0],y+top/2,tiers.centre[1]],'oak',{stageShape:{kind:'tiers',floor:y}});
 // One collidable cushion row per band, so each part's bounds (which phase6-sanity checks against the outline) are its row's.
 const seats=stageSeats();
 for(const band of new Set(seats.map(s=>s.band))){const row=seats.filter(s=>s.band===band),b=box(row.map(s=>[s.x,s.z])),top=row[0].top;
  add('p6_stage_cushions_'+band,[b.size[0]+CUSHION[0],CUSHION[1],b.size[1]+CUSHION[0]],[b.centre[0],y+top-CUSHION[1]/2,b.centre[1]],'cream',{stageShape:{kind:'cushions',band,floor:y}});}
 for(const s of seats)rests.push({id:'p6-stage-tier-'+s.tier+'-seat-'+s.index,room,kind:'sit',point:[s.x,y+s.top,s.z],facing:s.facing,height:y+s.top,instanced:true,phase4:true,phase6:true});
 return {tiers:TIERS.length,seats:seats.length};
}
