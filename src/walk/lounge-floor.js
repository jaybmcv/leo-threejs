import * as T from 'three';
import {objectRoom,unanchorPoint,anchorObject} from '../plan/rooms.js';
import {COMMONS} from '../model.js';
import {canvasTexture,seeded} from '../polish-kit.js';

// The Hydro-Nip Lounge's floor on foot (from tester feedback): glossy black acrylic poured with neon swirls, on the
// lounge's floor and galleries, the hall strip in front of it and the stretch of promenade it opens onto. The rugs,
// the dome's purple floor glow and the promenade's guide lines all sit above it and stay as they were.
const C=COMMONS[0],X0=C.x-C.width/2,X1=C.x+C.width/2,Z0=C.z-C.depth/2,Z1=C.z+C.depth/2,Y=24.3,TILE=9,PROMENADE=4;
const FLOORS=/^(Commons_floor|N1_commons_floor|Rear_gallery|End_gallery|Front_gallery|Upper_stair_landing|Upper_gallery_connection|Commons_hall_floor)$/;

// A tileable swirl: ribbons that follow a periodic flow field, each a dark edge, a neon body and a bright core, drawn
// once per neighbouring tile so they wrap.
const swirl=()=>canvasTexture(1024,1024,(g,w,h)=>{
 g.fillStyle='#07040d';g.fillRect(0,0,w,h);
 const rnd=seeded(116),colors=['#ff2fd0','#8a3dff','#2f7bff','#2fe0ff','#9dff2f','#ff2fd0','#5a2fff'];
 const angle=(x,y)=>{const u=2*Math.PI*x/w,v=2*Math.PI*y/h;return 1.6*Math.sin(u+2*Math.sin(v))+1.3*Math.cos(2*v-u)+.8*Math.sin(3*u+v);};
 g.lineCap=g.lineJoin='round';
 for(let i=0;i<34;i++){
  let x=rnd()*w,y=rnd()*h;const pts=[[x,y]],turn=rnd()<.5?0:Math.PI;
  for(let k=0;k<150;k++){const a=angle(x,y)+turn;x+=Math.cos(a)*5;y+=Math.sin(a)*5;pts.push([x,y]);}
  const width=10+rnd()*26,color=colors[i%colors.length];
  for(const [stroke,lw,alpha,blur] of [['#000',width+10,.85,0],[color,width,1,18],['#fff',width*.28,.45,0]]){
   g.strokeStyle=stroke;g.lineWidth=lw;g.globalAlpha=alpha;g.shadowColor=color;g.shadowBlur=blur;
   for(const ox of [-w,0,w])for(const oy of [-h,0,h]){g.beginPath();pts.forEach(([px,py],k)=>k?g.lineTo(px+ox,py+oy):g.moveTo(px+ox,py+oy));g.stroke();}}
 }
 g.globalAlpha=1;g.shadowBlur=0;
});

// World-planar UVs, so the swirl runs on unbroken across every floor piece at one scale.
function planar(o){
 o.updateWorldMatrix(true,false);const g=o.geometry.clone(),p=g.attributes.position,v=new T.Vector3(),uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(objectRoom(o)==='commons-1')v.fromArray(unanchorPoint('commons-1',v.toArray()));uv[i*2]=v.x/TILE;uv[i*2+1]=-v.z/TILE;}
 g.setAttribute('uv',new T.BufferAttribute(uv,2));o.geometry=g;
}

export function glossLoungeFloor(ship){
 if(typeof document==='undefined')return null;
 const map=swirl();
 // Low roughness keeps the surface glossy; the room's reflections are switched off by quietFloorReflections. A little of
 // the pattern glows, like neon under blacklight.
 const material=new T.MeshStandardMaterial({name:'Lounge_acrylic_floor',map,emissive:0xffffff,emissiveMap:map,emissiveIntensity:.4,roughness:.1,metalness:0});
 const inside=(b,o)=>{const c=b.getCenter(new T.Vector3());if(objectRoom(o)==='commons-1')c.fromArray(unanchorPoint('commons-1',c.toArray()));return c.x>X0&&c.x<X1&&c.z>Z0-.1&&c.z<0&&c.y>Y-1&&c.y<Y+9;};
 const found=[];
 ship.inside.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&FLOORS.test(o.name)&&inside(new T.Box3().setFromObject(o),o))found.push(o);});
 for(const o of found){planar(o);o.material=material;}
 // The promenade in front of the lounge, laid just over its own floor.
 const promenade=new T.Mesh(new T.PlaneGeometry(X1-X0,PROMENADE*2).rotateX(-Math.PI/2).translate((X0+X1)/2,Y+.006,0),material);
 promenade.name='Lounge_promenade_floor';planar(promenade);anchorObject(promenade,'commons-1');ship.inside.add(promenade);
 return {material,floors:found.length};
}

// The glare (feedback-inbox #159): the glossy floor mirrors the room's environment, and where the environment is bright
// it shows as a white pool on the neon. Once the environment is loaded, the lounge floor takes it at no strength, so it
// stays black acrylic with its neon, while the rest of the ship keeps its light. Called when the environment loads and
// after the floor is built, whichever comes first.
export function quietFloorReflections(root,environment){
 if(!environment)return;
 root.traverse(o=>{if(o.isMesh&&o.material?.name==='Lounge_acrylic_floor'){o.material.envMap=environment;o.material.envMapIntensity=0;o.material.needsUpdate=true;}});
}
