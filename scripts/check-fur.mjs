import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {Cache,Texture,Vector3,Vector2} from 'three';
import {createFurColour} from '../src/walk/fur.js';
import {createDLCat} from '../src/vendor/cosmo/DLCat.js';
import {FUR_MASK,FUR_ATLAS_SHA,FUR_MASK_RUNS,FUR_MASK_SIZE} from '../src/walk/fur-mask.js';
import {FUR_COLOURS,cleanFur,savedFur,saveFur} from '../src/walk/fur-colours.js';
import {encodeRecord,encodeIdentity,assembleFrame,decodeFrame,WireReader,PROTOCOL,WIRE_VERSION} from '../src/walk/net/wire.js';

const source=await fs.readFile('src/vendor/cosmo/DLCat.js','utf8'),images=JSON.parse(source.match(/var images = (.*);/)[1]);
const bytes=Buffer.from(images[1].dataUri.split(',')[1],'base64');
assert.equal(createHash('sha256').update(bytes).digest('hex'),FUR_ATLAS_SHA,'Regenerate and inspect the mask after an atlas change');
const pixels=async input=>{const image=await loadImage(input),c=createCanvas(image.width,image.height),ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
const atlas=await pixels(bytes),mask=await pixels(FUR_MASK);assert.equal(mask.length,atlas.length);
assert.equal(FUR_MASK_SIZE[0]*FUR_MASK_SIZE[1],mask.length/4);
let offset=0,value=0;for(const length of FUR_MASK_RUNS){assert(Number.isInteger(length)&&length>=0);for(let i=0;i<length;i++)assert.equal(mask[(offset+i)*4],value,'Packed mask differs from the inspected image');offset+=length;value^=255;}assert.equal(offset,mask.length/4);
let fur=0,preserved=0;
for(let i=0;i<mask.length;i+=4){if(mask[i]){fur++;assert(atlas[i+2]>atlas[i+1]*1.5&&atlas[i+2]>atlas[i]*1.5,'Mask spilled onto non-blue detail');}else preserved++;}
assert(fur>600000&&preserved>400000,'Mask must contain the fur and preserve the face detail');
// Exercise the actual map replacement with the original decoded atlas and a native canvas.
const decoded=await loadImage(bytes);
globalThis.document={createElement(){throw Error('Default fur must not create or read a canvas');}};
const map=new Texture(decoded);map.name='body_BaseColor';const clothes=new Texture(decoded);clothes.name='clothes_BaseColor';
const peer=new Texture(decoded);peer.name='body_BaseColor';const asset=map=>({meshes:[{material:{map}},{material:{map:clothes}}]});
const set=createFurColour(asset(map)),setPeer=createFurColour(asset(peer));assert.equal(typeof set,'function','Default fur setup must be synchronous');set(0);setPeer(0);assert.equal(map.image,decoded);assert.equal(peer.image,decoded);
globalThis.document={createElement:()=>createCanvas(1,1)};
const read=image=>{const ctx=image.getContext('2d');return ctx.getImageData(0,0,image.width,image.height).data;};
for(let colour=1;colour<FUR_COLOURS.length;colour++){
 set(colour);const tinted=read(map.image);let changed=0;
 for(let i=0;i<mask.length;i+=4)if(!mask[i])assert.deepEqual(tinted.subarray(i,i+4),atlas.subarray(i,i+4),'Protected face pixel changed');else if(tinted[i]!==atlas[i])changed++;
 assert(changed>600000);assert.equal(peer.image,decoded);assert.equal(clothes.image,decoded);
}
setPeer(2);const peerImage=peer.image;set(0);assert.equal(map.image,decoded);assert.equal(peer.image,peerImage);
set(999);assert.equal(map.image,decoded);
Cache.enabled=true;for(const image of images)Cache.add('image:'+image.dataUri,await loadImage(image.dataUri));
const cat=await createDLCat({height:1.75}),eyes=cat.meshes.find(m=>m.name==='eyes'),skin=cat.meshes.find(m=>m.name==='body');
eyes.geometry.computeBoundingBox();const centre=eyes.geometry.boundingBox.getCenter(new Vector3()),p=skin.geometry.attributes.position,v=new Vector3(),furUV=new Vector2();let best=Infinity;
for(let i=0;i<p.count;i++){const d=v.fromBufferAttribute(p,i).distanceToSquared(centre);if(d<best){best=d;furUV.fromBufferAttribute(skin.geometry.attributes.uv,i);}}
const sample=uv=>mask[(Math.min(1023,Math.floor(uv.y*1024))*1024+Math.min(1023,Math.floor(uv.x*1024)))*4];
assert.equal(sample(furUV),255,'Hammock and catnip lids must follow the fur');
for(const name of ['nose','male_eyelash'])assert.equal(sample(new Vector2().fromBufferAttribute(cat.meshes.find(m=>m.name===name).geometry.attributes.uv,0)),0,'Catnip pink cheeks and dark mouth must stay unchanged');
cat.dispose();Cache.clear();Cache.enabled=false;delete globalThis.document;
const pose={pos:[12,-35.7,-42.98],yaw:-.7,grounded:true,stance:'stand'};
for(let colour=0;colour<FUR_COLOURS.length;colour++){
 for(const extras of [{},{stance:'crouch',jumpCount:2,jumpS:.2,rise:1,emote:'wave',rest:'lie',playing:true,ball:true}]){
  const frame=assembleFrame([encodeIdentity(7,'cat','Voyager',true,true)],[encodeRecord(7,{...pose,...extras,fur:colour})]),reader=new WireReader();
  assert.equal(reader.read(frame)[0].fur,colour);assert.equal(reader.read(frame)[0].hat,true);
  for(let n=0;n<frame.length;n++)assert.equal(decodeFrame(frame.subarray(0,n)),null,'Truncated frame accepted');
 }
}
for(const bad of [-1,5,255,1.5,'2',{},NaN,Infinity]){assert.equal(cleanFur(bad),0);assert.throws(()=>encodeRecord(0,{...pose,fur:bad}));}
const broken=assembleFrame([],[encodeRecord(1,pose)]);broken[broken.length-1]=255;assert.equal(decodeFrame(broken),null);
const old=assembleFrame([],[]);old[1]=5;assert.equal(decodeFrame(old),null);assert.equal(PROTOCOL,6);assert.equal(WIRE_VERSION,6);
let stored=null;globalThis.localStorage={getItem:()=>stored,setItem:(k,v)=>{stored=v;}};
assert.equal(savedFur(),0);assert(saveFur(3));assert.equal(savedFur(),3);stored='"3"';assert.equal(savedFur(),0);stored='invalid';assert.equal(savedFur(),0);
globalThis.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(savedFur(),0);assert.equal(saveFur(2),false);delete globalThis.localStorage;
console.log(`PASS fur: no default startup canvas, packed-mask parity, atlas pin, ${fur} masked / ${preserved} preserved texels, every colour and motion wire roundtrip, malformed/old frames and local storage`);
