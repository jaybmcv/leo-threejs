import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import * as T from 'three';
import {sharePlaques} from '../src/walk/plaque-atlas.js';

// The deck plaques' shared sheet (src/walk/plaque-atlas.js), without a GPU: every plaque shows its own picture's pixels
// from the sheet, a geometry two plaques share moves once, other signs keep their pictures, and a repaint reaches the sheet.
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
globalThis.document={createElement:()=>createCanvas(1,1)};
const picture=shade=>{const canvas=createCanvas(256,320),c=canvas.getContext('2d');c.fillStyle=`rgb(${shade},${255-shade},40)`;c.fillRect(0,0,256,320);c.fillStyle='#fff';c.fillRect(shade%200,20+shade%90,30,40);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;};
const plaque=(t,geometry=new T.PlaneGeometry(.42,.525))=>new T.Mesh(geometry,new T.MeshBasicMaterial({name:'Walk_deck_plaque',map:t,toneMapped:false}));
const pixels=(canvas,x,y,w,h)=>Buffer.from(canvas.getContext('2d').getImageData(x,y,w,h).data);
// The sheet's pixels under a plaque's four texture coordinates.
const shown=o=>{const uv=o.geometry.attributes.uv,image=o.material.map.image;let u0=1,v0=1,u1=0,v1=0;for(let i=0;i<4;i++){u0=Math.min(u0,uv.getX(i));u1=Math.max(u1,uv.getX(i));v0=Math.min(v0,uv.getY(i));v1=Math.max(v1,uv.getY(i));}
 return pixels(image,Math.round(u0*image.width),Math.round((1-v1)*image.height),Math.round((u1-u0)*image.width),Math.round((v1-v0)*image.height));};

{const group=new T.Group(),pictures=Array.from({length:10},(_,i)=>picture(i*23)),plaques=pictures.map(t=>plaque(t));
 const again=plaque(pictures[3]),twin=plaque(pictures[7],plaques[7].geometry);plaques.push(again,twin);
 const display=new T.Mesh(new T.PlaneGeometry(.44,.165),new T.MeshBasicMaterial({map:new T.CanvasTexture(createCanvas(256,96))})),before=display.material;
 for(const o of [...plaques,display])group.add(o);
 const own=plaques.map(o=>pixels(o.material.map.image,0,0,256,320));
 assert.deepEqual(sharePlaques(group),{pictures:10,plaques:12,size:[2048,640]});
 const sheet=plaques[0].material;assert(plaques.every(o=>o.material===sheet)&&sheet.map!==pictures[0]&&sheet.name==='Walk_deck_plaque');
 assert.equal(sheet.map.colorSpace,T.SRGBColorSpace);assert.equal(sheet.map.anisotropy,4);pass('every plaque shares one sheet, with its pictures\' colour space and anisotropy');
 assert.equal(display.material,before);pass('a sign that is not a deck plaque keeps its own picture');
 for(const [i,o] of plaques.entries())assert(shown(o).equals(own[i]),'plaque '+i+' shows another picture');pass('each plaque shows its own pixels from the sheet, a geometry two share included');
 const c=pictures[5].image.getContext('2d'),version=sheet.map.version;c.fillStyle='#123456';c.fillRect(0,0,256,320);pictures[5].needsUpdate=true;
 assert(sheet.map.version>version);assert(shown(plaques[5]).equals(pixels(pictures[5].image,0,0,256,320)));pass('a plaque\'s repaint is copied into the sheet');}
{const group=new T.Group(),t=picture(9),a=plaque(t),b=plaque(t);group.add(a,b);
 assert.equal(sharePlaques(group),null);assert.equal(a.material.map,t);pass('one picture alone is left as it is');}
console.log(`plaque atlas: ${checks} checks passed`);
