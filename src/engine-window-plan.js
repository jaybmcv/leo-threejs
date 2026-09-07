// Shared exterior and inner acoustic-wall openings, in ship metres.
// Maintenance floors: central hall -11.7 m, side pods -19.7 m.
const row=(centres,floor,zone)=>centres.map(x=>({x0:x-1.7,x1:x+1.7,y0:floor+1.25,y1:floor+2.75,floor,zone}));
export const CENTRAL_ENGINE_WINDOWS=row([-270,-257,-245,-232,-224,-211,-202,-188],-11.7,'central-engine-maintenance');
export const POD_ENGINE_WINDOWS=row([-266,-259,-249,-237,-224,-215,-204,-196,-181],-19.7,'pod-engine-maintenance');
