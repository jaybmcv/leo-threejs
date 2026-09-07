import * as THREE from 'three';
import { createExterior } from './base/exterior.js';
import { hullAt } from './base/hull-profile.js';
import { exteriorWidth } from './base/exterior-profile.js';
import { addSurfaceDetails } from './surface-details.js';
import { applySurfaceFinish } from './finish.js';
import { smoothTailFairing } from './tail-fairing.js';
import { rebuildAsSaucer } from './saucer-hull.js';

/** Editable exterior in metres: +X forward, +Y up, +Z starboard.
 * Reuses the workspace's detailed LEO loft at its original 600 m length.
 */
export function createShuttle() {
  const root = new THREE.Group();
  root.name = 'LEO_reference_shuttle';
  const { exterior } = createExterior(root, { hullAt });
  exterior.name = 'LEO_600m_exterior';
  root.userData = {
    revision: 6,
    title: 'LEO — Mars Cats Voyage',
    units: 'metres', length: 600, span: 300,
    description: 'Concept exterior reconstructed from the supplied illustration. Capacity of 10,000 is an artwork specification, not a validated interior capacity.',
  };
  root.traverse(object => {
    if (!object.isMesh) return;
    // Subdivide lettering before projecting it across the hull's shoulder.
    // Large glyph triangles otherwise cut through the change in surface slope.
    if (['LEO_wordmark','Mission_identifier','Mission_brand'].includes(object.name)) {
      const source = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      const original = source.attributes.position.array,values=[];
      const distance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
      function split(a,b,c,depth=0) {
        const edges=[distance(a,b),distance(b,c),distance(c,a)],longest=Math.max(...edges);
        if(longest<=1.5**2||depth>=10) {values.push(...a,...b,...c);return;}
        if(edges[1]===longest) [a,b,c]=[b,c,a];else if(edges[2]===longest)[a,b,c]=[c,a,b];
        const middle=a.map((v,k)=>(v+b[k])/2);
        split(a,middle,c,depth+1);split(middle,b,c,depth+1);
      }
      for(let i=0;i<original.length;i+=9) split(Array.from(original.slice(i,i+3)),Array.from(original.slice(i+3,i+6)),Array.from(original.slice(i+6,i+9)));
      source.dispose();
      const side=object.rotation.y===0?1:-1;
      for(let i=0;i<values.length;i+=3) values[i+2]=exteriorWidth(object.position.x+side*values[i],object.position.y+values[i+1])+ .8-side*object.position.z;
      object.geometry.dispose(); object.geometry=new THREE.BufferGeometry();
      object.geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3)); object.geometry.computeVertexNormals();
    }
    object.geometry.normalizeNormals();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material.name.includes('Ceramic_satin')) material.color.set(0xd5d8dc);
      if (material.name.includes('Thermal_navy')) material.color.set(0x242c3b);
    }
  });
  addSurfaceDetails(root);
  refineExterior(root);
  smoothTailFairing(root);
  rebuildAsSaucer(root);
  applySurfaceFinish(root);
  return root;
}

