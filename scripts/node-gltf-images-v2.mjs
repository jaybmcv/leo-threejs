import {loadImage} from '@napi-rs/canvas';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// A real image decoder for geometry audits of embedded-texture GLBs in Node.
export async function parseNodeTexturedGLB(bytes){
 const previousSelf=globalThis.self,previousBitmap=globalThis.createImageBitmap;
 try{
  globalThis.self={URL:globalThis.URL};
  globalThis.createImageBitmap=async blob=>loadImage(Buffer.from(await blob.arrayBuffer()));
  const parsed=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const textures=parsed.parser.json.textures||[];for(let i=0;i<textures.length;i++){const image=await parsed.parser.getDependency('texture',i);if(!image?.image?.width||!image?.image?.height)throw Error('Embedded GLB image did not decode: '+i);}
  return parsed;
 }finally{if(previousSelf===undefined)delete globalThis.self;else globalThis.self=previousSelf;if(previousBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=previousBitmap;}
}
