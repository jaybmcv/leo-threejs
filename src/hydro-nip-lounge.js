import * as T from 'three';

// The Hydro-Nip Lounge (feedback-inbox #58, HYDRO_NIP_LOUNGE.md): a catnip lounge in Neighborhood 1's garden commons,
// concept by Tochtli. Built in the commons template's own frame (x 109.5-154.5, z 8-46, floor 24.3); the commons root
// moves and mirrors it into place. The garden middle gives way to it; galleries, stairs and shared services stay.
const FLOOR=24.3,CEILING=35.65;

// The garden parts the lounge replaces: planters and trees, the cafe, and the commons' cat figures.
const REPLACED=/^(Garden_planter|Planting_bed|Planting_detail|Tree_trunk|Tree_canopy|Low_plant|Stylized_tree|Garden_bench(_\w+)?|Planter_\w+|Layered_garden_foliage|Table_foliage|Table_ceramic_vase|Community_cafe_counter|Cafe_\w+|Table_pedestal|Espresso_\w+|Coffee_\w+|Serving_cup|Mars_cat_1\.75m)$/;
export function clearGarden(root){
 const gone=[];
 root.traverse(o=>{
  if(REPLACED.test(o.name))gone.push(o);
  // The cafe's chairs; the kitchen and reading chairs belong to the shared services and stay.
  else if(o.name==='Tail_clearance_chair'&&o.parent?.name!=='Neighborhood_shared_services')gone.push(o);
 });
 for(const o of gone)o.removeFromParent();
 return gone.length;
}

// Phase 1 blockout: plain masses for each zone, for approval of the layout before any detail.
export function createHydroNipLounge(){
 const root=new T.Group();root.name='Hydro_Nip_Lounge';
 root.userData={concept:'Tochtli (Discord tochtli_13)',issue:'feedback-inbox #58',stage:'Blockout'};
 const mat=(name,color,extra={})=>new T.MeshStandardMaterial({name,color,roughness:.7,...extra});
 const glass=(name,color)=>mat(name,color,{transparent:true,opacity:.35,depthWrite:false,side:T.DoubleSide});
 const add=(name,geo,m,pos)=>{const o=new T.Mesh(geo,m);o.name=name;o.position.set(...pos);root.add(o);return o;};
 const box=(name,[w,h,d],[x,y,z],m)=>add(name,new T.BoxGeometry(w,h,d),m,[x,y+h/2,z]);
 // The Haze Maze: a three-storey glass tower in front of the end gallery.
 box('Lounge_blockout_haze_maze',[6.5,10.9,14],[117.25,FLOOR,26],glass('Lounge_blockout_maze',0x5fd36a));
 // The Terpene Tasting Deck: a bar along the maze's side, stools facing the dome.
 const bar=mat('Lounge_blockout_bar',0x8a5a3c);
 box('Lounge_blockout_tasting_bar',[1,1.1,9],[123.1,FLOOR,25.5],bar);
 box('Lounge_blockout_tasting_shelf',[.5,2.4,9],[121.6,FLOOR,25.5],bar);
 for(let i=0;i<6;i++)add('Lounge_blockout_stool',new T.CylinderGeometry(.22,.22,.75,10),mat('Lounge_blockout_stool',0x3c2f4f),[124.3,FLOOR+.375,22+i*1.4]);
 // The Anti-Gravity Geodesic Hammock Dome.
 add('Lounge_blockout_dome',new T.SphereGeometry(6.5,24,12,0,Math.PI*2,0,Math.PI/2),glass('Lounge_blockout_dome',0x8f7cf0),[134,FLOOR,25]);
 // The Cosmic Munchies Converger: a counter, and the machine hung from the ceiling over it.
 box('Lounge_blockout_munchies_counter',[3,1.1,5],[144.5,FLOOR,25],mat('Lounge_blockout_munchies',0x2f5f8f));
 add('Lounge_blockout_munchies_machine',new T.CylinderGeometry(1.1,.7,2.2,16),mat('Lounge_blockout_machine',0x44617a),[144.5,CEILING-1.6,25]);
 // The sign stands on the dome's crown, facing the entrance (-z). Hung at the dome's front it filled the upper gallery's
 // view of the room; on the crown it is 13 m from that gallery's rail.
 box('Lounge_blockout_sign',[11,2.2,.2],[134,FLOOR+6.6,25],mat('Lounge_blockout_sign',0xd04fc8,{emissive:0x8a2a85}));
 // Lounge seating in front, toward the entrance: rugs and beanbags.
 for(const [x,z,w,d] of [[127,15,7,4],[137,15,7,4],[144,16,4,3]])box('Lounge_blockout_rug',[w,.03,d],[x,FLOOR,z],mat('Lounge_blockout_rug',0x6b4a8a));
 for(const [x,z] of [[125,14],[128,16],[135,14],[138,16.2],[141,14.5],[144.5,16]])add('Lounge_blockout_beanbag',new T.SphereGeometry(.55,12,8),mat('Lounge_blockout_beanbag',0x7b5aa6),[x,FLOOR+.35,z]);
 // The credit plaque by the entrance.
 box('Lounge_blockout_credit_plaque',[1.2,1.4,.15],[117.5,FLOOR,12.6],mat('Lounge_blockout_plaque',0xd8c9a0));
 return root;
}
