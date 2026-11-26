import * as T from 'three';

export const greenRoomMaterials={
 charcoal:{color:0x272431,roughness:.9,emissive:0x1d1a28,emissiveIntensity:.25},
 carpet:{color:0x164532,roughness:1,emissive:0x0b2015,emissiveIntensity:.22},
 mirror:{color:0x828499,roughness:.085,metalness:1,envMapIntensity:1.35},
 velvet:{color:0xba792a,roughness:.93,emissive:0x824416,emissiveIntensity:.22},
 lacquer:{color:0x171524,roughness:.34,metalness:.24},
 brass:{color:0xc39850,roughness:.33,metalness:.6},
 violet:{color:0x542451,roughness:.32,metalness:.25},
 jade:{color:0x16817a,roughness:.34,metalness:.28},
 fuchsia:{color:0xff579f,emissive:0xff2583,emissiveIntensity:1.8},
 mint:{color:0x75ffcf,emissive:0x32ffbb,emissiveIntensity:1.6},
 amber:{color:0xffc878,emissive:0xff8b39,emissiveIntensity:1.8},
};

const couchShape=(width,length)=>{
 const shape=new T.Shape(),sweep=t=>.48*Math.sin(Math.PI*t);
 for(const edge of [-1,1])for(let i=0;i<=24;i++){
  const t=edge*(1-i/12),x=sweep(t)+edge*width/2,z=t*length/2;
  if(edge===-1&&i===0)shape.moveTo(x,z);else shape.lineTo(x,z);
 }
 shape.closePath();
 return shape;
};
const guitarShape=()=>{
 const g=new T.Shape();
 g.moveTo(0,-.48);g.bezierCurveTo(-.66,-.48,-.60,-.04,-.37,.06);
 g.bezierCurveTo(-.26,.17,-.50,.39,-.28,.47);g.quadraticCurveTo(-.18,.4,-.11,.20);
 g.lineTo(.10,.19);g.quadraticCurveTo(.20,.42,.31,.37);
 g.bezierCurveTo(.48,.31,.25,.14,.41,.04);g.bezierCurveTo(.63,-.15,.52,-.48,0,-.48);g.closePath();
 return g;
};
export function greenRoomGeometry({part,size:[w,h,d]}){
 if(part==='green_room_carpet'||part==='green_room_ceiling_finish')return new T.PlaneGeometry(w,d).rotateX(part==='green_room_carpet'?-Math.PI/2:Math.PI/2);
 if(part==='green_room_wall_finish')return new T.PlaneGeometry(w,h);
 if(/^green_room_sofa_(seat_cushion|back)$/.test(part)){
  const bevel=Math.min(.085,h*.22),shape=couchShape(w-2*bevel,d-2*bevel);
  return new T.ExtrudeGeometry(shape,{depth:h-2*bevel,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,steps:1}).rotateX(Math.PI/2).translate(0,(h-2*bevel)/2,0);
 }
 if(part==='green_room_guitar_body')return new T.ExtrudeGeometry(guitarShape(),{depth:1,bevelEnabled:false,curveSegments:7}).translate(0,0,-.5).scale(w,h,d);
 if(part==='green_room_bass_drum')return new T.CylinderGeometry(w/2,w/2,d,24).rotateX(Math.PI/2);
 if(/^green_room_(ottoman|table_top|table_stem|stool|toms|cymbal|pendant|pot)$/.test(part)){
  const taper=part==='green_room_pendant'?0.67:part==='green_room_pot'?1.25:1;
  return new T.CylinderGeometry(w/2,w/(2*taper),h,20).scale(1,1,d/w);
 }
 return null;
}
