import * as T from 'three';
import {ARENA_ID,TRIGGERS} from '../mudwater-arena.js';

// Mudwater Arena on Deck 16 (MUDWATER_ARENA.md): the game's link and the pack counter's card for the walk, and the
// hologram cards on the stage board turning slowly. E at the match screen, or on the board in front of either podium,
// opens Mudwater's own game page in a new tab; E at the pack counter shows the giveaway card (walk.html's
// #mudwater-sheet). The holograms leave the room for a group of their own before the ship is merged, so they can turn.
export const GAME_URL='https://mudwater.bayc.com/game/';
const REACH=1.3,SPIN=.25,BOB=.03;
const LABEL={mudwater:'Play Mudwater',packs:'Booster packs'};

// `ship`: the walk's ship (its rooms still unmerged).
export function createMudwater(ship){
 const room=ship.root.getObjectByName('Area_'+ARENA_ID);if(!room)return null;
 room.updateMatrixWorld(true);
 const spots=TRIGGERS.map(t=>({kind:t.kind,at:room.localToWorld(new T.Vector3(...t.at))}));
 // (The group stands at the room's floor height, so it is drawn with that deck's band: main.js toBand.)
 const group=new T.Group();group.name='Mudwater_holograms';group.position.y=room.getWorldPosition(new T.Vector3()).y;
 const cards=[];
 room.traverse(o=>{if(o.name==='Mudwater_hologram')cards.push(o);});
 for(const o of cards){const p=o.getWorldPosition(new T.Vector3()),q=o.getWorldQuaternion(new T.Quaternion());
  o.removeFromParent();group.add(o);o.position.copy(p).y-=group.position.y;o.quaternion.copy(q);o.userData.base={y:o.position.y,yaw:new T.Euler().setFromQuaternion(q,'YXZ').y};}
 let t=0;
 return {
  group,
  update(dt){t+=dt;cards.forEach((o,i)=>{const b=o.userData.base;o.rotation.set(0,b.yaw+t*SPIN*(i%2?-1:1),0);o.position.y=b.y+Math.sin(t*1.3+i*1.7)*BOB;});},
  // The use prompt: the nearest trigger within reach, on its own floor.
  near(p){
   let best=null,bd=REACH;
   for(const s of spots){if(Math.abs(p.y-s.at.y)>1.2)continue;const d=Math.hypot(p.x-s.at.x,p.z-s.at.z);if(d<bd){bd=d;best=s;}}
   return best?{kind:best.kind,label:LABEL[best.kind]}:null;
  },
  play(){window.open(GAME_URL,'_blank','noopener');},
 };
}
