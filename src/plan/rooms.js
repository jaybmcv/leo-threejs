import * as T from 'three';
import {AREAS,CABINS,COMMONS,TRANSIT_CORES} from './v1.js';

export const LAYOUT_VERSION=1;
const entries=new Map(),overrides=new Map(),objects=new WeakMap(),cabinRoots=new WeakMap(),instanceBases=new WeakMap(),cabinIds=new Map(),mergedObjects=new WeakMap();let deferred=false;
const add=a=>{const f={yaw:0,mirror:false,...a};f.origin=Object.freeze([...f.origin]);f.size=Object.freeze([...f.size]);if(f.bounds)f.bounds=Object.freeze(f.bounds.map(p=>Object.freeze([...p])));entries.set(f.id,Object.freeze(f));};
add({id:'arrival-assembly',name:'Arrival garden atrium',origin:[-115,-35.7,-38],size:[52,7.5,34],deck:2,assembly:true});
for(const a of AREAS)add({...a,parent:['d02-arrival-1','d03-farm-1'].includes(a.id)?'arrival-assembly':null,...(a.id==='d16-voyage-forum-bow'?{bounds:[[-42,-.35,-24.1],[26.1,3.5,24.1]]}:{})});
for(const [i,c] of COMMONS.entries())add({id:'commons-'+(i+1),name:'Neighborhood '+(i+1)+' garden',origin:[c.x,c.y,c.z],size:[c.width,c.height,c.depth],deck:17,mirror:c.z<0,assembly:true,...(i===0?{bounds:[[-22.5,-.35,-31],[22.5,11.35,19]]}:{})});
for(const c of CABINS)add({id:c.id,name:c.id,origin:[c.x,c.y,c.z],size:[c.width,c.height,c.depth],deck:c.deck,yaw:c.z-Math.round(c.z/26)*26<0?Math.PI:0});
add({id:'observation-lounge',name:'Forward observation lounge and ramp',origin:[170,26.3,0],size:[92,10,96],deck:18,bounds:[[-38,-2.31,-41.7],[42.8,7.5,41.7]]});
for(let n=1;n<=10;n++)add({id:'nose-commons-'+n,name:'Nose commons '+n,origin:[186,-39.7+(n+4)*4,0],size:[104,3.5,112],deck:n+5});
for(let d=1;d<=20;d++)add({id:'circulation-'+d,name:'Deck '+d+' fixed circulation',origin:[0,-39.7+(d-1)*4,0],size:[640,4,300],deck:d,fixed:true,lowest:true});
for(let deck=1;deck<=20;deck++)for(const c of TRANSIT_CORES)if(deck<=c.lastDeck)for(const s of [-1,1]){const y=-39.7+(deck-1)*4;add({id:'lift-'+c.id+'-'+s+'-d'+deck,name:'Fixed lift landing',origin:[c.x,y,s*6],size:[3.8,3.5,3.8],deck,fixed:true});add({id:'stairs-'+c.id+'-'+s+'-d'+deck,name:'Fixed stair core',origin:[c.stairX+1,y,s*c.stairZ],size:[7,3.5,5],deck,fixed:true});}
for(let deck=4;deck<=17;deck++)add({id:'service-lift-d'+deck,name:'Fixed service lift',origin:[-156,-39.7+(deck-1)*4,8],size:[4,3.5,4],deck,fixed:true});
for(const a of [{id:'crown',origin:[-247,120.3,0],size:[100,10,40]},{id:'fin',origin:[-247,24.3,0],size:[100,96,30]},{id:'aft-machinery',origin:[-240,-20,0],size:[150,70,300]},{id:'exterior',origin:[0,0,0],size:[640,300,300]}])add({...a,name:a.id,fixed:true,lowest:true});
export const registry=()=>[...entries.values()].map(a=>frame(a.id));
export const v1Frame=id=>{const f=entries.get(id);if(!f)throw new Error('Unknown room '+id);return f;};
export const motionOwner=id=>v1Frame(id).parent||id;
const matrix=f=>new T.Matrix4().makeTranslation(...f.origin).multiply(new T.Matrix4().makeRotationY(f.yaw)).multiply(new T.Matrix4().makeScale(1,1,f.mirror?-1:1));
export function frame(id){const a=v1Frame(id),owner=motionOwner(id),o=overrides.get(owner);if(!o)return a;
 if(owner===id)return {...a,...o};
 const m=matrix({...v1Frame(owner),...o}).multiply(matrix(v1Frame(owner)).invert()).multiply(matrix(a)),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();m.decompose(p,q,s);
 // Read facing from the matrix; decompose puts a reflection in x rather than our local z.
 const f=new T.Vector3(0,0,1).transformDirection(m),mirror=m.determinant()<0;
 return {...a,origin:p.toArray(),yaw:Math.atan2(f.x,f.z)-(mirror?Math.PI:0),mirror};
}
export function toWorld(id,p,{legacy=false}={}){return new T.Vector3(...p).applyMatrix4(matrix(legacy?v1Frame(id):frame(id))).toArray();}
export function toLocal(id,p){return new T.Vector3(...p).applyMatrix4(matrix(frame(id)).invert()).toArray();}
export function yawToWorld(id,yaw){const f=frame(id);return f.yaw+(f.mirror?Math.PI-yaw:yaw);}
export function yawToLocal(id,yaw){const f=frame(id);return f.mirror?Math.PI-(yaw-f.yaw):yaw-f.yaw;}
export function roomAt(p,{legacy=false}={}){let best=null,rank=Infinity;for(const a of entries.values()){
 const f=legacy?a:frame(a.id),[w,h,d]=a.size,lo=a.bounds?.[0]||[-w/2,-.35,-d/2],hi=a.bounds?.[1]||[w/2,h,d/2],dy=p[1]-f.origin[1];if(dy<lo[1]||dy>hi[1])continue;
 const dx=p[0]-f.origin[0],dz=p[2]-f.origin[2],c=Math.cos(f.yaw),s=Math.sin(f.yaw);
 const u=c*dx-s*dz,v=(s*dx+c*dz)*(f.mirror?-1:1);if(u<lo[0]||u>hi[0]||v<lo[2]||v>hi[2])continue;
 const r=(a.lowest?1e12:0)+w*h*d;if(r<rank){best=a.id;rank=r;}}
 return best;
}
export function setFrameOverride(id,{dx=0,dz=0,yawDeg=0,mirror=false}={}){id=motionOwner(id);const a=v1Frame(id);if(a.fixed)throw new Error('Fixed frame '+id);
 if(![dx,dz,yawDeg].every(Number.isFinite))throw new Error('Invalid anchor override');
 overrides.set(id,{origin:[a.origin[0]+dx,a.origin[1],a.origin[2]+dz],yaw:a.yaw+yawDeg*Math.PI/180,mirror:!!a.mirror!==!!mirror});return frame(id);
}
export function clearFrameOverrides(){overrides.clear();}
export const anyFrameOverrides=()=>overrides.size>0;
export const hasFrameOverride=id=>overrides.has(motionOwner(id));
export function deltaMatrix(id){return matrix(frame(id)).multiply(matrix(v1Frame(id)).invert());}
// Exact identity path preserves the accepted v1 transforms and exports, including rounding in old builders.
export function anchoredPoint(id,p){return hasFrameOverride(id)?new T.Vector3(...p).applyMatrix4(deltaMatrix(id)).toArray():[...p];}
export function anchoredDirection(id,p){return hasFrameOverride(id)?new T.Vector3(...p).transformDirection(deltaMatrix(id)).toArray():[...p];}
export function anchoredYaw(id,yaw){return hasFrameOverride(id)?yawToWorld(id,legacyYaw(id,yaw)):yaw;}
function legacyYaw(id,yaw){const a=v1Frame(id);return a.mirror?Math.PI-(yaw-a.yaw):yaw-a.yaw;}
export function deferRoomFrames(value=true){deferred=value;}
export function anchorObject(root,id){v1Frame(id);if(objects.has(root))return root;objects.set(root,{id,applied:false});if(!deferred)resolveObject(root);return root;}
function resolveObject(root){const a=objects.get(root);if(!a||a.applied||!hasFrameOverride(a.id))return;
 root.updateWorldMatrix(true,false);a.base=root.matrixWorld.clone();const m=root.parent?root.parent.matrixWorld.clone().invert():new T.Matrix4();m.multiply(deltaMatrix(a.id)).multiply(root.matrixWorld);m.decompose(root.position,root.quaternion,root.scale);root.updateMatrix();root.updateMatrixWorld(true);a.applied=true;
}
export function anchorCabins(root,number){cabinRoots.set(root,number);return root;}
export function resolveRoomFrames(root){deferred=false;root.updateMatrixWorld(true);root.traverse(o=>resolveObject(o));
 root.traverse(r=>{const number=cabinRoots.get(r);if(!number)return;const sample=CABINS.find(c=>c.neighborhood===10&&c.x>120&&c.z===5.2),list=CABINS.filter(c=>c.neighborhood===number),sampleId=sample.id.replace('N10','N'+String(number).padStart(2,'0'));
  for(const name of ['Sample_cabin_walls','Sample_cabin_fittings']){const o=r.getObjectByName(name);if(o)anchorObject(o,sampleId);}
  const others=list.filter(c=>c.id!==sampleId),m=new T.Matrix4();r.traverse(o=>{if(!o.isInstancedMesh||o.count!==499)return;o.updateWorldMatrix(true,false);const inv=o.matrixWorld.clone().invert();others.forEach((c,i)=>{if(!hasFrameOverride(c.id))return;o.getMatrixAt(i,m);let bases=instanceBases.get(o);if(!bases)instanceBases.set(o,bases=new Map());bases.set(i,o.matrixWorld.clone().multiply(m));m.premultiply(o.matrixWorld).premultiply(deltaMatrix(c.id)).premultiply(inv);o.setMatrixAt(i,m);});o.instanceMatrix.needsUpdate=true;});
 });root.traverse(o=>resolveMerged(o));root.updateMatrixWorld(true);
}
export const objectRoom=o=>{for(let p=o;p;p=p.parent){const a=objects.get(p);if(a)return a.id;}return null;};

