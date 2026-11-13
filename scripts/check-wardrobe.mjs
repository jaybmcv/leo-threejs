// The wardrobe's bomber jacket (src/walk/wardrobe.js) on the real Cosmo: it is skinned to his own bones and stays on the
// hoodie's surface in bent poses, swapping outfits builds it once, his shared looks are untouched, and nothing about the
// outfit reaches other visitors (only the visitor's own walk code uses it, and the wire and server never mention it).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadImage} from '@napi-rs/canvas';
import {Cache,Vector3,Quaternion} from 'three';
import {createDLCat} from '../src/vendor/cosmo/DLCat.js';
import {createWardrobe} from '../src/walk/wardrobe.js';
import {OUTFITS,cleanOutfit,savedOutfit,saveOutfit,startOutfit} from '../src/walk/outfits.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
const source=await fs.readFile('src/vendor/cosmo/DLCat.js','utf8'),images=JSON.parse(source.match(/var images = (.*);/)[1]);
Cache.enabled=true;for(const image of images)Cache.add('image:'+image.dataUri,await loadImage(image.dataUri));
const cat=await createDLCat({height:1.75});Cache.clear();Cache.enabled=false;
const nameOf=m=>m.userData.originalName??m.name,mesh=n=>cat.meshes.find(m=>nameOf(m)===n);
const hoodieParts=['hoodie.001','hoodie.002','NurbsPath','Cylinder'].map(mesh),hoodie=hoodieParts[0],kept=cat.meshes.filter(m=>!hoodieParts.includes(m));
const looks=cat.meshes.map(m=>[m.material,m.material.color.getHex(),m.material.map,m.material.side,m.material.vertexColors]);
const bones=new Map();cat.root.traverse(o=>{if(o.isBone)bones.set(nameOf(o),o);});
const wardrobe=createWardrobe({asset:cat,bones});

assert.equal(wardrobe.set(undefined),'default');assert.equal(wardrobe.jacket,null);assert(cat.meshes.every(m=>m.visible));
pass('the default outfit is the hoodie as before, and no jacket is built for it');

assert.equal(wardrobe.set('bomber'),'bomber');const jacket=wardrobe.jacket;
assert(jacket?.isSkinnedMesh&&jacket.visible&&jacket.parent===hoodie.parent);assert.equal(jacket.skeleton,hoodie.skeleton);
assert(hoodieParts.every(m=>!m.visible),'the hoodie, its pocket and drawstrings hide under the jacket');
assert(kept.every(m=>m.visible),'head, hat mount, fur, shorts, shoes and tail stay');
assert(['body','shot','shoes.001','shoes.005','tail','eyes'].every(n=>mesh(n).visible));
pass('the bomber is one skinned mesh on Cosmo\'s own skeleton; only the hoodie\'s four parts hide');

for(let i=0;i<25;i++){wardrobe.set(i%2?'bomber':'default');wardrobe.set('bomber');}
assert.equal(hoodie.parent.children.filter(o=>o.name==='Wardrobe_bomber').length,1);assert.equal(wardrobe.jacket,jacket);
wardrobe.set('default');assert(!jacket.visible&&hoodieParts.every(m=>m.visible));
assert.equal(wardrobe.set('pirate hat'),'default');assert(!jacket.visible&&hoodieParts.every(m=>m.visible));
pass('fifty swaps keep the one jacket mesh; Default and anything unknown bring the hoodie back');

assert.deepEqual(cat.meshes.map(m=>[m.material,m.material.color.getHex(),m.material.map,m.material.side,m.material.vertexColors]),looks);
assert(!cat.meshes.some(m=>m.material===jacket.material));
pass('Cosmo\'s shared materials are untouched; the jacket has its own');

// Bent poses (arms up and forward, a deep squat, a twist), as the walk's emotes, sitting and swimming bend him: every
// point of the jacket's shell stays on the matching point of the hoodie, a little out (no detached sleeves, no gaps).
const shell=hoodie.geometry.index.count,zipFrom=shell;
const poses={
 'arms raised':{'upper_arm.L':[0,0,1.2],'upper_arm.R':[0,0,-1.2],'forearm.L':[0,0,.8],'forearm.R':[0,0,-.8]},
 'arms forward, squat':{'upper_arm.L':[-1.2,0,0],'upper_arm.R':[-1.2,0,0],'thigh.L':[-1.6,0,0],'thigh.R':[-1.6,0,0],'shin.L':[2,0,0],'shin.R':[2,0,0],'spine.001':[.4,0,0]},
 'twist and lean':{'spine.003':[.3,.6,.2],'spine.005':[-.2,.3,0],'upper_arm.L':[.6,.4,-.3]},
};
const a=new Vector3(),b=new Vector3(),q=new Quaternion(),rest=[...bones.values()].map(o=>o.quaternion.clone());
const scale=new Vector3();cat.root.getWorldScale(scale);
// The zip's points' distances to the shell's nearest points, standing: bent, they may not open up from these.
const zipGaps=()=>{const pts=[];for(let i=0;i<shell;i++)pts.push(jacket.getVertexPosition(i,new Vector3()));const out=[];
 for(let i=zipFrom;i<jacket.geometry.attributes.position.count;i++){jacket.getVertexPosition(i,a);out.push(Math.min(...pts.map(p=>p.distanceTo(a)))/scale.x);}return out;};
