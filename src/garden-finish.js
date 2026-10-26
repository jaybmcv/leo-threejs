import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {polishInterior} from './interior-polish.js';
import {stylizedTree} from './stylized-plants.js';
import {seeded} from './polish-kit.js';

// All additions belong to the shared commons template, so every neighborhood
// receives the same finishes without moving its floor, galleries or routes.
export function finishGarden({fittings,walls,parts,wallParts,material}){
 const oak=material('Commons_oak',0xa98762,{roughness:.66,metalness:0});
 const stone=material('Commons_limestone',0xd1cbbb,{roughness:.86,metalness:0});
 const sage=material('Commons_sage_upholstery',0x668279,{roughness:1,metalness:0});
 const clay=material('Commons_clay_upholstery',0xb07d63,{roughness:1,metalness:0});
 const dark=material('Commons_dark_bronze',0x364748,{roughness:.45,metalness:.55});
 const diffuser=material('Commons_warm_diffuser',0xffe5b7,{roughness:.5,metalness:0,emissive:0xffdaa0,emissiveIntensity:.7});
 const leaves=[0x406751,0x628566,0x87a276].map((c,i)=>material('Commons_foliage_'+i,c,{roughness:.95,metalness:0}));
 const finish=new T.Group();finish.name='Garden_commons_refined_furnishings';fittings.add(finish);
 const ceiling=new T.Group();ceiling.name='Garden_commons_refined_lighting';walls.add(ceiling);
 const add=(name,geo,mat,pos,parent=finish)=>{const o=new T.Mesh(geo,mat);o.name=name;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const box=(name,size,pos,mat,parent=finish,r=.045)=>add(name,new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(s=>s*.4))),mat,pos,parent);
 const cylinder=(name,r,h,pos,mat,parent=finish)=>add(name,new T.CylinderGeometry(r,r,h,16),mat,pos,parent);
 // One crew cat stood inside the second planter (x 136.5-145.5, z 27.5-36.5); it now waits just behind it.
 for(const part of parts)if(part.name==='Mars_cat_1.75m'&&part.position.x===144&&part.position.z===36)part.position.z=38.5;
 const trees=[];
 for(const part of [...parts,...wallParts])part.traverse(o=>{
  // The kitchen island chairs sat with their backs to it; turn them in place to face the island.
  if(o.name==='Tail_clearance_chair'&&o.position.z===37&&o.parent?.name==='Neighborhood_shared_services')o.rotation.y=0;
  if(!o.isMesh)return;
  if(o.name==='Low_plant'){o.visible=false;return;}
  // The blockout trees give way to branching, leaf-clustered ones; each hidden trunk still marks its spot.
  if(o.name==='Tree_canopy'){o.visible=false;return;}
  if(o.name==='Tree_trunk'){o.visible=false;trees.push(o.position.clone().setY(o.position.y-o.geometry.parameters.height/2));return;}
  if(['Garden_planter','Community_cafe_counter','Shared_kitchen_island','Laundry_counter','Reading_shelf','Seat','Back'].includes(o.name)){
   const p=o.geometry.parameters;if(p.width)o.geometry=new RoundedBoxGeometry(p.width,p.height,p.depth,2,Math.min(.09,p.height*.3));
   o.material=o.name==='Garden_planter'?stone:['Seat','Back'].includes(o.name)?sage:oak;
  }
  if(o.name==='Cafe_table')o.material=stone;
  if(o.name==='Reading_shelf'){
   o.geometry=new RoundedBoxGeometry(.055,2.3,2,2,.015);o.position.x-=.1225;
  }
  if(o.name==='Garden_bench'){
   o.geometry=new RoundedBoxGeometry(8,.35,.7,2,.055);o.position.y=24.475;o.material=oak;
  }
 });
 trees.forEach((base,i)=>finish.add(stylizedTree(base,{height:7.2,spread:5.8,seed:40+i})));
 // Layer low shrubs, grasses and broad leaves entirely inside the two beds.
 const foliage=[[],[],[]],leafShape=new T.SphereGeometry(1,7,5);
 for(const [cx,cz] of [[125,24],[141,32]]){
  for(let j=0;j<22;j++){
   const a=j*2.399963,r=2.1+(j%4)*.5,px=cx+Math.sin(a)*r,pz=cz+Math.cos(a)*r;
   for(let k=0;k<7;k++){
    const angle=k*Math.PI*2/7+j*.3;
    const g=leafShape.clone().scale(.11+(j%3)*.025,.40+(k%3)*.12,.07);
    g.rotateZ(.35+Math.sin(k)*.4);g.rotateY(angle);
    g.translate(px+Math.sin(angle)*.25,25.13+(k%3)*.13,pz+Math.cos(angle)*.25);foliage[j%3].push(g);
   }
  }
  // Segmented cushions and backs keep the established bench footprint.
  for(let i=0;i<4;i++){
   box('Garden_bench_cushion',[1.87,.13,.66],[cx-2.88+i*1.92,24.715,cz-5.1],i===3?clay:sage);
   box('Garden_bench_back',[1.87,.64,.15],[cx-2.88+i*1.92,25.04,cz-4.78],sage);
  }
  for(const dx of [-3.92,0,3.92])box('Garden_bench_arm',[.085,.3,.61],[cx+dx,24.96,cz-5.1],oak);
  box('Planter_seat_glow',[7.65,.035,.035],[cx,24.43,cz-5.47],diffuser);
  for(const dx of [-4.35,4.35])box('Planter_edge_cap',[.2,.09,8.8],[cx+dx,24.99,cz],oak);
  const light=new T.PointLight(0xffe8c7,55,18,2);light.name='Garden_soft_fill';light.position.set(cx,29.4,cz);finish.add(light);
 }
 foliage.forEach((gs,i)=>{add('Layered_garden_foliage',mergeGeometries(gs),leaves[i],[0,0,0]);gs.forEach(g=>g.dispose());});leafShape.dispose();
 // Warm oak battens and stone worktops refine the existing shared facilities.
 box('Cafe_stone_worktop',[10.15,.085,1.3],[132,25.39,42],stone);
 for(let i=0;i<56;i++)box('Cafe_oak_batten',[.095,.82,.045],[127.1+i*.178,24.87,41.378],oak);
 box('Cafe_plinth',[9.7,.13,.07],[132,24.375,41.39],dark);
 box('Espresso_machine',[1.05,.48,.5],[130,25.67,42.15],dark);
 box('Espresso_front',[.86,.24,.025],[130,25.68,41.886],stone);
 box('Espresso_drip_tray',[.85,.035,.21],[130,25.46,41.79],dark);
 for(const x of [129.76,130.24])cylinder('Coffee_cup',.075,.12,[x,25.54,41.83],stone);
 cylinder('Coffee_grinder',.14,.43,[128.98,25.66,42.12],dark);
 cylinder('Cafe_serving_tray',.37,.035,[133.4,25.453,42],oak);
 for(const dx of [-.13,.13])cylinder('Serving_cup',.075,.12,[133.4+dx,25.53,42],stone);
 box('Kitchen_worktop_edge',[8.08,.065,2.05],[131,25.355,39],stone);
 for(const [x,z] of [[142,14],[121,36],[148,23]]){
  cylinder('Table_ceramic_vase',.095,.2,[x,25.245,z],stone);
  add('Table_foliage',new T.SphereGeometry(.16,10,6),leaves[0],[x,25.43,z]);
 }
 // Pendants stop below the rear gallery, rather than crossing its floor.
 for(const x of [128,132,136]){
  cylinder('Cafe_pendant_stem',.022,.85,[x,27.57,41.9],dark,ceiling);
  add('Cafe_pendant_shade',new T.CylinderGeometry(.16,.43,.26,24),oak,[x,27.025,41.9],ceiling);
  cylinder('Cafe_pendant_diffuser',.38,.025,[x,26.891,41.9],diffuser,ceiling);
 }
 for(const y of [28.3,32.3]){
  box('Gallery_warm_light',[40,.035,.09],[133,y-.31,42.25],diffuser,ceiling);
  box('Gallery_end_light',[.09,.035,29],[111.7,y-.31,26.5],diffuser,ceiling);
 }
 for(const x of [124,135])for(let k=0;k<5;k++)box('Acoustic_ceiling_baffle',[.13,.32,22],[x+k*.4,35.16,27],oak,ceiling);
 // Reading shelves gain books, arranged behind the existing seating.
 for(const x of [117,120,123]){
  for(const z of [43.53,45.47])box('Library_end_panel',[.3,2.3,.06],[x,25.45,z],oak);
  for(let level=0;level<4;level++)box('Library_shelf',[.3,.06,1.9],[x,24.61+level*.6,44.5],oak);
  for(let level=0;level<3;level++)for(let i=0;i<6;i++){
   const h=.29+(i%3)*.04;
   box('Library_book',[.23,h,.12],[x+.035,24.64+level*.6+h/2,43.8+i*.22],i%2?clay:sage);
  }
 }
 // Framed abstract prints hang on bare wall runs: the end wall under the gallery and between the gallery doors.
 // Each composition is seeded geometry, so no outside artwork or textures are needed.
 const inks=[0x668279,0xb07d63,0xd4a24c,0x2f4858,0xa4513a].map((c,i)=>material('Commons_art_ink_'+i,c,{roughness:.9,metalness:0}));
 const linen=material('Commons_art_linen',0xeee6d6,{roughness:.95,metalness:0});
 const art={frame:[],linen:[],ink:inks.map(()=>[])};
 const print=(seed,w,h,pos,yaw)=>{
  const rnd=seeded(seed),m=new T.Matrix4().makeRotationY(yaw).setPosition(...pos),bar=.07;
  const put=(list,g)=>list.push(g.applyMatrix4(m));
  for(const [sx,sy,x,y] of [[w+bar*2,bar,0,(h+bar)/2],[w+bar*2,bar,0,-(h+bar)/2],[bar,h,(w+bar)/2,0],[bar,h,-(w+bar)/2,0]])put(art.frame,new T.BoxGeometry(sx,sy,.06).translate(x,y,.03));
  put(art.linen,new T.BoxGeometry(w,h,.02).translate(0,0,.02));
  for(let k=0,n=3+Math.floor(rnd()*3);k<n;k++){
   const ink=art.ink[Math.floor(rnd()*inks.length)],z=.033+k*.004;
   if(rnd()<.35){const r=Math.min(w,h)*(.12+rnd()*.18);put(ink,new T.CylinderGeometry(r,r,.006,32).rotateX(Math.PI/2).translate((rnd()-.5)*(w-r*2.4),(rnd()-.5)*(h-r*2.4),z));}
   else{const sw=w*(.15+rnd()*.45),sh=h*(.12+rnd()*.5);put(ink,new T.BoxGeometry(sw,sh,.006).translate((rnd()-.5)*(w*.9-sw),(rnd()-.5)*(h*.9-sh),z));}
  }
 };
 [22,28,34].forEach((z,i)=>print(70+i,1.6,1.2,[109.6,26.1,z],Math.PI/2));
 print(73,2.2,1.4,[141.5,26.2,45.8],Math.PI);
 [29.9,33.85].forEach((y,j)=>[121.5,130.5,139.5].forEach((x,i)=>print(80+j*3+i,1.4,1,[x,y,45.8],Math.PI)));
 add('Commons_art_frame',mergeGeometries(art.frame),dark,[0,0,0]);
 add('Commons_art_canvas',mergeGeometries(art.linen),linen,[0,0,0]);
 art.ink.forEach((gs,i)=>{if(gs.length)add('Commons_art_print',mergeGeometries(gs),inks[i],[0,0,0]);});
 [art.frame,art.linen,...art.ink].forEach(gs=>gs.forEach(g=>g.dispose()));
 bendRails(parts,finish,dark);
 for(const p of [...parts,...wallParts,finish,ceiling])polishInterior(p,'Garden commons');
 return {revision:2,plantedBeds:2,benchSeats:8,cafePendants:3,framedPrints:10,scope:'Shared commons polish; softened joinery, tailored seating and satin hardware'};
}

