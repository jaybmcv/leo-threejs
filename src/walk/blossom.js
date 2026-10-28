import * as T from 'three';
import {roomObject} from '../plan/rooms.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {plantClumps} from '../stylized-plants.js';
import {seeded} from '../polish-kit.js';

// The aft planter of the Deck 17 garden commons (Neighborhood 10, the commons the tour opens in) becomes a cherry
// blossom garden on foot: its green tree gives way to a pink bonsai-style cherry with a gnarled S-curved trunk, layered
// blossom pads and surface roots; a bed of mixed flowers and a carpet of fallen petals fill the planter, petals spill
// onto the floor round it, and the planter is clad as a dry-stone wall with a capstone rim. Petals drift down from the
// canopy and a few butterflies flutter round the tree while a walker is near. The other commons keep their trees.
// The planter's corner toward the arrival side is a koi pond at floor level, fed by a waterfall over rocks from the
// bed. A red arched bridge climbs from the floor over the pond to a bench under the tree that a walker can sit on,
// and the falls can be heard nearby while the walk's sound is on.
// Frame: the commons template (model.js createNeighborhood), where this planter is 9 x 9 m at x 136.5-145.5,
// z 27.5-36.5, its top at 24.95 and its soil at 25.01 over the floor at 24.3.
const COMMONS='Fitted_garden_commons_10',BED={x:141,z:32,half:4.5},FLOOR=24.3,TOP=24.95,SOIL=25.01,NEAR=45;
const OLD=/^(Stylized_tree_trunk|Stylized_tree_canopy|Tree_trunk|Tree_canopy|Low_plant|Planter_edge_cap)$/;
const PINKS=[0xf7b6cf,0xf29bbd,0xfbd0e0,0xe882a8,0xffe1ec,0xf5a3c4];
// The pond takes a 3.3 m corner of the bed; the bridge crosses it along x to the bench, and the falls are in the
// corner the bed wraps round. HEAR is how near the falls their sound starts.
const POND={x0:136.5,x1:139.8,z0:33.2,z1:36.5},WATER=24.58,BRIDGE={x0:136.45,x1:140.05,z:35,half:.6},BENCH={x:141.15,z:34.8};
const FALLS={x:139.4,z:33.72,lip:25.62},HEAR=14,RED=0xc8322b;

const inBed=(x,z,pad=0)=>Math.abs(x-BED.x)<BED.half+pad&&Math.abs(z-BED.z)<BED.half+pad;
const inPond=(x,z,pad=0)=>x>POND.x0-pad&&x<POND.x1+pad&&z>POND.z0-pad&&z<POND.z1+pad;
// The bed as an L round the pond, `inset` in from the planter's edges: [x0,x1,z0,z1] boxes in the frame.
const L=inset=>[[BED.x-BED.half+inset,BED.x+BED.half-inset,BED.z-BED.half+inset,POND.z0-inset],[POND.x1+inset,BED.x+BED.half-inset,POND.z0-inset,BED.z+BED.half-inset]];
const slab=([x0,x1,z0,z1],y0,y1)=>new T.BoxGeometry(x1-x0,y1-y0,z1-z0).translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
function frameOf(ship){const root=roomObject(ship,COMMONS);if(!root)return null;root.updateWorldMatrix(true,true);return root;}

// Before the colliders and seats are found: take the planter's tree, shrubs and oak edge caps out, cut the pond's
// corner out of the planter and its soil, and set the bench under the tree. The garden foliage is merged across both of
// the commons' beds, so this bed's leaves are cut out of a copy of it. Returns false if the commons is missing.
export function prepareBlossomBed(ship){
 const root=frameOf(ship);if(!root)return false;
 const toFrame=new T.Matrix4().copy(root.matrixWorld).invert(),m=new T.Matrix4(),box=new T.Box3(),c=new T.Vector3(),gone=[],shaped=[];
 const centreOf=o=>{if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();return box.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(toFrame,o.matrixWorld)).getCenter(c);};
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh)return;
  if(OLD.test(o.name)){if(inBed(centreOf(o).x,c.z))gone.push(o);}
  else if(o.name==='Garden_planter'||o.name==='Planting_bed'){if(inBed(centreOf(o).x,c.z))shaped.push(o);}
  else if(o.name==='Layered_garden_foliage'){
   const g=o.geometry,p=g.attributes.position,idx=g.index,keep=[],v=new T.Vector3(),toLocal=m.multiplyMatrices(toFrame,o.matrixWorld).clone();
   const n=idx?idx.count:p.count,at=i=>idx?idx.getX(i):i;
   for(let i=0;i<n;i+=3){v.fromBufferAttribute(p,at(i)).applyMatrix4(toLocal);if(inBed(v.x,v.z))continue;for(let k=0;k<3;k++){v.fromBufferAttribute(p,at(i+k));keep.push(v.x,v.y,v.z);}}
   const cut=new T.BufferGeometry();cut.setAttribute('position',new T.Float32BufferAttribute(keep,3));cut.computeVertexNormals();
   o.geometry=cut;// the template's geometry stays as it is for the other commons
  }
 });
 for(const o of gone)o.removeFromParent();
 // The planter and its soil become an L; the stone wall (below) clads the new faces toward the pond.
 for(const o of shaped){const [inset,y0,y1]=o.name==='Garden_planter'?[0,FLOOR,TOP]:[.25,TOP,SOIL],local=m.multiplyMatrices(toFrame,o.matrixWorld).clone().invert();
  o.geometry=mergeGeometries(L(inset).map(b=>slab(b,y0,y1))).applyMatrix4(local);}
 root.add(bench());
 return true;
}

