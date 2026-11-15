import * as T from 'three';

// On the Deck 17 promenade's light-strip line, clear of the jaguar and aquarium.
// The hall ceiling underside is 3.54 m; the badge leaves 2.52 m below its rim.
export const HYDRO_NIP_HANGER={at:[-113.5,2.95,-19.4],radius:.43,ceiling:3.54,yaw:Math.PI/2};
const LOGO=typeof __HYDRO_NIP_MAIN_LOGO__==='undefined'?null:__HYDRO_NIP_MAIN_LOGO__;
export function hangHydroNipSign(parent){
 const {at,radius,ceiling,yaw}=HYDRO_NIP_HANGER,depth=.04,group=new T.Group();
 group.name='Hydro_Nip_Promenade_Sign';group.position.set(...at);group.rotation.y=yaw;
 group.userData={noCollide:true,deck:17,assetId:'hydro-nip-main-logo',readableFaces:2};
 const body=new T.MeshStandardMaterial({name:'Hydro_Nip_Hanger_Body',color:0x131127,roughness:.4,metalness:.4});
 const add=(name,geometry,material)=>{const o=new T.Mesh(geometry,material);o.name=name;o.userData.noCollide=true;group.add(o);return o;};
 add('Hydro_Nip_Hanger_Body',new T.CylinderGeometry(radius,radius,depth,64).rotateX(Math.PI/2),body);
 // Reuse the lounge's existing badge and its crop, with separately turned faces.
 let map=null;
 if(LOGO&&typeof document!=='undefined'){
  map=new T.TextureLoader().load(LOGO);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;map.offset.set(.02,.018);map.repeat.set(.96,.964);
 }
 const face=new T.MeshBasicMaterial({name:'Hydro_Nip_Hanger_Logo',map,toneMapped:false});
 const rim=new T.MeshBasicMaterial({name:'Hydro_Nip_Hanger_Neon',color:0x45e3ff,toneMapped:false});
 for(const side of [1,-1]){
  const o=add(side>0?'Hydro_Nip_Hanger_Front':'Hydro_Nip_Hanger_Back',new T.CircleGeometry(radius-.012,64),face);
  o.position.z=side*(depth/2+.002);if(side<0)o.rotation.y=Math.PI;
  add('Hydro_Nip_Hanger_Rim',new T.TorusGeometry(radius-.005,.008,6,64).translate(0,0,side*(depth/2+.003)),rim);
 }
 // Rods meet the ceiling between light fixtures, without crossing a diffuser.
 const shoulder=Math.sqrt(radius*radius-.2*.2),drop=ceiling-at[1]-shoulder;
 for(const side of [-1,1]){
  const rod=add('Hydro_Nip_Hanger_Rod',new T.CylinderGeometry(.009,.009,drop,6),body);
  rod.position.set(side*.2,shoulder+drop/2,0);
 }
 parent.add(group);return group;
}
