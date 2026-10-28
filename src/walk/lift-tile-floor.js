import * as T from 'three';
import {anchorObject} from '../plan/rooms.js';
import {COMMONS} from '../model.js';
import {canvasTexture,seeded} from '../polish-kit.js';

// Deck 19's lift lobby and promenade on foot, down to the end of the Hydro-Nip Lounge (from tester feedback): black
// ceramic diamond tile with fine light grout, laid just over the cream floor (the floor, its height and its colliders
// are unchanged). It runs from the aft lifts (x -138) along the promenade between its walls (z +-3.94) to the lounge's
// forward end, and on over the doorway bridge into the lounge (the lounge's own floor, lounge-floor.js, takes over
// from there). The Neighborhood 2 doorway across stays cream.
const C=COMMONS[0],X0=-138,X1=C.x+C.width/2,Y=32.3,LIFT=.007,HALF=3.94,BRIDGE=[-114.5,-110.5,-8];
// One texture period is a pair of rhombi in the lattice, [width, length] metres: tiles .6 across and 1.04 long. The
// texture is REPEAT x REPEAT periods, so the tile tones vary.
const PERIOD=[.6,1.04],REPEAT=2,PX=512;

// A rhombus with its long diagonal across the walk (z), drawn inset from its lattice cell so the grout shows between.
const diamond=(g,cx,cy,a,b,inset)=>{
 const apothem=a*b/Math.hypot(a,b),k=1-inset/apothem;
 g.beginPath();g.moveTo(cx,cy-b*k);g.lineTo(cx+a*k,cy);g.lineTo(cx,cy+b*k);g.lineTo(cx-a*k,cy);g.closePath();
};
const tile=()=>canvasTexture(PX*REPEAT,PX*REPEAT,(g,w,h)=>{
 const rnd=seeded(19),a=w/REPEAT/2,b=h/REPEAT/2;
 g.fillStyle='#8a867d';g.fillRect(0,0,w,h);
 // The lattice: a rhombus at every other grid point, each drawn once per neighbouring texture so the edges wrap.
 for(let i=0;i<REPEAT*2;i++)for(let j=0;j<REPEAT*2;j++){
  if((i+j)%2)continue;
  const cx=i*a,cy=j*b,tone=22+Math.floor(rnd()*10);
  for(const ox of [-w,0,w])for(const oy of [-h,0,h]){
   const x=cx+ox,y=cy+oy;if(x<-a||x>w+a||y<-b||y>h+b)continue;
   diamond(g,x,y,a,b,4);
   // Near black with a soft sheen across each tile, as a glaze catches the light.
   const sheen=g.createLinearGradient(x-a,y-b,x+a,y+b);
   sheen.addColorStop(0,`rgb(${tone+14},${tone+14},${tone+17})`);sheen.addColorStop(.55,`rgb(${tone},${tone},${tone+2})`);sheen.addColorStop(1,`rgb(${tone-8},${tone-8},${tone-6})`);
   g.fillStyle=sheen;g.fill();
   // A faint bevelled edge just inside the glaze.
   diamond(g,x,y,a,b,7.5);g.strokeStyle='rgba(255,255,255,.07)';g.lineWidth=1.5;g.stroke();
  }
 }
});

export function tileLiftFloor(ship){
 if(typeof document==='undefined')return null;
 const material=new T.MeshStandardMaterial({name:'Lift_lobby_black_tile',map:tile(),roughness:.62,metalness:0});
 // World-planar UVs: the texture covers REPEAT periods in x and z, so tiles run on unbroken across the pieces.
 const piece=(x0,x1,z0,z1,name)=>{
  const g=new T.PlaneGeometry(x1-x0,z1-z0).rotateX(-Math.PI/2).translate((x0+x1)/2,Y+LIFT,(z0+z1)/2),p=g.attributes.position,uv=new Float32Array(p.count*2);
  for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)/(PERIOD[0]*REPEAT);uv[i*2+1]=p.getZ(i)/(PERIOD[1]*REPEAT);}
  g.setAttribute('uv',new T.BufferAttribute(uv,2));
  const m=new T.Mesh(g,material);m.name=name;anchorObject(m,'circulation-19');ship.inside.add(m);return m;
 };
 piece(X0,X1,-HALF,HALF,'Lift_lobby_tile_floor');
 // The doorway bridge into the lounge, on the Neighborhood 1 (-z) side.
 piece(BRIDGE[0],BRIDGE[1],BRIDGE[2],-HALF,'Lift_lobby_tile_bridge');
 return {material};
}
