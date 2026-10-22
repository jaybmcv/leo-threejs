import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// The captain's hat (revision 6, src/vendor/captain-hat: see its README) that testers wear: anyone holding a tester
// invite, the code that turns on tester feedback. It is the handoff's GLB, the same hat as its procedural source with
// the same axes and origin (+Y up, +Z the visor, the origin at the bottom centre of the band opening), loaded once,
// the first time a hat is wanted, and shared by every hat on screen. A hat is a rigid accessory parented to Cosmo's
// head bone (spine.006: +Y up and +Z forward like the hat, near-metre units), so it turns, nods and bobs with the head.
// FIT is in that bone's local space: how wide the band opening is, where its bottom centre sits and how it tips.
// Fitted with the head's own vertices against the hat's meshes (every head vertex under the crown or below the band, at
// least 12 mm clear): the band opening 0.53 wide, its bottom 0.335 above the bone and 6 cm back, tipped back 8 degrees, so
// both ears sit inside the crown and the visor and shallow badge face forward.
export const FIT={openingWidth:.53,position:[0,.335,-.06],rotation:[-.14,0,0]};
const NOMINAL_OPENING=2.76;

let source=null;
function loadHat(url){
 source??=new GLTFLoader().loadAsync(url).then(gltf=>{
  const hat=gltf.scene.getObjectByName('CaptainsHat')||gltf.scene;
  hat.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return hat;
 }).catch(error=>{source=null;throw error;});
 return source;
}

// Put a hat on a walker (avatar.js createWalker); returns {remove()}. Asking twice keeps the one hat.
export function wearHat(walker,url){
 if(walker.hat)return walker.hat;
 const head=walker.figure.bones.get('spine.006');if(!head)throw new Error('Cosmo has no head bone for the hat');
 const mount=new T.Group();mount.name='CaptainsHatMount';
 const worn={mount,removed:false,remove(){worn.removed=true;mount.removeFromParent();if(walker.hat===worn)walker.hat=null;}};
 walker.hat=worn;fit(mount);head.add(mount);
 // The meshes arrive with the first load; they share its geometry and materials.
 loadHat(url).then(hat=>{if(!worn.removed)mount.add(hat.clone(true));}).catch(()=>{walker.hat=null;mount.removeFromParent();});
 return worn;
}
export function fit(mount,f=FIT){
 mount.position.fromArray(f.position);mount.rotation.set(...f.rotation);mount.scale.setScalar(f.openingWidth/NOMINAL_OPENING);
}
