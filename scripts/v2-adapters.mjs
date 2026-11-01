// These temporary adapters must be folded into selected source at cutover.
import fs from 'node:fs/promises';
import {launchBAdapters,launchBAnchors} from './launch-b-adapters.mjs';
import {gotoAdapters,gotoAdapterAnchors} from './goto-adapters-v2.mjs';
export const adapterAnchors={
 "src/v2/cabin-privacy.js":"child.geometry.clone().applyMatrix4(child.matrix)",
 ...launchBAnchors,
 ...gotoAdapterAnchors,
 "src/walk/paintings.js":"import * as T from 'three';",/*cache-input-adapter:start*/
 "src/walk/lift-tile-floor.js":"import * as T from 'three';",
 "src/walk/vault.js":"import * as T from 'three';",
 "src/walk/vault-lift.js":"import * as T from 'three';",
 "src/walk/kittens.js":"import {roomObject} from '../plan/rooms.js';",
 "src/walk/prepare.js":"import {findRestSpots,solidSpots} from './rest.js';",
 "src/walk/lounge-falls.js":"import * as T from 'three';",
/*cache-input-adapter:end*/
 "src/walk/halloween.js":"import * as T from 'three';",
 "src/transit.js":"import * as T from 'three';",
 "src/walk/minimap.js":"import {DECKS} from '../model.js';",
 "src/walk/render-bake.js":"import * as T from 'three';",
 "src/walk/lounge.js":"import * as T from 'three';",
 "src/walk/lounge-entrance-signs.js":"import * as T from 'three';",
 "src/walk/lounge-mural.js":"import * as T from 'three';",
 "src/garden-finish.js":"import * as T from 'three';",
 "src/mudwater-arena.js":"import * as T from 'three';",
 "src/walk/controller.js":"import * as T from 'three';",
 "src/walk/world.js":"import * as T from 'three';",
 "src/hydro-nip-lounge.js":"import * as T from 'three';",
 "src/walk/collision.js":"import * as T from 'three';",
 "src/walk/railings.js":"import * as T from 'three';",
 "src/plan/rooms.js": "import * as T from 'three';",
 "src/model.js": "import * as T from 'three';",
 "src/walk/main.js": "import '../plan/debug.js';",
 "src/walk/link.js": "// A link to a spot on the walk: walk.html?at=x,y,z&yaw=90&pitch=-10&view=first (ship metres, degrees). The page drops",
 "src/walk/places.js": "import * as T from 'three';",
 "src/walk/hex-floor.js": "import * as T from 'three';",
 "src/walk/lounge-floor.js": "import * as T from 'three';",
 "src/walk/commons-hall.js": "import * as T from 'three';",
 "src/walk/windows.js": "import * as T from 'three';"
};
class Source {
 constructor(file,text,issues,adapters){this.file=file;this.text=text.replaceAll('\r\n','\n');this.original=this.text;this.issues=issues;this.adapters=adapters;}
 require(target,kind='replace',original=false){const text=original?this.original:this.text,found=target instanceof RegExp?new RegExp(target.source,target.flags.replace('g','')).test(text):text.includes(target);this.adapters.push({file:this.file,kind,target:String(target)});if(!found)this.issues.push(this.file+': '+kind+' missing text '+JSON.stringify(String(target)));return found;}
 replace(target,value){if(this.require(target))this.text=this.text.replace(target,value);return this;}
 replaceAll(target,value){if(this.require(target,'replaceAll'))this.text=this.text.replaceAll(target,value);return this;}
 prepend(value){if(this.require(adapterAnchors[this.file],'prepend anchor',true))this.text=value+this.text;return this;}
 append(value){if(this.require(adapterAnchors[this.file],'append anchor',true))this.text+=value;return this;}
 splice(from,to,value){const a=this.text.indexOf(from),b=this.text.indexOf(to,Math.max(0,a));const ok=this.require(from,'splice start')&this.require(to,'splice end');if(ok&&b>a)this.text=this.text.slice(0,a)+value+this.text.slice(b);else if(ok)this.issues.push(this.file+': splice end precedes start '+JSON.stringify(to));return this;}
}
export function applyV2Adapters(file,text,{issues=[],adapters=[],collect=false}={}){const s=new Source(file,text,issues,adapters);
 if(file==='src/v2/cabin-privacy.js'){s.prepend("import {compactRenderGeometry} from './facade.js';\n").replace('child.geometry.clone().applyMatrix4(child.matrix)','compactRenderGeometry(child.geometry).applyMatrix4(child.matrix)');}
/*cache-input-adapter:start*/
  if(file==='src/walk/kittens.js'){s.prepend("import {recordKittenSupports} from '../v2/room-feature-supports.js';\n");s.replace(' return {group,solid};',' recordKittenSupports(ship,solid);return {group,solid};');}
  if(file==='src/walk/lounge-falls.js'){s.prepend("import {fittedLoungeFalls} from '../v2/lounge-falls-fit.js';\n");s.replace('export function createLoungeFalls(ship){','function createUnfittedLoungeFalls(ship){');s.append("\nexport function createLoungeFalls(ship){return fittedLoungeFalls(ship,createUnfittedLoungeFalls); }\n");}
  if(file==='src/walk/prepare.js'){s.prepend("import {prepareClubhouseAccess} from '../v2/clubhouse-access.js';\nimport {prepareV2LoungeFalls} from '../v2/lounge-falls-fit.js';\n");s.replace(' resolveRoomFrames(ship.root);',' resolveRoomFrames(ship.root);prepareV2LoungeFalls(ship,()=>createLoungeFalls(ship));').replace(' const colliders=buildColliders(ship', ' const accessLift=createVaultLift({addMover(){return{place(){}}}});prepareClubhouseAccess(ship,accessLift);\n const colliders=buildColliders(ship');}
  if(file==='src/walk/vault-lift.js')s.replace('[.08,H,END-FRONT,-1.2,H/2,(END+FRONT)/2]','[.08,H,.58,-1.2,H/2,FRONT+.29],[.08,H,.38,-1.2,H/2,END-.19],[.08,.25,1.44,-1.2,H-.125,2.6]');
  if(file==='src/walk/vault.js')s.prepend("import {fitV2VaultLiftSpec} from '../v2/vault-lift-fit.js';\n").replace("export const VAULT_LIFT={...world(XA+3.7,ZF/2),y:FLOOR,stops:[17,18,19].map(deck=>({deck,y:floorY(deck),label:`Deck ${deck}`}))};","export const VAULT_LIFT=fitV2VaultLiftSpec({...world(XA+3.7,ZF/2),y:FLOOR,stops:[17,18,19].map(deck=>({deck,y:floorY(deck),label:`Deck ${deck}`}))});");
  if(file==='src/walk/lift-tile-floor.js')s.replace("piece(X0,X1,-HALF,HALF,'Lift_lobby_tile_floor');","piece(X0,Math.min(X1,-122),-HALF,HALF,'Lift_lobby_tile_floor');").replace("piece(BRIDGE[0],BRIDGE[1],BRIDGE[2],-HALF,'Lift_lobby_tile_bridge');","/* Removed centre-route bridge finish; the original aft lobby tile remains. */");
/*cache-input-adapter:end*/  if(file==='src/walk/halloween.js'){s.prepend("import {halloweenLanes,laneRange,lanePoint,laneYaw,laneWalls,warpHalloweenDecor,mappedClownCabins,clownPose,clownLocal,clownNear,clownFacing} from '../v2/halloween-layout.js';\n");s.replace('LANES=[-52,-26,0,26,52],FACE=2','LANES=halloweenLanes,FACE=1.3');s.splice('function walls(mid,s){','// A flat quad on a lane wall,','function walls(mid,s){return laneWalls(mid,s); }\n');s.replace('for(let x=-117;x<=123;x+=9.2)','for(let x=laneRange(mid)[0];x<=laneRange(mid)[1];x+=9.2)');s.replace('for(let x=-120;x<=120;x+=6)','for(let x=laneRange(mid)[0];x<=laneRange(mid)[1];x+=6)');s.replace('at:new T.Vector3(x+(r()-.5)*.6,CEILING-.02,mid+(r()-.5)*.8),heading:','at:lanePoint(mid,x+(r()-.5)*.6,CEILING-.02,(r()-.5)*.8),heading:laneYaw(mid,x)+');s.replaceAll('last=-200+(s>0?11:0)','last=laneRange(mid)[0]-22+(s>0?11:0)');s.replaceAll('lastSign=-200+(s>0?20:0)','lastSign=laneRange(mid)[0]-40+(s>0?20:0)');s.replace('TRAY=[1.62,.08,-2.48],GLASS=-1.32','TRAY=[1.07,.08,-2.83],GLASS=-1.48');s.replace('CLOWN_CABINS.map(id=>CABINS.find(c=>c.id===id)).filter(Boolean)','mappedClownCabins(CLOWN_CABINS)');s.replace('g.position.set(c.x+k*TRAY[0],TRAY[1],c.z+k*TRAY[2]);g.rotation.y=k>0?0:Math.PI;','const pose=clownPose(c);g.position.set(...pose.position);g.rotation.y=pose.yaw;g.userData.cabin=c.id;');s.replace('const inCabin=(c,p)=>{const dx=(p.x-c.cabin.x)*c.k,dz=(p.z-c.cabin.z)*c.k;return p.y>FLOOR-.5&&p.y<FLOOR+3.4&&Math.abs(dx)<2&&dz>-3&&dz<3.1?{dx,dz}:null;};','const inCabin=(c,p)=>clownLocal(c.cabin,p);');s.replace('Math.atan2(at.dx-TRAY[0],at.dz-TRAY[2])','Math.atan2((at.dx-TRAY[0])*clownFacing(c.cabin),at.dz-TRAY[2])');s.replace("if(at&&at.dz>GLASS&&Math.hypot(at.dx-1.45,at.dz-GLASS-.45)<1.3)","if(at&&clownNear(c.cabin,p))");s.replace(" // The deck's sound:"," warpHalloweenDecor(group);\n // The deck's sound:");}
  if(file==='src/transit.js'){s.replace('function floor(deck,x0,x1,z0,z1,name){',"function floor(deck,x0,x1,z0,z1,name){if(deck>=16&&/^(Garden_central_promenade|Garden_entry_bridge|Stair_to_garden_bridge)$/.test(name))return null;");s.replace('root.userData.graph=graph;',"graph.nodes=graph.nodes.filter(n=>!/^garden_/.test(n.id));const valid=new Set(graph.nodes.map(n=>n.id));graph.edges=graph.edges.filter(e=>valid.has(e.a)&&valid.has(e.b)&&!(e.type==='central corridor'&&Number(e.a.match(/_d(\\d+)$/)?.[1])>=16));root.userData.graph=graph;");}
  if(file==='src/walk/minimap.js')s.replace(' const shown=[];'," if(number===20){for(const z of[-12.5,12.5]){const[cx,cz]=at(132,z);g.font='bold '+(10*dpr)+'px sans-serif';g.fillStyle='#f4c68c';g.strokeStyle='#121b24';g.lineWidth=3*dpr;for(const[label,dy]of[['Crew gallery',-7],['Crew only',7]]){g.strokeText(label,cx,cz+dy*dpr);g.fillText(label,cx,cz+dy*dpr);}}}\n const shown=[];");
  if(file==='src/walk/minimap.js'){s.replace("import {SHIP_AREAS} from '../areas.js';","import {mapRooms as SHIP_AREAS,currentMapPlaces} from '../v2/map-labels.js';\nimport {contains} from '../plan/geometry-v2.js';").replace('const inside=(a,[ax,az],e=0)=>','const inside=(a,[ax,az],e=0)=>a.polygon?contains(a.polygon,[ax,az]):').replace('for(const p of places){','for(const p of currentMapPlaces(places)){').replace('const y=floorY(number),here=places.filter','const y=floorY(number),here=currentMapPlaces(places).filter');}
  if(file==='src/plan/rooms.js'){
   s.prepend("import layout from 'v2-layout';\nimport {hullOwnerAt} from '../v2/ownership.js';\n").replace('LAYOUT_VERSION=1','LAYOUT_VERSION=2').replace('export function roomAt(','function legacyRoomAt(').append("\nexport function roomAt(point,options={}){return (!options.legacy&&hullOwnerAt(point))||legacyRoomAt(point,options); }\n");
   s.append(`
// Prepared worlds restore registry identity without applying room transforms twice.
export function captureRoomAnchors(root){const rows=[];root.traverse(o=>{const a=objects.get(o);if(a)rows.push({uuid:o.uuid,id:a.id,applied:a.applied,base:a.base?.toArray()});});return rows;}
export function restoreRoomAnchors(root,rows){if(!Array.isArray(rows))throw Error('Missing prepared room anchors');const nodes=new Map();root.traverse(o=>nodes.set(o.uuid,o));for(const r of rows){const o=nodes.get(r.uuid);if(!o)throw Error('Missing prepared room anchor '+r.id);objects.set(o,{id:r.id,applied:true,...(r.base?{base:new T.Matrix4().fromArray(r.base)}:{})});}deferred=false;}
`);
   const at='export const registry=';
   const init=`// Production frames are the selected plan, rather than a debug override.\nfor(const r of [...layout.rooms,...layout.fixedRooms,...layout.cabins]){if(r.aggregate)continue;if(!entries.has(r.id))add({id:r.id,name:r.name||r.id,origin:r.frame?.origin||[r.x,r.y,r.z],size:r.size||[r.width,r.height,r.depth],deck:r.deck,yaw:r.yaw||0,mirror:!!r.mirror});const owner=entries.get(r.id).parent||r.id;if(owner!==r.id)continue;overrides.set(owner,{origin:r.fittingFrame?.origin||r.frame?.origin||[r.x,r.y,r.z],yaw:r.fittingFrame?.yaw??r.frame?.yaw??r.yaw??0,mirror:!!r.mirror,deck:r.deck,size:r.size||[r.width,r.height,r.depth],bounds:r.fittingFrame?.bounds||null});}\nfor(const r of layout.rooms.filter(r=>/^nose-commons-/.test(r.id))){const id='nose-commons-'+Number(r.id.split('-').at(-1));if(entries.has(id))overrides.set(id,{origin:r.frame.origin,yaw:r.frame.yaw,mirror:false,size:r.size,bounds:null});}\nconst arrival=layout.rooms.find(r=>r.id==='d02-arrival-1');overrides.set('arrival-assembly',{origin:arrival.frame.origin,yaw:arrival.frame.yaw,mirror:false});\n`;
   s.replace('export function instanceRoom(o,i){','export function instanceRoom(o,i){if(o.userData.cabinIds)return (o.userData.currentCabinIds||o.userData.cabinIds)[i];');
   s.replace('export function baselineMatrix(o,i=null){','export function baselineMatrix(o,i=null){if(i!==null&&o.userData.cabinIds){const m=new T.Matrix4();o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);const id=instanceRoom(o,i);return hasFrameOverride(id)?deltaMatrix(id).invert().multiply(m):m;}');
   s.replace('const entries=new Map(),overrides=new Map()', 'const selectedFrames=new Map(),entries=new Map(),overrides=new Map()');
   s.replace('o=overrides.get(owner);','selected=selectedFrames.get(owner),debug=overrides.get(owner),o=selected||debug?{...selected,...debug}:null;');
   s.replace('const a=v1Frame(id);if(a.fixed)', 'const a={...v1Frame(id),...selectedFrames.get(id)};if(a.fixed)');
   s.replace('()=>overrides.size>0','()=>selectedFrames.size>0||overrides.size>0').replace('id=>overrides.has(motionOwner(id))','id=>selectedFrames.has(motionOwner(id))||overrides.has(motionOwner(id))');
   s.replace(at,init.replaceAll('overrides.set(', 'selectedFrames.set(')+at).replace('[w,h,d]=a.size,lo=a.bounds?.[0]','[w,h,d]=f.size,lo=f.bounds?.[0]').replace('hi=a.bounds?.[1]','hi=f.bounds?.[1]');
  }
  if(file==='src/hydro-nip-lounge.js'){
   s.prepend("import layout from 'v2-layout';\nconst v2MazeFit=(()=>{const r=layout.rooms.find(r=>r.id==='commons-1'),p=r.components.pieces.find(p=>p.name==='Haze Maze tower'),t=r.components.mazeTubes,toLocal=z=>27+r.side*(z-r.z);return {dx:p.center[0]-r.x+132-117.25,dz:toLocal(p.center[2])-26,front:toLocal(t[0].to),rear:toLocal(t[1].to)};})();\n");
   s.replace('const at=[117.5,FLOOR,12.6]', 'const at=[140.8,FLOOR,10.6]');
   s.replace('MAZE={x0:114,x1:120.5,z0:19,z1:33,top:35.2}', 'MAZE={x0:114+v2MazeFit.dx,x1:120.5+v2MazeFit.dx,z0:19+v2MazeFit.dz,z1:33+v2MazeFit.dz,top:35.2}');
   s.replace('CELLS={x0:114.1,z0:19.1', 'CELLS={x0:114.1+v2MazeFit.dx,z0:19.1+v2MazeFit.dz');
   s.replace('TUBES=[{x:119.4,level:LEVELS[0],from:MAZE.z0,to:12},{x:118,level:LEVELS[1],from:MAZE.z1,to:42}]','TUBES=[{x:119.4+v2MazeFit.dx,level:LEVELS[0],from:MAZE.z0,to:v2MazeFit.front},{x:118+v2MazeFit.dx,level:LEVELS[1],from:MAZE.z1,to:v2MazeFit.rear}]');
   s.replace('[[118.1,23.6,3.4,4.4,LEVELS[0]],[117.4,29.9,4.6,4.4,LEVELS[1]]])', '[[118.1,23.6,3.4,4.4,LEVELS[0]],[117.4,29.9,4.6,4.4,LEVELS[1]]].map(([x,z,...rest])=>[x+v2MazeFit.dx,z+v2MazeFit.dz,...rest]))');
   s.replace('[[117,23.2,LEVELS[0]],[117,25.4,LEVELS[0]],[116.2,31.2,LEVELS[1]],[119.4,31.6,LEVELS[1]]].forEach', '[[117,23.2,LEVELS[0]],[117,25.4,LEVELS[0]],[116.2,31.2,LEVELS[1]],[119.4,31.6,LEVELS[1]]].map(([x,z,y])=>[x+v2MazeFit.dx,z+v2MazeFit.dz,y]).forEach');
   s.replace('at:[116.6,FLOOR+3.15,z0-.1]', 'at:[116.6+v2MazeFit.dx,FLOOR+3.15,z0-.1]');
  }
  if(file==='src/mudwater-arena.js'){s.prepend("import {removeGeometryCaps} from './v2/geometry.js';\n").replaceAll('[w,.012,t]','[w+t,.012,t]').replace('[t,.012,dz]','[t,.012,dz-(dz/2<10.3?t:0)]').replace('const g=new T.BoxGeometry(...size);if(ry)',"const g=new T.BoxGeometry(...size);if(name==='Arena_floor_inlay'&&size[2]>size[0]&&size[2]/2<10.3)removeGeometryCaps(g,2);if(ry)");}

  if(file==='src/walk/render-bake.js'){
   // Exact hull/window cuts and owned room finishes resolve overlaps at production time.
   // Moving those edges later can put a floor or guard back into a window reveal.
   s.replace('const bands=new Map(),normal=new T.Matrix3(),xyz=[0,0,0],nudges=coplanarNudges(taken);','const bands=new Map(),normal=new T.Matrix3(),xyz=[0,0,0],nudges=coplanarNudges(taken.filter(o=>o.name!=="Deck_slab"&&o.name!=="V2_glass_wall"&&!o.userData.batchedEnvelope&&!o.userData.hullEnvelopeBatch&&!o.userData.hullSkinSurface&&!/^Smooth_pressure_envelope/.test(o.name)&&!o.userData.v2SkinClipped&&!o.userData.v2WindowClipped));');
   s.replace("const I=b.vertices>65535?","const preparedRanges=[];const recordRange=(o,vertex,start)=>{const owner=o.geometry.attributes._leo_owner,finish=o.geometry.attributes._leo_finish,own=owner?o.userData.ownerTable?.[owner.getX(vertex)]:null,name=finish?o.userData.finishNames?.[finish.getX(vertex)]:null,previous=preparedRanges.at(-1);if(previous&&previous.source===o.uuid&&previous.owner===own&&previous.finish===name&&previous.start+previous.count===start){previous.count++;return;}preparedRanges.push({source:o.uuid,name:o.name,owner:own,finish:name,start,count:1,userData:Object.fromEntries(['room','interface','component','batchedEnvelope','hullEnvelopeBatch','hullSkinSurface','collisionOnly','role','noCollide','envelopeKind'].filter(k=>o.userData[k]!==undefined).map(k=>[k,o.userData[k]]))});};const I=b.vertices>65535?");
   s.replace('I[io++]=f(0)+vo;','recordRange(o,f(0),io/3);I[io++]=f(0)+vo;');
   s.replace('I[io++]=vo;I[io++]=vo+a;','recordRange(o,idx?idx[t]:t,io/3);I[io++]=vo;I[io++]=vo+a;');
   s.replace('geo.setIndex(new T.BufferAttribute(I,1));','geo.userData.preparedRanges=preparedRanges;geo.setIndex(new T.BufferAttribute(I,1));');
  }
  if(file==='src/walk/controller.js')s.replace('this.colliders.raycast(this.ray,up+down)','(this.colliders.raycastGround||this.colliders.raycast).call(this.colliders,this.ray,up+down)');
  if(file==='src/walk/world.js')s.replace('if(SURFACE.test(o.name))return;','if(SURFACE.test(o.name)||o.userData.hullEnvelopeBatch||o.userData.hullSkinSurface)return;');
  if(file==='src/walk/lounge.js')s.prepend("import layout from 'v2-layout';\nimport {fitNativeLounge} from '../v2/skin-retirement.js';\n").replace(' return {\n  drawn,doors,',' fitNativeLounge(ship,layout,drawn,mural);\n return {\n  drawn,doors,');
  if(file==='src/walk/lounge-entrance-signs.js')s.prepend("import {fitLoungeEntrance} from '../v2/community-routes.js';\n").replace('group.updateMatrixWorld(true);placeObject(group,key);return group;','group.updateMatrixWorld(true);placeObject(group,key);fitLoungeEntrance(group,deck);return group;');
  if(file==='src/walk/lounge-mural.js')s.prepend("import {fitSynthwaveMural} from '../v2/community-routes.js';\n").replace('return {group,low:Math.min(back,left),top};','fitSynthwaveMural(group);return {group,low:FLOOR,top:FLOOR+3.65};').replace("if(typeof document==='undefined')return null;","const geometryOnly=typeof document==='undefined';").replace('map.wrapS=map.wrapT=T.ClampToEdgeWrapping;map.anisotropy=8;','if(map){map.wrapS=map.wrapT=T.ClampToEdgeWrapping;map.anisotropy=8;}').replace('const backMap=canvasTexture(','const backMap=geometryOnly?null:canvasTexture(').replace('const leftMap=canvasTexture(','const leftMap=geometryOnly?null:canvasTexture(').replaceAll('ROOM_Z1-.1-lift','ROOM_Z0+.1+lift');
  if(file==='src/garden-finish.js'){s.replace('[141.5,26.2,45.8],Math.PI','[141.5,26.2,8.2],0').replace('[x,y,45.8],Math.PI','[x,y,8.2],0').replace('24.61+level*.6,44.5','24.61+level*.6,39.5').replace('[43.53,45.47]','[38.53,40.47]').replace('43.8+i*.22','38.8+i*.22');}
  if(file==='src/model.js')s.prepend("import {configureV2Ship} from './v2/model.js';\n").replace('  return ship;','  return configureV2Ship(ship);').replace('[xx,25.45,44.5]','[xx,25.45,39.5]');
  if(file==='src/walk/main.js'){
   s.prepend("import {visibilityState} from '../v2/visibility-state.js';\nconst spanChanged=visibilityState(),renderMetrics={span:[]};let spanQuery=null;\nimport {createVisibilityQuery} from '../v2/visibility-query.js';\nimport {installDistantArchitecture} from '../v2/distant-architecture.js';\nimport {batchLowDeckDraws,separateAtriumPaving} from '../v2/facade.js';\nimport {phase4Culling} from '../v2/phase4-culling.js';\nlet phase4Visibility=null;\nimport {v2Signs} from '../v2/signs.js';\nimport {attachFacade,isolateStaticWorld} from '../v2/facade.js';\nimport {createCabinGlass} from '../v2/cabin-glass.js';\nimport {crewGalleryController} from '../v2/crew-gallery.js';\nlet cabinGlass=null,crewGallery=null;\n");
   s.replace('shapeInterior(ship.exterior,ship.inside);','// v2 slabs use the finished hull oracle; do not fair a second time.');
   s.replace('corridorTrim(lifts.signs,{inside:ship.inside,partitions:walkPlan.walls});','v2Signs(lifts.signs);');
   s.replace('stairSigns(lifts.signs,colliders);corridorSigns(lifts.signs);floorGuides(lifts.signs);','');

   
   s.replace('const b0=performance.now();baked=bakeForWalking(ship.root', 'ship.v2Haze=createHaze(ship);attachFacade(ship,scene);const b0=performance.now();baked=bakeForWalking(ship.root');
   s.replace('haze.add(createHaze(ship));','haze.add(ship.v2Haze);cabinGlass=createCabinGlass(ship,scene);crewGallery=crewGalleryController(ship);hangarDoor=createHangarDoor(scene,colliders);');
   s.replace('haze.add(ship.v2Haze);','haze.add(ship.v2Haze);separateAtriumPaving(ship);await installDistantArchitecture(ship,baked,haze,{phone,multiDraw:renderer.extensions.has("WEBGL_multi_draw")});');
   s.replace('camera.far-5,1500','140,1500');
   s.replace("document.body.dataset.ready='1';", "let firstViewReady=false;status('Preparing first view…');");
   s.replace("await buildShip();\ntry{localStorage.removeItem(STARTING);}catch{}","await buildShip();");
   s.replace('if(!arcade.isOpen&&!pool.isOpen&&!pinballGame.isOpen)draw(camera);',"if(!arcade.isOpen&&!pool.isOpen&&!pinballGame.isOpen){draw(camera);if(!firstViewReady){firstViewReady=true;timings.push(['First complete frame',Math.round(performance.now()-t0)]);document.body.dataset.ready='1';try{localStorage.removeItem(STARTING);}catch{}}}");
   s.replace('if(now-lastSpan<150)return viewSpan;lastSpan=now;','if(now-lastSpan<150)return viewSpan;lastSpan=now;if(!spanChanged(camera,p,0,0,colliders))return viewSpan;const spanStart=performance.now();');
   s.replace('return viewSpan=[low,high];','renderMetrics.span.push(performance.now()-spanStart);if(renderMetrics.span.length>600)renderMetrics.span.shift();return viewSpan=[low,high];');
   s.replace('const hit=colliders.raycast(ray.ray,90,.6)','const hit=(spanQuery??=createVisibilityQuery(colliders)).raycast(ray.ray,90,.6)');
   s.replace('const h=colliders.raycast(probe,12)','const h=(spanQuery??=createVisibilityQuery(colliders)).raycast(probe,12)');
   s.replace("q.name==='Remaining_499_furnished_cabins'","q.name==='V2_cabin_instances'").replace("q.name==='Repeated_cabin_walls'","q.name==='V2_cabin_shells'").replace('||o.count!==499','');
   s.replace('}\nlet imagingScans=null;\nlet baked=null',' isolateStaticWorld(ship,scene);ship.v2LowDeckBatches=await batchLowDeckDraws(baked,renderer);\n}\nlet imagingScans=null;\nlet baked=null');
   s.replace('o.count=order.length;o.instanceMatrix.needsUpdate=true;', 'o.userData.currentCabinIds=order.map(i=>o.userData.cabinIds[i]);o.count=order.length;o.instanceMatrix.needsUpdate=true;');
   s.replace('const [low,high]=span(p,now);','cabinGlass?.update(p);crewGallery?.update(p);const [low,high]=span(p,now);phase4Visibility?.update(camera,p,low,high,now);');
   s.replace("ship.inside.traverse(o=>{if(!o.isInstancedMesh)return;","phase4Visibility=phase4Culling(ship.inside,colliders);ship.inside.traverse(o=>{if(!o.isInstancedMesh||o.userData.phase4)return;");
  }
  if(file==='src/walk/main.js'){
   s.replace("  if(t.kind==='call')", "  if(t.kind==='launch-ladder'){goTo({at:t.at,yaw:heading,lv:2,resolved:true});return;}\n  if(t.kind==='cabin-glass'){cabinGlass.toggle(t.cabin);return;}\n  if(t.kind==='call')");
   s.replace(' const b=booth.near(p)||comics.near(p)||chinampa?.near(p);'," const ladder=hangarDoor?.near(p);if(ladder)return ladder;\n const privacy=cabinGlass?.near(p,new T.Vector3(Math.sin(heading),0,Math.cos(heading)));if(privacy)return privacy;\n const b=booth.near(p)||comics.near(p)||chinampa?.near(p);");
   s.replace('globalThis.__walk={registry,restSpots,','globalThis.__walk={registry,get phase4Visibility(){return phase4Visibility;},renderMetrics,get hangarDoor(){return hangarDoor;},get cabinGlass(){return cabinGlass;},restSpots,');
   s.replace('get live(){return live;}', 'get live(){return live;},get halloween(){return halloween;},get crewGallery(){return crewGallery;},get maze(){return maze;},get pinballMachine(){return pinballMachine;},get theatre(){return theatre;},get poolTable(){return poolTable;},get surgeryArms(){return surgeryArms;}');
  }
  if(file==='src/walk/link.js'){s.prepend("import {phase4LegacySpot} from '../v2/phase4-community.js';\nimport {remapLegacyCorridor} from '../v2/ship-log-remap.js';\nimport layout from 'v2-layout';\n").replace('const room=spot.room||roomAt(spot.at,{legacy:true});','const feature=phase4LegacySpot(spot);if(feature)return feature;const room=spot.room||roomAt(spot.at,{legacy:true});').replace('const room=spot.room||roomAt(spot.at,{legacy:true});',"const room=spot.room||roomAt(spot.at,{legacy:true});const corridor=remapLegacyCorridor(spot,room);if(corridor)return corridor;if(layout.cabinIdMap[room]){const id=layout.cabinIdMap[room],a=v1Frame(room),f=frame(id);return {...spot,room:id,at:toWorld(id,[0,0,0]),yaw:f.yaw+(spot.yaw??a.yaw)-a.yaw,lv:2,resolved:true};}");s.replace('LAYOUT_VERSION,roomAt,anchoredPoint,anchoredYaw','LAYOUT_VERSION,roomAt,anchoredPoint,anchoredYaw,frame,v1Frame,toLocal,toWorld').replace('at:room?anchoredPoint(room,spot.at):spot.at','at:room?fitLegacySpot(room,anchoredPoint(room,spot.at)):spot.at');s.append("\nfunction fitLegacySpot(id,p){const a=v1Frame(id),f=frame(id),l=toLocal(id,p);let changed=false;for(const k of [0,2]){const a0=a.bounds?.[0][k]??-a.size[k]/2,a1=a.bounds?.[1][k]??a.size[k]/2,b0=f.bounds?.[0][k]??-f.size[k]/2,b1=f.bounds?.[1][k]??f.size[k]/2;if(b1-b0<a1-a0){l[k]=Math.max(b0+.6,Math.min(b1-.6,l[k]));changed=true;}}return changed?toWorld(id,l):p;}\n");}
  if(file==='src/walk/paintings.js'){s.prepend("import {fitPhase4Painting,phase4PaintingPoint} from '../v2/phase4-community.js';\n").replace("placeObject(group,'painting/'+p.name);group.updateMatrixWorld(true);","placeObject(group,'painting/'+p.name);fitPhase4Painting(group,p);group.updateMatrixWorld(true);").replace("centre:new T.Vector3(...placed('painting/'+p.name))","centre:new T.Vector3(...phase4PaintingPoint(p.name,placed('painting/'+p.name)))");}
  if(file==='src/walk/hex-floor.js'){s.prepend("import layout from 'v2-layout';\n");s.splice('function hallways(){','export function createHexFloor',"function hallways(){const rects=[];for(const c of layout.circulation.corridors.filter(c=>c.deck===1))for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],w=c.width/2;rects.push([Math.min(a[0],b[0])-w,Math.max(a[0],b[0])+w,Math.min(a[1],b[1])-w,Math.max(a[1],b[1])+w]);}return {y:layout.decks[0].y,rects};}\n\n");}
  if(file==='src/walk/lounge-floor.js'){s.prepend("import {applyLoungeFloorFinish} from '../v2/lounge-floor-material.js';\n");s.splice('export function glossLoungeFloor(ship){','// The glare',"export function glossLoungeFloor(ship){return applyLoungeFloorFinish(ship); }\n\n");}
  if(file==='src/walk/commons-hall.js')s.replace('export function openCommonsHall(ship){','export function openCommonsHall(ship){return 0;');
  if(file==='src/walk/collision.js'){s.prepend("import {memoBVH} from '../v2/build-cache.js';\n");s.replace('n+=b.geometry.attributes.position.count/3','n+=(b.geometry.index?.count??b.geometry.attributes.position.count)/3');s.replace('function bvhOf(positions){', 'function bvhOf(positions){return memoBVH(positions,()=>uncachedBvhOf(positions));}\nfunction uncachedBvhOf(positions){\n const clean=new Float32Array(positions.length);let kept=0;for(let i=0;i<positions.length;i+=9){const ax=positions[i+3]-positions[i],ay=positions[i+4]-positions[i+1],az=positions[i+5]-positions[i+2],bx=positions[i+6]-positions[i],by=positions[i+7]-positions[i+1],bz=positions[i+8]-positions[i+2],nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;if(nx*nx+ny*ny+nz*nz>1e-16)for(let k=0;k<9;k++)clean[kept++]=positions[i+k];}positions=clean.subarray(0,kept);');}
  if(file==='src/walk/deck-map.js')s.replace('for(const [deck,axis,a0,a1,pos] of rails){','for(const [deck,axis,a0,a1,pos,y,z1] of rails){if(axis===2){const d=out.find(o=>o.number===deck);if(d){const n=Math.max(1,Math.ceil(Math.hypot(a1-a0,z1-pos)/(cell*.5)));for(let i=0;i<=n;i++){const k=at(a0+(a1-a0)*i/n,pos+(z1-pos)*i/n);if(k>=0)d.data[k]=MAP_CLASS.rail;}}continue;}');
  if(file==='src/walk/railings.js')s.replace('return rows.filter(r=>r[3]-r[2]>=.5);','return rows.filter(r=>r[3]-r[2]>=.1);').replace('||d.designed[n]&&!(d.height[n]===d.height[n])','');

  if(file==='src/walk/collision.js'){
   s.replace("constructor(){this.array=new Float32Array(4096);this.length=0;}","constructor(){this.array=new Float32Array(4096);this.length=0;this.flags=new Uint8Array(4096);this.flagLength=0;}");
   s.replace(" push9(src,at){"," pushFlag(flag){if(this.flagLength===this.flags.length){const a=new Uint8Array(this.flags.length*2);a.set(this.flags);this.flags=a;}this.flags[this.flagLength++]=flag;}\n push9(src,at){");
   s.replace("scratch.length=0;meshTriangles(o,scratch);","scratch.length=0;meshTriangles(o,scratch);const sightIgnored=!!o.userData.collisionOnly||[].concat(o.material).every(m=>m?.transparent&&m.opacity<.6);");
   s.replace("for(let i=0;i<scratch.length;i+=9){\n    const y0=","for(let i=0;i<scratch.length;i+=9){\n    const p=Array.from({length:9},(_,k)=>Math.fround(scratch[i+k])),ax=p[3]-p[0],ay=p[4]-p[1],az=p[5]-p[2],bx=p[6]-p[0],by=p[7]-p[1],bz=p[8]-p[2],nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;if(!(nx*nx+ny*ny+nz*nz>1e-16))continue;\n    const y0=");
   s.replace("list.push9(scratch,i);","list.push9(scratch,i);list.pushFlag(sightIgnored?1:0);");
   s.replace("const bvh=bvhOf(all);this.bands.set(b,{bvh,geometry:bvh.geometry,band:b});","const bvh=bvhOf(all),flags=new Uint8Array((old?.windowFlags?.length||0)+list.flagLength);if(old?.windowFlags)flags.set(old.windowFlags);flags.set(list.flags.subarray(0,list.flagLength),old?.windowFlags?.length||0);if(flags.length!==bvh.geometry.attributes.position.count/3)throw Error('Prepared collision visibility flags do not match triangles');bvh.leoWindowFlags=flags;this.bands.set(b,{bvh,geometry:bvh.geometry,band:b,windowFlags:flags});");
   s.replace(" get triangles(){"," raycastSight(ray,far=1e4,near=0){const box=new T.Box3().setFromPoints([ray.origin,ray.at(far,new T.Vector3())]).expandByScalar(.01),local=new T.Ray();let best=null;for(const [bvh,inverse,matrix]of this.near(box,ray)){local.copy(ray);if(inverse)local.applyMatrix4(inverse);for(const hit of bvh.raycast(local,T.DoubleSide,near,far)){if(bvh.leoWindowFlags?.[hit.faceIndex])continue;if(hit.distance<=far&&(!best||hit.distance<best.distance)){const normal=hit.face.normal.clone();if(matrix)normal.transformDirection(matrix);if(normal.dot(ray.direction)>0)normal.negate();best={distance:hit.distance,point:ray.at(hit.distance,new T.Vector3()),normal};}}}return best;}\n get triangles(){");
  }
  if(file==='src/walk/windows.js')s.replace(/export function openWindows\(([^)]*)\)\{/,'export function openWindows($1){return 0;');
 launchBAdapters(file,s);
 gotoAdapters(file,s);
  if(issues.length&&!collect)throw new Error('V2 source adapters failed:\n'+issues.join('\n'));return s.text;
}
export async function checkV2Adapters(root=process.cwd()){const issues=[],adapters=[];for(const file of Object.keys(adapterAnchors)){try{applyV2Adapters(file,await fs.readFile(root+'/'+file,'utf8'),{issues,adapters,collect:true});}catch(e){issues.push(file+': '+e.message);}}return {issues,adapters};}
