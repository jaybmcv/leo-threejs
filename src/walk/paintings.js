import * as T from 'three';
import {placed,placedV1,placeObject} from '../plan/placements.js';
import {bandOf} from './collision.js';

// Paintings hung on the walk's walls. Each is one entry: its image (src/walk/art, hashed into the build by
// scripts/walk-page.mjs), the wall face's point it centres on, the way it faces, and the largest box the wall leaves it
// clear of rails and trim. It hangs as large as that box allows at the image's own proportions, in a slim dark frame.
// An entry with `off` stands that far out from the wall, its frame boxed back to it, to hang clear of wall fittings.
// The image loads only once a walker comes within NEAR metres; until then the canvas shows plain.
export const PAINTINGS=[
 // Orange Haze #1, by M.V. Orange Haze: the back of the Crown lounge's lift housing (fin-crown.js), the dark navy face
 // (z -2.175) that faces the lounge's port side, across its full 4.2 m and from the floor (120.3)
 // to the housing's top (123.4).
 {name:'Orange_Haze_1',file:'orange-haze-1.jpg',size:[1600,1195],room:'crown',wall:placed('painting/Orange_Haze_1'),facing:[0,0,-1],fit:[3.92,2.78],floor:120.3},
 // Orange Haze #2, by M.V. Orange Haze: the forward wall of the Deck 17 starboard garden commons, between the
 // galleries' rails (z 12) and the stair landing's (z 33), the floor (24.3) and the roof rib (34.92).
 {name:'Orange_Haze_2',file:'orange-haze-2.jpg',size:[1600,1195],room:'commons-10',wall:placed('painting/Orange_Haze_2'),facing:[-1,0,0],fit:[18,9.4],floor:24.3},
 // Orange Haze #3, by M.V. Orange Haze: the far wall of the Deck 17 forward lounge, on the upright run of its side
 // return between the aft partition (x 171) and where its foot flares toward the windows; under the ceiling ribs (33).
 {name:'Orange_Haze_3',file:'orange-haze-3.jpg',size:[1600,1195],room:'observation-lounge',wall:placed('painting/Orange_Haze_3'),facing:[-.2118,0,-.9773],fit:[5.1,3.8],floor:26.3},
 // Orange Haze #4, by M.V. Orange Haze: the far port wall of the Deck 17 window lounge. That wall is a twisted sheet (lounge.js): its
 // upper, aft part stands upright and its lower, forward part leans back. The painting fills the upright part, from
 // the rear wall (x 170) to where the lean would leave its corner 20 cm off the wall, and up to the ceiling ribs.
 {name:'Orange_Haze_4',file:'orange-haze-4.jpg',size:[1600,1195],room:'observation-lounge',wall:placed('painting/Orange_Haze_4'),facing:[-.2118,0,.9773],fit:[6,4.48],floor:26.3},
 // Orange Haze #5: the far wall of the Deck 2 transfer branch, seen through the arrival hall's exit (z -40 to -36) and
 // centred on it, from the threshold (-35.67) to the branch ceiling (-32.4). Portrait, so the wall shows either side.
 {name:'Orange_Haze_5',file:'orange-haze-5.jpg',size:[1195,1600],room:'circulation-2',wall:placed('painting/Orange_Haze_5'),facing:[1,0,0],fit:[4,2.95],floor:-35.67},
 // Orange Haze #6: the recessed bay on the port side of the Deck 15 cross-corridor junction (x 122.9, z -2 to -8.44),
 // centred in it, from just over the floor (16.3) to just under the corridor soffit (19.65) that fronts the bay.
 {name:'Orange_Haze_6',file:'orange-haze-6.jpg',size:[1600,1195],room:'circulation-15',wall:placed('painting/Orange_Haze_6'),facing:[1,0,0],fit:[6,2.95],floor:16.3},
 // Orange Haze #7: the recessed bay on the starboard side of the Deck 15 cross-corridor junction (x 122.9, z 2 to 8.44),
 // centred in it, from just over the floor (16.3) to just under the corridor soffit (19.65) that fronts the bay.
 {name:'Orange_Haze_7',file:'orange-haze-7.jpg',size:[1600,1210],room:'circulation-15',wall:placed('painting/Orange_Haze_7'),facing:[1,0,0],fit:[6,2.95],floor:16.3},
 // Orange Haze #9: the outboard wall of the Deck 2 arrival hall, across from the garden atrium's cat tree (x -117.5,
 // arrival-atrium.js), floor (-35.7) to ceiling (-32.4).
 {name:'Orange_Haze_9',file:'orange-haze-9.jpg',size:[1600,1223],room:'d02-arrival-1',wall:placed('painting/Orange_Haze_9'),facing:[0,0,1],fit:[20,2.95],floor:-35.7},
 // Orange Haze #10, by M.V. Orange Haze: the aft wall of the Deck 5 side corridor (x -148), facing the Medical ward's
 // doorway (z -40 to -36) and centred on it, from near the floor (-23.7) to near the ceiling (-20.4). The corridor's end
 // wall at z -40 sets its width; it stands 17 cm out, in front of the wall's pipes, handrail and hatch.
 {name:'Orange_Haze_10',file:'orange-haze-10.jpg',size:[1600,1202],room:'circulation-5',wall:placed('painting/Orange_Haze_10'),facing:[1,0,0],fit:[3.62,3],floor:-23.7,off:.17},
 // Orange Haze #15, by M.V. Orange Haze, in three parts: the outboard wall of the Deck 20 Captain's office (z 32.84),
 // part 1 to part 3 from left to right as you face it, from just over the floor (36.3) to just under the ceiling (39.6).
 // The middle part is centred on the wall (x 53); 20 cm of wall shows between the frames.
 {name:'Orange_Haze_15_1',file:'orange-haze-15-1.jpg',size:[1250,1600],room:'d20-captain-7',wall:placed('painting/Orange_Haze_15_1'),facing:[0,0,-1],fit:[2.4,2.95],floor:36.3},
 {name:'Orange_Haze_15_2',file:'orange-haze-15-2.jpg',size:[1248,1600],room:'d20-captain-7',wall:placed('painting/Orange_Haze_15_2'),facing:[0,0,-1],fit:[2.4,2.95],floor:36.3},
 {name:'Orange_Haze_15_3',file:'orange-haze-15-3.jpg',size:[1245,1600],room:'d20-captain-7',wall:placed('painting/Orange_Haze_15_3'),facing:[0,0,-1],fit:[2.4,2.95],floor:36.3},
];
export const NEAR=45,FRAME={width:.14,depth:.08};
// A painting's hung width and height: as large as its fit box allows at the image's proportions.
export function hangSize(p){const aspect=p.size[0]/p.size[1],h=Math.min(p.fit[1],p.fit[0]/aspect);return [h*aspect,h];}