// The bench under the tree, facing the pond down the bridge: a wooden seat and back on red lacquered legs and arms.
// It joins the ship so the walk's seats (rest.js) find it by its seat and back names, and the colliders hold it.
function bench(){
 const g=new T.Group();g.name='Blossom_bench';
 const wood=new T.MeshStandardMaterial({name:'Blossom_bench_wood',color:0x9a6a45,roughness:.7}),red=new T.MeshStandardMaterial({name:'Blossom_bench_lacquer',color:RED,roughness:.45});
 const part=(name,size,[x,y,z],mat,tilt=0)=>{const o=new T.Mesh(new T.BoxGeometry(...size),mat);o.name=name;o.position.set(BENCH.x+x,SOIL+y,BENCH.z+z);o.rotation.z=tilt;o.castShadow=o.receiveShadow=true;g.add(o);};
 part('Garden_bench_cushion',[.5,.07,1.7],[0,.465,0],wood);
 part('Garden_bench_back',[.06,.42,1.7],[.28,.79,0],wood,-.12);
 for(const z of [-.8,.8]){
  for(const x of [-.2,.2])part('Blossom_bench_leg',[.07,.43,.07],[x,.215,z],red);
  part('Blossom_bench_post',[.06,.7,.06],[.27,.64,z],red);part('Blossom_bench_arm',[.58,.05,.07],[0,.7,z],red);
 }
 return g;
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

// A koi heading +z: an orange body with white patches, a fanned tail and two side fins, as one vertex-coloured geometry.
function koiGeometry(){
 const body=new T.SphereGeometry(1,10,6).scale(.05,.035,.16).toNonIndexed(),p=body.attributes.position,col=new Float32Array(p.count*3),c=new T.Color();
 for(let i=0;i<p.count;i+=3){c.set(Math.sin(p.getZ(i)*40+1)+Math.sin(p.getX(i)*70)*.6>1.05?0xfff4ea:0xff5a0a);for(let k=0;k<3;k++)c.toArray(col,(i+k)*3);}
 body.setAttribute('color',new T.BufferAttribute(col,3));body.deleteAttribute('uv');
 const shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.08,-.05,.07,-.12);shape.lineTo(0,-.08);shape.lineTo(-.07,-.12);shape.quadraticCurveTo(-.08,-.05,0,0);
 const tail=tinted(new T.ShapeGeometry(shape,3).rotateX(Math.PI/2).translate(0,0,-.13),0xff8a3a);
 const fins=[-1,1].map(s=>tinted(new T.SphereGeometry(1,6,3).scale(.045,.005,.022).rotateY(s*.6).translate(s*.055,-.012,.05),0xffb27a));
 return mergeGeometries([body,tail,...fins]);
}

