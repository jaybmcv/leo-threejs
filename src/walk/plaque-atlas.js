import * as T from 'three';

// The deck plaques by the lift landings (signs.js) have a picture each, so each deck's plaques drew on their own: the open
// atrium shows fifteen decks, 15 draws. Here they share one sheet, copied cell by cell from their own pictures, which
// stay to be painted again once the brand fonts are in (each repaint is copied over), so main's per-band merge and
// src/v2/phone-bands.js draw every deck's plaques at once. Desktops only: a phone's pictures shrink to a size limit
// (src/v2/phone-memory.js), which would blur a whole sheet. Call before the per-band merge. Returns a proof or null.
const CELL_W=256,CELL_H=320,COLUMNS=8;
export function sharePlaques(group){
 const meshes=[];group.traverse(o=>{const image=o.material?.map?.image;if(o.isMesh&&o.material.name==='Walk_deck_plaque'&&image?.width===CELL_W&&image.height===CELL_H)meshes.push(o);});
 const pictures=[...new Set(meshes.map(o=>o.material.map))];if(pictures.length<2)return null;
 const canvas=document.createElement('canvas');canvas.width=Math.min(pictures.length,COLUMNS)*CELL_W;canvas.height=Math.ceil(pictures.length/COLUMNS)*CELL_H;
 const c=canvas.getContext('2d'),sheet=new T.CanvasTexture(canvas);sheet.colorSpace=pictures[0].colorSpace;sheet.anisotropy=pictures[0].anisotropy;
 const material=meshes[0].material.clone();material.map=sheet;
 const cell=new Map(pictures.map((p,i)=>[p,[i%COLUMNS*CELL_W,Math.floor(i/COLUMNS)*CELL_H]]));
 const copy=p=>{const [x,y]=cell.get(p);c.clearRect(x,y,CELL_W,CELL_H);c.drawImage(p.image,x,y);sheet.needsUpdate=true;};
 // A plaque's own picture is no longer drawn: its repaint (signs.js sets needsUpdate) is copied into the sheet instead.
 for(const p of pictures){copy(p);Object.defineProperty(p,'needsUpdate',{configurable:true,set(v){if(v)copy(p);}});}
 const moved=new Set();
 for(const o of meshes){const g=o.geometry,[x,y]=cell.get(o.material.map),uv=g.attributes.uv;
  if(!moved.has(g)){moved.add(g);for(let i=0;i<uv.count;i++)uv.setXY(i,(x+uv.getX(i)*CELL_W)/canvas.width,1-(y+(1-uv.getY(i))*CELL_H)/canvas.height);uv.needsUpdate=true;}
  o.material=material;}
 return {pictures:pictures.length,plaques:meshes.length,size:[canvas.width,canvas.height]};
}
