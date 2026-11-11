import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// G5 Common stage, option A (docs/atrium-areas.md, concept stage-a-amphitheatre): four shallow curved tiers of warm timber
// with cream cushions, facing the stage's timber deck and its cream back wall. Metres in the Deck 6 frame (y from the deck).
// The tiers are concentric about CENTRE, in front of the stage. Each rises 0.24 m: under the walker's 0.4 m step
// (src/walk/collision.js BODY.step), so every tread is walked onto from the one below, and the top (0.96 m) stays under
// the 1 m drop the walk check allows without a guard (scripts/v2-walk.mjs). They end inside the zone: z 8.5 clears the
// boulevard planters, z 35 keeps 2.4 m off the room recess at x 71..89, and the top tier's back edge stays at x >= 66.5.
// The top tier is a deep promenade (the stage-wide viewpoint at x 68 stands on it, as in the concept).
const CENTRE=[102,30],RISE=.24,Z_MIN=8.5,Z_MAX=35;
const TREADS=[[24.4,26.6],[26.6,28.8],[28.8,31],[31,35.5]];
// Cushions: one row at the front of each tier, facing the centre, at least 1 m in from the tier's ends (so no one standing
// on a cushion steps straight off a tier end), about 1.6 m apart along the row.
const CUSHION=[.7,.08,.55],CUSHION_IN=.3,CUSHION_PITCH=1.6,END_CLEAR=1;
const ARC_STEP=1.25*Math.PI/180;
const at=(r,t)=>[CENTRE[0]+r*Math.cos(t),CENTRE[1]+r*Math.sin(t)];

// The tiers in plan: angles run from the stage-left end (towards the boulevard) through pi (straight back from the
// stage) to the stage-right end. `rise` is the tread's height above the deck.
export function stageTiers(){
 return TREADS.map(([inner,outer],i)=>{
  const start=Math.PI-Math.asin((Z_MAX-CENTRE[1])/outer),end=Math.PI+Math.asin((CENTRE[1]-Z_MIN)/outer);
  const n=Math.ceil((end-start)/ARC_STEP),arc=(r,reverse)=>Array.from({length:n+1},(_,k)=>at(r,start+(end-start)*(reverse?n-k:k)/n));
  return {tier:i+1,rise:(i+1)*RISE,inner,outer,start,end,polygon:[...arc(outer,false),...arc(inner,true)]};
 });
}
export function stageSeats(){
 const seats=[];
 for(const t of stageTiers()){
  const r=t.inner+CUSHION_IN,margin=(END_CLEAR+CUSHION[0]/2)/r,span=t.end-t.start-2*margin,n=Math.floor(span*r/CUSHION_PITCH)+1;
  for(let k=0;k<n;k++){const a=t.start+margin+span*(n>1?k/(n-1):.5),[x,z]=at(r,a),facing=[-Math.cos(a),0,-Math.sin(a)];
   seats.push({tier:t.tier,index:k,x,z,top:t.rise+CUSHION[1],facing,yaw:Math.atan2(facing[0],facing[2])});}
 }
 return seats;
}

