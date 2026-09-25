import * as T from 'three';
import {dressArrival,dressDriveBulkheads} from './engineering-dressing.js';

// The guided tours walk through cutaway models: rooms that stop at the section line, so a turn of the head showed
// open space where the rest of the ship should be. These walk-only shells close each tour stop's surroundings.
// They are hidden outside walk mode so the cutaway overviews stay open.

const FALLBACK={wall:0xe6e0d4,floor:0xd8d2c6,ceiling:0xf0ece4};
// Reuse the host model's own materials (by mesh name) so the shells read as the same build.
function palette(root,names){
 const pick=(name,color)=>{const o=root.getObjectByName(name);const m=o&&(Array.isArray(o.material)?o.material[0]:o.material);return m||new T.MeshStandardMaterial({color,roughness:.85});};
 return {wall:pick(names.wall,FALLBACK.wall),floor:pick(names.floor,FALLBACK.floor),ceiling:pick(names.ceiling,FALLBACK.ceiling)};
}
// An axis-aligned slab from min to max corner.
function slab(group,name,[x0,y0,z0],[x1,y1,z1],material){
 const m=new T.Mesh(new T.BoxGeometry(x1-x0,y1-y0,z1-z0),material);m.name=name;m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);m.receiveShadow=true;group.add(m);return m;
}
const stripGlow=new T.MeshStandardMaterial({name:'Tour_ceiling_strip',color:0xf4f0e8,emissive:0xfff2dc,emissiveIntensity:1.6});
// Linear ceiling lights running along x under a ceiling at `y`.
function ceilingStrips(group,x0,x1,y,zs){for(const z of zs)slab(group,'Tour_ceiling_strip',[x0,y-.06,z-.12],[x1,y,z+.12],stripGlow);}
const doorMaterial=new T.MeshStandardMaterial({name:'Tour_closed_door',color:0x2a3a47,roughness:.55,metalness:.25});
const doorGlow=new T.MeshStandardMaterial({name:'Tour_door_status',color:0x2fd6c5,emissive:0x2fd6c5,emissiveIntensity:1.4});
// A closed service door on a wall facing +x or -x (`facing` is the room side).
function closedDoorX(group,x,zc,y0,facing,width=1.6,height=2.3){
 const t=.06*facing;
 slab(group,'Tour_closed_door',[Math.min(x,x+t),y0,zc-width/2],[Math.max(x,x+t),y0+height,zc+width/2],doorMaterial);
 slab(group,'Tour_door_status',[Math.min(x+t,x+t*1.4),y0+height*.62,zc+width/2+.12],[Math.max(x+t,x+t*1.4),y0+height*.62+.14,zc+width/2+.2],doorGlow);
}

// Neighborhood 10 (the home tour's cabin, corridor, lift, garden and promenade stops).
export function encloseNeighborhoodTour(root){
 const g=new T.Group();g.name='Tour_neighborhood_shell';
 const m=palette(root,{wall:'Commons_end_wall',floor:'Commons_floor',ceiling:'Commons_ceiling'});
 const lobby=palette(root,{wall:'Commons_end_wall',floor:'Neighborhood_circulation',ceiling:'Corridor_ceilings'});
 // Deck 15 lift lobby, past the last cabins: the sides opened onto the gaps between cabin rows.
 for(const s of [-1,1])slab(g,'Tour_deck15_lobby_wall',[122.9,16.2,s*8.45-.1],[134,19.7,s*8.45+.1],m.wall);
 slab(g,'Tour_deck15_lobby_floor',[122.9,16,-8.45],[134,16.28,8.45],lobby.floor);
 slab(g,'Tour_deck15_lobby_ceiling',[122.9,19.62,-8.45],[134,19.85,8.45],lobby.ceiling);
 // The far (aft) end of the Deck 15 corridors, 250 m back: the neighbourhood model stops there, which showed as a
 // black square down the corridor.
 slab(g,'Tour_deck15_aft_end',[-124.35,16,-54],[-124.1,19.9,54],lobby.wall);
 // Deck 17 lift lobby: its far end, its open side and the ceiling over it.
 slab(g,'Tour_deck17_lobby_wall',[109.4,24.1,-8.35],[136.8,35.6,-8.1],m.wall);
 slab(g,'Tour_deck17_lobby_end',[109.2,24.1,-8.35],[109.45,35.6,8],m.wall);
 slab(g,'Tour_deck17_lobby_ceiling',[109.2,35.5,-8.35],[136.8,35.8,8],lobby.ceiling);
 slab(g,'Tour_deck17_lobby_floor',[109.2,23.95,-8.35],[136.8,24.27,8],lobby.floor);
 // The pocket between the promenade and the garden, beside the stair (kept behind the promenade wall at z 4).
 slab(g,'Tour_garden_pocket_floor',[145.8,24,4.02],[154.5,24.28,8],m.floor);
 slab(g,'Tour_garden_pocket_wall',[145.8,24.1,4.02],[154.8,35.6,4.27],m.wall);
 slab(g,'Tour_garden_pocket_ceiling',[145.8,35.5,4.02],[154.8,35.8,8],m.ceiling);
 // The garden's forward end wall (the side that opened onto space); tour-polish dresses it as a living wall.
 slab(g,'Tour_garden_end_wall',[154.55,24,4.02],[154.8,35.8,46.1],m.wall);
 return g;
}

