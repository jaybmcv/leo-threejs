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
// Phase 1 is dressing only: the dome and the maze are sealed glass you see into, and the seats use the sit action.
// Neon, glass, mist and light are merged per material here (the walk leaves glowing and see-through meshes unmerged);
// seats stay separate meshes, named as the walk's rest spots expect.
const FLOOR=24.3,CEILING=35.65,LEVELS=[28.3,32.3];
const DOME={x:134,z:25,r:6.5},MAZE={x0:114,x1:120.5,z0:19,z1:33,top:35.2},MUNCH={x:145.5,z:25};
const PINK=0xff4fd8,CYAN=0x45e3ff,GREEN=0x6dff7a,PURPLE=0xa77bff,AMBER=0xffc266;
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
 };
 // A paint is a shared material and a colour.
 const paint=(mat,color=0xffffff,{dim=1,uv=null}={})=>shared[mat]?{mat:shared[mat],color:new T.Color(color).multiplyScalar(dim),uv}:null;
 // Additive glows dim by colour; `uv` points each at its half of the atlas (a beam at the bright middle of the spot).
 const glow=(color,dim,uv)=>paint('glow',color,{dim,uv});
 const neon=hex=>paint('neon',hex),halo=hex=>glow(hex,.5,(u,v)=>[u*.5,v]);
 const M={
  glass:paint('glass',0xcfeeff),mazeGlass:paint('glass',0xa8ffbf),mist:glow(0x7dff8e,.55,(u,v)=>[.5+u*.5,v]),beam:glow(0x5fc8ff,.2,()=>[.25,.5]),rug:paint('rug'),
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
 const put=(p,g)=>{if(!p){g.dispose();return;}(lists.get(p.mat)||lists.set(p.mat,[]).get(p.mat)).push(tidy(g,p.color,p.uv));};
 const box=(m,[w,h,d],[x,y,z])=>put(m,new T.BoxGeometry(w,h,d).translate(x,y,z));
 const cyl=(m,rt,rb,h,[x,y,z],seg=12,open=false)=>put(m,new T.CylinderGeometry(rt,rb,h,seg,1,open).translate(x,y,z));
 const ball=(m,r,[x,y,z],detail=1)=>put(m,new T.IcosahedronGeometry(r,detail).translate(x,y,z));
 const UP=new T.Vector3(0,1,0);
 const rod=(m,a,b,r,seg=6)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),g=new T.CylinderGeometry(r,r,d.length(),seg,1,true);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(UP,d.normalize()));put(m,g.translate(...A.add(B).multiplyScalar(.5).toArray()));};
 // Seats keep their own meshes and names (src/walk/rest.js finds Seat, Soft_seat and Meditation_cushion by name).
 const seat=(name,geo,p,[x,y,z])=>{const o=new T.Mesh(tidy(geo,p.color),p.mat);o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;root.add(o);return o;};

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

 // The Anti-Gravity Geodesic Hammock Dome: struts and nodes on a two-frequency geodesic, cut at the floor, sealed glass.
 {const ico=new T.IcosahedronGeometry(DOME.r,2),p=ico.attributes.position,key=v=>v.toArray().map(n=>n.toFixed(3)).join(),edges=new Map(),nodes=new Map(),skin=[];
  const at=i=>{const v=new T.Vector3().fromBufferAttribute(p,i);v.y=Math.max(v.y,0);return v;};
  // Faces reaching well below the floor go; the rest are flattened onto it.
  for(let i=0;i<p.count;i+=3){if(Math.min(p.getY(i),p.getY(i+1),p.getY(i+2))<-DOME.r*.12)continue;const t=[at(i),at(i+1),at(i+2)];
   skin.push(...t);for(const v of t)nodes.set(key(v),v);for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3];if(a.y===0&&b.y===0)continue;edges.set([key(a),key(b)].sort().join('|'),[a,b]);}}
  const o=new T.Vector3(DOME.x,FLOOR,DOME.z);
  for(const [a,b] of edges.values())rod(M.strut,a.clone().add(o).toArray(),b.clone().add(o).toArray(),.045,5);
  for(const v of nodes.values())ball(M.strut,.08,v.clone().add(o).toArray(),0);
  const g=new T.BufferGeometry().setFromPoints(skin.map(v=>v.clone().add(o)));g.computeVertexNormals();
  put(M.glass,g);
  // A ring planter round the base, full of catnip.
  const R0=DOME.r+.15,R1=DOME.r+.95;
  cyl(M.board,R1,R1,.5,[o.x,FLOOR+.25,o.z],48,true);cyl(M.board,R0,R0,.5,[o.x,FLOOR+.25,o.z],48,true);
  put(M.board,new T.RingGeometry(R0,R1,48).rotateX(-Math.PI/2).translate(o.x,FLOOR+.5,o.z));
  put(neon(PURPLE),new T.TorusGeometry(R1+.01,.025,4,96).rotateX(Math.PI/2).translate(o.x,FLOOR+.5,o.z));
  for(let i=0;i<64;i++){const a=i/64*Math.PI*2+rnd()*.05,r=R0+.2+rnd()*.55,x=o.x+Math.cos(a)*r,z=o.z+Math.sin(a)*r;
   if(Math.abs(x-o.x)<.9&&z<o.z)continue;// the door
   for(let k=0;k<3;k++)put(M.leaf,new T.OctahedronGeometry(.15+rnd()*.08,0).scale(1,1.6,1).translate(x+rnd()*.2-.1,FLOOR+.62+k*.12,z+rnd()*.2-.1));
   if(i%2)put(M.flower,new T.ConeGeometry(.05,.32,5).translate(x,FLOOR+.95,z));}
  // The sealed door, toward the entrance, outlined in cyan.
  const dz=o.z-DOME.r+.35;box(M.dark,[1.7,2.5,.12],[o.x,FLOOR+1.25,dz-.3]);box(M.glass,[1.3,2.25,.04],[o.x,FLOOR+1.13,dz-.37]);
  put(neon(CYAN),new T.TubeGeometry(roundRect(1.45,2.35,.25,0),48,.022,4,true).translate(o.x,FLOOR+1.2,dz-.39));
  // A soft purple glow on the floor inside.
  put(halo(PURPLE),new T.PlaneGeometry(DOME.r*2,DOME.r*2).rotateX(-Math.PI/2).translate(o.x,FLOOR+.03,o.z));
  // Hammocks hung from the frame at staggered heights, each a sagging cloth with a rope at each end.
  const hang=[[0,0,3.1,.4],[2.9,.6,1.4,1.2],[-2.6,1.4,1.6,2.3],[1.2,-3,2,.2],[-1.6,-2.6,2.6,1],[3.4,-1.9,2.7,2.6],[-3.6,-.8,3.2,.7],[.4,3.2,2.6,1.7],[-.6,1.6,4.1,2.9]];
  hang.forEach(([hx,hz,hy,rot],i)=>{
   const g=new T.PlaneGeometry(2.1,.95,12,4),q=g.attributes.position;
   for(let k=0;k<q.count;k++){const x=q.getX(k),w=q.getY(k);q.setXYZ(k,x,-.42*(1-(2*x/2.1)**2)-.13*(1-(2*w/.95)**2),w);}
   g.computeVertexNormals();g.rotateY(rot).translate(o.x+hx,FLOOR+hy,o.z+hz);put([M.magenta,M.teal,M.purple][i%3],g);
   for(const s of [-1,1]){const ex=o.x+hx+Math.cos(rot)*s*1.05,ez=o.z+hz-Math.sin(rot)*s*1.05,dx=ex-o.x,dzz=ez-o.z,top=Math.sqrt(Math.max(.5,DOME.r**2-dx*dx-dzz*dzz))-.15;
    rod(M.dark,[ex,FLOOR+hy,ez],[ex*.9+o.x*.1,FLOOR+top,ez*.9+o.z*.1],.012,3);}
  });
 }
 // The sign on the dome's crown, facing the entrance.
 for(const s of [-1,1])rod(M.dark,[DOME.x+s*3.2,FLOOR+DOME.r-.8,DOME.z],[DOME.x+s*3.2,FLOOR+DOME.r+.7,DOME.z],.05,6);
 sign({at:[DOME.x,FLOOR+DOME.r+2.1,DOME.z],normal:[0,0,-1],width:10.6,height:2.9,color:PINK,frame:CYAN,leaves:true,
  lines:[{text:'THE',size:.32,color:CYAN},{text:'HYDRO-NIP',size:.95},{text:'LOUNGE',size:.5,color:CYAN}]});

 // The Haze Maze: a three-storey glass tower of cat shelves, ramps and platforms, full of green catnip mist.
 {const {x0,x1,z0,z1,top}=MAZE,cx=(x0+x1)/2,cz=(z0+z1)/2,h=top-FLOOR,glass=[];
  const wall=(w,hh,d,x,y,z)=>glass.push(new T.BoxGeometry(w,hh,d).translate(x,y,z));
  wall(x1-x0,h,.04,cx,FLOOR+h/2,z0);wall(x1-x0,h,.04,cx,FLOOR+h/2,z1);wall(.04,h,z1-z0,x0,FLOOR+h/2,cz);wall(.04,h,z1-z0,x1,FLOOR+h/2,cz);wall(x1-x0,.04,z1-z0,cx,top,cz);
  for(const g of glass)put(M.mazeGlass,g);
  for(const x of [x0,x1])for(const z of [z0,z1])box(M.dark,[.14,h,.14],[x,FLOOR+h/2,z]);
  for(let z=z0+2.33;z<z1-.1;z+=2.33)for(const x of [x0,x1])box(M.dark,[.08,h,.08],[x,FLOOR+h/2,z]);
  for(const z of [z0,z1])box(M.dark,[.08,h,.08],[cx,FLOOR+h/2,z]);
  for(const y of [FLOOR+.06,...LEVELS,top])for(const z of [z0,z1])box(M.dark,[x1-x0,.1,.1],[cx,y,z]);
  for(const y of [FLOOR+.06,...LEVELS,top])for(const x of [x0,x1])box(M.dark,[.1,.1,z1-z0],[x,y,cz]);
  // Inside: platforms on alternating halves, a zigzag of shelves between them, and cushions to curl up on.
  box(M.wood,[x1-x0-.3,.12,7],[cx,LEVELS[0],z0+3.6]);box(M.wood,[x1-x0-.3,.12,7],[cx,LEVELS[1],z1-3.6]);
  for(let i=0;i<9;i++){const y=FLOOR+.5+i*.85,z=z0+7.4+(i%3)*1.6,x=i%2?x0+1.1:x1-1.1;box(M.wood,[1.2,.08,.9],[x,y,z]);box(M.teal,[1.05,.06,.75],[x,y+.07,z]);}
  for(let i=0;i<8;i++){const y=LEVELS[0]+.5+i*.48,x=x0+.7+(i%2)*(x1-x0-1.4),z=z1-1-i*.35;box(M.wood,[.9,.08,.7],[x,y,z]);}
  for(const [x,y,z] of [[cx-1.2,LEVELS[0]+.18,z0+2],[cx+1.4,LEVELS[0]+.18,z0+5],[cx,LEVELS[1]+.18,z1-2.2]])cyl(M.magenta,.45,.5,.18,[x,y,z],14);
  // Catnip mist: crossed soft planes at three heights.
  for(let i=0;i<12;i++){const y=FLOOR+1.4+i%4*2.6+rnd()*.6,z=z0+1.5+rnd()*(z1-z0-3),x=cx+(rnd()-.5)*2.4,w=3+rnd()*2.4,a=rnd()*Math.PI;
   for(const da of [0,Math.PI/2])put(M.mist,new T.PlaneGeometry(w,2.6+rnd()).rotateY(a+da).translate(x,y,z));}
  // Vines trailing from the roof inside.
  for(let i=0;i<14;i++){const x=x0+.4+rnd()*(x1-x0-.8),z=z0+.4+rnd()*(z1-z0-.8),n=6+Math.floor(rnd()*8);
   for(let k=0;k<n;k++)put(M.leaf,new T.OctahedronGeometry(.09,0).scale(1,.45,1.3).rotateY(rnd()*3).translate(x+Math.sin(k*1.7)*.08,top-.15-k*.2,z));}
  // The sealed sliding door and its sign, toward the entrance.
  box(M.dark,[1.8,2.55,.1],[cx,FLOOR+1.27,z0-.06]);box(M.mazeGlass,[1.4,2.3,.03],[cx,FLOOR+1.15,z0-.12]);
  put(neon(CYAN),new T.TubeGeometry(roundRect(1.5,2.4,.2,0),48,.022,4,true).translate(cx,FLOOR+1.2,z0-.14));
  sign({at:[cx,FLOOR+3.3,z0-.1],normal:[0,0,-1],width:3.4,height:1.2,color:GREEN,lines:[{text:'HAZE MAZE',size:.42}]});
  // Glass tubes from the tower's top out over the room to the front and rear galleries, ringed in green.
  for(const pts of [[[cx+.8,top-.6,z0+2],[cx+4.4,34.8,z0-2.6],[cx+8.3,34.85,12.5]],[[cx+.8,top-.6,z1-2],[cx+3.8,34.8,z1+3],[cx+5.6,34.85,41.6]]]){
   const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));put(M.glass,new T.TubeGeometry(curve,36,.5,10,false));
   for(let t=0;t<=1.0001;t+=1/6){const p=curve.getPointAt(Math.min(t,1)),d=curve.getTangentAt(Math.min(t,1));
    put(neon(GREEN),new T.TorusGeometry(.53,.025,4,18).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),d)).translate(p.x,p.y,p.z));}}
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
  for(const [a,b] of edges){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),spans=Math.max(1,Math.round(len/4.5));
   for(let s=0;s<spans;s++){let prev=null;const n=8;
    for(let i=0;i<=n;i++){const t=(s+i/n)/spans,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,sag=.35*(1-(2*i/n-1)**2),p=[x,y-sag,z];
     if(prev)rod(M.dark,prev,p,.006,3);if(i<n)put(neon(AMBER),new T.OctahedronGeometry(.05,0).translate(x,y-sag-.06,z));prev=p;}
    // A pot of catnip at each span's middle, on three cords, with trailing stems; none against the maze's glass.
    const t=(s+.5)/spans,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,out=a[1]===b[1]?(a[1]<20?.45:-.45):.45,px=a[1]===b[1]?x:x+out,pz=a[1]===b[1]?z+out:z,py=level-.95;
    if(px<MAZE.x0+.5&&pz>MAZE.z0-.5&&pz<MAZE.z1+.5)continue;
    cyl(M.pot,.2,.14,.24,[px,py,pz],10);for(let k=0;k<3;k++){const ang=k/3*Math.PI*2;rod(M.dark,[px+Math.cos(ang)*.18,py+.12,pz+Math.sin(ang)*.18],[px,level-.3,pz],.005,3);}
    const reach=level===LEVELS[0]?1.4:2.1;
    for(let k=0;k<4;k++){const ang=k/4*Math.PI*2+rnd(),sx=px+Math.cos(ang)*.17,sz=pz+Math.sin(ang)*.17,len=reach*(.55+rnd()*.45);
     for(let d=0;d<len;d+=.23)put(M.leaf,new T.OctahedronGeometry(.075,0).scale(1,.4,1.25).rotateY(d*3+k).translate(sx+Math.sin(d*2.3)*.05,py+.1-d,sz+Math.cos(d*2.1)*.05));}}}}

 // The credit plaque by the entrance.
 {const at=[117.5,FLOOR,12.6];cyl(M.dark,.05,.05,1.1,[at[0],FLOOR+.55,at[2]+.08],8);box(M.dark,[.5,.03,.5],[at[0],FLOOR+.015,at[2]+.08]);
  sign({at:[at[0],FLOOR+1.32,at[2]],normal:[0,0,-1],width:1.25,height:.62,color:AMBER,lines:[{text:'HYDRO-NIP LOUNGE',size:.085},{text:'Concept by Tochtli',size:.075,color:0xf3e6c4}]});}

 // One mesh per material.
 for(const [m,gs] of lists){const g=mergeGeometries(gs);gs.forEach(x=>x.dispose());const o=new T.Mesh(g,m);o.name=m.name;o.receiveShadow=true;o.castShadow=!m.transparent&&!(m instanceof T.MeshBasicMaterial);root.add(o);}
 return root;
}
