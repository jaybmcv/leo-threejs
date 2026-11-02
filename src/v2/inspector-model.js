import * as T from 'three';

// The inspector consumes the published GLB, never a second procedural reconstruction.
// Motion uses its persistent room/cabin owners, including Meshopt-reordered batches.
export function motionFor(layout, id, point, exterior = false, name = '') {
  if (exterior) return [point.z<0?-1:1, 0, 0, /Crown|Fin_panorama/.test(name) ? 4 : /Upright_tail_assembly|V34_fin_/.test(name) ? 3 : /Wings_engines_tail|V35_pod_|V32_engine_/.test(name) || Math.abs(point.z) > 90 ? 2 : 1];
  if(/Aft_crown/.test(name))return [0,19,0,4];
  if(/Aft_fin|V2_fin_guard/.test(name))return [0,19,0,3];
  if(/Aft_pods/.test(name))return [point.z<0?-1:1,0,0,2];
  const room = layout.byId.get(id);
  const polygon = room?.polygon;
  const x = polygon ? polygon.reduce((s,p)=>s+p[0],0)/polygon.length : point.x;
  const z = polygon ? polygon.reduce((s,p)=>s+p[1],0)/polygon.length : point.z;
  const deck = room?.deck || Math.max(1,Math.min(20,Math.floor((point.y+40)/4)+1));
  return [x, deck-1, z, /Deck_slab|corridor|distribution_ceiling|pressure_lining/i.test(name) ? 5 : 0];
}

