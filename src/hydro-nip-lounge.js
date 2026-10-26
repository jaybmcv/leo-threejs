import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from './assets/helvetiker-bold.json' with {type:'json'};
import {canvasTexture,seeded} from './polish-kit.js';

// The Hydro-Nip Lounge (feedback-inbox #58, HYDRO_NIP_LOUNGE.md): a catnip lounge in Neighborhood 1's garden commons,
// concept by Tochtli. Built in the commons template's own frame (x 109.5-154.5, z 8-46, floor 24.3); the commons root
// moves it into place and mirrors it across the centreline (`mirror` -1), so lettering is mirrored back where it is
// made. The garden middle gives way to it; galleries, stairs and shared services stay.
// Phase 1 dressed it; phase 2 makes the Haze Maze and the hammock dome walkable, and phase 3 slides their doors open and
// lets you lie in the hammocks (the walk's side is src/walk/lounge.js).
// Neon, glass, mist and light are merged per material here (the walk leaves glowing and see-through meshes unmerged);
// seats, hammocks and doors stay separate meshes, named as the walk expects.
const FLOOR=24.3,CEILING=35.65,LEVELS=[28.3,32.3],ROOM={x0:109.5,x1:154.5,z0:8,z1:46};
const DOME={x:134,z:25,r:6.5},MAZE={x0:114,x1:120.5,z0:19,z1:33,top:35.2},MUNCH={x:145.5,z:25};
// The maze inside: a ground floor of 3 x 6 roomy cells, walled to chest height so you and the camera see over the
// partitions (behind the last row, z 31.5-32.9, the first stair's foot), the lower platform in front of SPLIT and the
// upper one behind it, each at its gallery's height, so a level glass tube runs from each to its gallery: the lower to
// the front gallery, the upper to the rear one.
const CELLS={x0:114.1,z0:19.1,w:2.1,d:12.4/6,cols:3,rows:6},SPLIT=CELLS.z0+4*CELLS.d;
const TUBES=[{x:119.4,level:LEVELS[0],from:MAZE.z0,to:12},{x:118,level:LEVELS[1],from:MAZE.z1,to:42}],TUBE={r:1.35,floor:1,half:.95};
// The ground floor's one way through (cells [col,row]; row 0 at the door, which opens on cell 1).
const PASSAGES=[[[1,0],[2,0]],[[2,0],[2,1]],[[2,1],[2,2]],[[2,2],[2,3]],[[2,3],[1,3]],[[1,3],[1,4]],[[1,4],[0,4]],[[0,4],[0,5]],[[0,5],[1,5]],
 // and its dead end
 [[1,0],[0,0]],[[0,0],[0,1]],[[0,1],[1,1]],[[1,1],[1,2]],[[1,2],[0,2]],[[0,2],[0,3]]];
// The first stair's flight fills the last two cells of column 2.
const STAIR_CELLS=new Set(['2,4','2,5']);
// Where the walk finds the lounge's parts (src/walk/lounge.js), in the template frame.
export const LOUNGE={FLOOR,CEILING,LEVELS,ROOM,DOME,MAZE,SPLIT,TUBES};
const PINK=0xff4fd8,CYAN=0x45e3ff,GREEN=0x6dff7a,PURPLE=0xa77bff,AMBER=0xffc266,BLACKLIGHT=0x8a4dff;
const font=new FontLoader().parse(fontData);

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

// Each tube lands on a gallery through a gap in its railing (model.js rail(): a Handrail tube and Balusters): the
// handrail is split round the gap and the balusters in it go.
export function openRails(root){
 root.updateMatrixWorld(true);
 const gaps=TUBES.map(t=>({z:t.to,y:t.level,x0:t.x-TUBE.r-.05,x1:t.x+TUBE.r+.05})),gone=[],added=[];
 const hit=(g,b)=>Math.abs((b.min.z+b.max.z)/2-g.z)<.3&&b.max.x>g.x0&&b.min.x<g.x1;
 root.traverse(o=>{
  if(!o.isMesh)return;
  if(o.name==='Baluster'){const p=o.position;for(const g of gaps)if(Math.abs(p.z-g.z)<.3&&Math.abs(p.y-(g.y+.55))<.2&&p.x>g.x0-.1&&p.x<g.x1+.1)gone.push(o);}
  if(o.name==='Handrail'){o.geometry.computeBoundingBox();const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrix);
   for(const g of gaps){if(!hit(g,b)||Math.abs(b.max.y-.045-(g.y+1.1))>.1)continue;gone.push(o);
    for(const [xa,xb] of [[b.min.x,g.x0],[g.x1,b.max.x]])if(xb-xa>.1){
     const piece=new T.Mesh(new T.TubeGeometry(new T.LineCurve3(new T.Vector3(xa,g.y+1.1,g.z),new T.Vector3(xb,g.y+1.1,g.z)),8,.045,6,false),o.material);
     piece.name='Handrail';piece.castShadow=piece.receiveShadow=true;added.push([o.parent,piece]);
     const post=new T.Mesh(new T.BoxGeometry(.06,1.1,.06),o.material);post.name='Baluster';post.position.set(xa===g.x1?xa:xb,g.y+.55,g.z);added.push([o.parent,post]);}}}
 });
 for(const o of gone)o.removeFromParent();for(const [p,o] of added)p.add(o);
 return gone.length;
}

