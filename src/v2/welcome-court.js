// Where the arrival lobby's welcome court stands (G1, drawn by atrium-lobby-park.js), and the night light round its
// lanterns (shown by atrium-mood.js). Plain numbers, so the walk can place that light without the drawing code.
const DEG=Math.PI/180;

// Centre of the court, 11 m from the arrival view (lobby-in) and 29° to its left, as in the concept.
export const WELCOME_COURT={x:-110,z:-5.5};
export const COURT_PLANTER_RING=4.6,COURT_LAMP_RING=5.3;
// The boulevard planters' size, so the court's join their batch (and their trims).
export const COURT_PLANTER=[2.4,.42,1.1];
// Eight planters 45° apart from 22.5°, all square to the ship (the trims are laid unrotated), as offsets from the centre.
export const COURT_PLANTERS=Array.from({length:8},(_,k)=>(22.5+k*45)*DEG).map(a=>[Math.cos(a)*COURT_PLANTER_RING,Math.sin(a)*COURT_PLANTER_RING]);
// Four lamp posts between the planters, on the diagonals, as offsets from the centre.
export const COURT_LAMPS=[45,135,225,315].map(a=>[Math.cos(a*DEG)*COURT_LAMP_RING,Math.sin(a*DEG)*COURT_LAMP_RING]);
// The middle of each lantern's glowing core, over the floor.
export const COURT_LANTERN_CORE=3.865;

// The night light, as soft squares facing out of the floor (pools), across each lantern (halos) and off the planters'
// long sides (uplights): a warm pool under each lamp; a faint halo round each lantern, three crossed upright squares so it
// reads from every side; two small uplights at the foot of each long side of every planter, their lower half under the
// floor, so each shows as a glow rising up the stone.
const POOL=3.6,HALO=1.3,UPLIGHT=.55,UPLIGHT_SPREAD=.6,PLANTER_FACE=COURT_PLANTER[2]/2+.015;

/** The court's night glows over a floor at y: {kind:'pool'|'halo'|'uplight', at:[x,y,z], size, tilt, turn}, a size-m
 * square in the x-y plane tilted about x then turned about y (radians). Pools first, then halos, then uplights. */
export function welcomeCourtGlows(y){
 const {x,z}=WELCOME_COURT,glows=[];
 for(const[dx,dz]of COURT_LAMPS)glows.push({kind:'pool',at:[x+dx,y+.02,z+dz],size:POOL,tilt:-Math.PI/2,turn:0});
 for(const[dx,dz]of COURT_LAMPS)for(const turn of[0,60,120])glows.push({kind:'halo',at:[x+dx,y+COURT_LANTERN_CORE,z+dz],size:HALO,tilt:0,turn:turn*DEG});
 for(const[dx,dz]of COURT_PLANTERS)for(const side of[-1,1])for(const along of[-1,1])
  glows.push({kind:'uplight',at:[x+dx+along*UPLIGHT_SPREAD,y+.03,z+dz+side*PLANTER_FACE],size:UPLIGHT,tilt:0,turn:0});
 return glows;
}