cat.root.updateMatrixWorld(true);jacket.skeleton.update();const standing=zipGaps();
for(const [name,turns] of Object.entries(poses)){
 [...bones.values()].forEach((o,i)=>o.quaternion.copy(rest[i]));
 for(const [bone,e] of Object.entries(turns))bones.get(bone).quaternion.multiply(q.setFromAxisAngle(new Vector3(1,0,0),e[0])).multiply(q.setFromAxisAngle(new Vector3(0,1,0),e[1])).multiply(q.setFromAxisAngle(new Vector3(0,0,1),e[2]));
 cat.root.updateMatrixWorld(true);jacket.skeleton.update();
 let worst=0,moved=0;const index=hoodie.geometry.index;
 for(let i=0;i<shell;i++){jacket.getVertexPosition(i,a);hoodie.getVertexPosition(index.getX(i),b);worst=Math.max(worst,a.distanceTo(b)/scale.x);
  a.fromBufferAttribute(jacket.geometry.attributes.position,i);moved=Math.max(moved,b.distanceTo(a.applyMatrix4(jacket.matrixWorld))/scale.x);}
 assert(moved>.2,`${name}: the pose must really bend him`);
 assert(worst<.02,`${name}: the jacket strays ${worst.toFixed(3)} from the hoodie`);
 const gap=Math.max(...zipGaps().map((d,i)=>d-standing[i]));
 assert(gap<.01,`${name}: the zip lifts ${gap.toFixed(3)} off the jacket`);
 pass(`${name} (sleeves moved up to ${(moved*100).toFixed(0)} cm): the shell keeps within ${(worst*100).toFixed(1)} cm of the hoodie, the zip within ${(Math.max(0,gap)*1000).toFixed(1)} mm of where it sits standing`);
}
[...bones.values()].forEach((o,i)=>o.quaternion.copy(rest[i]));

// The front fastening runs up the middle of the chest, from the waistband to the collar.
{const p=jacket.geometry.attributes.position,c=jacket.geometry.attributes.color;let lo=Infinity,hi=-Infinity,metal=0;
 for(let i=zipFrom;i<p.count;i++){assert(Math.abs(p.getX(i))<.02&&p.getZ(i)>.1);lo=Math.min(lo,p.getY(i));hi=Math.max(hi,p.getY(i));if(c.getX(i)>.3)metal++;}
 assert(lo<.6&&hi>1.03&&metal>=6,'the zip runs hem to collar');
 const tones=new Set();for(let i=0;i<zipFrom;i++)tones.add(c.getX(i).toFixed(3)+c.getY(i).toFixed(3));assert.equal(tones.size,2,'shell and ribbing');
 pass('a zip up the front from hem to collar, and the shell in two tones: body and ribbed cuffs, waistband and collar');}

wardrobe.dispose();assert(!jacket.parent&&hoodieParts.every(m=>m.visible));cat.dispose();
pass('disposing takes the jacket off and gives the hoodie back');

// Storage: kept on this browser, Default for anything missing, unknown or blocked.
assert.equal(OUTFITS[0].id,'default');for(const bad of [null,undefined,'',1,'Bomber','__proto__',{}])assert.equal(cleanOutfit(bad),'default');
let stored=null;globalThis.localStorage={getItem:()=>stored,setItem:(k,v)=>{assert.equal(k,'leo-outfit');stored=v;}};
assert.equal(savedOutfit(),'default');assert(saveOutfit('bomber'));assert.equal(savedOutfit(),'bomber');stored='tux';assert.equal(savedOutfit(),'default');
globalThis.location={search:'?at=1,2,3&outfit=default'};stored='bomber';assert.equal(startOutfit(),'default');assert.equal(stored,'bomber');
location.search='?outfit=cape';assert.equal(startOutfit(),'default');location.search='?at=1,2,3';assert.equal(startOutfit(),'bomber');
globalThis.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(savedOutfit(),'default');assert.equal(saveOutfit('bomber'),false);assert.equal(startOutfit(),'default');
location.search='?outfit=bomber';assert.equal(startOutfit(),'bomber');delete globalThis.localStorage;delete globalThis.location;
pass('the choice is saved on this browser; missing, invalid or blocked storage falls back to Default; a link\'s ?outfit= dresses one visit unsaved');

// Local only: the visitor's own walk code is the only user, and the wire, other visitors' walkers and the server never
// carry or read an outfit.
const files=async dir=>(await fs.readdir(dir,{recursive:true})).filter(f=>/\.(m?js|ts)$/.test(f)).map(f=>path.join(dir,f).replaceAll('\\','/'));
const users=[];for(const f of await files('src')){const s=await fs.readFile(f,'utf8');if(/from '\.\/(wardrobe|outfits)\.js'/.test(s))users.push(f);}
assert.deepEqual(users.sort(),['src/walk/fur-settings.js','src/walk/main.authoring.js','src/walk/main.js','src/walk/main.prepared.js','src/walk/main.public.js','src/walk/wardrobe.js']);
for(const f of [...await files('src/walk/net'),...await files('server'),'src/walk/remotes.js','src/walk/avatar.js','src/walk/crowd-draw.js'])
 assert(!/outfit|wardrobe|bomber/i.test(await fs.readFile(f,'utf8')),f+' must not carry the outfit');
for(const f of ['src/walk/main.js','src/walk/main.public.js','src/walk/main.prepared.js','src/walk/main.authoring.js']){
 const s=await fs.readFile(f,'utf8');assert.equal((s.match(/createWardrobe\(/g)||[]).length,1);assert(/createWardrobe\(walker\.figure\)/.test(s),f+': the wardrobe dresses the own walker');
 assert(!/remotes[^;\n]*wardrobe|wardrobe[^;\n]*remotes/.test(s));}
pass('only the visitor\'s own walker is dressed; net, server and other visitors never mention an outfit');
console.log(`wardrobe: ${passed} checks passed`);
