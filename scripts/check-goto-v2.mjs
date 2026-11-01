import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build,transform} from 'esbuild';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {runtimeLayout} from './v2-plugin.mjs';
import {applyV2Adapters,checkV2Adapters} from './v2-adapters.mjs';
import {gotoAdapters} from './goto-adapters-v2.mjs';
import {contains} from '../src/plan/geometry-v2.js';
import {buildGotoPlaces,groupPlaces,describeV2,deckDirectory,isCrewGallery} from '../src/v2/wayfinding-data.js';
import {featurePlaces} from '../src/v2/goto-features.js';
import {guideSchedule,lobbySchedule} from '../src/v2/wayfinding-guide-data.js';
import {checkGotoFloors,gotoFloor} from '../src/v2/goto-floor.js';
import {readGotoColliders} from './goto-colliders-v2.mjs';
import {livePosesV2} from './live-poses-v2.mjs';
const layout=runtimeLayout(JSON.parse(await fs.readFile('output/leo-interior-v02/layout.json','utf8')));
assert(layout.decks.every(d=>!('corridors'in d)),'Fixture must exercise the trimmed walk layout');
const places=buildGotoPlaces(layout,featurePlaces(layout)),ids=new Set(places.map(p=>p.id));
for(const r of [...layout.rooms,...layout.fixedRooms].filter(r=>!r.aggregate&&!isCrewGallery(r)))assert(ids.has(r.id),'Room missing from Go-to '+r.id);
for(const s of layout.shuttles)assert(ids.has(s.id),'Escape shuttle missing from Go-to '+s.id);
for(const id of ['d02-new-1','d03-new-1','d05-new-4','atrium-floor','haze-maze','container-maze','pinball','selfie-camera','telescope','aquarium-treasure','chinampa','lever-panel','arcade-treadmill','neon-arena','fin-platform-6','fin-service-gallery'])assert(ids.has(id),'Highlight missing '+id);
assert(!places.some(isCrewGallery),'Crew gallery must not be public');
assert(!places.some(p=>p.deck===20&&layout.circulation.bridges.some(b=>b.deck===20&&b.access==='crew'&&contains(b.polygon,[p.at[0],p.at[2]]))),'A public shortcut must not land in a closed crew bridge');for(const r of layout.rooms.filter(r=>r.closed))assert(!places.some(p=>p.id===r.id||p.room===r.id),'Closed crew room in public Go-to '+r.id);assert(!/Crew only/.test(describeV2(layout,[132,36.3,0])),'Public lift-tower floor must not be labelled crew-only');
assert(!places.some(p=>/lifeboat|skywalk/i.test(p.name+' '+p.detail)),'Retired public wording');
assert.equal(groupPlaces(layout,places).length,21,'Twenty decks plus fin/crown');
assert.equal(deckDirectory(layout).length,20);
const sample=places.find(p=>p.id==='sample-cabin');assert.equal(sample.deck,15);assert.equal(layout.cabins.find(c=>c.id===sample.room).berths,2);
const smoke=await fs.readFile('scripts/v2-smoke.mjs','utf8');assert(smoke.includes('b.dataset.place==="sample-cabin"')&&smoke.includes('b.dataset.place==="observation-lounge"'),'Existing v2 smoke must select stable current destination ids');
for(const r of layout.rooms.filter(r=>/^nose-commons-/.test(r.id)))assert(places.find(p=>p.id===r.id).name===r.name,'Bow café current name');
const guides=guideSchedule(layout),lobbies=lobbySchedule(layout),rooms=new Map(layout.rooms.map(r=>[r.id,r]));
for(const g of guides){assert.equal(g.label,rooms.get(g.id).name);assert.equal(g.youAreHere,'You are here · Deck '+g.deck);assert(layout.circulation.corridors.some(c=>c.id===g.corridor));}
for(const g of lobbies){assert.equal(g.rows.length,20);assert(g.rows.every((text,i)=>text==='Deck '+(i+1)+' · '+layout.decks[i].name));}
assert.match(describeV2(layout,places.find(p=>p.id==='d05-new-4').at),/Wellness & spa/);
assert.match(describeV2(layout,places.find(p=>p.id==='telescope').at),/^Deck 17/);
assert.match(describeV2(layout,places.find(p=>p.id==='fin-platform-6').at),/Fin inspection platforms/);
assert.equal(describeV2(layout,places.find(p=>p.id==='crown-lounge').at),'Crown lounge');
assert.equal(describeV2(layout,[132,36.3,12]),'Deck 20 · Crew service gallery · Crew only');
// Render the actual guide module with the same trimmed field availability.
const guideLayout={decks:layout.decks.map(({number,name,y})=>({number,name,y})),rooms:layout.rooms.map(({id,name,deck,kind,x,y,z,depth,height,aggregate,door,frame,fittingFrame,galleryDoors,components,closed,access,polygon})=>({id,name,deck,kind,x,y,z,depth,height,aggregate,door,frame,fittingFrame,galleryDoors,components,closed,access,polygon})),fixedRooms:layout.fixedRooms,cabins:layout.cabins.map(({id,deck,x,y,z,yaw,berths,neighborhood})=>({id,deck,x,y,z,yaw,berths,neighborhood})),shuttles:layout.shuttles.map(({id,roomId,deck,x,y,z,yaw})=>({id,roomId,deck,x,y,z,yaw})),circulation:{corridors:layout.circulation.corridors.map(({id})=>({id}))}};
const guideBundle=await build({absWorkingDir:process.cwd(),tsconfigRaw:{},entryPoints:['scripts/goto-guide-render-fixture-v2.mjs'],bundle:true,platform:'node',packages:'external',format:'esm',write:false,plugins:[{name:'goto-guide-fixture',setup(b){b.onResolve({filter:/^v2-layout$/},()=>({path:'layout',namespace:'goto-fixture'}));b.onLoad({filter:/.*/,namespace:'goto-fixture'},()=>({contents:'export default '+JSON.stringify(guideLayout),loader:'js'}));b.onResolve({filter:/.*/},a=>a.kind!=='entry-point'&&!a.path.startsWith('.')&&!path.isAbsolute(a.path)?{path:a.path,external:true}:{path:path.resolve(a.resolveDir||process.cwd(),a.path),namespace:'goto-source'});b.onLoad({filter:/.*/,namespace:'goto-source'},async a=>({contents:await fs.readFile(a.path,'utf8'),loader:a.path.endsWith('.json')?'json':'js',resolveDir:path.dirname(a.path)}));}}]});
await fs.mkdir('output/phase7',{recursive:true});const guideFile=path.resolve('output/phase7/goto-guide-render-fixture.mjs');await fs.writeFile(guideFile,guideBundle.outputFiles[0].contents);const guideModule=await import(pathToFileURL(guideFile).href+'?run='+Date.now()),guideRender=guideModule.checkGuideRendering();const sameCatalog=candidate=>JSON.stringify(candidate)===JSON.stringify(places);assert(sameCatalog(guideModule.runtimePlaces),'Production Go-to export differs from the validated catalog');assert(!sameCatalog([...guideModule.runtimePlaces,{id:'injected-outside-catalog',at:[999,0,999]}]),'An extra production Go-to entry escaped the binding check');
const report=await checkV2Adapters();assert.equal(report.issues.length,0,'Adapter source anchors changed');
// Each goto operation's removed anchor must fail. Use the same Source protocol
// against only this piece, so no other phase's legacy names enter the report.
const ops=[];class Probe{constructor(file,text){this.file=file;this.text=text;this.original=text;}require(a){ops.push({file:this.file,target:a});return this;}prepend(v){this.text=v+this.text;return this;}replace(a,b){this.require(a);this.text=this.text.replace(a,b);return this;}splice(a,b,v){this.require(a);this.require(b);const i=this.text.indexOf(a),j=this.text.indexOf(b,i);this.text=this.text.slice(0,i)+v+this.text.slice(j);return this;}}
for(const file of ['src/walk/places.js','src/walk/main.js','src/walk/help.js','src/walk/signs.js','src/walk/lift-ride.js']){
 const source=(await fs.readFile(file,'utf8')).replaceAll('\r\n','\n'),adapted=applyV2Adapters(file,source);await transform(adapted,{loader:'js'});
 const probe=new Probe(file,source);gotoAdapters(file,probe);
 if(file.endsWith('/places.js'))assert(adapted.includes('export const PLACES=V2_PLACES;'),'Walk must consume the production v2 catalog');
 if(file.endsWith('/help.js')){assert(adapted.includes('const FIND=V2_FIND'));assert(adapted.includes('go:V2_EXAMPLE_GO'));}
 if(file.endsWith('/main.js')){assert(adapted.includes('renderGotoMenu(list,PLACES'));assert(adapted.includes('v2GotoStand(colliders,place.at)'));assert(adapted.includes('lifts=createLifts(scene,colliders);addWayfindingGuides(lifts.signs);'));}
}
for(const {file,target}of ops){let source=(await fs.readFile(file,'utf8')).replaceAll('\r\n','\n');source=target instanceof RegExp?source.replace(target,'MISSING_GOTO_ANCHOR'):source.replaceAll(target,'MISSING_GOTO_ANCHOR');const issues=[];applyV2Adapters(file,source,{issues,collect:true});assert(issues.length,'Removed goto source anchor accepted');}
assert.throws(()=>buildGotoPlaces(layout,[featurePlaces(layout)[0],featurePlaces(layout)[0]]),/Duplicate/);
const arg=process.argv.find(a=>a.startsWith('--prepared='))?.slice(11),prepared=await readGotoColliders(arg||process.env.LEO_GOTO_PREPARED||'output/leo-interior-v02/prepared-walk');
for(const board of lobbies)assert(gotoFloor(prepared.colliders,[board.at[0],layout.decks[board.deck-1].y,board.at[2]]).ok,'Lobby directory outside real floor '+board.id);
const failures=checkGotoFloors(guideModule.runtimePlaces,prepared.colliders);
assert.deepEqual(failures,[],'Go-to entry does not land on a safe floor');
const poses=livePosesV2(layout);for(const p of [...poses.shots,poses.nearWalker,poses.far]){assert(gotoFloor(prepared.colliders,p.feet).ok,'Unsafe live pose '+p.id);assert(Math.abs(p.camera.position[1]-p.feet[1]-1.65)<1e-9);}
for(let i=0;i<10;i++)assert(gotoFloor(prepared.colliders,poses.walk(i)).ok,'Unsafe live walk step');
const good=places.find(p=>p.id==='lobby-10'),badTargets=[
 {id:'void',at:[0,layout.decks[9].y,0]},
 {id:'off-ship',at:[999,layout.decks[5].y,999]},
 {id:'wrong-height',at:[...good.at.slice(0,1),good.at[1]+1.1,good.at[2]]},
 {id:'non-finite',at:[NaN,0,0]},
];
for(const bad of badTargets)assert.equal(checkGotoFloors([bad],prepared.colliders).length,1,'Unsafe mutation accepted '+bad.id);
assert(!gotoFloor({...prepared.colliders,raycastGround:()=>null,overlaps:()=>false},good.at).ok,'Missing floor accepted');
assert(!gotoFloor({raycastGround:(ray)=>({point:{y:good.at[1]},normal:{y:1}}),overlaps:()=>true},good.at).ok,'Blocked capsule accepted');
assert(!gotoFloor({raycastGround:(ray)=>Math.abs(ray.origin.x-good.at[0])>.2?null:{point:{y:good.at[1]},normal:{y:1}},overlaps:()=>false},good.at).ok,'Unsupported footprint accepted');
assert(!gotoFloor({raycastGround:()=>({point:{y:good.at[1]},normal:{y:1}}),overlaps:()=>false},good.at,{planned:()=>false}).ok,'Exterior/guard floor accepted');
await fs.mkdir('output/phase7',{recursive:true});await fs.writeFile('output/phase7/check-goto.json',JSON.stringify({status:'PASS',prepared:prepared.sha256,layoutShape:'trimmed runtimeLayout',destinations:places.length,rooms:places.filter(p=>p.section==='Rooms').length,services:places.filter(p=>p.section==='Services').length,shuttles:layout.shuttles.length,groups:21,roomGuides:guides.length,lobbyDirectories:lobbies.length,guideRender,liveShots:poses.shots.length,productionCatalogVerified:true,negativeFixtures:badTargets.length+6,removedAdapterAnchors:ops.length,scope:'Exact destination floor/footprint/headroom probes against prepared collisions; no full build or flood'},null,2));
if(process.env.LEO_GOTO_REVIEW_URL){const {runGotoBrowser}=await import('./goto-browser-fixture-v2.mjs');await runGotoBrowser(process.env.LEO_GOTO_REVIEW_URL);}
console.log('PASS v2 Go-to: '+places.length+' safe landings; '+ops.length+' removed source anchors rejected; unsafe floor/void/height/footprint/capsule mutations rejected');
