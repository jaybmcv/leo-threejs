import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {preparedManifest,preparedArrayReader} from './prepared-patch-v2.mjs';
import {parseGlb} from './patch-models-v2.mjs';
import {checkFastPatchCollision} from './fast-collision-v2.mjs';

// The dressing lane's proofs (fast-dressing-v2.mjs).
//   node scripts/check-fast-dressing-v2.mjs              classifier: a selfie-only edit takes lane D; a shared helper,
//                                                        prepare.js or a new import takes the whole build
//   node scripts/check-fast-dressing-v2.mjs --patch [--base=DIR] [--patched=DIR]
//                                                        after lane D: output/ against fast-base, everything but the
//                                                        dressing unchanged and the dressing as freshly compiled
//   node scripts/check-fast-dressing-v2.mjs --full=DIR [--patched=DIR] [--untagged]
//                                                        a lane D output (default output/leo-interior-v02) against an
//                                                        independent full build of the same source; --untagged compares
//                                                        a tagged build with one from before the owner tags
const sha=x=>createHash('sha256').update(x).digest('hex'),arg=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const root='output/leo-interior-v02',tag=process.env.LEO_FAST_TAG||'last',report={status:'FAIL'};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bytesOf=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);

// One prepared walk in a form two builds can be compared in: arrays and geometries by content, uuids by first use (a
// full build's counter shifts when a dressing makes fewer objects), static collision bands as sorted triangle lists.
export async function canonicalPrepared(directory,{owner=o=>o,skipOwners=new Set(),skipTemplates=()=>false}={}){
 const m=await preparedManifest(directory),read=preparedArrayReader(m,directory),uuids=new Map(),memo=new Map();
 const once=async(key,fn)=>{if(!memo.has(key))memo.set(key,await fn());return memo.get(key);};
 const array=id=>id==null?null:once('a'+id,async()=>{const a=await read(id);return a.constructor.name+':'+sha(bytesOf(a));});
 const deep=async v=>{if(typeof v==='string')return UUID.test(v)?(uuids.has(v)||uuids.set(v,'uuid-'+uuids.size),uuids.get(v)):v;if(Array.isArray(v)){const out=[];for(const x of v)out.push(await deep(x));return out;}
  if(v&&typeof v==='object'){const out={};for(const [k,x]of Object.entries(v))out[k]=k==='$array'?await array(x):await deep(x);return out;}return v;};
 // Indexed attributes are read through their index: the encoder's shared vertex pools hold other geometries' vertices
 // too, so a dressing edit moves pool offsets and lengths without changing anything drawn.
 const indexed=async(g,a)=>{const ix=await read(g.index),x=await read(a.array),n=a.itemSize,out=new x.constructor(ix.length*n);for(let i=0;i<ix.length;i++)for(let k=0;k<n;k++)out[i*n+k]=x[ix[i]*n+k];return x.constructor.name+':'+ix.length+':'+sha(bytesOf(out));};
 const geometry=id=>id===undefined||id===null?id:once('g'+id,async()=>{const g=m.geometries[id],attributes={};for(const [k,a]of Object.entries(g.attributes).sort())attributes[k]={...a,array:g.index==null?await array(a.array):await indexed(g,a)};return sha(JSON.stringify(await deep({...g,attributes,index:g.index==null?null:'indexed'})));});
 const textures=new Map(m.textures.map(t=>[t.uuid,t])),images=new Map(m.images.map(i=>[i.uuid,i]));
 const material=id=>id===undefined?id:Array.isArray(id)?Promise.all(id.map(material)):once('m'+id,async()=>{const x=m.materials[id],refs={};for(const [k,v]of Object.entries(x))if(textures.has(v)){const t=textures.get(v);refs[k]={...t,image:images.get(t.image)?sha(JSON.stringify(images.get(t.image))):t.image};}return sha(JSON.stringify(await deep({...x,...refs})));});
 const graph=async g=>{if(!g)return g;const nodes=[];for(const n of g.nodes||[])nodes.push(await deep({...n,geometry:await geometry(n.geometry),material:await material(n.material),instanceMatrix:await array(n.instanceMatrix),instanceColor:await array(n.instanceColor)}));return {root:await deep(g.root),nodes};};
 const bvh=async r=>({...await deep({...r,geometry:undefined,roots:undefined,index:undefined,indirect:undefined,windowFlags:undefined}),geometry:await geometry(r.geometry),roots:await Promise.all(r.roots.map(array)),index:r.index!=null&&r.index===m.geometries[r.geometry].index?'geometry index':await array(r.index),indirect:await array(r.indirect),windowFlags:await array(r.windowFlags)});
 // Static bands are rebuilt whole by a patch, so their BVH layout and memoized bounds are not part of the content.
 const band=async r=>{const g=m.geometries[r.geometry],p=await read(g.attributes.position.array),ix=g.index==null?null:await read(g.index),f=r.windowFlags==null?null:await read(r.windowFlags),ownerAt=[];for(const s of r.ownerSpans||[])for(let i=s.start;i<s.start+s.count;i++)ownerAt[i]=s.owner;
  const rows=[],count=(ix?.length??p.length/3)/3,v=new Float32Array(9);for(let t=0;t<count;t++){const o=owner(ownerAt[t]??null);if(skipOwners.has(o))continue;for(let k=0;k<3;k++){const q=ix?ix[t*3+k]:t*3+k;v.set(p.subarray(q*3,q*3+3),k*3);}rows.push(Buffer.from(v.buffer).toString('hex')+'|'+(f?.[t]||0)+'|'+o);}
  rows.sort();return {triangles:rows.length,sha:sha(rows.join('\n'))};};
 const colliders=async c=>{if(!c)return c;const bands=[];for(const [k,r]of [...c.bands].sort(([a],[b])=>a-b)){const b=await band(r);if(b.triangles)bands.push([k,b]);}
  const groups=[];for(const g of c.groups)groups.push({...await deep({...g,bvh:undefined}),bvh:await bvh(g.bvh)});const movers=[];for(const x of c.movers)movers.push({...await deep({...x,bvh:undefined}),bvh:await bvh(x.bvh)});
  return {bands,groups,movers,ground:await colliders(c.ground)};};
 const out={};
 for(const k of ['version','geometryEncoding','roomOwnershipVersion','collisionPackVersion','vertexPoolVersion','tupleCodecVersion'])out[k]=m[k];
 const templates=[];for(const [key,id]of [...m.geometryTemplates].sort(([a],[b])=>a<b?-1:a>b?1:0))if(!skipTemplates(key))templates.push([key,await geometry(id)]);out.geometryTemplates=templates;
 out.source=await graph(m.source);for(const k of ['ship','signs'])out[k]=k==='signs'?await graph(m.signs):await deep(m.ship);
 out.bands=[];for(const [k,g]of m.bands)out.bands.push([k,await graph(g)]);
 for(const k of ['haze','facade','lounge','frost'])out[k]=await graph(m[k]);
 for(const k of ['privacy','roomFeatureSupports','skinAuthority','retirements','bake'])out[k]=await deep(m[k]);
 out.colliders=await colliders(m.colliders);out.rest=await deep(m.rest);out.seats=m.seats;
 return out;
}
// The first difference between two canonical values, as a path.
export function difference(a,b,path='$'){
 if(JSON.stringify(a)===JSON.stringify(b))return null;
 if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const d=difference(a[k],b[k],path+'.'+k);if(d)return d;}}
 return path+': '+JSON.stringify(a)?.slice(0,160)+' != '+JSON.stringify(b)?.slice(0,160);
}

