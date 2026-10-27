import {AREAS} from '../src/plan/v1.js';
import {addStructuralOpenings} from '../src/plan/structure-v2.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=process.cwd();
// All mutations are opt-in source adapters. The v1 sources and emitted bundle are unchanged.
export function v2Plugin(layout,{node=false}={}){layout=addStructuralOpenings(structuredClone(layout));const lounge=layout.rooms.find(r=>r.id==='observation-lounge');if(!lounge.fittingFrame){const p=lounge.polygon;const x=lounge.door.center[0];lounge.fittingFrame={origin:[x,lounge.y,0],yaw:0,bounds:[[-24,-2.31,Math.min(...p.map(p=>p[1]))],[Math.max(...p.map(p=>p[0]))-x,lounge.height,Math.max(...p.map(p=>p[1]))]]};}layout.fixedRooms??=AREAS.filter(a=>!layout.rooms.some(r=>r.id===a.id)).map(a=>({...a,frame:{origin:a.origin,yaw:0},width:a.size[0],height:a.size[1],depth:a.size[2],x:a.origin[0],y:a.origin[1],z:a.origin[2],center:a.origin,yaw:0,fixed:true}));layout={...layout,windows:[],decks:layout.decks.map(({programme,corridors,navigation,roomLines,residentialFront,...d})=>d),circulation:Object.fromEntries(['corridors','stairs','bridges','towers','lifts','ramps'].map(k=>[k,layout.circulation[k]]))};return {name:'leo-layout-2',setup(b){
 b.onResolve({filter:/^v2-layout$/},()=>({path:'layout',namespace:'v2-data'}));
 b.onLoad({filter:/.*/,namespace:'v2-data'},()=>({contents:JSON.stringify(layout),loader:'json'}));
 b.onResolve({filter:/.*/},a=>{
  if(/^(walk-partitions|walk-changes)$/.test(a.path))return null;
  if(node&&(!a.path.startsWith('.')&&!path.isAbsolute(a.path)))return {path:a.path,external:true};
  const legacy=a.path.endsWith('?legacy');if(legacy)a={...a,path:a.path.slice(0,-7)};
  let p=a.path==='three'?path.join(root,'node_modules/three/build/three.module.js'):a.path.startsWith('.')?path.resolve(a.resolveDir||root,a.path):path.isAbsolute(a.path)?a.path:require.resolve(a.path);
  if(!legacy&&p.endsWith(path.join('walk','railings.js')))p=path.join(root,'src/v2/railings.js');
  if(!legacy&&p.endsWith(path.join('walk','world.js')))p=path.join(root,'src/v2/world.js');
  if(p.endsWith(path.join('walk','rest.js'))&&!a.importer.endsWith(path.join('v2','rest.js')))p=path.join(root,'src/v2/rest.js');
  if(p.endsWith(path.join('walk','haze.js')))p=path.join(root,'src/v2/haze.js');
  return {path:p,namespace:'v2-source'};
 });
 b.onLoad({filter:/.*/,namespace:'v2-source'},async a=>{
  let actual=a.path,s;try{s=await fs.readFile(actual,'utf8');}catch(e){if(!actual.endsWith('.js'))throw e;actual=actual.slice(0,-3)+'.ts';s=await fs.readFile(actual,'utf8');}const file=path.relative(root,a.path).replaceAll('\\','/');
  if(file==='src/plan/rooms.js'){
   s="import layout from 'v2-layout';\n"+s.replace('LAYOUT_VERSION=1','LAYOUT_VERSION=2');
   const at='export const registry=';
   const init=`// Production frames are the selected plan, rather than a debug override.\nfor(const r of [...layout.rooms,...layout.fixedRooms,...layout.cabins]){if(r.aggregate)continue;if(!entries.has(r.id))add({id:r.id,name:r.name||r.id,origin:r.frame?.origin||[r.x,r.y,r.z],size:r.size||[r.width,r.height,r.depth],deck:r.deck,yaw:r.yaw||0,mirror:!!r.mirror});const owner=entries.get(r.id).parent||r.id;if(owner!==r.id)continue;overrides.set(owner,{origin:r.fittingFrame?.origin||r.frame?.origin||[r.x,r.y,r.z],yaw:r.fittingFrame?.yaw??r.frame?.yaw??r.yaw??0,mirror:!!r.mirror,size:r.size||[r.width,r.height,r.depth],bounds:r.fittingFrame?.bounds||null});}\nfor(const r of layout.rooms.filter(r=>/^nose-commons-/.test(r.id))){const id='nose-commons-'+Number(r.id.split('-').at(-1));if(entries.has(id))overrides.set(id,{origin:r.frame.origin,yaw:r.frame.yaw,mirror:false,size:r.size,bounds:null});}\nconst arrival=layout.rooms.find(r=>r.id==='d02-arrival-1');overrides.set('arrival-assembly',{origin:arrival.frame.origin,yaw:arrival.frame.yaw,mirror:false});\n`;
   s=s.replace('export function instanceRoom(o,i){','export function instanceRoom(o,i){if(o.userData.cabinIds)return (o.userData.currentCabinIds||o.userData.cabinIds)[i];');
   s=s.replace('export function baselineMatrix(o,i=null){','export function baselineMatrix(o,i=null){if(i!==null&&o.userData.cabinIds){const m=new T.Matrix4();o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);const id=instanceRoom(o,i);return hasFrameOverride(id)?deltaMatrix(id).invert().multiply(m):m;}');
   s=s.replace('const entries=new Map(),overrides=new Map()', 'const selectedFrames=new Map(),entries=new Map(),overrides=new Map()');
   s=s.replace('o=overrides.get(owner);','selected=selectedFrames.get(owner),debug=overrides.get(owner),o=selected||debug?{...selected,...debug}:null;');
   s=s.replace('const a=v1Frame(id);if(a.fixed)', 'const a={...v1Frame(id),...selectedFrames.get(id)};if(a.fixed)');
   s=s.replace('()=>overrides.size>0','()=>selectedFrames.size>0||overrides.size>0').replace('id=>overrides.has(motionOwner(id))','id=>selectedFrames.has(motionOwner(id))||overrides.has(motionOwner(id))');
   s=s.replace(at,init.replaceAll('overrides.set(', 'selectedFrames.set(')+at).replace('[w,h,d]=a.size,lo=a.bounds?.[0]','[w,h,d]=f.size,lo=f.bounds?.[0]').replace('hi=a.bounds?.[1]','hi=f.bounds?.[1]');
  }
  if(file==='src/model.js')s="import {configureV2Ship} from './v2/model.js';\n"+s.replace('  return ship;','  return configureV2Ship(ship);');
  if(file==='src/walk/main.js'){
   s=s.replaceAll('\r\n','\n');
   s="import {v2Signs} from '../v2/signs.js';\nimport {attachFacade,isolateStaticWorld} from '../v2/facade.js';\n"+s;
   s=s.replace('shapeInterior(ship.exterior,ship.inside);','// v2 slabs use the finished hull oracle; do not fair a second time.');
   s=s.replace('corridorTrim(lifts.signs,{inside:ship.inside,partitions:walkPlan.walls});','v2Signs(lifts.signs);');
   s=s.replace('stairSigns(lifts.signs,colliders);corridorSigns(lifts.signs);floorGuides(lifts.signs);','');
   s=s.replace('halloween=createHalloween(ship,','halloween=null;/* v1 seasonal lanes are intentionally retired. */ false&&createHalloween(ship,');
   
   s=s.replace('haze.add(createHaze(ship));','haze.add(createHaze(ship));attachFacade(ship,scene);');
   s=s.replace("q.name==='Remaining_499_furnished_cabins'","q.name==='V2_cabin_instances'").replace("q.name==='Repeated_cabin_walls'","q.name==='V2_cabin_shells'").replace('||o.count!==499','');
   s=s.replace('}\nlet baked=null',' isolateStaticWorld(ship,scene);\n}\nlet baked=null');
   s=s.replace('o.count=order.length;o.instanceMatrix.needsUpdate=true;', 'o.userData.currentCabinIds=order.map(i=>o.userData.cabinIds[i]);o.count=order.length;o.instanceMatrix.needsUpdate=true;');
   s=s.replace('const [low,high]=span(p,now);','const [low,high]=[p.y-4,p.y+5];');
  }
  if(file==='src/walk/link.js'){s=s.replace('LAYOUT_VERSION,roomAt,anchoredPoint,anchoredYaw','LAYOUT_VERSION,roomAt,anchoredPoint,anchoredYaw,frame,v1Frame,toLocal,toWorld').replace('at:room?anchoredPoint(room,spot.at):spot.at','at:room?fitLegacySpot(room,anchoredPoint(room,spot.at)):spot.at');s+="\nfunction fitLegacySpot(id,p){const a=v1Frame(id),f=frame(id),l=toLocal(id,p);let changed=false;for(const k of [0,2]){const a0=a.bounds?.[0][k]??-a.size[k]/2,a1=a.bounds?.[1][k]??a.size[k]/2,b0=f.bounds?.[0][k]??-f.size[k]/2,b1=f.bounds?.[1][k]??f.size[k]/2;if(b1-b0<a1-a0){l[k]=Math.max(b0+.6,Math.min(b1-.6,l[k]));changed=true;}}return changed?toWorld(id,l):p;}\n";}
  if(file==='src/walk/places.js'){s=s.replace('const room=anyFrameOverrides()?SHIP_AREAS.find(a=>a.id===roomAt(p.toArray()))','const selectedRoom=anyFrameOverrides()?roomAt(p.toArray()):null;const room=anyFrameOverrides()?SHIP_AREAS.find(a=>a.id===selectedRoom)');s="import layout from 'v2-layout';\n"+s.replace('export const PLACES=','const originalPlaces=');s+="\nexport const PLACES=[...originalPlaces,{name:'Atrium floor',detail:'Deck 6 · open atrium',at:[0,-19.7,0],yaw:Math.PI/2,resolved:true},{name:'Skywalk',detail:'Deck 20 · glass tower bridge',at:[128.3,36.3,12.5],yaw:-Math.PI/2,resolved:true},...layout.rooms.filter(r=>!r.aggregate&&r.door).map(r=>({name:r.name,detail:'Deck '+r.deck,room:r.id,at:r.door.center,yaw:0,lv:2,resolved:true}))];\n";}
  if(file==='src/walk/hex-floor.js'){s="import layout from 'v2-layout';\n"+s;const a=s.indexOf('function hallways(){'),z=s.indexOf('export function createHexFloor',a);s=s.slice(0,a)+"function hallways(){const rects=[];for(const c of layout.circulation.corridors.filter(c=>c.deck===1))for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],w=c.width/2;rects.push([Math.min(a[0],b[0])-w,Math.max(a[0],b[0])+w,Math.min(a[1],b[1])-w,Math.max(a[1],b[1])+w]);}return {y:layout.decks[0].y,rects};}\n\n"+s.slice(z);}
  if(file==='src/walk/lounge-floor.js')s=s.replace('const FLOORS=/^(','const owner=o=>objectRoom(o)||o.parent?.userData.room;\nconst FLOORS=/^(V2_room_floor|V2_garden_gallery|').replaceAll("objectRoom(o)==='commons-1'","owner(o)==='commons-1'");
  if(file==='src/walk/commons-hall.js')s=s.replace('export function openCommonsHall(ship){','export function openCommonsHall(ship){return 0;');
  if(file==='src/walk/windows.js')s=s.replace(/export function openWindows\(([^)]*)\)\{/,'export function openWindows($1){return 0;');
  return {contents:s,loader:actual.endsWith('.json')?'json':actual.endsWith('.ts')?'ts':'js',resolveDir:path.dirname(a.path)};
 });
}};}
