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
 const skip=o=>{if(o.updateMatrixWorld===SETTLED||o.isBone||o.isSkinnedMesh)return;const base=o.updateMatrixWorld;let stale=false;
  o.updateMatrixWorld=Object.assign(function(force){if(!this.visible){stale=true;return;}const catchUp=stale;stale=false;base.call(this,force||catchUp);},{liveWhenShown:true});};
 for(const root of roots)root.traverse(skip);
}
