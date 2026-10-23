import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CROWN} from '../fin-crown.js';
import {shapePoint} from '../concept-shape.js';

// The Crown lounge hostess: a ginger and white Cosmo in a pink corset, a purple octopus sitting on her head, standing
// by the welcome plinth to greet whoever steps out of the crown lift. She is the baked Cosmo stand (cosmo.js
// createCosmoKit), the same size as the walker, with her own copies of its materials: the blue fur in the body texture
// turns ginger, white on the muzzle, chest and tail tip, and the hoodie turns into a laced pink corset over bare arms,
// the shorts plum. Kit space: feet at the origin, facing +z, her left +x; the head is 1.1 to 1.67 m up.
const AT=[-251.3,4.4],FACE=[-247,3.2];
const GINGER=new T.Color(0xc8824a),WHITE=new T.Color(0xf4efe6),PINK=new T.Color(0xf08c96),PLUM=new T.Color(0x6e3278),LACE=new T.Color(0x1c1a1e);
const glsl=c=>`vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`;

// Both shaders get the kit-space position; the colour change runs on the texture's colour, after it is read.
function recolour(material,name,code){
 const m=material.clone();m.name=name;
 m.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 vKit;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvKit=position;');
  s.fragmentShader='varying vec3 vKit;\n'+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+code);
 };
 m.customProgramCacheKey=()=>name;
 return m;
}
// Fur is the texture's flat blue (darker blue in the ears), so eyes, nose and mouth keep their own colours.
const FUR=`{vec3 c=diffuseColor.rgb;float fur=smoothstep(.08,.2,c.b-max(c.r,c.g));
 float bib=smoothstep(.1,.16,vKit.z)*(1.-smoothstep(1.24,1.3,vKit.y))*step(.98,vKit.y)+(1.-smoothstep(-.45,-.38,vKit.z))*step(vKit.y,.6);
 diffuseColor.rgb=mix(c,mix(${glsl(GINGER)},${glsl(WHITE)},clamp(bib,0.,1.))*clamp(c.b/.63,.35,1.1),fur);}`;
// The hoodie is near black and the shorts orange in the clothes texture. Off the torso the sleeves read as arms; above
// the corset's top edge, the collar as the white bib.
const CLOTHES=`{vec3 c=diffuseColor.rgb;float shorts=step(.12,c.r-c.b),arm=step(.165,abs(vKit.x)),top=step(1.04,vKit.y);
 float lace=step(.09,vKit.z)*step(abs(vKit.x),.04)*step(vKit.y,1.03)*step(.8,vKit.y);
 float cross=lace*step(abs(abs(vKit.x)-.035*(1.-2.*abs(fract(vKit.y*16.)-.5))),.004)+lace*step(abs(vKit.x),.003);
 vec3 corset=mix(${glsl(PINK)},${glsl(LACE)},clamp(cross,0.,1.));
 vec3 skin=mix(${glsl(GINGER)},${glsl(WHITE)},step(.08,vKit.z)*top);
 diffuseColor.rgb=shorts>.5?${glsl(PLUM)}:mix(corset,skin,max(arm,top));}`;

// The octopus: a glossy mantle over the ears, its eyes looking forward, and eight arms draped over the crown, the
// front ones short so the cat's eyes stay clear.
function octopus(){
 const purple=new T.MeshStandardMaterial({name:'Crown_hostess_octopus',color:0x7a3cc8,roughness:.32,metalness:0});
 const white=new T.MeshStandardMaterial({name:'Crown_hostess_octopus_eye',color:0xf6f2e8,roughness:.4});
 const black=new T.MeshStandardMaterial({name:'Crown_hostess_octopus_pupil',color:0x141018,roughness:.3});
 const centre=new T.Vector3(.035,1.62,-.01),parts=[];
 const mantle=new T.SphereGeometry(.19,24,16);mantle.scale(1,.8,1.12);mantle.rotateX(-.35);mantle.translate(centre.x,centre.y,centre.z);parts.push(mantle);
 for(let i=0;i<8;i++){
  const a=(i+.5)/8*Math.PI*2,dir=new T.Vector3(Math.sin(a),0,Math.cos(a)),front=Math.max(0,Math.cos(a)),drop=.32*(1-front*.7),reach=.3-front*.06;
  const at=(r,y)=>new T.Vector3(centre.x+dir.x*r,y,centre.z+dir.z*r*1.15);
  const path=new T.CatmullRomCurve3([at(.1,centre.y-.07),at(reach*.8,centre.y-.1),at(reach,centre.y-.1-drop*.6),at(reach+.02,centre.y-.1-drop),at(reach+.07,centre.y-.07-drop)]);
  const arm=new T.TubeGeometry(path,24,.04,8,false),p=arm.attributes.position,n=24+1;
  // Each arm tapers to its tip.
  for(let k=0;k<p.count;k++){const t=Math.floor(k/9)/(n-1),q=path.getPointAt(Math.min(1,t)),s=1-t*.75;p.setXYZ(k,q.x+(p.getX(k)-q.x)*s,q.y+(p.getY(k)-q.y)*s,q.z+(p.getZ(k)-q.z)*s);}
  arm.computeVertexNormals();parts.push(arm.toNonIndexed());
 }
 const g=new T.Group();g.name='Crown_hostess_octopus';
 g.add(new T.Mesh(mergeGeometries(parts.map(p=>p.index?p.toNonIndexed():p)),purple));
 const eyes=[],pupils=[];
 for(const s of [-1,1]){const e=new T.SphereGeometry(.035,12,8),p=new T.SphereGeometry(.016,10,6);
  e.translate(centre.x+s*.07,centre.y+.06,centre.z+.18);p.translate(centre.x+s*.07,centre.y+.06,centre.z+.21);eyes.push(e);pupils.push(p);}
 g.add(new T.Mesh(mergeGeometries(eyes),white),new T.Mesh(mergeGeometries(pupils),black));
 return g;
}

// The hostess at her post, in walk coordinates.
export function createHostess(kit){
 const g=kit.figure();g.name='Crown_hostess';
 for(const m of g.children){
  if(m.material.name==='body')m.material=recolour(m.material,'Crown_hostess_fur',FUR);
  // The hoodie's pocket and seams are in its normal map: softened, the pink reads as a fitted corset.
  else if(m.material.name==='clothes'){m.material=recolour(m.material,'Crown_hostess_corset',CLOTHES);m.material.normalScale.multiplyScalar(.2);}
 }
 g.add(octopus());
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 g.position.set(AT[0],shapePoint([AT[0],CROWN.floor,AT[1]])[1],AT[1]);
 g.rotation.y=Math.atan2(FACE[0]-AT[0],FACE[1]-AT[1]);
 return g;
}
