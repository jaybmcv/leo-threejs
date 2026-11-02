import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {seeded} from '../polish-kit.js';

// Selected concept 5B. This factory is used only by the neighborhood-10 blossom
// activity, in its legacy commons frame. It never changes a shared garden material.
// All beds stay inside the old raised planter; the bridge/bench approach stays open.
export const CONSERVATORY_ISLANDS = [
  [138.1,29.0,.95,'fern'],[140.1,28.6,.8,'coral'],[142.1,28.8,1,'broadleaf'],
  [144.0,29.1,.8,'fern'],[137.9,31.3,.85,'cream'],[143.9,31.5,.9,'coral'],
  [143.9,33.5,.85,'broadleaf'],[143.5,35.3,.8,'fern'],[141.5,30.0,.65,'cream'],
];
export const CONSERVATORY_GALLERY = [
  [126,28.3,41.75],[134,28.3,41.75],[142,28.3,41.75],
  [122,32.3,41.75],[131,32.3,41.75],[140,32.3,41.75],
];

// The former flower scatter shared its random stream with the pond, bridge plank
// tones and falling petals. Advance that stream without constructing the retired
// meshes so all those existing details remain byte-for-byte unchanged.
export function preserveBlossomRandomSequence(rnd) {
  for(let i=0;i<275;i++) {
    let x,z;do{x=141+(rnd()-.5)*8;z=32+(rnd()-.5)*8;}
    while(Math.hypot(x-141,z-32)<=1.3||(x>136.05&&x<140.25&&z>32.75&&z<36.95)||(x>139.6&&x<141.95&&z>33.85&&z<35.95));
    for(let j=0;j<6;j++)rnd();
  }
  for(let i=0;i<275;i++)rnd();
}

function colorGeometry(g, color) {
  const geometry=g.index?g.toNonIndexed():g,c=new T.Color(color),n=geometry.attributes.position.count;
  const colors=new Float32Array(n*3);for(let i=0;i<n;i++)c.toArray(colors,i*3);
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.deleteAttribute('uv');return geometry;
}
function leafGeometry(steps=8) {
  // Single vertices at the tips avoid the former degenerate triangles.
  const p=[0,0,0],indices=[];
  for(let i=1;i<steps;i++) {
    const t=i/steps,w=Math.sin(Math.PI*t)**.8*.32,y=Math.sin(t*Math.PI)*.15-t*t*.09;
    p.push(-w,y,t,0,y+w*.18,t,w,y,t);
    if(i===1)indices.push(0,1,2,0,2,3);
    else for(let j=0;j<2;j++){const a=1+(i-2)*3+j;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
  }
  const tip=p.length/3,a=tip-3;p.push(0,-.09,1);indices.push(a,tip,a+1,a+1,tip,a+2);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function stemBetween(a,b,r,color){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);return colorGeometry(new T.CylinderGeometry(r,r,d.length(),4,1,true).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize())).translate(...av.add(bv).multiplyScalar(.5).toArray()),color);}
function broadleafGeometry() {
  const pieces=[];for(let i=0;i<7;i++) {
    const a=i*2.39996,len=.75+(i%3)*.14;
    const h=.28+(i%3)*.16;
    pieces.push(colorGeometry(leafGeometry().scale(len,len,len).rotateX(-.7-(i%3)*.15).rotateY(a).translate(0,h,0),[0x32684e,0x4b865b,0x78a86a][i%3]));
    pieces.push(stemBetween([0,0,0],[0,h+.04,0],.014,0x83a068));
  }
  const g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());return g;
}
function fernGeometry() {
  const pieces=[];for(let f=0;f<7;f++) {
    const a=f*Math.PI*2/7,arc=t=>.1+Math.sin(t*Math.PI*.85)*.56;
    for(let n=0;n<7;n++) {
      const t=(n+1)/8,w=.19*(1-t)+.045;
      for(const side of [-1,1])pieces.push(colorGeometry(leafGeometry(3).scale(w*.7,.8*w,w*2.3).rotateY(side*1.05).translate(side*.015,arc(t),t*.95).rotateY(a),[0x3d7750,0x63955b,0x89b56c][n%3]));
      pieces.push(stemBetween([0,arc(n/8),n/8*.95],[0,arc(t),t*.95],.008,0x86a565).rotateY(a));
    }
  }
  const g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());return g;
}
function floweringShrub(color) {
  const pieces=[];for(let i=0;i<7;i++) {
    const a=i*2.4,r=.12+Math.sqrt(i/7)*.37,x=Math.cos(a)*r,z=Math.sin(a)*r,y=.18+(1-r)*.25;
    for(let j=0;j<4;j++)pieces.push(colorGeometry(leafGeometry(3).scale(.38,.38,.38).rotateX(-.35).rotateY(j*1.5708+a).translate(x,y-.14,z),j%2?0x477553:0x618f5c));
    if(i%2===0)for(let j=0;j<5;j++)pieces.push(colorGeometry(new T.SphereGeometry(.066,6,2).scale(1,.4,1).translate(x+Math.cos(j*1.2566)*.056,y+.09,z+Math.sin(j*1.2566)*.056),color));
  }
  const g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());return g;
}

