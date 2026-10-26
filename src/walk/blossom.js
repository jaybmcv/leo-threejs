import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {plantClumps} from '../stylized-plants.js';
import {seeded} from '../polish-kit.js';

// The aft planter of the Deck 17 garden commons (Neighborhood 10, the commons the tour opens in) becomes a cherry
// blossom garden on foot: its green tree gives way to a pink bonsai-style cherry with a gnarled S-curved trunk, layered
// blossom pads and surface roots; a bed of mixed flowers and a carpet of fallen petals fill the planter, petals spill
// onto the floor round it, and the planter is clad as a dry-stone wall with a capstone rim. Petals drift down from the
// canopy and a few butterflies flutter round the tree while a walker is near. The other commons keep their trees.
// Frame: the commons template (model.js createNeighborhood), where this planter is 9 x 9 m at x 136.5-145.5,
// z 27.5-36.5, its top at 24.95 and its soil at 25.01 over the floor at 24.3.
const COMMONS='Fitted_garden_commons_10',BED={x:141,z:32,half:4.5},FLOOR=24.3,TOP=24.95,SOIL=25.01,NEAR=45;
const OLD=/^(Stylized_tree_trunk|Stylized_tree_canopy|Tree_trunk|Tree_canopy|Low_plant|Planter_edge_cap)$/;
const PINKS=[0xf7b6cf,0xf29bbd,0xfbd0e0,0xe882a8,0xffe1ec,0xf5a3c4];

const inBed=(x,z,pad=0)=>Math.abs(x-BED.x)<BED.half+pad&&Math.abs(z-BED.z)<BED.half+pad;
function frameOf(ship){const root=ship.root.getObjectByName(COMMONS);if(!root)return null;root.updateWorldMatrix(true,true);return root;}

// Take the planter's tree, shrubs and oak edge caps out before the colliders are built. The garden foliage is merged
// across both of the commons' beds, so this bed's leaves are cut out of a copy of it. Returns false if it's missing.
export function stripBlossomBed(ship){
 const root=frameOf(ship);if(!root)return false;
 const toFrame=new T.Matrix4().copy(root.matrixWorld).invert(),m=new T.Matrix4(),box=new T.Box3(),c=new T.Vector3(),gone=[];
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh)return;
  if(OLD.test(o.name)){
   if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
   box.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(toFrame,o.matrixWorld)).getCenter(c);
   if(inBed(c.x,c.z))gone.push(o);
  }
  else if(o.name==='Layered_garden_foliage'){
   const g=o.geometry,p=g.attributes.position,idx=g.index,keep=[],v=new T.Vector3(),toLocal=m.multiplyMatrices(toFrame,o.matrixWorld).clone();
   const n=idx?idx.count:p.count,at=i=>idx?idx.getX(i):i;
   for(let i=0;i<n;i+=3){v.fromBufferAttribute(p,at(i)).applyMatrix4(toLocal);if(inBed(v.x,v.z))continue;for(let k=0;k<3;k++){v.fromBufferAttribute(p,at(i+k));keep.push(v.x,v.y,v.z);}}
   const cut=new T.BufferGeometry();cut.setAttribute('position',new T.Float32BufferAttribute(keep,3));cut.computeVertexNormals();
   o.geometry=cut;// the template's geometry stays as it is for the other commons
  }
 });
 for(const o of gone)o.removeFromParent();
 return true;
}

function tinted(geometry,color){
 const g=geometry.index?geometry.toNonIndexed():geometry,c=new T.Color(color),colors=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
 g.setAttribute('color',new T.BufferAttribute(colors,3));g.deleteAttribute('uv');return g;
}
function limb(from,to,r0,r1){
 const d=new T.Vector3().subVectors(to,from),g=new T.CylinderGeometry(r1,r0,d.length(),8,1);
 g.translate(0,d.length()/2,0).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize())).translate(from.x,from.y,from.z);
 g.deleteAttribute('uv');return g.toNonIndexed();// to merge with the joints' non-indexed spheres
}

