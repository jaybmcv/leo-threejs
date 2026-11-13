// The atrium's cabins are drawn by what the camera sees, never by the walker's height (src/v2/atrium-rooms.js).
// Checks: which cabins count as real (the walker's own deck; on any other deck those within reach whose window faces
// the camera, held a little past the reach, whatever the walker's height); every cabin keeps its card and side walls
// at every height; the corridor end, the window pane and the frame stand in exactly where the real cabin
// does not draw; the pool holds the reached cabins' own parts; a deck's cabin parts share the deck's height range; and
// the card's shader looks the capture up through the room's box and dissolves by distance from the camera alone.
// Usage: node scripts/check-atrium-rooms.mjs
import assert from 'node:assert/strict';
import * as T from 'three';
import layout from '../src/plan/selected-layout.js';
import {addFlowingAtriumRibs} from '../src/v2/flowing-ribs.js';
import {registerAtriumArchitecture,enableAtriumProxyFade} from '../src/v2/atrium-visibility.js';
import {ROOMS,cabinBandShown,cabinDoorSide,atriumRoomStates,roomCardMaterial,createAtriumRooms} from '../src/v2/atrium-rooms.js';
import {ROOM_VIEW_EYE} from '../src/v2/atrium-room-views.js';
import {keepsGeometry} from '../src/v2/shader-hooks.js';

// The walker's band: standing on a deck shows that deck's cabins and neither neighbour's; between decks, both.
const decks=layout.decks.filter(d=>d.number>=6&&d.number<=15),gap=decks[1].y-decks[0].y;
for(const d of decks){const band=y=>cabinBandShown(y-.14,y+3.5,d.y);
 assert(band(d.y),'Standing on a deck shows its cabins');assert(!band(d.y-gap),'The deck below stays out');assert(!band(d.y+gap),'The deck above stays out');}
assert(cabinBandShown(decks[1].y-.14,decks[1].y+3.5,decks[0].y+1)&&cabinBandShown(decks[0].y-.14,decks[0].y+3.5,decks[0].y+1),'A metre up, both decks show');

// Two facing rows of cabins on each of four decks: windows at z = -3.7 (facing -z) and z = 20 (facing +z).
const cabinDecks=decks.slice(0,4),placements=[];
for(const d of cabinDecks)for(let i=0;i<6;i++)for(const row of [0,1]){
 const x=i*3.3,z=row?23.7:0,yaw=row?Math.PI:0,doorZ=row?z-3.7:z+3.7,matrix=new T.Matrix4().makeTranslation(x,d.y,z).multiply(new T.Matrix4().makeRotationY(yaw));
 placements.push({id:`d${d.number}-${row}-${i}`,view:'atrium',type:'twin',key:'twin-1-atrium',deck:d.number,x,y:d.y,z,yaw,door:{center:[x,d.y,doorZ]},matrix});}
placements.push({id:'space-1',view:'space',type:'twin',key:'twin-1-space',deck:6,x:50,y:cabinDecks[0].y,z:0,yaw:0,door:{center:[50,cabinDecks[0].y,3.7]},matrix:new T.Matrix4().makeTranslation(50,cabinDecks[0].y,0)});
for(const c of placements)assert.equal(cabinDoorSide(c),1,'The door is at local +z in this fixture');