export function createLayeredConservatory() {
  const group=new T.Group();group.name='Blossom_layered_conservatory_5B';
  group.userData={concept:'5B',owner:'commons-10',stage:'implemented',decorative:true};
  const rnd=seeded(5102026),material=new T.MeshStandardMaterial({name:'Conservatory_foliage',vertexColors:true,roughness:.91,side:T.DoubleSide});
  const catalog={fern:fernGeometry(),broadleaf:broadleafGeometry(),cream:floweringShrub(0xf4e5bd),coral:floweringShrub(0xe4937c)};
  const points={fern:[],broadleaf:[],cream:[],coral:[]},ground=[];
  for(const [x,z,r,kind] of CONSERVATORY_ISLANDS) {
    points[kind].push([x,25.01,z,kind==='broadleaf'?1.45:1.3]);
    for(let i=0;i<5;i++) {const a=i*1.2566;ground.push([x+Math.cos(a)*r*.6,25.06,z+Math.sin(a)*r*.6,.55]);}
    // Smaller repeat plants make coherent drifts rather than a random rainbow.
    for(let i=0;i<3;i++) {const a=i*2.094+.4;points[kind==='broadleaf'?'fern':kind].push([x+Math.cos(a)*r*.65,25.01,z+Math.sin(a)*r*.65,.6]);}
  }
  const groundPieces=[];for(let i=0;i<7;i++)groundPieces.push(colorGeometry(leafGeometry(3).scale(.6,.55,.75).rotateY(i*2.39996).translate(Math.cos(i*2.4)*.18,.03+(i%3)*.05,Math.sin(i*2.4)*.18),i%2?0x52734e:0x6c8b55));
  catalog.ground=mergeGeometries(groundPieces);groundPieces.forEach(p=>p.dispose());points.ground=ground;
  catalog.gallery=colorGeometry(catalog.ground.clone(),0x91aa52);points.gallery=[];
  for(const [x,y,z] of CONSERVATORY_GALLERY)for(let i=0;i<7;i++)points.gallery.push([x+(i-3)*.27,y+.38,z-.1,.36]);
  const matrix=new T.Matrix4(),q=new T.Quaternion(),up=new T.Vector3(0,1,0);
  for(const [kind,locations] of Object.entries(points)) {
    const mesh=new T.InstancedMesh(catalog[kind],material,locations.length);mesh.name='Conservatory_'+kind;
    locations.forEach(([x,y,z,s],i)=>mesh.setMatrixAt(i,matrix.compose(new T.Vector3(x,y,z),q.setFromAxisAngle(up,rnd()*Math.PI*2),new T.Vector3(s,s,s))));
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  // Six troughs fixed outside the gallery rail, above walker headroom. Nothing
  // extends into the gallery walking surface, doors, stairs or bridge approach.
  const troughMat=new T.MeshStandardMaterial({name:'Conservatory_walnut_trough',color:0x78533c,roughness:.72});
  const troughs=new T.InstancedMesh(new T.BoxGeometry(2,.32,.42),troughMat,CONSERVATORY_GALLERY.length);
  troughs.name='Conservatory_gallery_troughs';
  const vines=[];
  CONSERVATORY_GALLERY.forEach(([x,y,z],i)=>{
    troughs.setMatrixAt(i,new T.Matrix4().makeTranslation(x,y+.22,z));
    for(let strand=0;strand<6;strand++)for(let n=0;n<9;n++) {
      const t=n/8;vines.push([x+(strand-2.5)*.28+Math.sin(t*4+strand)*.08,y+.4-t*(.8+strand%3*.2),z-.22-Math.sin(t*Math.PI)*.15,.22+(1-t)*.09,strand+n]);
    }
  });
  troughs.instanceMatrix.needsUpdate=true;troughs.computeBoundingSphere();troughs.castShadow=troughs.receiveShadow=true;group.add(troughs);
  const trailing=new T.InstancedMesh(leafGeometry(3),new T.MeshStandardMaterial({name:'Conservatory_trailing_leaves',color:0x5c925c,side:T.DoubleSide,roughness:.92}),vines.length);
  trailing.name='Conservatory_gallery_trailing_leaves';
  vines.forEach(([x,y,z,s,turn],i)=>trailing.setMatrixAt(i,matrix.compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(1.3,Math.sin(turn)*.7,turn%2?.5:-.5)),new T.Vector3(s,s,s))));
  trailing.instanceMatrix.needsUpdate=true;trailing.computeBoundingSphere();trailing.castShadow=trailing.receiveShadow=true;group.add(trailing);
  return group;
}
