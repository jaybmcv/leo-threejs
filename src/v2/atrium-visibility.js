import * as T from 'three';
import {ATRIUM_VIEW} from './atrium-render-policy.js';
import layout from'../plan/selected-layout.js';import{contains,distanceToSegment,bounds}from'../plan/geometry-v2.js';import{ATRIUM_PROTOTYPE}from'../plan/atrium-v2.js';
let position=null,classified;const architecture=[],owners=new Map();
for(const r of[...layout.cabins,...layout.rooms.filter(r=>!r.aggregate),...(layout.hullPrototypes?.prototypes||[]).map(p=>({polygon:p.polygon,y:p.chart.origin[1],height:p.rect[3],deck:p.deck}))]){
 if(!r.polygon)continue;const box=bounds(r.polygon),y=r.y,height=r.height||3.4;
 for(const d of layout.decks)if(d.y>=y-.1&&d.y<y+height){let list=owners.get(d.number);if(!list)owners.set(d.number,list=[]);list.push({polygon:r.polygon,box,y,height});}
}
let proxyY=null,fogClassified,cameraVisible=false,cameraRange=null;const fogs=[];
const fullAtriumSpan=[layout.decks[5].y-.3,ATRIUM_PROTOTYPE.skyY+.1];
// Seen from outside it, the atrium draws only the heights the PVS says that sight reaches (setAtriumSight's range), when it
// says; from inside, or when the rays answered, it draws whole.
export function atriumViewSpan(){if(!ATRIUM_VIEW.fullHeight)return null;if(inOpenAtrium())return fullAtriumSpan;return cameraVisible?cameraRange??fullAtriumSpan:null;}
// The camera may see into the atrium while the walker is in an adjoining room.
export function setAtriumSight(visible,range=null){cameraVisible=!!visible;cameraRange=visible?range:null;applyAtriumFog();}
export function registerAtriumFog(fog){if(!fogs.some(r=>r.fog===fog))fogs.push({fog,near:fog.near,far:fog.far});applyAtriumFog();}
export function inOpenAtrium(){if(fogClassified!==undefined)return fogClassified;const p=position;if(!p||p.y<layout.decks[5].y-.3||p.y>39.94)return fogClassified=false;let d=layout.decks[5];for(const q of layout.decks)if(q.y<=p.y+.2)d=q;if(d.number<6||!d.atrium?.outline)return fogClassified=false;const ring=d.atrium.outline,v=[p.x,p.z];if(!contains(ring,v)&&!ring.some((a,i)=>distanceToSegment(v,a,ring[(i+1)%ring.length])<=3.5))return fogClassified=false;return fogClassified=!(owners.get(d.number)||[]).some(r=>p.y>=r.y-.1&&p.y<r.y+r.height&&p.x>=r.box.x0&&p.x<=r.box.x1&&p.z>=r.box.z0&&p.z<=r.box.z1&&contains(r.polygon,v));}
// The near facade's merged copy of the lift tower and aft-core architecture (P6_tower_architecture, and the aft stair
// flights in P6_tower_stairs) is the only geometry those parts have: addPhase6Architecture hides every source it takes
// before the walk's bake, so no deck band holds them. It always draws. From 2026-11-05 it was hidden while the
// full-height atrium bands drew, on the belief that it duplicated them (feedback #267/#272), and everything in it went
// whenever the atrium was in sight: the lift-shaft glass and guide columns at both cores, and the forward core's bridges
// and landings. The shaft glass came and went as a walker neared a lift, and the bridges had no undersides from the
// atrium floor (2026-11-08 report). On the live walk that day no band mesh held the shaft glass material, and every
// tower-copy mesh but the stairs was hidden at each open-atrium spot. The stair flights had already been split out of
// the gate for the same reason (#258). What #267/#272 saw was the copy's faces sharing planes with band parts around the
// cores; the copy now sits a few millimetres off them instead (separateAtriumPaving, facade.js). The distant haze copy
// is untouched.
const towerCopies=[];
// Below the atrium floor, the rest of the near facade (the atrium's own architecture) draws only while the atrium bands
// do: unseen, it was still shaded in every pixel it covered, behind whatever hid it, as a logarithmic depth buffer tests
// depth only after shading. The arrival hall on Deck 2, which sees no atrium (atrium-sight.js), shaded about 100 layers
// of it per pixel on a phone. From Deck 6 up it always draws: it holds the fronts of the rooms on the atrium, seen from
// inside them while the atrium is not. The tower copies (P6_tower_architecture, P6_tower_stairs) stay outside the gate:
// nothing else draws them, at any height.
const nearFacades=[];
const belowAtrium=()=>!!position&&position.y<fullAtriumSpan[0];
// A prepared facade keeps the visibility the authoring page last gave each mesh, so the copies are shown here too.
function applyTowerCopies(){const full=atriumViewSpan()!==null,below=belowAtrium();for(const o of towerCopies)o.visible=true;for(const o of nearFacades)o.visible=full||!below;}
function applyAtriumFog(){applyTowerCopies();if(!fogs.length)return;const on=inOpenAtrium()||cameraVisible;for(const r of fogs){r.fog.near=on?ATRIUM_VIEW.fogNear:r.near;r.fog.far=on?ATRIUM_VIEW.fogFar:r.far;}}
export function registerAtriumArchitecture(root){if(root?.name==='V2_atrium_facade')root.traverse(o=>{if(o.isMesh&&o.name==='P6_tower_architecture'&&!towerCopies.includes(o))towerCopies.push(o);});
 // A prepared facade may arrive with the group already made (the authoring build ran this too).
 if(root?.name==='V2_atrium_facade'){let gated=root.getObjectByName('V2_atrium_facade_gated');
  if(!gated){gated=new T.Group();gated.name='V2_atrium_facade_gated';gated.userData.noCollide=true;for(const o of [...root.children])if(!towerCopies.includes(o)&&o.name!=='P6_tower_stairs')gated.add(o);root.add(gated);}
  if(!nearFacades.includes(gated))nearFacades.push(gated);gated.visible=atriumViewSpan()!==null||!belowAtrium();}root?.traverse(o=>{if(o.isInstancedMesh&&o.userData.proxySpans&&!architecture.some(a=>a.o===o))architecture.push({o,all:o.instanceMatrix.array.slice(),spans:o.userData.proxySpans,fade:proxyFadeOn&&!o.userData.distantProxy?fadeProxy(o):null});});updateProxies();}
