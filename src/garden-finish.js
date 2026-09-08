import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {polishInterior} from './interior-polish.js';

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
 for(const part of [...parts,...wallParts])part.traverse(o=>{
  if(!o.isMesh)return;
  if(o.name==='Low_plant'){o.visible=false;return;}
  if(o.name==='Tree_canopy'){
   const radius=o.geometry.parameters.radius;o.geometry=new T.SphereGeometry(radius,14,10);o.scale.set(1,.8,1);o.material=leaves[1];
  }
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
 for(const p of [...parts,...wallParts,finish,ceiling])polishInterior(p,'Garden commons');
 return {revision:2,plantedBeds:2,benchSeats:8,cafePendants:3,scope:'Shared commons polish; softened joinery, tailored seating and satin hardware'};
}
