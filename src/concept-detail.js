import * as T from 'three';

// Surface detail from the concept sheet that the saved exterior only hints at. The crown carries a bold dorsal spine:
// a dark rail with a capsule sensor pod at each end (orange-tipped) and two clusters of tall antenna masts, with
// orange marker plates beside it; it replaces the saved model's small pads, thin rail and whiskers. The keel's docking
// locators become the sheet's orange running lights. Names keep the Sensor_/Dorsal_sensor prefixes, so the Explode
// dial lifts them with the roof; materials are the exterior's own, so the paint pass finishes them like the rest. The
// hull identity grows to the sheet's scale (enlargeBranding).

// The crown top is flat at 54.2 m along the centreline over the spine's length (measured on the saved hull).
const ROOF=54.15,RAIL={from:-12,to:94,width:3.4,height:1.4};
const PODS=[{x:-4,dir:-1},{x:84,dir:1}],POD={radius:2.3,length:10};
const MASTS=[{x:28,heights:[16,12.5,10]},{x:58,heights:[14,10]}],MAST_SPREAD=1.3;
const MARKERS=[[36,4.6],[41,-4.6],[46,4.6]],MARKER=3;
const OLD_DORSAL=/^(Dorsal_sensor_rail|Sensor_fairing|Sensor_amber|Dorsal_whiskers)$/;
// The saved locators are 1.6 x 0.18 m; the sheet's running lights read from across the ship.
const LOCATOR=/^V32_docking_locator/,LOCATOR_SCALE=[2.5,3,1];

function materialNamed(root,name){let found=null;root.traverse(o=>{if(found||!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name===name)found=m;});return found;}

// Hull identity at the sheet's scale. The emblem block (emblem and "MARS CATS VOYAGE") and the LEO block ("LEO" and
// "MCV / 01") each grow 1.5x inside the window-free bay the window schedule left for them (the same on both sides), so
// no window is covered. Each decal vertex keeps its height off the hull, which leans inward with height.
const BRANDS=[{parts:/^(V33_authentic_Mars_Cats_Voyage_logo|Mission_brand)$/,bay:[-49,21,-.5,24]},{parts:/^(LEO_wordmark|Mission_identifier)$/,bay:[53,92,-.5,20.2]}];
const BRAND_SCALE=1.5,HULL=/^Smooth_pressure_envelope/,CELL=2,SURFACE_BAND=new T.Box3(new T.Vector3(-60,-6,50),new T.Vector3(100,30,Infinity));
// Outer |z| of the hull at (x, y) on one side, from the hull triangles inside the band.
// Ship positions of a mesh's vertices, kept per geometry and frame, since the identity and the doors both index the hull.
const shipVertices=new WeakMap();
function verticesOf(o,m){
 const hit=shipVertices.get(o.geometry);if(hit&&hit.matrix.equals(m))return hit.world;
 const p=o.geometry.attributes.position,world=new Float32Array(p.count*3),v=new T.Vector3();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);world[i*3]=v.x;world[i*3+1]=v.y;world[i*3+2]=v.z;}
 shipVertices.set(o.geometry,{matrix:m.clone(),world});return world;
}
export function hullSurface(exterior,frame,cached=true,band=SURFACE_BAND,parts=HULL){
 const bins=[new Map(),new Map()],m=new T.Matrix4();
 const B=band,v=new T.Vector3();
 exterior.traverse(o=>{if(!o.isMesh||!parts.test(o.name))return;m.multiplyMatrices(frame,o.matrixWorld);const p=o.geometry.attributes.position,ix=o.geometry.index?.array,n=ix?ix.length:p.count;
  // Each vertex once: its ship position and which side's band it is in (0 outside, 1 port, 2 starboard).
  const world=verticesOf(o,m),inBand=new Uint8Array(p.count);
  for(let i=0;i<p.count;i++){const x=world[i*3],y=world[i*3+1],z=world[i*3+2];if(x>=B.min.x&&x<=B.max.x&&y>=B.min.y&&y<=B.max.y&&Math.abs(z)>=B.min.z)inBand[i]=z>0?2:1;}
  for(let t=0;t<n;t+=3){
   const i0=ix?ix[t]:t,i1=ix?ix[t+1]:t+1,i2=ix?ix[t+2]:t+2,s0=inBand[i0];if(!s0||inBand[i1]!==s0||inBand[i2]!==s0)continue;
   const tri=[i0,i1,i2].map(i=>[world[i*3],world[i*3+1],Math.abs(world[i*3+2])]),bin=bins[s0-1];
   const u0=Math.floor(Math.min(tri[0][0],tri[1][0],tri[2][0])/CELL),u1=Math.floor(Math.max(tri[0][0],tri[1][0],tri[2][0])/CELL),w0=Math.floor(Math.min(tri[0][1],tri[1][1],tri[2][1])/CELL),w1=Math.floor(Math.max(tri[0][1],tri[1][1],tri[2][1])/CELL);
   for(let u=u0;u<=u1;u++)for(let w=w0;w<=w1;w++){const key=u*4096+w;let list=bin.get(key);if(!list)bin.set(key,list=[]);list.push(tri);}
  }
 });
 // The emblem alone has ~150k vertices on a few square metres; lookups are cached per centimetre (the side leans
 // ~1.2 m in z per metre of height, so coarser rounding would lift or sink the letters).
 const memo=new Map();
 if(!cached)return lookup;
 return (x,y,side)=>{const u=Math.round(x*100),w=Math.round(y*100),key=(u*65536+w)*2+side;if(!memo.has(key))memo.set(key,lookup(u/100,w/100,side));return memo.get(key);};
 function lookup(x,y,side){let best=NaN;for(const [a,b,c] of bins[side].get(Math.floor(x/CELL)*4096+Math.floor(y/CELL))||[]){
  const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)continue;
  const l1=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,l2=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,l3=1-l1-l2;
  if(Math.min(l1,l2,l3)>=-1e-6){const z=l1*a[2]+l2*b[2]+l3*c[2];if(!(z<=best))best=z;}}return best;}
}
function enlargeBranding(exterior,frame){
 const surface=hullSurface(exterior,frame),m=new T.Matrix4(),v=new T.Vector3();
 for(const {parts,bay:[x0,x1,y0,y1]} of BRANDS)for(const side of [0,1]){
  const meshes=[];exterior.traverse(o=>{if(o.isMesh&&parts.test(o.name)&&(new T.Box3().setFromObject(o).getCenter(v).z>0?1:0)===side)meshes.push(o);});if(!meshes.length)continue;
  const block=new T.Box3();for(const o of meshes)block.union(new T.Box3().setFromObject(o).applyMatrix4(frame));
  const c=block.getCenter(new T.Vector3()),half=block.getSize(new T.Vector3()).multiplyScalar(.5),s=Math.min(BRAND_SCALE,(x1-x0)/2/half.x,(y1-y0)/2/half.y);
  const cx=Math.min(Math.max(c.x,x0+half.x*s),x1-half.x*s),cy=Math.min(Math.max(c.y,y0+half.y*s),y1-half.y*s);
  for(const o of meshes){
   o.geometry=o.geometry.clone();m.multiplyMatrices(frame,o.matrixWorld);const inv=m.clone().invert(),p=o.geometry.attributes.position,out=new Float32Array(p.count*3);
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);const sign=Math.sign(v.z)||1,x=cx+s*(v.x-c.x),y=cy+s*(v.y-c.y),from=surface(v.x,v.y,side),to=surface(x,y,side);
    const z=Number.isFinite(from)&&Number.isFinite(to)?to+(Math.abs(v.z)-from):Math.abs(v.z);v.set(x,y,sign*z).applyMatrix4(inv);out[i*3]=v.x;out[i*3+1]=v.y;out[i*3+2]=v.z;}
   o.geometry.setAttribute('position',new T.BufferAttribute(out,3));o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
  }
 }
}

