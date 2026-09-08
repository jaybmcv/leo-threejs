import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import fontData from './assets/helvetiker-bold.json' with {type:'json'};
import {halfWidth,logicalX} from './model.js';
import {finishedRoofY} from './exterior-profile.js';
import {outlinedSlab} from './floor-geometry.js';

export const NOSE_COMMONS=[
 ['The Daily Grind','cafe',0xb97850,'An oak coffee counter, curved conversation groups and small cafe tables.'],
 ['The Reading Room','library',0x697a91,'Low book aisles, individual reading desks and quiet upholstered reading bays.'],
 ['The Colour Works','art',0xbd826d,'Shared studio benches, easels and a walk-through exhibition of resident artwork.'],
 ['Little Orbits','family',0xd9b65e,'Soft play islands, child-height craft tables and seating for accompanying adults.'],
 ['The Listening Room','music',0x856b92,'A rehearsal corner, keyboard stations and intimate listening salons.'],
 ['The Games Club','games',0x518b89,'Chess tables, table tennis and long tables for board games with friends.'],
 ['The Slow Room','wellness',0x8a9c83,'Stretching mats, meditation circles and a quiet tea counter.'],
 ['The Tinker Room','maker',0xb89b60,'Electronics benches, enclosed desktop printers and a communal repair table.'],
 ['The Long Table','kitchen',0xb7775d,'Teaching kitchen islands, shared dining tables and a residents recipe wall.'],
 ['The Quiet Grove','grove',0x658e75,'Low planting islands, winding seating groups and small botanical study tables.'],
].map(([name,kind,color,description],i)=>({number:i+1,deck:i+6,name,kind,color,description}));
const font=new FontLoader().parse(fontData);
const mat=(name,color)=>new T.MeshStandardMaterial({name:'Nose_'+name,color,roughness:.78});
const M={floor:mat('limestone',0xcecfc4),wall:mat('warm_lining',0xe4e4d9),wood:mat('oak',0xa78a67),dark:mat('graphite',0x2b414b),leaf:mat('leaf',0x5d8464),soil:mat('soil',0x4b4b39),paper:mat('paper',0xe9e2cf),metal:mat('metal',0x8b9b9c)};
M.light=new T.MeshStandardMaterial({name:'Nose_warm_light',color:0xffe3b4,emissive:0xffdba1,emissiveIntensity:.5});

