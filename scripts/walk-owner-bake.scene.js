// The owner bake's view of a built walk scene (bundled into the bake page by scripts/walk-owner-bake.mjs): the occluders
// the proof may use, with the condition each depends on, and the parts it may hide, with their boxes and identities.
import * as T from 'three';
import {ownerPath,ownerPrint} from '../src/v2/owner-hiding.js';

// Parts that move, ride or animate: never hidden, never occluders.
export const MOVING=/pool_ball|door|drape|curtain|yarn|ball_|swing|fan_|rotor|wheel|car_|lift|gate|shutter/i;
const LIFT=/^Walk_lift_|^Lift_|^Car_/;
// Plain opaque materials only: anything transparent, cut out, refracting or shaded by custom code may let sight through.
const plainOpaque=m=>!!m&&m.visible!==false&&!m.transparent&&(m.opacity??1)>=1&&!(m.alphaTest>0)&&!m.alphaMap&&!(m.transmission>0)&&m.colorWrite!==false&&m.depthWrite!==false&&m.depthTest!==false&&!m.wireframe&&!m.isShaderMaterial&&!m.isRawShaderMaterial
 &&(m.isMeshStandardMaterial||m.isMeshBasicMaterial||m.isMeshLambertMaterial||m.isMeshPhongMaterial||m.isMeshPhysicalMaterial||m.isMeshToonMaterial||m.isMeshMatcapMaterial);
const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const moving=o=>{for(let q=o;q;q=q.parent)if(MOVING.test(q.name||''))return true;return false;};

/** Occluder soup: {positions (Float32Array, 9 per triangle), sides, conds (indices into `conditions`), conditions
 * ([path, print] of what must be drawn: a merge source's band group, or the mesh itself), bandConds (the band ones),
 * mergeRoot (the merged pieces' group, which every band condition also needs), stats}. Merged deck meshes
 * contribute through their sources, which keep their arrays in a bake page (?ownerBake). */
export function collectOccluders(scene){
 const byUuid=new Map();scene.traverse(q=>byUuid.set(q.uuid,q));
 const conditions=[],index=new Map(),condOf=o=>{let i=index.get(o);if(i===undefined){i=conditions.length;conditions.push([ownerPath(o,scene),ownerPrint(o)]);index.set(o,i);}return i;};
 const bandOf=q=>{for(let p=q.parent;p;p=p.parent){if(p.userData?.mergedSources)return p.parent;if(/^Walk_band_\d+$/.test(p.name||''))return p;}return null;};
 const positions=[],sides=[],conds=[],bandConds=new Set(),stats={meshes:0,sources:0,triangles:0,skippedMaterials:0,noArrays:0};let mergeRoot=null;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 const add=(o,cond)=>{const g=o.geometry,p=g?.attributes?.position,ix=g?.index;if(!p?.array||ix&&!ix.array){stats.noArrays++;return;}
  const mats=[o.material].flat(),flip=o.matrixWorld.determinant()<0,total=ix?ix.count:p.count,dr=g.drawRange,end=Math.min(total,dr.start+dr.count);
  // three ignores geometry groups unless the material is an array.
  const groups=Array.isArray(o.material)&&g.groups?.length?g.groups:[{start:0,count:total,materialIndex:0}];
  for(const gr of groups){const m=mats[gr.materialIndex??0];if(!plainOpaque(m)){stats.skippedMaterials++;continue;}const side=m.side===T.DoubleSide?2:m.side===T.BackSide?1:0;
   for(let i=Math.max(gr.start,dr.start);i+2<Math.min(gr.start+gr.count,end);i+=3){
    a.fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(o.matrixWorld);b.fromBufferAttribute(p,ix?ix.getX(i+1):i+1).applyMatrix4(o.matrixWorld);c.fromBufferAttribute(p,ix?ix.getX(i+2):i+2).applyMatrix4(o.matrixWorld);
    // Stored counter-clockwise as drawn: a mirrored object's front face flips with its determinant.
    const [B,C]=flip?[c,b]:[b,c];positions.push(a.x,a.y,a.z,B.x,B.y,B.z,C.x,C.y,C.z);sides.push(side);conds.push(cond);stats.triangles++;}}};
 scene.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||o.isBatchedMesh||moving(o))return;
  if(o.userData.sources?.length){if(o.parent&&mergeRoot===null)mergeRoot=condOf(o.parent);for(const id of o.userData.sources){const q=byUuid.get(id),band=q&&bandOf(q);if(!band)continue;q.updateWorldMatrix(true,false);const k=condOf(band);bandConds.add(k);add(q,k);stats.sources++;}return;}
  if(o.userData.bandMerged||!shown(o))return;add(o,condOf(o));stats.meshes++;});
 return {positions:Float32Array.from(positions),sides:Uint8Array.from(sides),conds:Uint32Array.from(conds),conditions,bandConds,mergeRoot,stats};
}

