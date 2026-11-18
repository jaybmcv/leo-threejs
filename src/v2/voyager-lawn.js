import * as T from 'three';
import {phase6ParkPath} from '../plan/atrium-v2.js';
import {phase6Programme} from './phase6-programme.js';
import {getAtriumQuality} from './atrium-quality.js';
import {keepsGeometry} from './shader-hooks.js';

const CELL=4,SPACING=.22,CAPACITY=36000,TONES=[0x7ea95b,0x8bb566],colours=TONES.map(c=>new T.Color(c));
const hash=(x,z,k=0)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(k+1,1274126177);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;};
const key=(x,z)=>x+','+z;

// Use the finished lawn triangles, including every structural cut. Paving and
// other decks never enter the sampler. This also works on a prepared ship.
export function lawnSampler(paving,y){
 const bins=new Map(),p=paving.geometry.attributes.position,c=paving.geometry.attributes.color,ix=paving.geometry.index,v=new T.Vector3();
 paving.updateWorldMatrix(true,false);
 for(let i=0;i<(ix?.count??p.count);i+=3){
  const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k);
  const tone=colours.findIndex(t=>ids.every(n=>Math.hypot(c.getX(n)-t.r,c.getY(n)-t.g,c.getZ(n)-t.b)<.012));if(tone<0)continue;
  const world=ids.map(n=>v.fromBufferAttribute(p,n).applyMatrix4(paving.matrixWorld).toArray());if(world.some(q=>Math.abs(q[1]-y)>.02))continue;
  const tri=world.map(q=>[q[0],q[2]]),xs=tri.map(q=>q[0]),zs=tri.map(q=>q[1]),cross=(tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1])-(tri[1][1]-tri[0][1])*(tri[2][0]-tri[0][0]);if(Math.abs(cross)<1e-8)continue;
  const sign=Math.sign(cross),edges=tri.flatMap((a,i)=>{const b=tri[(i+1)%3],dx=b[0]-a[0],dz=b[1]-a[1];return[-dz*sign,dx*sign,(dz*a[0]-dx*a[1])*sign];}),row={edges,tone:TONES[tone]};
  for(let x=Math.floor(Math.min(...xs)/CELL);x<=Math.floor(Math.max(...xs)/CELL);x++)for(let z=Math.floor(Math.min(...zs)/CELL);z<=Math.floor(Math.max(...zs)/CELL);z++){
   const k=key(x,z);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(row);
  }
 }
 const sample=(x,z)=>{for(const {edges:e,tone} of bins.get(key(Math.floor(x/CELL),Math.floor(z/CELL)))||[])if(e[0]*x+e[1]*z+e[2]>=-1e-6&&e[3]*x+e[4]*z+e[5]>=-1e-6&&e[6]*x+e[7]*z+e[8]>=-1e-6)return tone;return 0;};
 return {bins,sample};
}

// Leave generous margins round planted beds, trunks and the meadow drifts.
// The meadow reaches 4 m from the path centre and 4.7 m from a grove tree.
export function lawnBlocker(layout){
 const y=layout.decks[5].y,{parts,beds}=phase6Programme(layout,{atriumOnly:true}),ground=[...parts,...beds].filter(p=>p.deck===6&&(beds.includes(p)||p.at[1]-p.size[1]/2<y+.3)),path=phase6ParkPath(),edge=path.slice(0,path.length/2),bins=new Map();
 const put=(p,w,d)=>{for(let x=Math.floor((p.x-w)/CELL);x<=Math.floor((p.x+w)/CELL);x++)for(let z=Math.floor((p.z-d)/CELL);z<=Math.floor((p.z+d)/CELL);z++){const k=key(x,z);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(p);}};
 for(const p of ground){const c=Math.cos(p.yaw),s=Math.sin(p.yaw),w=p.size[0]/2+.18,d=p.size[2]/2+.18;put({x:p.at[0],z:p.at[2],c,s,w,d},Math.abs(c)*w+Math.abs(s)*d,Math.abs(s)*w+Math.abs(c)*d);}
 const trees=parts.filter(p=>p.deck===6&&p.part==='p6_tree_trunk').map(p=>[p.at[0],p.at[2]]);trees.push([-37.5,-30.5],[-62.5,-31]);
 for(const [x,z] of trees)put({x,z,r:4.9},4.9,4.9);
 return (x,z)=>{
  if(x>-88.4&&x<-3.6){const px=Math.max(-88,Math.min(-4,x)),i=Math.min(edge.length-2,Math.floor(px+88)),a=edge[i],b=edge[i+1],centre=a[1]+(b[1]-a[1])*(px-a[0])+1.2;if(Math.abs(z-centre)<4.6)return true;}
  for(const p of bins.get(key(Math.floor(x/CELL),Math.floor(z/CELL)))||[]){const dx=x-p.x,dz=z-p.z;if(p.r?dx*dx+dz*dz<p.r*p.r:Math.abs(p.c*dx-p.s*dz)<p.w&&Math.abs(p.s*dx+p.c*dz)<p.d)return true;}
  return false;
 };
}

