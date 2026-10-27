import * as T from 'three';
import layout from 'v2-layout';
import {polygonGeometry} from './geometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function createHaze(){
 // Only the actual structural plates enter the distant pass. Atrium and assembly voids survive.
 const geos=layout.decks.map(d=>polygonGeometry(d.slab.outline,d.slab.holes.map(h=>h.polygon),d.y,.2));
 const roof=layout.decks.at(-1);geos.push(polygonGeometry(roof.slab.outline,[],roof.y+3.72,.1));
 const sides=[];for(const d of layout.decks){const p=d.slab.outline,y=d.y;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];sides.push(a[0],y-.5,a[1],b[0],y-.5,b[1],b[0],y+4.5,b[1],a[0],y-.5,a[1],b[0],y+4.5,b[1],a[0],y+4.5,a[1]);}}const side=new T.BufferGeometry();side.setAttribute('position',new T.Float32BufferAttribute(sides,3));side.computeVertexNormals();geos.push(side);
 const o=new T.Mesh(mergeGeometries(geos),new T.MeshBasicMaterial({name:'V2_haze',color:0xd9dcd6,side:T.DoubleSide}));o.name='Walk_haze';o.frustumCulled=false;geos.forEach(g=>g.dispose());return o;
}
