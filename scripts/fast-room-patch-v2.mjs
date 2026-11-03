import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {baseline,output} from './fast-state-v2.mjs';
import {PreparedPatch,preparedManifest,preparedArrayReader,hash} from './prepared-patch-v2.mjs';
import {patchModels} from './patch-models-v2.mjs';
import {cachedRoom} from './fast-room-cache-v2.mjs';
import {removeOwnedSpans} from './patch-owned-spans-v2.mjs';

function ownedPaths(nodes){
 const byId=new Map(nodes.map(n=>[n.uuid,n])),counts=new Map(),segments=new Map(),paths=new Map();
 for(const n of nodes){const key=n.parent+'|'+n.name,index=counts.get(key)||0;counts.set(key,index+1);segments.set(n.uuid,n.name+'#'+index);}
 const path=n=>{if(paths.has(n.uuid))return paths.get(n.uuid);let value=null;if(n.geometry===undefined&&(n.name?.startsWith('Area_')||n.name?.startsWith('V2_shell_')))value=n.name;else{const parent=byId.get(n.parent),prefix=parent&&path(parent);if(prefix)value=prefix+'/'+segments.get(n.uuid);}paths.set(n.uuid,value);return value;};
 return new Map(nodes.map(n=>[path(n),n]).filter(([key])=>key));
}
function remapNodes(value,ids){
 if(!value||typeof value!=='object')return value;if(Array.isArray(value))return value.map(v=>remapNodes(v,ids));
 return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,(key==='$node'||key==='source')&&ids.has(v)?ids.get(v):remapNodes(v,ids)]));
}