export function roomObject(ship,id){id=id.replace(/^Area_/,'');if(/^Fitted_garden_commons_/.test(id))id='commons-'+Number(id.split('_').at(-1));
 if(id==='Hydro_Nip_Lounge')return roomObject(ship,'commons-1')?.getObjectByName(id)||null;
 v1Frame(id);const name=id.startsWith('commons-')?'Fitted_garden_commons_'+String(id.split('-')[1]).padStart(2,'0'):id==='observation-lounge'?'Shared_observation_lounge_and_approach':id.startsWith('nose-commons-')?'Nose_commons_'+String(id.split('-').at(-1)).padStart(2,'0'):'Area_'+id;
 const root=ship.root.getObjectByName(name);if(root&&!objects.has(root))anchorObject(root,id);return root;
}
export function anchoredOffset(id,p){if(!hasFrameOverride(id))return [...p];const m=deltaMatrix(id);m.setPosition(0,0,0);return new T.Vector3(...p).applyMatrix4(m).toArray();}

export function unanchorPoint(id,p){return hasFrameOverride(id)?new T.Vector3(...p).applyMatrix4(deltaMatrix(id).invert()).toArray():[...p];}
export function moverOrientation(id,m){if(hasFrameOverride(id)){const r=deltaMatrix(id);r.setPosition(0,0,0);m.multiply(r);}return m;}