// Apply the same continuous deformation to skin and surface details. All
// dimensions remain in metres, and the earlier shared model stays unchanged.
function refineExterior(root) {
  const smooth = THREE.MathUtils.smoothstep;
  const widthCache = new Map();
  function shoulderDelta(x,y) {
    const key = `${x}:${y}`;
    if(widthCache.has(key)) return widthCache.get(key);
    const weight=smooth(x,-165,-135)*(1-smooth(x,150,175))*smooth(y,-5,5)*(1-smooth(y,21,29));
    if(!weight) return 0;
    let averaged=0;
    for(const [dx,wx] of [[-4,.25],[0,.5],[4,.25]])
      for(const [dy,wy] of [[-4,1/16],[-2,4/16],[0,6/16],[2,4/16],[4,1/16]]) averaged+=exteriorWidth(x+dx,y+dy)*wx*wy;
    const delta=(averaged-exteriorWidth(x,y))*weight;
    widthCache.set(key,delta);return delta;
  }
  function roundedShoulder(x,y) {
    // Bilinear sampling keeps adjacent meshes coincident without per-vertex
    // evaluation of the complete pressure-hull loft.
    const ix=Math.floor(x/2)*2,iy=Math.floor(y/2)*2,fx=(x-ix)/2,fy=(y-iy)/2;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(shoulderDelta(ix,iy),shoulderDelta(ix+2,iy),fx),THREE.MathUtils.lerp(shoulderDelta(ix,iy+2),shoulderDelta(ix+2,iy+2),fx),fy);
  }
  root.updateMatrixWorld(true);
  const point=new THREE.Vector3();
  const coloredMaterials=new Map(),glassMaterials=new Map();
  const major=/^(Smooth_pressure_envelope_|Sculpted_nacelle_shell|Blended_double_delta|Wing_thermal_edge|Swept_cat_tail|Swept_tail_cap|Tail_root_dorsal_fairing|Contoured_aft_pressure_frame|Nacelle_exhaust_bulkhead)/;
  root.traverse(object=>{
    if(!object.isMesh) return;
    const ancestors=[];for(let parent=object.parent;parent;parent=parent.parent)ancestors.push(parent.name);
    const isTail=ancestors.includes('Upright_tail_assembly');
    const podName=ancestors.find(name=>name==='Starboard_nacelle'||name==='Port_nacelle');
    const isShell=ancestors.includes('Port_shell')||ancestors.includes('Starboard_shell');
    const inverse=object.matrixWorld.clone().invert(),positions=object.geometry.attributes.position;
    if(isTail||podName||isShell) {
      const pod=podName?root.getObjectByName(podName):null;
      const centreZ=pod?(podName==='Starboard_nacelle'?129.75:-129.75)+pod.position.z:0;
      for(let i=0;i<positions.count;i++) {
        point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
        if(isTail && point.y>32) point.y=32+(point.y-32)*.82;
        if(pod) {
          const x=point.x-pod.position.x;
          // Retain the lower mounting sill and the full 300 m span. Above it,
          // narrow the shoulders and start the descending roof farther aft.
          const upper=smooth(point.y,-30,12),fore=smooth(x,-268,-172);
          point.z=centreZ+(point.z-centreZ)*(1-.16*upper*(.45+.55*fore));
          point.y-=5.5*fore*upper*(1-smooth(x,-168,-135));
        }
        if(isShell && point.x>-165 && point.x<175 && point.y>-5 && point.y<29)
          point.z+=Math.sign(point.z)*roundedShoulder(point.x,point.y)*smooth(Math.abs(point.z),20,45);
        point.applyMatrix4(inverse); positions.setXYZ(i,point.x,point.y,point.z);
      }
      object.geometry.computeVertexNormals();object.geometry.computeBoundingBox();object.geometry.computeBoundingSphere();
    }
    const materials=Array.isArray(object.material)?object.material:[object.material];
    object.material=materials.map(material=>{
      if(material.name.includes('Observation_glass')) {
        if(!glassMaterials.has(material.uuid)) glassMaterials.set(material.uuid,new THREE.MeshPhysicalMaterial({
          name:'LEO_reflective_observation_glass',color:0x18364b,metalness:.5,roughness:.18,
          clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.65,side:THREE.DoubleSide,
        }));
        return glassMaterials.get(material.uuid);
      }
      if(material.name.includes('Recess')) {material.color.set(0x0b121d);material.roughness=.82;material.envMapIntensity=.25;}
      if(material.name.includes('Ceramic_access_panels')) material.color.set(0xbcc5cd);
      if(material.name.includes('Dorsal_service_covers')) material.color.set(0xc4cbd1);
      if(material.name.includes('Thermal_navy')) {material.roughness=.46;material.metalness=.3;}
      if(material.name.includes('Inhabited_windows')) {material.color.set(0xb0b5af);material.emissive.set(0xc9b889);material.emissiveIntensity=.38;}
      if(material.name.includes('Panel_reveal')) material.color.set(0x64727e);
      if(material.name.includes('Engine_idle_glow')) material.emissiveIntensity=1.1;
      if(major.test(object.name)) {
        if(!coloredMaterials.has(material.uuid)) {const clone=material.clone();clone.vertexColors=true;coloredMaterials.set(material.uuid,clone);}
        return coloredMaterials.get(material.uuid);
      }
      return material;
    });
    if(!Array.isArray(object.material)||object.material.length===1)object.material=object.material[0];
    if(major.test(object.name)) {
      const colors=new Float32Array(positions.count*3);
      for(let i=0;i<positions.count;i++) {
        point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
        const a=Math.floor((point.x+300)/26),b=Math.floor((point.y+55)/10),c=Math.floor(Math.abs(point.z)/17);
        const hash=Math.sin(a*127.1+b*311.7+c*74.7)*43758.5453;
        const value=.925+.075*(hash-Math.floor(hash));
        colors.set([value,value,value],i*3);
      }
      object.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    }
    object.castShadow=major.test(object.name);
    // Tiny surface-mounted geometry should not shadow the underlying skin.
    object.receiveShadow=major.test(object.name)||/panel|cover|hatch/i.test(object.name);
  });
  root.userData.refinements=['Rounded shoulder transitions','Tapered engine-pod shoulders','Tail height reduced above root by 18%','Subtle ceramic panel variation','Clear-coated observation glass'];
}