// States, on plain rows.
{const rows=placements.filter(c=>c.view==='atrium').map(c=>{const e=c.matrix.elements,w=new T.Vector3(0,1.7,-3.7).applyMatrix4(c.matrix);return {y:c.y,window:w.toArray(),out:[-e[8],-e[10]]};});
 const state=new Uint8Array(rows.length),y0=cabinDecks[0].y,y2=cabinDecks[2].y,count=v=>state.filter(s=>s===v).length;
 // The walker stands on the lowest deck; the camera hangs 4 m in front of the third deck's first-row windows.
 const eye=new T.Vector3(3.3*2.5,y2+1.7,-3.7-4);
 assert(atriumRoomStates(rows,state,eye,y0),'The first pass changes the states');
 assert.equal(count(1),12,'The walker\'s deck is real, both rows');
 const reached=rows.map((r,i)=>state[i]===2?i:-1).filter(i=>i>=0);
 assert(reached.length>=6&&reached.length<=18,'Cabins near the camera on other decks are real: '+reached.length);
 for(const i of reached){const r=rows[i];assert(Math.hypot(eye.x-r.window[0],eye.y-r.window[1],eye.z-r.window[2])<ROOMS.reach,'Within reach');assert(r.window[2]<0,'Only the row whose windows face the camera');}
 assert(reached.some(i=>rows[i].y!==y2),'Reach is by distance, not by deck');
 assert(!atriumRoomStates(rows,state,eye,y0),'Nothing changes while nothing moves');
 // Held a little past the reach, then let go.
 const k=reached[0],edge=rows[k],out=d=>new T.Vector3(edge.window[0],edge.window[1],edge.window[2]-d);
 atriumRoomStates(rows,state,out(ROOMS.reach-.3),y0);assert.equal(state[k],2,'Reached within the reach');
 atriumRoomStates(rows,state,out(ROOMS.reach+.3),y0);assert.equal(state[k],2,'Held just past the reach');
 atriumRoomStates(rows,state,out(ROOMS.keep+.3),y0);assert.equal(state[k],0,'Let go past the hold');
 atriumRoomStates(rows,state,out(ROOMS.reach+.3),y0);assert.equal(state[k],0,'Not taken up again until within reach');
 // Behind the windows (inside the building) nothing is reached.
 atriumRoomStates(rows,state,new T.Vector3(3.3*2.5,y2+1.7,2),y0);assert.equal(count(2),0,'From behind its window a cabin is not reached');
 // The walker's height alone decides nothing but its own deck: the same camera reaches the same rooms.
 atriumRoomStates(rows,state,eye,y0);const low=[...state],y3=cabinDecks[3].y;assert(low.includes(2));atriumRoomStates(rows,state,eye,y3);
 assert.equal(count(1),12);assert(rows.every((r,i)=>(state[i]===1)===(r.y===y3)),'Only the walker\'s deck follows its height');
 assert(rows.every((r,i)=>r.y===y0||r.y===y3||state[i]===low[i]),'On every other deck the walker\'s height changes nothing');}

// The card's shader.
const cube=()=>({texture:new T.CubeTexture()}),views=new Map([[1,{full:cube(),rotation:new T.Matrix3(),eye:new T.Vector3(0,0,-ROOM_VIEW_EYE)}]]);
{const m=roomCardMaterial(views.get(1)),lib=T.ShaderLib.basic,s={vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader,uniforms:{}};m.onBeforeCompile(s);
 assert.equal(m.side,T.FrontSide,'The card faces the atrium only');assert.equal(m.toneMapped,false,'Shown as captured');
 assert(s.vertexShader.includes(`smoothstep(${ROOMS.near.toFixed(3)},${ROOMS.far.toFixed(3)},distance(cameraPosition,`),'Dissolves by distance from the camera');
 assert(!/walker/i.test(s.vertexShader+s.fragmentShader),'Nothing in the card depends on the walker');
 assert(/discard/.test(s.fragmentShader)&&/textureCube\(roomView,roomRot\*\(roomHit-roomEye\)\)/.test(s.fragmentShader),'Painted with the capture, through the room\'s box, from where it was taken');
 assert(s.uniforms.roomView&&s.uniforms.roomRot&&s.uniforms.roomEye,'Card uniforms bound');
 assert(!keepsGeometry(m.onBeforeCompile),'A dissolving card is never a wall for the owner bake');
 assert(ROOM_VIEW_EYE>2&&ROOM_VIEW_EYE<3.7,'The capture is taken beside the window, inside the room');}

// The whole thing on a small scene: the facade's frames, the deck's own cabin parts, the frost.
enableAtriumProxyFade();
const scene=new T.Scene(),parent=new T.Group(),facade=new T.Group();scene.add(parent);
const atrium=placements.filter(c=>c.view==='atrium');addFlowingAtriumRibs(facade,atrium);registerAtriumArchitecture(facade);
const instanced=[],part=(name,list)=>{const o=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({name}),list.length);o.name=name;list.forEach((c,i)=>o.setMatrixAt(i,c.matrix));
 o.userData={cabins:true,cabinIds:list.map(c=>c.id),span:[list[0].y,list[0].y+.5]};scene.add(o);instanced.push(o);return o;};