export function createPaintings({urls={},anisotropy=1}={}){
 const frame=new T.MeshStandardMaterial({name:'Painting_frame',color:0x1c1a18,roughness:.55,metalness:.2});
 const pieces=PAINTINGS.map(p=>{
  const [w,h]=hangSize(p),[x,y,z]=placedV1('painting/'+p.name),f=new T.Vector3(...p.facing);
  // The group's origin on the floor, so it draws with the bands its height spans.
  const group=new T.Group();group.name='Painting_'+p.name;group.position.set(x,p.floor,z);group.rotation.y=Math.atan2(f.x,f.z);
  group.userData={band:bandOf(y-h/2),top:bandOf(y+h/2)};
  const box=(name,s,at)=>{const o=new T.Mesh(new T.BoxGeometry(...s),frame);o.name=name;o.position.set(...at);group.add(o);};
  const W=FRAME.width,D=FRAME.depth+(p.off||0),cy=y-p.floor;
  for(const s of [-1,1]){box('Painting_frame_rail',[w+2*W,W,D],[0,cy+s*(h+W)/2,D/2]);box('Painting_frame_stile',[W,h,D],[s*(w+W)/2,cy,D/2]);}
  const canvas=new T.MeshBasicMaterial({name:'Painting_canvas',color:0xe2d8c6});
  const art=new T.Mesh(new T.PlaneGeometry(w,h),canvas);art.name='Painting_art_'+p.name;art.position.set(0,cy,D-FRAME.depth*.4);group.add(art);
  placeObject(group,'painting/'+p.name);group.updateMatrixWorld(true);
  return {p,group,canvas,centre:new T.Vector3(...placed('painting/'+p.name)),url:urls[p.file],loading:false};
 });
 return {
  groups:pieces.map(q=>q.group),targets:pieces.map(q=>({name:q.p.name,at:q.centre,room:q.p.room})),
  // Called with the walker's position a few times a second: start loading any painting now near.
  update(at){
   for(const q of pieces){
    if(q.loading||!q.url||q.centre.distanceTo(at)>NEAR)continue;q.loading=true;
    new T.TextureLoader().load(q.url,t=>{t.colorSpace=T.SRGBColorSpace;t.anisotropy=anisotropy;q.canvas.map=t;q.canvas.color.set(0xffffff);q.canvas.needsUpdate=true;},undefined,()=>{q.loading=false;q.url=null;});
   }
  },
 };
}