// A GLB as its scene tree with every accessor, material and image by content, so a patch that appends a dressing's
// nodes and retires the old ones compares equal to a full build that wrote them in place.
export async function canonicalGlb(bytes,{dropTag=false,only=null,skipTagged=false}={}){
 const {json:j,bin}=parseGlb(bytes),memo=new Map(),once=(k,fn)=>{if(!memo.has(k))memo.set(k,fn());return memo.get(k);};
 const size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
 const view=i=>{const v=j.bufferViews[i];return bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);};
 const accessor=i=>i===undefined?i:once('a'+i,()=>{const a=j.accessors[i],element=size[a.componentType]*width[a.type],v=j.bufferViews[a.bufferView],stride=v?.byteStride||element,data=a.bufferView===undefined?Buffer.alloc(0):view(a.bufferView),out=Buffer.alloc(a.count*element);for(let n=0;n<a.count;n++)data.copy(out,n*element,(a.byteOffset||0)+n*stride,(a.byteOffset||0)+n*stride+element);return sha(JSON.stringify({...a,bufferView:undefined,byteOffset:undefined,data:sha(out)}));});
 const textures=x=>{if(!x||typeof x!=='object')return x;if(Array.isArray(x))return x.map(textures);const out={};for(const [k,v]of Object.entries(x))out[k]=/Texture$/.test(k)&&typeof v?.index==='number'?{...textures(v),index:texture(v.index)}:textures(v);return out;};
 const texture=i=>once('t'+i,()=>{const t=j.textures[i],img=j.images?.[t.source];return sha(JSON.stringify({...t,source:img&&{...img,bufferView:undefined,data:img.bufferView===undefined?img.uri:sha(view(img.bufferView))},sampler:j.samplers?.[t.sampler]}));});
 const material=i=>i===undefined?i:once('m'+i,()=>sha(JSON.stringify(textures(j.materials[i]))));
 const mesh=i=>i===undefined?i:once('mesh'+i,()=>sha(JSON.stringify({...j.meshes[i],primitives:j.meshes[i].primitives.map(p=>({...p,attributes:Object.fromEntries(Object.entries(p.attributes).sort().map(([k,v])=>[k,accessor(v)])),indices:accessor(p.indices),material:material(p.material),targets:p.targets?.map(t=>Object.fromEntries(Object.entries(t).map(([k,v])=>[k,accessor(v)])))}))})));
 const node=i=>{const n=j.nodes[i];if(skipTagged&&n.extras?.fastDressing)return {name:n.name,hash:'dressing:'+n.extras.fastDressing,children:[]};const extras=n.extras&&dropTag?Object.fromEntries(Object.entries(n.extras).filter(([k])=>k!=='fastDressing')):n.extras,ext=n.extensions?.EXT_mesh_gpu_instancing;
  const own={...n,children:undefined,extras:extras&&Object.keys(extras).length?extras:undefined,mesh:mesh(n.mesh),extensions:n.extensions&&{...n.extensions,...(ext?{EXT_mesh_gpu_instancing:{...ext,attributes:Object.fromEntries(Object.entries(ext.attributes).map(([k,v])=>[k,accessor(v)]))}}:{})}};
  const children=(n.children||[]).map(node);return {name:n.name,hash:sha(JSON.stringify(own)+children.map(c=>c.hash).join(',')),children};};
 const scene=j.scenes[j.scene||0];if(only!==null)return node(only);
 return {extras:j.extras,extensionsUsed:[...(j.extensionsUsed||[])].sort(),extensionsRequired:[...(j.extensionsRequired||[])].sort(),roots:scene.nodes.map(node),json:j};
}
// The path to the first node whose subtree differs.
export function nodeDifference(a,b,path=''){if(a.hash===b.hash)return null;const here=path+'/'+a.name;if(a.children.length!==b.children.length)return here+' has '+a.children.length+' children, '+b.children.length+' expected';for(let i=0;i<a.children.length;i++){const d=nodeDifference(a.children[i],b.children[i],here);if(d)return d;}return here+' differs';}
export async function compareModels(patched,full,{dropTag=false}={}){
 const rows=[];
 for(const file of (await fs.readdir(full)).filter(f=>f.endsWith('.glb')).sort()){
  const a=await fs.readFile(patched+'/'+file),b=await fs.readFile(full+'/'+file);if(a.equals(b)){rows.push({file,bytes:'identical'});continue;}
  const x=await canonicalGlb(a,{dropTag}),y=await canonicalGlb(b,{dropTag});
  assert.deepEqual([x.extras,x.extensionsUsed,x.extensionsRequired],[y.extras,y.extensionsUsed,y.extensionsRequired],file+' top-level metadata differs');
  assert.equal(x.roots.length,y.roots.length,file+' scene roots differ');for(let i=0;i<x.roots.length;i++){const d=nodeDifference(x.roots[i],y.roots[i]);assert(!d,file+': '+d);}
  rows.push({file,bytes:'differ',content:'scene tree equal by content'});
 }
 return rows;
}

