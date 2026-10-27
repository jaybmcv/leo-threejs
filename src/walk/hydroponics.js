import {roomObject} from '../plan/rooms.js';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import fontData from '../assets/helvetiker-bold.json' with {type:'json'};
import {GREENS,SHAPES,blade,orient,paint,stem} from './foliage.js';

// Deck 3's Hydroponic garden A, dressed on foot as a working crop room. The racks, the aisles and the amber floor
// guides stay. Each shelf's six small trays of identical round clusters give way to one shallow nutrient tray planted
// with its bay's crop, and the bays differ: leafy rows (butterhead, red lettuce, kale), upright herbs (basil, mint,
// chives) and a few compact fruiting plants (tomatoes, peppers, strawberries). Each crop is one low-poly plant drawn
// instanced, every copy turned, sized and shaded a little differently. A slim warm-white grow strip runs under both
// lips of each shelf (and of a light frame over the top shelf), a feed line rises at one end of each rack into every
// tray and a return line drops from the other, and both ends carry a tab with the crop's name and a teal status light.
// Applied after the arrival atrium has taken the racks beside its opening (world.js prepareExteriorForWalking), so the
// trays are in the colliders and the walk check. Room frame (Area_d03-farm-1): x -26 (the entry) to 26, z -17 to 17,
// the floor at 0. A rack is 5 m along x and 1.65 m across, its shelves (0.1 thick) at 0.3, 1.18 and 2.06 m and its
// posts at x ±2.4, z ±0.75 from its centre, 2.8 m tall.
const ROOM='Area_d03-farm-1',OLD=/^(Leaf_cluster|Grow_tray)$/,TAU=Math.PI*2;
const HALF=2.5,LIP=.825,TRAY=[4.74,.06,1.46],FILM=[4.62,.006,1.34],TOP=2.76;
// Each crop: the plant drawn, plants a row (two rows a tray, the second staggered), their size range and a tint.
const CROPS={
 butterhead:{label:'BUTTERHEAD',plant:'butterhead',step:.44,size:[.95,1.15]},
 redleaf:{label:'RED LETTUCE',plant:'redleaf',step:.44,size:[.9,1.1]},
 kale:{label:'KALE',plant:'kale',step:.46,size:[.9,1.1]},
 basil:{label:'BASIL',plant:'basil',step:.38,size:[.95,1.15]},
 mint:{label:'MINT',plant:'basil',step:.36,size:[.85,1],tint:[.62,.84,.74]},
 chives:{label:'CHIVES',plant:'chives',step:.3,size:[.9,1.1]},
 tomato:{label:'TOMATO',plant:'tomato',step:.5,size:[.9,1.05]},
 pepper:{label:'PEPPER',plant:'pepper',step:.45,size:[.9,1.05]},
 strawberry:{label:'STRAWBERRY',plant:'strawberry',step:.38,size:[.9,1.1]},
};
// The crop in each bay [rack centre x, z], so no two neighbours match; a rack not listed takes the next in turn.
const BAYS=[[-18,-12,'kale'],[-18,-7,'butterhead'],[-18,7,'basil'],[-18,12,'strawberry'],[-9,-12,'redleaf'],[-9,12,'chives'],
 [0,-12,'tomato'],[0,12,'butterhead'],[9,-12,'basil'],[9,-7,'chives'],[9,7,'redleaf'],[9,12,'pepper'],
 [18,-12,'butterhead'],[18,-7,'kale'],[18,7,'mint'],[18,12,'tomato']];

