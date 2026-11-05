// Ownership follows explicit room roots, never a point-in-room guess. Shared
// floors, hull surfaces and circulation therefore remain outside room patches.
export function roomOwner(object){
 for(let p=object;p;p=p.parent){
  if(p.userData?.fastRoom)return p.userData.fastRoom;
  if(p.userData?.room)return p.userData.room;
  if(!p.isMesh&&p.name?.startsWith('Area_'))return p.name.slice(5);
  if(!p.isMesh&&p.name?.startsWith('V2_shell_'))return p.name.slice(9);
 }
 return null;
}

// A dressing the fast lane can replace alone carries its producer's tag (scripts/fast-dressing-v2.mjs).
export function roomPatchOwner(object){
 for(let p=object;p;p=p.parent){
  if(p.userData?.fastDressing)return 'dressing:'+p.userData.fastDressing;
  if(p.userData?.batchedEnvelope)return null;
  if(!p.isMesh&&p.name?.startsWith('Area_'))return p.name.slice(5)+'|source';
  if(!p.isMesh&&p.name?.startsWith('V2_shell_'))return p.name.slice(9)+'|shell';
 }
 return null;
}
