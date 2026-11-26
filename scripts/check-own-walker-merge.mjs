// Your own cat drawn as one skinned mesh per material (avatar.js mergeDraws, merged-skin.js), with the real rig and the
// wardrobe (wardrobe.js) in Node: 15 draws become 4, and in every state the walk puts it in (the hoodie, the bomber, a
// change of clothes back and forth, eyes shut in a hammock, a change of clothes with them shut) it draws the same
// triangles, in the same materials, at the same places, as a cat drawing its own parts (main.js ?walkermerge=0).
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadImage} from '@napi-rs/canvas';
import * as T from 'three';
import {build} from './native-bundle.mjs';
import {createWardrobe} from '../src/walk/wardrobe.js';

let passed=0;const pass=name=>{passed++;console.log('PASS '+name);};
// avatar.js imports the rig's TypeScript, which Node cannot strip alone: bundled for Node, sharing this three.
const out=path.resolve('output/check-walker'),file=path.join(out,`own-walker.${process.pid}.mjs`);await fs.mkdir(out,{recursive:true});
const bundle=await build({entryPoints:['src/walk/avatar.js'],bundle:true,format:'esm',platform:'node',external:['three'],write:false,target:'es2022',logLevel:'error'});
await fs.writeFile(file,bundle.outputFiles[0].text);
let createWalker;try{({createWalker}=await import('file://'+file.replaceAll('\\','/')));}finally{await fs.rm(file,{force:true});}
const {createDLCat}=await import('../src/vendor/cosmo/DLCat.js');
const source=await fs.readFile('src/vendor/cosmo/DLCat.js','utf8'),images=JSON.parse(source.match(/var images = (.*);/)[1]);
T.Cache.enabled=true;for(const image of images)T.Cache.add('image:'+image.dataUri,await loadImage(image.dataUri));
const motion=JSON.parse(await fs.readFile('src/walk/assets/ecctrl-locomotion.json','utf8'));

// As main.js makes your own cat: merged (M), and as ?walkermerge=0 makes it (P), each in its own scene and dressed.
const make=async mergeDraws=>{const walker=await createWalker(createDLCat,motion,{mergeDraws}),scene=new T.Scene();scene.add(walker.holder);
 return {walker,scene,wardrobe:createWardrobe(walker.figure,{reskin:walker.reskin})};};
const M=await make(true),P=await make(false);T.Cache.clear();T.Cache.enabled=false;
// What draws: every visible mesh under the cat, none of whose ancestors is hidden.
const drawn=({walker})=>{const list=[];walker.holder.traverse(o=>{if(!o.isMesh||!o.visible)return;for(let p=o;p;p=p.parent)if(!p.visible)return;list.push(o);});return list;};
const triangles=m=>(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3;
const byMaterial=c=>{const out={};for(const m of drawn(c))out[m.material.name]=(out[m.material.name]||0)+triangles(m);return out;};
// Every drawn vertex where it is drawn, posed, material by material, in the parts' own order (merged copies keep it).
const order=c=>new Map(c.walker.figure.asset.meshes.map((m,i)=>[m,i]));
const where=c=>{const at={},rank=order(c);c.scene.updateMatrixWorld(true);
 const meshes=drawn(c).sort((a,b)=>(rank.get(a)??(a.name.startsWith('Merged_')?-1:99))-(rank.get(b)??(b.name.startsWith('Merged_')?-1:99)));
 for(const m of meshes){const list=at[m.material.name]??=[];const v=new T.Vector3();for(let i=0;i<m.geometry.attributes.position.count;i++)list.push(m.getVertexPosition(i,v).applyMatrix4(m.matrixWorld).clone());}
 return at;};
const same=(label)=>{
 assert.deepEqual(byMaterial(M),byMaterial(P),label+': the same triangles in each material');
 const a=where(M),b=where(P);assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());
 for(const k in a){assert.equal(a[k].length,b[k].length,label+': '+k);let worst=0;a[k].forEach((v,i)=>worst=Math.max(worst,v.distanceTo(b[k][i])));assert.ok(worst<1e-5,`${label}: ${k} vertices up to ${worst} m apart`);}
};
const names=c=>drawn(c).map(m=>m.name).sort();
const base={speed:0,grounded:true,stance:'stand',jumpCount:1,jumpS:-1,turnRate:0,accel:0,rise:0};
const step=(s,n=1)=>{for(let i=0;i<n;i++)for(const c of [M,P])c.walker.update(1/60,{...base,...s});};

