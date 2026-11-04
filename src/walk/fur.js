import {FUR_MASK_RUNS,FUR_MASK_SIZE} from './fur-mask.js';
import {FUR_COLOURS,cleanFur} from './fur-colours.js';

let mask;
const variants=new WeakMap();
const canvasOf=image=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;return c;};
// The default cat needs no image decode or canvas readback during startup.
function furMask(){
 if(mask)return mask;
 const data=new Uint8Array(FUR_MASK_SIZE[0]*FUR_MASK_SIZE[1]);let offset=0,value=0;
 for(const length of FUR_MASK_RUNS){if(value)data.fill(1,offset,offset+length);offset+=length;value^=1;}
 return mask=data;
}
// Only decoded images are shared. Each avatar keeps ownership of its own map and material.
export function createFurColour(asset){
 const maps=[...new Set(asset.meshes.flatMap(m=>(Array.isArray(m.material)?m.material:[m.material]).map(m=>m.map)).filter(m=>m?.name==='body_BaseColor'))];
 const originals=maps.map(m=>m.image);let selected=0;
 return value=>{
  const next=cleanFur(value);if(next===selected)return;selected=next;
  const coverage=next?furMask():null;
  maps.forEach((map,i)=>{
   const source=originals[i];let choices=variants.get(source);if(!choices){choices=new Map([[0,source]]);variants.set(source,choices);}
   if(!choices.has(next)){
    const out=canvasOf(source),context=out.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0);
    const pixels=context.getImageData(0,0,out.width,out.height),rgb=FUR_COLOURS[next].rgb;
    if(out.width!==FUR_MASK_SIZE[0]||out.height!==FUR_MASK_SIZE[1])throw Error('Cosmo fur mask does not fit its atlas');
    for(let p=0;p<pixels.data.length;p+=4)if(coverage[p/4]){const shade=pixels.data[p+2]/FUR_COLOURS[0].rgb[2];
     for(let k=0;k<3;k++)pixels.data[p+k]=rgb[k]*shade;}
    context.putImageData(pixels,0,0);choices.set(next,out);
   }
   map.image=choices.get(next);map.needsUpdate=true;
  });
 };
}
