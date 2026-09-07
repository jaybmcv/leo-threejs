import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createShip,CABINS,DECKS,SPEC,ROUTE,COMMONS} from '../src/model.js';

const out=path.resolve('output/leo-interior-v01');await fs.mkdir(out,{recursive:true});
// Browser-compatible FileReader adapter for the exporter's Blob use in Node.
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.({target:this});}).catch(e=>this.onerror?.(e));}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.({target:this});}).catch(e=>this.onerror?.(e));}};
const ship=createShip();ship.inside.visible=true;ship.detail.root.visible=false;
ship.root.traverse(o=>{if(o.isMesh)o.geometry.normalizeNormals();});
const exporter=new GLTFExporter();
for(const [name,root] of [['leo-full-ship',ship.root],['leo-exterior',ship.exterior],['leo-neighborhood',ship.detail.root]]){
  root.visible=true;
  const data=await exporter.parseAsync(root,{binary:true,onlyVisible:true});
  await fs.writeFile(path.join(out,`${name}.glb`),Buffer.from(data));
  console.log(`${name}.glb: ${(data.byteLength/1048576).toFixed(2)} MB`);
}
await fs.writeFile(path.join(out,'cabin-schedule.csv'),'id,neighborhood,deck,x_m,floor_y_m,z_m,envelope_width_m,envelope_depth_m,envelope_height_m,berths\n'+CABINS.map(c=>[c.id,c.neighborhood,c.deck,c.x.toFixed(2),c.y.toFixed(2),c.z.toFixed(2),c.width,c.depth,c.height,c.berths].join(',')).join('\n')+'\n');
await fs.writeFile(path.join(out,'design-data.json'),JSON.stringify({spec:SPEC,decks:DECKS,commons:COMMONS,route:ROUTE},null,2));
const result=await build({entryPoints:['src/viewer.js'],bundle:true,minify:true,format:'iife',write:false,target:'es2022',legalComments:'eof'});
const html=(await fs.readFile('src/viewer.html','utf8')).replace('/* BUNDLE */',()=>result.outputFiles[0].text.replaceAll('</script','<\\/script'));
await fs.writeFile(path.join(out,'index.html'),html);await fs.copyFile('README.md',path.join(out,'README.md'));
await fs.copyFile('node_modules/three/LICENSE',path.join(out,'THREE-LICENSE.txt'));
await fs.mkdir(path.join(out,'comparison'),{recursive:true});
for(const view of ['top','concept','side'])await fs.copyFile(`output/leo-exterior-v30/renders/exterior-${view}-shape.png`,path.join(out,`comparison/exterior-v30-${view}.png`));
await fs.copyFile('src/comparison.html',path.join(out,'comparison.html'));
await fs.copyFile('concepts/v05/user-reference.png',path.join(out,'reference.png'));
await fs.copyFile('concepts/v15/video-target.png',path.join(out,'video-target.png'));
await import('./check-top-plan.mjs');
for(const name of ['reference-review','annotation-review','shape-guide'])await fs.copyFile(path.join(out,'top-plan-review.html'),path.join(out,name+'.html'));
console.log(`Offline viewer: ${path.join(out,'index.html')}`);
