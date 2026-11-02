import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Selected concepts 2C / 4A. All dimensions are metres in the existing Deck 6
// frame. These additions occupy shallow-water bays, not the z=-6..6 boulevard.
export const REFLECTION_BAYS = [30, 46, 78, 94];
const materials = new Map();
const palette = {
  reflection_ivory: [0xe4d7bf, .74, 0],
  reflection_walnut: [0x694431, .7, 0],
  reflection_clay: [0xbb582f, .95, 0],
  reflection_brass: [0xb58a48, .4, .65],
  reflection_leaf: [0x426848, .9, 0],
  reflection_leaf_light: [0x729362, .88, 0],
  reflection_leaf_dark: [0x294d3d, .93, 0],
  reflection_soil: [0x3e352c, 1, 0],
  reflection_light: [0xffd69b, .5, 0],
};
export function reflectionMaterial(name) {
  if (!palette[name]) return null;
  if (!materials.has(name)) {
    const [color, roughness, metalness] = palette[name];
    materials.set(name, new T.MeshStandardMaterial({name:'P4_'+name,color,roughness,metalness,vertexColors:name.startsWith('reflection_leaf'),
      ...(name === 'reflection_light' ? {emissive:color,emissiveIntensity:.65} : {})}));
  }
  return materials.get(name);
}
const sectorPoints = (outer, inner, start, end, segments = 32) => {
  const points=[];
  for(let i=0;i<=segments;i++){const t=start+(end-start)*i/segments;points.push([Math.cos(t)*outer,Math.sin(t)*outer]);}
  if(inner)for(let i=segments;i>=0;i--){const t=start+(end-start)*i/segments;points.push([Math.cos(t)*inner,Math.sin(t)*inner]);}
  else points.push([0,0]);
  return points;
};
export function reflectionGeometry(part) {
  const spec=part.reflectionShape;
  if(!spec)return null;
  if(spec.kind==='branch'){
    const curve=new T.CatmullRomCurve3(spec.points.map(p=>new T.Vector3(...p)));
    const g=new T.TubeGeometry(curve,16,spec.radius,8,false);g.computeBoundingBox();
    const center=g.boundingBox.getCenter(new T.Vector3());return g.translate(-center.x,-center.y,-center.z);
  }
  if(spec.kind==='crown'){
    // Layered leaf clusters keep a readable broad canopy at distance and avoid
    // a single balloon surface in close seated views. No textures/downloads.
    const clumps=[],count=part.size[0]>2?48:16;
    for(let i=0;i<count;i++){
      const h=1-2*(i+.5)/count,a=i*2.39996323,r=Math.sqrt(1-h*h),s=(count>20?.29:.42)+.055*Math.sin(i*7.31);
      const g=new T.IcosahedronGeometry(s,count>20?1:0).scale(1,.7,1).translate(Math.cos(a)*r*.82,h*.72,Math.sin(a)*r*.82);
      const colors=new Float32Array(g.attributes.position.count*3),shade=.83+.15*(.5+.5*Math.sin(i*3.19));
      for(let j=0;j<colors.length;j+=3){colors[j]=shade;colors[j+1]=shade;colors[j+2]=shade*.94;}
      g.setAttribute('color',new T.BufferAttribute(colors,3));clumps.push(g);
    }
    const g=mergeGeometries(clumps);clumps.forEach(p=>p.dispose());g.computeBoundingBox();
    const size=g.boundingBox.getSize(new T.Vector3()),center=g.boundingBox.getCenter(new T.Vector3());
    return g.translate(-center.x,-center.y,-center.z).scale(...part.size.map((n,i)=>n/size.getComponent(i)));
  }
  if(spec.kind==='rib'){
    // Open-bottom portal: 6.5 m clear opening, round upper corners, no threshold.
    const s=new T.Shape();s.moveTo(-3.6,0);s.lineTo(-3.6,2.3);s.bezierCurveTo(-3.6,3.2,-3.2,3.6,-2.3,3.6);s.lineTo(2.3,3.6);s.bezierCurveTo(3.2,3.6,3.6,3.2,3.6,2.3);s.lineTo(3.6,0);s.lineTo(3.25,0);s.lineTo(3.25,2.3);s.bezierCurveTo(3.25,2.95,2.95,3.25,2.3,3.25);s.lineTo(-2.3,3.25);s.bezierCurveTo(-2.95,3.25,-3.25,2.95,-3.25,2.3);s.lineTo(-3.25,0);s.closePath();
    return new T.ExtrudeGeometry(s,{depth:.38,steps:1,bevelEnabled:false,curveSegments:12}).translate(0,-1.8,-.19);
  }
  const points=sectorPoints(spec.outer,spec.inner,spec.start,spec.end),s=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));
  const g=new T.ExtrudeGeometry(s,{depth:part.size[1],steps:1,bevelEnabled:false});g.rotateX(-Math.PI/2);g.computeBoundingBox();
  const c=g.boundingBox.getCenter(new T.Vector3());return g.translate(-c.x,-c.y,-c.z);
}

