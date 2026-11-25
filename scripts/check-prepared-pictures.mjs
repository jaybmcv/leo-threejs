// The prepared walk's pictures as lossless WebP (scripts/prepared-pictures.mjs), on small pictures made here: which it
// turns and which it leaves, the same pixels after (colour under transparent pixels included), and the phone build's
// picture scaling (build-phone-walk.mjs) the same from either. Usage: node scripts/check-prepared-pictures.mjs
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {webpPictures,plainPng,scalePicture} from './prepared-pictures.mjs';
import {encodePreparedWalk} from './encode-prepared-walk-v2.mjs';

let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
let seed=5;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const url=(type,b)=>'data:image/'+type+';base64,'+b.toString('base64'),bytesOf=u=>Buffer.from(u.slice(u.indexOf(',')+1),'base64');
const pixels=b=>sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});
// A painted sign: flat colour with lettering, the kind of canvas the walk paints (WebP wins on these).
function painted(w,h,{alpha=false,hidden=false}={}){const d=Buffer.alloc(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,ink=((x>>3)+(y>>3))%5===0;d[i]=ink?240:20+(y>>4);d[i+1]=ink?200:30;d[i+2]=ink?40:60+(x>>5);d[i+3]=alpha?(x<w/4?0:x<w/2?128:255):255;
  if(hidden&&d[i+3]===0){d[i]=rand(256);d[i+1]=rand(256);d[i+2]=rand(256);}}
 return d;}
const png=(w,h,o)=>sharp(painted(w,h,o),{raw:{width:w,height:h,channels:4}}).png().toBuffer();
// A chunk spliced in before IDAT (gAMA: browsers may apply it to a PNG and never to a WebP).
function withChunk(p,type,data){const at=p.indexOf('IDAT')-4,len=Buffer.alloc(4);len.writeUInt32BE(data.length);
 const crc=Buffer.alloc(4);crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type,'latin1'),data]))>>>0);
 return Buffer.concat([p.subarray(0,at),len,Buffer.from(type,'latin1'),data,crc,p.subarray(at)]);}

const opaque=await png(256,128),seeThrough=await png(200,120,{alpha:true,hidden:true}),gamma=withChunk(opaque,'gAMA',Buffer.from([0,0,0xb1,0x8f]));
const deep=await sharp(painted(64,64),{raw:{width:64,height:64,channels:4}}).png({force:true}).toColourspace('rgb16').toBuffer();
const jpeg=await sharp(painted(64,64),{raw:{width:64,height:64,channels:4}}).jpeg().toBuffer();
// EXIF (orientation 6: Chrome shows the PNG turned) and APNG animation control, which a WebP would drop.
const exif=withChunk(opaque,'eXIf',Buffer.from('4d4d002a000000080001011200030000000100060000000000','hex')),animated=withChunk(opaque,'acTL',Buffer.from([0,0,0,2,0,0,0,0]));
// Wider than WebP's 16,383 pixels: sharp would refuse it.
const wide=await sharp(Buffer.alloc(16384*4*3,90),{raw:{width:16384,height:4,channels:3}}).png().toBuffer();
assert.ok(plainPng(opaque)&&plainPng(seeThrough));assert.ok(!plainPng(gamma),'gAMA');assert.ok(!plainPng(deep),'16-bit');assert.ok(!plainPng(jpeg));
assert.ok(!plainPng(exif),'eXIf');assert.ok(!plainPng(animated),'acTL');assert.ok(!plainPng(wide),'16,384 wide');
const odd=[{uuid:'x',url:url('png',exif)},{uuid:'y',url:url('png',animated)},{uuid:'z',url:url('png',wide)}],oddBefore=structuredClone(odd);
assert.deepEqual(await webpPictures(odd),{pictures:3,turned:0,kept:3,pngBytes:0,webpBytes:0});assert.deepEqual(odd,oddBefore);
pass('only a plain 8-bit RGB or RGBA PNG is one to turn (a colour chunk, EXIF, animation, 16 bits, a side over 16,383 or another format is left)');

