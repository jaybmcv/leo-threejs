import * as T from 'three';
import layout from 'v2-layout';
import {polygonGeometry} from './geometry.js';
import {rectangle} from '../plan/geometry-v2.js';
import {facadeVolumeMasks} from './facade.js';
import {retireLegacySkinGeometry} from './skin-retirement.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function createHaze(ship,{authority=null}={}){
 // Reuse the real, holed and skin-clipped plates before the render bake releases their source buffers.
 const geos=layout.decks.map(d=>{const slab=ship?.decks?.[d.number-1]?.getObjectByName('Deck_slab');if(slab?.geometry.attributes.position.count){slab.updateWorldMatrix(true,false);return slab.geometry.clone().applyMatrix4(slab.matrixWorld);}const holes=[...d.slab.holes.map(h=>h.polygon),...layout.cabins.filter(c=>c.deck===d.number).map(c=>c.hullPrototype?c.hullPrototype.polygon:rectangle(c.x,c.z,3.18,7.4,c.yaw)),...layout.hullPrototypes.prototypes.filter(p=>p.deck===d.number&&p.kind!=='cabin').map(p=>p.polygon),...layout.shuttles.filter(s=>s.deck===d.number).map(s=>s.polygon)];return polygonGeometry(d.slab.outline,holes,d.y,.2);});
 const roof=layout.decks.at(-1);geos.push(polygonGeometry(roof.slab.outline,facadeVolumeMasks(roof.y+3.62,roof.y+3.72),roof.y+3.72,.1));
 // The real hull closes every outside edge; no inset proxy side wall is needed.
 const o=new T.Mesh(mergeGeometries(geos),new T.MeshBasicMaterial({name:'V2_haze',color:0xd9dcd6,side:T.DoubleSide}));o.name='Walk_haze';o.frustumCulled=false;o.userData.noCollide=true;geos.forEach(g=>g.dispose());
 if(ship?.exterior||authority)retireLegacySkinGeometry(ship||{},layout,{root:o,authority,actors:false});return o;
}
