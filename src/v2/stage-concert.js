import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Static concert dressing in the stage's Deck 6 frame. The deck, wall and seats belong to atrium-stage.js.
const STEEL=0x8d9da2,DARK=0x172129,GRILLE=0x34434b,OLIVE=0x697454,BEIGE=0xbca887;
const FLOOR=.36,EDGE=4.8,RIG_ROWS=[109,117.5];
export const stageConcertFixtures=()=>RIG_ROWS.flatMap((x,row)=>Array.from({length:27},(_,i)=>({id:`common-stage-${row}-${i}`,at:[x,3.86,19.6+i*.8],tilt:.22,direction:[-Math.sin(.22),-Math.cos(.22),0]})));
let parts;
export function stageConcertParts(){
 if(parts)return parts;
 parts=[];
 const box=(size,at,colour,extra={})=>parts.push({size,at,colour,...extra});
 const bar=(a,b,width=.09,colour=STEEL,extra={})=>parts.push({a,b,width,colour,...extra});
 // A shallow barrel roof, panelled underneath. Its entire outline stays inside the timber deck.
 const roof=z=>5.45+.65*(1-((z-30)/15.7)**2);
 for(let i=0;i<32;i++){
  const z0=14.3+i*31.4/32,z1=14.3+(i+1)*31.4/32,dy=roof(z1)-roof(z0),span=Math.hypot(z1-z0,dy),angle=Math.atan2(dy,z1-z0);
  box([13,.16,span],[113,(roof(z0)+roof(z1))/2+.08,(z0+z1)/2],0x7c898d,{tilt:-angle});
  for(let j=0;j<4;j++)box([3.235,.07,span-.012],[108.125+j*3.25,(roof(z0)+roof(z1))/2-.045,(z0+z1)/2], [0xb67d47,0xbf8450,0xad7441,0xb9804a][(i+j)%4],{tilt:-angle});
 }
 // The front and rear curved trusses carry the roof; two straight bars carry the fixture rows.
 for(const x of[108.9,119.1])for(let i=0;i<16;i++){
  const za=14.5+i*31/16,zb=za+31/16;
  for(const drop of[.12,.62])bar([x,roof(za)-drop,za],[x,roof(zb)-drop,zb],.11);
  bar([x,roof(za)-.12,za],[x,roof(zb)-.62,zb],.065);
  bar([x,roof(za)-.62,za],[x,roof(za)-.12,za],.065);
 }
 for(const z of[15.5,44.5])bar([106.9,5.25,z],[119.1,5.25,z],.15);
 for(const x of RIG_ROWS){
  for(const dx of[-.18,.18])for(const h of[4.16,4.66])bar([x+dx,h,15],[x+dx,h,45],.075);
  for(let z=15;z<45;z+=1.25){
   for(const dx of[-.18,.18])bar([x+dx,4.16,z],[x+dx,4.66,z+1.25],.05);
   bar([x-.18,4.66,z],[x+.18,4.66,z],.05);
  }
  for(const z of[15,22.5,30,37.5,45])bar([x,4.66,z],[x,roof(z)-.08,z],.08);
 }
 // Each fixture has a stable mount and down vector for a later beam pass. These lenses emit no light.
 for(const f of stageConcertFixtures()){
  box([.14,.28,.14],[f.at[0],4.02,f.at[2]],STEEL);
  box([.43,.46,.4],f.at,DARK,{roll:-f.tilt});
  const lens=[f.at[0]-.24*Math.sin(f.tilt),f.at[1]-.24*Math.cos(f.tilt),f.at[2]];
  box([.3,.018,.29],lens,0xe1cf9f,{roll:-f.tilt});
  for(const dz of[-.25,.25])box([.06,.46,.06],[f.at[0],3.95,f.at[2]+dz],GRILLE);
 }
 for(const side of[-1,1]){
  const z0=side<0?14:46-EDGE,zc=z0+EDGE/2,solid={solid:true,side};
  // Contiguous flight cases close the spaces between the pillars, stacks and platform edge.
  for(let i=0;i<6;i++){
   const x=107.6+i*2.2;
   box([2.2,.82,EDGE],[x,FLOOR+.41,zc],DARK,solid);
   box([2.14,.035,EDGE-.08],[x,FLOOR+.84,zc],GRILLE);
   for(const z of[z0+.08,z0+EDGE-.08])box([2.18,.055,.055],[x,FLOOR+.68,z],STEEL);
   box([.22,.1,.025],[x,FLOOR+.45,zc-side*(EDGE/2+.012)],STEEL);
  }
  // Four corner V pairs only. Their feet sit among the cases, with no narrow passage behind them.
  for(const x of[107.7,118.3]){
   const z=30+side*14.5;
   box([.85,.12,.85],[x,FLOOR+.06,z],STEEL,solid);
   for(const dx of[-.8,.8])bar([x,FLOOR+.12,z],[x+dx,5.25,z],.3,STEEL,solid);
   bar([x-.8,5.25,z],[x+.8,5.25,z],.22);
  }
  for(const [i,x]of[109,112.1,115.2,118.1].entries()){
   const h=[1.45,2.15,1.85,1.3][i],z=zc-side*.35;
   box([2.35,h,3.2],[x,FLOOR+.85+h/2,z],i%2?GRILLE:DARK,solid);
   // Recessed rack fronts, amplifier grilles, handles and blank controls; no logos or textures.
   for(let k=0;k<4;k++){
    box([.035,.18,2.7],[x-1.19,FLOOR+1.03+k*(h-.3)/4,z],DARK);
    for(const dz of[-1.2,1.2])box([.06,.075,.16],[x-1.22,FLOOR+1.1+k*(h-.3)/4,z+dz],STEEL);
   }
   if(i===1||i===3){
    // Uneven folded canvas over the top and outer side, leaving the equipment face partly exposed.
    const colour=i===1?OLIVE:BEIGE,top=FLOOR+.85+h;
    for(let k=0;k<6;k++){
     const zc1=z-1.65+(k+.5)*.55,fold=k%2?.035:-.025;
     box([2.44,.08,.56],[x+.06,top+.075+fold,zc1],colour,{roll:k%2?.025:-.025});
     box([.08,.72+(k%3)*.12,.56],[x+1.24,top-.28+fold,zc1],colour);
    }
   }
  }
  // Compact floor stacks at the audience end of each side island.
  for(let k=0;k<2;k++){
   const x=107.7,z=zc-side*1.2,h=FLOOR+.85+.44+k*.88;
   box([1.65,.84,1.7],[x,h,z],DARK,solid);
   box([.035,.69,1.5],[x-.84,h,z],GRILLE);
   for(const dz of[-.43,.43])box([.045,.53,.035],[x-.865,h,z+dz],DARK);
  }
  // Six splayed line-array boxes per side, suspended above the cat's head.
  const z=30+side*10.8;
  for(const dz of[-.5,.5]){
   bar([109,4.66,z+dz],[108.6,4.66,z+dz],.055);
   bar([108.6,4.66,z+dz],[108.6,4.35,z+dz],.055);
  }
  for(let i=0;i<6;i++){
   const roll=-.03-i*.055,x=108.6+.022*i*i,h=4.2-i*.29;
   box([.85,.265,1.5],[x,h,z],DARK,{roll});
   box([.025,.21,1.37],[x-.43,h+.43*Math.sin(-roll),z],GRILLE,{roll});
  }
 }
 return parts;
}
export function stageConcertGeometry(p){
 if(p.a){const a=new T.Vector3(...p.a),b=new T.Vector3(...p.b),delta=b.clone().sub(a);return new T.BoxGeometry(p.width,delta.length(),p.width).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize())).translate(...a.add(b).multiplyScalar(.5).toArray());}
 return new T.BoxGeometry(...p.size).rotateX(p.tilt||0).rotateZ(p.roll||0).translate(...p.at);
}
export function stageConcertCollider(side){
 const geos=stageConcertParts().filter(p=>p.solid&&p.side===side).map(stageConcertGeometry),g=mergeGeometries(geos);geos.forEach(g=>g.dispose());return g;
}
export function addStageConcertDecor(out,y){
 for(const p of stageConcertParts()){
  const source=stageConcertGeometry(p),g=source.toNonIndexed().translate(0,y,0),c=new T.Color(p.colour),col=new Float32Array(g.attributes.position.count*3);source.dispose();
  for(let i=0;i<col.length;i+=3)c.toArray(col,i);
  g.setAttribute('color',new T.BufferAttribute(col,3));out.push(g);
 }
}
