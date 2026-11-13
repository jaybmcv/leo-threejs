// The atrium room stand-ins dissolve over the first metres inside the window where the real cabins draw, instead of
// stopping in one frame at its edge (src/v2/atrium-visibility.js): the rule on a phone, and on a desktop until the walk
// has captured its cabins. Checks: outside the window nothing changes, inside it the fade falls smoothly from 1 to 0,
// standing on a deck shows no part-faded stand-in, distant copies and shared buffers are untouched, and the shader patch
// lands in the three.js programs the stand-ins use. Then the rule by named real cabins (scripts/check-atrium-rooms.mjs
// checks the module that names them).
// Usage: node scripts/check-atrium-proxy-fade.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {addFlowingAtriumRibs} from '../src/v2/flowing-ribs.js';
import {registerAtriumArchitecture,setAtriumView,enableAtriumProxyFade,atriumProxyFade,setAtriumRealRooms} from '../src/v2/atrium-visibility.js';

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

// Once the walk draws the atrium's cabins by what the camera sees (atrium-rooms.js), it names the real cabins: their
// window frames' stand-ins hide at any height, every other frame stays whole, the room boxes stop drawing, and the
// distant copies are untouched. Without the names the height window is the rule again.
const box=new T.BoxGeometry(3.16,3.4,7.4),rooms=new T.InstancedMesh(box,new T.MeshBasicMaterial({name:'P6_atrium_room_returns',color:0xe6d4b6,side:T.DoubleSide}),cabins.length);
rooms.name='P6_atrium_room_returns';rooms.userData={roomOwners:cabins.map(c=>c.id),proxySpans:cabins.map(c=>[c.y-.14,c.y+3.5])};
cabins.forEach((c,i)=>rooms.setMatrixAt(i,c.matrix.clone().multiply(new T.Matrix4().makeTranslation(0,1.7,0))));
const roomRoot=new T.Group();roomRoot.add(rooms);registerAtriumArchitecture(roomRoot);
const real=new Set([cabins[2].id,cabins[5].id]),m=new T.Matrix4(),left=cabins.filter(c=>!real.has(c.id));
setAtriumRealRooms(real);
for(let y=decks[0].y;y<=decks.at(-1).y;y+=.5){setAtriumView(new T.Vector3(0,y,0));
 assert.equal(rooms.count,0,'Room boxes no longer draw');assert.equal(rooms.visible,false,'Room boxes are hidden');
 for(const o of facade.children){assert.equal(o.count,left.length,'Frames stand in for every cabin that is not real, at any height');
  left.forEach((c,n)=>{o.getMatrixAt(n,m);assert(Math.abs(m.elements[13]-c.y)<1e-6,'The frames kept belong to the other cabins');});
  assert([...o.geometry.attributes.proxyFade.array.slice(0,o.count)].every(v=>v===1),'Frames never dither');}
 for(const o of haze.children)assert.equal(o.count,cabins.length,'Distant copies stay complete');}
setAtriumRealRooms(null);
assert.equal(view(decks[3].y),0,'The height window rules again without the names');assert(rooms.count>0&&rooms.count<cabins.length,'Room boxes follow the height window again');
console.log(JSON.stringify({status:'PASS',stops,fadingStops,standingDecks:decks.length,realRooms:real.size}));
