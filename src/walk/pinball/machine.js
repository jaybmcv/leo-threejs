import {roomObject} from '../../plan/rooms.js';
import {walkCanvas,hasWalkCanvas} from '../canvas.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {W,H} from './rules.js';
import {drawTable,drawBackglass} from './art.js';

// The pinball machine in the Deck 16 Recreation Hall (from tester feedback): against the hall's end wall under its name,
// on the hall's centre line, facing the door down the aisle, past the end of Paw Pool's table and clear of the tables
// either side. A navy cabinet on chrome legs, the game's own table under the glass (art.js), a lit backglass, flipper
// buttons and a plunger. E in front opens the game (game.js). Everything is the walk's own: the ship's models and
// exports are unchanged. Room frame (Area_d16-recreation-4): the end wall's face at x=25.84 (its name panel above
// 2.2 m), the aisle between z=±2, the nearest tables' chairs out to x=16.7 at z=±7.75.
const ROOM='Area_d16-recreation-4',WALL=25.84,Z=0,REACH=1.3;
// The cabinet: width, length, the body's depth and its tilt (back up), the backbox's width, height and depth.
const CAB={w:.74,l:1.36,body:.36,tilt:.07,y:.76,box:{w:.76,h:.74,d:.22}};

function texture(w,h,draw){const c=walkCanvas();c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}

