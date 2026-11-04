import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {walkCanvas} from './canvas.js';

// Wheel dimensions shared by the visual and driving model.
export const CART_WHEELS={wheelbase:2,rearAxle:-1.15,frontAxle:.85,wheel:.29,track:.64};
const MCT=CART_WHEELS;

let template=null;
const mats={};
function materials(){
 if(mats.body)return mats;
 const m=(name,color,o={})=>new T.MeshStandardMaterial({name:'MCT_'+name,color,roughness:.55,...o});
 Object.assign(mats,{body:m('body',0x5f6b73,{metalness:.35,roughness:.48}),dark:m('trim',0x22292d,{roughness:.7}),deck:m('deck',0x3a4247,{roughness:.85}),
  seat:m('seat',0x8a9399,{roughness:.8}),orange:m('frame',0xe8782c,{metalness:.25,roughness:.42}),steel:m('steel',0x9aa6ab,{metalness:.75,roughness:.3}),
  tyre:m('tyre',0x1c2023,{roughness:.9}),hub:m('hub',0x3f6d72,{metalness:.45,roughness:.4}),
  lamp:m('lamp',0xfff4dc,{emissive:0xfff1d0,emissiveIntensity:1.4}),teal:m('glow',0x19c4b6,{emissive:0x19c4b6,emissiveIntensity:1.1}),red:m('tail',0xb02020,{emissive:0xc02020,emissiveIntensity:.8})});
 return mats;
}
// The body as a few merged meshes, one per material, shared by all six carts.
function body(){
 if(template)return template;
 const M=materials(),parts=new Map();
 const add=(geo,mat,at,rot)=>{if(rot)geo.rotateX(rot[0]||0).rotateY(rot[1]||0).rotateZ(rot[2]||0);geo.translate(...at);(parts.get(mat)||parts.set(mat,[]).get(mat)).push(geo);};
 const box=(size,at,mat,rot)=>add(new T.BoxGeometry(...size),mat,at,rot);
 const tube=(a,b,r,mat)=>{const va=new T.Vector3(...a),vb=new T.Vector3(...b),g=new T.CylinderGeometry(r,r,va.distanceTo(vb),10);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),vb.clone().sub(va).normalize()));add(g,mat,va.add(vb).multiplyScalar(.5).toArray());};
 // Chassis and floor plate, front to back.
 box([1.36,.1,3.1],[0,.19,-.32],M.dark);
 box([1.3,.04,1.0],[0,.26,0],M.deck);
 // The nose: a cowl over the front wheels, sloping to the dash, with a bumper, lamps and an orange stripe.
 box([1.46,.48,.8],[0,.54,.88],M.body);
 box([1.4,.16,.5],[0,.84,.68],M.body,[-.35]);
 box([1.24,.2,.16],[0,.9,.44],M.dark);
 box([1.1,.05,.1],[0,1.0,.44],M.teal);
 box([1.52,.14,.14],[0,.3,1.3],M.dark);
 for(const s of [-1,1]){box([.24,.1,.03],[s*.47,.64,1.285],M.lamp);box([.012,.07,.74],[s*.735,.6,.88],M.orange);}
 // The cab: sills each side and the driver's seat in the middle, with a steering wheel on a column.
 for(const s of [-1,1])box([.1,.32,1.04],[s*.68,.42,-.05],M.body);
 box([.36,.3,.34],[0,.36,-.02],M.dark);
 box([.52,.1,.46],[0,.57,-.02],M.seat);
 box([.52,.6,.1],[0,.92,-.3],M.seat,[-.12]);
 tube([0,.5,.42],[0,.88,.3],.025,M.steel);
 add(new T.TorusGeometry(.16,.022,8,24),M.dark,[0,.9,.28],[-.55]);
 // The roll bar behind the driver.
 for(const s of [-1,1]){tube([s*.66,.5,-.6],[s*.66,1.62,-.6],.032,M.orange);tube([s*.66,1.1,-.6],[s*.66,.5,-1.0],.024,M.orange);}
 tube([-.66,1.62,-.6],[.66,1.62,-.6],.032,M.orange);
 // The rear deck, its fenders and the bench facing backwards, with a step for the riders' feet.
 box([1.46,.3,1.24],[0,.35,-1.16],M.body);
 for(const s of [-1,1])box([.2,.1,.72],[s*.68,.62,-1.15],M.dark);
 box([1.24,.1,.44],[0,.57,-1.33],M.seat);
 box([1.24,.52,.1],[0,.88,-1.06],M.seat,[-.1]);
 box([1.2,.05,.28],[0,.2,-1.88],M.steel);
 for(const s of [-1,1]){box([.16,.06,.03],[s*.6,.42,-1.785],M.red);box([.03,.05,.3],[s*.736,.44,-.2],M.teal);}
 template=[...parts].map(([mat,list])=>{const g=mergeGeometries(list);g.computeBoundingSphere();return {mat,g};});
 return template;
}
const tyreGeo=new T.CylinderGeometry(MCT.wheel,MCT.wheel,.2,20).rotateZ(Math.PI/2),hubGeo=new T.CylinderGeometry(.13,.13,.21,12).rotateZ(Math.PI/2),
 boltGeo=new T.BoxGeometry(.215,.04,.05);
// Its number, on the nose and on both sides of the cowl.
function plate(n){
 const canvas=walkCanvas();if(!canvas)return null;canvas.width=256;canvas.height=64;const g=canvas.getContext('2d');
 g.fillStyle='#d9dee0';g.fillRect(0,0,256,64);g.fillStyle='#1d2427';g.font='bold 44px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('MCT-0'+n,128,34);
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
 return new T.MeshStandardMaterial({name:'MCT_number',map:t,roughness:.6});
}
// A cart to draw: `group` is placed at the cart's origin and yaw; pose(steer, roll) turns the wheels.
export function createCartMesh(n){
 const group=new T.Group();group.name='MCT_'+String(n).padStart(2,'0');
 for(const {mat,g} of body()){const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;group.add(m);}
 const number=plate(n);
 if(number){const g=new T.PlaneGeometry(.42,.105);
  for(const [at,yaw] of [[[0,.44,1.284],0],[[.732,.72,.86],Math.PI/2],[[-.732,.72,.86],-Math.PI/2]]){const m=new T.Mesh(g,number);m.position.set(...at);m.rotation.y=yaw;group.add(m);}}
 const wheels=[];
 for(const z of [MCT.frontAxle,MCT.rearAxle])for(const s of [-1,1]){
  const pivot=new T.Group();pivot.position.set(s*MCT.track,MCT.wheel,z);const spin=new T.Group();pivot.add(spin);
  spin.add(new T.Mesh(tyreGeo,materials().tyre),new T.Mesh(hubGeo,materials().hub),new T.Mesh(boltGeo,materials().steel));
  group.add(pivot);wheels.push({pivot,spin,front:z>0});
 }
 return {group,pose(steer,roll){for(const w of wheels){if(w.front)w.pivot.rotation.y=steer;w.spin.rotation.x=roll;}}};
}
