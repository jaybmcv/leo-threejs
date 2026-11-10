// Three's scene walk (WebGLRenderer's projectObject) visits every node of the scene each frame, bones too: 93 for every
// other visitor (avatar.js with cacheBones), about 1.1 ms for 24 in view on an RTX 3090's host, though bones draw
// nothing. It skips the children of a hidden node, and nothing else reads a bone's visibility (world matrices and
// skinning ignore it), so the bones are hidden from it except the path to whatever hangs from one and is shown: the hat
// on the head bone (hat.js), the catnip face (catnip-face.js).
//   boneWalk(bones) -> {sync(): after what hangs from the bones was shown or hidden this frame}
export function boneWalk(bones){
 const set=new Set(bones);let hung=[],path=[];
 // What hangs from a bone, and the bones above it; redone when something is hung or taken off.
 const recount=()=>{
  hung=[];const on=new Set();
  for(const b of bones)for(const c of b.children)if(!set.has(c)){hung.push(c);for(let x=b;set.has(x);x=x.parent)on.add(x);}
  path=[...on];for(const b of bones)b.visible=false;
 };
 for(const b of bones){b.addEventListener('childadded',recount);b.addEventListener('childremoved',recount);}
 recount();
 return {sync(){
  for(const b of path)b.visible=false;
  for(const c of hung)if(c.visible)for(let x=c.parent;set.has(x)&&!x.visible;x=x.parent)x.visible=true;
 }};
}
