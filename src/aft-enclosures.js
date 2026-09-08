import {cutWindowApertures} from './window-geometry.js';
import {tintBoxWindow} from './glazing-finish.js';
import {CENTRAL_ENGINE_WINDOWS,POD_ENGINE_WINDOWS} from './engine-window-plan.js';
import * as T from 'three';
import envelope from './assets/aft-envelope.json' with {type:'json'};

export function addAftEnclosures(parts,shells){
 const wall=new T.MeshStandardMaterial({name:'Engineering acoustic panels',color:0xb9c9c9,roughness:.8,side:T.DoubleSide});
 const dark=new T.MeshStandardMaterial({name:'Engineering door frames',color:0x284858,roughness:.6});
 const light=new T.MeshStandardMaterial({name:'Engineering route lighting',color:0xfde5be,emissive:0xffd398,emissiveIntensity:.9});
 const teal=new T.MeshStandardMaterial({name:'Maintenance route teal',color:0x3d9495,roughness:.8});
 function box(name,size,pos,mat,g,cut=true){const o=new T.Mesh(new T.BoxGeometry(...size),mat);o.name=name;o.position.set(...pos);o.receiveShadow=true;o.castShadow=mat!==light;g.add(o);if(cut)shells.push(o);return o;}
 function panel(name,p,g){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([p[0],p[1],p[2],p[0],p[2],p[3]].flat(),3));geo.computeVertexNormals();const o=new T.Mesh(geo,wall);o.name=name;o.receiveShadow=true;o.castShadow=true;g.add(o);shells.push(o);}
 function portal(x,y,g,prefix){for(const s of [-1,1]){box(prefix+'_jamb',[.4,3.2,.25],[x,y+1.6,s*2],dark,g);box(prefix+'_stowed_door',[.18,2.9,1.85],[x+.24,y+1.45,s*3.15],dark,g);}box(prefix+'_lintel',[.4,.28,4.25],[x,y+3.2,0],dark,g);box(prefix+'_exit_light',[.08,.16,1.5],[x+.3,y+2.94,0],light,g);}
 for(const z of [-23.65,23.65])box('Machinery_side_enclosure',[107.6,22.6,.24],[-232,-.4,z],wall,parts.drive);
 box('Machinery_acoustic_ceiling',[107.6,.22,47.4],[-232,11.05,0],wall,parts.drive);
 portal(-177.7,-11.7,parts.drive,'Machinery_entry');
 for(const z of [-8,8]){box('Machinery_aisle_light',[99,.09,.35],[-232,10.83,z],light,parts.drive);box('Machinery_route_band',[98,.015,.65],[-232,-11.688,z],teal,parts.drive,false);}
 for(const z of [-27.65,27.65])box('Tank_side_enclosure',[67.6,11,.22],[-210,-22.1,z],wall,parts.tanks);
 box('Tank_aft_enclosure',[.22,11,55.4],[-243.75,-22.1,0],wall,parts.tanks);
 box('Tank_acoustic_ceiling',[67.6,.2,55.4],[-210,-16.55,0],wall,parts.tanks);portal(-175.7,-27.7,parts.tanks,'Tank_entry');
 for(const z of [-3,3])box('Tank_route_light',[64,.09,.25],[-210,-16.72,z],light,parts.tanks);
 // Pod enclosures follow the sampled roof slope and retain the wing doorways.
 for(const pod of envelope.pods){const g=parts.pods.getObjectByName(pod.side+'_pod_machinery'),zc=pod.centerZ,sgn=Math.sign(zc),rows=pod.sections;
  function roof(x){let i=1;while(i<rows.length-1&&x>rows[i].x)i++;const a=rows[i-1],b=rows[i],t=(x-a.x)/(b.x-a.x);return a.roof[1]+t*(b.roof[1]-a.roof[1])-.35;}
  const xs=[...new Set([...rows.map(q=>q.x),-177,-171])].sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++){const a=xs[i-1],b=xs[i],ya=roof(a),yb=roof(b);
   panel('Pod_ceiling_panel',[[a,ya,zc-14.4],[b,yb,zc-14.4],[b,yb,zc+14.4],[a,ya,zc+14.4]],g);
   for(const s of [-1,1]){const bottom=s===-sgn&&a>=-177&&b<=-171?-16.4:-19.7;panel('Pod_side_panel',[[a,bottom,zc+s*14.4],[b,bottom,zc+s*14.4],[b,yb,zc+s*14.4],[a,ya,zc+s*14.4]],g);}
  }
  panel('Pod_aft_enclosure',[[-277,-19.7,zc-14.4],[-277,roof(-277),zc-14.4],[-277,roof(-277),zc+14.4],[-277,-19.7,zc+14.4]],g);
  // The forward portal preserves a four-metre maintenance aisle.
  for(const s of [-1,1])box('Pod_forward_bulkhead',[.2,roof(-168)+19.7,12.4],[-168,(roof(-168)-19.7)/2,zc+s*8.2],wall,g);
  box('Pod_forward_header',[.2,roof(-168)+16.5,4],[-168,(roof(-168)-16.5)/2,zc],wall,g);
  for(const x of [-177,-171])box('Pod_wing_door_jamb',[.15,3.3,.2],[x,-18.05,zc-sgn*14.4],dark,g);
  box('Pod_wing_door_header',[6.1,.2,.25],[-174,-16.4,zc-sgn*14.4],dark,g);
  box('Pod_route_band',[99,.015,.5],[-223,-19.688,zc],teal,g,false);
  for(const x of [-264,-242,-220,-198,-178])box('Pod_ceiling_light',[3,.08,.25],[x,roof(x)-.15,zc],light,g);
 }
 // The inner acoustic lining shares exactly the exterior window schedule.
 // Cutting both skins avoids glazing that is painted over an opaque room wall.
 const glass=new T.MeshPhysicalMaterial({name:'Engine maintenance window glass',color:0x6a9aaa,roughness:.18,transparent:true,opacity:.3,side:T.DoubleSide,depthWrite:false});
 function interiorWindows(g,plan,center,halfWidth,prefix){
  g.updateWorldMatrix(true,true);const walls=[];g.traverse(o=>{if(o.isMesh&&['Machinery_side_enclosure','Pod_side_panel'].includes(o.name))walls.push(o);});walls.forEach(o=>cutWindowApertures(o,plan));
  for(const s of [-1,1])for(const r of plan){const x=(r.x0+r.x1)/2,y=(r.y0+r.y1)/2,z=center+s*(halfWidth-.18),w=r.x1-r.x0,h=r.y1-r.y0;
   tintBoxWindow(box(prefix+'_inner_glazing',[w,h,.045],[x,y,z],glass,g),'z',Math.sign(z-center));
   for(const xx of [r.x0-.06,r.x1+.06])box(prefix+'_window_jamb',[.12,h+.24,.08],[xx,y,z-s*.05],dark,g);
   for(const yy of [r.y0-.06,r.y1+.06])box(prefix+'_window_trim',[w+.24,.12,.08],[x,yy,z-s*.05],dark,g);
  }
 }
 interiorWindows(parts.drive,CENTRAL_ENGINE_WINDOWS,0,23.65,'Central_engine');
 for(const pod of envelope.pods)interiorWindows(parts.pods.getObjectByName(pod.side+'_pod_machinery'),POD_ENGINE_WINDOWS,pod.centerZ,14.4,'Pod_engine');

}
