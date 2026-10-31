import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import layout from 'v2-layout';
import {guideSchedule,lobbySchedule} from './wayfinding-guide-data.js';
// Additional information only. The existing 283 v2 stair/lift sign placements,
// signPlace(), lift doors, collision geometry and prepared sign cache stay intact.
export function addWayfindingGuides(parent){
 // main.js assigns live objects to a band using position.y. Each deck needs
 // its own floor-height root and local geometry, just like a furnished room.
 const roots=new Map(layout.decks.map(d=>{const g=new T.Group();g.name='V2_wayfinding_guides_deck_'+d.number;g.position.y=d.y;g.userData={noCollide:true,deck:d.number};parent.add(g);return [d.number,g];}));
 const guides=guideSchedule(layout),lobbies=lobbySchedule(layout),paint=[];
 const fit=(c,text,x,y,width,size=28)=>{while(size>12){c.font='600 '+size+'px sans-serif';if(c.measureText(text).width<=width)break;size--;}c.fillText(text,x,y);};
 // One atlas per deck for all room plaques: one draw per deck, independent of room count.
 for(const d of layout.decks){const root=roots.get(d.number),rows=guides.filter(g=>g.deck===d.number),cols=2,cellW=512,cellH=112,canvas=document.createElement('canvas');canvas.width=cellW*cols;canvas.height=Math.max(1,Math.ceil(rows.length/cols))*cellH;const c=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const draw=()=>{c.fillStyle='#10252e';c.fillRect(0,0,canvas.width,canvas.height);rows.forEach((r,i)=>{const x=i%cols*cellW,y=Math.floor(i/cols)*cellH;c.fillStyle='#2fd6c5';fit(c,r.youAreHere,x+18,y+34,cellW-36,22);c.fillStyle='#f5ddba';fit(c,r.label,x+18,y+79,cellW-36,30);});texture.needsUpdate=true;};draw();paint.push(draw);
  const planes=rows.map((r,i)=>{const g=new T.PlaneGeometry(r.width,.55),uv=g.attributes.uv,col=i%cols,row=Math.floor(i/cols),count=Math.ceil(rows.length/cols);for(let j=0;j<uv.count;j++)uv.setXY(j,(col+uv.getX(j))/cols,1-(row+1-uv.getY(j))/count);g.rotateY(r.yaw).translate(r.at[0],r.at[1]-d.y,r.at[2]);return g;});
  if(planes.length){const m=new T.Mesh(mergeGeometries(planes),new T.MeshBasicMaterial({map:texture,toneMapped:false}));m.name='V2_corridor_room_guides';m.userData={noCollide:true,deck:d.number,labels:rows.map(r=>({id:r.id,label:r.label,youAreHere:r.youAreHere,corridor:r.corridor}))};root.add(m);for(const g of planes)g.dispose();}
  const arrows=rows.map(r=>{const dx=r.to[0]-r.from[0],dz=r.to[2]-r.from[2],length=Math.hypot(dx,dz),g=new T.ShapeGeometry(new T.Shape([new T.Vector2(0,.20),new T.Vector2(length,0),new T.Vector2(0,-.20),new T.Vector2(.15,0)]));g.rotateX(-Math.PI/2).rotateY(-Math.atan2(dz,dx)).translate(r.from[0],r.from[1]-d.y,r.from[2]);return g;});
  if(arrows.length){const m=new T.Mesh(mergeGeometries(arrows),new T.MeshBasicMaterial({color:0x2fd6c5,toneMapped:false}));m.name='V2_floor_guides';m.userData={noCollide:true,deck:d.number,destinations:rows.map(r=>r.id)};root.add(m);for(const g of arrows)g.dispose();}
 }
 for(const row of lobbies){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=300;const c=canvas.getContext('2d'),texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const draw=()=>{c.fillStyle='#10252e';c.fillRect(0,0,1024,300);c.fillStyle='#2fd6c5';fit(c,row.youAreHere,20,30,984,24);row.rows.forEach((text,i)=>{c.fillStyle=text.startsWith('Deck '+row.deck+' ·')?'#ffb578':'#f5ddba';fit(c,text,i<10?20:526,58+i%10*22,478,18);});c.fillStyle='#2fd6c5';fit(c,row.note,20,289,984,19);texture.needsUpdate=true;};draw();paint.push(draw);
  const m=new T.Mesh(new T.PlaneGeometry(3.6,1.05),new T.MeshBasicMaterial({map:texture,toneMapped:false}));m.name='V2_lobby_deck_directory';m.position.set(row.at[0],row.at[1]-layout.decks[row.deck-1].y,row.at[2]);m.rotation.y=row.yaw;m.userData={...row,noCollide:true};roots.get(row.deck).add(m);
 }
 globalThis.document.fonts?.ready.then(()=>{for(const draw of paint)draw();});return [...roots.values()];
}
