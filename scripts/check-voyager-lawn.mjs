import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {atriumFloorGeometry,atriumFloorMaterial} from '../src/v2/atrium-surfaces.js';
import {phase6ParkPath} from '../src/plan/atrium-v2.js';
import {phase6Programme} from '../src/v2/phase6-programme.js';
import {geometryKept} from '../src/v2/shader-hooks.js';
import {createVoyagerLawn,lawnSampler,lawnBlocker,shadeLawn} from '../src/v2/voyager-lawn.js';

const d=layout.decks[5],y=d.y+.006;
const geometry=atriumFloorGeometry(d.slab.outline,d.slab.holes.map(h=>h.polygon),d.y,d.atrium.outline);
const original=geometry.attributes.position.array.slice(),facade=new T.Group(),scene=new T.Scene(),far=new T.Group();
const floor=new T.Mesh(geometry,atriumFloorMaterial.clone());floor.name='P6_atrium_floor_actual';floor.position.y=.006;facade.add(floor);
const distant=new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true}));far.add(distant);
// Match the public layout, which intentionally carries no authoring skin charts.
const runtime=structuredClone(layout);runtime.hullPrototypes.prototypes=runtime.hullPrototypes.prototypes.map(({id,ownerId,kind,deck,polygon,chart,rect,floorHoles})=>({id,ownerId,kind,deck,polygon,chart:{origin:chart.origin},rect,floorHoles}));
const full=phase6Programme(layout),local=phase6Programme(runtime,{atriumOnly:true});
for(const name of ['parts','beds'])assert.deepEqual(local[name],full[name].filter(p=>p.deck===6&&p.room.startsWith('atrium6-')),'runtime clearances match the full atrium programme');
const ship={facade,v2DistantArchitecture:far},sample=lawnSampler(floor,y).sample,blocked=lawnBlocker(runtime);
assert(sample(-88.33,-8.57)&&!blocked(-88.33,-8.57),'grass reaches the lawn by the sign');
for(const [x,z] of [[-84,0],[-84,-5],[-96,-8.57],[0,0]])assert.equal(sample(x,z),0,'paving and border stay clear');
const path=phase6ParkPath();for(const [x,z] of path.slice(1,path.length/2-1))assert.equal(sample(x,z+1.2),0,'the winding path stays clear');
assert(blocked(-86,-8.8)&&blocked(-82,-8.8),'both sign posts stay clear');
assert(blocked(-50,-27)&&blocked(-37.5,-30.5),'tree and flower beds stay clear');
let level='high';const lawn=createVoyagerLawn(ship,scene,runtime,{getQuality:()=>level}),camera=new T.PerspectiveCamera(),m=new T.Matrix4();
let inspected=0;
for(const [x,z] of [[-88.33,-8.57],[-65,-10],[-40,-35],[-80,44],[12,44],[15,-7]]){
 camera.position.set(x,y+1.7,z);lawn.update(camera,1000+inspected);
 assert(lawn.mesh.count>0&&lawn.mesh.count<=lawn.stats.capacity);assert(lawn.mesh.userData.noCollide);
 for(let i=0;i<lawn.mesh.count;i++){
  lawn.mesh.getMatrixAt(i,m);const e=m.elements,px=e[12],pz=e[14];
  assert(Math.abs(e[13]-y)<.00001);assert(sample(px,pz)&&!blocked(px,pz),'every tuft stays on lawn and outside planted beds/fittings');
  assert(Math.hypot(px-x,pz-z)<=20.01,'only nearby grass is submitted');inspected++;
 }
}
assert.equal(lawn.mesh.geometry.attributes.position.count/3,9,'three simple blades per tuft');
assert.equal(scene.children.length,1,'one instanced draw');
level='performance';for(let n=0;n<100;n++)lawn.update(camera,200000+n*100);assert.equal(lawn.mesh.visible,false,'Performance drops blades');
level='balanced';for(let n=0;n<100;n++)lawn.update(camera,220000+n*100);assert(lawn.mesh.visible);assert(lawn.mesh.count<13000,'Balanced reduces grass range');
const phoneScene=new T.Scene();createVoyagerLawn(ship,phoneScene,layout,{phone:true});assert.equal(phoneScene.children.length,0,'phones allocate no blades');
assert(floor.material.userData.voyagerLawn&&distant.material.userData.voyagerLawn,'near and far floor get procedural grass');
assert(geometryKept(floor.material)&&!geometryKept(lawn.mesh.material),'floor shading retains its occlusion contract; shrinking blades stay dynamic');
for(const mat of [floor.material,distant.material]){
 const source=mat.isMeshBasicMaterial?T.ShaderLib.basic:T.ShaderLib.standard,shader={vertexShader:source.vertexShader,fragmentShader:source.fragmentShader,uniforms:{}};
 mat.onBeforeCompile(shader);assert(shader.vertexShader.includes('vLawnMask'));assert(shader.fragmentShader.includes('grainFade'));
 assert(!shader.vertexShader.includes('y--'),'negative deck height produces valid subtraction');
 for(const copy of [mat.clone(),new T.MaterialLoader().parse(mat.toJSON())]){
  assert(copy.userData.voyagerLawn,'the saved diagnostic marker survives cloning and prepared loading');
  const before={vertexShader:source.vertexShader,fragmentShader:source.fragmentShader,uniforms:{}};copy.onBeforeCompile(before);
  assert(!before.fragmentShader.includes('grainFade'),'material serialization does not preserve shader functions');
  shadeLawn(copy,y);const hook=copy.onBeforeCompile;shadeLawn(copy,y);assert.equal(copy.onBeforeCompile,hook,'runtime installation is idempotent');
  const after={vertexShader:source.vertexShader,fragmentShader:source.fragmentShader,uniforms:{}};copy.onBeforeCompile(after);
  assert(after.vertexShader.includes('vLawnMask')&&after.fragmentShader.includes('grainFade'),'restored materials reinstall lawn grain and patches');
  assert(geometryKept(copy),'restored floor shading still keeps its geometry');
 }
}
assert.deepEqual(geometry.attributes.position.array,original,'render dressing never changes floor geometry');
console.log('Voyager lawn: '+inspected+' instances checked across Deck 6; clear paths, beds and fittings; one draw, phone/low settings and unchanged floor.');
