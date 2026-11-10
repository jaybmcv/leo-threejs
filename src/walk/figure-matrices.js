// Another visitor's Cosmo (avatar.js with cacheBones: remotes.js) is 117 objects: the figure's groups, 93 bones, its 15
// parts and their merged copies. Three remade all their matrices every frame in the scene pass, and the skeleton's
// bone texture before drawing, though on most frames nothing had moved them: a rig solve (dlCatFigure.ts apply) ends by
// making them current itself, and between paced solves (rig-pace.js) a body standing still is unchanged. A solve also
// remade the bone texture twice on its way, which only drawing reads (the floor probes and the shoe contact read the
// bones' world matrices).
//   figureMatrices(figure) -> {solve(fn): run a rig solve; changed(): bones or the figure's height were moved outside a
//   solve (what avatar.js does on top of one, a solved pose restored)}
// After it, figure.root.updateMatrixWorld (the scene pass reaches it through the walker's holder and body) does nothing
// unless something changed since it last ran, its parent's world matrix differs (the holder moved or turned, the body
// leaned) or its own transform does; inside a solve it always runs. The skeleton's update does nothing inside a solve,
// nor while the matrices are as they were at its last run. Anything added under the figure later (the hat on the head
// bone, then the hat's meshes) counts as a change.
export function figureMatrices(figure){
 const root=figure.root,base=root.updateMatrixWorld,last=new Float64Array(26);
 let solving=false,dirty=true,made=0,parent=null;
 const same=()=>{
  if(!root.parent||root.parent!==parent)return false;const m=root.parent.matrixWorld.elements;
  for(let i=0;i<16;i++)if(m[i]!==last[i])return false;
  const p=root.position,q=root.quaternion,s=root.scale;
  return p.x===last[16]&&p.y===last[17]&&p.z===last[18]&&q.x===last[19]&&q.y===last[20]&&q.z===last[21]&&q.w===last[22]&&s.x===last[23]&&s.y===last[24]&&s.z===last[25];
 };
 const keep=()=>{
  parent=root.parent;if(parent)last.set(parent.matrixWorld.elements);
  const p=root.position,q=root.quaternion,s=root.scale;last[16]=p.x;last[17]=p.y;last[18]=p.z;last[19]=q.x;last[20]=q.y;last[21]=q.z;last[22]=q.w;last[23]=s.x;last[24]=s.y;last[25]=s.z;
 };
 root.updateMatrixWorld=function(force){if(!solving&&!dirty&&same())return;base.call(this,force);keep();dirty=false;made++;};
 // The parts' skeleton (their merged copies bind the same one).
 for(const s of new Set(figure.asset.meshes.map(m=>m.skeleton))){const update=s.update;let seen=-1;
  s.update=function(){if(solving||seen===made)return;update.call(this);seen=made;};}
 const watched=new WeakSet(),watch=o=>{if(watched.has(o))return;watched.add(o);o.addEventListener('childadded',e=>{dirty=true;e.child.traverse(watch);});};
 root.traverse(watch);
 return {
  solve(fn){solving=true;try{return fn();}finally{solving=false;}},
  changed(){dirty=true;},
  // How many times the figure's matrices were made (checks).
  get made(){return made;},
 };
}