// While a room reaches from 0.5 m below the walker's feet to 3.5 m above them, the room's stand-in (the
// carcass and window frame) is hidden and the deck's real cabins draw instead: walls, doors and the nearest furniture
// (main.public.js cull, the same window). In the walk (enableAtriumProxyFade) the stand-in no longer stops in one frame at
// that edge: it carries on into the window, over the real room already drawing there, and dissolves with a screen-space
// dither over its first PROXY_FADE metres, so climbing, falling or gliding past the decks shows each row of rooms
// arriving, not snapping in (2026-11-08 glide video). Nothing more draws than the real rooms the window already holds,
// and standing on a deck changes nothing: the walker's own deck is 3.64 m inside its window, past the fade, and the
// decks above and below are outside theirs. Each fragment is drawn whole or discarded, so the stand-in stays opaque and
// nothing sorts; the walk's logarithmic depth already tests depth after shading, so the discard costs no early depth
// test. Off by default: the authoring build and the checks register the same meshes and keep them exactly as they were.
const PROXY_FADE=3;let proxyFadeOn=false;
export function enableAtriumProxyFade(){proxyFadeOn=true;}
function fadeMaterial(source){const m=source.clone();m.name=source.name+'_fade';
 m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('void main() {','attribute float proxyFade;\nvarying float vProxyFade;\nvoid main() {\n\tvProxyFade=proxyFade;');
  // An ordered 4x4 (Bayer) threshold reads as an even blend; a noise threshold sparkled while gliding.
  s.fragmentShader=s.fragmentShader.replace('void main() {','varying float vProxyFade;\nconst float PROXY_BAYER[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);\nvoid main() {\n\tif(vProxyFade<.999){ivec2 q=ivec2(gl_FragCoord.xy)&3;if((PROXY_BAYER[q.x+q.y*4]+.5)/16.>=vProxyFade)discard;}');};
 m.customProgramCacheKey=()=>'atrium-proxy-fade';return m;}