const images=[{uuid:'a',url:url('png',opaque)},{uuid:'b',url:url('png',seeThrough)},{uuid:'c',url:url('png',gamma)},{uuid:'d',url:url('png',deep)},{uuid:'e',url:url('jpeg',jpeg)},{uuid:'f',url:'pictures/f.png'},{uuid:'g',url:[url('png',opaque)]}];
const before=structuredClone(images),proof=await webpPictures(images);
assert.deepEqual(images.map(i=>typeof i.url==='string'?i.url.slice(0,15):'list'),['data:image/webp','data:image/webp','data:image/png;','data:image/png;','data:image/jpeg','pictures/f.png','list']);
assert.deepEqual(images.slice(2).map(i=>i.url),before.slice(2).map(i=>i.url),'the rest left as they were');
assert.equal(proof.pictures,4);assert.equal(proof.turned,2);assert.equal(proof.kept,2);assert.ok(proof.webpBytes<proof.pngBytes);
for(const k of [0,1]){const [x,y]=await Promise.all([pixels(bytesOf(before[k].url)),pixels(bytesOf(images[k].url))]);assert.deepEqual(x.info,y.info);assert.ok(x.data.equals(y.data),'pixels '+before[k].uuid);}
pass('a sign and a see-through picture turn to smaller WebP with the same pixels, colour under transparent pixels included');
const map={x:{uuid:'x',url:url('png',opaque)}};await webpPictures(map);assert.ok(map.x.url.startsWith('data:image/webp'));
const again=await webpPictures(images);assert.equal(again.pictures,2);assert.equal(again.turned,0);
pass('pictures kept by uuid are turned too, and a second pass leaves WebP alone');

// The phone build scales pictures down. sharp shrinks a WebP or JPEG while decoding unless told not to, which changes
// its pixels; with that off, the same picture scales to the same pixels from its PNG and its WebP.
for(const source of [opaque,seeThrough]){const webp=await sharp(source).webp({lossless:true,exact:true}).toBuffer();
 const [a,b]=await Promise.all([scalePicture(source,.5),scalePicture(webp,.5)]);const [x,y]=await Promise.all([pixels(a.data),pixels(b.data)]);
 assert.deepEqual([x.info.width,x.info.height],[y.info.width,y.info.height]);assert.ok(x.data.equals(y.data),'scaled pixels');}
pass('the phone build scales a picture to the same pixels from its PNG or its WebP');
// A whole build reuses the last prepared walk when its inputs are unchanged, and the encoder keeps an encoded walk as it
// is: one encoded before its pictures were gets them turned in its metadata, its integrity and record following.
{const dir='output/phase3b/startup/pictures-fixture',sha=b=>createHash('sha256').update(b).digest('hex');await fs.rm(dir,{recursive:true,force:true});await fs.mkdir(dir,{recursive:true});
 const manifest={geometryEncoding:'lossless-meshopt-typed-arrays',vertexPoolVersion:1,collisionPackVersion:1,tupleCodecVersion:1,images:[{uuid:'a',url:url('png',opaque)},{uuid:'c',url:url('png',gamma)}]};
 const world=zlib.zstdCompressSync(Buffer.from(JSON.stringify(manifest))),part=Buffer.from('geometry stays');await fs.writeFile(dir+'/world.bin',world);await fs.writeFile(dir+'/geometry-0.bin',part);
 await fs.writeFile(dir+'/complete.json',JSON.stringify({status:'PASS',compressedBytes:world.length+part.length,metadataBytes:9}));
 await fs.writeFile(dir+'/integrity.json',JSON.stringify({sha256:'old',files:['geometry-0.bin','world.bin'],sourceInputs:{kept:1}}));
 const complete=await encodePreparedWalk(dir),after=JSON.parse(zlib.zstdDecompressSync(await fs.readFile(dir+'/world.bin'))),integrity=JSON.parse(await fs.readFile(dir+'/integrity.json'));
 assert.ok(after.images[0].url.startsWith('data:image/webp'));assert.equal(after.images[1].url,manifest.images[1].url);assert.equal(complete.pictureProof.turned,1);
 assert.deepEqual(JSON.parse(await fs.readFile(dir+'/complete.json')),complete);assert.equal(complete.compressedBytes,(await fs.stat(dir+'/world.bin')).size+part.length);
 const hash=createHash('sha256');for(const n of ['geometry-0.bin','world.bin']){hash.update(n);hash.update(await fs.readFile(dir+'/'+n));}assert.equal(integrity.sha256,hash.digest('hex'));
 assert.deepEqual(integrity.sourceInputs,{kept:1});assert.ok((await fs.readFile(dir+'/geometry-0.bin')).equals(part));
 const bytes=await fs.readFile(dir+'/world.bin');assert.deepEqual(await encodePreparedWalk(dir),complete);assert.ok((await fs.readFile(dir+'/world.bin')).equals(bytes),'a second run leaves it');await fs.rm(dir,{recursive:true,force:true});
 pass('a walk encoded before its pictures were gets them turned, its integrity and record following, and only once');}
console.log('prepared pictures: '+checks+' checks passed');