// Two shapes, each drawn and collided as one furnishing (phase4-fitout.js): every tier in one solid, every cushion in
// another. Both are indexed, so on multi-draw GPUs they join the oak and cream furnishing batches (furnishing-batches.js).
export function stageGeometry(part){
 const spec=part.stageShape;if(!spec)return null;
 // The shapes are laid out from the deck (spec.floor); the part's centre is in the ship frame.
 const [ox,,oz]=part.at,oy=part.at[1]-spec.floor;
 if(spec.kind==='tiers')return tiersGeometry(ox,oy,oz);
 if(spec.kind==='cushions'){
  const list=stageSeats().map(s=>new RoundedBoxGeometry(...CUSHION,1,.02).rotateY(s.yaw).translate(s.x-ox,s.top-CUSHION[1]/2-oy,s.z-oz));
  const g=mergeVertices(mergeGeometries(list));list.forEach(x=>x.dispose());return g;
 }
 return null;
}
// Each tier a closed solid from the deck to its tread (no underside): tread, riser, back and both ends, with radial normals
// on the curved faces so the risers shade smoothly round the arc.
function tiersGeometry(ox,oy,oz){
 const pos=[],nor=[],index=[];
 const quad=(corners,normals,out)=>{const base=pos.length/3;corners.forEach((c,k)=>{pos.push(c[0]-ox,c[1]-oy,c[2]-oz);nor.push(...normals[k]);});
  const [a,b,c]=[0,1,2].map(k=>new T.Vector3(...corners[k])),face=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a));
  index.push(...(face.dot(new T.Vector3(...out))>=0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).map(k=>base+k));};
 for(const t of stageTiers()){
  const n=Math.ceil((t.end-t.start)/ARC_STEP),angle=k=>t.start+(t.end-t.start)*k/n,h=t.rise;
  for(let k=0;k<n;k++){
   const a=angle(k),b=angle(k+1),[ia,ib,oa,ob]=[[t.inner,a],[t.inner,b],[t.outer,a],[t.outer,b]].map(([r,q])=>at(r,q)),ra=[Math.cos(a),0,Math.sin(a)],rb=[Math.cos(b),0,Math.sin(b)],up=[0,1,0];
   quad([[ia[0],h,ia[1]],[oa[0],h,oa[1]],[ob[0],h,ob[1]],[ib[0],h,ib[1]]],[up,up,up,up],up);
   const inA=ra.map(v=>-v),inB=rb.map(v=>-v);
   quad([[ia[0],0,ia[1]],[ib[0],0,ib[1]],[ib[0],h,ib[1]],[ia[0],h,ia[1]]],[inA,inB,inB,inA],[-(ra[0]+rb[0]),0,-(ra[2]+rb[2])]);
   quad([[oa[0],0,oa[1]],[ob[0],0,ob[1]],[ob[0],h,ob[1]],[oa[0],h,oa[1]]],[ra,rb,rb,ra],[ra[0]+rb[0],0,ra[2]+rb[2]]);
  }
  for(const [q,sign] of [[t.start,-1],[t.end,1]]){
   const [i,o]=[at(t.inner,q),at(t.outer,q)],side=[-Math.sin(q)*sign,0,Math.cos(q)*sign];
   quad([[i[0],0,i[1]],[o[0],0,o[1]],[o[0],h,o[1]],[i[0],h,i[1]]],[side,side,side,side],side);
  }
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(new Array(pos.length/3*2).fill(0),2));g.setIndex(index);return g;
}

// Replaces the flat stage box, navy backdrop and 145 teal theatre chairs. The stage keeps its 14 x 32 m timber deck (0.36 m,
// one step up) and its sign (phase6-programme.js); the backdrop becomes a cream stone wall, its face where it was.
export function addAtriumStage({parts,rests,y}){
 const room='atrium6-stage',add=(part,size,centre,mat,options={})=>parts.push({room,part,size,at:centre,mat,yaw:0,deck:6,phase6:true,selectedDesign:'stage-a',...options});
 add('p6_stage_platform',[14,.36,32],[113,y+.18,30],'oak');
 add('p6_stage_backdrop',[.28,3.1,29],[119.86,y+1.91,30],'cream',{noCollide:true});
 const box=points=>{const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);return {size:[x1-x0,z1-z0],centre:[(x0+x1)/2,(z0+z1)/2]};};
 const tiers=box(stageTiers().flatMap(t=>t.polygon)),top=TREADS.length*RISE;
 add('p6_stage_tiers',[tiers.size[0],top,tiers.size[1]],[tiers.centre[0],y+top/2,tiers.centre[1]],'oak',{stageShape:{kind:'tiers',floor:y}});
 const seats=stageSeats(),cushions=box(seats.map(s=>[s.x,s.z]));
 add('p6_stage_cushions',[cushions.size[0]+CUSHION[0],top,cushions.size[1]+CUSHION[0]],[cushions.centre[0],y+(RISE+top+CUSHION[1])/2,cushions.centre[1]],'cream',{stageShape:{kind:'cushions',floor:y}});
 for(const s of seats)rests.push({id:'p6-stage-tier-'+s.tier+'-seat-'+s.index,room,kind:'sit',point:[s.x,y+s.top,s.z],facing:s.facing,height:y+s.top,instanced:true,phase4:true,phase6:true});
 return {tiers:TREADS.length,seats:seats.length};
}
