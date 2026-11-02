import {createSkinAuthority} from '../plan/skin-clearance-v2.js';
// Derive containment from the finished web asset before any intentional walk cuts.
// In particular, opening the crown shaft changes winding at remote projection seams.
// The independent buffers in this authority must never follow those later mutations.
const canonical=new WeakMap(),proofs=new WeakMap();
export function captureFinishedSkinAuthority(ship){
 if(canonical.has(ship))return canonical.get(ship);
 if(ship.hullEnvelopesFitted)throw Error('Finished web skin authority must be captured before walk cuts');
 ship.root?.updateMatrixWorld(true);const authority=createSkinAuthority(ship.exterior);
 if(!authority.components.some(c=>c.name==='pressure'))throw Error('Finished web pressure skin missing');
 canonical.set(ship,authority);return authority;
}
export function finishedSkinAuthority(ship){
 const authority=canonical.get(ship);if(!authority)throw Error('Missing immutable finished web skin authority; prepare the exterior before fitting geometry');return authority;
}
export async function skinAuthorityProof(authority){
 if(proofs.has(authority))return proofs.get(authority);
 const hash=async a=>{const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');};
 const components=[];for(const c of [...authority.components].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
  const p=c.geometry.attributes.position.array,words=new Uint32Array(p.buffer,p.byteOffset,p.length),ix=c.geometry.index?.array,n=(ix?.length??p.length/3)/3,tuples=new Uint32Array(n*9),order=new Uint32Array(n),word=i=>words[i]===0x80000000?0:words[i];
  for(let t=0;t<n;t++){const v=[0,1,2].map(k=>(ix?ix[t*3+k]:t*3+k)*3);let first=0;for(let k=1;k<3;k++){for(let a=0;a<9;a++){const axis=a%3,corner=Math.floor(a/3),x=word(v[(k+corner)%3]+axis),y=word(v[(first+corner)%3]+axis);if(x===y)continue;if(x<y)first=k;break;}}for(let k=0;k<3;k++)for(let a=0;a<3;a++)tuples[t*9+k*3+a]=word(v[(first+k)%3]+a);order[t]=t;}
  order.sort((a,b)=>{for(let k=0;k<9;k++){const x=tuples[a*9+k],y=tuples[b*9+k];if(x!==y)return x-y;}return 0;});const sorted=new Uint32Array(n*9);for(let i=0;i<n;i++)sorted.set(tuples.subarray(order[i]*9,order[i]*9+9),i*9);
  components.push({name:c.name,triangles:n,orientedTrianglesSha256:await hash(sorted)});
 }

 const signature=await hash(new TextEncoder().encode(JSON.stringify(components))),proof={version:1,source:'finished-web-before-walk-cuts',method:'Exact Float32 world triangles, cyclic orientation canonicalized and sorted; duplicate faces retained and signed zero normalized. Independent of lossless index/vertex reordering.',signature,components};proofs.set(authority,proof);return proof;
}
export const finishedSkinAuthorityProof=ship=>skinAuthorityProof(finishedSkinAuthority(ship));
