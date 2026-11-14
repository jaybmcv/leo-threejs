import * as T from 'three';

// Warm prepared ships still carry the retired rectangular-gallery lights. Their
// source names and exact lounge-frame bounds keep every other fitting intact.
export function retirePreparedLoungeLights(ship){
 const lounge=ship.root.getObjectByName('Fitted_garden_commons_01');if(!lounge)return 0;
 lounge.updateWorldMatrix(true,false);const inverse=lounge.matrixWorld.clone().invert(),point=new T.Vector3();let removed=0;
 const inside=(name,p)=>[27.99,31.99].some(y=>Math.abs(p.y-y)<.06)&&(name==='Gallery_end_light'?Math.abs(p.x-111.7)<.06&&p.z>11.94&&p.z<41.06:Math.abs(p.z-42.25)<.06&&p.x>112.94&&p.x<153.06);
 for(const group of ship.v2PreparedBake.bands.values()){
  group.updateWorldMatrix(true,true);const meshes=[];group.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)meshes.push(o);});
  for(const o of meshes){
   const g=o.geometry,ranges=g.userData.preparedRanges||[],targets=ranges.filter(r=>r.name==='Gallery_end_light'||r.name==='Gallery_warm_light');if(!targets.length)continue;
   const p=g.attributes.position,index=g.index,matrix=inverse.clone().multiply(o.matrixWorld),drop=new Set();
   for(const r of targets)for(let face=r.start;face<r.start+r.count;face++)if([0,1,2].every(k=>inside(r.name,point.fromBufferAttribute(p,index?index.getX(face*3+k):face*3+k).applyMatrix4(matrix))))drop.add(face);
   if(!drop.size)continue;removed+=drop.size;
   const count=(index?.count??p.count)/3,kept=[],prefix=new Uint32Array(count+1);
   for(let face=0;face<count;face++){prefix[face+1]=prefix[face]+(drop.has(face)?1:0);if(!drop.has(face))for(let k=0;k<3;k++)kept.push(index?index.getX(face*3+k):face*3+k);}
   if(!kept.length){o.removeFromParent();continue;}
   const next=g.clone();next.setIndex(kept);next.clearGroups();
   for(const r of g.groups){const start=r.start/3,end=(r.start+r.count)/3,n=r.count-(prefix[end]-prefix[start])*3;if(n)next.addGroup(r.start-prefix[start]*3,n,r.materialIndex);}
   next.userData.preparedRanges=ranges.map(r=>({...r,start:r.start-prefix[r.start],count:r.count-prefix[r.start+r.count]+prefix[r.start]})).filter(r=>r.count);
   next.computeBoundingBox();next.computeBoundingSphere();o.geometry=next;
  }
 }
 return removed;
}

