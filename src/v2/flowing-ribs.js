import * as T from 'three';

// 4A: a shared rounded reveal at the sealed, atrium-facing window of a cabin.
// The corridor entry is the opposite face. The existing glass/rail remains.
const ivory=new T.MeshStandardMaterial({name:'Flowing_rib_ivory',color:0xe4d7bf,roughness:.64,metalness:.04});
const brass=new T.MeshStandardMaterial({name:'Flowing_rib_brass',color:0xb58a48,roughness:.43,metalness:.64,side:T.DoubleSide});
function roundedRect(width,height,radius){
  const p=new T.Shape(),x=-width/2,y=(3.4-height)/2,r=radius;
  p.moveTo(x+r,y);p.lineTo(x+width-r,y);p.quadraticCurveTo(x+width,y,x+width,y+r);
  p.lineTo(x+width,y+height-r);p.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  p.lineTo(x+r,y+height);p.quadraticCurveTo(x,y+height,x,y+height-r);
  p.lineTo(x,y+r);p.quadraticCurveTo(x,y,x+r,y);return p;
}
function ring(outer,inner,depth=0){
  const s=roundedRect(...outer),hole=roundedRect(...inner);s.holes.push(new T.Path(hole.getPoints(4)));
  return depth?new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:4}).translate(0,0,-depth/2):new T.ShapeGeometry(s,4);
}
const reveal=ring([3.18,3.4,.48],[2.84,3.06,.32],.12);
const inlay=ring([2.875,3.095,.3375],[2.84,3.06,.32]);
export const FLOWING_RIB_PARTS=[
  {name:'Flowing_atrium_window_reveal',geometry:reveal,material:ivory,depth:3.76},
  {name:'Flowing_atrium_window_inlay',geometry:inlay,material:brass,depth:3.825},
];

export function addFlowingCabinRibs(parent,doorSign){
  for(const part of FLOWING_RIB_PARTS){
    const o=new T.Mesh(part.geometry,part.material);o.name='Cabin_v2_'+part.name;
    o.position.z=-doorSign*part.depth;
    // These sit on the existing sealed pane: retain the original collision.
    o.userData={shell:true,noCollide:true,selectedDesign:'4A',atriumWindowTrim:true};parent.add(o);
  }
}

// Distant architectural frames retain the exact front contour but no hidden
// reveal depth. Physical nearby cabin templates keep FLOWING_RIB_PARTS above.
let facadeParts;
function flowingFacadeParts(){
  if(facadeParts)return facadeParts;
  const source=reveal,p=source.attributes.position,n=source.attributes.normal,ix=source.index,positions=[];
  for(let i=0;i<(ix?.count||p.count);i+=3){
    const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);
    if(ids.every(id=>n.getZ(id)>.99))for(const id of ids)positions.push(p.getX(id),p.getY(id),0);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  const material=ivory.clone();material.name='Flowing_rib_ivory_facade';material.side=T.DoubleSide;
  facadeParts=[{...FLOWING_RIB_PARTS[0],geometry,material,depth:3.82},FLOWING_RIB_PARTS[1]];
  return facadeParts;
}

export function addFlowingAtriumRibs(root,cabins){
  const list=cabins.filter(c=>c.view==='atrium');
  for(const part of flowingFacadeParts()){
    const o=new T.InstancedMesh(part.geometry,part.material,list.length);
    o.name='P6_'+part.name;o.frustumCulled=false;
    o.userData={noCollide:true,phase6Architecture:true,selectedDesign:'4A',roomOwners:list.map(c=>c.id),proxySpans:list.map(c=>[c.y-.14,c.y+3.5])};
    list.forEach((c,i)=>{
      const dx=c.door.center[0]-c.x,dz=c.door.center[2]-c.z,sign=Math.sin(c.yaw)*dx+Math.cos(c.yaw)*dz>0?1:-1;
      o.setMatrixAt(i,c.matrix.clone().multiply(new T.Matrix4().makeTranslation(0,0,-sign*part.depth)));
    });
    o.computeBoundingBox();o.computeBoundingSphere();root.add(o);
  }
  return {windows:list.length,draws:FLOWING_RIB_PARTS.length,trianglesPerWindow:flowingFacadeParts().reduce((n,p)=>n+(p.geometry.index?.count||p.geometry.attributes.position.count)/3,0)};
}
