// The atrium room stand-ins dissolve over the first metres inside the window where the real cabins draw, instead of
// stopping in one frame at its edge (src/v2/atrium-visibility.js). Checks: outside the window nothing changes, inside it
// the fade falls smoothly from 1 to 0, standing on a deck shows no part-faded stand-in, distant copies and shared buffers
// are untouched, and the shader patch lands in the three.js programs the stand-ins use.
// Usage: node scripts/check-atrium-proxy-fade.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {addFlowingAtriumRibs} from '../src/v2/flowing-ribs.js';
import {registerAtriumArchitecture,setAtriumView,enableAtriumProxyFade,atriumProxyFade,setAtriumRoomViews,setAtriumFurnished} from '../src/v2/atrium-visibility.js';

// Without the fade the rule is the walk's old one: hidden exactly inside the window.
for(const y of[-19.7,-17.2,-15.7,0.3,2.1])for(const[lo,hi]of[[-19.84,-16.2],[-15.84,-12.2],[.16,3.8]])
 assert.equal(atriumProxyFade(lo,hi,y,false),lo<y+3.5&&hi>y-.5?0:1,'Unchanged hidden window without the fade');

enableAtriumProxyFade();
const decks=layout.decks.filter(d=>d.number>=6&&d.number<=18);
const cabins=decks.map(d=>({id:'fade-'+d.number,view:'atrium',x:0,z:0,y:d.y,yaw:0,door:{center:[0,d.y,3.7]},matrix:new T.Matrix4().makeTranslation(0,d.y,0)}));
const facade=new T.Group();addFlowingAtriumRibs(facade,cabins);
const sourceGeometry=facade.children.map(o=>o.geometry),sourceMaterial=facade.children.map(o=>o.material);
const haze=new T.Group();for(const o of facade.children){const d=o.clone();d.userData={...o.userData,distantProxy:true};haze.add(d);}
registerAtriumArchitecture(facade);registerAtriumArchitecture(haze);

for(const [i,o] of facade.children.entries()){
 assert.notEqual(o.geometry,sourceGeometry[i],'Stand-in draws its own geometry');
 assert.equal(o.geometry.attributes.position,sourceGeometry[i].attributes.position,'Vertex buffers are shared, not copied');
 assert(!sourceGeometry[i].attributes.proxyFade,'The shared source geometry gains no fade attribute');
 assert.notEqual(o.material,sourceMaterial[i],'Stand-in draws its own material');
 const lib=T.ShaderLib[o.material.isMeshStandardMaterial?'standard':'basic'],shader={vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader};
 o.material.onBeforeCompile(shader);assert(/attribute float proxyFade;[\s\S]*vProxyFade=proxyFade/.test(shader.vertexShader),'Vertex shader carries the fade');
 assert(/discard/.test(shader.fragmentShader)&&/varying float vProxyFade/.test(shader.fragmentShader),'Fragment shader dithers');
}
for(const o of haze.children)assert(!o.geometry.attributes.proxyFade,'Distant copies keep their geometry');

const view=y=>{setAtriumView(new T.Vector3(0,y,0));const o=facade.children[0],spans=o.userData.proxySpans,f=o.geometry.attributes.proxyFade.array;
 const expect=spans.map(([lo,hi])=>{const gap=Math.max(lo-(y+3.5),y-.5-hi);if(gap>=0)return 1;const t=1+gap/3;return t<=0?0:Math.round(t*t*(3-2*t)*64)/64;});
 for(const m of facade.children)assert.equal(m.count,expect.filter(v=>v>0).length,'Shown: outside the window, or still fading inside it');
 expect.filter(v=>v>0).forEach((v,n)=>assert(Math.abs(f[n]-v)<=1/64,'Smooth fade with depth into the window'));
 for(const m of haze.children)assert.equal(m.count,cabins.length,'Distant copies stay complete');
 return [...f.slice(0,o.count)].filter(v=>v<1).length;};
let fadingStops=0,stops=0;
for(let y=decks[0].y;y<=decks.at(-1).y;y+=.25){stops++;if(view(y))fadingStops++;}
for(const d of decks)assert.equal(view(d.y),0,'Standing on a deck shows no part-faded stand-in');
assert(fadingStops>stops/3,'Moving between decks fades');

// Once the walk has captured its cabins' insides (atrium-room-views.js), the room stand-ins stay drawn at every height,
// painted with the capture, and the window frames swap whole at the window edge with no dither.
const box=new T.BoxGeometry(3.16,3.4,7.4),rooms=new T.InstancedMesh(box,new T.MeshBasicMaterial({name:'P6_atrium_room_returns',color:0xe6d4b6,side:T.DoubleSide}),cabins.length);
rooms.name='P6_atrium_room_returns';rooms.userData={roomOwners:cabins.map(c=>c.id),proxySpans:cabins.map(c=>[c.y-.14,c.y+3.5])};
cabins.forEach((c,i)=>rooms.setMatrixAt(i,c.matrix.clone().multiply(new T.Matrix4().makeTranslation(0,1.7,0))));
const roomRoot=new T.Group();roomRoot.add(rooms);registerAtriumArchitecture(roomRoot);
const cube=()=>({texture:new T.CubeTexture()}),views=new Map([[1,{full:cube(),empty:cube(),rotation:new T.Matrix3()}]]);
assert.equal(setAtriumRoomViews(views,new Map(cabins.map(c=>[c.id,1]))),true,'Room views take');
assert.equal(rooms.material.side,T.BackSide,'Drawn from the inside only');
const roomShader={vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader,uniforms:{}};rooms.material.onBeforeCompile(roomShader);
assert(/transformed\*=vec3\(\.985,\.985,\.995\)/.test(roomShader.vertexShader),'Sits inside the real cabin');
assert(/textureCube\(roomEmpty,roomD\)/.test(roomShader.fragmentShader)&&/textureCube\(roomFull,roomD\)/.test(roomShader.fragmentShader),'Painted with the capture');
assert(roomShader.uniforms.roomWalkerY&&roomShader.uniforms.roomRot,'Room uniforms bound');
for(let y=decks[0].y;y<=decks.at(-1).y;y+=.5){setAtriumView(new T.Vector3(0,y,0));
 assert.equal(rooms.count,cabins.length,'Every room stays drawn');
 for(const o of facade.children){const f=o.geometry.attributes.proxyFade.array,expect=o.userData.proxySpans.filter(([lo,hi])=>!(lo<y+3.5&&hi>y-.5)).length;
  assert.equal(o.count,expect,'Frames swap at the window edge');assert([...f.slice(0,o.count)].every(v=>v===1),'Frames never dither');}}
setAtriumFurnished(new Set([cabins[2].id,cabins[5].id]));
assert.deepEqual([...rooms.geometry.attributes.roomFurnished.array].map((v,i)=>v?i:-1).filter(i=>i>=0),[2,5],'Furnished cabins marked');
console.log(JSON.stringify({status:'PASS',stops,fadingStops,standingDecks:decks.length,roomViews:true}));
