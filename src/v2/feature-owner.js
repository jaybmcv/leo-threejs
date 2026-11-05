// A room feature the feature fast lane can rebuild alone (scripts/fast-dressing-v2.mjs). The group and solid its create
// call returns carry its id (roomPatchOwner reads it), so its collision spans and model nodes are its own. The ledger
// records whether the call stayed detached: it added nothing to the ship and moved, replaced, recoloured or removed
// nothing already there. Only a detached call can be patched alone; the patch carries just what it returns.
const ledger=new Map();
export const featureLedger=()=>ledger;
const materialKey=m=>[m.uuid,m.visible,m.opacity,m.transparent,m.side,m.color?.getHex?.(),m.emissive?.getHex?.(),m.map?.uuid,m.version].join(':');
const userKey=o=>{try{return JSON.stringify(o.userData);}catch{return '?';}};
const signature=o=>[o.parent?.uuid,o.name,o.visible,o.position.x,o.position.y,o.position.z,o.quaternion.x,o.quaternion.y,o.quaternion.z,o.quaternion.w,o.scale.x,o.scale.y,o.scale.z,o.matrixAutoUpdate,o.matrix.elements.join(),
 o.geometry?.uuid,o.geometry&&Object.entries(o.geometry.attributes).map(([k,a])=>k+a.count+'v'+a.version).join(),o.geometry?.index?.count,o.count,o.instanceMatrix?.version,
 [].concat(o.material??[]).map(materialKey).join(),userKey(o)].join('|');
// deep: also hash every geometry's arrays, so writing into an existing mesh's vertices shows (the fast lane's own check).
const contents=root=>{const seen=new Set();let h=0x811c9dc5;root.traverse(o=>{for(const a of [...Object.values(o.geometry?.attributes||{}),o.geometry?.index,o.instanceMatrix].filter(Boolean)){if(seen.has(a.array))continue;seen.add(a.array);
 // Whole words where the array is aligned, then its trailing bytes (a Uint16 index's last half word).
 const b=a.array,aligned=b.byteOffset%4?0:b.byteLength>>2,w=new Uint32Array(b.buffer,b.byteOffset,aligned),tail=new Uint8Array(b.buffer,b.byteOffset+aligned*4,b.byteLength-aligned*4);
 for(let i=0;i<w.length;i++)h=Math.imul(h^w[i],16777619);for(let i=0;i<tail.length;i++)h=Math.imul(h^tail[i],16777619);}});return h>>>0;};
const tag=(o,id)=>{if(o&&!o.userData.fastFeature&&!o.userData.fastDressing)o.userData.fastFeature=id;};
export function feature(id,ship,create,{deep=false}={}){
 const before=new Map();ship.root.traverse(o=>before.set(o,signature(o)));const hash=deep?contents(ship.root):0;
 const result=create();
 const seen=new Set();let added=0,changed=0;
 ship.root.traverse(o=>{seen.add(o);if(!before.has(o))added++;else if(signature(o)!==before.get(o))changed++;});
 let removed=0;for(const o of before.keys())if(!seen.has(o))removed++;
 const roots=(result?.isObject3D?[result]:[result?.group,result?.solid,...(result?.groups||[])]).filter(Boolean);for(const r of roots)tag(r,id);
 let triangles=0;for(const r of roots)r.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;const n=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;triangles+=o.isInstancedMesh?n*o.count:n;});
 const rewritten=deep&&contents(ship.root)!==hash;
 ledger.set(id,{additive:added===0&&changed===0&&removed===0&&!rewritten,added,changed,removed,rewritten,returned:!!result,triangles});
 return result;
}