// Only the original, baked render contents are fixed. Band parents receive live activities later.
const pending=new WeakMap(),SETTLED=()=>{};
export function rememberPreparedStatic(ship){
 ship.v2RetiredLoungeLights=retirePreparedLoungeLights(ship);
 const fixed=new Set();for(const group of ship.v2PreparedBake.bands.values())for(const child of group.children)child.traverse(o=>fixed.add(o));
 pending.set(ship,fixed);
}
export function settlePreparedStatic(ship){
 const fixed=pending.get(ship);if(!fixed)return;
 const ids=new Set([...fixed].map(o=>o.uuid));
 // Low-deck batching runs after capture. Its new render-only meshes replace only these fixed sources.
 for(const group of ship.v2PreparedBake.bands.values())group.traverse(o=>{if(o.userData.renderOnly&&o.userData.sources?.length&&o.userData.sources.every(id=>ids.has(id)))fixed.add(o);});
 // Cabin shell instances never enter the proximity reordering path. Doors and every transparent
 // shell stay live for cabinPrivacy; P4 batches and all other source objects remain live as well.
 ship.liveDraws?.traverse(o=>{if(o.isInstancedMesh&&o.userData.cabinWalls&&!o.userData.phase4&&!o.userData.near&&!/^Cabin_v2_(door|ensuite-door)/.test(o.name)&&![].concat(o.material||[]).some(m=>m.transparent))fixed.add(o);});
 const roots=[...ship.v2PreparedBake.bands.values(),...(ship.liveDraws?[ship.liveDraws]:[])];
 // Resolve the final parent transforms, including matrixAutoUpdate=false objects, before pruning.
 for(const root of roots)root.updateWorldMatrix(true,true);
 const settle=(o,live=false)=>{live||=!!o.userData.keepLive;let still=fixed.has(o)&&!live&&!o.isSkinnedMesh;for(const c of o.children)if(!settle(c,live))still=false;if(still)o.updateMatrixWorld=SETTLED;return still;};
 for(const root of roots)settle(root);pending.delete(ship);
 // The branches that stay live are mostly hidden at any moment (culled instances, other decks' bands). A hidden branch
 // skips its matrix update; its first update once shown again is forced, so a parent that moved meanwhile is caught up
 // before it draws. Skinned figures and their bones keep the normal update.
 // A shown node whose position, rotation and scale are unchanged, with no forced or flagged update, keeps last frame's
 // matrices: three would recompose and remultiply the same values. Three also forces the whole subtree of every
 // auto-updating node (the scene and band groups included), so an unchanged node forces only the children that cannot
 // check for themselves: late additions and objects with hand-set matrices are forced exactly as three would. A node
 // moved to another parent recomputes.
 // Such an unchanged node visits only the children that are not settled, from a list kept per node and redone when a
 // child is added or removed (settling happens once, before this, so a child never becomes settled later), and marks
 // a hidden checking child stale itself rather than calling it: from the open atrium about 7,000 of the ~8,800 calls a
 // frame went to settled nodes, which do nothing, or hidden ones, which only note that they are stale.
 const skip=o=>{if(o.updateMatrixWorld===SETTLED||o.updateMatrixWorld.liveWhenShown||o.isBone||o.isSkinnedMesh)return;const base=o.updateMatrixWorld,last=new Float64Array(10);let known=false,parent=null,kids=null;
  const recount=()=>{kids=null;};o.addEventListener('childadded',recount);o.addEventListener('childremoved',recount);
  const update=Object.assign(function(force){if(!this.visible){update.stale=true;return;}const catchUp=update.stale;update.stale=false;
   if(this.matrixAutoUpdate&&this.pivot==null){const p=this.position,q=this.quaternion,k=this.scale;
    if(known&&!force&&!catchUp&&!this.matrixWorldNeedsUpdate&&this.parent===parent&&p.x===last[0]&&p.y===last[1]&&p.z===last[2]&&q._x===last[3]&&q._y===last[4]&&q._z===last[5]&&q._w===last[6]&&k.x===last[7]&&k.y===last[8]&&k.z===last[9]){
     const list=kids??=this.children.filter(c=>c.updateMatrixWorld!==SETTLED);
     for(let i=0;i<list.length;i++){const c=list[i],u=c.updateMatrixWorld;
      if(!u.liveWhenShown)u.call(c,true);else if(!c.visible)u.stale=true;else u.call(c,!c.matrixAutoUpdate);}
     return;}
    last[0]=p.x;last[1]=p.y;last[2]=p.z;last[3]=q._x;last[4]=q._y;last[5]=q._z;last[6]=q._w;last[7]=k.x;last[8]=k.y;last[9]=k.z;parent=this.parent;known=true;}
   base.call(this,force||catchUp);},{liveWhenShown:true,stale:false});
  o.updateMatrixWorld=update;};
 for(const root of roots)root.traverse(skip);
 // The scene would force every band each frame. It and everything already in it (lifts, the walker, the facade) get the
 // same check: it compares the node's own transform, so moving objects still update.
 const scene=roots[0]?.parent;if(scene?.isScene)scene.traverse(skip);
}
