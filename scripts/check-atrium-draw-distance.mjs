// Exercise real visibility/culling modules with a small, deterministic ship fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {visibilityState} from '../src/v2/visibility-state.js';

const rect=(x,z,w=4,d=4)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]];
const ground=-39.7+5*4;
const room=(id,z,extra={})=>({id,y:ground,height:3.4,deck:6,polygon:rect(0,z),...extra});
const fixture={
 decks:Array.from({length:20},(_,i)=>({number:i+1,y:-39.7+i*4,atrium:{outline:rect(0,0,400,400)}})),
 cabins:[],shuttles:[],rooms:[
  room('closed-near',32),room('closed-far',124),
  room('closed-at-limit',92),room('closed-beyond-limit',92.01),
  room('front-gallery',145,{y:20.3,deck:16,publicFront:true,launchD:true}),
  room('nose-commons-01',155),room('commons-garden',165,{kind:'garden'}),
  room('public-behind',-150,{publicFront:true}),
  room('show-below',135,{showFromBelow:true}),
 ],
};
const result=await build({
 stdin:{contents:`export * from './src/v2/atrium-render-policy.js';
 export * from './src/v2/atrium-visibility.js';
 export * from './src/v2/phase4-culling.js';
 export {showBands} from './src/v2/render-bake.js';
 export {bandOf} from './src/walk/collision.js';`,resolveDir:process.cwd()},
 bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',
 plugins:[{name:'deterministic-layout',setup(b){
  b.onResolve({filter:/selected-layout\.js$/},()=>({path:'fixture-layout',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default '+JSON.stringify(fixture)}));
  b.onResolve({filter:/^(three|three\/.*|three-mesh-bvh)$/},a=>({path:import.meta.resolve(a.path),external:true}));
 }}],
});
const api=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const {ATRIUM_VIEW,isAtriumPublicOwner,setAtriumView,setAtriumSight,inOpenAtrium,atriumViewSpan,registerAtriumFog,phase4Culling,showBands,bandOf}=api;
const checks=[];
const check=(name,fn)=>{fn();checks.push(name);};
check('measured camera/fog/private-query budget',()=>assert.deepEqual(ATRIUM_VIEW,{far:450,fogNear:120,fogFar:1100,fullHeight:true,roomReach:90}));
check('public owner identity survives absent room metadata',()=>{
 for(const id of ['circulation-6','circulation-16','circulation-19','circulation-20','nose-commons-01','nose-commons-10','neighborhood-10-cafe','neighborhood-1-dining','d16-new-1','d16-new-2','d16-voyage-forum-bow','observation-lounge'])
  assert.equal(isAtriumPublicOwner(id,undefined),true,id);
 for(const id of ['circulation-5','circulation-21','closed-far','unknown-owner'])assert.equal(isAtriumPublicOwner(id,undefined),false,id);
 for(const room of [{phase6Atrium:true},{showFromBelow:true},{publicFront:true},{kind:'garden'}])assert.equal(isAtriumPublicOwner('unnamed',room),true);
});
const full=[ground-.3,40.02+.1],fog=new T.Fog(0,70,148);
registerAtriumFog(fog);
check('full height survives ground, jump, landing and upper galleries',()=>{
 for(const y of [ground,ground+.5,ground+1.8,ground,ground+4,36.3]){
  setAtriumView({x:0,y,z:0});const span=atriumViewSpan();assert.deepEqual(span,full);
  const bands=new Map([5,6,10,15,19,20].map(b=>[b,{userData:{band:b},visible:false}]));
  showBands(bands,...span);assert(bands.get(20).visible,'sky/upper-gallery band must be selected');
  assert(bands.get(bandOf(ground)).visible,'Deck 6 remains selected');
  assert.equal(fog.near,120);assert.equal(fog.far,1100);
 }
});
check('enclosed/outside/below/above transitions restore bounded visibility and fog',()=>{
 for(const p of [{x:0,y:ground,z:32},{x:210,y:ground,z:0},{x:0,y:ground-1,z:0},{x:0,y:40,z:0}]){
  setAtriumView(p);assert.equal(atriumViewSpan(),null);assert.equal(fog.near,70);assert.equal(fog.far,148);
  setAtriumView({x:0,y:ground,z:0});assert.deepEqual(atriumViewSpan(),full);assert.equal(fog.far,1100);
 }
});

const root=new T.Scene(),meshes=new Map();
for(const [id,y,z] of [...fixture.rooms.map(r=>[r.id,r.y+1.5,r.polygon[0][1]+2]),['circulation-16',20.3,175],['unknown-owner',ground+1.5,185]]){
 const o=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial(),1);
 o.setMatrixAt(0,new T.Matrix4().makeTranslation(0,y,z));
 o.userData={phase4:true,ownerRuns:[{component:id,start:0,count:1}]};root.add(o);meshes.set(id,o);
}
const lodMesh=new T.InstancedMesh(new T.BoxGeometry(.02,.02,.02),new T.MeshBasicMaterial(),2);
lodMesh.setMatrixAt(0,new T.Matrix4().makeTranslation(0,ground+1.5,100));
lodMesh.setMatrixAt(1,new T.Matrix4().compose(new T.Vector3(0,ground+1.5,100),new T.Quaternion(),new T.Vector3(100,100,100)));
lodMesh.userData={phase4:true,ownerRuns:[{component:'nose-commons-01',start:0,count:2}]};root.add(lodMesh);
const lodOriginal=lodMesh.instanceMatrix.array.slice(),lodOwnerRuns=structuredClone(lodMesh.userData.ownerRuns);
root.updateMatrixWorld(true);
const col={bands:new Map(),groups:[],movers:[],*near(){}};
const camera=new T.PerspectiveCamera(90,16/9,.05,ATRIUM_VIEW.far);
const culling=phase4Culling(root,col);
let clock=1000;
function update(p,elapsed=1000){camera.position.set(p.x,p.y+1.7,p.z);camera.lookAt(0,0,180);camera.updateMatrixWorld(true);culling.update(camera,p,...full,clock+=elapsed);}
const open={x:0,y:ground,z:0},inside={x:0,y:ground,z:32};
const shown=id=>meshes.get(id).visible&&meshes.get(id).count===1;
check('open atrium preserves all public fronts and fallback circulation, bounds private rooms',()=>{
 update(open);
 for(const id of ['front-gallery','nose-commons-01','commons-garden','show-below','circulation-16','unknown-owner','closed-near','closed-at-limit'])assert(shown(id),id);
 for(const id of ['closed-far','closed-beyond-limit','public-behind'])assert(!shown(id),id);
});
check('enclosed-room entry removes cutoff and restores same-deck public-front gate',()=>{
 update(inside,1);
 assert(shown('closed-far'),'private far room retains original visibility queries outside open atrium');
 assert(!shown('front-gallery'),'launchD deck gate restored outside open atrium');
 update(open,1);assert(!shown('closed-far'));assert(shown('front-gallery'));
});
check('public bypass retains frustum; actual opaque BVH still hides nearby enclosed contents',()=>{
 const geometry=new T.PlaneGeometry(1000,1000).translate(0,ground+1.5,1),glass=new MeshBVH(geometry);
 glass.leoWindowFlags=new Uint8Array(geometry.index.count/3).fill(1);
 col.bands.set(bandOf(ground),{bvh:glass});update(open);
 assert(shown('closed-near'),'transparent BVH must preserve sight into nearby rooms');
 assert(shown('unknown-owner'),'transparent BVH must preserve sight for unknown owners');
 // Replace the BVH so the exact-state cache also observes the material change.
 col.bands.set(bandOf(ground),{bvh:new MeshBVH(geometry)});
 update(open);
 for(const id of ['front-gallery','nose-commons-01','commons-garden','show-below','circulation-16'])assert(shown(id),id);
 assert(!shown('closed-near'),'opaque near private room must still be culled');
 assert(!shown('unknown-owner'),'unknown owners still receive occlusion queries');
 assert(!shown('public-behind'),'public bypass must not bypass frustum');
 assert(culling.stats.firstHits>0,'real opaque query was exercised');
});

for(const suffix of ['', '.authoring', '.prepared', '.public']){
 const file=`src/walk/main${suffix}.js`,source=await fs.readFile(file,'utf8');
 const span=source.slice(source.indexOf('function span(p,now){'),source.indexOf('\nfunction cull('));
 check(`${file}: long camera, matching haze, bounded room probes/cabins`,()=>{
  assert.match(source,/PerspectiveCamera\(phone\?70:62,1,\.05,ATRIUM_VIEW\.far\)/);
  assert.match(source,/PerspectiveCamera\(60,1,ATRIUM_VIEW\.far-10,1500\)/);
  assert.match(source,/NEAR_CABINS=40/);
  assert.match(span,/raycast\(ray\.ray,90,\.6\)/);assert.match(span,/raycast\(probe,12\)/);
  assert(span.indexOf('atriumViewSpan()')<span.indexOf('now-lastSpan>=150'),'full-height classification precedes trace throttle');
 });
 check(`${file}: immediate exit retraces even at identical previous indoor pose`,()=>{
  const executable=source.slice(source.indexOf('const VIEW_RAYS=[];'),source.indexOf('\nfunction cull('));
  let queries=0;const metrics={span:[]};
  const createQuery=()=>({raycast(ray){queries++;return {distance:1,point:ray.at(1,new T.Vector3())};}});
  const run=Function('T','setAtriumView','atriumViewSpan','spanChanged','camera','colliders','renderMetrics','createVisibilityQuery',
   'ATRIUM_VIEW','inOpenAtrium','setAtriumSight','createAtriumSight',
   'let spanQuery=null;'+executable+';return span;')(T,setAtriumView,atriumViewSpan,visibilityState(),camera,col,metrics,createQuery,ATRIUM_VIEW,inOpenAtrium,setAtriumSight,()=>({update:()=>false}));
  const indoor=run(inside,1000),before=queries;
  assert(before>0);assert.notDeepEqual(indoor,full);
  assert.deepEqual(run(open,1050),full);assert.equal(queries,before,'atrium shortcut must not trace');
  assert.deepEqual(run(inside,1100),indoor);assert(queries>before,'exit must invalidate both timer and identical-pose cache');
 });
}
check('camera sight keeps distant public owners and fog across a room boundary',()=>{
 setAtriumView(inside);setAtriumSight(true);update(inside,1);
 assert.deepEqual(atriumViewSpan(),full);assert.equal(fog.far,1100);assert(shown('front-gallery'));
 setAtriumSight(false);update(inside,1);assert.equal(atriumViewSpan(),null);assert.equal(fog.far,148);assert(!shown('front-gallery'));
});
for(const suffix of ['', '.authoring', '.prepared', '.public']){
 const source=await fs.readFile(`src/walk/main${suffix}.js`,'utf8');
 check(`main${suffix}: camera-visible atrium unions local floor and clears without stale span`,()=>{
  const executable=source.slice(source.indexOf('const VIEW_RAYS=[];'),source.indexOf('\nfunction cull('));
  let seen=true;const p={x:210,y:ground-12,z:0},metrics={span:[]};
  const query=()=>({raycast(ray){return {distance:1,point:ray.at(1,new T.Vector3())};}});
  const run=Function('T','setAtriumView','atriumViewSpan','spanChanged','camera','colliders','renderMetrics','createVisibilityQuery','ATRIUM_VIEW','inOpenAtrium','setAtriumSight','createAtriumSight',
   'let spanQuery=null;'+executable+';return span;')(T,setAtriumView,atriumViewSpan,visibilityState(),camera,col,metrics,query,ATRIUM_VIEW,inOpenAtrium,setAtriumSight,()=>({update:()=>seen}));
  const combined=run(p,1000);assert(combined[0]<=p.y-3);assert.equal(combined[1],full[1]);
  seen=false;const local=run(p,1001);assert(local[0]<=p.y-3);assert(local[1]<full[1]);
  seen=true;assert.deepEqual(run(p,1002),combined);
 });
}

check('phase4 compacts subpixel props and restores original matrices when resolution grows',()=>{
 update(open);assert.equal(lodMesh.count,1);assert.deepEqual(lodMesh.instanceMatrix.array.slice(0,16),lodOriginal.slice(16,32));
 culling.update(camera,open,...full,clock+=1,4320);assert.equal(lodMesh.count,2);assert.deepEqual(lodMesh.instanceMatrix.array,lodOriginal);
 assert.deepEqual(lodMesh.userData.ownerRuns,lodOwnerRuns);
 const compacted=culling.stats.compactions;culling.update(camera,open,...full,clock+=1000,4320);assert.equal(culling.stats.compactions,compacted);
 culling.update(camera,open,...full,clock+=1,360);assert.equal(lodMesh.count,1);
});
const runtimeCulling=await fs.readFile('src/v2/phase4-culling.js','utf8'),authoringCulling=await fs.readFile('src/v2/phase4-culling.authoring.js','utf8');
check('authoring and runtime retain identical visibility and LOD behavior',()=>assert.equal(authoringCulling.replace("from './visibility-query.authoring.js'","from './visibility-query.js'"),runtimeCulling));
console.log(JSON.stringify({status:'PASS',checks:checks.length,details:checks,phase4:culling.stats},null,2));
