// Shared v2 fixture dimensions. These equal the original meshes; no geometry changes.
export const GYM_TREADMILL={xs:[-18,-10,-2,6,14,22],z:-10,size:[1.3,.22,2.6],centerY:.15};
export const ACTIVITY_FLOOR={size:[15,.03,9],center:[0,.025,0]};

// Client and server use the same activation rectangle, including approaches at its corners.
export function treadmillNear(p,m){
 const v=(p,k)=>Array.isArray(p)?p[k]:p['xyz'[k]],dx=v(p,0)-v(m.centre,0),dz=v(p,2)-v(m.centre,2),fx=v(m.front,0),fz=v(m.front,2);
 return Math.abs(v(p,1)-m.top)<1.2&&Math.abs(dx*fx+dz*fz)<m.length/2+1.5&&Math.abs(-dx*fz+dz*fx)<m.width/2+1.5;
}
