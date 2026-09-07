import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { frontPoint, WINDOW_ROWS } from './base/hull-profile.js';
import { exteriorWidth } from './base/exterior-profile.js';
import { bowHeight } from './base/diagonal-profile.js';

/** Small, surface-following details added before the shared assembly deformation. */
export function addSurfaceDetails(root) {
  const ceramic=new T.MeshStandardMaterial({name:'LEO_service_panel_ceramic',color:0xc2cad1,roughness:.56,metalness:.22});
  const seam=new T.MeshStandardMaterial({name:'LEO_precision_panel_seams',color:0x5d6b79,roughness:.65,metalness:.3});
  const alloy=new T.MeshStandardMaterial({name:'LEO_window_frame_alloy',color:0x8996a2,roughness:.32,metalness:.7});
  const recess=new T.MeshStandardMaterial({name:'LEO_engine_vent_recess',color:0x0c131b,roughness:.85});
  const amber=new T.MeshStandardMaterial({name:'LEO_amber_guide_lamps',color:0xe6bc76,emissive:0xe2a759,emissiveIntensity:.7,roughness:.35});
  const batches=new Map();
  function collect(parent,name,geometry,material) {
    const key=parent.uuid+name;
    if(!batches.has(key))batches.set(key,{parent,name,material,geometries:[]});
    batches.get(key).geometries.push(geometry);
  }
  function line(parent,name,points,radius,material) {
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal');
    collect(parent,name,new T.TubeGeometry(curve,Math.max(4,points.length*2),radius,5,false),material);
  }
  function box(parent,name,size,position,material) {collect(parent,name,new T.BoxGeometry(...size).translate(...position),material);}
  for(const side of [-1,1]) {
    const shell=root.getObjectByName(side>0?'Starboard_shell':'Port_shell');
    const sidePoint=(x,y,offset=.44)=>[x,y,side*(exteriorWidth(x,y)+offset)];
    // Short guide lights along the thermal belt; deliberately sparse at this scale.
    for(let x=-242;x<174;x+=23)line(shell,'Recessed_amber_hull_guides',Array.from({length:5},(_,i)=>sidePoint(x+i*.7,-16,.55)),.105,amber);
    for(let angle=.12;angle<1.55;angle+=.16)line(shell,'Recessed_amber_bow_guides',Array.from({length:5},(_,i)=>frontPoint(-16,angle+i*.008,side,.48)),.105,amber);
    // Larger chamfered access plates on the lower forward cheeks.
    for(const [x0,x1,y0,y1] of [[142,162,-6,2],[167,185,-8,-1],[32,49,25,29]]) {
      const positions=[],indices=[],nx=12,ny=8;
      for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++) {
        const y=T.MathUtils.lerp(y0,y1,j/ny),trim=Math.max(0,.8-Math.min(y-y0,y1-y));
        positions.push(...sidePoint(T.MathUtils.lerp(x0+trim,x1-trim,i/nx),y,.42));
      }
      for(let i=0;i<nx;i++)for(let j=0;j<ny;j++) {const a=i*(ny+1)+j,b=a+ny+1;indices.push(...(side>0?[a,b,a+1,b,b+1,a+1]:[a,a+1,b,b,a+1,b+1]));}
      const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      collect(shell,'Chamfered_forward_service_panels',geometry,ceramic);
      const boundary=[[x0+.8,y0],[x1-.8,y0],[x1,y0+.8],[x1,y1-.8],[x1-.8,y1],[x0+.8,y1],[x0,y1-.8],[x0,y0+.8],[x0+.8,y0]],points=[];
      for(let i=0;i<boundary.length-1;i++)for(let k=0;k<8;k++)points.push(sidePoint(T.MathUtils.lerp(boundary[i][0],boundary[i+1][0],k/8),T.MathUtils.lerp(boundary[i][1],boundary[i+1][1],k/8),.55));
      points.push(points[0]);line(shell,'Chamfered_service_panel_gaskets',points,.09,seam);
      for(const x of [x0+2,x1-2])for(const y of [y0+1.4,y1-1.4])line(shell,'Service_panel_fasteners',[sidePoint(x-.23,y,.62),sidePoint(x+.23,y,.62)],.1,alloy);
    }
    // Fine lower window sills emphasize individual panes without thickening the glass.
    for(const row of WINDOW_ROWS)for(let i=0;i<row.panesPerSide;i++) {
      const a0=i/row.panesPerSide*row.arc+.024,a1=(i+1)/row.panesPerSide*row.arc-.024;
      line(shell,'Observation_window_lower_sills',Array.from({length:13},(_,k)=>frontPoint(row.bottom+.12,T.MathUtils.lerp(a0,a1,k/12),side,.77)),.095,alloy);
    }
    const pod=root.getObjectByName(side>0?'Starboard_nacelle':'Port_nacelle'),zc=side*129.75;
    box(pod,'Recessed_engine_heat_exchanger',[.35,9,23],[-292.24,14.5,zc],recess);
    for(let j=0;j<6;j++)box(pod,'Engine_heat_exchanger_louvers',[.48,.42,21],[-292.5,10.6+j*1.55,zc],alloy);
    for(let z of [-12,12])box(pod,'Engine_vent_surround',[.6,10,.5],[-292.45,14.5,zc+z],alloy);
    for(let z of [-8,8])box(pod,'Engine_service_amber_markers',[.7,.65,2.4],[-292.7,21,zc+z],amber);
  }
  const fixed=root.getObjectByName('Wings_engines_tail');
  for(const x of [-7,49])for(const side of [-1,1]) {
    const z=side*1.7;
    line(fixed,'Dorsal_communications_masts',[[x,54,z],[x-.3,59,z],[x-1.2,65+(side>0?2:0),z]],.2,alloy);
    box(fixed,'Communications_mast_socket',[3,1.1,2.4],[x,54.4,z],seam);
  }
  for(const {parent,name,geometries,material} of batches.values()) {
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    if(!geometry)throw new Error(`Cannot merge detail: ${name}`);
    if(parent.name==='Port_shell'||parent.name==='Starboard_shell') {
      const positions=geometry.attributes.position;
      for(let i=0;i<positions.count;i++)positions.setY(i,bowHeight(positions.getX(i),positions.getY(i)));
      geometry.computeVertexNormals();
    }
    const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=false;parent.add(mesh);
  }
}
