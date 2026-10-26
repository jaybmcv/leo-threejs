import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {seeded,standard} from './polish-kit.js';

// Stylized, flat-shaded planting for the tour: game-like trees built from a tapered trunk, a few branches and a
// canopy of leaf clusters (one merged, vertex-coloured mesh per tree), plus instanced clumps for beds and planters.

const GREENS=[0x3f7236,0x4f8a3f,0x5f9c46,0x6fae4f,0x86bd5d];
export const EMBERS=[0xc4461a,0xe0621f,0xf28a34,0xd9542a,0xf2a950];// a Mars-orange ornamental
const bark=standard(0x6b4a32,{roughness:.9,flatShading:true});
const canopyMaterial=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.85});

function tinted(geometry,color){
 const g=geometry.index?geometry.toNonIndexed():geometry,c=new T.Color(color),colors=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
 g.setAttribute('color',new T.BufferAttribute(colors,3));g.deleteAttribute('uv');return g;
}
function limb(from,to,r0,r1){
 const d=new T.Vector3().subVectors(to,from),g=new T.CylinderGeometry(r1,r0,d.length(),7,1);
 g.translate(0,d.length()/2,0).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize())).translate(from.x,from.y,from.z);
 g.deleteAttribute('uv');return g;
}

// A tree rooted at `base`, `height` metres tall, canopy `spread` metres across.
export function stylizedTree(base,{height=6.5,spread=5,palette=GREENS,seed=1}={}){
 const rnd=seeded(seed),tree=new T.Group();tree.name='Stylized_tree';
 const top=new T.Vector3(base.x+(rnd()-.5)*.3,base.y+height*.62,base.z+(rnd()-.5)*.3);
 const wood=[limb(base,top,height*.05,height*.028)],tips=[top];
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2+rnd()*.6,from=new T.Vector3().lerpVectors(base,top,.55+rnd()*.35);
  const tip=from.clone().add(new T.Vector3(Math.cos(a)*spread*.32,height*(.12+rnd()*.12),Math.sin(a)*spread*.32));wood.push(limb(from,tip,height*.02,height*.01));tips.push(tip);}
 const trunk=new T.Mesh(mergeGeometries(wood),bark);trunk.name='Stylized_tree_trunk';trunk.castShadow=true;tree.add(trunk);
 const blobs=[],centre=top.clone().add(new T.Vector3(0,height*.12,0));
 for(let i=0;i<26;i++){
  const anchor=i<tips.length?tips[i]:centre,r=spread*(.13+rnd()*.1),g=tinted(new T.IcosahedronGeometry(r,1),palette[rnd()*palette.length|0]);
  const a=rnd()*Math.PI*2,u=rnd(),off=i<tips.length?new T.Vector3():new T.Vector3(Math.cos(a)*spread*.36*Math.sqrt(u),(rnd()-.35)*height*.2,Math.sin(a)*spread*.36*Math.sqrt(u));
  g.scale(1,.78,1).translate(anchor.x+off.x,anchor.y+off.y,anchor.z+off.z);blobs.push(g);
 }
 const canopy=new T.Mesh(mergeGeometries(blobs),canopyMaterial);canopy.name='Stylized_tree_canopy';canopy.castShadow=true;canopy.receiveShadow=true;tree.add(canopy);
 return tree;
}

