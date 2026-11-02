// Prepared static bands and instance groups are immutable after startup. Movers
// (doors, lift cars and gates) carry every runtime collision transform change.
// Reuse only an exactly identical visibility query state; no spatial rounding.
export function visibilityState(){let previous=null;return(camera,p,low,high,col)=>{const next=[...camera.matrixWorld.elements,...camera.projectionMatrix.elements,p.x,p.y,p.z,low,high,col.bands.size,col.groups.length,col.movers.length];for(const[b,r]of col.bands)next.push(b,r.bvh);for(const g of col.groups)next.push(g,g.bvh,g.items,g.items.length);for(const m of col.movers)next.push(m,m.enabled,...m.matrix.elements);const changed=!previous||next.length!==previous.length||next.some((v,i)=>v!==previous[i]);previous=next;return changed;};}