// Small marks from the sheet: a dark slot window on each pod's outer flank near the bow, and amber beacons on each pod's
// top front edge and on the fin cap's nose. Each joins the group of the part it sits on, so the Explode dial carries it.
// Positions are measured from the shaped meshes, so they follow the pod bows and the lowered crown.
const SLOT={x:-196,y:6,length:5,radius:1.1,depth:.35},BEACON=.9;
function pointsOf(root,frame,test){const out=[],v=new T.Vector3(),m=new T.Matrix4();root.traverse(o=>{if(!o.isMesh||!test(o))return;m.multiplyMatrices(frame,o.matrixWorld);const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)out.push(v.fromBufferAttribute(p,i).applyMatrix4(m).toArray());});return out;}
function addMarks(exterior,frame,amber,dark){
 const place=(group,name,geometry,material,[x,y,z])=>{geometry.translate(x,y,z);geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(frame,group.matrixWorld).invert());const m=new T.Mesh(geometry,material);m.name=name;group.add(m);};
 for(const side of ['Port_nacelle','Starboard_nacelle']){
  const pod=exterior.getObjectByName(side);if(!pod)continue;const shell=pointsOf(pod,frame,o=>/^Sculpted_nacelle_shell/.test(o.name));if(!shell.length)continue;
  const zs=shell.map(p=>p[2]),centre=(Math.min(...zs)+Math.max(...zs))/2,out=Math.sign(centre);
  // The flank's outer face at the slot, and the deck line's front edge.
  const flank=Math.max(...shell.filter(([x,y])=>Math.abs(x-SLOT.x)<3&&Math.abs(y-SLOT.y)<1.5).map(p=>Math.abs(p[2]-centre)));
  const top=Math.max(...shell.map(p=>p[1])),front=Math.max(...shell.filter(p=>p[1]>top-.3).map(p=>p[0]));
  const slot=new T.CapsuleGeometry(SLOT.radius,SLOT.length,4,12);slot.rotateZ(Math.PI/2);slot.scale(1,1,SLOT.depth/SLOT.radius);
  if(Number.isFinite(flank))place(pod,'Nacelle_concept_slot',slot,dark,[SLOT.x,SLOT.y,centre+out*(flank-.05)]);
  place(pod,'Nacelle_concept_beacon',new T.SphereGeometry(BEACON,12,8),amber,[front-1.2,top+.4,centre]);
 }
 const cap=exterior.getObjectByName('Fin_cap_retained_white_underside');
 if(cap){const b=new T.Box3().setFromObject(cap).applyMatrix4(frame);place(cap.parent,'Crown_concept_beacon',new T.SphereGeometry(BEACON*1.2,12,8),amber,[b.max.x+.2,b.max.y-1.5,0]);}
}

