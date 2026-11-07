import defaultOverrides from '../plan/room-fitout-overrides-v2.json' with {type:'json'};

// Source furniture moves and removals apply before geometry is baked.
export function moveRoomFitoutMeshes(source,id,overrides=defaultOverrides){
 for(const move of overrides[id]?.moveMeshes||[]){
  if(!Array.isArray(move.names)||!Array.isArray(move.by)||move.by.length!==3||!move.by.every(Number.isFinite))throw Error('Invalid source furniture move in '+id);
  source.traverse(o=>{if(o.isMesh&&move.names.includes(o.name)){if(o.userData.v2FitoutMoved)return;move.by.forEach((v,i)=>o.position.setComponent(i,o.position.getComponent(i)+v));o.userData.v2FitoutMoved=true;}});
 }
 for(const removal of overrides[id]?.removeMeshes||[]){
  if(!Array.isArray(removal.names)||!removal.names.length||new Set(removal.names).size!==removal.names.length||!Array.isArray(removal.near)||removal.near.length!==3||!removal.near.every(Number.isFinite)||!Number.isFinite(removal.radius)||removal.radius<=0)throw Error('Invalid source furniture removal in '+id);
  const key=removal.names.join('|')+'@'+removal.near.join(','),applied=source.userData.v2FitoutRemovals||(source.userData.v2FitoutRemovals=[]);if(applied.includes(key))continue;
  const found=[];source.traverse(o=>{if(o.isMesh&&removal.names.includes(o.name)&&Math.hypot(o.position.x-removal.near[0],o.position.y-removal.near[1],o.position.z-removal.near[2])<=removal.radius)found.push(o);});
  if(found.length!==removal.names.length)throw Error('Expected '+removal.names.length+' source furniture meshes for removal in '+id+', found '+found.length);
  for(const o of found){o.removeFromParent();o.geometry.dispose();}applied.push(key);
 }
}

// A small room edit is data shared by the clean build and the patch builder.
// Added parts use metres in the room's fitting frame; replacements retain the
// original placement unless explicitly changed. Collision uses the same mesh.
export function applyRoomFitoutOverrides(data,layout,overrides=defaultOverrides){
 const materials=new Set(['resident','oak','cream','teal','sage','clay','navy','metal','orange','green','light','screen','water','glass','red','alarm']);
 const matches=(part,filter)=>Object.entries(filter).every(([key,value])=>part[key]===value);
 const check=part=>{if(!part.part||!Array.isArray(part.size)||part.size.length!==3||!part.size.every(n=>Number.isFinite(n)&&n>0)||!Array.isArray(part.at)||part.at.length!==3||!part.at.every(Number.isFinite)||!materials.has(part.mat))throw Error('Invalid room fitout part in '+part.room);return part;};
 for(const [id,change]of Object.entries(overrides)){
  const craft=layout.shuttles?.find(s=>s.id===id),room=craft||layout.rooms.find(r=>r.id===id&&!r.aggregate);if(!room)throw Error('Unknown room fitout override '+id);
  if(!change.add&&!change.replace&&!change.remove&&!change.rests)continue;
  const owner=craft?craft.roomId:id;
  const support=p=>/seat_cushion|mattress|lounger_cushion/.test(p.part),needsAnchors=()=>{if(!Array.isArray(change.rests))throw Error('Seat/bed geometry changed in '+id+'; supply the complete room rests array (or [] when removing all seats)');};
  if(craft&&(change.replace?.length||change.remove?.length||change.rests||(change.add||[]).some(support)))throw Error('Escape craft overrides support added non-seat fittings only');
  for(const edit of change.replace||[]){if(!edit.match||!edit.set)throw Error('Room replacement needs match and set');let count=0;data.parts=data.parts.map(p=>{if(p.room!==id||!matches(p,edit.match))return p;count++;if(support(p)&&Object.keys(edit.set).some(k=>k!=='mat'))needsAnchors();return check({...p,...edit.set,room:id,deck:room.deck});});if(!count)throw Error('No matching room part for '+id);}
  for(const filter of change.remove||[])data.parts=data.parts.filter(p=>{if(p.room!==id||!matches(p,filter))return true;if(support(p))needsAnchors();return false;});
  const origin=room.fittingFrame?.origin||room.frame?.origin||[room.x,room.y,room.z],yaw=room.fittingFrame?.yaw??room.frame?.yaw??room.yaw??0,c=Math.cos(yaw),s=Math.sin(yaw),point=([x,y,z])=>[origin[0]+c*x+s*z,origin[1]+y,origin[2]-s*x+c*z];
  for(const part of change.add||[])if(support(part))needsAnchors();
  for(const part of change.add||[])data.parts.push(check({...part,at:point(part.at||[]),yaw:yaw+(part.yaw||0),mat:part.mat||'oak',room:owner,deck:room.deck,...(craft?{component:id}:{})}));
  if(change.rests){data.rests=data.rests.filter(r=>r.room!==id);change.rests.forEach((rest,i)=>{const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite),direction=v=>vector(v)&&Math.hypot(...v)>0,rotate=([x,y,z])=>[c*x+s*z,y,-s*x+c*z];if(!['sit','lie'].includes(rest.kind)||!vector(rest.point)||rest.facing!==undefined&&!direction(rest.facing)||rest.head!==undefined&&!direction(rest.head)||rest.kind==='lie'&&!direction(rest.head))throw Error('Invalid rest anchor in '+id+'; lying anchors need a nonzero head direction');const at=point(rest.point),f=rest.facing||[0,0,1];data.rests.push({...rest,id:rest.id||'fitout-'+id+'-'+i,room:id,point:at,height:at[1],facing:rotate(f),...(rest.head?{head:rotate(rest.head)}:{}),instanced:true,phase4:true});});}
  if(!data.rooms.some(r=>r.id===id))data.rooms.push(room);
 }
 return data;
}
