import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ATRIUM_ZONES,ATRIUM_PROTOTYPE,phase6LakePolygon} from '../plan/atrium-v2.js';
import {polygonGeometry} from './geometry.js';
import {walkCanvas} from '../walk/canvas.js';
const rect=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const outsideRect=([x0,x1,z0,z1])=>[rect(-1000,x0,-1000,1000),rect(x1,1000,-1000,1000),rect(x0,x1,-1000,z0),rect(x0,x1,z1,1000)];
const cleanRing=ring=>{const p=ring.filter((b,i)=>!i||Math.hypot(b[0]-ring[i-1][0],b[1]-ring[i-1][1])>1e-8);if(p.length>1&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<1e-8)p.pop();return p.filter((b,i)=>{const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];return Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))>1e-8;});};
function colourGeometry(g,hex){const c=new T.Color(hex),n=g.attributes.position.count,a=new Float32Array(n*3);for(let i=0;i<n;i++)a.set([c.r,c.g,c.b],i*3);g.setAttribute('color',new T.BufferAttribute(a,3));return g;}
export const atriumFloorMaterial=new T.MeshStandardMaterial({name:'P6_atrium_paving',color:0xffffff,vertexColors:true,roughness:.8});
function keepFaces(g,test){const p=g.attributes.position,n=g.attributes.normal,out=[];for(let i=0;i<p.count;i+=3)if(test(n.getY(i),i,p))for(let k=0;k<3;k++)out.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));g.dispose();const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(out,3));result.computeVertexNormals();return result;}
export function atriumFloorGeometry(outline,holes,y,atriumOutline=outline){
 const zones=ATRIUM_ZONES.map(z=>z.id.endsWith('lake')?{...z,polygon:phase6LakePolygon(atriumOutline)}:z);
 // One underside and real perimeter. Coloured areas partition only the top face:
 // no duplicated internal vertical faces, coplanar finish sheets or buried slabs.
 const g=[colourGeometry(keepFaces(polygonGeometry(outline,holes,y),(ny,i,p)=>ny<.5&&![0,1,2].every(k=>Math.abs(p.getY(i+k)-y)<1e-4)),0xd9d3c4),
 colourGeometry(keepFaces(polygonGeometry(outline,[...holes,...zones.map(z=>z.polygon)],y,0),ny=>ny>.5),0xd9d3c4)];
 const indexed=holes.map(p=>({p,x0:Math.min(...p.map(q=>q[0])),x1:Math.max(...p.map(q=>q[0])),z0:Math.min(...p.map(q=>q[1])),z1:Math.max(...p.map(q=>q[1]))}));
 for(const z of zones){const[x0,x1,z0,z1]=z.bounds,cuts=indexed.filter(h=>h.x0<x1&&h.x1>x0&&h.z0<z1&&h.z1>z0).map(h=>h.p),top=y-(z.id.endsWith('lake')?ATRIUM_PROTOTYPE.waterDepth:0);
 g.push(colourGeometry(keepFaces((z.id.endsWith('lake')?polygonGeometry(z.polygon,cuts,top,0):polygonGeometry(outline,[...cuts,...outsideRect(z.bounds)],top,0)),ny=>ny>.5),z.colour));
 if(z.id.endsWith('lake')){const wall=keepFaces(polygonGeometry(z.polygon,cuts,y,ATRIUM_PROTOTYPE.waterDepth),(ny)=>Math.abs(ny)<.5);g.push(colourGeometry(wall,0xd9d3c4));}}
 const result=mergeGeometries(g);g.forEach(x=>x.dispose());return result;
}
let sky;
export function skyMaterial(){
 if(sky)return sky;
 const c=walkCanvas();if(!c)return new T.MeshBasicMaterial({name:'P6_sky_ceiling',color:0xb9dbeb,fog:false});
 c.width=1024;c.height=128;const g=c.getContext('2d'),gradient=g.createLinearGradient(0,0,0,128);gradient.addColorStop(0,'#85b9da');gradient.addColorStop(.48,'#c0e0ee');gradient.addColorStop(1,'#f0eee1');g.fillStyle=gradient;g.fillRect(0,0,1024,128);
 for(let i=0;i<16;i++){const x=(i*177+53)%1100-40,y=35+(i*37)%70;g.save();g.globalAlpha=.12+(i%3)*.035;g.fillStyle='#ffffff';g.beginPath();g.ellipse(x,y,70+(i%4)*19,10+(i%3)*4,-.05,0,Math.PI*2);g.fill();g.restore();}
 if(typeof c.data==='function')Object.defineProperty(c,'data',{value:undefined});
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;
 sky=new T.MeshBasicMaterial({name:'P6_sky_ceiling',map:texture,color:0xffffff,fog:false});return sky;
}
export function skyCeilingGeometry(layout){const d=layout.decks[19],g=polygonGeometry(cleanRing(d.atrium.outline),[],d.y+3.72,.08),p=g.attributes.position,uv=new Float32Array(p.count*2),xs=d.atrium.outline.map(q=>q[0]),lo=Math.min(...xs),hi=Math.max(...xs);for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)-lo)/(hi-lo);uv[i*2+1]=(p.getZ(i)+14)/28;}g.setAttribute('uv',new T.BufferAttribute(uv,2));return g;}
export function buildPhase6Water(ship,layout){
 const parent=ship.inside.getObjectByName('V2_structure'),y=layout.decks[5].y;
 const zone=ATRIUM_ZONES.find(z=>z.id==='atrium6-lake'),water=keepFaces(polygonGeometry(phase6LakePolygon(layout.decks[5].atrium.outline),[],y-.01,0),ny=>ny>.5);
 const o=new T.Mesh(water,new T.MeshStandardMaterial({name:'P6_lake_water',color:0x4f99a4,roughness:.18,metalness:.1,transparent:true,opacity:.76,side:T.DoubleSide,forceSinglePass:true}));
 o.name='P6_lake_water';o.userData={noCollide:true,v2Deck:6,room:'atrium6-lake',phase6:true,shallowDepth:.15};parent.add(o);return o;
}
