import * as T from 'three';
import {anchorObject} from '../plan/rooms.js';
import {publicFinishMaterials,publicFloorUV} from '../v2/finish-kit.authoring.js';

// The aft lobby's transit slab projects past the deck paving into the atrium cutout.
export function finishLiftLobbyFloor(ship,layout){
 const deck=layout.decks[18],opening=deck.slab.holes.find(h=>h.id==='atrium').polygon;
 const lobby=ship.ensureTransit().floors.find(f=>f.deck===deck.number&&f.name==='Transit_lobby_floor'&&f.x1<0);
 if(!lobby)return null;
 const {x0,x1,z0,z1}=lobby;
 const edge=opening.find(([x,z],i)=>{
  const [nx,nz]=opening[(i+1)%opening.length];
  return x===nx&&x>=x0&&x<x1&&Math.min(z,nz)<=z0&&Math.max(z,nz)>=z1;
 });
 if(!edge)return null;
 // Dress only the exposed top. The adjacent kit uses the same 2 mm lift and world UVs.
 const start=edge[0];
 const g=publicFloorUV(new T.PlaneGeometry(x1-start,z1-z0).rotateX(-Math.PI/2).translate((start+x1)/2,deck.y+.002,(z0+z1)/2));
 const m=new T.Mesh(g,publicFinishMaterials().floor);
 m.name='Lift_lobby_hex_floor_finish';
 m.userData.noCollide=true;
 anchorObject(m,'circulation-19');ship.inside.add(m);
 return m;
}
