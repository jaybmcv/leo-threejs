// A labelled grid of images: a baseline set, or one area's screenshot beside its concept options.
//   node scripts/atrium-contact-sheet.mjs <out.jpg> <columns> <image>...
// Each tile is labelled with its file name.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createCanvas,loadImage} from '@napi-rs/canvas';
const [out,cols,...files]=process.argv.slice(2);
const columns=Number(cols);
if(!out||!Number.isInteger(columns)||columns<1||!files.length)throw Error('Usage: atrium-contact-sheet.mjs <out.jpg> <columns> <image>...');
const TILE_W=640,LABEL_H=28,GAP=6;
const images=await Promise.all(files.map(f=>loadImage(f)));
const tileH=Math.round(TILE_W*images[0].height/images[0].width),rows=Math.ceil(images.length/columns);
const canvas=createCanvas(columns*(TILE_W+GAP)+GAP,rows*(tileH+LABEL_H+GAP)+GAP),g=canvas.getContext('2d');
g.fillStyle='#111';g.fillRect(0,0,canvas.width,canvas.height);g.font='18px sans-serif';g.textBaseline='middle';
images.forEach((img,i)=>{
 const x=GAP+(i%columns)*(TILE_W+GAP),y=GAP+Math.floor(i/columns)*(tileH+LABEL_H+GAP);
 g.fillStyle='#ddd';g.fillText(path.basename(files[i]).replace(/\.\w+$/,''),x+4,y+LABEL_H/2);
 g.drawImage(img,x,y+LABEL_H,TILE_W,tileH);
});
await fs.writeFile(out,canvas.toBuffer('image/jpeg',85));
console.log(out,canvas.width+'x'+canvas.height);