// Size the lining at ceiling level, including the finished sloping bow surface.
// Keep furniture aft of the taper and a six-metre spine clear of every activity.
export function nosePlan(number){
 const a=NOSE_COMMONS[number-1];if(!a)throw new Error('Nose commons must be 1–10');
 const y=-39.7+(a.deck-1)*4,ceiling=y+3.45,stations=[];
 for(let x=148;x<=238;x+=2){
  let w=Math.min(56,halfWidth(x,ceiling,4)-3);
  while(w>0&&finishedRoofY(logicalX(x),w)<ceiling+1)w-=.5;
  if(w<15)break;stations.push([x,w]);
 }
 const end=stations.at(-1)[0],outline=[...stations.map(([x,w])=>[x,-w]),...stations.slice().reverse().map(([x,w])=>[x,w])];
 return {a,y,ceiling,stations,end,outline};
}
export function createNoseCommons(number){
 const p=nosePlan(number),{a,y,ceiling,outline,end}=p,root=new T.Group(),shell=new T.Group(),fit=new T.Group();
 root.name='Nose_commons_'+String(number).padStart(2,'0');shell.name='Nose_lining';fit.name='Nose_furnishings';root.add(shell,fit);
 const accent=mat(a.kind,a.color),features={};
 function add(name,g,m,parent=fit){const o=new T.Mesh(g,m);o.name=name;o.receiveShadow=true;parent.add(o);return o;}
 function box(name,size,pos,m=accent,parent=fit,r=0){const g=r?new RoundedBoxGeometry(...size,1,Math.min(r,...size.map(v=>v/3))):new T.BoxGeometry(...size);const o=add(name,g,m,parent);o.position.set(pos[0],y+pos[1],pos[2]);return o;}
 function cyl(name,r,h,x,z,cy,m=accent){const o=add(name,new T.CylinderGeometry(r,r,h,20),m);o.position.set(x,y+cy,z);return o;}
 function label(text,x,z,cy=2.45,size=.5,rot=-Math.PI/2){const g=new TextGeometry(text,{font,size,depth:.005,curveSegments:1});g.computeBoundingBox();g.translate(-g.boundingBox.max.x/2,0,0);const o=add('Commons_wayfinding',g,M.dark);o.position.set(x,y+cy,z);o.rotation.y=rot;return o;}
 const floor=add('Nose_finished_floor',outlinedSlab(outline,[],y,.02),M.floor,root);
 add('Nose_entry_floor',outlinedSlab([[134,-2],[148,-2],[148,2],[134,2]],[],y,.02),M.floor,root);
 add('Nose_ceiling',outlinedSlab(outline,[],ceiling+.08,.08),M.wall,shell);
 for(let i=0;i<outline.length;i++){
  const b=outline[i],c=outline[(i+1)%outline.length];
  if(b[0]===148&&c[0]===148)continue;
  const length=Math.hypot(c[0]-b[0],c[1]-b[1]);
  const o=box('Nose_perimeter_lining',[length,3.45,.16],[(b[0]+c[0])/2,1.725,(b[1]+c[1])/2],M.wall,shell);o.rotation.y=-Math.atan2(c[1]-b[1],c[0]-b[0]);
 }
 const rearW=p.stations[0][1];for(const s of [-1,1])box('Nose_entry_bulkhead',[.16,3.45,rearW-3],[148,1.725,s*(rearW+3)/2],M.wall,shell);
 box('Central_promenade_finish',[end-149,.012,6],[(149+end)/2,.008,0],M.paper);
 for(const s of [-1,1])box('Promenade_edge',[end-150,.015,.08],[(150+end)/2,.014,s*2.8],accent);
 label('D'+a.deck+' / '+a.name.toUpperCase(),end-.3,0,2.5,.44);
 label('LIFTS / HOMES',148.15,10,2.5,.3,Math.PI/2);
 for(let x=154;x<end-2;x+=10)box('Warm_ceiling_strip',[4,.05,.14],[x,3.38,0],M.light,shell);
 function seat(x,z,rot=0){const g=new T.Group();fit.add(g);g.position.set(x,0,z);g.rotation.y=rot;
  box('Seat_base',[.7,.32,.68],[0,.2,0],M.wood,g,.035);box('Seat_cushion',[.8,.14,.78],[0,.43,0],accent,g,.055);box('Seat_back',[.8,.62,.13],[0,.74,.34],accent,g,.05);}
 function table(x,z,l=2.4,w=1.1){box('Shared_table',[l,.10,w],[x,.76,z],M.wood,fit,.035);for(const s of [-1,1])box('Table_trestle',[.12,.7,w*.75],[x+s*l*.34,.35,z],M.dark);}
 function setting(x,z){cyl('Cup',.07,.12,x,z,.91,M.paper);cyl('Plate',.18,.018,x+.4,z,.825,M.paper);}
 function plant(x,z,r=1.2){cyl('Planter',r,.55,x,z,.275,M.paper);cyl('Soil',r*.91,.04,x,z,.56,M.soil);for(let i=0;i<5;i++){const o=add('Low_foliage',new T.SphereGeometry(r*.42,8,6),M.leaf);o.scale.y=1.4;o.position.set(x+Math.cos(i*1.26)*r*.5,y+.58+r*.55,z+Math.sin(i*1.26)*r*.5);}}
 function salon(x,z,count=6,r=2.6){cyl('Salon_rug',r+1,.018,x,z,.018,accent);cyl('Coffee_table',.65,.1,x,z,.51,M.wood);cyl('Coffee_table_base',.12,.46,x,z,.23,M.dark);for(let i=0;i<count;i++){const t=i/count*Math.PI*2;seat(x+Math.cos(t)*r,z+Math.sin(t)*r,Math.PI/2-t);}}
 function counter(x,z,l=7){box('Service_counter',[l,.9,1.1],[x,.45,z],M.wood,fit,.05);box('Countertop',[l+.1,.08,1.2],[x,.94,z],M.paper,fit,.025);for(let i=-2;i<=2;i++)box('Counter_front_fluting',[.035,.7,.02],[x+i*l/6,.46,z+.56],M.dark);}
 function books(x,z){box('Open_bookcase',[4,1.8,.48],[x,.9,z],M.wood);for(let j=0;j<4;j++)for(let k=0;k<12;k++)box('Book_spine',[.16,.25+(k%3)*.04,.22],[x-1.75+k*.31,.27+j*.41,z+.27],k%2?accent:M.paper);}
 function groupFeature(kind){features[kind]=(features[kind]||0)+1;}
 // Bays have deliberately different shapes and occupancies. Omit any bay that
 // would intrude into the narrower upper-deck bow rather than squeezing it.
 const bays=[];
 for(const x of [161,183,number===10?201:205,227])for(const z of [-38,-15,15,38]){
  if(x+8>end-1)continue;
  const near=p.stations.filter(([sx])=>Math.abs(sx-x)<=9);
  if(near.length&&Math.abs(z)+8<Math.min(...near.map(v=>v[1])))bays.push([x,z]);
 }
 bays.forEach(([x,z],i)=>{
  groupFeature(a.kind);
  if(a.kind==='cafe'){
   if(i===0){counter(x,z);box('Espresso_machine',[1.3,.6,.6],[x,.128+1.2,z],M.metal,fit,.06);for(let k=-2;k<=2;k++)seat(x+k*1.25,z+2.3);}
   else if(i%3===0)salon(x,z,7,3.1);
   else for(const dx of [-3,3])for(const dz of [-3,3]){cyl('Cafe_table',.7,.1,x+dx,z+dz,.77,M.wood);cyl('Cafe_pedestal',.13,.72,x+dx,z+dz,.36,M.dark);seat(x+dx,z+dz-1.1,Math.PI);seat(x+dx,z+dz+1.1);setting(x+dx,z+dz);}
  }else if(a.kind==='library'){
   if(i%2===0){for(const dz of [-4,0,4])books(x,z+dz);}
   else {salon(x,z,4,3);for(const dx of [-5,5]){table(x+dx,z,1.5,.75);seat(x+dx,z+1.1);box('Open_book',[.45,.04,.32],[x+dx,.84,z],M.paper);}}
  }else if(a.kind==='art'){
   if(i%3===0){for(let j=-2;j<=2;j++){box('Easel_leg',[.06,1.9,.08],[x+j*2.4,.95,z],M.wood);box('Painting_canvas',[1.5,1.1,.05],[x+j*2.4,1.4,z+.08],M.paper);box('Resident_artwork',[.75,.45,.025],[x+j*2.4,1.42,z+.12],accent);}}
   else {table(x,z,7,2);for(const dx of [-2.5,0,2.5])for(const s of [-1,1]){seat(x+dx,z+s*1.8,s<0?Math.PI:0);box('Drawing_sheet',[.7,.012,.5],[x+dx,.825,z+s*.55],M.paper);}counter(x,z-5,5);}
  }else if(a.kind==='family'){
   if(i%2===0){cyl('Soft_play_island',5,.06,x,z,.035,accent);for(let j=0;j<7;j++){const t=j*.9;box('Soft_play_block',[.8,.4+(j%3)*.2,.8],[x+Math.cos(t)*2,.26+(j%3)*.1,z+Math.sin(t)*2],j%2?M.paper:accent,fit,.13);}for(const dx of [-4,4])seat(x+dx,z+4);}
   else {box('Child_craft_table',[3,.09,1.6],[x,.51,z],M.wood,fit,.06);for(const dx of [-1,0,1])for(const s of [-1,1])cyl('Child_stool',.26,.3,x+dx,z+s*1.2,.15,accent);salon(x,z+4,3,2);}
  }else if(a.kind==='music'){
   if(i===0){box('Piano_body',[2.4,.65,.9],[x,.72,z],M.dark,fit,.06);for(let j=0;j<28;j++)box('Piano_key',[.069,.025,.25],[x-1+j*.075,.94,z+.58],M.paper);seat(x,z+1.5);for(const dx of [-4,4])box('Acoustic_screen',[2,2.4,.22],[x+dx,1.2,z],accent,fit,.07);}
   else if(i%3===0){table(x,z,3.2,.85);box('Mixing_console',[2,.12,.65],[x,.86,z],M.dark);for(let j=0;j<12;j++)box('Mixer_fader',[.025,.015,.23],[x-.85+j*.15,.93,z],M.paper);seat(x,z+1.3);}
   else salon(x,z,8,3.4);
  }else if(a.kind==='games'){
   if(i%3===0){table(x,z,2.74,1.525);box('Table_tennis_surface',[2.74,.025,1.525],[x,.825,z],accent);box('Table_tennis_net',[.025,.152,1.525],[x,.914,z],M.paper);}
   else if(i%2===0){table(x,z,5,1.6);for(const dx of [-1.8,0,1.8])for(const s of [-1,1])seat(x+dx,z+s*1.5,s<0?Math.PI:0);}
   else for(const dz of [-3,3]){table(x,z+dz,1.2,1.2);for(let j=0;j<8;j++)for(let k=0;k<8;k++)box('Chess_square',[.1,.01,.1],[x-.35+j*.1,.82,z+dz-.35+k*.1],(j+k)%2?M.dark:M.paper);seat(x,z+dz+1.2);seat(x,z+dz-1.2,Math.PI);}
  }else if(a.kind==='wellness'){
   if(i===0){counter(x,z,5);for(const dx of [-1,0,1])cyl('Tea_pot',.15,.24,x+dx,z,1.09,M.paper);salon(x,z+4,4,2.5);}
   else if(i%2===0){for(const dx of [-3,0,3])for(const dz of [-3,2])box('Stretching_mat',[.85,.035,2],[x+dx,.02,z+dz],accent,fit,.06);}
   else {for(let j=0;j<8;j++){const t=j*Math.PI/4;cyl('Meditation_cushion',.42,.16,x+Math.cos(t)*3,z+Math.sin(t)*3,.08,accent);}plant(x,z,.8);}
  }else if(a.kind==='maker'){
   table(x,z,i%2?6:3,1.7);for(const dx of [-1,1]){seat(x+dx,z+1.5);box('Electronics_mat',[.8,.015,.6],[x+dx,.825,z],M.dark);box('Repair_parts',[.2,.08,.16],[x+dx,.87,z],M.metal);}
   if(i%2===0){counter(x,z-4,5);for(const dx of [-1.5,1.5]){box('Enclosed_desktop_printer',[.8,.8,.7],[x+dx,1.38,z-4],M.dark,fit,.04);box('Printer_front',[.6,.55,.025],[x+dx,1.39,z-3.64],M.metal);}}
   else {box('Tool_wall',[4,1.8,.12],[x,1.65,z-4],M.wood);for(let j=-4;j<=4;j++)box('Hand_tool',[.08,.5,.08],[x+j*.4,1.7,z-3.89],M.metal);}
  }else if(a.kind==='kitchen'){
   if(i%3===0){counter(x,z,7);for(const dx of [-2,2]){box('Induction_hob',[1,.025,.65],[x+dx,1,z],M.dark);for(const s of [-1,1])cyl('Cooking_pan',.17,.12,x+dx+s*.25,z,1.075,M.metal);}counter(x,z-4,6);}
   else {table(x,z,8,1.8);for(const dx of [-3,-1,1,3])for(const s of [-1,1]){seat(x+dx,z+s*1.6,s<0?Math.PI:0);setting(x+dx,z+s*.55);}}
  }else{
   if(i%3===0){for(const dx of [-3,3])for(const dz of [-2,2])plant(x+dx,z+dz,1.8);}
   else if(i%2){salon(x,z,5,3.2);plant(x-5,z,1.1);}
   else {table(x,z,3,1.2);seat(x,z+1.3);plant(x,z-3,2);box('Botanical_sketchbook',[.6,.045,.45],[x,.84,z],M.paper);}
  }
 });
 root.userData={noseCommons:true,number,deck:a.deck,name:a.name,kind:a.kind,features,bays:bays.length,floor:y,clearSpineWidth:6,description:a.description};
 return {root,shell,fit,plan:p,overview:{position:[end+32,y+76,106],target:[(148+end)/2,y,0]},inside:{position:[153,y+1.7,0],target:[183,y+1.6,15]}};
}
