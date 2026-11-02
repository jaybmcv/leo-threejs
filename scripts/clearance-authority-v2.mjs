import * as T from 'three';
import {createSkinAuthority as createAxialAuthority} from '../src/plan/skin-clearance-v2.js';
// Independent containment fallback for gaps in the axial projection of the finished
// triangle soup. This changes the sign of an interior distance, never the 5 cm limit.
// Fourteen oblique rays must agree (at least 12) on positive oriented winding.
const directions=[[1,.173,.311],[.271,1,.193],[.219,.137,1],[1,1,.71],[1,-.53,.91],[-.67,1,.43],[.4,.73,-1]].flatMap(d=>[new T.Vector3(...d).normalize(),new T.Vector3(...d).normalize().negate()]);
export function createSkinAuthority(root){
 const base=createAxialAuthority(root),pressure=base.components.find(c=>c.name==='pressure'),cache=new Map(),proof={tested:0,recovered:0,rejected:0,examples:[]};
 const insideSeam=q=>{if(!pressure||!pressure.box.containsPoint(new T.Vector3(...q)))return false;const side=Math.sign(q[2])||1;if(pressure.atlas.skin(q[0],q[1],side)!==null)return false;const key=q.join(',');if(cache.has(key))return cache.get(key);const origin=new T.Vector3(...q),pos=pressure.geometry.attributes.position,ix=pressure.geometry.index,normal=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let votes=0;
  for(const direction of directions){const hits=pressure.bvh.raycast(new T.Ray(origin,direction),T.DoubleSide,.000001,10000).sort((a,b)=>a.distance-b.distance);let last=-Infinity,winding=0;for(const hit of hits){if(hit.distance-last<=.0001)continue;last=hit.distance;for(const[k,v]of [[0,a],[1,b],[2,c]])v.fromBufferAttribute(pos,ix?ix.getX(hit.faceIndex*3+k):hit.faceIndex*3+k);normal.crossVectors(b.sub(a),c.sub(a)).normalize();winding+=Math.sign(normal.dot(direction));}if(winding>0)votes++;}
  const inside=votes>=12;proof.tested++;proof[inside?'recovered':'rejected']++;if(proof.examples.length<30)proof.examples.push({point:q,votes,total:directions.length,inside});cache.set(key,inside);return inside;
 };
 return {...base,seamContainmentProof:proof,insidePressure(q){return base.insidePressure(q)||insideSeam(q);},distance(q,options={}){const d=base.distance(q,options);return d>0&&(!options.componentName||options.componentName==='pressure')&&insideSeam(q)?-d:d;}};
}