// The bonsai cherry rooted at `base`: trunk, roots and branches as one bark mesh, blossom pads as one vertex-coloured mesh.
function cherry(base,rnd){
 const v=(x,y,z)=>new T.Vector3(base.x+x,base.y+y,base.z+z),wood=[],blobs=[];
 const trunk=[[0,-.1,0,.55],[.4,.8,.18,.46],[.12,1.6,-.28,.38],[-.36,2.3,-.06,.32],[-.12,3,.3,.26],[.3,3.6,.1,.2],[.12,4.2,-.12,.15]].map(([x,y,z,r])=>({p:v(x,y,z),r}));
 for(let i=0;i<trunk.length-1;i++){wood.push(limb(trunk[i].p,trunk[i+1].p,trunk[i].r,trunk[i+1].r));wood.push(new T.IcosahedronGeometry(trunk[i+1].r,1).translate(...trunk[i+1].p.toArray()).deleteAttribute('uv'));}
 // Surface roots fan over the soil.
 for(let i=0;i<7;i++){const a=i/7*Math.PI*2+rnd()*.4,l=.9+rnd()*.5;wood.push(limb(v(Math.cos(a)*.2,.3,Math.sin(a)*.2),v(Math.cos(a)*l,.01,Math.sin(a)*l),.2,.05));}
 const pad=(c,n,spread,r)=>{for(let i=0;i<n;i++){const a=rnd()*Math.PI*2,d=Math.sqrt(rnd())*spread;
  blobs.push(tinted(new T.IcosahedronGeometry(r*(.7+rnd()*.5),1),PINKS[rnd()*PINKS.length|0]).scale(1,.55,1).translate(c.x+Math.cos(a)*d,c.y+(rnd()-.4)*.35,c.z+Math.sin(a)*d));}};
 // Long, nearly level branches end in flat blossom clouds, the way a bonsai is trained; each forks once.
 const from=[1,2,2,3,3,4,5,5],turn=rnd()*Math.PI*2;
 from.forEach((k,i)=>{
  const a=turn+i/from.length*Math.PI*2+(rnd()-.5)*.5,len=2+rnd()*1.2,root=trunk[k].p,lift=.35+rnd()*.5;
  const mid=root.clone().add(new T.Vector3(Math.cos(a)*len*.55,lift,Math.sin(a)*len*.55));
  const tip=root.clone().add(new T.Vector3(Math.cos(a)*len,lift+.2-rnd()*.35,Math.sin(a)*len));
  wood.push(limb(root,mid,.15,.1),limb(mid,tip,.1,.05));
  const b=a+(rnd()<.5?-.7:.7),fork=mid.clone().add(new T.Vector3(Math.cos(b)*.9,.35,Math.sin(b)*.9));wood.push(limb(mid,fork,.08,.04));
  pad(tip.clone().add(new T.Vector3(0,.25,0)),7,.75,.62);pad(fork.clone().add(new T.Vector3(0,.2,0)),4,.45,.5);pad(mid.clone().add(new T.Vector3(0,.3,0)),2,.3,.45);
 });
 pad(trunk.at(-1).p.clone().add(new T.Vector3(0,.35,0)),9,.8,.7);
 const bark=new T.MeshStandardMaterial({name:'Blossom_bark',color:0x4a3328,roughness:.9,flatShading:true});
 const blossom=new T.MeshStandardMaterial({name:'Blossom_canopy',vertexColors:true,flatShading:true,roughness:.8,emissive:0x3a0f1e,emissiveIntensity:.25});
 const t=new T.Mesh(mergeGeometries(wood),bark),c=new T.Mesh(mergeGeometries(blobs),blossom);
 t.name='Blossom_tree_trunk';c.name='Blossom_tree_canopy';for(const o of [t,c]){o.castShadow=true;o.receiveShadow=true;}
 wood.forEach(g=>g.dispose());blobs.forEach(g=>g.dispose());
 return [t,c];
}

