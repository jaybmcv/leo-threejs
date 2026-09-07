import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { Box3 } from 'three';
import { createShuttle } from '../src/reference-shuttle/model.js';
import { createCanvas, ImageData } from '@napi-rs/canvas';
const out = path.resolve('output/leo-reference');
await fs.mkdir(out,{recursive:true});
// Native canvas support lets GLTFExporter embed procedural DataTextures as PNGs.
globalThis.ImageData=ImageData;
globalThis.OffscreenCanvas=class {
  constructor(width,height){this.canvas=createCanvas(width,height);}
  get width(){return this.canvas.width;} set width(value){this.canvas.width=value;}
  get height(){return this.canvas.height;} set height(value){this.canvas.height=value;}
  getContext(type,options){return this.canvas.getContext(type,options);}
  async convertToBlob(){return new Blob([this.canvas.toBuffer('image/png')],{type:'image/png'});}
};
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => {this.result=result;this.onloadend?.({target:this});}).catch(e=>this.onerror?.(e)); }
  readAsDataURL(blob) {blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.({target:this});}).catch(e=>this.onerror?.(e));}
};
const modelStart=performance.now();
const ship = createShuttle();
const modelBuildMs=Math.round(performance.now()-modelStart);
let meshes=0, triangles=0;
ship.traverse(o=>{if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position;for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))throw new Error(`Invalid vertex: ${o.name}`);triangles+=(o.geometry.index?.count||p.count)/3;});
const bounds=new Box3().setFromObject(ship);
const glb=await new GLTFExporter().parseAsync(ship,{binary:true});
await fs.writeFile(path.join(out,'leo-shuttle.glb'),Buffer.from(glb));
const result=await build({entryPoints:['src/reference-shuttle/viewer.js'],bundle:true,minify:true,format:'iife',write:false,target:'es2022',legalComments:'eof'});
const html=(await fs.readFile('src/reference-shuttle/index.html','utf8')).replace('/* BUNDLE */',()=>result.outputFiles[0].text.replaceAll('</script','<\\/script'));
await fs.writeFile(path.join(out,'index.html'),html);
await fs.copyFile('src/reference-shuttle/assets/full-reference.png',path.join(out,'reference.png'));
await fs.copyFile('src/reference-shuttle/assets/saucer-reference.png',path.join(out,'saucer-reference.png'));
await fs.copyFile('node_modules/three/LICENSE',path.join(out,'THREE-LICENSE.txt'));
await fs.copyFile('src/reference-shuttle/README.md',path.join(out,'README.md'));
const validator=await import('gltf-validator');
const validation=await validator.validateBytes(new Uint8Array(glb),{uri:'leo-shuttle.glb'});
const report={modelBuildMs,meshes,triangles,saucer:ship.userData.saucer,tailFairing:ship.userData.tailFairing,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},glbBytes:glb.byteLength,validation:validation.issues};
await fs.writeFile(path.join(out,'validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,validation:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings,infos:validation.issues.numInfos}},null,2));
if(validation.issues.numErrors)process.exitCode=1;
console.log(`Viewer: ${out}/index.html`);
