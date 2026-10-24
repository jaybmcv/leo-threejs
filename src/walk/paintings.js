import * as T from 'three';
import {bandOf} from './collision.js';

// Paintings hung on the walk's walls. Each is one entry: its image (src/walk/art, hashed into the build by
// scripts/walk-page.mjs), the wall face's point it centres on, the way it faces, and the largest box the wall leaves it
// clear of rails and trim. It hangs as large as that box allows at the image's own proportions, in a slim dark frame.
// The image loads only once a walker comes within NEAR metres; until then the canvas shows plain.
export const PAINTINGS=[
 // Orange Haze #2, by M.V. Orange Haze: the forward wall of the Deck 17 starboard garden commons, between the
 // galleries' rails (z 12) and the stair landing's (z 33), the floor (24.3) and the roof rib (34.92).
 {name:'Orange_Haze_2',file:'orange-haze-2.jpg',size:[1600,1195],wall:[154.44,29.8,22.5],facing:[-1,0,0],fit:[18,9.4],floor:24.3},
 // Orange Haze #7: the recessed bay on the starboard side of the Deck 15 cross-corridor junction (x 122.9, z 2 to 8.44),
 // centred in it, from just over the floor (16.3) to just under the corridor soffit (19.65) that fronts the bay.
 {name:'Orange_Haze_7',file:'orange-haze-7.jpg',size:[1600,1210],wall:[122.9,18.025,5.22],facing:[1,0,0],fit:[6,2.95],floor:16.3},
];
const NEAR=45,FRAME={width:.14,depth:.08};

export function createPaintings({urls={},anisotropy=1}={}){
 const frame=new T.MeshStandardMaterial({name:'Painting_frame',color:0x1c1a18,roughness:.55,metalness:.2});
 const pieces=PAINTINGS.map(p=>{
  const aspect=p.size[0]/p.size[1],h=Math.min(p.fit[1],p.fit[0]/aspect),w=h*aspect,[x,y,z]=p.wall,f=new T.Vector3(...p.facing);
  // The group's origin on the floor, so it draws with the bands its height spans.
  const group=new T.Group();group.name='Painting_'+p.name;group.position.set(x,p.floor,z);group.rotation.y=Math.atan2(f.x,f.z);
  group.userData={band:bandOf(y-h/2),top:bandOf(y+h/2)};
  const box=(name,s,at)=>{const o=new T.Mesh(new T.BoxGeometry(...s),frame);o.name=name;o.position.set(...at);group.add(o);};
  const W=FRAME.width,D=FRAME.depth,cy=y-p.floor;
  for(const s of [-1,1]){box('Painting_frame_rail',[w+2*W,W,D],[0,cy+s*(h+W)/2,D/2]);box('Painting_frame_stile',[W,h,D],[s*(w+W)/2,cy,D/2]);}
  const canvas=new T.MeshBasicMaterial({name:'Painting_canvas',color:0xe2d8c6});
  const art=new T.Mesh(new T.PlaneGeometry(w,h),canvas);art.name='Painting_art_'+p.name;art.position.set(0,cy,D*.6);group.add(art);
  group.updateMatrixWorld(true);
  return {p,group,canvas,centre:new T.Vector3(x,y,z),url:urls[p.file],loading:false};
 });
 return {
  groups:pieces.map(q=>q.group),
  // Called with the walker's position a few times a second: start loading any painting now near.
  update(at){
   for(const q of pieces){
    if(q.loading||!q.url||q.centre.distanceTo(at)>NEAR)continue;q.loading=true;
    new T.TextureLoader().load(q.url,t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=anisotropy;q.canvas.map=t;q.canvas.color.set(0xffffff);q.canvas.needsUpdate=true;},undefined,()=>{q.loading=false;q.url=null;});
   }
  },
 };
}