// The garden, in ship coordinates. `group` draws (with its deck band), `solid` holds the trunk, the bridge and the pond's
// edges for the colliders, and update() lets the petals fall, the butterflies fly, the water run and the koi swim while
// the walker is within NEAR metres, and fades the falls' sound in and out.
export function createBlossomGarden(ship){
 const root=frameOf(ship);if(!root)return null;
 const rnd=seeded(9517),centre=new T.Vector3(BED.x,SOIL,BED.z).applyMatrix4(root.matrixWorld);
 // Drawn in the template frame, under a group placed at the bed so it joins the right deck band.
 const group=new T.Group();group.name='Cherry_blossom_garden';group.position.copy(centre);
 const frame=new T.Group();frame.matrixAutoUpdate=false;frame.matrix.makeTranslation(-centre.x,-centre.y,-centre.z).multiply(root.matrixWorld);group.add(frame);
 const solid=new T.Group();solid.name='Cherry_blossom_colliders';solid.matrixAutoUpdate=false;solid.matrix.copy(root.matrixWorld);
 const block=(w,h,d,x,y,z,rz=0)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d));o.position.set(x,y,z);o.rotation.z=rz;solid.add(o);};
 const white=(name,o={})=>new T.MeshStandardMaterial({name,color:0xffffff,roughness:.75,...o});
 const stoneMat=new T.MeshStandardMaterial({name:'Blossom_stone',vertexColors:true,flatShading:true,roughness:.95});
 const stoneTint=()=>new T.Color(0x8d8a80).multiplyScalar(.82+rnd()*.3).lerp(new T.Color(0xa08a6a),rnd()*.4);

 frame.add(...cherry(new T.Vector3(BED.x,SOIL,BED.z),rnd));
 {const o=new T.Mesh(new T.CylinderGeometry(.55,.55,3.2,8));o.position.set(BED.x+.1,SOIL+1.6,BED.z);solid.add(o);}

 // A dry-stone wall round the planter, the pond's two sides included: two courses of irregular blocks, a capstone rim
 // over the top edge. Each edge runs corner to corner with the bed on its left, and says how far past each end its
 // stones and its caps reach (less at the inside corner by the falls). No caps where the bridge lands.
 const stones=[],W=BED.x-BED.half,E=BED.x+BED.half,S=BED.z-BED.half,N=BED.z+BED.half;
 const EDGES=[[[W,S],[E,S],.1,.1,.12,.12],[[E,S],[E,N],.1,.1,.12,.12],[[E,N],[POND.x1,N],.1,.1,.12,.12],
  [[POND.x1,N],[POND.x1,POND.z0],.1,-.12,.12,.42],[[POND.x1,POND.z0],[W,POND.z0],.02,.1,-.14,.12],[[W,POND.z0],[W,S],.1,.1,.12,.12]];
 EDGES.forEach(([[ax,az],[bx,bz],e0,e1,c0,c1],edge)=>{
  const len=Math.hypot(bx-ax,bz-az),tx=(bx-ax)/len,tz=(bz-az)/len,nx=tz,nz=-tx,turn=-Math.atan2(tz,tx);
  for(let course=0;course<2;course++){
   let s=-e0+course*.3*rnd();
   while(s<len+e1){const l=Math.min(.45+rnd()*.45,len+e1+.02-s),y=FLOOR+.16+course*.31,o=.05+rnd()*.02,mid=s+l/2;
    const g=new T.BoxGeometry(l-.03,.28+rnd()*.03,.14).rotateY(turn+(rnd()-.5)*.06).translate(ax+tx*mid+nx*o,y,az+tz*mid+nz*o);
    stones.push(tinted(g,stoneTint()));s+=l;}
  }
  let s=-c0;
  while(s<len+c1){const l=Math.min(.7+rnd()*.5,len+c1+.02-s),mid=s+l/2,x=ax+tx*mid-nx*.14,z=az+tz*mid-nz*.14;
   const g=new T.BoxGeometry(l-.025,.1,.56).rotateY(turn).translate(x,TOP+.05+rnd()*.02,z);
   if(!(edge===3&&Math.abs(z-BRIDGE.z)<BRIDGE.half+.12))stones.push(tinted(g,new T.Color(0xb3ada0).multiplyScalar(.9+rnd()*.15)));s+=l;}
 });
 {const o=new T.Mesh(mergeGeometries(stones),stoneMat);o.name='Blossom_stone_wall';o.castShadow=true;o.receiveShadow=true;frame.add(o);stones.forEach(g=>g.dispose());}

 // Green underplanting, then flowers of every kind through it, clear of the trunk and its roots, the pond and the bench.
 const open=(x,z)=>Math.hypot(x-BED.x,z-BED.z)>1.3&&!inPond(x,z,.45)&&!(x>139.6&&x<141.95&&z>33.85&&z<35.95);
 plantClumps(frame,[[136.6,145.4,27.6,32.75],[140.3,145.4,32.75,33.85],[141.95,145.4,33.85,36.4],[140.3,141.95,35.95,36.4]].map(([x0,x1,z0,z1])=>
  new T.Box3(new T.Vector3(x0,0,z0),new T.Vector3(x1,SOIL,z1))),{seed:9518,density:.7,flowers:false});
 const spot=()=>{for(;;){const x=BED.x+(rnd()-.5)*8,z=BED.z+(rnd()-.5)*8;if(open(x,z))return [x,z];}};
 const daisy=mergeGeometries([...Array.from({length:6},(_,i)=>tinted(new T.SphereGeometry(1,6,3).scale(.07,.014,.028).translate(.065,0,0).rotateY(i/6*Math.PI*2),0xffffff)),tinted(new T.SphereGeometry(.032,6,4),0xffc23a)]);
 const tulip=tinted(new T.LatheGeometry([[0,0],[.05,.02],[.065,.07],[.05,.13]].map(([x,y])=>new T.Vector2(x,y)),6),0xffffff);
 const spike=mergeGeometries(Array.from({length:6},(_,i)=>tinted(new T.IcosahedronGeometry(.04-i*.004,0).translate(0,i*.05,0),0xffffff)));
 const kinds=[[daisy,[0xffffff,0xfff2a8,0xff8fc0,0xffb347,0xd27bff],110],[tulip,[0xe8323c,0xff5a8a,0xffd23f,0xff7a1a,0xb04ad8,0xffffff],95],[spike,[0x8a5cf0,0x5a7cf0,0xd65cc8,0xc9a6ff],70]];
 const stems=[],petalMat=white('Blossom_flower',{vertexColors:true,side:T.DoubleSide,roughness:.6});
 for(const [geometry,colors,count] of kinds){
  frame.add(scatter('Blossom_flowers',geometry,petalMat,colors,count,rnd,()=>{
   const [x,z]=spot(),h=.2+rnd()*.35;stems.push([x,z,h]);
   return [new T.Vector3(x,SOIL+h,z),new T.Euler((rnd()-.5)*.4,rnd()*6,(rnd()-.5)*.4),new T.Vector3().setScalar(.85+rnd()*.5)];}));
 }
 frame.add(scatter('Blossom_flower_stems',new T.CylinderGeometry(.008,.011,1,4).translate(0,.5,0),white('Blossom_stem'),[0x4f7f45,0x5f9c46],stems.length,rnd,i=>
  [new T.Vector3(stems[i][0],SOIL,stems[i][1]),new T.Euler(),new T.Vector3(1,stems[i][2],1)]));

 // Fallen petals carpet the soil, float on the pond and spill onto the floor round the wall.
 const H=BED.half,petal=new T.CircleGeometry(.045,5).rotateX(-Math.PI/2).scale(1,1,.6),petalColour=white('Blossom_petal',{side:T.DoubleSide,roughness:.85});
 const onWater=()=>[POND.x0+.3+rnd()*(POND.x1-POND.x0-.8),WATER+.004,POND.z0+.6+rnd()*(POND.z1-POND.z0-.8)];
 frame.add(scatter('Blossom_fallen_petals',petal,petalColour,PINKS,3200,rnd,i=>{
  let x,z,y;
  if(i<2700){do{x=BED.x+(rnd()-.5)*8.4;z=BED.z+(rnd()-.5)*8.4;}while(inPond(x,z,.3));y=SOIL+.004+rnd()*.01;}
  else if(i<2820)[x,y,z]=onWater();
  else{const a=rnd()*Math.PI*2,d=H+.25+rnd()*rnd()*1.6;x=BED.x+Math.cos(a)*d*1.05;z=BED.z+Math.sin(a)*d*1.05;if(inBed(x,z,.2)){x=BED.x+Math.sign(x-BED.x)*(H+.3+rnd()*.6);}y=FLOOR+.004;
   if(inPond(x,z,.35))[x,y,z]=onWater();}
  return [new T.Vector3(x,y,z),new T.Euler((rnd()-.5)*.3,rnd()*6,(rnd()-.5)*.3),new T.Vector3().setScalar(1+rnd()*.7)];}));

 // The pond: a dark pebbled bed at floor level, a rim of rounded stones along its open sides, and still water over it.
 // Its floor is solid just under the water, so the rim is low enough to step out over but too high to step in over.
 const P=POND,pw=P.x1-P.x0,pd=P.z1-P.z0,rocks=[];
 {const o=new T.Mesh(new T.BoxGeometry(pw,.03,pd).translate((P.x0+P.x1)/2,FLOOR+.015,(P.z0+P.z1)/2),new T.MeshStandardMaterial({name:'Blossom_pond_bed',color:0x2b3833,roughness:1}));o.name='Blossom_pond_bed';frame.add(o);}
 frame.add(scatter('Blossom_pond_pebbles',new T.IcosahedronGeometry(.05,0).scale(1,.45,.8),white('Blossom_pebble',{flatShading:true,roughness:.9}),[0x6f6a60,0x8d877a,0x4f4b45,0xa49a88],70,rnd,()=>
  [new T.Vector3(P.x0+.25+rnd()*(pw-.5),FLOOR+.035,P.z0+.25+rnd()*(pd-.5)),new T.Euler(0,rnd()*6,0),new T.Vector3().setScalar(.7+rnd()*.9)]));
 const gap=z=>Math.abs(z-BRIDGE.z)<BRIDGE.half+.08,rimTop=FLOOR+.48;
 const rim=(x,z)=>{const r=.16+rnd()*.07;rocks.push(tinted(new T.IcosahedronGeometry(r,1).scale(1.2,.85,1.1).rotateY(rnd()*6).translate(x,rimTop-r*.85,z),stoneTint()));};
 for(let z=P.z0+.08;z<P.z1;z+=.27+rnd()*.08)if(!gap(z))rim(P.x0+.14,z);
 for(let x=P.x0+.3;x<P.x1-.05;x+=.27+rnd()*.08)rim(x,P.z1-.14);
 block(pw,.15,pd,(P.x0+P.x1)/2,FLOOR+.075,(P.z0+P.z1)/2);
 for(const [z0,z1] of [[P.z0,BRIDGE.z-BRIDGE.half-.02],[BRIDGE.z+BRIDGE.half+.02,P.z1]])block(.3,.48,z1-z0,P.x0+.14,FLOOR+.24,(z0+z1)/2);
 block(pw,.48,.3,(P.x0+P.x1)/2,FLOOR+.24,P.z1-.14);
 // The falls: rocks piled in the corner the bed wraps round, rising above the soil; the water leaves a lip between them.
 for(const [x,y,z,r] of [[139.5,24.55,33.5,.42],[139.08,24.45,33.42,.3],[139.55,24.5,33.95,.28],[139.62,25.05,33.45,.36],[139.68,25.4,33.78,.28],[139.5,25.36,33.38,.27],[139.74,25.74,33.52,.24],[139.85,25.25,34.05,.22]])
  rocks.push(tinted(new T.IcosahedronGeometry(r,1).scale(1,.8+rnd()*.25,1).rotateY(rnd()*6).translate(x,y,z),stoneTint().multiplyScalar(.9)));
 block(.6,1.65,.75,139.6,FLOOR+.83,33.57);
 // Flat stepping stones from the bridge to the bench.
 for(const [x,z,r] of [[140.28,35,.2],[140.62,34.88,.18]])rocks.push(tinted(new T.CylinderGeometry(r,r*1.05,.05,7).scale(1.2,1,1).rotateY(rnd()*6).translate(x,SOIL-.01,z),new T.Color(0xa7a194).multiplyScalar(.9+rnd()*.15)));
 // Lily pads on the still side of the pond, one with a pink flower.
 for(const [x,z,r] of [[137.05,33.75,.17],[137.4,36.05,.15],[138.85,36.1,.13],[136.95,34.05,.11]])rocks.push(tinted(new T.CircleGeometry(r,12,.3,Math.PI*2-.5).rotateX(-Math.PI/2).rotateY(rnd()*6).translate(x,WATER+.006,z),0x4f8a3e));
 for(let i=0;i<6;i++)rocks.push(tinted(new T.SphereGeometry(1,5,3).scale(.035,.025,.012).translate(0,.02,.03).rotateX(-.6).rotateY(i/6*Math.PI*2).translate(137.05,WATER+.03,33.75),0xf7a8c8));
 {const o=new T.Mesh(mergeGeometries(rocks),stoneMat);o.name='Blossom_pond_stones';o.castShadow=true;o.receiveShadow=true;frame.add(o);rocks.forEach(g=>g.dispose());}
 const water=new T.Mesh(new T.PlaneGeometry(pw-.12,pd-.12).rotateX(-Math.PI/2).translate((P.x0+P.x1)/2,WATER,(P.z0+P.z1)/2),
  new T.MeshStandardMaterial({name:'Blossom_pond_water',color:0x3d8f9a,transparent:true,opacity:.48,roughness:.06,metalness:.2,emissive:0x0d3a40,emissiveIntensity:.4,depthWrite:false}));
 water.name='Blossom_pond_water';water.renderOrder=1;frame.add(water);

 // The waterfall: a clear sheet curving out from the lip as it falls into the pond, streaks running down it, foam and
 // rings where it lands.
 const drop=FALLS.lip-WATER,sheet=new T.PlaneGeometry(.42,drop,1,8);
 {const p=sheet.attributes.position;for(let i=0;i<p.count;i++){const t=(drop/2-p.getY(i))/drop,w=p.getX(i);p.setXYZ(i,FALLS.x-.02-.2*t*t,FALLS.lip-t*drop,FALLS.z+w*(1+t*.35));}sheet.computeVertexNormals();}
 {const o=new T.Mesh(sheet,new T.MeshStandardMaterial({name:'Blossom_falls',color:0xd8f4f7,transparent:true,opacity:.55,emissive:0x5a9aa4,emissiveIntensity:.35,roughness:.1,side:T.DoubleSide,depthWrite:false}));
  o.name='Blossom_falls';o.renderOrder=2;frame.add(o);}
 const STREAK=36,streaks=new T.InstancedMesh(new T.BoxGeometry(.012,.2,.012),new T.MeshBasicMaterial({name:'Blossom_falls_streak',color:0xf2fdff,transparent:true,opacity:.8,depthWrite:false}),STREAK);
 const runs=Array.from({length:STREAK},()=>({z:(rnd()-.5)*.38,ph:rnd(),speed:.9+rnd()*.4}));
 const IMPACT=new T.Vector3(FALLS.x-.22,WATER,FALLS.z);
 const FOAM=9,foam=new T.InstancedMesh(new T.IcosahedronGeometry(.07,1),new T.MeshStandardMaterial({name:'Blossom_falls_foam',color:0xffffff,transparent:true,opacity:.85,roughness:.4}),FOAM);
 const bubbles=Array.from({length:FOAM},(_,i)=>({x:IMPACT.x+(rnd()-.6)*.25,z:IMPACT.z+(i/(FOAM-1)-.5)*.5,ph:rnd()*6}));
 const rings=Array.from({length:3},(_,i)=>{const o=new T.Mesh(new T.RingGeometry(.92,1,28).rotateX(-Math.PI/2),new T.MeshBasicMaterial({name:'Blossom_ripple',color:0xffffff,transparent:true,opacity:0,depthWrite:false}));
  o.name='Blossom_ripple';o.position.set(IMPACT.x-.05,WATER+.004,IMPACT.z);o.userData.ph=i/3;o.renderOrder=2;frame.add(o);return o;});
 streaks.name='Blossom_falls_streaks';foam.name='Blossom_falls_foam';streaks.frustumCulled=foam.frustumCulled=false;streaks.renderOrder=2;frame.add(streaks,foam);

 // Koi wander the pond just under the surface, passing under the bridge.
 const KOI=7,koi=new T.InstancedMesh(koiGeometry(),new T.MeshStandardMaterial({name:'Blossom_koi',vertexColors:true,roughness:.45,side:T.DoubleSide,emissive:0xff4a00,emissiveIntensity:.18}),KOI);
 const KC={x:138,z:35},fish=Array.from({length:KOI},()=>({rx:.55+rnd()*.65,rz:.5+rnd()*.7,w:(.22+rnd()*.25)*(rnd()<.5?-1:1),ph:rnd()*6,y:WATER-.035-rnd()*.05,size:.8+rnd()*.5}));
 [0xffffff,0xffffff,0xffe2b8,0xffd0a0,0xffffff,0xfff0d8,0xffe0b0].forEach((col,i)=>koi.setColorAt(i,new T.Color(col)));
 koi.name='Blossom_koi';koi.frustumCulled=false;frame.add(koi);

 // The red bridge: an arched deck from the floor at the planter's edge, over the pond, to the soil by the bench, with
 // lacquered side beams, posts with gold caps and a handrail on each side. Its planks and rails are solid.
 const span=BRIDGE.x1-BRIDGE.x0,deck=x=>{const u=(x-BRIDGE.x0)/span;return FLOOR+.05+(SOIL+.04-FLOOR-.05)*u+.5*Math.sin(Math.PI*u);};
 const slope=x=>Math.atan2(deck(x+.01)-deck(x-.01),.02),bridge=[];
 const bar=(a,b,w,h,color)=>{const d=new T.Vector3().subVectors(b,a);bridge.push(tinted(new T.BoxGeometry(d.length()+.02,h,w).rotateZ(Math.atan2(d.y,d.x)).translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2),color));};
 const PLANKS=15;
 for(let i=0;i<PLANKS;i++){const x=BRIDGE.x0+(i+.5)*span/PLANKS,a=slope(x),l=span/PLANKS/Math.cos(a)-.025,y=deck(x)-.025;
  bridge.push(tinted(new T.BoxGeometry(l,.05,BRIDGE.half*2).rotateZ(a).translate(x,y,BRIDGE.z),new T.Color(0xa4483a).multiplyScalar(.9+rnd()*.15)));block(l,.05,BRIDGE.half*2,x,y,BRIDGE.z,a);}
 const STEPS=12,at=(k,s,up)=>{const x=BRIDGE.x0+k*span/STEPS;return new T.Vector3(x,deck(x)+up,BRIDGE.z+s*(BRIDGE.half+.03));};
 for(const s of [-1,1]){
  for(let k=0;k<STEPS;k++){
   bar(at(k,s,-.1),at(k+1,s,-.1),.08,.2,RED);bar(at(k,s,.84),at(k+1,s,.84),.07,.06,RED);bar(at(k,s,.42),at(k+1,s,.42),.04,.04,RED);
   const a=at(k,s,.45),b=at(k+1,s,.45);block(a.distanceTo(b)+.02,.95,.1,(a.x+b.x)/2,(a.y+b.y)/2,a.z,Math.atan2(b.y-a.y,b.x-a.x));
  }
  for(let k=0;k<=STEPS;k+=3){const p=at(k,s,0);bridge.push(tinted(new T.BoxGeometry(.1,1.02,.1).translate(p.x,p.y+.36,p.z),RED));
   bridge.push(tinted(new T.SphereGeometry(.065,8,6).scale(1,1.15,1).translate(p.x,p.y+.93,p.z),0xd8aa4c),tinted(new T.ConeGeometry(.03,.08,8).translate(p.x,p.y+1.03,p.z),0xd8aa4c));}
 }
 {const o=new T.Mesh(mergeGeometries(bridge),new T.MeshStandardMaterial({name:'Blossom_bridge',vertexColors:true,roughness:.45}));o.name='Blossom_bridge';o.castShadow=true;o.receiveShadow=true;frame.add(o);bridge.forEach(g=>g.dispose());}

 // Petals falling from the canopy: each drifts down with a sway and a tumble, and starts again at the top on landing.
 const FALL=160,falling=new T.InstancedMesh(petal,petalColour,FALL),drift=[];falling.name='Blossom_falling_petals';falling.frustumCulled=false;
 const reset=(d,top)=>{const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*3.6;d.x=BED.x+Math.cos(a)*r;d.z=BED.z+Math.sin(a)*r;d.y=top?SOIL+3+rnd()*2.2:SOIL+rnd()*5;
  d.speed=.22+rnd()*.25;d.phase=rnd()*6;d.sway=.15+rnd()*.25;d.spin=1+rnd()*2.5;};
 const c=new T.Color();for(let i=0;i<FALL;i++){const d={};reset(d,false);drift.push(d);falling.setColorAt(i,c.set(PINKS[rnd()*PINKS.length|0]));}
 frame.add(falling);

 // Butterflies: two wings each, hinged on the body and beating as they wander round the tree.
 const wingShape=new T.Shape();wingShape.moveTo(0,-.02);wingShape.bezierCurveTo(.07,-.09,.15,-.07,.13,.0);wingShape.bezierCurveTo(.17,.07,.1,.12,0,.04);
 const FLY=8,wings=new T.InstancedMesh(new T.ShapeGeometry(wingShape,4).rotateX(-Math.PI/2),white('Blossom_butterfly',{side:T.DoubleSide,roughness:.5}),FLY*2);
 const bodies=new T.InstancedMesh(new T.CapsuleGeometry(.012,.07,2,4).rotateX(Math.PI/2),new T.MeshStandardMaterial({name:'Blossom_butterfly_body',color:0x1e1a18,roughness:.6}),FLY);
 wings.name='Blossom_butterflies';bodies.name='Blossom_butterfly_bodies';wings.frustumCulled=bodies.frustumCulled=false;
 const flies=Array.from({length:FLY},(_,i)=>({r:2+rnd()*3,h:SOIL+.4+rnd()*1.8,w:(.18+rnd()*.2)*(rnd()<.5?-1:1),ph:rnd()*6,beat:11+rnd()*5}));
 [0xf28a1e,0x3d8be0,0xf6d23c,0xf4f0e8,0xff7fb5,0xf28a1e,0x6ad1e0,0xffffff].forEach((col,i)=>{c.set(col);wings.setColorAt(2*i,c);wings.setColorAt(2*i+1,c);});
 frame.add(wings,bodies);

 const m=new T.Matrix4(),q=new T.Quaternion(),q2=new T.Quaternion(),e=new T.Euler(),p=new T.Vector3(),s=new T.Vector3(1,1,1),k=new T.Vector3();
 const flip=new T.Vector3(-1,1,1),fwd=new T.Vector3(0,0,1),UP=T.Object3D.DEFAULT_UP;
 let time=0;
 function animate(dt){
  time+=dt;
  for(let i=0;i<FALL;i++){const d=drift[i];d.y-=d.speed*dt;
   const floor=inPond(d.x,d.z)?WATER:inBed(d.x,d.z)?SOIL:FLOOR;if(d.y<floor)reset(d,true);
   const t=time*1.3+d.phase;p.set(d.x+Math.sin(t)*d.sway,d.y,d.z+Math.cos(t*.8)*d.sway);
   falling.setMatrixAt(i,m.compose(p,q.setFromEuler(e.set(t*d.spin,t*.7,Math.sin(t)*1.2)),s));}
  falling.instanceMatrix.needsUpdate=true;
  flies.forEach((f,i)=>{const t=time*f.w+f.ph;
   p.set(BED.x+Math.cos(t)*f.r+Math.sin(t*2.7)*.35,f.h+Math.sin(t*3.1)*.3+Math.sin(time*4+f.ph)*.04,BED.z+Math.sin(t)*f.r+Math.cos(t*2.3)*.35);
   // Heading along the path (its derivative), so each one flies where it's going.
   const yaw=Math.atan2(-Math.sin(t)*f.r*f.w,Math.cos(t)*f.r*f.w);q.setFromAxisAngle(UP,yaw);
   bodies.setMatrixAt(i,m.compose(p,q,s));
   const flap=.25+Math.sin(time*f.beat+f.ph)*.95;
   wings.setMatrixAt(2*i,m.compose(p,q2.setFromAxisAngle(fwd,-flap).premultiply(q),s));
   wings.setMatrixAt(2*i+1,m.compose(p,q2.setFromAxisAngle(fwd,flap).premultiply(q),flip));
  });
  wings.instanceMatrix.needsUpdate=bodies.instanceMatrix.needsUpdate=true;
  // The water runs down the sheet, gathering speed, and churns where it lands.
  q.identity();
  runs.forEach((r,i)=>{const f=(time*r.speed+r.ph)%1,t=f*f;p.set(FALLS.x-.03-.2*t,FALLS.lip-.08-t*(drop-.1),FALLS.z+r.z*(1+t*.35));streaks.setMatrixAt(i,m.compose(p,q,s));});
  bubbles.forEach((b,i)=>{const g=.7+.45*Math.sin(time*7+b.ph);p.set(b.x,WATER+.015,b.z);foam.setMatrixAt(i,m.compose(p,q,k.set(g,g*.45,g)));});
  streaks.instanceMatrix.needsUpdate=foam.instanceMatrix.needsUpdate=true;
  for(const o of rings){const f=(time*.55+o.userData.ph)%1,r=.12+f*.5;o.scale.set(r,1,r);o.material.opacity=(1-f)*.45;}
  fish.forEach((f,i)=>{const t=time*f.w+f.ph;p.set(KC.x+Math.cos(t)*f.rx,f.y,KC.z+Math.sin(t)*f.rz);
   const yaw=Math.atan2(-Math.sin(t)*f.rx*f.w,Math.cos(t)*f.rz*f.w)+Math.sin(time*5+f.ph)*.16;
   koi.setMatrixAt(i,m.compose(p,q.setFromAxisAngle(UP,yaw),k.setScalar(f.size)));});
  koi.instanceMatrix.needsUpdate=true;
 }
 animate(0);

 // The falls' sound: looped noise shaped like a small creek, bright and light on low rumble, made with Web Audio as the
 // ship's hum is (ambience.js), with small bubbles plinking into the water every so often. It follows the Sound button
 // and fades in as you come near.
 let ctx=null,gain=null,plink=0;
 function sound(){
  ctx=new (window.AudioContext||window.webkitAudioContext)();gain=ctx.createGain();gain.gain.value=0;gain.connect(ctx.destination);
  const n=ctx.sampleRate*3,fade=2048,buf=ctx.createBuffer(2,n,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let b=0;for(let i=0;i<n;i++){const w=Math.random()*2-1;b=(b+.04*w)/1.04;d[i]=w*.4+b*1.6;}
   for(let i=0;i<fade;i++){const f=i/fade;d[i]=d[i]*f+d[n-fade+i]*(1-f);}}// the loop's ends cross-faded, so it has no seam
  const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;src.loopEnd=(n-fade)/ctx.sampleRate;
  const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=400;
  const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=3000;
  const body=ctx.createBiquadFilter();body.type='peaking';body.frequency.value=1200;body.gain.value=2;
  // The splash brightens and dulls a little, unevenly, as falling water does.
  for(const [rate,depth] of [[.21,500],[.53,300]]){const o=ctx.createOscillator();o.frequency.value=rate;const g=ctx.createGain();g.gain.value=depth;o.connect(g).connect(low.frequency);o.start();}
  src.connect(high).connect(low).connect(body).connect(gain);src.start();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)ctx.suspend();else ctx.resume();});
 }
 function drip(level){
  const t=ctx.currentTime,o=ctx.createOscillator(),v=ctx.createGain(),f=900+Math.random()*1100;
  o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*2.2,t+.06);
  v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(.05*level,t+.005);v.gain.exponentialRampToValueAtTime(.0001,t+.09);
  o.connect(v).connect(ctx.destination);o.start(t);o.stop(t+.1);
 }
 const here=new T.Vector3(),falls=IMPACT.clone().applyMatrix4(root.matrixWorld);
 return {group,solid,
  update(dt,walker,soundOn=false){
   if(walker.distanceTo(here.copy(centre))<NEAR)animate(Math.min(dt,.1));
   const d=walker.distanceTo(falls),level=soundOn&&Math.abs(walker.y-falls.y)<4&&d<HEAR?(1-d/HEAR)**2:0;
   if(level>0&&!ctx&&navigator.userActivation?.hasBeenActive!==false)sound();
   if(!ctx)return;
   gain.gain.setTargetAtTime(level*.55,ctx.currentTime,.4);
   if(level>0&&ctx.state==='running'&&(plink-=dt)<=0){plink=.08+Math.random()*.4;drip(level);}
  },
  // Where the falls' sound comes from, for checks.
  falls,
 };
}