export function instanceRoom(o,i){for(let r=o;r;r=r.parent){const n=cabinRoots.get(r);if(!n)continue;if(o.count!==499)return objectRoom(o);if(!cabinIds.has(n)){const sample=CABINS.find(c=>c.neighborhood===10&&c.x>120&&c.z===5.2).id.replace('N10','N'+String(n).padStart(2,'0'));cabinIds.set(n,CABINS.filter(c=>c.neighborhood===n&&c.id!==sample).map(c=>c.id));}return cabinIds.get(n)[i];}return objectRoom(o);}
export function baselineMatrix(o,i=null){const saved=i===null?null:instanceBases.get(o)?.get(i);if(saved)return saved;
 const chain=[];let result=null;for(let p=o;p;p=p.parent){const a=objects.get(p);if(a?.base){result=a.base.clone();for(let k=chain.length-1;k>=0;k--)result.multiply(chain[k]);break;}chain.push(p.matrix);}
 result||=o.matrixWorld;if(i!==null){const m=new T.Matrix4();o.getMatrixAt(i,m);result=result.clone().multiply(m);}return result;
}

export function anchorMerged(root,owners){for(const id of owners)if(id)v1Frame(id);mergedObjects.set(root,{owners,applied:false});return root;}
function resolveMerged(o){const a=mergedObjects.get(o);if(!a||a.applied||!a.owners.some(id=>id&&hasFrameOverride(id)))return;
 o.updateWorldMatrix(true,false);o.geometry=o.geometry.clone();const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,v=new T.Vector3(),inv=o.matrixWorld.clone().invert();
 a.owners.forEach((id,i)=>{if(!id||!hasFrameOverride(id))return;const m=inv.clone().multiply(deltaMatrix(id)).multiply(o.matrixWorld),normal=new T.Matrix3().getNormalMatrix(m);
  for(let k=i*24;k<(i+1)*24;k++){v.fromBufferAttribute(p,k).applyMatrix4(m);p.setXYZ(k,v.x,v.y,v.z);if(n){v.fromBufferAttribute(n,k).applyNormalMatrix(normal);n.setXYZ(k,v.x,v.y,v.z);}}
  if(m.determinant()<0&&g.index)for(let k=i*36;k<(i+1)*36;k+=3){const b=g.index.getX(k+1);g.index.setX(k+1,g.index.getX(k+2));g.index.setX(k+2,b);}
 });g.computeBoundingBox();g.computeBoundingSphere();a.applied=true;
}
