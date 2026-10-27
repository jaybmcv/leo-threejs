// These temporary adapters must be folded into selected source at cutover.
import fs from 'node:fs/promises';
export const adapterAnchors={
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
  if(file==='src/plan/rooms.js'){
   s.prepend("import layout from 'v2-layout';\n").replace('LAYOUT_VERSION=1','LAYOUT_VERSION=2');
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
  if(file==='src/model.js')s.prepend("import {configureV2Ship} from './v2/model.js';\n").replace('  return ship;','  return configureV2Ship(ship);');
  if(file==='src/walk/main.js'){
   s.prepend("import {v2Signs} from '../v2/signs.js';\nimport {attachFacade,isolateStaticWorld} from '../v2/facade.js';\nimport {createCabinGlass} from '../v2/cabin-glass.js';\nlet cabinGlass=null;\n");
   s.replace('shapeInterior(ship.exterior,ship.inside);','// v2 slabs use the finished hull oracle; do not fair a second time.');
   s.replace('corridorTrim(lifts.signs,{inside:ship.inside,partitions:walkPlan.walls});','v2Signs(lifts.signs);');
   s.replace('stairSigns(lifts.signs,colliders);corridorSigns(lifts.signs);floorGuides(lifts.signs);','');
   s.replace('halloween=createHalloween(ship,','halloween=null;/* v1 seasonal lanes are intentionally retired. */ false&&createHalloween(ship,');
   
   s.replace('haze.add(createHaze(ship));','haze.add(createHaze(ship));attachFacade(ship,scene);cabinGlass=createCabinGlass(ship,scene);');
   s.replace("q.name==='Remaining_499_furnished_cabins'","q.name==='V2_cabin_instances'").replace("q.name==='Repeated_cabin_walls'","q.name==='V2_cabin_shells'").replace('||o.count!==499','');
   s.replace('}\nlet baked=null',' isolateStaticWorld(ship,scene);\n}\nlet baked=null');
   s.replace('o.count=order.length;o.instanceMatrix.needsUpdate=true;', 'o.userData.currentCabinIds=order.map(i=>o.userData.cabinIds[i]);o.count=order.length;o.instanceMatrix.needsUpdate=true;');
   s.replace('const [low,high]=span(p,now);','cabinGlass?.update(p);const [low,high]=[p.y-4,p.y+5];');
  }
  if(file==='src/walk/main.js'){
   s.replace("  if(t.kind==='call')", "  if(t.kind==='cabin-glass'){cabinGlass.toggle(t.cabin);return;}\n  if(t.kind==='call')");
   s.replace(' const b=booth.near(p)||comics.near(p);'," const privacy=cabinGlass?.near(p,new T.Vector3(Math.sin(heading),0,Math.cos(heading)));if(privacy)return privacy;\n const b=booth.near(p)||comics.near(p);");
   s.replace('globalThis.__walk={registry,restSpots,','globalThis.__walk={registry,get cabinGlass(){return cabinGlass;},restSpots,');
  }
  if(file==='src/walk/link.js'){s.replace('LAYOUT_VERSION,roomAt,anchoredPoint,anchoredYaw','LAYOUT_VERSION,roomAt,anchoredPoint,anchoredYaw,frame,v1Frame,toLocal,toWorld').replace('at:room?anchoredPoint(room,spot.at):spot.at','at:room?fitLegacySpot(room,anchoredPoint(room,spot.at)):spot.at');s.append("\nfunction fitLegacySpot(id,p){const a=v1Frame(id),f=frame(id),l=toLocal(id,p);let changed=false;for(const k of [0,2]){const a0=a.bounds?.[0][k]??-a.size[k]/2,a1=a.bounds?.[1][k]??a.size[k]/2,b0=f.bounds?.[0][k]??-f.size[k]/2,b1=f.bounds?.[1][k]??f.size[k]/2;if(b1-b0<a1-a0){l[k]=Math.max(b0+.6,Math.min(b1-.6,l[k]));changed=true;}}return changed?toWorld(id,l):p;}\n");}
  if(file==='src/walk/places.js'){s.replace('const room=anyFrameOverrides()?SHIP_AREAS.find(a=>a.id===roomAt(p.toArray()))','const selectedRoom=anyFrameOverrides()?roomAt(p.toArray()):null;const room=anyFrameOverrides()?SHIP_AREAS.find(a=>a.id===selectedRoom)');s.prepend("import layout from 'v2-layout';\n").replace('export const PLACES=','const originalPlaces=');s.append("\nexport const PLACES=[...originalPlaces,{name:'Atrium floor',detail:'Deck 6 · open atrium',at:[0,-19.7,0],yaw:Math.PI/2,resolved:true},{name:'Skywalk',detail:'Deck 20 · glass tower bridge',at:[128.3,36.3,12.5],yaw:-Math.PI/2,resolved:true},...layout.rooms.filter(r=>!r.aggregate&&r.door).map(r=>({name:r.name,detail:'Deck '+r.deck,room:r.id,at:r.door.center,yaw:0,lv:2,resolved:true}))];\n");}
  if(file==='src/walk/hex-floor.js'){s.prepend("import layout from 'v2-layout';\n");s.splice('function hallways(){','export function createHexFloor',"function hallways(){const rects=[];for(const c of layout.circulation.corridors.filter(c=>c.deck===1))for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],w=c.width/2;rects.push([Math.min(a[0],b[0])-w,Math.max(a[0],b[0])+w,Math.min(a[1],b[1])-w,Math.max(a[1],b[1])+w]);}return {y:layout.decks[0].y,rects};}\n\n");}
  if(file==='src/walk/lounge-floor.js')s.replace('const FLOORS=/^(','const owner=o=>objectRoom(o)||o.parent?.userData.room;\nconst FLOORS=/^(V2_room_floor|V2_garden_gallery|').replaceAll("objectRoom(o)==='commons-1'","owner(o)==='commons-1'");
  if(file==='src/walk/commons-hall.js')s.replace('export function openCommonsHall(ship){','export function openCommonsHall(ship){return 0;');
  if(file==='src/walk/collision.js')s.replace('function bvhOf(positions){', 'function bvhOf(positions){\n const clean=new Float32Array(positions.length);let kept=0;for(let i=0;i<positions.length;i+=9){const ax=positions[i+3]-positions[i],ay=positions[i+4]-positions[i+1],az=positions[i+5]-positions[i+2],bx=positions[i+6]-positions[i],by=positions[i+7]-positions[i+1],bz=positions[i+8]-positions[i+2],nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;if(nx*nx+ny*ny+nz*nz>1e-16)for(let k=0;k<9;k++)clean[kept++]=positions[i+k];}positions=clean.subarray(0,kept);');
  if(file==='src/walk/railings.js')s.replace('return rows.filter(r=>r[3]-r[2]>=.5);','return rows.filter(r=>r[3]-r[2]>=.1);');
  if(file==='src/walk/windows.js')s.replace(/export function openWindows\(([^)]*)\)\{/,'export function openWindows($1){return 0;');
 if(issues.length&&!collect)throw new Error('V2 source adapters failed:\n'+issues.join('\n'));return s.text;
}
export async function checkV2Adapters(root=process.cwd()){const issues=[],adapters=[];for(const file of Object.keys(adapterAnchors)){try{applyV2Adapters(file,await fs.readFile(root+'/'+file,'utf8'),{issues,adapters,collect:true});}catch(e){issues.push(file+': '+e.message);}}return {issues,adapters};}