// An instanced mesh with a colour per instance; `place(i)` returns [position, euler, scale] for each.
function scatter(name,geometry,material,colors,count,rnd,place){
 const mesh=new T.InstancedMesh(geometry,material,count),m=new T.Matrix4(),q=new T.Quaternion(),c=new T.Color();mesh.name=name;mesh.receiveShadow=true;
 for(let i=0;i<count;i++){const [p,e,s]=place(i);mesh.setMatrixAt(i,m.compose(p,q.setFromEuler(e),s));mesh.setColorAt(i,c.set(colors[rnd()*colors.length|0]));}
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();return mesh;
}

// The garden, in ship coordinates. `group` draws (with its deck band), `solid` holds the trunk for the colliders, and
// update() lets the petals fall and the butterflies fly while the walker is within NEAR metres.
export function createBlossomGarden(ship){
 const root=frameOf(ship);if(!root)return null;
 const rnd=seeded(9517),centre=new T.Vector3(BED.x,SOIL,BED.z).applyMatrix4(root.matrixWorld);
 // Drawn in the template frame, under a group placed at the bed so it joins the right deck band.
 const group=new T.Group();group.name='Cherry_blossom_garden';group.position.copy(centre);
 const frame=new T.Group();frame.matrixAutoUpdate=false;frame.matrix.makeTranslation(-centre.x,-centre.y,-centre.z).multiply(root.matrixWorld);group.add(frame);
 const solid=new T.Group();solid.name='Cherry_blossom_colliders';solid.matrixAutoUpdate=false;solid.matrix.copy(root.matrixWorld);
 const white=(name,o={})=>new T.MeshStandardMaterial({name,color:0xffffff,roughness:.75,...o});

 frame.add(...cherry(new T.Vector3(BED.x,SOIL,BED.z),rnd));
 {const o=new T.Mesh(new T.CylinderGeometry(.55,.55,3.2,8));o.position.set(BED.x+.1,SOIL+1.6,BED.z);solid.add(o);}

 // A dry-stone wall round the planter: two courses of irregular blocks, a capstone rim over the top edge.
 const stones=[],H=BED.half;
 for(const [ax,az,sx,sz] of [[0,-1,1,0],[0,1,1,0],[-1,0,0,1],[1,0,0,1]])for(let course=0;course<2;course++){
  let s=-H-.1+course*.3*rnd();
  while(s<H+.1){const len=Math.min(.45+rnd()*.45,H+.12-s),y=FLOOR+.16+course*.31,o=H+.05+rnd()*.02,mid=s+len/2;
   const g=new T.BoxGeometry(sx?len-.03:.14,.28+rnd()*.03,sz?len-.03:.14).rotateY((rnd()-.5)*.06).translate(BED.x+ax*o+sx*mid,y,BED.z+az*o+sz*mid);
   const k=.82+rnd()*.3;stones.push(tinted(g,new T.Color(0x8d8a80).multiplyScalar(k).lerp(new T.Color(0xa08a6a),rnd()*.4)));s+=len;}
 }
 for(const [ax,az,sx,sz] of [[0,-1,1,0],[0,1,1,0],[-1,0,0,1],[1,0,0,1]]){
  let s=-H-.12;
  while(s<H+.12){const len=Math.min(.7+rnd()*.5,H+.14-s),mid=s+len/2,o=H-.14;
   const g=new T.BoxGeometry(sx?len-.025:.56,.1,sz?len-.025:.56).translate(BED.x+ax*o+sx*mid,TOP+.05+rnd()*.02,BED.z+az*o+sz*mid);
   stones.push(tinted(g,new T.Color(0xb3ada0).multiplyScalar(.9+rnd()*.15)));s+=len;}
 }
 {const o=new T.Mesh(mergeGeometries(stones),new T.MeshStandardMaterial({name:'Blossom_stone',vertexColors:true,flatShading:true,roughness:.95}));
  o.name='Blossom_stone_wall';o.castShadow=true;o.receiveShadow=true;frame.add(o);stones.forEach(g=>g.dispose());}

 // Green underplanting, then flowers of every kind through it, clear of the trunk and its roots.
 plantClumps(frame,[new T.Box3(new T.Vector3(BED.x-4.1,0,BED.z-4.1),new T.Vector3(BED.x+4.1,SOIL,BED.z+4.1))],{seed:9518,density:.7,flowers:false});
 const spot=()=>{for(;;){const x=BED.x+(rnd()-.5)*8,z=BED.z+(rnd()-.5)*8;if(Math.hypot(x-BED.x,z-BED.z)>1.3)return [x,z];}};
 const daisy=mergeGeometries([...Array.from({length:6},(_,i)=>tinted(new T.SphereGeometry(1,6,3).scale(.07,.014,.028).translate(.065,0,0).rotateY(i/6*Math.PI*2),0xffffff)),tinted(new T.SphereGeometry(.032,6,4),0xffc23a)]);
 const tulip=tinted(new T.LatheGeometry([[0,0],[.05,.02],[.065,.07],[.05,.13]].map(([x,y])=>new T.Vector2(x,y)),6),0xffffff);
 const spike=mergeGeometries(Array.from({length:6},(_,i)=>tinted(new T.IcosahedronGeometry(.04-i*.004,0).translate(0,i*.05,0),0xffffff)));
 const kinds=[[daisy,[0xffffff,0xfff2a8,0xff8fc0,0xffb347,0xd27bff],130],[tulip,[0xe8323c,0xff5a8a,0xffd23f,0xff7a1a,0xb04ad8,0xffffff],110],[spike,[0x8a5cf0,0x5a7cf0,0xd65cc8,0xc9a6ff],80]];
 const stems=[],petalMat=white('Blossom_flower',{vertexColors:true,side:T.DoubleSide,roughness:.6});
 for(const [geometry,colors,count] of kinds){
  frame.add(scatter('Blossom_flowers',geometry,petalMat,colors,count,rnd,()=>{
   const [x,z]=spot(),h=.2+rnd()*.35;stems.push([x,z,h]);
   return [new T.Vector3(x,SOIL+h,z),new T.Euler((rnd()-.5)*.4,rnd()*6,(rnd()-.5)*.4),new T.Vector3().setScalar(.85+rnd()*.5)];}));
 }
 frame.add(scatter('Blossom_flower_stems',new T.CylinderGeometry(.008,.011,1,4).translate(0,.5,0),white('Blossom_stem'),[0x4f7f45,0x5f9c46],stems.length,rnd,i=>
  [new T.Vector3(stems[i][0],SOIL,stems[i][1]),new T.Euler(),new T.Vector3(1,stems[i][2],1)]));

 // Fallen petals carpet the soil and spill onto the floor round the wall.
 const petal=new T.CircleGeometry(.045,5).rotateX(-Math.PI/2).scale(1,1,.6),petalColour=white('Blossom_petal',{side:T.DoubleSide,roughness:.85});
 frame.add(scatter('Blossom_fallen_petals',petal,petalColour,PINKS,1400,rnd,i=>{
  let x,z,y;
  if(i<1150){x=BED.x+(rnd()-.5)*8.4;z=BED.z+(rnd()-.5)*8.4;y=SOIL+.004+rnd()*.01;}
  else{const a=rnd()*Math.PI*2,d=H+.25+rnd()*rnd()*1.6;x=BED.x+Math.cos(a)*d*1.05;z=BED.z+Math.sin(a)*d*1.05;if(inBed(x,z,.2)){x=BED.x+Math.sign(x-BED.x)*(H+.3+rnd()*.6);}y=FLOOR+.004;}
  return [new T.Vector3(x,y,z),new T.Euler((rnd()-.5)*.3,rnd()*6,(rnd()-.5)*.3),new T.Vector3().setScalar(.7+rnd()*.6)];}));

 // Petals falling from the canopy: each drifts down with a sway and a tumble, and starts again at the top on landing.
 const FALL=160,falling=new T.InstancedMesh(petal,petalColour,FALL),drop=[];falling.name='Blossom_falling_petals';falling.frustumCulled=false;
 const reset=(d,top)=>{const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*3.6;d.x=BED.x+Math.cos(a)*r;d.z=BED.z+Math.sin(a)*r;d.y=top?SOIL+3+rnd()*2.2:SOIL+rnd()*5;
  d.speed=.22+rnd()*.25;d.phase=rnd()*6;d.sway=.15+rnd()*.25;d.spin=1+rnd()*2.5;};
 const c=new T.Color();for(let i=0;i<FALL;i++){const d={};reset(d,false);drop.push(d);falling.setColorAt(i,c.set(PINKS[rnd()*PINKS.length|0]));}
 frame.add(falling);

 // Butterflies: two wings each, hinged on the body and beating as they wander round the tree.
 const wingShape=new T.Shape();wingShape.moveTo(0,-.02);wingShape.bezierCurveTo(.07,-.09,.15,-.07,.13,.0);wingShape.bezierCurveTo(.17,.07,.1,.12,0,.04);
 const FLY=8,wings=new T.InstancedMesh(new T.ShapeGeometry(wingShape,4).rotateX(-Math.PI/2),white('Blossom_butterfly',{side:T.DoubleSide,roughness:.5}),FLY*2);
 const bodies=new T.InstancedMesh(new T.CapsuleGeometry(.012,.07,2,4).rotateX(Math.PI/2),new T.MeshStandardMaterial({name:'Blossom_butterfly_body',color:0x1e1a18,roughness:.6}),FLY);
 wings.name='Blossom_butterflies';bodies.name='Blossom_butterfly_bodies';wings.frustumCulled=bodies.frustumCulled=false;
 const flies=Array.from({length:FLY},(_,i)=>({r:2+rnd()*3,h:SOIL+.4+rnd()*1.8,w:(.18+rnd()*.2)*(rnd()<.5?-1:1),ph:rnd()*6,beat:11+rnd()*5}));
 [0xf28a1e,0x3d8be0,0xf6d23c,0xf4f0e8,0xff7fb5,0xf28a1e,0x6ad1e0,0xffffff].forEach((col,i)=>{c.set(col);wings.setColorAt(2*i,c);wings.setColorAt(2*i+1,c);});
 frame.add(wings,bodies);

 const m=new T.Matrix4(),q=new T.Quaternion(),q2=new T.Quaternion(),e=new T.Euler(),p=new T.Vector3(),s=new T.Vector3(1,1,1),flip=new T.Vector3(-1,1,1),fwd=new T.Vector3(0,0,1);
 let time=0;
 function animate(dt){
  time+=dt;
  for(let i=0;i<FALL;i++){const d=drop[i];d.y-=d.speed*dt;
   const floor=inBed(d.x,d.z)?SOIL:FLOOR;if(d.y<floor)reset(d,true);
   const t=time*1.3+d.phase;p.set(d.x+Math.sin(t)*d.sway,d.y,d.z+Math.cos(t*.8)*d.sway);
   falling.setMatrixAt(i,m.compose(p,q.setFromEuler(e.set(t*d.spin,t*.7,Math.sin(t)*1.2)),s));}
  falling.instanceMatrix.needsUpdate=true;
  flies.forEach((f,i)=>{const t=time*f.w+f.ph;
   p.set(BED.x+Math.cos(t)*f.r+Math.sin(t*2.7)*.35,f.h+Math.sin(t*3.1)*.3+Math.sin(time*4+f.ph)*.04,BED.z+Math.sin(t)*f.r+Math.cos(t*2.3)*.35);
   // Heading along the path (its derivative), so each one flies where it's going.
   const yaw=Math.atan2(-Math.sin(t)*f.r*f.w,Math.cos(t)*f.r*f.w);q.setFromAxisAngle(T.Object3D.DEFAULT_UP,yaw);
   bodies.setMatrixAt(i,m.compose(p,q,s));
   const flap=.25+Math.sin(time*f.beat+f.ph)*.95;
   wings.setMatrixAt(2*i,m.compose(p,q2.setFromAxisAngle(fwd,-flap).premultiply(q),s));
   wings.setMatrixAt(2*i+1,m.compose(p,q2.setFromAxisAngle(fwd,flap).premultiply(q),flip));
  });
  wings.instanceMatrix.needsUpdate=bodies.instanceMatrix.needsUpdate=true;
 }
 animate(0);
 const here=new T.Vector3();
 return {group,solid,update(dt,walker){if(walker.distanceTo(here.copy(centre))<NEAR)animate(Math.min(dt,.1));}};
}
