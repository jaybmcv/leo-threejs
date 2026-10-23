import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {polishInterior} from './interior-polish.js';
import {shrubGeometry} from './stylized-plants.js';

function kit(root,prefix){
 const mat=(name,color,extra={})=>new T.MeshStandardMaterial({name:prefix+' '+name,color,roughness:.65,metalness:0,...extra});
 const m={oak:mat('oak',0xa98762),stone:mat('limestone',0xd7cbb5,{roughness:.82}),sage:mat('sage fabric',0x668279,{roughness:1}),clay:mat('clay fabric',0xb18169,{roughness:1}),brass:mat('satin bronze',0xa58c62,{roughness:.32,metalness:.7}),dark:mat('graphite',0x273c46,{roughness:.4,metalness:.3}),leaf:mat('foliage',0x547b59,{roughness:1}),light:mat('warm diffuser',0xffe2b0,{emissive:0xffd197,emissiveIntensity:.65}),glass:mat('bottle glass',0x487e74,{roughness:.2,metalness:.15})};
 const add=(name,geo,p,material,parent=root)=>{const o=new T.Mesh(geo,m[material]);o.name=prefix+'_'+name;o.position.set(...p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const box=(name,size,p,material,parent=root,r=.035)=>add(name,new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(v=>v*.4))),p,material,parent);
 const cyl=(name,r,h,p,material,parent=root)=>add(name,new T.CylinderGeometry(r,r,h,20),p,material,parent);
 return {m,add,box,cyl};
}

