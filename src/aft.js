import * as T from 'three';
import {createFinCrown,CROWN} from './fin-crown.js';
import {addAftEnclosures} from './aft-enclosures.js';
import envelope from './assets/aft-envelope.json' with {type:'json'};
import {unionRectangles,slabGeometry} from './floor-geometry.js';
import {aftOpenings} from './aft-layout.js';
export function createAft(){
 const root=new T.Group();root.name='AFT_SYSTEMS_BLOCKOUT';root.userData={stage:'Aft enclosed machinery and refined crown concept 03',units:'metres',reservoirs:4,podDriveChambers:4,centralDriveTrains:3,serviceLift:1,crownPassengerLift:1,stairTower:1};
 const parts={};for(const k of ['drive','tanks','pods','access','fin','crown']){const g=new T.Group();g.name='Aft_'+k;root.add(g);parts[k]=g;}
 const shells=[];const mats=Object.fromEntries(Object.entries({floor:0xb7b5a4,wall:0xd1dbdb,frame:0x476272,metal:0x899a9e,dark:0x203540,tank:0x829f9e,amber:0xd9a767,pipe:0x779cac,light:0xffdfae}).map(([k,color])=>[k,new T.MeshStandardMaterial({name:'Aft_'+k,color,roughness:.7,metalness:k==='metal'?.5:.12,...(k==='light'?{emissive:color,emissiveIntensity:.7}:{})})]));
 const floorY=d=>-39.7+(d-1)*4;const floors=[],routes=[];
 function box(name,size,p,mat='wall',g=parts.drive){const o=new T.Mesh(new T.BoxGeometry(...size),mats[mat]);o.name=name;o.position.set(...p);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
 function beam(name,a,b,r=.15,mat='frame',g=parts.drive){const va=new T.Vector3(...a),vb=new T.Vector3(...b),o=new T.Mesh(new T.CylinderGeometry(r,r,va.distanceTo(vb),10),mats[mat]);o.name=name;o.position.copy(va.clone().add(vb).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());o.castShadow=true;g.add(o);return o;}
 function floor(name,rects,y,g,holes=[]){const o=new T.Mesh(slabGeometry(unionRectangles(rects,holes),y,.2),mats.floor);o.name=name;o.receiveShadow=true;g.add(o);floors.push(o);return o;}
 const rect=(x0,x1,z0,z1)=>({x0,x1,z0,z1});
 function rail(a,b,y,g){beam('Maintenance_handrail',[a[0],y+1.1,a[1]],[b[0],y+1.1,b[1]],.045,'amber',g);const len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let i=0;i<=Math.ceil(len/4);i++){const t=i/Math.ceil(len/4),x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;beam('Rail_post',[x,y,z],[x,y+1.1,z],.035,'frame',g);}}
 function cylinder(name,x0,x1,y,z,r,g,mat='metal'){
  const o=beam(name,[x0,y,z],[x1,y,z],r,mat,g);
  for(const x of [x0+1,x1-1]){const ring=new T.Mesh(new T.TorusGeometry(r+.12,.16,8,32),mats.frame);ring.rotation.y=Math.PI/2;ring.position.set(x,y,z);ring.name=name+'_restraint';g.add(ring);}
  return o;
 }
 function bulkhead(name,x,y,w,h,g){for(const s of [-1,1])shells.push(box(name,[.25,h,(w-4)/2],[x,y+h/2,s*(w+4)/4],'wall',g));shells.push(box(name+'_header',[.25,h-3.1,4],[x,y+3.1+(h-3.1)/2,0],'wall',g));}
 // The high machinery volume sits above the existing Deck 7 engineering rooms.
 floor('Machinery_hall_floor',[rect(-286,-178,-24,24)],-11.7,parts.drive);
 bulkhead('Machinery_aft_bulkhead',-286,-11.7,48,23,parts.drive);bulkhead('Machinery_forward_bulkhead',-178,-11.7,48,23,parts.drive);
 for(const x of [-281,-260,-238,-215,-194,-181]){
  for(const s of [-1,1])beam('Central_hall_frame',[x,-11.5,s*23.3],[x,10.7,s*23.3],.28,'frame');
  beam('Central_hall_roof_frame',[x,10.7,-23.3],[x,10.7,23.3],.28,'frame');
 }
 for(const z of [-16,0,16]){
  cylinder('Central_drive_train',-280,-244,-2,z,5.5,parts.drive);
  cylinder('Drive_coupling',-239,-220,-2,z,3.4,parts.drive,'dark');
  cylinder('Drive_interstage_shaft',-244,-239,-2,z,1.5,parts.drive,'frame');
  cylinder('Drive_interstage_shaft',-220,-214,-2,z,1.5,parts.drive,'frame');
  cylinder('Power_conditioning_drum',-214,-190,-2,z,4.4,parts.drive,'tank');
  for(const x of [-274,-250,-208,-195])box('Drive_support_saddle',[3,4.1,8],[x,-9.55,z],'frame');
  beam('Main_coolant_header',[-282,7,z],[-184,7,z],.32,'pipe');
  for(const x of [-256,-204])beam('Coolant_drop',[x,7,z],[x,3.2,z],.23,'pipe');
 }
 for(const z of [-10,-6,6,10])beam('Drive_aisle_marker',[-284,-11.67,z],[-180,-11.67,z],.045,'amber');
 // Four long tanks fill a two-deck reservoir volume, below the existing rooms.
 floor('Reservoir_bay_floor',[rect(-244,-176,-28,28)],-27.7,parts.tanks);bulkhead('Reservoir_bulkhead',-176,-27.7,56,11.2,parts.tanks);
 for(const x of [-226,-195])for(const z of [-15,15]){
  cylinder('Reservoir_tank',x-12,x+12,-22.4,z,4.5,parts.tanks,'tank');
  for(const dx of [-8,8])box('Tank_saddle',[2.2,.65,9],[x+dx,-27.375,z],'frame',parts.tanks);
  beam('Tank_feed',[x+12,-22.4,z],[x+14,-22.4,z],.25,'pipe',parts.tanks);
  beam('Tank_isolation_drop',[x+14,-22.4,z],[x+14,-24.9,z],.2,'pipe',parts.tanks);
  box('Isolation_manifold',[1.2,2,3],[x+14,-25.9,z],'dark',parts.tanks);
 }
 for(const x of [-241,-211,-179]){for(const z of [-26,26])beam('Tank_bay_column',[x,-27.5,z],[x,-16.6,z],.22,'frame',parts.tanks);beam('Tank_bay_roof_frame',[x,-16.6,-26],[x,-16.6,26],.22,'frame',parts.tanks);}
 // Pod machinery is placed in world coordinates from the retained pod shells.
 for(const pod of envelope.pods){const z=pod.centerZ,g=new T.Group();g.name=pod.side+'_pod_machinery';parts.pods.add(g);
  floor('Pod_maintenance_floor',[rect(-278,-165,z-15,z+15)],-19.7,g);
  for(const dz of [-7.5,7.5]){cylinder('Pod_drive_chamber',-278,-234,-12,z+dz,5.6,g);cylinder('Pod_feed_drum',-229,-208,-12,z+dz,3.8,g,'tank');
   cylinder('Pod_interstage_shaft',-234,-229,-12,z+dz,1.4,g,'frame');
   for(const x of [-271,-243,-219])box('Pod_mount',[2,1.8,8],[x,-18.8,z+dz],'frame',g);
   beam('Pod_supply_line',[-230,-5.7,z+dz],[-192,-5.7,z+dz],.21,'pipe',g);
   beam('Pod_supply_drop',[-192,-5.7,z+dz],[-192,-17.9,z+dz],.18,'pipe',g);
  }
  for(const x of [-200,-190])for(const dz of [-8,8]){box('Pod_pump_skid',[6,.3,5],[x,-19.55,z+dz],'frame',g);cylinder('Pod_transfer_pump',x-2,x+2,-17.9,z+dz,1.2,g,'tank');box('Pod_control_cabinet',[1,2.8,2],[x+3.5,-18.3,z+dz],'dark',g);}
  for(const q of pod.sections){const points=[[q.x,-19.5,z-14],[q.x,q.roof[0],z-14],[q.x,q.roof[1],z],[q.x,q.roof[2],z+14],[q.x,-19.5,z+14]];for(let i=1;i<points.length;i++)beam('Pod_structural_frame',points[i-1],points[i],.22,'frame',g);}
  for(const dz of [-2,2])beam('Pod_aisle_marker',[-277,-19.67,z+dz],[-167,-19.67,z+dz],.035,'amber',g);
 }
 // Stepped galleries follow the wing's actual vertical drop, with level ends.
 const drop=z=>{const t=T.MathUtils.clamp((z-54)/64,0,1);return -13*t*t*(3-2*t)+3.2*Math.sin(Math.PI*t)**2;};
 const wingStops=[{z:4,y:-7.7},{z:60,y:-7.7}];
 for(let i=1;i<=72;i++){let lo=60,hi=112;for(let k=0;k<24;k++){const m=(lo+hi)/2;if(drop(m)>-i/6)lo=m;else hi=m;}wingStops.push({z:(lo+hi)/2,y:-7.7-i/6});}
 wingStops.push({z:Math.abs(envelope.pods[1].centerZ),y:-19.7});
 for(const s of [-1,1]){const path=[[-174,-7.7,0]];
  for(let i=1;i<wingStops.length;i++){const a=wingStops[i-1],b=wingStops[i];floor('Wing_gallery_tread',[rect(-177,-171,Math.min(s*a.z,s*b.z),Math.max(s*a.z,s*b.z))],a.y,parts.access);
   if(b.y<a.y)box('Wing_gallery_riser',[6,a.y-b.y,.07],[-174,(a.y+b.y)/2,s*b.z],'frame',parts.access);
   for(const x of [-176.8,-171.2]){beam('Wing_gallery_handrail',[x,a.y+1.1,s*a.z],[x,a.y+1.1,s*(i===wingStops.length-1?b.z-3:b.z)],.04,'amber',parts.access);}
   if(i%6===0)for(const x of [-176.8,-171.2])beam('Wing_gallery_frame',[x,a.y,s*a.z],[x,a.y+2.9,s*a.z],.08,'frame',parts.access);
   path.push([-174,a.y,s*(a.z+b.z)/2]);
  }
  path.push([-174,-19.7,s*Math.abs(envelope.pods[1].centerZ)]);routes.push({name:s>0?'Starboard wing gallery':'Port wing gallery',points:path});
 }
 // A service lift and one switchback stair connect all fourteen aft levels.
 const top=floorY(17)+3.1,bottom=floorY(4),shaftX=-156,shaftZ=8;
 for(const dx of [-2,2])for(const dz of [-2,2])beam('Aft_lift_guide',[shaftX+dx,bottom,shaftZ+dz],[shaftX+dx,top,shaftZ+dz],.12,'frame',parts.access);
 floor('Aft_lift_car_floor',[rect(-157.8,-154.2,6.2,9.8)],-11.7,parts.access);
 floor('Aft_lift_car_threshold',[rect(-157.3,-154.7,5.9,6.3)],-11.7,parts.access);
 box('Aft_lift_car_roof',[3.6,.13,3.6],[-156,-8.85,8],'frame',parts.access);
 for(const x of [-157.8,-154.2])box('Aft_lift_car_side',[.08,2.7,3.6],[x,-10.35,8],'metal',parts.access);
 for(let d=4;d<=17;d++){const y=floorY(d),rects=[rect(-174,-132,-4,4),rect(-174,-169.5,-12.5,0),rect(-158,-154,4,6),rect(-171.5,-169.5,-12.5,-7.5)];
  floor('Aft_level_landing',rects,y-.006,parts.access,aftOpenings(d));
  for(const dx of [-1.6,1.6])box('Aft_lift_jamb',[.6,2.7,.15],[-156+dx,y+1.35,6],'frame',parts.access);
  box('Aft_lift_header',[4,.4,.15],[-156,y+2.9,6],'frame',parts.access);
  if(d!==8)box('Aft_lift_landing_door',[2.6,2.7,.08],[-156,y+1.35,6],'metal',parts.access);
  if(d<17){floor('Aft_stair_half_landing',[rect(-164.5,-162.5,-12.5,-7.5)],y+2,parts.access);
   for(let i=0;i<12;i++){const run=5/12,h=(i+1)/6;box('Aft_stair_up',[run,.14,2.2],[-169.5+(i+.5)*run,y+h-.07,-11.4],'floor',parts.access);box('Aft_stair_return',[run,.14,2.2],[-164.5-(i+.5)*run,y+2+h-.07,-8.6],'floor',parts.access);}
   for(const z of [-12.4,-10.4])beam('Aft_stair_rail',[-169.5,y+1.1,z],[-164.5,y+3.1,z],.04,'amber',parts.access);
   for(const z of [-9.6,-7.6])beam('Aft_stair_rail',[-164.5,y+3.1,z],[-169.5,y+5.1,z],.04,'amber',parts.access);
  }
 }
 floor('Tank_bay_link',[rect(-176,-174,-3,3)],-27.7,parts.access);floor('Drive_hall_link',[rect(-178,-174,-3,3)],-11.7,parts.access);
 floor('Upper_service_gallery',[rect(-245,-174,-3,3)],24.3,parts.access,[CROWN.lift]);for(const s of [-1,1])rail([-244,s*2.8],[-175,s*2.8],24.3,parts.access);
 // Fin platforms, internal spars and ladder runs follow measured shell sections.
 const rows=envelope.fin.filter(q=>q.y>=32&&q.y<=128),g=parts.fin;
 for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];for(const z of [-2.5,2.5]){
  beam('Fin_rear_spar',[a.a+4,a.y,z],[b.a+4,b.y,z],.24,'frame',g);beam('Fin_front_spar',[a.b-4,a.y,z],[b.b-4,b.y,z],.24,'frame',g);
  beam('Fin_diagonal_web',[a.a+4,a.y,z],[b.b-4,b.y,z],.12,'metal',g);
 }
 }
 // A passenger lift now serves the fin platforms and panoramic crown.
 for(const q of rows.filter(q=>(q.y-32)%16===0)){
  floor('Fin_inspection_platform',[rect(Math.min(q.a+6,-249.5),q.b-6,-2.35,2.35)],q.y,g,[CROWN.lift]);
  for(const s of [-1,1])rail([Math.min(q.a+6,-249.5),s*2.2],[q.b-6,s*2.2],q.y,g);
 }
 for(const x of [-249,-245])for(const z of [-2,2])beam('Crown_lift_guide',[x,24.3,z],[x,135.4,z],.1,'frame',g);
 for(const y of [24.3,32,48,64,80,96,112,128]){
  box('Crown_lift_platform_door',[.1,2.7,2.8],[-244.9,y+1.35,0],'metal',g);
  for(const z of [-1.6,1.6])box('Crown_lift_platform_jamb',[.15,2.9,.35],[-244.8,y+1.45,z],'frame',g);
  box('Crown_lift_platform_header',[.15,.3,3.55],[-244.8,y+2.85,0],'frame',g);
 }
 floor('Crown_lift_lower_lobby',[rect(-249.5,-239,-2.35,2.35)],24.294,parts.access,[CROWN.lift]);
 const crown=createFinCrown();parts.crown.add(crown.root);
 addAftEnclosures(parts,shells);
 root.updateMatrixWorld(true);return {root,parts,shells,floors,routes,envelope,crown};
}
