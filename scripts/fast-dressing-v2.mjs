import fs from 'node:fs/promises';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createCanvas,ImageData} from '@napi-rs/canvas';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {producerGraph,geometryRoots} from './fast-dependencies-v2.mjs';
import {PreparedPatch,preparedManifest,preparedArrayReader} from './prepared-patch-v2.mjs';
import {removeOwnedSpans} from './patch-owned-spans-v2.mjs';
import {parseGlb,packGlb,alignGlb} from './patch-models-v2.mjs';
import {shareExportGeometry} from './v2-export.mjs';
import {indexedV2Export} from './v2-indexed-export.mjs';
import {prepareArrivalCanvasExport} from './arrival-canvas-export-v2.mjs';
import {PreparedWriter} from '../src/v2/prepared-codec.js';
import {installWalkCanvas} from '../src/walk/canvas.js';
import {Colliders,solid} from '../src/walk/collision.js';
import {groundMesh} from '../src/v2/ground.js';
import {feature,featureLedger} from '../src/v2/feature-owner.js';

// The dressing fast lane: an additive prop made from no ship state, with its own render templates and, for some,
// collision spans and model nodes. Each entry is qualified by hand:
//  files      the module's four mode variants;
//  consumers  the only modules that may import a changed file, in the geometry graph or the offline authoring page's
//             (main.authoring.js), and imports everything a changed file may import;
//  glue       [file, line]: each line that places it, exactly once in its file;
//  uses       [file, token, allowed]: past the allowed snippets the token appears nowhere else in that file's code, so
//             nothing but the glue reaches the prop (and a consumer that would read it stays idle);
//  collision  it is made solid, owned by its producer's tag (group.userData.fastDressing, read by roomPatchOwner in
//             room-owner.js, never a name); model: it is in leo-full-ship.glb (v2-build.mjs exports it).
export const DRESSINGS={
 selfie:{owner:'dressing:selfie',create:'createSelfieBooth',groups:r=>[r.group],site:'src/walk/selfie.js',collision:true,model:true,
  files:['src/walk/selfie.js','src/walk/selfie.authoring.js','src/walk/selfie.prepared.js','src/walk/selfie.public.js'],
  source:'src/walk/selfie.js',authoring:'src/walk/selfie.authoring.js',public:'src/walk/selfie.public.js',
  consumers:['src/walk/prepare.js','src/walk/prepare.authoring.js'],glue:['src/walk/prepare.js','src/walk/prepare.authoring.js'].map(f=>[f,'const booth=createSelfieBooth();colliders.addStatic(booth.group);']),uses:[],
  imports:['package:three','src/walk/canvas.js','src/fin-crown.js','src/concept-shape.js','src/v2/prepared-geometry-record.js']},
 // The paintings: only the authoring page hangs them, after collision and the bake, so their one prepared output is
 // their geometry templates; never solid and in no model. trim.js reads PAINTINGS to keep corridor walls bare behind
 // them, but the v2 walk imports corridorTrim without calling it, and the uses check keeps it that way.
 paintings:{owner:null,create:'createPaintings',groups:r=>r.groups,site:'src/walk/paintings.js',collision:false,model:false,
  files:['src/walk/paintings.js','src/walk/paintings.authoring.js','src/walk/paintings.prepared.js','src/walk/paintings.public.js'],
  source:null,authoring:'src/walk/paintings.authoring.js',public:'src/walk/paintings.public.js',
  consumers:['src/walk/main.authoring.js','src/walk/trim.authoring.js'],
  glue:[['src/walk/main.authoring.js','paintings=createPaintings({urls:artUrls,anisotropy:renderer.capabilities.getMaxAnisotropy()});']],
  uses:[['src/walk/main.authoring.js',/\bpaintings\b|\bcreatePaintings\b/g,["import {createPaintings} from './paintings.authoring.js';",'paintings=createPaintings({urls:artUrls,anisotropy:renderer.capabilities.getMaxAnisotropy()});','for(const g of paintings.groups){baked.bands.set(g.name,g);scene.add(g);}',',paintings=null,','paintings.update(p);',',paintings,']],
   ['src/walk/main.authoring.js',/\bcorridorTrim\b/g,["import {corridorTrim} from './trim.authoring.js';"]]],
  // [consumer, its only importers]: the idle consumer is reached only through the files the uses check reads.
  idle:[['src/walk/trim.authoring.js',['src/walk/main.authoring.js']]],
  imports:['package:three','src/v2/phase4-community.js','src/plan/placements.js','src/walk/collision.authoring.js','src/v2/prepared-geometry-record.js']},
 // The rest of the authoring page's template-only props, hung after collision and the bake like the paintings: the
 // ship log boards, the comic books, Deck 1's hex floor and the observation lounge's compass inlay. Past their glue
 // the page only calls their runtime methods (the lookaheads below); their meshes reach nothing that is saved.
 ...template('changes-board','createChangesBoards',r=>r.groups,
  {glue:'const changeLog=createChangesBoards({',token:/\bcreateChangesBoards\b|\bchangeLog\b(?!\.(?:open|setStatus|setHearts|refused|near|nearby)\()/g,
   allowed:["import {createChangesBoards} from './changes-board.authoring.js';",'for(const g of changeLog.groups)toBand(g);','mudwater,changeLog,comics','loungeFalls;},changeLog,get walker'],
   imports:['src/v2/prepared-geometry-record.js','package:three','src/plan/placements.js','package:walk-changes','src/walk/link.js']}),
 ...template('comics','createComics',r=>r.groups,
  {glue:'comics=createComics({urls:artUrls,anisotropy:renderer.capabilities.getMaxAnisotropy()});for(const g of comics.groups)toBand(g);',token:/\bcreateComics\b|\bcomics\b(?!\.(?:update|near)\()/g,
   allowed:["import {createComics,createComicReader} from './comics.authoring.js';",',comics=null,','changeLog,comics,paintings'],
   imports:['src/v2/prepared-geometry-record.js','package:three','src/plan/rooms.js','src/fin-crown.js','src/concept-shape.js']}),
 ...template('hex-floor','createHexFloor',r=>[r.group],
  {glue:'hexFloor=createHexFloor();',token:/\bcreateHexFloor\b|\bhexFloor\b(?!\?\.update\()/g,
   allowed:["import {createHexFloor} from './hex-floor.authoring.js';",'toBand(hexFloor.group);',',hexFloor=null,'],
   imports:['src/v2/prepared-geometry-record.js','src/plan/selected-layout.js','package:three','src/plan/rooms.js','package:three/addons/utils/BufferGeometryUtils.js','src/plan/geometry-v2.js','src/service-circulation.js','src/transit.authoring.js'],
   preload:['src/model.authoring.js','src/model.js']}),
 ...template('lounge-compass','createLoungeCompass',r=>r?[r]:[],
  {glue:'{const compass=createLoungeCompass();if(compass)toBand(compass);}',token:/\bcreateLoungeCompass\b/g,
   allowed:["import {createLoungeCompass} from './lounge-compass.authoring.js';"],
   imports:['src/v2/prepared-geometry-record.js','package:three','src/plan/rooms.js','src/polish-kit.js','src/lounge.js']}),
};
// A template-only dressing the authoring page alone makes: src/walk/<name>.js and its variants, placed by `glue`.
function template(name,create,groups,{glue,token,allowed,imports,preload=[]}){
 const file=v=>'src/walk/'+name+v+'.js';
 return {[name]:{owner:null,create,groups,site:file(''),collision:false,model:false,files:['','.authoring','.prepared','.public'].map(file),
  source:null,authoring:file('.authoring'),public:file('.public'),consumers:['src/walk/main.authoring.js'],
  glue:[['src/walk/main.authoring.js',glue]],uses:[['src/walk/main.authoring.js',token,[glue,...allowed]]],imports,preload}};
}
// Room features: every call prepare.js and prepare.authoring.js wrap in feature() (src/v2/feature-owner.js) is an entry,
// keyed feature:<module>. Each is rebuilt in Node against the baseline's own decoded ship, so its glue is that line in both
// files. Only calls whose arguments are the ship and the page's still and anisotropy qualify (the Cosmo kit, hat and art
// urls aren't rebuilt here). Each prepare file's own import names the variant it runs; a module with one file is all four.
// Whether the call only adds to the ship is the baseline's ledger and the compile's own; whether it can move a rail is
// the rail probes'.
// Anything else prepare imports from the module (a strip or bed helper) runs in the fit-out, before the walls are fitted,
// and is baked with its room: its code and what it reaches in the module must be the baseline's (featureHelperHashes).
// A module only the feature's own files import (layered-conservatory.js under blossom.js) is part of the feature.
const PREPARES={source:'src/walk/prepare.js',authoring:'src/walk/prepare.authoring.js',public:'src/walk/prepare.public.js',prepared:'src/walk/prepare.prepared.js'};
const variantOf=f=>f.replace(/(\.authoring|\.public|\.prepared)?\.js$/,'');
let sourceImports=null;
// Every src module's relative imports, read once: who imports a helper decides whether it is private to a feature.
function importers(){
 if(sourceImports)return sourceImports;sourceImports=new Map();
 const walk=dir=>{for(const e of readdirSync(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())walk(f);else if(f.endsWith('.js'))
  for(const m of readFileSync(f,'utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)){const to=path.posix.normalize(path.posix.join(path.posix.dirname(f),m[1]));if(!sourceImports.has(to))sourceImports.set(to,new Set());sourceImports.get(to).add(f);}}};
 walk('src');return sourceImports;
}
// The names the authoring page binds prepare's result to ({…,name:alias,…}=prepared, alias=prepared.name), and whether
// each is only declared, guarded, drawn (toBand, scene.add, a for…of toBand list) or updated (update, near). Debug-only
// lines, comments and imports are already left out; whitespace is squeezed out first, so `} = prepared` reads as `}=prepared`.
export function pageUsesOnlyDrawing(raw,name){
 const page=raw.replace(/\s+/g,' ').replace(/ ?([=:,{}()[\];?.&|]) ?/g,'$1'),escape=n=>n.replace(/[$.]/g,c=>'\\'+c),word='[A-Za-z_$][\\w$]*';
 // prepared itself is only defined, destructured or read by key: passed on or aliased whole, it could reach anything.
 if(/(?<![\w$.])prepared(?![\w$])/.test(page.replace(/\bprepared=prepareWalkWorld\(/g,'').replace(/\{[^{}]*\}=prepared\b/g,'').replace(/\bprepared\.[A-Za-z_$][\w$]*/g,'')))return false;
 const bound=new Set(['prepared.'+name]);
 for(const m of page.matchAll(/\{([^{}]*)\}=prepared\b/g))for(const p of m[1].split(',')){const [k,a]=p.split(':');if(k===name)bound.add(a||k);}
 for(const m of page.matchAll(new RegExp('(?<![\\w$.])('+word+')=prepared\\.('+word+')(?![\\w$])','g')))if(m[2]===name)bound.add(m[1]);
 // The bindings themselves and then each allowed use come out; anything left of a binding is another use.
 let text=page.replace(/\{[^{}]*\}=prepared\b/g,'').replace(new RegExp('(?<![\\w$.])'+word+'=prepared\\.'+word+'(?![\\w$.])','g'),'');
 const at=b=>'(?<![\\w$.])'+escape(b)+'(?![\\w$])';
 text=text.replace(new RegExp('for\\(const ('+word+') of ?(\\[[^;]*?\\])\\)toBand\\(\\1\\)','g'),(m,v,list)=>{
  for(const b of bound)list=list.replace(new RegExp('\\(?'+at(b)+'\\?\\['+escape(b)+'\\.groups?\\]:\\[\\]\\)?','g'),'').replace(new RegExp('\\(?'+at(b)+'\\?'+escape(b)+'\\.groups:\\[\\]\\)?','g'),'').replace(new RegExp(at(b)+'\\.groups?(?![\\w$])','g'),'');
  return 'for(const '+v+' of '+list+')toBand('+v+')';});
 for(const b of bound){const e=escape(b);
  for(const ok of ['toBand\\('+e+'(?:\\.group)?\\)','scene\\.add\\('+e+'\\.group\\)','for\\(const ('+word+') of '+e+'\\.groups\\)toBand\\(\\1\\)',at(b)+'\\??\\.(?:update|near)\\(','if\\('+e+'\\)',at(b)+'=null(?![\\w$])'])
   text=text.replace(new RegExp(ok,'g'),'');
  if(new RegExp(at(b)).test(text))return false;}
 return true;
}
function roomFeatures(){
 const out={},files=[PREPARES.source,PREPARES.authoring],texts=Object.fromEntries(Object.entries(PREPARES).map(([k,f])=>[k,readFileSync(f,'utf8')])),
  lines=files.map(f=>readFileSync(f,'utf8').split(/\r?\n/).map(l=>l.trim())),
  page=readFileSync('src/walk/main.authoring.js','utf8').split(/\r?\n/).filter(l=>!/^\s*(\/\/|import )/.test(l)&&!l.includes('__WALK_DEBUG__')).join('\n');
 for(const line of lines[1]){const m=line.match(/^const ([A-Za-z]+)=feature\('([^']+)',ship,\(\)=>(create[A-Za-z]+)\(([^)]*)\)\);(.*)$/);if(!m)continue;
  const [,name,id,create,args,rest]=m;if(!/^(ship(,\{(still|anisotropy)(,(still|anisotropy))?\})?)?$/.test(args))continue;
  // The variant each prepare file imports, and the names it takes from it.
  const imports=Object.fromEntries(Object.entries(texts).map(([k,t])=>[k,[...t.matchAll(/import \{([^}]*)\} from '\.\/([^']+)';/g)].filter(x=>variantOf(x[2])===id).map(x=>({file:'src/walk/'+x[2],names:x[1].split(',').map(s=>s.trim())}))]));
  if(Object.values(imports).some(v=>v.length!==1||!v[0].names.includes(create)))continue;
  const variant=Object.fromEntries(Object.entries(imports).map(([k,[v]])=>[k,v.file]));
  const helpers=[...new Map(Object.values(imports).flatMap(([v])=>v.names.filter(n=>n!==create).map(n=>[v.file+'#'+n,[v.file,n]]))).values()];
  const glue=lines.map((l,i)=>[files[i],l.find(x=>x.startsWith('const '+name+"=feature('"+id+"',"))]);if(glue.some(([,g])=>!g))continue;
  // What the authoring page does with the result past prepare: draws it (group, groups) and calls it each frame (update,
  // near). Any other use (the arcade's treadmill feeds Paws Off's templates; vault.attach adds the door's collision; the
  // maze game gets the hold) is one the patch doesn't rebuild, so that feature stays with the full build.
  if(!pageUsesOnlyDrawing(page,name))continue;
  const own=[...new Set([...Object.values(variant),...['','.authoring','.prepared','.public'].map(v=>'src/walk/'+id+v+'.js').filter(f=>existsSync(f))])];
  // Modules only the feature's own files import, one level down.
  const by=importers(),privates=[...new Set(own.flatMap(f=>[...by.entries()].filter(([,from])=>from.has(f)).map(([to])=>to)))]
   .filter(f=>f.startsWith('src/walk/')&&!own.includes(f)&&[...by.get(f)].every(u=>own.includes(u)||variantOf(u)===variantOf(f)));
  const solidCall=rest.match(new RegExp('colliders\\.addStatic\\('+name+'(\\.solid)?(,\\(\\)=>true)?\\)'));
  out['feature:'+id]={feature:id,owner:'feature:'+id,create,args:ctx=>args?[ctx.ship,...(args.includes('{')?[{still:false,anisotropy:16}]:[])]:[],
   groups:r=>r?.groups?[...r.groups]:[r?.isObject3D?r:r?.group].filter(Boolean),solidOf:solidCall?r=>solidCall[1]?r.solid:r:null,filter:solidCall?.[2]?()=>true:null,
   site:'src/walk/'+id+'.js',sites:['src/walk/'+id+'.js',...new Set(privates.map(f=>variantOf(f)+'.js'))],
   collision:!!solidCall,model:true,files:[...own,...privates],source:variant.source,authoring:variant.authoring,public:variant.public,
   consumers:[...files,...own,...privates],glue,uses:[],imports:null,helpers};
 }
 return out;
}
// A module's top-level statements, split where a line starts at column 0 (the repo's style: continuation lines are
// indented or close a bracket), with full-line comments dropped. Each knows the names it declares.
function topLevel(text){
 const chunks=[];for(const line of text.replace(/\r\n/g,'\n').split('\n')){if(/^\s*\/\//.test(line))continue;
  if(/^[^\s}\])]/.test(line)||!chunks.length)chunks.push({text:line});else chunks.at(-1).text+='\n'+line;}
 for(const c of chunks){const t=c.text,f=t.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?|class)\s*([A-Za-z_$][\w$]*)/);
  c.list=/^export\s*\{/.test(t);c.declaration=!!f&&!/^(?:export\s+)?(?:default\s+)?class\b/.test(t);
  c.names=f?[f[1]]:/^(?:export\s+)?(?:const|let|var)\s/.test(t)?[...[...t.matchAll(/([A-Za-z_$][\w$]*)\s*=(?![=>])/g)].map(x=>x[1]),
   ...[...t.matchAll(/^(?:export\s+)?(?:const|let|var)\s+[{[]([^=]*)[}\]]\s*=/g)].flatMap(x=>x[1].split(',').map(s=>s.split(':').at(-1).trim()))].filter(Boolean):[];}
 return chunks;
}
// A bare name: not part of another, and not a property (one dot before it; a spread's three dots still count).
const NAME='(?<![\\w$])(?<!(?:^|[^.])\\.)';
const mentions=(text,n)=>new RegExp(NAME+n.replace(/\$/g,'\\$')+'(?![\\w$])').test(text);
// A helper's code and everything it can reach in its module. Only a function declaration can be left out, and only when
// nothing kept names it: a top-level const, let, var or class runs as the module loads and may change what the helper
// sees (Object.assign on a pattern it tests), so every one is kept, with every import, every bare statement and what
// they name. Matching names as text over-includes, which can only widen more often. An export list names everything, so
// it is kept but not followed.
export function helperReach(file,name){
 const chunks=topLevel(readFileSync(file,'utf8')),keep=new Set(),queue=chunks.filter(c=>c.names.includes(name)||!c.declaration);
 if(!chunks.some(c=>c.names.includes(name)))throw Error('No top-level '+name+' in '+file);
 while(queue.length){const c=queue.pop();if(keep.has(c))continue;keep.add(c);if(c.list)continue;
  for(const d of chunks)if(!keep.has(d)&&d.names.some(n=>mentions(c.text,n)))queue.push(d);}
 return chunks.filter(c=>keep.has(c)).map(c=>c.text);
}
export const helperHash=(file,name)=>createHash('sha256').update(helperReach(file,name).join('\n')).digest('hex');
// Every qualified feature helper's hash, saved with the clean baseline (fast-state-v2.mjs).
export const featureHelperHashes=()=>Object.fromEntries(Object.values(DRESSINGS).flatMap(d=>(d.helpers||[]).map(([f,n])=>[f+'#'+n,helperHash(f,n)])));
Object.assign(DRESSINGS,roomFeatures());
// Room dressings: a room whose fit-out pass (dressGamingLounge, …) every prepare file imports and runs before collision,
// the rest spots and the bake, so its furniture and walls are baked with the room; and whose page-side create, called
// only by the authoring page (main.authoring.js), returns a group that page draws (toBand) and updates and nothing else.
// That group is never solid, in no model and not saved (bands keep only Walk_merged_), so the create's one prepared
// output is its geometry templates, which the public walk replays. An edit to the create takes the lane: it is rebuilt
// in Node against the baseline's decoded ship, must leave that ship untouched, and its templates are swapped. The dress
// pass must be the baseline's in every variant (helperHash, as for a feature's strip). Templates are told apart by their
// recording site: the labels the dress pass reaches stay the baseline's; every other label of the module is the create's.
// The page wraps each create in feature() under its dressing id, so the clean baseline's ledger says whether that call
// left the authoring ship untouched; the Node rebuild must say so too. The decoded ship lacks the room's baked leaf
// meshes, so a create could change one unseen (the gaming lounge's runs before the bake): every line of the code only
// the create reaches that names the ship, the room, the page's lights, the layout or a global must be one of `reads`,
// as built (the ship only to find the room, the room only for its frame, the lights only in the mood block).
// gaming-lounge and surgery only. The imaging room's create takes the Cosmo kit, which isn't rebuilt here; the aquarium
// is out (lounge.js, partitions.js and the live identity read it).
const ROOM_READS=['const room=roomObject(ship,ROOM);if(!room)return null;','room.updateWorldMatrix(true,false);','room.matrixWorld.decompose(group.position,group.quaternion,group.scale);'];
function roomDressings(){
 const out={},page=readFileSync('src/walk/main.authoring.js','utf8'),publicPage=readFileSync('src/walk/main.public.js','utf8'),texts=Object.entries(PREPARES).map(([,f])=>[f,readFileSync(f,'utf8')]);
 const still="{still:matchMedia('(prefers-reduced-motion: reduce)').matches}";
 const rooms={
  // The page's lights stand in as fresh ones, so the mood block runs as it does on the page.
  'gaming-lounge':{room:'d16-training-aft',dress:'dressGamingLounge',create:'createGamingLounge',binding:'gaming',
   args:ctx=>[ctx.ship,{hemi:new T.HemisphereLight(0xffffff,0x444444,1),fill:new T.DirectionalLight(0xffffff,1),scene:new T.Scene()},{still:false}],
   glue:"gaming=feature('room:gaming-lounge',ship,()=>createGamingLounge(ship,{hemi,fill,scene},"+still+"));",
   allowed:['if(gaming)toBand(gaming.group);',',gaming=null,','get gaming(){return gaming;}'],
   imports:['src/v2/prepared-geometry-record.js','src/plan/selected-layout.js','src/plan/rooms.js','package:three','package:three/addons/utils/BufferGeometryUtils.js'],
   reads:['export function createGamingLounge(ship,light=null,{still=false}={}){',...ROOM_READS,'function roomOutline(room){',
    "const plan=layout.rooms?.find(r=>'Area_'+r.id===ROOM)?.polygon,toLocal=room.matrixWorld.clone().invert(),y=room.matrixWorld.elements[13];",
    'const world=local.map(([x,z])=>{const v=new T.Vector3(x,0,z).applyMatrix4(room.matrixWorld);return [v.x,v.z];});',
    'const outline=roomOutline(room),flat=(flip)=>new T.ShapeGeometry(new T.Shape(outline.local.map(([x,z])=>new T.Vector2(x,flip*z))));',
    'if(light){','const {hemi,fill,scene}=light,base={hemi:hemi.intensity,fill:fill.intensity,env:scene.environmentIntensity,sky:hemi.color.clone(),ground:hemi.groundColor.clone()};',
    'setMood=t=>{const f=(a,b)=>a+(b-a)*t;hemi.intensity=f(base.hemi,base.hemi*MOOD.hemi);fill.intensity=f(base.fill,base.fill*MOOD.fill);',
    'scene.environmentIntensity=f(base.env,base.env*MOOD.env);hemi.color.lerpColors(base.sky,skyC,t);hemi.groundColor.lerpColors(base.ground,groundC,t);};']},
  // capsule-bubbles.js isn't the suite's to change here: its module code runs before the world is built, so an edit to it widens.
  surgery:{room:'d05-surgery-2',dress:'dressSurgery',create:'createSurgeryArms',binding:'surgeryArms',args:ctx=>[ctx.ship,{still:false}],
   glue:"surgeryArms=feature('room:surgery',ship,()=>createSurgeryArms(ship,"+still+"));if(surgeryArms)toBand(surgeryArms.group);",
   allowed:[',surgeryArms=null,','get surgeryArms(){return surgeryArms;}'],
   imports:['src/v2/prepared-geometry-record.js','src/plan/rooms.js','src/walk/capsule-bubbles.js','src/walk/canvas.js','package:three','package:three/addons/geometries/RoundedBoxGeometry.js'],
   reads:['export function createSurgeryArms(ship,{still=false}={}){',...ROOM_READS,'const toRoom=room.matrixWorld.clone().invert(),local=new T.Vector3();','const centre=room.getWorldPosition(new T.Vector3());',
    // arm()'s own parent group (parent, as a bare name, is also the page's window).
    'const add=(parent,name,geo,m,at,rot)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...at);if(rot)o.rotation.set(...rot);o.castShadow=true;parent.add(o);return o;};']},
 };
 const variantImport=(text,id,names)=>{const rows=[...text.matchAll(/import \{([^}]*)\} from '\.\/([^']+)';/g)].filter(x=>variantOf(x[2])===id);
  return rows.length===1&&JSON.stringify(rows[0][1].split(',').map(s=>s.trim()))===JSON.stringify(names)?'src/walk/'+rows[0][2]:null;};
 for(const [id,r]of Object.entries(rooms)){
  // Each prepare file imports the dress pass and nothing else from the module; each page, the create and nothing else.
  const dressFrom=texts.map(([,t])=>variantImport(t,id,[r.dress])),authoring=variantImport(page,id,[r.create]),publicFile=variantImport(publicPage,id,[r.create]);
  if(dressFrom.some(f=>!f)||!authoring||!publicFile)continue;
  const variants=['','.authoring','.prepared','.public'].map(v=>'src/walk/'+id+v+'.js').filter(f=>existsSync(f)),site='src/walk/'+id+'.js',files=[...variants,...(r.privates||[])];
  // The recording labels the dress pass reaches in any variant (what helperHash keeps): baked with the room, never the create's.
  let dressSites=null;const sitesOfDress=()=>dressSites??=new Set([...new Set(dressFrom)].flatMap(f=>helperReach(f,r.dress)).flatMap(t=>[...t.matchAll(/(?:RecordGeometry|recordMerged|ReplayGeometry|replayMerged)\(\s*["']([^"']+)["']/g)].map(m=>m[1])));
  // Past its glue and these, the page only calls binding?.update(…) each frame.
  const token=new RegExp('\\b'+r.create+'\\b|'+NAME+r.binding+'(?![\\w$])(?!\\?\\.update\\()','g');
  out['room:'+id]={room:r.room,owner:null,create:r.create,dress:r.dress,reads:r.reads,args:r.args,groups:x=>x?.group?[x.group]:[],site,dressSites:sitesOfDress,
   owns:key=>{const s=key.slice(0,key.indexOf('|'));return (s===site||s.startsWith(site+':'))&&!sitesOfDress().has(s);},
   collision:false,model:false,files,source:null,authoring,public:publicFile,
   consumers:[PREPARES.source,PREPARES.authoring,'src/walk/main.authoring.js',...files],
   glue:[['src/walk/main.authoring.js',r.glue]],
   uses:[['src/walk/main.authoring.js',token,["import {"+r.create+"} from './"+authoring.slice('src/walk/'.length)+"';",r.glue,...r.allowed]]],
   imports:[...r.imports,...(r.privates||[])],helpers:[...new Set(dressFrom)].map(f=>[f,r.dress])};
 }
 return out;
}
Object.assign(DRESSINGS,roomDressings());
const labelsIn=t=>[...t.matchAll(/(?:RecordGeometry|recordMerged|ReplayGeometry|replayMerged)\(\s*["']([^"']+)["']/g)].map(m=>m[1]);
// What only the create reaches (helperReach, less the dress pass's, whose code is the baseline's) may touch the ship,
// the room, the page's lights, the layout or a global only in its `reads` lines, and may neither record a dress-pass
// label nor call a dress-pass function that records one. The chunks both reach that record at load stay the dress's.
// The names, the ways round them (arguments, a constructor's Function, prototypes, reflection) and the globals.
const REACH=new RegExp(NAME+'(ship|room|light|hemi|fill|scene|layout|arguments|globalThis|window|self|top|parent|frames|document|eval|Function|require)(?![\\w$])|(?<![\\w$])(constructor|prototype|__proto__|Reflect|Proxy|defineProperty|defineProperties|setPrototypeOf)(?![\\w$])|\\bimport\\s*\\(');
export function roomCreateGuard(id){const d=DRESSINGS[id],dress=helperReach(d.authoring,d.dress),own=new Set(dress),create=helperReach(d.authoring,d.create),labels=d.dressSites();
 const only=create.filter(t=>!own.has(t));
 for(const t of only)for(const line of t.split('\n').map(l=>l.trim()))if(REACH.test(line)&&!d.reads.includes(line))return 'The '+id+' create reaches past its room frame: '+line.slice(0,90);
 const recorders=topLevel(readFileSync(d.authoring,'utf8')).filter(c=>own.has(c.text)&&labelsIn(c.text).length);
 for(const c of recorders){if(!c.declaration&&create.includes(c.text))return 'The '+id+' module records geometry as it loads';
  for(const n of c.names)if(only.some(t=>mentions(t,n)))return 'The '+id+' create calls '+n+', which records the dress pass\'s geometry';}
 for(const t of only)for(const l of labelsIn(t))if(labels.has(l))return 'The '+id+' create records the dress pass\'s label '+l;
 return null;
}
// The baseline's decoded ship, restored as the public walk restores it (prepared-runtime.js), for room features to build on.
let shipContext=null;
async function featureContext(base){
 if(shipContext?.base===base)return shipContext;
 // The ship models first, as the builds enter: transit and model import each other, and a feature that reaches transit
 // alone (the jaguar gate's floorY) finds it half loaded.
 await import('../src/model.authoring.js');await import('../src/model.js');
 const {readPreparedWorld}=await import('../src/v2/prepared-codec.public.js'),names=await fs.readdir(base),metadataName=['world.parts.json','world.bin','world.json.gz'].find(n=>names.includes(n));
 globalThis.requestAnimationFrame??=f=>setTimeout(f,0);
 const {ship,manifest}=await readPreparedWorld(pathToFileURL(path.resolve(base)+path.sep),{skipImages:true,metadataName,fetchBytes:n=>fs.readFile(path.join(base,n))});
 (await import('../src/plan/rooms.js')).restoreRoomAnchors(ship.root,ship.v2RoomAnchors);ship.layout=(await import('../src/plan/selected-layout.js')).default;
 return shipContext={base,ship,ledger:new Map(manifest.features||[])};
}
// The cells every rail and void-guard question to the colliders reached (walk-plan.json railProbes, src/v2/rail-probes.js).
async function railProbes(baseDirectory){
 const p=JSON.parse(await fs.readFile(baseDirectory+'/walk-plan.json','utf8')).railProbes;if(!p||p.unbounded||!Array.isArray(p.cells))return null;
 const cells=new Set();for(let i=0;i<p.cells.length;i+=3)cells.add(p.cells[i]+','+p.cells[i+1]+','+p.cells[i+2]);return {cell:p.cell,cells};
}
// Does any triangle's box (5 cm of slack) reach a cell a question reached?
function nearProbe(positions,{cell,cells}){
 const r=.05,f=v=>Math.floor(v/cell);for(let i=0;i<positions.length;i+=9){let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,z1=-Infinity;
  for(let k=0;k<9;k+=3){const x=positions[i+k],y=positions[i+k+1],z=positions[i+k+2];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(z<z0)z0=z;if(z>z1)z1=z;}
  for(let a=f(x0-r);a<=f(x1+r);a++)for(let b=f(y0-r);b<=f(y1+r);b++)for(let c=f(z0-r);c<=f(z1+r);c++)if(cells.has(a+','+b+','+c))return true;
 }
 return false;
}
// Consumers are looked for in both graphs: the geometry producers and the page that authors the prepared walk.
const consumerRoots=()=>[...geometryRoots(),'src/walk/main.authoring.js'];
// A file's code without its comment lines, for the uses check.
const code=text=>text.replace(/\r\n/g,'\n').split('\n').map(l=>l.replace(/^\s*\/\/.*$/,'')).join('\n');
// An edit the patch can't carry (a lost tag, a new texture or instancing, a replay mismatch) takes the wider build
// rather than failing the deploy; the full pipeline supports it.
const decline=(ok,message)=>{if(!ok)throw Error(message+'; take the wider build');};
// A template belongs to a dressing by its recording site: RecordGeometry keys site:n|args, recordMerged site|merge|...
// A room dressing owns its keys by exact label (owns).
export const ownsTemplate=(d,key)=>d.owns?d.owns(key):(d.sites||[d.site]).some(s=>key.startsWith(s+':')||key.startsWith(s+'|'));
export const dressingOwners=ids=>new Set(ids.filter(id=>DRESSINGS[id].collision).map(id=>DRESSINGS[id].owner));

// null: not a dressing-only change (the normal lanes decide). {reason}: a dressing file changed but it can't be
// patched alone. {dressings}: every changed file belongs to qualified dressings and each is used only by its own glue.
export async function classifyDressings(files,{graph=null}={}){
 const ids=Object.keys(DRESSINGS).filter(id=>files.some(f=>DRESSINGS[id].files.includes(f)));
 if(!ids.length||files.some(f=>!ids.some(id=>DRESSINGS[id].files.includes(f))))return null;
 graph??=await producerGraph(consumerRoots());const users=f=>Object.keys(graph).filter(g=>graph[g].includes(f));
 for(const id of ids){const d=DRESSINGS[id];
  for(const f of files.filter(f=>d.files.includes(f))){
   if(!graph[f])return {reason:'Dressing module '+f+' left the geometry graph'};
   const others=users(f).filter(u=>!d.consumers.includes(u));if(others.length||!users(f).length)return {reason:f+' is also used by '+(others.join(', ')||'nothing it was qualified for')};
   const extra=d.imports?graph[f].filter(i=>!d.imports.includes(i)):[];if(extra.length)return {reason:f+' imports '+extra.join(', ')+', outside its qualified dressing inputs'};
  }
  const blocked=await pageGuard(id,users);if(blocked)return {reason:blocked};
 }
 return {dressings:ids};
}
// The lines that place a dressing and its uses past them, read on every deploy: main.authoring.js lies outside the
// geometry identity, so an edit to it alone would otherwise take lane A with stale prepared data.
async function pageGuard(id,users){const d=DRESSINGS[id];
 for(const [file,line]of d.glue)if((await fs.readFile(file,'utf8')).split(line).length!==2)return 'The '+id+' dressing is no longer placed by its one qualified line in '+file;
 for(const [file,token,allowed]of d.uses){let text=code(await fs.readFile(file,'utf8'));
  for(const a of allowed){if(text.split(a).length!==2)return 'The '+id+' dressing\'s use in '+file+' changed: '+a.slice(0,60);text=text.replace(a,'');}
  const rest=text.match(token);if(rest)return file+' reaches the '+id+' dressing outside its qualified uses: '+rest.slice(0,3).join(', ');}
 for(const [consumer,only]of d.idle||[]){const others=users(consumer).filter(u=>!only.includes(u));if(others.length)return consumer+', idle for the '+id+' dressing, is also imported by '+others.join(', ');}
 return null;
}
// Whatever changed: a page that now reaches a dressing's meshes (makes one solid, adds it to the ship) takes the whole build.
export async function authoringPageGuard(){const graph=await producerGraph(consumerRoots()),users=f=>Object.keys(graph).filter(g=>graph[g].includes(f));
 for(const id of Object.keys(DRESSINGS)){const blocked=await pageGuard(id,users);if(blocked)return blocked;}
 return null;
}

// Rails are planned (railings.js) by probing the colliders at drop edges of the 20 deck rasters, up to a flight's
// 3.88 m above a deck plus a 1.3 m guard probe. A dressing whose old and new triangles all stand well above the top
// deck can't move a rail, so walk-plan.json and walk-map.png stay the baseline's.
// (model.js first: transit.js reached first is mid-cycle with lifts.js.)
async function railCeiling(){const {DECKS}=await import('../src/model.js'),{floorY}=await import('../src/transit.js');return floorY(DECKS.length)+6;}
const minimumY=positions=>{let y=Infinity;for(let i=1;i<positions.length;i+=3)y=Math.min(y,positions[i]);return y;};

// A dressing's triangles in each static band (or ground band), in band order, from an encoded prepared walk.
export async function ownedTriangles(manifest,read,owner,{ground=false}={}){
 const out=[];for(const [band,record]of (ground?manifest.colliders.ground:manifest.colliders).bands){const spans=(record.ownerSpans||[]).filter(r=>r.owner===owner);if(!spans.length)continue;
  const geometry=manifest.geometries[record.geometry],positions=await read(geometry.attributes.position.array),index=geometry.index==null?null:await read(geometry.index),flags=record.windowFlags==null?null:await read(record.windowFlags),p=[],f=[];
  for(const r of spans)for(let i=r.start;i<r.start+r.count;i++){for(let k=0;k<3;k++){const v=index?index[i*3+k]:i*3+k;p.push(positions[v*3],positions[v*3+1],positions[v*3+2]);}f.push(flags?.[i]||0);}
  out.push({band,positions:Float32Array.from(p),flags:Uint8Array.from(f)});}
 return out;
}

let shimmed=false;
// Node's canvas and exporter globals, as v2-build.mjs sets them before it exports the ship's models.
function shims(){if(shimmed)return;shimmed=true;installWalkCanvas(createCanvas);globalThis.FileReader??=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
 globalThis.ImageData=ImageData;globalThis.HTMLCanvasElement=createCanvas(1,1).constructor;
 // A dressing with its own page panel (the ship log boards) builds DOM it never draws into the prepared walk: inert
 // elements take every property and call. Anything the stand-in can't carry throws, and the patch widens.
 const inert=()=>{const own={};return new Proxy(function(){return inert();},{get:(t,k)=>k in own?own[k]:k===Symbol.toPrimitive?()=>'':k==='then'?undefined:(own[k]=inert()),set:(t,k,v)=>{own[k]=v;return true;}});};
 const canvas=()=>{const c=createCanvas(1,1);c.toBlob=(cb,type='image/png')=>cb(new Blob([c.toBuffer(type)],{type}));return Object.assign(c,{style:{},addEventListener(){},removeEventListener(){},setAttribute(){},focus(){},getBoundingClientRect:()=>({left:0,top:0,width:1,height:1})});};
 globalThis.document??={createElement:tag=>tag==='canvas'||tag===undefined?canvas():inert(),head:inert(),body:inert(),addEventListener(){},removeEventListener(){},getElementById:()=>inert(),querySelector:()=>inert()};
 globalThis.addEventListener??=()=>{};globalThis.removeEventListener??=()=>{};
 // The public replay reads templates from the prepared walk; here from the authoring records just made, read when each
 // template is taken (the module is evaluated once, for the first dressing compiled). The ship log (walk-changes, from
 // git at page build) only fills the boards' texture, so an empty one stands in.
 registerHooks({resolve(specifier,context,next){if(/prepared-resource\.public\.js$/.test(specifier))return {url:'data:text/javascript,export const preparedResource={get geometryTemplates(){return globalThis.__leoDressingTemplates;}};',shortCircuit:true};
  if(specifier==='walk-changes')return {url:'data:text/javascript,export default [];',shortCircuit:true};return next(specifier,context);},
  // A room dressing's variants also hand out their top-level bindings (moduleState).
  load(url,context,next){const r=next(url,context),file=Object.values(DRESSINGS).filter(d=>d.room).flatMap(d=>[d.authoring,d.public]).find(f=>url.endsWith('/'+f));if(!file||r.format!=='module')return r;
   const names=[...new Set(topLevel(String(r.source)).filter(c=>!c.declaration&&!/^import\b/.test(c.text)).flatMap(c=>c.names))].filter(n=>/^[A-Za-z_$][\w$]*$/.test(n));
   return {...r,source:String(r.source)+'\nexport const __leoTopLevel=()=>({'+names.map(n=>'...(typeof '+n+"!=='undefined'?{"+n+'}:{})').join(',')+'});\n',shortCircuit:true};}});
}
// What a room dressing's create could change besides the ship: its module's top-level values (the dress pass's
// materials are shared with what it baked), three's exports and the globals. Data properties are followed (getters
// are never run), functions and accessors are kept by identity, typed arrays by content. `ids` is shared by the
// snapshots compared, so an object or function put in another's place reads as new.
function moduleState(mod,ids){
 const seen=new Set(),rows=[],id=v=>{if(!ids.has(v))ids.set(v,ids.size);return ids.get(v);};
 const walk=v=>{if(v===null||typeof v!=='object'&&typeof v!=='function')return typeof v+':'+String(v);const i=id(v);if(seen.has(v))return '#'+i;seen.add(v);
  if(seen.size>300000)throw Error('Room dressing state too large to compare; take the wider build');
  if(typeof v==='function')return 'fn#'+i;
  if(ArrayBuffer.isView(v))return v.constructor.name+':'+createHash('sha256').update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength)).digest('hex');
  const own=[];let names=[];try{names=Object.getOwnPropertyNames(v).sort();}catch{return 'opaque#'+i;}
  for(const k of names){const p=Object.getOwnPropertyDescriptor(v,k);own.push(k+('value' in p?'='+walk(p.value):'@'+walk(p.get)+'/'+walk(p.set)));}
  rows.push(i+':'+Object.getPrototypeOf(v)?.constructor?.name+'{'+own.join(',')+'}');return '#'+i;};
 // Classes and the globals one level only: what each name holds, by identity.
 const ref=x=>x!==null&&(typeof x==='object'||typeof x==='function')?'ref#'+id(x):typeof x+':'+String(x);
 const shallow=v=>Object.getOwnPropertyNames(v).sort().map(k=>{const p=Object.getOwnPropertyDescriptor(v,k);return k+('value' in p?'='+ref(p.value):'@'+ref(p.get)+'/'+ref(p.set));}).join(',');
 const top=Object.entries(mod.__leoTopLevel()).map(([k,v])=>k+'='+walk(v)).join(';');
 const three=Object.entries(T).map(([k,v])=>k+'='+(typeof v==='function'?shallow(v)+'|'+(v.prototype?shallow(v.prototype):''):walk(v))).join(';');
 return top+'\n'+three+'\n'+shallow(globalThis)+'\n'+rows.join('\n');
}
const shape=root=>{const rows=[];root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,a=[];for(const [k,x]of Object.entries(g.attributes).sort())a.push(k,Array.from(x.array));rows.push([o.name,o.matrixWorld.elements,a,g.index?Array.from(g.index.array):null,o.count??null,o.instanceMatrix?Array.from(o.instanceMatrix.array):null]);});return JSON.stringify(rows);};

// Each fresh process compiles a dressing exactly as a full build does: the authoring variant for the prepared walk's
// templates and collision (the offline authoring page), the plain module for the full-ship model (v2-build.mjs).
export async function compileDressing(id,{base=null}={}){
 const d=DRESSINGS[id];shims();
 // Each variant's call is checked on its own: it may only return its parts, never change the ship it reads.
 // A room dressing's create runs on the same decoded ship, under the same check, keyed by its dressing id.
 // A room dressing's create must also leave its module's values, three and the globals as they were (moduleState).
 const ctx=d.feature||d.room?await featureContext(base):null,checked=d.feature||(d.room&&id),make=mod=>{if(!checked)return mod[d.create]();const ids=new Map(),state=d.room?(decline(typeof mod.__leoTopLevel==='function','Room dressing '+id+' module state is not exposed'),moduleState(mod,ids)):null,r=feature(checked,ctx.ship,()=>mod[d.create](...d.args(ctx)),{deep:true});
  if(d.room)decline(moduleState(mod,ids)===state,'Room dressing '+id+' changes its module\'s values, three or a global');
  decline(featureLedger().get(checked).additive,(d.feature?'Feature ':'Room dressing ')+checked+' changes the ship as well as returning its parts');return r;};
 if(checked)decline(ctx.ledger.get(checked)?.additive===true,(d.feature?'Feature ':'Room dressing ')+checked+" isn't an additive call in the baseline ledger");
 if(d.room){const reason=roomCreateGuard(id);decline(!reason,reason);}
 // Its strip and bed helpers were baked with their rooms: each must be the baseline's (featureHelperHashes).
 if(d.helpers?.length){const saved=JSON.parse(await fs.readFile(path.join(path.dirname(base),'state.json'),'utf8')).featureHelpers||{};
  for(const [f,n]of d.helpers)decline(saved[f+'#'+n]!==undefined&&saved[f+'#'+n]===helperHash(f,n),(d.feature?'Feature '+d.feature:'Room dressing '+id)+' helper '+n+' ('+f+') is not the one the baseline was built with');}
 const {geometryRecords}=await import('../src/v2/prepared-geometry-record.js'),before=new Set(geometryRecords().keys());
 // Modules the page has loaded first, where a dressing reaches an import cycle (transit.js and lifts.js) mid-way.
 for(const p of d.preload||[])await import('../'+p);
 const result=make(await import('../'+d.authoring)),ledger=checked?{...featureLedger().get(checked)}:null,authored=d.groups(result),group=new T.Group();
for(const g of authored)group.add(g);
 const col=new Colliders(),ground=new Colliders();
 if(d.collision&&d.feature){const root=d.solidOf(result);decline(root?.userData.fastFeature===d.feature,'Feature '+d.feature+' lost its owner tag');
  col.addStatic(root,d.filter||undefined);ground.addStatic(root,o=>(d.filter||solid)(o)&&groundMesh(o));}
 else if(d.collision){decline(authored.length===1&&authored[0].userData.fastDressing===id,'Dressing '+id+' lost its owner tag');
  // The glue's addStatic, after installGround (ground.js) has made it feed the walkable surfaces to the ground bands too.
  col.addStatic(authored[0]);ground.addStatic(authored[0],o=>solid(o)&&groundMesh(o));}
 const pending=c=>[...c.pending].sort(([a],[b])=>a-b).map(([band,list])=>{for(const r of list.ownerSpans)assert.equal(r.owner,d.owner,'Dressing collision outside its owner');return {band,positions:list.values.slice(),flags:list.flags.slice(0,list.flagLength),spans:list.ownerSpans};});
 const collision=pending(col),groundCollision=pending(ground);
 for(const key of geometryRecords().keys())decline(before.has(key)||ownsTemplate(d,key),'Dressing '+id+' recorded another module\'s geometry: '+key.slice(0,80));
 const templates=[...geometryRecords()].filter(([key])=>ownsTemplate(d,key));
 // The public variant must find every template it replays and rebuild the same meshes.
 globalThis.__leoDressingTemplates=new Map(templates);const replayed=new T.Group();for(const g of d.groups(make(await import('../'+d.public))))replayed.add(g);
 decline(shape(replayed)===shape(group),'Public '+id+' replay differs from its authoring geometry');
 if(!d.model)return {id,templates,collision,groundCollision,ledger,model:null};
 const plain=make(await import('../'+d.source))?.group;
 // A feature that returns no group isn't in leo-full-ship.glb (v2-build.mjs adds each prepared item's group).
 if(d.feature&&!plain)return {id,templates,collision,groundCollision,ledger,model:null};
 decline(d.feature?plain.userData.fastFeature===d.feature:plain.userData.fastDressing===id,'Dressing '+id+' model lost its owner tag');
 prepareArrivalCanvasExport(plain);shareExportGeometry(plain);
 // Model finalization (retire-obsolete-facades-v2.mjs) prunes the exported ship: Node's canvas textures export as
 // transparent black and fold into their material's colour factor.
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.readBinary(new Uint8Array(await indexedV2Export(await new GLTFExporter().parseAsync(plain,{binary:true,onlyVisible:true}))));
 await doc.transform(prune());return {id,templates,collision,groundCollision,ledger,model:Buffer.from(await io.writeBinary(doc))};
}

// Replace the dressing's nodes in the one model that holds them (leo-full-ship.glb) at the same place in its parent.
async function patchDressingModels({baseline,destination,compiled}){
 const rows=[],found=new Map();
 for(const file of (await fs.readdir(baseline)).filter(f=>f.endsWith('.glb'))){
  const original=await fs.readFile(baseline+'/'+file),{json:j,bin}=parseGlb(original),tagged=new Map();
  // A tagged node inside another with the same tag is part of it (the jaguar gate's solid is in its group). Two separate
  // roots for one patched id can't be replaced as one.
  const tagOf=n=>n.extras?.fastDressing??(n.extras?.fastFeature===undefined?undefined:'feature:'+n.extras.fastFeature),parentOf=new Map(),twice=new Set();
  j.nodes.forEach((n,i)=>{for(const c of n.children||[])parentOf.set(c,i);});
  const inside=(i,id)=>{for(let p=parentOf.get(i);p!==undefined;p=parentOf.get(p))if(tagOf(j.nodes[p])===id)return true;return false;};
  j.nodes.forEach((n,i)=>{const id=tagOf(n);if(id===undefined||inside(i,id))return;if(tagged.has(id))twice.add(id);tagged.set(id,i);});
  for(const c of compiled)decline(!twice.has(c.id),'Model has two '+c.id+' dressings: '+file);
  const mine=compiled.filter(c=>tagged.has(c.id));if(!mine.length){await fs.copyFile(baseline+'/'+file,destination+'/'+file);rows.push({file,reused:true});continue;}
  const fragments=[alignGlb(bin)];let length=fragments[0].length;const append=bytes=>{const offset=length,b=alignGlb(Buffer.from(bytes));fragments.push(b);length+=b.length;return offset;};
  const retire=i=>{const n=j.nodes[i];delete n.mesh;delete n.extensions;delete n.extras;for(const c of n.children||[])retire(c);};
  for(const c of mine){
   const old=tagged.get(c.id),parent=j.nodes.findIndex(n=>n.children?.includes(old));decline(parent>=0,'Dressing '+c.id+' is not inside the ship model');found.set(c.id,file);
   const {json:a,bin:abin}=parseGlb(c.model);decline(!a.images?.length&&!a.textures?.length&&!a.skins?.length&&!a.animations?.length&&a.scenes[a.scene||0].nodes.length===1,'Dressing model patch must be one static untextured root');
   // Plain and instanced meshes are relocated (an instanced node's EXT_mesh_gpu_instancing attributes are accessors, moved
   // with the rest; quantized accessors are only other component types). Compression, morph targets and sparse accessors
   // hold indices this copy doesn't remap.
   decline(!(a.extensionsUsed||[]).some(e=>!/^(KHR_(materials_|texture_transform|mesh_quantization)|EXT_mesh_gpu_instancing$)/.test(e))
    &&!(a.nodes||[]).some(n=>n.extensions&&Object.keys(n.extensions).some(k=>k!=='EXT_mesh_gpu_instancing'))&&!(a.accessors||[]).some(x=>x.sparse||x.bufferView===undefined)
    &&!(a.meshes||[]).some(m=>m.extensions||m.primitives.some(p=>p.extensions||p.targets)),'Dressing model uses compression, morph targets or sparse accessors');
   const viewOffset=j.bufferViews.length,accessorOffset=j.accessors.length,materialOffset=(j.materials||[]).length,meshOffset=j.meshes.length,nodeOffset=j.nodes.length,binOffset=append(abin);
   j.bufferViews.push(...a.bufferViews.map(v=>({...v,buffer:0,byteOffset:binOffset+(v.byteOffset||0)})));
   j.accessors.push(...a.accessors.map(x=>({...x,bufferView:x.bufferView+viewOffset})));j.materials??=[];j.materials.push(...(a.materials||[]));
   j.meshes.push(...(a.meshes||[]).map(m=>({...m,primitives:m.primitives.map(p=>({...p,attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,v+accessorOffset])),...(p.indices===undefined?{}:{indices:p.indices+accessorOffset}),...(p.material===undefined?{}:{material:p.material+materialOffset})}))})));
   for(const n of a.nodes){const copy=structuredClone(n);if(copy.mesh!==undefined)copy.mesh+=meshOffset;if(copy.children)copy.children=copy.children.map(i=>i+nodeOffset);
    const instancing=copy.extensions?.EXT_mesh_gpu_instancing;if(instancing)instancing.attributes=Object.fromEntries(Object.entries(instancing.attributes).map(([k,v])=>[k,v+accessorOffset]));j.nodes.push(copy);}
   retire(old);const children=j.nodes[parent].children;children[children.indexOf(old)]=a.scenes[a.scene||0].nodes[0]+nodeOffset;
   j.extensionsUsed=[...new Set([...(j.extensionsUsed||[]),...(a.extensionsUsed||[])])];if(a.extensionsRequired?.length)j.extensionsRequired=[...new Set([...(j.extensionsRequired||[]),...a.extensionsRequired])];
  }
  const bytes=packGlb(j,Buffer.concat(fragments,length));await fs.writeFile(destination+'/'+file,bytes);rows.push({file,reused:false,dressings:mine.map(c=>c.id),bytes:bytes.length});
 }
 for(const c of compiled)decline(found.has(c.id),'No model holds the '+c.id+' dressing');
 return rows;
}

export async function patchDressings(plan,timer,{baseDirectory,destination}){
 const ids=plan.dressings,base=baseDirectory+'/prepared-walk',m=await preparedManifest(base),read=preparedArrayReader(m,base),patch=new PreparedPatch(m),owners=dressingOwners(ids);
 // A dressing that won't build in Node (its page stand-ins fall short) is the full build's to make.
 const compiled=await timer.stage('compile changed dressings',async()=>{const rows=[];for(const id of ids)try{rows.push(await compileDressing(id,{base}));}catch(e){const message=String(e?.message??e);if(/take the wider build/.test(message))throw e;decline(false,'The '+id+' dressing failed to build in Node: '+message.split('\n')[0]);}return rows;});
 const ceiling=await railCeiling(),probes=ids.some(id=>DRESSINGS[id].feature)?await railProbes(baseDirectory):null;
 for(const c of compiled){const d=DRESSINGS[c.id],old=d.collision?await ownedTriangles(m,read,d.owner):[];
  // A baseline from before ownership tags can't say which triangles were the dressing's.
  // A room feature the public walk builds from its code (the vault, the blossom garden) has no templates on either side.
  // A room dressing too (the imaging room's create records none on either side; its helpers need the new baseline).
  if((d.feature||d.room)&&c.templates.length>0!==m.geometryTemplates.some(([key])=>ownsTemplate(d,key)))throw Error('The '+c.id+' '+(d.feature?'feature':'room dressing')+' changed whether it records templates; take the wider build');
  if(d.collision&&!old.length||!d.feature&&!d.room&&!m.geometryTemplates.some(([key])=>ownsTemplate(d,key)))throw Error('The '+c.id+' dressing needs one clean full build with dressing owners; take the wider build');
  // Rails only see solid dressings; one that is never solid has no triangles for them to probe.
  if(d.feature){if(!probes)throw Error('The '+c.id+' feature needs one clean full build with rail probes; take the wider build');
   const oldGround=await ownedTriangles(m,read,d.owner,{ground:true});
   if([...old,...oldGround,...c.collision,...c.groundCollision].some(r=>nearProbe(r.positions,probes)))throw Error('The '+c.id+' feature reaches a rail probe; take the wider build');
   continue;}
  if([...old,...c.collision].some(r=>minimumY(r.positions)<=ceiling))throw Error('The '+c.id+' dressing reaches the deck rails\' probe range; take the wider build');
 }
 const merge=field=>{const out=new Map();for(const c of compiled)for(const r of c[field]){const row=out.get(r.band)||{positions:[],flags:[],spans:[]};row.spans.push(...r.spans.map(s=>({...s,start:s.start+row.flags.length})));row.positions.push(...r.positions);row.flags.push(...r.flags);out.set(r.band,row);}return out;};
 const removedSpans=await timer.stage('replace owned collision spans',()=>removeOwnedSpans(m,patch,read,owners,merge('collision'),merge('groundCollision')));
 decline(removedSpans.renderTriangles===0,'The patch would remove baked render triangles');
 await timer.stage('replace dressing templates',async()=>{const writer=new PreparedWriter(),rows=compiled.flatMap(c=>c.templates.map(([key,g])=>[key,writer.geometry(g)])),first=m.geometries.length;patch.absorb(writer);
  m.geometryTemplates=[...m.geometryTemplates.filter(([key])=>!compiled.some(c=>ownsTemplate(DRESSINGS[c.id],key))),...rows.map(([key,id])=>[key,id+first])];});
 // The ledger rows of the rebuilt calls are the compile's (a full build records the page's: equal for an additive call).
 if(m.features)m.features=m.features.map(([k,v])=>{const c=compiled.find(c=>c.ledger&&(DRESSINGS[c.id].feature||c.id)===k);return c?[k,c.ledger]:[k,v];});
 const models=await timer.stage('patch dressing models',()=>patchDressingModels({baseline:baseDirectory,destination,compiled:compiled.filter(c=>c.model)}));
 const original=JSON.parse(await fs.readFile(base+'/integrity.json','utf8')),sourceInputs={...original.sourceInputs,sources:plan.identity};
 const prepared=await timer.stage('encode changed parts',()=>patch.save(destination+'/prepared-walk',base,sourceInputs,{rooms:[],decks:[],dressings:ids,collisionDressings:ids.filter(id=>DRESSINGS[id].collision),base:original.sha256}));
 return {models,prepared,removedSpans,templates:compiled.map(c=>({id:c.id,templates:c.templates.length,bands:c.collision.map(r=>r.band),triangles:c.collision.reduce((n,r)=>n+r.flags.length,0),groundTriangles:c.groundCollision.reduce((n,r)=>n+r.flags.length,0)}))};
}
