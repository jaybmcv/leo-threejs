import {planX,planZ} from './plan-profile.js';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries,mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import fontData from './assets/helvetiker-bold.json' with { type: 'json' };
import {frontPoint,WINDOW_ROWS} from './hull-profile.js';
import {bowHeight} from './diagonal-profile.js';
import {exteriorWidth as halfWidth,exteriorRoofY as roofY,exteriorShellPoint as shellPoint} from './exterior-profile.js';

const font=new FontLoader().parse(fontData);
const V=(x,y,z)=>new T.Vector3(x,y,z);
export function createExterior(root,{hullAt}) {
  const exterior=new T.Group();exterior.name='01_EXTERIOR_REFINED_V18';root.add(exterior);
  const addGroup=(name,p=exterior)=>{const g=new T.Group();g.name=name;p.add(g);return g;};
  const fixed=addGroup('Wings_engines_tail'),port=addGroup('Port_shell'),starboard=addGroup('Starboard_shell');
  const mat=(name,color,roughness=.5,metalness=.15)=>new T.MeshStandardMaterial({name,color,roughness,metalness});
  const white=mat('V18_Ceramic_satin',0xcbd1d5,.52,.18),navy=mat('V18_Thermal_navy',0x243244,.62,.2),edge=mat('V18_Edge_alloy',0x647480,.4,.55),black=mat('V18_Recess',0x111c29,.62,.3),seam=mat('V18_Panel_reveal',0x71808a,.75,.1),blue=mat('V18_Observation_glass',0x1d3b53,.27,.4),orange=mat('V18_Amber_markers',0xeb9d47,.5,.15),ink=mat('V18_Identity_ink',0x263b53,.65,.08);
  const ceramicPanel=mat('V18_Ceramic_access_panels',0xbfc8ce,.6,.15),thermalPanel=mat('V18_Thermal_service_panels',0x2b3c50,.65,.22),gasket=mat('V18_Glazing_seals',0x172330,.82,.05);
  const palePanel=mat('V18_Dorsal_service_covers',0xc5cdd2,.59,.17);
  const warm=new T.MeshStandardMaterial({name:'V18_Inhabited_windows',color:0x294554,roughness:.3,metalness:.2,emissive:0x506874,emissiveIntensity:.2});
  const engineGlow=new T.MeshStandardMaterial({name:'V18_Engine_idle_glow',color:0x527ca5,emissive:0x426d92,emissiveIntensity:.8,roughness:.25});
  const mesh=(name,geo,material,p=fixed,pos=[0,0,0])=>{const m=new T.Mesh(geo,material);m.name=name;m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;};
  const box=(name,size,pos,material,p=fixed,r=.3)=>mesh(name,new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(x=>x/3))),material,p,pos);
  const batches=new Map();
  const collect=(name,geo,material,p=fixed)=>{const key=`${p.uuid}:${name}`;if(!batches.has(key))batches.set(key,{name,geos:[],material,p});batches.get(key).geos.push(geo);};
  const line=(name,pts,r,material=seam,p=fixed)=>{
    const curve=new T.CatmullRomCurve3(pts.map(p=>Array.isArray(p)?V(...p):p));
    collect(name,new T.TubeGeometry(curve,Math.max(8,pts.length*3),r,5,false),material,p);
  };
  const text=(name,value,size,pos,material=ink,p=fixed,rotation=[0,0,0])=>{
    const geo=new T.ShapeGeometry(font.generateShapes(value,size),4);
    if(['LEO_wordmark','Mission_identifier','Mission_brand'].includes(name)){const side=rotation[1]===0?1:-1,a=geo.attributes.position;for(let i=0;i<a.count;i++){const x=pos[0]+side*a.getX(i),y=pos[1]+a.getY(i);a.setZ(i,halfWidth(x,y)+.65-side*pos[2]);}geo.computeVertexNormals();}
    const m=mesh(name,geo,material,p,pos);m.rotation.set(...rotation);m.castShadow=false;m.receiveShadow=false;return m;
  };
  const sidePoint=(x,y,s,offset=.2)=>[x,y,s*(halfWidth(x,y)+offset)];
  function surfacePanel(name,x0,x1,y0,y1,s,material,parent,offset=.22,corner=.8){
    const p=[],ix=[],nx=Math.max(4,Math.ceil((x1-x0)/2)),ny=Math.max(4,Math.ceil(y1-y0));
    for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){
      const y=T.MathUtils.lerp(y0,y1,j/ny),trim=Math.max(0,corner-Math.min(y-y0,y1-y));
      p.push(...sidePoint(T.MathUtils.lerp(x0+trim,x1-trim,i/nx),y,s,offset));
    }
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const a=i*(ny+1)+j,b=a+ny+1;if(s>0)ix.push(a,b,a+1,b,b+1,a+1);else ix.push(a,a+1,b,b,a+1,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();collect(name,g,material,parent);
  }
  function panelOutline(name,x0,x1,y0,y1,s,parent,material=seam,offset=.4,r=.085){
    const pts=[],corners=[[x0+.8,y0],[x1-.8,y0],[x1,y0+.8],[x1,y1-.8],[x1-.8,y1],[x0+.8,y1],[x0,y1-.8],[x0,y0+.8],[x0+.8,y0]];
    for(let k=0;k<corners.length-1;k++){const a=corners[k],b=corners[k+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));for(let i=0;i<n;i++)pts.push(sidePoint(T.MathUtils.lerp(a[0],b[0],i/n),T.MathUtils.lerp(a[1],b[1],i/n),s,offset));}pts.push(pts[0]);
    line(name,pts,r,material,parent);
  }
  function roofPanel(name,x0,x1,z0,z1,height,material,parent,offset=.25,corner=1){
    const p=[],ix=[],nx=Math.max(4,Math.ceil((x1-x0)/2)),nz=Math.max(4,Math.ceil((z1-z0)/1.5));
    for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
      const z=T.MathUtils.lerp(z0,z1,j/nz),trim=Math.max(0,corner-Math.min(z-z0,z1-z));
      const x=T.MathUtils.lerp(x0+trim,x1-trim,i/nx);p.push(x,height(x,z)+offset,z);
    }
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=i*(nz+1)+j,b=a+nz+1;ix.push(a,a+1,b,b,a+1,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();collect(name,g,material,parent);
  }
  function shell(s,p){
    const vertices=[],lower=[],upper=[],segments=288,rows=401;
    // Cosine spacing resolves the highly curved nose with short longitudinal faces.
    for(let i=0;i<rows;i++)for(let j=0;j<=segments;j++)vertices.push(...shellPoint(-300*Math.cos(i/(rows-1)*Math.PI),-Math.PI/2+j/segments*Math.PI,s));
    for(let i=0;i<rows-1;i++)for(let j=0;j<segments;j++){
      const a=i*(segments+1)+j,b=a+segments+1,ix=j<108?lower:upper;
      if(s===1)ix.push(a,b,a+1,b,b+1,a+1);else ix.push(a,a+1,b,b,a+1,b+1);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex([...lower,...upper]);g.addGroup(0,lower.length,1);g.addGroup(lower.length,upper.length,0);g.computeVertexNormals();
    // The old shelf produces very thin triangles when lowered. Evaluate the
    // fairing's surface normal directly instead of averaging those triangles.
    const positions=g.attributes.position,normals=g.attributes.normal;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      if(x<=-184||x>=27||y<=13)continue;
      const d=.1,n=V(-(roofY(x+d,z)-roofY(x-d,z))/(2*d),1,-(roofY(x,z+d)-roofY(x,z-d))/(2*d)).normalize();
      normals.setXYZ(i,n.x,n.y,n.z);
    }
    mesh(`Smooth_pressure_envelope_${s}`,g,[white,navy],p);
    // A level forward chine wraps the nose continuously, including the centreline.
    for(let theta of [-Math.PI/8,-.56,-.83]){
      const pts=Array.from({length:117},(_,i)=>shellPoint(-284+i*462/116,theta,s,.18));
      const y=pts.at(-1)[1];for(let i=1;i<=80;i++)pts.push(frontPoint(y,(1-i/80)*Math.PI/2,s,.18));
      line('Continuous_chine',pts,theta===-Math.PI/8?.3:.1,theta===-Math.PI/8?edge:seam,p);
    }
    // Fine transverse and longitudinal panel joints, restrained at ship scale.
    for(let x of [-274,-230,-180,-130,-75,-20,35,90,145]){
      line('Hull_panel_seams',Array.from({length:31},(_,i)=>shellPoint(x,-1.12+i/30*2.68,s,.06)),.055,seam,p);
    }
    for(let theta of [-.35,.4,1.2])line('Hull_panel_seams',Array.from({length:111},(_,i)=>shellPoint(-265+i*4,theta,s,.06)),.045,seam,p);
    for(let angle of [.34,.72,1.1,1.43])line('Bow_cheek_panel_joint',Array.from({length:45},(_,i)=>frontPoint(-14+i*17/44,angle,s,.16)),.065,seam,p);
    const verts=[],ids=[];
    const pane=(x1,x2,y1,y2,offset=.24)=>{
      if([halfWidth(x1,y1),halfWidth(x2,y2),halfWidth(x1,y2),halfWidth(x2,y1)].some(w=>w<2))return;
      const k=verts.length/3,nx=Math.ceil((x2-x1)/1.5),ny=Math.ceil((y2-y1)/.5);
      for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++){const x=T.MathUtils.lerp(x1,x2,i/nx),y=T.MathUtils.lerp(y1,y2,j/ny);verts.push(x,y,s*(halfWidth(x,y)+offset));}
      for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const a=k+i*(ny+1)+j,b=a+ny+1;if(s>0)ids.push(a,b,a+1,b,b+1,a+1);else ids.push(a,a+1,b,b,a+1,b+1);}
    };
    for(let row=0;row<9;row++){
      const y=-10+row*4.5;
      for(const [start,count] of [[-109,10],[-44,9],[86,13]])for(let i=0;i<count;i++){
        const x=start+i*5.6+(row%3)*1.4;
        if(y>2&&y<21&&x>-26&&x<56)continue;
        if(y>3&&y<19&&x>74&&x<119)continue;
        if(y>17&&x>56)continue;
        if(y>=21&&[-95,-51,-7,37].some(h=>x+4.5>h-1&&x<h+14))continue;
        pane(x,x+4.5,y,y+.27);
      }
    }
    for(let row=0;row<2;row++){
      const x0=62+row*3,y0=33+row*5;
      surfacePanel('Forward_side_vent_seal',x0,110,y0,y0+3,s,gasket,p,.3,.55);
      surfacePanel('Forward_side_vent_glass',x0+.5,109.5,y0+.35,y0+2.65,s,blue,p,.48,.4);
      panelOutline('Forward_side_vent_frame',x0,110,y0,y0+3,s,p,edge,.52,.1);
    }
    const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(verts,3));wg.setIndex(ids);wg.computeVertexNormals();mesh('Individual_deck_windows',wg,warm,p);
    // Tonal thermal plates and flush access hatches follow the same outer surface.
    for(let x=-113;x<=167;x+=40){
      surfacePanel('Lower_thermal_panel_fields',x,x+36,-36,-17,s,thermalPanel,p,.22,1.1);
      panelOutline('Thermal_panel_joint',x,x+36,-36,-17,s,p,black,.34,.1);
      surfacePanel('Service_access_panel',x+23,x+32,-25,-19,s,navy,p,.39,.65);
      panelOutline('Service_access_reveal',x+23,x+32,-25,-19,s,p,edge,.52,.06);
      surfacePanel('Thermal_amber_locator',x+3,x+6,-19,-18.65,s,orange,p,.42,.12);
    }
    for(let x of [-95,-51,-7,37]){
      panelOutline('Upper_service_hatch',x,x+13,22,29,s,p,seam,.22,.07);
      surfacePanel('Upper_hatch_latch',x+9,x+11,24,24.7,s,edge,p,.3,.18);
    }
    for(let x of [174,202,230]){
      surfacePanel('Bow_access_panels',x,x+14,-5,0,s,ceramicPanel,p,.27,.7);
      panelOutline('Bow_access_panel_seal',x,x+14,-5,0,s,p,seam,.39,.07);
    }
    // Lifeboat galleries and cargo interface plates are surface details, not capacity claims.
    for(let x of [-99,-48,3,54,105]){
      surfacePanel('Lifeboat_bay_frame',x-14.5,x+14.5,-32.5,-25.5,s,edge,p,.46,.5);
      surfacePanel('Lifeboat_bay_recess',x-13.5,x+13.5,-31.75,-26.25,s,black,p,.6,.35);
      for(let i=0;i<6;i++)line('Lifeboat_shutter_rib',Array.from({length:9},(_,j)=>sidePoint(x-10.5+i*4.2,-31.5+j*5/8,s,.74)),.085,edge,p);
      surfacePanel('Bay_amber_marker',x-2,x+2,-27.1,-26.7,s,orange,p,.77,.1);
    }
    // Identity surfaces remain true vector geometry in the GLB.
    if(s===1){text('LEO_wordmark','LEO',8,[80,8,halfWidth(100,12)+.7],ink,p);text('Mission_identifier','MCV / 01',1.6,[81,4,halfWidth(95,5)+.7],ink,p);}
    else{text('LEO_wordmark','LEO',8,[111,8,-halfWidth(100,12)-.7],ink,p,[0,Math.PI,0]);text('Mission_identifier','MCV / 01',1.6,[105,4,-halfWidth(95,5)-.7],ink,p,[0,Math.PI,0]);}
    for(const [word,y] of [['MARS',17],['CATS',12],['VOYAGE',7]])text('Mission_brand',word,3.2,s===1?[-4,y,halfWidth(10,y)+.7]:[4,y,-halfWidth(10,y)-.7],ink,p,[0,s===1?0:Math.PI,0]);
    const crestX=s===1?-16:16;
    const badge=addGroup('Feline_mission_crest',p);badge.position.set(crestX,13,s*(halfWidth(crestX,13)+.85));if(s<0)badge.rotation.y=Math.PI;
    mesh('Crest_roundel',new T.CircleGeometry(5.5,48),ink,badge);
    const cat=new T.Shape();cat.moveTo(-3.4,-1);cat.lineTo(-3.3,3.5);cat.lineTo(-1.4,2);cat.quadraticCurveTo(0,2.8,1.4,2);cat.lineTo(3.3,3.5);cat.lineTo(3.4,-1);cat.bezierCurveTo(3.3,-4.3,-3.3,-4.3,-3.4,-1);
    mesh('Crest_cat',new T.ShapeGeometry(cat),white,badge,[0,0,.35]);
    for(let x of [-1.25,1.25])mesh('Crest_eye',new T.CircleGeometry(.45,16),ink,badge,[x,.1,.7]);
    const nose=new T.Shape();nose.moveTo(-.55,-1);nose.lineTo(.55,-1);nose.lineTo(0,-1.65);nose.closePath();mesh('Crest_nose',new T.ShapeGeometry(nose),ink,badge,[0,0,.7]);
    badge.traverse(o=>{if(o.isMesh){const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const x=crestX+s*(a.getX(i)+o.position.x),y=13+a.getY(i)+o.position.y;a.setZ(i,halfWidth(x,y)+.65-s*badge.position.z);}o.geometry.computeVertexNormals();o.castShadow=false;o.receiveShadow=false;}});
    // Aft hangar mouth at the wing root.
    surfacePanel('Transfer_hangar_frame',-184,-150,-22,-10,s,edge,p,.4,.7);
    surfacePanel('Transfer_hangar_inset',-182.7,-151.3,-20.8,-11.2,s,black,p,.6,.6);
    for(let yy of [-18,-14])line('Hangar_door_reveal',Array.from({length:21},(_,i)=>sidePoint(-181+i*28/20,yy,s,.85)),.1,edge,p);
    surfacePanel('Transfer_hangar_amber',-171,-165,-12,-11.5,s,orange,p,.86,.15);
  }
  shell(-1,port);shell(1,starboard);
  // Level window rows wrap the raked bow facade. They share its exact loft function.
  function canopyPatch(a0,a1,y0,y1,s,parent,material,offset,name){
    const p=[],ix=[],na=20,nr=12;
    for(let i=0;i<=na;i++)for(let j=0;j<=nr;j++){
      const y=T.MathUtils.lerp(y0,y1,j/nr),trim=.014*Math.max(0,1-Math.min(y-y0,y1-y)/.72);
      const a=T.MathUtils.lerp(a0+trim,a1-trim,i/na);p.push(...frontPoint(y,a,s,offset));
    }
    for(let i=0;i<na;i++)for(let j=0;j<nr;j++){const a=i*(nr+1)+j,b=a+nr+1;ix.push(a,a+1,b,b,a+1,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();collect(name,g,material,parent);
  }
  blue.side=T.DoubleSide;gasket.side=T.DoubleSide;
  for(const s of [-1,1]){
    const parent=s===1?starboard:port;
    for(const {bottom:y0,top:y1,arc:maxAngle,panesPerSide:count} of WINDOW_ROWS){
      for(let i=0;i<count;i++){
        const a0=i/count*maxAngle+.01,a1=(i+1)/count*maxAngle-.01;
        canopyPatch(a0,a1,y0,y1,s,parent,gasket,.42,'Individual_glazing_seals');
        canopyPatch(a0+.005,a1-.005,y0+.35,y1-.35,s,parent,blue,.59,'Forward_observation_panes');
        const boundary=[];
        for(let j=0;j<=12;j++)boundary.push(frontPoint(y0,T.MathUtils.lerp(a0+.014,a1-.014,j/12),s,.62));
        boundary.push(frontPoint(y0+.72,a1,s,.62),frontPoint(y1-.72,a1,s,.62));
        for(let j=0;j<=12;j++)boundary.push(frontPoint(y1,T.MathUtils.lerp(a1-.014,a0+.014,j/12),s,.62));
        boundary.push(frontPoint(y1-.72,a0,s,.62),frontPoint(y0+.72,a0,s,.62),boundary[0]);
        line('Individual_glazing_frames',boundary,.22,edge,parent);
      }
    }
    line('Bridge_roof_brow',Array.from({length:49},(_,i)=>frontPoint(50.7,i/48*1.62,s,.26)),.42,white,parent);
    for(let y of [1,-8])line('Bow_horizontal_panel_reveal',Array.from({length:65},(_,i)=>frontPoint(y,i/64*1.48,s,.16)),.07,seam,parent);
    canopyPatch(.008,.17,6.1,8.5,s,parent,gasket,.44,'Forward_navigation_sensor_seal');
    canopyPatch(.014,.163,6.45,8.15,s,parent,blue,.62,'Forward_navigation_sensor_glass');
  }
  // Low-mounted nacelles meet an anhedral wing instead of sitting at roof height.
  const wingDrop=z=>{const t=T.MathUtils.clamp((Math.abs(z)-54)/64,0,1);return -13*t*t*(3-2*t)+3.2*Math.sin(Math.PI*t)**2;};
  const wingTop=z=>-1.8+wingDrop(z);
  function podProfile(x){
    const t=T.MathUtils.clamp((x+208)/73,0,1);
    const corner=u=>1-Math.sqrt(Math.max(0,1-T.MathUtils.clamp(u,0,1)**2));
    const e=.24,ramp=(t<e?t*t/(2*e):t>1-e?1-e-(1-t)**2/(2*e):t-e/2)/(1-e);
    const aftRound=1-T.MathUtils.smoothstep(x,-292,-270);
    return {w:Math.max(.8,(23.6-7.2*corner((-x-281)/11))*Math.sqrt(Math.max(0,1-Math.max(0,(x+155)/20)**2))),lo:-26+4*aftRound+2*t*t,hi:30-8*aftRound-36*ramp,n:4};
  }
  // Rounded trapezoidal sections: flat roofs, chamfered shoulders, a broad lower sill.
  const sectionShape=new T.Shape();sectionShape.moveTo(0,1);sectionShape.lineTo(.61,1);sectionShape.quadraticCurveTo(.72,1,.78,.91);sectionShape.lineTo(.97,.27);sectionShape.quadraticCurveTo(1,.19,1,.14);sectionShape.quadraticCurveTo(1,0,.72,0);sectionShape.lineTo(-.72,0);sectionShape.quadraticCurveTo(-1,0,-1,.14);sectionShape.quadraticCurveTo(-1,.19,-.97,.27);sectionShape.lineTo(-.78,.91);sectionShape.quadraticCurveTo(-.72,1,-.61,1);sectionShape.closePath();
  const podSection=sectionShape.getSpacedPoints(80);
  function sectionRoof(u){let height=0;for(let i=0;i<podSection.length-1;i++){const a=podSection[i],b=podSection[i+1];if(Math.abs(b.x-a.x)<1e-8)continue;const t=(u-a.x)/(b.x-a.x);if(t>=0&&t<=1)height=Math.max(height,T.MathUtils.lerp(a.y,b.y,t));}return height;}
  function sectionWidth(v){let width=0;for(let i=0;i<podSection.length-1;i++){const a=podSection[i],b=podSection[i+1];if(Math.abs(b.y-a.y)<1e-8)continue;const t=(v-a.y)/(b.y-a.y);if(t>=0&&t<=1)width=Math.max(width,Math.abs(T.MathUtils.lerp(a.x,b.x,t)));}return width;}
  for(const s of [-1,1]){
    const pod=addGroup(s===1?'Starboard_nacelle':'Port_nacelle',fixed),zc=s*129.75;
    const p=[],low=[],up=[],nx=120,nt=80;
    for(let i=0;i<=nx;i++)for(let j=0;j<=nt;j++){
      const x=-292+157*Math.sin(i/nx*Math.PI/2),h=podProfile(x),q=podSection[j];
      p.push(x,h.lo+(h.hi-h.lo)*q.y,zc+h.w*q.x);
    }
    for(let i=0;i<nx;i++)for(let j=0;j<nt;j++){const a=i*(nt+1)+j,b=a+nt+1,ix=(podSection[j].y+podSection[j+1].y)/2<.19?low:up;ix.push(a,a+1,b,b,a+1,b+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([...low,...up]);g.addGroup(0,low.length,1);g.addGroup(low.length,up.length,0);g.computeVertexNormals();mesh('Sculpted_nacelle_shell',g,[white,navy],pod);
    // Close the open nacelle end with a shaped exhaust plate and recessed nozzle seats.
    const back=podProfile(-292),outline=new T.Shape();
    podSection.forEach((q,k)=>{const z=back.w*q.x,y=back.lo+(back.hi-back.lo)*q.y;if(k===0)outline.moveTo(z,y);else outline.lineTo(z,y);});
    for(let zz of [-7.5,7.5]){const hole=new T.Path();hole.absarc(zz,-1,6.85,0,Math.PI*2,true);outline.holes.push(hole);}
    const rearGeo=new T.ShapeGeometry(outline,32);const rear=mesh('Nacelle_exhaust_bulkhead',rearGeo,navy,pod,[-292,0,zc]);rear.rotation.y=-Math.PI/2;
    const noseProfile=podProfile(-135),noseOutline=new T.Shape();podSection.forEach((q,k)=>{const z=noseProfile.w*q.x,y=noseProfile.lo+(noseProfile.hi-noseProfile.lo)*q.y;if(k===0)noseOutline.moveTo(z,y);else noseOutline.lineTo(z,y);});const noseCap=mesh('Nacelle_chamfered_nose_face',new T.ShapeGeometry(noseOutline),navy,pod,[-135,0,zc]);noseCap.rotation.y=Math.PI/2;
    for(let zz of [-7.5,7.5]){const seat=mesh('Nozzle_recess_surround',new T.TorusGeometry(7.2,.35,10,48),edge,pod,[-292.5,-1,zc+zz]);seat.rotation.y=Math.PI/2;}
    for(let offset of [-1,1])line('Nacelle_chine',Array.from({length:61},(_,i)=>{const x=-286+i*151/60,h=podProfile(x);return [x,h.lo+(h.hi-h.lo)*.19,zc+offset*(h.w*sectionWidth(.19)+.16)];}),.25,edge,pod);
    for(let x of [-272,-218,-185]){
      const h=podProfile(x);line('Nacelle_panel_seam',podSection.filter(q=>q.y>=.19).map(q=>[x,h.lo+(h.hi-h.lo)*q.y+.1,zc+(h.w+.1)*q.x]),.07,seam,pod);
    }
    const podRoof=(x,z)=>{const h=podProfile(x);return h.lo+(h.hi-h.lo)*sectionRoof((z-zc)/h.w);};
    roofPanel('Nacelle_forward_service_panel',-185,-144,zc-9,zc+9,podRoof,palePanel,pod,.28,1.5);
    for(const dz of [-9,9])line('Nacelle_forward_panel_reveal',Array.from({length:25},(_,i)=>{const x=-183.5+i*38/24;return [x,podRoof(x,zc+dz)+.35,zc+dz];}),.075,seam,pod);
    for(let x of [-163,-159,-155])roofPanel('Nacelle_front_sensor_gill',x,x+1.25,zc-5,zc+5,podRoof,navy,pod,.48,.5);
    roofPanel('Nacelle_front_hatch_latch',-181,-178,zc-2,zc+2,podRoof,edge,pod,.48,.35);
    for(let zz of [-10,10])line('Service_panel_reveal',Array.from({length:32},(_,i)=>{const x=-270+i*3;return [x,podRoof(x,zc+zz)+.2,zc+zz];}),.12,seam,pod);
    for(let x of [-270,-177])line('Service_panel_reveal',Array.from({length:15},(_,i)=>{const z=zc-10+i*20/14;return [x,podRoof(x,z)+.2,z];}),.12,seam,pod);
    text('Nacelle_designation','LEO',4,[-229,30.7,zc+3],ink,pod,[-Math.PI/2,0,0]);
    for(let zz of [-7.5,7.5]){
      const shroud=mesh('Engine_shroud',new T.CylinderGeometry(7.3,6.8,9,32,1,true),navy,pod,[-294,-1,zc+zz]);shroud.rotation.z=Math.PI/2;
      const bellMaterial=black.clone();bellMaterial.side=T.DoubleSide;
      const bell=mesh('Engine_bell',new T.CylinderGeometry(6.4,4.4,7,48,1,true),bellMaterial,pod,[-294,-1,zc+zz]);bell.rotation.z=Math.PI/2;
      for(let xx of [-298,-292]){const ring=mesh('Engine_nozzle_lip',new T.TorusGeometry(xx===-298?6.5:5.3,.45,8,32),edge,pod,[xx,-1,zc+zz]);ring.rotation.y=Math.PI/2;}
      const glow=mesh('Engine_throat',new T.CircleGeometry(4,32),engineGlow,pod,[-290.1,-1,zc+zz]);glow.rotation.y=-Math.PI/2;
      for(let i=0;i<3;i++){const groove=mesh('Nozzle_internal_cooling_ring',new T.TorusGeometry(4.65+i*.53,.15,6,40),edge,pod,[-291-i*2,-1,zc+zz]);groove.rotation.y=Math.PI/2;}
      for(let j=0;j<12;j++){const a=j/12*Math.PI*2;box('Nozzle_radial_segment',[6,.2,.4],[-294,-1+6.6*Math.sin(a),zc+zz+6.6*Math.cos(a)],edge,pod,.05);}
    }
    const hazard=box('Pod_hazard_bar',[6,.28,1.5],[-213,podProfile(-213).hi+.25,zc],orange,pod,.1);
    // Service gills and attitude-thruster clusters reinforce the nacelle's scale.
    for(let k=0;k<6;k++)box('Nacelle_cooling_gill',[.7,.3,9],[-261+k*3.4,podRoof(-261+k*3.4,zc)+.2,zc],navy,pod,.1);
    for(let xx of [-265,-192]){
      const h=podProfile(xx),z=zc+s*(h.w*sectionWidth((5-h.lo)/(h.hi-h.lo))+.15);
      box('RCS_cluster_plate',[10,4,.45],[xx,5,z],navy,pod,.5);
      for(let dx of [-2.7,0,2.7]){
        const ring=mesh('RCS_nozzle_rim',new T.TorusGeometry(.7,.16,6,16),edge,pod,[xx+dx,5,z+s*.35]);
        const disk=mesh('RCS_nozzle',new T.CircleGeometry(.57,16),black,pod,[xx+dx,5,z+s*.38]);if(s<0){ring.rotation.y=Math.PI;disk.rotation.y=Math.PI;}
      }
    }
    const podBounds=new T.Box3().setFromObject(pod);pod.position.z+=s*150-(s>0?podBounds.max.z:podBounds.min.z);
    // A sculpted double-delta plan and a rounded leading edge.
    const sh=new T.Shape(),point=(x,y)=>[planX(x),-s*planZ(y)];
    sh.moveTo(...point(970,787));sh.lineTo(...point(976,766));sh.quadraticCurveTo(...point(978,762),...point(974,756));sh.lineTo(...point(948,714));sh.lineTo(...point(1035,708));sh.lineTo(...point(1083,737));sh.quadraticCurveTo(...point(1090,743),...point(1110,743));sh.lineTo(...point(1080,800));sh.closePath();
    const wg=new T.ExtrudeGeometry(sh,{depth:5,bevelEnabled:true,bevelSize:.65,bevelThickness:2.2,bevelSegments:3,curveSegments:16,steps:1});wg.rotateX(-Math.PI/2);wg.translate(0,-9,0);
    // Subdivide the broad cap triangles before bending; a coarse extruded cap
    // otherwise bridges the curved span and leaves its surface details floating.
    const subdivide=(geo,passes)=>{let current=geo.index?geo.toNonIndexed():geo.clone();for(let pass=0;pass<passes;pass++){const a=current.attributes.position,p=[];for(let i=0;i<a.count;i+=3){const q=[0,1,2].map(k=>V(a.getX(i+k),a.getY(i+k),a.getZ(i+k))),ab=q[0].clone().add(q[1]).multiplyScalar(.5),bc=q[1].clone().add(q[2]).multiplyScalar(.5),ca=q[2].clone().add(q[0]).multiplyScalar(.5);for(const v of [q[0],ab,ca,ab,q[1],bc,ca,bc,q[2],ab,bc,ca])p.push(...v.toArray());}current.dispose();current=new T.BufferGeometry();current.setAttribute('position',new T.Float32BufferAttribute(p,3));}return current;};
    const wingDraft=subdivide(wg,3),wa=wingDraft.attributes.position;for(let i=0;i<wa.count;i++)wa.setY(i,wa.getY(i)+wingDrop(wa.getZ(i)));const bentWing=mergeVertices(wingDraft,1e-4);bentWing.computeVertexNormals();mesh('Blended_double_delta',bentWing,white,fixed);wg.dispose();wingDraft.dispose();
    const belly=bentWing.clone().translate(180,0,0).scale(1.006,1,1.006).translate(-180,-3.7,0);mesh('Wing_thermal_edge',belly,navy,fixed);
    // The wing-root shoulder is part of the shell, avoiding a grazing mesh seam.
    const fence=new T.Shape();fence.moveTo(-164,0);fence.lineTo(-175,13);fence.quadraticCurveTo(-177,14,-179,12);fence.lineTo(-186,0);fence.closePath();
    const fenceGeo=new T.ExtrudeGeometry(fence,{depth:1.8,bevelEnabled:true,bevelSize:.6,bevelThickness:.4,bevelSegments:2});fenceGeo.translate(0,0,s*90-.9);
    const fa=fenceGeo.attributes.position;for(let i=0;i<fa.count;i++)fa.setY(i,fa.getY(i)+wingTop(fa.getZ(i))-.6);fenceGeo.computeVertexNormals();mesh('Wing_stabilizer_fence',fenceGeo,white,fixed);
    line('Fence_dark_leading_edge',[[-175,12+wingTop(90),s*90],[-171,7+wingTop(90),s*90],[-165,1+wingTop(90),s*90]],.65,navy,fixed);
    box('Fence_amber_tip',[2.2,.9,2.1],[-176,12.8+wingTop(90),s*90],orange,fixed,.2);
    const radiator=new T.Shape();radiator.moveTo(-187,-s*62);radiator.lineTo(-218,-s*110);radiator.lineTo(-205,-s*110);radiator.lineTo(-174,-s*62);radiator.closePath();
    const radiatorBase=new T.ShapeGeometry(radiator);radiatorBase.rotateX(-Math.PI/2);radiatorBase.translate(0,-1.7,0);const radiatorGeo=subdivide(radiatorBase,5),ra=radiatorGeo.attributes.position;for(let i=0;i<ra.count;i++)ra.setY(i,ra.getY(i)+wingDrop(ra.getZ(i)));radiatorGeo.computeVertexNormals();radiatorBase.dispose();const radiatorMat=navy.clone();radiatorMat.side=T.DoubleSide;mesh('Swept_wing_louver_recess',radiatorGeo,radiatorMat,fixed);
    for(let i=0;i<15;i++){
      const z=64+i*3,x=-180.5-(z-62)*31/48;
      box('Aft_radiator_louver',[11,.3,.55],[x,-1.4+wingDrop(z),s*z],edge,fixed,.08);
    }
    line('Elevon_hinge',Array.from({length:33},(_,i)=>{const z=58+57*i/32;return [-188-(z-58)*32/57,-2+wingDrop(z),s*z];}),.22,edge,fixed);
    line('Wing_leading_edge',Array.from({length:33},(_,i)=>{const z=129-50*i/32;return [-185+(129-z)*86/50,-1.5+wingDrop(z),s*z];}),.15,seam,fixed);
  }
  const tailGroup=addGroup('Upright_tail_assembly',fixed);
  // Back-swept cat-tail with a sculpted cap and inset rudder.
  const ts=new T.Shape();ts.moveTo(-244,27);ts.bezierCurveTo(-257,56,-279,103,-290,120);ts.quadraticCurveTo(-293,125,-285,125);ts.lineTo(-247,118);ts.bezierCurveTo(-226,86,-195,47,-171,35);ts.closePath();
  const tg=new T.ExtrudeGeometry(ts,{depth:7,bevelEnabled:true,bevelSize:1.6,bevelThickness:1.5,bevelSegments:3,curveSegments:20,steps:1});tg.translate(0,0,-3.5);mesh('Swept_cat_tail',tg,white,tailGroup);
  const capShape=new T.Shape();capShape.moveTo(-296,-5);capShape.quadraticCurveTo(-297,-10,-291,-11);capShape.lineTo(-235,-9);capShape.quadraticCurveTo(-220,-5,-219,0);capShape.quadraticCurveTo(-220,5,-235,9);capShape.lineTo(-291,11);capShape.quadraticCurveTo(-297,10,-296,5);capShape.closePath();
  const capGeo=new T.ExtrudeGeometry(capShape,{depth:4.2,bevelEnabled:true,bevelSize:1.3,bevelThickness:1.1,bevelSegments:5,curveSegments:24});capGeo.rotateX(-Math.PI/2);capGeo.translate(0,122.5,0);const capVertices=capGeo.attributes.position;for(let i=0;i<capVertices.count;i++){const x=capVertices.getX(i),y=capVertices.getY(i),t=T.MathUtils.smoothstep(x,-252,-220);capVertices.setY(i,123.2+(y-123.2)*(1-.5*t)-.06*(x+296));}capGeo.computeVertexNormals();mesh('Swept_tail_cap',capGeo,white,tailGroup);
  // Low dorsal fairing extends the tail's root into the spine.
  const rootFairing=mesh('Tail_root_dorsal_fairing',new T.SphereGeometry(1,56,28),white,tailGroup,[-207,32,0]);rootFairing.scale.set(49,4.8,13);
  const rudderMat=ceramicPanel.clone();rudderMat.side=T.DoubleSide;
  for(const s of [-1,1]){
    const shape=new T.Shape();shape.moveTo(-252,48);shape.lineTo(-281,114);shape.lineTo(-274,113);shape.lineTo(-245,48);shape.closePath();
    const geo=new T.ShapeGeometry(shape);const rudder=mesh('Inset_rudder',geo,rudderMat,tailGroup,[0,0,s*5.3]);rudder.castShadow=false;rudder.receiveShadow=false;
    line('Rudder_perimeter_joint',[[-252,48,s*5.4],[-281,114,s*5.4],[-274,113,s*5.4],[-245,48,s*5.4]],.09,seam,tailGroup);
    text('Tail_registry','MCV 01',2.2,s===1?[-245,83,5.4]:[-232,83,-5.4],ink,tailGroup,[0,s===1?0:Math.PI,0]);
    for(let y of [62,94]){const x=-252-(y-48)*29/66;line('Rudder_segment_joint',[[x,y,s*5.45],[x+7,y,s*5.45]],.12,edge,tailGroup);}
    for(let y of [52,101]){
      const x=y===52?-231:-253;
      line('Tail_access_hatch',[[x,y,s*5.17],[x+10,y,s*5.17],[x+10,y+4,s*5.17],[x,y+4,s*5.17],[x,y,s*5.17]],.06,seam,tailGroup);
      box('Tail_hatch_latch',[1.2,.3,.15],[x+7.6,y+1.2,s*5.2],edge,tailGroup,.04);
    }
  }
  box('Tail_top_amber',[5,.3,2],[-232,122.8,0],orange,tailGroup,.08);
  // Roof maintenance plate, spine and sensors.
  for(const s of [-1,1]){
    const parent=s===1?starboard:port,z0=s>0?7:-29,z1=s>0?29:-7;
    for(const x of [-79,-16]){
      roofPanel('Dorsal_service_cover',x,x+58,z0,z1,roofY,palePanel,parent,.22,1.2);
      for(let dz of [z0+3,z1-3])roofPanel('Dorsal_cover_latch',x+5,x+7,dz-.6,dz+.6,roofY,edge,parent,.4,.25);
    }
    line('Dorsal_maintenance_hatch',[[ -89,roofY(-89,s*33,.15),s*33],[40,roofY(40,s*33,.15),s*33],[116,roofY(116,s*31,.15),s*31]],.12,seam,s===1?starboard:port);
    line('Dorsal_hatch_front',[[116,roofY(116,0,.15),0],[116,roofY(116,s*16,.15),s*16],[116,roofY(116,s*31,.15),s*31]],.12,seam,s===1?starboard:port);
  }
  box('Dorsal_sensor_rail',[170,1.1,2.3],[31,53.5,0],edge,fixed,.4);
  for(let x of [-46,52,109]){
    box('Sensor_fairing',[13,2.4,5.4],[x,54.5,0],navy,fixed,1.1);
    line('Dorsal_whiskers',[[x-2,55.5,0],[x-2.4,60,0],[x-3,63.5,0]],.22,edge,fixed);
    box('Sensor_amber',[2.8,.25,3],[x+3,55.85,0],orange,fixed,.07);
  }
  text('Roof_mission','MCV 01',2.3,[85,53,24],ink,starboard,[-Math.PI/2,0,0]);
  for(let s of [-1,1])line('Nose_whisker',[[284,-20,s*13],[293,-22,s*16],[297,-22,s*17]],.2,edge,fixed);
  const aft=hullAt(-299.94),aftContour=Array.from({length:49},(_,i)=>{const y=T.MathUtils.lerp(aft.bottom,aft.top,i/48);return [halfWidth(-299.94,y),y];}),aftShape=new T.Shape();
  [...aftContour,...aftContour.slice().reverse().map(([z,y])=>[-z,y])].forEach(([z,y],i)=>i?aftShape.lineTo(z,y):aftShape.moveTo(z,y));aftShape.closePath();
  const aftCap=mesh('Contoured_aft_pressure_frame',new T.ShapeGeometry(aftShape),navy,fixed,[-299.94,0,0]);aftCap.rotation.y=-Math.PI/2;
  box('Aft_service_recess',[.4,26,49],[-299.5,1.5,0],navy,fixed,.15);
  for(let z of [-16,0,16]){
    box('Aft_service_door',[.3,21,13],[-299.72,1.5,z],black,fixed,.1);
    for(let y of [-6,-2,2,6,10])box('Aft_service_louver',[.25,.55,11],[-299.86,y,z],edge,fixed,.08);
    box('Aft_service_marker',[.2,.55,4],[-299.89,13,z],orange,fixed,.07);
  }
  // Merge repeated detail by material/group, retaining editable thematic layers.
  for(const {name,geos,material,p} of batches.values()){const g=mergeGeometries(geos);if(g){const detail=mesh(name,g,material,p);if(/seam|reveal|frame|chine|pane|seal|glass/i.test(name)){detail.castShadow=false;detail.receiveShadow=false;}}geos.forEach(g=>g.dispose());}
  // Set the span after all surface-following batches have joined their nacelles.
  for(const [name,s] of [['Starboard_nacelle',1],['Port_nacelle',-1]]){const pod=fixed.getObjectByName(name),bounds=new T.Box3().setFromObject(pod);pod.position.z+=s*150-(s>0?bounds.max.z:bounds.min.z);pod.position.y=-11;pod.position.x=7;}
  // Bake the annotated tail proportions into editable component geometry.
  const capForm=new T.Matrix4().makeTranslation(-258,122.5,0).multiply(new T.Matrix4().makeScale(1.18,1.45,1.3)).multiply(new T.Matrix4().makeTranslation(258,-122.5,0));
  const tailForm=new T.Matrix4().set(1,.3,0,-9.6, 0,1.2,0,-6.4, 0,0,1,0, 0,0,0,1);
  tailGroup.traverse(o=>{if(!o.isMesh)return;o.updateMatrix();o.geometry.applyMatrix4(o.matrix);if(['Swept_tail_cap','Tail_top_amber'].includes(o.name))o.geometry.applyMatrix4(capForm);o.geometry.applyMatrix4(tailForm);o.geometry.computeVertexNormals();o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.updateMatrix();});
  // Apply the same height-only bow rake to shell, glazing, seals and brow.
  // Transform normals with the deformation's Jacobian so the aft fairing's
  // analytic normals survive this separate forward refinement.
  exterior.updateMatrixWorld(true);
  exterior.traverse(o=>{
    if(!o.isMesh)return;
    const a=o.geometry.attributes.position,n=o.geometry.attributes.normal;
    const inv=o.matrixWorld.clone().invert(),toWorld=new T.Matrix3().getNormalMatrix(o.matrixWorld),toLocal=toWorld.clone().invert();
    for(let i=0;i<a.count;i++){
      const p=V(a.getX(i),a.getY(i),a.getZ(i)).applyMatrix4(o.matrixWorld);
      if(p.x<=120||p.y<=-15)continue;
      const d=.01,dx=(bowHeight(p.x+d,p.y)-bowHeight(p.x-d,p.y))/(2*d),dy=(bowHeight(p.x,p.y+d)-bowHeight(p.x,p.y-d))/(2*d);
      if(n){const v=V(n.getX(i),n.getY(i),n.getZ(i)).applyMatrix3(toWorld).normalize();v.set(v.x-dx*v.y/dy,v.y/dy,v.z).applyMatrix3(toLocal).normalize();n.setXYZ(i,v.x,v.y,v.z);}
      p.y=bowHeight(p.x,p.y);p.applyMatrix4(inv);a.setXYZ(i,p.x,p.y,p.z);
    }
    o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
  });
  exterior.userData={revision:'18',scope:'Diagonal form refinement with fixed plan',glazing:'Hull-conforming observation bands; pressure-shell engineering remains conceptual'};
  return {exterior,fixed,port,starboard};
}

