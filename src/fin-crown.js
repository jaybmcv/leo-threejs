import * as T from 'three';
import capPlan from './assets/fin-cap-plan.json' with {type:'json'};
import {outlinedSlab,unionRectangles,slabGeometry} from './floor-geometry.js';

export const CROWN={floor:132.3,ceiling:137.5,outline:capPlan.map(([x,z])=>[-235+(x+235)*.985,z*.985]),lift:{x0:-249.2,x1:-244.8,z0:-2.2,z1:2.2}};
export function createFinCrown(){
 const root=new T.Group();root.name='Fin_panorama_lounge';root.userData={floor:CROWN.floor,centralBar:1,stage:'Fin crown observation deck concept'};
 const shell=new T.Group();shell.name='Crown_exterior';root.add(shell);const roofs=[];
 const mat=(name,color,extra={})=>new T.MeshStandardMaterial({name,color,roughness:.55,...extra});
 const m={floor:mat('Crown warm timber',0x81624a),navy:mat('Crown navy fascia',0x233b4b),ivory:mat('Crown ceramic',0xd9dfda),frame:mat('Crown bronze',0x9d7950,{metalness:.65}),seat:mat('Crown teal upholstery',0x357778),stone:mat('Bar pale stone',0xd8ccb3),leaf:mat('Planter foliage',0x456b50),light:mat('Warm light',0xffd39c,{emissive:0xffc783,emissiveIntensity:1}),glass:mat('Panoramic blue glazing',0x83b4c5,{transparent:true,opacity:.23,metalness:.1,roughness:.13,side:T.DoubleSide,depthWrite:false})};
 function mesh(name,geo,p,material,g=root){const o=new T.Mesh(geo,m[material]);o.name=name;o.position.set(...p);o.castShadow=material!=='glass';o.receiveShadow=true;g.add(o);return o;}
 const box=(name,size,p,material,g)=>mesh(name,new T.BoxGeometry(...size),p,material,g);
 const cyl=(name,r,h,p,material,g)=>mesh(name,new T.CylinderGeometry(r,r,h,32),p,material,g);
 const y=CROWN.floor;
 mesh('Crown_observation_floor',outlinedSlab(CROWN.outline,[CROWN.lift],y,.55),[0,0,0],'floor',shell);
 // Low sill and continuous glazing follow the accepted cap's projected outline.
 const perimeter=[],lengths=CROWN.outline.map((a,i)=>{const b=CROWN.outline[(i+1)%CROWN.outline.length];return Math.hypot(b[0]-a[0],b[1]-a[1]);}),total=lengths.reduce((a,b)=>a+b,0),count=Math.ceil(total/3.2);
 for(let j=0;j<count;j++){let distance=total*j/count,i=0;while(distance>lengths[i]&&i<lengths.length-1)distance-=lengths[i++];const a=CROWN.outline[i],b=CROWN.outline[(i+1)%CROWN.outline.length],t=distance/lengths[i];perimeter.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
 function edge(name,a,b,h,cy,thick,material){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),o=box(name,[len+.02,h,thick],[(a[0]+b[0])/2,cy,(a[1]+b[1])/2],material,shell);o.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);}
 for(let i=0;i<perimeter.length;i++){const a=perimeter[i],b=perimeter[(i+1)%perimeter.length];edge('Crown_window_sill',a,b,.75,y+.1,.25,'navy');edge('Crown_sill_inlay',a,b,.07,y-.12,.29,'ivory');edge('Crown_panoramic_window',a,b,4.15,y+2.55,.055,'glass');edge('Crown_window_header',a,b,.3,y+4.8,.26,'ivory');edge('Crown_header_gasket',a,b,.065,y+4.59,.27,'navy');box('Crown_window_mullion',[.1,4.4,.1],[a[0],y+2.55,a[1]],'frame',shell);}
 const roof=mesh('Crown_roof',outlinedSlab(CROWN.outline,[],CROWN.ceiling+.6,.6),[0,0,0],'ivory',shell);roofs.push(roof);
 for(const z of [-10,10]){const o=box('Crown_ceiling_light',[59,.07,.18],[-236,CROWN.ceiling-.08,z],'light',shell);roofs.push(o);}
 // A walk-in island bar, with a clear staff entrance on its aft end.
 const barRects=[{x0:-237,x1:-227,z0:-3.3,z1:-2.3},{x0:-237,x1:-227,z0:2.3,z1:3.3},{x0:-228,x1:-227,z0:-2.3,z1:2.3}];
 mesh('Crown_central_bar',slabGeometry(unionRectangles(barRects),y+1.08,.95),[0,0,0],'navy');
 mesh('Crown_bar_counter',slabGeometry(unionRectangles(barRects.map(r=>({x0:r.x0-.15,x1:r.x1+.15,z0:r.z0-.15,z1:r.z1+.15}))),y+1.2,.12),[0,0,0],'stone');
 box('Crown_bar_work_island',[4,.92,1.3],[-232,y+.46,0],'floor');box('Crown_bar_worktop',[4.2,.1,1.5],[-232,y+.97,0],'stone');
 for(const x of [-235.5,-233.5,-231.5,-229.5])for(const z of [-4.4,4.4]){cyl('Crown_bar_stool_base',.28,.08,[x,y+.04,z],'frame');cyl('Crown_bar_stool_stem',.055,.68,[x,y+.4,z],'frame');cyl('Crown_bar_stool_seat',.36,.16,[x,y+.83,z],'seat');}
 for(const x of [-233,-232.5,-232,-231.5])cyl('Crown_bar_bottle',.08,.35,[x,y+1.2,.35],'leaf');
 // Small seating groups keep the long windows and central circulation open.
 for(const x of [-269,-258,-214,-204])for(const s of [-1,1]){const z=s*(x===-204?5.4:9);
  cyl('Crown_lounge_table',.85,.12,[x,y+.66,z],'stone');cyl('Crown_table_pedestal',.11,.6,[x,y+.3,z],'frame');
  function crescent(name,inner,outer,height,bottom,material){const shape=new T.Shape();for(let i=0;i<=32;i++){const a=Math.PI*i/32;const px=Math.cos(a)*outer,pz=-s*Math.sin(a)*outer;i?shape.lineTo(px,pz):shape.moveTo(px,pz);}for(let i=32;i>=0;i--){const a=Math.PI*i/32;shape.lineTo(Math.cos(a)*inner,-s*Math.sin(a)*inner);}shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:true,bevelSize:.05,bevelThickness:.04,bevelSegments:3,steps:1});geo.rotateX(-Math.PI/2);return mesh(name,geo,[x,y+bottom,z],material);}
  crescent('Crown_curved_banquette_base',1.28,1.98,.26,.12,'navy');crescent('Crown_curved_banquette_seat',1.25,2,.2,.4,'seat');crescent('Crown_curved_banquette_back',1.85,2.05,.72,.55,'seat');
 }
 for(const x of [-263,-218])for(const z of [-12,12]){cyl('Crown_planter',.6,.65,[x,y+.325,z],'ivory');mesh('Crown_plant',new T.SphereGeometry(.8,12,8),[x,y+1.35,z],'leaf');}
 // Passenger lift arrives next to the bar, separated from the window promenade.
 for(const x of [-249.1,-244.9])box('Crown_lift_side',[.15,3.1,4.2],[x,y+1.55,0],'navy');
 box('Crown_lift_back',[4.2,3.1,.15],[-247,y+1.55,-2.1],'navy');box('Crown_lift_portal',[4.2,.35,.25],[-247,y+3.05,2.1],'frame');
 for(const x of [-248.8,-245.2])box('Crown_lift_jamb',[.45,2.9,.2],[x,y+1.45,2.1],'ivory');
 box('Crown_lift_car_floor',[3.9,.2,3.9],[-247,y-.1,0],'stone');box('Crown_lift_threshold',[3,.2,.5],[-247,y-.1,2.05],'stone');
 // A sheltered arrival alcove with an open route to both window promenades.
 box('Crown_lobby_canopy',[6.5,.18,6.2],[-247,y+3.65,.65],'ivory');
 box('Crown_lobby_soffit_light',[5.8,.06,.14],[-247,y+3.52,3.4],'light');
 box('Crown_lobby_welcome_plinth',[1.25,1.05,.45],[-250.2,y+.525,3.5],'navy');
 box('Crown_lobby_display',[1.1,.5,.055],[-250.2,y+1.25,3.7],'light');
 for(const x of [-250,-244])box('Crown_lobby_edge',[.08,.012,2.8],[x,y+.008,3.7],'frame');
 // Suspended oval lighting gives the bar its own ceiling without closing views.
 const halo=new T.Mesh(new T.TorusGeometry(1,.025,8,96),m.light);halo.name='Crown_bar_light_halo';halo.rotation.x=Math.PI/2;halo.scale.set(6.5,4.5,1);halo.position.set(-232,y+3.7,0);root.add(halo);
 for(const x of [-237,-227]){const stem=box('Crown_pendant_stem',[.035,1.45,.035],[x,y+4.45,0],'frame');roofs.push(stem);}
 for(let x=-268;x<=-204;x+=4){const width=x>-215?11:24;const rib=box('Crown_ceiling_rib',[.14,.24,width],[x,CROWN.ceiling-.16,0],'floor');roofs.push(rib);}
 for(const z of [-3.42,3.42])box('Crown_bar_toe_light',[9.8,.07,.035],[-232,y+.16,z],'light');
 root.updateMatrixWorld(true);return {root,shell,roofs};
}

// Retain the source GLB; only the active model's fin cap is repurposed.
export function prepareCrownExterior(exterior){
 const remove=[];exterior.traverse(o=>{if(['Swept_tail_cap','Tail_top_amber'].includes(o.name))remove.push(o);if(o.name==='Swept_cat_tail'){
  o.geometry=o.geometry.clone();o.updateWorldMatrix(true,false);const inv=o.matrixWorld.clone().invert(),p=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);v.y=Math.min(v.y,CROWN.floor-.6);v.applyMatrix4(inv);p.setXYZ(i,v.x,v.y,v.z);}p.needsUpdate=true;o.geometry.computeVertexNormals();
 }});remove.forEach(o=>o.removeFromParent());
}