function random(seed){let s=seed>>>0;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

// The plants, each built once about its base: creased, vertex-coloured blades (foliage.js) and faceted fruit.
const leaf=(len,wid,o)=>blade(len,wid,{segs:2,...o});
// A broad leaf, wide nearly to its blunt tip, in three rows so it reads round rather than as a diamond.
const ROUND=t=>Math.sin(Math.PI*t**.75)**.5,broad=(len,wid,o)=>blade(len,wid,{segs:3,shape:ROUND,...o});
const fruit=(geo,[x,y,z],color)=>paint(geo.translate(x,y,z),color);
const PLANTS={
 // A loose rosette of broad cupped leaves round a paler heart.
 butterhead(out){
  for(let i=0;i<6;i++)out.push(orient(broad(.22,.22,{fold:.45,droop:.3,base:GREENS.mid,mid:GREENS.pale,tip:GREENS.lime}),[0,.02,0],i/6*TAU,.38,0));
  for(let i=0;i<2;i++)out.push(orient(broad(.15,.17,{fold:.9,droop:0,base:GREENS.lime,mid:GREENS.cream,tip:GREENS.pale}),[0,.03,0],i*Math.PI+.6,.95,0));
 },
 // Broad leaves, green at the stem and wine red at the edges, alternately low and raised.
 redleaf(out){for(let i=0;i<8;i++)out.push(orient(broad(.21+.04*(i%2),.2,{fold:.5,droop:.3,base:0x6f9a48,mid:0x8a5a4a,tip:0x7a2a3a,edge:0x8b3346}),[0,.02,0],i/8*TAU,.5+.35*(i%2),0));},
 // Tall, ruffled blue-green leaves from an upright crown.
 kale(out){for(let i=0;i<6;i++)out.push(orient(blade(.4,.2,{segs:3,shape:SHAPES.lance,fold:.6,droop:.5,base:0x2f5a48,mid:0x6d9a84,tip:0x46725f}),[0,.02,0],i/6*TAU+(i%2)*.3,1+.2*(i%2),0));},
 // A bushy herb: glossy pointed leaves in three tiers, spreading below and rising smaller toward the top.
 basil(out){[[5,.19,.25,.05],[4,.15,.5,.14],[3,.11,.8,.22]].forEach(([n,len,lift,y],t)=>{for(let i=0;i<n;i++)out.push(orient(leaf(len,len*.72,{shape:SHAPES.oval,fold:.35,droop:.25,base:GREENS.mid,mid:GREENS.bright,tip:GREENS.lime}),[0,y,0],i/n*TAU+t*.7,lift,0));});},
 // A bunch of fine upright blades, splaying a little.
 chives(out){for(let i=0;i<9;i++){const yaw=i/9*TAU;out.push(orient(leaf(.34+.05*(i%3),.035,{shape:SHAPES.lance,fold:.15,droop:.1,base:GREENS.dark,mid:GREENS.mid,tip:GREENS.bright}),[Math.cos(yaw)*.025,0,Math.sin(yaw)*.025],yaw,1.18+.08*(i%3),0));}},
 // A short stem with toothed leaves at every height and a truss of fruit ripening from green to red.
 tomato(out){
  out.push(stem([[0,0,0],[.015,.24,0],[0,.48,.015]],.011,GREENS.dark,3));
  for(let i=0;i<10;i++)out.push(orient(leaf(.22-i*.01,.12,{shape:SHAPES.lance,fold:.35,droop:.45,base:GREENS.deep,mid:GREENS.mid,tip:GREENS.dark}),[0,.08+i*.04,0],i*2.4,.45,0));
  for(const [p,c] of [[[.12,.2,.03],0xd8442e],[[-.07,.27,.11],0xd8442e],[[.04,.33,-.12],0xe8862a],[[-.11,.16,-.05],0x9fbf55],[[.08,.12,-.08],0xd8442e]])out.push(fruit(new T.OctahedronGeometry(.045,0),p,c));
 },
 // Glossy oval leaves on a short stem, with red, yellow and orange fruit hanging among them.
 pepper(out){
  out.push(stem([[0,0,0],[0,.19,.015],[.015,.38,0]],.012,GREENS.dark,3));
  for(let i=0;i<9;i++)out.push(orient(leaf(.18,.12,{shape:SHAPES.oval,fold:.3,droop:.3,base:GREENS.dark,mid:GREENS.bright,tip:GREENS.mid}),[0,.1+i*.035,0],i*2.4,.35,0));
  for(const [p,c] of [[[.12,.19,0],0xd8342e],[[-.07,.24,.11],0xf2c230],[[-.04,.17,-.12],0xe8862a]])out.push(fruit(new T.OctahedronGeometry(1,0).scale(.036,.066,.036),p,c));
 },
 // A low clump of rounded leaves with red berries lying out round its edge.
 strawberry(out){
  for(let i=0;i<7;i++)out.push(orient(broad(.16,.16,{fold:.35,droop:.35,base:GREENS.dark,mid:GREENS.mid,tip:GREENS.deep}),[0,.03,0],i/7*TAU,.6+.25*(i%2),0));
  for(let i=0;i<5;i++){const a=i/5*TAU+.4;out.push(fruit(new T.OctahedronGeometry(1,0).scale(.028,.038,.028),[Math.cos(a)*.17,.035,Math.sin(a)*.17],0xd8343a));}
 },
};

export function dressHydroponics(ship){
 const room=roomObject(ship,ROOM),fit=room?.getObjectByName('Room_fittings');if(!fit)return false;
 const racks=[];fit.traverse(o=>{if(o.name==='Hydroponic_rack')racks.push(o);});if(!racks.length)return false;
 // The old trays, their clusters and the tray trim (rails and light bars, one mesh for the room) go.
 const old=[];room.traverse(o=>{if(o.isMesh&&(OLD.test(o.name)||o.name==='Refined_grow_lighting'))old.push(o);});
 for(const o of old){o.removeFromParent();o.geometry.dispose();}

 const mat=(name,color,o={})=>new T.MeshStandardMaterial({name:'Hydro_'+name,color,roughness:.6,...o});
 const M={tray:mat('tray',0xd3d8d5,{roughness:.5}),film:mat('nutrient_film',0x2b5856,{roughness:.25}),housing:mat('light_housing',0x39474d,{roughness:.45,metalness:.4}),
  feed:mat('feed_line',0x4a97ab,{roughness:.35,metalness:.2}),drain:mat('return_line',0x56636a,{roughness:.45,metalness:.3}),valve:mat('valve',0x2f3c42,{roughness:.5}),
  tab:mat('crop_label',0xf1eee4,{roughness:.8}),letters:mat('crop_lettering',0x22343c,{roughness:.7}),
  glow:new T.MeshBasicMaterial({name:'Hydro_grow_light',color:0xffe6c0,toneMapped:false}),
  status:new T.MeshBasicMaterial({name:'Hydro_status_light',color:0x4fe3cf,toneMapped:false}),
  crops:new T.MeshStandardMaterial({name:'Hydro_crops',color:0xffffff,vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:.75})};
 const group=new T.Group();group.name='Hydroponic_garden_dressing';fit.add(group);
 const parts=new Map();
 const put=(name,material,g)=>{const k=name+'|'+material.name;let p=parts.get(k);if(!p)parts.set(k,p={name,material,list:[]});
  g=g.index?g.toNonIndexed():g;for(const n of Object.keys(g.attributes))if(!['position','normal','uv'].includes(n))g.deleteAttribute(n);p.list.push(g);};
 const box=(name,m,[w,h,d],[x,y,z])=>put(name,m,new T.BoxGeometry(w,h,d).translate(x,y,z));
 const pipe=(name,m,r,a,b,seg=8)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),g=new T.CylinderGeometry(r,r,va.distanceTo(vb),seg);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),vb.clone().sub(va).normalize()));put(name,m,g.translate(...va.add(vb).multiplyScalar(.5).toArray()));};
 const font=new FontLoader().parse(fontData);
 // A line of lettering centred on the origin in its plane (facing +z), no wider than maxW.
 const lettering=(text,size,maxW)=>{const g=new T.ShapeGeometry(font.generateShapes(text,size),2);g.computeBoundingBox();const b=g.boundingBox,k=Math.min(1,maxW/(b.max.x-b.min.x));
  return g.translate(-(b.min.x+b.max.x)/2,-(b.min.y+b.max.y)/2,0).scale(k,k,1);};
 const plants=new Map(),order=Object.keys(CROPS);
 racks.forEach((rack,i)=>{
  const shelves=rack.children.filter(o=>o.name==='Shelf').sort((a,b)=>a.position.y-b.position.y);if(!shelves.length)return;
  const {x:X,z:Z}=shelves[0].position,levels=shelves.map(o=>o.position.y);
  const kind=BAYS.find(([x,z])=>Math.abs(x-X)<.5&&Math.abs(z-Z)<.5)?.[2]||order[i%order.length],crop=CROPS[kind],r=random(4100+i*37);
  levels.forEach((y,l)=>{
   // The tray on the shelf, its nutrient film just proud of the rim, and the crop in two staggered rows.
   const top=y+.05,film=top+TRAY[1]+FILM[1]/2-.002;
   box('Hydro_tray',M.tray,TRAY,[X,top+TRAY[1]/2,Z]);box('Hydro_nutrient_film',M.film,FILM,[X,film,Z]);
   const n=Math.floor(4.22/crop.step)+1,stage=.85+r()*.2;
   for(const [row,dz] of [[0,-.33],[1,.33]])for(let k=0;k<n-row;k++){
    const s=(crop.size[0]+(crop.size[1]-crop.size[0])*r())*stage,shade=.88+r()*.2,t=crop.tint||[1,1,1];
    let list=plants.get(crop.plant);if(!list)plants.set(crop.plant,list=[]);
    list.push({p:[X+(k-(n-1)/2+row/2)*crop.step+(r()-.5)*.05,film+FILM[1]/2,Z+dz+(r()-.5)*.05],yaw:r()*TAU,s,c:t.map(v=>v*shade)});
   }
   // Grow strips under both lips of the shelf above (or of the light frame over the top shelf).
   const under=l+1<levels.length?levels[l+1]-.05:TOP-.0175;
   for(const sz of [-1,1]){const z=Z+sz*(l+1<levels.length?LIP-.12:.62);
    if(l+1<levels.length)box('Hydro_light_housing',M.housing,[4.66,.018,.055],[X,under-.009,z]);
    box('Hydro_grow_light',M.glow,[4.6,.008,.042],[X,under-(l+1<levels.length?.022:.004),z]);}
  });
  // The light frame over the top shelf: a crossbar between each end's posts, and a bar along each side.
  for(const sx of [-1,1])box('Hydro_light_frame',M.housing,[.05,.04,1.5],[X+sx*2.4,TOP,Z]);
  for(const sz of [-1,1])box('Hydro_light_frame',M.housing,[4.75,.035,.05],[X,TOP,Z+sz*.62]);
  // Feed line at the -x end, rising past every tray with a valve and status light at each; return line at the +x end.
  const ends=[[-1,M.feed,'Hydro_feed_line',.5,.022],[1,M.drain,'Hydro_return_line',-.5,.024]];
  for(const [sx,m,name,dz,rad] of ends){
   const x=X+sx*(HALF+.07),z=Z+dz,yTop=levels.at(-1)+.09;
   pipe(name,m,rad,[x,0,z],[x,yTop,z]);put(name,m,new T.CylinderGeometry(rad*2,rad*2,.02,10).translate(x,.01,z));
   for(const y of levels){const yy=y+.09;pipe(name,m,rad*.65,[x,yy,z],[X+sx*(TRAY[0]/2-.02),yy,z],6);
    if(sx<0){box('Hydro_valve',M.valve,[.055,.055,.055],[x,yy,z]);box('Hydro_status_light',M.status,[.004,.016,.016],[x-.03,yy,z]);}}
  }
  // A tab on each end of the middle shelf, clear of that end's line: the crop's name with a teal status light on the
  // reader's left (-z at the -x end, +z at the +x end).
  const mid=levels[Math.min(1,levels.length-1)]-.005,label=lettering(crop.label,.048,.36);
  for(const sx of [-1,1]){
   const face=X+sx*(HALF+.013),zc=Z+sx*.12;
   box('Hydro_crop_label',M.tab,[.012,.13,.5],[X+sx*(HALF+.006),mid,zc]);
   box('Hydro_status_light',M.status,[.004,.026,.026],[face+sx*.002,mid,zc+sx*.205]);
   put('Hydro_crop_lettering',M.letters,label.clone().rotateY(sx*Math.PI/2).translate(face+sx*.001,mid,zc-sx*.03));
  }
  label.dispose();
 });
 for(const {name,material,list} of parts.values()){const o=new T.Mesh(mergeGeometries(list),material);o.name=name;o.receiveShadow=true;
  if(name!=='Hydro_tray'&&!/_line$/.test(name))o.userData.noCollide=true;group.add(o);list.forEach(g=>g.dispose());}
 // One instanced mesh a plant, so the ~1,000 plants are a handful of draws.
 const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3(),sc=new T.Vector3(),c=new T.Color();
 for(const [kind,list] of plants){
  const out=[];PLANTS[kind](out);const geo=mergeGeometries(out);out.forEach(g=>g.dispose());
  const mesh=new T.InstancedMesh(geo,M.crops,list.length);mesh.name='Hydro_crop_'+kind;mesh.receiveShadow=true;
  list.forEach(({p,yaw,s,c:[cr,cg,cb]},j)=>{mesh.setMatrixAt(j,m.compose(v.set(...p),q.setFromEuler(e.set(0,yaw,0)),sc.set(s,s*(.9+(j%5)*.05),s)));mesh.setColorAt(j,c.setRGB(cr,cg,cb));});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
 }
 return racks.length;
}
