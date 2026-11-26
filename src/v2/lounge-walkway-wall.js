import * as T from 'three';
import {mesh} from './geometry.js';
import {LOUNGE_MURAL_X} from '../plan/lounge-layout-v2.js';

// Report #427: a plain matte black wall under the open-floor edge of the lounge's Deck 18 walkway (commons-1-rear-4),
// from the Deck 17 floor to the walkway's underside and from the mural face to the hall wall (x -88).
// Jay (2026-11-24): it stops at the waterfall pond's rim on each side, and the causeway through the falls is the way
// between the open floor and the lounge. `pond` is that opening: the fitted pond's rim stones and the leaves on them reach
// x -103.30 to -96.10 on this line (after #426 moved it toward the hall) (scripts/check-lounge-walkway-wall-v2.mjs holds the wall to the pond as it is built).
// Where the Terpene Tasting Deck's back bar crosses the line (x -129 to -127.65) the wall meets it; the bar stays put.
export const LOUNGE_WALKWAY_WALL={gallery:'commons-1-rear-4',from:LOUNGE_MURAL_X,to:-88,pond:[-103.33,-96.07],inset:.01,thickness:.1,foot:.05,top:.04};

// The walkway's open-floor edge: the most outboard (lowest z) vertex of the gallery at each x. Past the
// slab's ends it runs straight on to the end walls.
export function loungeWalkwayWallLine(r){
 const w=LOUNGE_WALKWAY_WALL,g=r?.components?.galleries?.find(g=>g.id===w.gallery);if(!g)return null;
 const byX=new Map();for(const [x,z] of g.polygon){const k=Math.round(x*1000)/1000;byX.set(k,Math.min(byX.get(k)??Infinity,z));}
 const line=[...byX].sort((a,b)=>b[0]-a[0]);
 if(line[0][0]<w.to)line.unshift([w.to,line[0][1]]);if(line.at(-1)[0]>w.from)line.push([w.from,line.at(-1)[1]]);
 return {line,y:r.y,underside:g.center[1]-g.size[1]};
}

// z of the edge at x, by straight runs between the line's vertices.
export function loungeWalkwayEdgeZ(line,x){
 for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i];if(x<=a[0]&&x>=b[0])return a[0]===b[0]?Math.min(a[1],b[1]):a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}
 return null;
}

// The two runs, each a list of [x,z] points along the edge, cut at the pond.
export function loungeWalkwayWallRuns(line){
 const w=LOUNGE_WALKWAY_WALL,[p0,p1]=w.pond,cut=(x0,x1)=>{const pts=[[x1,loungeWalkwayEdgeZ(line,x1)]];for(const p of line)if(p[0]<x1-1e-6&&p[0]>x0+1e-6)pts.push(p);pts.push([x0,loungeWalkwayEdgeZ(line,x0)]);return pts;};
 return [cut(p1,w.to),cut(w.from,p0)];
}

let material;
export function loungeWalkwayWallMaterial(){return material??=new T.MeshStandardMaterial({name:'Lounge_walkway_wall_black',color:0x0b0b0d,roughness:.92,metalness:0});}

// One strip per run: the open-floor face sits `inset` behind the slab's edge face, so the two never share a plane. The foot
// goes into the deck slab and the top into the walkway slab, so neither has a face flush on a floor or an underside (the
// coplanar-finish rule). Ends against the synthwave and hall walls have no cap (they would be coplanar with those walls);
// the ends at the pond are capped.
export function loungeWalkwayWallGeometry(r){
 const plan=loungeWalkwayWallLine(r);if(!plan)return null;
 const w=LOUNGE_WALKWAY_WALL,y0=plan.y-w.foot,y1=plan.underside+w.top,pos=[];
 // Wound a,c,b / a,d,c so each listed face points away from the wall (checked in scripts/check-lounge-walkway-wall-v2.mjs).
 const quad=(a,b,c,d)=>pos.push(...a,...c,...b,...a,...d,...c);
 for(const run of loungeWalkwayWallRuns(plan.line)){
  // Inward normals (toward the slab, +z side) per vertex, mitred between neighbouring runs.
  const normal=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),n=[-dz/l,dx/l];return n[1]<0?[-n[0],-n[1]]:n;};
  const seg=run.slice(1).map((b,i)=>normal(run[i],b));
  const off=run.map((p,i)=>{const a=seg[Math.max(0,i-1)],b=seg[Math.min(seg.length-1,i)],m=[a[0]+b[0],a[1]+b[1]],l=Math.hypot(...m),u=[m[0]/l,m[1]/l],k=1/Math.max(.5,u[0]*b[0]+u[1]*b[1]);return [u[0]*k,u[1]*k];});
  const front=run.map((p,i)=>[p[0]+off[i][0]*w.inset,p[1]+off[i][1]*w.inset]),back=run.map((p,i)=>[p[0]+off[i][0]*(w.inset+w.thickness),p[1]+off[i][1]*(w.inset+w.thickness)]);
  for(let i=1;i<run.length;i++){
   const f0=front[i-1],f1=front[i],b0=back[i-1],b1=back[i];
   // Each run goes toward -x: open-floor face, lounge face, then the top.
   quad([f0[0],y0,f0[1]],[f0[0],y1,f0[1]],[f1[0],y1,f1[1]],[f1[0],y0,f1[1]]);
   quad([b1[0],y0,b1[1]],[b1[0],y1,b1[1]],[b0[0],y1,b0[1]],[b0[0],y0,b0[1]]);
   quad([f0[0],y1,f0[1]],[b0[0],y1,b0[1]],[b1[0],y1,b1[1]],[f1[0],y1,f1[1]]);
  }
  for(const [i,sign] of [[0,1],[run.length-1,-1]]){const x=run[i][0];if(Math.abs(x-w.to)<1e-6||Math.abs(x-w.from)<1e-6)continue;
   const f=front[i],b=back[i];
   if(sign>0)quad([b[0],y0,b[1]],[b[0],y1,b[1]],[f[0],y1,f[1]],[f[0],y0,f[1]]);else quad([f[0],y0,f[1]],[f[0],y1,f[1]],[b[0],y1,b[1]],[b[0],y0,b[1]]);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}

export function buildLoungeWalkwayWall(parent,r){
 if(r?.id!=='commons-1')return null;const g=loungeWalkwayWallGeometry(r);if(!g)return null;
 const o=mesh(parent,'Lounge_walkway_wall',g,loungeWalkwayWallMaterial());o.userData={...o.userData,room:'commons-1',v2Deck:17,role:'wall'};o.castShadow=o.receiveShadow=true;return o;
}
