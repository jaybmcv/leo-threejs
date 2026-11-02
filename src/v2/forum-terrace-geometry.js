import * as T from 'three';
import {polygonGeometry} from './geometry.js';

// The ship floor closes the underside. Adjacent tiers share only one riser,
// from the preceding tread height, rather than overlapping full-height boxes.
export function forumTerraceGeometry(terrace,y){
 const g=polygonGeometry(terrace.polygon,[],y+terrace.rise,0),p=g.attributes.position,n=g.attributes.normal,vertices=[];
 for(let i=0;i<p.count;i+=3)if(n.getY(i)>.9)for(let k=0;k<3;k++)vertices.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));g.dispose();
 const ring=terrace.polygon,N=81,quad=(a,b,low)=>{const A=[a[0],y+terrace.rise,a[1]],B=[b[0],y+terrace.rise,b[1]],C=[b[0],y+low,b[1]],D=[a[0],y+low,a[1]];vertices.push(...A,...B,...C,...A,...C,...D);};
 for(let i=0;i<ring.length;i++){if(i<N-1){if(terrace.tier===4)quad(ring[i],ring[i+1],0);}else if(i===N-1||i===ring.length-1)quad(ring[i],ring[(i+1)%ring.length],0);else quad(ring[i],ring[i+1],terrace.rise-.06);}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(vertices,3));out.computeVertexNormals();return out;
}
