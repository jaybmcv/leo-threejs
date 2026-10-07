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
export function hullSurface(exterior,frame,cached=true){
 const bins=[new Map(),new Map()],m=new T.Matrix4();
 const B=SURFACE_BAND,v=new T.Vector3();
 exterior.traverse(o=>{if(!o.isMesh||!HULL.test(o.name))return;m.multiplyMatrices(frame,o.matrixWorld);const p=o.geometry.attributes.position,ix=o.geometry.index?.array,n=ix?ix.length:p.count;
  // Each vertex once: its ship position and which side's band it is in (0 outside, 1 port, 2 starboard).
  const world=new Float32Array(p.count*3),band=new Uint8Array(p.count);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);world[i*3]=v.x;world[i*3+1]=v.y;world[i*3+2]=v.z;
   if(v.x>=B.min.x&&v.x<=B.max.x&&v.y>=B.min.y&&v.y<=B.max.y&&Math.abs(v.z)>=B.min.z)band[i]=v.z>0?2:1;}
  for(let t=0;t<n;t+=3){
   const i0=ix?ix[t]:t,i1=ix?ix[t+1]:t+1,i2=ix?ix[t+2]:t+2,s0=band[i0];if(!s0||band[i1]!==s0||band[i2]!==s0)continue;
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
 addMarks(exterior,frame,amber,materialNamed(exterior,'V32_Recess')??navy);
 exterior.updateMatrixWorld(true);
}
