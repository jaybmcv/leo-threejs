export function preparedWalkAdapters(file,text,{authoring=false,prepared=false}={}){
 let s=text;
 const replace=(a,b)=>{if(!s.includes(a))throw Error('Prepared walk adapter anchor missing: '+file+' '+a);s=s.replace(a,b);};
 if(authoring){
  if(file==='src/v2/skin-retirement.js'){
   s="import {rememberSample} from './bounded-samples.js';\n"+s;
   replace('cache.set(key,d);','rememberSample(cache,key,d);');
   replace('const moved=actors?fitGardenActors(ship,layout,authority):[]',"const moved=actors?(globalThis.__leoAuthoringWork?.('garden-actors-start'),fitGardenActors(ship,layout,authority)):[]");
   replace("for(const [index,o]of meshes.entries()){","const accelerated=globalThis.__leoAuthoringRetire?.({meshes,cuts,allMeshes,legacy,serial:o=>{const result=[];if(allMeshes||legacy.test(o.name)){const n=cutChartMany(o,cuts);if(n)result.push({mesh:o.name,windowFaces:n});if(!o.geometry.attributes.position.count){o.userData.v2RetiredExterior=true;o.removeFromParent();return result;}}const r=trimMeshToSkin(o,authority);if(r)result.push(r);return result;}});if(accelerated)return {rows:accelerated,moved};for(const [index,o]of meshes.entries()){globalThis.__leoAuthoringWork?.('retire-mesh',{index,total:meshes.length,name:o.name,vertices:o.geometry.attributes.position.count});");
  }
  if(file==='src/v2/build-cache.js'){
   replace("const before=o.geometry,input=JSON.stringify(","if(o.geometry.attributes.position.count>50000)globalThis.__leoAuthoringWork?.('geometry-cache-key',{name:o.name,kind,vertices:o.geometry.attributes.position.count});const before=o.geometry,input=JSON.stringify(");
   replace("const a=positions instanceof Float32Array?positions:new Float64Array(positions),input=", "if(positions.length>500000)globalThis.__leoAuthoringWork?.('bvh-cache-key',{coordinates:positions.length});const a=positions instanceof Float32Array?positions:new Float64Array(positions),input=");
   replace("const bvh=compute(),r=MeshBVH.serialize(bvh", "if(positions.length>500000)globalThis.__leoAuthoringWork?.('bvh-cache-miss',{coordinates:positions.length});const bvh=compute(),r=MeshBVH.serialize(bvh");
  }
  if(file==='src/walk/collision.js'){replace('for(const [b,list] of this.pending){',"for(const [b,list] of this.pending){globalThis.__leoAuthoringWork?.('collision-band',{band:b,coordinates:list.length});");replace('function bvhOf(positions){return memoBVH(positions,()=>uncachedBvhOf(positions));}',"function bvhOf(positions){const start=performance.now();globalThis.__leoAuthoringWork?.('bvh-start',{coordinates:positions.length});try{return memoBVH(positions,()=>uncachedBvhOf(positions));}finally{globalThis.__leoAuthoringWork?.('bvh-complete',{coordinates:positions.length,ms:performance.now()-start});}}");}
  if(file==='src/v2/world.js')replace('const progress=message=>{','const progress=message=>{console.log(new Date().toISOString(),message);');
  if(file==='src/walk/prepare.js'){s=s.split('\n').map(line=>/^ (strip|prepare|placeAttendant|dress|resolveRoomFrames)/.test(line)&&line.includes('(')?' globalThis.__leoAuthoringWork?.(\"prepare-step\",{step:'+JSON.stringify(line.trim())+'});\n'+line:line).join('\n');s="import {checkpointPreparedWalk} from '../v2/prepared-authoring.js';\n"+s;replace('afterBase?.(colliders);','afterBase?.(colliders);checkpointPreparedWalk(ship);');}
  if(file==='src/walk/main.js'){replace('halloween=createHalloween(ship,','halloween=null;false&&createHalloween(ship,');s="import {initBrowserBuildCache} from '../v2/build-cache.js';import {installAuthoringWorkers} from '../v2/authoring-workers.js';await initBrowserBuildCache();await installAuthoringWorkers();\nimport {savePreparedWalk} from '../v2/prepared-authoring.js';\n"+s;replace('v2Signs(lifts.signs);','const signsBefore=new Set(lifts.signs.children);v2Signs(lifts.signs);ship.v2PreparedSigns=new T.Group();ship.v2PreparedSigns.name=\"Prepared_v2_signs\";for(const o of lifts.signs.children)if(!signsBefore.has(o))ship.v2PreparedSigns.add(o.clone(true));');replace(" isolateStaticWorld(ship,scene);"," await savePreparedWalk(ship,{colliders,baked,haze:ship.v2Haze,lounge,restSpots,seats:prepared.seats});\n await new Promise(()=>{});\n isolateStaticWorld(ship,scene);");}
 }
 if(prepared){
  if(file==='src/walk/main.js'){
   replace("status('Preparing the walk…');await idle();","status('Preparing the walk · 1/4 · placing the ship…');await idle();");
   replace('const toBand=o=>{',"status('Preparing the walk · 2/4 · placing activities…');await idle();\n const toBand=o=>{");
   replace('mct=createTransporters({colliders,lifts});',"status('Preparing the walk · 3/4 · connecting transport and displays…');await idle();\n mct=createTransporters({colliders,lifts});");
   replace('phase4Visibility=phase4Culling(ship.inside,colliders);',"status('Preparing the walk · 4/4 · setting nearby details…');await idle();\n phase4Visibility=phase4Culling(ship.inside,colliders);");
   replace('if(wardTrolley)toBand(wardTrolley.group);','if(typeof __WALK_DEBUG__!=="undefined"&&__WALK_DEBUG__)ship.v2RuntimeFeatures={wardTrolley,baggage,freightGate};if(wardTrolley)toBand(wardTrolley.group);');
   s+="\nif(typeof __WALK_DEBUG__!==\"undefined\"&&__WALK_DEBUG__)Object.defineProperties(globalThis.__walk,{treasure:{get:()=>treasure},baggage:{get:()=>baggage},featureDiagnostics:{get:()=>ship.v2RuntimeFeatures}});\n";
   s="import {loadPreparedShip,preparedBake,preparedFacade,preparedHaze,preparedPlacements,preparedDecks,preparedSigns} from '../v2/prepared-runtime.js';\n"+s;
   replace("import {attachFacade,isolateStaticWorld} from '../v2/facade.js';","import {isolateStaticWorld} from '../v2/facade.js';");
   replace("import {createCabinGlass} from '../v2/cabin-glass.js';","import {createCabinGlass} from '../v2/prepared-cabin-glass.js';");
   replace("import {buildSteps,cabinPlacements,outsideOnly} from './world.js';","const cabinPlacements=preparedPlacements;");
   replace("import {DECKS} from '../model.js';","const DECKS=preparedDecks;");
   replace('deferRoomFrames();const ship=createShip({deferExterior:true,lazyInterior:true});scene.add(ship.root);','deferRoomFrames();const ship=await loadPreparedShip(scene,status);scene.add(ship.root);');
   const begin=s.indexOf('async function loadExterior(){'),end=s.indexOf('\nconst idle=',begin);if(begin<0||end<0)throw Error('Prepared exterior loading anchors missing');s=s.slice(0,begin)+'async function loadExterior(){}\n'+s.slice(end);
   const a=s.indexOf(' let done=0;const total=26;'),b=s.indexOf(" status('Fitting the walls…');",a);if(a<0||b<0)throw Error('Prepared interior anchors missing');s=s.slice(0,a)+s.slice(b);
   replace('const w0=performance.now(),opened=openWindows(ship,walkPlan.windows);clearGlass(ship.root);','const w0=performance.now(),opened=0;');
   replace('v2Signs(lifts.signs);','preparedSigns(ship,lifts.signs);');
   replace(' glossLoungeFloor(ship);quietFloorReflections(scene,scene.environment);',' quietFloorReflections(scene,scene.environment);');replace(' tileLiftFloor(ship);',' // The floor finish is in the prepared render bands.');
   replace('if(cosmoKit)globalThis.LeoCosmo.dressCats(ship.inside,cosmoKit);','// Fixed crew are already dressed in the prepared render bands.');
   replace('ship.exterior.traverse(o=>{if(o.isMesh&&outsideOnly(o))o.visible=false;});','// Exterior visibility was resolved by the build.');
   replace('ship.v2Haze=createHaze(ship);attachFacade(ship,scene);','ship.v2Haze=preparedHaze(ship);preparedFacade(ship,scene);');
   replace('baked=bakeForWalking(ship.root,{release:true})','baked=preparedBake(ship)');
   replace('for(const g of baked.bands.values())scene.add(g);','for(const g of baked.bands.values())scene.add(g);quietFloorReflections(scene,scene.environment);');
   replace('const prepared=prepareWalkWorld(ship,','const prepared=await prepareWalkWorld(ship,');
   s=s.split('\n').map(line=>/^(pawsOff|theatre|gaming|hexFloor)=/.test(line.trim())?line+'\n await idle();':line).join('\n');
   replace('for(const o of instanced){\n  if(!o.userData.boat&&(!o.userData.cabins','const sharedNear=new Map();for(const o of instanced){\n  if(!o.userData.boat&&(!o.userData.cabins');
   replace('const all=Array.from({length:o.count}',"const key=o.parent.uuid+'|'+(o.userData.cabinIds||[o.uuid]).join(',');if(sharedNear.has(key)){o.userData.near=sharedNear.get(key);continue;}const all=Array.from({length:o.count}");
   replace('o.userData.near={all,centres:all.map(m=>new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld))};','o.userData.near={all,centres:all.map(m=>new T.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld))};sharedNear.set(key,o.userData.near);');
  }
  if(file==='src/walk/prepare.js'){
   s="import {installPreparedColliders} from '../v2/prepared-codec.js';\n"+s;
   replace('export function prepareWalkWorld(','export async function prepareWalkWorld(');
   const a=s.indexOf(' const dropped='),b=s.indexOf(' afterBase?.(colliders);',a);if(a<0||b<0)throw Error('Prepared world anchors missing');s=s.slice(0,a)+' const dropped=0,colliders=installPreparedColliders(into,ship.v2PreparedColliders);\n'+s.slice(b);
   s=s.split('\n').map(line=>line.trim().startsWith('const ')&&line.includes('create')?line+'\n await new Promise(r=>setTimeout(r,0));':line).join('\n');
   replace('const restSpots=findRestSpots(ship.inside),seats=solidSpots(restSpots,colliders),lounge=createLounge(ship,colliders,light);','const restSpots=ship.v2PreparedRest,seats=ship.v2PreparedSeats.map(i=>restSpots[i]),lounge=createLounge(ship,colliders,light);');
  }
  if(file==='src/walk/lounge.js'){
   replace("import {fitNativeLounge} from '../v2/skin-retirement.js';","import {fitPreparedLounge as fitNativeLounge} from '../v2/prepared-runtime.js';");
  }
 }
 return s;
}