// Instanced leafy clumps, grasses and (optionally) flowers over the top of each box, `density` scaling the counts per m².
export function plantClumps(parent,boxes,{seed=509,density=1,flowers=true}={}){
 const rnd=seeded(seed),clump=new T.IcosahedronGeometry(.22,0),blade=new T.ConeGeometry(.05,.7,4),bloom=new T.IcosahedronGeometry(.07,0);
 const area=b=>(b.max.x-b.min.x)*(b.max.z-b.min.z);
 const kinds=[[clump,standard(0x4f7f45,{roughness:.9,flatShading:true}),8],[blade,standard(0x7fa85a,{roughness:.9}),12]];
 if(flowers)kinds.push([bloom,standard(0xf85800,{roughness:.6,emissive:0x5a1e00,emissiveIntensity:.25}),3.5],[bloom,standard(0xf4f0e8,{roughness:.6}),3.5]);
 const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),p=new T.Vector3(),sc=new T.Vector3();
 for(const [geometry,material,perSquareMetre] of kinds){
  const counts=boxes.map(b=>Math.round(area(b)*perSquareMetre*density)),mesh=new T.InstancedMesh(geometry,material,counts.reduce((a,c)=>a+c,0));
  mesh.name='Planting_detail';mesh.receiveShadow=true;
  let i=0;boxes.forEach((b,bi)=>{for(let k=0;k<counts[bi];k++){
   const tall=geometry===blade,lift=geometry===bloom?.35+rnd()*.35:tall?.3:.08;
   p.set(b.min.x+.15+rnd()*(b.max.x-b.min.x-.3),b.max.y+lift,b.min.z+.15+rnd()*(b.max.z-b.min.z-.3));
   e.set(tall?(rnd()-.5)*.5:rnd()*6,rnd()*6,tall?(rnd()-.5)*.5:0);sc.setScalar(.6+rnd()*.9);
   mesh.setMatrixAt(i++,m.compose(p,q.setFromEuler(e),sc));
  }});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();parent.add(mesh);
 }
}

// A full potted shrub as one merged, vertex-coloured, faceted geometry rooted at the origin: overlapping leaf
// clusters fill an upright, rounded outline, with smaller leaf tips breaking the silhouette.
export function shrubGeometry({height=1.6,spread=1.1,palette=GREENS,seed=1}={}){
 const rnd=seeded(seed),parts=[];
 const leaf=(r,detail,x,y,z,color)=>{const g=tinted(new T.IcosahedronGeometry(r,detail),color);g.rotateY(rnd()*6).scale(1,.85,1).translate(x,y,z);parts.push(g);};
 for(let i=0;i<30;i++){
  const t=.12+rnd()*.78,a=rnd()*Math.PI*2,edge=Math.sin(Math.PI*Math.min(1,t*1.05))*spread*.42,d=edge*(.45+rnd()*.55);
  leaf(spread*(.15+rnd()*.07),1,Math.cos(a)*d,t*height,Math.sin(a)*d,palette[rnd()*palette.length|0]);
 }
 leaf(spread*.2,1,0,height*.9,0,palette[3]);
 for(let i=0;i<22;i++){
  const t=.25+rnd()*.7,a=i*2.4+rnd()*.4,d=Math.sin(Math.PI*t)*spread*.5+.04;
  leaf(spread*(.06+rnd()*.035),0,Math.cos(a)*d,t*height,Math.sin(a)*d,palette[(rnd()*2|0)+3]);
 }
 const g=mergeGeometries(parts);g.computeVertexNormals();return g;// non-indexed, so normals stay faceted in exports
}

// A giant faceted boulder, `width` x `height` x `depth` metres, sitting on y=0: a lumpy icosphere with a flat base and
// each facet a slightly different weathered grey or brown (one non-indexed, vertex-coloured mesh).
const STONES=[0x6c665e,0x7b746a,0x5d5852,0x8a8173,0x6e6255,0x948b7e];
export function boulderGeometry({width=2.4,height=2.6,depth=2,palette=STONES,seed=1}={}){
 const rnd=seeded(seed),g=new T.IcosahedronGeometry(1,2),p=g.attributes.position,v=new T.Vector3();
 const bumps=Array.from({length:9},()=>[new T.Vector3(rnd()-.5,rnd()-.5,rnd()-.5).normalize(),(rnd()-.4)*.35]);
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i).normalize();const r=1+bumps.reduce((s,[d,a])=>s+a*Math.max(0,v.dot(d))**3,0);
  v.multiplyScalar(r);v.y=Math.max(v.y,-.7);p.setXYZ(i,v.x*width/2,(v.y+.7)/1.7*height,v.z*depth/2);
 }
 const colors=new Float32Array(p.count*3),c=new T.Color();
 for(let i=0;i<p.count;i+=3){c.set(palette[rnd()*palette.length|0]).multiplyScalar(.85+p.getY(i)/height*.25);for(let k=0;k<3;k++)c.toArray(colors,(i+k)*3);}
 g.setAttribute('color',new T.BufferAttribute(colors,3));g.deleteAttribute('uv');g.computeVertexNormals();return g;
}
