import{communityDisplayParts}from'./community-displays.js';
import {removeGeometryCaps} from './geometry.js';
import {walkCanvas} from '../walk/canvas.js';
import {arrivalArtWall} from './phase4-community.js';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {phase4Programme} from './phase4-programme.js';
import {meshTriangles} from '../walk/collision.js';
import {groundMesh} from './ground.js';
function removeTopCap(g){g.computeBoundingBox();const p=g.attributes.position,ix=g.index,top=g.boundingBox.max.y,keep=[];for(let i=0;i<ix.count;i+=3){const ids=[0,1,2].map(k=>ix.getX(i+k));if(!ids.every(id=>Math.abs(p.getY(id)-top)<1e-7))keep.push(...ids);}g.setIndex(keep);g.clearGroups();}
const colours={resident:0xbd826d,oak:0xb9966f,cream:0xe4e5de,teal:0x357b82,sage:0x637e64,clay:0x996954,navy:0x172e3b,metal:0x8d9da2,orange:0xe88032,green:0x507c50,light:0xffedca,screen:0x234b67,water:0x469ba7},mats=new Map();
const atriumGlass=new T.MeshStandardMaterial({name:'P4_atrium_glass',color:0x9abcc6,transparent:true,opacity:.20,roughness:.3,side:T.DoubleSide});
function material(name){if(!mats.has(name))mats.set(name,new T.MeshStandardMaterial({name:'P4_'+name,color:colours[name],roughness:name==='metal'?.42:.72,metalness:name==='metal'?.45:0,...(['light','screen'].includes(name)?{emissive:colours[name],emissiveIntensity:name==='light'?1:.45}:{})}));return mats.get(name);}
export function buildPhase4Fitout(ship,layout){
 if(ship.v2Phase4)return ship.v2Phase4;
 const root=new T.Group();root.name='V2_phase4_fitouts';root.userData={stage:2};
 const data=phase4Programme(layout);data.parts.push(...communityDisplayParts(layout));const batches=new Map(),mount=arrivalArtWall();data.parts.push({part:'arrival_display_wall',size:[.10,3.28,2.6],at:[mount[0]-.10,layout.decks[1].y+1.64,mount[2]],yaw:0,mat:'navy',room:'circulation-2',deck:2});
 const signs=new Map();for(const p of data.parts.filter(p=>p.text)){let a=signs.get(p.deck);if(!a)signs.set(p.deck,a=[]);a.push(p);}const signMaterials=new Map();for(const[deck,all]of signs)for(let first=0;first<all.length;first+=32){const list=all.slice(first,first+32),atlas=deck+':'+first,c=walkCanvas();c.width=1024;c.height=128*list.length;const ctx=c.getContext('2d');ctx.fillStyle='#142d39';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#f6dfb7';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 40px sans-serif';list.forEach((p,i)=>{const lines=p.text.split('\n');ctx.font='bold '+(lines.length>1?26:40)+'px sans-serif';lines.forEach((line,j)=>ctx.fillText(line,512,i*128+64+(j-(lines.length-1)/2)*32,990));p.signRow=i;p.signRows=list.length;p.signAtlas=atlas;});if(typeof c.data==='function')Object.defineProperty(c,'data',{value:undefined});const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;signMaterials.set(atlas,new T.MeshStandardMaterial({name:'P4_menu_deck_'+deck+'_'+first,map:tx,roughness:.7}));}
 for(const p of data.parts){
  if(p.text){const g=new T.BoxGeometry(...p.size),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setY(i,1-(p.signRow+1)/p.signRows+uv.getY(i)/p.signRows);const o=new T.Mesh(g,signMaterials.get(p.signAtlas));o.name='P4_menu_sign';o.position.set(...p.at);o.rotation.y=p.yaw;o.userData={noCollide:true,room:p.room,v2Deck:p.deck,phase4:true};root.add(o);continue;}
  const key=[p.deck,p.part,p.mat,p.size.join(','),!!p.round,!!p.noCollide].join('|');let b=batches.get(key);if(!b)batches.set(key,b={...p,list:[]});b.list.push(p);
 }
 for(const b of batches.values()){
  const geo=b.part==='p6_tree_crown'?new T.IcosahedronGeometry(1,1).scale(...b.size.map(x=>x/2)):b.part==='p6_tree_trunk'?new T.CylinderGeometry(.16,.22,b.size[1],7):b.round?new RoundedBoxGeometry(...b.size,1,Math.min(.08,...b.size.map(x=>x/4))):new T.BoxGeometry(...b.size),o=new T.InstancedMesh(geo,(b.mat==='glass'?atriumGlass:material(b.mat)),b.list.length);o.name='P4_'+b.part;if(/shuttle_(side_wall|bow_bulkhead|stern_wall)/.test(b.part))removeGeometryCaps(geo,1);if(b.part==='shuttle_side_wall')removeGeometryCaps(geo,0);if(/shuttle_.*wall_header/.test(b.part)){removeGeometryCaps(geo,2);removeTopCap(geo);}
  b.list.forEach((p,i)=>o.setMatrixAt(i,new T.Matrix4().compose(new T.Vector3(...p.at),new T.Quaternion().setFromEuler(new T.Euler(0,p.yaw,p.roll||0)),new T.Vector3(1,1,1))));o.computeBoundingBox();o.computeBoundingSphere();
  const ownerRuns=[];b.list.forEach((p,i)=>{const last=ownerRuns.at(-1),component=p.component||p.room;if(last&&last.room===p.room&&last.component===component)last.count++;else ownerRuns.push({start:i,count:1,room:p.room,component});});o.userData={phase4:true,v2Deck:b.deck,noCollide:!!b.noCollide,roomOwners:[...new Set(b.list.map(p=>p.room))],ownerRuns};root.add(o);
 }
 // Full-height internal glazing at the terrace's atrium end; exterior skin is untouched.
 for(const r of layout.rooms.filter(r=>/^neighborhood-\d+-(dining|cafe)$/.test(r.id))){const g=ship.inside.getObjectByName('V2_shell_'+r.id),edge=r.id.endsWith('dining')?-18:18;for(const o of g?.children||[]){if(!o.isMesh||!o.name.includes('wall'))continue;const b=new T.Box3().setFromObject(o,true);if(Math.abs(b.getCenter(new T.Vector3()).z-edge)<.1){o.material=atriumGlass;o.userData.corridorGlass=true;}}}
 const parent=ship.inside.getObjectByName('V2_structure')||ship.inside,byDeck=new Map(),meshes=[...root.children];for(const o of meshes){const n=o.userData.v2Deck;let d=byDeck.get(n);if(!d){d=new T.Group();d.name='V2_phase4_deck_'+n;d.userData={v2Deck:n,phase4:true};byDeck.set(n,d);parent.add(d);}d.add(o);}ship.v2Phase4={roots:[...byDeck.values()],meshes,...data};return ship.v2Phase4;
}
export function addPhase4Colliders(ship,col,ground){
 const p=ship.v2Phase4;if(!p)return;const furnitureShapes=new Map();for(const r of p.roots)r.updateWorldMatrix(true,true);
 // Merge the accepted craft's exact prior solid proxies once. Reuse its rigid BVH at all 100 frames.
 const ships=p.rooms.filter(r=>r.id.includes('-escape-')),byId=new Map(p.parts.filter(r=>r.component).map(r=>[r.component,true])),first=ships[0],craft=first&&p.parts.find(r=>r.component===first.id),solidCraft=[],groundCraft=[];
 const worldToCraft=craft?new T.Matrix4().makeRotationY(-craft.yaw).multiply(new T.Matrix4().makeTranslation(-layoutPoint(first.id)[0],-layoutPoint(first.id)[1],-layoutPoint(first.id)[2])):null;
 function layoutPoint(id){const floor=p.parts.find(q=>q.component===id&&q.part==='shuttle_floor');return[floor.at[0],floor.at[1]-.066,floor.at[2]];}
 for(const o of p.meshes){if(!o.isInstancedMesh||o.userData.noCollide)continue;
  const proxy=new T.Mesh(o.geometry,o.material),triangles=[];proxy.updateMatrixWorld(true);meshTriangles(proxy,triangles);
  const matrices=[],owners=[];for(const run of o.userData.ownerRuns)for(let i=run.start;i<run.start+run.count;i++){
   const m=new T.Matrix4();o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);
   if(byId.has(run.component)){
    if(run.component===first.id){const verts=[],q=new T.Mesh(o.geometry,o.material);meshTriangles(q,verts,worldToCraft.clone().multiply(m));solidCraft.push(...verts);if(groundMesh(o))groundCraft.push(...verts);}continue;
   }
   matrices.push(m);owners.push(run.component);
  }
  if(!matrices.length)continue;
  const walkable=groundMesh(o),key=(walkable?'ground|':'barrier|')+triangles.join(',');let shape=furnitureShapes.get(key);if(!shape)furnitureShapes.set(key,shape={triangles,matrices:[],owners:[],walkable});shape.matrices.push(...matrices);shape.owners.push(...owners);
 }
 let shapeIndex=0;for(const shape of furnitureShapes.values()){const name='P4_furniture_shape_'+shapeIndex++,group=col.addInstances(name,shape.triangles,shape.matrices);group.items.forEach((it,i)=>it.owner=shape.owners[i]);if(shape.walkable){const g=ground.addInstances(name,shape.triangles,shape.matrices);g.items.forEach((it,i)=>it.owner=shape.owners[i]);}}
 if(first){const matrices=ships.map(s=>{const floor=p.parts.find(q=>q.component===s.id&&q.part==='shuttle_floor');return new T.Matrix4().compose(new T.Vector3(...layoutPoint(s.id)),new T.Quaternion().setFromEuler(new T.Euler(0,floor.yaw,0)),new T.Vector3(1,1,1));}),body=col.addInstances('P4_escape_craft',solidCraft,matrices),floor=ground.addInstances('P4_escape_craft_ground',groundCraft,matrices);body.items.forEach((it,i)=>it.owner=ships[i].id);floor.items.forEach((it,i)=>it.owner=ships[i].id);p.collision={crafts:ships.length,bodyClasses:1,groundClasses:1,bodyInstances:body.items.length,groundInstances:floor.items.length,bodyTriangles:solidCraft.length/9,groundTriangles:groundCraft.length/9};}
}