// The machine, placed in `ship`'s Recreation Hall. Returns {group, solid, spot, near} in ship coordinates, or null if
// the room is missing.
export function createPinballMachine(ship){
 const room=roomObject(ship,ROOM);if(!room||!hasWalkCanvas())return null;
 room.updateWorldMatrix(true,false);
 const group=new T.Group();group.name='Recreation_pinball';room.matrixWorld.decompose(group.position,group.quaternion,group.scale);
 const solid=new T.Group();solid.name='Recreation_pinball_collider';room.matrixWorld.decompose(solid.position,solid.quaternion,solid.scale);
 // The machine's own frame: x across it, y up, z toward the player; its back at the wall, facing the door (-x).
 const at=new T.Matrix4().makeRotationY(-Math.PI/2).setPosition(WALL-.02-CAB.l/2,0,Z);
 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Pinball_'+name,color,roughness:.55,...o});
 const M={body:mat('body',0x1d3550),side:mat('side_art',0x233b4b),chrome:mat('chrome',0xc9d2d8,{roughness:.25,metalness:.85}),dark:mat('dark',0x10141b),
  orange:mat('orange',0xf85800,{emissive:0xf85800,emissiveIntensity:.35}),teal:new T.MeshBasicMaterial({name:'Pinball_neon',color:0x2fd6c5,toneMapped:false}),
  glass:new T.MeshStandardMaterial({name:'Pinball_glass',color:0xd8f2ff,transparent:true,opacity:.12,roughness:.05,metalness:.2,depthWrite:false}),
  field:new T.MeshBasicMaterial({name:'Pinball_table',map:texture(W*4,H*4,(x)=>drawTable(x,4)),toneMapped:false}),
  back:new T.MeshBasicMaterial({name:'Pinball_backglass',map:texture(512,512,drawBackglass),toneMapped:false})};
 const parts=new Map();
 const piece=(m,geo,tilted=false)=>{if(tilted)geo.applyMatrix4(tilt);geo.applyMatrix4(at);(parts.get(m)||parts.set(m,[]).get(m)).push(geo.index?geo.toNonIndexed():geo);};
 const box=(m,[w,h,d],[x,y,z],tilted)=>piece(m,new T.BoxGeometry(w,h,d).translate(x,y,z),tilted);
 const rod=(m,r,[ax,ay,az],[bx,by,bz])=>{const a=new T.Vector3(ax,ay,az),b=new T.Vector3(bx,by,bz),geo=new T.CylinderGeometry(r,r,a.distanceTo(b),10);
  geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));geo.translate(...a.add(b).multiplyScalar(.5).toArray());piece(m,geo);};
 // The body, tilted back up: everything built at its centre goes through `tilt`.
 const tilt=new T.Matrix4().makeRotationX(CAB.tilt).setPosition(0,CAB.y,0);
 const {w,l,body}=CAB,top=body/2;
 box(M.body,[w,body,l],[0,0,0],true);
 for(const s of [-1,1]){box(M.side,[.01,body*.7,l*.86],[s*(w/2+.005),0,0],true);box(M.chrome,[.05,.03,l],[s*(w/2-.02),top+.015,0],true);box(M.teal,[.006,.012,l*.8],[s*(w/2+.012),-top*.4,0],true);}
 // The table under the glass, its top end at the back; the lockdown bar across the front.
 piece(M.field,new T.PlaneGeometry(w-.1,l-.12).rotateX(-Math.PI/2).translate(0,top+.002,.01),true);
 piece(M.glass,new T.PlaneGeometry(w-.08,l-.08).rotateX(-Math.PI/2).translate(0,top+.03,0),true);
 box(M.chrome,[w,.04,.07],[0,top+.02,l/2-.035],true);
 // The coin door on the front, flipper buttons on the sides near the front, the plunger at the front right.
 box(M.dark,[.3,.2,.01],[0,-.02,l/2+.005],true);box(M.orange,[.04,.06,.012],[-.05,-.01,l/2+.01],true);box(M.orange,[.04,.06,.012],[.05,-.01,l/2+.01],true);
 for(const s of [-1,1])piece(M.orange,new T.CylinderGeometry(.018,.018,.025,12).rotateZ(Math.PI/2).translate(s*(w/2+.012),top*.3,l/2-.1),true);
 piece(M.chrome,new T.CylinderGeometry(.012,.012,.12,8).rotateX(Math.PI/2).translate(w/2-.09,top*.25,l/2+.06),true);
 piece(M.orange,new T.SphereGeometry(.025,12,8).translate(w/2-.09,top*.25,l/2+.12),true);
 // Chrome legs from the floor to the body's underside at each corner, with levelers.
 const under=new T.Vector3();
 for(const sx of [-1,1])for(const sz of [-1,1]){under.set(sx*(w/2-.05),-top,sz*(l/2-.07)).applyMatrix4(tilt);
  rod(M.chrome,.025,[under.x,0,under.z],[under.x,under.y,under.z]);box(M.dark,[.07,.02,.07],[under.x,.01,under.z]);}
 // The backbox: standing on the body's back end, its lit glass facing the player, a neon line round it.
 const back=new T.Vector3(0,top,-l/2+CAB.box.d/2).applyMatrix4(tilt),{w:bw,h:bh,d:bd}=CAB.box,by=back.y+bh/2;
 box(M.body,[bw,bh,bd],[0,by,back.z]);box(M.dark,[bw-.06,bh-.06,.01],[0,by,back.z+bd/2+.002]);
 piece(M.back,new T.PlaneGeometry(bw-.08,bh-.08).translate(0,by,back.z+bd/2+.008));
 box(M.teal,[bw+.01,.015,.015],[0,by+bh/2+.008,back.z+bd/2]);for(const s of [-1,1])box(M.teal,[.015,bh,.015],[s*(bw/2+.008),by,back.z+bd/2]);
 for(const [m,gs] of parts){const o=new T.Mesh(mergeGeometries(gs),m);o.name=m.name;o.castShadow=m===M.body||m===M.chrome;o.receiveShadow=m!==M.teal&&m!==M.back&&m!==M.field;gs.forEach(g=>g.dispose());group.add(o);}
 // Solid as one plain box round the cabinet and its backbox.
 {const geo=new T.BoxGeometry(w+.04,by+bh/2,l).translate(0,(by+bh/2)/2,0).applyMatrix4(at);solid.add(new T.Mesh(geo));}
 group.updateMatrixWorld(true);solid.updateMatrixWorld(true);
 // Where a player stands to play: in front of the lockdown bar.
 const spot=group.localToWorld(new T.Vector3(0,0,l/2+.4).applyMatrix4(at)),floor=spot.y;
 return {group,solid,spot,
  near(p){if(Math.abs(p.y-floor)>1.5)return null;return Math.hypot(p.x-spot.x,p.z-spot.z)<REACH?{kind:'pinball',label:'Play Leo Pinball'}:null;},
 };
}
