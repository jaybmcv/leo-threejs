// Only the original, baked render contents are fixed. Band parents receive live activities later.
const pending=new WeakMap(),SETTLED=()=>{};
export function rememberPreparedStatic(ship){
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
 // check for themselves: late additions and objects with hand-set matrices are forced exactly as three would.
 const checks=c=>c.updateMatrixWorld===SETTLED||c.updateMatrixWorld.liveWhenShown&&c.matrixAutoUpdate;
 const skip=o=>{if(o.updateMatrixWorld===SETTLED||o.updateMatrixWorld.liveWhenShown||o.isBone||o.isSkinnedMesh)return;const base=o.updateMatrixWorld,last=new Float64Array(10);let stale=false,known=false;
  o.updateMatrixWorld=Object.assign(function(force){if(!this.visible){stale=true;return;}const catchUp=stale;stale=false;
   if(this.matrixAutoUpdate&&this.pivot==null){const p=this.position,q=this.quaternion,k=this.scale;
    if(known&&!force&&!catchUp&&!this.matrixWorldNeedsUpdate&&p.x===last[0]&&p.y===last[1]&&p.z===last[2]&&q._x===last[3]&&q._y===last[4]&&q._z===last[5]&&q._w===last[6]&&k.x===last[7]&&k.y===last[8]&&k.z===last[9]){
     for(const c of this.children)c.updateMatrixWorld(!checks(c));return;}
    last[0]=p.x;last[1]=p.y;last[2]=p.z;last[3]=q._x;last[4]=q._y;last[5]=q._z;last[6]=q._w;last[7]=k.x;last[8]=k.y;last[9]=k.z;known=true;}
   base.call(this,force||catchUp);},{liveWhenShown:true});};
 for(const root of roots)root.traverse(skip);
 // The scene would force every band each frame. It and everything already in it (lifts, the walker, the facade) get the
 // same check: it compares the node's own transform, so moving objects still update.
 const scene=roots[0]?.parent;if(scene?.isScene)scene.traverse(skip);
}
