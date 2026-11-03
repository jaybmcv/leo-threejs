// The static instance grids are populated at construction/deserialization. Movers
// have their own live path. Keep the original group order and let the caller read
// each group's current cell contents and test its exact bounds.
const indexes=new WeakMap();
// Replacing keys without changing a Map's size needs explicit invalidation.
// Existing cell lists and each item's bounds are still read live by the caller.
export function invalidateCollisionCells(groups){indexes.delete(groups);}
export function collisionCellGroups(groups,keys){
 let index=indexes.get(groups);
 if(!index||index.rows.length!==groups.length||groups.some((g,i)=>{const r=index.rows[i];return r.group!==g||r.cells!==g.cells||r.size!==g.cells.size;})){
  const cells=new Map(),rows=[];
  groups.forEach((group,id)=>{rows.push({group,cells:group.cells,size:group.cells.size});for(const key of group.cells.keys()){let ids=cells.get(key);if(!ids)cells.set(key,ids=[]);ids.push(id);}});
  index={rows,cells};indexes.set(groups,index);
 }
 const ids=new Set();for(const key of keys)for(const id of index.cells.get(key)||[])ids.add(id);
 return [...ids].sort((a,b)=>a-b).map(id=>groups[id]);
}

// Very wide queries enumerate occupied cells instead of materializing an
// arbitrarily large 3D box. Numeric x/y/z order preserves near()'s hit order.
export function occupiedCollisionCellKeys(cells,box,size=8){
 const x0=Math.floor(box.min.x/size),y0=Math.floor(box.min.y/size),z0=Math.floor(box.min.z/size),x1=Math.floor(box.max.x/size),y1=Math.floor(box.max.y/size),z1=Math.floor(box.max.z/size);
 if([x0,y0,z0,x1,y1,z1].some(Number.isNaN))return [];
 const rows=[];
 for(const key of cells.keys()){const p=key.split(',').map(Number);if(p.length===3&&p.every(Number.isInteger)&&key===p.join(',')&&p[0]>=x0&&p[0]<=x1&&p[1]>=y0&&p[1]<=y1&&p[2]>=z0&&p[2]<=z1)rows.push({key,p});}
 rows.sort((a,b)=>a.p[0]-b.p[0]||a.p[1]-b.p[1]||a.p[2]-b.p[2]);return rows.map(r=>r.key);
}