export function finishForwardLounge(lounge,shell,y){
 const detail=new T.Group();detail.name='Forward_lounge_finish';lounge.add(detail);
 const {m,add,box,cyl}=kit(detail,'Forward');
 const chairs=[],planters=[],tables=[],bookcases=[];
 lounge.traverse(o=>{
  if(o.name==='Upholstered_lounge_chair')chairs.push(o);
  if(o.name==='Lounge_planter')planters.push(o);
  if(o.name==='Round_lounge_table')tables.push(o);
  if(o.name==='Bookcase')bookcases.push(o);
  if(o.name==='Lounge_plant')o.visible=false;
  if(o.name==='Lounge_rug'){o.geometry=new RoundedBoxGeometry(16,.025,16,3,.01);o.material=m.sage;}
  if(o.name==='Continuous_window_ledge')o.material=m.oak;
  if(o.name==='Reading_bench'){o.material=m.oak;o.geometry=new RoundedBoxGeometry(1.1,.48,8,2,.07);}
  if(o.name==='Reading_bench_back')o.material=m.sage;
  if(o.name==='Bookcase'){o.geometry=new RoundedBoxGeometry(.055,2.1,7,2,.015);o.position.x=170.7525;}
 });
 chairs.forEach((chair,i)=>{
  chair.traverse(o=>{if(['Soft_seat','Soft_back','Padded_arm'].includes(o.name))o.material=i%6===0?m.clay:m.sage;if(o.name==='Chair_plinth')o.material=m.oak;});
  box('Chair_underseat_reveal',[.71,.045,.66],[0,.297,0],'dark',chair);
 });
 for(const table of tables){
  table.material=m.stone;const {x,z}=table.position;
  box('Table_book',[.28,.035,.2],[x+.34,y+.773,z+.12],'clay');
  cyl('Tea_cup',.07,.11,[x-.31,y+.81,z+.2],'stone');
  cyl('Cup_saucer',.105,.016,[x-.31,y+.762,z+.2],'oak');
 }
 const spines=[0x688997,0xb18169,0x668279,0x2f4858,0xd8cdb4,0x8a5a44].map((c,i)=>new T.MeshStandardMaterial({name:'Forward book cloth '+i,color:c,roughness:.85,metalness:0})),books=spines.map(()=>[]);
 let seed=7;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
 for(const shelf of bookcases){
  const z=shelf.position.z;
  for(let level=0;level<4;level++)box('Reading_shelf',[.55,.055,6.85],[171,y+.315+level*.55,z],'oak');
  for(const end of [-3.47,3.47])box('Bookcase_end',[.55,2.1,.06],[171,y+1.05,z+end],'oak');
  box('Library_task_light',[.055,.04,6.65],[171.29,y+2.04,z],'light');
  // Books fill the three lower shelves end to end, broken by a few lying stacks and small objects.
  for(let level=0;level<3;level++){
   const base=y+.3425+level*.55;let at=z-3.42;
   while(at<z+3.42){
    const r=rnd();
    if(r<.05&&at<z+3.1){
     const c=at+.15,kind=Math.floor(rnd()*3);
     if(kind===0)cyl('Shelf_vase',.055,.2,[171.03,base+.1,c],'glass');
     else if(kind===1)add('Shelf_bowl',new T.CylinderGeometry(.1,.06,.07,20),[171.03,base+.035,c],'stone');
     else{cyl('Shelf_plant_pot',.07,.11,[171.03,base+.055,c],'stone');add('Shelf_plant',new T.SphereGeometry(.11,10,8),[171.03,base+.2,c],'leaf').scale.set(1,1.2,1);}
     at+=.3;continue;
    }
    if(r<.1&&at<z+3.1){
     const n=2+Math.floor(rnd()*3);
     for(let i=0;i<n;i++)books[Math.floor(rnd()*spines.length)].push([171.05,base+.022+i*.044,at+.14,.3,.04,.22-i*.01]);
     at+=.3;continue;
    }
    const t=.03+rnd()*.04,h=.22+rnd()*.14,d=.26+rnd()*.12;
    if(at+t>z+3.42)break;
    books[Math.floor(rnd()*spines.length)].push([171.235-d/2,base+h/2,at+t/2,d,h,t]);at+=t+.004;
   }
  }
 }
 // One instanced mesh per cloth colour keeps the few hundred books cheap to draw.
 books.forEach((list,i)=>{
  const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),spines[i],list.length);mesh.name='Forward_shelf_books';mesh.castShadow=mesh.receiveShadow=true;
  list.forEach(([x,by,bz,d,h,t],j)=>mesh.setMatrixAt(j,new T.Matrix4().compose(new T.Vector3(x,by,bz),new T.Quaternion(),new T.Vector3(d,h,t))));detail.add(mesh);
 });
 for(const planter of planters){
  planter.material=m.stone;planter.geometry=new RoundedBoxGeometry(2.4,.65,2.4,2,.08);
  const {x,z}=planter.position;
  box('Planter_soil',[2.16,.035,2.16],[x,y+.64,z],'dark');
  for(let j=0;j<20;j++){
   const a=j*2.39996,r=.25+(j%4)*.17;
   const leaf=add('Broad_leaf',new T.SphereGeometry(1,8,6),[x+Math.sin(a)*r,y+.98+(j%3)*.16,z+Math.cos(a)*r],'leaf');
   leaf.scale.set(.14,.38+(j%3)*.08,.055);leaf.rotation.set(.35*Math.sin(a),a,.45*Math.cos(a));
  }
 }
 // Timber wall lining stops short of the entrance and stays behind the seats.
 for(const s of [-1,1])for(let k=0;k<36;k++)box('Rear_wall_batten',[.085,2.7,.07],[170.18,y+1.45,s*(8+k*.72)],'oak',shell);
 // A bronze collar and eyepiece turn the existing scope into a readable object.
 cyl('Scope_column',.13,.63,[203,y+.85,0],'brass');
 const lens=cyl('Scope_optical_head',.21,.12,[203.5,y+1.49,0],'dark');lens.rotation.z=-Math.PI/2.8;
 polishInterior(lounge,'Forward observation lounge');polishInterior(shell,'Forward observation lining');
}