export function createHydroNipLounge({mirror=1}={}){
 const root=new T.Group();root.name='Hydro_Nip_Lounge';
 root.userData={concept:'Tochtli (Discord tochtli_13)',issue:'feedback-inbox #58',stage:'Phase 1: dressing'};
 const rnd=seeded(58);
 // Materials.
 const std=(name,color,o={})=>new T.MeshStandardMaterial({name,color,roughness:.6,metalness:0,...o});
 // Textures need a canvas: the browser has one. The Node builds (walk plan, checks, model downloads) do not, and do
 // without the additive glows (glTF keeps no blending anyway) and the rug's pattern.
 const canvas=typeof document!=='undefined';
 const glowTex=canvas&&canvasTexture(128,128,(g,w,h)=>{const r=g.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.3,'rgba(255,255,255,.4)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);});
 const mistTex=canvas&&canvasTexture(256,256,(g,w,h)=>{const r=seeded(7);
  for(let i=0;i<46;i++){const x=w*(.15+r()*.7),y=h*(.15+r()*.7),s=18+r()*56,gr=g.createRadialGradient(x,y,0,x,y,s);gr.addColorStop(0,`rgba(255,255,255,${.12+r()*.2})`);gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h);}
  g.globalCompositeOperation='destination-in';const edge=g.createRadialGradient(w/2,h/2,w*.2,w/2,h/2,w/2);edge.addColorStop(0,'rgba(0,0,0,1)');edge.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=edge;g.fillRect(0,0,w,h);});
 // One additive texture for every glow: the soft spot on the left half, the mist on the right.
 const glowAtlas=canvas&&canvasTexture(512,256,(g)=>{g.drawImage(glowTex.image,0,0,256,256);g.drawImage(mistTex.image,256,0,256,256);});if(glowAtlas)glowAtlas.wrapS=glowAtlas.wrapT=T.ClampToEdgeWrapping;
 const rugTex=canvas&&canvasTexture(512,512,(g,w,h)=>{
  g.fillStyle='#3b1f5c';g.fillRect(0,0,w,h);
  for(const [inset,color,width] of [[14,'#d9a441',10],[38,'#1f8a84',16],[66,'#c2407e',6],[86,'#d9a441',4]]){g.strokeStyle=color;g.lineWidth=width;g.strokeRect(inset,inset,w-2*inset,h-2*inset);}
  g.save();g.translate(w/2,h/2);g.rotate(Math.PI/4);for(const [s,c] of [[150,'#1f8a84'],[112,'#c2407e'],[76,'#d9a441'],[40,'#6b3fa3']]){g.fillStyle=c;g.fillRect(-s/2,-s/2,s,s);}g.restore();
  g.fillStyle='rgba(217,164,65,.5)';for(let i=0;i<4;i++)for(let j=0;j<4;j++)if((i===0||i===3||j===0||j===3)){g.beginPath();g.arc(120+i*91,120+j*91,7,0,Math.PI*2);g.fill();}
 });
 // Few materials, colour per vertex: the walk draws each material once per deck band it spans, so the lounge's dozens
 // of colours share a matte, a sheen, a neon, a halo and a glass (plus the mist, the beam and the rugs).
 const shared={
  matte:std('Lounge_matte',0xffffff,{vertexColors:true,roughness:.85}),
  sheen:std('Lounge_sheen',0xffffff,{vertexColors:true,roughness:.32,metalness:.55}),
  // Foliage apart, so its name keeps it from being solid (src/walk/collision.js skips leaves).
  leaf:std('Lounge_catnip_leaf',0xffffff,{vertexColors:true,roughness:.9}),
  neon:new T.MeshBasicMaterial({name:'Lounge_neon_glow',vertexColors:true,toneMapped:false}),
  glow:canvas&&new T.MeshBasicMaterial({name:'Lounge_additive_glow',vertexColors:true,map:glowAtlas,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false}),
  glass:std('Lounge_glass',0xffffff,{vertexColors:true,transparent:true,opacity:.15,roughness:.05,metalness:.1,depthWrite:false,side:T.DoubleSide}),
  rug:canvas?std('Lounge_rug',0xffffff,{map:rugTex,roughness:1}):std('Lounge_rug',0x3b1f5c,{roughness:1}),
  // The maze's partitions: frosted green glass you can't see through clearly, solid to walk into.
  frost:std('Lounge_frosted_glass',0xffffff,{vertexColors:true,transparent:true,opacity:.62,roughness:.55,metalness:0,side:T.DoubleSide}),
 };
 // The mist inside the maze is the glow apart, so the walk can thin it out round a walker inside (src/walk/lounge.js).
 shared.mazeMist=canvas&&Object.assign(shared.glow.clone(),{name:'Lounge_maze_mist'});
 // A paint is a shared material and a colour.
 const paint=(mat,color=0xffffff,{dim=1,uv=null}={})=>shared[mat]?{mat:shared[mat],color:new T.Color(color).multiplyScalar(dim),uv}:null;
 // Additive glows dim by colour; `uv` points each at its half of the atlas (a beam at the bright middle of the spot).
 const glow=(color,dim,uv)=>paint('glow',color,{dim,uv});
 const neon=hex=>paint('neon',hex),halo=hex=>glow(hex,.5,(u,v)=>[u*.5,v]);
 // A loose paint is dressing a walker passes through (hammock ropes, the maze's mist): the walk doesn't collide with it.
 const loose=p=>p&&{...p,loose:true};
 const M={
  glass:paint('glass',0xcfeeff),mazeGlass:paint('glass',0xa8ffbf),mist:glow(0x7dff8e,.55,(u,v)=>[.5+u*.5,v]),mazeMist:loose(paint('mazeMist',0x7dff8e,{dim:.55,uv:(u,v)=>[.5+u*.5,v]})),frost:paint('frost',0x9fe8b0),beam:glow(0x5fc8ff,.2,()=>[.25,.5]),rug:paint('rug'),
  dark:paint('sheen',0x272131),board:paint('sheen',0x16111f),metal:paint('sheen',0xb9c2cc),strut:neon(0x7a5cff),
  wood:paint('matte',0x4a2f22),sisal:paint('matte',0xcdb18a),purple:paint('matte',0x6a3fa3),magenta:paint('matte',0xb03a86),teal:paint('matte',0x23857f),
  leaf:paint('leaf',0x4f9a55),flower:paint('leaf',0xd5c4f2),pot:paint('matte',0xb5653d),
 };
 // Geometry, merged per material at the end. Everything is made in the template frame.
 const lists=new Map();
 const tidy=(g,color,uv)=>{const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();
  for(const k of Object.keys(n.attributes))if(!['position','normal','uv'].includes(k))n.deleteAttribute(k);
  if(!n.attributes.normal)n.computeVertexNormals();if(!n.attributes.uv)n.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(n.attributes.position.count*2),2));
  const c=new Float32Array(n.attributes.position.count*3);for(let i=0;i<c.length;i+=3){c[i]=color.r;c[i+1]=color.g;c[i+2]=color.b;}n.setAttribute('color',new T.BufferAttribute(c,3));
  if(uv){const a=n.attributes.uv;for(let i=0;i<a.count;i++){const [u,v]=uv(a.getX(i),a.getY(i));a.setXY(i,u,v);}}return n;};
 // (Loose paints merge apart, as Lounge_*_loose meshes the walk doesn't collide with.)
 const put=(p,g)=>{if(!p){g.dispose();return;}const key=p.loose?p.mat.name+'|loose':p.mat;(lists.get(key)||lists.set(key,{mat:p.mat,loose:!!p.loose,gs:[]}).get(key)).gs.push(tidy(g,p.color,p.uv));};
 const box=(m,[w,h,d],[x,y,z])=>put(m,new T.BoxGeometry(w,h,d).translate(x,y,z));
 const cyl=(m,rt,rb,h,[x,y,z],seg=12,open=false)=>put(m,new T.CylinderGeometry(rt,rb,h,seg,1,open).translate(x,y,z));
 const ball=(m,r,[x,y,z],detail=1)=>put(m,new T.IcosahedronGeometry(r,detail).translate(x,y,z));
 const UP=new T.Vector3(0,1,0);
 const rod=(m,a,b,r,seg=6)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),g=new T.CylinderGeometry(r,r,d.length(),seg,1,true);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(UP,d.normalize()));put(m,g.translate(...A.add(B).multiplyScalar(.5).toArray()));};
 // Seats keep their own meshes and names (src/walk/rest.js finds Seat, Soft_seat and Meditation_cushion by name).
 const seat=(name,geo,p,[x,y,z])=>{const o=new T.Mesh(tidy(geo,p.color),p.mat);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 // A sliding door: two glass leaves in a dark frame across an opening in the plane z = `z`, `width` wide, shown shut.
 // Each leaf is a glass pane (Lounge_door_panel) and its frame (Lounge_door_frame), meshes of their own that the walk
 // slides apart along `slide` (template frame; src/walk/lounge.js), so neither is solid here: the walk makes each leaf
 // a moving collider, and the checks walk through the opening.
 let doors=0;
 // `pocket`: the side the leaves run on, 1 behind the wall (inside), -1 in front of it.
 function door({x,z,width,height,face,pocket=1}){
  const half=width/2,id=doors++,zz=z-face*pocket*.12;
  box(M.dark,[.12,height+.1,.16],[x-half-.06,FLOOR+(height+.1)/2,z]);box(M.dark,[.12,height+.1,.16],[x+half+.06,FLOOR+(height+.1)/2,z]);box(M.dark,[width+.24,.12,.16],[x,FLOOR+height+.06,z]);
  put(neon(CYAN),new T.TubeGeometry(roundRect(width+.36,height+.24,.2,0),48,.022,4,true).translate(x,FLOOR+(height+.1)/2,z+face*.1));
  for(const s of [-1,1]){
   const at=[x+s*half/2,FLOOR+height/2,zz],data={door:id,slide:[s*(half+.07),0,0],size:[half,height,.06]};
   const glassPane=new T.Mesh(tidy(new T.BoxGeometry(half-.1,height-.1,.03),new T.Color(0xa8ffbf)),shared.glass);
   const rim=[[half,.06,.06,0,(height-.06)/2],[half,.06,.06,0,-(height-.06)/2],[.06,height,.06,(half-.06)/2,0],[.06,height,.06,-(half-.06)/2,0]].map(([w,hh,d,dx,dy])=>new T.BoxGeometry(w,hh,d).translate(dx,dy,0));
   // A green pull down the meeting edge.
   rim.push(new T.BoxGeometry(.03,.9,.08).translate(-s*(half/2-.12),0,0));
   const frame=new T.Mesh(tidy(mergeGeometries(rim.map(g=>g.toNonIndexed())),new T.Color(0x272131)),shared.sheen);
   for(const [o,name] of [[glassPane,'Lounge_door_panel'],[frame,'Lounge_door_frame']]){o.name=name;o.position.set(...at);o.userData={...data,noCollide:true};root.add(o);}}
 }

 // Signs: lettering with a soft halo on a dark board, framed by a neon tube. `normal` is the way it faces in the
 // template frame; the placement undoes the commons' mirror so the words read the right way round.
 const placing=(at,normal)=>new T.Matrix4().makeTranslation(...at).multiply(new T.Matrix4().makeScale(1,1,mirror)).multiply(new T.Matrix4().makeRotationY(Math.atan2(normal[0],normal[2]*mirror)));
 const roundRect=(w,h,r,z,pts=[])=>{for(const [cx,cy,a0] of [[w/2-r,h/2-r,0],[-w/2+r,h/2-r,Math.PI/2],[-w/2+r,-h/2+r,Math.PI],[w/2-r,-h/2+r,Math.PI*1.5]])for(let i=0;i<=4;i++){const a=a0+i/4*Math.PI/2;pts.push(new T.Vector3(cx+Math.cos(a)*r,cy+Math.sin(a)*r,z));}return new T.CatmullRomCurve3(pts,true,'catmullrom',.1);};
 const leafCurve=(cx,cy,s,z)=>new T.CatmullRomCurve3(Array.from({length:28},(_,i)=>{const t=i/28*Math.PI*2,c=1+.09*Math.cos(9*t);return new T.Vector3(cx+s*.62*Math.sin(t)*c*(1-.25*Math.cos(t)),cy+s*(Math.cos(t)*.95+.15*Math.sin(t)**2),z);}),true);
 function sign({at,normal,lines,color,frame=color,width,height,leaves=false,board=true}){
  const m=placing(at,normal),local=[];
  let y=lines.reduce((s,l)=>s+l.size*1.35,0)/2;
  for(const l of lines){y-=l.size;const g=new TextGeometry(l.text,{font,size:l.size,depth:.025,curveSegments:2});g.computeBoundingBox();const b=g.boundingBox;
   g.translate(-(b.max.x+b.min.x)/2,y,.04);local.push([neon(l.color||color),g]);y-=l.size*.35;}
  // The glow spills round the board from behind it; in front, it washed the dark board out to grey.
  local.push([halo(color),new T.PlaneGeometry(width*1.3,height*2).translate(0,0,board?-.12:.02)]);
  if(board)local.push([M.board,new T.BoxGeometry(width,height,.08).translate(0,0,-.04)]);
  local.push([neon(frame),new T.TubeGeometry(roundRect(width-.12,height-.12,Math.min(.3,height/4),.03),96,.03,5,true)]);
  if(leaves)for(const s of [-1,1])local.push([neon(GREEN),new T.TubeGeometry(leafCurve(s*(width/2-.42),0,.34,.04),56,.022,4,true)],[neon(GREEN),new T.CylinderGeometry(.015,.015,.5,4).translate(s*(width/2-.42),-.2,.04)]);
  for(const [mat,g] of local)put(mat,mirrored(g.applyMatrix4(m),m));
 }
 // A placement that mirrors turns every triangle inside out; swap two corners of each to turn it back.
 function mirrored(g,m){
  if(m.determinant()>0)return g;const n=g.index?g.toNonIndexed():g;
  for(const a of Object.values(n.attributes))for(let i=0;i<a.count;i+=3)for(let k=0;k<a.itemSize;k++){const t=a.array[(i+1)*a.itemSize+k];a.array[(i+1)*a.itemSize+k]=a.array[(i+2)*a.itemSize+k];a.array[(i+2)*a.itemSize+k]=t;}
  return n;
 }

 // The Anti-Gravity Geodesic Hammock Dome: struts and nodes on a two-frequency geodesic, cut at the floor, glass, with a
 // glass porch through to its door at the front.
 const PORCH={half:1.05,height:2.7,out:DOME.z-7.75,in:DOME.z-5.4};
 {const ico=new T.IcosahedronGeometry(DOME.r,2),p=ico.attributes.position,key=v=>v.toArray().map(n=>n.toFixed(3)).join(),edges=new Map(),nodes=new Map(),skin=[];
  const at=i=>{const v=new T.Vector3().fromBufferAttribute(p,i);v.y=Math.max(v.y,0);return v;};
  // The porch's way in: the skin and struts in front of it go (the porch's frame closes round the cut).
  const doorway=(...vs)=>{const c=vs.reduce((s,v)=>s.add(v),new T.Vector3()).divideScalar(vs.length);return Math.abs(c.x)<PORCH.half+.9&&c.z<-DOME.r*.55&&c.y<PORCH.height+.6;};
  // Faces reaching well below the floor go; the rest are flattened onto it.
  for(let i=0;i<p.count;i+=3){if(Math.min(p.getY(i),p.getY(i+1),p.getY(i+2))<-DOME.r*.12)continue;const t=[at(i),at(i+1),at(i+2)];if(doorway(...t))continue;
   skin.push(...t);for(const v of t)nodes.set(key(v),v);for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3];if(a.y===0&&b.y===0)continue;edges.set([key(a),key(b)].sort().join('|'),[a,b]);}}
  const o=new T.Vector3(DOME.x,FLOOR,DOME.z);
  for(const [a,b] of edges.values())rod(M.strut,a.clone().add(o).toArray(),b.clone().add(o).toArray(),.045,5);
  for(const v of nodes.values())ball(M.strut,.08,v.clone().add(o).toArray(),0);
  const g=new T.BufferGeometry().setFromPoints(skin.map(v=>v.clone().add(o)));g.computeVertexNormals();
  put(M.glass,g);
  // A ring planter round the base, full of catnip, open where the porch passes. Each part is made with the gap toward
  // +x and turned to face the entrance (-z).
  const R0=DOME.r+.15,R1=DOME.r+.95,gap=(PORCH.half+.1)/R0,face=g=>put(M.board,g.rotateY(Math.PI/2).translate(o.x,FLOOR,o.z));
  for(const r of [R0,R1])face(new T.CylinderGeometry(r,r,.5,48,1,true,Math.PI/2+gap,Math.PI*2-2*gap).translate(0,.25,0));
  face(new T.RingGeometry(R0,R1,48,1,gap,Math.PI*2-2*gap).rotateX(-Math.PI/2).translate(0,.5,0));
  for(const s of [-1,1])face(new T.PlaneGeometry(R1-R0,.5).translate((R0+R1)/2*Math.cos(gap),.25,s*(R0+R1)/2*Math.sin(gap)));
  put(neon(PURPLE),new T.TorusGeometry(R1+.01,.025,4,96,Math.PI*2-2*gap).rotateX(Math.PI/2).rotateY(Math.PI/2-gap).translate(o.x,FLOOR+.5,o.z));
  for(let i=0;i<64;i++){const a=i/64*Math.PI*2+rnd()*.05,r=R0+.2+rnd()*.55,x=o.x+Math.cos(a)*r,z=o.z+Math.sin(a)*r;
   if(Math.abs(x-o.x)<PORCH.half+.3&&z<o.z)continue;// the porch
   for(let k=0;k<3;k++)put(M.leaf,new T.OctahedronGeometry(.15+rnd()*.08,0).scale(1,1.6,1).translate(x+rnd()*.2-.1,FLOOR+.62+k*.12,z+rnd()*.2-.1));
   if(i%2)put(M.flower,new T.ConeGeometry(.05,.32,5).translate(x,FLOOR+.95,z));}
  // The porch: glass sides and roof from the door out front to inside the dome's skin, with a dark frame where it meets
  // the cut, and the sliding door at its front.
  {const {half,height}=PORCH,len=PORCH.in-PORCH.out,mid=(PORCH.in+PORCH.out)/2;
   for(const s of [-1,1])box(M.glass,[.04,height,len],[o.x+s*half,FLOOR+height/2,mid]);box(M.glass,[2*half,.04,len],[o.x,FLOOR+height,mid]);
   for(const s of [-1,1])box(M.dark,[.1,height,.1],[o.x+s*half,FLOOR+height/2,PORCH.in]);box(M.dark,[2*half+.1,.1,.1],[o.x,FLOOR+height,PORCH.in]);
   for(const s of [-1,1])box(M.dark,[.08,.08,len],[o.x+s*half,FLOOR+height,mid]);
   door({x:o.x,z:PORCH.out,width:1.7,height:2.45,face:-1,pocket:-1});
   // The skin left round the cut: a dark collar from the porch's frame out to it.
   for(const s of [-1,1])box(M.dark,[.9,height+.6,.08],[o.x+s*(half+.45),FLOOR+(height+.6)/2,PORCH.in]);box(M.dark,[2*half+1.8,.6,.08],[o.x,FLOOR+height+.3,PORCH.in]);}
  // A soft purple glow on the floor inside.
  put(halo(PURPLE),new T.PlaneGeometry(DOME.r*2,DOME.r*2).rotateX(-Math.PI/2).translate(o.x,FLOOR+.03,o.z));
  // Nine spreader-bar hammocks in a ring round the dome's middle, spokes out from it, with the way in from the porch left
  // clear. Each is a gently dished cloth held flat by an oak bar at each end, the bar's ends roped to a point above it,
  // and from there a rope up to the frame (loose: you walk through it). Cloth, bars and their ropes are one mesh
  // (Hammock) of its own, hung from the line between those two points, so the walk can lie you in it and swing it.
  const HAMMOCK={length:2.3,width:1.1,bar:.66,sag:.12,dip:.06,hang:.45,from:2.4},L=HAMMOCK.length/2;
  for(let i=1;i<=9;i++){const a=-Math.PI/2+i*Math.PI/5,ux=Math.cos(a),uz=Math.sin(a),mid=HAMMOCK.from+L;
   const g=new T.PlaneGeometry(HAMMOCK.length,HAMMOCK.width,12,4),q=g.attributes.position;
   // (The plane's y goes to -z so its face turns up; a copy wound the other way is the cloth's underside.)
   for(let k=0;k<q.count;k++){const x=q.getX(k),w=q.getY(k);q.setXYZ(k,x,-HAMMOCK.hang-HAMMOCK.sag*(1-(x/L)**2)-HAMMOCK.dip*(1-(2*w/HAMMOCK.width)**2),-w);}
   const under=g.clone(),ix=under.index.array;for(let k=0;k<ix.length;k+=3)[ix[k+1],ix[k+2]]=[ix[k+2],ix[k+1]];
   const c=[M.magenta,M.teal,M.purple][i%3],parts=[tidy(g,c.color),tidy(under,c.color)];
   for(const s of [-1,1]){parts.push(tidy(new T.CylinderGeometry(.035,.035,HAMMOCK.width+.16,8).rotateX(Math.PI/2).translate(s*L,-HAMMOCK.hang,0),M.wood.color));
    for(const w of [-1,1]){const A=new T.Vector3(s*L,-HAMMOCK.hang,w*(HAMMOCK.width/2+.06)),B=new T.Vector3(s*(L+.25),0,0),d=B.clone().sub(A);
     parts.push(tidy(new T.CylinderGeometry(.012,.012,d.length(),4,1,true).applyQuaternion(new T.Quaternion().setFromUnitVectors(UP,d.normalize())).translate(...A.add(B).multiplyScalar(.5).toArray()),M.dark.color));}}
   const both=mergeGeometries(parts);both.computeVertexNormals();
   const cloth=new T.Mesh(both,c.mat);cloth.name='Hammock';
   cloth.position.set(o.x+ux*mid,FLOOR+HAMMOCK.bar+HAMMOCK.hang,o.z+uz*mid);cloth.rotation.y=-a;
   // Swung about the line between its rope points (local x) by the walk; you lie with your head toward the rim (+x).
   cloth.userData={head:[1,0,0],sway:i};cloth.castShadow=cloth.receiveShadow=true;root.add(cloth);
   for(const [r,to] of [[mid-L-.25,2.6],[mid+L+.25,5.4]]){const top=Math.sqrt(DOME.r**2-to*to)-.12;
    rod(loose(M.dark),[o.x+ux*r,FLOOR+HAMMOCK.bar+HAMMOCK.hang,o.z+uz*r],[o.x+ux*to,FLOOR+top,o.z+uz*to],.012,3);}
  }
 }
 // The sign on the dome's crown, facing the entrance.
 for(const s of [-1,1])rod(M.dark,[DOME.x+s*3.2,FLOOR+DOME.r-.8,DOME.z],[DOME.x+s*3.2,FLOOR+DOME.r+.7,DOME.z],.05,6);
 sign({at:[DOME.x,FLOOR+DOME.r+2.1,DOME.z],normal:[0,0,-1],width:10.6,height:2.9,color:PINK,frame:CYAN,leaves:true,
  lines:[{text:'THE',size:.32,color:CYAN},{text:'HYDRO-NIP',size:.95},{text:'LOUNGE',size:.5,color:CYAN}]});

 // The Haze Maze: a three-storey glass tower full of green catnip mist. You walk in at the front into a maze of
 // partitions, find the cat-shelf stair at the back up to the lower platform, then climb the second stair to the upper
 // one. A glass tube runs level from each platform to its gallery: the lower to the front, the upper to the rear.
 {const {x0,x1,z0,z1,top}=MAZE,cx=(x0+x1)/2,cz=(z0+z1)/2,h=top-FLOOR,rise=(LEVELS[0]-FLOOR)/11,C=CELLS;
  // The glass, with openings [x0,x1,y0,y1] for the door and the two tubes.
  const tubeHole=t=>[t.x-TUBE.half,t.x+TUBE.half,t.level,t.level+2.45];
  const front=[[cx-1,cx+1,FLOOR,FLOOR+2.5],tubeHole(TUBES[0])],back=[tubeHole(TUBES[1])];
  // A wall across x at z, from xa to xb and FLOOR to the top, less its openings.
  const holed=(z,xa,xb,holes)=>{const xs=[...new Set([xa,xb,...holes.flatMap(o=>[o[0],o[1]])])].sort((a,b)=>a-b);
   for(let i=0;i<xs.length-1;i++){const a=xs[i],b=xs[i+1],m=(a+b)/2;let y=FLOOR;
    for(const o of holes.filter(o=>o[0]<m&&o[1]>m).sort((p,q)=>p[2]-q[2])){if(o[2]>y)put(M.mazeGlass,new T.BoxGeometry(b-a,o[2]-y,.04).translate(m,(y+o[2])/2,z));y=o[3];}
    if(top>y)put(M.mazeGlass,new T.BoxGeometry(b-a,top-y,.04).translate(m,(y+top)/2,z));}};
  holed(z0,x0,x1,front);holed(z1,x0,x1,back);
  for(const x of [x0,x1])put(M.mazeGlass,new T.BoxGeometry(.04,h,z1-z0).translate(x,FLOOR+h/2,cz));put(M.mazeGlass,new T.BoxGeometry(x1-x0,.04,z1-z0).translate(cx,top,cz));
  // The frame: corner posts, posts down the long sides and beside each tube, and rails at every level.
  for(const x of [x0,x1])for(const z of [z0,z1])box(M.dark,[.14,h,.14],[x,FLOOR+h/2,z]);
  for(let z=z0+2.33;z<z1-.1;z+=2.33)for(const x of [x0,x1])box(M.dark,[.08,h,.08],[x,FLOOR+h/2,z]);
  for(const [z,o] of [[z0,front[1]],[z1,back[0]]])for(const x of [o[0],o[1]])box(M.dark,[.08,o[3]-o[2],.08],[x,(o[2]+o[3])/2,z]);
  for(const y of [FLOOR+.06,...LEVELS,top])for(const z of [z0,z1])box(M.dark,[x1-x0,.1,.1],[cx,y,z]);
  for(const y of [FLOOR+.06,...LEVELS,top])for(const x of [x0,x1])box(M.dark,[.1,.1,z1-z0],[x,y,cz]);
  door({x:cx,z:z0,width:1.9,height:2.45,face:-1,pocket:1});
  // The ground floor's partitions: every wall between cells that PASSAGES leaves shut.
  const key=(a,b)=>[a,b].map(String).sort().join('|'),open=new Set(PASSAGES.map(([a,b])=>key(a,b))),stair=(c,r)=>STAIR_CELLS.has(c+','+r);
  // Each partition: frosted green glass, capped dark with a green line along the top, catnip tufts at its feet.
  const H=1.6,wall=(x,z,w,d)=>{box(M.frost,[w,H,d],[x,FLOOR+H/2,z]);box(M.dark,[w+.03,.06,d+.03],[x,FLOOR+H+.03,z]);box(neon(GREEN),[w+.035,.015,d+.035],[x,FLOOR+H-.02,z]);
   const long=w>d?[1,0]:[0,1],len=Math.max(w,d);for(let t=-len/2+.2;t<len/2-.1;t+=.38)for(const s of [-1,1]){const px=x+long[0]*t+long[1]*s*.12,pz=z+long[1]*t+long[0]*s*.12;
    for(let k=0;k<2;k++)put(M.leaf,new T.OctahedronGeometry(.09+rnd()*.05,0).scale(1,1.5,1).translate(px+rnd()*.08-.04,FLOOR+.1+k*.12,pz+rnd()*.08-.04));}};
  for(let c=0;c<C.cols;c++)for(let r=0;r<C.rows;r++){if(stair(c,r))continue;
   if(c+1<C.cols&&!stair(c+1,r)&&!open.has(key([c,r],[c+1,r])))wall(C.x0+(c+1)*C.w,C.z0+(r+.5)*C.d,.1,C.d+.1);
   if(r+1<C.rows&&!stair(c,r+1)&&!open.has(key([c,r],[c,r+1])))wall(C.x0+(c+.5)*C.w,C.z0+(r+1)*C.d,C.w+.1,.1);}
  // The cat-shelf stairs, each step a solid shelf (4 m in 11 rises). The first: two shelves along the back wall from
  // the maze's last cells, a landing, then forward up column 2 to the lower platform's back edge.
  // A shelf: a sisal-wrapped block under an oak tread.
  const step=(xa,xb,za,zb,base,y)=>{box(M.sisal,[xb-xa,y-.05-base,zb-za],[(xa+xb)/2,(base+y-.05)/2,(za+zb)/2]);box(M.wood,[xb-xa,.05,zb-za],[(xa+xb)/2,y-.025,(za+zb)/2]);};
  const foot=C.z0+C.rows*C.d,wallIn=z1-.1,east=C.x0+2*C.w,west=C.x0+1.575;
  step(east-2.8,east-1.4,foot,wallIn,FLOOR,FLOOR+rise);step(east-1.4,east,foot,wallIn,FLOOR,FLOOR+2*rise);step(east,x1-.1,foot,wallIn,FLOOR,FLOOR+3*rise);
  {const t=(foot-SPLIT)/8;for(let k=4;k<=11;k++)step(east,x1-.1,foot-(k-3)*t,foot-(k-4)*t,FLOOR,FLOOR+k*rise);}
  // The second: from beside the front tube, two shelves along the front wall, a landing, then back up column 0 to the
  // upper platform's front edge.
  const lobby=TUBES[0].x-TUBE.half,front0=C.z0+1.4;
  step(lobby-1.45,lobby,C.z0,front0,LEVELS[0],LEVELS[0]+rise);step(west,lobby-1.45,C.z0,front0,LEVELS[0],LEVELS[0]+2*rise);step(C.x0,west,C.z0,front0,LEVELS[0],LEVELS[0]+3*rise);
  {const t=(SPLIT-front0)/8;for(let k=4;k<=11;k++)step(C.x0,west,front0+(k-4)*t,front0+(k-3)*t,LEVELS[0],LEVELS[0]+k*rise);}
  // The platforms, and glass guards with a green rail where they and the stairs drop away.
  box(M.wood,[x1-x0-.1,.12,SPLIT-z0-.05],[cx,LEVELS[0]-.06,(z0+SPLIT)/2]);box(M.wood,[x1-x0-.1,.12,z1-SPLIT-.05],[cx,LEVELS[1]-.06,(SPLIT+z1)/2]);
  // A rug on each, clear of the stairs and the ways to the tubes.
  // (Plain colour with a border: the patterned rug's texture keeps it out of the walk's merge, a draw per deck band.)
  for(const [x,z,w,d,y] of [[118.1,23.6,3.4,4.4,LEVELS[0]],[117.4,29.9,4.6,4.4,LEVELS[1]]]){box(M.purple,[w,.02,d],[x,y+.01,z]);
   for(const s of [-1,1]){box(M.teal,[w,.022,.14],[x,y+.011,z+s*(d/2-.2)]);box(M.teal,[.14,.022,d],[x+s*(w/2-.2),y+.011,z]);}}
  const guard=(x,z,w,d,base,height)=>{put(M.mazeGlass,new T.BoxGeometry(w,height,d).translate(x,base+height/2,z));put(neon(GREEN),new T.BoxGeometry(w+.04,.04,d+.04).translate(x,base+height,z));};
  guard((west+east)/2,SPLIT,east-west,.04,LEVELS[0],1);guard((west+x1)/2,SPLIT,x1-west,.04,LEVELS[1],1);
  guard(east,(SPLIT+foot)/2,.04,foot-SPLIT,FLOOR,LEVELS[0]+1-FLOOR);guard(west,(front0+SPLIT)/2,.04,SPLIT-front0,LEVELS[0],LEVELS[1]+1-LEVELS[0]);
  // Cushions to curl up on, on both platforms.
  [[117,23.2,LEVELS[0]],[117,25.4,LEVELS[0]],[116.2,31.2,LEVELS[1]],[119.4,31.6,LEVELS[1]]].forEach(([x,z,y],i)=>
   seat('Meditation_cushion',new T.CylinderGeometry(.34,.37,.15,16),[M.magenta,M.teal][i%2],[x,y+.095,z]));
  // Catnip mist: crossed soft planes, thick on the ground floor and thinning as you climb.
  for(let i=0;i<12;i++){const up=i<6?0:i<10?1:2,y=[FLOOR,...LEVELS][up]+1.2+rnd()*.6,[za,zb]=[[z0+1,z1-2],[z0+1,SPLIT-1],[SPLIT+1,z1-1]][up];
   const z=za+rnd()*(zb-za),x=cx+(rnd()-.5)*3.6,w=2.4+rnd()*2,a=rnd()*Math.PI;
   for(const da of [0,Math.PI/2])put(M.mazeMist,new T.PlaneGeometry(w,2.2+rnd()).rotateY(a+da).translate(x,y,z));}
  // Vines trailing from the roof inside.
  for(let i=0;i<14;i++){const x=x0+.4+rnd()*(x1-x0-.8),z=z0+.4+rnd()*(z1-z0-.8),n=3+Math.floor(rnd()*4);
   for(let k=0;k<n;k++)put(M.leaf,new T.OctahedronGeometry(.09,0).scale(1,.45,1.3).rotateY(rnd()*3).translate(x+Math.sin(k*1.7)*.08,top-.15-k*.2,z));}
  sign({at:[116.6,FLOOR+3.15,z0-.1],normal:[0,0,-1],width:3.2,height:1.2,color:GREEN,lines:[{text:'HAZE MAZE',size:.42}]});
  // The tubes: glass, ringed in green, with a floor level with the platform and the gallery at either end.
  for(const t of TUBES){const len=Math.abs(t.to-t.from),zc=(t.to+t.from)/2,yc=t.level+TUBE.floor,n=Math.round(len/1.2);
   put(M.glass,new T.CylinderGeometry(TUBE.r,TUBE.r,len,18,1,true).rotateX(Math.PI/2).translate(t.x,yc,zc));
   box(M.wood,[1.75,.1,len+.2],[t.x,t.level-.05,zc]);for(const s of [-1,1])box(neon(GREEN),[.03,.012,len],[t.x+s*.84,t.level+.006,zc]);
   // Low glass along both edges of the floor, where the tube curves away below it: the walk's railing planner (and
   // anyone) sees the edge is guarded, and no railing goes in down the tube.
   for(const s of [-1,1])box(M.glass,[.03,.9,len],[t.x+s*.88,t.level+.45,zc]);
   for(let i=0;i<=n;i++)put(neon(GREEN),new T.TorusGeometry(TUBE.r+.03,.025,4,24).translate(t.x,yc,Math.min(t.from,t.to)+i*len/n));}
 }

 // The Terpene Tasting Deck: a bar across the back of the room behind the maze, facing the entrance, with a back bar of
 // glowing catnip blends and stools on the room's side. (It stood along the maze's flank at first and hid the maze.)
 // Its back bar leaves a 1.25 m way behind it to the reading nook; the kitchen island's chairs start past its end.
 {const x0=117.5,x1=126.5,cx=(x0+x1)/2,bz=36.1,shelf=37.9,len=x1-x0;
  box(M.wood,[len,1.02,1],[cx,FLOOR+.51,bz]);box(M.board,[len+.2,.06,1.2],[cx,FLOOR+1.05,bz]);
  for(const y of [FLOOR+.08,FLOOR+.98])box(neon(GREEN),[len,.025,.02],[cx,y,bz-.51]);
  box(M.wood,[len,2.6,.45],[cx,FLOOR+1.3,shelf]);
  for(const y of [FLOOR+1.15,FLOOR+1.75,FLOOR+2.35])box(M.board,[len,.04,.5],[cx,y,shelf-.25]);
  const liquids=[GREEN,AMBER,PURPLE,PINK,CYAN],flask=new T.LatheGeometry([[0,0],[.11,0],[.11,.02],[.04,.17],[.035,.26],[.04,.27]].map(([x,y])=>new T.Vector2(x,y)),8),fz=shelf-.28;
  let n=0;for(const y of [FLOOR+1.17,FLOOR+1.77,FLOOR+2.37])for(let x=x0+.35;x<x1-.2;x+=.62){const k=n++%5,round=n%3===0;
   if(round){ball(M.glass,.12,[x,y+.12,fz],1);ball(neon(liquids[k]),.085,[x,y+.1,fz],0);cyl(M.glass,.03,.03,.14,[x,y+.29,fz],6,true);}
   else{put(M.glass,flask.clone().translate(x,y,fz));put(neon(liquids[k]),new T.ConeGeometry(.095,.12,8).translate(x,y+.06,fz));}}
  // Tasting flights on the bar top: little glasses of blend on a board.
  for(let x=x0+1;x<x1-.5;x+=1.8){box(M.wood,[.7,.03,.3],[x,FLOOR+1.095,bz-.15]);for(let i=0;i<4;i++){cyl(M.glass,.03,.025,.09,[x-.24+i*.16,FLOOR+1.155,bz-.15],8,true);cyl(neon(liquids[(i+x|0)%5]),.026,.022,.04,[x-.24+i*.16,FLOOR+1.13,bz-.15],8);}}
  // A distillery as the centrepiece: a still, its coil and a receiving flask.
  ball(M.metal,.3,[cx,FLOOR+1.45,bz+.05],1);cyl(M.metal,.05,.05,.5,[cx,FLOOR+1.85,bz+.05],8);
  put(M.metal,new T.TorusGeometry(.12,.018,4,16,Math.PI*6).rotateX(Math.PI/2).translate(cx+.5,FLOOR+1.55,bz+.05));
  ball(M.glass,.14,[cx+.75,FLOOR+1.22,bz+.05],1);ball(neon(GREEN),.1,[cx+.75,FLOOR+1.2,bz+.05],0);
  for(let i=0;i<6;i++){const x=x0+1+i*1.4,z=bz-1.2;
   seat('Seat',new T.CylinderGeometry(.22,.22,.08,14),M.purple,[x,FLOOR+.76,z]);
   cyl(M.dark,.035,.035,.72,[x,FLOOR+.36,z],6);put(M.dark,new T.TorusGeometry(.18,.015,4,16).rotateX(Math.PI/2).translate(x,FLOOR+.3,z));cyl(M.dark,.2,.2,.03,[x,FLOOR+.015,z],12);}
  sign({at:[cx,FLOOR+3.25,shelf-.3],normal:[0,0,-1],width:6.6,height:1.25,color:GREEN,frame:AMBER,lines:[{text:'THE TERPENE',size:.3},{text:'TASTING DECK',size:.38,color:AMBER}]});
 }

 // The Cosmic Munchies Converger: a counter with snack dispensers, and the machine hung from the ceiling, beaming down.
 {const {x,z}=MUNCH,top=FLOOR+1.1;
  box(M.metal,[3,1.06,5],[x,FLOOR+.53,z]);box(M.board,[3.2,.06,5.2],[x,top,z]);
  for(const s of [-1,1])box(neon(CYAN),[3.1,.025,.02],[x,top-.05,z+s*2.61]);box(neon(CYAN),[.02,.025,5.1],[x-1.61,top-.05,z]);
  cyl(M.dark,.62,.7,.12,[x,top+.06,z],24);put(halo(CYAN),new T.CircleGeometry(.9,24).rotateX(-Math.PI/2).translate(x,top+.125,z));
  put(neon(CYAN),new T.TorusGeometry(.6,.03,4,32).rotateX(Math.PI/2).translate(x,top+.12,z));
  const candy=[PINK,AMBER,GREEN,PURPLE];
  candy.forEach((c,i)=>{const zz=z-1.8+i*1.2;cyl(M.glass,.2,.2,.7,[x+1.15,top+.38,zz],12,true);cyl(M.dark,.22,.22,.08,[x+1.15,top+.77,zz],12);
   for(let k=0;k<9;k++)ball(neon(c),.05,[x+1.15+Math.cos(k*2.4)*.1,top+.08+k*.06,zz+Math.sin(k*2.4)*.1],0);});
  box(M.board,[.06,.5,.8],[x-1.4,top+.3,z+1.8]);box(neon(CYAN),[.02,.38,.66],[x-1.44,top+.3,z+1.8]);
  // The machine: ceiling plate, a tapering body ringed with lights, three claws and the emitter.
  cyl(M.dark,1.3,1.3,.12,[x,CEILING-.08,z],24);cyl(M.metal,1.1,.75,1.7,[x,CEILING-1,z],20);cyl(M.dark,.75,.5,.5,[x,CEILING-2.1,z],20);
  for(const [y,r] of [[CEILING-.5,1.03],[CEILING-1.1,.92],[CEILING-1.7,.8]])put(neon(CYAN),new T.TorusGeometry(r,.03,4,40).rotateX(Math.PI/2).translate(x,y,z));
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2,ax=x+Math.cos(a)*.62,az=z+Math.sin(a)*.62;rod(M.dark,[ax,CEILING-2.1,az],[x+Math.cos(a)*.95,CEILING-2.9,z+Math.sin(a)*.95],.05,6);rod(M.dark,[x+Math.cos(a)*.95,CEILING-2.9,z+Math.sin(a)*.95],[x+Math.cos(a)*.55,CEILING-3.3,z+Math.sin(a)*.55],.04,6);}
  ball(neon(CYAN),.22,[x,CEILING-2.45,z],1);
  // The beam, and two snacks caught in it on their way down.
  const beamTop=CEILING-2.5,beamH=beamTop-(top+.12);
  put(M.beam,new T.CylinderGeometry(.3,.65,beamH,24,1,true).translate(x,top+.12+beamH/2,z));
  put(M.beam,new T.CylinderGeometry(.15,.45,beamH,24,1,true).translate(x,top+.12+beamH/2,z));
  put(neon(PINK),new T.TorusGeometry(.16,.07,8,18).rotateX(1.1).translate(x+.1,FLOOR+4.6,z));
  put(M.wood,new T.CylinderGeometry(.14,.14,.04,14).rotateZ(.5).translate(x-.12,FLOOR+3.4,z+.1));
  for(let i=0;i<3;i++){const sz=z-1.4+i*1.4;seat('Seat',new T.CylinderGeometry(.22,.22,.08,14),M.teal,[x-2.6,FLOOR+.76,sz]);cyl(M.dark,.035,.035,.72,[x-2.6,FLOOR+.36,sz],6);cyl(M.dark,.2,.2,.03,[x-2.6,FLOOR+.015,sz],12);}
  sign({at:[x,CEILING-4.1,z-3.1],normal:[0,0,-1],width:4.6,height:1.3,color:CYAN,frame:PINK,lines:[{text:'COSMIC MUNCHIES',size:.3},{text:'CONVERGER',size:.36,color:PINK}]});
  for(const s of [-1,1])rod(M.dark,[x+s*2,CEILING-3.45,z-3.1],[x+s*2,CEILING,z-3.1],.012,3);
 }

 // Lounge seating toward the entrance: patterned rugs, beanbags, floor cushions, low tables and cat toys.
 for(const [x,z,w,d] of [[127,15,7,4],[137,15,7,4],[144,16,4,3]])box(M.rug,[w,.02,d],[x,FLOOR+.01,z]);
 [[124.6,14.2,'magenta'],[127.6,16.4,'teal'],[129.6,14,'purple'],[134.8,14.1,'teal'],[138.2,16.5,'magenta'],[140.2,14.3,'purple'],[144.6,16.1,'magenta']].forEach(([x,z,c])=>
  seat('Soft_seat',new T.SphereGeometry(.58,16,10).scale(1,.62,1),M[c],[x,FLOOR+.36,z]));
 [[126.4,13.4],[131,16.2],[133.6,16],[136.2,13.4],[142.7,14.9],[145.6,17.2]].forEach(([x,z],i)=>
  seat('Meditation_cushion',new T.CylinderGeometry(.34,.37,.15,16),[M.purple,M.teal,M.magenta][i%3],[x,FLOOR+.095,z]));
 for(const [x,z] of [[127.2,15],[137.2,15]]){cyl(M.wood,.5,.5,.05,[x,FLOOR+.4,z],18);cyl(M.dark,.08,.12,.38,[x,FLOOR+.19,z],8);
  cyl(M.board,.18,.12,.08,[x,FLOOR+.465,z],12);put(M.leaf,new T.SphereGeometry(.15,8,5,0,Math.PI*2,0,Math.PI/2).translate(x,FLOOR+.49,z));}
 [[125.8,15.8,PINK],[131.6,13.6,AMBER],[136,16.8,GREEN],[139.6,15.6,PURPLE],[143.4,17.4,CYAN],[128.8,13.1,AMBER]].forEach(([x,z,c])=>put(neon(c),new T.IcosahedronGeometry(.09,1).translate(x,FLOOR+.11,z)));
 // Cat trees: sisal posts, platforms and a bed on top.
 for(const [x,z,h] of [[124.6,22.5,2.6],[147,18.6,2.2],[112.6,35.8,1.8]]){
  cyl(M.sisal,.09,.09,h,[x,FLOOR+h/2,z],8);cyl(M.sisal,.07,.07,h*.6,[x+.45,FLOOR+h*.3,z+.2],8);
  cyl(M.wood,.5,.5,.06,[x,FLOOR+.03,z],16);
  for(const [dy,dx,r] of [[h*.38,.3,.32],[h*.68,-.2,.36]])cyl(M.purple,r,r,.05,[x+dx,FLOOR+dy,z],14);
  put(M.teal,new T.TorusGeometry(.32,.1,6,16).rotateX(Math.PI/2).translate(x,FLOOR+h+.06,z));cyl(M.teal,.3,.3,.06,[x,FLOOR+h,z],14);
  put(neon(PINK),new T.IcosahedronGeometry(.07,0).translate(x+.35,FLOOR+h*.38-.3,z));rod(M.dark,[x+.35,FLOOR+h*.38-.22,z],[x+.35,FLOOR+h*.38,z],.004,3);}

 // String lights in catenaries under both galleries' edges, and catnip in pots hanging between them.
 const edges=[[[114,12.05],[154,12.05]],[[114,41.95],[147.5,41.95]],[[113.55,12.6],[113.55,41.5]]];
 for(const level of LEVELS){const y=level-.32;
  // A tube landing on this edge: no lights where it meets its own level, and no pots hanging into it from either.
  const tubeAt=(x,z,lvl,pad)=>TUBES.some(t=>Math.abs(z-t.to)<1&&Math.abs(x-t.x)<TUBE.r+pad&&(lvl===undefined||lvl===t.level));
  for(const [a,b] of edges){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),spans=Math.max(1,Math.round(len/4.5));
   for(let s=0;s<spans;s++){let prev=null;const n=8;
    for(let i=0;i<=n;i++){const t=(s+i/n)/spans,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,sag=.35*(1-(2*i/n-1)**2),p=[x,y-sag,z];
     if(tubeAt(x,z,level,.3)){prev=null;continue;}
     if(prev)rod(M.dark,prev,p,.006,3);if(i<n)put(neon(AMBER),new T.OctahedronGeometry(.05,0).translate(x,y-sag-.06,z));prev=p;}
    // A pot of catnip at each span's middle, on three cords, with trailing stems; none against the maze's glass.
    const t=(s+.5)/spans,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,out=a[1]===b[1]?(a[1]<20?.45:-.45):.45,px=a[1]===b[1]?x:x+out,pz=a[1]===b[1]?z+out:z,py=level-.95;
    if(px<MAZE.x0+.5&&pz>MAZE.z0-.5&&pz<MAZE.z1+.5||tubeAt(px,z,undefined,.6))continue;
    cyl(M.pot,.2,.14,.24,[px,py,pz],10);for(let k=0;k<3;k++){const ang=k/3*Math.PI*2;rod(M.dark,[px+Math.cos(ang)*.18,py+.12,pz+Math.sin(ang)*.18],[px,level-.3,pz],.005,3);}
    const reach=level===LEVELS[0]?1.4:2.1;
    for(let k=0;k<4;k++){const ang=k/4*Math.PI*2+rnd(),sx=px+Math.cos(ang)*.17,sz=pz+Math.sin(ang)*.17,len=reach*(.55+rnd()*.45);
     for(let d=0;d<len;d+=.23)put(M.leaf,new T.OctahedronGeometry(.075,0).scale(1,.4,1.25).rotateY(d*3+k).translate(sx+Math.sin(d*2.3)*.05,py+.1-d,sz+Math.cos(d*2.1)*.05));}}}}

 // Blacklight sconces along the rear and end walls, on the floor and both galleries (from tester feedback): a violet tube
 // between dark caps on a back plate, washing the wall round it in violet. Each sits clear of the gallery doors,
 // columns and prints; `n` is the way it faces, into the room.
 {const sconce=(x,y,z,n)=>{const turn=g=>g.rotateY(Math.atan2(n[0],n[2])).translate(x,y,z);
   put(M.dark,turn(new T.BoxGeometry(.24,.64,.06).translate(0,0,.03)));
   for(const s of [-1,1])put(M.dark,turn(new T.BoxGeometry(.2,.05,.2).translate(0,s*.27,.12)));
   put(neon(BLACKLIGHT),turn(new T.CylinderGeometry(.045,.045,.5,8).translate(0,0,.12)));
   put(glow(BLACKLIGHT,.75,(u,v)=>[u*.5,v]),turn(new T.PlaneGeometry(1.5,2.4).translate(0,0,.015)));};
  // (The end wall's prints hang between the ground floor's sconces: src/garden-finish.js.)
  for(const [y,up,ends] of [[FLOOR,2.3,[14,19.5,25,31,37]],[LEVELS[0],1.9,[14,20.5,27,33.5,40]],[LEVELS[1],1.9,[14,20.5,27,33.5,40]]]){
   for(const x of [113.5,119,123.5,128.4,137.4,147.5])sconce(x,y+up,ROOM.z1-.1,[0,0,-1]);
   for(const z of ends)sconce(ROOM.x0+.1,y+up,z,[1,0,0]);}}

 // The credit plaque by the entrance.
 {const at=[117.5,FLOOR,12.6];cyl(M.dark,.05,.05,1.1,[at[0],FLOOR+.55,at[2]+.08],8);box(M.dark,[.5,.03,.5],[at[0],FLOOR+.015,at[2]+.08]);
  sign({at:[at[0],FLOOR+1.32,at[2]],normal:[0,0,-1],width:1.25,height:.62,color:AMBER,lines:[{text:'HYDRO-NIP LOUNGE',size:.085},{text:'Concept by Tochtli',size:.075,color:0xf3e6c4}]});}

 // One mesh per material.
 for(const {mat:m,loose,gs} of lists.values()){const g=mergeGeometries(gs);gs.forEach(x=>x.dispose());const o=new T.Mesh(g,m);o.name=loose?m.name+'_loose':m.name;o.receiveShadow=true;o.castShadow=!m.transparent&&!(m instanceof T.MeshBasicMaterial);
  if(loose)o.userData.noCollide=true;root.add(o);}
 return root;
}