// The aft end of Deck 15 on the engineering tour: the cross hall behind the aft lifts ended at the section line.
// `root` is the aft transit core, whose stair walls lend the material.
export function encloseResidentialConnection(root){
 const g=new T.Group();g.name='Tour_residential_connection_shell';
 const m=palette(root,{wall:'Stair_end_wall',floor:'Neighborhood_circulation',ceiling:'Corridor_ceilings'});
 slab(g,'Tour_aft_cross_hall_end',[-138.45,16,-54],[-138.2,20.4,54],m.wall);
 return g;
}

// Engineering, reservoir, pod and fin stops on the engineering tour.
export function encloseAftTour(root){
 const g=new T.Group();g.name='Tour_aft_shell';root.updateMatrixWorld(true);
 const m=palette(root,{wall:'Machinery_side_enclosure',floor:'Machinery_hall_floor',ceiling:'Tank_acoustic_ceiling'});
 // Deck 8 arrival: the lift and stair landing in front of the machinery bulkhead becomes an enclosed lobby.
 const A={x0:-178,x1:-131.7,z0:-12.8,z1:10.4,floor:-11.75,ceiling:-8.25};
 slab(g,'Tour_arrival_floor',[A.x0,A.floor-.2,A.z0],[A.x1,A.floor,A.z1],m.floor);
 slab(g,'Tour_arrival_ceiling',[A.x0,A.ceiling,A.z0],[A.x1,A.ceiling+.15,A.z1],m.ceiling);
 slab(g,'Tour_arrival_wall',[A.x0,A.floor,A.z0-.2],[A.x1,A.ceiling,A.z0],m.wall);
 slab(g,'Tour_arrival_wall',[A.x0,A.floor,A.z1],[A.x1,A.ceiling,A.z1+.2],m.wall);
 slab(g,'Tour_arrival_end',[A.x1,A.floor,A.z0-.2],[A.x1+.2,A.ceiling,A.z1+.2],m.wall);
 closedDoorX(g,A.x1,0,A.floor,-1);ceilingStrips(g,A.x0+3,A.x1-3,A.ceiling,[-6,0,5]);dressArrival(g,m,A);
 // Short vestibules behind the reservoir bay and pod aisle doorways, each ending in a closed door.
 vestibule(g,m,{x:-176,dir:1,zc:0,half:2.45,floor:-27.7,ceiling:-24.45,depth:6});
 vestibule(g,m,{x:-168,dir:1,zc:126.2,half:2.35,floor:-19.7,ceiling:-16.4,depth:6});
 // Fin crown lift lobby at the end of the upper service gallery.
 const F={x0:-250.7,x1:-233,half:3.3,floor:24.25,ceiling:31.62};
 slab(g,'Tour_fin_lobby_floor',[F.x0,F.floor-.2,-F.half],[F.x1,F.floor,F.half],m.floor);
 slab(g,'Tour_fin_lobby_ceiling',[F.x0,F.ceiling,-F.half],[F.x1,F.ceiling+.15,F.half],m.ceiling);
 for(const s of [-1,1])slab(g,'Tour_fin_lobby_wall',[F.x0,F.floor,s>0?F.half:-F.half-.2],[F.x1,F.ceiling,s>0?F.half+.2:-F.half],m.wall);
 slab(g,'Tour_fin_lobby_end',[F.x0-.2,F.floor,-F.half-.2],[F.x0,F.ceiling,F.half+.2],m.wall);
 // The lobby opens through a doorway into the upper service gallery, which the fin tour walks along.
 const D={half:1.6,top:F.floor+2.75};
 for(const s of [-1,1])slab(g,'Tour_fin_gallery_wall',[F.x1,F.floor,s>0?D.half:-F.half-.2],[F.x1+.2,F.ceiling,s>0?F.half+.2:-D.half],m.wall);
 slab(g,'Tour_fin_gallery_lintel',[F.x1,D.top,-D.half],[F.x1+.2,F.ceiling,D.half],m.wall);
 ceilingStrips(g,F.x0+5,F.x1-1,F.ceiling,[-2,2]);
 encloseServiceGallery(g,m,F);
 dressDriveBulkheads(g,root);
 return g;
}

