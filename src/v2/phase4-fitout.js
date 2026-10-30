import {removeGeometryCaps} from './geometry.js';
import {walkCanvas} from '../walk/canvas.js';
import {arrivalArtWall} from './phase4-community.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {phase4Programme} from './phase4-programme.js';
import {meshTriangles} from '../walk/collision.js';
import {groundMesh} from './ground.js';
function removeTopCap(g){g.computeBoundingBox();const p=g.attributes.position,ix=g.index,top=g.boundingBox.max.y,keep=[];for(let i=0;i<ix.count;i+=3){const ids=[0,1,2].map(k=>ix.getX(i+k));if(!ids.every(id=>Math.abs(p.getY(id)-top)<1e-7))keep.push(...ids);}g.setIndex(keep);g.clearGroups();}
const colours={oak:0xb9966f,cream:0xe4e5de,teal:0x357b82,navy:0x172e3b,metal:0x8d9da2,orange:0xe88032,green:0x507c50,light:0xffedca,screen:0x234b67,water:0x469ba7},mats=new Map();
function material(name){if(!mats.has(name))mats.set(name,new T.MeshStandardMaterial({name:'P4_'+name,color:colours[name],roughness:name==='metal'?.42:.72,metalness:name==='metal'?.45:0,...(['light','screen'].includes(name)?{emissive:colours[name],emissiveIntensity:name==='light'?1:.45}:{})}));return mats.get(name);}
export function buildPhase4Fitout(ship,layout){
 if(ship.v2Phase4)return ship.v2Phase4;
 const root=new T.Group();root.name='V2_phase4_prototypes';root.userData={stage:1};
 const data=phase4Programme(layout),batches=new Map(),mount=arrivalArtWall();data.parts.push({part:'arrival_display_wall',size:[.10,3.28,2.6],at:[mount[0]-.10,layout.decks[1].y+1.64,mount[2]],yaw:0,mat:'navy',room:'circulation-2',deck:2});
 for(const p of data.parts){
  if(p.text){const c=walkCanvas();c.width=1024;c.height=160;const ctx=c.getContext('2d');ctx.fillStyle='#142d39';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#f6dfb7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 46px sans-serif';ctx.fillText(p.text,512,80,990);if(typeof c.data==='function')Object.defineProperty(c,'data',{value:undefined});const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;const o=new T.Mesh(new T.BoxGeometry(...p.size),new T.MeshStandardMaterial({name:'P4_menu_'+p.room,map:tx,roughness:.7}));o.name='P4_menu_sign';o.position.set(...p.at);o.rotation.y=p.yaw;o.userData={noCollide:true,room:p.room,v2Deck:p.deck,phase4:true};root.add(o);continue;}
  const key=[p.deck,p.part,p.mat,p.size.join(','),!!p.round,!!p.noCollide].join('|');let b=batches.get(key);if(!b)batches.set(key,b={...p,list:[]});b.list.push(p);
 }
 for(const b of batches.values()){
  const geo=b.round?new RoundedBoxGeometry(...b.size,1,Math.min(.08,...b.size.map(x=>x/4))):new T.BoxGeometry(...b.size),o=new T.InstancedMesh(geo,material(b.mat),b.list.length);o.name='P4_'+b.part;if(/shuttle_(side_wall|bow_bulkhead|stern_wall)/.test(b.part))removeGeometryCaps(geo,1);if(b.part==='shuttle_side_wall')removeGeometryCaps(geo,0);if(/shuttle_.*wall_header/.test(b.part)){removeGeometryCaps(geo,2);removeTopCap(geo);}
  b.list.forEach((p,i)=>o.setMatrixAt(i,new T.Matrix4().compose(new T.Vector3(...p.at),new T.Quaternion().setFromEuler(new T.Euler(0,p.yaw,p.roll||0)),new T.Vector3(1,1,1))));o.computeBoundingBox();o.computeBoundingSphere();
  const ownerRuns=[];b.list.forEach((p,i)=>{const last=ownerRuns.at(-1),component=p.component||p.room;if(last&&last.room===p.room&&last.component===component)last.count++;else ownerRuns.push({start:i,count:1,room:p.room,component});});o.userData={phase4:true,v2Deck:b.deck,noCollide:!!b.noCollide,roomOwners:[...new Set(b.list.map(p=>p.room))],ownerRuns};root.add(o);
 }
 // Full-height internal glazing at the terrace's atrium end; exterior skin is untouched.
 for(const r of layout.rooms.filter(r=>/^neighborhood-5-(dining|cafe)$/.test(r.id))){const g=ship.inside.getObjectByName('V2_shell_'+r.id),edge=r.id.endsWith('dining')?-18:18;for(const o of g?.children||[]){if(!o.isMesh||!o.name.includes('wall'))continue;const b=new T.Box3().setFromObject(o,true);if(Math.abs(b.getCenter(new T.Vector3()).z-edge)<.1){o.material=new T.MeshStandardMaterial({name:'P4_atrium_glass',color:0x9abcc6,transparent:true,opacity:.20,roughness:.3,side:T.DoubleSide});o.userData.corridorGlass=true;}}}
 const parent=ship.inside.getObjectByName('V2_structure')||ship.inside,byDeck=new Map(),meshes=[...root.children];for(const o of meshes){const n=o.userData.v2Deck;let d=byDeck.get(n);if(!d){d=new T.Group();d.name='V2_phase4_deck_'+n;d.userData={v2Deck:n,phase4:true};byDeck.set(n,d);parent.add(d);}d.add(o);}ship.v2Phase4={roots:[...byDeck.values()],meshes,...data};return ship.v2Phase4;
}
export function addPhase4Colliders(ship,col,ground){
 const p=ship.v2Phase4;if(!p)return;for(const r of p.roots)r.updateWorldMatrix(true,true);
 for(const o of p.meshes){if(!o.isInstancedMesh||o.userData.noCollide)continue;
  const proxy=new T.Mesh(o.geometry,o.material),triangles=[];proxy.updateMatrixWorld(true);meshTriangles(proxy,triangles);
  const matrices=[];for(let i=0;i<o.count;i++){const m=new T.Matrix4();o.getMatrixAt(i,m);matrices.push(o.matrixWorld.clone().multiply(m));}
  const owner=i=>o.userData.ownerRuns.find(r=>i>=r.start&&i<r.start+r.count).component,group=col.addInstances(o.name,triangles,matrices);group.items.forEach((it,i)=>it.owner=owner(i));if(groundMesh(o)){const g=ground.addInstances(o.name,triangles,matrices);g.items.forEach((it,i)=>it.owner=owner(i));}
 }
}