// The sheet's keel shows one large hangar door. Leo's shuttle handling bay is at the bow on Deck 2 (x 148-220), so the
// door goes there, on both sides: a dark recessed panel with an alloy frame, shutter ribs and amber corner lights, laid
// on the hull's lower curve (over the thermal panel field where it covers the hull). The lifeboat bays further aft
// are left as they are.
const DOOR={x0:140,x1:170,y0:-44,y1:-29,frame:.6,ribs:6,inset:.12,proud:.22},DOOR_BAND=new T.Box3(new T.Vector3(130,-50,40),new T.Vector3(180,-20,Infinity));
function addHangarDoors(exterior,frame,{dark,alloy,amber}){
 const group=exterior.getObjectByName('V32_surface_refinements')??exterior,surface=hullSurface(exterior,frame,false,DOOR_BAND,/^(Smooth_pressure_envelope|Lower_thermal_panel_fields)/);
 const toGroup=new T.Matrix4().multiplyMatrices(frame,group.matrixWorld).invert();
 // A patch of the hull's surface over [x0,x1] x [y0,y1], lifted off it by `lift`.
 const patch=(name,[x0,x1,y0,y1],lift,material,side,steps=[12,8])=>{
  const [nu,nv]=steps,p=[],ix=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const x=x0+(x1-x0)*i/nu,y=y0+(y1-y0)*j/nv,z=surface(x,y,side>0?1:0);p.push(x,y,side*((Number.isFinite(z)?z:0)+lift));}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+nu+1;if(side>0)ix.push(a,a+1,b,a+1,b+1,b);else ix.push(a,b,a+1,a+1,b,b+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.applyMatrix4(toGroup);g.computeVertexNormals();
  const m=new T.Mesh(g,material);m.name=name;group.add(m);return m;
 };
 const {x0,x1,y0,y1,frame:w,ribs,inset,proud}=DOOR;
 for(const side of [-1,1]){
  patch('Hangar_door_panel',[x0,x1,y0,y1],inset,dark,side);
  for(const [a,b,c,d] of [[x0-w,x1+w,y1,y1+w],[x0-w,x1+w,y0-w,y0],[x0-w,x0,y0,y1],[x1,x1+w,y0,y1]])patch('Hangar_door_frame',[a,b,c,d],proud,alloy,side,[8,1]);
  for(let k=1;k<ribs;k++){const y=y0+(y1-y0)*k/ribs;patch('Hangar_door_rib',[x0,x1,y-.12,y+.12],inset+.06,alloy,side,[12,1]);}
  for(const x of [x0-w*2.5,x1+w*2.5])patch('Hangar_door_light',[x-.5,x+.5,y1-.5,y1+.5],proud,amber,side,[1,1]);
 }
}
// Each pod's flat deck carries a raised lid on the sheet: a rounded rectangle outlined by a low rim.
const LID={inset:3.2,front:1.5,radius:2.4,rim:.45,height:.18};
function addPodLids(exterior,frame,material){
 for(const side of ['Port_nacelle','Starboard_nacelle']){
  const pod=exterior.getObjectByName(side);if(!pod)continue;const shell=pointsOf(pod,frame,o=>/^Sculpted_nacelle_shell/.test(o.name));if(!shell.length)continue;
  const top=Math.max(...shell.map(p=>p[1])),deck=shell.filter(p=>p[1]>top-.05),xs=deck.map(p=>p[0]),zs=deck.map(p=>p[2]);
  const x0=Math.min(...xs)+LID.inset,x1=Math.max(...xs)-LID.inset-LID.front,z0=Math.min(...zs)+LID.inset,z1=Math.max(...zs)-LID.inset,r=LID.radius;
  const ring=(a,b,c,d,rr)=>{const s=new T.Shape();s.moveTo(a+rr,c);s.lineTo(b-rr,c);s.quadraticCurveTo(b,c,b,c+rr);s.lineTo(b,d-rr);s.quadraticCurveTo(b,d,b-rr,d);s.lineTo(a+rr,d);s.quadraticCurveTo(a,d,a,d-rr);s.lineTo(a,c+rr);s.quadraticCurveTo(a,c,a+rr,c);return s;};
  const outer=ring(x0,x1,z0,z1,r),hole=ring(x0+LID.rim,x1-LID.rim,z0+LID.rim,z1-LID.rim,r-LID.rim);outer.holes.push(new T.Path(hole.getPoints()));
  const g=new T.ExtrudeGeometry(outer,{depth:LID.height,bevelEnabled:false,curveSegments:6});
  // The shape's (x, z) lies in its XY plane; a quarter turn about x lays it flat (extruded downward) on the deck.
  g.rotateX(Math.PI/2);g.translate(0,top+LID.height,0);
  g.applyMatrix4(new T.Matrix4().multiplyMatrices(frame,pod.matrixWorld).invert());g.computeVertexNormals();
  const m=new T.Mesh(g,material);m.name='Nacelle_concept_lid';pod.add(m);
 }
}