// The upper service gallery on Deck 17, from the fin lobby to just past the link to the fin lounge (x -207..-203 on
// the +z side), ending in a closed door.
function encloseServiceGallery(g,m,F){
 const G={x0:F.x1+.2,x1:-190,half:3.3,floor:F.floor,ceiling:27.8,link:[-207.2,-202.8]};
 slab(g,'Tour_gallery_floor',[G.x0,G.floor-.2,-G.half],[G.x1,G.floor+.03,G.half],m.floor);
 slab(g,'Tour_gallery_ceiling',[G.x0,G.ceiling,-G.half],[G.x1,G.ceiling+.15,G.half],m.ceiling);
 slab(g,'Tour_gallery_wall',[G.x0,G.floor,-G.half-.2],[G.x1,G.ceiling,-G.half],m.wall);
 slab(g,'Tour_gallery_wall',[G.x0,G.floor,G.half],[G.link[0],G.ceiling,G.half+.2],m.wall);
 slab(g,'Tour_gallery_wall',[G.link[1],G.floor,G.half],[G.x1,G.ceiling,G.half+.2],m.wall);
 slab(g,'Tour_gallery_end',[G.x1,G.floor,-G.half-.2],[G.x1+.2,G.ceiling,G.half+.2],m.wall);
 closedDoorX(g,G.x1,0,G.floor,-1,1.4,2.4);ceilingStrips(g,G.x0+2,G.x1-2,G.ceiling,[0]);
}

// A short passage from a doorway at `x`, running `depth` metres in `dir` (±1 along x), ending in a closed door.
function vestibule(g,m,{x,dir,zc,half,floor,ceiling,depth}){
 const far=x+dir*depth,x0=Math.min(x,far),x1=Math.max(x,far);
 slab(g,'Tour_vestibule_floor',[x0,floor-.2,zc-half],[x1,floor-.02,zc+half],m.floor);
 slab(g,'Tour_vestibule_ceiling',[x0,ceiling,zc-half],[x1,ceiling+.15,zc+half],m.ceiling);
 // Walls reach below the floor slab so no crack opens along the floor edge.
 for(const s of [-1,1])slab(g,'Tour_vestibule_wall',[x0,floor-.2,s>0?zc+half:zc-half-.2],[x1,ceiling,s>0?zc+half+.2:zc-half],m.wall);
 slab(g,'Tour_vestibule_end',[dir>0?x1:x0-.2,floor-.2,zc-half-.2],[dir>0?x1+.2:x0,ceiling,zc+half+.2],m.wall);
 closedDoorX(g,dir>0?x1:x0,zc,floor,-dir);
}