export async function patchRooms(plan,timer,{baseDirectory=baseline,destination=output}={}){
 const rooms=new Set(plan.rooms),base=baseDirectory+'/prepared-walk',m=await preparedManifest(base),read=preparedArrayReader(m,base),patch=new PreparedPatch(m);
 const legacy=new Set(plan.legacyRooms||[]),shells=new Set(plan.shellRooms||[]),patchOwners=new Set([...legacy].map(id=>id+'|source').concat([...shells].map(id=>id+'|shell'))),cache=[];
 if(patchOwners.size&&m.roomOwnershipVersion!==1)throw Error('Legacy room replacement needs one clean authoring run with room-owner spans; run npm run build once outside the sandbox');
 const compiled=await timer.stage('author or reuse changed rooms',async()=>{const rows=[];for(const id of plan.rooms){const value=await cachedRoom({id,legacy:legacy.has(id),shell:shells.has(id),key:JSON.stringify([plan.basePrepared,plan.patchProducer,id,plan.roomKeys?.[id],legacy.has(id),shells.has(id)])});rows.push(value);cache.push({room:id,hit:value.hit});}return rows;});
 const removedSpans=await timer.stage('remove owned render and collision spans',()=>removeOwnedSpans(m,patch,read,patchOwners));
 // Preserve required anchor groups, but discard their old mesh descendants.
 const originalPaths=ownedPaths(m.source.nodes),byId=new Map(m.source.nodes.map(n=>[n.uuid,n])),ownerOf=n=>{for(let p=n;p;p=byId.get(p.parent)){if(p.geometry===undefined&&p.name?.startsWith('Area_'))return p.name.slice(5)+'|source';if(p.geometry===undefined&&p.name?.startsWith('V2_shell_'))return p.name.slice(9)+'|shell';}return null;};
 // Keep group identities used by ship.serviceDecks and room anchors. Replaced
 // meshes are removed; matching regenerated nodes receive the original IDs.
 m.source.nodes=m.source.nodes.filter(n=>n.geometry===undefined||!patchOwners.has(ownerOf(n)));
 // Meshes with unchanged text stay in the original render bands. Only the
 // selected owners are removed from mixed batches; neighbours keep their data.
 const removed=new Set();let keptInstances=0,removedInstances=0;
 for(const node of m.source.nodes){const runs=node.userData?.phase4&&node.userData.ownerRuns;if(!runs?.some(r=>rooms.has(r.room)||rooms.has(r.component)))continue;
  const keep=[];for(const r of runs)if(!rooms.has(r.room)&&!rooms.has(r.component))for(let i=r.start;i<r.start+r.count;i++)keep.push(i);
  removedInstances+=runs.reduce((n,r)=>n+r.count,0)-keep.length;
  if(!keep.length){removed.add(node.uuid);continue;}
  for(const field of ['instanceMatrix','instanceColor'])if(node[field]!=null){const original=await read(node[field]),stride=field==='instanceMatrix'?16:3,next=new original.constructor(keep.length*stride);keep.forEach((i,k)=>next.set(original.subarray(i*stride,(i+1)*stride),k*stride));node[field]=patch.array(next);}
  node.count=keep.length;keptInstances+=keep.length;let offset=0;node.userData.ownerRuns=runs.filter(r=>!rooms.has(r.room)&&!rooms.has(r.component)).map(r=>{const value={...r,start:offset};offset+=r.count;return value;});node.userData.roomOwners=[...new Set(node.userData.ownerRuns.map(r=>r.room))];
  // The original bounds are conservative after removing instances.
 }
 m.source.nodes=m.source.nodes.filter(n=>!removed.has(n.uuid));
 const filterGroups=col=>{for(const group of col.groups){const keep=group.items.filter(i=>!rooms.has(i.owner)),ids=new Map(keep.map((item,i)=>[item.i,i]));group.items=keep.map((item,i)=>({...item,i}));group.cells=group.cells.map(([cell,list])=>[cell,list.filter(i=>ids.has(i)).map(i=>ids.get(i))]).filter(([,list])=>list.length);}col.groups=col.groups.filter(g=>g.items.length);if(col.ground)filterGroups(col.ground);};filterGroups(m.colliders);
 let changedCollisionGroups=0,changedGroundGroups=0;
 const seated=new Set(m.seats.map(i=>m.rest[i]));m.rest=m.rest.filter(s=>!((s.phase4&&rooms.has(s.room))||legacy.has(s.room)));m.seats=m.rest.map((s,i)=>seated.has(s)?i:null).filter(i=>i!==null);
 for(const row of compiled){
  const firstGeometry=m.geometries.length,relocate=patch.absorb(row.writer),nodeIds=new Map();
  for(const graph of row.graphs){
   const updated=relocate.graph(graph),parent=m.source.nodes.find(n=>n.name===graph.nodes[0].name),paths=ownedPaths(updated.nodes);
   for(const [key,node]of paths){const old=originalPaths.get(key);if(old)nodeIds.set(node.uuid,old.uuid);}
   if(parent)nodeIds.set(updated.root,parent.uuid);
   const structure=m.source.nodes.find(n=>n.name==='V2_structure');assert(structure,'Missing baseline structure root');
   for(const node of updated.nodes){const root=node.uuid===updated.root;node.uuid=nodeIds.get(node.uuid)||node.uuid;node.parent=root?(parent?.parent||structure.uuid):(nodeIds.get(node.parent)||node.parent);node.userData=remapNodes(node.userData,nodeIds);const existing=m.source.nodes.find(n=>n.uuid===node.uuid);if(existing)Object.assign(existing,node);else m.source.nodes.push(node);}
  }
  for(let i=firstGeometry;i<m.geometries.length;i++)m.geometries[i].userData=remapNodes(m.geometries[i].userData,nodeIds);
  for(const [key,graph]of row.bands||[]){const updated=relocate.graph(graph),existing=m.bands.find(([id])=>String(id)===String(key));if(existing){for(const node of updated.nodes.slice(1)){if(node.parent===updated.root)node.parent=existing[1].root;existing[1].nodes.push(node);}}else m.bands.push([key,updated]);}
  const extra=relocate.colliders(row.collision),extraGround=relocate.colliders(row.groundCollision);
  for(const g of [...extra.groups,...extraGround.groups])g.name='fast-'+g.name+'-'+hash(Buffer.from(row.id)).slice(0,8);
  assert(!extra.bands.length&&!extraGround.bands.length,'Room cache must use independent collision groups');
  m.colliders.groups.push(...extra.groups);m.colliders.ground.groups.push(...extraGround.groups);changedCollisionGroups+=extra.groups.length;changedGroundGroups+=extraGround.groups.length;
  for(const [i,rest]of row.rests.entries()){if(row.seatIndices.includes(i))m.seats.push(m.rest.length);m.rest.push(remapNodes(relocate.value(rest),nodeIds));}
 }
 const models=await timer.stage('patch affected models',()=>patchModels({baseline:baseDirectory,destination,rooms:plan.rooms,legacyRooms:[...legacy],shellRooms:[...shells],encodedRooms:compiled.map(r=>({id:r.id,bytes:r.model}))}));
 const original=JSON.parse(await fs.readFile(base+'/integrity.json','utf8')),sourceInputs={...original.sourceInputs,sources:plan.identity};
 const prepared=await timer.stage('encode changed parts',()=>patch.save(destination+'/prepared-walk',base,sourceInputs,{rooms:plan.rooms,decks:plan.decks,base:original.sha256}));
 return {models,prepared,removedInstances,keptInstances,changedCollisionGroups,changedGroundGroups,cache,removedSpans};
}