// Railings read as bent tube rather than cut-off sticks. The gallery handrails meet at their corners in a smooth
// elbow and a free end curves down into a post on the floor. The stair handrails, which hung over the flights with
// nothing holding them, bend down at both ends into newels on the floor and stand on a post every fifth tread.
const BEND=.25,TREADS_PER_POST=5;
function bendRails(parts,parent,postMat){
 const V=(...a)=>new T.Vector3(...a),down=V(0,-1,0);
 const line=(a,b,r)=>new T.TubeGeometry(new T.LineCurve3(a,b),1,r,12,false);
 const elbow=(a,c,b,r)=>new T.TubeGeometry(new T.QuadraticBezierCurve3(a,c,b),10,r,12,false);
 const put=(name,gs,mat)=>{const o=new T.Mesh(mergeGeometries(gs),mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);gs.forEach(g=>g.dispose());return o;};
 const ends=o=>{const p=o.geometry.parameters?.path?.points;return p&&p.length===2?[p[0].clone().applyMatrix4(o.matrix),p[1].clone().applyMatrix4(o.matrix)]:null;};
 // Gallery handrails (model.js rail()): level tubes 1.1 m over the floor, r .045.
 const rails=parts.filter(o=>o.isMesh&&o.name==='Handrail').map(o=>({o,p:ends(o)})).filter(r=>r.p);
 const bends=[];
 for(const r of rails){
  const cut=[0,0];
  r.p.forEach((e,k)=>{
   const inward=r.p[1-k].clone().sub(e).normalize();
   let partner=null;for(const s of rails)if(s!==r)s.p.forEach((f,m)=>{if(f.distanceTo(e)<.02)partner={s,m};});
   if(partner){
    const other=partner.s.p[1-partner.m].clone().sub(e).normalize();
    // Straight on: the two tubes are one rail. Turning: one elbow, drawn by the first of the pair.
    if(Math.abs(other.dot(inward))>.99)return;
    cut[k]=BEND;if(rails.indexOf(partner.s)>rails.indexOf(r))bends.push(elbow(e.clone().addScaledVector(inward,BEND),e.clone(),e.clone().addScaledVector(other,BEND),.045));
    return;
   }
   cut[k]=BEND;const foot=e.clone().addScaledVector(down,1.1);
   bends.push(elbow(e.clone().addScaledVector(inward,BEND),e.clone(),e.clone().addScaledVector(down,BEND),.045),line(e.clone().addScaledVector(down,BEND),foot,.045));
  });
  const a=r.p[0].clone().lerp(r.p[1],cut[0]/r.p[0].distanceTo(r.p[1])),b=r.p[1].clone().lerp(r.p[0],cut[1]/r.p[0].distanceTo(r.p[1]));
  r.o.geometry.dispose();r.o.geometry=line(a.applyMatrix4(r.o.matrix.clone().invert()),b.applyMatrix4(r.o.matrix.clone().invert()),.045);
 }
 if(bends.length)put('Handrail_bend',bends,rails[0].o.material);
 // Stair handrails (model.js): one sloped tube per side of each flight, 1.1 m over its foot and its head.
 const treads=parts.filter(o=>o.isMesh&&o.name==='Gallery_stair'&&o.geometry.parameters?.width);
 for(const o of parts.filter(o=>o.isMesh&&o.name==='Stair_handrail')){
  const p=ends(o);if(!p)continue;
  const [a,b]=p[0].y<p[1].y?p:[p[1],p[0]],dir=b.clone().sub(a).normalize(),r=o.geometry.parameters.radius||.05;
  const gs=[line(a.clone().addScaledVector(down,1.1),a.clone().addScaledVector(down,BEND),r),elbow(a.clone().addScaledVector(down,BEND),a.clone(),a.clone().addScaledVector(dir,BEND),r),
   line(a.clone().addScaledVector(dir,BEND),b.clone().addScaledVector(dir,-BEND),r),elbow(b.clone().addScaledVector(dir,-BEND),b.clone(),b.clone().addScaledVector(down,BEND),r),
   line(b.clone().addScaledVector(down,BEND),b.clone().addScaledVector(down,1.1),r)];
  o.geometry.dispose();o.geometry=mergeGeometries(gs.map(g=>g.applyMatrix4(o.matrix.clone().invert())));gs.forEach(g=>g.dispose());
  // The flight's treads under this rail, foot to head; a post stands on every fifth one.
  const mine=treads.filter(t=>{const w=t.geometry.parameters.width/2,top=t.position.y+t.geometry.parameters.height/2;return Math.abs(Math.abs(t.position.x-a.x)-w)<.02&&top>a.y-1.15&&top<b.y-1.05;})
   .sort((s,t)=>Math.abs(s.position.z-a.z)-Math.abs(t.position.z-a.z));
  for(let i=TREADS_PER_POST-1;i<mine.length-2;i+=TREADS_PER_POST){
   const t=mine[i],top=t.position.y+t.geometry.parameters.height/2,y=a.y+(b.y-a.y)*(t.position.z-a.z)/(b.z-a.z);
   const m=new T.Mesh(new T.CylinderGeometry(.022,.022,y-top,12),postMat);m.name='Handrail_post';m.position.set(a.x,(y+top)/2,t.position.z);m.castShadow=m.receiveShadow=true;parent.add(m);
  }
 }
}