// The fade attribute goes on a geometry of the mesh's own that shares the source's buffers, so nothing else drawing
// that geometry (the cabins' own window trim) gains it, and a prepared vertex pool is not copied.
function fadeProxy(o){const s=o.geometry,g=new T.BufferGeometry();for(const[k,v]of Object.entries(s.attributes))g.setAttribute(k,v);g.setIndex(s.index);for(const r of s.groups)g.addGroup(r.start,r.count,r.materialIndex);g.setDrawRange(s.drawRange.start,s.drawRange.count);g.boundingBox=s.boundingBox;g.boundingSphere=s.boundingSphere;g.userData=s.userData;
 const fade=new T.InstancedBufferAttribute(new Float32Array(o.userData.proxySpans.length).fill(1),1);fade.setUsage(T.DynamicDrawUsage);g.setAttribute('proxyFade',fade);o.geometry=g;o.material=Array.isArray(o.material)?o.material.map(fadeMaterial):fadeMaterial(o.material);return fade;}
// How much of a stand-in shows: 1 outside the window, then down to 0 over the window's first PROXY_FADE metres (0 hides it).
export function atriumProxyFade(lo,hi,y,fade=proxyFadeOn){const gap=Math.max(lo-(y+3.5),y-.5-hi);if(gap>=0)return 1;if(!fade)return 0;const t=1+gap/PROXY_FADE;return t<=0?0:Math.round(t*t*(3-2*t)*64)/64;}
// Once the walk has captured what its cabins look like inside (atrium-room-views.js), the room stand-ins stop being
// stand-ins: every one stays drawn, at every height, painted with that capture (box-projected, so its walls, floor and
// ceiling keep their perspective), and a room never disappears or swaps as the walker passes its deck. It is drawn from
// the inside only (back faces), so from inside a cabin it is not there, and from a corridor it shows the room as through
// the open window. It sits 2-3 cm inside the real cabin's surfaces, so where the real cabin draws too (near the walker)
// the two never fight over a pixel: the stand-in covers the real walls and the real furniture stands in front of it. A
// cabin whose real furniture is drawn (main.public.js, the nearest cabins) shows the capture without furniture, so the
// furniture is never there twice; elsewhere the furnished capture. Within 5-8 m of the eye, where the real room is
// drawing, the stand-in dissolves so the real walls show at full sharpness; the two look alike, so nothing reads as a
// change. The window frames have one owner each: the stand-in frame until the real cabin draws, then the real one (the
// same front outline), with no dissolve.
const ROOM_NEAR=5,ROOM_FAR=8,roomUniforms={walkerY:{value:0}};let roomViews=false;
function roomMaterial(source,view){const m=source.clone();m.name='P6_atrium_room_view';m.side=T.BackSide;m.toneMapped=false;
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,{roomWalkerY:roomUniforms.walkerY,roomFull:{value:view.full.texture},roomEmpty:{value:view.empty.texture},roomRot:{value:view.rotation}});
  s.vertexShader=s.vertexShader.replace('void main() {','uniform float roomWalkerY;\nattribute float roomFurnished;\nvarying vec3 vRoomDir;\nvarying float vRoomFade;\nvarying float vRoomEmpty;\nvoid main() {')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
	vRoomDir=position;transformed*=vec3(.985,.985,.995);
	{vec3 centre=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;float gap=max(centre.y-1.84-(roomWalkerY+3.5),roomWalkerY-.5-(centre.y+1.8));
	vRoomFade=gap>=0.?1.:smoothstep(${ROOM_NEAR.toFixed(1)},${ROOM_FAR.toFixed(1)},distance(cameraPosition,centre));vRoomEmpty=roomFurnished;}`);
  s.fragmentShader=s.fragmentShader.replace('void main() {','uniform samplerCube roomFull;\nuniform samplerCube roomEmpty;\nuniform mat3 roomRot;\nvarying vec3 vRoomDir;\nvarying float vRoomFade;\nvarying float vRoomEmpty;\nconst float ROOM_BAYER[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);\nvoid main() {\n\tif(vRoomFade<.999){ivec2 q=ivec2(gl_FragCoord.xy)&3;if((ROOM_BAYER[q.x+q.y*4]+.5)/16.>=vRoomFade)discard;}')
   .replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec3 roomD=roomRot*vRoomDir;vec4 diffuseColor=vec4(sRGBTransferEOTF(vRoomEmpty>.5?textureCube(roomEmpty,roomD):textureCube(roomFull,roomD)).rgb,opacity);');};
 m.customProgramCacheKey=()=>'atrium-room-view';return m;}
// views: Map side (-1|1) -> {full, empty: WebGLCubeRenderTarget, rotation: Matrix3}; sides: Map cabin id -> side.
export function setAtriumRoomViews(views,sides){
 for(const a of architecture){if(a.o.name!=='P6_atrium_room_returns'||a.o.userData.distantProxy||!a.fade)continue;
  const view=views.get(sides.get(a.o.userData.roomOwners?.[0]));if(!view?.full||!view.empty)continue;
  const furnished=new T.InstancedBufferAttribute(new Float32Array(a.spans.length),1);furnished.setUsage(T.DynamicDrawUsage);a.o.geometry.setAttribute('roomFurnished',furnished);
  a.o.material=roomMaterial(a.o.material,view);a.o.material.userData.capture={ms:views.ms,worst:views.worst};a.room={furnished};a.selected=null;roomViews=true;}
 updateProxies();return roomViews;}
// The cabins whose real furniture is drawing (ids), so their stand-ins show the room without it.
export function setAtriumFurnished(ids){for(const a of architecture){if(!a.room)continue;const v=a.room.furnished,owners=a.o.userData.roomOwners;let changed=false;
 for(let i=0;i<owners.length;i++){const f=ids.has(owners[i])?1:0;if(v.array[i]!==f){v.array[i]=f;changed=true;}}if(changed)v.needsUpdate=true;}}
export const atriumStandIns=()=>architecture.map(a=>a.o);
function updateProxies(){
 for(const a of architecture){const near=!a.o.userData.distantProxy,selected=[],fades=[];
  for(let i=0;i<a.spans.length;i++){const[lo,hi]=a.spans[i],f=a.room?1:near&&proxyY!==null?atriumProxyFade(lo,hi,proxyY,!!a.fade&&!roomViews):1;if(f>0){selected.push(i);fades.push(f);}}
  if(a.selected&&selected.length===a.selected.length&&selected.every((v,i)=>v===a.selected[i])&&(!a.fade||fades.every((v,i)=>v===a.fades[i])))continue;
  a.selected=selected;a.fades=fades;selected.forEach((i,n)=>a.o.instanceMatrix.array.set(a.all.subarray(i*16,i*16+16),n*16));if(a.fade){a.fade.array.set(fades);a.fade.needsUpdate=true;}
  a.o.count=selected.length;a.o.visible=selected.length>0;a.o.instanceMatrix.needsUpdate=true;}}
export function setAtriumView(p){roomUniforms.walkerY.value=p.y;const changed=!position||(position.x-p.x)**2+(position.y-p.y)**2+(position.z-p.z)**2>=1e-8;if(changed){position={x:p.x,y:p.y,z:p.z};classified=undefined;fogClassified=undefined;cameraVisible=false;if(proxyY!==p.y){proxyY=p.y;updateProxies();}}applyAtriumFog();}
function classify(){if(classified!==undefined)return classified;const p=position;if(!p)return null;const d=layout.decks.reduce((a,b)=>Math.abs(a.y-p.y)<Math.abs(b.y-p.y)?a:b);
 if(d.number<6||!d.atrium?.outline)return classified=null;
 const q=[p.x,p.z],ring=d.atrium.outline;
 if(Math.abs(p.y-d.y)>1.6||!contains(ring,q)&&!ring.some((a,i)=>distanceToSegment(q,a,ring[(i+1)%ring.length])<=3.5))return classified=null;
 if((owners.get(d.number)||[]).some(r=>p.y>=r.y-.1&&p.y<r.y+r.height&&p.x>=r.box.x0&&p.x<=r.box.x1&&p.z>=r.box.z0&&p.z<=r.box.z1&&contains(r.polygon,q)))return classified=null;
 return classified=[p.y-ATRIUM_PROTOTYPE.interiorReach,p.y+ATRIUM_PROTOTYPE.interiorReach];
}
export function fastAtriumSpan(p){setAtriumView(p);return classify();}
export function atriumSpan(low,high){const span=classify();return span?[Math.max(low,span[0]),Math.min(high,span[1])]:[low,high];}
export function onePassAtriumGlass(root){if(root.isScene&&root.fog)registerAtriumFog(root.fog);root.traverse(o=>{for(const m of[].concat(o.material||[]))if(m.transparent&&m.side===2)m.forceSinglePass=true;});}