export function finishCrownLounge(root,y){
 const detail=new T.Group();detail.name='Fin_lounge_finish';root.add(detail);
 const {m,add,box,cyl}=kit(detail,'Crown_finish');
 const tables=[],stools=[],bottles=[],plants=[];
 root.traverse(o=>{
  if(o.name==='Crown_bar_stool_seat')stools.push(o);
  if(o.name==='Crown_lounge_table')tables.push(o);
  if(o.name==='Crown_bar_bottle')bottles.push(o);
  if(o.name==='Crown_curved_banquette_seat'||o.name==='Crown_curved_banquette_back')o.material=m.sage;
  if(o.name==='Crown_plant')plants.push(o);
  if(o.name==='Crown_bar_work_island')o.material=m.oak;
 });
 // Each planter holds a leafy shrub rooted on its top, 0.7 m below the old plant's centre.
 const foliage=new T.MeshStandardMaterial({name:'Crown_finish foliage',vertexColors:true,flatShading:true,roughness:.85});
 plants.forEach((o,i)=>{o.geometry=shrubGeometry({height:1.75,spread:1.15,seed:141+i}).translate(0,-.7,0);o.material=foliage;});
 for(const s of [-1,1]){
  for(let k=0;k<49;k++)box('Bar_oak_batten',[.09,.81,.045],[-236.85+k*.2,y+.655,s*3.3225],'oak');
  box('Counter_bronze_edge',[10.24,.03,.025],[-232,y+1.15,s*3.452],'brass');
 }
 stools.forEach(o=>{
  o.material=m.sage;const {x,z}=o.position,s=Math.sign(z);
  box('Stool_back',[.57,.34,.1],[x,y+1.1,z+s*.31],'sage');
  for(const dx of [-.235,.235])box('Stool_back_support',[.025,.34,.025],[x+dx,y+.91,z+s*.31],'brass');
  const ring=add('Stool_footrest',new T.TorusGeometry(.22,.018,8,24),[x,y+.32,z],'brass');ring.rotation.x=Math.PI/2;
 });
 for(const table of tables){
  table.material=m.stone;const {x,z}=table.position;
  cyl('Table_lamp_base',.13,.035,[x,y+.737,z],'brass');
  cyl('Table_lamp_stem',.025,.23,[x,y+.87,z],'brass');
  add('Table_lamp_shade',new T.CylinderGeometry(.1,.22,.19,20),[x,y+1.025,z],'light');
  for(const dx of [-.35,.35])cyl('Table_drink',.065,.14,[x+dx,y+.795,z+.17],'glass');
 }
 for(const bottle of bottles){
  bottle.material=m.glass;const {x,z}=bottle.position;
  cyl('Bottle_neck',.03,.11,[x,y+1.43,z],'glass');
  cyl('Bottle_cap',.033,.025,[x,y+1.495,z],'brass');
 }
 // One instanced mesh per part and finish keeps the tap row and back-bar bottles cheap to draw.
 const at=(x,py,z,sx=1,sy=1,sz=1,rx=0)=>new T.Matrix4().compose(new T.Vector3(x,py,z),new T.Quaternion().setFromEuler(new T.Euler(rx,0,0)),new T.Vector3(sx,sy,sz));
 const inst=(name,geo,material,list)=>{const o=new T.InstancedMesh(geo,material,list.length);o.name='Crown_finish_'+name;o.castShadow=o.receiveShadow=true;list.forEach((matrix,j)=>o.setMatrixAt(j,matrix));detail.add(o);return o;};
 // Six draught taps stand along the inner edge of the starboard counter, spouts toward the staff aisle.
 const taps=[0,1,2,3,4,5].map(i=>-234.25+i*.5),tz=2.47,badges=[[],[],[]];
 box('Tap_drip_tray',[3.1,.025,.16],[-233,y+1.213,tz],'dark');
 inst('Tap_column',new T.CylinderGeometry(.05,.035,.36,16),m.brass,taps.map(x=>at(x,y+1.4,tz)));
 inst('Tap_spout',new T.BoxGeometry(.03,.03,.12),m.brass,taps.map(x=>at(x,y+1.52,tz-.08)));
 inst('Tap_handle',new T.CylinderGeometry(.022,.03,.2,12),m.oak,taps.map(x=>at(x,y+1.68,tz)));
 taps.forEach((x,i)=>badges[i%3].push(at(x,y+1.84,tz,1,1,1,Math.PI/2)));
 badges.forEach((list,i)=>inst('Tap_badge',new T.CylinderGeometry(.075,.075,.015,24),[m.stone,m.sage,m.clay][i],list));
 // A low oak step on the work island's starboard edge displays a row of spirits bottles.
 box('Back_bar_bottle_step',[3.7,.14,.2],[-232.05,y+1.09,.6],'oak');
 const spirit=(name,color,extra={})=>new T.MeshStandardMaterial({name:'Crown_finish spirit glass '+name,color,roughness:.15,metalness:.1,...extra});
 const kinds=[{r:.055,h:.3,mat:spirit('amber',0x9a5a1e)},{square:true,h:.26,mat:spirit('clear',0xcfd8d3,{roughness:.08})},{r:.045,h:.34,mat:spirit('ruby',0x7a2430)},{r:.06,h:.24,mat:spirit('smoke',0x3b4a3f)}];
 const round=kinds.map(()=>[]),square=[],necks=[],caps=[],base=y+1.16;
 for(let i=0;i<12;i++){
  const x=-233.75+i*.3,k=kinds[i%4],top=base+k.h;
  if(k.square){square.push(at(x,base+k.h/2,.6,.1,k.h,.1));necks.push(at(x,top+.045,.6,.018,.09,.018));}
  else round[i%4].push(at(x,base+k.h/2,.6,k.r,k.h,k.r),at(x,top+.045,.6,.018,.09,.018));
  caps.push(at(x,top+.1,.6,.022,.025,.022));
 }
 const unit=new T.CylinderGeometry(1,1,1,16);
 kinds.forEach((k,i)=>{if(round[i].length)inst('Spirit_bottle',unit,k.mat,round[i]);});
 inst('Spirit_bottle',new T.BoxGeometry(1,1,1),kinds[1].mat,square);
 inst('Spirit_bottle_neck',unit,kinds[1].mat,necks);
 inst('Spirit_bottle_cap',unit,m.brass,caps);
 box('Coffee_machine',[.7,.42,.6],[-230.8,y+1.23,-.15],'dark');
 box('Coffee_machine_face',[.55,.24,.025],[-230.8,y+1.25,-.462],'stone');
 box('Coffee_drip_tray',[.56,.035,.13],[-230.8,y+1.055,-.5],'brass');
 for(const x of [-233.6,-233.1])cyl('Bar_cup',.075,.12,[x,y+1.085,-.3],'stone');
 // Service drawers face the staff aisle within the existing island footprint.
 for(const x of [-233.25,-232,-230.75]){
  box('Service_drawer',[1.13,.36,.025],[x,y+.61,-.663],'oak');
  box('Drawer_pull',[.3,.025,.035],[x,y+.72,-.687],'brass');
 }
 // A two-tier bronze chandelier hangs from the ceiling rib over the middle of the bar, clear of heads and the halo.
 const cx=-232,top=y+4.92,parts={brass:[],light:[],crystal:[]},o=new T.Object3D();
 const part=(kind,geo,p,rot=[0,0,0],sy=1)=>{o.position.set(...p);o.rotation.set(...rot);o.scale.set(1,sy,1);o.updateMatrix();parts[kind].push(geo.applyMatrix4(o.matrix));};
 part('brass',new T.CylinderGeometry(.24,.24,.06,24),[cx,top-.03,0]);
 part('brass',new T.CylinderGeometry(.022,.022,.82,12),[cx,top-.47,0]);
 part('brass',new T.SphereGeometry(.15,20,14),[cx,y+3.97,0]);
 part('brass',new T.CylinderGeometry(.05,.1,.55,20),[cx,y+3.66,0]);
 for(const [r,h,n] of [[1.05,y+3.95,12],[.62,y+3.52,8]]){
  part('brass',new T.TorusGeometry(r,.022,8,64),[cx,h,0],[Math.PI/2,0,0]);
  for(let k=0;k<n;k++){
   const a=(k+.5)/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
   part('brass',new T.BoxGeometry(r,.024,.024),[cx+c*r/2,h,s*r/2],[0,-a,0]);
   part('brass',new T.CylinderGeometry(.045,.045,.05,12),[cx+c*r,h+.04,s*r]);
   part('light',new T.SphereGeometry(.055,12,8),[cx+c*r,h+.12,s*r],undefined,1.5);
  }
  for(let k=0;k<n*2;k++){const a=k/(n*2)*Math.PI*2;part('crystal',new T.OctahedronGeometry(.045),[cx+Math.cos(a)*r,h-.13,Math.sin(a)*r],undefined,2);}
 }
 part('crystal',new T.OctahedronGeometry(.09),[cx,y+3.25,0],undefined,1.8);
 const crystal=new T.MeshStandardMaterial({name:'Crown_finish crystal',color:0xfff4e2,emissive:0xffd8a8,emissiveIntensity:.35,roughness:.08,metalness:.1});
 for(const [kind,name] of [['brass','Chandelier_frame'],['light','Chandelier_light_bulbs'],['crystal','Chandelier_glass_drops']]){
  const g=mergeGeometries(parts[kind]);parts[kind].forEach(g=>g.dispose());const mesh=add(name,g,[0,0,0],kind==='crystal'?'light':kind);if(kind==='crystal')mesh.material=crystal;
 }
 root.userData.stage='Refined panoramic lounge with upholstered banquettes and fitted central bar';
 polishInterior(root,'Fin crown observation lounge');
}