export function prepareInspectorModel(root, layout, {exterior=false, amount={value:0}, selectedDeck={value:0}}={}) {
  layout.byId ??= new Map([...layout.rooms,...layout.cabins,...layout.shuttles].map(r=>[r.id,r]));
  root.updateMatrixWorld(true);
  // Keep triangles rigid across the centre seam. Moving their vertices by the
  // sign of Z would stretch roof and wing triangles across the open hull.
  if(exterior){
    const meshes=[];root.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh)meshes.push(o);});
    const v=new T.Vector3();
    for(const mesh of meshes){
      let names='';for(let p=mesh;p;p=p.parent)names+=' '+p.name;
      const g=mesh.geometry;if(/Fin_panorama|Upright_tail_assembly|V34_fin_/.test(names)||Array.isArray(mesh.material))continue;
      const pos=g.attributes.position,port=[],starboard=[],count=g.index?.count||pos.count;
      for(let i=0;i<count;i+=3){const ids=[0,1,2].map(k=>g.index?g.index.getX(i+k):i+k);let z=0;for(const j of ids)z+=v.fromBufferAttribute(pos,j).applyMatrix4(mesh.matrixWorld).z;(z<0?port:starboard).push(...ids);}
      if(!port.length||!starboard.length)continue;
      const half=ids=>{const h=new T.BufferGeometry();h.attributes={...g.attributes};h.setIndex(ids);h.boundingBox=new T.Box3();for(const i of ids)h.boundingBox.expandByPoint(v.fromBufferAttribute(pos,i));h.boundingSphere=h.boundingBox.getBoundingSphere(new T.Sphere());return h;};
      const twin=mesh.clone();twin.geometry=half(starboard);twin.userData.inspectorSide=1;mesh.geometry=half(port);mesh.userData.inspectorSide=-1;mesh.parent.add(twin);
    }
    root.updateMatrixWorld(true);
  }
  const records=[], materials=new Map(), point=new T.Vector3(), matrix=new T.Matrix4();
  function material(source, motion, attribute) {
    const key=source.uuid+'|'+(attribute?'attribute':motion.join(','));
    if(materials.has(key))return materials.get(key);
    const m=source.clone();
    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{leoAmount:amount,leoSelectedDeck:selectedDeck,leoMotion:{value:new T.Vector4(...motion)}});
      shader.vertexShader=`uniform float leoAmount; uniform vec4 leoMotion; varying float vLeoDeck; varying float vLeoKind; ${attribute?'attribute vec4 leoDisplay;':''}\n`+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>', `
        #include <project_vertex>
        vec4 motion = ${attribute?'leoDisplay':'leoMotion'};
        vec4 leoWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          leoWorld = instanceMatrix * leoWorld;
        #endif
        leoWorld = modelMatrix * leoWorld;
        float hull = smoothstep(0.0, .28, leoAmount);
        float rooms = smoothstep(.70, 1.0, leoAmount);
        vec3 displacement = vec3(0.0);
        if(motion.w == 1.0 || motion.w == 2.0) {
          displacement.y = -110.0*hull - 210.0*rooms;
          displacement.z = (motion.x < 0.0 ? -1.0 : 1.0) * (150.0*hull + (motion.w == 2.0 ? 110.0*smoothstep(.20,.46,leoAmount) : 0.0));
        } else if(motion.w == 3.0 || motion.w == 4.0) {
          displacement = vec3(-200.0,90.0,0.0)*smoothstep(.14,.42,leoAmount);
          if(motion.w == 4.0) displacement.y += 60.0*smoothstep(.30,.56,leoAmount);
        } else {
          displacement.y = (40.0+motion.y*16.0)*smoothstep(.14,.67,leoAmount);
          if(motion.w != 5.0) displacement.xz = vec2(motion.x+18.0,motion.z)*.6*rooms;
        }
        mvPosition += viewMatrix * vec4(displacement,0.0);
        gl_Position = projectionMatrix * mvPosition;
        vLeoDeck=motion.y+1.0; vLeoKind=motion.w;
      `);
      shader.fragmentShader='uniform float leoAmount; uniform float leoSelectedDeck; varying float vLeoDeck; varying float vLeoKind;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if(vLeoKind == 5.0 && leoAmount > .82) discard;
        if(leoSelectedDeck > 0.0 && abs(vLeoDeck-leoSelectedDeck) > .1) discard;
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        if(vLeoKind == 0.0){vec3 tint=vLeoDeck>=6.0&&vLeoDeck<=15.0?vec3(.64,.47,.79):vLeoDeck<=2.0?vec3(.77,.49,.23):vLeoDeck<=5.0?vec3(.29,.65,.51):vec3(.38,.64,.47);diffuseColor.rgb=mix(diffuseColor.rgb,tint,.45*smoothstep(.68,.9,leoAmount));}
      `);
    };
    m.customProgramCacheKey=()=>attribute?'leo-current-owner-motion-v1':'leo-current-part-motion-v1';
    materials.set(key,m);return m;
  }
  root.traverse(o=>{
    o.matrixAutoUpdate=false;
    if(!o.isMesh)return;
    let id, ancestorName=o.name;
    let deck;
    for(let p=o;p&&p!==root;p=p.parent){const candidate=p.userData.room||p.userData.id;if(!id&&layout.byId.has(candidate))id=candidate;deck??=p.userData.v2Deck||(/^Deck_/.test(p.name)?p.userData.number:null);ancestorName+=' '+p.name;}
    const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();if(!g.boundingSphere)g.computeBoundingSphere();
    if(o.isInstancedMesh&&!o.boundingBox)o.computeBoundingBox();
    const box=(o.isInstancedMesh?o.boundingBox:g.boundingBox).clone().applyMatrix4(o.matrixWorld),center=box.getCenter(new T.Vector3());
    const motion=motionFor(layout,id,center,exterior,ancestorName);
    if(exterior&&o.userData.inspectorSide)motion[0]=o.userData.inspectorSide;
    if(!exterior&&!id&&deck&&motion[3]!==3&&motion[3]!==4)motion[1]=deck-1;
    let attribute=null;
    const owners=g.getAttribute('_leo_owner');
    if(!exterior&&owners&&o.userData.ownerTable){
      const rows=new Float32Array(owners.count*4),table=o.userData.ownerTable.map(owner=>motionFor(layout,owner?.component||owner?.room,center,false,ancestorName));
      for(let i=0;i<owners.count;i++)rows.set(table[owners.getX(i)]||motion,i*4);
      // The exported batch has a single identity instance; vertex owners take priority.
      attribute=new T.BufferAttribute(rows,4);
    }else if(!exterior&&o.isInstancedMesh){
      const rows=new Float32Array(o.count*4);
      for(let i=0;i<o.count;i++){
        o.getMatrixAt(i,matrix);g.boundingBox.getCenter(point).applyMatrix4(matrix).applyMatrix4(o.matrixWorld);
        rows.set(motionFor(layout,o.userData.cabinIds?.[i]||o.userData.roomIds?.[i]||id,point,false,ancestorName),i*4);
      }
      attribute=new T.InstancedBufferAttribute(rows,4);
    }
    if(attribute){const copy=new T.BufferGeometry();copy.index=g.index;copy.attributes={...g.attributes};copy.morphAttributes=g.morphAttributes;copy.groups=g.groups;copy.boundingBox=g.boundingBox;copy.boundingSphere=g.boundingSphere;o.geometry=copy;copy.setAttribute('leoDisplay',attribute);}
    o.material=Array.isArray(o.material)?o.material.map(m=>material(m,motion,!!attribute)):material(o.material,motion,!!attribute);
    // Shader displacement can leave the original bounding sphere. The viewer does
    // explicit size/selection culling; GPU clipping still handles the viewport.
    o.frustumCulled=false;
    const scale=new T.Vector3().setFromMatrixScale(o.matrixWorld);
    records.push({mesh:o,box,center,radius:g.boundingSphere.radius*Math.max(...scale.toArray()),motion,attribute:!!attribute,owner:id,ceiling:/ceiling|roof/i.test(o.name),baseVisible:o.visible});
  });
  return {root,records,amount,selectedDeck,materials};
}
