import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {cutChartMany} from './hull-prototypes.js';
import {attachEnvelopeOwners} from '../plan/envelope-mesh-v2.js';

// Open the approved upper Forum strip in the owned hull-ceiling pieces too.
// Rebuild each owner/finish range so the cut keeps the normal ownership audits intact.
export function openForumUpperCeiling(ship,layout){
 const room=layout.rooms.find(r=>r.id==='d16-voyage-forum-bow'),extension=room?.ceilingExtension;
 if(!extension)return;
 const xs=extension.polygon.map(p=>p[0]),zs=extension.polygon.map(p=>p[1]);
 const cut={p:{chart:{origin:[0,0,0],u:[1,0,0],v:[0,0,1]}},rect:[Math.min(...xs),Math.max(...xs),extension.y-.3,extension.y+.3],v0:Math.min(...zs),v1:Math.max(...zs),ignoreOwner:true};
 const structure=ship.inside.getObjectByName('V2_structure'),proof=[];
 structure.updateWorldMatrix(true,true);
 for(const mesh of structure.children){
  if(!mesh.isMesh||mesh.name!=='V2_outer_room_ceiling'||!mesh.userData.ownerRanges?.some(r=>r.room===room.id))continue;
  const old=mesh.geometry,source=old.index?old.toNonIndexed():old,parts=[],ranges=[],finishes=[];let start=0;
  for(const range of mesh.userData.ownerRanges){
   const g=new T.BufferGeometry();
   for(const[name,a]of Object.entries(source.attributes)){
    if(name.startsWith('_leo_'))continue;
    const data=new a.array.constructor(a.array.slice(range.start*a.itemSize,(range.start+range.count)*a.itemSize));
    g.setAttribute(name,new T.BufferAttribute(data,a.itemSize,a.normalized));
   }
   const part=new T.Mesh(g,mesh.material);part.matrixWorld.copy(mesh.matrixWorld);
   const before=g.attributes.position.count;
   if(range.room===room.id)cutChartMany(part,[cut]);
   const count=part.geometry.attributes.position.count;
   if(range.room===room.id)proof.push({component:range.component,before:before/3,after:count/3});
   if(count){parts.push(part.geometry);ranges.push({...range,start,count});const finish=old.userData.finishParts?.find(p=>p.start===range.start&&p.count===range.count);finishes.push({...finish,name:finish?.name||'V2_hull_room_ceiling',room:range.room,component:range.component,start,count});start+=count;}
   if(part.geometry!==g)g.dispose();
  }
  const merged=mergeGeometries(parts);merged.userData.finishParts=finishes;mesh.geometry=merged;mesh.userData.ownerRanges=ranges;mesh.userData.roomOwners=[...new Set(ranges.map(r=>r.room))];attachEnvelopeOwners(mesh,ranges);for(const p of parts)p.dispose();if(source!==old)source.dispose();old.dispose();
 }
 structure.userData.launchEForumCeiling=proof;
}
