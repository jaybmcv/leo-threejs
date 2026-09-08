import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

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
 for(const shelf of bookcases){
  const z=shelf.position.z;
  for(let level=0;level<4;level++)box('Reading_shelf',[.55,.055,6.85],[171,y+.315+level*.55,z],'oak');
  for(const end of [-3.47,3.47])box('Bookcase_end',[.55,2.1,.06],[171,y+1.05,z+end],'oak');
  box('Library_task_light',[.055,.04,6.65],[171.29,y+2.04,z],'light');
 }
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
}

export function finishCrownLounge(root,y){
 const detail=new T.Group();detail.name='Fin_lounge_finish';root.add(detail);
 const {m,add,box,cyl}=kit(detail,'Crown_finish');
 const tables=[],stools=[],bottles=[];
 root.traverse(o=>{
  if(o.name==='Crown_bar_stool_seat')stools.push(o);
  if(o.name==='Crown_lounge_table')tables.push(o);
  if(o.name==='Crown_bar_bottle')bottles.push(o);
  if(o.name==='Crown_curved_banquette_seat'||o.name==='Crown_curved_banquette_back')o.material=m.sage;
  if(o.name==='Crown_plant'){o.geometry=new T.SphereGeometry(.8,16,12);o.scale.set(.8,1.3,.8);}
  if(o.name==='Crown_bar_work_island')o.material=m.oak;
 });
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
 box('Coffee_machine',[.7,.42,.6],[-230.8,y+1.23,-.15],'dark');
 box('Coffee_machine_face',[.55,.24,.025],[-230.8,y+1.25,-.462],'stone');
 box('Coffee_drip_tray',[.56,.035,.13],[-230.8,y+1.055,-.5],'brass');
 for(const x of [-233.6,-233.1])cyl('Bar_cup',.075,.12,[x,y+1.085,-.3],'stone');
 // Service drawers face the staff aisle within the existing island footprint.
 for(const x of [-233.25,-232,-230.75]){
  box('Service_drawer',[1.13,.36,.025],[x,y+.61,-.663],'oak');
  box('Drawer_pull',[.3,.025,.035],[x,y+.72,-.687],'brass');
 }
 root.userData.stage='Refined panoramic lounge with upholstered banquettes and fitted central bar';
}
