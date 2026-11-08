import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import layout from '../plan/selected-layout.js';
import {guideSchedule,lobbySchedule} from './wayfinding-guide-data.js';
// The distribution ceiling's underside is 3.64 m above each deck.
const DIRECTORY_WIDTH=3.6,DIRECTORY_HEIGHT=1.05,DIRECTORY_CEILING_HEIGHT=3.64,BACKGROUND='#10252e';
const directoryBacking=new T.MeshBasicMaterial({color:0x10252e,toneMapped:false}),directorySupport=new T.MeshStandardMaterial({color:0x586e7b,metalness:.55,roughness:.4});
// Each picture (a deck's room plaques, a lobby board) is a w×h block of a page: a canvas, its texture and one material.
// Without `size` every block is a page of its own. With it, the blocks (all one width) fill the columns of pages at most
// `size` square, tallest first, so every deck's plaques and boards share a few materials and src/v2/phone-bands.js draws
// them for all decks at once: the open atrium shows fifteen decks and drew each one's plaques and board apart, 30 draws.
function placePictures(blocks,size){
 const pages=[];
 if(size){
  const width=blocks[0]?.w,count=Math.floor(size/width);if(blocks.some(b=>b.w!==width))throw Error('Wayfinding pictures must share one width');
  for(const b of [...blocks].sort((a,b)=>b.h-a.h)){
   let page=pages.find(p=>Math.min(...p.columns)+b.h<=size);if(!page)pages.push(page={columns:new Array(count).fill(0)});
   const c=page.columns.indexOf(Math.min(...page.columns));Object.assign(b,{page,x:c*width,y:page.columns[c]});page.columns[c]+=b.h;
  }
  for(const p of pages){p.w=p.columns.filter(h=>h>0).length*width;p.h=Math.max(...p.columns);}
 }else for(const b of blocks){const page={w:b.w,h:b.h};pages.push(page);Object.assign(b,{page,x:0,y:0});}
 for(const p of pages){
  p.canvas=document.createElement('canvas');p.canvas.width=p.w;p.canvas.height=p.h;
  // Mipmaps blend a block's edge with whatever lies beyond it: let that be the blocks' own background.
  const c=p.canvas.getContext('2d');c.fillStyle=BACKGROUND;c.fillRect(0,0,p.w,p.h);
  p.texture=new T.CanvasTexture(p.canvas);p.texture.colorSpace=T.SRGBColorSpace;p.material=new T.MeshBasicMaterial({name:'V2_wayfinding_page',map:p.texture,toneMapped:false});
 }
}
// Paints a block's picture into its area of its page.
function paintBlock(b,draw){const c=b.page.canvas.getContext('2d');c.save();c.translate(b.x,b.y);c.beginPath();c.rect(0,0,b.w,b.h);c.clip();draw(c);c.restore();b.page.texture.needsUpdate=true;}
// Moves texture coordinates from the block (0 to 1 across it, v up) into its page.
function intoPage(b,uv){for(let i=0;i<uv.count;i++)uv.setXY(i,(b.x+uv.getX(i)*b.w)/b.page.w,1-(b.y+(1-uv.getY(i))*b.h)/b.page.h);}
// Additional information only. The existing 283 v2 stair/lift sign placements,
// signPlace(), lift doors, collision geometry and prepared sign cache stay intact.
// `pageSize`: share pictures across decks in pages of at most that size (see placePictures); 0 keeps one per picture.
export function addWayfindingGuides(parent,{pageSize=0}={}){
 // main.js assigns live objects to a band using position.y. Each deck needs
 // its own floor-height root and local geometry, just like a furnished room.
 const roots=new Map(layout.decks.map(d=>{const g=new T.Group();g.name='V2_wayfinding_guides_deck_'+d.number;g.position.y=d.y;g.userData={noCollide:true,deck:d.number};parent.add(g);return [d.number,g];}));
 const guides=guideSchedule(layout),lobbies=lobbySchedule(layout),paint=[];
 const fit=(c,text,x,y,width,size=28)=>{while(size>12){c.font='600 '+size+'px sans-serif';if(c.measureText(text).width<=width)break;size--;}c.fillText(text,x,y);};
 // All of a deck's room plaques are one block, two cells wide: one draw per deck, independent of room count.
 const cols=2,cellW=512,cellH=112,decks=new Map(),boards=new Map();
 for(const d of layout.decks){const rows=guides.filter(g=>g.deck===d.number);if(rows.length)decks.set(d.number,{rows,w:cellW*cols,h:Math.ceil(rows.length/cols)*cellH});}
 for(const row of lobbies)boards.set(row,{w:1024,h:300});
 placePictures([...decks.values(),...boards.values()],pageSize);
 for(const d of layout.decks){const root=roots.get(d.number),b=decks.get(d.number),rows=b?b.rows:[];
  if(b){
   const draw=()=>paintBlock(b,c=>{c.fillStyle=BACKGROUND;c.fillRect(0,0,b.w,b.h);rows.forEach((r,i)=>{const x=i%cols*cellW,y=Math.floor(i/cols)*cellH;c.fillStyle='#2fd6c5';fit(c,r.youAreHere,x+18,y+34,cellW-36,22);c.fillStyle='#f5ddba';fit(c,r.label,x+18,y+79,cellW-36,30);});});draw();paint.push(draw);
   const count=Math.ceil(rows.length/cols),planes=rows.map((r,i)=>{const g=new T.PlaneGeometry(r.width,.55),uv=g.attributes.uv,col=i%cols,row=Math.floor(i/cols);for(let j=0;j<uv.count;j++)uv.setXY(j,(col+uv.getX(j))/cols,1-(row+1-uv.getY(j))/count);intoPage(b,uv);g.rotateY(r.yaw).translate(r.at[0],r.at[1]-d.y,r.at[2]);return g;});
   const m=new T.Mesh(mergeGeometries(planes),b.page.material);m.name='V2_corridor_room_guides';m.userData={noCollide:true,deck:d.number,labels:rows.map(r=>({id:r.id,label:r.label,youAreHere:r.youAreHere,corridor:r.corridor}))};root.add(m);for(const g of planes)g.dispose();
  }
  const arrows=rows.map(r=>{const dx=r.to[0]-r.from[0],dz=r.to[2]-r.from[2],length=Math.hypot(dx,dz),g=new T.ShapeGeometry(new T.Shape([new T.Vector2(0,.20),new T.Vector2(length,0),new T.Vector2(0,-.20),new T.Vector2(.15,0)]));g.rotateX(-Math.PI/2).rotateY(-Math.atan2(dz,dx)).translate(r.from[0],r.from[1]-d.y,r.from[2]);return g;});
  if(arrows.length){const m=new T.Mesh(mergeGeometries(arrows),new T.MeshBasicMaterial({color:0x2fd6c5,toneMapped:false}));m.name='V2_floor_guides';m.userData={noCollide:true,deck:d.number,destinations:rows.map(r=>r.id)};root.add(m);for(const g of arrows)g.dispose();}
 }
 for(const row of lobbies){const b=boards.get(row);
  const draw=()=>paintBlock(b,c=>{c.fillStyle=BACKGROUND;c.fillRect(0,0,1024,300);c.fillStyle='#2fd6c5';fit(c,row.youAreHere,20,30,984,24);row.rows.forEach((text,i)=>{c.fillStyle=text.startsWith('Deck '+row.deck+' ·')?'#ffb578':'#f5ddba';fit(c,text,i<10?20:526,58+i%10*22,478,18);});c.fillStyle='#2fd6c5';fit(c,row.note,20,289,984,19);});draw();paint.push(draw);
  const deck=layout.decks[row.deck-1],top=DIRECTORY_HEIGHT/2,postHeight=DIRECTORY_CEILING_HEIGHT-(row.at[1]-deck.y)-top;
  const board=new T.Group();board.name='V2_lobby_deck_directory';board.position.set(row.at[0],row.at[1]-deck.y,row.at[2]);board.rotation.y=row.yaw;board.userData={...row,noCollide:true,readableFaces:2};roots.get(row.deck).add(board);
  const backing=new T.Mesh(new T.BoxGeometry(DIRECTORY_WIDTH,DIRECTORY_HEIGHT,.04),directoryBacking);backing.name='V2_lobby_deck_directory_backing';backing.userData.noCollide=true;board.add(backing);
  const front=new T.PlaneGeometry(DIRECTORY_WIDTH,DIRECTORY_HEIGHT).translate(0,0,.026),back=new T.PlaneGeometry(DIRECTORY_WIDTH,DIRECTORY_HEIGHT).rotateY(Math.PI).translate(0,0,-.026),faces=mergeGeometries([front,back]);front.dispose();back.dispose();intoPage(b,faces.attributes.uv);
  const face=new T.Mesh(faces,b.page.material);face.name='V2_lobby_deck_directory_faces';face.userData={noCollide:true,readableFaces:2};board.add(face);
  if(postHeight>0)for(const side of [-1,1]){const post=new T.Mesh(new T.CylinderGeometry(.022,.022,postHeight,6),directorySupport);post.name='V2_lobby_deck_directory_support';post.position.set(side*DIRECTORY_WIDTH/2,top+postHeight/2,0);post.userData.noCollide=true;board.add(post);}
 }
 globalThis.document.fonts?.ready.then(()=>{for(const draw of paint)draw();});return [...roots.values()];
}
