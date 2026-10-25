import * as T from 'three';
import {CROWN} from '../fin-crown.js';
import {shapePoint} from '../concept-shape.js';

// Comic books lying about the walk, to pick up and read. Each is one entry: its title, its pages in reading order
// (src/walk/art, hashed into the build by scripts/walk-page.mjs; the first is also the cover), the pages' pixel size, the
// point on the surface it lies on (before the fin drop), the way its top edge points and, optionally, how near a walker
// must stand to read it (REACH metres otherwise). Use one and the reader sheet
// shows its pages one at a time, with Next page to turn and Finish on the last. The cover loads once a walker comes
// within NEAR metres; the pages only when the book is opened.
export const COMICS=[
 // Extraction: Go!, on the forward end of the Crown lounge's bar counter (its top is 1.2 m over the lounge floor).
 {name:'Extraction_Go',title:'Extraction: Go!',where:'Crown lounge',pages:['extraction-go-1.jpg','extraction-go-2.jpg','extraction-go-3.jpg'],size:[1073,1600],at:[-227.45,CROWN.floor+1.2,1.3],top:[-1,0,-.25]},
 // In the Club, on the forward booth table at z -5.4 (its top is .72 m up), on the open side clear of the lamp and drinks,
 // facing a walker standing at the table. Its shorter reach leaves the banquette's seats to Sit down.
 {name:'In_the_Club',title:'In the Club',where:'Crown lounge',pages:['in-the-club-1.jpg','in-the-club-2.jpg','in-the-club-3.jpg'],size:[1073,1600],at:[-204.05,CROWN.floor+.72,-4.9],top:[.2,0,-1],reach:1.1},
 // The Outpost, on the booth table at x -214, z 9 (its top is .72 m up), on the open side clear of the lamp and
 // drinks, facing a walker standing at the table. Its shorter reach leaves the banquette's seats to Sit down.
 {name:'The_Outpost',title:'The Outpost',where:'Crown lounge',pages:['the-outpost-1.jpg','the-outpost-2.jpg','the-outpost-3.jpg'],size:[1073,1600],at:[-214.05,CROWN.floor+.72,8.5],top:[.2,0,1],reach:1.1},
];
const NEAR=30,REACH=1.7,BOOK={height:.32,thick:.012};

export function createComics({urls={},anisotropy=1}={}){
 const edge=new T.MeshStandardMaterial({name:'Comic_page_edge',color:0xeee6d6,roughness:.85});
 const books=COMICS.map(c=>{
  const [x,y,z]=shapePoint(c.at),floor=shapePoint([c.at[0],CROWN.floor,c.at[2]])[1],h=BOOK.height,w=h*c.size[0]/c.size[1];
  const cover=new T.MeshStandardMaterial({name:'Comic_cover',color:0x2a2f3a,roughness:.6});
  // A box's top face shows its image upright with the image's top toward local -z; turn that toward `top`.
  const book=new T.Mesh(new T.BoxGeometry(w,BOOK.thick,h),[edge,edge,cover,edge,edge,edge]);book.name='Comic_'+c.name;
  book.position.y=y-floor+BOOK.thick/2;book.rotation.y=Math.atan2(-c.top[0],-c.top[2]);
  // Its origin on the floor, so main.js files it with that deck's band.
  const group=new T.Group();group.name='Comic_book_'+c.name;group.position.set(x,floor,z);group.add(book);
  return {c,group,cover,floor,spot:new T.Vector3(x,y,z),url:urls[c.pages[0]],loading:false};
 });
 return {
  groups:books.map(b=>b.group),
  // Called with the walker's position a few times a second: start loading any cover now near.
  update(at){
   for(const b of books){
    if(b.loading||!b.url||b.spot.distanceTo(at)>NEAR)continue;b.loading=true;
    new T.TextureLoader().load(b.url,t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=anisotropy;b.cover.map=t;b.cover.color.set(0xffffff);b.cover.needsUpdate=true;},undefined,()=>{b.loading=false;b.url=null;});
   }
  },
  // The use prompt for a book within reach on the walker's own level.
  near(p){
   for(const b of books){if(Math.abs(p.y-b.floor)>1.5||Math.hypot(p.x-b.spot.x,p.z-b.spot.z)>(b.c.reach||REACH))continue;return {kind:'comic',comic:b.c,label:'Read '+b.c.title};}
   return null;
  },
 };
}

// The reader: one page at a time in the sheet, the next one fetched in the background. Back and Next page turn (as do
// the arrow keys); the last page's button is Finish, which closes the book.
export function createComicReader(sheet,{urls={},onClose}={}){
 const $=s=>sheet.querySelector(s),img=$('.comic-page'),back=$('.comic-back'),next=$('.comic-next'),count=$('.comic-count');
 let comic=null,page=0;
 const src=file=>urls[file]||'';
 const show=()=>{
  const n=comic.pages.length;img.src=src(comic.pages[page]);img.alt=`${comic.title}, page ${page+1} of ${n}`;
  count.textContent=`Page ${page+1} of ${n}`;back.disabled=page===0;next.textContent=page===n-1?'Finish':'Next page';
  if(page<n-1)new Image().src=src(comic.pages[page+1]);
 };
 const turn=d=>{if(!comic)return;if(page+d>=comic.pages.length){onClose?.();return;}page=Math.max(0,page+d);show();};
 back.addEventListener('click',()=>turn(-1));next.addEventListener('click',()=>turn(1));
 return {
  open(c){comic=c;page=0;$('.comic-where').textContent=c.where||'Comic';$('.comic-title').textContent=c.title;img.style.aspectRatio=`${c.size[0]}/${c.size[1]}`;show();sheet.hidden=false;next.focus();},
  // A key while the reader is open (Space and Enter already press the focused button).
  key(code){if(code==='ArrowRight'||code==='KeyD')turn(1);else if(code==='ArrowLeft'||code==='KeyA')turn(-1);},
 };
}
