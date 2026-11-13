import * as T from 'three';
import {cleanOutfit} from './outfits.js';

// The wardrobe (from tester feedback): a bomber jacket for the visitor's own cat only (main.js; never other visitors,
// whose walkers this is not given). The jacket is the hoodie's own shell lifted off it a little, skinned to the same
// bones with the same weights, so it walks, runs, sits, swims and emotes exactly as the hoodie does. Its faces take the
// jacket's colours by where they are on the hoodie: ribbed cuffs past the wrists, a ribbed waistband round the hem and
// a ribbed collar round the neck; a zip runs up the front. Worn, the hoodie's parts hide; built once, on first wear.
// The hoodie's parts: its body and sleeves, the front pocket, the drawstrings and their eyelets.
const HOODIE=['hoodie.001','hoodie.002','NurbsPath','Cylinder'];
// In the hoodie's bind space (T-pose, arms along x, near-metre units): how far the shell lifts off, where the cuffs
// start along the arms, where the waistband ends and the collar starts on the torso.
const LIFT=.011,CUFF_X=.5,WAIST_Y=.63,COLLAR_Y=1.045,TORSO_X=.27;
// The zip: tape and teeth half-widths, how far each stands off the shell, from the hem to the collar.
const TAPE=.016,TEETH=.006,ZIP_FROM=.57,ZIP_TO=1.07,ZIP_STEP=.02;
const SHELL=0x56623a,RIB=0x24262a,TAPE_C=0x1b1c1e,METAL=0xb7b4aa;

