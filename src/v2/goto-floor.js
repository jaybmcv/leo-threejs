import * as T from 'three';
import {BODY} from '../walk/collision.js';
// Exact destination check: no spiral search, no lower-deck fallback. The whole
// walker footprint needs a floor at the advertised elevation and clear headroom.
export function gotoFloor(colliders,at,{planned=()=>true,tolerance=.18}={}){
 if(!Array.isArray(at)||at.length!==3||!at.every(Number.isFinite))return {ok:false,reason:'invalid coordinates'};
 const [x,y,z]=at,{radius:r,height:h,step}=BODY,cast=colliders.raycastGround||colliders.raycast;
 const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0));let floor=null;
 for(const [dx,dz]of [[0,0],...Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4)*r,Math.sin(i*Math.PI/4)*r])]){
  ray.origin.set(x+dx,y+.42,z+dz);const hit=cast.call(colliders,ray,.42+tolerance);
  if(!hit||hit.normal.y<.7||Math.abs(hit.point.y-y)>tolerance)return {ok:false,reason:'missing safe floor'};
  if(floor===null)floor=hit.point.y;
  if(Math.abs(hit.point.y-floor)>.08)return {ok:false,reason:'floor edge under footprint'};
  if(!planned(x+dx,hit.point.y,z+dz))return {ok:false,reason:'outside planned interior floor'};
 }
 const segment=new T.Line3(new T.Vector3(x,floor+step+r,z),new T.Vector3(x,floor+h-r,z));
 if(colliders.overlaps(segment,r))return {ok:false,reason:'blocked walker or headroom'};
 return {ok:true,at:[x,floor,z]};
}
export function checkGotoFloors(places,colliders,options){return places.flatMap(p=>{const result=gotoFloor(colliders,p.at,options);return result.ok?[]:[{id:p.id,reason:result.reason}];});}