export function applyConceptDetail(exterior){
 exterior.updateMatrixWorld(true);
 const group=exterior.getObjectByName('Wings_engines_tail'),navy=materialNamed(exterior,'V32_Thermal_navy'),amber=materialNamed(exterior,'V32_Amber_markers'),alloy=materialNamed(exterior,'V32_Edge_alloy');
 if(!group||!navy||!amber||!alloy)return;
 const old=[];group.traverse(o=>{if(o.isMesh&&OLD_DORSAL.test(o.name))old.push(o);});old.forEach(o=>o.parent.remove(o));
 // Parts are laid out in ship coordinates, then placed in the group's frame.
 const toGroup=new T.Matrix4().multiplyMatrices(exterior.parent?exterior.parent.matrixWorld.clone().invert():new T.Matrix4(),group.matrixWorld).invert();
 // One assembly, so the Explode dial lifts the spine as a single roof part (it lifts each part by its own height).
 const assembly=new T.Group();assembly.name='Dorsal_sensor_assembly';group.add(assembly);
 const add=(name,geometry,material,[x,y,z],rotate)=>{if(rotate)geometry.rotateZ(rotate);geometry.translate(x,y,z);geometry.applyMatrix4(toGroup);const m=new T.Mesh(geometry,material);m.name=name;assembly.add(m);return m;};
 add('Dorsal_sensor_spine',new T.BoxGeometry(RAIL.to-RAIL.from,RAIL.height,RAIL.width),navy,[(RAIL.from+RAIL.to)/2,ROOF+RAIL.height/2-.2,0]);
 for(const {x,dir} of PODS){
  const y=ROOF+RAIL.height+POD.radius*.7;
  add('Sensor_pod',new T.CapsuleGeometry(POD.radius,POD.length,6,16),navy,[x,y,0],Math.PI/2);
  add('Sensor_pod_tip',new T.SphereGeometry(POD.radius*.55,16,8),amber,[x+dir*(POD.length/2+POD.radius*.75),y,0]);
 }
 for(const {x,heights} of MASTS)heights.forEach((h,i)=>{
  const dx=(i-(heights.length-1)/2)*MAST_SPREAD,dz=i%2?MAST_SPREAD*.6:-MAST_SPREAD*.6;
  add('Sensor_mast_collar',new T.CylinderGeometry(.9,1.2,1.2,12),navy,[x+dx,ROOF+RAIL.height+.4,dz]);
  add('Sensor_mast',new T.CylinderGeometry(.16,.3,h,8),alloy,[x+dx,ROOF+RAIL.height+h/2,dz]);
  add('Sensor_mast_tip',new T.SphereGeometry(.35,8,6),amber,[x+dx,ROOF+RAIL.height+h,dz]);
 });
 for(const [x,z] of MARKERS)add('Sensor_marker_plate',new T.BoxGeometry(MARKER,.25,MARKER),amber,[x,ROOF+.05,z]);
 exterior.traverse(o=>{if(o.isMesh&&LOCATOR.test(o.name)){o.scale.multiply(new T.Vector3(...LOCATOR_SCALE));o.material=amber;}});
 const frame=exterior.parent?exterior.parent.matrixWorld.clone().invert():new T.Matrix4();
 enlargeBranding(exterior,frame);
 const recess=materialNamed(exterior,'V32_Recess')??navy;
 addMarks(exterior,frame,amber,recess);
 addHangarDoors(exterior,frame,{dark:recess,alloy,amber});
 addPodLids(exterior,frame,materialNamed(exterior,'V32_Panel_reveal')??alloy);
 exterior.updateMatrixWorld(true);
}
