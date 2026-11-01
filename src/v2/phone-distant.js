import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {publicAsset} from './public-assets.js';
export const PHONE_DISTANT_LIMITS={bytes:32*1024*1024,draws:32,hullTriangles:750000};
export function lightDistantPreset({phone=false,multiDraw=true}={}){return phone||multiDraw===false||(typeof window!=='undefined'&&typeof navigator!=='undefined'&&((navigator.deviceMemory||8)<=4||(navigator.hardwareConcurrency||8)<=4));}
export async function installPhoneDistant(ship,haze){
 const bytes=await publicAsset('leo-exterior-phone.glb')||await fetch(new URL('../leo-exterior-phone.glb',location.href)).then(r=>{if(!r.ok)throw Error('Phone hull unavailable');return r.arrayBuffer()});
 const loaded=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes,''),parts=[];let count=0;loaded.scene.updateMatrixWorld(true);
 loaded.scene.traverse(o=>{if(o.isMesh&&o.geometry?.attributes.position){parts.push(o);count+=o.geometry.index?.count||o.geometry.attributes.position.count;}});
 if(count/3>PHONE_DISTANT_LIMITS.hullTriangles)throw Error('Phone distant hull exceeds triangle gate');
 const positions=new Float32Array(count*3),colors=new Uint8Array(count*3),v=new T.Vector3();let at=0;
 for(const o of parts){const p=o.geometry.attributes.position,c=o.geometry.attributes.color,ix=o.geometry.index,m=Array.isArray(o.material)?o.material[0]:o.material,tint=m.color||new T.Color(0xd9dcd6),glass=m.transparent||m.opacity<1;for(let i=0;i<(ix?.count||p.count);i++){const j=ix?ix.getX(i):i;v.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld);positions[at]=v.x;positions[at+1]=v.y;positions[at+2]=v.z;for(let k=0;k<3;k++)colors[at+k]=Math.round(255*Math.min(1,glass?.63:[tint.r,tint.g,tint.b][k]*(c&&m.vertexColors?c.getComponent(j,k):1)));at+=3;}await new Promise(r=>setTimeout(r,0));}
 const root=new T.Group();root.name='V2_phone_distant_architecture';root.userData={noCollide:true,independentOfBands:true};
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('color',new T.BufferAttribute(colors,3,true));g.computeBoundingSphere();const mat=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}),o=new T.Mesh(g,mat);o.name='V2_phone_distant_hull';root.add(o);
 // The near pass retains clear glass. Only this >140m enclosure uses opaque distant glazing.
 let triangles=count/3;ship.facade?.traverse(o=>{if(!o.isMesh||!/^P6_(atrium_floor_actual|sky_ceiling|sky_tip|tower_architecture)$/.test(o.name)||o.material.transparent)return;o.updateWorldMatrix(true,false);const m=new T.MeshBasicMaterial({color:o.material.color||0xffffff,map:o.material.map||null,vertexColors:!!o.material.vertexColors,side:T.DoubleSide});const copy=new T.Mesh(o.geometry,m);copy.matrixAutoUpdate=false;copy.matrix.copy(o.matrixWorld);copy.userData.noCollide=true;root.add(copy);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
 const proof={preset:'phone-hull',asset:'leo-exterior-phone.glb',hullTriangles:count/3,triangles,bytes:positions.byteLength+colors.byteLength,draws:root.children.length+1,limits:PHONE_DISTANT_LIMITS};
 if(proof.bytes>PHONE_DISTANT_LIMITS.bytes||proof.draws>PHONE_DISTANT_LIMITS.draws)throw Error('Phone distant memory/draw gate failed');
 root.userData.proof=proof;haze.add(root);ship.v2DistantArchitecture=root;
 for(const o of parts)o.geometry.dispose();return root;
}
