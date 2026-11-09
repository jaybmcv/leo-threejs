import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A lift's call light (signs.js callLight) is a 14 cm ring by its doors: about 100 on the ship, each its own draw (about
// 40 at the open atrium), as they change material when lit. Those on one deck band draw as one mesh holding both
// pictures, unlit and lit; a light's lit() rewrites its four vertices' lit value. The lights are children of `parent`
// (the lift signs, at the ship's origin); place(mesh,y) puts each merged mesh in its band. Returns how many merged.
export function mergeCallLights(parent,bandOf,place){
 const lists=new Map();
 for(const o of parent.children){if(!o.isMesh||!o.userData.callLight)continue;const band=bandOf(o.position.y);let l=lists.get(band);if(!l)lists.set(band,l=[]);l.push(o);}
 // The bands share one material per pair of pictures: three refreshes a material's uniforms whenever the next draw uses
 // another material object, so a copy per band cost a refresh per band for the same look.
 let merged=0;const shared=new Map();
 for(const list of lists.values()){
  if(list.length<2)continue;
  const materialOf=list[0].userData.callLight.material,off=materialOf(false),on=materialOf(true);
  const parts=list.map(o=>{o.updateMatrix();const g=o.geometry.clone().applyMatrix4(o.matrix);
   g.setAttribute('callLit',new T.BufferAttribute(new Float32Array(g.attributes.position.count).fill(o.material===on?1:0),1));return g;});
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;
  const lit=geometry.attributes.callLit;lit.setUsage(T.DynamicDrawUsage);
  // Drawn with the opaque parts (the pictures are cut out at alpha .5 and write depth either way): one band's lights
  // sorted as one transparent mesh could draw after a glass pane in front of one of them, untinted by it. Their soft
  // ring edges turn to multisample coverage instead of blending.
  const pair=shared.get(off)??shared.set(off,new Map()).get(off);let material=pair.get(on);
  if(!material){material=off.clone();material.name='Walk_call_lights';material.transparent=false;material.alphaToCoverage=true;
   material.onBeforeCompile=shader=>{shader.uniforms.litMap={value:on.map};
    shader.vertexShader='attribute float callLit;\nvarying float vCallLit;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n\tvCallLit=callLit;');
    shader.fragmentShader='uniform sampler2D litMap;\nvarying float vCallLit;\n'+shader.fragmentShader.replace('#include <map_fragment>','diffuseColor*=mix(texture2D(map,vMapUv),texture2D(litMap,vMapUv),vCallLit);');};
   material.customProgramCacheKey=()=>'walk-call-lights';pair.set(on,material);}
  const mesh=new T.Mesh(geometry,material);mesh.name='Walk_call_lights';mesh.userData={noCollide:true,renderOnly:true};
  let start=0;
  for(const o of list){
   const light=o.userData.callLight,from=start,count=o.geometry.attributes.position.count;let state=o.material===on;start+=count;
   light.lit=value=>{value=!!value;if(value===state)return;state=value;lit.array.fill(value?1:0,from,from+count);lit.addUpdateRange(from,count);lit.needsUpdate=true;};
   parent.remove(o);
  }
  place(mesh,list[0].position.y);merged+=list.length;
 }
 return merged;
}
