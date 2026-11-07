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
// The near facade's merged copy of the lift tower and aft-core architecture (P6_tower_architecture) is the same
// geometry the baked bands hold; while the full-height atrium bands draw, it only z-fights with them (feedback
// #267/#272), so it is hidden then. The distant haze copy is untouched.
// Only from the atrium up, though: the bands hold the aft core from about Deck 4, so for Decks 1-3 (the stairs and
// landings beside the arrival hall) the copy is the only geometry there is. Below the atrium floor the sight test used to
// turn the full-height bands on near the Deck 2 aft stairs, and hiding the copy then made the stairs vanish (2026-11-07
// report). Since the same day it never answers visible below the atrium floor (atrium-sight.js), and the copy always
// draws there anyway.
const towerCopies=[];
// Below the atrium floor, the rest of the near facade (the atrium's own architecture) draws only while the atrium bands
// do: unseen, it was still shaded in every pixel it covered, behind whatever hid it, as a logarithmic depth buffer tests
// depth only after shading. The arrival hall on Deck 2, which sees no atrium (atrium-sight.js), shaded about 100 layers
// of it per pixel on a phone. From Deck 6 up it always draws: it holds the fronts of the rooms on the atrium, seen from
// inside them while the atrium is not. The tower copies stay outside the gate: they stand in for the bands when those
// are hidden (lift-shaft glass seen from a car), and so do the aft stair flights (P6_tower_stairs), which nothing
// else draws.
const nearFacades=[];
const belowAtrium=()=>!!position&&position.y<fullAtriumSpan[0];
function applyTowerCopies(){const full=atriumViewSpan()!==null,below=belowAtrium();for(const o of towerCopies)o.visible=!full||below;for(const o of nearFacades)o.visible=full||!below;}
function applyAtriumFog(){applyTowerCopies();if(!fogs.length)return;const on=inOpenAtrium()||cameraVisible;for(const r of fogs){r.fog.near=on?ATRIUM_VIEW.fogNear:r.near;r.fog.far=on?ATRIUM_VIEW.fogFar:r.far;}}
export function registerAtriumArchitecture(root){if(root?.name==='V2_atrium_facade')root.traverse(o=>{if(o.isMesh&&o.name==='P6_tower_architecture'&&!towerCopies.includes(o))towerCopies.push(o);});
 // A prepared facade may arrive with the group already made (the authoring build ran this too).
 if(root?.name==='V2_atrium_facade'){let gated=root.getObjectByName('V2_atrium_facade_gated');
  if(!gated){gated=new T.Group();gated.name='V2_atrium_facade_gated';gated.userData.noCollide=true;for(const o of [...root.children])if(!towerCopies.includes(o)&&o.name!=='P6_tower_stairs')gated.add(o);root.add(gated);}
  if(!nearFacades.includes(gated))nearFacades.push(gated);gated.visible=atriumViewSpan()!==null||!belowAtrium();}root?.traverse(o=>{if(o.isInstancedMesh&&o.userData.proxySpans&&!architecture.some(a=>a.o===o))architecture.push({o,all:o.instanceMatrix.array.slice(),spans:o.userData.proxySpans});});updateProxies();}
function updateProxies(){for(const a of architecture){const selected=[];for(let i=0;i<a.spans.length;i++){const[lo,hi]=a.spans[i];if(!a.o.userData.distantProxy&&proxyY!==null&&lo<proxyY+3.5&&hi>proxyY-.5)continue;selected.push(i);}if(a.selected&&selected.length===a.selected.length&&selected.every((v,i)=>v===a.selected[i]))continue;a.selected=selected;selected.forEach((i,n)=>a.o.instanceMatrix.array.set(a.all.subarray(i*16,i*16+16),n*16));a.o.count=selected.length;a.o.visible=selected.length>0;a.o.instanceMatrix.needsUpdate=true;}}
export function setAtriumView(p){const changed=!position||(position.x-p.x)**2+(position.y-p.y)**2+(position.z-p.z)**2>=1e-8;if(changed){position={x:p.x,y:p.y,z:p.z};classified=undefined;fogClassified=undefined;cameraVisible=false;if(proxyY!==p.y){proxyY=p.y;updateProxies();}}applyAtriumFog();}
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
