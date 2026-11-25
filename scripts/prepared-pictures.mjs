// The prepared walk's pictures (painted canvases: signs, murals, screens, labels) travel as data URLs inside its
// metadata, which every visitor downloads before the ship's geometry. As PNG they were 13 of its 18.8 MB; the same
// pixels as lossless WebP are about a third of that (356 pictures: 15.5 MB as PNG, 4.4 MB as WebP), and every browser
// the walk runs in decodes either from a data URL (three's ObjectLoader reads both alike).
// Only a plain 8-bit RGB or RGBA PNG is turned (no colour profile, gamma or other colour chunk a browser might apply to
// one format and not the other), only when the WebP is smaller, and only once it is proven to decode to exactly the PNG's
// pixels, colour under transparent pixels included (`exact`). Anything else stays as it was.
import sharp from 'sharp';

const PNG_URL='data:image/png;base64,',SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const COLOUR_CHUNKS=new Set(['iCCP','gAMA','sRGB','cHRM','sBIT','cICP','mDCv','cLLi','PLTE','tRNS']);
// Whether a PNG is one this may turn: 8 bits a channel, RGB or RGBA, no colour chunk.
export function plainPng(png){
 if(png.length<33||!png.subarray(0,8).equals(SIGNATURE)||png.toString('latin1',12,16)!=='IHDR')return false;
 const depth=png[24],type=png[25],interlace=png[28];if(depth!==8||(type!==2&&type!==6)||interlace!==0)return false;
 for(let at=8;at+8<=png.length;){const length=png.readUInt32BE(at),chunk=png.toString('latin1',at+4,at+8);if(COLOUR_CHUNKS.has(chunk))return false;if(chunk==='IEND')return true;at+=12+length;}
 return false;
}
const pixels=bytes=>sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
/** Turns the PNG pictures of a prepared walk's `images` (an array or an object of {uuid,url}) into lossless WebP, in
 * place. Resolves with what it did: {pictures (PNG data URLs seen), turned, kept, pngBytes, webpBytes (of those turned)}. */
export async function webpPictures(images,{effort=6}={}){
 const proof={pictures:0,turned:0,kept:0,pngBytes:0,webpBytes:0};
 await Promise.all(Object.values(images||{}).map(async image=>{
  if(typeof image?.url!=='string'||!image.url.startsWith(PNG_URL))return;
  proof.pictures++;const png=Buffer.from(image.url.slice(PNG_URL.length),'base64');
  if(!plainPng(png)){proof.kept++;return;}
  const webp=await sharp(png).webp({lossless:true,exact:true,effort}).toBuffer();
  if(webp.length>=png.length){proof.kept++;return;}
  const [a,b]=await Promise.all([pixels(png),pixels(webp)]);
  if(a.info.width!==b.info.width||a.info.height!==b.info.height||a.info.channels!==b.info.channels||!a.data.equals(b.data)){proof.kept++;return;}
  image.url='data:image/webp;base64,'+webp.toString('base64');proof.turned++;proof.pngBytes+=png.length;proof.webpBytes+=webp.length;
 }));
 return proof;
}

/** A picture scaled by `scale` (none below `least` pixels a side) for the phone ship (build-phone-walk.mjs), as JPEG if it
 * was one and as PNG otherwise; null if it is no bigger than that already. sharp shrinks a WebP or JPEG while decoding it
 * unless told not to, with a coarser filter: a picture turned to WebP above would come out of it with other pixels than
 * its PNG did, so the whole of the scaling is left to the resize, as it always was for a PNG (the same bytes from one; the nine pictures that were WebP already, in November
 * 2026, now scale that way too). */
export async function scalePicture(bytes,scale,least=16){
 const picture=sharp(bytes),{width,height,format}=await picture.metadata(),w=Math.max(least,Math.round(width*scale)),h=Math.max(least,Math.round(height*scale));
 if(w>=width&&h>=height)return null;const type=format==='jpeg'?'jpeg':'png';
 return {data:await picture.resize(w,h,{fit:'fill',fastShrinkOnLoad:false})[type]().toBuffer(),type,width,height,w,h};
}