M.wardrobe.set('default');P.wardrobe.set('default');step({speed:1.4},20);
assert.equal(drawn(P).length,15);assert.deepEqual(names(M),['Merged_body','Merged_clothes','shoes001','shoes005']);
same('default, walking');pass('your own cat draws 4 meshes, not 15: the same triangles in each material, posed where its parts are');

const start={names:names(M),merged:M.walker.merged.merged};
M.wardrobe.set('bomber');P.wardrobe.set('bomber');step({speed:3},20);
assert.deepEqual(names(M),['Merged_body','Wardrobe_bomber','shoes001','shoes005','shot']);assert.equal(drawn(P).length,12);
assert.ok(!M.walker.merged.meshes.some(m=>m.name==='Merged_clothes'),'no merged copy holds the hidden hoodie');
same('bomber, running');pass('in the bomber the hoodie\'s parts leave the merged copies (5 draws, 12 part by part); the rest draws as before');

{const before=M.walker.merged;M.wardrobe.set('bomber');assert.equal(M.walker.merged,before,'the same outfit again merges nothing again');}
for(let i=0;i<6;i++){const o=i%2?'default':'bomber';M.wardrobe.set(o);P.wardrobe.set(o);}
M.wardrobe.set('default');P.wardrobe.set('default');step({},5);
assert.deepEqual(names(M),start.names);assert.equal(M.walker.merged.merged,start.merged);same('back to default');
{let copies=0;M.walker.holder.traverse(o=>{if(o.name.startsWith('Merged_'))copies++;});assert.equal(copies,M.walker.merged.meshes.length,'no merged copy is left behind');}
pass('back and forth, the hoodie comes back into its merged copy as at the start, and no old copy stays');

// Eyes shut in a hammock (avatar.js): the swapped uvs reach the merged copy, through a change of clothes and back.
const eyes=c=>c.walker.figure.asset.meshes.find(m=>m.name==='eyes'),hammock={rest:{kind:'lie',weight:1,hammock:true}};
const eyeUv=c=>{const m=c.walker.merged.meshes.find(x=>x.material===eyes(c).material),parts=c.walker.figure.asset.meshes.filter(p=>p.material===eyes(c).material);
 let at=0;for(const p of parts){if(p===eyes(c))break;at+=p.geometry.attributes.position.count;}
 const uv=m.geometry.attributes.uv,own=eyes(c).geometry.attributes.uv;for(let i=0;i<own.count;i++)if(uv.getX(at+i)!==own.getX(i)||uv.getY(at+i)!==own.getY(i))return false;return true;};
const open=eyes(M).geometry.attributes.uv;
step(hammock,3);assert.notEqual(eyes(M).geometry.attributes.uv,open);assert.ok(eyeUv(M));same('hammock');
M.wardrobe.set('bomber');P.wardrobe.set('bomber');step(hammock,2);assert.ok(eyeUv(M));same('hammock, bomber');
step({},3);assert.equal(eyes(M).geometry.attributes.uv,open);assert.ok(eyeUv(M));same('out of the hammock, bomber');
pass('eyes shut in a hammock show in the merged copy, through a change of clothes while shut, and open again after');

// The catnip face and the hat's mount are their own meshes, on the head bone, and draw as before.
step({catnip:true},90);assert.ok(drawn(M).some(m=>m.name==='Catnip_face'));same('catnip face, bomber');
pass('the catnip face draws over the merged cat as over its parts');

M.wardrobe.dispose();P.wardrobe.dispose();step({},2);assert.deepEqual(names(M).filter(n=>n!=='Catnip_face'),start.names);same('wardrobe disposed');
M.walker.dispose();assert.ok(M.walker.figure.asset.meshes.every(m=>m.visible));P.walker.dispose();
pass('the wardrobe gives the hoodie back merged; the walker disposes its current copies');
console.log(`own walker merge: ${passed} checks passed`);