export function addReflectionTerraces({parts,rests,y}) {
  const room='atrium6-lake';
  // Replace only reeds/planters which occupied the new dry peninsulas.
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];if(p.room===room&&['garden_planter','recovery_planting'].includes(p.part)&&p.at[2]>-12&&p.at[2]<-5&&REFLECTION_BAYS.some(x=>Math.abs(p.at[0]-x)<5.8+p.size[0]/2))parts.splice(i,1);}
  const add=(part,size,at,mat,options={})=>parts.push({room,part,size,at,mat,yaw:0,deck:6,phase6:true,selectedDesign:'2C-4A',...options});
  const arc=(part,x,z,outer,inner,start,end,height,centerY,mat,options={})=>{
    const points=sectorPoints(outer,inner,start,end),xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
    add(part,[maxX-minX,height,maxZ-minZ],[x+(minX+maxX)/2,centerY,z+(minZ+maxZ)/2],mat,{reflectionShape:{kind:'sector',outer,inner,start,end},...options});
  };
  for(const [i,x] of REFLECTION_BAYS.entries()){
    const z=-5.8,outer=5.6;
    // 2 cm step from the established dry floor; no new floor cut or deep water.
    arc('p6_reflection_floor',x,z,outer,0,Math.PI,2*Math.PI,.18,y-.07,'reflection_ivory');
    arc('p6_reflection_waterline',x,z,outer+.012,outer-.05,Math.PI,2*Math.PI,.06,y-.03,'reflection_brass',{noCollide:true});
    // Arc seats face inward; the north half remains completely open for entry.
    arc('p6_reflection_seat_base',x,z,5.05,4.12,200*Math.PI/180,350*Math.PI/180,.34,y+.20,'reflection_walnut');
    arc('p6_reflection_seat_back',x,z,5.10,4.92,200*Math.PI/180,350*Math.PI/180,.52,y+.70,'reflection_clay');
    for(const [j,t] of [215,245,275,305,335].entries()){
      const a=t*Math.PI/180,r=4.6,sx=x+Math.cos(a)*r,sz=z+Math.sin(a)*r,yaw=Math.atan2(-Math.cos(a),-Math.sin(a));
      const start=a-.235,end=a+.235;
      arc('p6_reflection_seat_cushion',x,z,5.02,4.15,start,end,.14,y+.44,'reflection_clay');
      rests.push({id:'p6-reflection-'+i+'-seat-'+j,room,kind:'sit',point:[sx,y+.51,sz],facing:[Math.sin(yaw),0,Math.cos(yaw)],height:y+.51,instanced:true,phase4:true,phase6:true});
    }
    // Curved frames express 4A at each gateway without closing the bay or rail.
    add('p6_reflection_flowing_rib',[7.2,3.6,.38],[x,y+1.82,z-.45],'reflection_ivory',{reflectionShape:{kind:'rib'}});
    for(const dx of[-3.5,3.5]){
      add('p6_reflection_lamp_stem',[.11,.72,.11],[x+dx,y+.38,z-1.3],'reflection_brass');
      add('p6_reflection_lamp_diffuser',[.25,.32,.25],[x+dx,y+.82,z-1.3],'reflection_light',{round:true,noCollide:true});
    }
    add('p6_reflection_low_table',[1.15,.12,.85],[x,y+.57,z-2.5],'reflection_walnut',{round:true});
    add('p6_reflection_table_base',[.45,.50,.45],[x,y+.27,z-2.5],'reflection_brass',{round:true});
    // Low planted ends frame the furniture without screening the water.
    for(const side of[-1,1]){
      const a=side<0?Math.PI+.035:Math.PI*2-.1658;
      arc('p6_reflection_planter',x,z,5.35,4.05,a,a+.14,.40,y+.22,'reflection_ivory');
      for(let k=0;k<3;k++){
        const angle=a+.025+k*.045;
        add('p6_reflection_planting',[.4,.45,.4],[x+Math.cos(angle)*4.68,y+.60,z+Math.sin(angle)*4.68],k%2?'reflection_leaf':'reflection_leaf_light',{reflectionShape:{kind:'crown'},noCollide:true});
      }
    }
  }
  // A single broad-canopied specimen is the lake's visual destination. Its
  // stepped island sits clear of the existing bridge and perimeter paths.
  const tx=44,tz=-26.8;
  arc('p6_reflection_island_floor',tx,tz,7.2,0,0,Math.PI*2,.22,y-.05,'reflection_ivory');
  arc('p6_reflection_island_waterline',tx,tz,7.22,7.12,0,Math.PI*2,.08,y-.02,'reflection_brass',{noCollide:true});
  arc('p6_reflection_island_step',tx,tz,5.8,0,0,Math.PI*2,.18,y+.15,'reflection_ivory');
  arc('p6_reflection_tree_bed',tx,tz,3.25,0,0,Math.PI*2,.35,y+.395,'reflection_ivory');
  arc('p6_reflection_tree_soil',tx,tz,3.05,0,0,Math.PI*2,.06,y+.60,'reflection_soil',{noCollide:true});
  arc('p6_reflection_island_light',tx,tz,5.81,5.75,0,Math.PI*2,.035,y+.19,'reflection_light',{noCollide:true});
  const branch=(points,radius)=>{
    const spec={kind:'branch',points,radius};
    // Geometry helper recentres each part; keep original curve bounds for placement.
    const original=new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),16,radius,8,false);original.computeBoundingBox();
    const c=original.boundingBox.getCenter(new T.Vector3()),size=original.boundingBox.getSize(new T.Vector3());original.dispose();
    add('p6_reflection_tree_branch',size.toArray(),[tx+c.x,y+c.y,tz+c.z],'reflection_walnut',{reflectionShape:spec});
  };
  branch([[0,.6,0],[-.25,2,0],[.25,4,.2],[-.1,6,.35]],.38);
  for(const points of[
    [[.1,2.7,.05],[-1.4,4.1,.15],[-3.2,5.2,.3],[-4.1,5.7,.7]],
    [[.15,3.4,.15],[1.3,4.4,.5],[2.8,5.3,1.5],[3.9,5.8,2]],
    [[.05,3.9,.2],[.5,5,-1.3],[1.4,6.1,-2.8],[2.2,6.5,-3.3]],
    [[0,4.2,.2],[-.8,5.2,1.6],[-1.2,6.2,3],[-1.8,6.5,3.7]],
  ])branch(points,.18);
  const crowns=[[-4,5.9,.6,4.5,2.1,4.2],[-2.4,6.6,-1.3,4.8,2.1,4.4],[.3,6.7,.1,5.8,2.5,5.3],[3.9,6,2,4.7,2.2,4.6],[2.1,6.8,-3,4.6,2.1,4.5],[-1.5,6.7,3.4,4.9,2,4.3],[1.2,6.8,3,4.3,2.2,3.9]];
  crowns.forEach(([dx,dy,dz,w,h,d],i)=>add('p6_reflection_tree_crown',[w,h,d],[tx+dx,y+dy,tz+dz],['reflection_leaf','reflection_leaf_light','reflection_leaf_dark'][i%3],{reflectionShape:{kind:'crown'},noCollide:true}));
  for(let i=0;i<18;i++){const a=i*Math.PI*2/18,r=2.25+(i%2)*.25;add('p6_reflection_understory',[1.2,.45,1.1],[tx+Math.cos(a)*r,y+.85,tz+Math.sin(a)*r],i%3?'reflection_leaf_dark':'reflection_leaf_light',{reflectionShape:{kind:'crown'},noCollide:true});}
  return {bays:REFLECTION_BAYS.length,seats:REFLECTION_BAYS.length*5};
}
