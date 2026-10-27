import fs from 'node:fs/promises';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {registry,v1Frame,frame,toWorld,toLocal,yawToWorld,yawToLocal,roomAt,setFrameOverride,clearFrameOverrides,anchorMerged,resolveRoomFrames,deltaMatrix} from '../src/plan/rooms.js';
import {SHIP_AREAS} from '../src/areas.js';
import {AREAS} from '../src/plan/v1.js';
import {readSpot,remapSpot,spotLink} from '../src/walk/link.js';
const rules=JSON.parse(await fs.readFile('src/plan/ownership-rules.json','utf8')),allow=JSON.parse(await fs.readFile('src/plan/anchor-allow-list.json','utf8'));
const glob=(pattern,p)=>new RegExp('^'+pattern.replace(/[.+?^$()|[\]{}]/g,'\\$&').replaceAll('*','.*')+'$').test(p);
const exception=p=>allow.find(a=>a.paths.some(g=>glob(g,p)));
// Text is compared and fingerprinted with LF line endings, whatever the checkout uses (core.autocrlf on Windows).
const lf=s=>s.replace(/\r\n/g,'\n'),digest=s=>createHash('sha256').update(lf(s)).digest('hex');
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
export function placementSites(source){return strip(source).split('\n').map(s=>s.trim()).filter(s=>/\.position\.(set|copy|[xyz]\s*=)|\.translate\(|\.setMatrixAt\(|\b(?:wall|home|at|center)\s*:\s*\[|\b(?:box|mesh|pipe|tube|rail|tree|chair|round|cyl|put|own|add|piece|plant|panel)\s*\(/.test(s));}
export function anchoredModule(source,rule){return rule?.via==='inherited'||/\b(anchorArea|anchorObject|anchorCabins|roomObject|toWorld|toLocal|placed|placedV1|placeObject|resolveRoomFrames|deferRoomFrames|remapSpot)\s*\(/.test(strip(source));}
const expand=ids=>[...new Set(ids.flatMap(id=>id==='@areas'?AREAS.map(a=>a.id):id==='@cabins'?registry().filter(a=>/^N\d/.test(a.id)).map(a=>a.id):id==='@commons'?registry().filter(a=>/^commons-/.test(a.id)).map(a=>a.id):id==='@nose'?registry().filter(a=>/^nose-commons-/.test(a.id)).map(a=>a.id):id==='@circulation'?Array.from({length:20},(_,i)=>'circulation-'+(i+1)):[id]))];
// A fixture from the old holo builder: a literal world placement with no room boundary must fail.
assert.equal(anchoredModule("const group=new T.Group();group.position.set(9,36.3,-21);",{}),false);
assert.equal(anchoredModule("const group=new T.Group();group.position.set(9,36.3,-21);placeObject(group,'mission-holo');",{}),true);
assert.equal(placementSites('group.position.set(9,36.3,-21);').length,1);
const records=[],errors=[];
for(const dir of ['src','src/walk'])for(const rel of await fs.readdir(dir,{recursive:dir==='src/walk'})){
 const p=dir+'/'+rel.replaceAll('\\','/');if(!p.endsWith('.js')||p.startsWith('src/walk/assets/')||p.startsWith('src/walk/net/'))continue;
 const source=await fs.readFile(p,'utf8'),sites=placementSites(source);if(!sites.length&&!rules[p])continue;
 const rule=rules[p],fixed=exception(p);if(!rule&&!fixed){errors.push(p+': geometry/position module has no owner or documented exception');continue;}
 if(rule&&!anchoredModule(source,rule)){errors.push(p+': missing room-frame boundary');continue;}
 const ids=rule?expand(rule.owners):fixed.room&&fixed.room!=='inherit'?expand([fixed.room]):[];for(const id of ids)v1Frame(id);
 const names=[...source.matchAll(/\.name\s*=\s*['"]([^'"\n]+)['"]/g)].map(m=>m[1]);
 records.push({source:p,rooms:rule?rule.owners:ids,via:rule?.via||'frame boundary',fixed:!rule,reason:fixed&&!rule?fixed.reason:undefined,features:[...new Set(names)],colliders:[...new Set(names.filter(n=>/solid|collid|entrance/i.test(n)))],interactionTargets:/\bnear\(|TRIGGERS|spots|PLACES|callAt|mills/.test(source)?'same room frames; see debug world positions':null,placements:sites.length,signature:digest(source.replaceAll('\r\n','\n'))});
}
for(const a of SHIP_AREAS){const b=v1Frame(a.id);assert.deepEqual(b.origin,a.center,'v1 origin drift: '+a.id);assert.deepEqual(b.size,[a.width,a.height,a.depth],'v1 size drift: '+a.id);}
for(const id of ['arrival-assembly','d16-theater-5','commons-1','d20-mission-2','d20-captain-7','d20-recovery-aft'])for(const change of [{dx:9},{dz:-7},{yawDeg:37},{mirror:true},{dx:9,dz:-7,yawDeg:37,mirror:true}]){
 setFrameOverride(id,change);const p=[1.2,.7,-2.8],q=toLocal(id,toWorld(id,p));q.forEach((n,i)=>assert(Math.abs(n-p[i])<1e-10,id+' round trip'));
 const yaw=.67;assert(Math.abs(yawToLocal(id,yawToWorld(id,yaw))-yaw)<1e-10,id+' facing');
 assert.equal(frame('d16-library-2'),v1Frame('d16-library-2'),'unrelated room moved');clearFrameOverrides();
}
for(const change of [{dx:7,dz:-3},{yawDeg:37},{mirror:true}]){const original=mergeGeometries([new T.BoxGeometry(2,2,2).translate(9,37,-21),new T.BoxGeometry(2,2,2).translate(53,37,21)]),mesh=new T.Mesh(original),points=original.attributes.position.array.slice();anchorMerged(mesh,['d20-mission-2','d20-captain-7']);setFrameOverride('d20-mission-2',change);resolveRoomFrames(mesh);const p=mesh.geometry.attributes.position,v=new T.Vector3(),m=deltaMatrix('d20-mission-2');for(let i=0;i<p.count;i++){v.fromArray(points,i*3);if(i<24)v.applyMatrix4(m);assert(v.distanceTo(new T.Vector3().fromBufferAttribute(p,i))<1e-4,'merged reservation owner');}clearFrameOverrides();}
assert.equal(roomAt([132,24.3,6]),'lift-forward-1-d17');assert.equal(roomAt([149,24.3,0]),'observation-lounge');assert.equal(roomAt([140,20.3,0]),'d16-voyage-forum-bow');
assert.equal(roomAt([-115,-35.7,-38]),'d02-arrival-1','lifeboat descriptor stole arrival');
assert.equal(roomAt([9,36.3,-21]),'d20-mission-2');
const legacy=readSpot('?at=9,36.3,-21&yaw=30');assert.equal(legacy.lv,1);assert.equal(readSpot('?at=9,36.3,-21&lv=x'),null);
setFrameOverride('d20-mission-2',{dx:7,yawDeg:37,mirror:true});const remapped=remapSpot(legacy);assert.deepEqual(remapped.at,toWorld('d20-mission-2',[0,0,0]));assert.equal(remapSpot(remapped),remapped);assert(Math.abs(remapped.yaw-(37*Math.PI/180+Math.PI-legacy.yaw))<1e-12);assert.deepEqual(remapSpot({...legacy,lv:2}).at,legacy.at);clearFrameOverrides();
const oldLocation=globalThis.location;globalThis.location={href:'https://example.invalid/walk.html'};assert(spotLink({position:{x:9,y:36.3,z:-21},yaw:0,pitch:0}).includes('lv=1'));globalThis.location=oldLocation;
const placements=JSON.parse(await fs.readFile('src/plan/placements.json','utf8'));for(const [key,p] of Object.entries(placements)){v1Frame(p.room);toWorld(p.room,p.local).forEach((n,i)=>assert(Math.abs(n-p.v1[i])<1e-10,key+' local frame'));}
const inventory={layoutVersion:1,ownerSets:Object.fromEntries(['@areas','@cabins','@commons','@nose','@circulation'].map(k=>[k,expand([k])])),description:'Placement sources, their complete owner sets, collider roots and interaction ownership. Source fingerprints gate added or changed placements. Run node scripts/check-anchors.mjs --write after assigning a new feature.',placedFeatures:placements,modules:records.sort((a,b)=>a.source.localeCompare(b.source))},serialized=JSON.stringify(inventory,null,2)+'\n';
if(errors.length)throw new Error(errors.join('\n'));
if(process.argv.includes('--write'))await fs.writeFile('src/plan/ownership.json',serialized);else assert.equal(lf(await fs.readFile('src/plan/ownership.json','utf8')),lf(serialized),'Ownership inventory is stale; assign ownership then run check-anchors --write');
console.log('Anchors: '+registry().length+' frames, '+records.length+' modules, '+records.reduce((n,r)=>n+r.placements,0)+' placement sites; old-code fixture and independent translation/rotation/mirror round trips pass.');
