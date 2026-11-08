// What the Detail menu sets on the desktop's merged drawing (main.public.js; ?deskbatch=low keeps the atrium geometry
// pack's own levels). In the open atrium the haze (atrium-visibility.js) is clear to the 450 m far plane: Balanced closes
// it in, and Performance brings it to the corridors' 148 m, where the fog cull (fog-cull.js) leaves out what is beyond.
// Performance also drops corner shading (corner-shade.js) and, from the next load, multisampled edges.
export const DETAIL=Object.freeze({
 high:Object.freeze({near:Infinity,far:Infinity,antialias:true,corner:true}),
 balanced:Object.freeze({near:110,far:250,antialias:true,corner:true}),
 performance:Object.freeze({near:70,far:148,antialias:false,corner:false}),
});
// Each frame after the atrium has set the fog, before drawing: brings the haze in to the level, never out.
export function closeHaze(fog,level){const d=DETAIL[level];fog.near=Math.min(fog.near,d.near);fog.far=Math.min(fog.far,d.far);}
