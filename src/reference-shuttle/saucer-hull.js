import * as T from 'three';
import { halfWidth as oldWidth, frontAtLevel } from './base/hull-profile.js';
import { exteriorWidth } from './base/exterior-profile.js';
import { planHalfWidth } from './base/plan-profile.js';
import { bowHeight } from './base/diagonal-profile.js';

// A closed, elongated lenticular body. The tail remains a separate narrow
// structure inserted into its rounded rear, rather than becoming the roof.
const sections=[[-55,0,-125],[-52,50,-150],[-45,84,-181],[-32,101,-199],[-25,104,-202],[-15,103,-200],[-4,100,-195],[8,94,-187],[20,82,-173],[32,67,-157],[42,53,-142],[49,38,-132],[52,32,-127],[52.8,0,-126]];
function profile(y,column) {
  if(y<=sections[0][0])return sections[0][column];if(y>=sections.at(-1)[0])return sections.at(-1)[column];
  const i=sections.findIndex((p,i)=>i<sections.length-1&&y>=p[0]&&y<=sections[i+1][0]);
  const slope=i=>(sections[i+1][column]-sections[i][column])/(sections[i+1][0]-sections[i][0]);
  const tangent=i=>{if(i===0)return slope(0);if(i===sections.length-1)return slope(i-1);const a=slope(i-1),b=slope(i);return a*b<=0?0:2*a*b/(a+b);};
  const a=sections[i],b=sections[i+1],h=b[0]-a[0],t=(y-a[0])/h;
  return (2*t**3-3*t*t+1)*a[column]+(t**3-2*t*t+t)*h*tangent(i)+(-2*t**3+3*t*t)*b[column]+(t**3-t*t)*h*tangent(i+1);
}
export function saucerWidth(x,y) {
  if(y<=-55||y>=52.8||x<-202||x>300)return 0;
  if(x>=160)return oldWidth(x,y)*1.16;
  let width=profile(y,1);
  if(x<-42) {const radius=-42-profile(y,2),t=(-42-x)/radius;width*=Math.sqrt(Math.max(0,1-t*t));}
  const blend=T.MathUtils.smoothstep(x,70,160);
  return Math.max(0,T.MathUtils.lerp(width,oldWidth(x,y)*1.16,blend));
}
function limits(x) {
  let lo=-25,hi=52.8;for(let i=0;i<30;i++){const y=(lo+hi)/2;if(saucerWidth(x,y)>1e-7)lo=y;else hi=y;}const top=lo;
  lo=-55;hi=-25;for(let i=0;i<30;i++){const y=(lo+hi)/2;if(saucerWidth(x,y)>1e-7)hi=y;else lo=y;}return {top,bottom:hi};
}
function compactNeck(source) {
  const attributes=source.attributes,oldIndices=source.index.array,indices=[],map=new Map(),vertices=[],groups=[];
  for(const group of source.groups) {
    const start=indices.length;
    for(let i=group.start;i<group.start+group.count;i+=3) {
      const x=(attributes.position.getX(oldIndices[i])+attributes.position.getX(oldIndices[i+1])+attributes.position.getX(oldIndices[i+2]))/3;
      if(x>=-108)continue;
      for(let j=0;j<3;j++){const old=oldIndices[i+j];if(!map.has(old)){map.set(old,vertices.length);vertices.push(old);}indices.push(map.get(old));}
    }
    groups.push({start,count:indices.length-start,materialIndex:group.materialIndex});
  }
  const geometry=new T.BufferGeometry();
  for(const [name,attribute] of Object.entries(attributes)) {
    const array=new attribute.array.constructor(vertices.length*attribute.itemSize);
    for(let i=0;i<vertices.length;i++)for(let j=0;j<attribute.itemSize;j++)array[i*attribute.itemSize+j]=attribute.array[vertices[i]*attribute.itemSize+j];
    geometry.setAttribute(name,new T.BufferAttribute(array,attribute.itemSize,attribute.normalized));
  }
  geometry.setIndex(indices);for(const group of groups)geometry.addGroup(group.start,group.count,group.materialIndex);
  return geometry;
}
function neckPoint(point) {
  const blend=T.MathUtils.smoothstep(point.x,-235,-160),width=planHalfWidth(point.x);
  point.z*=T.MathUtils.lerp(1,Math.min(1,43/Math.max(1,width)),blend);
  // The dorsal centre carries the fin into the saucer; the outer shoulders
  // tuck beneath the saucer instead of forming another broad upper deck.
  point.y-=18*T.MathUtils.smoothstep(point.x,-220,-145)*T.MathUtils.smoothstep(point.y,0,30)*T.MathUtils.smoothstep(Math.abs(point.z),8,25);
  return point;
}
export function rebuildAsSaucer(root) {
  const obsolete=[];
  root.traverse(object=>{if(['Smoothed_aft_panel_joint','Hull_panel_seams','Continuous_chine','Dorsal_hatch_front'].includes(object.name))obsolete.push(object);});
  for(const object of obsolete)object.parent.remove(object);
  const necks=[];
  for(const side of [-1,1]) {
    const parent=root.getObjectByName(side>0?'Starboard_shell':'Port_shell');
    const previous=parent.getObjectByName(`Smooth_pressure_envelope_${side}`);
    const material=previous.material;
    const neckGeometry=compactNeck(previous.geometry),p=neckGeometry.attributes.position,point=new T.Vector3();
    for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);neckPoint(point);p.setXYZ(i,point.x,point.y,point.z);}
    neckGeometry.computeVertexNormals();neckGeometry.computeBoundingBox();neckGeometry.computeBoundingSphere();
    const neck=new T.Mesh(neckGeometry,material);neck.name=`Tail_attachment_shell_${side}`;neck.castShadow=neck.receiveShadow=true;
    parent.add(neck);necks.push(neck);parent.remove(previous);previous.geometry.dispose();

    const rows=321,segments=288,positions=[],lower=[],upper=[],colors=[];
    for(let i=0;i<rows;i++) {
      const x=49-251*Math.cos(i/(rows-1)*Math.PI),{top,bottom}=limits(x),belt=T.MathUtils.clamp(-16,bottom,top);
      for(let j=0;j<=segments;j++) {
        const y=j<=108?bottom+(belt-bottom)*(1-Math.cos(j/108*Math.PI/2)):belt+(top-belt)*Math.sin((j-108)/180*Math.PI/2);
        positions.push(x,bowHeight(x,y),side*saucerWidth(x,y));
        const shade=.97+.03*Math.sin(x*.13+j*.17)**2;colors.push(shade,shade,shade);
      }
    }
    for(let i=0;i<rows-1;i++)for(let j=0;j<segments;j++) {
      const a=i*(segments+1)+j,b=a+segments+1,target=j<108?lower:upper;
      target.push(...(side>0?[a,b,a+1,b,b+1,a+1]:[a,a+1,b,b,a+1,b+1]));
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex([...lower,...upper]);
    geometry.addGroup(0,lower.length,1);geometry.addGroup(lower.length,upper.length,0);geometry.computeVertexNormals();
    const normals=geometry.attributes.normal;
    for(let i=0;i<rows;i++)for(const j of [0,segments]){const k=i*(segments+1)+j;point.fromBufferAttribute(normals,k);point.z=0;point.normalize();normals.setXYZ(k,point.x,point.y,point.z);}
    const hull=new T.Mesh(geometry,material);hull.name=`Smooth_pressure_envelope_${side}`;hull.castShadow=hull.receiveShadow=true;parent.add(hull);
  }

  root.updateMatrixWorld(true);const point=new T.Vector3();let projected=0;
  root.traverse(object=>{
    if(!object.isMesh||object.name.startsWith('Smooth_pressure_envelope_')||object.name.startsWith('Tail_attachment_shell_'))return;
    let shell=false;for(let parent=object.parent;parent;parent=parent.parent)if(parent.name==='Port_shell'||parent.name==='Starboard_shell')shell=true;
    if(!shell||/Dorsal|Roof_mission/.test(object.name))return;
    const inverse=object.matrixWorld.clone().invert(),positions=object.geometry.attributes.position;let changed=false;
    for(let i=0;i<positions.count;i++) {
      point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
      if(point.x>=130) {
        point.z*=1.16;point.applyMatrix4(inverse);positions.setXYZ(i,point.x,point.y,point.z);changed=true;continue;
      }
      if(point.y>=51)continue;
      const width=saucerWidth(point.x,point.y),side=Math.sign(point.z)||1;
      if(point.x>-202&&width>3) {
        const gap=T.MathUtils.clamp(Math.abs(point.z)-exteriorWidth(point.x,point.y),.22,1.1);
        point.z=side*(width+gap);projected++;
      } else neckPoint(point);
      point.applyMatrix4(inverse);positions.setXYZ(i,point.x,point.y,point.z);changed=true;
    }
    if(changed){object.geometry.computeVertexNormals();object.geometry.computeBoundingBox();object.geometry.computeBoundingSphere();}
  });
  // The continuous rim makes the long saucer read as one separate volume.
  const rimMaterial=new T.MeshStandardMaterial({name:'LEO_saucer_rim_alloy',color:0x667585,roughness:.4,metalness:.6});
  const rimDark=new T.MeshStandardMaterial({name:'LEO_saucer_lower_rim',color:0x172435,roughness:.62,metalness:.22});
  for(const [y,material,radius] of [[-16,rimMaterial,.24],[-29,rimDark,.16]]) {
    const rear=profile(y,2),front=frontAtLevel(y),points=[];
    for(const side of [1,-1])for(let i=0;i<=220;i++) {
      const u=side>0?i/220:1-i/220,x=T.MathUtils.lerp(rear+.03,front-.03,u);
      points.push(new T.Vector3(x,bowHeight(x,y),side*(saucerWidth(x,y)+.2)));
    }
    const curve=new T.CatmullRomCurve3(points,true,'centripetal');
    const mesh=new T.Mesh(new T.TubeGeometry(curve,900,radius,5,true),material);mesh.name='Elongated_saucer_perimeter_rim';root.add(mesh);
  }
  const joinWidth=saucerWidth(-140,-25);
  if(!(joinWidth>43&&saucerWidth(0,-25)>100))throw new Error('Saucer must overlap the narrow tail attachment');
  root.userData.saucer={bodyLength:502,bodySpan:208,tailAttachmentSpan:86,projectedDetailVertices:projected,description:'Elongated lenticular body with a rounded rear edge around a narrow inserted tail spine'};
  // The earlier curvature comparison described the superseded blended body.
  delete root.userData.tailFairing;
}