const nameOf=m=>m.userData.originalName??m.name;
export function bomberGeometry(source){
 const pos=source.attributes.position,nor=source.attributes.normal,ids=source.attributes.skinIndex,ws=source.attributes.skinWeight;
 // Normals summed where the hoodie's seams split a point, so the shell lifts off in one piece.
 const key=i=>pos.getX(i).toFixed(4)+','+pos.getY(i).toFixed(4)+','+pos.getZ(i).toFixed(4),sums=new Map(),v=new T.Vector3();
 for(let i=0;i<pos.count;i++){const k=key(i);if(!sums.has(k))sums.set(k,new T.Vector3());sums.get(k).add(v.fromBufferAttribute(nor,i));}
 const lifted=[],normals=[];
 for(let i=0;i<pos.count;i++){const n=sums.get(key(i)).clone().normalize();normals.push(n);lifted.push(v.fromBufferAttribute(pos,i).clone().addScaledVector(n,LIFT));}
 const out={position:[],normal:[],color:[],skinIndex:[],skinWeight:[]},col=new T.Color();
 const corner=(p,n,c,bones)=>{out.position.push(p.x,p.y,p.z);out.normal.push(n.x,n.y,n.z);out.color.push(c.r,c.g,c.b);
  for(let k=0;k<4;k++){out.skinIndex.push(bones[k]?.[0]??0);out.skinWeight.push(bones[k]?.[1]??0);}};
 const skinOf=i=>[0,1,2,3].map(k=>[ids.getComponent(i,k),ws.getComponent(i,k)]).filter(b=>b[1]>0);
 // The shell, face by face, coloured by where the face's middle is on the hoodie.
 const index=source.index,tris=[],c=new T.Vector3();
 for(let t=0;t<index.count;t+=3){
  const a=index.getX(t),b=index.getX(t+1),d=index.getX(t+2);tris.push([a,b,d]);
  c.fromBufferAttribute(pos,a).add(v.fromBufferAttribute(pos,b)).add(v.fromBufferAttribute(pos,d)).divideScalar(3);
  const rib=Math.abs(c.x)>CUFF_X||Math.abs(c.x)<TORSO_X&&(c.y<WAIST_Y||c.y>COLLAR_Y);col.set(rib?RIB:SHELL);
  for(const i of [a,b,d])corner(lifted[i],normals[i],col,skinOf(i));
 }
 // The zip, up the front at x=0: each step meets the shell's front face, and takes its point's blend of that face's
 // weights (as the shorts' pockets do in the Cosmo kit), so it bends with the chest.
 const ray=new T.Ray(),hit=new T.Vector3(),bary=new T.Vector3(),rail=[];
 for(let y=ZIP_FROM;y<=ZIP_TO+1e-6;y+=ZIP_STEP){
  ray.set(new T.Vector3(0,y,1),new T.Vector3(0,0,-1));let best=null;
  for(const tri of tris){const [a,b,d]=tri.map(i=>lifted[i]);if(!ray.intersectTriangle(a,b,d,false,hit))continue;if(best&&hit.z<=best.at.z)continue;
   T.Triangle.getBarycoord(hit,a,b,d,bary);best={at:hit.clone(),tri,w:bary.toArray()};}
  if(!best)continue;
  const blend=new Map(),n=new T.Vector3();
  best.tri.forEach((i,j)=>{n.addScaledVector(normals[i],best.w[j]);for(const [bone,w] of skinOf(i))blend.set(bone,(blend.get(bone)??0)+w*best.w[j]);});
  const bones=[...blend].sort((p,q)=>q[1]-p[1]).slice(0,4),total=bones.reduce((s,b)=>s+b[1],0);bones.forEach(b=>b[1]/=total);
  rail.push({at:best.at,n:n.normalize(),bones});
 }
 const strip=(half,off,hex)=>{col.set(hex);for(let k=0;k+1<rail.length;k++){const p=rail[k],q=rail[k+1];
  const pts=[[p,-half],[p,half],[q,half],[q,-half]].map(([r,x])=>[r.at.clone().addScaledVector(r.n,off).setX(x),r]);
  for(const j of [0,1,2,0,2,3])corner(pts[j][0],pts[j][1].n,col,pts[j][1].bones);}};
 strip(TAPE,.003,TAPE_C);strip(TEETH,.005,METAL);
 // The pull, hanging from the top of the zip.
 const top=rail.at(-1);if(top){col.set(METAL);const at=(x,y)=>top.at.clone().addScaledVector(top.n,.007).add(new T.Vector3(x,y,0));
  const pts=[at(-.009,-.002),at(.009,-.002),at(.008,-.042),at(-.008,-.042)];for(const j of [0,1,2,0,2,3])corner(pts[j],top.n,col,top.bones);}
 const g=new T.BufferGeometry();g.name='Wardrobe_bomber';
 g.setAttribute('position',new T.Float32BufferAttribute(out.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(out.normal,3));
 g.setAttribute('color',new T.Float32BufferAttribute(out.color,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(out.skinIndex,4));
 g.setAttribute('skinWeight',new T.Float32BufferAttribute(out.skinWeight,4));g.computeBoundingBox();g.computeBoundingSphere();
 return g;
}

// `figure`: the visitor's own walker's (avatar.js createWalker). Returns {set(outfit), outfit, jacket, dispose()}.
export function createWardrobe(figure){
 const parts=figure.asset.meshes.filter(m=>HOODIE.includes(nameOf(m))),hoodie=parts.find(m=>nameOf(m)==='hoodie.001');
 let jacket=null,material=null,outfit='default';
 function build(){
  material=new T.MeshStandardMaterial({name:'Wardrobe_bomber',vertexColors:true,roughness:.6,metalness:.05,side:T.DoubleSide});
  jacket=new T.SkinnedMesh(bomberGeometry(hoodie.geometry),material);jacket.name='Wardrobe_bomber';
  jacket.position.copy(hoodie.position);jacket.quaternion.copy(hoodie.quaternion);jacket.scale.copy(hoodie.scale);
  jacket.castShadow=hoodie.castShadow;jacket.receiveShadow=hoodie.receiveShadow;
  // Culled round the pelvis as the hoodie is (dlCatFigure.ts cullAroundPelvis), wide enough for any pose.
  if(hoodie.boundingSphere)jacket.boundingSphere=hoodie.boundingSphere.clone();jacket.frustumCulled=hoodie.frustumCulled;
  hoodie.parent.add(jacket);jacket.bind(hoodie.skeleton,hoodie.bindMatrix);
 }
 return {
  get outfit(){return outfit;},get jacket(){return jacket;},
  set(value){
   outfit=cleanOutfit(value);const on=outfit==='bomber'&&!!hoodie;
   if(on&&!jacket)build();
   for(const p of parts)p.visible=!on;if(jacket)jacket.visible=on;
   return outfit;
  },
  dispose(){if(!jacket)return;jacket.removeFromParent();jacket.geometry.dispose();material.dispose();jacket=material=null;for(const p of parts)p.visible=true;outfit='default';}
 };
}