for(const d of cabinDecks){const list=placements.filter(c=>c.y===d.y&&c.view==='atrium');part('Cabin_v2_shell_V2_lining_polished',list);part('Cabin_v2_shell_V2_cabin_view_glass',list);part('Cabin_v2_mattress',list);}
part('Cabin_v2_mattress',placements.filter(c=>c.view==='space'));
const lining=instanced[0].material,rooms=createAtriumRooms({scene,parent,placements,views,instanced,lining});
assert(rooms,'The rooms are made');assert.equal(rooms.stats.cabins,atrium.length,'Every atrium cabin, and no other');
for(const o of instanced)if(o.userData.cabinIds[0]!=='space-1'){const y=placements.find(c=>c.id===o.userData.cabinIds[0]).y;assert.deepEqual(o.userData.band,[y-.14,y+3.5],'A deck\'s cabin parts share the deck\'s range');}
const named=n=>parent.children.filter(o=>o.name===n),one=n=>{const l=named(n);assert.equal(l.length,1,'One '+n);return l[0];};
const card=one('P6_atrium_room_card'),sides=one('P6_atrium_room_sides'),ends=one('P6_atrium_room_ends'),pane=one('P6_atrium_room_pane');
assert.equal(sides.material,lining,'Side walls in the real wall\'s material');assert.equal(pane.material,instanced[1].material,'The pane in the real pane\'s glass');assert.equal(pane.geometry,instanced[1].geometry,'The pane is the real part');
const camera=new T.PerspectiveCamera(),frames=facade.children,walker=new T.Vector3(0,cabinDecks[0].y,10);
const look=(x,y,z)=>{camera.position.set(x,y,z);camera.updateMatrixWorld(true);rooms.update(camera,walker);};
const expect=(what)=>{const real=rooms.stats.shown+rooms.stats.reached,rest=atrium.length-real;
 assert.equal(card.count,atrium.length,'Every card draws ('+what+')');assert.equal(sides.count,atrium.length,'Every side wall draws ('+what+')');
 assert.equal(ends.count,rest,'Corridor ends only where the cabin is not real ('+what+')');assert.equal(pane.count,rest,'Panes only where the cabin is not real ('+what+')');
 for(const o of frames)assert.equal(o.count,rest,'Frame stand-ins only where the cabin is not real ('+what+')');
 for(const o of rooms.pool.children){assert.equal(o.count,rooms.stats.reached,'The pool holds the reached cabins ('+what+')');assert.equal(o.visible,rooms.stats.reached>0);}};
look(8,cabinDecks[0].y+2,10);assert.equal(rooms.stats.shown,12);assert.equal(rooms.stats.reached,0,'Mid-atrium nothing is reached');expect('mid-atrium');
assert.equal(rooms.pool.children.length,3,'One pooled copy of each part of the kind');
for(const o of rooms.pool.children)assert(instanced.some(src=>src.geometry===o.geometry&&src.material===o.material),'Pooled parts are the deck parts themselves');
look(8,cabinDecks[2].y+1.7,-3.7-3);assert(rooms.stats.reached>=6,'Close to another deck\'s windows its rooms are real');expect('by the windows two decks up');
const m4=new T.Matrix4(),mats=new Set(atrium.filter((c,i)=>rooms.state[i]===2).map(c=>c.matrix.elements.join()));
for(let i=0;i<rooms.pool.children[0].count;i++){rooms.pool.children[0].getMatrixAt(i,m4);assert(mats.has(Array.from(m4.elements,(v,k)=>atrium.find(c=>Math.abs(c.matrix.elements[12]-m4.elements[12])<1e-4&&Math.abs(c.matrix.elements[13]-m4.elements[13])<1e-4&&Math.abs(c.matrix.elements[14]-m4.elements[14])<1e-4).matrix.elements[k]).join()),'Each pooled cabin stands where a reached cabin does');}
// The same camera with the walker on another deck: the reached rooms on the walker's new deck become that deck's own.
const before=rooms.stats.reached;walker.y=cabinDecks[2].y;look(8,cabinDecks[2].y+1.7,-3.7-3);
assert.equal(rooms.stats.shown,12);assert(rooms.stats.reached<before&&rooms.stats.reached>0,'The walker\'s deck needs no pooled copies');expect('walker on the camera\'s deck');
look(8,cabinDecks[0].y+2,10);assert.equal(rooms.stats.reached,0);expect('back mid-atrium');
console.log(JSON.stringify({status:'PASS',cabins:rooms.stats.cabins,poolParts:rooms.pool.children.length,changes:rooms.stats.changes}));
