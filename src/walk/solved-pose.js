// The pose Cosmo's last rig solve left (avatar.js), kept so a frame without a solve (rig-pace.js: unseen, or another visitor
// small on screen) starts again from it. What is done on top of a solve each frame (the tail tucked under a hat, the
// longboard, the arm up a grapple line, a rest pose blended in) eases the bones and the figure's height from where the
// solve left them; without this it would ease them again from where it left them the frame before, and compound.
//   solvedPose(bones, root) -> {keep(): after a solve; touched(): something moved them on top of it this frame;
//   restore(): a frame without a solve, back to the solved pose if anything was done on top of it (returns whether it was)}
export function solvedPose(bones,root){
 const q=bones.map(b=>b.quaternion.clone());let y=root.position.y,dirty=false;
 return {
  keep(){for(let i=0;i<bones.length;i++)q[i].copy(bones[i].quaternion);y=root.position.y;dirty=false;},
  touched(){dirty=true;},
  restore(){if(!dirty)return false;for(let i=0;i<bones.length;i++)bones[i].quaternion.copy(q[i]);root.position.y=y;dirty=false;return true;},
 };
}