const CLUSTER=4;
// A big mesh's triangles grouped into 4 m clusters, each with its own box (a far wall's box would cover the whole deck).
function clusters(o,box){
 const g=o.geometry,p=g.attributes.position,ix=g.index,s=box.getSize(new T.Vector3());
 if(Math.max(s.x,s.y,s.z)<=CLUSTER*1.5||!p?.array||ix&&!ix.array)return [box];
 const m=new Map(),v=[new T.Vector3(),new T.Vector3(),new T.Vector3()],n=(ix?ix.count:p.count)/3;
 for(let f=0;f<n;f++){for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,ix?ix.getX(f*3+k):f*3+k).applyMatrix4(o.matrixWorld);
  const key=[0,1,2].map(a=>Math.floor((v[0].getComponent(a)+v[1].getComponent(a)+v[2].getComponent(a))/3/CLUSTER)).join(',');let bb=m.get(key);if(!bb)m.set(key,bb=new T.Box3());bb.expandByPoint(v[0]).expandByPoint(v[1]).expandByPoint(v[2]);}
 return [...m.values()];
}

/** Parts the bake may hide, grouped by owner (an instanced or merged mesh is its own owner; any other part belongs to
 * its feature root): [{root, parts:[{o, path, print, boxes, slots?}]}]. A cabin part (re-packed from userData.near.all)
 * lists its slots: [{id, centre, box}]. Left out: movers, lift parts, shadow casters, see-through parts, other instanced
 * meshes (their shown instances change and their full list is not exposed). */
export function collectTargets(scene){
 const isRoot=q=>!q.parent||q.parent===scene||/^Walk_band_\d+$|live_source|^V2_live/i.test(q.parent.name||'');
 const ownerOf=o=>{if(o.isInstancedMesh||/_merged_|^Walk_merged_/.test(o.name||''))return o;let q=o;while(!isRoot(q))q=q.parent;return q;};
 const groups=new Map(),byUuid=new Map();scene.traverse(q=>byUuid.set(q.uuid,q));
 const boxesOf=o=>{const g=o.geometry;if(!g.boundingBox){if(!g.attributes.position?.array)return null;g.computeBoundingBox();}
  if(o.userData.sources?.length)return o.userData.sources.flatMap(id=>{const q=byUuid.get(id),qg=q?.geometry;if(!qg)return [null];if(!qg.boundingBox){if(!qg.attributes.position?.array)return [null];qg.computeBoundingBox();}q.updateWorldMatrix(true,false);return clusters(q,qg.boundingBox.clone().applyMatrix4(q.matrixWorld));});
  return clusters(o,g.boundingBox.clone().applyMatrix4(o.matrixWorld));};
 const visit=(o,visible)=>{visible=visible&&o.visible;if(!visible)return;
  if(o.isMesh&&!o.isSkinnedMesh&&!o.isBatchedMesh&&!o.castShadow&&[o.material].flat().every(m=>m&&!m.transparent&&m.visible!==false)){
   const root=ownerOf(o);let lifted=false;for(let q=o;q;q=q.parent)if(LIFT.test(q.name||'')){lifted=true;break;}
   if(!lifted&&!MOVING.test(o.name||'')){let part=null;
    if(o.isInstancedMesh){const near=o.userData.near;if(near&&o.userData.cabinIds&&!o.userData.boat){const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();
      part={o,slots:near.all.map((m,i)=>({id:o.userData.cabinIds[i],centre:near.centres[i],box:g.boundingBox.clone().applyMatrix4(m.clone().premultiply(o.matrixWorld))}))};}}
    else{const boxes=boxesOf(o);if(boxes&&!boxes.includes(null))part={o,boxes};}
    if(part){part.path=ownerPath(o,scene);part.print=ownerPrint(o);if(part.print){let e=groups.get(root);if(!e)groups.set(root,e={root,parts:[]});e.parts.push(part);}}}}
  for(const c of o.children)visit(c,visible);};
 visit(scene,true);return [...groups.values()];
}
