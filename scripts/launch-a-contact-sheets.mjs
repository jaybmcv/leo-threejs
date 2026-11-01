import fs from 'node:fs/promises';
import {createCanvas,loadImage} from '@napi-rs/canvas';
const out='output/launch-a',before=out+'/before-exact-distance',after=out+'/complete-distance';
const rows=JSON.parse(await fs.readFile(after+'/distance.json')).rows;
const links=['# Native moving-view captures','','All are 1280 × 720 screenshots from native D3D11 rendering. The contact sheets scale these originals without altering scene content.','','| Deck | Direction | Motion | Distance | Before | After |','|---|---|---|---:|---|---|'];
for(const r of rows)links.push('| '+r.deck+' | '+(r.side<0?'aft':'bow')+' | '+r.direction+' | '+r.distance+' m | [PNG](before-exact-distance/'+r.file+') | [PNG](complete-distance/'+r.file+') |');
for(const deck of[3,6])for(const side of[-1,1])for(const direction of['approach','recede']){
 const selected=rows.filter(r=>r.deck===deck&&r.side===side&&r.direction===direction),w=320,h=180,label=28,canvas=createCanvas(w*selected.length,2*(h+label)+45),ctx=canvas.getContext('2d');
 ctx.fillStyle='#10202a';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#eef5f7';ctx.font='bold 18px Arial';ctx.fillText('Deck '+deck+' · '+(side<0?'aft':'bow')+' · '+direction+' · BEFORE / AFTER',12,28);
 for(let k=0;k<2;k++)for(let i=0;i<selected.length;i++){const r=selected[i],im=await loadImage((k?after:before)+'/'+r.file),y=45+k*(h+label);ctx.drawImage(im,i*w,y,w,h);ctx.fillStyle='#eef5f7';ctx.font='14px Arial';ctx.fillText((k?'After':'Before')+' · '+r.distance+' m',i*w+10,y+h+20);}
 const file='contact-d'+deck+'-'+(side<0?'aft':'bow')+'-'+direction+'.png';await fs.writeFile(out+'/'+file,canvas.toBuffer('image/png'));
}
await fs.writeFile(out+'/image-index.md',links.join('\n')+'\n');
console.log('Wrote 8 comparison contact sheets and index of '+rows.length*2+' originals');