const grain=`
float lawnHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float lawnNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(lawnHash(i),lawnHash(i+vec2(1,0)),f.x),mix(lawnHash(i+vec2(0,1)),lawnHash(i+vec2(1,1)),f.x),f.y);}
`;
const shadedMaterials=new WeakSet();
export function shadeLawn(material,y){
 // Prepared materials and clones keep userData, but lose shader functions.
 // Only a material patched in this runtime can skip installing the shader.
 if(shadedMaterials.has(material))return;shadedMaterials.add(material);material.userData.voyagerLawn=true;
 const base=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=function(shader,renderer){
  base.call(this,shader,renderer);
  shader.vertexShader='varying vec2 vLawnPlan; varying float vLawnMask;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec4 lawnWorld=modelMatrix*vec4(transformed,1.0);
vLawnPlan=lawnWorld.xz;vLawnMask=0.0;
#ifdef USE_COLOR
vLawnMask=step(abs(lawnWorld.y-(${y.toFixed(4)})),0.02)*max(1.0-step(0.012,distance(color,vec3(${colours[0].toArray().join(',')}))),1.0-step(0.012,distance(color,vec3(${colours[1].toArray().join(',')}))));
#endif
#include <project_vertex>`);
  shader.fragmentShader='varying vec2 vLawnPlan; varying float vLawnMask;\n'+grain+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
if(vLawnMask>0.5){
 float patches=lawnNoise(vLawnPlan*.38)*.65+lawnNoise(vLawnPlan*1.37+19.3)*.35;
 vec2 bladePlan=vec2(vLawnPlan.x*.91+vLawnPlan.y*.41,-vLawnPlan.x*.41+vLawnPlan.y*.91);
 float fine=lawnNoise(bladePlan*vec2(38.0,8.0));
 float grainFade=1.0-smoothstep(.025,.12,max(length(dFdx(vLawnPlan)),length(dFdy(vLawnPlan))));
 diffuseColor.rgb*=.80+.40*patches+(fine-.5)*.30*grainFade;
}`);
 };
 material.onBeforeCompile.keepsGeometry=keepsGeometry(base);
 material.customProgramCacheKey=()=>cache()+'|voyager-lawn-1';material.needsUpdate=true;
}

function tuftGeometry(){
 const p=[],c=[];
 for(let k=0;k<3;k++){
  const a=k*Math.PI*2/3,cs=Math.cos(a),sn=Math.sin(a),points=[[-.018,0,0],[.018,0,0],[-.012,.075,.012],[.012,.075,.012],[.026,.15,.04]];
  for(const i of[0,1,2,1,3,2,2,3,4]){const[x,y,z]=points[i];p.push(x*cs+z*sn,y,-x*sn+z*cs);const tone=.65+y*3.2;c.push(tone,tone,tone);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}

export function createVoyagerLawn(ship,scene,layout,{phone=false,getQuality=getAtriumQuality}={}){
 const paving=ship.facade?.getObjectByName('P6_atrium_floor_actual');if(!paving)return null;
 const y=layout.decks[5].y+.006;
 shadeLawn(paving.material,y);
 // The far/phone floor uses the same geometry with a Basic material.
 ship.v2DistantArchitecture?.traverse(o=>{if(o.isMesh&&o.geometry===paving.geometry)shadeLawn(o.material,y);});
 if(phone)return {update(){},stats:{phone:true,instances:0}};
 const {bins,sample}=lawnSampler(paving,y),blocked=lawnBlocker(layout),cells=new Map(),matrix=new T.Matrix4(),tint=new T.Color();
 const uniforms={lawnRadius:{value:getQuality()==='balanced'?12:18},lawnGrowth:{value:getQuality()==='performance'?0:1}},material=new T.MeshStandardMaterial({name:'Voyager_short_grass',vertexColors:true,side:T.DoubleSide,roughness:1,flatShading:true});
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);shader.vertexShader='uniform float lawnRadius; uniform float lawnGrowth;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec3 lawnBase=(modelMatrix*instanceMatrix*vec4(0,0,0,1)).xyz;
float growth=(1.0-smoothstep(lawnRadius*.62,lawnRadius,distance(lawnBase,cameraPosition)))*lawnGrowth;
transformed*=growth;
#include <project_vertex>`);
 };
 const mesh=new T.InstancedMesh(tuftGeometry(),material,CAPACITY);mesh.name='Voyager_lawn_blades';mesh.userData={noCollide:true,keepLive:true,v2Deck:6};mesh.frustumCulled=false;mesh.count=0;
 mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.setColorAt(0,tint);mesh.instanceColor.setUsage(T.DynamicDrawUsage);scene.add(mesh);
 const stats={instances:0,capacity:CAPACITY,draws:1},last=new T.Vector3(Infinity,Infinity,Infinity);let lastRange=0,lastTime=0;
 const cell=(cx,cz)=>{
  const k=key(cx,cz);if(cells.has(k))return cells.get(k);const points=[];
  // A global jittered lattice avoids overlapping samples at cell boundaries.
  for(let ix=Math.ceil(cx*CELL/SPACING);ix<Math.ceil((cx+1)*CELL/SPACING);ix++)for(let iz=Math.ceil(cz*CELL/SPACING);iz<Math.ceil((cz+1)*CELL/SPACING);iz++){
   const x=(ix+.15+hash(ix,iz)*.7)*SPACING,z=(iz+.15+hash(ix,iz,1)*.7)*SPACING,tone=sample(x,z);
   if(!tone||blocked(x,z)||![[.1,0],[-.1,0],[0,.1],[0,-.1],[.1,.1],[-.1,.1],[.1,-.1],[-.1,-.1]].every(([a,b])=>sample(x+a,z+b)))continue;
   points.push({x,z,tone,turn:hash(ix,iz,2)*Math.PI*2,size:.65+hash(ix,iz,3)*.7,lean:(hash(ix,iz,4)-.5)*.3});
  }
  cells.set(k,points);return points;
 };
 return {mesh,stats,update(camera,now=performance.now()){
  const level=getQuality(),target=level==='performance'?0:1,range=level==='balanced'?12:18,dt=lastTime?Math.min(.1,(now-lastTime)/1000):.1;lastTime=now;
  uniforms.lawnGrowth.value=T.MathUtils.damp(uniforms.lawnGrowth.value,target,6,dt);
  uniforms.lawnRadius.value=T.MathUtils.damp(uniforms.lawnRadius.value,range,5,dt);
  const at=camera.position,radius=Math.max(range,uniforms.lawnRadius.value)+2;
  mesh.visible=uniforms.lawnGrowth.value>.002&&Math.abs(at.y-y)<radius;
  if(!mesh.visible)return;
  if(at.distanceToSquared(last)<1&&Math.abs(radius-lastRange)<.15)return;
  last.copy(at);lastRange=radius;let n=0;
  for(let cx=Math.floor((at.x-radius)/CELL);cx<=Math.floor((at.x+radius)/CELL);cx++)for(let cz=Math.floor((at.z-radius)/CELL);cz<=Math.floor((at.z+radius)/CELL);cz++){
   if(!bins.has(key(cx,cz)))continue;
   for(const p of cell(cx,cz)){if(Math.hypot(p.x-at.x,p.z-at.z)>radius)continue;
    if(n===CAPACITY)throw Error('Voyager grass instance budget exceeded');
    matrix.makeRotationY(p.turn);matrix.elements[4]=p.lean;matrix.elements[5]=p.size;matrix.setPosition(p.x,y,p.z);mesh.setMatrixAt(n,matrix);
    tint.setHex(p.tone).multiplyScalar(.82+hash(Math.round(p.x/SPACING),Math.round(p.z/SPACING),5)*.35);mesh.setColorAt(n++,tint);
   }
  }
  mesh.count=n;stats.instances=n;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
 }};
}