// Imported, it only lends its comparisons.
if(!import.meta.main){}else if(process.argv.some(a=>a.startsWith('--full='))){
 // A lane D output against an independent full build of the same source.
 const patched=arg('patched')||root,full=arg('full'),untagged=process.argv.includes('--untagged'),start=performance.now();
 const owner=untagged?o=>o?.startsWith('dressing:')?null:o:o=>o;
 const [a,b]=[await canonicalPrepared(patched+'/prepared-walk',{owner}),await canonicalPrepared(full+'/prepared-walk',{owner})];
 const d=difference(a,b);assert(!d,'Prepared walks differ beyond owner normalisation: '+d);
 const plain=[];for(const name of ['layout.json','walk-plan.json','walk-map.png','exterior-envelopes.json']){assert((await fs.readFile(patched+'/'+name)).equals(await fs.readFile(full+'/'+name)),name+' differs from the full build');plain.push(name);}
 Object.assign(report,{mode:untagged?'tagged against untagged full build':'lane D against full build',patched,full,prepared:{templates:a.geometryTemplates.length,collisionBands:a.colliders.bands.length,triangles:a.colliders.bands.reduce((n,[,x])=>n+x.triangles,0)},plain,models:await compareModels(patched,full,{dropTag:untagged}),seconds:(performance.now()-start)/1000,status:'PASS'});
}else if(process.argv.includes('--patch')){
 // Everything but the dressing is the clean baseline's; the dressing is what compileDressing makes from today's source.
 const base=arg('base')||root+'/fast-base',patched=arg('patched')||root,{DRESSINGS,compileDressing,ownsTemplate}=await import('./fast-dressing-v2.mjs'),m=await preparedManifest(patched+'/prepared-walk'),ids=m.fastPatch?.dressings||[];assert(ids.length,'No dressing patch to compare');
 const owners=new Set(ids.filter(id=>DRESSINGS[id].collision).map(id=>DRESSINGS[id].owner)),skipTemplates=key=>ids.some(id=>ownsTemplate(DRESSINGS[id],key));
 const before=await canonicalPrepared(base+'/prepared-walk',{skipOwners:owners,skipTemplates}),after=await canonicalPrepared(patched+'/prepared-walk',{skipOwners:owners,skipTemplates});
 const d=difference(after,before);assert(!d,'Dressing patch changed something else: '+d);
 const read=preparedArrayReader(m,patched+'/prepared-walk'),compiled=[];for(const id of ids)compiled.push(await compileDressing(id));
 const {ownedTriangles}=await import('./fast-dressing-v2.mjs'),key=r=>{const rows=[];for(let t=0;t<r.flags.length;t++)rows.push(Buffer.from(r.positions.buffer,r.positions.byteOffset+t*36,36).toString('hex')+'|'+r.flags[t]);return [r.band,rows.sort().join(',')];};
 for(const c of compiled){const d=DRESSINGS[c.id];
  if(d.collision){assert.deepEqual((await ownedTriangles(m,read,d.owner)).map(key),c.collision.map(key),c.id+' collision differs from a fresh compile');
   assert.deepEqual((await ownedTriangles(m,read,d.owner,{ground:true})).map(key),c.groundCollision.map(key),c.id+' ground collision differs from a fresh compile');}
  else assert(!c.collision.length&&!c.groundCollision.length&&!c.model,c.id+' is qualified as never solid and in no model');
  const templates=new Map(m.geometryTemplates.filter(([k])=>ownsTemplate(d,k)));assert.deepEqual([...templates.keys()].sort(),c.templates.map(([k])=>k).sort(),c.id+' template keys');
  for(const [k,g]of c.templates){const r=m.geometries[templates.get(k)];for(const [name,a]of Object.entries(g.attributes))assert(bytesOf(await read(r.attributes[name].array)).equals(bytesOf(a.array)),c.id+' template '+k.slice(0,60)+' '+name);assert(bytesOf(await read(r.index)).equals(bytesOf(g.index.array)),c.id+' template index '+k.slice(0,60));}
 }
 // The model: the full ship's dressing subtree is the fresh export and the rest of every model is the baseline's.
 const models=[];for(const file of (await fs.readdir(base)).filter(f=>f.endsWith('.glb')).sort()){
  const a=await fs.readFile(patched+'/'+file),b=await fs.readFile(base+'/'+file);if(a.equals(b)){models.push({file,bytes:'identical'});continue;}
  // Outside the dressings every node is the baseline's; each dressing subtree is the fresh export, in the same place.
  const x=await canonicalGlb(a,{skipTagged:true}),y=await canonicalGlb(b,{skipTagged:true});
  assert.equal(x.roots.length,y.roots.length,file+' scene roots differ');for(let i=0;i<x.roots.length;i++){const d=nodeDifference(x.roots[i],y.roots[i]);assert(!d,file+' changed outside its dressings: '+d);}
  const tagged=x.json.nodes.flatMap((n,i)=>n.extras?.fastDressing?[[n.extras.fastDressing,i]]:[]);assert.deepEqual(tagged.map(([id])=>id).sort(),y.json.nodes.flatMap(n=>n.extras?.fastDressing?[n.extras.fastDressing]:[]).sort(),file+' dressing tags');
  for(const [id,i]of tagged){const c=compiled.find(c=>c.id===id);assert(c,'Unexpected dressing '+id+' in '+file);const fresh=await canonicalGlb(c.model,{only:parseGlb(c.model).json.scenes[0].nodes[0]});assert.equal((await canonicalGlb(a,{only:i})).hash,fresh.hash,id+' model nodes differ from a fresh export');}
  models.push({file,bytes:'differ',dressings:tagged.map(([id])=>id)});
 }
 Object.assign(report,{mode:'lane D against its baseline',dressings:ids,collision:await checkFastPatchCollision(patched+'/prepared-walk'),models,status:'PASS'});
}else{
 // Classification: real source edits, restored afterwards; a clean baseline of this checkout is required.
 const {classifyFastChange}=await import('./fast-state-v2.mjs'),{classifyDressings}=await import('./fast-dressing-v2.mjs');
 const files=['src/walk/selfie.js','src/walk/selfie.authoring.js','src/walk/canvas.js','src/walk/prepare.js','src/walk/paintings.js','src/walk/paintings.authoring.js','src/v2/phase4-community.js','src/walk/main.authoring.js'],templates=['changes-board','comics','hex-floor','lounge-compass'],
  roots=['src/walk/link.js','src/walk/lift-ride.authoring.js','src/v2/hangar-door.js','src/walk/hostess.authoring.js','src/walk/paws-off/game.authoring.js'];
 files.push(...templates.map(id=>'src/walk/'+id+'.authoring.js'),...roots);const originals=new Map(await Promise.all(files.map(async f=>[f,await fs.readFile(f,'utf8')])));
 const restore=async()=>{for(const [f,t]of originals)await fs.writeFile(f,t);};
 const edit=async(f,from,to)=>{const t=originals.get(f);assert.equal(t.split(from).length,2,'Fixture anchor moved in '+f);await fs.writeFile(f,t.replace(from,to));};
 const camera="box('Selfie_camera',[.22,.2,.32]",bigger="box('Selfie_camera',[.24,.2,.32]",cases=[];
 const expect=async(name,lane,setup)=>{await restore();await setup();const plan=await classifyFastChange();cases.push({name,lane:plan.lane,reason:plan.reason,files:plan.files});assert.equal(plan.lane,lane,name+': '+plan.reason);return plan;};
 try{
  const clean=await classifyFastChange();assert.equal(clean.lane,'A','This check needs a clean full-build baseline of this checkout: '+clean.reason);
  const plan=await expect('selfie geometry edit','D',async()=>{for(const f of files.slice(0,2))await edit(f,camera,bigger);});assert.deepEqual(plan.dressings,['selfie']);
  await expect('authoring variant only','D',()=>edit('src/walk/selfie.authoring.js',camera,bigger));
  await expect('shared helper edit','whole',()=>edit('src/walk/canvas.js','let factory=null;','let factory=null;// fixture'));
  await expect('selfie and shared helper','whole',async()=>{await edit('src/walk/selfie.js',camera,bigger);await fs.writeFile('src/walk/canvas.js',originals.get('src/walk/canvas.js')+'\n// fixture\n');});
  await expect('prepare.js edit','whole',()=>edit('src/walk/prepare.js','const booth=createSelfieBooth();','const booth=createSelfieBooth();booth.group.position.x+=.1;'));
  await expect('selfie gains an unqualified import','whole',()=>edit('src/walk/selfie.js',"import * as T from 'three';","import * as T from 'three';import {LIFTS} from './lifts.js';void LIFTS;"));
  await restore();await edit('src/walk/prepare.js','const booth=createSelfieBooth();colliders.addStatic(booth.group);','const booth=createSelfieBooth();if(booth)colliders.addStatic(booth.group);');
  assert.match((await classifyDressings(['src/walk/selfie.js'])).reason,/no longer placed by its one qualified line in src\/walk\/prepare\.js/);cases.push({name:'placement line changed',reason:'no longer placed'});
  // The paintings: their frames take lane D, alone or with the booth; a shared input of theirs widens.
  const deeper=async()=>{for(const f of files.slice(4,6))await edit(f,'FRAME={width:.14,depth:.08}','FRAME={width:.14,depth:.09}');};
  assert.deepEqual((await expect('paintings frame edit','D',deeper)).dressings,['paintings']);
  assert.deepEqual((await expect('paintings and selfie','D',async()=>{await deeper();for(const f of files.slice(0,2))await edit(f,camera,bigger);})).dressings,['selfie','paintings']);
  await expect('paintings and their shared helper','whole',async()=>{await deeper();await fs.writeFile(files[6],originals.get(files[6])+'\n// fixture\n');});
  // The authoring page lies outside the geometry identity, so its reach to the paintings is read on every lane D.
  const page=async(from,to,pattern,name)=>{await restore();await edit(files[7],from,to);assert.match((await classifyDressings(['src/walk/paintings.authoring.js'])).reason,pattern);cases.push({name,reason:String(pattern)});};
  await page('for(const g of paintings.groups){baked.bands.set(g.name,g);scene.add(g);}','for(const g of paintings.groups){baked.bands.set(g.name,g);scene.add(g);}colliders.addStatic(paintings.groups[0]);',/reaches the paintings dressing outside its qualified uses/,'authoring page makes a painting solid');
  await page('for(const g of paintings.groups){baked.bands.set(g.name,g);scene.add(g);}','for(const g of paintings.groups){baked.bands.set(g.name,g);scene.add(g);}corridorTrim(ship.inside);',/reaches the paintings dressing outside its qualified uses: corridorTrim/,'authoring page calls the trim that reads PAINTINGS');
  await page('paintings=createPaintings({urls:artUrls,','paintings=createPaintings({urls:artUrls,scale:2,',/no longer placed by its one qualified line in src\/walk\/main\.authoring\.js/,'paintings glue changed');
  // The authoring page's other template-only dressings: each takes lane D, all of them with the booth and paintings
  // too. A helper of theirs, or a module made a geometry root instead (movers, the Cosmo kit, the ship), widens.
  const touch=async f=>fs.writeFile(f,originals.get(f)+'\n// fixture\n');
  for(const id of templates)assert.deepEqual((await expect(id+' edit','D',()=>touch('src/walk/'+id+'.authoring.js'))).dressings,[id]);
  assert.deepEqual((await expect('every dressing at once','D',async()=>{await deeper();for(const f of files.slice(0,2))await edit(f,camera,bigger);for(const id of templates)await touch('src/walk/'+id+'.authoring.js');})).dressings,['selfie','paintings',...templates]);
  for(const f of roots)await expect(f+' edit','whole',()=>touch(f));
  const reach=async(id,from,to,pattern,name)=>{await restore();await edit(files[7],from,to);assert.match((await classifyDressings(['src/walk/'+id+'.authoring.js'])).reason,pattern);cases.push({name,reason:String(pattern)});};
  await reach('hex-floor','toBand(hexFloor.group);','toBand(hexFloor.group);colliders.addStatic(hexFloor.group);',/reaches the hex-floor dressing outside its qualified uses/,'authoring page makes the hex floor solid');
  await reach('changes-board','for(const g of changeLog.groups)toBand(g);','for(const g of changeLog.groups)toBand(g);ship.inside.add(changeLog.groups[0]);',/reaches the changes-board dressing outside its qualified uses/,'authoring page puts a ship log board in the ship');
  await reach('comics','comics=createComics({urls:artUrls,','comics=createComics({urls:artUrls,count:2,',/no longer placed by its one qualified line/,'comics glue changed');
  await reach('lounge-compass','{const compass=createLoungeCompass();if(compass)toBand(compass);}','{const compass=createLoungeCompass();if(compass)ship.inside.add(compass);}',/no longer placed by its one qualified line/,'compass moved into the ship before saving');
  // The page edited alone, with no dressing file changed, still meets the guard on the way to lane A.
  const alone=await expect('authoring page alone makes the hex floor solid','whole',()=>edit(files[7],'toBand(hexFloor.group);','toBand(hexFloor.group);colliders.addStatic(hexFloor.group);'));assert.match(alone.reason,/reaches the hex-floor dressing/);
  await expect('authoring page alone, unrelated edit','A',()=>edit(files[7],'toBand(hexFloor.group);','toBand(hexFloor.group);void 0;'));
 }finally{await restore();}
 // Through every consumer, independent of the working tree: a second importer or a moved glue line widens.
 const graph=g=>({graph:g}),selfie=['src/walk/canvas.js','package:three','src/fin-crown.js','src/concept-shape.js'];
 assert.deepEqual(await classifyDressings(['src/walk/selfie.js'],graph({'src/walk/prepare.js':['src/walk/selfie.js'],'src/walk/selfie.js':selfie})),{dressings:['selfie']});
 assert.match((await classifyDressings(['src/walk/selfie.js'],graph({'src/walk/prepare.js':['src/walk/selfie.js'],'src/walk/lounge.js':['src/walk/selfie.js'],'src/walk/selfie.js':selfie}))).reason,/also used by src\/walk\/lounge\.js/);
 assert.equal(await classifyDressings(['src/walk/selfie.js','src/walk/prepare.js']),null);
 const paintings=['package:three','src/v2/phase4-community.js','src/plan/placements.js','src/walk/collision.authoring.js','src/v2/prepared-geometry-record.js'],page={'src/walk/main.authoring.js':['src/walk/paintings.authoring.js','src/walk/trim.authoring.js'],'src/walk/trim.authoring.js':['src/walk/paintings.authoring.js'],'src/walk/paintings.authoring.js':paintings};
 assert.deepEqual(await classifyDressings(['src/walk/paintings.authoring.js'],graph(page)),{dressings:['paintings']});
 assert.match((await classifyDressings(['src/walk/paintings.authoring.js'],graph({...page,'src/walk/comics.authoring.js':['src/walk/trim.authoring.js']}))).reason,/trim\.authoring\.js, idle for the paintings dressing, is also imported by src\/walk\/comics\.authoring\.js/);
 Object.assign(report,{mode:'classification',cases,status:'PASS'});
}
if(import.meta.main){await fs.mkdir('output/fast-deploy',{recursive:true});await fs.writeFile('output/fast-deploy/'+tag+'-dressing-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
